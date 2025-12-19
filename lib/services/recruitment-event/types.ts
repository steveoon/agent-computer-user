/**
 * Recruitment Event Service - Internal Type Definitions
 *
 * These types are used internally by the service and should not be exposed directly.
 * External consumers should use the types exported from db/types.ts.
 */

import type { SourcePlatformValue, ApiSourceValue } from "@/db/types";

/**
 * Context information for recruitment events
 * Passed through AsyncLocalStorage for request-level isolation
 */
export interface RecruitmentContext {
  /** Agent identifier (e.g., "zhipin-001") */
  agentId: string;
  /** Brand ID for filtering */
  brandId?: number;
  /** Source platform (zhipin, yupao) */
  sourcePlatform: SourcePlatformValue;
  /** API source (web, open_api) - identifies request origin */
  apiSource: ApiSourceValue;
  /** Job ID if available */
  jobId?: number;
  /** Job name if available */
  jobName?: string;
}

/**
 * Candidate snapshot for event recording
 * Captured at event time to preserve historical data
 */
export interface CandidateSnapshot {
  /** Candidate name (required) */
  name: string;
  /** Position/job title */
  position?: string;
  /** Age (string format from platform) */
  age?: string;
  /** Gender */
  gender?: string;
  /** Education level */
  education?: string;
  /** Expected salary */
  expectedSalary?: string;
  /** Expected work location */
  expectedLocation?: string;
  /** Height (blue-collar specific) */
  height?: string;
  /** Weight (blue-collar specific) */
  weight?: string;
  /** Has health certificate (blue-collar specific) */
  healthCert?: boolean;
}

/**
 * Options for message sent event
 */
export interface MessageSentOptions {
  /** Whether this was an auto-reply */
  isAutoReply?: boolean;
}

/**
 * Details for interview booking event
 */
export interface InterviewBookingDetails {
  /** Interview time (ISO string or formatted) */
  interviewTime: string;
  /** Interview address */
  address?: string;
  /** Candidate phone number */
  candidatePhone?: string;
}

/**
 * Sender type for received messages
 */
export type MessageSenderType = "candidate" | "recruiter" | "system" | "unknown";
