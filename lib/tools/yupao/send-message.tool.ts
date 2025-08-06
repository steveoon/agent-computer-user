import { tool } from "ai";
import { z } from "zod";
import { getPuppeteerMCPClient } from "@/lib/mcp/client-manager";
import { YUPAO_INPUT_SELECTORS } from "./constants";
import { randomDelay, wrapAntiDetectionScript } from "../zhipin/anti-detection-utils";

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
 * Yupao发送消息工具
 *
 * 功能：
 * - 使用 Puppeteer MCP 在 fb-editor 中输入消息
 * - 点击发送按钮发送消息
 * - 支持清空输入框
 * - 验证消息是否成功发送
 */
export const yupaoSendMessageTool = () =>
  tool({
    description: `发送消息到Yupao聊天窗口
    
    功能：
    - 在 fb-editor 输入框中输入消息
    - 自动查找并点击发送按钮
    - 支持清空原有内容
    - 验证消息是否成功发送
    
    注意：
    - 需要先打开候选人聊天窗口
    - 支持多行消息（使用\\n分隔）
    - fb-editor 是一个 contenteditable div`,

    parameters: z.object({
      message: z.string().describe("要发送的消息内容"),
      clearBefore: z.boolean().optional().default(true).describe("发送前是否清空输入框"),
      waitAfterSend: z.number().optional().default(1000).describe("发送后等待时间（毫秒）"),
    }),

    execute: async ({ message, clearBefore = true, waitAfterSend = 1000 }) => {
      try {
        const client = await getPuppeteerMCPClient();
        const tools = await client.tools();

        // 检查必需的工具是否可用
        const requiredTools = ["puppeteer_click", "puppeteer_evaluate"] as const;
        for (const toolName of requiredTools) {
          if (!tools[toolName]) {
            throw new Error(`MCP tool ${toolName} not available`);
          }
        }
        
        // 类型断言：在检查后这些工具一定存在
        const puppeteerEvaluate = tools.puppeteer_evaluate as NonNullable<typeof tools.puppeteer_evaluate>;
        const puppeteerClick = tools.puppeteer_click as NonNullable<typeof tools.puppeteer_click>;

        // 步骤1: 验证输入框是否存在
        const checkInputScript = wrapAntiDetectionScript(`
          const editor = document.querySelector('${YUPAO_INPUT_SELECTORS.fbEditor}');
          if (editor) {
            const isContentEditable = editor.contentEditable === 'true' || editor.getAttribute('contenteditable') === 'true';
            return { 
              exists: true, 
              isContentEditable: isContentEditable,
              currentContent: editor.textContent || '',
              hasPlaceholder: document.querySelector('${YUPAO_INPUT_SELECTORS.placeholder}') !== null
            };
          }
          return { exists: false };
        `);

        const inputResult = await puppeteerEvaluate.execute({ script: checkInputScript });
        const inputData = parseEvaluateResult(inputResult);
        
        if (!inputData?.exists) {
          return {
            success: false,
            error: "Input element not found",
            message: "未找到输入框",
          };
        }

        // 步骤2: 点击输入框获取焦点
        await randomDelay(100, 300);
        try {
          await puppeteerClick.execute({ selector: YUPAO_INPUT_SELECTORS.fbEditor });
        } catch {
          // 静默处理错误
        }

        // 步骤3: 清空输入框
        if (clearBefore) {
          try {
            // 使用脚本直接清空内容
            const clearScript = wrapAntiDetectionScript(`
              const editor = document.querySelector('${YUPAO_INPUT_SELECTORS.fbEditor}');
              if (editor) {
                // 清空内容
                editor.innerHTML = '<p data-fish-node="element"><br /></p>';
                
                // 触发 input 事件
                const inputEvent = new Event('input', { bubbles: true });
                editor.dispatchEvent(inputEvent);
                
                // 更新字数统计
                const charCount = document.querySelector('${YUPAO_INPUT_SELECTORS.charCount}');
                if (charCount) {
                  charCount.textContent = '0';
                }
                
                return { cleared: true };
              }
              return { cleared: false };
            `);
            
            await puppeteerEvaluate.execute({ script: clearScript });
            await randomDelay(50, 150);
          } catch {
            // 静默处理错误
          }
        }

        // 步骤4: 输入消息内容
        // 由于 fb-editor 是 contenteditable，使用特殊的方式输入
        await randomDelay(100, 200);
        
        const fillScript = wrapAntiDetectionScript(`
          const editor = document.querySelector('${YUPAO_INPUT_SELECTORS.fbEditor}');
          if (editor) {
            // 获取焦点
            editor.focus();
            
            // 处理消息内容，将换行符转换为<br>
            const lines = ${JSON.stringify(message)}.split('\\n');
            const htmlContent = lines.map(line => '<p data-fish-node="element">' + (line || '<br />') + '</p>').join('');
            
            // 设置内容
            editor.innerHTML = htmlContent;
            
            // 触发输入事件
            const inputEvent = new Event('input', { bubbles: true });
            editor.dispatchEvent(inputEvent);
            
            // 更新字数统计
            const charCount = document.querySelector('${YUPAO_INPUT_SELECTORS.charCount}');
            if (charCount) {
              charCount.textContent = ${JSON.stringify(message)}.length.toString();
            }
            
            // 移除占位符样式
            const container = document.querySelector('${YUPAO_INPUT_SELECTORS.editorContainer}');
            if (container) {
              container.classList.remove('is-placeholder-visible');
            }
            
            return { filled: true, messageLength: ${JSON.stringify(message)}.length };
          }
          return { filled: false };
        `);
        
        const fillResult = await puppeteerEvaluate.execute({ script: fillScript });
        const fillData = parseEvaluateResult(fillResult);
        
        if (!fillData?.filled) {
          // 对于contenteditable元素，puppeteer_fill不适用
          // 直接返回错误，需要检查页面状态
          return {
            success: false,
            error: "Failed to fill message in contenteditable div. Please check if the page is loaded correctly.",
            message: "填充消息失败，请检查页面是否正确加载",
            details: {
              selector: YUPAO_INPUT_SELECTORS.fbEditor,
              attemptedMessage: message,
              hint: "fb-editor is a contenteditable div, not a standard input field"
            }
          };
        }

        // 随机等待确保文本已填充
        await randomDelay(300, 800);

        // 步骤5: 查找并点击发送按钮
        const findSendButtonScript = wrapAntiDetectionScript(`
          const sendButton = document.querySelector('${YUPAO_INPUT_SELECTORS.sendButton}');
          if (sendButton && sendButton.offsetParent !== null) {
            return { 
              exists: true, 
              selector: '${YUPAO_INPUT_SELECTORS.sendButton}',
              text: sendButton.textContent || ''
            };
          }
          
          // 备用选择器
          const altButton = document.querySelector('.fb-chat-footer button');
          if (altButton && altButton.textContent?.includes('发送')) {
            return { 
              exists: true, 
              selector: '.fb-chat-footer button',
              text: altButton.textContent
            };
          }
          
          return { exists: false };
        `);

        const sendButtonResult = await puppeteerEvaluate.execute({ script: findSendButtonScript });
        const sendButtonData = parseEvaluateResult(sendButtonResult);
        
        if (!sendButtonData?.exists) {
          return {
            success: false,
            error: "Send button not found",
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
          
          // 验证消息是否发送成功（检查输入框是否已清空）
          const verifyScript = wrapAntiDetectionScript(`
            const editor = document.querySelector('${YUPAO_INPUT_SELECTORS.fbEditor}');
            const charCount = document.querySelector('${YUPAO_INPUT_SELECTORS.charCount}');
            return {
              editorEmpty: editor ? (editor.textContent?.trim() === '' || editor.textContent === '\\n') : false,
              charCountZero: charCount ? charCount.textContent === '0' : false
            };
          `);
          
          const verifyResult = await puppeteerEvaluate.execute({ script: verifyScript });
          const verifyData = parseEvaluateResult(verifyResult);
          
          return {
            success: true,
            message: `成功发送消息: "${message}"`,
            details: {
              sentText: message,
              sendButtonSelector: sendSelector,
              verified: verifyData?.editorEmpty || false,
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
export const createYupaoSendMessageTool = yupaoSendMessageTool;

// 导出工具
export const SEND_MESSAGE_ACTION = "send_message";