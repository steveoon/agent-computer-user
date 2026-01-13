/**
 * Duliday 同步相关类型定义
 *
 * 统一管理同步服务的 Zod schemas 和 TypeScript 类型
 * 遵循 Schema-First 原则：从 Zod schema 推导 TypeScript 类型
 */

import { z } from "zod/v3";
import { ZhipinDataSchema } from "./zhipin";

// ========== 地理编码统计 ==========

/**
 * 地理编码统计 Schema
 * 用于追踪门店地理编码的处理结果
 */
export const GeocodingStatsSchema = z.object({
  total: z.number(),
  success: z.number(),
  failed: z.number(),
  skipped: z.number(),
  failedStores: z.array(z.string()),
});

export type GeocodingStats = z.infer<typeof GeocodingStatsSchema>;

// ========== 同步结果 ==========

/**
 * 单个品牌的同步结果 Schema
 */
export const SyncResultSchema = z
  .object({
    success: z.boolean(),
    totalRecords: z.number(),
    processedRecords: z.number(),
    storeCount: z.number(),
    brandName: z.string(),
    errors: z.array(z.string()),
    duration: z.number(),
    convertedData: ZhipinDataSchema.partial().optional(),
    geocodingStats: GeocodingStatsSchema.optional(),
  })
  .passthrough();

export type SyncResult = z.infer<typeof SyncResultSchema>;

// ========== 同步记录 ==========

/**
 * 同步历史记录 Schema
 * 包含一次同步操作的完整信息
 */
export const SyncRecordSchema = z
  .object({
    id: z.string(),
    timestamp: z.string(),
    organizationIds: z.array(z.number()),
    results: z.array(SyncResultSchema),
    totalDuration: z.number(),
    overallSuccess: z.boolean(),
  })
  .passthrough();

export type SyncRecord = z.infer<typeof SyncRecordSchema>;

// ========== API 响应类型 ==========

/**
 * 同步 API 响应 Schema
 * 支持两种格式：直接返回 SyncRecord 或包装在 data 字段中
 */
export const SyncResponseSchema = z.union([
  SyncRecordSchema,
  z.object({ data: SyncRecordSchema }).passthrough(),
]);

export type SyncResponse = z.infer<typeof SyncResponseSchema>;

/**
 * 同步流消息 Schema
 * 用于 NDJSON 流式响应的解析
 */
export const SyncStreamMessageSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("result"),
      data: SyncRecordSchema,
    })
    .passthrough(),
  z
    .object({
      type: z.literal("error"),
      error: z.string().optional(),
    })
    .passthrough(),
]);

export type SyncStreamMessage = z.infer<typeof SyncStreamMessageSchema>;

// ========== 部分成功响应 ==========

/**
 * 部分成功的响应接口
 * 用于处理部分职位验证失败的情况
 */
export interface PartialSuccessResponse {
  validPositions: unknown[]; // DulidayRaw.Position[]
  invalidPositions: Array<{
    position: unknown; // Partial<DulidayRaw.Position>
    error: string;
  }>;
  totalCount: number;
}
