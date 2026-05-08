import { ApiErrorType, createErrorResponse } from "@/lib/utils/api-response";

const ALLOWED_AGENT_IDS_HEADER = "x-open-api-allowed-agent-ids";

export function getAllowedAgentIds(request: Request): string[] {
  const raw = request.headers.get(ALLOWED_AGENT_IDS_HEADER);
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string" && item.length > 0);
  } catch {
    return [];
  }
}

export function isAgentAllowed(agentId: string, allowedAgentIds: readonly string[]): boolean {
  return allowedAgentIds.includes("*") || allowedAgentIds.includes(agentId);
}

export function createAgentForbiddenResponse(agentId: string, correlationId?: string) {
  return createErrorResponse(ApiErrorType.Forbidden, {
    message: `Agent '${agentId}' is not authorized for this API key`,
    details: { agentId },
    correlationId,
  });
}
