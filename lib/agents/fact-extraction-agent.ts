/**
 * 通用事实提取引擎
 *
 * 职责划分：
 * - 引擎负责：通用提取原则（只提取明确信息、不推测、累积式、保留原话）
 *            + 可选的本地增量缓存策略（历史事实加载、消息裁剪、合并、滑动过期）
 * - 调用方负责：业务上下文（要提取哪些字段、领域知识如品牌数据等、事实合并规则）
 *
 * 扩展示例（新业务场景）：
 * ```typescript
 * const result = await extractFacts(message, history, {
 *   extractionSchemaOutput: MySchema,
 *   schemaName: "MyScenario",
 *   buildUserPrompt: (msg, hist) => buildMyPrompt(msg, hist, myDomainData),
 *   fallback: { clause: undefined, reasoning: "提取失败" },
 *   // 启用本地增量缓存（可选）
 *   cache: { userId, sessionId },
 * });
 * ```
 */

import { getDynamicRegistry } from "@/lib/model-registry/dynamic-registry";
import { DEFAULT_MODEL_CONFIG, DEFAULT_PROVIDER_CONFIGS, type ModelId } from "@/lib/config/models";
import { safeGenerateObject } from "@/lib/ai";
import { localCacheService } from "@/lib/services/local-cache.service";
import type { FactExtractionOptions } from "./types";

// ========== 通用提取原则（引擎语义）==========

/**
 * 引擎内置的通用提取原则，所有业务场景共享
 * 调用方通过 systemContext 补充业务专属说明
 */
const BASE_SYSTEM_PROMPT = [
  "你是结构化事实提取引擎，从对话历史中提取结构化事实信息。",
  "",
  "通用提取原则：",
  "- 客观真实：只提取对话中明确提到的信息，不推测不编造",
  "- 累积式：从整个对话历史中累积提取，不只看最后一轮",
  "- 保留原话：除非有特殊说明，字段值保留用户的原始表述",
  "- 省略缺失：对话中未提及的字段省略，不要填写占位值",
].join("\n");

// ========== 内置合并逻辑 ==========

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

/**
 * 深度自动合并：数组累积去重，其他类型新值覆盖（非空时保留旧值）
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
  // 基本类型：新值非空则覆盖，否则保留旧值
  return next !== undefined && next !== null && next !== "" ? next : prev;
}

function autoMerge<T>(previous: T | null, newFacts: T): T {
  if (!previous) return newFacts;
  return deepMerge(previous, newFacts) as T;
}

// ========== 核心函数 ==========

/**
 * 从对话历史中提取结构化事实
 *
 * 当传入 cache 配置时，引擎自动执行：
 * 1. 从本地缓存加载历史事实
 * 2. 根据缓存状态决定提取策略（增量 10条 / 全量 50条）
 * 3. LLM 提取新事实
 * 4. 合并新旧事实
 * 5. 异步更新本地缓存（滑动 TTL）
 * 6. 返回合并后的完整事实（而非仅新增部分）
 *
 * @param message - 当前消息
 * @param conversationHistory - 完整对话历史（引擎内部按策略裁剪）
 * @param options - 提取配置
 * @returns 提取结果（启用 cache 时为合并后的完整画像）
 */
export async function extractFacts<T>(
  message: string,
  conversationHistory: string[],
  options: FactExtractionOptions<T>
): Promise<T> {
  const {
    extractionSchemaOutput,
    schemaName,
    buildUserPrompt,
    fallback,
    modelConfig,
    cache,
  } = options;

  // 1. 本地增量缓存策略（仅启用 cache 时生效）
  let previousFacts: T | null = null;
  let cacheKey: string | null = null;
  let messagesToProcess = conversationHistory;

  if (cache) {
    const { userId, sessionId, incrementalMessages = 10, fullMessages = 50 } = cache;

    cacheKey = `candidate_facts:${userId}:${sessionId}`;
    previousFacts = await localCacheService.get<T>(cacheKey);

    const count = previousFacts ? incrementalMessages : fullMessages;
    messagesToProcess = conversationHistory.slice(-count);

    console.log(
      `[extractFacts:${schemaName}] Cache ${previousFacts ? "hit" : "miss"}, ` +
        `processing last ${count}/${conversationHistory.length} messages ` +
        `(token saving: ${Math.round((1 - count / Math.max(conversationHistory.length, 1)) * 100)}%)`
    );
  }

  // 2. 构建用户侧提示词（使用裁剪后的消息）
  const prompt = buildUserPrompt(message, messagesToProcess);

  // 3. 选择模型
  const registry = getDynamicRegistry(DEFAULT_PROVIDER_CONFIGS);
  const extractModel = (modelConfig?.extractModel ||
    DEFAULT_MODEL_CONFIG.classifyModel) as ModelId;

  // 4. LLM 推理
  const result = await safeGenerateObject({
    model: registry.languageModel(extractModel),
    schema: extractionSchemaOutput,
    schemaName,
    system: BASE_SYSTEM_PROMPT,
    prompt,
  });

  const newFacts = result.success
    ? result.data
    : (console.warn(`[extractFacts:${schemaName}] LLM extraction failed, using fallback`),
       fallback);

  // 5. 合并 + 异步更新本地缓存（滑动 TTL）
  if (cache && cacheKey) {
    const { ttl = 24 * 60 * 60 } = cache;
    const mergedFacts = autoMerge(previousFacts, newFacts);

    // 异步写入，不阻塞响应返回
    localCacheService.setex(cacheKey, ttl, mergedFacts).catch((err: unknown) => {
      console.warn(`[extractFacts:${schemaName}] Cache save failed:`, err);
    });

    // 返回合并后的完整事实（含历史画像）
    return mergedFacts;
  }

  return newFacts;
}
