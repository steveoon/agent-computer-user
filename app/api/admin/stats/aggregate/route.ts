/**
 * Stats Aggregation API Endpoint
 *
 * GET /api/admin/stats/aggregate - 获取调度器状态
 * POST /api/admin/stats/aggregate - 手动触发聚合
 */

import { z } from "zod";
import { schedulerService } from "@/lib/services/recruitment-stats";
import {
  createSuccessResponse,
  createErrorResponse,
  ApiErrorType,
} from "@/lib/utils/api-response";

/**
 * 手动触发聚合的请求体 Schema
 */
const triggerSchema = z.object({
  /** 可选 Agent ID，如果提供则进行全量重算 */
  agentId: z.string().optional(),
  /** 是否强制重算（目前未使用） */
  force: z.boolean().default(false),
});

/**
 * GET - 获取调度器状态
 */
export async function GET() {
  try {
    const status = schedulerService.getStatus();

    return createSuccessResponse({
      scheduler: {
        isRunning: status.isRunning,
        lastRunTime: status.lastRunTime?.toISOString() ?? null,
        nextMainAggregationTime: status.nextMainAggregationTime?.toISOString() ?? null,
        config: {
          dirtyIntervalMinutes: Math.round(status.config.dirtyIntervalMs / 60000),
          mainAggregationHour: status.config.mainAggregationHour,
          batchSize: status.config.batchSize,
          enabled: status.config.enabled,
        },
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
    });
  } catch (error) {
    console.error("[API][Stats][Aggregate] Get status failed:", error);
    return createErrorResponse(ApiErrorType.InternalServerError, {
      message: error instanceof Error ? error.message : "Failed to get scheduler status",
    });
  }
}

/**
 * POST - 手动触发聚合
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    // 验证请求体
    const parseResult = triggerSchema.safeParse(body);
    if (!parseResult.success) {
      return createErrorResponse(ApiErrorType.BadRequest, {
        message: "Invalid request body",
        details: parseResult.error.issues,
      });
    }

    const { agentId } = parseResult.data;

    // 触发聚合
    const result = await schedulerService.triggerManual(agentId);

    return createSuccessResponse({
      message: agentId
        ? `Full re-aggregation completed for ${agentId}`
        : "Dirty aggregation completed",
      result: {
        success: result.success,
        processedCount: result.processedCount,
        failedCount: result.failedCount,
        duration: result.duration,
        errors: result.errors,
      },
    });
  } catch (error) {
    console.error("[API][Stats][Aggregate] Trigger failed:", error);
    return createErrorResponse(ApiErrorType.InternalServerError, {
      message: error instanceof Error ? error.message : "Aggregation failed",
    });
  }
}
