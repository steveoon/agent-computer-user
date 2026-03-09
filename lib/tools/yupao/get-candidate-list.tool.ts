import { tool } from "ai";
import { z } from 'zod/v3';
import { getPlaywrightMCPClient } from "@/lib/mcp/client-manager";
import { YUPAO_SAY_HELLO_SELECTORS } from "./constants";
import { createDynamicClassSelector } from "./dynamic-selector-utils";
import type { YupaoCandidateCard } from "./types";
import {
  selectYupaoTab,
  parsePlaywrightResult,
  wrapPlaywrightScript,
  type TabSelectionResult,
} from "@/lib/tools/shared/playwright-utils";

/**
 * Yupao获取候选人列表工具
 *
 * 功能：
 * - 获取"牛人打招呼"页面的候选人列表
 * - 提取候选人的详细信息
 * - 支持过滤已联系的候选人
 */
export const yupaoGetCandidateListTool = () =>
  tool({
    description: `Yupao获取候选人列表功能

    功能：
    - 获取"牛人打招呼"页面的所有候选人信息
    - 提取姓名、性别、年龄、介绍、期望薪资等信息
    - 标记在线状态和是否已联系
    - 支持过滤已联系的候选人
    - [Playwright] 支持自动切换到鱼泡标签页

    注意：
    - 需要先打开Yupao的"牛人打招呼"页面
    - 会自动处理动态CSS选择器`,

    inputSchema: z.object({
      skipContacted: z.boolean().optional().default(false).describe("是否跳过已联系的候选人"),
      maxResults: z.number().optional().describe("最多返回的候选人数量"),
      autoSwitchTab: z
        .boolean()
        .optional()
        .default(true)
        .describe("是否自动切换到鱼泡标签页（仅 Playwright 模式有效）"),
    }),

    execute: async ({ skipContacted = false, maxResults, autoSwitchTab = true }) => {
      try {
        const mcpBackend = "playwright" as const;

        // 自动切换到鱼泡标签页
        if (autoSwitchTab) {
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

        // 获取 Playwright MCP 客户端
        const client = await getPlaywrightMCPClient();

        const tools = await client.tools();

        // Playwright 工具名称
        const toolName = "browser_evaluate";

        if (!tools[toolName]) {
          throw new Error(
            `MCP tool ${toolName} not available. 请确保 Playwright MCP 正在运行且已连接浏览器。`
          );
        }

        const mcpTool = tools[toolName];

        // 脚本内容（两个后端共用）
        const scriptContent = `
          const candidates = [];
          
          // 尝试多种选择器策略
          const cardSelectors = [
            '${YUPAO_SAY_HELLO_SELECTORS.candidateCard}',
            '${YUPAO_SAY_HELLO_SELECTORS.candidateCardAlt}',
            '${createDynamicClassSelector("_card")}',
            'div[data-index]'
          ];
          
          let cards = [];
          for (const selector of cardSelectors) {
            try {
              const found = document.querySelectorAll(selector);
              if (found.length > 0) {
                cards = Array.from(found);
                break;
              }
            } catch (e) {}
          }
          
          cards.forEach((card, index) => {
            try {
              const candidate = { index };
              
              // 获取姓名
              const nameSelectors = [
                '${YUPAO_SAY_HELLO_SELECTORS.candidateName}',
                '${YUPAO_SAY_HELLO_SELECTORS.candidateNameAlt}',
                '${createDynamicClassSelector("_name")}:not([class*="_nameR_"])'
              ];
              
              for (const selector of nameSelectors) {
                try {
                  const nameEl = card.querySelector(selector);
                  if (nameEl) {
                    candidate.name = nameEl.textContent?.trim();
                    break;
                  }
                } catch (e) {}
              }
              
              // 获取基本信息（性别、年龄等）
              // 支持两种结构:
              // - 旧结构: _baseInfoStr_ 内容如 "女丨32岁丨3年经验"
              // - 新结构: _baseInfoRow_ 内容如 "<span>35岁</span><span>离职-随时到岗</span>"
              const baseInfoSelectors = [
                '${YUPAO_SAY_HELLO_SELECTORS.baseInfoStr}',
                '${YUPAO_SAY_HELLO_SELECTORS.baseInfoStrAlt}',
                '${createDynamicClassSelector("_baseInfoStr")}',
                '${YUPAO_SAY_HELLO_SELECTORS.baseInfoRow}',
                '${YUPAO_SAY_HELLO_SELECTORS.baseInfoRowAlt}',
                '${createDynamicClassSelector("_baseInfoRow")}'
              ];

              for (const selector of baseInfoSelectors) {
                try {
                  const infoEl = card.querySelector(selector);
                  if (infoEl) {
                    const infoText = infoEl.textContent?.trim();
                    if (infoText) {
                      // 尝试用丨分割（旧结构）
                      if (infoText.includes('丨')) {
                        const parts = infoText.split('丨').map(s => s.trim());
                        candidate.gender = parts[0];
                        candidate.age = parts[1];
                        candidate.experience = parts[2];
                        candidate.education = parts[3];
                      } else {
                        // 新结构: 直接从文本中提取
                        const ageMatch = infoText.match(/(\\d+)岁/);
                        if (ageMatch) {
                          candidate.age = ageMatch[0];
                        }
                        // 尝试提取其他信息
                        if (infoText.includes('男')) candidate.gender = '男';
                        else if (infoText.includes('女')) candidate.gender = '女';
                      }
                    }
                    break;
                  }
                } catch (e) {}
              }
              
              // 获取自我介绍
              // 支持两种结构:
              // - 旧结构: _introduce_
              // - 新结构: _introduceRow_
              const introSelectors = [
                '${YUPAO_SAY_HELLO_SELECTORS.introduce}',
                '${YUPAO_SAY_HELLO_SELECTORS.introduceAlt}',
                '${createDynamicClassSelector("_introduce")}',
                '${YUPAO_SAY_HELLO_SELECTORS.introduceRow}',
                '${YUPAO_SAY_HELLO_SELECTORS.introduceRowAlt}',
                '${createDynamicClassSelector("_introduceRow")}'
              ];

              for (const selector of introSelectors) {
                try {
                  const introEl = card.querySelector(selector);
                  if (introEl) {
                    candidate.introduce = introEl.textContent?.trim();
                    break;
                  }
                } catch (e) {}
              }

              // 获取期望职位信息
              // 支持两种结构:
              // - 旧结构: _cardMRI_ 内有span元素
              // - 新结构: _recentEventRow_ 内有div元素，用 _divideDot_ 分隔
              const expectedSelectors = [
                '${YUPAO_SAY_HELLO_SELECTORS.expectedInfo}',
                '${YUPAO_SAY_HELLO_SELECTORS.expectedInfoAlt}',
                '${YUPAO_SAY_HELLO_SELECTORS.recentEventRow}',
                '${YUPAO_SAY_HELLO_SELECTORS.recentEventRowAlt}',
                '${createDynamicClassSelector("_recentEventRow")}'
              ];

              for (const selector of expectedSelectors) {
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

                    if (textItems.length >= 1) candidate.expectedLocation = textItems[0];
                    if (textItems.length >= 2) candidate.expectedPosition = textItems[1];
                    if (textItems.length >= 3) candidate.expectedSalary = textItems[2];
                    break;
                  }

                  // 旧结构: 从文本解析
                  const text = expectationEl.textContent?.trim();
                  if (text?.includes('期望')) {
                    const content = text.replace('期望：', '').trim();
                    if (content.includes('·')) {
                      const parts = content.split('·').map(s => s.trim());
                      candidate.expectedLocation = parts[0];
                      candidate.expectedPosition = parts[1];
                    } else {
                      candidate.expectedPosition = content;
                    }
                  }
                  if (candidate.expectedPosition) break;
                } catch (e) {}
              }

              // 获取薪资（如果上面没有获取到）
              // 支持两种结构:
              // - 旧结构: _salary_
              // - 新结构: text-[#0092FF] (Tailwind 蓝色)
              if (!candidate.expectedSalary) {
                const salarySelectors = [
                  '${YUPAO_SAY_HELLO_SELECTORS.salary}',
                  '${YUPAO_SAY_HELLO_SELECTORS.salaryAlt}',
                  '${createDynamicClassSelector("_salary")}',
                  '.text-\\\\[\\\\#0092FF\\\\]',
                  'div.flex-none.text-\\\\[\\\\#0092FF\\\\]'
                ];

                for (const selector of salarySelectors) {
                  try {
                    const salaryEl = card.querySelector(selector);
                    if (salaryEl) {
                      candidate.expectedSalary = salaryEl.textContent?.trim();
                      break;
                    }
                  } catch (e) {}
                }
              }
              
              // 获取在线状态
              const onlineSelectors = [
                '${YUPAO_SAY_HELLO_SELECTORS.onlineYes}',
                '${YUPAO_SAY_HELLO_SELECTORS.online}',
                '${YUPAO_SAY_HELLO_SELECTORS.relation}'
              ];
              
              for (const selector of onlineSelectors) {
                try {
                  const statusEl = card.querySelector(selector);
                  if (statusEl) {
                    const statusText = statusEl.textContent?.trim();
                    if (statusText?.includes('在线')) {
                      candidate.onlineStatus = 'online';
                    } else if (statusText?.includes('刚刚')) {
                      candidate.onlineStatus = 'recently';
                    } else if (statusText?.includes('已联系')) {
                      candidate.onlineStatus = 'contacted';
                    } else {
                      candidate.onlineStatus = 'offline';
                    }
                    break;
                  }
                } catch (e) {}
              }
              
              // 获取按钮文本
              const btnSelectors = [
                '${YUPAO_SAY_HELLO_SELECTORS.chatBtn}',
                '${YUPAO_SAY_HELLO_SELECTORS.chatBtnAlt}',
                '${createDynamicClassSelector("_chatBtn")}'
              ];
              
              for (const selector of btnSelectors) {
                try {
                  const btnEl = card.querySelector(selector);
                  if (btnEl) {
                    candidate.buttonText = btnEl.textContent?.trim();
                    break;
                  }
                } catch (e) {}
              }
              
              // 获取标签
              const tagSelectors = [
                '${YUPAO_SAY_HELLO_SELECTORS.tag}',
                '${YUPAO_SAY_HELLO_SELECTORS.tagAlt}'
              ];
              
              candidate.tags = [];
              for (const selector of tagSelectors) {
                try {
                  const tagEls = card.querySelectorAll(selector);
                  if (tagEls.length > 0) {
                    candidate.tags = Array.from(tagEls).map(el => el.textContent?.trim()).filter(Boolean);
                    break;
                  }
                } catch (e) {}
              }
              
              candidates.push(candidate);
            } catch (e) {
              console.error('Error parsing candidate card:', e);
            }
          });

          return candidates;
        `;

        // 使用 Playwright 脚本包装
        const getCandidatesScript = wrapPlaywrightScript(scriptContent);

        // 执行脚本
        console.log("[Playwright] 正在执行脚本...");
        const candidatesResult = await mcpTool.execute({ function: getCandidatesScript });

        // 解析 Playwright 结果
        let candidates: YupaoCandidateCard[] | null = null;

        const parsedResult = parsePlaywrightResult(candidatesResult);
        if (Array.isArray(parsedResult)) {
          candidates = parsedResult as YupaoCandidateCard[];
        }

        if (!candidates || candidates.length === 0) {
          return {
            success: false,
            error: "未找到候选人列表",
            message: "请确保已打开Yupao的牛人打招呼页面",
            mcpBackend,
          };
        }

        // 过滤候选人
        let filteredCandidates = candidates;
        if (skipContacted) {
          filteredCandidates = candidates.filter(c => c.onlineStatus !== "contacted");
        }

        // 限制返回数量
        if (maxResults && maxResults > 0) {
          filteredCandidates = filteredCandidates.slice(0, maxResults);
        }

        return {
          success: true,
          message: `成功获取 ${filteredCandidates.length} 个候选人信息`,
          data: {
            candidates: filteredCandidates,
            total: candidates.length,
            filtered: skipContacted
              ? candidates.filter(c => c.onlineStatus === "contacted").length
              : 0,
          },
          mcpBackend,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error occurred",
          message: "获取候选人列表时发生错误",
          mcpBackend: "playwright" as const,
        };
      }
    },
  });

/**
 * 快捷创建函数
 */
export const createYupaoGetCandidateListTool = yupaoGetCandidateListTool;

// 导出工具
export const GET_CANDIDATE_LIST_ACTION = "get_candidate_list";
