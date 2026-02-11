/**
 * 类型定义入口文件
 * 统一导出所有类型，避免重复导入
 */

// 从zhipin.ts导出核心业务类型
export type {
  AttendanceRequirement,
  ScheduleType,
  AttendancePolicy,
  TimeSlotAvailability,
  SchedulingFlexibility,
  Position,
  Store,
  Templates,
  ScreeningRules,
  BrandConfig,
  ZhipinData,
  SampleData,
  ReplyContext,
  CandidateInfo,
  ConversationMessage,
  MessageClassification,
  Extract,
  ReplyArgsMap,
  LLMToolArgs,
} from "./zhipin";

export { ATTENDANCE_PATTERNS } from "./zhipin";

// 从config.ts导出配置相关类型
export type {
  SystemPromptsConfig,
  ReplyPolicyConfig,
  LegacyReplyPromptsConfig,
  AppConfigData,
  ConfigService,
  ConfigManagerState,
  BrandPriorityStrategy,
} from "./config";

export { CONFIG_STORAGE_KEY, CONFIG_VERSION } from "./config";

export type {
  FunnelStage,
  ReplyNeed,
  RiskFlag,
  TurnExtractedInfo,
  TurnPlan,
  StageGoalPolicy,
  PersonaPolicy,
  IndustryVoicePolicy,
  HardConstraintRule,
  HardConstraintsPolicy,
  FactGatePolicy,
  AgeQualificationPolicy,
  QualificationPolicy,
} from "./reply-policy";

export {
  FunnelStageSchema,
  ReplyNeedSchema,
  RiskFlagSchema,
  TurnExtractedInfoSchema,
  TurnPlanSchema,
  StageGoalPolicySchema,
  PersonaPolicySchema,
  IndustryVoicePolicySchema,
  HardConstraintRuleSchema,
  HardConstraintsPolicySchema,
  FactGatePolicySchema,
  AgeQualificationPolicySchema,
  QualificationPolicySchema,
  ReplyPolicyConfigSchema,
  DEFAULT_REPLY_POLICY,
} from "./reply-policy";

// 从 image-optimize-type.ts 导出图像优化相关类型（显式导出，避免 tree-shaking 问题）
export type {
  CompressionConfig,
  CompressionResult,
  ImageAnalysis,
  CompressionParams,
  BestCompressionResult,
  OptimalDimensions,
} from "./image-optimize-type";

// 从 feishu.ts 导出飞书相关类型（显式导出，避免 tree-shaking 问题）
export type {
  FeishuNotificationType,
  FeishuNotificationOptions,
  FeishuApiResponse,
  FeishuMessageResult,
  FeishuToolParams,
} from "./feishu";

export { FEISHU_NOTIFICATION_LABELS } from "./feishu";

// 从 geocoding.ts 导出地理编码相关类型
export type {
  Coordinates,
  StoreWithDistance,
  BatchGeocodingStats,
  BatchGeocodingResult,
  AmapMCPResponse,
  MapsGeoParams,
  MapsTextSearchParams,
  MapsSearchDetailParams,
  MapsGeoResult,
  MapsTextSearchResult,
  MapsSearchDetailResult,
  AmapMCPTools,
} from "./geocoding";

export { CoordinatesSchema, CHINA_BOUNDS } from "./geocoding";

// 从 duliday-sync.ts 导出同步相关类型
export type {
  GeocodingStats,
  SyncResult,
  SyncRecord,
  SyncResponse,
  SyncStreamMessage,
  PartialSuccessResponse,
} from "./duliday-sync";

export {
  GeocodingStatsSchema,
  SyncResultSchema,
  SyncRecordSchema,
  SyncResponseSchema,
  SyncStreamMessageSchema,
} from "./duliday-sync";

// AI SDK 相关类型
export type FinishReason =
  | "stop"
  | "length"
  | "content-filter"
  | "tool-calls"
  | "error"
  | "other"
  | "unknown"
  | null;

// 从tool-common.ts导出工具相关类型
export type {
  // 工具注册表类型
  ToolCreationContext,
  ToolDefinition,
  ToolCategory,
  SystemPromptType,
  ToolSet,
  // 工具输出类型
  ToolOutput,
  TextOutput,
  ImageOutput,
  ExtendedToolOutput,
  // 工具部分类型
  ToolPart,
  ToolPartState,
  StructuredToolOutput,
} from "./tool-common";

export {
  // 工具输出模式
  ToolOutputSchema,
  TextOutputSchema,
  ImageOutputSchema,
  ExtendedToolOutputSchema,
  // 工具辅助函数
  isTextOutput,
  isImageOutput,
  isToolPart,
  extractToolName,
  getToolPartState,
  getToolPartInput,
  getToolPartOutput,
  getToolPartErrorText,
  hasToolOutput,
  hasToolError,
  getToolCallId,
  parseToolOutput,
  normalizeToolOutput,
  createTextOutput,
  createImageOutput,
  createErrorOutput,
} from "./tool-common";

// 从api.ts导出API相关类型
export type {
  ChatRequestBody,
  ChatRequestOptions,
  SyncRequestBody,
  SyncResponseBody,
  TestLLMReplyRequestBody,
  TestLLMReplyResponseBody,
  APIErrorResponse,
  APISuccessResponse,
} from "./api";

export { ChatRequestBodySchema, isChatRequestBody, validateChatRequestBody } from "./api";

// 从chat-details.ts导出聊天详情相关类型
export type {
  // 基础类型
  ChatMessageSender,
  ChatMessageType,
  ChatMessage,
  ChatStats,
  UnifiedCandidateInfo,
  ChatDetailsSummary,
  ChatDetailsData,
  ChatDetailsResult,
} from "./chat-details";

export {
  // Zod Schemas
  ChatMessageSenderSchema,
  ChatMessageTypeSchema,
  ChatMessageSchema,
  ChatStatsSchema,
  UnifiedCandidateInfoSchema,
  ChatDetailsSummarySchema,
  ChatDetailsDataSchema,
  ChatDetailsResultSchema,
  // Type Guards
  isChatDetailsResult,
  isSuccessfulChatDetailsResult,
  isErrorChatDetailsResult,
  // Utility Functions
  parseChatDetailsResult,
  extractCandidateName,
  extractTotalMessages,
  getSenderDisplay,
  migrateToUnifiedType,
} from "./chat-details";
