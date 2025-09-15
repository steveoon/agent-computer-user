import { tool } from "ai";
import { z } from "zod";
import { getPuppeteerMCPClient } from "@/lib/mcp/client-manager";
import {
  wrapAntiDetectionScript,
  randomDelay,
  humanDelay,
  performRandomScroll,
  shouldAddRandomBehavior,
} from "./anti-detection-utils";
import type { AutomationResult } from "./types";

/**
 * Zhipin打开简历结果类型
 */
export interface ZhipinOpenResumeResult {
  candidateName: string;
  candidateId?: string;
  success: boolean;
  message?: string;
  error?: string;
  timestamp: string;
}

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
 * Boss直聘点击打开候选人简历工具
 *
 * 功能：
 * - 点击候选人卡片打开简历详情弹窗
 * - 支持批量打开多个候选人简历
 * - 包含反爬虫策略
 *
 * 关键选择器：
 * - .card-inner[data-geek] - 具有data-geek属性的card-inner元素
 * - data-geek属性包含候选人的唯一标识符
 * - 点击这个元素会触发简历详情弹窗
 */
export const zhipinOpenResumeTool = () =>
  tool({
    description: `Boss直聘点击打开候选人简历功能
    
    功能：
    - 点击指定候选人卡片打开简历详情弹窗
    - 支持批量打开多个候选人简历
    - 包含反爬虫策略和人性化操作
    
    注意：
    - 需要在候选人列表页面使用
    - 候选人索引从0开始，对应#recommend-list .card-list中的.card-inner[data-geek]元素顺序
    - 点击card-inner元素（带有data-geek属性）来触发弹窗
    - 自动等待列表加载完成后再执行点击
    - 包含随机延迟和鼠标轨迹模拟`,

    inputSchema: z.object({
      candidateIndices: z
        .array(z.number())
        .describe("要打开简历的候选人索引列表（从0开始，对应页面上的候选人顺序）"),
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
      waitForModal: z.boolean().optional().default(true).describe("是否等待弹窗出现后再继续"),
      modalWaitTime: z.number().optional().default(3000).describe("等待弹窗加载的时间（毫秒）"),
    }),

    execute: async ({
      candidateIndices,
      delayBetweenClicksMin = 2000,
      delayBetweenClicksMax = 4000,
      scrollBehavior = true,
      waitForModal = true,
      modalWaitTime = 3000,
    }): Promise<
      AutomationResult<{
        results: ZhipinOpenResumeResult[];
        summary: {
          total: number;
          success: number;
          failed: number;
        };
      }>
    > => {
      try {
        const client = await getPuppeteerMCPClient();
        const tools = await client.tools();

        // 检查必需的工具
        if (!tools.puppeteer_evaluate) {
          throw new Error("Required MCP tool puppeteer_evaluate not available");
        }

        const puppeteerEvaluate = tools.puppeteer_evaluate;

        // 初始延迟
        await randomDelay(500, 1000);

        // 先检查列表是否加载完成
        const checkListScript = wrapAntiDetectionScript(`
          let doc = document;
          const iframe = document.querySelector('iframe[name="recommendFrame"]');
          
          if (iframe) {
            try {
              const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
              if (iframeDoc) {
                doc = iframeDoc;
              }
            } catch (e) {
              console.error('访问iframe失败:', e);
            }
          }
          
          const cards = doc.querySelectorAll('#recommend-list .card-list .card-inner[data-geek]');
          return { 
            loaded: cards.length > 0, 
            count: cards.length,
            message: cards.length > 0 ? '列表已加载' : '列表未加载'
          };
        `);

        // 等待列表加载（最多重试10次，每次500ms）
        let listLoaded = false;
        for (let retry = 0; retry < 10; retry++) {
          const checkResult = await puppeteerEvaluate.execute({ script: checkListScript });
          const listStatus = parseEvaluateResult(checkResult) as {
            loaded: boolean;
            count: number;
          } | null;

          if (listStatus?.loaded) {
            listLoaded = true;
            console.log(`推荐列表已加载，找到 ${listStatus.count} 个候选人`);
            break;
          }

          await randomDelay(400, 600);
        }

        if (!listLoaded) {
          return {
            success: false,
            error: "推荐列表加载超时，请确保页面已完全加载",
          };
        }

        const results: ZhipinOpenResumeResult[] = [];

        // 依次点击每个候选人卡片打开简历
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

            // 查找并点击目标卡片
            const clickScript = wrapAntiDetectionScript(`
              // 首先尝试获取iframe
              let doc = document;
              const iframe = document.querySelector('iframe[name="recommendFrame"]');
              
              if (iframe) {
                try {
                  // 获取iframe的文档
                  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                  if (iframeDoc) {
                    doc = iframeDoc;
                    console.log('已切换到iframe文档进行打开简历操作');
                  }
                } catch (e) {
                  console.error('访问iframe失败:', e);
                }
              }
              
              // 使用更精确的选择器，限定在推荐列表内查找候选人卡片
              // 避免选中其他区域的元素导致索引错位
              let allCandidateCards = doc.querySelectorAll('#recommend-list .card-list .card-item .card-inner[data-geek]');
              
              if (allCandidateCards.length === 0) {
                // 备用选择器：尝试不包含 .card-item 的路径（某些布局可能不同）
                allCandidateCards = doc.querySelectorAll('#recommend-list .card-list .card-inner[data-geek]');
                if (allCandidateCards.length === 0) {
                  // 最后备用：只在推荐列表内查找
                  allCandidateCards = doc.querySelectorAll('#recommend-list .card-inner[data-geek]');
                  if (allCandidateCards.length === 0) {
                    return { success: false, error: '未找到推荐列表中的候选人卡片' };
                  }
                }
              }
              
              console.log('找到候选人卡片数量: ' + allCandidateCards.length);
              
              // 检查索引范围
              if (${candidateIndex} < 0) {
                return { 
                  success: false, 
                  error: '候选人索引必须为非负整数' 
                };
              }
              
              if (${candidateIndex} >= allCandidateCards.length) {
                return { 
                  success: false, 
                  error: '候选人索引超出范围，当前页面只有 ' + allCandidateCards.length + ' 个候选人' 
                };
              }
              
              const targetCard = allCandidateCards[${candidateIndex}];
              
              // 获取候选人ID和姓名
              const candidateId = targetCard.getAttribute('data-geek') || targetCard.getAttribute('data-geekid');
              
              // 查找候选人姓名
              let candidateName = '候选人';
              // 在card-inner内部或其父容器中查找姓名
              const nameEl = targetCard.querySelector('.name') || 
                           targetCard.closest('.candidate-card-wrap')?.querySelector('.name');
              if (nameEl) {
                candidateName = nameEl.textContent?.trim() || candidateName;
              }
              
              // 检查是否已经查看过（has-viewed类）
              const hasViewed = targetCard.classList.contains('has-viewed');
              
              // 直接在iframe内部点击卡片
              try {
                // 先滚动到元素可见
                targetCard.scrollIntoView({ behavior: 'auto', block: 'center' });
                
                // 获取卡片位置
                const rect = targetCard.getBoundingClientRect();
                const x = rect.left + rect.width / 2;
                const y = rect.top + rect.height / 2;
                
                // 获取正确的window对象（iframe的window）
                const win = doc.defaultView || window;
                
                // 触发完整的鼠标事件序列（不包含click事件，避免重复）
                const mouseEvents = [
                  new MouseEvent('mouseover', { view: win, bubbles: true, cancelable: true, clientX: x, clientY: y }),
                  new MouseEvent('mouseenter', { view: win, bubbles: true, cancelable: true, clientX: x, clientY: y }),
                  new MouseEvent('mousemove', { view: win, bubbles: true, cancelable: true, clientX: x, clientY: y }),
                  new MouseEvent('mousedown', { view: win, bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }),
                  new MouseEvent('mouseup', { view: win, bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 })
                ];
                
                // 依次触发事件
                for (const event of mouseEvents) {
                  targetCard.dispatchEvent(event);
                }
                
                // 最后调用一次click方法完成点击
                targetCard.click();
                
                // 标记为已点击
                targetCard.setAttribute('data-zhipin-resume-opened', 'true');
                
                return { 
                  success: true, 
                  candidateName: candidateName,
                  candidateId: candidateId,
                  hasViewed: hasViewed,
                  clicked: true
                };
              } catch (clickError) {
                return { 
                  success: false, 
                  error: '点击卡片失败: ' + clickError.message,
                  candidateName: candidateName,
                  candidateId: candidateId
                };
              }
            `);

            const clickResult = await puppeteerEvaluate.execute({ script: clickScript });
            const result = parseEvaluateResult(clickResult) as {
              success: boolean;
              candidateName?: string;
              candidateId?: string;
              hasViewed?: boolean;
              error?: string;
              clicked?: boolean;
            } | null;

            if (!result?.success) {
              results.push({
                candidateName: result?.candidateName || `候选人${candidateIndex}`,
                candidateId: result?.candidateId,
                success: false,
                error: result?.error || "操作失败",
                timestamp: new Date().toISOString(),
              });
              continue;
            }

            // 点击成功
            results.push({
              candidateName: result.candidateName || `候选人${candidateIndex}`,
              candidateId: result.candidateId,
              success: true,
              message: `成功打开简历${result.hasViewed ? "（已查看过）" : "（新简历）"}`,
              timestamp: new Date().toISOString(),
            });

            // 如果需要等待弹窗加载
            if (waitForModal) {
              await randomDelay(modalWaitTime, modalWaitTime + 500);

              // 检查弹窗是否成功打开
              const checkModalScript = wrapAntiDetectionScript(`
                // Boss直聘常见的弹窗选择器
                const modalSelectors = [
                  '.resume-detail-modal',
                  '.dialog-container', 
                  '.modal-resume',
                  '.boss-dialog',
                  '.resume-dialog',
                  '.dialog-wrap',
                  '.geek-detail-dialog',
                  '.candidate-detail-dialog',
                  '[class*="resume-detail"]',
                  '[class*="geek-detail"]'
                ];
                
                // 检查主文档
                for (const selector of modalSelectors) {
                  const modal = document.querySelector(selector);
                  if (modal && (modal.offsetWidth > 0 || modal.offsetHeight > 0)) {
                    console.log('简历详情弹窗已打开: ' + selector);
                    return { modalOpened: true, selector: selector };
                  }
                }
                
                // 检查iframe内部
                const iframe = document.querySelector('iframe[name="recommendFrame"]');
                if (iframe) {
                  try {
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                    if (iframeDoc) {
                      for (const selector of modalSelectors) {
                        const iframeModal = iframeDoc.querySelector(selector);
                        if (iframeModal && (iframeModal.offsetWidth > 0 || iframeModal.offsetHeight > 0)) {
                          console.log('简历详情弹窗已在iframe中打开: ' + selector);
                          return { modalOpened: true, selector: selector };
                        }
                      }
                    }
                  } catch (e) {
                    console.error('检查iframe弹窗失败:', e);
                  }
                }
                
                return { modalOpened: false };
              `);

              const modalResult = await puppeteerEvaluate.execute({ script: checkModalScript });
              const modalCheck = parseEvaluateResult(modalResult) as {
                modalOpened: boolean;
              } | null;

              if (modalCheck?.modalOpened) {
                console.log(`候选人${candidateIndex}的简历弹窗已成功打开`);
              }
            }

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
        };
      }
    },
  });

/**
 * 快捷创建函数
 */
export const createZhipinOpenResumeTool = zhipinOpenResumeTool;

// 导出工具
export const ZHIPIN_OPEN_RESUME_ACTION = "zhipin_open_resume";
