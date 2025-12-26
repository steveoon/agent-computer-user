import { tool } from "ai";
import { z } from 'zod/v3';
import { getPuppeteerMCPClient } from "@/lib/mcp/client-manager";
import { wrapAntiDetectionScript, randomDelay } from "./anti-detection-utils";
import type { AutomationResult } from "./types";

/**
 * 序列化的 DOMRect 信息
 */
interface SerializedRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Canvas 调试信息
 */
interface CanvasDebugInfo {
  canvasRect: SerializedRect;
  secondIframeRect: SerializedRect;
  firstIframeRect: SerializedRect;
}

/**
 * Canvas位置信息类型
 */
export interface CanvasPositionInfo {
  // 用于截图的绝对坐标（重要：这是截图时应该使用的坐标）
  screenshotArea: {
    x: number; // 左边距（相对于浏览器窗口）
    y: number; // 上边距（相对于浏览器窗口）
    width: number; // 截图宽度
    height: number; // 截图高度
  };
  // Canvas原始信息
  canvasInfo: {
    width: number; // Canvas内部宽度
    height: number; // Canvas内部高度
    clientWidth: number; // Canvas显示宽度
    clientHeight: number; // Canvas显示高度
  };
  // 调试用的详细定位信息
  debugInfo?: CanvasDebugInfo;
  markerAdded: boolean;
  note: string;
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
 * Boss直聘简历Canvas定位工具
 *
 * 功能：
 * - 定位简历弹窗中的Canvas元素
 * - 计算Canvas在页面中的绝对位置
 * - 支持添加可视化标记帮助定位
 * - 处理嵌套iframe结构
 *
 * 技术原理：
 * - 外层页面: Boss直聘推荐页面 (https://www.zhipin.com/web/chat/recommend)
 *   └── 第一层iframe: 推荐页面框架 (https://www.zhipin.com/web/frame/recommend/)
 *       └── 简历弹窗: div.boss-popup__wrapper.boss-dialog.dialog-lib-resume.recommendV2
 *           └── 第二层iframe: 简历渲染容器 (https://www.zhipin.com/web/frame/c-resume/)
 *               └── 目标结构: div#resume > canvas#resume
 */
export const zhipinLocateResumeCanvasTool = () =>
  tool({
    description: `Boss直聘简历Canvas定位工具
    
    功能：
    - 定位简历弹窗中的Canvas元素
    - 计算Canvas在页面中的绝对位置
    - 在Canvas位置添加红色边框标记
    - 仅计算 Canvas 的位置与尺寸（不做截图与AI解析）
    
    返回值说明：
    - screenshotArea: 用于截图的坐标（x, y, width, height）
    - canvasInfo: Canvas的原始尺寸信息
    - debugInfo: 调试用的详细定位信息
    - markerAdded: 是否已在页面上标记了Canvas区域
    - note: 提示信息
    
    使用方法：
    1. 先使用 zhipin_open_resume 工具打开简历弹窗
    2. 调用此工具获取 Canvas 的位置与尺寸坐标
    
    注意：
    - 仅负责定位，不进行截图与AI解析
    - Canvas元素位于嵌套iframe中，工具已处理多层 iframe 定位`,

    inputSchema: z.object({
      addMarker: z.boolean().optional().default(true).describe("是否添加红色边框标记Canvas位置"),
      markerColor: z
        .string()
        .optional()
        .default("transparent")
        .describe("标记的背景颜色（默认透明，避免遮挡内容）"),
      markerBorderWidth: z.number().optional().default(2).describe("标记边框宽度（像素）"),
      clearExistingMarkers: z.boolean().optional().default(true).describe("是否清除已存在的标记"),
    }),

    execute: async ({
      addMarker = true,
      markerColor = "transparent", // 默认透明，避免遮挡
      markerBorderWidth = 2,
      clearExistingMarkers = true,
    }): Promise<AutomationResult<CanvasPositionInfo>> => {
      try {
        const client = await getPuppeteerMCPClient();
        const tools = await client.tools();

        // 检查必需的工具
        if (!tools.puppeteer_evaluate) {
          throw new Error("Required MCP tool puppeteer_evaluate not available");
        }

        const puppeteerEvaluate = tools.puppeteer_evaluate;

        // 初始延迟
        await randomDelay(300, 500);

        // 如果需要清除已存在的标记
        if (clearExistingMarkers) {
          const clearScript = wrapAntiDetectionScript(`
            const existingMarkers = document.querySelectorAll('#canvas-position-marker');
            existingMarkers.forEach(marker => marker.remove());
            console.log('已清除 ' + existingMarkers.length + ' 个现有标记');
            return { cleared: existingMarkers.length };
          `);

          await puppeteerEvaluate.execute({ script: clearScript });
        }

        // 主要的Canvas定位脚本（包含轮询等待）
        const locateCanvasScript = wrapAntiDetectionScript(`
          async function getCanvasPosition() {
            try {
              // 轮询等待第一层iframe（最多等待3秒）
              let firstIframe = null;
              const maxRetries = 10;
              const retryDelay = 300;
              
              for (let i = 0; i < maxRetries; i++) {
                firstIframe = document.querySelector('iframe[src*="/web/frame/recommend/"]') || 
                             document.querySelector('iframe[name="recommendFrame"]');
                if (firstIframe) {
                  console.log('找到第一层iframe，耗时: ' + (i * retryDelay) + 'ms');
                  break;
                }
                if (i < maxRetries - 1) {
                  await new Promise(resolve => setTimeout(resolve, retryDelay));
                }
              }
              
              if (!firstIframe) {
                return { error: "未找到第一层iframe，请确保在推荐页面" };
              }

              const targetIframe = firstIframe;
              
              // 第二步：轮询等待简历弹窗
              const firstIframeDoc = targetIframe.contentDocument || targetIframe.contentWindow.document;
              
              const popupSelectors = [
                '.boss-popup__wrapper.boss-dialog.dialog-lib-resume.recommendV2',
                '.boss-popup__wrapper.boss-dialog.dialog-lib-resume',
                '.boss-dialog.dialog-lib-resume',
                '.dialog-lib-resume',
                '[class*="dialog-lib-resume"]',
                '.boss-popup__wrapper.boss-dialog[style*="display: block"]',
                '.boss-popup__wrapper.boss-dialog:not([style*="display: none"])'
              ];
              
              let resumePopup = null;
              for (let i = 0; i < maxRetries; i++) {
                for (const selector of popupSelectors) {
                  resumePopup = firstIframeDoc.querySelector(selector);
                  if (resumePopup) {
                    console.log('找到简历弹窗，选择器: ' + selector + '，耗时: ' + (i * retryDelay) + 'ms');
                    break;
                  }
                }
                if (resumePopup) break;
                if (i < maxRetries - 1) {
                  await new Promise(resolve => setTimeout(resolve, retryDelay));
                }
              }
              
              if (!resumePopup) {
                return { error: "简历弹窗未打开，需要先点击候选人卡片打开简历" };
              }

              // 第三步：获取第二层iframe（简历内容iframe）
              const secondIframeSelectors = [
                'iframe[src*="/web/frame/c-resume/"]',
                'iframe[src*="c-resume"]',
                '.dialog-lib-resume iframe',
                '.boss-dialog iframe',
                'iframe[name*="resume"]'
              ];
              
              let secondIframe = null;
              for (const selector of secondIframeSelectors) {
                secondIframe = firstIframeDoc.querySelector(selector);
                if (secondIframe) {
                  console.log('找到简历iframe使用选择器: ' + selector);
                  break;
                }
              }
              
              if (!secondIframe) {
                return { error: "未找到简历iframe，弹窗可能还在加载中" };
              }

              // 第四步：轮询等待Canvas元素
              const secondIframeDoc = secondIframe.contentDocument || secondIframe.contentWindow.document;
              
              const canvasSelectors = [
                '#resume canvas#resume',
                '#resume canvas',
                'canvas#resume',
                '.resume-container canvas',
                'canvas[id*="resume"]',
                'canvas'  // 最后的备用选择器
              ];
              
              let resumeCanvas = null;
              for (let i = 0; i < maxRetries; i++) {
                for (const selector of canvasSelectors) {
                  resumeCanvas = secondIframeDoc.querySelector(selector);
                  if (resumeCanvas) {
                    console.log('找到Canvas，选择器: ' + selector + '，耗时: ' + (i * retryDelay) + 'ms');
                    break;
                  }
                }
                if (resumeCanvas) break;
                if (i < maxRetries - 1) {
                  await new Promise(resolve => setTimeout(resolve, retryDelay));
                }
              }
              
              if (!resumeCanvas) {
                const bodyContent = secondIframeDoc.body ? secondIframeDoc.body.innerHTML.substring(0, 200) : 'No body';
                return { 
                  error: "未找到简历canvas元素，已等待3秒。iframe内容预览: " + bodyContent,
                  debug: {
                    hasBody: !!secondIframeDoc.body,
                    bodyChildrenCount: secondIframeDoc.body ? secondIframeDoc.body.children.length : 0
                  }
                };
              }

              // 第五步：计算Canvas在各个层级中的位置信息
              const canvasRect = resumeCanvas.getBoundingClientRect();
              const secondIframeRect = secondIframe.getBoundingClientRect();
              const firstIframeRect = targetIframe.getBoundingClientRect();

              // 计算Canvas在主页面中的绝对位置
              const absolutePosition = {
                left: firstIframeRect.left + secondIframeRect.left + canvasRect.left,
                top: firstIframeRect.top + secondIframeRect.top + canvasRect.top,
                width: canvasRect.width,
                height: canvasRect.height
              };

              // 滚动使Canvas区域尽可能居中显示
              const scrollTop = Math.max(0, absolutePosition.top - (window.innerHeight - absolutePosition.height) / 2);
              window.scrollTo({ top: scrollTop, behavior: 'instant' });
              console.log('已滚动到位置: ' + scrollTop + '，使Canvas尽可能居中');

              // 根据参数决定是否添加标记
              let markerAdded = false;
              if (${addMarker}) {
                // 添加一个临时标记元素来帮助定位
                const marker = document.createElement('div');
                marker.id = 'canvas-position-marker';
                marker.style.position = 'fixed';
                marker.style.left = absolutePosition.left + 'px';
                marker.style.top = absolutePosition.top + 'px';
                marker.style.width = absolutePosition.width + 'px';
                marker.style.height = absolutePosition.height + 'px';
                marker.style.border = '${markerBorderWidth}px solid red';
                marker.style.zIndex = '999999';
                marker.style.pointerEvents = 'none';
                marker.style.backgroundColor = '${markerColor}';
                
                // 添加一个小标签显示尺寸信息
                const label = document.createElement('div');
                label.style.position = 'absolute';
                label.style.top = '-25px';
                label.style.left = '0';
                label.style.background = 'red';
                label.style.color = 'white';
                label.style.padding = '2px 8px';
                label.style.fontSize = '12px';
                label.style.fontFamily = 'monospace';
                label.textContent = 'Canvas: ' + Math.round(absolutePosition.width) + 'x' + Math.round(absolutePosition.height);
                marker.appendChild(label);
                
                document.body.appendChild(marker);
                markerAdded = true;
              }

              return {
                success: true,
                // 主要返回值：用于截图的坐标
                screenshotArea: {
                  x: absolutePosition.left,
                  y: absolutePosition.top,
                  width: absolutePosition.width,
                  height: absolutePosition.height
                },
                // Canvas原始尺寸信息
                canvasInfo: {
                  width: resumeCanvas.width,
                  height: resumeCanvas.height,
                  clientWidth: resumeCanvas.clientWidth,
                  clientHeight: resumeCanvas.clientHeight
                },
                // 调试信息（保持与原脚本兼容）
                debugInfo: {
                  canvasRect: {
                    left: canvasRect.left,
                    top: canvasRect.top,
                    width: canvasRect.width,
                    height: canvasRect.height
                  },
                  secondIframeRect: {
                    left: secondIframeRect.left,
                    top: secondIframeRect.top,
                    width: secondIframeRect.width,
                    height: secondIframeRect.height
                  },
                  firstIframeRect: {
                    left: firstIframeRect.left,
                    top: firstIframeRect.top,
                    width: firstIframeRect.width,
                    height: firstIframeRect.height
                  }
                },
                markerAdded: markerAdded,
                note: markerAdded 
                  ? "已添加红色边框标记Canvas位置。使用 screenshotArea 坐标进行截图。" 
                  : "Canvas位置已计算。使用 screenshotArea 坐标进行截图。"
              };
              
            } catch (error) {
              return { 
                error: "获取位置信息失败: " + error.message,
                stack: error.stack
              };
            }
          }
          
          // 执行定位函数（处理异步）
          return (async () => {
            const result = await getCanvasPosition();
            return result;
          })();
        `);

        const result = await puppeteerEvaluate.execute({ script: locateCanvasScript });
        const positionData = parseEvaluateResult(result) as
          | (CanvasPositionInfo & { success: boolean })
          | { error: string }
          | null;

        if (!positionData) {
          return {
            success: false,
            error: "无法解析Canvas位置信息",
          };
        }

        if ("error" in positionData) {
          return {
            success: false,
            error: positionData.error,
          };
        }

        if ("success" in positionData && positionData.success) {
          // 移除success字段，只返回位置信息
          const { success: _success, ...cleanData } = positionData;

          console.log(`Canvas定位成功:
            - Canvas尺寸: ${cleanData.canvasInfo.width}x${cleanData.canvasInfo.height}
            - 截图区域: x=${cleanData.screenshotArea.x}, y=${cleanData.screenshotArea.y}
            - 截图尺寸: ${cleanData.screenshotArea.width}x${cleanData.screenshotArea.height}
            - 标记状态: ${cleanData.markerAdded ? "已添加" : "未添加"}
            
            重要：使用 screenshotArea 坐标进行截图`);

          const finalData = cleanData as CanvasPositionInfo;

          return {
            success: true,
            data: finalData,
          };
        }

        return {
          success: false,
          error: "Canvas定位失败",
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
export const createZhipinLocateResumeCanvasTool = zhipinLocateResumeCanvasTool;

// 导出工具
export const ZHIPIN_LOCATE_RESUME_CANVAS_ACTION = "zhipin_locate_resume_canvas";
