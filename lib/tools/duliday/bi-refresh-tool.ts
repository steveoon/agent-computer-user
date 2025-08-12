import { tool } from "ai";
import { z } from "zod";

// ==================== 常量配置 ====================
const REFRESH_CONFIG = {
  REFRESH_URL: "https://bi.duliday.com/public-api/data-source/sa02db85d1ae64d699f6fd4e/refresh",
  TOKEN: "o7490d75e4eca4f3a8b7ecfd",
  ESTIMATED_REFRESH_TIME: 30, // 预计刷新时间（秒）
} as const;

/**
 * Duliday BI数据源刷新工具
 *
 * @description 触发Duliday BI数据源的刷新，确保获取最新的业务数据
 * @returns AI SDK tool instance
 */
export const dulidayBiRefreshTool = () =>
  tool({
    description:
      "刷新Duliday BI报表的数据源，确保数据是最新的。此操作通常需要30秒以上才能完成，刷新后需要等待一段时间再使用bi_report工具获取数据。建议在发现数据过时或需要最新数据时使用。",
    inputSchema: z.object({
      waitReminder: z
        .boolean()
        .optional()
        .default(true)
        .describe("是否提醒用户等待数据刷新完成"),
    }),
    execute: async ({ waitReminder = true }) => {
      console.log("🔄 开始刷新Duliday BI数据源...");

      try {
        // 构建请求URL
        const url = `${REFRESH_CONFIG.REFRESH_URL}?token=${REFRESH_CONFIG.TOKEN}`;
        
        // 发起刷新请求
        const response = await fetch(url, {
          method: "GET",
          headers: {
            "Accept": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`刷新请求失败: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data.result !== "ok") {
          throw new Error(`数据源刷新失败: ${data.message || "未知错误"}`);
        }

        const taskId = data.response?.taskId;
        console.log(`✅ 数据源刷新任务已启动，任务ID: ${taskId}`);

        // 构建返回消息
        let message = "";
        
        if (waitReminder) {
          message = `✅ 刷新任务已成功触发\n`;
          message += `任务ID: ${taskId || "未返回"}\n`;
          message += `\n⏱️ 重要提示:\n`;
          message += `• 数据刷新通常需要 30 秒以上\n`;
          message += `• 请等待 30-45 秒后再使用 duliday_bi_report 工具\n`;
          message += `• 过早查询可能仍会获取到旧数据`;
        } else {
          message = `✅ 刷新任务已启动\n`;
          message += `任务ID: ${taskId || "未返回"}`;
        }

        return {
          type: "text" as const,
          text: message,
        };
      } catch (error) {
        console.error("刷新BI数据源失败:", error);
        
        return {
          type: "text" as const,
          text: `❌ 刷新失败: ${error instanceof Error ? error.message : "未知错误"}`,
        };
      }
    },
  });