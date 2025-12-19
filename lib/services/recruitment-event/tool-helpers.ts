/**
 * Tool Helpers for Recruitment Event Recording
 *
 * Provides unified helper functions for recording recruitment events from tools.
 * These functions encapsulate the common pattern of:
 * 1. Getting context
 * 2. Parsing candidate info
 * 3. Extracting brand ID
 * 4. Building and recording events
 *
 * @example
 * ```typescript
 * // In a tool's execute function:
 * await recordMessageSentEvent({
 *   platform: SourcePlatform.YUPAO,
 *   candidate: { name, position, age, education },
 *   jobInfo: { jobName },
 *   unreadCount: unreadCountBeforeReply,
 *   message,
 * });
 * ```
 */

import {
  generateCandidateKey,
  generateSessionId,
  type SourcePlatformValue,
} from "@/db/types";
import { recruitmentEventService } from "./service";
import { recruitmentContext } from "./context";
import { extractBrandIdFromJobName } from "./brand-lookup";
import { parseAge, parseSalary } from "./candidate-parser";

const LOG_PREFIX = "[RecruitmentEvent][ToolHelpers]";

/**
 * Raw candidate info as received from tools (before parsing)
 */
export interface RawCandidateInfo {
  name: string;
  position?: string;
  /** Raw age string like "36岁" */
  age?: string;
  education?: string;
  /** Raw salary string like "3000-4000元" */
  expectedSalary?: string;
  expectedLocation?: string;
}

/**
 * Job information for event recording
 */
export interface JobInfo {
  jobId?: number;
  /** Job name (沟通职位/待招岗位), used to extract brand ID */
  jobName?: string;
}

/**
 * Parameters for recording a MESSAGE_SENT event
 */
export interface RecordMessageSentParams {
  platform: SourcePlatformValue;
  candidate: RawCandidateInfo;
  jobInfo?: JobInfo;
  unreadCount: number;
  message: string;
}

/**
 * Parameters for recording a WECHAT_EXCHANGED event
 */
export interface RecordWechatExchangedParams {
  platform: SourcePlatformValue;
  candidate: RawCandidateInfo;
  jobInfo?: JobInfo;
  /** WeChat number if captured */
  wechatNumber?: string;
}

/**
 * Parameters for recording a CANDIDATE_CONTACTED event (proactive outreach via say_hello)
 */
export interface RecordCandidateContactedParams {
  platform: SourcePlatformValue;
  candidate: RawCandidateInfo;
  jobInfo?: JobInfo;
}

/**
 * Record a MESSAGE_SENT event (fire-and-forget)
 *
 * Handles all the common logic:
 * - Getting/overriding context with platform
 * - Parsing age and salary strings
 * - Extracting brand ID from job name
 * - Computing session ID and message sequence
 * - Building and recording the event
 *
 * @param params - Event parameters
 */
export async function recordMessageSentEvent(
  params: RecordMessageSentParams
): Promise<void> {
  const { platform, candidate, jobInfo, unreadCount, message } = params;

  const ctx = recruitmentContext.getContext();
  if (!ctx || !candidate.name) {
    console.warn(`${LOG_PREFIX} Skipping message_sent: missing context or candidate name`);
    return;
  }

  try {
    // Extract brand ID from job name
    const brandId = await extractBrandIdFromJobName(jobInfo?.jobName);

    // Build event with parsed candidate info
    const builder = recruitmentEventService
      .event(ctx)
      .forPlatform(platform)
      .candidate({
        name: candidate.name,
        position: candidate.position,
        age: parseAge(candidate.age),
        education: candidate.education,
        expectedSalary: parseSalary(candidate.expectedSalary),
        expectedLocation: candidate.expectedLocation,
      });

    // Set job info
    if (jobInfo?.jobName) {
      builder.forJob(jobInfo.jobId || 0, jobInfo.jobName);
    }

    // Set brand
    if (brandId) {
      builder.forBrand(brandId);
    }

    // Set unread context
    builder.withUnreadContext(unreadCount);

    // Compute session ID and get next message sequence
    const eventTime = new Date();
    const candidateKey = generateCandidateKey({
      platform,
      candidateName: candidate.name,
      candidatePosition: candidate.position,
    });
    const sessionId = generateSessionId(ctx.agentId, candidateKey, eventTime);
    const messageSequence = await recruitmentEventService.getNextMessageSequence(sessionId);

    builder.at(eventTime).withMessageSequence(messageSequence);

    // Record event (fire-and-forget)
    const event = builder.messageSent(message);
    recruitmentEventService.recordAsync(event);

    console.log(
      `${LOG_PREFIX} Recorded message_sent for: ${candidate.name} (${platform}, unread: ${unreadCount})`
    );
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to record message_sent:`, error);
  }
}

/**
 * Record a WECHAT_EXCHANGED event (fire-and-forget)
 *
 * @param params - Event parameters
 */
export async function recordWechatExchangedEvent(
  params: RecordWechatExchangedParams
): Promise<void> {
  const { platform, candidate, jobInfo, wechatNumber } = params;

  const ctx = recruitmentContext.getContext();
  if (!ctx || !candidate.name) {
    console.warn(`${LOG_PREFIX} Skipping wechat_exchanged: missing context or candidate name`);
    return;
  }

  try {
    // Extract brand ID from job name
    const brandId = await extractBrandIdFromJobName(jobInfo?.jobName);

    // Build event with parsed candidate info
    const builder = recruitmentEventService
      .event(ctx)
      .forPlatform(platform)
      .candidate({
        name: candidate.name,
        position: candidate.position,
        age: parseAge(candidate.age),
        education: candidate.education,
        expectedSalary: parseSalary(candidate.expectedSalary),
        expectedLocation: candidate.expectedLocation,
      });

    // Set job info
    if (jobInfo?.jobName) {
      builder.forJob(jobInfo.jobId || 0, jobInfo.jobName);
    }

    // Set brand
    if (brandId) {
      builder.forBrand(brandId);
    }

    // Record event (fire-and-forget)
    const event = builder.wechatExchanged(wechatNumber);
    recruitmentEventService.recordAsync(event);

    console.log(
      `${LOG_PREFIX} Recorded wechat_exchanged for: ${candidate.name} (${platform})${wechatNumber ? `, wechat: ${wechatNumber}` : ""}`
    );
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to record wechat_exchanged:`, error);
  }
}

/**
 * Record a CANDIDATE_CONTACTED event (fire-and-forget)
 *
 * Used for proactive outreach via say_hello tools.
 * This event represents "we → candidate" proactive contact.
 *
 * @param params - Event parameters
 */
export async function recordCandidateContactedEvent(
  params: RecordCandidateContactedParams
): Promise<void> {
  const { platform, candidate, jobInfo } = params;

  const ctx = recruitmentContext.getContext();
  if (!ctx || !candidate.name) {
    console.warn(`${LOG_PREFIX} Skipping candidate_contacted: missing context or candidate name`);
    return;
  }

  try {
    // Extract brand ID from job name
    const brandId = await extractBrandIdFromJobName(jobInfo?.jobName);

    // Build event with parsed candidate info
    const builder = recruitmentEventService
      .event(ctx)
      .forPlatform(platform)
      .candidate({
        name: candidate.name,
        position: candidate.position,
        age: parseAge(candidate.age),
        education: candidate.education,
        expectedSalary: parseSalary(candidate.expectedSalary),
        expectedLocation: candidate.expectedLocation,
      });

    // Set job info
    if (jobInfo?.jobName) {
      builder.forJob(jobInfo.jobId || 0, jobInfo.jobName);
    }

    // Set brand
    if (brandId) {
      builder.forBrand(brandId);
    }

    // Record event (fire-and-forget)
    const event = builder.candidateContacted();
    recruitmentEventService.recordAsync(event);

    console.log(
      `${LOG_PREFIX} Recorded candidate_contacted for: ${candidate.name} (${platform})`
    );
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to record candidate_contacted:`, error);
  }
}
