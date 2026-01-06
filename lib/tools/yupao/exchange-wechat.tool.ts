import { tool } from "ai";
import { z } from 'zod/v3';
import { getPuppeteerMCPClient, getPlaywrightMCPClient } from "@/lib/mcp/client-manager";
import { YUPAO_EXCHANGE_WECHAT_SELECTORS } from "./constants";
import {
  wrapAntiDetectionScript,
  randomDelay,
  clickWithMouseTrajectory,
} from "../zhipin/anti-detection-utils";
import { createDynamicClassSelector } from "./dynamic-selector-utils";
import { parseEvaluateResult } from "../shared/puppeteer-utils";
import { SourcePlatform } from "@/db/types";
import { recordWechatExchangedEvent } from "@/lib/services/recruitment-event";
import {
  selectYupaoTab,
  parsePlaywrightResult,
  wrapPlaywrightScript,
  type TabSelectionResult,
} from "@/lib/tools/shared/playwright-utils";

// Feature flag: 使用 Playwright MCP 而非 Puppeteer MCP
const USE_PLAYWRIGHT_MCP = process.env.USE_PLAYWRIGHT_MCP === "true";

/**
 * Yupao交换微信工具
 *
 * 功能：
 * - 点击"换微信"按钮
 * - 在弹出的确认对话框中点击"确定"
 * - 完成微信交换流程
 */
export const yupaoExchangeWechatTool = () =>
  tool({
    description: `Yupao交换微信功能

    功能：
    - 自动点击"换微信"按钮
    - 在确认对话框中点击"确定"按钮
    - 完成微信号交换流程
    ${USE_PLAYWRIGHT_MCP ? "- [Playwright] 支持自动切换到鱼泡标签页" : ""}

    注意：
    - 需要先打开候选人聊天窗口
    - 需要确保当前聊天对象支持交换微信
    - 操作有先后顺序，会自动等待弹窗出现

    重要：交换微信时请传入候选人信息用于数据统计，这些信息来自 yupao_get_chat_details 工具返回的 summary 对象：
    - candidateName: summary.candidateName
    - candidatePosition: summary.candidatePosition（候选人期望职位）
    - candidateAge: summary.candidateAge（如"21岁"）
    - candidateEducation: summary.candidateEducation（如"本科"）
    - candidateExpectedSalary: summary.candidateExpectedSalary（如"3000-4000元"）
    - candidateExpectedLocation: summary.candidateExpectedLocation（如"大连"）
    - jobName: summary.communicationPosition（沟通职位/待招岗位）`,

    inputSchema: z.object({
      waitBetweenClicksMin: z
        .number()
        .optional()
        .default(400)
        .describe("两次点击之间的最小等待时间（毫秒）"),
      waitBetweenClicksMax: z
        .number()
        .optional()
        .default(800)
        .describe("两次点击之间的最大等待时间（毫秒）"),
      waitAfterExchangeMin: z
        .number()
        .optional()
        .default(800)
        .describe("交换完成后的最小等待时间（毫秒）"),
      waitAfterExchangeMax: z
        .number()
        .optional()
        .default(1500)
        .describe("交换完成后的最大等待时间（毫秒）"),
      autoSwitchTab: z
        .boolean()
        .optional()
        .default(true)
        .describe("是否自动切换到鱼泡标签页（仅 Playwright 模式有效）"),
      // 埋点上下文 - 来自 yupao_get_chat_details 返回的 summary 对象
      candidateName: z.string().describe("【必填】候选人姓名，来自 summary.candidateName"),
      candidatePosition: z.string().describe("【必填】候选人期望职位，来自 summary.candidatePosition"),
      candidateAge: z.string().optional().describe("候选人年龄，来自 summary.candidateAge（如'21岁'）"),
      candidateEducation: z.string().optional().describe("候选人学历，来自 summary.candidateEducation（如'本科'）"),
      candidateExpectedSalary: z.string().optional().describe("候选人期望薪资，来自 summary.candidateExpectedSalary（如'3000-4000元'）"),
      candidateExpectedLocation: z.string().optional().describe("候选人期望地点，来自 summary.candidateExpectedLocation（如'大连'）"),
      jobId: z.number().optional().describe("岗位ID"),
      jobName: z.string().describe("【必填】沟通职位/待招岗位名称，来自 summary.communicationPosition"),
    }),

    execute: async ({
      waitBetweenClicksMin = 400,
      waitBetweenClicksMax = 800,
      waitAfterExchangeMin = 800,
      waitAfterExchangeMax = 1500,
      autoSwitchTab = true,
      candidateName,
      candidatePosition,
      candidateAge,
      candidateEducation,
      candidateExpectedSalary,
      candidateExpectedLocation,
      jobId,
      jobName,
    }) => {
      try {
        const mcpBackend = USE_PLAYWRIGHT_MCP ? "playwright" : "puppeteer";

        // Playwright 模式: 自动切换到鱼泡标签页
        if (USE_PLAYWRIGHT_MCP && autoSwitchTab) {
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

        // 获取适当的 MCP 客户端
        const client = USE_PLAYWRIGHT_MCP
          ? await getPlaywrightMCPClient()
          : await getPuppeteerMCPClient();

        const tools = await client.tools();

        // 根据 MCP 类型选择工具名称
        const evaluateToolName = USE_PLAYWRIGHT_MCP ? "browser_evaluate" : "puppeteer_evaluate";

        // 检查必需的工具是否可用
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
            // 所以这里使用 evaluate 方式点击
            await executeScript(`
              const el = document.querySelector('${selector}');
              if (el) { el.click(); return { success: true }; }
              return { success: false };
            `);
          } else {
            await clickWithMouseTrajectory(client, selector, {
              preClickDelay: 100,
              moveSteps: 20,
            });
          }
        };

        // 添加初始延迟 (仅 Puppeteer 模式)
        if (!USE_PLAYWRIGHT_MCP) {
          await randomDelay(100, 300);
        }

        // 优先策略：检查是否有待处理的"同意"按钮（对方发起的交换请求）
        const pendingResult = await executeScript(`
          // 查找所有交换请求气泡
          const boxes = document.querySelectorAll('.exchange-phone-box');
          for (const box of boxes) {
            // 检查是否是微信交换请求 (包含微信图标)
            const hasWechatIcon = box.querySelector('.yp-weixinlogo');
            if (!hasWechatIcon) continue;

            // 检查是否有"同意"按钮
            const agreeBtn = box.querySelector('.agree.ep-btn');
            if (agreeBtn) {
              // 检查按钮是否可见且未被禁用
              const style = window.getComputedStyle(agreeBtn);
              if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
                agreeBtn.click();
                return {
                  handled: true,
                  message: '已自动同意对方的交换微信请求',
                  text: agreeBtn.textContent?.trim()
                };
              }
            }
          }
          return { handled: false };
        `);
        const pendingData = pendingResult as { handled: boolean; message?: string } | null;

        if (pendingData?.handled) {
          // 等待交换完成
          if (!USE_PLAYWRIGHT_MCP) {
            await randomDelay(waitAfterExchangeMin, waitAfterExchangeMax);
          } else {
            const delay = waitAfterExchangeMin + Math.random() * (waitAfterExchangeMax - waitAfterExchangeMin);
            await new Promise(r => setTimeout(r, delay));
          }

          // 尝试提取微信号
          let wechatNumber: string | undefined;
          try {
            const wechatData = await executeScript(`
              const containerSelectors = ['.view-phone-box', 'div[class*="view-phone-box"]'];
              const wechatIconSelectors = ['.yp-weixinlogo', '.yp-pc.yp-weixinlogo', 'i[class*="yp-weixin"]'];
              const textSelectors = ['.text', 'p[class*="text"]', 'span[class*="text"]'];
              for (const containerSel of containerSelectors) {
                const boxes = document.querySelectorAll(containerSel);
                for (const box of Array.from(boxes).reverse()) {
                  let hasWechatIcon = false;
                  for (const iconSel of wechatIconSelectors) {
                    if (box.querySelector(iconSel)) { hasWechatIcon = true; break; }
                  }
                  if (!hasWechatIcon) continue;
                  for (const textSel of textSelectors) {
                    const textEl = box.querySelector(textSel);
                    if (textEl && textEl.textContent) {
                      const wechat = textEl.textContent.trim();
                      if (wechat && wechat.length >= 5 && wechat.length <= 30 &&
                          !wechat.includes('点击') && !wechat.includes('查看') &&
                          !wechat.includes('交换') && !wechat.includes('请求')) {
                        return { wechatId: wechat };
                      }
                    }
                  }
                }
              }
              return { wechatId: null };
            `) as { wechatId?: string | null } | null;
            if (wechatData?.wechatId && typeof wechatData.wechatId === "string") {
              wechatNumber = wechatData.wechatId;
            }
          } catch {
            // 静默处理错误
          }

          // 📊 埋点：记录微信交换事件（同意对方请求的情况）
          if (candidateName) {
            recordWechatExchangedEvent({
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
              wechatNumber,
            });
          } else {
            console.warn(
              "[yupao_exchange_wechat] ⚠️ candidateName 未传入（同意请求场景），跳过 wechat_exchanged 事件记录。"
            );
          }

          return {
            success: true,
            message: wechatNumber
              ? `成功同意交换微信: ${wechatNumber}`
              : pendingData.message || "成功同意交换微信请求",
            details: {
              method: "accepted_request",
              info: "检测到对方已发起请求，自动点击同意",
              wechatNumber: wechatNumber || undefined,
            },
            mcpBackend,
          };
        }

        // 第一步：查找交换微信按钮 - 使用动态选择器
        const exchangeBtnSelector = createDynamicClassSelector("_exchange-tel-btn");

        const exchangeData = await executeScript(`
          // 策略1: 尝试精确的选择器（如果constants中的选择器有效）
          const exchangeBtn = document.querySelector('${YUPAO_EXCHANGE_WECHAT_SELECTORS.exchangeButton}');
          if (exchangeBtn && exchangeBtn.textContent?.includes('${YUPAO_EXCHANGE_WECHAT_SELECTORS.exchangeButtonContains}')) {
            return {
              exists: true,
              selector: '${YUPAO_EXCHANGE_WECHAT_SELECTORS.exchangeButton}',
              text: exchangeBtn.textContent.trim()
            };
          }

          // 策略2: 使用动态CSS选择器查找所有交换按钮
          const buttons = document.querySelectorAll('${exchangeBtnSelector}');
          for (let i = 0; i < buttons.length; i++) {
            const btn = buttons[i];
            if (btn.textContent && btn.textContent.includes('${YUPAO_EXCHANGE_WECHAT_SELECTORS.exchangeButtonContains}')) {
              return {
                exists: true,
                selector: '${exchangeBtnSelector}',
                index: i,
                text: btn.textContent.trim()
              };
            }
          }

          // 策略3: 使用更宽泛的选择器
          const allButtons = document.querySelectorAll('div[class*="_exchange-tel-btn"]');
          for (let i = 0; i < allButtons.length; i++) {
            const btn = allButtons[i];
            if (btn.textContent && btn.textContent.includes('换微信')) {
              return {
                exists: true,
                selector: 'div[class*="_exchange-tel-btn"]',
                index: i,
                text: btn.textContent.trim()
              };
            }
          }

          return { exists: false };
        `) as { exists?: boolean; selector?: string; index?: number; text?: string } | null;

        if (!exchangeData?.exists) {
          return {
            success: false,
            error: '未找到"换微信"按钮',
            message: "请确保已打开候选人聊天窗口",
            mcpBackend,
          };
        }

        // 点击交换按钮
        let exchangeClicked = false;
        try {
          if (exchangeData.index !== undefined && typeof exchangeData.index === "number") {
            // 使用索引点击
            const marked = await executeScript(`
              const selector = '${exchangeData.selector || exchangeBtnSelector}';
              const buttons = document.querySelectorAll(selector);
              const targetBtn = buttons[${exchangeData.index}];
              if (targetBtn) {
                targetBtn.setAttribute('data-exchange-wechat-temp', 'true');
                return { success: true };
              }
              return { success: false };
            `) as { success?: boolean } | null;

            if (marked?.success) {
              await executeClick('[data-exchange-wechat-temp="true"]');
              exchangeClicked = true;

              // 清理临时属性
              await executeScript(`
                const btn = document.querySelector('[data-exchange-wechat-temp="true"]');
                if (btn) btn.removeAttribute('data-exchange-wechat-temp');
              `);
            }
          } else if (exchangeData.selector && typeof exchangeData.selector === "string") {
            // 直接使用选择器
            await executeClick(exchangeData.selector);
            exchangeClicked = true;
          }
        } catch (_error) {
          // 备用方案：尝试包含文本的选择器
          const fallback = await executeScript(`
            const buttons = document.querySelectorAll('div[class*="_exchange-tel-btn"]');
            for (const btn of buttons) {
              if (btn.textContent && btn.textContent.includes('换微信')) {
                btn.setAttribute('data-exchange-wechat-fallback', 'true');
                return { success: true };
              }
            }
            return { success: false };
          `) as { success?: boolean } | null;

          if (fallback?.success) {
            try {
              await executeClick('div[data-exchange-wechat-fallback="true"]');
              exchangeClicked = true;
            } catch (_err) {
              exchangeClicked = false;
            }
          }
        }

        if (!exchangeClicked) {
          return {
            success: false,
            error: "点击交换微信按钮失败",
            message: "请确保已打开候选人聊天窗口",
            mcpBackend,
          };
        }

        // 等待弹窗出现
        if (!USE_PLAYWRIGHT_MCP) {
          await randomDelay(waitBetweenClicksMin, waitBetweenClicksMax);
        } else {
          const delay = waitBetweenClicksMin + Math.random() * (waitBetweenClicksMax - waitBetweenClicksMin);
          await new Promise(r => setTimeout(r, delay));
        }

        // 检查弹窗是否出现 - 使用动态选择器
        const dialogSelector = createDynamicClassSelector("_exchangeTipPop");
        const wechatPopSelector = createDynamicClassSelector("_wechatPop");

        const dialogData = await executeScript(`
          // 策略1: 尝试精确的选择器
          let dialog = document.querySelector('${YUPAO_EXCHANGE_WECHAT_SELECTORS.exchangeTipPop}');

          // 策略2: 使用动态选择器
          if (!dialog) {
            dialog = document.querySelector('${dialogSelector}${wechatPopSelector}');
          }

          // 策略3: 更宽泛的选择器
          if (!dialog) {
            const dialogs = document.querySelectorAll('${dialogSelector}');
            for (const d of dialogs) {
              if (d.classList.toString().includes('_wechatPop')) {
                dialog = d;
                break;
              }
            }
          }

          const isVisible = dialog && (dialog.style.display === 'block' || getComputedStyle(dialog).display !== 'none');
          const confirmBtn = dialog ? dialog.querySelector('${YUPAO_EXCHANGE_WECHAT_SELECTORS.confirmButton}') : null;
          return {
            exists: !!dialog,
            visible: isVisible,
            hasConfirmButton: !!confirmBtn
          };
        `) as { exists?: boolean; visible?: boolean; hasConfirmButton?: boolean } | null;

        if (!dialogData?.visible || !dialogData?.hasConfirmButton) {
          // 如果弹窗还没出现，再等待一下
          if (!USE_PLAYWRIGHT_MCP) {
            await randomDelay(500, 800);
          } else {
            await new Promise(r => setTimeout(r, 650));
          }
        }

        // 第二步：查找并点击确认按钮 - 使用动态选择器
        const confirmData = await executeScript(`
          // 策略1: 查找所有可能的对话框，只选择可见的
          let dialog = null;

          // 先查找所有包含 _exchangeTipPop 的元素
          const allDialogs = document.querySelectorAll('[class*="_exchangeTipPop"]');
          for (const d of allDialogs) {
            // 检查是否可见（display: block 或不是 none）
            const style = window.getComputedStyle(d);
            if (style.display !== 'none' && style.visibility !== 'hidden') {
              dialog = d;
              console.log('找到可见的对话框:', d.className, 'display:', style.display);
              break;
            }
          }

          // 如果没找到，尝试使用动态选择器
          if (!dialog) {
            dialog = document.querySelector('${dialogSelector}');
            if (dialog) {
              const style = window.getComputedStyle(dialog);
              if (style.display === 'none' || style.visibility === 'hidden') {
                dialog = null; // 如果不可见，重置为null
              }
            }
          }

          // 最后尝试 _wechatPop
          if (!dialog) {
            const wechatPops = document.querySelectorAll('[class*="_wechatPop"]');
            for (const d of wechatPops) {
              const style = window.getComputedStyle(d);
              if (style.display !== 'none' && style.visibility !== 'hidden') {
                dialog = d;
                break;
              }
            }
          }

          if (dialog) {
            console.log('使用对话框:', dialog.className);
            // 策略1.1: 查找primary样式的确定按钮
            const primaryBtns = dialog.querySelectorAll('button[class*="_primary"]');
            for (let i = 0; i < primaryBtns.length; i++) {
              const btn = primaryBtns[i];
              if (btn.textContent && btn.textContent.includes('确定')) {
                // 验证按钮是否可见
                const btnStyle = window.getComputedStyle(btn);
                const isVisible = btnStyle.display !== 'none' &&
                                 btnStyle.visibility !== 'hidden' &&
                                 btn.offsetParent !== null;

                if (isVisible) {
                  // 为按钮添加唯一标识（不使用引号避免转义问题）
                  btn.setAttribute('data-yupao-confirm-btn', 'yes');
                  console.log('找到可见的确定按钮，类名:', btn.className);
                  return {
                    exists: true,
                    selector: '[data-yupao-confirm-btn=yes]',
                    text: btn.textContent.trim(),
                    isInDialog: true,
                    buttonClass: btn.className
                  };
                }
              }
            }

            // 策略1.2: 查找所有按钮，找包含"确定"的
            const buttons = dialog.querySelectorAll('button');
            for (let i = 0; i < buttons.length; i++) {
              const btn = buttons[i];
              if (btn.textContent && btn.textContent.includes('确定')) {
                // 检查是否是primary按钮（通过类名或样式）
                if (btn.classList.toString().includes('_primary') ||
                    btn.className.includes('primary')) {
                  btn.setAttribute('data-yupao-confirm-btn', 'yes');
                  return {
                    exists: true,
                    selector: '[data-yupao-confirm-btn=yes]',
                    text: btn.textContent.trim(),
                    isInDialog: true
                  };
                }
              }
            }

            // 策略1.3: 如果没有primary样式，选择最后一个"确定"按钮（通常是确认按钮）
            for (let i = buttons.length - 1; i >= 0; i--) {
              const btn = buttons[i];
              if (btn.textContent && btn.textContent.includes('确定')) {
                btn.setAttribute('data-yupao-confirm-btn', 'yes');
                return {
                  exists: true,
                  selector: '[data-yupao-confirm-btn=yes]',
                  text: btn.textContent.trim(),
                  isInDialog: true,
                  fallback: true
                };
              }
            }
          }

          return { exists: false };
        `) as { exists?: boolean; selector?: string; text?: string; isInDialog?: boolean; buttonClass?: string; fallback?: boolean } | null;

        if (!confirmData?.exists) {
          return {
            success: false,
            error: '未找到确认对话框中的"确定"按钮',
            exchangeButtonClicked: true,
            message: "已点击交换微信按钮，但未能找到确认按钮",
            mcpBackend,
          };
        }

        // 添加点击前延迟
        if (!USE_PLAYWRIGHT_MCP) {
          await randomDelay(200, 400);
        } else {
          await new Promise(r => setTimeout(r, 300));
        }

        // 点击确认按钮
        let confirmClicked = false;
        try {
          // 由于我们已经在查找时添加了唯一标识，直接使用选择器点击
          if (confirmData.selector && typeof confirmData.selector === "string") {
            await executeClick(confirmData.selector);
            confirmClicked = true;

            // 清理标识属性
            await executeScript(`
              const btn = document.querySelector('[data-yupao-confirm-btn=yes]');
              if (btn) btn.removeAttribute('data-yupao-confirm-btn');
            `);
          }
        } catch (_error) {
          // 最后的备用方案：直接点击
          const lastData = await executeScript(`
            const dialog = document.querySelector('[class*="_exchangeTipPop"]') ||
                           document.querySelector('[class*="_wechatPop"]') ||
                           document.querySelector('.ant-modal');
            if (dialog) {
              // 优先查找带primary样式的确定按钮
              const primaryBtn = dialog.querySelector('button[class*="_primary"]');
              if (primaryBtn && primaryBtn.textContent && primaryBtn.textContent.includes('确定')) {
                primaryBtn.click();
                return { success: true, method: 'primary' };
              }

              // 否则查找任何包含"确定"的按钮
              const btns = dialog.querySelectorAll('button');
              for (const btn of btns) {
                if (btn.textContent && btn.textContent.includes('确定')) {
                  btn.click();
                  return { success: true, method: 'text' };
                }
              }
            }
            return { success: false };
          `) as { success?: boolean; method?: string } | null;
          confirmClicked = !!lastData?.success;
        }

        if (!confirmClicked) {
          return {
            success: false,
            error: "点击确认按钮失败",
            exchangeButtonClicked: true,
            message: "已点击交换微信按钮，但未能点击确认按钮",
            mcpBackend,
          };
        }

        // 等待交换完成
        if (!USE_PLAYWRIGHT_MCP) {
          await randomDelay(waitAfterExchangeMin, waitAfterExchangeMax);
        } else {
          const delay = waitAfterExchangeMin + Math.random() * (waitAfterExchangeMax - waitAfterExchangeMin);
          await new Promise(r => setTimeout(r, delay));
        }

        // 尝试提取交换后的微信号
        let wechatNumber: string | undefined;
        try {
          // Yupao DOM 结构 (参考 get-chat-details.tool.ts):
          // - 容器: .view-phone-box
          // - 微信图标: .yp-weixinlogo 或 .yp-pc.yp-weixinlogo
          // - 微信号文本: .view-phone-box .text
          const wechatData = await executeScript(`
            // 选择器列表（按优先级）
            const containerSelectors = ['.view-phone-box', 'div[class*="view-phone-box"]'];
            const wechatIconSelectors = ['.yp-weixinlogo', '.yp-pc.yp-weixinlogo', 'i[class*="yp-weixin"]'];
            const phoneIconSelectors = ['.yp-shouji3', '.yp-pc.yp-shouji3', 'i[class*="yp-shouji"]'];
            const textSelectors = ['.text', 'p[class*="text"]', 'span[class*="text"]'];

            // 查找所有 view-phone-box 容器（从最新的开始）
            for (const containerSel of containerSelectors) {
              const boxes = document.querySelectorAll(containerSel);
              for (const box of Array.from(boxes).reverse()) {
                // 检查是否包含微信图标
                let hasWechatIcon = false;
                for (const iconSel of wechatIconSelectors) {
                  if (box.querySelector(iconSel)) {
                    hasWechatIcon = true;
                    break;
                  }
                }

                // 确保不是电话图标（排除电话交换的情况）
                let hasPhoneIcon = false;
                for (const iconSel of phoneIconSelectors) {
                  if (box.querySelector(iconSel)) {
                    hasPhoneIcon = true;
                    break;
                  }
                }
                if (!hasWechatIcon || hasPhoneIcon) continue;

                // 查找微信号文本
                for (const textSel of textSelectors) {
                  const textEl = box.querySelector(textSel);
                  if (textEl && textEl.textContent) {
                    const wechat = textEl.textContent.trim();
                    // 验证: 非空、长度合理 (5-30字符)、不是提示文本
                    if (wechat &&
                        wechat.length >= 5 &&
                        wechat.length <= 30 &&
                        !wechat.includes('点击') &&
                        !wechat.includes('查看') &&
                        !wechat.includes('交换') &&
                        !wechat.includes('请求')) {
                      return { wechatId: wechat };
                    }
                  }
                }
              }
            }
            return { wechatId: null };
          `) as { wechatId?: string | null } | null;
          if (wechatData?.wechatId && typeof wechatData.wechatId === "string") {
            wechatNumber = wechatData.wechatId;
          }
        } catch {
          // 静默处理错误，微信号提取失败不影响主流程
        }

        // 📊 埋点：记录微信交换事件（fire-and-forget）
        if (candidateName) {
          recordWechatExchangedEvent({
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
            wechatNumber,
          });
        } else {
          console.warn(
            "[yupao_exchange_wechat] ⚠️ candidateName 未传入，跳过 wechat_exchanged 事件记录。请确保调用时传入 candidateName 参数！"
          );
        }

        return {
          success: true,
          message: wechatNumber ? `成功交换微信: ${wechatNumber}` : "成功交换微信",
          details: {
            exchangeButtonSelector: (exchangeData.selector as string) || "unknown",
            confirmButtonSelector: (confirmData.selector as string) || "unknown",
            wechatNumber: wechatNumber || undefined,
          },
          mcpBackend,
        };
      } catch (error) {
        // 静默处理错误
        const mcpBackend = USE_PLAYWRIGHT_MCP ? "playwright" : "puppeteer";

        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error occurred",
          message: "交换微信时发生错误",
          mcpBackend,
        };
      }
    },
  });

/**
 * 快捷创建函数
 */
export const createYupaoExchangeWechatTool = yupaoExchangeWechatTool;

// 导出工具
export const EXCHANGE_WECHAT_ACTION = "exchange_wechat";
