import { tool } from "ai";
import { z } from "zod";
import { getPuppeteerMCPClient } from "@/lib/mcp/client-manager";
import { CHAT_SELECTORS } from "./constants";
import { randomDelay, wrapAntiDetectionScript } from "./anti-detection-utils";
import { recruitmentEventService, recruitmentContext } from "@/lib/services/recruitment-event";

/**
 * 解析 puppeteer_evaluate 的结果
 */
function parseEvaluateResult(result: unknown): Record<string, unknown> | null {
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
    console.error("Failed to parse evaluate result:", e);
  }
  return null;
}

/**
 * 发送消息工具
 *
 * 功能：
 * - 使用 Puppeteer MCP 的 click 和 fill 方法
 * - 在输入框中输入消息
 * - 点击发送按钮发送消息
 * - 支持多种发送按钮选择器
 * - 验证消息是否成功发送
 */
export const zhipinSendMessageTool = () =>
  tool({
    description: `发送消息到BOSS直聘聊天窗口
    
    功能：
    - 在聊天输入框中输入消息
    - 自动查找并点击发送按钮
    - 验证消息是否成功发送
    
    注意：
    - 需要先打开候选人聊天窗口
    - 支持多行消息（使用\\n分隔）
    - 会自动等待消息发送完成`,

    inputSchema: z.object({
      message: z.string().describe("要发送的消息内容"),
      clearBefore: z.boolean().optional().default(true).describe("发送前是否清空输入框"),
      waitAfterSend: z.number().optional().default(1000).describe("发送后等待时间（毫秒）"),
      // 埋点上下文（可选）
      candidateName: z.string().optional().describe("候选人姓名，用于埋点统计"),
      candidatePosition: z.string().optional().describe("候选人应聘职位，用于埋点统计"),
    }),

    execute: async ({
      message,
      clearBefore = true,
      waitAfterSend = 1000,
      candidateName,
      candidatePosition,
    }) => {
      try {
        const client = await getPuppeteerMCPClient();
        const tools = await client.tools();

        // 检查必需的工具是否可用
        const requiredTools = ["puppeteer_click", "puppeteer_fill", "puppeteer_evaluate"] as const;
        for (const toolName of requiredTools) {
          if (!tools[toolName]) {
            throw new Error(`MCP tool ${toolName} not available`);
          }
        }

        // 类型断言：在检查后这些工具一定存在
        const puppeteerEvaluate = tools.puppeteer_evaluate as NonNullable<
          typeof tools.puppeteer_evaluate
        >;
        const puppeteerClick = tools.puppeteer_click as NonNullable<typeof tools.puppeteer_click>;
        const puppeteerFill = tools.puppeteer_fill as NonNullable<typeof tools.puppeteer_fill>;

        // 输入框选择器列表 - 优化为最常用的几个
        const inputSelectors = [
          CHAT_SELECTORS.inputEditorId, // 优先使用ID选择器
          CHAT_SELECTORS.inputTextarea,
          CHAT_SELECTORS.inputBox,
        ];

        // 发送按钮选择器列表 - 减少选择器数量避免DOM扫频
        const sendButtonSelectors = [
          CHAT_SELECTORS.submitContent,
          CHAT_SELECTORS.sendButtonAlt,
          CHAT_SELECTORS.sendButton,
        ];

        // 步骤1: 批量查找输入框（减少DOM查询）
        const findInputScript = wrapAntiDetectionScript(`
          const selectors = ${JSON.stringify(inputSelectors)};
          for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
              return { 
                exists: true, 
                selector: selector,
                tagName: element.tagName, 
                id: element.id 
              };
            }
          }
          return { exists: false };
        `);

        const inputResult = await puppeteerEvaluate.execute({ script: findInputScript });
        const inputData = parseEvaluateResult(inputResult);

        if (!inputData?.exists) {
          return {
            success: false,
            error: "Input element not found",
            triedSelectors: inputSelectors,
            message: "未找到输入框",
          };
        }

        const usedInputSelector = inputData.selector as string;

        // 步骤2: 点击输入框获取焦点（添加随机延迟）
        await randomDelay(100, 300);
        try {
          await puppeteerClick.execute({ selector: usedInputSelector });
        } catch {
          // 静默处理错误
        }

        // 步骤3: 清空输入框（使用Ctrl+A + Backspace更自然）
        if (clearBefore) {
          try {
            // 先聚焦
            await puppeteerClick.execute({ selector: usedInputSelector });
            await randomDelay(50, 150);

            // Ctrl+A 全选
            if (tools.puppeteer_key) {
              await tools.puppeteer_key.execute({ key: "Control+a" });
              await randomDelay(50, 100);

              // Backspace 删除
              await tools.puppeteer_key.execute({ key: "Backspace" });
            } else {
              // 降级方案：直接清空
              await puppeteerFill.execute({ selector: usedInputSelector, value: "" });
            }
          } catch {
            // 静默处理错误
          }
        }

        // 步骤4: 填充消息（添加随机延迟）
        await randomDelay(100, 200);
        try {
          await puppeteerFill.execute({ selector: usedInputSelector, value: message });
        } catch (error) {
          return {
            success: false,
            error: `Failed to fill message: ${error instanceof Error ? error.message : "Unknown error"}`,
            message: "填充消息失败",
          };
        }

        // 随机等待300-800ms确保文本已填充
        await randomDelay(300, 800);

        // 步骤5: 批量查找发送按钮（减少DOM查询）
        const findSendButtonScript = wrapAntiDetectionScript(`
          const selectors = ${JSON.stringify(sendButtonSelectors)};
          for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element && element.offsetParent !== null) {
              return { 
                exists: true, 
                selector: selector 
              };
            }
          }
          // 如果前面的都没找到，尝试更宽泛的选择器
          const fallbackSelectors = [
            '.btn-send',
            'button[type="submit"]',
            '[class*="send"]'
          ];
          for (const selector of fallbackSelectors) {
            const element = document.querySelector(selector);
            if (element && element.offsetParent !== null) {
              return { 
                exists: true, 
                selector: selector 
              };
            }
          }
          return { exists: false };
        `);

        const sendButtonResult = await puppeteerEvaluate.execute({ script: findSendButtonScript });
        const sendButtonData = parseEvaluateResult(sendButtonResult);

        if (!sendButtonData?.exists) {
          return {
            success: false,
            error: "Send button not found",
            triedSelectors: sendButtonSelectors,
            inputSelector: usedInputSelector,
            message: "未找到发送按钮",
          };
        }

        // 点击发送按钮前添加随机延迟
        await randomDelay(200, 400);

        try {
          const sendSelector = sendButtonData.selector as string;
          await puppeteerClick.execute({ selector: sendSelector });

          // 等待消息发送完成
          if (waitAfterSend > 0) {
            await randomDelay(waitAfterSend * 0.8, waitAfterSend * 1.2);
          }

          // 埋点：记录消息发送事件（fire-and-forget）
          const ctx = recruitmentContext.getContext();
          if (ctx && candidateName) {
            const event = recruitmentEventService
              .event(ctx)
              .candidate({ name: candidateName, position: candidatePosition })
              .messageSent(message);
            recruitmentEventService.recordAsync(event);
          }

          return {
            success: true,
            message: `成功发送消息: "${message}"`,
            details: {
              sentText: message,
              inputSelector: usedInputSelector,
              sendButtonSelector: sendSelector,
            },
          };
        } catch (error) {
          return {
            success: false,
            error: `Failed to click send button: ${error instanceof Error ? error.message : "Unknown error"}`,
            message: "点击发送按钮失败",
          };
        }
      } catch (error) {
        // 静默处理错误，避免暴露

        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error occurred",
          message: "发送消息时发生错误",
        };
      }
    },
  });

/**
 * 快捷创建函数
 */
export const createZhipinSendMessageTool = zhipinSendMessageTool;
