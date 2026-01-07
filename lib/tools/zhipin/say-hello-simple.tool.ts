import { tool } from "ai";
import { z } from 'zod/v3';
import { getPuppeteerMCPClient, getPlaywrightMCPClient } from "@/lib/mcp/client-manager";
import {
  wrapAntiDetectionScript,
  randomDelay,
  humanDelay,
  performRandomScroll,
  shouldAddRandomBehavior,
} from "./anti-detection-utils";
import { SourcePlatform } from "@/db/types";
import { recordCandidateContactedEvent } from "@/lib/services/recruitment-event/tool-helpers";
import {
  selectZhipinTab,
  parsePlaywrightResult,
  wrapPlaywrightScript,
  type TabSelectionResult,
} from "@/lib/tools/shared/playwright-utils";

// Feature flag: 使用 Playwright MCP 而非 Puppeteer MCP
const USE_PLAYWRIGHT_MCP = process.env.USE_PLAYWRIGHT_MCP === "true";

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
    ${USE_PLAYWRIGHT_MCP ? "- [Playwright] 支持自动切换到Boss直聘标签页" : ""}

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
      autoSwitchTab: z
        .boolean()
        .optional()
        .default(true)
        .describe("是否自动切换到Boss直聘标签页（仅 Playwright 模式有效）"),
    }),

    execute: async ({
      candidateIndices,
      delayBetweenClicksMin = 2000,
      delayBetweenClicksMax = 4000,
      scrollBehavior = true,
      autoSwitchTab = true,
    }) => {
      try {
        const mcpBackend = USE_PLAYWRIGHT_MCP ? "playwright" : "puppeteer";

        // Playwright 模式: 自动切换到Boss直聘标签页
        if (USE_PLAYWRIGHT_MCP && autoSwitchTab) {
          console.log("[Playwright] 正在切换到Boss直聘标签页...");
          const tabResult: TabSelectionResult = await selectZhipinTab();

          if (!tabResult.success) {
            return {
              success: false,
              error: `无法切换到Boss直聘标签页: ${tabResult.error}`,
              message: "请确保已在浏览器中打开Boss直聘页面",
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

        // 检查必需的工具
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

        // 初始延迟 (仅 Puppeteer 模式)
        if (!USE_PLAYWRIGHT_MCP) {
          await randomDelay(500, 1000);
        }

        const results: ZhipinSayHelloResult[] = [];

        // 依次点击每个候选人的打招呼按钮
        for (let i = 0; i < candidateIndices.length; i++) {
          const candidateIndex = candidateIndices[i];

          try {
            // 滚动行为 (仅 Puppeteer 模式)
            if (!USE_PLAYWRIGHT_MCP && scrollBehavior && shouldAddRandomBehavior(0.3)) {
              await performRandomScroll(client, {
                minDistance: 100,
                maxDistance: 300,
                direction: "down",
                probability: 0.5,
              });
            }

            // 查找并点击目标按钮的脚本内容
            const clickScriptContent = `
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

              // 获取候选人年龄和学历 - 从 .base-info 文本中提取
              // 格式: "24岁|3年|大专|离职-随时到岗" (蓝领) 或 "25岁|7年|本科|离职-随时到岗" (白领)
              let candidateAge = null;
              let candidateEducation = null;
              const baseInfoEl = targetCard.querySelector('.base-info');
              if (baseInfoEl) {
                // 遍历子节点提取文本（跳过分隔符）
                const infoParts = [];
                baseInfoEl.childNodes.forEach(node => {
                  if (node.nodeType === Node.TEXT_NODE) {
                    const text = node.textContent?.trim();
                    if (text) {
                      infoParts.push(text);
                    }
                  }
                });
                // infoParts: ["24岁", "3年", "大专", "离职-随时到岗"]
                for (const part of infoParts) {
                  if (part.includes('岁')) {
                    candidateAge = part;
                  } else if (['初中', '中专', '中技', '高中', '大专', '本科', '硕士', '博士'].some(edu => part.includes(edu))) {
                    candidateEducation = part;
                  }
                }
              }

              // 获取候选人期望职位和期望位置
              // 白领结构: .row-flex .content .join-text-wrap
              // 蓝领结构: .timeline-wrap.expect .content.join-text-wrap
              let candidatePosition = null;
              let candidateExpectedLocation = null;

              // 辅助函数：从 join-text-wrap 中提取文本部分
              const extractFromJoinTextWrap = (joinTextWrap) => {
                const textParts = [];
                joinTextWrap.childNodes.forEach(node => {
                  if (node.nodeType === Node.TEXT_NODE) {
                    const text = node.textContent?.trim();
                    if (text) {
                      textParts.push(text);
                    }
                  }
                });
                return textParts;
              };

              // 策略1: 白领结构 - .row-flex .content
              const expectRow = targetCard.querySelector('.row-flex:not(.geek-desc)');
              if (expectRow) {
                const labelEl = expectRow.querySelector('.label');
                const contentEl = expectRow.querySelector('.content');
                const labelText = labelEl?.textContent || '';
                // 支持 "期望" 和 "最近关注" 两种 label
                if ((labelText.includes('期望') || labelText.includes('最近关注')) && contentEl) {
                  const joinTextWrap = contentEl.querySelector('.join-text-wrap');
                  if (joinTextWrap) {
                    const textParts = extractFromJoinTextWrap(joinTextWrap);
                    if (textParts.length >= 1) candidateExpectedLocation = textParts[0];
                    if (textParts.length >= 2) candidatePosition = textParts[1];
                  }
                }
              }

              // 策略2: 蓝领结构 - .timeline-wrap.expect .content
              if (!candidateExpectedLocation && !candidatePosition) {
                const timelineExpect = targetCard.querySelector('.timeline-wrap.expect');
                if (timelineExpect) {
                  const contentEl = timelineExpect.querySelector('.content.join-text-wrap') ||
                                   timelineExpect.querySelector('.content .join-text-wrap');
                  if (contentEl) {
                    const textParts = extractFromJoinTextWrap(contentEl);
                    if (textParts.length >= 1) candidateExpectedLocation = textParts[0];
                    if (textParts.length >= 2) candidatePosition = textParts[1];
                  }
                }
              }

              // 获取候选人期望薪资 - 从 .salary-wrap 中提取
              let candidateExpectedSalary = null;
              const salaryEl = targetCard.querySelector('.salary-wrap');
              if (salaryEl) {
                candidateExpectedSalary = salaryEl.textContent?.trim() || null;
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
                  candidateAge: candidateAge,
                  candidateEducation: candidateEducation,
                  candidatePosition: candidatePosition,
                  candidateExpectedLocation: candidateExpectedLocation,
                  candidateExpectedSalary: candidateExpectedSalary,
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
            `;

            const clickResultRaw = await executeScript(clickScriptContent);
            const result = clickResultRaw as {
              success: boolean;
              buttonText?: string;
              candidateName?: string;
              candidateId?: string;
              candidateAge?: string;
              candidateEducation?: string;
              candidatePosition?: string;
              candidateExpectedLocation?: string;
              candidateExpectedSalary?: string;
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
            const successCandidateName = result.candidateName || `候选人${candidateIndex}`;
            results.push({
              candidateName: successCandidateName,
              candidateId: result.candidateId,
              success: true,
              message: `成功点击${result.buttonText || "打招呼按钮"}`,
              timestamp: new Date().toISOString(),
            });

            // 记录 CANDIDATE_CONTACTED 事件（主动打招呼）
            recordCandidateContactedEvent({
              platform: SourcePlatform.ZHIPIN,
              candidate: {
                name: successCandidateName,
                age: result.candidateAge,
                education: result.candidateEducation,
                position: result.candidatePosition,
                expectedLocation: result.candidateExpectedLocation,
                expectedSalary: result.candidateExpectedSalary,
              },
            }).catch((err) => {
              console.warn("[ZhipinSayHello] Failed to record candidate_contacted event:", err);
            });

            // 等待系统处理和发送消息
            await randomDelay(1000, 1500);

            // 等待下一个候选人
            if (i < candidateIndices.length - 1) {
              await randomDelay(delayBetweenClicksMin, delayBetweenClicksMax);

              // 偶尔添加更长的延迟（模拟人类行为）
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
          mcpBackend,
        };
      } catch (error) {
        const mcpBackend = USE_PLAYWRIGHT_MCP ? "playwright" : "puppeteer";
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error occurred",
          message: "点击打招呼按钮时发生错误",
          mcpBackend,
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
