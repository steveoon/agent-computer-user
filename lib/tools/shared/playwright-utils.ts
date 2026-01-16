/**
 * Playwright MCP Utilities
 *
 * Shared utility functions for Playwright MCP tool interactions.
 * Provides Tab management and script execution utilities.
 */

import { getPlaywrightMCPClient } from "@/lib/mcp/client-manager";

// ========== Type Definitions ==========

/**
 * Tab information from browser_tabs tool
 */
export interface PlaywrightTabInfo {
  index: number;
  url: string;
  title: string;
  active?: boolean;
}

/**
 * Tab selection result
 */
export interface TabSelectionResult {
  success: boolean;
  tab?: PlaywrightTabInfo;
  error?: string;
  availableTabs?: PlaywrightTabInfo[];
}

/**
 * Platform URL patterns for tab matching
 */
const PLATFORM_PATTERNS: Record<string, RegExp> = {
  zhipin: /zhipin\.com/i,
  boss: /zhipin\.com/i, // Alias for zhipin
  yupao: /yupao/i,
};

// ========== Tab Management Functions ==========

/**
 * List all browser tabs
 *
 * @returns Array of tab information
 * @throws Error if browser_tabs tool is not available
 *
 * @example
 * const tabs = await listBrowserTabs();
 * console.log(`Found ${tabs.length} tabs`);
 */
export async function listBrowserTabs(): Promise<PlaywrightTabInfo[]> {
  const client = await getPlaywrightMCPClient();
  const tools = await client.tools();

  if (!tools.browser_tabs) {
    throw new Error(
      "browser_tabs tool not available. Ensure Playwright MCP is properly connected (via --extension or --cdp-endpoint)."
    );
  }

  // 添加超时处理，防止 MCP 无响应时卡死
  const TIMEOUT_MS = 15000;
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(
        new Error(
          `browser_tabs 操作超时 (${TIMEOUT_MS / 1000}秒)。请检查：\n` +
            "- Extension 模式：确保已安装并激活 Playwright MCP Bridge 扩展\n" +
            "- CDP 模式：确保 Chrome 已启动并开启远程调试端口"
        )
      );
    }, TIMEOUT_MS);
  });

  const result = await Promise.race([
    tools.browser_tabs.execute({ action: "list" }),
    timeoutPromise,
  ]);

  return parseTabsResult(result);
}

/**
 * Select a tab by URL pattern
 *
 * @param urlPattern - String or RegExp to match against tab URL
 * @returns Tab selection result
 *
 * @example
 * const result = await selectTabByUrl(/zhipin\.com/i);
 * if (result.success) {
 *   console.log(`Selected tab: ${result.tab.title}`);
 * }
 */
export async function selectTabByUrl(
  urlPattern: string | RegExp
): Promise<TabSelectionResult> {
  try {
    const client = await getPlaywrightMCPClient();
    const tools = await client.tools();

    if (!tools.browser_tabs) {
      return {
        success: false,
        error:
          "browser_tabs tool not available. Ensure Playwright MCP is properly connected (via --extension or --cdp-endpoint).",
      };
    }

    // 直接执行 list 操作，复用 tools 对象，避免调用 listBrowserTabs() 导致的重复 client.tools()
    const TIMEOUT_MS = 15000;
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () =>
          reject(new Error(`browser_tabs 操作超时 (${TIMEOUT_MS / 1000}秒)`)),
        TIMEOUT_MS
      );
    });

    const listResult = await Promise.race([
      tools.browser_tabs.execute({ action: "list" }),
      timeoutPromise,
    ]);
    const tabs = parseTabsResult(listResult);

    // Find matching tab
    const pattern =
      typeof urlPattern === "string" ? new RegExp(urlPattern, "i") : urlPattern;

    const matchingTab = tabs.find((tab) => pattern.test(tab.url));

    if (!matchingTab) {
      return {
        success: false,
        error: `No tab found matching pattern: ${urlPattern}`,
        availableTabs: tabs,
      };
    }

    // Select the tab
    await tools.browser_tabs.execute({
      action: "select",
      index: matchingTab.index,
    });

    console.log(
      `[PlaywrightUtils] Selected tab: ${matchingTab.title} (${matchingTab.url})`
    );

    return {
      success: true,
      tab: { ...matchingTab, active: true },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Select tab for a specific platform
 *
 * @param platform - Platform name: 'zhipin', 'boss', or 'yupao'
 * @returns Tab selection result
 *
 * @example
 * const result = await selectPlatformTab('zhipin');
 */
export async function selectPlatformTab(
  platform: "zhipin" | "boss" | "yupao"
): Promise<TabSelectionResult> {
  const pattern = PLATFORM_PATTERNS[platform];
  if (!pattern) {
    return {
      success: false,
      error: `Unknown platform: ${platform}. Supported: zhipin, boss, yupao`,
    };
  }

  return selectTabByUrl(pattern);
}

/**
 * Select BOSS Zhipin (直聘) tab
 */
export async function selectZhipinTab(): Promise<TabSelectionResult> {
  return selectPlatformTab("zhipin");
}

/**
 * Select Yupao (鱼泡) tab
 */
export async function selectYupaoTab(): Promise<TabSelectionResult> {
  return selectPlatformTab("yupao");
}

/**
 * Ensure we're on the correct platform tab before operations
 *
 * @param platform - Platform name
 * @returns Tab selection result (success if already on correct tab or switch successful)
 */
export async function ensurePlatformTab(
  platform: "zhipin" | "boss" | "yupao"
): Promise<TabSelectionResult> {
  try {
    const tabs = await listBrowserTabs();
    const activeTab = tabs.find((t) => t.active);
    const pattern = PLATFORM_PATTERNS[platform];

    // Already on correct tab
    if (activeTab && pattern.test(activeTab.url)) {
      return { success: true, tab: activeTab };
    }

    // Need to switch
    return selectPlatformTab(platform);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ========== Script Wrapping Functions ==========

/**
 * Wrap script for Playwright MCP execution
 *
 * Playwright MCP's browser_evaluate expects a function expression,
 * not an IIFE. It will invoke the function and return the result.
 *
 * @param innerScript - The script logic to wrap
 * @returns Function expression string for Playwright MCP
 */
export function wrapPlaywrightScript(innerScript: string): string {
  return `() => {
    try {
      ${innerScript}
    } catch (err) {
      return { success: false, error: err.message || 'Unknown error' };
    }
  }`;
}

/**
 * Generate synchronous batch processing script for Playwright
 *
 * Unlike Puppeteer's async version with requestIdleCallback,
 * this uses simple synchronous iteration for better serialization.
 *
 * @param processingLogic - The processing logic for each element
 * @returns Script string with processAllElements function
 */
export function generatePlaywrightBatchScript(processingLogic: string): string {
  return `
    const processAllElements = (elements) => {
      const results = [];
      for (let idx = 0; idx < elements.length; idx++) {
        const element = elements[idx];
        const i = idx;
        try {
          ${processingLogic}
        } catch (err) {
          // Silent error handling
        }
      }
      return results;
    };
  `;
}

// ========== Script Execution Functions ==========

/**
 * Execute JavaScript in browser context using Playwright MCP
 *
 * This is a drop-in replacement for puppeteer_evaluate.
 * Scripts are executed in the page context with access to DOM.
 *
 * @param script - JavaScript code to execute
 * @returns Parsed result from script execution
 *
 * @example
 * const title = await playwrightEvaluate('return document.title');
 */
export async function playwrightEvaluate(script: string): Promise<unknown> {
  const client = await getPlaywrightMCPClient();
  const tools = await client.tools();

  if (!tools.browser_evaluate) {
    throw new Error("browser_evaluate tool not available");
  }

  // Playwright MCP browser_evaluate 使用 "function" 参数名
  const wrappedScript = wrapPlaywrightScript(script);
  const result = await tools.browser_evaluate.execute({ function: wrappedScript });
  return parsePlaywrightResult(result);
}

/**
 * Parse result from Playwright MCP tools
 *
 * Playwright MCP returns results in Markdown format:
 * ```
 * ### Result
 * { ... JSON ... }
 *
 * ### Ran Playwright code
 * await page.evaluate(...)
 * ```
 *
 * @param result - Raw result from MCP tool execution
 * @returns Parsed result
 */
export function parsePlaywrightResult(result: unknown): unknown {
  const mcpResult = result as { content?: Array<{ text?: string; type?: string }> };

  if (mcpResult?.content?.[0]) {
    const content = mcpResult.content[0];

    if (content.text) {
      const text = content.text;

      // 策略1: 检查是否是 Playwright MCP 的 Markdown 格式
      // 格式: "### Result\n{...}\n\n### Ran Playwright code\n..."
      if (text.startsWith("### Result")) {
        // 提取 ### Result 后面到下一个 ### 之间的内容
        const resultMatch = text.match(/### Result\s*\n([\s\S]*?)(?=\n###|\n\n###|$)/);
        if (resultMatch) {
          const jsonText = resultMatch[1].trim();
          try {
            return JSON.parse(jsonText);
          } catch {
            // 继续尝试其他策略
          }
        }
      }

      // 策略2: 直接尝试 JSON 解析（纯 JSON 响应）
      const trimmedText = text.trim();
      if (trimmedText.startsWith("{") || trimmedText.startsWith("[")) {
        try {
          return JSON.parse(trimmedText);
        } catch {
          // 继续尝试其他策略
        }
      }

      // 策略3: 查找文本中的 JSON 对象
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch {
          // 解析失败，返回原始文本
        }
      }

      return text;
    }
  }

  return result;
}

/**
 * Parse tabs list result from browser_tabs tool
 */
function parseTabsResult(result: unknown): PlaywrightTabInfo[] {
  const mcpResult = result as {
    content?: Array<{ text?: string; type?: string }>;
    isError?: boolean;
  };

  // 处理错误响应
  if (mcpResult?.isError) {
    const errorText = mcpResult.content?.[0]?.text || "Unknown error";
    console.error("[PlaywrightUtils] browser_tabs 返回错误:", errorText);

    // 检查是否是 "No open tabs" 错误
    if (errorText.includes("No open tabs")) {
      throw new Error(
        "Playwright MCP Extension 模式报告没有打开的标签页。\n" +
          "Extension 模式的限制：它只能控制由 MCP 导航打开的页面，无法访问已有标签页。\n" +
          "解决方案：\n" +
          "1. 使用 CDP 模式（设置 CHROME_REMOTE_DEBUGGING_PORT 环境变量）\n" +
          "2. 或使用 browser_navigate 工具先导航到目标页面"
      );
    }

    // 检查是否是页面关闭错误
    if (errorText.includes("Target page, context or browser has been closed")) {
      throw new Error(
        "浏览器页面/上下文已关闭。请确保：\n" +
          "1. 浏览器没有关闭目标页面\n" +
          "2. Playwright MCP Bridge 扩展仍然激活\n" +
          "3. 尝试刷新页面或重新激活扩展"
      );
    }

    throw new Error(`Playwright MCP 错误: ${errorText}`);
  }

  if (mcpResult?.content?.[0]) {
    const content = mcpResult.content[0];

    if (content.text) {
      // 只有当内容看起来像 JSON 时才尝试解析
      const trimmedText = content.text.trim();
      if (trimmedText.startsWith("{") || trimmedText.startsWith("[")) {
        try {
          const parsed = JSON.parse(content.text);

          // Handle different result formats
          if (Array.isArray(parsed)) {
            return parsed;
          }
          if (parsed.tabs && Array.isArray(parsed.tabs)) {
            return parsed.tabs;
          }
          // 尝试从其他可能的结构中提取
          if (parsed.result && Array.isArray(parsed.result)) {
            return parsed.result;
          }
        } catch {
          // JSON parse failed, try markdown format
        }
      }
    }

    // 尝试解析 Markdown 格式的标签列表
    // Playwright MCP 返回格式: "- 0: (current) [Title] (https://url.com)"
    if (content.text) {
      const textLines = content.text.split("\n");
      const tabs: PlaywrightTabInfo[] = [];

      for (const line of textLines) {
        // 匹配 Playwright MCP 格式: - 0: (current) [Title] (URL) 或 - 0: [Title] (URL)
        const playwrightMatch = line.match(
          /^-\s*(\d+):\s*(?:\(current\)\s*)?\[([^\]]+)\]\s*\(([^)]+)\)/
        );
        if (playwrightMatch) {
          tabs.push({
            index: parseInt(playwrightMatch[1], 10),
            title: playwrightMatch[2].trim(),
            url: playwrightMatch[3].trim(),
            active: line.includes("(current)"),
          });
          continue;
        }

        // 备用匹配格式: [1] Title - https://url.com
        const altMatch = line.match(/\[?(\d+)\]?\s*(.+?)\s*[-–]\s*(https?:\/\/[^\s]+)/);
        if (altMatch) {
          tabs.push({
            index: parseInt(altMatch[1], 10),
            title: altMatch[2].trim(),
            url: altMatch[3].trim(),
          });
        }
      }

      if (tabs.length > 0) {
        return tabs;
      }
    }
  }

  // 检查是否是直接的数组结果（某些版本可能直接返回）
  if (Array.isArray(result)) {
    return result as PlaywrightTabInfo[];
  }

  console.warn("[PlaywrightUtils] Failed to parse tabs result - unknown format");
  return [];
}

// ========== Utility Functions ==========

/**
 * Check if Playwright MCP is available and connected
 */
export async function isPlaywrightAvailable(): Promise<boolean> {
  try {
    const client = await getPlaywrightMCPClient();
    const tools = await client.tools();
    return !!tools.browser_evaluate;
  } catch {
    return false;
  }
}

/**
 * Get Playwright MCP tools with type safety
 */
export async function getPlaywrightTools() {
  const client = await getPlaywrightMCPClient();
  const tools = await client.tools();

  return {
    // Tab management
    browser_tabs: tools.browser_tabs as
      | {
          execute(params: {
            action: "list" | "select" | "close" | "new";
            index?: number;
            url?: string;
          }): Promise<unknown>;
        }
      | undefined,

    // Script execution
    browser_evaluate: tools.browser_evaluate as
      | {
          execute(params: { script: string }): Promise<unknown>;
        }
      | undefined,

    // Navigation
    browser_navigate: tools.browser_navigate as
      | {
          execute(params: { url: string }): Promise<unknown>;
        }
      | undefined,

    // Screenshot
    browser_take_screenshot: tools.browser_take_screenshot as
      | {
          execute(params?: { filename?: string }): Promise<unknown>;
        }
      | undefined,

    // Page snapshot (accessibility tree)
    browser_snapshot: tools.browser_snapshot as
      | {
          execute(params?: Record<string, never>): Promise<unknown>;
        }
      | undefined,
  };
}

// ========== Click Utility Functions ==========

/**
 * Click result from playwrightClick
 */
export interface PlaywrightClickResult {
  success: boolean;
  clicked?: boolean;
  selector?: string;
  error?: string;
}

/**
 * Click an element using CSS selector via Playwright MCP
 *
 * Note: Playwright MCP's browser_click expects accessibility refs, not CSS selectors.
 * This function uses browser_evaluate to execute el.click() instead.
 *
 * @param selector - CSS selector for the element to click
 * @returns Click result
 *
 * @example
 * const result = await playwrightClick('.submit-button');
 * if (result.success) {
 *   console.log('Clicked successfully');
 * }
 */
export async function playwrightClick(selector: string): Promise<PlaywrightClickResult> {
  try {
    const client = await getPlaywrightMCPClient();
    const tools = await client.tools();

    if (!tools.browser_evaluate) {
      return {
        success: false,
        error: "browser_evaluate tool not available",
      };
    }

    const clickScript = wrapPlaywrightScript(`
      const el = document.querySelector('${selector}');
      if (el) {
        el.click();
        return { success: true, clicked: true, selector: '${selector}' };
      }
      return { success: false, error: '元素未找到', selector: '${selector}' };
    `);

    const result = await tools.browser_evaluate.execute({ function: clickScript });
    const parsed = parsePlaywrightResult(result) as PlaywrightClickResult;

    return parsed || { success: false, error: "Failed to parse click result" };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Click an element by index within a selector group
 *
 * @param selector - CSS selector for the element group
 * @param index - Index of the element to click (0-based)
 * @returns Click result
 *
 * @example
 * const result = await playwrightClickByIndex('.list-item', 2);
 */
export async function playwrightClickByIndex(
  selector: string,
  index: number
): Promise<PlaywrightClickResult> {
  try {
    const client = await getPlaywrightMCPClient();
    const tools = await client.tools();

    if (!tools.browser_evaluate) {
      return {
        success: false,
        error: "browser_evaluate tool not available",
      };
    }

    const clickScript = wrapPlaywrightScript(`
      const elements = document.querySelectorAll('${selector}');
      if (elements[${index}]) {
        elements[${index}].click();
        return { success: true, clicked: true, selector: '${selector}', index: ${index} };
      }
      return { success: false, error: '元素未找到或索引越界', selector: '${selector}', index: ${index}, total: elements.length };
    `);

    const result = await tools.browser_evaluate.execute({ function: clickScript });
    const parsed = parsePlaywrightResult(result) as PlaywrightClickResult;

    return parsed || { success: false, error: "Failed to parse click result" };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Click an element using Playwright MCP's native browser_click tool
 *
 * This uses the recommended Playwright approach with accessibility-based element selection.
 * Instead of CSS selectors, it uses element text/description to find and click elements.
 *
 * @param elementText - Text content or accessible name of the element to click (e.g., "发送", "Submit")
 * @returns Click result
 *
 * @example
 * // Click a button by its text content
 * const result = await playwrightClickByText("发送");
 * if (result.success) {
 *   console.log('Clicked successfully');
 * }
 */
export async function playwrightClickByText(
  elementText: string
): Promise<PlaywrightClickResult> {
  // Playwright MCP 的 browser_click 需要 ref 参数（来自 browser_snapshot）
  // 使用 DOM 搜索方式查找并点击包含指定文本的元素
  return playwrightClickByTextFallback(elementText);
}

/**
 * Fallback: Click element by text using browser_evaluate
 */
async function playwrightClickByTextFallback(
  elementText: string
): Promise<PlaywrightClickResult> {
  try {
    const client = await getPlaywrightMCPClient();
    const tools = await client.tools();

    if (!tools.browser_evaluate) {
      return {
        success: false,
        error: "browser_evaluate tool not available",
      };
    }

    // 使用 XPath 或遍历 DOM 查找包含指定文本的可点击元素
    const clickScript = wrapPlaywrightScript(`
      const text = ${JSON.stringify(elementText)};

      // 策略1: 查找按钮或可点击元素包含指定文本
      const clickableSelectors = ['button', '[role="button"]', 'a', '.submit', '[class*="btn"]', '[class*="send"]'];

      for (const selector of clickableSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          if (el.textContent?.trim() === text || el.textContent?.includes(text)) {
            el.scrollIntoView({ behavior: 'instant', block: 'center' });
            const rect = el.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            const eventOptions = {
              bubbles: true,
              cancelable: true,
              view: window,
              clientX: centerX,
              clientY: centerY,
              button: 0,
              buttons: 1
            };

            el.dispatchEvent(new MouseEvent('mousedown', eventOptions));
            el.dispatchEvent(new MouseEvent('mouseup', eventOptions));
            el.dispatchEvent(new MouseEvent('click', eventOptions));
            el.click();

            return {
              success: true,
              clicked: true,
              text: text,
              foundSelector: selector,
              tagName: el.tagName,
              className: el.className
            };
          }
        }
      }

      // 策略2: 使用 XPath 查找
      const xpath = "//*[contains(text(), '" + text + "')]";
      const xpathResult = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      const xpathEl = xpathResult.singleNodeValue;

      if (xpathEl && xpathEl instanceof HTMLElement) {
        xpathEl.scrollIntoView({ behavior: 'instant', block: 'center' });
        xpathEl.click();
        return {
          success: true,
          clicked: true,
          text: text,
          method: 'xpath',
          tagName: xpathEl.tagName
        };
      }

      return { success: false, error: '未找到包含指定文本的元素', text: text };
    `);

    const result = await tools.browser_evaluate.execute({ function: clickScript });
    const parsed = parsePlaywrightResult(result) as PlaywrightClickResult;

    return parsed || { success: false, error: "Failed to parse click result" };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
