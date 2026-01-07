import { tool } from "ai";
import { z } from 'zod/v3';
import { getPuppeteerMCPClient, getPlaywrightMCPClient } from "@/lib/mcp/client-manager";
import { getAdaptiveSelectors, generateFindElementScript } from "./dynamic-selector-utils";
import {
  wrapAntiDetectionScript,
  clickWithMouseTrajectory,
  performRandomScroll,
} from "../zhipin/anti-detection-utils";
import {
  selectYupaoTab,
  parsePlaywrightResult,
  wrapPlaywrightScript,
  type TabSelectionResult,
} from "@/lib/tools/shared/playwright-utils";

// Feature flag: 使用 Playwright MCP 而非 Puppeteer MCP
const USE_PLAYWRIGHT_MCP = process.env.USE_PLAYWRIGHT_MCP === "true";

export const openCandidateChatTool = tool({
  description: `打开指定候选人的聊天窗口

  功能特性：
  - 支持按候选人姓名查找并点击
  - 支持按索引点击（第N个候选人）
  - 自动检测未读状态
  - 返回详细的候选人信息
  - 使用防检测机制和鼠标轨迹模拟
  ${USE_PLAYWRIGHT_MCP ? "- [Playwright] 支持自动切换到鱼泡标签页" : ""}
  `,

  inputSchema: z.object({
    candidateName: z.string().optional().describe("要打开的候选人姓名（支持部分匹配）"),

    index: z.number().optional().describe("要打开的候选人索引（0开始，如果不指定姓名）"),

    preferUnread: z.boolean().optional().default(true).describe("是否优先选择有未读消息的候选人"),

    listOnly: z.boolean().optional().default(false).describe("仅列出候选人，不执行点击操作"),

    autoSwitchTab: z
      .boolean()
      .optional()
      .default(true)
      .describe("是否自动切换到鱼泡标签页（仅 Playwright 模式有效）"),
  }),

  execute: async ({ candidateName, index, preferUnread = true, listOnly = false, autoSwitchTab = true }) => {
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

      // 创建脚本
      const script = `
          ${generateFindElementScript()}
          
          const candidateName = ${candidateName ? `'${candidateName}'` : "null"};
          const targetIndex = ${index !== undefined ? index : "null"};
          const preferUnread = ${preferUnread};
          const listOnly = ${listOnly};
          
          // 动态选择器定义
          const convItemSelectors = ${JSON.stringify(getAdaptiveSelectors("convItem"))};
          const nameSelectors = ${JSON.stringify(getAdaptiveSelectors("candidateName"))};
          const jobTitleSelectors = ${JSON.stringify(getAdaptiveSelectors("jobTitle"))};
          const unreadNumSelectors = ${JSON.stringify(getAdaptiveSelectors("unreadNum"))};
          const statusSelectors = ${JSON.stringify(getAdaptiveSelectors("statusUnread"))};
          const timeSelectors = ${JSON.stringify(getAdaptiveSelectors("messageTime"))};
          const msgSelectors = ${JSON.stringify(getAdaptiveSelectors("msgText"))};
          
          // 使用第一个成功的选择器获取所有对话项
          let convItems = [];
          for (const selector of convItemSelectors) {
            try {
              const items = document.querySelectorAll(selector);
              if (items.length > 0) {
                convItems = items;
                break;
              }
            } catch (e) {
              // 继续尝试下一个选择器
            }
          }
          
          const candidates = [];
          
          // 处理每个对话项
          convItems.forEach((item, idx) => {
            try {
              // 查找名字元素
              const nameElement = findElement(item, nameSelectors);
              const name = nameElement ? nameElement.textContent.trim() : '';
              
              if (!name) return;
              
              // 获取职位信息
              const positionElement = findElement(item, jobTitleSelectors);
              const position = positionElement ? positionElement.textContent.trim() : '';
              
              // 检查未读状态 - 只看未读数字标签
              const unreadNumElement = findElement(item, unreadNumSelectors);
              let hasUnread = false;
              let unreadCount = 0;
              
              if (unreadNumElement) {
                const unreadText = unreadNumElement.textContent?.trim();
                if (unreadText) {
                  unreadCount = parseInt(unreadText, 10) || 0;
                  hasUnread = unreadCount > 0;
                }
              }
              
              // 获取时间
              const timeElement = findElement(item, timeSelectors);
              const lastMessageTime = timeElement ? timeElement.textContent.trim() : '';
              
              // 获取最新消息
              const msgElement = findElement(item, msgSelectors);
              const messagePreview = msgElement ? msgElement.textContent.trim().substring(0, 50) : '';
              
              // 获取消息状态
              const statusElement = findElement(item, statusSelectors);
              const messageStatus = statusElement ? statusElement.textContent.trim() : '';
              
              candidates.push({
                name: name,
                position: position,
                index: idx,
                hasUnread: hasUnread,
                unreadCount: unreadCount,
                lastMessageTime: lastMessageTime,
                messagePreview: messagePreview,
                messageStatus: messageStatus
              });
            } catch (err) {
              // 静默处理错误
            }
          });
          
          // 如果只是列出候选人
          if (listOnly) {
            return {
              success: true,
              action: 'list',
              candidates: candidates.map(c => ({
                name: c.name,
                position: c.position,
                index: c.index,
                hasUnread: c.hasUnread,
                unreadCount: c.unreadCount,
                lastMessageTime: c.lastMessageTime,
                messagePreview: c.messagePreview,
                messageStatus: c.messageStatus
              })),
              totalCount: candidates.length
            };
          }
          
          // 查找目标候选人
          let targetCandidate = null;
          
          if (candidateName) {
            // 1. 优先尝试完全匹配
            targetCandidate = candidates.find(c => c.name === candidateName);

            // 2. 如果没找到，尝试包含匹配
            if (!targetCandidate) {
              targetCandidate = candidates.find(c => 
                c.name.includes(candidateName) || candidateName.includes(c.name)
              );
            }
            
            // 3. 如果没找到完全匹配，尝试模糊匹配 (字符匹配)
            if (!targetCandidate) {
              targetCandidate = candidates.find(c => {
                const nameChars = candidateName.split('');
                return nameChars.every(char => c.name.includes(char));
              });
            }
          } else if (targetIndex !== null) {
            // 按索引查找
            if (preferUnread) {
              // 只考虑未读的
              const unreadCandidates = candidates.filter(c => c.hasUnread);
              targetCandidate = unreadCandidates[targetIndex];
            } else {
              targetCandidate = candidates[targetIndex];
            }
          } else if (preferUnread) {
            // 默认选择第一个未读的
            targetCandidate = candidates.find(c => c.hasUnread);
          }
          
          // 执行点击 - 返回选择器信息而不是直接点击
          if (targetCandidate) {
            // 查找目标元素并返回选择器
            // 使用同样的动态选择器重新获取元素
            let items = [];
            let usedSelector = '';
            for (const selector of convItemSelectors) {
              try {
                const foundItems = document.querySelectorAll(selector);
                if (foundItems.length > 0) {
                  items = foundItems;
                  usedSelector = selector;
                  break;
                }
              } catch (e) {
                // 继续尝试下一个选择器
              }
            }
            
            // 方案1：通过名称匹配
            for (let i = 0; i < items.length; i++) {
              const item = items[i];
              const nameEl = findElement(item, nameSelectors);
              if (nameEl && nameEl.textContent.trim() === targetCandidate.name) {
                return {
                  success: true,
                  action: 'found',
                  clickTarget: {
                    selector: usedSelector,
                    index: i,
                    name: targetCandidate.name
                  },
                  candidateInfo: {
                    name: targetCandidate.name,
                    position: targetCandidate.position,
                    index: targetCandidate.index,
                    hasUnread: targetCandidate.hasUnread,
                    unreadCount: targetCandidate.unreadCount,
                    lastMessageTime: targetCandidate.lastMessageTime,
                    messagePreview: targetCandidate.messagePreview,
                    messageStatus: targetCandidate.messageStatus
                  },
                  totalCandidates: candidates.length
                };
              }
            }
            
            // 方案2：如果名称匹配失败，使用索引
            if (items[targetCandidate.index]) {
              return {
                success: true,
                action: 'found',
                clickTarget: {
                  selector: usedSelector,
                  index: targetCandidate.index,
                  name: targetCandidate.name
                },
                candidateInfo: {
                  name: targetCandidate.name,
                  position: targetCandidate.position,
                  index: targetCandidate.index,
                  hasUnread: targetCandidate.hasUnread,
                  unreadCount: targetCandidate.unreadCount,
                  lastMessageTime: targetCandidate.lastMessageTime,
                  messagePreview: targetCandidate.messagePreview,
                  messageStatus: targetCandidate.messageStatus
                },
                totalCandidates: candidates.length,
                byIndex: true
              };
            }
            
            return {
              success: false,
              error: 'Failed to click on candidate',
              targetCandidate: targetCandidate
            };
          } else {
            // 没找到目标，返回候选人列表供参考
            return {
              success: false,
              action: 'not_found',
              candidates: candidates.map(c => ({
                name: c.name,
                position: c.position,
                index: c.index,
                hasUnread: c.hasUnread,
                unreadCount: c.unreadCount
              })),
              totalCandidates: candidates.length,
              message: candidateName ? 
                '未找到候选人: ' + candidateName :
                '未找到符合条件的候选人'
            };
          }
      `;

      // 根据 MCP 类型生成不同的脚本包装
      const wrappedScript = USE_PLAYWRIGHT_MCP
        ? wrapPlaywrightScript(script)
        : wrapAntiDetectionScript(script);

      // 执行脚本
      const tools = await client.tools();
      const toolName = USE_PLAYWRIGHT_MCP ? "browser_evaluate" : "puppeteer_evaluate";

      if (!tools[toolName]) {
        throw new Error(
          `MCP tool ${toolName} not available. ${
            USE_PLAYWRIGHT_MCP
              ? "请确保 Playwright MCP 正在运行且已连接浏览器。"
              : "请确保 Puppeteer MCP 正在运行。"
          }`
        );
      }

      const mcpTool = tools[toolName];
      const executeParams = USE_PLAYWRIGHT_MCP ? { function: wrappedScript } : { script: wrappedScript };
      const result = await mcpTool.execute(executeParams);

      // 根据 MCP 类型解析结果
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let parsedResult: any = null;

      if (USE_PLAYWRIGHT_MCP) {
        // Playwright MCP 结果解析
        parsedResult = parsePlaywrightResult(result);
      } else {
        // Puppeteer MCP 结果解析
        const mcpResult = result as { content?: Array<{ text?: string }> };
        if (mcpResult?.content?.[0]?.text) {
          const resultText = mcpResult.content[0].text;

          try {
            const executionMatch = resultText.match(
              /Execution result:\s*\n([\s\S]*?)(\n\nConsole output|$)/
            );

            if (executionMatch && executionMatch[1].trim() !== "undefined") {
              const jsonResult = executionMatch[1].trim();
              parsedResult = JSON.parse(jsonResult);
            }
          } catch (e) {
            console.error("Failed to parse result:", e);
            return {
              success: false,
              error: "Failed to parse script result",
              rawResult: resultText,
              mcpBackend,
            };
          }
        }
      }

      if (!parsedResult) {
        return {
          success: false,
          error: "Script execution returned undefined",
          mcpBackend,
        };
      }

      // 如果找到了点击目标，使用更可靠的方法执行点击
      if (
        parsedResult.success &&
        parsedResult.action === "found" &&
        parsedResult.clickTarget
      ) {
        const { selector, index, name } = parsedResult.clickTarget;

        try {
          // 添加随机延迟模拟人类行为
          const delay = 50 + Math.random() * 100;
          await new Promise(resolve => setTimeout(resolve, delay));

          // 在点击前执行随机滚动 (仅 Puppeteer 模式)
          if (!USE_PLAYWRIGHT_MCP) {
            await performRandomScroll(client, {
              minDistance: 20,
              maxDistance: 80,
              probability: 0.3,
              direction: "both",
            });
          }

          // 标记和点击脚本
          const markScriptContent = `
            ${generateFindElementScript()}

            const nameSelectors = ${JSON.stringify(getAdaptiveSelectors("candidateName"))};

            const items = document.querySelectorAll('${selector}');
            if (items[${index}]) {
              // 先清理可能存在的旧标记
              document.querySelectorAll('[data-temp-click-target]').forEach(el => {
                el.removeAttribute('data-temp-click-target');
              });

              // 标记目标元素
              items[${index}].setAttribute('data-temp-click-target', 'true');

              // 验证标记的元素确实是我们要的候选人
              const nameEl = findElement(items[${index}], nameSelectors);
              const actualName = nameEl ? nameEl.textContent.trim() : '';

              return {
                success: true,
                marked: true,
                actualName: actualName,
                expectedName: '${name}',
                nameMatch: actualName === '${name}'
              };
            }
            return { success: false, error: '无法找到目标元素' };
          `;

          const markScript = USE_PLAYWRIGHT_MCP
            ? wrapPlaywrightScript(markScriptContent)
            : wrapAntiDetectionScript(markScriptContent);

          const markExecuteParams = USE_PLAYWRIGHT_MCP
            ? { function: markScript }
            : { script: markScript };
          const markResult = await mcpTool.execute(markExecuteParams);

          const markData = USE_PLAYWRIGHT_MCP
            ? parsePlaywrightResult(markResult)
            : parseEvaluateResult(markResult);

          if (
            markData &&
            typeof markData === "object" &&
            "success" in markData &&
            markData.success
          ) {
            // 使用临时属性选择器点击
            const tempSelector = `${selector}[data-temp-click-target="true"]`;

            if (USE_PLAYWRIGHT_MCP) {
              // Playwright: 使用 browser_evaluate 执行点击
              // 注意: browser_click 需要 accessibility ref，不支持 CSS 选择器
              const clickScript = wrapPlaywrightScript(`
                const el = document.querySelector('${tempSelector}');
                if (el) {
                  el.click();
                  return { success: true, clicked: true, selector: '${tempSelector}' };
                }
                return { success: false, error: '元素未找到', selector: '${tempSelector}' };
              `);
              const clickResult = await mcpTool.execute({ function: clickScript });
              const parsedClickResult = parsePlaywrightResult(clickResult);

              // 检查点击是否成功
              if (parsedClickResult && typeof parsedClickResult === 'object' && 'success' in parsedClickResult) {
                if (!parsedClickResult.success) {
                  console.error(`[${mcpBackend}] 点击失败:`, parsedClickResult);
                  return {
                    success: false,
                    error: "点击元素失败",
                    details: parsedClickResult,
                    candidateInfo: parsedResult.candidateInfo,
                    mcpBackend,
                  };
                }
              }
            } else {
              // Puppeteer: 使用带鼠标轨迹的点击
              await clickWithMouseTrajectory(client, tempSelector, {
                preClickDelay: 200,
                moveSteps: 18,
              });
            }

            // 清理临时属性
            const cleanupScriptContent = `
              const el = document.querySelector('[data-temp-click-target]');
              if (el) el.removeAttribute('data-temp-click-target');
              return { cleaned: true };
            `;
            const cleanupScript = USE_PLAYWRIGHT_MCP
              ? wrapPlaywrightScript(cleanupScriptContent)
              : wrapAntiDetectionScript(cleanupScriptContent);
            const cleanupParams = USE_PLAYWRIGHT_MCP
              ? { function: cleanupScript }
              : { script: cleanupScript };
            await mcpTool.execute(cleanupParams);

            return {
              success: true,
              action: "clicked",
              clickedCandidate: parsedResult.candidateInfo,
              totalCandidates: parsedResult.totalCandidates,
              message:
                "成功点击候选人" +
                (parsedResult.byIndex ? "（通过索引）" : "") +
                ": " +
                parsedResult.candidateInfo.name,
              mcpBackend,
            };
          } else {
            return {
              success: false,
              error: "无法标记目标元素",
              details: markData,
              candidateInfo: parsedResult.candidateInfo,
              mcpBackend,
            };
          }
        } catch (clickError) {
          console.error("Failed to click candidate:", clickError);
          return {
            success: false,
            error: "点击操作失败",
            details: clickError instanceof Error ? clickError.message : "未知错误",
            candidateInfo: parsedResult.candidateInfo,
            mcpBackend,
          };
        }
      }

      return { ...parsedResult, mcpBackend };
    } catch (error) {
      console.error("Failed to open candidate chat:", error);
      const mcpBackend = USE_PLAYWRIGHT_MCP ? "playwright" : "puppeteer";
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: "打开候选人聊天失败",
        mcpBackend,
      };
    }
  },
});

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

// 导出工具
export const OPEN_CANDIDATE_CHAT_ACTION = "open_candidate_chat";
