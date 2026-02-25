/**
 * 候选人实体提取 Agent
 *
 * 职责：
 * - 从对话历史中提取候选人事实信息
 * - 分为面试信息和意向信息两部分
 * - 品牌识别：将别名映射为正式名称
 * - 累积式提取：从整个对话历史中收集信息
 *
 * 核心原则：
 * - 与阶段无关：全面提取所有事实，不根据阶段选择性提取
 * - 保留原话：除品牌外，所有字段保留用户原话
 * - 客观真实：只提取明确提到的信息，不推测不编造
 */

import { z } from "zod/v3";
import { getDynamicRegistry } from "@/lib/model-registry/dynamic-registry";
import { DEFAULT_MODEL_CONFIG, DEFAULT_PROVIDER_CONFIGS, type ModelId } from "@/lib/config/models";
import { safeGenerateObject } from "@/lib/ai";
import {
  EntityExtractionResultSchema,
  type BrandDataList,
  type EntityExtractionResult,
} from "./types";
import type { ProviderConfigs } from "./types";

// ========== 品牌数据获取 ==========

/**
 * 品牌列表API地址（支持环境变量覆盖）
 * 优先级：BRAND_LIST_API_URL > DULIDAY_API_BASE_URL + /brand/list > 默认地址
 */
const BRAND_LIST_API_URL =
  process.env.BRAND_LIST_API_URL ||
  (process.env.DULIDAY_API_BASE_URL
    ? `${process.env.DULIDAY_API_BASE_URL}/persistence/ai/api/brand/list`
    : "https://k8s.duliday.com/persistence/ai/api/brand/list");

const BRAND_LIST_CACHE_KEY = "duliday:brand-list";
const BRAND_LIST_CACHE_TTL_SECONDS = 30 * 60; // Redis缓存30分钟
const MEMORY_CACHE_TTL_MS = 5 * 60 * 1000; // 内存缓存5分钟

/**
 * 内存缓存（减少Redis网络开销）
 */
let memoryCache: { data: BrandDataList; expiry: number } | null = null;

const BrandListItemSchema = z
  .object({
    name: z.string().optional(),
    brandName: z.string().optional(),
    brand: z.string().optional(),
    brandAlias: z.string().optional(),
    aliases: z.array(z.string()).optional(),
    brandAliasList: z.array(z.string()).optional(),
    aliasList: z.array(z.string()).optional(),
    brandAliases: z.array(z.string()).optional(),
  })
  .passthrough();

const BrandListResponseSchema = z.union([
  z.array(BrandListItemSchema),
  z
    .object({
      brands: z.array(BrandListItemSchema).optional(),
      data: z
        .object({
          brands: z.array(BrandListItemSchema).optional(),
          result: z.array(BrandListItemSchema).optional(),
          list: z.array(BrandListItemSchema).optional(),
        })
        .optional(),
    })
    .passthrough(),
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isNonEmptyString);
}

function extractBrandListFromPayload(payload: unknown): BrandDataList | null {
  const candidates: unknown[] = [];

  if (Array.isArray(payload)) {
    candidates.push(payload);
  }

  if (isRecord(payload)) {
    if (Array.isArray(payload.brands)) {
      candidates.push(payload.brands);
    }

    if (isRecord(payload.data)) {
      if (Array.isArray(payload.data.brands)) {
        candidates.push(payload.data.brands);
      }
      if (Array.isArray(payload.data.result)) {
        candidates.push(payload.data.result);
      }
      if (Array.isArray(payload.data.list)) {
        candidates.push(payload.data.list);
      }
    }
  }

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;

    const mapped = candidate
      .map((item) => {
        if (!isRecord(item)) return null;
        const name =
          (isNonEmptyString(item.name) && item.name) ||
          (isNonEmptyString(item.brandName) && item.brandName) ||
          (isNonEmptyString(item.brand) && item.brand) ||
          (isNonEmptyString(item.brandAlias) && item.brandAlias) ||
          "";
        if (!name) return null;
        const aliases = [
          ...toStringArray(item.aliases),
          ...toStringArray(item.brandAliasList),
          ...toStringArray(item.aliasList),
          ...toStringArray(item.brandAliases),
        ];
        const uniqueAliases = Array.from(new Set(aliases)).filter(alias => alias !== name);
        return { name, aliases: uniqueAliases };
      })
      .filter((item): item is { name: string; aliases: string[] } => item !== null);

    if (mapped.length > 0) {
      return mapped;
    }
  }

  return null;
}

function parseBrandListResponse(payload: unknown): BrandDataList | null {
  const parsed = BrandListResponseSchema.safeParse(payload);
  if (!parsed.success) {
    console.warn("[fetchBrandData] Response schema validation failed:", parsed.error);
    return null;
  }
  return extractBrandListFromPayload(parsed.data);
}

/**
 * 从Redis获取品牌数据（简化版）
 */
async function redisGetJson(key: string): Promise<BrandDataList | null> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!redisUrl || !redisToken) return null;

  try {
    const response = await fetch(`${redisUrl}/get/${encodeURIComponent(key)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${redisToken}` },
    });

    if (!response.ok) return null;

    const payload = await response.json();
    if (!isRecord(payload) || !payload.result) return null;

    // 统一处理：先JSON.parse（如果是字符串），再提取
    const rawResult = payload.result;
    const parsed = typeof rawResult === "string" ? JSON.parse(rawResult) : rawResult;
    return extractBrandListFromPayload(parsed);
  } catch (error) {
    console.warn("[redisGetJson] Failed:", error);
    return null;
  }
}

/**
 * 向Redis存储品牌数据（简化版）
 */
async function redisSetJson(key: string, value: BrandDataList): Promise<void> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!redisUrl || !redisToken) return;

  try {
    const url = `${redisUrl}/setex/${encodeURIComponent(key)}/${BRAND_LIST_CACHE_TTL_SECONDS}/${encodeURIComponent(JSON.stringify(value))}`;
    await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${redisToken}` },
    });
  } catch (error) {
    console.warn("[redisSetJson] Failed:", error);
  }
}

/**
 * 从后端 API 获取品牌数据（三层缓存架构）
 *
 * 缓存策略：
 * 1. 内存缓存（5分钟，无网络开销）
 * 2. Redis缓存（30分钟，减少API调用）
 * 3. API请求（兜底）
 *
 * @returns 品牌数据列表，格式：[{ name: "肯德基", aliases: ["KFC", "开封菜"] }, ...]
 *
 * 错误处理：
 * - 请求失败时返回空数组，保证流程不中断
 * - 数据格式错误时返回空数组
 */
export async function fetchBrandData(): Promise<BrandDataList> {
  try {
    // 1. 检查内存缓存（最快，无网络开销）
    if (memoryCache && Date.now() < memoryCache.expiry) {
      return memoryCache.data;
    }

    // 2. 检查Redis缓存
    const cached = await redisGetJson(BRAND_LIST_CACHE_KEY);
    if (cached && cached.length > 0) {
      // 刷新内存缓存
      memoryCache = { data: cached, expiry: Date.now() + MEMORY_CACHE_TTL_MS };
      return cached;
    }

    // 3. 调用API
    const dulidayToken = process.env.DULIDAY_TOKEN;
    if (!dulidayToken) {
      console.warn("[fetchBrandData] Missing DULIDAY_TOKEN, skipping brand fetch");
      return [];
    }

    const response = await fetch(BRAND_LIST_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Duliday-Token": dulidayToken,
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      console.warn(`[fetchBrandData] HTTP error: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    const brands = parseBrandListResponse(data);

    if (!brands) {
      console.warn("[fetchBrandData] Invalid data format:", data);
      return [];
    }

    // 4. 更新缓存
    await redisSetJson(BRAND_LIST_CACHE_KEY, brands);
    memoryCache = { data: brands, expiry: Date.now() + MEMORY_CACHE_TTL_MS };

    return brands;
  } catch (error) {
    console.warn("[fetchBrandData] Failed to fetch brand data:", error);
    return [];
  }
}

/**
 * 清除品牌数据缓存（用于测试或强制刷新）
 */
export function clearBrandDataCache(): void {
  memoryCache = null;
}

// ========== 提示词构建 ==========

/**
 * 构建实体提取提示词（注入品牌数据）
 *
 * 提示词设计：
 * - 强调全面提取（与阶段无关）
 * - 提供品牌映射信息
 * - 明确字段定义和提取规则
 */
function buildExtractionPrompt(
  message: string,
  history: string[],
  brandData: BrandDataList
): { system: string; prompt: string } {
  const system = [
    "你是招聘对话实体提取器。",
    "从对话历史中提取候选人的所有事实信息。",
    "分为两部分：interview_info（面试信息）和 preferences（意向信息）。",
    "",
    "提取原则：",
    "- 全面提取：只要对话中提到的信息都要提取",
    "- 客观真实：只提取明确提到的信息，不推测不编造",
    "- 累积式：从整个对话历史中累积所有信息",
    "- 与阶段无关：不管在哪个对话阶段，都要全面提取",
  ].join("\n");

  // 构建品牌信息提示
  const brandInfo =
    brandData.length > 0
      ? brandData.map((brand) => `- ${brand.name}（别称：${brand.aliases.join("、")}）`).join("\n")
      : "暂无品牌数据";

  const prompt = [
    "[可用品牌信息]",
    "当前公司合作的品牌及其常见别称：",
    brandInfo,
    "说明：品牌列表仅用于帮助你识别对话中哪些词是品牌实体，提取时保留候选人的原话。",
    "",
    "[提取字段定义]",
    "",
    "interview_info（面试信息）:",
    '- name: 姓名（如："张三"）',
    '- phone: 联系方式（如："13800138000"）',
    '- gender: 性别（如："男"、"女"）',
    '- age: 年龄（保留原话，如："18"、"25岁"）',
    '- applied_store: 应聘门店（如："人民广场店"）',
    '- applied_position: 应聘岗位（如："服务员"）',
    '- interview_time: 面试时间（如："明天下午2点"）',
    '- is_student: 是否是学生（如："是"、"学生"、"否"）',
    "",
    "preferences（意向信息）:",
    '- brands: 意向品牌（数组，保留原话，如：用户说"KFC"就提取["KFC"]，说"肯德基"就提取["肯德基"]）',
    '- salary: 意向薪资（保留原话，如："时薪20"、"4000-5000"）',
    '- position: 意向岗位（如："服务员"、"收银员"）',
    '- schedule: 意向班次/时间（如："周末"、"晚班"）',
    '- cities: 意向城市（数组，如：["上海", "杭州"]）',
    '- district: 意向区域（如："浦东"、"徐汇"）',
    '- location: 意向地点/商圈（如："人民广场"、"陆家嘴"）',
    "",
    "[提取规则]",
    "- 只提取明确提到的信息，不推测不编造",
    '- 保留用户原话：所有字段（包括品牌）都保留用户的原始表述',
    '- 品牌识别：利用品牌列表识别哪些词是品牌，但提取时保持原词（如用户说"KFC"，就提取"KFC"）',
    "- 未提及的字段省略，不要猜测",
    "- 所有字段都用字符串类型（不要转换类型）",
    '- 多个值用数组（如：["KFC", "麦当劳"]）',
    "- 从整个对话历史中累积提取（不只是最后一轮）",
    "",
    "[历史对话]",
    history.join("\n") || "无",
    "",
    "[当前消息]",
    message,
    "",
    "[输出格式]",
    "JSON 对象，包含三个字段：",
    "- interview_info: 对象（未提及的字段省略）",
    "- preferences: 对象（未提及的字段省略）",
    "- reasoning: 简短说明提取了哪些信息",
  ].join("\n");

  return { system, prompt };
}

// ========== 实体提取核心函数 ==========

export interface ExtractCandidateFactsOptions {
  conversationHistory: string[];
  brandData: BrandDataList;
  modelConfig?: {
    extractModel?: string;
  };
  providerConfigs?: ProviderConfigs;
}

/**
 * 从对话历史中提取候选人事实信息
 *
 * @param message - 候选人当前消息
 * @param options - 提取选项
 * @returns 实体提取结果（interview_info + preferences + reasoning）
 *
 * 核心特性：
 * - 与阶段无关：全面提取所有事实
 * - 累积式提取：从整个对话历史中收集信息
 * - 品牌映射：使用 brandData 统一品牌名称
 * - 优雅降级：LLM 失败时返回空对象
 */
export async function extractCandidateFacts(
  message: string,
  options: ExtractCandidateFactsOptions
): Promise<EntityExtractionResult> {
  const {
    conversationHistory = [],
    brandData = [],
    modelConfig,
    providerConfigs = DEFAULT_PROVIDER_CONFIGS,
  } = options;

  // 1. 构建提示词（注入 brandData）
  const prompts = buildExtractionPrompt(message, conversationHistory, brandData);

  // 2. 选择模型
  const registry = getDynamicRegistry(providerConfigs);
  const extractModel = (modelConfig?.extractModel ||
    DEFAULT_MODEL_CONFIG.classifyModel) as ModelId;

  // 3. LLM 推理
  const result = await safeGenerateObject({
    model: registry.languageModel(extractModel),
    schema: EntityExtractionResultSchema,
    schemaName: "CandidateFactsExtraction",
    system: prompts.system,
    prompt: prompts.prompt,
  });

  // 4. 降级策略
  if (!result.success) {
    console.warn("[extractCandidateFacts] LLM extraction failed, using fallback");
    return {
      interview_info: {},
      preferences: {},
      reasoning: "实体提取失败，使用空值降级",
    };
  }

  return result.data;
}
