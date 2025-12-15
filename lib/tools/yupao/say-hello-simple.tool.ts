import { tool } from "ai";
import { z } from "zod";
import { getPuppeteerMCPClient } from "@/lib/mcp/client-manager";
import { YUPAO_SAY_HELLO_SELECTORS } from "./constants";
import {
  wrapAntiDetectionScript,
  randomDelay,
  humanDelay,
  clickWithMouseTrajectory,
  performRandomScroll,
  shouldAddRandomBehavior,
} from "../zhipin/anti-detection-utils";
import { createDynamicClassSelector } from "./dynamic-selector-utils";
import type { YupaoSayHelloResult } from "./types";
import { SourcePlatform } from "@/db/types";
import { recordCandidateContactedEvent } from "@/lib/services/recruitment-event/tool-helpers";

/**
 * 解析 puppeteer_evaluate 的结果
 */
function parseEvaluateResult(result: unknown): unknown {
  try {
    const mcpResult = result as { content?: Array<{ text?: string }> };
    if (mcpResult?.content?.[0]?.text) {
      const resultText = mcpResult.content[0].text;
      const executionMatch = resultText.match(
        /Execution result:\s*\n([\s\S]*?)(\n\nConsole output|$)/
      );

      if (executionMatch && executionMatch[1].trim() !== "undefined") {
        const jsonResult = executionMatch[1].trim();
        return JSON.parse(jsonResult);
      }
    }
  } catch (e) {
    console.error("Failed to parse evaluate result:", e);
  }
  return null;
}

/**
 * Yupao点击打招呼工具（简化版）
 *
 * 功能：
 * - 点击指定候选人的"聊一聊"按钮
 * - 系统会自动发送默认招呼语
 * - 包含反爬虫策略
 */
export const yupaoSayHelloSimpleTool = () =>
  tool({
    description: `Yupao点击打招呼按钮功能
    
    功能：
    - 点击指定候选人的"聊一聊"按钮
    - 系统会自动发送默认的招呼语
    - 支持批量打招呼（依次点击多个候选人）
    - 包含反爬虫策略和人性化操作
    
    注意：
    - 需要先使用 get_candidate_list 获取候选人列表
    - 点击后系统会自动发送消息，无需手动输入
    - 包含随机延迟和鼠标轨迹模拟`,

    inputSchema: z.object({
      candidateIndices: z
        .array(z.number())
        .describe("要打招呼的候选人索引列表（来自get_candidate_list的index）"),
      delayBetweenClicksMin: z
        .number()
        .optional()
        .default(2000)
        .describe("两次点击之间的最小延迟（毫秒）"),
      delayBetweenClicksMax: z
        .number()
        .optional()
        .default(4000)
        .describe("两次点击之间的最大延迟（毫秒）"),
      scrollBehavior: z.boolean().optional().default(true).describe("是否启用随机滚动行为"),
    }),

    execute: async ({
      candidateIndices,
      delayBetweenClicksMin = 2000,
      delayBetweenClicksMax = 4000,
      scrollBehavior = true,
    }) => {
      try {
        const client = await getPuppeteerMCPClient();
        const tools = await client.tools();

        // 检查必需的工具
        if (!tools.puppeteer_evaluate || !tools.puppeteer_click) {
          throw new Error("Required MCP tools not available");
        }

        const puppeteerEvaluate = tools.puppeteer_evaluate;

        // 初始延迟
        await randomDelay(500, 1000);

        const results: YupaoSayHelloResult[] = [];

        // 依次点击每个候选人的聊天按钮
        for (let i = 0; i < candidateIndices.length; i++) {
          const candidateIndex = candidateIndices[i];

          try {
            // 滚动行为
            if (scrollBehavior && shouldAddRandomBehavior(0.3)) {
              await performRandomScroll(client, {
                minDistance: 100,
                maxDistance: 300,
                direction: "down",
                probability: 0.5,
              });
            }

            // 先标记目标按钮
            const markScript = wrapAntiDetectionScript(`
              // 方法1: 通过data-index查找
              let card = document.querySelector('[data-index="${candidateIndex}"]');

              // 方法2: 通过索引查找所有卡片
              if (!card) {
                const allCards = document.querySelectorAll('${createDynamicClassSelector("_card")}');
                if (!allCards.length) {
                  // 尝试更宽泛的选择器
                  const cards2 = document.querySelectorAll('[class*="_card_"]');
                  if (cards2[${candidateIndex}]) {
                    card = cards2[${candidateIndex}];
                  }
                } else if (allCards[${candidateIndex}]) {
                  card = allCards[${candidateIndex}];
                }
              }

              if (!card) {
                return { success: false, error: '未找到候选人卡片' };
              }

              // 查找聊天按钮
              const btnSelectors = [
                '${YUPAO_SAY_HELLO_SELECTORS.chatBtn}',
                '${YUPAO_SAY_HELLO_SELECTORS.chatBtnAlt}',
                '${createDynamicClassSelector("_chatBtn")}',
                'button:first-of-type'
              ];

              let btn = null;
              for (const selector of btnSelectors) {
                try {
                  btn = card.querySelector(selector);
                  if (btn && (btn.textContent?.includes('聊一聊') || btn.textContent?.includes('继续聊'))) {
                    break;
                  }
                  btn = null;
                } catch (e) {}
              }

              // 备用方案：查找所有按钮
              if (!btn) {
                const allBtns = card.querySelectorAll('button');
                for (const b of allBtns) {
                  if (b.textContent?.includes('聊一聊') || b.textContent?.includes('继续聊')) {
                    btn = b;
                    break;
                  }
                }
              }

              if (!btn) {
                return { success: false, error: '未找到聊天按钮' };
              }

              // 获取候选人姓名
              let candidateName = '候选人';
              const nameEl = card.querySelector('[class*="_name_"]:not([class*="_nameR_"])');
              if (nameEl) {
                candidateName = nameEl.textContent?.trim() || candidateName;
              }

              // 获取候选人年龄和学历 - 从基本信息中提取
              // 支持两种结构:
              // - 旧结构: _baseInfoStr_ 内容如 "女丨32岁丨大专"
              // - 新结构: _baseInfoRow_ 内容如 "<span>24岁</span><span>丨大专</span><span>丨离职</span>"
              let candidateAge = null;
              let candidateEducation = null;
              const educationList = ['初中', '中专', '中技', '高中', '大专', '本科', '硕士', '博士'];
              const baseInfoSelectors = [
                '${createDynamicClassSelector("_baseInfoStr")}',
                '${createDynamicClassSelector("_baseInfoRow")}'
              ];
              for (const selector of baseInfoSelectors) {
                try {
                  const baseInfoEl = card.querySelector(selector);
                  if (baseInfoEl) {
                    const baseInfoText = baseInfoEl.textContent || '';
                    // 提取年龄
                    const ageMatch = baseInfoText.match(/(\\d+)岁/);
                    if (ageMatch) {
                      candidateAge = ageMatch[1] + '岁';
                    }
                    // 提取学历
                    for (const edu of educationList) {
                      if (baseInfoText.includes(edu)) {
                        candidateEducation = edu;
                        break;
                      }
                    }
                    if (candidateAge) break;
                  }
                } catch (e) {}
              }

              // 获取期望信息 - 从期望区域提取位置和职位
              // 支持两种结构:
              // - 旧结构: _cardMRI_ 内有span元素
              // - 新结构: _recentEventRow_ 内有div元素，用 _divideDot_ 分隔
              let candidatePosition = null;
              let candidateExpectedLocation = null;
              let candidateExpectedSalary = null;

              const expectationSelectors = [
                '${createDynamicClassSelector("_cardMRI")}',
                '${createDynamicClassSelector("_recentEventRow")}'
              ];

              for (const selector of expectationSelectors) {
                try {
                  const expectationEl = card.querySelector(selector);
                  if (!expectationEl) continue;

                  // 新结构: 查找包含期望信息的flex容器
                  const flexContainer = expectationEl.querySelector('.flex.gap-\\\\[4px\\\\]') ||
                                       expectationEl.querySelector('div.flex.overflow-hidden');
                  if (flexContainer) {
                    // 新结构: div元素按顺序排列 [位置, ·, 职位, ·, 薪资]
                    const children = Array.from(flexContainer.children);
                    const textItems = children.filter(el =>
                      !el.classList.contains('_divideDot_') &&
                      !el.className.includes('_divideDot_') &&
                      !el.className.includes('_dot_')
                    ).map(el => el.textContent?.trim()).filter(Boolean);

                    if (textItems.length >= 1) candidateExpectedLocation = textItems[0];
                    if (textItems.length >= 2) candidatePosition = textItems[1];
                    if (textItems.length >= 3) candidateExpectedSalary = textItems[2];
                    break;
                  }

                  // 旧结构: span元素
                  const spanEls = expectationEl.querySelectorAll('span:not([class*="_cardMRIT_"]):not([class*="_dot_"]):not([class*="_salary_"])');
                  for (const span of spanEls) {
                    const text = span.textContent?.trim();
                    if (text && text.includes('·')) {
                      const parts = text.split('·').map(p => p.trim());
                      if (parts.length >= 2) {
                        candidateExpectedLocation = parts[0];
                        candidatePosition = parts[1];
                      }
                    } else if (text && !candidateExpectedLocation) {
                      candidateExpectedLocation = text;
                    }
                  }

                  // 旧结构: 单独的薪资元素
                  const salaryEl = expectationEl.querySelector('[class*="_salary_"]');
                  if (salaryEl) {
                    candidateExpectedSalary = salaryEl.textContent?.trim() || null;
                  }

                  if (candidatePosition || candidateExpectedLocation) break;
                } catch (e) {}
              }

              // 备用: 直接查找薪资元素
              if (!candidateExpectedSalary) {
                const salarySelectors = [
                  '${createDynamicClassSelector("_salary")}',
                  '.text-\\\\[\\\\#0092FF\\\\]',
                  'div.flex-none.text-\\\\[\\\\#0092FF\\\\]'
                ];
                for (const selector of salarySelectors) {
                  try {
                    const salaryEl = card.querySelector(selector);
                    if (salaryEl) {
                      candidateExpectedSalary = salaryEl.textContent?.trim() || null;
                      break;
                    }
                  } catch (e) {}
                }
              }

              // 标记按钮
              btn.setAttribute('data-say-hello-target', 'true');
              return {
                success: true,
                buttonText: btn.textContent?.trim(),
                candidateName: candidateName,
                candidateAge: candidateAge,
                candidateEducation: candidateEducation,
                candidatePosition: candidatePosition,
                candidateExpectedLocation: candidateExpectedLocation,
                candidateExpectedSalary: candidateExpectedSalary
              };
            `);

            const markResult = await puppeteerEvaluate.execute({ script: markScript });
            const marked = parseEvaluateResult(markResult) as {
              success: boolean;
              buttonText?: string;
              candidateName?: string;
              candidateAge?: string;
              candidateEducation?: string;
              candidatePosition?: string;
              candidateExpectedLocation?: string;
              candidateExpectedSalary?: string;
              error?: string;
            } | null;

            if (!marked?.success) {
              results.push({
                candidateName: `候选人${candidateIndex}`,
                success: false,
                error: marked?.error || "未找到聊天按钮",
                timestamp: new Date().toISOString(),
              });
              continue;
            }

            // 使用鼠标轨迹点击
            await clickWithMouseTrajectory(client, '[data-say-hello-target="true"]', {
              preClickDelay: 200,
              moveSteps: 15,
            });

            // 清理标记
            await puppeteerEvaluate.execute({
              script: wrapAntiDetectionScript(`
                const btn = document.querySelector('[data-say-hello-target="true"]');
                if (btn) btn.removeAttribute('data-say-hello-target');
              `),
            });

            // 检查并处理可能出现的"同事已联系"弹窗
            await randomDelay(800, 1200);
            
            const dialogHandlerScript = wrapAntiDetectionScript(`
              function isVisible(elem) {
                if (!elem) return false;
                const style = window.getComputedStyle(elem);
                if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
                const rect = elem.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0;
              }

              const modals = Array.from(document.querySelectorAll('.ant-modal-content'));
              const conflictModal = modals.find(m => {
                // 1. 检查文本内容
                if (!m.textContent || !m.textContent.includes('您的同事近期联系过该牛人')) return false;
                
                // 2. 检查可见性
                // Antd Modal 通常通过父级 .ant-modal-wrap 控制显示
                const wrap = m.closest('.ant-modal-wrap');
                if (wrap && !isVisible(wrap)) return false;
                
                return isVisible(m);
              });
              
              if (conflictModal) {
                const buttons = Array.from(conflictModal.querySelectorAll('button'));
                const continueBtn = buttons.find(btn => btn.textContent && btn.textContent.includes('继续联系'));
                
                if (continueBtn && isVisible(continueBtn)) {
                  continueBtn.click();
                  return { handled: true, message: '检测到冲突弹窗，已自动点击继续联系' };
                }
                return { handled: true, error: '检测到冲突弹窗，但未找到有效继续联系按钮' };
              }
              return { handled: false };
            `);

            const dialogResultRaw = await puppeteerEvaluate.execute({ script: dialogHandlerScript });
            const dialogResult = parseEvaluateResult(dialogResultRaw) as { 
              handled: boolean; 
              message?: string; 
              error?: string 
            } | null;

            let resultMessage = `成功点击${marked.buttonText || "聊天按钮"}`;
            if (dialogResult?.handled) {
              if (dialogResult.message) {
                resultMessage += ` (${dialogResult.message})`;
              }
              if (dialogResult.error) {
                resultMessage += ` (警告: ${dialogResult.error})`;
              }
              // 如果处理了弹窗，额外等待一会儿让消息发送
              await new Promise(r => setTimeout(r, 500));
            }

            const successCandidateName = marked.candidateName || `候选人${candidateIndex}`;
            results.push({
              candidateName: successCandidateName,
              success: true,
              message: resultMessage,
              timestamp: new Date().toISOString(),
            });

            // 记录 CANDIDATE_CONTACTED 事件（主动打招呼）
            recordCandidateContactedEvent({
              platform: SourcePlatform.YUPAO,
              candidate: {
                name: successCandidateName,
                age: marked.candidateAge,
                education: marked.candidateEducation,
                position: marked.candidatePosition,
                expectedLocation: marked.candidateExpectedLocation,
                expectedSalary: marked.candidateExpectedSalary,
              },
            }).catch((err) => {
              console.warn("[YupaoSayHello] Failed to record candidate_contacted event:", err);
            });

            // 等待系统处理和发送消息
            await randomDelay(1000, 1500);

            // 等待下一个候选人
            if (i < candidateIndices.length - 1) {
              await randomDelay(delayBetweenClicksMin, delayBetweenClicksMax);

              // 偶尔添加更长的延迟
              if (shouldAddRandomBehavior(0.1)) {
                await humanDelay();
              }
            }
          } catch (error) {
            results.push({
              candidateName: `候选人${candidateIndex}`,
              success: false,
              error: error instanceof Error ? error.message : "点击失败",
              timestamp: new Date().toISOString(),
            });
          }
        }

        // 统计结果
        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;

        return {
          success: true,
          message: `批量打招呼完成：成功 ${successCount} 个，失败 ${failCount} 个`,
          data: {
            results,
            summary: {
              total: results.length,
              success: successCount,
              failed: failCount,
            },
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error occurred",
          message: "点击打招呼按钮时发生错误",
        };
      }
    },
  });

/**
 * 快捷创建函数
 */
export const createYupaoSayHelloSimpleTool = yupaoSayHelloSimpleTool;

// 导出工具
export const SAY_HELLO_SIMPLE_ACTION = "say_hello_simple";
