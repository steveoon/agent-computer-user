/**
 * Query Service
 *
 * 统计数据查询服务
 * 提供日/周/月/年等多时间维度的查询支持
 */

import { recruitmentStatsRepository, calculateRate } from "./repository";
import type {
  StatsQuery,
  AggregatedStats,
  TimeRangeValue,
  DashboardSummary,
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
    return rawStats.map((row) => ({
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
   */
  async getDashboardSummary(
    agentId?: string,
    days: number = 7
  ): Promise<DashboardSummary> {
    const now = new Date();

    // 当前周期
    const currentEnd = new Date(now);
    currentEnd.setHours(23, 59, 59, 999);

    const currentStart = new Date(now);
    currentStart.setDate(currentStart.getDate() - days + 1);
    currentStart.setHours(0, 0, 0, 0);

    // 上一周期
    const previousEnd = new Date(currentStart);
    previousEnd.setDate(previousEnd.getDate() - 1);
    previousEnd.setHours(23, 59, 59, 999);

    const previousStart = new Date(previousEnd);
    previousStart.setDate(previousStart.getDate() - days + 1);
    previousStart.setHours(0, 0, 0, 0);

    console.log(
      `${LOG_PREFIX} Dashboard summary: current=${currentStart.toISOString()}-${currentEnd.toISOString()}, previous=${previousStart.toISOString()}-${previousEnd.toISOString()}`
    );

    // 并行查询当前和上一周期
    const [currentRaw, previousRaw] = await Promise.all([
      recruitmentStatsRepository.queryAggregatedStats(
        agentId,
        currentStart,
        currentEnd
      ),
      recruitmentStatsRepository.queryAggregatedStats(
        agentId,
        previousStart,
        previousEnd
      ),
    ]);

    // 转换格式
    const current = currentRaw.map((row) => this.toAggregatedStats(row, currentStart, currentEnd));
    const previous = previousRaw.map((row) => this.toAggregatedStats(row, previousStart, previousEnd));

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
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const stats = await recruitmentStatsRepository.queryStats(
      agentId,
      dayStart,
      dayEnd
    );

    return stats.map((row) => ({
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
        // 计算所在周的周一到周日
        const weekStart = new Date(startDate);
        const dayOfWeek = weekStart.getDay();
        // 调整到周一（如果是周日，dayOfWeek=0，需要调整 6 天）
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        weekStart.setDate(weekStart.getDate() - daysToMonday);
        weekStart.setHours(0, 0, 0, 0);

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        return { start: weekStart, end: weekEnd };
      }

      case "month": {
        // 计算所在月的第一天到最后一天
        const monthStart = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        const monthEnd = new Date(
          startDate.getFullYear(),
          startDate.getMonth() + 1,
          0,
          23,
          59,
          59,
          999
        );
        return { start: monthStart, end: monthEnd };
      }

      case "year": {
        // 计算所在年的第一天到最后一天
        const yearStart = new Date(startDate.getFullYear(), 0, 1);
        const yearEnd = new Date(startDate.getFullYear(), 11, 31, 23, 59, 59, 999);
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
      uniqueCandidates: calcTrend(
        sumCurrent.uniqueCandidates,
        sumPrevious.uniqueCandidates
      ),
      messagesSent: calcTrend(sumCurrent.messagesSent, sumPrevious.messagesSent),
      wechatExchanged: calcTrend(
        sumCurrent.wechatExchanged,
        sumPrevious.wechatExchanged
      ),
      interviewsBooked: calcTrend(
        sumCurrent.interviewsBooked,
        sumPrevious.interviewsBooked
      ),
      candidatesHired: calcTrend(
        sumCurrent.candidatesHired,
        sumPrevious.candidatesHired
      ),
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
        messagesSent: acc.messagesSent + s.messagesSent,
        wechatExchanged: acc.wechatExchanged + s.wechatExchanged,
        interviewsBooked: acc.interviewsBooked + s.interviewsBooked,
        candidatesHired: acc.candidatesHired + s.candidatesHired,
      }),
      {
        totalEvents: 0,
        uniqueCandidates: 0,
        messagesSent: 0,
        wechatExchanged: 0,
        interviewsBooked: 0,
        candidatesHired: 0,
      }
    );
  }
}

/**
 * 单例实例
 */
export const queryService = new QueryService();
