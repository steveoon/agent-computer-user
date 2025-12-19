/**
 * Query Service
 *
 * 统计数据查询服务
 * 提供日/周/月/年等多时间维度的查询支持
 */

import { eq, and, or, gte, lte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { recruitmentEvents } from "@/db/schema";
import { recruitmentStatsRepository, calculateRate } from "./repository";
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
   *
   * @param agentId - 可选 Agent ID
   * @param days - 周期天数（默认 7 天）
   * @param referenceEndDate - 参考结束日期（默认为今天，用于支持"昨天"等历史日期查询）
   */
  async getDashboardSummary(
    agentId?: string,
    days: number = 7,
    referenceEndDate?: Date
  ): Promise<DashboardSummary> {
    // 使用传入的结束日期，或默认为今天
    const endDateRef = referenceEndDate ?? new Date();

    // 当前周期（使用 UTC 保持与 aggregation.service 一致）
    const currentEnd = new Date(endDateRef);
    currentEnd.setUTCHours(23, 59, 59, 999);

    const currentStart = new Date(endDateRef);
    currentStart.setUTCDate(currentStart.getUTCDate() - days + 1);
    currentStart.setUTCHours(0, 0, 0, 0);

    // 上一周期
    const previousEnd = new Date(currentStart);
    previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
    previousEnd.setUTCHours(23, 59, 59, 999);

    const previousStart = new Date(previousEnd);
    previousStart.setUTCDate(previousStart.getUTCDate() - days + 1);
    previousStart.setUTCHours(0, 0, 0, 0);

    console.log(
      `${LOG_PREFIX} Dashboard summary: current=${currentStart.toISOString()}-${currentEnd.toISOString()}, previous=${previousStart.toISOString()}-${previousEnd.toISOString()}`
    );

    // 并行查询当前和上一周期
    const [currentRaw, previousRaw] = await Promise.all([
      recruitmentStatsRepository.queryAggregatedStats(agentId, currentStart, currentEnd),
      recruitmentStatsRepository.queryAggregatedStats(agentId, previousStart, previousEnd),
    ]);

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
   *
   * @param agentId - 可选 Agent ID
   * @param startDate - 开始日期
   * @param endDate - 结束日期
   * @param brandId - 可选品牌 ID
   * @param jobId - 可选岗位 ID
   */
  async getStatsTrend(
    agentId: string | undefined,
    startDate: Date,
    endDate: Date,
    brandId?: number,
    jobId?: number
  ): Promise<DailyTrendItem[]> {
    console.log(
      `${LOG_PREFIX} Getting stats trend: ${agentId ?? "all"} from ${startDate.toISOString()} to ${endDate.toISOString()}`
    );

    // 查询原始日统计数据
    const rawStats = await recruitmentStatsRepository.queryStats(
      agentId,
      startDate,
      endDate,
      brandId,
      jobId
    );

    // 按日期聚合（因为可能有多个 brand/job 组合）
    const dailyMap = new Map<string, DailyTrendItem>();

    for (const row of rawStats) {
      const dateKey = row.statDate.toISOString().split("T")[0];
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
}

/**
 * 单例实例
 */
export const queryService = new QueryService();
