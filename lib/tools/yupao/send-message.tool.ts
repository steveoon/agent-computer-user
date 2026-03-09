import { tool } from "ai";
import { z } from 'zod/v3';
import { getPlaywrightMCPClient } from "@/lib/mcp/client-manager";
import { YUPAO_INPUT_SELECTORS } from "./constants";
import { randomDelay } from "../zhipin/anti-detection-utils";
import { SourcePlatform } from "@/db/types";
import { recordMessageSentEvent } from "@/lib/services/recruitment-event";
import {
  selectYupaoTab,
  parsePlaywrightResult,
  wrapPlaywrightScript,
  type TabSelectionResult,
} from "@/lib/tools/shared/playwright-utils";

/**
 * Yupao发送消息工具
 *
 * 功能：
 * - 使用 Playwright MCP 在 fb-editor 中输入消息
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
    - [Playwright] 支持自动切换到鱼泡标签页

    注意：
    - 需要先打开候选人聊天窗口
    - 支持多行消息（使用\\n分隔）
    - fb-editor 是一个 contenteditable div

    【必传参数】发送消息时请传入以下信息用于数据统计：

    1. 未读状态（来自 yupao_open_candidate_chat）：
       - unreadCountBeforeReply: clickedCandidate.unreadCount（打开候选人时的未读消息数，非常重要！）

    2. 候选人信息（来自 yupao_get_chat_details 的 summary）：
       - candidateName: summary.candidateName
       - candidatePosition: summary.candidatePosition（候选人期望职位）
       - candidateAge: summary.candidateAge（如"21岁"）
       - candidateEducation: summary.candidateEducation（如"本科"）
       - candidateExpectedSalary: summary.candidateExpectedSalary（如"3000-4000元"）
       - candidateExpectedLocation: summary.candidateExpectedLocation（如"大连"）
       - jobName: summary.communicationPosition（沟通职位/待招岗位）`,

    inputSchema: z.object({
      message: z.string().describe("要发送的消息内容"),
      clearBefore: z.boolean().optional().default(true).describe("发送前是否清空输入框"),
      waitAfterSend: z.number().optional().default(1000).describe("发送后等待时间（毫秒）"),
      autoSwitchTab: z
        .boolean()
        .optional()
        .default(true)
        .describe("是否自动切换到鱼泡标签页（仅 Playwright 模式有效）"),
      // 埋点上下文 - 来自 yupao_get_chat_details 返回的 summary 对象
      candidateName: z.string().describe("【必填】候选人姓名，来自 summary.candidateName"),
      candidatePosition: z.string().describe("候选人期望职位，来自 summary.candidatePosition"),
      candidateAge: z
        .string()
        .optional()
        .describe("候选人年龄，来自 summary.candidateAge（如'21岁'）"),
      candidateEducation: z
        .string()
        .optional()
        .describe("候选人学历，来自 summary.candidateEducation（如'本科'）"),
      candidateExpectedSalary: z
        .string()
        .optional()
        .describe("候选人期望薪资，来自 summary.candidateExpectedSalary（如'3000-4000元'）"),
      candidateExpectedLocation: z
        .string()
        .optional()
        .describe("候选人期望地点，来自 summary.candidateExpectedLocation（如'大连'）"),
      jobId: z.number().optional().describe("岗位ID"),
      jobName: z
        .string()
        .describe("【必填】沟通职位/待招岗位名称，来自 summary.communicationPosition"),
      // 未读消息上下文 - 优先来自 open_candidate_chat，其次来自 get_unread_messages
      unreadCountBeforeReply: z
        .number()
        .describe(
          "回复前的未读消息数。" +
            "【优先来源】yupao_open_candidate_chat 返回的 clickedCandidate.unreadCount - 这是打开候选人时捕获的最准确数据。" +
            "【次要来源】yupao_get_unread_messages 返回的候选人 unreadCount。" +
            "重要：如果是连续发送多条消息（对方未发新消息），第二条及之后应传 0，因为未读消息已在第一次回复时被消费。"
        ),
    }),

    execute: async ({
      message,
      clearBefore = true,
      waitAfterSend = 1000,
      autoSwitchTab = true,
      candidateName,
      candidatePosition,
      candidateAge,
      candidateEducation,
      candidateExpectedSalary,
      candidateExpectedLocation,
      jobId,
      jobName,
      unreadCountBeforeReply,
    }) => {
      try {
        const mcpBackend = "playwright" as const;

        // 自动切换到鱼泡标签页
        if (autoSwitchTab) {
          console.log("[Playwright] 正在切换到鱼泡标签页...");
          const tabResult: TabSelectionResult = await selectYupaoTab();

          if (!tabResult.success) {
            return {
              success: false,
              error: `无法切换到鱼泡标签页: ${tabResult.error}`,
              message: "请确保已在浏览器中打开鱼泡网页面",
              mcpBackend,
            };
          }

          console.log(`[Playwright] 已切换到: ${tabResult.tab?.title} (${tabResult.tab?.url})`);
        }

        // 获取 Playwright MCP 客户端
        const client = await getPlaywrightMCPClient();

        const tools = await client.tools();

        // Playwright 工具名称
        const evaluateToolName = "browser_evaluate";

        if (!tools[evaluateToolName]) {
          throw new Error(
            `MCP tool ${evaluateToolName} not available. 请确保 Playwright MCP 正在运行且已连接浏览器。`
          );
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const evaluateTool = tools[evaluateToolName] as any;

        // 辅助函数：执行脚本
        const executeScript = async (scriptContent: string) => {
          const script = wrapPlaywrightScript(scriptContent);
          const params = { function: script };
          const result = await evaluateTool.execute(params);
          return parsePlaywrightResult(result);
        };

        // 辅助函数：执行点击
        const executeClick = async (selector: string) => {
          // Playwright MCP 的 browser_click 需要 accessibility ref，不支持 CSS 选择器
          // 所以这里使用 evaluate 方式点击
          await executeScript(`
            const el = document.querySelector('${selector}');
            if (el) { el.click(); return { success: true }; }
            return { success: false };
          `);
        };

        // 步骤1: 验证输入框是否存在
        const inputData = await executeScript(`
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
        `) as { exists: boolean; isContentEditable?: boolean; currentContent?: string; hasPlaceholder?: boolean } | null;

        if (!inputData?.exists) {
          return {
            success: false,
            error: "Input element not found",
            message: "未找到输入框",
            mcpBackend,
          };
        }

        // 步骤2: 点击输入框获取焦点
        try {
          await executeClick(YUPAO_INPUT_SELECTORS.fbEditor);
        } catch {
          // 静默处理错误
        }

        // 步骤3: 清空输入框
        if (clearBefore) {
          try {
            await executeScript(`
              const editor = document.querySelector('${YUPAO_INPUT_SELECTORS.fbEditor}');
              if (editor) {
                editor.innerHTML = '<p data-fish-node="element"><br /></p>';
                const inputEvent = new Event('input', { bubbles: true });
                editor.dispatchEvent(inputEvent);
                const charCount = document.querySelector('${YUPAO_INPUT_SELECTORS.charCount}');
                if (charCount) { charCount.textContent = '0'; }
                return { cleared: true };
              }
              return { cleared: false };
            `);
          } catch {
            // 静默处理错误
          }
        }

        // 步骤4: 输入消息内容
        const fillData = await executeScript(`
          const editor = document.querySelector('${YUPAO_INPUT_SELECTORS.fbEditor}');
          if (editor) {
            editor.focus();
            const lines = ${JSON.stringify(message)}.split('\\n');
            const htmlContent = lines.map(line => '<p data-fish-node="element">' + (line || '<br />') + '</p>').join('');
            editor.innerHTML = htmlContent;
            const inputEvent = new Event('input', { bubbles: true });
            editor.dispatchEvent(inputEvent);
            const charCount = document.querySelector('${YUPAO_INPUT_SELECTORS.charCount}');
            if (charCount) { charCount.textContent = ${JSON.stringify(message)}.length.toString(); }
            const container = document.querySelector('${YUPAO_INPUT_SELECTORS.editorContainer}');
            if (container) { container.classList.remove('is-placeholder-visible'); }
            return { filled: true, messageLength: ${JSON.stringify(message)}.length };
          }
          return { filled: false };
        `) as { filled: boolean; messageLength?: number } | null;

        if (!fillData?.filled) {
          return {
            success: false,
            error: "Failed to fill message in contenteditable div. Please check if the page is loaded correctly.",
            message: "填充消息失败，请检查页面是否正确加载",
            details: {
              selector: YUPAO_INPUT_SELECTORS.fbEditor,
              attemptedMessage: message,
              hint: "fb-editor is a contenteditable div, not a standard input field",
            },
            mcpBackend,
          };
        }

        // 步骤5: 查找并点击发送按钮
        const sendButtonData = await executeScript(`
          const sendButton = document.querySelector('${YUPAO_INPUT_SELECTORS.sendButton}');
          if (sendButton && sendButton.offsetParent !== null) {
            return {
              exists: true,
              selector: '${YUPAO_INPUT_SELECTORS.sendButton}',
              text: sendButton.textContent || ''
            };
          }
          const altButton = document.querySelector('.fb-chat-footer button');
          if (altButton && altButton.textContent?.includes('发送')) {
            return {
              exists: true,
              selector: '.fb-chat-footer button',
              text: altButton.textContent
            };
          }
          return { exists: false };
        `) as { exists: boolean; selector?: string; text?: string } | null;

        if (!sendButtonData?.exists) {
          return {
            success: false,
            error: "Send button not found",
            message: "未找到发送按钮",
            mcpBackend,
          };
        }

        try {
          const sendSelector = sendButtonData.selector as string;
          await executeClick(sendSelector);

          // 等待消息发送完成
          if (waitAfterSend > 0) {
            await randomDelay(waitAfterSend * 0.8, waitAfterSend * 1.2);
          }

          // 验证消息是否发送成功（检查输入框是否已清空）
          const verifyData = await executeScript(`
            const editor = document.querySelector('${YUPAO_INPUT_SELECTORS.fbEditor}');
            const charCount = document.querySelector('${YUPAO_INPUT_SELECTORS.charCount}');
            return {
              editorEmpty: editor ? (editor.textContent?.trim() === '' || editor.textContent === '\\n') : false,
              charCountZero: charCount ? charCount.textContent === '0' : false
            };
          `) as { editorEmpty: boolean; charCountZero: boolean } | null;

          // 📊 埋点：记录消息发送事件（fire-and-forget）
          if (candidateName) {
            recordMessageSentEvent({
              platform: SourcePlatform.YUPAO,
              candidate: {
                name: candidateName,
                position: candidatePosition,
                age: candidateAge,
                education: candidateEducation,
                expectedSalary: candidateExpectedSalary,
                expectedLocation: candidateExpectedLocation,
              },
              jobInfo: { jobId, jobName },
              unreadCount: unreadCountBeforeReply ?? 0,
              message,
            });
          }

          return {
            success: true,
            message: `成功发送消息: "${message}"`,
            details: {
              sentText: message,
              sendButtonSelector: sendSelector,
              verified: verifyData?.editorEmpty || false,
            },
            mcpBackend,
          };
        } catch (error) {
          return {
            success: false,
            error: `Failed to click send button: ${error instanceof Error ? error.message : "Unknown error"}`,
            message: "点击发送按钮失败",
            mcpBackend,
          };
        }
      } catch (error) {
        // 静默处理错误
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error occurred",
          message: "发送消息时发生错误",
          mcpBackend: "playwright" as const,
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
