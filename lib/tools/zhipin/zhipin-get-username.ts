import { tool } from "ai";
import { z } from 'zod/v3';
import { getPuppeteerMCPClient, getPlaywrightMCPClient } from "@/lib/mcp/client-manager";
import { wrapAntiDetectionScript, randomDelay } from "./anti-detection-utils";
import {
  selectZhipinTab,
  parsePlaywrightResult,
  wrapPlaywrightScript,
  type TabSelectionResult,
} from "@/lib/tools/shared/playwright-utils";

// Feature flag: 使用 Playwright MCP 而非 Puppeteer MCP
const USE_PLAYWRIGHT_MCP = process.env.USE_PLAYWRIGHT_MCP === "true";

/**
 * 解析 puppeteer_evaluate 的结果
 */
function parseEvaluateResult(result: unknown): Record<string, unknown> | null {
  try {
    const mcpResult = result as { content?: Array<{ text?: string }> };
    if (mcpResult?.content?.[0]?.text) {
      const resultText = mcpResult.content[0].text;

      // 首先尝试标准格式解析（包含 "Execution result:"）
      const executionMatch = resultText.match(
        /Execution result:\s*\n([\s\S]*?)(\n\nConsole output|$)/
      );

      if (executionMatch) {
        const executionResult = executionMatch[1].trim();
        // 跳过 "undefined" 结果
        if (executionResult !== "undefined" && executionResult !== "") {
          try {
            return JSON.parse(executionResult) as Record<string, unknown>;
          } catch {
            // 静默处理错误
          }
        }
      }

      // 如果标准格式解析失败，尝试查找 JSON 对象
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]) as Record<string, unknown>;
        } catch {
          // 静默处理错误
        }
      }

      // 最后尝试直接解析整个文本
      try {
        const parsed = JSON.parse(resultText);
        if (typeof parsed === "object" && parsed !== null) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        // 忽略错误
      }
    }
  } catch (_e) {
    // 静默处理错误
  }
  return null;
}

/**
 * 获取BOSS直聘当前登录账号的用户名
 */
export const zhipinGetUsername = tool({
  description: `获取BOSS直聘当前登录账号的用户名
  ${USE_PLAYWRIGHT_MCP ? "- [Playwright] 支持自动切换到BOSS直聘标签页" : ""}`,
  inputSchema: z.object({
    autoSwitchTab: z
      .boolean()
      .optional()
      .default(true)
      .describe("是否自动切换到BOSS直聘标签页（仅 Playwright 模式有效）"),
  }),
  execute: async ({ autoSwitchTab = true }) => {
    try {
      // Playwright 模式: 自动切换到BOSS直聘标签页
      if (USE_PLAYWRIGHT_MCP && autoSwitchTab) {
        console.log("[Playwright] 正在切换到BOSS直聘标签页...");
        const tabResult: TabSelectionResult = await selectZhipinTab();

        if (!tabResult.success) {
          return {
            type: "text" as const,
            text: `❌ 无法切换到BOSS直聘标签页: ${tabResult.error}\n💡 请确保已在浏览器中打开BOSS直聘页面`,
            mcpBackend: "playwright" as const,
          };
        }

        console.log(`[Playwright] 已切换到: ${tabResult.tab?.title} (${tabResult.tab?.url})`);
      }

      // 获取适当的 MCP 客户端
      const client = USE_PLAYWRIGHT_MCP
        ? await getPlaywrightMCPClient()
        : await getPuppeteerMCPClient();

      const tools = await client.tools();

      // 根据 MCP 类型选择工具名称
      const toolName = USE_PLAYWRIGHT_MCP ? "browser_evaluate" : "puppeteer_evaluate";

      if (!tools[toolName]) {
        throw new Error(
          `MCP tool ${toolName} not available. ${
            USE_PLAYWRIGHT_MCP
              ? "请确保 Playwright MCP 正在运行且已连接浏览器。"
              : "请确保 Puppeteer MCP 正在运行。"
          }`
        );
      }

      // 添加初始延迟 (仅 Puppeteer 模式)
      if (!USE_PLAYWRIGHT_MCP) {
        await randomDelay(100, 300);
      }

      // 脚本内容（两个后端共用）
      const scriptContent = `
        // 批量定义所有选择器
        const selectors = [
          '#header > div > div > div.nav-item.nav-logout > div.top-profile-logout.ui-dropmenu.ui-dropmenu-drop-arrow > div.ui-dropmenu-label > div > span.user-name',
          '.user-name',
          '[class*="user-name"]',
          '[class*="username"]',
          '.nav-logout .user-name',
          '#header .user-name',
          '.nav-user .user-name',
          '.top-profile .user-name',
          '[data-qa="user-name"]',
          '.header-user-name',
          '.nav-item.nav-logout .user-name',
          '.ui-dropmenu-label .user-name'
        ];
        
        // 批量查询选择器
        for (const selector of selectors) {
          try {
            const element = document.querySelector(selector);
            if (element && element.textContent && element.textContent.trim()) {
              const userName = element.textContent.trim();
              // 基本验证：用户名长度合理
              if (userName.length > 0 && userName.length < 30) {
                return {
                  success: true,
                  userName: userName,
                  elementFound: true,
                  usedSelector: selector
                };
              }
            }
          } catch (e) {
            // 忽略无效选择器
          }
        }

        // 不再扫描所有元素，避免DOM扫频检测

        return {
          success: false,
          userName: null,
          elementFound: false,
          message: "未找到用户名元素",
        };
      `;

      // 根据 MCP 类型生成不同的脚本包装
      const script = USE_PLAYWRIGHT_MCP
        ? wrapPlaywrightScript(scriptContent)
        : wrapAntiDetectionScript(scriptContent);

      // 执行脚本
      const mcpTool = tools[toolName];
      console.log(`[${USE_PLAYWRIGHT_MCP ? "Playwright" : "Puppeteer"}] 正在执行脚本...`);

      // Playwright MCP 使用 "function" 参数名，Puppeteer MCP 使用 "script" 参数名
      const executeParams = USE_PLAYWRIGHT_MCP ? { function: script } : { script };
      const scriptResult = await mcpTool.execute(executeParams);

      // 根据 MCP 类型解析结果
      let result: Record<string, unknown> | null = null;
      const mcpBackend = USE_PLAYWRIGHT_MCP ? "playwright" : "puppeteer";

      if (USE_PLAYWRIGHT_MCP) {
        // Playwright MCP 结果解析
        const parsedResult = parsePlaywrightResult(scriptResult);
        if (parsedResult && typeof parsedResult === "object") {
          result = parsedResult as Record<string, unknown>;
        }
      } else {
        // Puppeteer MCP 结果解析
        result = parseEvaluateResult(scriptResult);
      }

      if (!result) {
        throw new Error("未能解析执行结果");
      }

      if (result.success && result.userName) {
        let successMessage = `✅ 成功获取BOSS直聘用户名：${result.userName}`;

        if (result.usedSelector) {
          successMessage += `\n🔍 使用选择器：${result.usedSelector}`;
        }

        return {
          type: "text" as const,
          text: successMessage,
          mcpBackend,
        };
      } else {
        return {
          type: "text" as const,
          text: `❌ 获取用户名失败：${result.message || "未知错误"}\n💡 提示：请确保已登录BOSS直聘账号`,
          mcpBackend,
        };
      }
    } catch (error) {
      // 静默处理错误
      const mcpBackend = USE_PLAYWRIGHT_MCP ? "playwright" : "puppeteer";

      let errorMessage = "❌ 获取用户名时发生错误";
      if (error instanceof Error) {
        errorMessage += `：${error.message}`;
      }

      return {
        type: "text" as const,
        text: errorMessage,
        mcpBackend,
      };
    }
  },
});

// 导出别名，方便使用
export const zhipin_get_username = zhipinGetUsername;
