import { tool } from "ai";
import { z } from "zod";
import { getPuppeteerMCPClient } from "@/lib/mcp/client-manager";
import { CHAT_SELECTORS } from "./constants";
import { randomDelay, wrapAntiDetectionScript } from "./anti-detection-utils";
import { parseEvaluateResult } from "../shared/puppeteer-utils";
import { SourcePlatform } from "@/db/types";
import { recordMessageSentEvent } from "@/lib/services/recruitment-event";

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
    - 会自动等待消息发送完成

    【必传参数】发送消息时请传入以下信息用于数据统计：

    1. 未读状态（来自 zhipin_open_candidate_chat_improved）：
       - unreadCountBeforeReply: candidateInfo.unreadCount（打开候选人时的未读消息数，非常重要！）

    2. 候选人信息（来自 zhipin_get_chat_details 的 summary）：
       - candidateName: summary.candidateName
       - candidateAge: summary.candidateAge（如"21岁"）
       - candidateEducation: summary.candidateEducation（如"本科"）
       - candidateExpectedSalary: summary.candidateExpectedSalary（如"3000-4000元"）
       - candidateExpectedLocation: summary.candidateExpectedLocation（如"大连"）
       - jobName: summary.communicationPosition（沟通职位/待招岗位，用于 candidate_key 生成）`,

    inputSchema: z.object({
      message: z.string().describe("要发送的消息内容"),
      clearBefore: z.boolean().optional().default(true).describe("发送前是否清空输入框"),
      waitAfterSend: z.number().optional().default(1000).describe("发送后等待时间（毫秒）"),
      // 埋点上下文 - 来自 zhipin_get_chat_details 返回的 summary 对象
      candidateName: z.string().optional().describe("候选人姓名，来自 summary.candidateName"),
      candidateAge: z.string().optional().describe("候选人年龄，来自 summary.candidateAge（如'21岁'）"),
      candidateEducation: z.string().optional().describe("候选人学历，来自 summary.candidateEducation（如'本科'）"),
      candidateExpectedSalary: z.string().optional().describe("候选人期望薪资，来自 summary.candidateExpectedSalary（如'3000-4000元'）"),
      candidateExpectedLocation: z.string().optional().describe("候选人期望地点，来自 summary.candidateExpectedLocation（如'大连'）"),
      jobId: z.number().optional().describe("岗位ID"),
      jobName: z.string().optional().describe("沟通职位/待招岗位名称，来自 summary.communicationPosition"),
      // 未读消息上下文 - 优先来自 open_candidate_chat，其次来自 get_unread_messages
      unreadCountBeforeReply: z.number().optional().describe(
        "回复前的未读消息数。" +
        "【优先来源】zhipin_open_candidate_chat_improved 返回的 candidateInfo.unreadCount - 这是打开候选人时捕获的最准确数据。" +
        "【次要来源】zhipin_get_unread_candidates_improved 返回的候选人 unreadCount。" +
        "重要：如果是连续发送多条消息（对方未发新消息），第二条及之后应传 0，因为未读消息已在第一次回复时被消费。"
      ),
    }),

    execute: async ({
      message,
      clearBefore = true,
      waitAfterSend = 1000,
      candidateName,
      candidateAge,
      candidateEducation,
      candidateExpectedSalary,
      candidateExpectedLocation,
      jobId,
      jobName,
      unreadCountBeforeReply,
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
          // 注意：zhipin 使用沟通职位（jobName）作为 candidate.position 用于 candidate_key 生成
          // 这与 yupao 不同，yupao 使用候选人期望职位
          if (candidateName) {
            recordMessageSentEvent({
              platform: SourcePlatform.ZHIPIN,
              candidate: {
                name: candidateName,
                position: jobName, // 使用沟通职位（communicationPosition）作为 candidate_key
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
