import { tool } from "ai";
import { z } from 'zod/v3';
import { YUPAO_UNREAD_SELECTORS } from "./constants";
import { getPuppeteerMCPClient, getPlaywrightMCPClient } from "@/lib/mcp/client-manager";
import {
  generateBatchProcessingScript,
  wrapAntiDetectionScript,
  performInitialScrollPattern,
  performRandomScroll,
} from "../zhipin/anti-detection-utils";
import { getAdaptiveSelectors, generateFindElementScript } from "./dynamic-selector-utils";
import {
  selectYupaoTab,
  parsePlaywrightResult,
  wrapPlaywrightScript,
  generatePlaywrightBatchScript,
  type TabSelectionResult,
} from "@/lib/tools/shared/playwright-utils";

// Feature flag: 使用 Playwright MCP 而非 Puppeteer MCP
// 设置环境变量 USE_PLAYWRIGHT_MCP=true 启用
const USE_PLAYWRIGHT_MCP = process.env.USE_PLAYWRIGHT_MCP === "true";

export const getUnreadMessagesTool = tool({
  description: `获取Yupao聊天列表中所有未读消息候选人

  功能特性：
  - 自动检测未读消息数量和状态标签（[送达]、[新招呼]等）
  - 提取候选人姓名、职位、时间、最新消息内容
  - 支持过滤和排序选项
  - 包含反检测机制
  ${USE_PLAYWRIGHT_MCP ? "- [Playwright] 支持自动切换到鱼泡标签页" : ""}
  `,

  inputSchema: z.object({
    selector: z
      .string()
      .optional()
      .default(YUPAO_UNREAD_SELECTORS.convItem)
      .describe("CSS选择器用于查找对话项"),

    max: z.number().optional().describe("返回的最大候选人数量"),

    onlyUnread: z.boolean().optional().default(false).describe("是否只返回有未读消息的候选人"),

    sortBy: z.enum(["time", "unreadCount", "name"]).optional().default("time").describe("排序方式"),

    // Playwright 专属参数
    autoSwitchTab: z
      .boolean()
      .optional()
      .default(true)
      .describe("是否自动切换到鱼泡标签页（仅 Playwright 模式有效）"),
  }),

  execute: async ({
    selector = YUPAO_UNREAD_SELECTORS.convItem,
    max,
    onlyUnread = false,
    sortBy = "time",
    autoSwitchTab = true,
  }) => {
    try {
      // Playwright 模式: 自动切换到鱼泡标签页
      if (USE_PLAYWRIGHT_MCP && autoSwitchTab) {
        console.log("[Playwright] 正在切换到鱼泡标签页...");
        const tabResult: TabSelectionResult = await selectYupaoTab();

        if (!tabResult.success) {
          return {
            success: false,
            candidates: [],
            count: 0,
            error: `无法切换到鱼泡标签页: ${tabResult.error}`,
            availableTabs: tabResult.availableTabs,
            message: "请确保已在浏览器中打开鱼泡网页面",
            mcpBackend: "playwright",
          };
        }

        console.log(`[Playwright] 已切换到: ${tabResult.tab?.title} (${tabResult.tab?.url})`);
      }

      // 获取适当的 MCP 客户端
      const client = USE_PLAYWRIGHT_MCP
        ? await getPlaywrightMCPClient()
        : await getPuppeteerMCPClient();

      // 在获取候选人列表前执行初始滚动模式
      await performInitialScrollPattern(client);

      // 创建分批处理的脚本 - 使用动态选择器策略
      const processingLogic = `
        // 注入查找元素的函数
        ${generateFindElementScript()}
        
        // 使用预定义的自适应选择器
        const nameSelectors = ${JSON.stringify(getAdaptiveSelectors("candidateName"))};
        const positionSelectors = ${JSON.stringify(getAdaptiveSelectors("jobTitle"))};
        const unreadNumSelectors = ${JSON.stringify(getAdaptiveSelectors("unreadNum"))};
        const statusSelectors = ${JSON.stringify(getAdaptiveSelectors("statusUnread"))};
        const timeSelectors = ${JSON.stringify(getAdaptiveSelectors("messageTime"))};
        const msgSelectors = ${JSON.stringify(getAdaptiveSelectors("msgText"))};
        
        // 查找各个元素
        const nameElement = findElement(element, nameSelectors);
        const name = nameElement ? nameElement.textContent.trim() : '';
        
        if (!name) return; // 跳过没有名字的元素
        
        const positionElement = findElement(element, positionSelectors);
        const position = positionElement ? positionElement.textContent.trim() : '';
        
        // 检查未读状态
        const unreadNumElement = findElement(element, unreadNumSelectors);
        const statusElement = findElement(element, statusSelectors);
        
        let unreadCount = 0;
        let hasUnread = false;
        let messageStatus = '';
        
        if (unreadNumElement) {
          const unreadText = unreadNumElement.textContent?.trim();
          if (unreadText && /^\\d+$/.test(unreadText)) {
            unreadCount = parseInt(unreadText, 10) || 0;
            hasUnread = unreadCount > 0;
          }
        }
        
        if (statusElement) {
          messageStatus = statusElement.textContent?.trim() || '';
        }
        
        const timeElement = findElement(element, timeSelectors);
        const time = timeElement ? timeElement.textContent.trim() : '';
        
        const msgElement = findElement(element, msgSelectors);
        const lastMessage = msgElement ? msgElement.textContent.trim() : '';
        
        // 根据条件添加候选人
        const shouldAdd = onlyUnread ? hasUnread : true;
        
        if (shouldAdd) {
          results.push({
            name: name,
            position: position,
            time: time,
            lastMessage: lastMessage,
            messageStatus: messageStatus,
            hasUnread: hasUnread,
            unreadCount: unreadCount,
            index: i
          });
        }
      `;

      // 根据 MCP 类型生成不同的脚本
      // Playwright MCP 对脚本序列化有严格要求，需要使用简化版本
      const script = USE_PLAYWRIGHT_MCP
        ? wrapPlaywrightScript(`
          const selector = '${selector}';
          const max = ${max || "null"};
          const onlyUnread = ${onlyUnread};
          const sortBy = '${sortBy}';

          // 动态查找对话项
          const findConvItems = () => {
            const selectors = [
              selector,
              ...${JSON.stringify(getAdaptiveSelectors("convItem"))}
            ];

            for (const sel of selectors) {
              try {
                const items = document.querySelectorAll(sel);
                if (items.length > 0) {
                  return Array.from(items);
                }
              } catch (e) {}
            }
            return [];
          };

          const elements = findConvItems();

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
        `)
        : wrapAntiDetectionScript(`
        const selector = '${selector}';
        const max = ${max || "null"};
        const onlyUnread = ${onlyUnread};
        const sortBy = '${sortBy}';

        // 动态查找对话项 - 尝试多种选择器策略
        const findConvItems = () => {
          const selectors = [
            selector, // 首先尝试传入的选择器
            ...${JSON.stringify(getAdaptiveSelectors("convItem"))} // 使用预定义的自适应选择器
          ];

          for (const sel of selectors) {
            try {
              const items = document.querySelectorAll(sel);
              if (items.length > 0) {
                console.log(\`Found \${items.length} items with selector: \${sel}\`);
                return Array.from(items);
              }
            } catch (e) {
              // 某些选择器可能不被支持
            }
          }

          return [];
        };

        // 获取所有对话项
        const elements = findConvItems();

        ${generateBatchProcessingScript(processingLogic, 5)}

        // 执行分批处理
        const candidates = await processAllBatches(elements);

        // 排序
        if (sortBy === 'unreadCount') {
          candidates.sort((a, b) => b.unreadCount - a.unreadCount);
        } else if (sortBy === 'name') {
          candidates.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
        } else if (sortBy === 'time') {
          // 时间排序逻辑：将时间字符串转换为可比较的格式
          candidates.sort((a, b) => {
            // 简单的时间比较，假设格式为 HH:mm
            const timeA = a.time.replace(':', '');
            const timeB = b.time.replace(':', '');
            return timeB.localeCompare(timeA);
          });
        }

        // 限制数量
        const finalCandidates = max ? candidates.slice(0, max) : candidates;

        // 统计信息
        const stats = {
          total: elements.length,
          withName: candidates.length,
          withUnread: candidates.filter(c => c.hasUnread).length,
          returned: finalCandidates.length
        };

        // 返回结果对象
        return {
          success: true,
          candidates: finalCandidates,
          count: finalCandidates.length,
          stats: stats,
          selector: selector,
          filters: {
            onlyUnread: onlyUnread,
            sortBy: sortBy,
            max: max
          }
        };
      `);

      // 执行脚本
      const tools = await client.tools();

      // 根据 MCP 类型选择工具名称
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

      // 执行脚本
      console.log(`[${USE_PLAYWRIGHT_MCP ? "Playwright" : "Puppeteer"}] 正在执行脚本...`);
      // Playwright MCP 使用 "function" 参数名，Puppeteer MCP 使用 "script" 参数名
      const executeParams = USE_PLAYWRIGHT_MCP ? { function: script } : { script };
      const result = await mcpTool.execute(executeParams);
      console.log(`[${USE_PLAYWRIGHT_MCP ? "Playwright" : "Puppeteer"}] 脚本执行完成`);

      // 在获取结果后再执行一次随机滚动
      await performRandomScroll(client, {
        minDistance: 30,
        maxDistance: 100,
        probability: 0.4,
        direction: "both",
      });

      // 根据 MCP 类型解析结果
      if (USE_PLAYWRIGHT_MCP) {
        // Playwright MCP 结果解析
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
      }

      // Puppeteer MCP 结果解析（保持原有逻辑）
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
            // 结果已经是 JSON 字符串，直接解析
            const parsedResult = JSON.parse(jsonResult);

            return {
              ...parsedResult,
              message: parsedResult.success
                ? `成功获取 ${parsedResult.count} 个候选人 (总计: ${parsedResult.stats.total}, 有名字: ${parsedResult.stats.withName}, 未读: ${parsedResult.stats.withUnread})`
                : "获取候选人失败",
              mcpBackend: "puppeteer",
            };
          }

          // 如果执行结果是 undefined，可能是脚本执行有问题
          console.error("Script execution returned undefined");
          return {
            success: false,
            candidates: [],
            count: 0,
            error: "Script execution returned undefined",
            rawResult: resultText,
            mcpBackend: "puppeteer",
          };
        } catch (e) {
          console.error("Failed to parse script result:", e);
          // 尝试直接提取 JSON 部分
          try {
            // 查找 JSON 对象的开始和结束
            const jsonMatch = resultText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsedResult = JSON.parse(jsonMatch[0]);
              return {
                ...parsedResult,
                message: parsedResult.success
                  ? `成功获取 ${parsedResult.count} 个候选人`
                  : "获取候选人失败",
                mcpBackend: "puppeteer",
              };
            }
          } catch {
            // 忽略二次解析错误
          }

          return {
            success: false,
            candidates: [],
            count: 0,
            error: "Failed to parse result: " + e,
            rawResult: resultText,
            mcpBackend: "puppeteer",
          };
        }
      }

      return {
        success: false,
        candidates: [],
        count: 0,
        error: "Unexpected result format",
        mcpBackend: USE_PLAYWRIGHT_MCP ? "playwright" : "puppeteer",
      };
    } catch (error) {
      console.error("Failed to get unread messages:", error);

      return {
        success: false,
        candidates: [],
        count: 0,
        error: error instanceof Error ? error.message : "Unknown error occurred",
        message: "获取未读消息时发生错误",
        mcpBackend: USE_PLAYWRIGHT_MCP ? "playwright" : "puppeteer",
      };
    }
  },
});

// 导出工具动作名称
export const GET_UNREAD_MESSAGES_ACTION = "get_unread_messages";
