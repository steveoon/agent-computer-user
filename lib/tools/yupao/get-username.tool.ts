import { tool } from "ai";
import { z } from 'zod/v3';
import { getPlaywrightMCPClient } from "@/lib/mcp/client-manager";
import { YUPAO_USER_SELECTORS } from "./constants";
import {
  selectYupaoTab,
  parsePlaywrightResult,
  wrapPlaywrightScript,
  type TabSelectionResult,
} from "@/lib/tools/shared/playwright-utils";

/**
 * 获取Yupao当前登录账号的用户名
 */
export const yupaoGetUsername = tool({
  description: `获取Yupao当前登录账号的用户名
  - [Playwright] 支持自动切换到鱼泡标签页`,
  inputSchema: z.object({
    autoSwitchTab: z
      .boolean()
      .optional()
      .default(true)
      .describe("是否自动切换到鱼泡标签页（仅 Playwright 模式有效）"),
  }),
  execute: async ({ autoSwitchTab = true }) => {
    try {
      // 自动切换到鱼泡标签页
      if (autoSwitchTab) {
        console.log("[Playwright] 正在切换到鱼泡标签页...");
        const tabResult: TabSelectionResult = await selectYupaoTab();

        if (!tabResult.success) {
          return {
            type: "text" as const,
            text: `无法切换到鱼泡标签页: ${tabResult.error}\n请确保已在浏览器中打开鱼泡网页面`,
            mcpBackend: "playwright" as const,
          };
        }

        console.log(`[Playwright] 已切换到: ${tabResult.tab?.title} (${tabResult.tab?.url})`);
      }

      // 获取 Playwright MCP 客户端
      const client = await getPlaywrightMCPClient();

      const tools = await client.tools();

      // Playwright 工具名称
      const toolName = "browser_evaluate";

      if (!tools[toolName]) {
        throw new Error(
          `MCP tool ${toolName} not available. 请确保 Playwright MCP 正在运行且已连接浏览器。`
        );
      }

      // 脚本内容（两个后端共用）
      const scriptContent = `
        // 批量定义所有选择器
        const selectors = [
          '${YUPAO_USER_SELECTORS.userName}',
          '${YUPAO_USER_SELECTORS.userNameAlt}',
          '.flex.items-center .name',
          '._avatar-box_1o1k9_17 ._name_1o1k9_11',
          '[class*="name"][class*="1o1k9"]',
          '.avatar-box .name',
          '[class*="avatar-box"] [class*="name"]',
          '.user-name',
          '[class*="user-name"]',
          '.profile .name',
          '.header-user-name'
        ];

        // 批量查询选择器
        for (const selector of selectors) {
          try {
            const element = document.querySelector(selector);
            if (element && element.textContent && element.textContent.trim()) {
              const userName = element.textContent.trim();
              // 基本验证：用户名长度合理
              if (userName.length > 0 && userName.length < 30) {
                // 过滤掉可能的噪音（如"我的"、"个人中心"等）
                const invalidPatterns = ['我的', '个人中心', '设置', '退出', '登录'];
                const isValid = !invalidPatterns.some(pattern => userName === pattern);

                if (isValid) {
                  return {
                    success: true,
                    userName: userName,
                    elementFound: true,
                    usedSelector: selector
                  };
                }
              }
            }
          } catch (e) {
            // 忽略无效选择器
          }
        }

        // 尝试从头像容器附近查找
        try {
          const avatarBox = document.querySelector('${YUPAO_USER_SELECTORS.avatarBox}');
          if (avatarBox) {
            // 查找容器内的所有文本节点
            const walker = document.createTreeWalker(
              avatarBox,
              NodeFilter.SHOW_TEXT,
              null,
              false
            );

            let node;
            while (node = walker.nextNode()) {
              const text = node.textContent?.trim();
              if (text && text.length > 0 && text.length < 30) {
                // 验证是否是用户名格式
                if (text.match(/^[\\u4e00-\\u9fa5a-zA-Z0-9_]+$/)) {
                  return {
                    success: true,
                    userName: text,
                    elementFound: true,
                    usedSelector: 'avatarBox text node'
                  };
                }
              }
            }
          }
        } catch (e) {
          // 忽略错误
        }

        return {
          success: false,
          userName: null,
          elementFound: false,
          message: "未找到用户名元素",
        };
      `;

      // 使用 Playwright 脚本包装
      const script = wrapPlaywrightScript(scriptContent);

      // 执行脚本
      const mcpTool = tools[toolName];
      console.log("[Playwright] 正在执行脚本...");

      const scriptResult = await mcpTool.execute({ function: script });

      // 解析 Playwright 结果
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
        let successMessage = `✅ 成功获取Yupao用户名：${result.userName}`;

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
          text: `❌ 获取用户名失败：${result.message || "未知错误"}\n💡 提示：请确保已登录Yupao账号`,
          mcpBackend,
        };
      }
    } catch (error) {
      // 静默处理错误
      let errorMessage = "获取用户名时发生错误";
      if (error instanceof Error) {
        errorMessage += `：${error.message}`;
      }

      return {
        type: "text" as const,
        text: errorMessage,
        mcpBackend: "playwright" as const,
      };
    }
  },
});

// 导出别名，方便使用
export const yupao_get_username = yupaoGetUsername;

// 导出工具
export const GET_USERNAME_ACTION = "get_username";
