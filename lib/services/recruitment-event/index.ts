/**
 * Recruitment Event Service Module
 *
 * Unified entry point for recording recruitment events from tools.
 *
 * @example
 * ```typescript
 * import {
 *   recruitmentEventService,
 *   recruitmentContext,
 *   parseMessageTime,
 * } from "@/lib/services/recruitment-event";
 *
 * // Set context at session start
 * recruitmentContext.run(
 *   { agentId: "zhipin-001", sourcePlatform: "zhipin" },
 *   async () => {
 *     // Record events within tools
 *     const event = recruitmentEventService
 *       .event()
 *       .candidate({ name: "张三" })
 *       .at(new Date())
 *       .messageSent("您好！");
 *
 *     await recruitmentEventService.record(event);
 *   }
 * );
 * ```
 */

// Main service (singleton)
export { recruitmentEventService } from "./service";

// Context manager (singleton)
export { recruitmentContext } from "./context";

// Builder class (for advanced usage)
export { RecruitmentEventBuilder } from "./builder";

// Repository (for direct database access if needed)
export {
  recruitmentEventsRepository,
  type DrizzleInsertEvent,
  type DrizzleSelectEvent,
} from "./repository";

// Time parser utility
export { parseMessageTime, formatDateForSession } from "./time-parser";

// Brand lookup utility
export { extractBrandIdFromJobName } from "./brand-lookup";

// Candidate info parser utilities
export { parseAge, parseSalary } from "./candidate-parser";

// Tool helper functions for recording events
export {
  recordMessageSentEvent,
  recordWechatExchangedEvent,
  type RawCandidateInfo,
  type JobInfo,
  type RecordMessageSentParams,
  type RecordWechatExchangedParams,
} from "./tool-helpers";

// Key generation utilities (for computing sessionId to get message sequence)
export { generateCandidateKey, generateSessionId } from "@/db/types";

// Step handlers for onStepFinish integration
export {
  handleChatDetailsEvent,
  handleUnreadCandidatesEvent,
  processStepToolResults,
  TOOL_HANDLERS,
  type ToolCallLike,
  type ToolResultLike,
} from "./step-handlers";

// Types
export type {
  RecruitmentContext,
  CandidateSnapshot,
  MessageSentOptions,
  InterviewBookingDetails,
  MessageSenderType,
} from "./types";
