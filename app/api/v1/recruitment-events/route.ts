/**
 * POST /api/v1/recruitment-events
 *
 * Open API endpoint for writing recruitment tracking events.
 * This does not expose browser automation tools.
 */

import {
  createErrorResponse,
  createSuccessResponse,
  generateCorrelationId,
  handleUnknownError,
  ApiErrorType,
} from "@/lib/utils/api-response";
import { ErrorCode } from "@/lib/errors";
import {
  parseOpenApiRecruitmentEventsBody,
  processOpenApiRecruitmentEvents,
} from "@/lib/services/recruitment-event/open-api";
import { getAllowedAgentIds } from "@/lib/utils/open-api-agent-auth";

export const maxDuration = 300;

export async function POST(req: Request) {
  const correlationId = generateCorrelationId();

  try {
    const allowedAgentIds = getAllowedAgentIds(req);
    const body = await req.json();
    const events = parseOpenApiRecruitmentEventsBody(body);
    const result = await processOpenApiRecruitmentEvents(events, allowedAgentIds);

    return createSuccessResponse(result, { correlationId });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return createErrorResponse(ApiErrorType.BadRequest, {
        message: "Invalid JSON request body",
        correlationId,
      });
    }

    if (error && typeof error === "object" && "issues" in error) {
      return createErrorResponse(ApiErrorType.BadRequest, {
        message: "Invalid request body",
        details: error,
        correlationId,
      });
    }

    return handleUnknownError(error, correlationId, ErrorCode.SYSTEM_INTERNAL);
  }
}
