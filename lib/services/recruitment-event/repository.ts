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
import { recruitmentStatsRepository } from "@/lib/services/recruitment-stats";
import { toBeijingMidnight, toBeijingDayEnd } from "@/lib/utils/beijing-timezone";

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
    const result = await withRetry(async () => {
      const db = getDb();
      const [inserted] = await db.insert(recruitmentEvents).values(event).returning();
      console.log(`${LOG_PREFIX} Event inserted: ${inserted.id} (${inserted.eventType})`);
      return inserted;
    }, "insert");

    // 标记统计数据为脏（需要重新聚合）
    if (result) {
      // 1. 始终标记汇总行（brand_id: null, job_id: null）为脏
      recruitmentStatsRepository
        .markDirty(result.agentId, result.eventTime, null, null)
        .catch((err) => {
          console.warn(`${LOG_PREFIX} Failed to mark aggregate stats dirty:`, err);
        });

      // 2. 如果有具体 brand/job，也标记该维度为脏
      if (result.brandId !== null || result.jobId !== null) {
        recruitmentStatsRepository
          .markDirty(
            result.agentId,
            result.eventTime,
            result.brandId ?? undefined,
            result.jobId ?? undefined
          )
          .catch((err) => {
            console.warn(`${LOG_PREFIX} Failed to mark dimension stats dirty:`, err);
          });
      }
    }

    return result;
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

  /**
   * 获取所有有事件记录的 Agent ID
   *
   * 用于全量重算
   */
  async getDistinctAgents(): Promise<string[]> {
    const result = await withRetry(async () => {
      const db = getDb();
      return db
        .selectDistinct({
          agentId: recruitmentEvents.agentId,
        })
        .from(recruitmentEvents);
    }, "getDistinctAgents");

    return result?.map(r => r.agentId) ?? [];
  }

  /**
   * 获取某个 Agent 有事件的所有日期
   *
   * 用于全量重算
   */
  async getDistinctEventDates(agentId: string): Promise<Date[]> {
    const result = await withRetry(async () => {
      const db = getDb();
      // 使用 date_trunc 获取北京时间当天0点对应的 UTC 时间
      // PostgreSQL 数据库时区已设为 Asia/Shanghai
      // 注意：ORDER BY 表达式必须和 SELECT DISTINCT 完全一致
      const dateExpr = sql<Date>`date_trunc('day', ${recruitmentEvents.eventTime} AT TIME ZONE 'Asia/Shanghai') AT TIME ZONE 'Asia/Shanghai'`;
      return db
        .selectDistinct({
          date: dateExpr,
        })
        .from(recruitmentEvents)
        .where(eq(recruitmentEvents.agentId, agentId))
        .orderBy(dateExpr);
    }, "getDistinctEventDates");

    // 结果已经是正确的 UTC 时间戳（北京时间0点对应的UTC时间）
    return result?.map(r => new Date(r.date)) ?? [];
  }

  /**
   * 获取某个 Agent 某天的所有品牌-岗位组合
   *
   * 用于细粒度聚合
   */
  async getDistinctDimensions(
    agentId: string,
    date: Date
  ): Promise<{ brandId: number | null; jobId: number | null }[]> {
    // 使用北京时间边界
    const dayStart = toBeijingMidnight(date);
    const dayEnd = toBeijingDayEnd(dayStart);

    const result = await withRetry(async () => {
      const db = getDb();
      return db
        .selectDistinct({
          brandId: recruitmentEvents.brandId,
          jobId: recruitmentEvents.jobId,
        })
        .from(recruitmentEvents)
        .where(
          and(
            eq(recruitmentEvents.agentId, agentId),
            gte(recruitmentEvents.eventTime, dayStart),
            lte(recruitmentEvents.eventTime, dayEnd)
          )
        );
    }, "getDistinctDimensions");

    return result ?? [];
  }
}

/**
 * Singleton instance of RecruitmentEventsRepository
 */
export const recruitmentEventsRepository = new RecruitmentEventsRepository();
