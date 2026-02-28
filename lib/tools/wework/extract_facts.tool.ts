import { tool } from "ai";
import type { UIMessage } from "ai";
import { z } from "zod/v3";
import { extractFacts } from "@/lib/agents/fact-extraction-agent";
import {
  EntityExtractionResultSchema,
  type BrandDataList,
  type EntityExtractionResult,
} from "./types";
import type { FactCacheOptions } from "@/lib/agents/types";

// ========== 品牌数据获取 ==========

const BRAND_LIST_API_URL = "https://k8s.duliday.com/persistence/ai/api/brand/list";

const MEMORY_CACHE_TTL_MS = 30 * 60 * 1000;

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
    if (Array.isArray(payload.brands)) candidates.push(payload.brands);
    if (isRecord(payload.data)) {
      if (Array.isArray(payload.data.brands)) candidates.push(payload.data.brands);
      if (Array.isArray(payload.data.result)) candidates.push(payload.data.result);
      if (Array.isArray(payload.data.list)) candidates.push(payload.data.list);
    }
  }

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;

    const mapped = candidate
      .map(item => {
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
        return { name, aliases: Array.from(new Set(aliases)).filter(a => a !== name) };
      })
      .filter((item): item is { name: string; aliases: string[] } => item !== null);

    if (mapped.length > 0) return mapped;
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
 * 从后端 API 获取品牌数据（内存缓存 30min → API）
 */
async function fetchBrandData(): Promise<BrandDataList> {
  try {
    if (memoryCache && Date.now() < memoryCache.expiry) return memoryCache.data;

    const dulidayToken = process.env.DULIDAY_TOKEN;
    if (!dulidayToken) {
      console.warn("[fetchBrandData] Missing DULIDAY_TOKEN, skipping brand fetch");
      return [];
    }

    const response = await fetch(BRAND_LIST_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Duliday-Token": dulidayToken },
      body: JSON.stringify({
        page: 1,
        pageSize: 1000,
      }),
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

    memoryCache = { data: brands, expiry: Date.now() + MEMORY_CACHE_TTL_MS };
    return brands;
  } catch (error) {
    console.warn("[fetchBrandData] Failed to fetch brand data:", error);
    return [];
  }
}

// ========== 提示词构建 ==========

function buildWeworkUserPrompt(brandData: BrandDataList) {
  return (message: string, history: string[]): string => {
    const brandInfo =
      brandData.length > 0
        ? brandData.map(brand => `- ${brand.name}（别称：${brand.aliases.join("、")}）`).join("\n")
        : "暂无品牌数据";

    return [
      "[可用品牌信息]",
      brandInfo,
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
      "- brands: 意向品牌（数组，保留原话）",
      '- salary: 意向薪资（保留原话，如："时薪20"、"4000-5000"）',
      '- position: 意向岗位（如："服务员"、"收银员"）',
      '- schedule: 意向班次/时间（如："周末"、"晚班"）',
      '- city: 意向城市（如："上海"、"杭州"）',
      '- district: 意向区域（如："浦东"、"徐汇"）',
      '- location: 意向地点/商圈（如："人民广场"、"陆家嘴"）',
      "",
      "[历史对话]",
      history.join("\n") || "无",
      "",
      "[当前消息]",
      message,
    ].join("\n");
  };
}

// ========== Tool 定义 ==========

const FALLBACK: EntityExtractionResult = {
  interview_info: {},
  preferences: {},
  reasoning: "实体提取失败，使用空值降级",
};

export function createWeworkExtractFactsTool(extractModel?: string, processedMessages?: UIMessage[], userId?: string, sessionId?: string) {
  return tool({
    description:
      "企微智能化：从对话历史中累积提取候选人事实信息（面试信息 + 意向信息），与对话阶段无关，全面客观",
    inputSchema: z.object({}),
    execute: async () => {
      const allHistory = (processedMessages ?? [])
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
      const brandData = await fetchBrandData();

      const cache: FactCacheOptions | undefined =
        userId && sessionId ? { userId, sessionId } : undefined;

      return extractFacts(message, conversationHistory, {
        extractionSchemaOutput: EntityExtractionResultSchema,
        schemaName: "WeworkCandidateFacts",
        buildUserPrompt: buildWeworkUserPrompt(brandData),
        fallback: FALLBACK,
        cache,
        ...(extractModel && {
          modelConfig: { extractModel },
        }),
      });
    },
  });
}
