import { tool } from "ai";
import { z } from "zod";
import { getOrgIdByBrandName, getAvailableBrands } from "@/lib/constants/organization-mapping";
import { jobListResponseSchema, type JobItem } from "./types";

/**
 * Duliday获取品牌在招岗位列表工具
 *
 * @description 调用Duliday API获取指定品牌的在招岗位列表
 * @param customToken 自定义的Duliday token，优先使用此token
 * @param defaultBrand 默认品牌名称，当用户未指定品牌时使用
 * @returns AI SDK tool instance
 */
export const dulidayJobListTool = (customToken?: string, defaultBrand?: string) =>
  tool({
    description:
      "获取品牌在招岗位列表。根据品牌名称、门店名称、地理位置、工作类型、岗位速记名等条件查询在招岗位。返回的岗位信息包含jobId（用于预约面试）和jobBasicInfoId（用于查询岗位详情）。",
    inputSchema: z.object({
      brandName: z
        .string()
        .optional()
        .describe("品牌名称，如：肯德基、必胜客、奥乐齐等。如不指定则使用当前默认品牌"),
      storeName: z.string().optional().describe("门店名称关键词，用于筛选特定门店"),
      regionName: z.string().optional().describe("地理位置/区域名称，如：浦东新区、静安区等"),
      laborForm: z
        .enum(["全职", "兼职", "小时工"])
        .optional()
        .describe("工作类型：全职、兼职、小时工"),
      jobNickName: z.string().optional().describe("岗位速记名称，如：日结、兼职+、洗碗工、后厨等"),
      pageNum: z.number().optional().default(0).describe("页码，从0开始"),
      pageSize: z
        .number()
        .optional()
        .default(80)
        .describe("每页数量，默认80条,如果没有找到用户要求的门店,则提高这个值"),
    }),
    execute: async ({
      brandName,
      storeName,
      regionName,
      laborForm,
      jobNickName,
      pageNum = 0,
      pageSize = 80,
    }) => {
      console.log("🔍 duliday_job_list tool called with:", {
        brandName,
        storeName,
        regionName,
        laborForm,
        jobNickName,
        pageNum,
        pageSize,
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

        // 确定要查询的品牌
        const targetBrand = brandName || defaultBrand;
        if (!targetBrand) {
          return {
            type: "text" as const,
            text: "❌ 请指定要查询的品牌名称",
          };
        }

        // 根据品牌名称获取组织ID
        const organizationId = getOrgIdByBrandName(targetBrand);
        if (!organizationId) {
          const availableBrands = getAvailableBrands();
          const brandList = availableBrands.map(b => b.name).join("、");
          return {
            type: "text" as const,
            text: `❌ 未找到品牌"${targetBrand}"的组织ID映射\n\n目前支持的品牌有：${brandList}\n\n请使用正确的品牌名称重试。`,
          };
        }

        // 构建请求体
        const requestBody = {
          organizationIds: [organizationId],
          pageNum,
          pageSize,
        };

        // 调用API
        const response = await fetch(
          "https://k8s.duliday.com/persistence/a/job-requirement/hiring/list/v2",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "duliday-token": dulidayToken,
            },
            body: JSON.stringify(requestBody),
          }
        );

        if (!response.ok) {
          throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
        }

        const rawData = await response.json();

        // 使用 zod 验证响应数据
        const parseResult = jobListResponseSchema.safeParse(rawData);
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

        // 格式化返回结果
        let jobs: JobItem[] = data.data?.result || [];

        if (jobs.length === 0) {
          return {
            type: "text" as const,
            text: `未找到${targetBrand}的在招岗位`,
          };
        }

        // 过滤结果
        if (storeName) {
          jobs = jobs.filter(
            job => job.storeName?.includes(storeName) || job.jobName?.includes(storeName)
          );
        }

        if (regionName) {
          jobs = jobs.filter(
            job =>
              job.storeRegionName?.includes(regionName) ||
              job.storeAddress?.includes(regionName) ||
              job.jobAddress?.includes(regionName)
          );
        }

        if (laborForm) {
          jobs = jobs.filter(job => job.laborFormName === laborForm);
        }

        if (jobNickName) {
          // 使用宽松的匹配逻辑，支持部分匹配
          const normalizedSearch = jobNickName.toLowerCase().trim();
          jobs = jobs.filter(job => {
            const normalizedJobNickName = (job.jobNickName || "").toLowerCase();
            const normalizedJobName = (job.jobName || "").toLowerCase();

            // 支持多种匹配方式：
            // 1. jobNickName 包含搜索关键词
            // 2. 搜索关键词包含 jobNickName
            // 3. jobName 中包含搜索关键词（作为后备）
            return (
              normalizedJobNickName.includes(normalizedSearch) ||
              normalizedSearch.includes(normalizedJobNickName) ||
              normalizedJobName.includes(normalizedSearch)
            );
          });
        }

        if (jobs.length === 0) {
          let filterMsg = `未找到符合条件的岗位\n\n查询条件：\n- 品牌：${targetBrand}`;
          if (storeName) filterMsg += `\n- 门店：包含"${storeName}"`;
          if (regionName) filterMsg += `\n- 地区：${regionName}`;
          if (laborForm) filterMsg += `\n- 类型：${laborForm}`;
          if (jobNickName) filterMsg += `\n- 岗位速记：${jobNickName}`;
          return {
            type: "text" as const,
            text: filterMsg,
          };
        }

        // 构建岗位列表信息
        let message = `✅ ${targetBrand} 在招岗位`;
        if (storeName || regionName || laborForm || jobNickName) {
          message += "（已筛选）";
        }
        message += `：共 ${jobs.length} 个\n\n`;

        jobs.forEach((job, index) => {
          message += `${index + 1}. ${job.jobName}\n`;
          if (job.jobNickName) {
            message += `   📝 岗位速记：${job.jobNickName}\n`;
          }
          message += `   📍 门店：${job.storeName} (${job.storeCityName} ${job.storeRegionName})\n`;
          message += `   💰 薪资：${job.salary} ${job.salaryUnitName}`;
          if (job.minComprehensiveSalary && job.maxComprehensiveSalary) {
            message += ` (综合月薪：${job.minComprehensiveSalary}-${job.maxComprehensiveSalary}元)`;
          }
          message += `\n`;
          message += `   👥 招聘人数：${job.requirementNum}人\n`;
          message += `   🏷️ 工作类型：${job.laborFormName} - ${job.jobTypeName}\n`;
          if (job.minAge && job.maxAge) {
            message += `   👤 年龄要求：${job.minAge}-${job.maxAge}岁\n`;
          }
          // 重要：包含必要的ID信息供其他工具使用
          message += `   📝 面试预约信息：\n`;
          message += `      - 岗位ID (jobId): ${job.jobId}\n`;
          message += `      - 基础信息ID (jobBasicInfoId): ${job.jobBasicInfoId}\n`;
          message += `\n`;
        });

        // 添加使用提示
        message += `\n💡 提示：\n`;
        message += `- 使用岗位ID (jobId) 进行面试预约\n`;
        message += `- 使用基础信息ID (jobBasicInfoId) 查询岗位详情`;

        return {
          type: "text" as const,
          text: message,
        };
      } catch (error) {
        console.error("获取岗位列表失败:", error);
        return {
          type: "text" as const,
          text: `❌ 获取岗位列表失败: ${error instanceof Error ? error.message : "未知错误"}`,
        };
      }
    },
  });
