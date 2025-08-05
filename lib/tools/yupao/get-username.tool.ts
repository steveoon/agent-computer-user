import { tool } from "ai";
import { z } from "zod";
import { getPuppeteerMCPClient } from "@/lib/mcp/client-manager";
import { YUPAO_USER_SELECTORS } from "./constants";
import { wrapAntiDetectionScript, randomDelay } from "../zhipin/anti-detection-utils";

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
        if (typeof parsed === 'object' && parsed !== null) {
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
 * 获取Yupao当前登录账号的用户名
 */
export const yupaoGetUsername = tool({
  description: "获取Yupao当前登录账号的用户名",
  parameters: z.object({}),
  execute: async () => {
    try {
      const client = await getPuppeteerMCPClient();
      const tools = await client.tools();
      
      if (!tools.puppeteer_evaluate) {
        throw new Error("MCP tool puppeteer_evaluate not available");
      }
      
      // 添加初始延迟
      await randomDelay(100, 300);
      
      // 执行获取用户名的脚本
      const script = wrapAntiDetectionScript(`
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
      `);
      
      // 执行脚本
      const scriptResult = await tools.puppeteer_evaluate.execute({ script });

      // 解析结果
      const result = parseEvaluateResult(scriptResult);
      
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
        };
      } else {
        return {
          type: "text" as const,
          text: `❌ 获取用户名失败：${result.message || "未知错误"}\n💡 提示：请确保已登录Yupao账号`,
        };
      }
    } catch (error) {
      // 静默处理错误
      
      let errorMessage = "❌ 获取用户名时发生错误";
      if (error instanceof Error) {
        errorMessage += `：${error.message}`;
      }
      
      return {
        type: "text" as const,
        text: errorMessage,
      };
    }
  },
});

// 导出别名，方便使用
export const yupao_get_username = yupaoGetUsername;

// 导出工具
export const GET_USERNAME_ACTION = "get_username";