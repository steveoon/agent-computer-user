import { tool } from "ai";
import { z } from 'zod/v3';
import { getPlaywrightMCPClient } from "@/lib/mcp/client-manager";
import {
  selectZhipinTab,
  parsePlaywrightResult,
  wrapPlaywrightScript,
  type TabSelectionResult,
} from "@/lib/tools/shared/playwright-utils";

/**
 * 获取BOSS直聘当前登录账号的用户名
 */
export const zhipinGetUsername = tool({
  description: `获取BOSS直聘当前登录账号的用户名
  - [Playwright] 支持自动切换到BOSS直聘标签页`,
  inputSchema: z.object({
    autoSwitchTab: z
      .boolean()
      .optional()
      .default(true)
      .describe("是否自动切换到BOSS直聘标签页（仅 Playwright 模式有效）"),
  }),
  execute: async ({ autoSwitchTab = true }) => {
    try {
      // 自动切换到BOSS直聘标签页
      if (autoSwitchTab) {
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

      // 获取 Playwright MCP 客户端
      const client = await getPlaywrightMCPClient();

      const tools = await client.tools();

      const toolName = "browser_evaluate";

      if (!tools[toolName]) {
        throw new Error(
          `MCP tool ${toolName} not available. 请确保 Playwright MCP 正在运行且已连接浏览器。`
        );
      }

      // 脚本内容
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

      // 生成脚本包装
      const script = wrapPlaywrightScript(scriptContent);

      // 执行脚本
      const mcpTool = tools[toolName];
      console.log("[Playwright] 正在执行脚本...");
      const scriptResult = await mcpTool.execute({ function: script });

      // 解析结果
      let result: Record<string, unknown> | null = null;
      const mcpBackend = "playwright" as const;

      const parsedResult = parsePlaywrightResult(scriptResult);
      if (parsedResult && typeof parsedResult === "object") {
        result = parsedResult as Record<string, unknown>;
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
      const mcpBackend = "playwright" as const;

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
