/**
 * Query Service
 *
 * 统计数据查询服务
 * 提供日/周/月/年等多时间维度的查询支持
 */

import { eq, and, or, gte, lte, sql, inArray, count, countDistinct } from "drizzle-orm";
import { getDb } from "@/db";
import { recruitmentEvents, dataDictionary } from "@/db/schema";
import { getDictionaryType, RecruitmentEventType } from "@/db/types";
import { recruitmentStatsRepository, calculateRate } from "./repository";
import { recruitmentEventsRepository } from "@/lib/services/recruitment-event/repository";
import {
  buildJobCondition,
  buildJobConditionRaw,
  hasJobFilter,
} from "./job-filter";
import {
  toBeijingMidnight,
  toBeijingDayEnd,
  toBeijingDateString,
} from "@/lib/utils/beijing-timezone";
import type {
  StatsQuery,
  AggregatedStats,
  TimeRangeValue,
  DashboardSummary,
  DailyTrendItem,
} from "./types";

const LOG_PREFIX = "[RecruitmentStats][Query]";

class QueryService {
  /**
   * 查询统计数据
   *
   * 支持按时间范围类型自动计算日期边界
   *
   * @param query - 查询参数
   */
  async queryStats(query: StatsQuery): Promise<AggregatedStats[]> {
    const { agentId, startDate, endDate, brandId, jobId, timeRange } = query;

    // 根据 timeRange 计算实际的日期范围
    const { start, end } = this.calculateDateRange(startDate, endDate, timeRange);

    console.log(
      `${LOG_PREFIX} Querying stats: ${agentId ?? "all"} from ${start.toISOString()} to ${end.toISOString()}`
    );

    // 查询聚合数据
    const rawStats = await recruitmentStatsRepository.queryAggregatedStats(
      agentId,
      start,
      end,
      brandId,
      jobId
    );

    // 转换为 AggregatedStats 格式
    return rawStats.map(row => ({
      agentId: row.agentId,
      startDate: start,
      endDate: end,
      brandId: row.brandId,
      jobId: row.jobId,
      totalEvents: row.totalEvents,
      uniqueCandidates: row.uniqueCandidates,
      uniqueSessions: row.uniqueSessions,
      // 入站漏斗
      messagesSent: row.messagesSent,
      messagesReceived: row.messagesReceived,
      inboundCandidates: row.inboundCandidates,
      candidatesReplied: row.candidatesReplied,
      unreadReplied: row.unreadReplied,
      // 出站漏斗
      proactiveOutreach: row.proactiveOutreach,
      proactiveResponded: row.proactiveResponded,
      // 转化指标
      wechatExchanged: row.wechatExchanged,
      interviewsBooked: row.interviewsBooked,
      candidatesHired: row.candidatesHired,
      replyRate: calculateRate(row.candidatesReplied, row.inboundCandidates),
      wechatRate: calculateRate(row.wechatExchanged, row.inboundCandidates),
      interviewRate: calculateRate(row.interviewsBooked, row.inboundCandidates),
    }));
  }

  /**
   * 获取 Dashboard 概览数据
   *
   * 包含当前周期、上一周期和环比趋势
   * 采用混合查询策略：无 jobNames 使用预聚合表，有 jobNames 从 events 表实时聚合
   *
   * @param agentId - 可选 Agent ID
   * @param days - 周期天数（默认 7 天）
   * @param referenceEndDate - 参考结束日期（默认为今天，用于支持"昨天"等历史日期查询）
   * @param brandId - 可选品牌 ID
   * @param jobNames - 可选岗位名称列表（多选）
   */
  async getDashboardSummary(
    agentId?: string,
    days: number = 7,
    referenceEndDate?: Date,
    brandId?: number,
    jobNames?: string[]
  ): Promise<DashboardSummary> {
    // 使用传入的结束日期，或默认为今天
    const endDateRef = referenceEndDate ?? new Date();

    // 当前周期（使用北京时区）
    const currentEnd = toBeijingDayEnd(endDateRef);
    const currentStartDate = new Date(endDateRef.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
    const currentStart = toBeijingMidnight(currentStartDate);

    // 上一周期
    const previousEndDate = new Date(currentStart.getTime() - 1);
    const previousEnd = toBeijingDayEnd(previousEndDate);
    const previousStartDate = new Date(previousEnd.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
    const previousStart = toBeijingMidnight(previousStartDate);

    console.log(
      `${LOG_PREFIX} Dashboard summary: current=${currentStart.toISOString()}-${currentEnd.toISOString()}, previous=${previousStart.toISOString()}-${previousEnd.toISOString()}, jobNames=${jobNames?.join(",") ?? "all"}`
    );

    // 混合查询策略：有 jobNames 使用实时聚合，否则使用预聚合表
    const hasJobFilter = jobNames && jobNames.length > 0;

    let currentRaw: Awaited<ReturnType<typeof recruitmentStatsRepository.queryAggregatedStats>>;
    let previousRaw: Awaited<ReturnType<typeof recruitmentStatsRepository.queryAggregatedStats>>;

    if (hasJobFilter) {
      // 从 events 表实时聚合
      [currentRaw, previousRaw] = await Promise.all([
        this.queryStatsFromEvents(agentId, currentStart, currentEnd, brandId, jobNames),
        this.queryStatsFromEvents(agentId, previousStart, previousEnd, brandId, jobNames),
      ]);
    } else {
      // 使用预聚合表（快速）
      [currentRaw, previousRaw] = await Promise.all([
        recruitmentStatsRepository.queryAggregatedStats(agentId, currentStart, currentEnd, brandId),
        recruitmentStatsRepository.queryAggregatedStats(agentId, previousStart, previousEnd, brandId),
      ]);
    }

    // 转换格式
    const current = currentRaw.map(row => this.toAggregatedStats(row, currentStart, currentEnd));
    const previous = previousRaw.map(row =>
      this.toAggregatedStats(row, previousStart, previousEnd)
    );

    // 计算趋势
    const trend = this.calculateTrends(current, previous);

    return { current, previous, trend };
  }

  /**
   * 从 events 表实时聚合统计数据
   *
   * 用于支持 jobNames 筛选（预聚合表不支持 job_name 维度）
   */
  private async queryStatsFromEvents(
    agentId: string | undefined,
    startDate: Date,
    endDate: Date,
    brandId?: number,
    jobNames?: string[]
  ): Promise<{
    agentId: string;
    brandId: number | null;
    jobId: number | null;
    totalEvents: number;
    uniqueCandidates: number;
    uniqueSessions: number;
    messagesSent: number;
    messagesReceived: number;
    inboundCandidates: number;
    candidatesReplied: number;
    unreadReplied: number;
    proactiveOutreach: number;
    proactiveResponded: number;
    wechatExchanged: number;
    interviewsBooked: number;
    candidatesHired: number;
  }[]> {
    const db = getDb();

    // 构建 WHERE 条件
    const conditions = [
      gte(recruitmentEvents.eventTime, startDate),
      lte(recruitmentEvents.eventTime, endDate),
    ];

    if (agentId) {
      conditions.push(eq(recruitmentEvents.agentId, agentId));
    }
    if (brandId !== undefined) {
      conditions.push(eq(recruitmentEvents.brandId, brandId));
    }
    // 使用集中化的 Job 筛选工具
    const jobCondition = buildJobCondition(jobNames ?? []);
    if (jobCondition) {
      conditions.push(jobCondition);
    }

    // 构建子查询的静态条件字符串（避免 Drizzle 参数重复绑定问题）
    const buildSubqueryConditions = (alias: string): string => {
      const parts: string[] = [];
      if (agentId) {
        const escapedAgentId = agentId.replace(/'/g, "''");
        parts.push(`${alias}.agent_id = '${escapedAgentId}'`);
      }
      if (brandId !== undefined) {
        parts.push(`${alias}.brand_id = ${brandId}`);
      }
      // 使用集中化的 Job 筛选工具
      if (hasJobFilter(jobNames)) {
        parts.push(buildJobConditionRaw(alias, jobNames!));
      }
      return parts.length > 0 ? "AND " + parts.join(" AND ") : "";
    };

    const receivedConditionsStr = buildSubqueryConditions("received");
    const contactedConditionsStr = buildSubqueryConditions("contacted");
    const startDateIso = startDate.toISOString();
    const endDateIso = endDate.toISOString();

    // 执行聚合查询（参考 aggregation.service.ts 的逻辑）
    // 注意：不按 agent 分组，所以 agentId 用常量而非从数据库查询
    const [stats] = await db
      .select({
        totalEvents: count(),
        uniqueCandidates: countDistinct(recruitmentEvents.candidateKey),
        uniqueSessions: countDistinct(recruitmentEvents.sessionId),
        messagesSent: sql<number>`COUNT(*) FILTER (WHERE ${recruitmentEvents.eventType} = ${RecruitmentEventType.MESSAGE_SENT})`,
        messagesReceived: sql<number>`COALESCE(SUM(${recruitmentEvents.unreadCountBeforeReply}) FILTER (WHERE ${recruitmentEvents.eventType} = ${RecruitmentEventType.MESSAGE_RECEIVED}), 0)`,
        inboundCandidates: sql<number>`COUNT(DISTINCT ${recruitmentEvents.candidateKey}) FILTER (WHERE ${recruitmentEvents.eventType} = ${RecruitmentEventType.MESSAGE_RECEIVED} OR (${recruitmentEvents.eventType} = ${RecruitmentEventType.MESSAGE_SENT} AND ${recruitmentEvents.wasUnreadBeforeReply} = true))`,
        candidatesReplied: sql<number>`COUNT(DISTINCT ${recruitmentEvents.candidateKey}) FILTER (WHERE ${recruitmentEvents.eventType} = ${RecruitmentEventType.MESSAGE_SENT} AND ${recruitmentEvents.wasUnreadBeforeReply} = true)`,
        unreadReplied: sql<number>`COALESCE(SUM(${recruitmentEvents.unreadCountBeforeReply}) FILTER (WHERE ${recruitmentEvents.eventType} = ${RecruitmentEventType.MESSAGE_SENT} AND ${recruitmentEvents.wasUnreadBeforeReply} = true), 0)`,
        proactiveOutreach: sql<number>`COUNT(DISTINCT ${recruitmentEvents.candidateKey}) FILTER (WHERE ${recruitmentEvents.eventType} = ${RecruitmentEventType.CANDIDATE_CONTACTED})`,
        // proactiveResponded: 主动触达后对方回复的候选人数（使用 candidate_name 宽松匹配）
        proactiveResponded: sql<number>`(
          SELECT COUNT(DISTINCT received.candidate_name)
          FROM ${recruitmentEvents} AS received
          WHERE received.event_type = ${RecruitmentEventType.MESSAGE_RECEIVED}
            AND received.event_time >= ${startDateIso}::timestamptz
            AND received.event_time <= ${endDateIso}::timestamptz
            ${sql.raw(receivedConditionsStr)}
            AND received.candidate_name IN (
              SELECT DISTINCT contacted.candidate_name
              FROM ${recruitmentEvents} AS contacted
              WHERE contacted.event_type = ${RecruitmentEventType.CANDIDATE_CONTACTED}
                AND contacted.event_time >= ${startDateIso}::timestamptz
                AND contacted.event_time <= ${endDateIso}::timestamptz
                ${sql.raw(contactedConditionsStr)}
            )
        )`,
        wechatExchanged: sql<number>`COUNT(DISTINCT ${recruitmentEvents.candidateKey}) FILTER (
          WHERE ${recruitmentEvents.eventType} = ${RecruitmentEventType.WECHAT_EXCHANGED}
          AND (
            ${recruitmentEvents.eventDetails}->>'exchangeType' = 'accepted'
            OR ${recruitmentEvents.eventDetails}->>'exchangeType' = 'completed'
            OR (
              ${recruitmentEvents.eventDetails}->>'exchangeType' IS NULL
              AND ${recruitmentEvents.eventDetails}->>'wechatNumber' IS NOT NULL
              AND ${recruitmentEvents.eventDetails}->>'wechatNumber' != ''
            )
          )
        )`,
        interviewsBooked: sql<number>`COUNT(DISTINCT ${recruitmentEvents.candidateKey}) FILTER (WHERE ${recruitmentEvents.eventType} = ${RecruitmentEventType.INTERVIEW_BOOKED})`,
        candidatesHired: sql<number>`COUNT(DISTINCT ${recruitmentEvents.candidateKey}) FILTER (WHERE ${recruitmentEvents.eventType} = ${RecruitmentEventType.CANDIDATE_HIRED})`,
      })
      .from(recruitmentEvents)
      .where(and(...conditions));

    if (!stats) {
      return [];
    }

    return [
      {
        agentId: agentId ?? "all",
        brandId: brandId ?? null,
        jobId: null,
        totalEvents: Number(stats.totalEvents) || 0,
        uniqueCandidates: Number(stats.uniqueCandidates) || 0,
        uniqueSessions: Number(stats.uniqueSessions) || 0,
        messagesSent: Number(stats.messagesSent) || 0,
        messagesReceived: Number(stats.messagesReceived) || 0,
        inboundCandidates: Number(stats.inboundCandidates) || 0,
        candidatesReplied: Number(stats.candidatesReplied) || 0,
        unreadReplied: Number(stats.unreadReplied) || 0,
        proactiveOutreach: Number(stats.proactiveOutreach) || 0,
        proactiveResponded: Number(stats.proactiveResponded) || 0,
        wechatExchanged: Number(stats.wechatExchanged) || 0,
        interviewsBooked: Number(stats.interviewsBooked) || 0,
        candidatesHired: Number(stats.candidatesHired) || 0,
      },
    ];
  }

  /**
   * 获取指定日期的详细统计
   *
   * @param agentId - Agent ID
   * @param date - 日期
   */
  async getDailyStats(agentId: string, date: Date): Promise<AggregatedStats[]> {
    const dayStart = new Date(date);
    dayStart.setUTCHours(0, 0, 0, 0);

    const dayEnd = new Date(date);
    dayEnd.setUTCHours(23, 59, 59, 999);

    const stats = await recruitmentStatsRepository.queryStats(agentId, dayStart, dayEnd);

    return stats.map(row => ({
      agentId: row.agentId,
      startDate: dayStart,
      endDate: dayEnd,
      brandId: row.brandId,
      jobId: row.jobId,
      totalEvents: row.totalEvents,
      uniqueCandidates: row.uniqueCandidates,
      uniqueSessions: row.uniqueSessions,
      // 入站漏斗
      messagesSent: row.messagesSent,
      messagesReceived: row.messagesReceived,
      inboundCandidates: row.inboundCandidates,
      candidatesReplied: row.candidatesReplied,
      unreadReplied: row.unreadReplied,
      // 出站漏斗
      proactiveOutreach: row.proactiveOutreach,
      proactiveResponded: row.proactiveResponded,
      // 转化指标
      wechatExchanged: row.wechatExchanged,
      interviewsBooked: row.interviewsBooked,
      candidatesHired: row.candidatesHired,
      replyRate: row.replyRate,
      wechatRate: row.wechatRate,
      interviewRate: row.interviewRate,
    }));
  }

  /**
   * 根据时间范围类型计算日期边界
   */
  private calculateDateRange(
    startDate: Date,
    endDate: Date,
    timeRange: TimeRangeValue
  ): { start: Date; end: Date } {
    switch (timeRange) {
      case "day":
        return { start: startDate, end: endDate };

      case "week": {
        // 计算所在周的周一到周日（使用 UTC）
        const weekStart = new Date(startDate);
        const dayOfWeek = weekStart.getUTCDay();
        // 调整到周一（如果是周日，dayOfWeek=0，需要调整 6 天）
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        weekStart.setUTCDate(weekStart.getUTCDate() - daysToMonday);
        weekStart.setUTCHours(0, 0, 0, 0);

        const weekEnd = new Date(weekStart);
        weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
        weekEnd.setUTCHours(23, 59, 59, 999);

        return { start: weekStart, end: weekEnd };
      }

      case "month": {
        // 计算所在月的第一天到最后一天（使用 UTC）
        const monthStart = new Date(
          Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1)
        );
        const monthEnd = new Date(
          Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 0, 23, 59, 59, 999)
        );
        return { start: monthStart, end: monthEnd };
      }

      case "year": {
        // 计算所在年的第一天到最后一天（使用 UTC）
        const yearStart = new Date(Date.UTC(startDate.getUTCFullYear(), 0, 1));
        const yearEnd = new Date(Date.UTC(startDate.getUTCFullYear(), 11, 31, 23, 59, 59, 999));
        return { start: yearStart, end: yearEnd };
      }

      case "custom":
      default:
        return { start: startDate, end: endDate };
    }
  }

  /**
   * 转换原始数据为 AggregatedStats 格式
   */
  private toAggregatedStats(
    row: {
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
    },
    startDate: Date,
    endDate: Date
  ): AggregatedStats {
    return {
      agentId: row.agentId,
      startDate,
      endDate,
      brandId: row.brandId,
      jobId: row.jobId,
      totalEvents: row.totalEvents,
      uniqueCandidates: row.uniqueCandidates,
      uniqueSessions: row.uniqueSessions,
      // 入站漏斗
      messagesSent: row.messagesSent,
      messagesReceived: row.messagesReceived,
      inboundCandidates: row.inboundCandidates,
      candidatesReplied: row.candidatesReplied,
      unreadReplied: row.unreadReplied,
      // 出站漏斗
      proactiveOutreach: row.proactiveOutreach,
      proactiveResponded: row.proactiveResponded,
      // 转化指标
      wechatExchanged: row.wechatExchanged,
      interviewsBooked: row.interviewsBooked,
      candidatesHired: row.candidatesHired,
      replyRate: calculateRate(row.candidatesReplied, row.inboundCandidates),
      wechatRate: calculateRate(row.wechatExchanged, row.inboundCandidates),
      interviewRate: calculateRate(row.interviewsBooked, row.inboundCandidates),
    };
  }

  /**
   * 计算环比趋势
   */
  private calculateTrends(
    current: AggregatedStats[],
    previous: AggregatedStats[]
  ): Record<string, number | null> {
    const sumCurrent = this.sumStats(current);
    const sumPrevious = this.sumStats(previous);

    const calcTrend = (curr: number, prev: number): number | null => {
      if (prev === 0) return curr > 0 ? 100 : null;
      return Math.round(((curr - prev) / prev) * 100);
    };

    return {
      totalEvents: calcTrend(sumCurrent.totalEvents, sumPrevious.totalEvents),
      uniqueCandidates: calcTrend(sumCurrent.uniqueCandidates, sumPrevious.uniqueCandidates),
      inboundCandidates: calcTrend(sumCurrent.inboundCandidates, sumPrevious.inboundCandidates),
      messagesReceived: calcTrend(sumCurrent.messagesReceived, sumPrevious.messagesReceived),
      wechatExchanged: calcTrend(sumCurrent.wechatExchanged, sumPrevious.wechatExchanged),
      interviewsBooked: calcTrend(sumCurrent.interviewsBooked, sumPrevious.interviewsBooked),
      candidatesHired: calcTrend(sumCurrent.candidatesHired, sumPrevious.candidatesHired),
      proactiveOutreach: calcTrend(sumCurrent.proactiveOutreach, sumPrevious.proactiveOutreach),
    };
  }

  /**
   * 汇总多条统计记录
   */
  private sumStats(stats: AggregatedStats[]): Record<string, number> {
    return stats.reduce(
      (acc, s) => ({
        totalEvents: acc.totalEvents + s.totalEvents,
        uniqueCandidates: acc.uniqueCandidates + s.uniqueCandidates,
        uniqueSessions: acc.uniqueSessions + s.uniqueSessions,
        // 入站漏斗
        messagesSent: acc.messagesSent + s.messagesSent,
        messagesReceived: acc.messagesReceived + s.messagesReceived,
        inboundCandidates: acc.inboundCandidates + s.inboundCandidates,
        candidatesReplied: acc.candidatesReplied + s.candidatesReplied,
        unreadReplied: acc.unreadReplied + s.unreadReplied,
        // 出站漏斗
        proactiveOutreach: acc.proactiveOutreach + s.proactiveOutreach,
        proactiveResponded: acc.proactiveResponded + s.proactiveResponded,
        // 转化指标
        wechatExchanged: acc.wechatExchanged + s.wechatExchanged,
        interviewsBooked: acc.interviewsBooked + s.interviewsBooked,
        candidatesHired: acc.candidatesHired + s.candidatesHired,
      }),
      {
        totalEvents: 0,
        uniqueCandidates: 0,
        uniqueSessions: 0,
        messagesSent: 0,
        messagesReceived: 0,
        inboundCandidates: 0,
        candidatesReplied: 0,
        unreadReplied: 0,
        proactiveOutreach: 0,
        proactiveResponded: 0,
        wechatExchanged: 0,
        interviewsBooked: 0,
        candidatesHired: 0,
      }
    );
  }

  /**
   * 获取日粒度趋势数据
   *
   * 返回指定日期范围内每天的统计数据
   * 采用混合查询策略：无 jobNames 使用预聚合表，有 jobNames 从 events 表实时聚合
   *
   * @param agentId - 可选 Agent ID
   * @param startDate - 开始日期
   * @param endDate - 结束日期
   * @param brandId - 可选品牌 ID
   * @param jobNames - 可选岗位名称列表
   */
  async getStatsTrend(
    agentId: string | undefined,
    startDate: Date,
    endDate: Date,
    brandId?: number,
    jobNames?: string[]
  ): Promise<DailyTrendItem[]> {
    console.log(
      `${LOG_PREFIX} Getting stats trend: ${agentId ?? "all"} from ${startDate.toISOString()} to ${endDate.toISOString()}, jobNames=${jobNames?.join(",") ?? "all"}`
    );

    const hasJobFilter = jobNames && jobNames.length > 0;

    if (hasJobFilter) {
      // 从 events 表实时聚合日趋势
      return this.queryTrendFromEvents(agentId, startDate, endDate, brandId, jobNames);
    }

    // 使用预聚合表（快速）
    const rawStats = await recruitmentStatsRepository.queryStats(
      agentId,
      startDate,
      endDate,
      brandId
    );

    // 按日期聚合（因为可能有多个 brand/job 组合）
    const dailyMap = new Map<string, DailyTrendItem>();

    for (const row of rawStats) {
      // 使用北京时间日期作为 key
      const dateKey = toBeijingDateString(row.statDate);
      const existing = dailyMap.get(dateKey);

      if (existing) {
        existing.messagesReceived += row.messagesReceived;
        existing.inboundCandidates += row.inboundCandidates;
        existing.candidatesReplied += row.candidatesReplied;
        existing.wechatExchanged += row.wechatExchanged;
        existing.interviewsBooked += row.interviewsBooked;
        existing.unreadReplied += row.unreadReplied;
        existing.proactiveOutreach += row.proactiveOutreach;
        existing.proactiveResponded += row.proactiveResponded;
      } else {
        dailyMap.set(dateKey, {
          date: dateKey,
          messagesReceived: row.messagesReceived,
          inboundCandidates: row.inboundCandidates,
          candidatesReplied: row.candidatesReplied,
          wechatExchanged: row.wechatExchanged,
          interviewsBooked: row.interviewsBooked,
          unreadReplied: row.unreadReplied,
          proactiveOutreach: row.proactiveOutreach,
          proactiveResponded: row.proactiveResponded,
        });
      }
    }

    // 按日期排序返回
    return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * 从 events 表实时聚合日趋势数据
   */
  private async queryTrendFromEvents(
    agentId: string | undefined,
    startDate: Date,
    endDate: Date,
    brandId?: number,
    jobNames?: string[]
  ): Promise<DailyTrendItem[]> {
    const db = getDb();

    // 构建 WHERE 条件
    const conditions = [
      gte(recruitmentEvents.eventTime, startDate),
      lte(recruitmentEvents.eventTime, endDate),
    ];

    if (agentId) {
      conditions.push(eq(recruitmentEvents.agentId, agentId));
    }
    if (brandId !== undefined) {
      conditions.push(eq(recruitmentEvents.brandId, brandId));
    }
    // 使用集中化的 Job 筛选工具
    const jobConditionTrend = buildJobCondition(jobNames ?? []);
    if (jobConditionTrend) {
      conditions.push(jobConditionTrend);
    }

    // 构建子查询的静态条件字符串（避免 Drizzle 参数重复绑定问题）
    const buildSubqueryConditions = (alias: string): string => {
      const parts: string[] = [];
      if (agentId) {
        const escapedAgentId = agentId.replace(/'/g, "''");
        parts.push(`${alias}.agent_id = '${escapedAgentId}'`);
      }
      if (brandId !== undefined) {
        parts.push(`${alias}.brand_id = ${brandId}`);
      }
      // 使用集中化的 Job 筛选工具
      if (hasJobFilter(jobNames)) {
        parts.push(buildJobConditionRaw(alias, jobNames!));
      }
      return parts.length > 0 ? "AND " + parts.join(" AND ") : "";
    };

    const contactedConditionsStr = buildSubqueryConditions("contacted");
    const startDateIso = startDate.toISOString();
    const endDateIso = endDate.toISOString();

    // 按日期聚合
    const results = await db
      .select({
        date: sql<string>`to_char(${recruitmentEvents.eventTime} AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD')`,
        messagesReceived: sql<number>`COALESCE(SUM(${recruitmentEvents.unreadCountBeforeReply}) FILTER (WHERE ${recruitmentEvents.eventType} = ${RecruitmentEventType.MESSAGE_RECEIVED}), 0)`,
        inboundCandidates: sql<number>`COUNT(DISTINCT ${recruitmentEvents.candidateKey}) FILTER (WHERE ${recruitmentEvents.eventType} = ${RecruitmentEventType.MESSAGE_RECEIVED} OR (${recruitmentEvents.eventType} = ${RecruitmentEventType.MESSAGE_SENT} AND ${recruitmentEvents.wasUnreadBeforeReply} = true))`,
        candidatesReplied: sql<number>`COUNT(DISTINCT ${recruitmentEvents.candidateKey}) FILTER (WHERE ${recruitmentEvents.eventType} = ${RecruitmentEventType.MESSAGE_SENT} AND ${recruitmentEvents.wasUnreadBeforeReply} = true)`,
        wechatExchanged: sql<number>`COUNT(DISTINCT ${recruitmentEvents.candidateKey}) FILTER (
          WHERE ${recruitmentEvents.eventType} = ${RecruitmentEventType.WECHAT_EXCHANGED}
          AND (
            ${recruitmentEvents.eventDetails}->>'exchangeType' = 'accepted'
            OR ${recruitmentEvents.eventDetails}->>'exchangeType' = 'completed'
            OR (
              ${recruitmentEvents.eventDetails}->>'exchangeType' IS NULL
              AND ${recruitmentEvents.eventDetails}->>'wechatNumber' IS NOT NULL
              AND ${recruitmentEvents.eventDetails}->>'wechatNumber' != ''
            )
          )
        )`,
        interviewsBooked: sql<number>`COUNT(DISTINCT ${recruitmentEvents.candidateKey}) FILTER (WHERE ${recruitmentEvents.eventType} = ${RecruitmentEventType.INTERVIEW_BOOKED})`,
        unreadReplied: sql<number>`COALESCE(SUM(${recruitmentEvents.unreadCountBeforeReply}) FILTER (WHERE ${recruitmentEvents.eventType} = ${RecruitmentEventType.MESSAGE_SENT} AND ${recruitmentEvents.wasUnreadBeforeReply} = true), 0)`,
        proactiveOutreach: sql<number>`COUNT(DISTINCT ${recruitmentEvents.candidateKey}) FILTER (WHERE ${recruitmentEvents.eventType} = ${RecruitmentEventType.CANDIDATE_CONTACTED})`,
        // proactiveResponded: 当天主动触达后收到回复的候选人（使用 candidate_name 宽松匹配）
        proactiveResponded: sql<number>`COUNT(DISTINCT ${recruitmentEvents.candidateName}) FILTER (
          WHERE ${recruitmentEvents.eventType} = ${RecruitmentEventType.MESSAGE_RECEIVED}
            AND ${recruitmentEvents.candidateName} IN (
              SELECT DISTINCT contacted.candidate_name
              FROM ${recruitmentEvents} AS contacted
              WHERE contacted.event_type = ${RecruitmentEventType.CANDIDATE_CONTACTED}
                AND contacted.event_time >= ${startDateIso}::timestamptz
                AND contacted.event_time <= ${endDateIso}::timestamptz
                ${sql.raw(contactedConditionsStr)}
                AND to_char(contacted.event_time AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD') = to_char(${recruitmentEvents.eventTime} AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD')
            )
        )`,
      })
      .from(recruitmentEvents)
      .where(and(...conditions))
      .groupBy(sql`to_char(${recruitmentEvents.eventTime} AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${recruitmentEvents.eventTime} AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD')`);

    return results.map(row => ({
      date: row.date,
      messagesReceived: Number(row.messagesReceived) || 0,
      inboundCandidates: Number(row.inboundCandidates) || 0,
      candidatesReplied: Number(row.candidatesReplied) || 0,
      wechatExchanged: Number(row.wechatExchanged) || 0,
      interviewsBooked: Number(row.interviewsBooked) || 0,
      unreadReplied: Number(row.unreadReplied) || 0,
      proactiveOutreach: Number(row.proactiveOutreach) || 0,
      proactiveResponded: Number(row.proactiveResponded) || 0,
    }));
  }

  /**
   * 获取未回复的候选人列表
   *
   * 未回复 = 入站候选人 - 已回复候选人
   * - 入站：有 message_received 或 message_sent(was_unread_before_reply=true)
   * - 已回复：有 message_sent(was_unread_before_reply=true)
   */
  async getUnrepliedCandidates(
    agentId: string | undefined,
    startDate: Date,
    endDate: Date
  ): Promise<{
    name: string;
    position: string | null;
    agentId: string;
    platform: string | null;
    lastMessageTime: string;
  }[]> {
    console.log(
      `${LOG_PREFIX} Getting unreplied candidates: ${agentId ?? "all"} from ${startDate.toISOString()} to ${endDate.toISOString()}`
    );

    const db = getDb();

    // 构建基础条件
    const conditions = [
      gte(recruitmentEvents.eventTime, startDate),
      lte(recruitmentEvents.eventTime, endDate),
    ];

    if (agentId) {
      conditions.push(eq(recruitmentEvents.agentId, agentId));
    }

    // 查询入站候选人（有 message_received 或 was_unread_before_reply=true 的 message_sent）
    const inboundQuery = db
      .selectDistinct({
        candidateKey: recruitmentEvents.candidateKey,
        candidateName: recruitmentEvents.candidateName,
        candidatePosition: recruitmentEvents.candidatePosition,
        agentId: recruitmentEvents.agentId,
        sourcePlatform: recruitmentEvents.sourcePlatform,
        lastMessageTime: sql<Date>`MAX(${recruitmentEvents.eventTime})`.as("last_message_time"),
      })
      .from(recruitmentEvents)
      .where(
        and(
          ...conditions,
          or(
            eq(recruitmentEvents.eventType, "message_received"),
            and(
              eq(recruitmentEvents.eventType, "message_sent"),
              eq(recruitmentEvents.wasUnreadBeforeReply, true)
            )
          )
        )
      )
      .groupBy(
        recruitmentEvents.candidateKey,
        recruitmentEvents.candidateName,
        recruitmentEvents.candidatePosition,
        recruitmentEvents.agentId,
        recruitmentEvents.sourcePlatform
      );

    // 查询已回复候选人
    const repliedQuery = db
      .selectDistinct({
        candidateKey: recruitmentEvents.candidateKey,
      })
      .from(recruitmentEvents)
      .where(
        and(
          ...conditions,
          eq(recruitmentEvents.eventType, "message_sent"),
          eq(recruitmentEvents.wasUnreadBeforeReply, true)
        )
      );

    // 执行查询
    const [inboundResults, repliedResults] = await Promise.all([inboundQuery, repliedQuery]);

    // 构建已回复候选人 Set
    const repliedKeys = new Set(repliedResults.map(r => r.candidateKey));

    // 过滤出未回复的候选人
    const unreplied = inboundResults
      .filter(c => !repliedKeys.has(c.candidateKey))
      .map(c => {
        // lastMessageTime 可能是 Date 或 string（取决于数据库驱动）
        const timeValue = c.lastMessageTime;
        const timeStr =
          timeValue instanceof Date
            ? timeValue.toISOString()
            : typeof timeValue === "string"
              ? timeValue
              : new Date().toISOString();
        return {
          name: c.candidateName ?? "未知",
          position: c.candidatePosition,
          agentId: c.agentId,
          platform: c.sourcePlatform,
          lastMessageTime: timeStr,
        };
      })
      .sort((a, b) => b.lastMessageTime.localeCompare(a.lastMessageTime)); // 按最近消息时间倒序

    console.log(`${LOG_PREFIX} Found ${unreplied.length} unreplied candidates`);

    return unreplied;
  }

  /**
   * 获取筛选器选项
   *
   * 返回可用的 Agent、Brand 和 Job 列表
   */
  async getFilterOptions(): Promise<{
    agents: Array<{ agentId: string; displayName: string }>;
    brands: Array<{ id: number; name: string }>;
    jobs: Array<{ value: string; label: string }>;
  }> {
    console.log(`${LOG_PREFIX} Getting filter options`);

    // 并行获取 Agent、Brand IDs 和 Job 选项
    const [agentIds, brandIds, jobs] = await Promise.all([
      recruitmentStatsRepository.getDistinctAgents(),
      recruitmentStatsRepository.getDistinctBrandIds(),
      recruitmentEventsRepository.getDistinctJobOptions(),
    ]);

    // Agent 列表（暂时使用 agentId 作为显示名称）
    const agents = agentIds.map((agentId: string) => ({
      agentId,
      displayName: agentId,
    }));

    // Brand 列表（关联 data_dictionary 获取名称）
    let brands: Array<{ id: number; name: string }> = [];
    if (brandIds.length > 0) {
      const db = getDb();
      brands = await db
        .select({
          id: dataDictionary.id,
          name: dataDictionary.mappingValue,
        })
        .from(dataDictionary)
        .where(
          and(
            eq(dataDictionary.dictionaryType, getDictionaryType("BRAND")),
            eq(dataDictionary.isActive, true),
            inArray(dataDictionary.id, brandIds)
          )
        )
        .orderBy(dataDictionary.displayOrder);
    }

    console.log(`${LOG_PREFIX} Filter options: ${agents.length} agents, ${brands.length} brands, ${jobs.length} jobs`);

    return { agents, brands, jobs };
  }
}

/**
 * 单例实例
 */
export const queryService = new QueryService();
