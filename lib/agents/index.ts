/**
 * Agents 模块统一导出
 *
 * 智能回复管道：
 * - classifyMessage: 消息分类（使用 generateText）
 * - generateSmartReply: 智能回复生成（分类 → 上下文 → 回复）
 *
 * 架构说明：
 * 这是确定性的顺序管道，不是代理工作流，因此不使用 ToolLoopAgent。
 */

// ========== Classification ==========
export { classifyMessage, type ClassificationOutput } from "./classification-agent";

// ========== Smart Reply ==========
export {
  generateSmartReply,
  type SmartReplyAgentOptions,
  type SmartReplyAgentResult,
  type SmartReplyDebugInfo,
} from "./smart-reply-agent";

// ========== Types ==========
export {
  // Schema
  ProviderConfigSchema,
  ProviderConfigsSchema,
  ModelConfigSchema,
  ClassificationOptionsSchema,
  BrandDataSchema,
  // Types
  type ProviderConfigs,
  type BrandData,
  type ClassificationOptions,
  type ProviderConfig,
  type ModelConfig,
} from "./types";
