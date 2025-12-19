/**
 * Recruitment Stats Repository
 *
 * 统计数据的数据库操作
 * 使用 Drizzle ORM with PostgreSQL
 */

import { eq, and, gte, lte, sql, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { recruitmentDailyStats } from "@/db/schema";
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
 * 将日期标准化为当天 0 点（UTC）
 */
function normalizeToStartOfDay(date: Date): Date {
  const normalized = new Date(date);
  normalized.setUTCHours(0, 0, 0, 0);
  return normalized;
}

/**
 * 计算百分比率（结果 * 100，如 85.5% = 8550）
 */
function calculateRate(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return Math.round((numerator / denominator) * 10000);
}

/**
 * 构建维度查询条件（正确处理 NULL）
 *
 * PostgreSQL 中 NULL ≠ NULL，需要使用 IS NULL 来比较
 */
function buildDimensionConditions(
  agentId: string,
  statDate: Date,
  brandId: number | null | undefined,
  jobId: number | null | undefined
) {
  return [
    eq(recruitmentDailyStats.agentId, agentId),
    eq(recruitmentDailyStats.statDate, statDate),
    brandId === null || brandId === undefined
      ? isNull(recruitmentDailyStats.brandId)
      : eq(recruitmentDailyStats.brandId, brandId),
    jobId === null || jobId === undefined
      ? isNull(recruitmentDailyStats.jobId)
      : eq(recruitmentDailyStats.jobId, jobId),
  ];
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
    const statDate = normalizeToStartOfDay(date);
    const normalizedBrandId = brandId ?? null;
    const normalizedJobId = jobId ?? null;

    await withRetry(async () => {
      const db = getDb();

      await db.transaction(async tx => {
        // 1. 查找现有记录（正确处理 NULL）
        const existing = await tx
          .select({ id: recruitmentDailyStats.id })
          .from(recruitmentDailyStats)
          .where(
            and(...buildDimensionConditions(agentId, statDate, normalizedBrandId, normalizedJobId))
          )
          .limit(1);

        if (existing.length > 0) {
          // 2a. 更新现有记录
          await tx
            .update(recruitmentDailyStats)
            .set({ isDirty: true, updatedAt: new Date() })
            .where(eq(recruitmentDailyStats.id, existing[0].id));
        } else {
          // 2b. 插入新记录
          await tx.insert(recruitmentDailyStats).values({
            agentId,
            statDate,
            brandId: normalizedBrandId,
            jobId: normalizedJobId,
            isDirty: true,
            // 初始化为 0，等待聚合填充
            totalEvents: 0,
            uniqueCandidates: 0,
            uniqueSessions: 0,
            // 入站漏斗
            messagesSent: 0,
            messagesReceived: 0,
            inboundCandidates: 0,
            candidatesReplied: 0,
            unreadReplied: 0,
            // 出站漏斗
            proactiveOutreach: 0,
            proactiveResponded: 0,
            // 转化指标
            wechatExchanged: 0,
            interviewsBooked: 0,
            candidatesHired: 0,
          });
        }
      });

      console.log(
        `${LOG_PREFIX} Marked dirty: ${agentId} @ ${statDate.toISOString().split("T")[0]}`
      );
    }, "markDirty");
  }

  /**
   * 更新/插入聚合统计
   *
   * 使用显式 SELECT + UPDATE/INSERT 模式，正确处理 NULL 值比较
   *
   * @param stats - 统计数据
   */
  async upsertStats(stats: DailyStatsRecord): Promise<void> {
    await withRetry(async () => {
      const db = getDb();

      await db.transaction(async tx => {
        // 1. 查找现有记录（正确处理 NULL）
        const existing = await tx
          .select({ id: recruitmentDailyStats.id })
          .from(recruitmentDailyStats)
          .where(
            and(
              ...buildDimensionConditions(stats.agentId, stats.statDate, stats.brandId, stats.jobId)
            )
          )
          .limit(1);

        const now = new Date();

        if (existing.length > 0) {
          // 2a. 更新现有记录
          await tx
            .update(recruitmentDailyStats)
            .set({
              totalEvents: stats.totalEvents,
              uniqueCandidates: stats.uniqueCandidates,
              uniqueSessions: stats.uniqueSessions,
              // 入站漏斗
              messagesSent: stats.messagesSent,
              messagesReceived: stats.messagesReceived,
              inboundCandidates: stats.inboundCandidates,
              candidatesReplied: stats.candidatesReplied,
              unreadReplied: stats.unreadReplied,
              // 出站漏斗
              proactiveOutreach: stats.proactiveOutreach,
              proactiveResponded: stats.proactiveResponded,
              // 转化指标
              wechatExchanged: stats.wechatExchanged,
              interviewsBooked: stats.interviewsBooked,
              candidatesHired: stats.candidatesHired,
              replyRate: stats.replyRate,
              wechatRate: stats.wechatRate,
              interviewRate: stats.interviewRate,
              isDirty: false,
              aggregatedAt: now,
              updatedAt: now,
            })
            .where(eq(recruitmentDailyStats.id, existing[0].id));
        } else {
          // 2b. 插入新记录
          await tx.insert(recruitmentDailyStats).values({
            agentId: stats.agentId,
            statDate: stats.statDate,
            brandId: stats.brandId,
            jobId: stats.jobId,
            totalEvents: stats.totalEvents,
            uniqueCandidates: stats.uniqueCandidates,
            uniqueSessions: stats.uniqueSessions,
            // 入站漏斗
            messagesSent: stats.messagesSent,
            messagesReceived: stats.messagesReceived,
            inboundCandidates: stats.inboundCandidates,
            candidatesReplied: stats.candidatesReplied,
            unreadReplied: stats.unreadReplied,
            // 出站漏斗
            proactiveOutreach: stats.proactiveOutreach,
            proactiveResponded: stats.proactiveResponded,
            // 转化指标
            wechatExchanged: stats.wechatExchanged,
            interviewsBooked: stats.interviewsBooked,
            candidatesHired: stats.candidatesHired,
            replyRate: stats.replyRate,
            wechatRate: stats.wechatRate,
            interviewRate: stats.interviewRate,
            isDirty: false,
            aggregatedAt: now,
          });
        }
      });

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
      // 当未指定 brandId 时，默认只查询总体聚合记录（brand_id IS NULL）
      // 避免将总体记录和品牌分解记录重复计算
      if (brandId !== undefined) {
        conditions.push(eq(recruitmentDailyStats.brandId, brandId));
      } else {
        conditions.push(isNull(recruitmentDailyStats.brandId));
      }
      // 当未指定 jobId 时，也过滤 job_id IS NULL（查询总体聚合记录）
      // 这样可以避免 brand_id: null + job_id: 0 与 brand_id: null + job_id: null 重复计算
      if (jobId !== undefined) {
        conditions.push(eq(recruitmentDailyStats.jobId, jobId));
      } else {
        conditions.push(isNull(recruitmentDailyStats.jobId));
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
      // 当未指定 brandId 时，默认只查询总体聚合记录（brand_id IS NULL）
      // 避免将总体记录和品牌分解记录重复计算
      if (brandId !== undefined) {
        conditions.push(eq(recruitmentDailyStats.brandId, brandId));
      } else {
        conditions.push(isNull(recruitmentDailyStats.brandId));
      }
      // 当未指定 jobId 时，也过滤 job_id IS NULL（查询总体聚合记录）
      // 这样可以避免 brand_id: null + job_id: 0 与 brand_id: null + job_id: null 重复计算
      if (jobId !== undefined) {
        conditions.push(eq(recruitmentDailyStats.jobId, jobId));
      } else {
        conditions.push(isNull(recruitmentDailyStats.jobId));
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

}

/**
 * 单例实例
 */
export const recruitmentStatsRepository = new RecruitmentStatsRepository();

// 导出工具函数供其他模块使用
export { normalizeToStartOfDay, calculateRate };
