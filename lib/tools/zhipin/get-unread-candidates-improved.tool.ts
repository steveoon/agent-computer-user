import { tool } from "ai";
import { z } from 'zod/v3';
import { UNREAD_SELECTORS } from "./constants";
import { getPlaywrightMCPClient } from "@/lib/mcp/client-manager";
import {
  performInitialScrollPattern,
  performRandomScroll,
} from "./anti-detection-utils";
import {
  selectZhipinTab,
  parsePlaywrightResult,
  wrapPlaywrightScript,
  generatePlaywrightBatchScript,
  type TabSelectionResult,
} from "@/lib/tools/shared/playwright-utils";

export const getUnreadCandidatesImprovedTool = tool({
  description: `获取当前聊天列表中所有未读候选人的改进版

  改进特性：
  - 使用更精确的选择器查找名字元素
  - 更准确的未读状态检测
  - 返回更详细的候选人信息
  - 支持过滤和排序选项
  - [Playwright] 支持自动切换到直聘标签页
  `,

  inputSchema: z.object({
    selector: z
      .string()
      .optional()
      .default(UNREAD_SELECTORS.unreadCandidates)
      .describe("CSS选择器用于查找候选人项"),

    max: z.number().optional().describe("返回的最大候选人数量"),

    onlyUnread: z.boolean().optional().default(false).describe("是否只返回有未读消息的候选人"),

    sortBy: z.enum(["time", "unreadCount", "name"]).optional().default("time").describe("排序方式"),

    // Playwright 专属参数
    autoSwitchTab: z
      .boolean()
      .optional()
      .default(true)
      .describe("是否自动切换到直聘标签页（仅 Playwright 模式有效）"),
  }),

  execute: async ({
    selector = UNREAD_SELECTORS.unreadCandidates,
    max,
    onlyUnread = false,
    sortBy = "time",
    autoSwitchTab = true,
  }) => {
    try {
      // 自动切换到直聘标签页
      if (autoSwitchTab) {
        console.log("[Playwright] 正在切换到直聘标签页...");
        const tabResult: TabSelectionResult = await selectZhipinTab();

        if (!tabResult.success) {
          return {
            success: false,
            candidates: [],
            count: 0,
            error: `无法切换到直聘标签页: ${tabResult.error}`,
            availableTabs: tabResult.availableTabs,
            message: "请确保已在浏览器中打开 BOSS 直聘页面",
            mcpBackend: "playwright" as const,
          };
        }

        console.log(`[Playwright] 已切换到: ${tabResult.tab?.title} (${tabResult.tab?.url})`);
      }

      // 获取 Playwright MCP 客户端
      const client = await getPlaywrightMCPClient();

      // 在获取候选人列表前执行初始滚动模式
      await performInitialScrollPattern();

      // 创建分批处理的脚本
      const processingLogic = `
        // 使用改进的选择器查找名字
        const nameElement = element.querySelector('${UNREAD_SELECTORS.candidateNameSelectors}');
        const name = nameElement ? nameElement.textContent.trim() : '';

        // 如果找不到名字，尝试从文本中提取
        let extractedName = name;
        if (!extractedName) {
          const textContent = element.textContent || '';
          const nameMatch = textContent.match(/[\\u4e00-\\u9fa5]{2,4}/);
          extractedName = nameMatch ? nameMatch[0] : '';
        }

        if (!extractedName) return; // 跳过没有名字的元素

        // 提取候选人期望职位 (.source-job)
        const positionElement = element.querySelector('${UNREAD_SELECTORS.jobTitle}');
        const position = positionElement ? positionElement.textContent.trim() : '';

        // 检查未读状态 - 减少querySelector调用
        const hasUnread = !!(
          element.querySelector('${UNREAD_SELECTORS.unreadBadge}') ||
          element.querySelector('${UNREAD_SELECTORS.unreadDot}')
        );
        
        // 获取未读数量 - 只在有未读时查询
        let unreadCount = 0;
        if (hasUnread) {
          const badgeElement = element.querySelector('${UNREAD_SELECTORS.unreadBadgeSpan}') ||
                               element.querySelector('${UNREAD_SELECTORS.unreadBadge}');
          
          if (badgeElement) {
            const badgeText = badgeElement.textContent?.trim();
            if (badgeText) {
              const countMatch = badgeText.match(/\\d+/);
              unreadCount = countMatch ? parseInt(countMatch[0], 10) : 1;
            } else {
              unreadCount = 1;
            }
          }
        }
        
        // 获取时间和预览 - 简化文本处理
        const textContent = element.textContent || '';
        const timeMatch = textContent.match(/\\d{1,2}:\\d{2}/);
        const time = timeMatch ? timeMatch[0] : '';
        
        const preview = textContent
          .replace(extractedName, '')
          .replace(/\\d{1,2}:\\d{2}/, '')
          .replace(/\\d+/, '')
          .trim()
          .substring(0, 100);
        
        // 根据条件添加候选人
        const shouldAdd = onlyUnread ? hasUnread : true;
        
        if (shouldAdd) {
          results.push({
            name: extractedName,
            position: position,
            time: time,
            preview: preview,
            hasUnread: hasUnread,
            unreadCount: unreadCount,
            index: i
          });
        }
      `;

      // 生成脚本
      const script = wrapPlaywrightScript(`
          const selector = '${selector}';
          const max = ${max || "null"};
          const onlyUnread = ${onlyUnread};
          const sortBy = '${sortBy}';

          // 获取所有候选人项
          const elements = Array.from(document.querySelectorAll(selector));

          ${generatePlaywrightBatchScript(processingLogic)}

          // 同步执行处理
          const candidates = processAllElements(elements);

          // 排序
          if (sortBy === 'unreadCount') {
            candidates.sort((a, b) => b.unreadCount - a.unreadCount);
          } else if (sortBy === 'name') {
            candidates.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
          } else if (sortBy === 'time') {
            candidates.sort((a, b) => {
              const timeA = a.time.replace(':', '');
              const timeB = b.time.replace(':', '');
              return timeB.localeCompare(timeA);
            });
          }

          const finalCandidates = max ? candidates.slice(0, max) : candidates;

          const stats = {
            total: elements.length,
            withName: candidates.length,
            withUnread: candidates.filter(c => c.hasUnread).length,
            returned: finalCandidates.length
          };

          return {
            success: true,
            candidates: finalCandidates,
            count: finalCandidates.length,
            stats: stats,
            selector: selector,
            filters: { onlyUnread, sortBy, max }
          };
        `);

      // 执行脚本
      const tools = await client.tools();

      const toolName = "browser_evaluate";

      if (!tools[toolName]) {
        throw new Error(
          `MCP tool ${toolName} not available. 请确保 Playwright MCP 正在运行且已连接浏览器。`
        );
      }

      const mcpTool = tools[toolName];

      // 执行脚本
      console.log("[Playwright] 正在执行脚本...");
      const result = await mcpTool.execute({ function: script });

            // 调试日志：查看脚本执行结果

            // console.log("[Playwright] 脚本执行结果:", JSON.stringify(result, null, 2));

            console.log("[Playwright] 脚本执行完成");

      // 在获取结果后再执行一次随机滚动
      await performRandomScroll({
        minDistance: 30,
        maxDistance: 100,
        probability: 0.4,
        direction: "both",
      });

      // 解析结果
      const parsedResult = parsePlaywrightResult(result);

      if (parsedResult && typeof parsedResult === "object") {
        const resultObj = parsedResult as Record<string, unknown>;
        if (resultObj.success !== undefined) {
          return {
            ...resultObj,
            message: resultObj.success
              ? `成功获取 ${resultObj.count} 个候选人 (Playwright)`
              : "获取候选人失败",
            mcpBackend: "playwright",
          };
        }
      }

      return {
        success: false,
        candidates: [],
        count: 0,
        error: "Playwright result parsing failed",
        rawResult: parsedResult,
        mcpBackend: "playwright",
      };
    } catch (error) {
      console.error("Failed to get unread candidates:", error);

      return {
        success: false,
        candidates: [],
        count: 0,
        error: error instanceof Error ? error.message : "Unknown error occurred",
        message: "获取未读候选人时发生错误",
        mcpBackend: "playwright" as const,
      };
    }
  },
});

// 导出工具动作名称
export const GET_UNREAD_CANDIDATES_IMPROVED_ACTION = "get_unread_candidates_improved";
