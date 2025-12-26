import { tool } from "ai";
import { z } from 'zod/v3';
import { getPuppeteerMCPClient } from "@/lib/mcp/client-manager";
import { wrapAntiDetectionScript, randomDelay } from "./anti-detection-utils";
import type { AutomationResult } from "./types";

/**
 * 关闭按钮信息接口
 */
interface CloseButtonInfo {
  tagName: string;
  className: string;
  hasParentClose: boolean;
}

/**
 * Boss直聘关闭简历详情弹窗工具
 *
 * 功能：
 * - 关闭当前打开的候选人简历详情弹窗
 * - 支持iframe和非iframe两种场景
 * - 自动检测弹窗是否存在
 *
 * 使用场景：
 * - 查看完候选人简历后关闭弹窗
 * - 批量查看简历时关闭当前弹窗以查看下一个
 * - 清理页面状态
 */
export const zhipinCloseResumeDetailTool = () =>
  tool({
    description: `Boss直聘关闭简历详情弹窗功能
    
    功能：
    - 关闭当前打开的简历详情弹窗
    - 支持iframe内的弹窗关闭
    - 自动检测弹窗状态
    
    使用场景：
    - 查看完简历后关闭弹窗继续浏览其他候选人
    - 批量筛选候选人时的弹窗管理
    - 页面状态清理
    
    注意：
    - 需要先打开简历详情弹窗
    - 关闭后会返回到候选人列表页面`,

    inputSchema: z.object({}),

    execute: async (): Promise<AutomationResult<{ closed: boolean; message: string }>> => {
      try {
        const client = await getPuppeteerMCPClient();
        const tools = await client.tools();

        // 检查必需的工具
        if (!tools.puppeteer_evaluate) {
          throw new Error("MCP tool puppeteer_evaluate not available");
        }

        const puppeteerEvaluate = tools.puppeteer_evaluate;

        // 初始延迟
        await randomDelay(200, 400);

        // 检测并关闭弹窗
        const closeScript = wrapAntiDetectionScript(`
          let doc = document;
          let result = { found: false, inIframe: false, selector: null, elementInfo: null };
          
          // 优先使用最精确的选择器
          const closeSelectors = [
            // recommendV2版本（当前版本）
            '.boss-popup__wrapper.recommendV2 .boss-popup__close',
            '.dialog-lib-resume.recommendV2 .boss-popup__close',
            // 通用简历弹窗选择器（兼容旧版）
            '.boss-popup__wrapper.dialog-lib-resume .boss-popup__close',
            '.dialog-lib-resume .boss-popup__close',
            // 兜底选择器
            '.boss-dialog .boss-popup__close',
            '.boss-popup__close'
          ];
          
          // 检查元素是否真正可见
          function isElementVisible(el) {
            if (!el) return false;
            const rect = el.getBoundingClientRect();
            return el.offsetParent !== null && 
                   (rect.width > 0 || rect.height > 0) &&
                   el.offsetWidth > 0 && el.offsetHeight > 0;
          }
          
          // 直接检查iframe（Boss直聘的弹窗在iframe中）
          const iframe = document.querySelector('iframe[name="recommendFrame"]') || 
                        document.querySelector('iframe[src*="/web/frame/recommend"]') ||
                        document.querySelector('iframe[src*="recommend"]');
          
          if (iframe) {
            try {
              const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
              if (iframeDoc) {
                doc = iframeDoc;
                result.inIframe = true;
                
                // 在iframe中查找关闭按钮
                for (const selector of closeSelectors) {
                  const closeBtn = doc.querySelector(selector);
                  if (closeBtn && isElementVisible(closeBtn)) {
                    result.found = true;
                    result.selector = selector;
                    result.elementInfo = {
                      tagName: closeBtn.tagName,
                      className: closeBtn.className,
                      hasParentClose: !!closeBtn.closest('.boss-popup__close')
                    };
                    console.log('在iframe中找到关闭按钮: ' + selector);
                    break;
                  }
                }
              }
            } catch (e) {
              console.error('无法访问iframe:', e);
            }
          }
          
          // 如果iframe中没找到，检查主文档（备用）
          if (!result.found) {
            for (const selector of closeSelectors) {
              const closeBtn = document.querySelector(selector);
              if (closeBtn && isElementVisible(closeBtn)) {
                result.found = true;
                result.selector = selector;
                result.inIframe = false;
                result.elementInfo = {
                  tagName: closeBtn.tagName,
                  className: closeBtn.className,
                  hasParentClose: !!closeBtn.closest('.boss-popup__close')
                };
                console.log('在主文档中找到关闭按钮: ' + selector);
                break;
              }
            }
          }
          
          // 如果还没找到，检查是否有弹窗存在
          if (!result.found) {
            const dialogSelectors = [
              '.boss-popup__wrapper.recommendV2',
              '.boss-popup__wrapper.dialog-lib-resume',
              '.dialog-lib-resume'
            ];
            
            // 检查是否有弹窗但找不到关闭按钮
            for (const sel of dialogSelectors) {
              const dialog = doc.querySelector(sel);
              if (dialog && isElementVisible(dialog)) {
                result.hasDialog = true;
                result.dialogType = sel;
                console.log('找到弹窗但未找到关闭按钮: ' + sel);
                break;
              }
            }
          }
          
          return result;
        `);

        // 执行检测脚本
        const detectResult = await puppeteerEvaluate.execute({ script: closeScript });

        // 解析结果
        const result = (() => {
          try {
            const mcpResult = detectResult as { content?: Array<{ text?: string }> };
            if (mcpResult?.content?.[0]?.text) {
              const resultText = mcpResult.content[0].text;
              const executionMatch = resultText.match(
                /Execution result:\s*\n([\s\S]*?)(\n\nConsole output|$)/
              );
              if (executionMatch && executionMatch[1].trim() !== "undefined") {
                return JSON.parse(executionMatch[1].trim());
              }
            }
          } catch (e) {
            console.error("Failed to parse detect result:", e);
          }
          return { found: false };
        })() as {
          found: boolean;
          inIframe: boolean;
          selector: string;
          hasDialog?: boolean;
          dialogType?: string;
          elementInfo?: CloseButtonInfo;
        };

        if (!result.found) {
          if (result.hasDialog) {
            return {
              success: false,
              error: `找到简历弹窗(${result.dialogType})但未找到关闭按钮，可能页面结构已变化`,
            };
          }
          return {
            success: false,
            error: "未找到打开的简历详情弹窗",
          };
        }

        // 点击关闭按钮
        try {
          // 如果在iframe中，需要特殊处理
          if (result.inIframe) {
            // 使用evaluate在iframe中点击，增加滚动和智能点击
            const clickScript = wrapAntiDetectionScript(`
              const iframe = document.querySelector('iframe[name="recommendFrame"]') || 
                          document.querySelector('iframe[src*="/web/frame/recommend"]') ||
                          document.querySelector('iframe[src*="recommend"]');
              if (iframe) {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                if (iframeDoc) {
                  const closeBtn = iframeDoc.querySelector('${result.selector}');
                  if (closeBtn) {
                    // 滚动到可视区域
                    closeBtn.scrollIntoView({ behavior: 'auto', block: 'center' });
                    
                    // 智能选择点击目标：优先父容器
                    const target = closeBtn.closest('.boss-popup__close') || closeBtn;
                    
                    // 触发点击
                    target.click();
                    
                    // 备用：分发点击事件
                    const clickEvent = new MouseEvent('click', {
                      bubbles: true,
                      cancelable: true,
                      view: iframeDoc.defaultView
                    });
                    target.dispatchEvent(clickEvent);
                    
                    return true;
                  }
                }
              }
              return false;
            `);

            await puppeteerEvaluate.execute({ script: clickScript });
          } else {
            // 主文档中的点击（很少见，但保留作为备用）
            await puppeteerEvaluate.execute({
              script: wrapAntiDetectionScript(`
                const closeBtn = document.querySelector('${result.selector}');
                if (closeBtn) {
                  closeBtn.scrollIntoView({ behavior: 'auto', block: 'center' });
                  const target = closeBtn.closest('.boss-popup__close') || closeBtn;
                  target.click();
                  return true;
                }
                return false;
              `),
            });
          }

          // 等待初始动画
          await randomDelay(200, 300);

          // 轮询验证弹窗是否已关闭
          let isClosed = false;
          const maxRetries = 5;
          const retryDelay = 300;

          for (let retry = 0; retry < maxRetries; retry++) {
            const verifyScript = wrapAntiDetectionScript(`
              function isDialogClosed() {
                // 检查元素是否真正可见
                function isElementVisible(el) {
                  if (!el) return false;
                  return el.offsetWidth > 0 || el.offsetHeight > 0;
                }
                
                let doc = document;
                
                // 检查弹窗选择器
                const dialogSelectors = [
                  '.boss-popup__wrapper.recommendV2',
                  '.boss-popup__wrapper.dialog-lib-resume',
                  '.dialog-lib-resume'
                ];
                
                // 优先检查iframe（Boss直聘弹窗通常在iframe中）
                const iframe = document.querySelector('iframe[name="recommendFrame"]') || 
                            document.querySelector('iframe[src*="/web/frame/recommend"]');
                
                if (iframe) {
                  try {
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                    if (iframeDoc) {
                      for (const sel of dialogSelectors) {
                        const dialog = iframeDoc.querySelector(sel);
                        if (dialog && isElementVisible(dialog)) {
                          return false; // 弹窗仍然可见
                        }
                      }
                    }
                  } catch (e) {}
                }
                
                // 备用：检查主文档
                for (const sel of dialogSelectors) {
                  const dialog = document.querySelector(sel);
                  if (dialog && isElementVisible(dialog)) {
                    return false; // 弹窗仍然可见
                  }
                }
                
                return true; // 弹窗已关闭
              }
              
              return isDialogClosed();
            `);

            const verifyResult = await puppeteerEvaluate.execute({ script: verifyScript });
            const closed = (() => {
              try {
                const mcpResult = verifyResult as { content?: Array<{ text?: string }> };
                if (mcpResult?.content?.[0]?.text) {
                  const resultText = mcpResult.content[0].text;
                  const executionMatch = resultText.match(
                    /Execution result:\s*\n([\s\S]*?)(\n\nConsole output|$)/
                  );
                  if (executionMatch) {
                    return executionMatch[1].trim() === "true";
                  }
                }
              } catch (e) {
                console.error("Failed to parse verify result:", e);
              }
              return false;
            })();

            if (closed) {
              isClosed = true;
              break;
            }

            // 如果还没关闭，等待后重试
            if (retry < maxRetries - 1) {
              await randomDelay(retryDelay, retryDelay + 100);
            }
          }

          if (isClosed) {
            return {
              success: true,
              data: {
                closed: true,
                message: "简历详情弹窗已成功关闭",
              },
            };
          } else {
            return {
              success: true,
              data: {
                closed: false,
                message: "已尝试关闭弹窗，但弹窗可能还在关闭动画中",
              },
            };
          }
        } catch (clickError) {
          return {
            success: false,
            error: `点击关闭按钮失败: ${clickError instanceof Error ? clickError.message : "Unknown error"}`,
          };
        }
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
export const createZhipinCloseResumeDetailTool = zhipinCloseResumeDetailTool;

// 导出工具
export const ZHIPIN_CLOSE_RESUME_DETAIL_ACTION = "zhipin_close_resume_detail";
