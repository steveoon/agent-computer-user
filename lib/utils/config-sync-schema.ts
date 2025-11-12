import { z } from "zod";
import { ZhipinDataSchema } from "@/types/zhipin";
import { ReplyPromptsConfigSchema } from "@/types/config";

const MetadataSchema = z.object({
  version: z.string(),
  lastUpdated: z.string(),
  migratedAt: z.string().optional().nullable().default(""),
  upgradedAt: z.string().optional().nullable(),
  repairedAt: z.string().optional().nullable(),
});

/**
 * 数据同步载荷 Schema（来源：浏览器 IndexedDB）
 */
export const ConfigSyncPayloadSchema = z.object({
  brandData: ZhipinDataSchema,
  replyPrompts: ReplyPromptsConfigSchema,
  metadata: MetadataSchema,
});

/**
 * 服务器端持久化 Schema
 */
export const StoredConfigSyncSchema = ConfigSyncPayloadSchema.extend({
  synced: z.boolean().default(true),
  serverSyncedAt: z.string().optional(),
});

export type ConfigSyncPayload = z.infer<typeof ConfigSyncPayloadSchema>;
export type StoredConfigSync = z.infer<typeof StoredConfigSyncSchema>;
