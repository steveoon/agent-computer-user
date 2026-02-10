/**
 * Agents 模块统一导出
 *
 * 智能回复管道：
 * - planTurn / classifyMessage: 回合规划（Policy-First）
 * - generateSmartReply: 智能回复生成（规划 → needs上下文 → 回复）
 *
 * 架构说明：
 * 这是确定性的顺序管道，不是代理工作流，因此不使用 ToolLoopAgent。
 */

// ========== Turn Planning ==========
export {
  planTurn,
  classifyMessage,
  type ClassificationOutput,
  type TurnPlanningOutput,
} from "./classification-agent";

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
  // Utils
  stageToLegacyReplyType,
  // Types
  type ProviderConfigs,
  type BrandData,
  type ClassificationOptions,
  type ProviderConfig,
  type ModelConfig,
} from "./types";
