/**
 * Shared type definitions for chat details tools
 * Used by both Zhipin and Yupao chat details components
 * 
 * These types are derived from Zod schemas to ensure runtime validation
 * and compile-time type safety across recruitment platforms
 */

import { z } from "zod";

// ========== Zod Schemas ==========

/**
 * Chat message sender type schema
 */
export const ChatMessageSenderSchema = z.enum([
  "candidate",   // 候选人
  "recruiter",   // 招聘者
  "system",      // 系统消息
  "unknown"      // 未知发送者
]);

/**
 * Chat message type schema
 */
export const ChatMessageTypeSchema = z.enum([
  "text",              // 文本消息
  "system",            // 系统消息
  "resume",            // 简历信息
  "wechat-exchange"    // 微信交换
]);

/**
 * Single chat message schema
 */
export const ChatMessageSchema = z.object({
  index: z.number().describe("消息索引"),
  sender: ChatMessageSenderSchema,
  messageType: ChatMessageTypeSchema,
  content: z.string().describe("消息内容"),
  time: z.string().describe("消息时间戳"),
  hasTime: z.boolean().describe("是否有时间戳")
});

/**
 * Chat statistics schema
 */
export const ChatStatsSchema = z.object({
  totalMessages: z.number().describe("总消息数"),
  returnedMessages: z.number().optional().describe("返回的消息数"),
  candidateMessages: z.number().describe("候选人消息数"),
  recruiterMessages: z.number().describe("招聘者消息数"),
  systemMessages: z.number().describe("系统消息数"),
  messagesWithTime: z.number().describe("有时间戳的消息数"),
  truncated: z.boolean().optional().describe("是否被截断"),
  dataTruncated: z.boolean().optional().describe("数据是否被截断"),
  originalDataSizeKB: z.number().optional().describe("原始数据大小(KB)")
});

/**
 * Candidate information schema
 * Compatible with both platforms' candidate info structure
 */
export const UnifiedCandidateInfoSchema = z.object({
  name: z.string().optional().describe("候选人姓名"),
  position: z.string().optional().describe("职位"),
  age: z.string().optional().describe("年龄"),
  experience: z.string().optional().describe("工作经验"),
  education: z.string().optional().describe("学历"),
  info: z.array(z.string()).optional().describe("其他信息标签"),
  fullText: z.string().optional().describe("完整文本信息"),
}).loose(); // Allow additional fields for platform-specific data

/**
 * Chat details summary schema
 */
export const ChatDetailsSummarySchema = z.object({
  candidateName: z.string().describe("候选人姓名"),
  candidatePosition: z.string().describe("候选人职位"),
  totalMessages: z.number().describe("总消息数"),
  lastMessageTime: z.string().describe("最后消息时间")
});

/**
 * Chat details data schema
 * The main data structure returned by tools
 */
export const ChatDetailsDataSchema = z.object({
  candidateInfo: UnifiedCandidateInfoSchema.nullable().optional().describe("候选人信息"),
  chatMessages: z.array(ChatMessageSchema).optional().describe("聊天消息列表"),
  formattedHistory: z.array(z.string()).optional().describe("格式化的对话历史"),
  stats: ChatStatsSchema.optional().describe("统计信息"),
  candidateInfoFound: z.boolean().optional().describe("是否找到候选人信息"),
  chatContainerFound: z.boolean().optional().describe("是否找到聊天容器"),
  extractedAt: z.string().optional().describe("提取时间")
});

/**
 * Complete chat details result schema
 * The final output structure from chat details tools
 * 
 * Note: Using strictObject to reject unknown fields and ensure type safety
 */
export const ChatDetailsResultSchema = z.strictObject({
  success: z.boolean().optional().describe("操作是否成功"),
  message: z.string().optional().describe("操作消息"),
  error: z.string().optional().describe("错误信息"),
  data: ChatDetailsDataSchema.optional().describe("聊天详情数据"),
  summary: ChatDetailsSummarySchema.optional().describe("聊天摘要"),
  formattedHistory: z.array(z.string()).optional().describe("格式化的对话历史"),
  rawResult: z.unknown().optional().describe("原始结果(调试用)")
});

// ========== TypeScript Types (derived from Zod schemas) ==========

/**
 * Chat message sender type
 */
export type ChatMessageSender = z.infer<typeof ChatMessageSenderSchema>;

/**
 * Chat message type
 */
export type ChatMessageType = z.infer<typeof ChatMessageTypeSchema>;

/**
 * Single chat message
 */
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

/**
 * Chat statistics
 */
export type ChatStats = z.infer<typeof ChatStatsSchema>;

/**
 * Unified candidate information
 * Used by both Zhipin and Yupao platforms
 */
export type UnifiedCandidateInfo = z.infer<typeof UnifiedCandidateInfoSchema>;

/**
 * Chat details summary
 */
export type ChatDetailsSummary = z.infer<typeof ChatDetailsSummarySchema>;

/**
 * Chat details data
 */
export type ChatDetailsData = z.infer<typeof ChatDetailsDataSchema>;

/**
 * Complete chat details result
 * This is the main type used by tool message components
 */
export type ChatDetailsResult = z.infer<typeof ChatDetailsResultSchema>;

// ========== Type Guards ==========

/**
 * Type guard to check if a value is a valid ChatDetailsResult
 */
export function isChatDetailsResult(value: unknown): value is ChatDetailsResult {
  return ChatDetailsResultSchema.safeParse(value).success;
}

/**
 * Type guard to check if the result is successful
 */
export function isSuccessfulChatDetailsResult(
  result: ChatDetailsResult
): result is ChatDetailsResult & { success: true; data: ChatDetailsData } {
  return result.success === true && result.data !== undefined;
}

/**
 * Type guard to check if the result has an error
 */
export function isErrorChatDetailsResult(
  result: ChatDetailsResult
): result is ChatDetailsResult & { success: false; error: string } {
  return result.success === false && result.error !== undefined;
}

// ========== Utility Functions ==========

/**
 * Safely parse and validate chat details result
 */
export function parseChatDetailsResult(value: unknown): ChatDetailsResult | null {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return null;
  }
  
  const parsed = ChatDetailsResultSchema.safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }
  
  // Check if the value has any of the expected properties
  // If it's a completely unrelated object, return null
  if (typeof value === 'object' && value !== null) {
    const obj = value as any;
    const hasExpectedProps = 
      'success' in obj || 
      'message' in obj || 
      'error' in obj || 
      'data' in obj || 
      'summary' in obj ||
      'formattedHistory' in obj;
    
    if (!hasExpectedProps) {
      console.warn("Object does not appear to be a ChatDetailsResult:", parsed.error);
      return null;
    }
    
    // If it has some expected properties but failed validation,
    // try to return a partial result with what we can salvage
    console.warn("Failed to fully parse chat details result, returning partial:", parsed.error);
    
    // Only return a partial object if at least one property is defined
    const partialResult: any = {};
    let hasDefinedValue = false;
    
    if (obj.success !== undefined) {
      partialResult.success = obj.success;
      hasDefinedValue = true;
    }
    if (obj.message !== undefined) {
      partialResult.message = obj.message;
      hasDefinedValue = true;
    }
    if (obj.error !== undefined) {
      partialResult.error = obj.error;
      hasDefinedValue = true;
    }
    if (obj.data !== undefined) {
      partialResult.data = obj.data;
      hasDefinedValue = true;
    }
    if (obj.summary !== undefined) {
      partialResult.summary = obj.summary;
      hasDefinedValue = true;
    }
    if (obj.formattedHistory !== undefined) {
      partialResult.formattedHistory = obj.formattedHistory;
      hasDefinedValue = true;
    }
    
    // If no properties are defined, return null instead of an empty object
    if (!hasDefinedValue) {
      return null;
    }
    
    return partialResult;
  }
  
  // For non-objects, return null
  console.warn("Invalid type for chat details result:", typeof value);
  return null;
}

/**
 * Extract candidate name from result
 */
export function extractCandidateName(result: ChatDetailsResult): string {
  if (result.summary?.candidateName) {
    return result.summary.candidateName;
  }
  if (result.data?.candidateInfo?.name) {
    return result.data.candidateInfo.name;
  }
  return "未知";
}

/**
 * Extract total message count from result
 */
export function extractTotalMessages(result: ChatDetailsResult): number {
  if (result.summary?.totalMessages !== undefined) {
    return result.summary.totalMessages;
  }
  if (result.data?.stats?.totalMessages !== undefined) {
    return result.data.stats.totalMessages;
  }
  if (result.data?.chatMessages) {
    return result.data.chatMessages.length;
  }
  return 0;
}

/**
 * Get sender display information
 */
export function getSenderDisplay(sender: ChatMessageSender): {
  label: string;
  defaultColor: string;
} {
  switch (sender) {
    case "candidate":
      return { label: "候选人", defaultColor: "text-blue-600 dark:text-blue-400" };
    case "recruiter":
      return { label: "招聘者", defaultColor: "text-green-600 dark:text-green-400" };
    case "system":
      return { label: "系统", defaultColor: "text-gray-500 dark:text-gray-400" };
    default:
      return { label: "未知", defaultColor: "text-gray-400 dark:text-gray-500" };
  }
}

// ========== Migration Helpers ==========

/**
 * Migrate from old inline type to new shared type
 * This helper ensures backward compatibility during migration
 */
export function migrateToUnifiedType(oldResult: any): ChatDetailsResult {
  // If it already matches the new schema, return as-is
  const parsed = ChatDetailsResultSchema.safeParse(oldResult);
  if (parsed.success) {
    return parsed.data;
  }

  // Otherwise, attempt to transform the old structure
  // This handles minor differences in field names or structure
  return {
    success: oldResult?.success,
    message: oldResult?.message,
    error: oldResult?.error,
    data: oldResult?.data,
    summary: oldResult?.summary,
    formattedHistory: oldResult?.formattedHistory,
    rawResult: oldResult?.rawResult
  };
}