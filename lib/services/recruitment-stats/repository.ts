/**
 * Recruitment Stats Repository
 *
 * 统计数据的数据库操作
 * 使用 Drizzle ORM with PostgreSQL
 */

import { eq, and, gte, lte, sql, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { recruitmentDailyStats } from "@/db/schema";
import { toBeijingMidnight } from "@/lib/utils/beijing-timezone";
import type { DirtyRecord, DailyStatsRecord } from "./types";

const LOG_PREFIX = "[RecruitmentStats][Repository]";

/** 最大重试次数 */
const MAX_RETRIES = 2;

/** 重试间隔（毫秒） */
const RETRY_DELAY_MS = 500;

/**
 * Drizzle 类型推断
 */
export type DrizzleInsertStats = typeof recruitmentDailyStats.$inferInsert;
export type DrizzleSelectStats = typeof recruitmentDailyStats.$inferSelect;

/**
 * Sleep 工具函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 重试包装器
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


/**
 * 计算百分比率（结果 * 100，如 85.5% = 8550）
 */
function calculateRate(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return Math.round((numerator / denominator) * 10000);
}

class RecruitmentStatsRepository {
  /**
   * 查找所有需要重新聚合的脏记录
   *
   * @param limit - 最大返回数量
   * @returns 脏记录数组
   */
  async findDirtyRecords(limit: number = 100): Promise<DirtyRecord[]> {
    const result = await withRetry(async () => {
      const db = getDb();
      return db
        .select({
          agentId: recruitmentDailyStats.agentId,
          statDate: recruitmentDailyStats.statDate,
          brandId: recruitmentDailyStats.brandId,
          jobId: recruitmentDailyStats.jobId,
        })
        .from(recruitmentDailyStats)
        .where(eq(recruitmentDailyStats.isDirty, true))
        .limit(limit);
    }, "findDirtyRecords");

    return result ?? [];
  }

  /**
   * 标记某天的统计为脏数据（需要重算）
   *
   * 使用显式 SELECT + UPDATE/INSERT 模式，正确处理 NULL 值比较
   *
   * @param agentId - Agent ID
   * @param date - 事件日期
   * @param brandId - 可选品牌 ID
   * @param jobId - 可选岗位 ID
   */
  async markDirty(
    agentId: string,
    date: Date,
    brandId?: number | null,
    jobId?: number | null
  ): Promise<void> {
    const statDate = toBeijingMidnight(date);
    const normalizedBrandId = brandId ?? null;
    const normalizedJobId = jobId ?? null;

    await withRetry(async () => {
      const db = getDb();
      // 转换 Date 为 ISO 字符串，避免原生 SQL 参数类型错误
      const statDateStr = statDate.toISOString();
      const nowStr = new Date().toISOString();

      // 使用原生 SQL 实现 ON CONFLICT DO UPDATE
      // 如果记录存在则标记为脏，否则插入新记录（初始化为 0）
      await db.execute(sql`
        INSERT INTO app_huajune.recruitment_daily_stats (
          agent_id, stat_date, brand_id, job_id,
          is_dirty,
          total_events, unique_candidates, unique_sessions,
          messages_sent, messages_received, inbound_candidates,
          candidates_replied, unread_replied,
          proactive_outreach, proactive_responded,
          wechat_exchanged, interviews_booked, candidates_hired,
          created_at, updated_at
        ) VALUES (
          ${agentId}, ${statDateStr}::timestamptz, ${normalizedBrandId}, ${normalizedJobId},
          true,
          0, 0, 0,
          0, 0, 0,
          0, 0,
          0, 0,
          0, 0, 0,
          ${nowStr}::timestamp, ${nowStr}::timestamp
        )
        ON CONFLICT (agent_id, stat_date, COALESCE(brand_id, -1), COALESCE(job_id, -1))
        DO UPDATE SET
          is_dirty = true,
          updated_at = EXCLUDED.updated_at
      `);

      console.log(
        `${LOG_PREFIX} Marked dirty: ${agentId} @ ${statDate.toISOString().split("T")[0]}`
      );
    }, "markDirty");
  }

  /**
   * 更新/插入聚合统计
   *
   * 使用 PostgreSQL ON CONFLICT DO UPDATE 实现原子 upsert
   * 依赖表达式索引: unique_daily_stats_v2 (agent_id, stat_date, COALESCE(brand_id, -1), COALESCE(job_id, -1))
   *
   * @param stats - 统计数据
   */
  async upsertStats(stats: DailyStatsRecord): Promise<void> {
    await withRetry(async () => {
      const db = getDb();
      // 转换 Date 为 ISO 字符串，避免原生 SQL 参数类型错误
      const statDateStr = stats.statDate.toISOString();
      const nowStr = new Date().toISOString();

      // 使用原生 SQL 实现 ON CONFLICT DO UPDATE
      // 注意：ON CONFLICT 需要引用表达式索引的完整表达式
      await db.execute(sql`
        INSERT INTO app_huajune.recruitment_daily_stats (
          agent_id, stat_date, brand_id, job_id,
          total_events, unique_candidates, unique_sessions,
          messages_sent, messages_received, inbound_candidates,
          candidates_replied, unread_replied,
          proactive_outreach, proactive_responded,
          wechat_exchanged, interviews_booked, candidates_hired,
          reply_rate, wechat_rate, interview_rate,
          is_dirty, aggregated_at, created_at, updated_at
        ) VALUES (
          ${stats.agentId}, ${statDateStr}::timestamptz, ${stats.brandId}, ${stats.jobId},
          ${stats.totalEvents}, ${stats.uniqueCandidates}, ${stats.uniqueSessions},
          ${stats.messagesSent}, ${stats.messagesReceived}, ${stats.inboundCandidates},
          ${stats.candidatesReplied}, ${stats.unreadReplied},
          ${stats.proactiveOutreach}, ${stats.proactiveResponded},
          ${stats.wechatExchanged}, ${stats.interviewsBooked}, ${stats.candidatesHired},
          ${stats.replyRate}, ${stats.wechatRate}, ${stats.interviewRate},
          false, ${nowStr}::timestamp, ${nowStr}::timestamp, ${nowStr}::timestamp
        )
        ON CONFLICT (agent_id, stat_date, COALESCE(brand_id, -1), COALESCE(job_id, -1))
        DO UPDATE SET
          total_events = EXCLUDED.total_events,
          unique_candidates = EXCLUDED.unique_candidates,
          unique_sessions = EXCLUDED.unique_sessions,
          messages_sent = EXCLUDED.messages_sent,
          messages_received = EXCLUDED.messages_received,
          inbound_candidates = EXCLUDED.inbound_candidates,
          candidates_replied = EXCLUDED.candidates_replied,
          unread_replied = EXCLUDED.unread_replied,
          proactive_outreach = EXCLUDED.proactive_outreach,
          proactive_responded = EXCLUDED.proactive_responded,
          wechat_exchanged = EXCLUDED.wechat_exchanged,
          interviews_booked = EXCLUDED.interviews_booked,
          candidates_hired = EXCLUDED.candidates_hired,
          reply_rate = EXCLUDED.reply_rate,
          wechat_rate = EXCLUDED.wechat_rate,
          interview_rate = EXCLUDED.interview_rate,
          is_dirty = false,
          aggregated_at = EXCLUDED.aggregated_at,
          updated_at = EXCLUDED.updated_at
      `);

      console.log(
        `${LOG_PREFIX} Upserted stats: ${stats.agentId} @ ${stats.statDate.toISOString().split("T")[0]}`
      );
    }, "upsertStats");
  }

  /**
   * 查询聚合统计
   *
   * 从 daily_stats 表查询并聚合，支持按时间范围汇总
   *
   * @param agentId - 可选 Agent ID 筛选
   * @param startDate - 开始日期
   * @param endDate - 结束日期
   * @param brandId - 可选品牌 ID 筛选
   * @param jobId - 可选岗位 ID 筛选
   */
  async queryStats(
    agentId: string | undefined,
    startDate: Date,
    endDate: Date,
    brandId?: number,
    jobId?: number
  ): Promise<DrizzleSelectStats[]> {
    const result = await withRetry(async () => {
      const db = getDb();

      // 构建条件
      const conditions = [
        gte(recruitmentDailyStats.statDate, startDate),
        lte(recruitmentDailyStats.statDate, endDate),
      ];

      if (agentId) {
        conditions.push(eq(recruitmentDailyStats.agentId, agentId));
      }

      // 品牌筛选逻辑
      if (brandId !== undefined) {
        // 查询特定品牌的记录（不限制 jobId，因为品牌记录的 job_id 可能是 0）
        conditions.push(eq(recruitmentDailyStats.brandId, brandId));
      } else {
        // 查询总体聚合记录（brand_id IS NULL + job_id IS NULL）
        conditions.push(isNull(recruitmentDailyStats.brandId));
        if (jobId !== undefined) {
          conditions.push(eq(recruitmentDailyStats.jobId, jobId));
        } else {
          conditions.push(isNull(recruitmentDailyStats.jobId));
        }
      }

      return db
        .select()
        .from(recruitmentDailyStats)
        .where(and(...conditions))
        .orderBy(recruitmentDailyStats.statDate);
    }, "queryStats");

    return result ?? [];
  }

  /**
   * 查询聚合汇总（跨日期汇总）
   *
   * 用于周/月/年报表，将多天数据汇总为单条
   */
  async queryAggregatedStats(
    agentId: string | undefined,
    startDate: Date,
    endDate: Date,
    brandId?: number,
    jobId?: number
  ): Promise<
    {
      agentId: string;
      brandId: number | null;
      jobId: number | null;
      totalEvents: number;
      uniqueCandidates: number;
      uniqueSessions: number;
      // 入站漏斗
      messagesSent: number;
      messagesReceived: number;
      inboundCandidates: number;
      candidatesReplied: number;
      unreadReplied: number;
      // 出站漏斗
      proactiveOutreach: number;
      proactiveResponded: number;
      // 转化指标
      wechatExchanged: number;
      interviewsBooked: number;
      candidatesHired: number;
    }[]
  > {
    const result = await withRetry(async () => {
      const db = getDb();

      // 构建条件
      const conditions = [
        gte(recruitmentDailyStats.statDate, startDate),
        lte(recruitmentDailyStats.statDate, endDate),
      ];

      if (agentId) {
        conditions.push(eq(recruitmentDailyStats.agentId, agentId));
      }

      // 品牌筛选逻辑
      if (brandId !== undefined) {
        // 查询特定品牌的记录（不限制 jobId，因为品牌记录的 job_id 可能是 0）
        conditions.push(eq(recruitmentDailyStats.brandId, brandId));
      } else {
        // 查询总体聚合记录（brand_id IS NULL + job_id IS NULL）
        conditions.push(isNull(recruitmentDailyStats.brandId));
        if (jobId !== undefined) {
          conditions.push(eq(recruitmentDailyStats.jobId, jobId));
        } else {
          conditions.push(isNull(recruitmentDailyStats.jobId));
        }
      }

      return db
        .select({
          agentId: recruitmentDailyStats.agentId,
          brandId: recruitmentDailyStats.brandId,
          jobId: recruitmentDailyStats.jobId,
          totalEvents: sql<number>`SUM(${recruitmentDailyStats.totalEvents})`,
          uniqueCandidates: sql<number>`SUM(${recruitmentDailyStats.uniqueCandidates})`,
          uniqueSessions: sql<number>`SUM(${recruitmentDailyStats.uniqueSessions})`,
          // 入站漏斗
          messagesSent: sql<number>`SUM(${recruitmentDailyStats.messagesSent})`,
          messagesReceived: sql<number>`SUM(${recruitmentDailyStats.messagesReceived})`,
          inboundCandidates: sql<number>`SUM(${recruitmentDailyStats.inboundCandidates})`,
          candidatesReplied: sql<number>`SUM(${recruitmentDailyStats.candidatesReplied})`,
          unreadReplied: sql<number>`SUM(${recruitmentDailyStats.unreadReplied})`,
          // 出站漏斗
          proactiveOutreach: sql<number>`SUM(${recruitmentDailyStats.proactiveOutreach})`,
          proactiveResponded: sql<number>`SUM(${recruitmentDailyStats.proactiveResponded})`,
          // 转化指标
          wechatExchanged: sql<number>`SUM(${recruitmentDailyStats.wechatExchanged})`,
          interviewsBooked: sql<number>`SUM(${recruitmentDailyStats.interviewsBooked})`,
          candidatesHired: sql<number>`SUM(${recruitmentDailyStats.candidatesHired})`,
        })
        .from(recruitmentDailyStats)
        .where(and(...conditions))
        .groupBy(
          recruitmentDailyStats.agentId,
          recruitmentDailyStats.brandId,
          recruitmentDailyStats.jobId
        );
    }, "queryAggregatedStats");

    return (
      result?.map(row => ({
        agentId: row.agentId,
        brandId: row.brandId,
        jobId: row.jobId,
        totalEvents: Number(row.totalEvents) || 0,
        uniqueCandidates: Number(row.uniqueCandidates) || 0,
        uniqueSessions: Number(row.uniqueSessions) || 0,
        // 入站漏斗
        messagesSent: Number(row.messagesSent) || 0,
        messagesReceived: Number(row.messagesReceived) || 0,
        inboundCandidates: Number(row.inboundCandidates) || 0,
        candidatesReplied: Number(row.candidatesReplied) || 0,
        unreadReplied: Number(row.unreadReplied) || 0,
        // 出站漏斗
        proactiveOutreach: Number(row.proactiveOutreach) || 0,
        proactiveResponded: Number(row.proactiveResponded) || 0,
        // 转化指标
        wechatExchanged: Number(row.wechatExchanged) || 0,
        interviewsBooked: Number(row.interviewsBooked) || 0,
        candidatesHired: Number(row.candidatesHired) || 0,
      })) ?? []
    );
  }

  /**
   * 获取去重的 Agent 列表
   *
   * 从 daily_stats 表获取所有有统计数据的 Agent
   */
  async getDistinctAgents(): Promise<string[]> {
    const result = await withRetry(async () => {
      const db = getDb();
      return db
        .selectDistinct({ agentId: recruitmentDailyStats.agentId })
        .from(recruitmentDailyStats)
        .orderBy(recruitmentDailyStats.agentId);
    }, "getDistinctAgents");

    return result?.map(row => row.agentId) ?? [];
  }

  /**
   * 获取去重的 Brand ID 列表
   *
   * 从 daily_stats 表获取所有有统计数据的 Brand ID（排除 NULL）
   */
  async getDistinctBrandIds(): Promise<number[]> {
    const result = await withRetry(async () => {
      const db = getDb();
      return db
        .selectDistinct({ brandId: recruitmentDailyStats.brandId })
        .from(recruitmentDailyStats)
        .where(sql`${recruitmentDailyStats.brandId} IS NOT NULL`)
        .orderBy(recruitmentDailyStats.brandId);
    }, "getDistinctBrandIds");

    return result?.map(row => row.brandId).filter((id): id is number => id !== null) ?? [];
  }

}

/**
 * 单例实例
 */
export const recruitmentStatsRepository = new RecruitmentStatsRepository();

// 导出工具函数供其他模块使用
export { calculateRate };
