/**
 * Prompt Engineering Module
 *
 * 基于Context Engineering原则的统一提示构建框架
 * 为分类和回复模型提供优化的prompt构建能力
 */

// ========== 核心构建器 ==========
export { BasePromptBuilder } from "./core/base-prompt-builder";
export { ClassificationPromptBuilder, classificationBuilder } from "./core/classification-builder";
export { TurnPlanningPromptBuilder, planningBuilder } from "./core/planning-builder";
export { ReplyPromptBuilder, replyBuilder } from "./core/reply-builder";

// ========== 内存管理 ==========
export { CellularMemoryManager } from "./memory/cellular-memory-manager";

// ========== 示例库 ==========
export { ReplyExampleRepository, replyExampleRepository } from "./examples/reply-examples";

// ========== 类型导出 ==========
// 所有类型都从统一的类型文件导出
export type {
  // Base types
  AtomicPrompt,
  MolecularContext,
  Example,
  BuilderConfig,
  PromptResult,
  // Classification types
  ClassificationParams,
  ClassificationType,
  ExtractedFacts,
  ExtractedFacts as ExtractedInfo, // 向后兼容
  // Reply types
  ReplyBuilderParams,
  ReplyResult,
  ContextOptimizerConfig,
  // Memory types
  OptimizedMemoryContext,
  WorkingMemoryValue,
  WorkingMemoryRecord,
  LongTermFact,
  CompressedLongTermMemory,
  // Other types
  StructuredContext,
  ConversationState,
  OutputFormat,
} from "@/types/context-engineering";

// ========== 常量导出 ==========
export { ClassificationTypes } from "./core/classification-builder";
export { DEFAULT_BUILDER_CONFIG } from "@/types/context-engineering";

// ========== 工厂函数 ==========

import { ClassificationPromptBuilder } from "./core/classification-builder";
import { ReplyPromptBuilder } from "./core/reply-builder";
import { TurnPlanningPromptBuilder } from "./core/planning-builder";
import type { BuilderConfig } from "@/types/context-engineering";

/**
 * 创建分类提示构建器实例
 */
export function createClassificationBuilder(config?: Partial<BuilderConfig>) {
  return new ClassificationPromptBuilder(config);
}

/**
 * 创建回复提示构建器实例
 */
export function createReplyBuilder(config?: Partial<BuilderConfig>) {
  return new ReplyPromptBuilder(config);
}

/**
 * 创建回合规划提示构建器实例
 */
export function createPlanningBuilder(config?: Partial<BuilderConfig>) {
  return new TurnPlanningPromptBuilder(config);
}

// ========== 预设配置 ==========

/**
 * 高性能配置（减少示例和token使用）
 */
export const HIGH_PERFORMANCE_CONFIG = {
  maxExamples: 1,
  tokenBudget: 1500,
  enableMemory: false,
};

/**
 * 高质量配置（更多示例和上下文）
 */
export const HIGH_QUALITY_CONFIG = {
  maxExamples: 5,
  tokenBudget: 4000,
  enableMemory: true,
};

/**
 * 平衡配置（默认）
 */
export const BALANCED_CONFIG = {
  maxExamples: 3,
  tokenBudget: 2500,
  enableMemory: true,
};
