import { tool } from "ai";
import { z } from "zod";
import { getEducationIdByName, EDUCATION_MAPPING } from "@/lib/constants/organization-mapping";
import { interviewBookingResponseSchema } from "./types";

/**
 * Duliday预约面试工具
 *
 * @description 为求职者预约面试，需要提供完整的个人信息和岗位信息
 * @param customToken 自定义的Duliday token，优先使用此token
 * @returns AI SDK tool instance
 */
export const dulidayInterviewBookingTool = (customToken?: string) =>
  tool({
    description:
      "预约面试。为求职者预约指定岗位的面试，需要提供完整的个人信息包括姓名、电话、性别、年龄、岗位ID和面试时间。",
    inputSchema: z.object({
      name: z.string().describe("求职者姓名"),
      phone: z.string().describe("联系电话"),
      age: z.string().describe("年龄，以字符串形式提供"),
      genderId: z.number().describe("性别ID：1=男，2=女"),
      jobId: z.number().describe("岗位ID，从岗位列表或岗位详情中获取"),
      interviewTime: z
        .string()
        .describe("面试时间，格式：YYYY-MM-DD HH:mm:ss，例如：2025-07-22 13:00:00"),
      education: z
        .string()
        .optional()
        .default("大专")
        .describe("学历，如：初中、高中、大专、本科等。默认为大专"),
      hasHealthCertificate: z
        .number()
        .optional()
        .default(1)
        .describe("是否有健康证：1=有，2=无但接受办理健康证，3=无且不接受办理健康证，默认为1"),
      customerLabelList: z
        .array(z.any())
        .optional()
        .default([])
        .describe("客户标签列表，默认为空数组"),
      operateType: z.number().optional().default(3).describe("操作类型，默认为3"),
    }),
    execute: async ({
      name,
      phone,
      age,
      genderId,
      jobId,
      interviewTime,
      education = "大专",
      hasHealthCertificate = 1,
      customerLabelList = [],
      operateType = 3,
    }) => {
      console.log("🔍 duliday_interview_booking tool called with:", {
        name,
        phone,
        age,
        genderId,
        jobId,
        interviewTime,
        education,
        hasHealthCertificate,
      });
      try {
        // 优先使用自定义token，否则使用环境变量
        const dulidayToken = customToken || process.env.DULIDAY_TOKEN;
        if (!dulidayToken) {
          return {
            type: "text" as const,
            text: "❌ 缺少DULIDAY_TOKEN，请在设置中配置或设置环境变量",
          };
        }

        // 验证必填字段
        const missingFields: string[] = [];
        if (!name) missingFields.push("姓名");
        if (!phone) missingFields.push("联系电话");
        if (!age) missingFields.push("年龄");
        if (!genderId) missingFields.push("性别");
        if (!jobId) missingFields.push("岗位ID");
        if (!interviewTime) missingFields.push("面试时间");

        if (missingFields.length > 0) {
          return {
            type: "text" as const,
            text: `❌ 缺少必填信息：${missingFields.join("、")}\n\n请提供完整的求职者信息。`,
          };
        }

        // 验证面试时间格式
        const timeRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
        if (!timeRegex.test(interviewTime)) {
          return {
            type: "text" as const,
            text: `❌ 面试时间格式错误\n\n请使用正确的格式：YYYY-MM-DD HH:mm:ss\n例如：2025-07-22 13:00:00`,
          };
        }

        // 转换学历名称为ID
        const educationId = getEducationIdByName(education);
        if (!educationId) {
          const availableEducations = Object.values(EDUCATION_MAPPING).join("、");
          return {
            type: "text" as const,
            text: `❌ 无效的学历：${education}\n\n支持的学历类型：${availableEducations}\n\n请提供正确的学历信息。`,
          };
        }

        // 构建请求体
        const requestBody = {
          name,
          age,
          phone,
          genderId,
          educationId,
          hasHealthCertificate,
          interviewTime,
          customerLabelList,
          jobId,
          operateType,
        };

        // 调用API
        const response = await fetch("https://k8s.duliday.com/persistence/a/supplier/entryUser", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "duliday-token": dulidayToken,
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
        }

        const rawData = await response.json();

        // 使用 zod 验证响应数据
        const parseResult = interviewBookingResponseSchema.safeParse(rawData);
        if (!parseResult.success) {
          console.error("响应数据格式错误:", parseResult.error);
          return {
            type: "text" as const,
            text: `❌ API响应格式错误，请联系管理员`,
          };
        }

        const data = parseResult.data;

        // 返回原始API响应数据，让组件处理展示
        return {
          type: "object" as const,
          object: {
            success: data.code === 0,
            code: data.code,
            message: data.message,
            notice: data.data?.notice || null,
            errorList: data.data?.errorList || null,
            // 包含原始请求信息供组件使用
            requestInfo: {
              name,
              phone,
              age,
              genderId,
              education,
              jobId,
              interviewTime,
            },
          },
        };
      } catch (error) {
        console.error("预约面试失败:", error);
        return {
          type: "text" as const,
          text: `❌ 预约面试失败: ${error instanceof Error ? error.message : "未知错误"}`,
        };
      }
    },
  });
