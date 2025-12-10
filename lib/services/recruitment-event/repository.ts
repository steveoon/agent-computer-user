/**
 * Recruitment Events Repository
 *
 * Database operations for recruitment_events table.
 * Uses Drizzle ORM with PostgreSQL.
 */

import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { recruitmentEvents } from "@/db/schema";
import type { RecruitmentEventTypeValue } from "@/db/types";

/**
 * Use Drizzle's native type inference for database operations
 * This avoids type mismatches between drizzle-zod generated types and Drizzle ORM
 */
export type DrizzleInsertEvent = typeof recruitmentEvents.$inferInsert;
export type DrizzleSelectEvent = typeof recruitmentEvents.$inferSelect;

const LOG_PREFIX = "[RecruitmentEvent][Repository]";

/** Maximum retry attempts for database operations */
const MAX_RETRIES = 2;

/** Delay between retries in milliseconds */
const RETRY_DELAY_MS = 500;

/**
 * Sleep utility for retry delay
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry wrapper for database operations
 */
async function withRetry<T>(operation: () => Promise<T>, operationName: string): Promise<T | null> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      console.error(
        `${LOG_PREFIX} ${operationName} failed (attempt ${attempt}/${MAX_RETRIES + 1}):`,
        error
      );

      if (attempt < MAX_RETRIES + 1) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  console.error(`${LOG_PREFIX} ${operationName} exhausted all retries`, lastError);
  return null;
}

class RecruitmentEventsRepository {
  /**
   * Insert a single recruitment event
   *
   * @param event - The event to insert
   * @returns The inserted event or null if failed
   */
  async insert(event: DrizzleInsertEvent): Promise<DrizzleSelectEvent | null> {
    return withRetry(async () => {
      const db = getDb();
      const [result] = await db.insert(recruitmentEvents).values(event).returning();
      console.log(`${LOG_PREFIX} Event inserted: ${result.id} (${result.eventType})`);
      return result;
    }, "insert");
  }

  /**
   * Insert multiple recruitment events in a single transaction
   *
   * @param events - Array of events to insert
   * @returns Number of successfully inserted events
   */
  async insertMany(events: DrizzleInsertEvent[]): Promise<number> {
    if (events.length === 0) return 0;

    const result = await withRetry(async () => {
      const db = getDb();
      const inserted = await db
        .insert(recruitmentEvents)
        .values(events)
        .returning({ id: recruitmentEvents.id });
      console.log(`${LOG_PREFIX} Batch insert: ${inserted.length} events`);
      return inserted.length;
    }, "insertMany");

    return result ?? 0;
  }

  /**
   * Find events by agent ID within a time range
   *
   * @param agentId - The agent ID to filter by
   * @param startTime - Start of time range
   * @param endTime - End of time range
   * @returns Array of matching events
   */
  async findByAgentAndTimeRange(
    agentId: string,
    startTime: Date,
    endTime: Date
  ): Promise<DrizzleSelectEvent[]> {
    const result = await withRetry(async () => {
      const db = getDb();
      return db
        .select()
        .from(recruitmentEvents)
        .where(
          and(
            eq(recruitmentEvents.agentId, agentId),
            gte(recruitmentEvents.eventTime, startTime),
            lte(recruitmentEvents.eventTime, endTime)
          )
        )
        .orderBy(desc(recruitmentEvents.eventTime));
    }, "findByAgentAndTimeRange");

    return result ?? [];
  }

  /**
   * Find events by session ID
   *
   * @param sessionId - The session ID to filter by
   * @returns Array of matching events
   */
  async findBySessionId(sessionId: string): Promise<DrizzleSelectEvent[]> {
    const result = await withRetry(async () => {
      const db = getDb();
      return db
        .select()
        .from(recruitmentEvents)
        .where(eq(recruitmentEvents.sessionId, sessionId))
        .orderBy(recruitmentEvents.eventTime);
    }, "findBySessionId");

    return result ?? [];
  }

  /**
   * Find events by candidate key
   *
   * @param candidateKey - The candidate key to filter by
   * @param limit - Maximum number of results (default: 100)
   * @returns Array of matching events
   */
  async findByCandidateKey(candidateKey: string, limit = 100): Promise<DrizzleSelectEvent[]> {
    const result = await withRetry(async () => {
      const db = getDb();
      return db
        .select()
        .from(recruitmentEvents)
        .where(eq(recruitmentEvents.candidateKey, candidateKey))
        .orderBy(desc(recruitmentEvents.eventTime))
        .limit(limit);
    }, "findByCandidateKey");

    return result ?? [];
  }

  /**
   * Find events by session ID and event type
   *
   * @param sessionId - The session ID to filter by
   * @param eventType - The event type to filter by
   * @returns Array of matching events
   */
  async findBySessionAndType(
    sessionId: string,
    eventType: RecruitmentEventTypeValue
  ): Promise<DrizzleSelectEvent[]> {
    const result = await withRetry(async () => {
      const db = getDb();
      return db
        .select()
        .from(recruitmentEvents)
        .where(
          and(
            eq(recruitmentEvents.sessionId, sessionId),
            eq(recruitmentEvents.eventType, eventType)
          )
        )
        .orderBy(desc(recruitmentEvents.eventTime));
    }, "findBySessionAndType");

    return result ?? [];
  }

  /**
   * Get the maximum message_sequence for a session using SQL aggregation
   *
   * More efficient than fetching all events and iterating in memory.
   *
   * @param sessionId - The session ID to query
   * @returns Maximum message_sequence value, or 0 if no events exist
   */
  async getMaxMessageSequence(sessionId: string): Promise<number> {
    const result = await withRetry(async () => {
      const db = getDb();
      return db
        .select({ maxSeq: sql<number>`COALESCE(MAX(${recruitmentEvents.messageSequence}), 0)` })
        .from(recruitmentEvents)
        .where(eq(recruitmentEvents.sessionId, sessionId));
    }, "getMaxMessageSequence");

    return result?.[0]?.maxSeq ?? 0;
  }
}

/**
 * Singleton instance of RecruitmentEventsRepository
 */
export const recruitmentEventsRepository = new RecruitmentEventsRepository();
