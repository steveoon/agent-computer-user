import {
  createAgentForbiddenResponse,
  getAllowedAgentIds,
  isAgentAllowed,
} from "@/lib/utils/open-api-agent-auth";
import { ApiErrorType, createErrorResponse } from "@/lib/utils/api-response";
import { parseBeijingDateString, toBeijingDayEnd } from "@/lib/utils/beijing-timezone";

export function authorizeStatsAgent(req: Request, agentId: string | undefined, correlationId: string) {
  const allowedAgentIds = getAllowedAgentIds(req);

  if (!agentId) {
    if (allowedAgentIds.includes("*")) return null;
    return createErrorResponse(ApiErrorType.Forbidden, {
      message: "agentId is required unless this API key can access all agents",
      correlationId,
    });
  }

  if (!isAgentAllowed(agentId, allowedAgentIds)) {
    return createAgentForbiddenResponse(agentId, correlationId);
  }

  return null;
}

export function parseOptionalNumber(value: string | null, fieldName: string): number | undefined {
  if (value === null || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${fieldName} must be an integer`);
  }
  return parsed;
}

export function parseJobNames(searchParams: URLSearchParams): string[] | undefined {
  const values = searchParams.getAll("jobNames");
  const normalized = values.flatMap(value => value.split(","));
  const jobNames = normalized.map(value => value.trim()).filter(Boolean);
  return jobNames.length > 0 ? jobNames : undefined;
}

export function parseDateParam(value: string | null, fieldName: string, endOfDay = false): Date {
  if (!value) {
    throw new Error(`${fieldName} is required`);
  }

  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? parseBeijingDateString(value)
    : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} must be a valid date`);
  }

  return endOfDay ? toBeijingDayEnd(date) : date;
}
