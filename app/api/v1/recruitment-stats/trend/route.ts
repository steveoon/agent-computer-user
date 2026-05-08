/**
 * GET /api/v1/recruitment-stats/trend
 *
 * Open API endpoint for day-grain recruitment trends.
 */

import {
  ApiErrorType,
  createErrorResponse,
  createSuccessResponse,
  generateCorrelationId,
  handleUnknownError,
} from "@/lib/utils/api-response";
import { ErrorCode } from "@/lib/errors";
import { queryService } from "@/lib/services/recruitment-stats/query.service";
import {
  authorizeStatsAgent,
  parseDateParam,
  parseJobNames,
  parseOptionalNumber,
} from "../_utils";

export async function GET(req: Request) {
  const correlationId = generateCorrelationId();

  try {
    const url = new URL(req.url);
    const agentId = url.searchParams.get("agentId") || undefined;
    const authError = authorizeStatsAgent(req, agentId, correlationId);
    if (authError) return authError;

    const startDate = parseDateParam(url.searchParams.get("startDate"), "startDate");
    const endDate = parseDateParam(url.searchParams.get("endDate"), "endDate", true);
    if (startDate.getTime() > endDate.getTime()) {
      return createErrorResponse(ApiErrorType.BadRequest, {
        message: "startDate must be before or equal to endDate",
        correlationId,
      });
    }

    const brandId = parseOptionalNumber(url.searchParams.get("brandId"), "brandId");
    const jobNames = parseJobNames(url.searchParams);
    const trend = await queryService.getStatsTrend(agentId, startDate, endDate, brandId, jobNames);

    const message =
      trend.length === 0
        ? "No recruitment trend data found for the requested agent and date range"
        : undefined;

    return createSuccessResponse({ trend }, { correlationId, message });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("must be") || error.message.includes("is required"))
    ) {
      return createErrorResponse(ApiErrorType.BadRequest, {
        message: error.message,
        correlationId,
      });
    }

    return handleUnknownError(error, correlationId, ErrorCode.SYSTEM_INTERNAL);
  }
}
