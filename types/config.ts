/**
 * 统一配置数据类型定义
 * 用于 localforage 存储的品牌数据和策略配置
 */

import { z } from 'zod/v3';
import { ZhipinDataSchema, ReplyContextSchema, type ZhipinData } from "./zhipin";
import {
  ReplyPolicyConfigSchema,
  type ReplyPolicyConfig,
} from "./reply-policy";

export const BrandPriorityStrategySchema = z.enum([
  "user-selected",
  "conversation-extracted",
  "smart",
]);

export const SystemPromptsConfigSchema = z.object({
  bossZhipinSystemPrompt: z.string(),
  generalComputerSystemPrompt: z.string(),
  bossZhipinLocalSystemPrompt: z.string(),
});

/**
 * 旧版 16 类回复指令（仅用于迁移/备份）
 */
export const LegacyReplyPromptsConfigSchema = z.record(ReplyContextSchema, z.string());

export const AppConfigDataSchema = z.object({
  brandData: ZhipinDataSchema,
  systemPrompts: SystemPromptsConfigSchema,
  replyPolicy: ReplyPolicyConfigSchema,
  activeSystemPrompt: z
    .enum(["bossZhipinSystemPrompt", "generalComputerSystemPrompt", "bossZhipinLocalSystemPrompt"])
    .optional(),
  brandPriorityStrategy: BrandPriorityStrategySchema.optional().default("smart"),
  metadata: z.object({
    version: z.string(),
    lastUpdated: z.string(),
    migratedAt: z.string().optional(),
    upgradedAt: z.string().optional(),
    repairedAt: z.string().optional(),
    backup: z
      .object({
        replyPrompts: z.record(z.string(), z.string()).optional(),
        brandTemplates: z.record(z.string(), z.record(z.string(), z.array(z.string()))).optional(),
        createdAt: z.string().optional(),
      })
      .optional(),
  }),
});

export type BrandPriorityStrategy = z.infer<typeof BrandPriorityStrategySchema>;
export type SystemPromptsConfig = z.infer<typeof SystemPromptsConfigSchema>;
export type LegacyReplyPromptsConfig = z.infer<typeof LegacyReplyPromptsConfigSchema>;
export type AppConfigData = z.infer<typeof AppConfigDataSchema>;

export interface ConfigService {
  getConfig(): Promise<AppConfigData | null>;
  saveConfig(data: AppConfigData): Promise<void>;
  updateBrandData(brandData: ZhipinData): Promise<void>;
  updateSystemPrompts(prompts: SystemPromptsConfig): Promise<void>;
  updateReplyPolicy(policy: ReplyPolicyConfig): Promise<void>;
  updateActiveSystemPrompt(promptType: keyof SystemPromptsConfig): Promise<void>;
  clearConfig(): Promise<void>;
  isConfigured(): Promise<boolean>;
}

export interface ConfigManagerState {
  config: AppConfigData | null;
  isLoading: boolean;
  isConfigured: boolean;
  error: string | null;

  updateBrandData: (brandData: ZhipinData) => Promise<void>;
  updateSystemPrompts: (prompts: SystemPromptsConfig) => Promise<void>;
  updateReplyPolicy: (policy: ReplyPolicyConfig) => Promise<void>;
  reloadConfig: () => Promise<void>;
  clearConfig: () => Promise<void>;
}

export const CONFIG_STORAGE_KEY = "APP_CONFIG_DATA" as const;
export const CONFIG_VERSION = "2.0.0" as const;

export type { ReplyPolicyConfig };
