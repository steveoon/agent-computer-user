/**
 * Classification Agent
 *
 * 使用 AI SDK v6 的 generateObject 实现消息分类
 * 替代原有的 classifyUserMessage() 函数
 *
 * 核心价值:
 * - generateObject 自动将 Zod enum 转换为 JSON Schema 约束
 * - 支持不具备 structuredOutputs 的模型（如 DeepSeek）
 * - 与原有 zhipin-data.loader.ts 中的分类逻辑行为一致
 *
 * 注意: 不使用 ToolLoopAgent + Output.object()，因为当模型不支持
 * structuredOutputs 时，Output.object() 不会将 enum 约束传递给模型
 */

import { generateObject } from "ai";
import { z } from "zod/v3";
import { getDynamicRegistry } from "@/lib/model-registry/dynamic-registry";
import { DEFAULT_MODEL_CONFIG, DEFAULT_PROVIDER_CONFIGS, type ModelId } from "@/lib/config/models";
import { ClassificationPromptBuilder } from "@/lib/prompt-engineering";
import { ReplyContextSchema, MessageClassificationSchema } from "@/types/zhipin";
import {
  ClassificationOptionsSchema,
  BrandDataSchema,
  type ProviderConfigs,
  type ClassificationOptions,
} from "./types";

// ========== Schema 定义 ==========

/**
 * 分类输出 Schema
 * 与现有 MessageClassificationSchema 对齐
 *
 * 使用 ReplyContextSchema (z.enum) 确保 replyType 只能是 16 种有效值之一
 * generateObject 会自动将此 enum 转换为 JSON Schema 约束传递给模型
 *
 * 注意：使用 .nullable() 而非 .optional()
 * OpenAI structuredOutputs 严格模式要求所有属性都在 required 数组中
 * .optional() 会导致属性不在 required 中，从而报错
 * .nullable() 保证属性必须存在，但值可以是 null
 */
const ClassificationOutputSchema = z.object({
  replyType: ReplyContextSchema.describe("回复类型分类"),
  extractedInfo: z
    .object({
      mentionedBrand: z.string().nullable().describe("提到的品牌名称，没有则为 null"),
      city: z.string().nullable().describe("提到的工作城市，没有则为 null"),
      mentionedLocations: z
        .array(
          z.object({
            location: z.string().describe("地点名称"),
            confidence: z.number().min(0).max(1).describe("地点识别置信度 0-1"),
          })
        )
        .max(10)
        .nullable()
        .describe("提到的具体位置（按置信度排序，最多10个），没有则为 null"),
      mentionedDistricts: z
        .array(
          z.object({
            district: z.string().describe("区域名称"),
            confidence: z.number().min(0).max(1).describe("区域识别置信度 0-1"),
          })
        )
        .max(10)
        .nullable()
        .describe("提到的区域（按置信度排序，最多10个），没有则为 null"),
      specificAge: z.number().nullable().describe("提到的具体年龄，没有则为 null"),
      hasUrgency: z.boolean().nullable().describe("是否表达紧急需求，无法判断则为 null"),
      preferredSchedule: z.string().nullable().describe("偏好的工作时间，没有则为 null"),
    })
    .describe("从消息中提取的关键信息"),
  reasoningText: z.string().describe("分类依据和分析过程"),
});

// ========== 便捷函数 ==========

/**
 * 执行消息分类
 *
 * 使用 generateObject 直接调用模型进行分类
 * generateObject 会自动将 Zod schema (包括 z.enum) 转换为 JSON Schema
 * 传递给模型，确保返回值符合约束
 *
 * @param message - 候选人消息
 * @param options - 分类选项
 * @returns 分类结果
 *
 * @example
 * ```typescript
 * const result = await classifyMessage("有什么工作吗？", {
 *   modelConfig: { classifyModel: "deepseek/deepseek-chat" },
 *   conversationHistory: [],
 *   brandData: { city: "上海", defaultBrand: "品牌A", availableBrands: ["品牌A"], storeCount: 10 },
 *   providerConfigs: { ... },
 * });
 * ```
 */
export async function classifyMessage(
  message: string,
  options: Omit<ClassificationOptions, "candidateMessage"> & { providerConfigs?: ProviderConfigs }
): Promise<z.infer<typeof MessageClassificationSchema>> {
  const {
    providerConfigs = DEFAULT_PROVIDER_CONFIGS,
    modelConfig,
    conversationHistory = [],
    brandData,
  } = options;

  // 创建动态 registry
  const registry = getDynamicRegistry(providerConfigs);

  // 获取分类模型
  const classifyModel = (modelConfig?.classifyModel ||
    DEFAULT_MODEL_CONFIG.classifyModel) as ModelId;

  // 构建分类提示
  const classificationBuilder = new ClassificationPromptBuilder();
  const prompts = classificationBuilder.build({
    message,
    conversationHistory,
    brandData,
  });

  // 使用 generateObject 进行分类
  // generateObject 会自动将 ReplyContextSchema (z.enum) 转换为 JSON Schema
  // 模型会收到包含所有 16 种有效值的 enum 约束
  const { object: classification } = await generateObject({
    model: registry.languageModel(classifyModel),
    schema: ClassificationOutputSchema,
    system: prompts.system,
    prompt: prompts.prompt,
  });

  return classification;
}

// ========== 类型导出 ==========

export type ClassificationOutput = z.infer<typeof ClassificationOutputSchema>;
export { ClassificationOptionsSchema, BrandDataSchema };
