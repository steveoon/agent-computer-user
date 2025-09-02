/**
 * Utility functions for Zhipin automation
 */

import { AutomationResult } from "./types";
import { TIMING } from "./constants";

/**
 * Sleep helper
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry helper for flaky operations
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = TIMING.maxRetries,
  delay: number = TIMING.retryDelay
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await sleep(delay);
      }
    }
  }

  throw lastError || new Error("Operation failed after retries");
}

/**
 * Create automation result
 */
export function createResult<T>(success: boolean, data?: T, error?: string): AutomationResult<T> {
  return {
    success,
    ...(data !== undefined && { data }),
    ...(error && { error }),
  };
}

/**
 * Check if URL is Zhipin chat page
 */
export function isZhipinChatUrl(url: string): boolean {
  return url.includes("zhipin.com") && url.includes("chat");
}

/**
 * Extract number from text (e.g., "3 unread" -> 3)
 */
export function extractNumber(text: string): number {
  const match = text.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

/**
 * Format timestamp for consistency
 */
export function formatTimestamp(date: Date = new Date()): string {
  return date.toISOString();
}

/**
 * Generic retry helper for operations
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delay?: number;
    actionName?: string;
  } = {}
): Promise<T> {
  const {
    maxAttempts = TIMING.maxRetries,
    delay = TIMING.retryDelay,
    actionName = "operation",
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`Attempting ${actionName} (attempt ${attempt}/${maxAttempts})`);
      return await fn();
    } catch (error) {
      lastError = error as Error;
      console.error(`${actionName} failed (attempt ${attempt}/${maxAttempts}):`, error);

      if (attempt < maxAttempts) {
        console.log(`Retrying ${actionName} in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  throw new Error(
    `${actionName} failed after ${maxAttempts} attempts: ${lastError?.message || "Unknown error"}`
  );
}
