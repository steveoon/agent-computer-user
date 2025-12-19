/**
 * Recruitment Context Manager
 *
 * Uses AsyncLocalStorage to provide request-level context isolation.
 * This allows tools to access agentId, brandId etc. without passing them through every function call.
 *
 * @example
 * ```typescript
 * // At Agent session start
 * recruitmentContext.run(
 *   { agentId: "zhipin-001", sourcePlatform: "zhipin" },
 *   async () => {
 *     // All tool calls within this scope can access the context
 *     await runAgentSession();
 *   }
 * );
 *
 * // Inside a tool
 * const ctx = recruitmentContext.getContext();
 * if (ctx) {
 *   console.log(ctx.agentId); // "zhipin-001"
 * }
 * ```
 */

import { AsyncLocalStorage } from "async_hooks";
import type { RecruitmentContext } from "./types";

class RecruitmentContextManager {
  private storage = new AsyncLocalStorage<RecruitmentContext>();

  /**
   * Run a function within a recruitment context
   * All async operations within fn will have access to this context
   *
   * @param context - The context to set for this execution scope
   * @param fn - The function to execute within this context
   * @returns The result of fn
   */
  run<T>(context: RecruitmentContext, fn: () => T): T {
    return this.storage.run(context, fn);
  }

  /**
   * Run an async function within a recruitment context
   * Convenience method for async functions
   *
   * @param context - The context to set for this execution scope
   * @param fn - The async function to execute within this context
   * @returns Promise resolving to the result of fn
   */
  async runAsync<T>(context: RecruitmentContext, fn: () => Promise<T>): Promise<T> {
    return this.storage.run(context, fn);
  }

  /**
   * Get the current context (may be undefined if not set)
   *
   * @returns The current context or undefined
   */
  getContext(): RecruitmentContext | undefined {
    return this.storage.getStore();
  }

  /**
   * Get the current context, throwing if not set
   * Use this when context is required for operation
   *
   * @throws Error if context is not initialized
   * @returns The current context
   */
  requireContext(): RecruitmentContext {
    const ctx = this.storage.getStore();
    if (!ctx) {
      throw new Error(
        "[RecruitmentContext] Context not initialized. " +
          "Make sure to call recruitmentContext.run() at the start of the agent session."
      );
    }
    return ctx;
  }

  /**
   * Check if context is currently set
   *
   * @returns true if context is available
   */
  hasContext(): boolean {
    return this.storage.getStore() !== undefined;
  }
}

/**
 * Singleton instance of RecruitmentContextManager
 * Import this to access or set the recruitment context
 */
export const recruitmentContext = new RecruitmentContextManager();
