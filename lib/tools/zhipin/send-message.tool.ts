import { tool } from "ai";
import { z } from 'zod/v3';
import { getPuppeteerMCPClient, getPlaywrightMCPClient } from "@/lib/mcp/client-manager";
import { CHAT_SELECTORS } from "./constants";
import { randomDelay, wrapAntiDetectionScript } from "./anti-detection-utils";
import { parseEvaluateResult } from "../shared/puppeteer-utils";
import { SourcePlatform } from "@/db/types";
import { recordMessageSentEvent } from "@/lib/services/recruitment-event";
import {
  selectZhipinTab,
  parsePlaywrightResult,
  wrapPlaywrightScript,
  playwrightClickByText,
  type TabSelectionResult,
} from "@/lib/tools/shared/playwright-utils";

// Feature flag: 使用 Playwright MCP 而非 Puppeteer MCP
const USE_PLAYWRIGHT_MCP = process.env.USE_PLAYWRIGHT_MCP === "true";

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
    ${USE_PLAYWRIGHT_MCP ? "- [Playwright] 支持自动切换到BOSS直聘标签页" : ""}

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
      autoSwitchTab: z
        .boolean()
        .optional()
        .default(true)
        .describe("是否自动切换到BOSS直聘标签页（仅 Playwright 模式有效）"),
      // 埋点上下文 - 来自 zhipin_get_chat_details 返回的 summary 对象
      candidateName: z.string().describe("【必填】候选人姓名，来自 summary.candidateName"),
      candidateAge: z.string().optional().describe("候选人年龄，来自 summary.candidateAge（如'21岁'）"),
      candidateEducation: z.string().optional().describe("候选人学历，来自 summary.candidateEducation（如'本科'）"),
      candidateExpectedSalary: z.string().optional().describe("候选人期望薪资，来自 summary.candidateExpectedSalary（如'3000-4000元'）"),
      candidateExpectedLocation: z.string().optional().describe("候选人期望地点，来自 summary.candidateExpectedLocation（如'大连'）"),
      jobId: z.number().optional().describe("岗位ID"),
      jobName: z.string().describe("【必填】沟通职位/待招岗位名称，来自 summary.communicationPosition"),
      // 未读消息上下文 - 优先来自 open_candidate_chat，其次来自 get_unread_messages
      unreadCountBeforeReply: z.number().describe(
        "【必填】回复前的未读消息数。" +
        "【优先来源】zhipin_open_candidate_chat_improved 返回的 candidateInfo.unreadCount - 这是打开候选人时捕获的最准确数据。" +
        "【次要来源】zhipin_get_unread_candidates_improved 返回的候选人 unreadCount。" +
        "重要：如果是连续发送多条消息（对方未发新消息），第二条及之后应传 0，因为未读消息已在第一次回复时被消费。"
      ),
    }),

    execute: async ({
      message,
      clearBefore = true,
      waitAfterSend = 1000,
      autoSwitchTab = true,
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
        const mcpBackend = USE_PLAYWRIGHT_MCP ? "playwright" : "puppeteer";

        // Playwright 模式: 自动切换到 BOSS 直聘标签页
        if (USE_PLAYWRIGHT_MCP && autoSwitchTab) {
          console.log("[Playwright] 正在切换到 BOSS 直聘标签页...");
          const tabResult: TabSelectionResult = await selectZhipinTab();

          if (!tabResult.success) {
            return {
              success: false,
              error: `无法切换到 BOSS 直聘标签页: ${tabResult.error}`,
              message: "请确保已在浏览器中打开 BOSS 直聘页面",
              mcpBackend,
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
        const evaluateToolName = USE_PLAYWRIGHT_MCP ? "browser_evaluate" : "puppeteer_evaluate";
        const clickToolName = USE_PLAYWRIGHT_MCP ? "browser_click" : "puppeteer_click";
        const fillToolName = USE_PLAYWRIGHT_MCP ? "browser_fill" : "puppeteer_fill";

        if (!tools[evaluateToolName]) {
          throw new Error(
            `MCP tool ${evaluateToolName} not available. ${
              USE_PLAYWRIGHT_MCP
                ? "请确保 Playwright MCP 正在运行且已连接浏览器。"
                : "请确保 Puppeteer MCP 正在运行。"
            }`
          );
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const evaluateTool = tools[evaluateToolName] as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const clickTool = tools[clickToolName] as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fillTool = tools[fillToolName] as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const keyTool = tools[USE_PLAYWRIGHT_MCP ? "browser_press_key" : "puppeteer_key"] as any;

        // 辅助函数：执行脚本
        const executeScript = async (scriptContent: string) => {
          const script = USE_PLAYWRIGHT_MCP
            ? wrapPlaywrightScript(scriptContent)
            : wrapAntiDetectionScript(scriptContent);
          const params = USE_PLAYWRIGHT_MCP ? { function: script } : { script };
          const result = await evaluateTool.execute(params);
          return USE_PLAYWRIGHT_MCP ? parsePlaywrightResult(result) : parseEvaluateResult(result);
        };

        // 辅助函数：执行点击
        const executeClick = async (selector: string) => {
          if (USE_PLAYWRIGHT_MCP) {
            // Playwright MCP 的 browser_click 需要 accessibility ref，不支持 CSS 选择器
            // 使用 evaluate 方式模拟完整的鼠标点击事件序列
            await executeScript(`
              const el = document.querySelector('${selector}');
              if (el) {
                // 确保元素可见
                el.scrollIntoView({ behavior: 'instant', block: 'center' });

                // 获取元素中心坐标
                const rect = el.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;

                // 创建鼠标事件的通用选项
                const eventOptions = {
                  bubbles: true,
                  cancelable: true,
                  view: window,
                  clientX: centerX,
                  clientY: centerY,
                  button: 0,
                  buttons: 1
                };

                // 模拟完整的鼠标事件序列：mousedown -> mouseup -> click
                el.dispatchEvent(new MouseEvent('mousedown', eventOptions));
                el.dispatchEvent(new MouseEvent('mouseup', eventOptions));
                el.dispatchEvent(new MouseEvent('click', eventOptions));

                // 如果是按钮，也尝试直接调用 click()
                if (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button') {
                  el.click();
                }

                return { success: true, tagName: el.tagName };
              }
              return { success: false };
            `);
          } else {
            await clickTool.execute({ selector });
          }
        };

        // 辅助函数：执行填充
        const executeFill = async (selector: string, value: string) => {
          if (USE_PLAYWRIGHT_MCP) {
            // Playwright MCP 需要使用 evaluate 方式填充
            // 需要处理多种输入元素类型：input/textarea 和 contenteditable
            await executeScript(`
              const el = document.querySelector('${selector}');
              if (el) {
                el.focus();

                // 检查是否是 contenteditable 元素
                const isContentEditable = el.isContentEditable ||
                  el.contentEditable === 'true' ||
                  el.getAttribute('contenteditable') === 'true';

                if (isContentEditable) {
                  // contenteditable 元素：使用 innerHTML 或 textContent
                  // 将换行符转换为 HTML 段落
                  const lines = ${JSON.stringify(value)}.split('\\n');
                  const htmlContent = lines.map(line => '<p>' + (line || '<br>') + '</p>').join('');
                  el.innerHTML = htmlContent;
                } else if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                  // 标准 input/textarea：使用 value
                  el.value = ${JSON.stringify(value)};
                } else {
                  // 其他元素：尝试使用 textContent
                  el.textContent = ${JSON.stringify(value)};
                }

                // 触发事件通知 React/Vue 等框架
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                return { success: true, isContentEditable: isContentEditable };
              }
              return { success: false };
            `);
          } else {
            await fillTool.execute({ selector, value });
          }
        };

        // 辅助函数：执行按键
        const executeKey = async (key: string) => {
          if (keyTool) {
            if (USE_PLAYWRIGHT_MCP) {
              await keyTool.execute({ key });
            } else {
              await keyTool.execute({ key });
            }
          }
        };

        // 输入框选择器列表 - 优化为最常用的几个
        const inputSelectors = [
          CHAT_SELECTORS.inputEditorId, // 优先使用ID选择器
          CHAT_SELECTORS.inputTextarea,
          CHAT_SELECTORS.inputBox,
        ];

        // 发送按钮选择器列表 - 优先使用内部的 .submit 元素
        const sendButtonSelectors = [
          CHAT_SELECTORS.submitButtonActive, // .submit-content .submit.active (首选)
          CHAT_SELECTORS.submitButton,       // .submit-content .submit
          CHAT_SELECTORS.submitContent,      // .submit-content (外层容器，备用)
          CHAT_SELECTORS.sendButtonAlt,
          CHAT_SELECTORS.sendButton,
        ];

        // 步骤1: 批量查找输入框（减少DOM查询）
        const inputData = (await executeScript(`
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
        `)) as { exists: boolean; selector?: string; tagName?: string; id?: string } | null;

        if (!inputData?.exists) {
          return {
            success: false,
            error: "Input element not found",
            triedSelectors: inputSelectors,
            message: "未找到输入框",
            mcpBackend,
          };
        }

        const usedInputSelector = inputData.selector as string;

        // 步骤2: 点击输入框获取焦点（添加随机延迟）
        if (!USE_PLAYWRIGHT_MCP) {
          await randomDelay(100, 300);
        }
        try {
          await executeClick(usedInputSelector);
        } catch {
          // 静默处理错误
        }

        // 步骤3: 清空输入框（使用Ctrl+A + Backspace更自然）
        if (clearBefore) {
          try {
            // 先聚焦
            await executeClick(usedInputSelector);
            if (!USE_PLAYWRIGHT_MCP) {
              await randomDelay(50, 150);
            }

            // Ctrl+A 全选
            if (keyTool) {
              await executeKey("Control+a");
              if (!USE_PLAYWRIGHT_MCP) {
                await randomDelay(50, 100);
              }

              // Backspace 删除
              await executeKey("Backspace");
            } else {
              // 降级方案：直接清空
              await executeFill(usedInputSelector, "");
            }
          } catch {
            // 静默处理错误
          }
        }

        // 步骤4: 填充消息（添加随机延迟）
        if (!USE_PLAYWRIGHT_MCP) {
          await randomDelay(100, 200);
        }
        try {
          await executeFill(usedInputSelector, message);
        } catch (error) {
          return {
            success: false,
            error: `Failed to fill message: ${error instanceof Error ? error.message : "Unknown error"}`,
            message: "填充消息失败",
            mcpBackend,
          };
        }

        // 随机等待300-800ms确保文本已填充
        if (!USE_PLAYWRIGHT_MCP) {
          await randomDelay(300, 800);
        }

        // 步骤5: 查找发送按钮
        const sendButtonData = (await executeScript(`
          const selectors = ${JSON.stringify(sendButtonSelectors)};
          for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element && element.offsetParent !== null) {
              return { exists: true, selector: selector };
            }
          }
          // 降级选择器
          const fallbackSelectors = ['.btn-send', 'button[type="submit"]', '[class*="send"]'];
          for (const selector of fallbackSelectors) {
            const element = document.querySelector(selector);
            if (element && element.offsetParent !== null) {
              return { exists: true, selector: selector };
            }
          }
          return { exists: false };
        `)) as { exists: boolean; selector?: string } | null;

        if (!sendButtonData?.exists) {
          return {
            success: false,
            error: "Send button not found",
            triedSelectors: sendButtonSelectors,
            inputSelector: usedInputSelector,
            message: "未找到发送按钮",
            mcpBackend,
          };
        }

        // 点击发送按钮前添加随机延迟 (仅 Puppeteer)
        if (!USE_PLAYWRIGHT_MCP) {
          await randomDelay(200, 400);
        }

        const sendSelector = sendButtonData.selector as string;

        try {
          if (USE_PLAYWRIGHT_MCP) {
            // Playwright 模式：使用文本定位点击
            const clickResult = await playwrightClickByText("发送");
            if (!clickResult.success) {
              throw new Error(clickResult.error || "Click failed");
            }
          } else {
            // Puppeteer 模式：使用 CSS 选择器点击
            await executeClick(sendSelector);
          }

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
        // 静默处理错误，避免暴露
        const mcpBackend = USE_PLAYWRIGHT_MCP ? "playwright" : "puppeteer";

        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error occurred",
          message: "发送消息时发生错误",
          mcpBackend,
        };
      }
    },
  });

/**
 * 快捷创建函数
 */
export const createZhipinSendMessageTool = zhipinSendMessageTool;
