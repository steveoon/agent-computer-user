import { z } from "zod/v3";
import type { NdjsonAction } from "@/lib/utils/ndjson-stream";
import type { SyncRecord, SyncResult } from "@/types/duliday-sync";
import {
  GeocodingStatsSchema,
  SyncRecordSchema,
  SyncResultSchema,
  SyncStreamMessageSchema,
} from "@/types/duliday-sync";
import { ZhipinDataSchema } from "@/types/zhipin";

export interface SyncStreamHandlers {
  onProgress?: (payload: {
    progress: number;
    currentOrg?: number;
    message: string;
  }) => void;
  onGeocodingProgress?: (payload: {
    brandName: string;
    processed: number;
    total: number;
    overallProgress: number;
    stats?: unknown;
  }) => void;
}

const MinimalSyncResultSchema = z
  .object({
    success: z.boolean(),
    processedRecords: z.number(),
    storeCount: z.number(),
    brandName: z.string(),
    duration: z.number(),
  })
  .passthrough();

const MinimalSyncRecordSchema = z
  .object({
    id: z.string(),
    timestamp: z.string(),
    results: z.array(z.unknown()),
    organizationIds: z.array(z.union([z.number(), z.string()])).optional(),
    totalDuration: z.number().optional(),
    overallSuccess: z.boolean().optional(),
  })
  .passthrough();

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function normalizeErrors(rawErrors: unknown): string[] {
  if (Array.isArray(rawErrors)) {
    return rawErrors.filter((item): item is string => typeof item === "string");
  }
  if (typeof rawErrors === "string") {
    return [rawErrors];
  }
  return [];
}

function normalizeConvertedData(rawData: unknown, context: string): {
  convertedData: SyncResult["convertedData"];
  warning?: string;
} {
  if (rawData === undefined) {
    return { convertedData: undefined };
  }

  const parsed = ZhipinDataSchema.partial().safeParse(rawData);
  if (!parsed.success) {
    return {
      convertedData: undefined,
      warning: `${context} convertedData 格式异常，已忽略`,
    };
  }

  return { convertedData: parsed.data };
}

function normalizeGeocodingStats(rawStats: unknown): SyncResult["geocodingStats"] {
  if (rawStats === undefined) {
    return undefined;
  }

  const parsed = GeocodingStatsSchema.safeParse(rawStats);
  return parsed.success ? parsed.data : undefined;
}

function normalizeSyncResult(raw: unknown, index: number, context: string): SyncResult {
  const parsed = MinimalSyncResultSchema.safeParse(raw);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message || "unknown";
    throw new Error(`${context} 第 ${index + 1} 条结果格式不正确: ${message}`);
  }

  const data: Record<string, unknown> = parsed.data;
  const totalRecordsRaw = data.totalRecords;
  const totalRecords =
    typeof totalRecordsRaw === "number" ? totalRecordsRaw : parsed.data.processedRecords;

  const errors = normalizeErrors(data.errors);
  const { convertedData, warning } = normalizeConvertedData(data.convertedData, context);
  const geocodingStats = normalizeGeocodingStats(data.geocodingStats);

  if (warning) {
    console.warn(`[sync-stream] ${warning}`);
  }

  const normalized = {
    ...data,
    ...parsed.data,
    totalRecords,
    errors,
    convertedData,
    geocodingStats,
  };

  const resultParsed = SyncResultSchema.safeParse(normalized);
  if (!resultParsed.success) {
    const message = resultParsed.error.issues[0]?.message || "unknown";
    throw new Error(`${context} 第 ${index + 1} 条结果校验失败: ${message}`);
  }

  return resultParsed.data;
}

export function ensureMinimalSyncRecord(payload: unknown, context: string): SyncRecord {
  const parsed = MinimalSyncRecordSchema.safeParse(payload);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message || "unknown";
    throw new Error(`${context} 格式错误: ${message}`);
  }

  const id = parsed.data.id.trim();
  if (!id) {
    throw new Error(`${context} 缺少有效 id`);
  }

  const timestamp = parsed.data.timestamp.trim();
  if (!timestamp) {
    throw new Error(`${context} 缺少有效 timestamp`);
  }
  if (Number.isNaN(Date.parse(timestamp))) {
    throw new Error(`${context} timestamp 格式不正确`);
  }

  if (parsed.data.results.length === 0) {
    throw new Error(`${context} 缺少 results 数据`);
  }

  const results = parsed.data.results.map((item, index) =>
    normalizeSyncResult(item, index, context)
  );

  const organizationIdsRaw = parsed.data.organizationIds ?? [];
  const organizationIds = organizationIdsRaw
    .map(id => (typeof id === "string" ? Number.parseInt(id, 10) : id))
    .filter((id): id is number => Number.isFinite(id));

  const totalDuration =
    typeof parsed.data.totalDuration === "number"
      ? parsed.data.totalDuration
      : results.reduce((sum, result) => sum + result.duration, 0);

  const overallSuccess =
    typeof parsed.data.overallSuccess === "boolean"
      ? parsed.data.overallSuccess
      : results.every(result => result.success);

  const normalized = {
    ...parsed.data,
    id,
    timestamp,
    organizationIds,
    results,
    totalDuration,
    overallSuccess,
  };

  const recordParsed = SyncRecordSchema.safeParse(normalized);
  if (!recordParsed.success) {
    const message = recordParsed.error.issues[0]?.message || "unknown";
    throw new Error(`${context} 校验失败: ${message}`);
  }

  return recordParsed.data;
}

export function createSyncStreamHandler(
  handlers: SyncStreamHandlers = {}
): (data: unknown) => NdjsonAction<SyncRecord> {
  return (data: unknown) => {
    const parsed = SyncStreamMessageSchema.safeParse(data);

    if (!parsed.success) {
      const rawType = isRecord(data) ? data.type : undefined;

      if (rawType === "error") {
        const message = isRecord(data) && typeof data.error === "string"
          ? data.error || "同步请求失败"
          : "同步请求失败";
        return { action: "error", message };
      }

      if (rawType === "result") {
        const payload = isRecord(data) ? data.data : undefined;
        const strict = SyncRecordSchema.safeParse(payload);
        if (strict.success) {
          return { action: "result", value: strict.data };
        }

        const minimal = ensureMinimalSyncRecord(payload, "同步结果");
        return { action: "result", value: minimal };
      }

      return { action: "skip" };
    }

    const msg = parsed.data;

    if (msg.type === "progress") {
      handlers.onProgress?.({
        progress: msg.progress,
        currentOrg: msg.currentOrg,
        message: msg.message,
      });
      return { action: "skip" };
    }

    if (msg.type === "geocoding_progress") {
      handlers.onGeocodingProgress?.({
        brandName: msg.brandName,
        processed: msg.processed,
        total: msg.total,
        overallProgress: msg.overallProgress,
        stats: msg.stats,
      });
      return { action: "skip" };
    }

    if (msg.type === "result") {
      return { action: "result", value: msg.data };
    }

    if (msg.type === "error") {
      return { action: "error", message: msg.error || "同步请求失败" };
    }

    return { action: "skip" };
  };
}
