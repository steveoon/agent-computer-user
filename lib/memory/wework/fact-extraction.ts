/**
 * 企微私域运营 — 事实提取管道
 *
 * 从对话历史中提取候选人结构化信息（面试信息 + 意向偏好），
 * 与历史 facts 合并后写入会话记忆。
 *
 * 定位：route.ts 的前置处理步骤（非 LLM 工具），通过预处理器注册表调用。
 * 核心价值：品牌别名映射 + 结构化提取规则 + 增量合并。
 */

import type { UIMessage } from "ai";
import { getDynamicRegistry } from "@/lib/model-registry/dynamic-registry";
import { DEFAULT_PROVIDER_CONFIGS, type ModelId } from "@/lib/config/models";
import { safeGenerateObject } from "@/lib/ai";
import {
  EntityExtractionResultSchema,
  type BrandDataList,
  type EntityExtractionResult,
} from "@/lib/tools/wework/types";
import type { WeworkSessionMemory } from "./session-memory";
import { getSharedBrandDictionary } from "@/lib/services/brand-alias/brand-alias.service";

// ========== 品牌数据获取 ==========

/**
 * 从共享品牌别名服务获取品牌数据，转换为 BrandDataList 格式
 */
async function fetchBrandData(): Promise<BrandDataList> {
  const dictionary = await getSharedBrandDictionary();
  return Object.entries(dictionary).map(([name, aliases]) => ({
    name,
    aliases: aliases.filter(a => a !== name),
  }));
}

// ========== 提示词 ==========

const SYSTEM_PROMPT = `你是结构化事实提取引擎，从招募经理与候选人的对话历史中提取结构化事实信息。

## 提取原则
- 累积式：从整个对话历史中累积提取，不只看最后一轮
- 保留原话：除非有特殊说明，字段值保留用户的原始表述
- 合理推理：可以根据上下文语境和常识知识进行合理推断，但不要凭空编造
- 省略缺失：对话中未提及且无法合理推断的字段省略

## 提取字段定义

interview_info（面试信息 —— 预约面试所需，需收集候选人的姓名、联系方式、性别、年龄、应聘门店与岗位、面试时间、是否学生、学历及健康证情况）:
- name: 姓名（如："张三"）
- phone: 联系方式（如："13800138000"）
- gender: 性别（如："男"、"女"）
- age: 年龄（保留原话，如："18"、"25岁"）
- applied_store: 应聘门店（如："人民广场店"）
- applied_position: 应聘岗位（如："服务员"）
- interview_time: 面试时间（如："明天下午2点"）
- is_student: 是否是学生（是、否）

preferences（意向信息）:
- labor_form: 用工形式（兼职、全职、寒假工、暑假工、小时工）
- brands: 意向品牌（数组）
- salary: 意向薪资（如："时薪20"、"4000-5000"）
- position: 意向岗位（如："服务员"、"收银员"）
- schedule: 意向班次/时间（如："周末"、"晚班"）
- city: 意向城市（如："上海"、"杭州"）
- district: 意向区域（如："浦东"、"徐汇"）
- location: 意向地点/商圈（如："人民广场"、"陆家嘴"）

## 推理指导

你不仅要提取对话中明确提到的信息，还需要结合上下文理解和常识知识推理出相关事实。

推理示例：
- 用户说"我在读大三" → is_student: true, education: "本科在读"
- 用户说"我只有周末有空" → labor_form: "兼职", schedule: "周末"
- 用户说"我刚高考完" → is_student: true, labor_form 可能为 "暑假工"
- 用户说"我想在学校附近找个活" → labor_form: "兼职"（学生找工作通常是兼职）
- 用户提到具体学校名 → 可推断 city/district（如果你知道学校所在地）

推理要求：
- 推理必须有合理依据，在 reasoning 字段中说明推理链
- 直接提取的事实和推理得出的事实都要记录
- 推理冲突时以用户明确陈述为准
- 不确定的推理不要填入字段，但可以在 reasoning 中提及

## 提取来源约束（applied_position / applied_store）

- 用户主动提出 → 直接提取（如用户说"我想做分拣"→ applied_position: "分拣"）
- 助手推荐后，用户表示感兴趣/确认/认可（如"嗯嗯"、"好的"、"可以"、继续追问该岗位详情）→ 应提取助手推荐的岗位/门店
- 助手推荐后，用户未回应、话题转移、或明确拒绝 → 不提取
- 提取值应为标准岗位名/门店名，去掉口语化后缀（如"的岗位"、"那个店"等）
- 红线：不可从品牌名称中包含的地名推断意向城市/区域。品牌名中的地名是品牌标识，不代表地理限制（如"成都你六姐"是全国连锁，不可推断城市为成都）
`;

function buildUserPrompt(brandData: BrandDataList, message: string, history: string[]): string {
  const brandInfo =
    brandData.length > 0
      ? brandData.map(brand => `- ${brand.name}（别称：${brand.aliases.join("、")}）`).join("\n")
      : "暂无品牌数据";

  return [
    "[可用品牌信息]",
    brandInfo,
    "",
    "[历史对话]",
    history.join("\n") || "无",
    "",
    "[当前消息]",
    message,
  ].join("\n");
}

// ========== 合并逻辑 ==========

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

/**
 * 深度合并：数组累积去重，基本类型新值覆盖（非空时保留旧值）
 *
 * 注意：LLM 返回 null 时保留旧值（即 null 不覆盖）。
 * 这符合增量提取语义 — null 表示"本轮未提取到"而非"用户主动清除"。
 * 如果需要支持显式清除字段，需引入特殊标记值（当前无此需求）。
 */
function deepMerge(prev: unknown, next: unknown): unknown {
  if (Array.isArray(prev) && Array.isArray(next)) {
    return Array.from(new Set([...prev, ...next]));
  }
  if (isPlainObject(prev) && isPlainObject(next)) {
    const result: Record<string, unknown> = { ...prev };
    for (const key of Object.keys(next)) {
      result[key] = deepMerge(prev[key], next[key]);
    }
    return result;
  }
  return next !== undefined && next !== null && next !== "" ? next : prev;
}

function autoMerge(
  previous: EntityExtractionResult | null,
  newFacts: EntityExtractionResult
): EntityExtractionResult {
  if (!previous) return newFacts;
  return deepMerge(previous, newFacts) as EntityExtractionResult;
}

// ========== 常量 ==========

const INCREMENTAL_MESSAGES = 10;
const FULL_MESSAGES = 50;

const FALLBACK: EntityExtractionResult = {
  interview_info: {
    name: null,
    phone: null,
    gender: null,
    age: null,
    applied_store: null,
    applied_position: null,
    interview_time: null,
    is_student: null,
    education: null,
    has_health_certificate: null,
  },
  preferences: {
    brands: null,
    salary: null,
    position: null,
    schedule: null,
    city: null,
    district: null,
    location: null,
    labor_form: null,
  },
  reasoning: "实体提取失败，使用空值降级",
};

// ========== 导出：提取管道 ==========

/**
 * 事实提取管道 — 从对话历史中提取候选人信息并写入会话记忆
 *
 * 流程：读历史 facts → 确定消息窗口 → 获取品牌数据 → LLM 提取 → 合并 → 写入
 * 调用后通过 sessionMemory.load() + formatSessionMemoryForPrompt() 读取结果。
 */
export async function extractAndSaveFacts(
  sessionMemory: WeworkSessionMemory,
  processedMessages: UIMessage[],
  _dulidayToken?: string
): Promise<void> {
  // 1. 提取对话历史
  const allHistory = processedMessages
    .filter(m => m.role === "user" || m.role === "assistant")
    .map(m => {
      const text = m.parts
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map(p => p.text)
        .join("");
      return `${m.role === "user" ? "用户" : "助手"}: ${text}`;
    })
    .filter(s => s.trim().length > 0);

  const message = allHistory.at(-1) ?? "";
  const conversationHistory = allHistory.slice(0, -1);

  // 2. 获取品牌数据
  const brandData = await fetchBrandData();

  // 3. 增量提取策略
  const previousFacts = await sessionMemory.getFacts();

  const count = previousFacts ? INCREMENTAL_MESSAGES : FULL_MESSAGES;
  const messagesToProcess = conversationHistory.slice(-count);

  console.log(
    `[extractFacts] Cache ${previousFacts ? "hit" : "miss"}, ` +
      `processing last ${count}/${conversationHistory.length} messages ` +
      `(token saving: ${Math.round((1 - count / Math.max(conversationHistory.length, 1)) * 100)}%)`
  );

  // 4. 构建提示词
  const prompt = buildUserPrompt(brandData, message, messagesToProcess);

  // 5. 选择模型 + LLM 推理
  const registry = getDynamicRegistry(DEFAULT_PROVIDER_CONFIGS);
  const modelId = "openai/gpt-5-mini" as ModelId;

  const result = await safeGenerateObject({
    model: registry.languageModel(modelId),
    schema: EntityExtractionResultSchema,
    schemaName: "WeworkCandidateFacts",
    system: SYSTEM_PROMPT,
    prompt,
  });

  const newFacts = result.success
    ? result.data
    : (console.warn("[extractFacts] LLM extraction failed, using fallback"), FALLBACK);

  // 6. 合并 + 写入
  const mergedFacts = autoMerge(previousFacts, newFacts);
  await sessionMemory.saveFacts(mergedFacts);
}
