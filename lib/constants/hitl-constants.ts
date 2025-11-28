/**
 * Human-in-the-Loop (HITL) Constants
 *
 * Shared constants for HITL workflow that can be safely imported
 * by both client and server components.
 */

// Approval constants shared between frontend and backend
export const APPROVAL = {
  YES: "Yes, confirmed.",
  NO: "No, denied.",
} as const;

export type ApprovalValue = (typeof APPROVAL)[keyof typeof APPROVAL];
