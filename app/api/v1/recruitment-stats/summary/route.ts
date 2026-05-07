/**
 * GET /api/v1/recruitment-stats/summary
 *
 * Open API endpoint for Dashboard summary metrics.
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
  parseJobNames,
  parseOptionalNumber,
  parseDateParam,
} from "../_utils";

export async function GET(req: Request) {
  const correlationId = generateCorrelationId();

  try {
    const url = new URL(req.url);
    const agentId = url.searchParams.get("agentId") || undefined;
    const authError = authorizeStatsAgent(req, agentId, correlationId);
    if (authError) return authError;

    const daysRaw = url.searchParams.get("days");
    const days = daysRaw ? Number(daysRaw) : 7;
    if (!Number.isInteger(days) || days < 1 || days > 366) {
      return createErrorResponse(ApiErrorType.BadRequest, {
        message: "days must be an integer between 1 and 366",
        correlationId,
      });
    }

    const brandId = parseOptionalNumber(url.searchParams.get("brandId"), "brandId");
    const endDateRaw = url.searchParams.get("endDate");
    const endDate = endDateRaw ? parseDateParam(endDateRaw, "endDate") : undefined;
    const jobNames = parseJobNames(url.searchParams);

    const summary = await queryService.getDashboardSummary(
      agentId,
      days,
      endDate,
      brandId,
      jobNames
    );

    const message =
      Array.isArray(summary.current) && summary.current.length === 0
        ? "No recruitment stats found for the requested agent and date range"
        : undefined;

    return createSuccessResponse({ summary }, { correlationId, message });
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
