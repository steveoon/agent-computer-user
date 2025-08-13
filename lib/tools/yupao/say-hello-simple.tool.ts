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
  shouldAddRandomBehavior
} from "../zhipin/anti-detection-utils";
import { createDynamicClassSelector } from "./dynamic-selector-utils";
import type { YupaoSayHelloResult } from "./types";

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
      scrollBehavior: z
        .boolean()
        .optional()
        .default(true)
        .describe("是否启用随机滚动行为"),
    }),
    
    execute: async ({
      candidateIndices,
      delayBetweenClicksMin = 2000,
      delayBetweenClicksMax = 4000,
      scrollBehavior = true
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
                direction: 'down',
                probability: 0.5
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
              
              // 获取候选人姓名（可选）
              let candidateName = '候选人';
              const nameEl = card.querySelector('[class*="_name_"]:not([class*="_nameR_"])');
              if (nameEl) {
                candidateName = nameEl.textContent?.trim() || candidateName;
              }
              
              // 标记按钮
              btn.setAttribute('data-say-hello-target', 'true');
              return { 
                success: true, 
                buttonText: btn.textContent?.trim(),
                candidateName: candidateName
              };
            `);
            
            const markResult = await puppeteerEvaluate.execute({ script: markScript });
            const marked = parseEvaluateResult(markResult) as { 
              success: boolean; 
              buttonText?: string;
              candidateName?: string;
              error?: string;
            } | null;
            
            if (!marked?.success) {
              results.push({
                candidateName: `候选人${candidateIndex}`,
                success: false,
                error: marked?.error || "未找到聊天按钮",
                timestamp: new Date().toISOString()
              });
              continue;
            }
            
            // 使用鼠标轨迹点击
            await clickWithMouseTrajectory(client, '[data-say-hello-target="true"]', {
              preClickDelay: 200,
              moveSteps: 15
            });
            
            // 清理标记
            await puppeteerEvaluate.execute({
              script: wrapAntiDetectionScript(`
                const btn = document.querySelector('[data-say-hello-target="true"]');
                if (btn) btn.removeAttribute('data-say-hello-target');
              `)
            });
            
            results.push({
              candidateName: marked.candidateName || `候选人${candidateIndex}`,
              success: true,
              message: `成功点击${marked.buttonText || '聊天按钮'}`,
              timestamp: new Date().toISOString()
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
              timestamp: new Date().toISOString()
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
              failed: failCount
            }
          }
        };
        
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error occurred",
          message: "点击打招呼按钮时发生错误"
        };
      }
    }
  });

/**
 * 快捷创建函数
 */
export const createYupaoSayHelloSimpleTool = yupaoSayHelloSimpleTool;

// 导出工具
export const SAY_HELLO_SIMPLE_ACTION = "say_hello_simple";