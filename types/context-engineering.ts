/**
 * Context Engineering 相关类型定义
 * 为 Context Engineering Prompt Builder 提供严格的类型安全
 */

import { z } from "zod";
import { MessageClassificationSchema, type ReplyContext } from "./zhipin";
// 使用来自lib/tools/zhipin/types的CandidateInfo，因为这是整个项目实际使用的版本
import { CandidateInfoSchema } from "@/lib/tools/zhipin/types";

// ========== Memory System Types ==========

/**
 * 长期内存事实类型
 * 用于存储提取的关键信息
 */
export const LongTermFactSchema = z.union([z.string(), z.number(), z.array(z.string())]);

export type LongTermFact = z.infer<typeof LongTermFactSchema>;

/**
 * 压缩后的长期内存结构
 * 按类型聚合的事实数据
 */
export const CompressedLongTermMemorySchema = z.record(z.string(), z.array(LongTermFactSchema));

export type CompressedLongTermMemory = z.infer<typeof CompressedLongTermMemorySchema>;

/**
 * 基础值类型 - 用于递归定义
 */
const BaseValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

/**
 * 工作内存值类型
 * 存储当前会话的临时状态
 */
export const WorkingMemoryValueSchema: z.ZodSchema = z.lazy(() =>
  z.union([
    BaseValueSchema,
    z.record(z.string(), WorkingMemoryValueSchema),
    z.array(WorkingMemoryValueSchema),
  ])
);

export type WorkingMemoryValue = z.infer<typeof WorkingMemoryValueSchema>;

/**
 * 工作内存记录
 * 键值对形式的工作内存
 */
export const WorkingMemoryRecordSchema = z.record(z.string(), WorkingMemoryValueSchema);

export type WorkingMemoryRecord = z.infer<typeof WorkingMemoryRecordSchema>;

/**
 * 优化后的内存上下文
 * getOptimizedContext 返回值类型
 */
export const OptimizedMemoryContextSchema = z.object({
  recent: z.array(z.string()), // 最近的对话历史
  facts: CompressedLongTermMemorySchema, // 压缩后的长期记忆
  working: WorkingMemoryRecordSchema, // 工作内存
});

export type OptimizedMemoryContext = z.infer<typeof OptimizedMemoryContextSchema>;

// ========== Prompt Building Types ==========

/**
 * 输出格式定义
 */
export const OutputFormatSchema = z.object({
  language: z.string(),
  length: z.object({
    min: z.number(),
    max: z.number(),
  }),
  format: z.string(),
  restrictions: z.array(z.string()),
});

export type OutputFormat = z.infer<typeof OutputFormatSchema>;

/**
 * 角色定义结构
 */
export const RoleDefinitionSchema = z.object({
  identity: z.string(), // 角色身份
  expertise: z.string(), // 专业程度（可衡量）
  personality: z.string(), // 性格特点
  background: z.string(), // 履历背景
});

export type RoleDefinition = z.infer<typeof RoleDefinitionSchema>;

/**
 * 原子化提示结构
 */
export const AtomicPromptSchema = z.object({
  role: RoleDefinitionSchema.optional(), // 角色定义（可选）
  task: z.string(),
  constraints: z.array(z.string()),
  outputFormat: OutputFormatSchema,
});

export type AtomicPrompt = z.infer<typeof AtomicPromptSchema>;

/**
 * 示例结构（用于Few-shot Learning）
 */
export const ExampleSchema = z.object({
  scenario: z.string(),
  input: z.string(),
  output: z.string(),
  reasoning: z.string().optional(),
  context: z.string().optional(), // 可选的上下文信息
  metadata: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]))
    .optional(), // 可选的元数据，使用具体类型
});

export type Example = z.infer<typeof ExampleSchema>;

/**
 * 对话状态
 */
export const ConversationStateSchema = z.object({
  replyType: z.string(),
  sentiment: z.enum(["positive", "neutral", "negative"]).optional(),
  urgency: z.enum(["high", "medium", "low"]).optional(),
});

export type ConversationState = z.infer<typeof ConversationStateSchema>;

/**
 * 提取的事实信息类型
 * 来自 MessageClassification 的 extractedInfo
 */
export const ExtractedFactsSchema = z.object({
  mentionedBrand: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  mentionedLocations: z
    .array(
      z.object({
        location: z.string(),
        confidence: z.number(),
      })
    )
    .nullable()
    .optional(),
  mentionedDistricts: z
    .array(
      z.object({
        district: z.string(),
        confidence: z.number().min(0).max(1),
      })
    )
    .max(3)
    .nullable()
    .optional(),
  specificAge: z.number().nullable().optional(),
  hasUrgency: z.boolean().nullable().optional(),
  preferredSchedule: z.string().nullable().optional(),
});

export type ExtractedFacts = z.infer<typeof ExtractedFactsSchema>;

/**
 * 结构化上下文
 */
export const StructuredContextSchema = z.object({
  conversationState: ConversationStateSchema,
  businessData: z.string(),
  candidateProfile: CandidateInfoSchema.optional(), // 使用具体的 CandidateInfoSchema
  extractedFacts: ExtractedFactsSchema,
});

export type StructuredContext = z.infer<typeof StructuredContextSchema>;

/**
 * 分子上下文结构
 */
export const MolecularContextSchema = z.object({
  instruction: z.string(),
  examples: z.array(ExampleSchema),
  context: StructuredContextSchema,
  newInput: z.string(),
});

export type MolecularContext = z.infer<typeof MolecularContextSchema>;

// ========== Prompt Builder Parameters ==========

/**
 * 构建器配置 Schema
 */
export const BuilderConfigSchema = z.object({
  maxExamples: z.number().optional(), // 最大示例数
  tokenBudget: z.number().optional(), // Token预算
  enableMemory: z.boolean().optional(), // 是否启用记忆管理
  experimentalFieldSupport: z.boolean().optional(), // 实验性：Neural Field支持
});

export type BuilderConfig = z.infer<typeof BuilderConfigSchema>;

/**
 * 构建结果 Schema
 */
export const PromptResultSchema = z.object({
  system: z.string(), // 系统提示
  prompt: z.string(), // 用户提示
  metadata: z
    .object({
      estimatedTokens: z.number().optional(), // 估算的token数
      usedExamples: z.number().optional(), // 使用的示例数
      memoryUsage: z.number().optional(), // 内存使用量
    })
    .optional(),
});

export type PromptResult = z.infer<typeof PromptResultSchema>;

/**
 * buildOptimizedPrompt 方法的参数类型 Schema
 */
export const OptimizedPromptParamsSchema = z.object({
  message: z.string(),
  classification: MessageClassificationSchema, // 使用具体的 MessageClassificationSchema
  contextInfo: z.string(),
  systemInstruction: z.string(),
  conversationHistory: z.array(z.string()),
  candidateInfo: CandidateInfoSchema.optional(),
  targetBrand: z.string().optional(),
});

export type OptimizedPromptParams = z.infer<typeof OptimizedPromptParamsSchema>;

/**
 * buildOptimizedPrompt 方法的返回类型 Schema
 */
export const OptimizedPromptResultSchema = z.object({
  system: z.string(),
  prompt: z.string(),
});

export type OptimizedPromptResult = z.infer<typeof OptimizedPromptResultSchema>;

// ========== Type Guards ==========

/**
 * 通用验证器生成器
 * 为任何 Zod schema 创建完整的验证工具集
 */
export function createValidator<T>(schema: z.ZodSchema<T>) {
  return {
    /**
     * 解析值，失败时抛出错误
     */
    parse: (value: unknown): T => schema.parse(value),

    /**
     * 安全解析值，返回结果对象
     */
    safeParse: (value: unknown) => schema.safeParse(value),

    /**
     * 类型守卫 - 检查值是否符合 schema
     */
    isValid: (value: unknown): value is T => schema.safeParse(value).success,

    /**
     * 获取默认值（如果 schema 定义了默认值）
     */
    getDefault: (): T | undefined => {
      try {
        return schema.parse(undefined);
      } catch {
        return undefined;
      }
    },

    /**
     * 部分验证 - 尝试解析值，返回成功解析的部分
     * 注意：这个方法主要用于调试，不保证完全准确
     */
    partial: (value: unknown): Partial<T> | null => {
      if (typeof value !== "object" || value === null) return null;

      // 尝试使用 schema 的 partial 方法（如果存在）
      try {
        const partialSchema = (schema as any).partial?.();
        if (partialSchema) {
          const result = partialSchema.safeParse(value);
          if (result.success) {
            return result.data;
          }
        }
      } catch {
        // 如果 partial 方法不存在或失败，继续
      }

      // 退回到简单的属性复制
      const parsed = schema.safeParse(value);
      if (parsed.success) {
        return parsed.data as Partial<T>;
      }

      // 如果完整解析失败，返回 null
      return null;
    },
  };
}

// 预定义的验证器将在 schema 定义之后创建

/**
 * 检查是否为有效的工作内存值
 * @deprecated 使用 WorkingMemoryValidator.isValid 代替
 */
export function isWorkingMemoryValue(value: unknown): value is WorkingMemoryValue {
  return WorkingMemoryValidator.isValid(value);
}

/**
 * 检查是否为有效的优化内存上下文
 * @deprecated 使用 OptimizedMemoryContextValidator.isValid 代替
 */
export function isOptimizedMemoryContext(value: unknown): value is OptimizedMemoryContext {
  return OptimizedMemoryContextValidator.isValid(value);
}

/**
 * 检查是否为有效的提取事实
 * @deprecated 使用 ExtractedFactsValidator.isValid 代替
 */
export function isExtractedFacts(value: unknown): value is ExtractedFacts {
  return ExtractedFactsValidator.isValid(value);
}

// ========== Classification Types ==========

/**
 * 分类类型从 types/zhipin.ts 的 ReplyContext 统一引用
 * 避免多处维护，保持单一数据源
 */

// 创建 ClassificationTypes 常量，保持向后兼容的 API
// 这些值必须与 types/zhipin.ts 中的 ReplyContextSchema 保持同步
// 使用 satisfies 确保类型安全
export const ClassificationTypes = {
  // 招聘咨询类 (1-10)
  INITIAL_INQUIRY: "initial_inquiry",
  LOCATION_INQUIRY: "location_inquiry",
  NO_LOCATION_MATCH: "no_location_match",
  SALARY_INQUIRY: "salary_inquiry",
  SCHEDULE_INQUIRY: "schedule_inquiry",
  INTERVIEW_REQUEST: "interview_request",
  AGE_CONCERN: "age_concern",
  INSURANCE_INQUIRY: "insurance_inquiry",
  FOLLOWUP_CHAT: "followup_chat",
  GENERAL_CHAT: "general_chat",

  // 出勤排班类 (11-16)
  ATTENDANCE_INQUIRY: "attendance_inquiry",
  FLEXIBILITY_INQUIRY: "flexibility_inquiry",
  ATTENDANCE_POLICY_INQUIRY: "attendance_policy_inquiry",
  WORK_HOURS_INQUIRY: "work_hours_inquiry",
  AVAILABILITY_INQUIRY: "availability_inquiry",
  PART_TIME_SUPPORT: "part_time_support",
} as const satisfies Record<string, ReplyContext>;

// 使用 ReplyContext 作为分类类型，保持与 zhipin.ts 的一致性
export type ClassificationType = ReplyContext;

// ========== Module-Specific Parameters ==========

/**
 * 分类参数 Schema
 */
export const ClassificationParamsSchema = z.object({
  message: z.string(),
  conversationHistory: z.array(z.string()).optional(),
  contextInfo: z.string().optional(), // 业务上下文信息，用于更准确的分类
  brandData: z
    .object({
      city: z.string(),
      defaultBrand: z.string(),
      availableBrands: z.array(z.string()),
      storeCount: z.number().optional(),
    })
    .optional(),
  candidateInfo: CandidateInfoSchema.optional(),
});

export type ClassificationParams = z.infer<typeof ClassificationParamsSchema>;

/**
 * 回复构建参数 Schema
 */
export const ReplyBuilderParamsSchema = z.object({
  message: z.string(),
  classification: MessageClassificationSchema, // 使用具体的 MessageClassificationSchema
  contextInfo: z.string(),
  systemInstruction: z.string(),
  conversationHistory: z.array(z.string()),
  candidateInfo: CandidateInfoSchema.optional(),
  targetBrand: z.string().optional(),
});

export type ReplyBuilderParams = z.infer<typeof ReplyBuilderParamsSchema>;

/**
 * 回复结果 Schema
 */
export const ReplyResultSchema = PromptResultSchema.extend({
  memoryUpdated: z.boolean().optional(),
});

export type ReplyResult = z.infer<typeof ReplyResultSchema>;

/**
 * 上下文优化器配置 Schema
 */
export const ContextOptimizerConfigSchema = z.object({
  prioritizeBrandSpecific: z.boolean(),
  includeConversationHistory: z.boolean(),
  maxHistoryLength: z.number(),
  includeExtractedFacts: z.boolean(),
});

export type ContextOptimizerConfig = z.infer<typeof ContextOptimizerConfigSchema>;

// ========== Constants ==========

/**
 * 内存管理常量
 */
export const MEMORY_CONSTANTS = {
  DEFAULT_TOKEN_BUDGET: 3000,
  MAX_LONG_TERM_ENTRIES: 30,
  MIN_CONVERSATION_HISTORY: 5,
  TOKEN_ESTIMATE_DIVISOR: 4, // 估算token数：字符长度 / 4
} as const;

/**
 * 提取模式正则表达式
 */
export const EXTRACTION_PATTERNS = {
  location: /(?:在|位于|地址|位置)[：:]\s*([^\s，。]+)/g,
  age: /(\d+)\s*岁/g,
  brand: /品牌[：:]\s*([^\s，。]+)/g,
  schedule: /(?:时间|排班)[：:]\s*([^\s，。]+)/g,
} as const;

/**
 * 紧急度检测关键词
 */
export const URGENCY_KEYWORDS = {
  high: ["急", "马上", "立刻", "现在", "今天", "赶紧"],
  medium: ["尽快", "最近", "这几天", "本周"],
} as const;

/**
 * 默认构建器配置
 */
export const DEFAULT_BUILDER_CONFIG: BuilderConfig = {
  maxExamples: 3,
  tokenBudget: 3000,
  enableMemory: true,
  experimentalFieldSupport: false,
};

// ========== Predefined Validators ==========

/**
 * 预定义的验证器
 * 在所有 schema 定义完成后创建
 */
export const WorkingMemoryValidator = createValidator(WorkingMemoryValueSchema);
export const OptimizedMemoryContextValidator = createValidator(OptimizedMemoryContextSchema);
export const ExtractedFactsValidator = createValidator(ExtractedFactsSchema);
export const BuilderConfigValidator = createValidator(BuilderConfigSchema);
export const PromptResultValidator = createValidator(PromptResultSchema);
export const ClassificationParamsValidator = createValidator(ClassificationParamsSchema);
export const ReplyBuilderParamsValidator = createValidator(ReplyBuilderParamsSchema);
export const ContextOptimizerConfigValidator = createValidator(ContextOptimizerConfigSchema);
