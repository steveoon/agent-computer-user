import { tool } from "ai";
import { z } from "zod";
import { getPuppeteerMCPClient } from "@/lib/mcp/client-manager";
import { YUPAO_EXCHANGE_WECHAT_SELECTORS } from "./constants";
import { wrapAntiDetectionScript, randomDelay, clickWithMouseTrajectory } from "../zhipin/anti-detection-utils";
import { createDynamicClassSelector } from "./dynamic-selector-utils";

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
    
    注意：
    - 需要先打开候选人聊天窗口
    - 需要确保当前聊天对象支持交换微信
    - 操作有先后顺序，会自动等待弹窗出现`,

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
    }),

    execute: async ({ waitBetweenClicksMin = 400, waitBetweenClicksMax = 800, waitAfterExchangeMin = 800, waitAfterExchangeMax = 1500 }) => {
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

        // 添加初始延迟
        await randomDelay(100, 300);

        // 第一步：查找交换微信按钮 - 使用动态选择器
        const exchangeBtnSelector = createDynamicClassSelector('_exchange-tel-btn');
        
        const findExchangeButtonScript = wrapAntiDetectionScript(`
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
        `);

        const exchangeResult = await puppeteerEvaluate.execute({ script: findExchangeButtonScript });
        const exchangeData = parseEvaluateResult(exchangeResult);

        if (!exchangeData?.exists) {
          return {
            success: false,
            error: '未找到"换微信"按钮',
            message: "请确保已打开候选人聊天窗口",
          };
        }

        // 点击交换按钮
        let exchangeClicked = false;
        try {
          if (exchangeData.index !== undefined && typeof exchangeData.index === 'number') {
            // 使用索引点击
            const markScript = wrapAntiDetectionScript(`
              const selector = '${exchangeData.selector || exchangeBtnSelector}';
              const buttons = document.querySelectorAll(selector);
              const targetBtn = buttons[${exchangeData.index}];
              if (targetBtn) {
                targetBtn.setAttribute('data-exchange-wechat-temp', 'true');
                return { success: true };
              }
              return { success: false };
            `);
            
            const markResult = await puppeteerEvaluate.execute({ script: markScript });
            const marked = parseEvaluateResult(markResult);
            
            if (marked?.success) {
              await clickWithMouseTrajectory(client, '[data-exchange-wechat-temp="true"]', {
                preClickDelay: 100,
                moveSteps: 20
              });
              exchangeClicked = true;
              
              // 清理临时属性
              await puppeteerEvaluate.execute({ 
                script: wrapAntiDetectionScript(`
                  const btn = document.querySelector('[data-exchange-wechat-temp="true"]');
                  if (btn) btn.removeAttribute('data-exchange-wechat-temp');
                `)
              });
            }
          } else if (exchangeData.selector && typeof exchangeData.selector === 'string') {
            // 直接使用选择器
            await clickWithMouseTrajectory(client, exchangeData.selector, {
              preClickDelay: 100,
              moveSteps: 20
            });
            exchangeClicked = true;
          }
        } catch (_error) {
          // 备用方案：尝试包含文本的选择器
          const fallbackScript = wrapAntiDetectionScript(`
            const buttons = document.querySelectorAll('div[class*="_exchange-tel-btn"]');
            for (const btn of buttons) {
              if (btn.textContent && btn.textContent.includes('换微信')) {
                btn.setAttribute('data-exchange-wechat-fallback', 'true');
                return { success: true };
              }
            }
            return { success: false };
          `);
          
          const fallbackResult = await puppeteerEvaluate.execute({ script: fallbackScript });
          const fallback = parseEvaluateResult(fallbackResult);
          
          if (fallback?.success) {
            try {
              await clickWithMouseTrajectory(client, 'div[data-exchange-wechat-fallback="true"]', {
                preClickDelay: 100,
                moveSteps: 20
              });
              exchangeClicked = true;
            } catch (_err) {
              exchangeClicked = false;
            }
          }
        }

        if (!exchangeClicked) {
          return {
            success: false,
            error: '点击交换微信按钮失败',
            message: "请确保已打开候选人聊天窗口",
          };
        }

        // 等待弹窗出现
        await randomDelay(waitBetweenClicksMin, waitBetweenClicksMax);
        
        // 检查弹窗是否出现 - 使用动态选择器
        const dialogSelector = createDynamicClassSelector('_exchangeTipPop');
        const wechatPopSelector = createDynamicClassSelector('_wechatPop');
        
        const checkDialogScript = wrapAntiDetectionScript(`
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
        `);
        
        const dialogCheck = await puppeteerEvaluate.execute({ script: checkDialogScript });
        const dialogData = parseEvaluateResult(dialogCheck);
        
        if (!dialogData?.visible || !dialogData?.hasConfirmButton) {
          // 如果弹窗还没出现，再等待一下
          await randomDelay(500, 800);
        }

        // 第二步：查找并点击确认按钮 - 使用动态选择器
        const findConfirmButtonScript = wrapAntiDetectionScript(`
          // 策略1: 先尝试精确选择器
          let confirmBtn = document.querySelector('${YUPAO_EXCHANGE_WECHAT_SELECTORS.exchangeTipPop} ${YUPAO_EXCHANGE_WECHAT_SELECTORS.confirmButton}');
          if (confirmBtn && confirmBtn.offsetParent !== null) {
            return {
              exists: true,
              selector: '${YUPAO_EXCHANGE_WECHAT_SELECTORS.exchangeTipPop} ${YUPAO_EXCHANGE_WECHAT_SELECTORS.confirmButton}',
              text: confirmBtn.textContent?.trim() || ''
            };
          }
          
          // 策略2: 使用动态选择器查找对话框内的确认按钮
          const dialog = document.querySelector('${dialogSelector}') || 
                         document.querySelector('[class*="_exchangeTipPop"]');
          
          if (dialog) {
            // 查找包含"确定"的按钮
            const buttons = dialog.querySelectorAll('button');
            for (let i = 0; i < buttons.length; i++) {
              const btn = buttons[i];
              if (btn.textContent && btn.textContent.includes('确定')) {
                // 检查是否是primary按钮
                if (btn.classList.toString().includes('_primary')) {
                  return {
                    exists: true,
                    selector: 'button',
                    index: i,
                    text: btn.textContent.trim(),
                    needsIndex: true
                  };
                }
              }
            }
          }
          
          return { exists: false };
        `);

        const confirmResult = await puppeteerEvaluate.execute({ script: findConfirmButtonScript });
        const confirmData = parseEvaluateResult(confirmResult);

        if (!confirmData?.exists) {
          return {
            success: false,
            error: '未找到确认对话框中的"确定"按钮',
            exchangeButtonClicked: true,
            message: "已点击交换微信按钮，但未能找到确认按钮",
          };
        }

        // 添加点击前延迟
        await randomDelay(200, 400);

        // 点击确认按钮
        let confirmClicked = false;
        try {
          if (confirmData.index !== undefined && typeof confirmData.index === 'number') {
            // 使用索引点击
            const markConfirmScript = wrapAntiDetectionScript(`
              const dialog = document.querySelector('${dialogSelector}') || 
                             document.querySelector('[class*="_exchangeTipPop"]');
              if (dialog) {
                const buttons = dialog.querySelectorAll('button');
                const targetBtn = buttons[${confirmData.index}];
                if (targetBtn) {
                  targetBtn.setAttribute('data-confirm-wechat-temp', 'true');
                  return { success: true };
                }
              }
              return { success: false };
            `);
            
            const markResult = await puppeteerEvaluate.execute({ script: markConfirmScript });
            const marked = parseEvaluateResult(markResult);
            
            if (marked?.success) {
              await clickWithMouseTrajectory(client, 'button[data-confirm-wechat-temp="true"]', {
                preClickDelay: 150,
                moveSteps: 15
              });
              confirmClicked = true;
              
              // 清理临时属性
              await puppeteerEvaluate.execute({ 
                script: wrapAntiDetectionScript(`
                  const btn = document.querySelector('button[data-confirm-wechat-temp="true"]');
                  if (btn) btn.removeAttribute('data-confirm-wechat-temp');
                `)
              });
            }
          } else if (confirmData.selector && typeof confirmData.selector === 'string') {
            // 直接使用选择器
            await clickWithMouseTrajectory(client, confirmData.selector, {
              preClickDelay: 150,
              moveSteps: 15
            });
            confirmClicked = true;
          }
        } catch (_error) {
          // 最后的备用方案
          const lastResortScript = wrapAntiDetectionScript(`
            const dialog = document.querySelector('${dialogSelector}') || 
                           document.querySelector('[class*="_exchangeTipPop"]') ||
                           document.querySelector('${YUPAO_EXCHANGE_WECHAT_SELECTORS.exchangeTipPop}');
            if (dialog) {
              const btns = dialog.querySelectorAll('button');
              for (const btn of btns) {
                if (btn.textContent && btn.textContent.includes('确定')) {
                  btn.click();
                  return { success: true };
                }
              }
            }
            return { success: false };
          `);
          
          const lastResult = await puppeteerEvaluate.execute({ script: lastResortScript });
          const lastData = parseEvaluateResult(lastResult);
          confirmClicked = !!lastData?.success;
        }

        if (!confirmClicked) {
          return {
            success: false,
            error: '点击确认按钮失败',
            exchangeButtonClicked: true,
            message: "已点击交换微信按钮，但未能点击确认按钮",
          };
        }

        // 等待交换完成
        await randomDelay(waitAfterExchangeMin, waitAfterExchangeMax);

        return {
          success: true,
          message: "成功交换微信",
          details: {
            exchangeButtonSelector: exchangeData.selector as string || 'unknown',
            confirmButtonSelector: confirmData.selector as string || 'unknown',
          },
        };
      } catch (error) {
        // 静默处理错误

        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error occurred",
          message: "交换微信时发生错误",
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