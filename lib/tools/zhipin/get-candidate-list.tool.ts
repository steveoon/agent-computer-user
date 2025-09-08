import { tool } from "ai";
import { z } from "zod";
import { getPuppeteerMCPClient } from "@/lib/mcp/client-manager";
import { wrapAntiDetectionScript, randomDelay } from "./anti-detection-utils";
import type { AutomationResult } from "./types";

/**
 * Boss直聘候选人卡片信息
 */
export interface ZhipinCandidateCard {
  index: number;
  candidateId?: string; // data-geek属性
  name: string;
  activeTime?: string; // 活跃时间，如"刚刚活跃"
  age?: string;
  experience?: string;
  education?: string;
  workStatus?: string; // 工作状态，如"在职-月内到岗"
  currentCompany?: string; // 当前公司
  currentPosition?: string; // 当前职位
  expectedLocation?: string; // 期望地点
  expectedPosition?: string; // 期望职位
  buttonText?: string; // "打招呼"按钮文本
  tags?: string[]; // 技能标签
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
 * Boss直聘获取候选人列表工具
 *
 * 功能：
 * - 获取候选人推荐页面的候选人列表
 * - 提取候选人的详细信息
 * - 支持过滤已联系的候选人
 *
 * 注意：
 * - Boss直聘使用两列布局，每个li.card-item包含两个候选人卡片
 * - 需要直接查找所有的候选人卡片，而不是li元素
 */
export const zhipinGetCandidateListTool = () =>
  tool({
    description: `Boss直聘获取候选人列表功能
    
    功能：
    - 获取候选人推荐页面的所有候选人信息
    - 提取姓名、年龄、经验、学历、工作状态、公司职位等信息
    - 提取期望地点和职位信息
    - 提取技能标签信息
    - 支持限制返回数量
    
    注意：
    - 需要先打开Boss直聘的候选人推荐页面
    - 页面URL通常为类似 zhipin.com/web/geek/recommend 的形式`,

    inputSchema: z.object({
      maxResults: z.number().optional().describe("最多返回的候选人数量"),
      includeNoGreetButton: z
        .boolean()
        .optional()
        .default(false)
        .describe("是否包含没有打招呼按钮的候选人"),
    }),

    execute: async ({
      maxResults,
      includeNoGreetButton = false,
    }): Promise<
      AutomationResult<{
        candidates: ZhipinCandidateCard[];
        total: number;
      }>
    > => {
      try {
        const client = await getPuppeteerMCPClient();
        const tools = await client.tools();

        // 检查必需的工具
        if (!tools.puppeteer_evaluate) {
          throw new Error("MCP tool puppeteer_evaluate not available");
        }

        const puppeteerEvaluate = tools.puppeteer_evaluate;

        // 初始延迟
        await randomDelay(300, 500);

        // 获取所有候选人信息
        const getCandidatesScript = wrapAntiDetectionScript(`
          const candidates = [];
          
          // 首先尝试获取iframe
          let doc = document;
          const iframe = document.querySelector('iframe[name="recommendFrame"]');
          
          if (iframe) {
            try {
              // 获取iframe的文档
              const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
              if (iframeDoc) {
                doc = iframeDoc;
                console.log('已切换到iframe文档');
              } else {
                console.log('无法访问iframe文档');
              }
            } catch (e) {
              console.error('访问iframe失败:', e);
              // 如果跨域，继续使用主文档
            }
          }
          
          // 查找所有候选人卡片
          let cardItems = [];
          
          // Boss直聘的布局是每个li.card-item包含一个div.row，
          // 而div.row里面有两个候选人卡片（左右两列）
          // 所以我们需要直接查找所有的候选人卡片，而不是li.card-item
          const selectors = [
            '.geek-card-small.candidate-card-wrap',  // 直接查找候选人卡片
            '.card-inner.common-wrap',
            'li.card-item .geek-card-small',
            'li.card-item .card-inner'
          ];
          
          for (const selector of selectors) {
            const found = doc.querySelectorAll(selector);
            if (found.length > 0) {
              cardItems = Array.from(found);
              console.log('使用选择器找到候选人卡片: ' + selector + ', 数量: ' + found.length);
              break;
            }
          }
          
          if (cardItems.length === 0) {
            return { 
              error: '未找到候选人卡片列表，尝试了选择器: ' + selectors.join(', '), 
              candidates: [],
              pageInfo: {
                hasIframe: !!iframe,
                isIframeAccessible: doc !== document,
                hasLiCardItem: doc.querySelectorAll('li.card-item').length,
                hasGeekCard: doc.querySelectorAll('.geek-card-small').length,
                hasCardInner: doc.querySelectorAll('.card-inner').length
              }
            };
          }
          
          cardItems.forEach((card, index) => {
            try {
              const candidate = { index };
              
              // 卡片容器就是当前元素
              let cardContainer = card;
              
              // 获取候选人ID - 根据实际DOM结构调整
              let cardInner = cardContainer.querySelector('.card-inner');
              if (!cardInner && cardContainer.classList.contains('card-inner')) {
                cardInner = cardContainer; // 如果card本身就是card-inner
              }
              if (cardInner) {
                candidate.candidateId = cardInner.getAttribute('data-geek') || 
                                       cardInner.getAttribute('data-geekid');
              }
              
              // 获取姓名
              const nameEl = cardContainer.querySelector('.name');
              if (nameEl) {
                candidate.name = nameEl.textContent?.trim();
              }
              
              // 获取在线状态 - 通过online-marker图标判断
              const onlineMarker = cardContainer.querySelector('.online-marker');
              if (onlineMarker) {
                candidate.activeTime = '在线';
              }
              
              // 获取薪资范围
              const salaryEl = cardContainer.querySelector('.salary-wrap');
              if (salaryEl) {
                candidate.expectedSalary = salaryEl.textContent?.trim();
              }
              
              // 获取基本信息（年龄、经验、学历、工作状态）
              const baseInfoEl = cardContainer.querySelector('.base-info.join-text-wrap');
              if (baseInfoEl) {
                const infoText = baseInfoEl.textContent?.trim();
                if (infoText) {
                  // 按照分隔符分割信息
                  const parts = infoText.split(/[丨|]/).map(s => s.trim()).filter(Boolean);
                  if (parts.length >= 1) candidate.age = parts[0];
                  if (parts.length >= 2) candidate.experience = parts[1];
                  if (parts.length >= 3) candidate.education = parts[2];
                  if (parts.length >= 4) candidate.workStatus = parts[3];
                }
              }
              
              // 获取工作经历（当前公司和职位）- 适配两种content结构
              let workExpEl = cardContainer.querySelector('.timeline-wrap.work-exps .content.join-text-wrap');
              if (!workExpEl) {
                workExpEl = cardContainer.querySelector('.timeline-wrap.work-exps .content');
              }
              if (workExpEl) {
                const workText = workExpEl.textContent?.trim();
                if (workText) {
                  // 按照点分隔符分割公司和职位
                  const workParts = workText.split('·').map(s => s.trim());
                  if (workParts.length >= 1) candidate.currentCompany = workParts[0];
                  if (workParts.length >= 2) candidate.currentPosition = workParts[1];
                  
                  // 如果没有分隔符，整个作为工作描述
                  if (workParts.length === 1) {
                    candidate.currentPosition = workText;
                  }
                }
              }
              
              // 获取期望信息（期望地点和职位）- 适配两种content结构
              let expectEl = cardContainer.querySelector('.timeline-wrap.expect .content.join-text-wrap');
              if (!expectEl) {
                expectEl = cardContainer.querySelector('.timeline-wrap.expect .content');
              }
              if (expectEl) {
                const expectText = expectEl.textContent?.trim();
                if (expectText) {
                  // 按照点分隔符分割地点和职位
                  const expectParts = expectText.split('·').map(s => s.trim());
                  if (expectParts.length >= 1) candidate.expectedLocation = expectParts[0];
                  if (expectParts.length >= 2) candidate.expectedPosition = expectParts[1];
                  
                  // 如果没有分隔符，整个作为期望职位
                  if (expectParts.length === 1) {
                    candidate.expectedPosition = expectText;
                  }
                }
              }
              
              // 获取技能标签
              const tagEls = cardContainer.querySelectorAll('.tags-wrap .tag-item');
              if (tagEls.length > 0) {
                candidate.tags = Array.from(tagEls).map(el => el.textContent?.trim()).filter(Boolean);
              }
              
              // 获取打招呼按钮文本
              const greetBtn = cardContainer.querySelector('button.btn.btn-greet');
              if (greetBtn) {
                candidate.buttonText = greetBtn.textContent?.trim();
              }
              
              candidates.push(candidate);
            } catch (e) {
              console.error('Error parsing candidate card:', e);
            }
          });
          
          return { candidates, total: candidates.length };
        `);

        const candidatesResult = await puppeteerEvaluate.execute({ script: getCandidatesScript });
        const result = parseEvaluateResult(candidatesResult) as {
          candidates: ZhipinCandidateCard[];
          total: number;
          error?: string;
        } | null;

        if (!result) {
          return {
            success: false,
            error: "获取候选人列表数据解析失败",
          };
        }

        if (result.error) {
          return {
            success: false,
            error: result.error,
          };
        }

        if (!result.candidates || result.candidates.length === 0) {
          return {
            success: false,
            error: "未找到候选人列表，请确保已打开Boss直聘的候选人推荐页面",
          };
        }

        let filteredCandidates = result.candidates;

        // 过滤没有打招呼按钮的候选人（除非明确要求包含）
        if (!includeNoGreetButton) {
          filteredCandidates = result.candidates.filter(c => c.buttonText);
        }

        // 限制返回数量
        if (maxResults && maxResults > 0) {
          filteredCandidates = filteredCandidates.slice(0, maxResults);
        }

        return {
          success: true,
          data: {
            candidates: filteredCandidates,
            total: result.total,
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
export const createZhipinGetCandidateListTool = zhipinGetCandidateListTool;

// 导出工具
export const ZHIPIN_GET_CANDIDATE_LIST_ACTION = "zhipin_get_candidate_list";
