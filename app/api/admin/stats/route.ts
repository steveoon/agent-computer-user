/**
 * Stats API Endpoint
 *
 * GET /api/admin/stats - 查询统计数据
 *
 * Query Parameters:
 * - agentId: 可选，Agent ID
 * - startDate: 必填，开始日期 (YYYY-MM-DD)
 * - endDate: 必填，结束日期 (YYYY-MM-DD)
 * - timeRange: 可选，时间范围类型 (day|week|month|year|custom)
 * - brandId: 可选，品牌 ID
 * - jobId: 可选，岗位 ID
 */

import { queryService, statsQuerySchema } from "@/lib/services/recruitment-stats";
import {
  createSuccessResponse,
  createErrorResponse,
  ApiErrorType,
} from "@/lib/utils/api-response";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // 解析查询参数
    const queryParams = {
      agentId: searchParams.get("agentId") ?? undefined,
      startDate: searchParams.get("startDate"),
      endDate: searchParams.get("endDate"),
      timeRange: searchParams.get("timeRange") ?? "day",
      brandId: searchParams.get("brandId")
        ? parseInt(searchParams.get("brandId")!, 10)
        : undefined,
      jobId: searchParams.get("jobId")
        ? parseInt(searchParams.get("jobId")!, 10)
        : undefined,
      groupBy: searchParams.get("groupBy") ?? "agent_only",
    };

    // 验证必填参数
    if (!queryParams.startDate || !queryParams.endDate) {
      return createErrorResponse(ApiErrorType.BadRequest, {
        message: "startDate and endDate are required",
      });
    }

    // Zod 验证
    const parseResult = statsQuerySchema.safeParse(queryParams);
    if (!parseResult.success) {
      return createErrorResponse(ApiErrorType.BadRequest, {
        message: "Invalid query parameters",
        details: parseResult.error.issues,
      });
    }

    // 查询统计
    const stats = await queryService.queryStats(parseResult.data);

    return createSuccessResponse({
      stats,
      query: {
        ...parseResult.data,
        startDate: parseResult.data.startDate.toISOString(),
        endDate: parseResult.data.endDate.toISOString(),
      },
    });
  } catch (error) {
    console.error("[API][Stats] Query failed:", error);
    return createErrorResponse(ApiErrorType.InternalServerError, {
      message: error instanceof Error ? error.message : "Query failed",
    });
  }
}
