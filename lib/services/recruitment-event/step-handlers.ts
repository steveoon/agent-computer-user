/**
 * Step Handlers for AI SDK onStepFinish
 *
 * Handles tool results from read-type tools (get_chat_details, get_unread_candidates)
 * and records summary events for statistics.
 *
 * @see AI SDK types: TypedToolCall, TypedToolResult (both have toolCallId, toolName)
 * @see https://sdk.vercel.ai/docs/ai-sdk-core/generating-text#multi-step-calls
 */

import { SourcePlatform, type SourcePlatformValue } from "@/db/types";
import { recruitmentEventService } from "./service";
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
 * Chat details result type (simplified)
 */
interface ChatDetailsResult {
  success: boolean;
  data?: {
    candidateInfo?: {
      name?: string;
      position?: string;
    };
    stats?: {
      totalMessages?: number;
      candidateMessages?: number;
      recruiterMessages?: number;
    };
    extractedAt?: string;
  };
}

/**
 * Unread candidates result type (simplified)
 * Compatible with both zhipin (preview) and yupao (lastMessage, position)
 */
interface UnreadCandidatesResult {
  success: boolean;
  candidates?: Array<{
    name?: string;
    position?: string; // yupao only - used for jobName
    hasUnread?: boolean;
    unreadCount?: number;
    preview?: string; // zhipin
    lastMessage?: string; // yupao
  }>;
}

/**
 * Handle zhipin_get_chat_details tool result
 *
 * Records a candidate_contacted event with chat session stats.
 * Uses existing event type to avoid schema changes.
 *
 * @param ctx - Recruitment context
 * @param result - Tool result
 */
export function handleChatDetailsEvent(ctx: RecruitmentContext, result: unknown): void {
  try {
    const data = result as ChatDetailsResult;
    if (!data?.success || !data?.data) return;

    const { candidateInfo, stats } = data.data;
    if (!candidateInfo?.name) return;

    console.log(
      `📊 [StepHandlers] Recording chat_details event: ${candidateInfo.name} (${ctx.sourcePlatform})`
    );

    // Record as candidate_contacted event with stats in details
    const event = recruitmentEventService
      .event(ctx)
      .candidate({ name: candidateInfo.name, position: candidateInfo.position })
      .candidateContacted(stats?.candidateMessages || 0, `聊天记录读取: 总消息${stats?.totalMessages || 0}条`);

    recruitmentEventService.recordAsync(event);
  } catch (error) {
    // Silent fail - don't affect main flow
    console.warn("[StepHandlers] handleChatDetailsEvent error:", error);
  }
}

/**
 * Handle zhipin_get_unread_candidates_improved tool result
 *
 * Records candidate_contacted events for candidates with unread messages.
 *
 * @param ctx - Recruitment context
 * @param result - Tool result
 */
export function handleUnreadCandidatesEvent(ctx: RecruitmentContext, result: unknown): void {
  try {
    const data = result as UnreadCandidatesResult;
    if (!data?.success || !data?.candidates) return;

    // Only record candidates with unread messages
    const unreadCandidates = data.candidates.filter(c => c.hasUnread && c.name);

    console.log(
      `📊 [StepHandlers] Recording unread_candidates event: ${unreadCandidates.length} candidates (${ctx.sourcePlatform})`
    );

    // Record each candidate as a contacted event
    for (const candidate of unreadCandidates) {
      // Build event with candidate info
      // yupao provides position, zhipin doesn't - use position as jobName when available
      const builder = recruitmentEventService
        .event(ctx)
        .candidate({ name: candidate.name!, position: candidate.position });

      // Set jobName from position if available (yupao only)
      if (candidate.position) {
        builder.forJob(0, candidate.position); // jobId=0 as placeholder, jobName from position
      }

      const event = builder.candidateContacted(
        candidate.unreadCount || 0,
        candidate.preview || candidate.lastMessage // zhipin uses preview, yupao uses lastMessage
      );

      recruitmentEventService.recordAsync(event);
    }
  } catch (error) {
    // Silent fail - don't affect main flow
    console.warn("[StepHandlers] handleUnreadCandidatesEvent error:", error);
  }
}

/**
 * Tool name to handler mapping
 * Supports both zhipin and yupao platforms
 *
 * NOTE: get_chat_details handlers are intentionally excluded to avoid duplicate
 * candidate_contacted events. The get_unread_* tools already record contact events
 * when candidates are first discovered, so reading chat details shouldn't create
 * another contact event.
 */
export const TOOL_HANDLERS: Record<string, (ctx: RecruitmentContext, result: unknown) => void> = {
  // zhipin tools - only unread candidates (contact discovery)
  zhipin_get_unread_candidates_improved: handleUnreadCandidatesEvent,
  // yupao tools - only unread messages (contact discovery)
  yupao_get_unread_messages: handleUnreadCandidatesEvent,
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
