"use server";

import { queryService } from "@/lib/services/recruitment-stats/query.service";
import { aggregationService } from "@/lib/services/recruitment-stats/aggregation.service";
import { schedulerService } from "@/lib/services/recruitment-stats";
import {
  toBeijingMidnight,
  toBeijingDayEnd,
  parseBeijingDateString,
} from "@/lib/utils/beijing-timezone";
import type {
  DashboardFilters,
  DashboardData,
  DashboardSummary,
  DailyTrendItem,
  AggregationResult,
  SchedulerStatus,
} from "@/lib/services/recruitment-stats/types";

const LOG_PREFIX = "[RecruitmentStats][Action]";

/**
 * 招聘统计 Dashboard Server Actions
 *
 * 用于内部运营人员查看招聘数据统计
 */

/**
 * 计算日期范围（根据 preset 或自定义日期）
 *
 * 使用北京时区计算日期边界，确保与数据库存储的 stat_date 一致
 */
function calculateDateRange(filters: DashboardFilters): {
  startDate: Date;
  endDate: Date;
  days: number;
} {
  const now = new Date();
  let startDate: Date;
  let endDate: Date;
  let days: number;

  switch (filters.preset) {
    case "today":
      startDate = toBeijingMidnight(now);
      endDate = toBeijingDayEnd(now);
      days = 1;
      break;

    case "yesterday": {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      startDate = toBeijingMidnight(yesterday);
      endDate = toBeijingDayEnd(yesterday);
      days = 1;
      break;
    }

    case "last7days": {
      endDate = toBeijingDayEnd(now);
      const start = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      startDate = toBeijingMidnight(start);
      days = 7;
      break;
    }

    case "last14days": {
      endDate = toBeijingDayEnd(now);
      const start = new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000);
      startDate = toBeijingMidnight(start);
      days = 14;
      break;
    }

    case "last30days": {
      endDate = toBeijingDayEnd(now);
      const start = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
      startDate = toBeijingMidnight(start);
      days = 30;
      break;
    }

    default:
      // 自定义日期范围 - 解析北京时间日期字符串
      startDate = parseBeijingDateString(filters.startDate);
      endDate = toBeijingDayEnd(parseBeijingDateString(filters.endDate));
      days = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      break;
  }

  return { startDate, endDate, days };
}

/**
 * 获取 Dashboard 完整数据
 *
 * 包含汇总统计和日粒度趋势数据
 */
export async function getDashboardData(
  filters: DashboardFilters
): Promise<{ success: true; data: DashboardData } | { success: false; error: string }> {
  try {
    const { startDate, endDate, days } = calculateDateRange(filters);
    const { agentId, brandId, jobId } = filters;

    // 并行获取汇总数据和趋势数据
    // 注意：传入 endDate 作为参考日期，支持"昨天"等历史日期查询
    const [summary, dailyTrend] = await Promise.all([
      queryService.getDashboardSummary(agentId, days, endDate, brandId, jobId),
      queryService.getStatsTrend(agentId, startDate, endDate, brandId, jobId),
    ]);

    return {
      success: true,
      data: {
        summary,
        dailyTrend,
      },
    };
  } catch (error) {
    console.error(`${LOG_PREFIX} getDashboardData failed:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "获取数据失败",
    };
  }
}

/**
 * 仅获取汇总数据（轻量级）
 */
export async function getDashboardSummary(
  agentId?: string,
  days: number = 7
): Promise<{ success: true; data: DashboardSummary } | { success: false; error: string }> {
  try {
    const summary = await queryService.getDashboardSummary(agentId, days);
    return {
      success: true,
      data: summary,
    };
  } catch (error) {
    console.error(`${LOG_PREFIX} getDashboardSummary failed:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "获取汇总数据失败",
    };
  }
}

/**
 * 仅获取趋势数据（用于图表）
 */
export async function getStatsTrend(
  filters: DashboardFilters
): Promise<{ success: true; data: DailyTrendItem[] } | { success: false; error: string }> {
  try {
    const { startDate, endDate } = calculateDateRange(filters);
    const { agentId, brandId, jobId } = filters;
    const dailyTrend = await queryService.getStatsTrend(
      agentId,
      startDate,
      endDate,
      brandId,
      jobId
    );
    return {
      success: true,
      data: dailyTrend,
    };
  } catch (error) {
    console.error(`${LOG_PREFIX} getStatsTrend failed:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "获取趋势数据失败",
    };
  }
}

/**
 * 手动触发统计聚合
 *
 * 调用 aggregationService.runMainAggregation() 执行完整的聚合流程：
 * 1. 先处理所有脏数据记录（增量聚合）
 * 2. 如果没有脏数据，则执行全量重算（兜底）
 */
export async function triggerAggregation(): Promise<
  { success: true; data: AggregationResult } | { success: false; error: string }
> {
  try {
    console.log(`${LOG_PREFIX} Manual aggregation triggered`);
    const result = await aggregationService.runMainAggregation(100);
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error(`${LOG_PREFIX} triggerAggregation failed:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "聚合失败",
    };
  }
}

/**
 * 序列化后的调度器状态（用于 Server Action 响应）
 */
export interface SerializedSchedulerStatus {
  isRunning: boolean;
  lastRunTime: string | null;
  nextMainAggregationTime: string | null;
  config: {
    dirtyIntervalMinutes: number;
    mainAggregationHour: number;
    batchSize: number;
    enabled: boolean;
  };
  lastResult: {
    success: boolean;
    processedCount: number;
    failedCount: number;
    duration: number;
    errors?: string[];
  } | null;
}

/**
 * 获取调度器状态
 */
export async function getSchedulerStatus(): Promise<
  { success: true; data: SerializedSchedulerStatus } | { success: false; error: string }
> {
  try {
    const status: SchedulerStatus = schedulerService.getStatus();

    // 序列化 Date 对象为 ISO 字符串
    const serialized: SerializedSchedulerStatus = {
      isRunning: status.isRunning,
      lastRunTime: status.lastRunTime?.toISOString() ?? null,
      nextMainAggregationTime: status.nextMainAggregationTime?.toISOString() ?? null,
      config: {
        dirtyIntervalMinutes: Math.round(status.config.dirtyIntervalMs / 60000),
        mainAggregationHour: status.config.mainAggregationHour,
        batchSize: status.config.batchSize,
        enabled: status.config.enabled,
      },
      lastResult: status.lastRunResult
        ? {
            success: status.lastRunResult.success,
            processedCount: status.lastRunResult.processedCount,
            failedCount: status.lastRunResult.failedCount,
            duration: status.lastRunResult.duration,
            errors: status.lastRunResult.errors,
          }
        : null,
    };

    return {
      success: true,
      data: serialized,
    };
  } catch (error) {
    console.error(`${LOG_PREFIX} getSchedulerStatus failed:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "获取调度器状态失败",
    };
  }
}

/**
 * 未回复候选人信息
 */
export interface UnrepliedCandidate {
  name: string;
  position: string | null;
  agentId: string;
  platform: string | null;
  lastMessageTime: string;
}

/**
 * 获取未回复的候选人列表
 *
 * 未回复 = 入站候选人 - 已回复候选人
 * - 入站：有 message_received 或 message_sent(was_unread_before_reply=true)
 * - 已回复：有 message_sent(was_unread_before_reply=true)
 */
export async function getUnrepliedCandidates(
  filters: DashboardFilters
): Promise<
  { success: true; data: UnrepliedCandidate[] } | { success: false; error: string }
> {
  try {
    const { startDate, endDate } = calculateDateRange(filters);
    const { agentId } = filters;

    const unreplied = await queryService.getUnrepliedCandidates(
      agentId,
      startDate,
      endDate
    );

    return {
      success: true,
      data: unreplied,
    };
  } catch (error) {
    console.error(`${LOG_PREFIX} getUnrepliedCandidates failed:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "获取未回复候选人失败",
    };
  }
}

/**
 * Agent 筛选选项
 */
export interface AgentOption {
  agentId: string;
  displayName: string;
}

/**
 * Brand 筛选选项
 */
export interface BrandOption {
  id: number;
  name: string;
}

/**
 * 筛选器选项
 */
export interface FilterOptions {
  agents: AgentOption[];
  brands: BrandOption[];
}

/**
 * 获取 Dashboard 筛选器选项
 *
 * 返回可用的 Agent 和 Brand 列表
 */
export async function getFilterOptions(): Promise<
  { success: true; data: FilterOptions } | { success: false; error: string }
> {
  try {
    const options = await queryService.getFilterOptions();
    return {
      success: true,
      data: options,
    };
  } catch (error) {
    console.error(`${LOG_PREFIX} getFilterOptions failed:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "获取筛选选项失败",
    };
  }
}
