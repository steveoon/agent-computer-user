import { tool } from "ai";
import { z } from "zod";
import { jobDetailsResponseSchema, type InterviewTime } from "./types";

/**
 * Duliday获取岗位详情工具
 * 
 * @description 根据jobBasicInfoId获取岗位的详细信息，包括面试时间、地址等
 * @param customToken 自定义的Duliday token，优先使用此token
 * @returns AI SDK tool instance
 */
export const dulidayJobDetailsTool = (customToken?: string) =>
  tool({
    description:
      "根据jobBasicInfoId获取岗位详情。获取指定岗位的详细信息，包括面试时间安排、面试地址等重要信息。",
    inputSchema: z.object({
      jobBasicInfoId: z
        .number()
        .describe("岗位基础信息ID，可以从岗位列表中获取"),
    }),
    execute: async ({ jobBasicInfoId }) => {
      console.log("🔍 duliday_job_details tool called with:", { jobBasicInfoId });
      try {
        // 优先使用自定义token，否则使用环境变量
        const dulidayToken = customToken || process.env.DULIDAY_TOKEN;
        if (!dulidayToken) {
          return {
            type: "text" as const,
            text: "❌ 缺少DULIDAY_TOKEN，请在设置中配置或设置环境变量",
          };
        }

        // 调用API
        const response = await fetch(
          `https://k8s.duliday.com/persistence/a/job/getJobStoreByJobBasicInfoId?jobBasicInfoId=${jobBasicInfoId}`,
          {
            method: "GET",
            headers: {
              "duliday-token": dulidayToken,
            },
          }
        );

        if (!response.ok) {
          throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
        }

        const rawData = await response.json();
        
        // 使用 zod 验证响应数据
        const parseResult = jobDetailsResponseSchema.safeParse(rawData);
        if (!parseResult.success) {
          console.error("响应数据格式错误:", parseResult.error);
          return {
            type: "text" as const,
            text: `❌ API响应格式错误，请联系管理员`,
          };
        }
        
        const data = parseResult.data;

        // 检查响应状态
        if (data.code !== 0) {
          return {
            type: "text" as const,
            text: `❌ API返回错误: ${data.message || "未知错误"}`,
          };
        }

        const jobDetails = data.data;
        if (!jobDetails) {
          return {
            type: "text" as const,
            text: "未找到岗位详情信息",
          };
        }

        // 构建详情信息
        let message = `✅ 岗位详情信息：\n\n`;
        message += `📋 岗位名称：${jobDetails.jobName}\n`;
        message += `📍 门店：${jobDetails.storeName}\n`;
        message += `👥 招聘人数：${jobDetails.requirementNum}人\n`;
        message += `🎯 阈值人数：${jobDetails.thresholdNum}人\n\n`;

        // 面试时间信息
        if (jobDetails.interviewTimes && jobDetails.interviewTimes.length > 0) {
          message += `⏰ 面试时间安排：\n`;
          const weekdayNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
          
          jobDetails.interviewTimes.forEach((timeSlot: InterviewTime) => {
            if (timeSlot.weekdays && timeSlot.weekdays.length > 0) {
              const weekday = weekdayNames[timeSlot.weekdays[0]];
              if (timeSlot.times && timeSlot.times.length > 0) {
                const time = timeSlot.times[0];
                // 将秒转换为时间格式
                const startHour = Math.floor(time.start / 3600);
                const startMinute = Math.floor((time.start % 3600) / 60);
                message += `   ${weekday} ${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}\n`;
              }
            }
          });
          message += `\n`;
        }

        // 面试地址信息
        if (jobDetails.interviewAddressMode) {
          message += `📍 面试地址模式：`;
          if (jobDetails.interviewAddressMode === 1) {
            message += `门店地址\n`;
          } else {
            message += `${jobDetails.interviewAddressText || "自定义地址"}\n`;
          }
        }

        // ID信息（供预约面试使用）
        message += `\n📝 备注：预约面试时需要使用以下信息：\n`;
        message += `   - jobBasicInfoId: ${jobDetails.jobBasicInfoId}\n`;
        message += `   - jobId: ${jobDetails.id}\n`;

        return {
          type: "text" as const,
          text: message,
        };
      } catch (error) {
        console.error("获取岗位详情失败:", error);
        return {
          type: "text" as const,
          text: `❌ 获取岗位详情失败: ${
            error instanceof Error ? error.message : "未知错误"
          }`,
        };
      }
    },
  });