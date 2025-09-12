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
 * Zhipin打招呼结果类型
 */
export interface ZhipinSayHelloResult {
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
 * Boss直聘点击打招呼工具
 *
 * 功能：
 * - 点击指定候选人的"打招呼"按钮
 * - 系统会自动发送默认招呼语
 * - 包含反爬虫策略
 *
 * 注意：
 * - Boss直聘使用两列布局，每个li.card-item包含两个候选人卡片
 * - 候选人索引是基于所有候选人卡片的顺序，不是li元素的顺序
 */
export const zhipinSayHelloSimpleTool = () =>
  tool({
    description: `Boss直聘点击打招呼按钮功能
    
    功能：
    - 点击指定候选人的"打招呼"按钮
    - 系统会自动发送默认的招呼语
    - 支持批量打招呼（依次点击多个候选人）
    - 包含反爬虫策略和人性化操作
    
    注意：
    - 需要在候选人列表页面使用
    - 候选人索引从0开始，对应页面上的候选人顺序
    - 点击后系统会自动发送消息，无需手动输入
    - 包含随机延迟和鼠标轨迹模拟`,

    inputSchema: z.object({
      candidateIndices: z
        .array(z.number())
        .describe("要打招呼的候选人索引列表（从0开始，对应页面上的候选人顺序）"),
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
    }): Promise<
      AutomationResult<{
        results: ZhipinSayHelloResult[];
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

        const results: ZhipinSayHelloResult[] = [];

        // 依次点击每个候选人的打招呼按钮
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

            // 查找并点击目标按钮
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
                    console.log('已切换到iframe文档进行打招呼操作');
                  }
                } catch (e) {
                  console.error('访问iframe失败:', e);
                }
              }
              
              // 获取所有候选人卡片
              // Boss直聘有多种布局，需要按优先级尝试不同的选择器
              let allCandidateCards = [];
              
              // 按优先级尝试不同的选择器
              const candidateSelectors = [
                // 新版结构（不带.geek-card-small类）
                '.candidate-card-wrap',
                // 旧版结构
                '.geek-card-small.candidate-card-wrap',
                // 备用选择器
                '.card-inner.common-wrap',
                '.card-inner[data-geek]'
              ];
              
              for (const selector of candidateSelectors) {
                const found = doc.querySelectorAll(selector);
                if (found.length > 0) {
                  // 过滤确保每个元素都是有效的候选人卡片
                  const validCards = Array.from(found).filter(el => {
                    // 检查是否有打招呼按钮，这是最可靠的判断方法
                    const hasGreetBtn = el.querySelector('button.btn.btn-greet') !== null;
                    // 或者检查是否有候选人信息
                    const hasCardInner = el.querySelector('.card-inner') !== null || el.classList.contains('card-inner');
                    return hasGreetBtn || hasCardInner;
                  });
                  
                  if (validCards.length > 0) {
                    allCandidateCards = validCards;
                    console.log('使用选择器找到候选人卡片: ' + selector + ', 数量: ' + validCards.length);
                    break;
                  }
                }
              }
              
              if (allCandidateCards.length === 0) {
                return { success: false, error: '未找到候选人卡片列表' };
              }
              
              console.log('找到候选人卡片数量: ' + allCandidateCards.length);
              
              if (${candidateIndex} >= allCandidateCards.length) {
                return { 
                  success: false, 
                  error: '候选人索引超出范围，当前页面只有 ' + allCandidateCards.length + ' 个候选人' 
                };
              }
              
              const targetCard = allCandidateCards[${candidateIndex}];
              
              // 获取候选人ID和姓名
              let cardInner = targetCard.querySelector('.card-inner');
              if (!cardInner && targetCard.classList.contains('card-inner')) {
                cardInner = targetCard; // 如果targetCard本身就是card-inner
              }
              const candidateId = cardInner ? (cardInner.getAttribute('data-geek') || cardInner.getAttribute('data-geekid')) : null;
              
              // 查找候选人姓名
              let candidateName = '候选人';
              const nameEl = targetCard.querySelector('.name');
              if (nameEl) {
                candidateName = nameEl.textContent?.trim() || candidateName;
              }
              
              // 查找打招呼按钮
              const greetBtn = targetCard.querySelector('button.btn.btn-greet');
              
              if (!greetBtn) {
                return { 
                  success: false, 
                  error: '未找到打招呼按钮', 
                  candidateName: candidateName,
                  candidateId: candidateId
                };
              }
              
              // 检查按钮是否可点击
              if (greetBtn.disabled) {
                return { 
                  success: false, 
                  error: '打招呼按钮已禁用', 
                  candidateName: candidateName,
                  candidateId: candidateId
                };
              }
              
              // 直接在iframe内部点击按钮
              // 使用同步的方式触发点击事件
              try {
                // 先滚动到元素可见
                greetBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
                
                // 获取按钮位置
                const rect = greetBtn.getBoundingClientRect();
                const x = rect.left + rect.width / 2;
                const y = rect.top + rect.height / 2;
                
                // 获取正确的window对象（iframe的window）
                const win = doc.defaultView || window;
                
                // 触发完整的鼠标事件序列
                const mouseEvents = [
                  new MouseEvent('mouseover', { view: win, bubbles: true, cancelable: true, clientX: x, clientY: y }),
                  new MouseEvent('mouseenter', { view: win, bubbles: true, cancelable: true, clientX: x, clientY: y }),
                  new MouseEvent('mousemove', { view: win, bubbles: true, cancelable: true, clientX: x, clientY: y }),
                  new MouseEvent('mousedown', { view: win, bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }),
                  new MouseEvent('mouseup', { view: win, bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }),
                  new MouseEvent('click', { view: win, bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 })
                ];
                
                // 依次触发事件
                for (const event of mouseEvents) {
                  greetBtn.dispatchEvent(event);
                }
                
                // 如果按钮还有onclick处理器，直接调用
                if (typeof greetBtn.onclick === 'function') {
                  greetBtn.onclick();
                }
                
                // 或者直接调用click方法
                greetBtn.click();
                
                // 标记为已点击
                greetBtn.setAttribute('data-zhipin-clicked', 'true');
                
                return { 
                  success: true, 
                  buttonText: greetBtn.textContent?.trim(),
                  candidateName: candidateName,
                  candidateId: candidateId,
                  clicked: true
                };
              } catch (clickError) {
                return { 
                  success: false, 
                  error: '点击按钮失败: ' + clickError.message,
                  candidateName: candidateName,
                  candidateId: candidateId
                };
              }
            `);

            const clickResult = await puppeteerEvaluate.execute({ script: clickScript });
            const result = parseEvaluateResult(clickResult) as {
              success: boolean;
              buttonText?: string;
              candidateName?: string;
              candidateId?: string;
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
              message: `成功点击${result.buttonText || "打招呼按钮"}`,
              timestamp: new Date().toISOString(),
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
export const createZhipinSayHelloSimpleTool = zhipinSayHelloSimpleTool;

// 导出工具
export const ZHIPIN_SAY_HELLO_SIMPLE_ACTION = "zhipin_say_hello_simple";
