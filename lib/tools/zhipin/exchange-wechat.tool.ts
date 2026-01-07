import { tool } from "ai";
import { z } from 'zod/v3';
import { getPuppeteerMCPClient, getPlaywrightMCPClient } from "@/lib/mcp/client-manager";
import { EXCHANGE_WECHAT_SELECTORS } from "./constants";
import {
  wrapAntiDetectionScript,
  randomDelay,
  clickWithMouseTrajectory,
} from "./anti-detection-utils";
import { parseEvaluateResult } from "../shared/puppeteer-utils";
import {
  selectZhipinTab,
  parsePlaywrightResult,
  wrapPlaywrightScript,
  type TabSelectionResult,
} from "@/lib/tools/shared/playwright-utils";
import { SourcePlatform, WechatExchangeType } from "@/db/types";
import {
  recruitmentEventService,
  recruitmentContext,
  extractBrandIdFromJobName,
} from "@/lib/services/recruitment-event";

// Feature flag: 使用 Playwright MCP 而非 Puppeteer MCP
const USE_PLAYWRIGHT_MCP = process.env.USE_PLAYWRIGHT_MCP === "true";

/**
 * 交换微信工具
 *
 * 功能：
 * - 点击"换微信"按钮
 * - 在弹出的确认对话框中点击"确定"
 * - 完成微信交换流程
 */
export const zhipinExchangeWechatTool = () =>
  tool({
    description: `BOSS直聘交换微信功能

    功能：
    - 自动点击"换微信"按钮
    - 在确认对话框中点击"确定"按钮
    - 完成微信号交换流程
    ${USE_PLAYWRIGHT_MCP ? "- [Playwright] 支持自动切换到BOSS直聘标签页" : ""}

    注意：
    - 需要先打开候选人聊天窗口
    - 需要确保当前聊天对象支持交换微信
    - 操作有先后顺序，会自动等待弹窗出现

    重要：交换微信时请传入候选人信息用于数据统计，这些信息来自 zhipin_get_chat_details 工具返回的 summary 对象：
    - candidateName: summary.candidateName
    - candidateAge: summary.candidateAge（如"21岁"）
    - candidateEducation: summary.candidateEducation（如"本科"）
    - candidateExpectedSalary: summary.candidateExpectedSalary（如"3000-4000元"）
    - candidateExpectedLocation: summary.candidateExpectedLocation（如"大连"）
    - jobName: summary.communicationPosition（沟通职位/待招岗位，用于 candidate_key 生成）`,

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
        .describe("是否自动切换到BOSS直聘标签页（仅 Playwright 模式有效）"),
      // 埋点上下文 - 来自 zhipin_get_chat_details 返回的 summary 对象
      candidateName: z.string().describe("【必填】候选人姓名，来自 summary.candidateName"),
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
      candidateAge,
      candidateEducation,
      candidateExpectedSalary,
      candidateExpectedLocation,
      jobId,
      jobName,
    }) => {
      try {
        const mcpBackend = USE_PLAYWRIGHT_MCP ? "playwright" : "puppeteer";

        // Playwright 模式: 自动切换到BOSS直聘标签页
        if (USE_PLAYWRIGHT_MCP && autoSwitchTab) {
          console.log("[Playwright] 正在切换到BOSS直聘标签页...");
          const tabResult: TabSelectionResult = await selectZhipinTab();

          if (!tabResult.success) {
            return {
              success: false,
              error: `无法切换到BOSS直聘标签页: ${tabResult.error}`,
              message: "请确保已在浏览器中打开BOSS直聘页面",
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

        // 第一步：批量查找交换微信按钮
        const exchangeButtonSelectors = [
          EXCHANGE_WECHAT_SELECTORS.exchangeButtonPath,
          EXCHANGE_WECHAT_SELECTORS.exchangeButton,
          ".operate-exchange-left .operate-btn",
        ];

        // 批量查找按钮
        const exchangeData = await executeScript(`
          const selectors = ${JSON.stringify(exchangeButtonSelectors)};

          // 先尝试直接选择器
          for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element && element.offsetParent !== null) {
              return {
                exists: true,
                selector: selector,
                text: element.textContent?.trim() || ''
              };
            }
          }

          // 如果没找到，尝试文本匹配
          const spans = document.querySelectorAll('span.operate-btn');
          for (let i = 0; i < spans.length; i++) {
            const span = spans[i];
            if (span.textContent && span.textContent.includes('换微信')) {
              return {
                exists: true,
                selector: 'span.operate-btn',
                index: i,
                text: span.textContent.trim()
              };
            }
          }

          return { exists: false };
        `) as { exists?: boolean; selector?: string; index?: number; text?: string } | null;

        if (!exchangeData?.exists) {
          return {
            success: false,
            error: '未找到"换微信"按钮',
            triedSelectors: exchangeButtonSelectors,
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
              const buttons = document.querySelectorAll('span.operate-btn');
              const targetBtn = buttons[${exchangeData.index}];
              if (targetBtn) {
                targetBtn.setAttribute('data-exchange-btn-temp', 'true');
                return { success: true };
              }
              return { success: false };
            `) as { success?: boolean } | null;

            if (marked?.success) {
              await executeClick('span.operate-btn[data-exchange-btn-temp="true"]');
              exchangeClicked = true;

              // 清理临时属性
              await executeScript(`
                const btn = document.querySelector('span.operate-btn[data-exchange-btn-temp="true"]');
                if (btn) btn.removeAttribute('data-exchange-btn-temp');
              `);
            }
          } else if (exchangeData.selector && typeof exchangeData.selector === "string") {
            // 直接使用选择器
            await executeClick(exchangeData.selector);
            exchangeClicked = true;
          }
        } catch (_error) {
          // 如果点击失败，尝试备用方案
          const fallbackData = await executeScript(`
            const spans = document.querySelectorAll('span.operate-btn');
            for (let i = 0; i < spans.length; i++) {
              const span = spans[i];
              if (span.textContent && span.textContent.includes('换微信')) {
                return { success: true, selector: 'span.operate-btn', index: i };
              }
            }
            return { success: false };
          `) as { success?: boolean; index?: number } | null;

          if (fallbackData?.success && typeof fallbackData.index === "number") {
            const markResult = await executeScript(`
              const btns = Array.from(document.querySelectorAll('span.operate-btn'));
              const targetBtn = btns.find(btn => btn.textContent && btn.textContent.includes('换微信'));
              if (targetBtn) {
                targetBtn.setAttribute('data-exchange-btn-temp', 'true');
                return { success: true };
              }
              return { success: false };
            `) as { success?: boolean } | null;

            if (markResult?.success) {
              try {
                await executeClick('span.operate-btn[data-exchange-btn-temp="true"]');
                exchangeClicked = true;

                // 清理临时属性
                await executeScript(`
                  const btn = document.querySelector('span.operate-btn[data-exchange-btn-temp="true"]');
                  if (btn) btn.removeAttribute('data-exchange-btn-temp');
                `);
              } catch (_err) {
                exchangeClicked = false;
              }
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

        // 检查弹窗是否出现
        const tooltipData = await executeScript(`
          const tooltip = document.querySelector('.exchange-tooltip');
          const isVisible = tooltip && tooltip.offsetParent !== null;
          const confirmBtn = tooltip ? tooltip.querySelector('.boss-btn-primary') : null;
          return {
            exists: !!tooltip,
            visible: isVisible,
            hasConfirmButton: !!confirmBtn
          };
        `) as { exists?: boolean; visible?: boolean; hasConfirmButton?: boolean } | null;

        if (!tooltipData?.visible || !tooltipData?.hasConfirmButton) {
          // 如果弹窗还没出现或按钮还没渲染，再等待一下
          if (!USE_PLAYWRIGHT_MCP) {
            await randomDelay(500, 800);
          } else {
            await new Promise(r => setTimeout(r, 650));
          }
        }

        // 第二步：批量查找确认按钮
        const confirmButtonSelectors = [
          EXCHANGE_WECHAT_SELECTORS.confirmButtonPath, // 使用constants中定义的完整路径
          EXCHANGE_WECHAT_SELECTORS.confirmButton,
          ".exchange-tooltip .btn-box span.boss-btn-primary",
          ".exchange-tooltip span.boss-btn-primary",
          "span.boss-btn-primary.boss-btn",
        ];

        // 批量查找确认按钮
        const confirmData = await executeScript(`
          const selectors = ${JSON.stringify(confirmButtonSelectors)};

          // 先尝试直接选择器
          for (const selector of selectors) {
            try {
              const element = document.querySelector(selector);
              if (element && element.offsetParent !== null) {
                // 确保元素可见且可点击
                const rect = element.getBoundingClientRect();
                const isVisible = rect.width > 0 && rect.height > 0 &&
                                rect.top >= 0 && rect.left >= 0 &&
                                rect.bottom <= window.innerHeight &&
                                rect.right <= window.innerWidth;

                if (isVisible) {
                  return {
                    exists: true,
                    selector: selector,
                    text: element.textContent?.trim() || '',
                    isVisible: true
                  };
                }
              }
            } catch (_e) {
              // 忽略无效选择器的错误
            }
          }

          // 如果没找到，尝试文本匹配
          const buttons = document.querySelectorAll('span.boss-btn-primary');
          for (let i = 0; i < buttons.length; i++) {
            const btn = buttons[i];
            if (btn.textContent && btn.textContent.includes('确定') && btn.offsetParent !== null) {
              // 检查是否在弹窗内
              const inTooltip = btn.closest('.exchange-tooltip');
              if (inTooltip) {
                return {
                  exists: true,
                  selector: 'span.boss-btn-primary',
                  index: i,
                  text: btn.textContent.trim()
                };
              }
            }
          }

          return { exists: false };
        `) as { exists?: boolean; selector?: string; index?: number; text?: string } | null;

        if (!confirmData?.exists) {
          return {
            success: false,
            error: '未找到确认对话框中的"确定"按钮',
            triedSelectors: confirmButtonSelectors,
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
          if (confirmData.index !== undefined && typeof confirmData.index === "number") {
            // 使用索引点击
            const markResult = await executeScript(`
              const btns = Array.from(document.querySelectorAll('.exchange-tooltip span.boss-btn-primary'));
              const targetBtn = btns.find(btn => btn.textContent && btn.textContent.includes('确定'));
              if (targetBtn) {
                targetBtn.setAttribute('data-confirm-btn-temp', 'true');
                return { success: true };
              }
              return { success: false };
            `) as { success?: boolean } | null;

            if (markResult?.success) {
              await executeClick('.exchange-tooltip span.boss-btn-primary[data-confirm-btn-temp="true"]');
              confirmClicked = true;

              // 清理临时属性
              await executeScript(`
                const btn = document.querySelector('.exchange-tooltip span.boss-btn-primary[data-confirm-btn-temp="true"]');
                if (btn) btn.removeAttribute('data-confirm-btn-temp');
              `);
            }
          } else if (confirmData.selector && typeof confirmData.selector === "string") {
            // 直接使用选择器
            await executeClick(confirmData.selector);
            confirmClicked = true;
          }
        } catch (_error) {
          // 如果点击失败，尝试备用方案
          const fallbackData = await executeScript(`
            const buttons = document.querySelectorAll('.exchange-tooltip span.boss-btn-primary');
            for (let i = 0; i < buttons.length; i++) {
              const btn = buttons[i];
              if (btn.textContent && btn.textContent.includes('确定')) {
                return { success: true, selector: '.exchange-tooltip span.boss-btn-primary', index: i };
              }
            }
            return { success: false };
          `) as { success?: boolean; index?: number } | null;

          if (fallbackData?.success && typeof fallbackData.index === "number") {
            const markResult = await executeScript(`
              const btns = Array.from(document.querySelectorAll('.exchange-tooltip span.boss-btn-primary'));
              const targetBtn = btns.find(btn => btn.textContent && btn.textContent.includes('确定'));
              if (targetBtn) {
                targetBtn.setAttribute('data-confirm-btn-temp', 'true');
                return { success: true };
              }
              return { success: false };
            `) as { success?: boolean } | null;

            if (markResult?.success) {
              try {
                await executeClick('.exchange-tooltip span.boss-btn-primary[data-confirm-btn-temp="true"]');
                confirmClicked = true;

                // 清理临时属性
                await executeScript(`
                  const btn = document.querySelector('.exchange-tooltip span.boss-btn-primary[data-confirm-btn-temp="true"]');
                  if (btn) btn.removeAttribute('data-confirm-btn-temp');
                `);
              } catch (_err) {
                confirmClicked = false;
              }
            }
          }
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
        // Zhipin DOM 结构 (参考 get-chat-details.tool.ts):
        // - 容器: .message-card-top-wrap 或 [class*="d-top-text"]
        // - 微信号: 8-15位数字 或 "微信：xxx" 格式
        let wechatNumber: string | undefined;
        try {
          const wechatData = await executeScript(`
            // 策略1: 查找微信交换卡片 (.message-card-top-wrap 或 d-top-text)
            const wechatCardSelectors = [
              '.message-card-top-wrap',
              '[class*="d-top-text"]',
              '.message-card-top-title'
            ];

            for (const selector of wechatCardSelectors) {
              const cards = document.querySelectorAll(selector);
              for (const card of Array.from(cards).reverse()) {
                const cardText = card.textContent || '';

                // 方法1: 查找连续的数字（8-15位，微信号常见格式）
                const numMatch = cardText.match(/\\b(\\d{8,15})\\b/);
                if (numMatch) {
                  return { wechatId: numMatch[1] };
                }

                // 方法2: 查找"微信"关键词后面的内容
                const wechatTextMatch = cardText.match(/微信[：:号]*\\s*([a-zA-Z0-9_-]{5,20})/);
                if (wechatTextMatch) {
                  return { wechatId: wechatTextMatch[1] };
                }

                // 方法3: 查找字母开头的微信号（字母+数字组合，6-20位）
                const alphaMatch = cardText.match(/\\b([a-zA-Z][a-zA-Z0-9_-]{5,19})\\b/);
                if (alphaMatch && !['微信', 'WeChat'].includes(alphaMatch[1])) {
                  return { wechatId: alphaMatch[1] };
                }
              }
            }

            // 策略2: 查找 msg-item 中的微信交换信息
            const msgItems = document.querySelectorAll('.message-item, .msg-item');
            for (const item of Array.from(msgItems).reverse()) {
              const hasWechatCard = item.querySelector('.message-card-top-wrap, [class*="d-top-text"]');
              if (hasWechatCard) {
                const text = hasWechatCard.textContent || '';
                const numMatch = text.match(/\\b(\\d{8,15})\\b/);
                if (numMatch) {
                  return { wechatId: numMatch[1] };
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

        // 埋点：记录微信交换事件（fire-and-forget）
        const ctx = recruitmentContext.getContext();
        if (ctx && candidateName) {
          // 显式设置 sourcePlatform 为 zhipin
          const zhipinCtx = { ...ctx, sourcePlatform: SourcePlatform.ZHIPIN };

          // 解析年龄：从 "36岁" 提取数字 "36"
          const parseAge = (ageStr?: string): string | undefined => {
            if (!ageStr) return undefined;
            const match = ageStr.match(/(\d+)/);
            return match ? match[1] : ageStr;
          };
          // 解析薪资：从 "3000-4000元" 提取 "3000-4000"
          const parseSalary = (salaryStr?: string): string | undefined => {
            if (!salaryStr) return undefined;
            // 移除"元"、"元/月"等后缀，保留数字和分隔符
            return salaryStr.replace(/元.*$/, "").trim();
          };

          // 从 jobName 提取 brandId（精确匹配 data_dictionary）
          const brandId = await extractBrandIdFromJobName(jobName);

          // 注意：zhipin 使用沟通职位（jobName）作为 candidate.position 用于 candidate_key 生成
          // 这与 yupao 不同，yupao 使用候选人期望职位
          const builder = recruitmentEventService
            .event(zhipinCtx)
            .candidate({
              name: candidateName,
              position: jobName, // 使用沟通职位（communicationPosition）作为 candidate_key
              age: parseAge(candidateAge),
              education: candidateEducation,
              expectedSalary: parseSalary(candidateExpectedSalary),
              expectedLocation: candidateExpectedLocation,
            });

          // 设置岗位信息
          if (jobName) {
            builder.forJob(jobId || 0, jobName);
          }

          // 设置品牌信息
          if (brandId) {
            builder.forBrand(brandId);
          }

          // zhipin 主动交换：我方发起请求，对方可能不同意，标记为 requested
          const event = builder.wechatExchanged(wechatNumber, WechatExchangeType.REQUESTED);
          recruitmentEventService.recordAsync(event);
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
export const createZhipinExchangeWechatTool = zhipinExchangeWechatTool;
