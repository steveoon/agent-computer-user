/**
 * Step Handlers for AI SDK onStepFinish
 *
 * Handles tool results from read-type tools (get_chat_details, get_unread_candidates)
 * and records summary events for statistics.
 *
 * @see AI SDK types: TypedToolCall, TypedToolResult (both have toolCallId, toolName)
 * @see https://sdk.vercel.ai/docs/ai-sdk-core/generating-text#multi-step-calls
 */

import {
  SourcePlatform,
  RecruitmentEventType,
  WechatExchangeType,
  type SourcePlatformValue,
  generateCandidateKey,
  generateSessionId,
} from "@/db/types";
import { recruitmentEventService } from "./service";
import { extractBrandIdFromJobName } from "./brand-lookup";
import { parseAge, parseSalary } from "./candidate-parser";
import type { RecruitmentContext } from "./types";

/**
 * Detect source platform from tool name
 */
function detectPlatform(toolName: string): SourcePlatformValue {
  if (toolName.startsWith("yupao_")) return SourcePlatform.YUPAO;
  return SourcePlatform.ZHIPIN;
}

/**
 * Create context with correct sourcePlatform based on tool name
 */
function createPlatformContext(ctx: RecruitmentContext, toolName: string): RecruitmentContext {
  const platform = detectPlatform(toolName);
  if (ctx.sourcePlatform === platform) return ctx;
  return { ...ctx, sourcePlatform: platform };
}

/**
 * Chat message type from get_chat_details
 */
interface ChatMessage {
  sender?: string;
  messageType?: string;
  content?: string;
  time?: string;
}

/**
 * Candidate info type from get_chat_details
 * Updated to match the new structure from zhipin/yupao get-chat-details tools
 */
interface CandidateInfo {
  name?: string;
  position?: string; // 候选人期望职位（如"服务员"）
  communicationPosition?: string; // 沟通职位/待招岗位（如"肯德基-兼职-全市可安排"）
  age?: string; // 如"37岁"
  education?: string; // 如"硕士"
  expectedLocation?: string; // 期望城市（如"上海"）
  expectedSalary?: string; // 期望薪资（如"3-8K"）
  experience?: string;
  gender?: string;
}

/**
 * Chat details result type (simplified)
 */
interface ChatDetailsResult {
  success: boolean;
  data?: {
    candidateInfo?: CandidateInfo;
    chatMessages?: ChatMessage[];
    stats?: {
      totalMessages?: number;
      candidateMessages?: number;
      recruiterMessages?: number;
    };
    extractedAt?: string;
  };
  // For compatibility with different tool output formats
  chatMessages?: ChatMessage[];
  candidateInfo?: CandidateInfo;
}

/**
 * Unread candidates result type (simplified)
 * Compatible with both zhipin (preview) and yupao (lastMessage)
 */
interface UnreadCandidatesResult {
  success: boolean;
  candidates?: Array<{
    name?: string;
    position?: string; // 候选人期望职位 (zhipin: .source-job, yupao: position field)
    hasUnread?: boolean;
    unreadCount?: number;
    preview?: string; // zhipin
    lastMessage?: string; // yupao
  }>;
}

/**
 * Handle zhipin_get_chat_details tool result
 *
 * @deprecated This function is no longer used in TOOL_HANDLERS.
 * Chat details reading doesn't trigger any event in the new model.
 * Events are only recorded when:
 * - MESSAGE_RECEIVED: get_unread_candidates detects unread messages
 * - CANDIDATE_CONTACTED: say_hello sends initial greeting
 * - MESSAGE_SENT: send_message replies to candidate
 * - WECHAT_EXCHANGED: WeChat exchange detected
 *
 * Kept for backward compatibility but does nothing.
 */
export function handleChatDetailsEvent(_ctx: RecruitmentContext, _result: unknown): void {
  // No-op: Chat details reading doesn't trigger events in the new model
  // WeChat exchange detection is handled by handleChatDetailsWechatExchange
}

/**
 * Handle zhipin_get_unread_candidates_improved tool result
 *
 * Records MESSAGE_RECEIVED events for candidates with unread messages.
 * This represents inbound events (candidate → us).
 * Includes deduplication to prevent duplicate events on browser reconnect.
 *
 * @param ctx - Recruitment context
 * @param result - Tool result
 */
export async function handleUnreadCandidatesEvent(
  ctx: RecruitmentContext,
  result: unknown
): Promise<void> {
  try {
    const data = result as UnreadCandidatesResult;
    if (!data?.success || !data?.candidates) return;

    // Only record candidates with unread messages
    const unreadCandidates = data.candidates.filter(c => c.hasUnread && c.name);

    console.log(
      `📊 [RecruitmentEvent][StepHandlers] Processing unread_candidates: ${unreadCandidates.length} candidates (${ctx.sourcePlatform})`
    );

    // Record each candidate as a message_received event (with deduplication)
    for (const candidate of unreadCandidates) {
      // Generate sessionId to check for existing events
      const candidateKey = generateCandidateKey({
        platform: ctx.sourcePlatform,
        candidateName: candidate.name!,
        candidatePosition: candidate.position,
      });
      const sessionId = generateSessionId(ctx.agentId, candidateKey, new Date());

      // Check if message_received event already exists for this session
      const alreadyRecorded = await recruitmentEventService.hasEventForSession(
        sessionId,
        RecruitmentEventType.MESSAGE_RECEIVED
      );

      if (alreadyRecorded) {
        console.log(
          `📊 [RecruitmentEvent][StepHandlers] Skipping duplicate message_received for: ${candidate.name} (session: ${sessionId})`
        );
        continue;
      }

      // Build event with candidate info
      // yupao provides position, zhipin doesn't - use position as jobName when available
      const builder = recruitmentEventService
        .event(ctx)
        .candidate({ name: candidate.name!, position: candidate.position })
        .withUnreadContext(candidate.unreadCount || 0); // Set unread context for Total Flow

      // Set jobName from position if available (yupao only)
      if (candidate.position) {
        builder.forJob(0, candidate.position); // jobId=0 as placeholder, jobName from position
      }

      const event = builder.messageReceived(
        candidate.unreadCount || 0,
        candidate.preview || candidate.lastMessage // zhipin uses preview, yupao uses lastMessage
      );

      recruitmentEventService.recordAsync(event);
      console.log(
        `📊 [RecruitmentEvent][StepHandlers] Recorded message_received for: ${candidate.name} (unread: ${candidate.unreadCount || 0})`
      );
    }
  } catch (error) {
    // Silent fail - don't affect main flow
    console.warn("[RecruitmentEvent][StepHandlers] handleUnreadCandidatesEvent error:", error);
  }
}

/**
 * Handle chat details to detect WeChat exchange initiated by candidate
 *
 * When the candidate shares their WeChat (not via exchange_wechat tool),
 * we detect it from chat messages and record a wechat_exchanged event.
 *
 * @param ctx - Recruitment context
 * @param result - Tool result
 */
export async function handleChatDetailsWechatExchange(
  ctx: RecruitmentContext,
  result: unknown
): Promise<void> {
  try {
    const data = result as ChatDetailsResult;
    if (!data?.success) return;

    // Get candidate info and chat messages from either format
    const candidateInfo = data.data?.candidateInfo || data.candidateInfo;
    const chatMessages = data.data?.chatMessages || data.chatMessages;

    if (!candidateInfo?.name || !chatMessages) return;

    // Find wechat-exchange messages
    const wechatExchangeMessages = chatMessages.filter(
      (msg) => msg.messageType === "wechat-exchange"
    );

    if (wechatExchangeMessages.length === 0) return;

    // 从 communicationPosition（沟通职位）提取 brandId
    const jobName = candidateInfo.communicationPosition;
    const brandId = await extractBrandIdFromJobName(jobName);

    // Generate session ID to check for existing events
    const candidateKey = generateCandidateKey({
      platform: ctx.sourcePlatform,
      candidateName: candidateInfo.name,
      candidatePosition: candidateInfo.position,
    });
    const sessionId = generateSessionId(ctx.agentId, candidateKey, new Date());

    // Check if wechat_exchanged event already exists for this session
    const alreadyRecorded = await recruitmentEventService.hasEventForSession(
      sessionId,
      RecruitmentEventType.WECHAT_EXCHANGED
    );

    if (alreadyRecorded) {
      console.log(
        `📊 [RecruitmentEvent][StepHandlers] WeChat exchange already recorded for session: ${sessionId}`
      );
      return;
    }

    // Extract WeChat number from the message content
    // Format: "微信交换成功 - 微信号: xxx" or just the number
    let wechatNumber: string | undefined;
    for (const msg of wechatExchangeMessages) {
      if (msg.content) {
        // Try to extract WeChat number from content
        const match = msg.content.match(/微信号[：:]\s*(\S+)/);
        if (match) {
          wechatNumber = match[1];
          break;
        }
        // If content is just a number/ID, use it directly
        if (/^[a-zA-Z0-9_-]{5,20}$/.test(msg.content.trim())) {
          wechatNumber = msg.content.trim();
          break;
        }
      }
    }

    console.log(
      `📊 [RecruitmentEvent][StepHandlers] Recording WeChat exchange from chat details: ${candidateInfo.name} (${ctx.sourcePlatform}), WeChat: ${wechatNumber || "unknown"}`
    );

    // Record the wechat_exchanged event with complete candidate info
    // (jobName and brandId already extracted above for sessionId generation)
    const builder = recruitmentEventService
      .event(ctx)
      .candidate({
        name: candidateInfo.name,
        position: candidateInfo.position,
        age: parseAge(candidateInfo.age),
        education: candidateInfo.education,
        expectedSalary: parseSalary(candidateInfo.expectedSalary),
        expectedLocation: candidateInfo.expectedLocation,
      });

    // 设置岗位信息
    if (jobName) {
      builder.forJob(0, jobName);
    }

    // 设置品牌信息
    if (brandId) {
      builder.forBrand(brandId);
    }

    // 从聊天记录检测到的交换 → COMPLETED（已确认成功）
    const event = builder.wechatExchanged(wechatNumber, WechatExchangeType.COMPLETED);
    recruitmentEventService.recordAsync(event);
  } catch (error) {
    // Silent fail - don't affect main flow
    console.warn("[RecruitmentEvent][StepHandlers] handleChatDetailsWechatExchange error:", error);
  }
}

/**
 * Async handler wrapper for TOOL_HANDLERS
 * Since handleChatDetailsWechatExchange is async, we need to wrap it
 */
function wrapAsyncHandler(
  handler: (ctx: RecruitmentContext, result: unknown) => Promise<void>
): (ctx: RecruitmentContext, result: unknown) => void {
  return (ctx, result) => {
    handler(ctx, result).catch((error) => {
      console.warn("[RecruitmentEvent][StepHandlers] Async handler error:", error);
    });
  };
}

/**
 * Tool name to handler mapping
 * Supports both zhipin and yupao platforms
 */
export const TOOL_HANDLERS: Record<string, (ctx: RecruitmentContext, result: unknown) => void> = {
  // zhipin tools
  zhipin_get_unread_candidates_improved: wrapAsyncHandler(handleUnreadCandidatesEvent),
  zhipin_get_chat_details: wrapAsyncHandler(handleChatDetailsWechatExchange),
  // yupao tools
  yupao_get_unread_messages: wrapAsyncHandler(handleUnreadCandidatesEvent),
  yupao_get_chat_details: wrapAsyncHandler(handleChatDetailsWechatExchange),
};

/**
 * AI SDK TypedToolCall - used in StepResult.toolCalls (onStepFinish)
 *
 * Note: This differs from ToolCallPart (model messages) which uses `args`.
 * StepResult types use `input` for the parsed tool arguments.
 *
 * @see node_modules/ai/dist/index.d.ts - StaticToolCall, DynamicToolCall
 * @see https://ai-sdk.dev/docs/reference/ai-sdk-core/model-message - ToolCallPart (different type)
 */
export interface ToolCallLike {
  type: "tool-call";
  toolCallId: string;
  toolName: string;
  input?: unknown; // Parsed arguments (StaticToolCall uses typed input)
}

/**
 * AI SDK TypedToolResult - used in StepResult.toolResults (onStepFinish)
 *
 * Note: This differs from ToolResultPart (model messages) which wraps output
 * in LanguageModelV2ToolResultOutput. StepResult types use raw `output`.
 *
 * @see node_modules/ai/dist/index.d.ts - StaticToolResult, DynamicToolResult
 * @see https://ai-sdk.dev/docs/reference/ai-sdk-core/model-message - ToolResultPart (different type)
 */
export interface ToolResultLike {
  type: "tool-result";
  toolCallId: string;
  toolName: string;
  output: unknown; // Raw tool return value (InferToolOutput<TOOL>)
}

/**
 * Process tool results from onStepFinish
 *
 * Uses AI SDK's StepResult structure where:
 * - toolCalls: Array<TypedToolCall<TOOLS>>
 * - toolResults: Array<TypedToolResult<TOOLS>>
 *
 * @param ctx - Recruitment context
 * @param toolCalls - Array of tool calls from the step (AI SDK TypedToolCall)
 * @param toolResults - Array of tool results from the step (AI SDK TypedToolResult)
 */
export function processStepToolResults(
  ctx: RecruitmentContext,
  toolCalls: ReadonlyArray<ToolCallLike>,
  toolResults: ReadonlyArray<ToolResultLike>
): void {
  if (!toolCalls || !toolResults || toolResults.length === 0) return;

  for (const tc of toolCalls) {
    const handler = TOOL_HANDLERS[tc.toolName];
    if (!handler) continue;

    const resultEntry = toolResults.find(r => r.toolCallId === tc.toolCallId);
    if (!resultEntry) continue;

    // Create context with correct sourcePlatform based on tool name (zhipin vs yupao)
    const platformCtx = createPlatformContext(ctx, tc.toolName);

    // AI SDK uses 'output' property for tool execution results
    handler(platformCtx, resultEntry.output);
  }
}
