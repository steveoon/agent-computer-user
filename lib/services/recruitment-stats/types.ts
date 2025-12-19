/**
 * Recruitment Stats Types
 *
 * 统计聚合模块的类型定义
 */

import { z } from "zod";

/**
 * 聚合维度枚举
 * 决定统计的粒度
 */
export const AggregationDimension = {
  /** 仅按 Agent 聚合 */
  AGENT_ONLY: "agent_only",
  /** 按 Agent + 品牌聚合 */
  AGENT_BRAND: "agent_brand",
  /** 按 Agent + 岗位聚合 */
  AGENT_JOB: "agent_job",
  /** 按 Agent + 品牌 + 岗位聚合（最细粒度） */
  AGENT_BRAND_JOB: "agent_brand_job",
} as const;

export type AggregationDimensionValue =
  (typeof AggregationDimension)[keyof typeof AggregationDimension];

/**
 * 时间范围枚举
 * 用于查询和展示
 */
export const TimeRange = {
  DAY: "day",
  WEEK: "week",
  MONTH: "month",
  YEAR: "year",
  CUSTOM: "custom",
} as const;

export type TimeRangeValue = (typeof TimeRange)[keyof typeof TimeRange];

/**
 * 聚合统计结果 Schema
 */
export const aggregatedStatsSchema = z.object({
  // 维度
  agentId: z.string(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  brandId: z.number().nullable(),
  jobId: z.number().nullable(),

  // 流量指标
  totalEvents: z.number(),
  uniqueCandidates: z.number(),
  uniqueSessions: z.number(),

  // 入站漏斗指标
  messagesSent: z.number(),
  messagesReceived: z.number(),
  inboundCandidates: z.number(),
  candidatesReplied: z.number(),
  unreadReplied: z.number(),

  // 出站漏斗指标
  proactiveOutreach: z.number(),
  proactiveResponded: z.number(),

  // 转化指标
  wechatExchanged: z.number(),
  interviewsBooked: z.number(),
  candidatesHired: z.number(),

  // 计算指标（百分比 * 100，如 85.5% = 8550）
  replyRate: z.number().nullable(),
  wechatRate: z.number().nullable(),
  interviewRate: z.number().nullable(),
});

export type AggregatedStats = z.infer<typeof aggregatedStatsSchema>;

/**
 * 统计查询参数 Schema
 */
export const statsQuerySchema = z.object({
  agentId: z.string().optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  timeRange: z.enum(["day", "week", "month", "year", "custom"]).default("day"),
  brandId: z.coerce.number().optional(),
  jobId: z.coerce.number().optional(),
  groupBy: z
    .enum(["agent_only", "agent_brand", "agent_job", "agent_brand_job"])
    .default("agent_only"),
});

export type StatsQuery = z.infer<typeof statsQuerySchema>;

/**
 * 脏数据记录
 * 表示需要重新聚合的维度组合
 */
export interface DirtyRecord {
  agentId: string;
  statDate: Date;
  brandId: number | null;
  jobId: number | null;
}

/**
 * 调度器配置
 */
export interface SchedulerConfig {
  /** 脏数据处理间隔（毫秒） */
  dirtyIntervalMs: number;
  /** 每日主聚合时间（小时，0-23） */
  mainAggregationHour: number;
  /** 批量处理大小 */
  batchSize: number;
  /** 是否启用调度器 */
  enabled: boolean;
}

/**
 * 聚合任务结果
 */
export interface AggregationResult {
  success: boolean;
  processedCount: number;
  failedCount: number;
  duration: number; // 毫秒
  errors?: string[];
}

/**
 * 调度器状态
 */
export interface SchedulerStatus {
  isRunning: boolean;
  lastRunResult: AggregationResult | null;
  lastRunTime: Date | null;
  nextMainAggregationTime: Date | null;
  config: SchedulerConfig;
}

/**
 * 日统计记录（用于 Repository 层）
 */
export interface DailyStatsRecord {
  agentId: string;
  statDate: Date;
  brandId: number | null;
  jobId: number | null;

  // 指标
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

  // 计算指标
  replyRate: number | null;
  wechatRate: number | null;
  interviewRate: number | null;
}

/**
 * Dashboard 概览数据
 */
export interface DashboardSummary {
  /** 当前周期统计 */
  current: AggregatedStats[];
  /** 上一周期统计（用于对比） */
  previous: AggregatedStats[];
  /** 环比趋势（百分比变化） */
  trend: Record<string, number | null>;
}

/**
 * Dashboard 筛选参数
 */
export interface DashboardFilters {
  startDate: string; // ISO date string
  endDate: string;
  agentId?: string;
  brandId?: number;
  jobId?: number;
  preset?: "today" | "yesterday" | "last7days" | "last14days" | "last30days";
}

/**
 * 日粒度趋势数据项
 */
export interface DailyTrendItem {
  date: string;
  messagesReceived: number;
  inboundCandidates: number;
  candidatesReplied: number;
  wechatExchanged: number;
  interviewsBooked: number;
  unreadReplied: number;
  proactiveOutreach: number;
  proactiveResponded: number;
}

/**
 * Dashboard 完整数据响应
 */
export interface DashboardData {
  summary: DashboardSummary;
  dailyTrend: DailyTrendItem[];
}
