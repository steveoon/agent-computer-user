/**
 * Recruitment Event Service
 *
 * Main service for recording recruitment events from tools.
 * Provides a clean API for tools to record events without direct database access.
 *
 * @example
 * ```typescript
 * // Simple usage with context
 * const event = recruitmentEventService
 *   .event()
 *   .candidate({ name: "张三" })
 *   .messageSent("您好！");
 * await recruitmentEventService.record(event);
 *
 * // Explicit context (when not in AsyncLocalStorage scope)
 * const event = recruitmentEventService
 *   .event({ agentId: "zhipin-001", sourcePlatform: "zhipin" })
 *   .candidate({ name: "张三" })
 *   .wechatExchanged();
 * await recruitmentEventService.record(event);
 * ```
 */

import { RecruitmentEventBuilder } from "./builder";
import {
  recruitmentEventsRepository,
  type DrizzleInsertEvent,
  type DrizzleSelectEvent,
} from "./repository";
import type { RecruitmentContext } from "./types";
import type { RecruitmentEventTypeValue } from "@/db/types";

const LOG_PREFIX = "[RecruitmentEvent][Service]";

class RecruitmentEventService {
  /**
   * Create a new event builder
   *
   * @param context - Optional explicit context. If not provided, uses AsyncLocalStorage context.
   * @returns A new RecruitmentEventBuilder instance
   */
  event(context?: RecruitmentContext): RecruitmentEventBuilder {
    return new RecruitmentEventBuilder(context);
  }

  /**
   * Record a single event to the database
   *
   * Non-blocking: write failures are logged but don't throw.
   * Validation is handled by Drizzle ORM at insert time.
   *
   * @param event - The event to record
   * @returns The recorded event or null if failed
   */
  async record(event: DrizzleInsertEvent): Promise<DrizzleSelectEvent | null> {
    // Basic validation for required fields
    if (!event.agentId || !event.candidateKey || !event.eventType || !event.eventTime) {
      console.error(`${LOG_PREFIX} Missing required fields:`, {
        agentId: !!event.agentId,
        candidateKey: !!event.candidateKey,
        eventType: !!event.eventType,
        eventTime: !!event.eventTime,
      });
      return null;
    }

    // Write to database (repository handles retries, Drizzle validates schema)
    const result = await recruitmentEventsRepository.insert(event);

    if (!result) {
      console.error(`${LOG_PREFIX} Failed to record event:`, event.eventType);
    }

    return result;
  }

  /**
   * Record multiple events in a batch
   *
   * @param events - Array of events to record
   * @returns Number of successfully recorded events
   */
  async recordBatch(events: DrizzleInsertEvent[]): Promise<number> {
    if (events.length === 0) return 0;

    // Filter to valid events only (basic validation)
    const validEvents = events.filter((event) => {
      const isValid = event.agentId && event.candidateKey && event.eventType && event.eventTime;
      if (!isValid) {
        console.warn(`${LOG_PREFIX} Skipping invalid event: missing required fields`);
        return false;
      }
      return true;
    });

    if (validEvents.length === 0) {
      console.warn(`${LOG_PREFIX} No valid events to record`);
      return 0;
    }

    return await recruitmentEventsRepository.insertMany(validEvents);
  }

  /**
   * Fire-and-forget event recording
   *
   * Use this when you don't need to wait for the result.
   * Errors are logged but never thrown.
   *
   * @param event - The event to record
   */
  recordAsync(event: DrizzleInsertEvent): void {
    this.record(event).catch((error) => {
      console.error(`${LOG_PREFIX} Async record failed:`, error);
    });
  }

  /**
   * Query events by agent and time range
   *
   * @param agentId - Agent ID to filter
   * @param startTime - Start of time range
   * @param endTime - End of time range
   * @returns Array of matching events
   */
  async getEventsByAgentAndTimeRange(
    agentId: string,
    startTime: Date,
    endTime: Date
  ): Promise<DrizzleSelectEvent[]> {
    return recruitmentEventsRepository.findByAgentAndTimeRange(agentId, startTime, endTime);
  }

  /**
   * Query events by session ID
   *
   * @param sessionId - Session ID to filter
   * @returns Array of events in the session
   */
  async getEventsBySessionId(sessionId: string): Promise<DrizzleSelectEvent[]> {
    return recruitmentEventsRepository.findBySessionId(sessionId);
  }

  /**
   * Query events by candidate key
   *
   * @param candidateKey - Candidate key to filter
   * @param limit - Maximum results (default: 100)
   * @returns Array of candidate's events
   */
  async getEventsByCandidateKey(
    candidateKey: string,
    limit?: number
  ): Promise<DrizzleSelectEvent[]> {
    return recruitmentEventsRepository.findByCandidateKey(candidateKey, limit);
  }

  /**
   * Get the next message sequence number for a session
   *
   * Uses SQL aggregation for efficiency instead of fetching all events.
   *
   * @param sessionId - Session ID to query
   * @returns Next sequence number (1-based)
   */
  async getNextMessageSequence(sessionId: string): Promise<number> {
    const maxSeq = await recruitmentEventsRepository.getMaxMessageSequence(sessionId);
    return maxSeq + 1;
  }

  /**
   * Check if a specific event type exists for a session
   *
   * Used to avoid duplicate event recording (e.g., wechat_exchanged)
   *
   * @param sessionId - Session ID to query
   * @param eventType - Event type to check
   * @returns True if at least one event of this type exists
   */
  async hasEventForSession(sessionId: string, eventType: RecruitmentEventTypeValue): Promise<boolean> {
    const events = await recruitmentEventsRepository.findBySessionAndType(sessionId, eventType);
    return events.length > 0;
  }
}

/**
 * Singleton instance of RecruitmentEventService
 */
export const recruitmentEventService = new RecruitmentEventService();
