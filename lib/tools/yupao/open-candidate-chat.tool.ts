import { tool } from "ai";
import { z } from "zod";
import { YUPAO_UNREAD_SELECTORS } from "./constants";
import { getPuppeteerMCPClient } from "@/lib/mcp/client-manager";
import { wrapAntiDetectionScript, clickWithMouseTrajectory, performRandomScroll } from "../zhipin/anti-detection-utils";

export const openCandidateChatTool = tool({
  description: `打开指定候选人的聊天窗口
  
  功能特性：
  - 支持按候选人姓名查找并点击
  - 支持按索引点击（第N个候选人）
  - 自动检测未读状态
  - 返回详细的候选人信息
  - 使用防检测机制和鼠标轨迹模拟
  `,

  parameters: z.object({
    candidateName: z.string().optional().describe("要打开的候选人姓名（支持部分匹配）"),

    index: z.number().optional().describe("要打开的候选人索引（0开始，如果不指定姓名）"),

    preferUnread: z.boolean().optional().default(true).describe("是否优先选择有未读消息的候选人"),

    listOnly: z.boolean().optional().default(false).describe("仅列出候选人，不执行点击操作"),
  }),

  execute: async ({ candidateName, index, preferUnread = true, listOnly = false }) => {
    try {
      const client = await getPuppeteerMCPClient();

      // 创建脚本
      const script = `
          const candidateName = ${candidateName ? `'${candidateName}'` : "null"};
          const targetIndex = ${index !== undefined ? index : "null"};
          const preferUnread = ${preferUnread};
          const listOnly = ${listOnly};
          
          // 获取所有对话项
          const convItems = document.querySelectorAll('${YUPAO_UNREAD_SELECTORS.convItem}');
          const candidates = [];
          
          // 处理每个对话项
          convItems.forEach((item, idx) => {
            try {
              // 查找名字元素
              const nameElement = item.querySelector('${YUPAO_UNREAD_SELECTORS.candidateName}');
              const name = nameElement ? nameElement.textContent.trim() : '';
              
              if (!name) return;
              
              // 获取职位信息
              const positionElement = item.querySelector('${YUPAO_UNREAD_SELECTORS.jobTitle}');
              const position = positionElement ? positionElement.textContent.trim() : '';
              
              // 检查未读状态 - 只看未读数字标签
              const unreadNumElement = item.querySelector('${YUPAO_UNREAD_SELECTORS.imageBox} ${YUPAO_UNREAD_SELECTORS.unreadNum}');
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
              const timeElement = item.querySelector('${YUPAO_UNREAD_SELECTORS.messageTime}');
              const lastMessageTime = timeElement ? timeElement.textContent.trim() : '';
              
              // 获取最新消息
              const msgElement = item.querySelector('${YUPAO_UNREAD_SELECTORS.msgText}');
              const messagePreview = msgElement ? msgElement.textContent.trim().substring(0, 50) : '';
              
              // 获取消息状态
              const statusElement = item.querySelector('${YUPAO_UNREAD_SELECTORS.statusUnread}');
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
            // 按名字查找
            targetCandidate = candidates.find(c => 
              c.name.includes(candidateName) || candidateName.includes(c.name)
            );
            
            // 如果没找到完全匹配，尝试模糊匹配
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
            const items = document.querySelectorAll('${YUPAO_UNREAD_SELECTORS.convItem}');
            
            // 方案1：通过名称匹配
            for (let i = 0; i < items.length; i++) {
              const item = items[i];
              const nameEl = item.querySelector('${YUPAO_UNREAD_SELECTORS.candidateName}');
              if (nameEl && nameEl.textContent.trim() === targetCandidate.name) {
                return {
                  success: true,
                  action: 'found',
                  clickTarget: {
                    selector: '${YUPAO_UNREAD_SELECTORS.convItem}',
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
                  selector: '${YUPAO_UNREAD_SELECTORS.convItem}',
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

      // 使用防检测包装
      const wrappedScript = wrapAntiDetectionScript(script);

      // 执行脚本
      const tools = await client.tools();
      const toolName = "puppeteer_evaluate";

      if (!tools[toolName]) {
        throw new Error(`MCP tool ${toolName} not available`);
      }

      const tool = tools[toolName];
      const result = await tool.execute({ script: wrappedScript });

      // 解析结果
      const mcpResult = result as { content?: Array<{ text?: string }> };
      if (mcpResult?.content?.[0]?.text) {
        const resultText = mcpResult.content[0].text;

        try {
          // 尝试从 "Execution result:" 后面提取实际结果
          const executionMatch = resultText.match(
            /Execution result:\s*\n([\s\S]*?)(\n\nConsole output|$)/
          );

          if (executionMatch && executionMatch[1].trim() !== "undefined") {
            const jsonResult = executionMatch[1].trim();
            const parsedResult = JSON.parse(jsonResult);
            
            // 如果找到了点击目标，使用更可靠的方法执行点击
            if (parsedResult.success && parsedResult.action === 'found' && parsedResult.clickTarget) {
              const { selector, index, name } = parsedResult.clickTarget;
              
              try {
                // 添加随机延迟模拟人类行为
                const delay = 50 + Math.random() * 100;
                await new Promise(resolve => setTimeout(resolve, delay));
                
                // 在点击前执行随机滚动
                await performRandomScroll(client, {
                  minDistance: 20,
                  maxDistance: 80,
                  probability: 0.3,
                  direction: 'both'
                });
                
                // 使用临时属性标记目标元素，避免选择器问题
                const markScript = wrapAntiDetectionScript(`
                  const items = document.querySelectorAll('${selector}');
                  if (items[${index}]) {
                    // 先清理可能存在的旧标记
                    document.querySelectorAll('[data-temp-click-target]').forEach(el => {
                      el.removeAttribute('data-temp-click-target');
                    });
                    
                    // 标记目标元素
                    items[${index}].setAttribute('data-temp-click-target', 'true');
                    
                    // 验证标记的元素确实是我们要的候选人
                    const nameEl = items[${index}].querySelector('${YUPAO_UNREAD_SELECTORS.candidateName}');
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
                `);
                
                const markResult = await tools.puppeteer_evaluate.execute({ script: markScript });
                const markData = parseEvaluateResult(markResult);
                
                if (markData && typeof markData === 'object' && 'success' in markData && markData.success) {
                  // 使用临时属性选择器点击
                  const tempSelector = `${selector}[data-temp-click-target="true"]`;
                  
                  // 使用带鼠标轨迹的点击
                  await clickWithMouseTrajectory(client, tempSelector, {
                    preClickDelay: 200,
                    moveSteps: 18
                  });
                  
                  // 清理临时属性
                  const cleanupScript = wrapAntiDetectionScript(`
                    const el = document.querySelector('[data-temp-click-target]');
                    if (el) el.removeAttribute('data-temp-click-target');
                  `);
                  await tools.puppeteer_evaluate.execute({ script: cleanupScript });
                  
                  return {
                    success: true,
                    action: 'clicked',
                    clickedCandidate: parsedResult.candidateInfo,
                    totalCandidates: parsedResult.totalCandidates,
                    message: '成功点击候选人' + (parsedResult.byIndex ? '（通过索引）' : '') + ': ' + parsedResult.candidateInfo.name
                  };
                } else {
                  return {
                    success: false,
                    error: '无法标记目标元素',
                    details: markData,
                    candidateInfo: parsedResult.candidateInfo
                  };
                }
              } catch (clickError) {
                return {
                  success: false,
                  error: '点击操作失败',
                  details: clickError instanceof Error ? clickError.message : '未知错误',
                  candidateInfo: parsedResult.candidateInfo
                };
              }
            }
            
            return parsedResult;
          }

          // 如果执行结果是 undefined，可能是脚本执行有问题
          console.error("Script execution returned undefined");
          return {
            success: false,
            error: "Script execution returned undefined",
            rawResult: resultText,
          };
        } catch (e) {
          console.error("Failed to parse result:", e);
          return {
            success: false,
            error: "Failed to parse script result",
            rawResult: resultText,
          };
        }
      }

      return {
        success: false,
        error: "Unexpected result format",
        rawResult: result,
      };
    } catch (error) {
      console.error("Failed to open candidate chat:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: "打开候选人聊天失败",
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