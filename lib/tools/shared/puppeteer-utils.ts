/**
 * Puppeteer MCP Utilities
 *
 * Shared utility functions for Puppeteer MCP tool interactions.
 */

/**
 * Parse the result from puppeteer_evaluate MCP tool
 *
 * The MCP result format:
 * ```
 * {
 *   content: [{
 *     text: "Execution result:\n{...JSON...}\n\nConsole output:\n..."
 *   }]
 * }
 * ```
 *
 * @param result - Raw result from puppeteer_evaluate.execute()
 * @returns Parsed JSON object or null if parsing fails
 *
 * @example
 * const result = await puppeteerEvaluate.execute({ script });
 * const data = parseEvaluateResult(result);
 * if (data?.success) {
 *   console.log(data.value);
 * }
 */
export function parseEvaluateResult(result: unknown): Record<string, unknown> | null {
  try {
    const mcpResult = result as { content?: Array<{ text?: string }> };
    if (mcpResult?.content?.[0]?.text) {
      const resultText = mcpResult.content[0].text;
      const executionMatch = resultText.match(
        /Execution result:\s*\n([\s\S]*?)(\n\nConsole output|$)/
      );

      if (executionMatch && executionMatch[1].trim() !== "undefined") {
        const jsonResult = executionMatch[1].trim();
        return JSON.parse(jsonResult) as Record<string, unknown>;
      }
    }
  } catch (e) {
    console.error("[PuppeteerUtils] Failed to parse evaluate result:", e);
  }
  return null;
}
