import { tool } from "ai";
import { z } from 'zod/v3';
import { aiJobListResponseSchema, type AIJobItem } from "./ai-job-types";

/**
 * API 端点
 */
const API_URL = "https://k8s.duliday.com/persistence/ai/api/job/list";

/**
 * 固定分页参数
 */
const DEFAULT_PAGE_NUM = 1;
const DEFAULT_PAGE_SIZE = 15;

/**
 * 输入参数 Schema
 */
const inputSchema = z.object({
  cityNameList: z
    .array(z.string())
    .optional()
    .default([])
    .describe('城市列表，如 ["上海市", "北京市"]'),
  regionNameList: z
    .array(z.string())
    .optional()
    .default([])
    .describe('区域列表，如 ["浦东新区", "静安区"]'),
  brandAliasList: z
    .array(z.string())
    .optional()
    .default([])
    .describe('品牌别名列表，如 ["肯德基", "必胜客"]'),
});

/**
 * 格式化薪资信息
 */
function formatSalaryInfo(job: AIJobItem): string {
  const salary = job.jobSalary;
  if (!salary) return "- **薪资信息**: 暂无\n";

  const lines: string[] = [];

  // 正式薪资场景
  const scenario = salary.salaryScenarioList?.[0];
  if (scenario) {
    if (scenario.basicSalary && scenario.basicSalaryUnit) {
      lines.push(`- **基本薪资**: ${scenario.basicSalary} ${scenario.basicSalaryUnit}`);
    }

    if (scenario.minComprehensiveSalary && scenario.maxComprehensiveSalary) {
      lines.push(
        `- **综合薪资**: ${scenario.minComprehensiveSalary}-${scenario.maxComprehensiveSalary} ${scenario.comprehensiveSalaryUnit || "元/月"}`
      );
    }

    if (scenario.salaryPeriod && scenario.payday) {
      lines.push(`- **结算周期**: ${scenario.salaryPeriod}，${scenario.payday}发薪`);
    }

    // 阶梯薪资
    if (scenario.hasStairSalary === "有阶梯薪资" && scenario.stairSalaries?.length) {
      const stairInfo = scenario.stairSalaries
        .map(s => `${s.fullWorkTime}${s.fullWorkTimeUnit}后${s.salary}${s.salaryUnit}`)
        .join("；");
      lines.push(`- **阶梯薪资**: ${stairInfo}`);
    }

    // 节假日薪资
    if (scenario.holidaySalary?.holidaySalaryType !== "无薪资" && scenario.holidaySalary) {
      const holiday = scenario.holidaySalary;
      if (holiday.holidayFixedSalary) {
        lines.push(`- **节假日薪资**: ${holiday.holidayFixedSalary} ${holiday.holidayFixedSalaryUnit || ""}`);
      }
    }

    // 加班薪资
    if (scenario.overtimeSalary?.overtimeSalaryType !== "无薪资" && scenario.overtimeSalary) {
      const overtime = scenario.overtimeSalary;
      if (overtime.overtimeFixedSalary) {
        lines.push(`- **加班薪资**: ${overtime.overtimeFixedSalary} ${overtime.overtimeFixedSalaryUnit || ""}`);
      }
    }
  }

  // 试用期薪资
  if (salary.probationSalary?.salary) {
    lines.push(
      `- **试用期薪资**: ${salary.probationSalary.salary} ${salary.probationSalary.salaryUnit || ""}`
    );
  }

  return lines.length > 0 ? lines.join("\n") + "\n" : "- **薪资信息**: 暂无\n";
}

/**
 * 格式化福利信息
 */
function formatWelfareInfo(job: AIJobItem): string {
  const welfare = job.welfare;
  if (!welfare) return "";

  const items: string[] = [];

  if (welfare.catering && welfare.catering !== "无餐饮福利") {
    items.push(welfare.catering);
  }
  if (welfare.accommodation && welfare.accommodation !== "无住宿福利") {
    items.push(welfare.accommodation);
  }
  if (welfare.haveInsurance) {
    items.push(welfare.haveInsurance);
  }
  if (welfare.otherWelfare?.length) {
    const others = welfare.otherWelfare.filter(w => w && w.trim());
    if (others.length) items.push(...others);
  }

  if (items.length > 0) {
    return `- **福利**: ${items.join("，")}\n`;
  }
  return "";
}

/**
 * 格式化招聘要求
 */
function formatRequirements(job: AIJobItem): string {
  const req = job.hiringRequirement;
  if (!req) return "";

  const lines: string[] = [];

  // 年龄要求
  const basic = req.basicPersonalRequirements;
  if (basic?.minAge || basic?.maxAge) {
    lines.push(`- **年龄**: ${basic.minAge || "不限"}-${basic.maxAge || "不限"}岁`);
  }

  // 学历要求
  if (req.certificate?.education && req.certificate.education !== "不限") {
    lines.push(`- **学历**: ${req.certificate.education}及以上`);
  }

  // 健康证
  if (req.certificate?.healthCertificate) {
    lines.push(`- **健康证**: 需要${req.certificate.healthCertificate}`);
  }

  // 其他要求
  if (req.remark) {
    lines.push(`- **其他要求**: ${req.remark.replace(/\n/g, "；")}`);
  }

  return lines.join("\n") + "\n";
}

/**
 * 格式化工作时间
 */
function formatWorkTime(job: AIJobItem): string {
  const wt = job.workTime;
  if (!wt) return "";

  const lines: string[] = [];

  // 就业形式
  if (wt.employmentForm) {
    lines.push(`- **就业形式**: ${wt.employmentForm}`);
  }

  // 临时工周期
  if (wt.temporaryEmployment?.temporaryEmploymentStartTime) {
    const start = wt.temporaryEmployment.temporaryEmploymentStartTime.split("T")[0];
    const end = wt.temporaryEmployment.temporaryEmploymentEndTime?.split("T")[0] || "";
    lines.push(`- **工作周期**: ${start} 至 ${end}`);
  }

  // 每周工作天数
  if (wt.weekWorkTime?.perWeekWorkDays) {
    lines.push(`- **每周工作**: ${wt.weekWorkTime.perWeekWorkDays}天`);
  }

  // 每日工时
  if (wt.dayWorkTime?.perDayMinWorkHours) {
    lines.push(`- **每日工时**: ${wt.dayWorkTime.perDayMinWorkHours}小时`);
  }

  // 排班时间
  if (wt.dailyShiftSchedule?.fixedScheduleList?.length) {
    const shifts = wt.dailyShiftSchedule.fixedScheduleList
      .map(s => `${s.fixedShiftStartTime}-${s.fixedShiftEndTime}`)
      .join("、");
    lines.push(`- **排班**: ${shifts}`);
  }

  return lines.join("\n") + "\n";
}

/**
 * 格式化面试信息
 */
function formatInterviewInfo(job: AIJobItem): string {
  const ip = job.interviewProcess;
  if (!ip) return "";

  const lines: string[] = [];

  // 面试轮数
  if (ip.interviewTotal) {
    lines.push(`- **面试轮数**: ${ip.interviewTotal}轮`);
  }

  // 面试方式
  if (ip.firstInterview?.firstInterviewWay) {
    lines.push(`- **面试方式**: ${ip.firstInterview.firstInterviewWay}`);
  }

  // 面试时间
  const firstInterview = ip.firstInterview;
  if (firstInterview?.fixedInterviewTimes?.length) {
    lines.push("- **面试时间**:");
    firstInterview.fixedInterviewTimes.slice(0, 5).forEach(ft => {
      const times = ft.interviewTimes
        ?.map(t => `${t.interviewStartTime}-${t.interviewEndTime}`)
        .join("、");
      lines.push(`  - ${ft.interviewDate} ${times}`);
    });
    if (firstInterview.fixedInterviewTimes.length > 5) {
      lines.push(`  - ...还有 ${firstInterview.fixedInterviewTimes.length - 5} 个时间段`);
    }
  } else if (firstInterview?.periodicInterviewTimes?.length) {
    lines.push("- **面试时间**:");
    firstInterview.periodicInterviewTimes.forEach(pt => {
      const times = pt.interviewTimes
        ?.map(t => `${t.interviewStartTime}-${t.interviewEndTime}`)
        .join("、");
      lines.push(`  - ${pt.interviewWeekday} ${times}`);
    });
  }

  // 试工信息
  if (ip.probationWork?.probationWorkPeriod) {
    lines.push(
      `- **试工**: ${ip.probationWork.probationWorkPeriod}${ip.probationWork.probationWorkPeriodUnit || "天"}${ip.probationWork.probationWorkAssessment || ""}`
    );
  }

  // 流程说明
  if (ip.processDesc) {
    lines.push(`- **流程说明**: ${ip.processDesc.replace(/\n/g, "；")}`);
  }

  return lines.join("\n") + "\n";
}

/**
 * 格式化单个岗位为 Markdown
 */
function formatJobToMarkdown(job: AIJobItem, index: number): string {
  const basicInfo = job.basicInfo;
  const store = basicInfo.storeInfo;

  let md = `## ${index + 1}. ${basicInfo.jobName || "未命名岗位"}\n\n`;

  // 基本信息
  md += "### 基本信息\n";
  if (basicInfo.brandName) {
    md += `- **品牌**: ${basicInfo.brandName}\n`;
  }
  if (store?.storeName) {
    md += `- **门店**: ${store.storeName}\n`;
  }
  if (store?.storeAddress) {
    md += `- **地址**: ${store.storeCityName || ""} ${store.storeRegionName || ""} ${store.storeAddress.split("-").pop() || ""}\n`;
  }
  if (basicInfo.jobCategoryName) {
    md += `- **岗位类型**: ${basicInfo.jobCategoryName}\n`;
  }
  if (basicInfo.laborForm) {
    md += `- **工作形式**: ${basicInfo.laborForm}\n`;
  }
  if (basicInfo.jobContent) {
    md += `- **工作内容**: ${basicInfo.jobContent.replace(/\n/g, "；").slice(0, 100)}${basicInfo.jobContent.length > 100 ? "..." : ""}\n`;
  }
  md += "\n";

  // 薪资福利
  md += "### 薪资福利\n";
  md += formatSalaryInfo(job);
  md += formatWelfareInfo(job);
  md += "\n";

  // 招聘要求
  const requirements = formatRequirements(job);
  if (requirements) {
    md += "### 招聘要求\n";
    md += requirements;
    md += "\n";
  }

  // 工作时间
  const workTime = formatWorkTime(job);
  if (workTime) {
    md += "### 工作时间\n";
    md += workTime;
    md += "\n";
  }

  // 面试信息
  const interview = formatInterviewInfo(job);
  if (interview) {
    md += "### 面试信息\n";
    md += interview;
    md += "\n";
  }

  // 预约信息
  md += "### 预约信息\n";
  md += `- **jobId**: ${basicInfo.jobId}\n`;
  md += "\n";

  return md;
}

/**
 * 格式化岗位列表为 Markdown
 */
function formatJobsToMarkdown(jobs: AIJobItem[], total: number, pageNum: number, pageSize: number): string {
  const start = (pageNum - 1) * pageSize + 1;
  const end = Math.min(start + jobs.length - 1, total);

  let md = "# 岗位查询结果\n\n";
  md += `共找到 ${total} 个岗位，当前显示第 ${start}-${end} 条\n\n`;
  md += "---\n\n";

  jobs.forEach((job, index) => {
    md += formatJobToMarkdown(job, index);
    md += "---\n\n";
  });

  return md;
}

/**
 * Duliday 获取岗位列表工具 (LLM 优化版)
 *
 * @description 调用清洗后的 API 获取岗位列表，返回 Markdown 格式化文本
 * @param customToken 自定义的 Duliday token
 * @returns AI SDK tool instance
 */
export const dulidayJobListForLlmTool = (customToken?: string) =>
  tool({
    description: `查询在招岗位列表。根据求职者的城市、区域、品牌偏好筛选匹配的岗位。
返回结构化的岗位信息，包含薪资、招聘要求、工作时间、面试安排等完整信息。
适用于自动回复求职者场景，帮助 LLM 了解岗位详情以生成个性化回复。`,
    inputSchema,
    execute: async ({ cityNameList, regionNameList, brandAliasList }) => {
      console.log("🔍 duliday_job_list_for_llm tool called with:", {
        cityNameList,
        regionNameList,
        brandAliasList,
      });

      try {
        // 获取 token
        const dulidayToken = customToken || process.env.DULIDAY_TOKEN;
        if (!dulidayToken) {
          return {
            type: "text" as const,
            text: "❌ 缺少 DULIDAY_TOKEN，请在设置中配置或设置环境变量",
          };
        }

        // 构建请求体
        const requestBody = {
          pageNum: DEFAULT_PAGE_NUM,
          pageSize: DEFAULT_PAGE_SIZE,
          cityNameList,
          regionNameList,
          brandAliasList,
        };

        // 调用 API
        const response = await fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Duliday-Token": dulidayToken,
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw new Error(`API 请求失败: ${response.status} ${response.statusText}`);
        }

        const rawData = await response.json();

        // 使用 Zod 验证响应数据
        const parseResult = aiJobListResponseSchema.safeParse(rawData);
        if (!parseResult.success) {
          console.error("响应数据格式错误:", parseResult.error);
          return {
            type: "text" as const,
            text: "❌ API 响应格式错误，请联系管理员",
          };
        }

        const data = parseResult.data;

        // 检查响应状态
        if (data.code !== 0) {
          return {
            type: "text" as const,
            text: `❌ API 返回错误: ${data.message || "未知错误"}`,
          };
        }

        // 检查数据
        const jobs = data.data?.result || [];
        const total = data.data?.total || 0;

        if (jobs.length === 0) {
          let filterMsg = "未找到符合条件的岗位\n\n查询条件：";
          if (cityNameList.length > 0) filterMsg += `\n- 城市：${cityNameList.join("、")}`;
          if (regionNameList.length > 0) filterMsg += `\n- 区域：${regionNameList.join("、")}`;
          if (brandAliasList.length > 0) filterMsg += `\n- 品牌：${brandAliasList.join("、")}`;
          if (cityNameList.length === 0 && regionNameList.length === 0 && brandAliasList.length === 0) {
            filterMsg += "\n- 无筛选条件（查询全部）";
          }
          return {
            type: "text" as const,
            text: filterMsg,
          };
        }

        // 格式化为 Markdown
        const markdown = formatJobsToMarkdown(jobs, total, DEFAULT_PAGE_NUM, DEFAULT_PAGE_SIZE);

        return {
          type: "text" as const,
          text: markdown,
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
