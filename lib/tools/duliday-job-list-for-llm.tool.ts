import { tool } from "ai";
import { z } from "zod/v3";
import { encode } from "@toon-format/toon";
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
 *
 * 渐进式披露设计：通过 6 个布尔开关控制返回的数据字段
 * - 默认只返回基本信息（极简模式），Token 消耗极低
 * - 按需开启其他开关，获取更详细的信息
 */
const inputSchema = z.object({
  // ========== 筛选条件 ==========
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
    .describe('品牌别名列表，如 ["肯德基", "KFC"]'),
  storeNameList: z
    .array(z.string())
    .optional()
    .default([])
    .describe('门店名称列表，如 ["浦东陆家嘴店"]，支持模糊匹配'),
  jobCategoryList: z
    .array(z.string())
    .optional()
    .default([])
    .describe('岗位类型列表，如 ["服务员", "收银员"]'),
  jobIdList: z
    .array(z.string())
    .optional()
    .default([])
    .describe('岗位ID列表，用于查询特定岗位'),

  // ========== 渐进式披露：布尔开关 ==========
  includeBasicInfo: z
    .boolean()
    .optional()
    .default(true)
    .describe('返回基本信息（品牌、门店、岗位名、地址等）- 默认true'),
  includeJobSalary: z
    .boolean()
    .optional()
    .default(false)
    .describe('返回薪资信息（基本薪资、综合薪资、结算周期等）'),
  includeWelfare: z
    .boolean()
    .optional()
    .default(false)
    .describe('返回福利信息（餐饮、住宿、保险等）'),
  includeHiringRequirement: z
    .boolean()
    .optional()
    .default(false)
    .describe('返回招聘要求（性别、年龄、身高、学历等）'),
  includeWorkTime: z
    .boolean()
    .optional()
    .default(false)
    .describe('返回工作时间/班次（就业形式、每周工时、排班等）'),
  includeInterviewProcess: z
    .boolean()
    .optional()
    .default(false)
    .describe('返回面试流程（面试轮数、时间、地址、试工、培训等）'),
});

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 渐进式披露布尔开关
 */
interface ProgressiveDisclosureFlags {
  includeBasicInfo: boolean;
  includeJobSalary: boolean;
  includeWelfare: boolean;
  includeHiringRequirement: boolean;
  includeWorkTime: boolean;
  includeInterviewProcess: boolean;
}

/**
 * 工具返回结果
 */
export interface JobListForLlmResult {
  /** 格式化后的 Markdown 文本，适合直接展示给 LLM */
  markdown: string;
  /** API 返回的原始 JSON 数据 */
  rawData: {
    result: AIJobItem[];
    total: number;
  } | null;
  /** 使用 TOON 格式压缩后的数据（Token 消耗约减少 40%） */
  toon: string;
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 判断值是否有效（非 null、非 undefined、非空字符串、非空数组）
 */
function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "number") return true;
  return true;
}

/**
 * 安全拼接多个字段，过滤空值
 */
function joinParts(parts: (string | null | undefined)[], separator = " "): string {
  return parts.filter(p => hasValue(p)).join(separator);
}

/**
 * 清洗文本（去除内部指令、多余标点、空白等）
 */
function cleanText(text: string): string {
  if (!text) return "";
  return text
    .replace(/辛苦跟.*?[。！？]/g, "") // 去除 "辛苦跟候选人讲清楚" 等
    .replace(/务必.*?[。！？]/g, "") // 去除 "务必..." 等
    .replace(/手动输入/g, "")
    .replace(/！{2,}/g, "！") // 降噪感叹号
    .replace(/[\n\r]+/g, "；") // 换行转分号
    .replace(/；{2,}/g, "；") // 去重分号
    .replace(/^；+|；+$/g, ""); // 去除首尾分号
}

/**
 * 添加一行输出（如果值有效）
 */
function addLine(lines: string[], label: string, value: string | null | undefined): void {
  if (hasValue(value) && typeof value === "string") {
    const cleaned = cleanText(value);
    if (cleaned) {
      lines.push(`- **${label}**: ${cleaned}`);
    }
  } else if (hasValue(value)) {
    lines.push(`- **${label}**: ${value}`);
  }
}

// ============================================================================
// 薪资信息格式化
// ============================================================================

function formatSalaryInfo(job: AIJobItem): string {
  const salary = job.jobSalary;
  if (!salary) return "";

  const lines: string[] = [];

  salary.salaryScenarioList?.forEach((scenario) => {
    const salaryType = scenario.salaryType;
    const stagePrefix = salaryType ? `${salaryType}期` : "";

    const basicSalaryObj = scenario.basicSalary;
    if (basicSalaryObj && hasValue(basicSalaryObj.basicSalary)) {
      const basicStr = `${basicSalaryObj.basicSalary}${basicSalaryObj.basicSalaryUnit || "元"}`;
      addLine(lines, `${stagePrefix}基本薪资`, basicStr);
    }

    const compSalaryObj = scenario.comprehensiveSalary;
    if (compSalaryObj && (hasValue(compSalaryObj.minComprehensiveSalary) || hasValue(compSalaryObj.maxComprehensiveSalary))) {
      const min = compSalaryObj.minComprehensiveSalary ?? "?";
      const max = compSalaryObj.maxComprehensiveSalary ?? "?";
      const unit = compSalaryObj.comprehensiveSalaryUnit || "元/月";
      addLine(lines, `${stagePrefix}综合薪资`, `${min}-${max} ${unit}`);
    }

    const periodParts = [scenario.salaryPeriod, scenario.payday ? `${scenario.payday}发薪` : null];
    const periodStr = joinParts(periodParts, "，");
    if (periodStr) {
      addLine(lines, `${stagePrefix}结算周期`, periodStr);
    }

    if (scenario.stairSalaries?.length) {
      const stairInfo = scenario.stairSalaries
        .filter(s => hasValue(s.salary))
        .map(s => {
          const threshold = hasValue(s.fullWorkTime)
            ? `超过${s.fullWorkTime}${s.fullWorkTimeUnit || ""} `
            : "";
          const desc = s.description ? `(${s.description})` : "";
          return `${threshold}${desc}按 ${s.salary}${s.salaryUnit || "元"} 结算`;
        })
        .join("；");
      if (stairInfo) {
        addLine(lines, `${stagePrefix}阶梯薪资`, stairInfo);
      }
    }

    const holiday = scenario.holidaySalary;
    if (holiday && holiday.holidaySalaryType !== "无薪资") {
      let holidayStr = "";
      if (hasValue(holiday.holidayFixedSalary)) {
        holidayStr = `${holiday.holidayFixedSalary}${holiday.holidayFixedSalaryUnit || "元"}`;
      } else if (hasValue(holiday.holidaySalaryMultiple)) {
        holidayStr = `${holiday.holidaySalaryMultiple}倍`;
      }
      if (hasValue(holiday.holidaySalaryDesc)) {
        holidayStr = joinParts([holidayStr, `(${holiday.holidaySalaryDesc})`]);
      }
      if (holidayStr) {
        addLine(lines, `${stagePrefix}节假日薪资`, holidayStr);
      }
    }

    const overtime = scenario.overtimeSalary;
    if (overtime && overtime.overtimeSalaryType !== "无薪资") {
      let overtimeStr = "";
      if (hasValue(overtime.overtimeFixedSalary)) {
        overtimeStr = `${overtime.overtimeFixedSalary}${overtime.overtimeFixedSalaryUnit || "元"}`;
      } else if (hasValue(overtime.overtimeSalaryMultiple)) {
        overtimeStr = `${overtime.overtimeSalaryMultiple}倍`;
      }
      if (hasValue(overtime.overtimeSalaryDesc)) {
        overtimeStr = joinParts([overtimeStr, `(${overtime.overtimeSalaryDesc})`]);
      }
      if (overtimeStr) {
        addLine(lines, `${stagePrefix}加班薪资`, overtimeStr);
      }
    }

    const other = scenario.otherSalary;
    if (other) {
      if (hasValue(other.commission)) {
        addLine(lines, `${stagePrefix}提成`, other.commission);
      }
      if (hasValue(other.attendanceSalary)) {
        addLine(
          lines,
          `${stagePrefix}全勤奖`,
          `${other.attendanceSalary}${other.attendanceSalaryUnit || "元"}`
        );
      }
      if (hasValue(other.performance)) {
        addLine(lines, `${stagePrefix}绩效`, other.performance);
      }
    }

    scenario.customSalaries?.forEach(custom => {
      if (hasValue(custom.name) && hasValue(custom.salary)) {
        addLine(lines, `${stagePrefix}${custom.name}`, custom.salary);
      }
    });
  });

  const probation = salary.probationSalary;
  if (probation) {
    if (hasValue(probation.salary)) {
      let probStr = `${probation.salary}${probation.salaryUnit || "元"}`;
      if (hasValue(probation.salaryDescription)) {
        probStr += `（${probation.salaryDescription}）`;
      }
      addLine(lines, "试工期薪资", probStr);
    } else if (hasValue(probation.salaryDescription)) {
      addLine(lines, "试工期说明", probation.salaryDescription);
    }
  }

  return lines.length > 0 ? lines.join("\n") + "\n" : "";
}

// ============================================================================
// 福利信息格式化
// ============================================================================

function formatWelfareInfo(job: AIJobItem): string {
  const welfare = job.welfare;
  if (!welfare) return "";

  const lines: string[] = [];

  if (hasValue(welfare.catering) && welfare.catering !== "无餐饮福利") {
    let cateringStr = welfare.catering;
    if (hasValue(welfare.cateringSalary)) {
      cateringStr += `（餐补${welfare.cateringSalary}${welfare.cateringSalaryUnit || "元"}）`;
    }
    addLine(lines, "餐饮", cateringStr);
  }

  if (hasValue(welfare.accommodation) && welfare.accommodation !== "无住宿福利") {
    let accStr = welfare.accommodation;
    if (hasValue(welfare.accommodationAllowance)) {
      accStr += `（补贴${welfare.accommodationAllowance}${welfare.accommodationAllowanceUnit || "元"}`;
      if (hasValue(welfare.probationAccommodationAllowanceReceive)) {
        accStr += `，试用期${welfare.probationAccommodationAllowanceReceive}`;
      }
      accStr += "）";
    }
    addLine(lines, "住宿", accStr);
  }

  if (hasValue(welfare.trafficAllowanceSalary)) {
    addLine(
      lines,
      "交通补贴",
      `${welfare.trafficAllowanceSalary}${welfare.trafficAllowanceSalaryUnit || "元"}`
    );
  }

  if (hasValue(welfare.haveInsurance)) {
    addLine(lines, "保险", welfare.haveInsurance);
  }

  if (hasValue(welfare.promotionWelfare)) {
    addLine(lines, "晋升", welfare.promotionWelfare);
  }

  const otherWelfareItems = welfare.otherWelfare?.filter(w => hasValue(w));
  if (otherWelfareItems?.length) {
    addLine(lines, "其他福利", otherWelfareItems.join("、"));
  }

  if (hasValue(welfare.memo)) {
    addLine(lines, "福利说明", welfare.memo);
  }

  return lines.length > 0 ? lines.join("\n") + "\n" : "";
}

// ============================================================================
// 招聘要求格式化
// ============================================================================

function formatRequirements(job: AIJobItem): string {
  const req = job.hiringRequirement;
  if (!req) return "";

  const lines: string[] = [];

  const basic = req.basicPersonalRequirements;
  if (basic) {
    if (hasValue(basic.genderRequirement) && basic.genderRequirement !== "不限") {
      addLine(lines, "性别", basic.genderRequirement);
    }

    if (hasValue(basic.minAge) || hasValue(basic.maxAge)) {
      const ageStr = `${basic.minAge ?? "不限"}-${basic.maxAge ?? "不限"}岁`;
      addLine(lines, "年龄", ageStr);
    }

    const heightParts: string[] = [];
    if (hasValue(basic.manMinHeight) || hasValue(basic.manMaxHeight)) {
      const manHeight = joinParts(
        [
          basic.manMinHeight ? `${basic.manMinHeight}cm` : null,
          basic.manMaxHeight ? `${basic.manMaxHeight}cm` : null,
        ],
        "-"
      );
      if (manHeight) heightParts.push(`男${manHeight}`);
    }
    if (hasValue(basic.womanMinHeight) || hasValue(basic.womanMaxHeight)) {
      const womanHeight = joinParts(
        [
          basic.womanMinHeight ? `${basic.womanMinHeight}cm` : null,
          basic.womanMaxHeight ? `${basic.womanMaxHeight}cm` : null,
        ],
        "-"
      );
      if (womanHeight) heightParts.push(`女${womanHeight}`);
    }
    if (heightParts.length > 0) {
      addLine(lines, "身高", heightParts.join("，"));
    }
  }

  if (hasValue(req.figure)) {
    addLine(lines, "形象", req.figure);
  }

  const cert = req.certificate;
  if (cert) {
    if (hasValue(cert.education) && cert.education !== "不限") {
      addLine(lines, "学历", `${cert.education}及以上`);
    }
    if (hasValue(cert.healthCertificate)) {
      addLine(lines, "健康证", cert.healthCertificate);
    }
    if (hasValue(cert.certificates)) {
      addLine(lines, "证书", cert.certificates);
    }
    if (hasValue(cert.driverLicenseType)) {
      addLine(lines, "驾照", cert.driverLicenseType);
    }
  }

  const hometown = req.requirementsForHometown;
  if (hometown) {
    if (hasValue(hometown.nationRequirementType) && hometown.nationRequirementType !== "不限") {
      let nationStr = hometown.nationRequirementType;
      if (hometown.nations?.length) {
        nationStr += `：${hometown.nations.join("、")}`;
      }
      addLine(lines, "民族", nationStr);
    }

    if (
      hasValue(hometown.nativePlaceRequirementType) &&
      hometown.nativePlaceRequirementType !== "不限"
    ) {
      let placeStr = hometown.nativePlaceRequirementType;
      if (hometown.nativePlaces?.length) {
        placeStr += `：${hometown.nativePlaces.join("、")}`;
      }
      addLine(lines, "籍贯", placeStr);
    }

    if (hasValue(hometown.countryRequirementType) && hometown.countryRequirementType !== "不限") {
      addLine(lines, "国籍", hometown.countryRequirementType);
    }
  }

  const marriage = req.marriageBearingAndSocialSecurity;
  if (marriage) {
    if (hasValue(marriage.marriageBearing) || hasValue(marriage.marriageBearingType)) {
      const marStr = joinParts([marriage.marriageBearingType, marriage.marriageBearing], "：");
      if (marStr && marStr !== "不限") {
        addLine(lines, "婚育", marStr);
      }
    }

    if (
      hasValue(marriage.socialSecurityRequirementType) &&
      marriage.socialSecurityRequirementType !== "不限"
    ) {
      let ssStr = marriage.socialSecurityRequirementType;
      if (hasValue(marriage.socialSecurityList)) {
        ssStr += `：${marriage.socialSecurityList}`;
      }
      addLine(lines, "社保", ssStr);
    }
  }

  const comp = req.competencyRequirements;
  if (comp) {
    if (hasValue(comp.workExperienceJobType)) {
      let expStr = comp.workExperienceJobType;
      if (hasValue(comp.minWorkTime)) {
        const unitMap: Record<number, string> = { 1: "月", 2: "年" };
        const unit = comp.minWorkTimeUnit ? unitMap[comp.minWorkTimeUnit] || "" : "";
        expStr += `（至少${comp.minWorkTime}${unit}）`;
      }
      addLine(lines, "工作经验", expStr);
    }
  }

  const lang = req.language;
  if (lang) {
    if (hasValue(lang.languages)) {
      let langStr = lang.languages;
      if (hasValue(lang.languageRemark)) {
        langStr += `（${lang.languageRemark}）`;
      }
      addLine(lines, "语言", langStr);
    }
  }

  if (req.remark) {
    addLine(lines, "其他要求", req.remark);
  }

  return lines.length > 0 ? lines.join("\n") + "\n" : "";
}

// ============================================================================
// 工作时间格式化
// ============================================================================

function formatWorkTime(job: AIJobItem): string {
  const wt = job.workTime;
  if (!wt) return "";

  const lines: string[] = [];

  if (hasValue(wt.employmentForm)) {
    let formStr = wt.employmentForm;
    if (hasValue(wt.employmentDescription)) {
      formStr += `（${wt.employmentDescription}）`;
    }
    addLine(lines, "就业形式", formStr);
  }

  if (hasValue(wt.minWorkMonths)) {
    addLine(lines, "最少工作", `${wt.minWorkMonths}个月`);
  }

  const temp = wt.temporaryEmployment;
  if (temp && hasValue(temp.temporaryEmploymentStartTime)) {
    const start = temp.temporaryEmploymentStartTime?.split("T")[0] || "";
    const end = temp.temporaryEmploymentEndTime?.split("T")[0] || "";
    addLine(lines, "工作周期", `${start} 至 ${end}`);
  }

  const week = wt.weekWorkTime;
  if (week) {
    const weekParts: string[] = [];
    if (hasValue(week.perWeekWorkDays)) {
      weekParts.push(`每周${week.perWeekWorkDays}天`);
    }
    if (hasValue(week.perWeekRestDays)) {
      weekParts.push(`休${week.perWeekRestDays}天`);
    }
    if (week.workSingleDouble) {
      weekParts.push(week.workSingleDouble);
    }
    if (hasValue(week.perWeekNeedWorkDays)) {
      weekParts.push(`需工作${week.perWeekNeedWorkDays}天`);
    }
    if (week.weekWorkTimeRequirement) {
      weekParts.push(week.weekWorkTimeRequirement);
    }
    if (weekParts.length > 0) {
      addLine(lines, "每周工时", weekParts.join("，"));
    }

    week.customnWorkTimeList?.forEach(custom => {
      if (custom.customWorkWeekdays?.length) {
        const daysStr = custom.customWorkWeekdays.join("、");
        const rangeStr =
          hasValue(custom.customMinWorkDays) && hasValue(custom.customMaxWorkDays)
            ? `（${custom.customMinWorkDays}-${custom.customMaxWorkDays}天）`
            : "";
        addLine(lines, "可选工作日", `${daysStr}${rangeStr}`);
      }
    });
  }

  const month = wt.monthWorkTime;
  if (month) {
    if (hasValue(month.perMonthMinWorkTime)) {
      const unit = month.perMonthMinWorkTimeUnit ?? "";
      addLine(lines, "每月最少出勤", `${month.perMonthMinWorkTime}${unit}`);
    }
    if (hasValue(month.perMonthMaxRestTime)) {
      addLine(lines, "每月最多休息", `${month.perMonthMaxRestTime}天`);
    }
    if (month.monthWorkTimeRequirement) {
      addLine(lines, "月工时要求", month.monthWorkTimeRequirement);
    }
  }

  const day = wt.dayWorkTime;
  if (day) {
    if (hasValue(day.perDayMinWorkHours)) {
      addLine(lines, "每日工时", `${day.perDayMinWorkHours}小时`);
    }
    if (hasValue(day.dayWorkTimeRequirement)) {
      addLine(lines, "日工时要求", day.dayWorkTimeRequirement);
    }
  }

  const hasWorkTimeRemark = hasValue(wt.workTimeRemark);

  const schedule = wt.dailyShiftSchedule;
  if (schedule) {
    if (hasValue(schedule.arrangementType)) {
      addLine(lines, "排班类型", schedule.arrangementType);
    }

    if (!hasWorkTimeRemark) {
      if (schedule.fixedScheduleList?.length) {
        const shifts = schedule.fixedScheduleList
          .filter(s => hasValue(s.fixedShiftStartTime) && hasValue(s.fixedShiftEndTime))
          .map(s => `${s.fixedShiftStartTime}-${s.fixedShiftEndTime}`)
          .join("、");
        if (shifts) {
          addLine(lines, "固定班次", shifts);
        }
      }

      if (schedule.combinedArrangement?.combinedArrangementList?.length) {
        const combined = schedule.combinedArrangement.combinedArrangementList
          .filter(s => hasValue(s.combinedShiftStartTime) && hasValue(s.combinedShiftEndTime))
          .map(s => `${s.combinedShiftStartTime}-${s.combinedShiftEndTime}`)
          .join("、");
        if (combined) {
          addLine(lines, "组合班次", combined);
        }
      }

      const fixed = schedule.fixedTime;
      if (fixed) {
        const goWork = joinParts([fixed.goToWorkStartTime, fixed.goToWorkEndTime], "-");
        const goOff = joinParts([fixed.goOffWorkStartTime, fixed.goOffWorkEndTime], "-");
        if (goWork || goOff) {
          addLine(
            lines,
            "弹性时间",
            joinParts([goWork ? `上班${goWork}` : null, goOff ? `下班${goOff}` : null], "，")
          );
        }
      }
    }
  }

  if (hasValue(wt.restTimeDesc)) {
    addLine(lines, "休息说明", wt.restTimeDesc);
  }

  if (hasWorkTimeRemark) {
    addLine(lines, "工时备注", wt.workTimeRemark);
  }

  return lines.length > 0 ? lines.join("\n") + "\n" : "";
}

// ============================================================================
// 面试信息格式化
// ============================================================================

function formatInterviewInfo(job: AIJobItem): string {
  const ip = job.interviewProcess;
  if (!ip) return "";

  const lines: string[] = [];

  if (hasValue(ip.interviewTotal)) {
    addLine(lines, "面试轮数", `${ip.interviewTotal}轮`);
  }

  const first = ip.firstInterview;
  if (first) {
    if (hasValue(first.firstInterviewWay)) {
      addLine(lines, "一面方式", first.firstInterviewWay);
    }
    if (hasValue(first.interviewAddress)) {
      addLine(lines, "一面地址", first.interviewAddress);
    }
    if (hasValue(first.interviewDemand)) {
      addLine(lines, "面试要求", first.interviewDemand);
    }
    if (hasValue(first.firstInterviewDesc)) {
      addLine(lines, "一面说明", first.firstInterviewDesc);
    }
    if (hasValue(first.fixedDeadline)) {
      addLine(lines, "报名截止", first.fixedDeadline);
    }
    if (hasValue(first.interviewTimeMode)) {
      addLine(lines, "时间模式", first.interviewTimeMode);
    }

    if (first.fixedInterviewTimes?.length) {
      lines.push("- **面试时间**:");
      first.fixedInterviewTimes.slice(0, 5).forEach(ft => {
        if (hasValue(ft.interviewDate)) {
          const times =
            ft.interviewTimes
              ?.filter(t => hasValue(t.interviewStartTime) && hasValue(t.interviewEndTime))
              .map(t => `${t.interviewStartTime}-${t.interviewEndTime}`)
              .join("、") || "";
          lines.push(`  - ${ft.interviewDate} ${times}`);
        }
      });
      if (first.fixedInterviewTimes.length > 5) {
        lines.push(`  - ...还有 ${first.fixedInterviewTimes.length - 5} 个时间段`);
      }
    }

    if (first.periodicInterviewTimes?.length) {
      lines.push("- **周期面试时间**:");
      first.periodicInterviewTimes.forEach(pt => {
        if (hasValue(pt.interviewWeekday)) {
          const times =
            pt.interviewTimes
              ?.filter(t => hasValue(t.interviewStartTime) && hasValue(t.interviewEndTime))
              .map(t => `${t.interviewStartTime}-${t.interviewEndTime}`)
              .join("、") || "";
          lines.push(`  - ${pt.interviewWeekday} ${times}`);
        }
      });
    }
  }

  const second = ip.secondInterview;
  if (second) {
    if (hasValue(second.secondInterviewWay)) {
      addLine(lines, "二面方式", second.secondInterviewWay);
    }
    if (hasValue(second.secondInterviewAddress)) {
      addLine(lines, "二面地址", second.secondInterviewAddress);
    }
    if (hasValue(second.secondInterviewDemand)) {
      addLine(lines, "二面要求", second.secondInterviewDemand);
    }
  }

  const third = ip.thirdInterview;
  if (third) {
    if (hasValue(third.thirdInterviewWay)) {
      addLine(lines, "三面方式", third.thirdInterviewWay);
    }
    if (hasValue(third.thirdInterviewAddress)) {
      addLine(lines, "三面地址", third.thirdInterviewAddress);
    }
    if (hasValue(third.thirdInterviewDemand)) {
      addLine(lines, "三面要求", third.thirdInterviewDemand);
    }
  }

  ip.interviewSupplement?.forEach(supp => {
    if (hasValue(supp.interviewSupplement)) {
      addLine(lines, "面试补充", supp.interviewSupplement);
    }
  });

  const probation = ip.probationWork;
  if (probation) {
    const probParts: string[] = [];
    if (hasValue(probation.probationWorkPeriod)) {
      probParts.push(
        `${probation.probationWorkPeriod}${probation.probationWorkPeriodUnit || "天"}`
      );
    }
    if (probation.probationWorkAssessment) {
      probParts.push(probation.probationWorkAssessment);
    }
    if (probation.probationWorkAssessmentText) {
      probParts.push(probation.probationWorkAssessmentText);
    }
    if (probParts.length > 0) {
      addLine(lines, "试工", probParts.join("，"));
    }
    if (hasValue(probation.probationWorkAddress)) {
      addLine(lines, "试工地址", probation.probationWorkAddress);
    }
  }

  const training = ip.training;
  if (training) {
    const trainParts: string[] = [];
    if (hasValue(training.trainingPeriod)) {
      trainParts.push(`${training.trainingPeriod}${training.trainingPeriodUnit || "天"}`);
    }
    if (training.trainingDesc) {
      trainParts.push(training.trainingDesc);
    }
    if (trainParts.length > 0) {
      addLine(lines, "培训", trainParts.join("，"));
    }
    if (hasValue(training.trainingAddress)) {
      addLine(lines, "培训地址", training.trainingAddress);
    }
  }

  if (ip.processDesc) {
    addLine(lines, "流程说明", ip.processDesc);
  }

  if (ip.remark) {
    addLine(lines, "面试备注", ip.remark);
  }

  return lines.length > 0 ? lines.join("\n") + "\n" : "";
}

// ============================================================================
// 岗位格式化
// ============================================================================

function formatJobToOneLine(job: AIJobItem, index: number): string {
  const basicInfo = job.basicInfo;
  const store = basicInfo.storeInfo;

  const brand = basicInfo.brandName || "";
  const jobName = basicInfo.jobName || "未命名岗位";
  const storeName = store?.storeName || "";
  const address = store?.storeAddress || "";

  const parts = [`${index + 1}. **${brand} - ${jobName}**`];
  if (storeName) parts.push(storeName);
  if (address) parts.push(address);

  return parts.join(" | ");
}

function formatBasicInfoSection(job: AIJobItem): string {
  const basicInfo = job.basicInfo;
  const store = basicInfo.storeInfo;
  const lines: string[] = [];

  if (hasValue(basicInfo.brandName)) {
    addLine(lines, "品牌", basicInfo.brandName);
  }

  if (store) {
    if (hasValue(store.storeName)) {
      addLine(lines, "门店", store.storeName);
    }
    if (hasValue(store.storeAddress)) {
      addLine(lines, "地址", store.storeAddress);
    }
  }

  if (hasValue(basicInfo.jobCategoryName)) {
    addLine(lines, "岗位类型", basicInfo.jobCategoryName);
  }

  if (hasValue(basicInfo.laborForm)) {
    addLine(lines, "用工形式", basicInfo.laborForm);
  }

  if (basicInfo.jobContent) {
    addLine(lines, "工作内容", basicInfo.jobContent);
  }

  if (hasValue(basicInfo.haveProbation) && basicInfo.haveProbation !== "无试用期") {
    addLine(lines, "试用期", basicInfo.haveProbation);
  }

  if (hasValue(basicInfo.needProbationWork) && basicInfo.needProbationWork !== "不需要试工") {
    addLine(lines, "试工", basicInfo.needProbationWork);
  }

  if (hasValue(basicInfo.needTraining) && basicInfo.needTraining !== "不需要培训") {
    addLine(lines, "培训", basicInfo.needTraining);
  }

  return lines.length > 0 ? "### 基本信息\n" + lines.join("\n") + "\n\n" : "";
}

function formatJobToMarkdown(
  job: AIJobItem,
  index: number,
  flags: ProgressiveDisclosureFlags
): string {
  const basicInfo = job.basicInfo;

  const titleParts = [basicInfo.jobName || "未命名岗位"];
  if (hasValue(basicInfo.jobNickName) && basicInfo.jobNickName !== basicInfo.jobName) {
    titleParts.push(`(${basicInfo.jobNickName})`);
  }
  let md = `## ${index + 1}. ${titleParts.join(" ")}\n\n`;

  if (flags.includeBasicInfo) {
    md += formatBasicInfoSection(job);
  }

  if (flags.includeJobSalary) {
    const salaryInfo = formatSalaryInfo(job);
    if (salaryInfo) {
      md += "### 薪资信息\n";
      md += salaryInfo;
      md += "\n";
    }
  }

  if (flags.includeWelfare) {
    const welfareInfo = formatWelfareInfo(job);
    if (welfareInfo) {
      md += "### 福利信息\n";
      md += welfareInfo;
      md += "\n";
    }
  }

  if (flags.includeHiringRequirement) {
    const requirements = formatRequirements(job);
    if (requirements) {
      md += "### 招聘要求\n";
      md += requirements;
      md += "\n";
    }
  }

  if (flags.includeWorkTime) {
    const workTime = formatWorkTime(job);
    if (workTime) {
      md += "### 工作时间\n";
      md += workTime;
      md += "\n";
    }
  }

  if (flags.includeInterviewProcess) {
    const interview = formatInterviewInfo(job);
    if (interview) {
      md += "### 面试流程\n";
      md += interview;
      md += "\n";
    }
  }

  md += "### 岗位标识\n";
  md += `- **jobId**: ${basicInfo.jobId}\n`;
  md += "\n";

  return md;
}

function isMinimalMode(flags: ProgressiveDisclosureFlags): boolean {
  return (
    flags.includeBasicInfo &&
    !flags.includeJobSalary &&
    !flags.includeWelfare &&
    !flags.includeHiringRequirement &&
    !flags.includeWorkTime &&
    !flags.includeInterviewProcess
  );
}

function formatJobsToMarkdown(
  jobs: AIJobItem[],
  total: number,
  pageNum: number,
  pageSize: number,
  flags: ProgressiveDisclosureFlags
): string {
  const start = (pageNum - 1) * pageSize + 1;
  const end = Math.min(start + jobs.length - 1, total);

  let md = `# 在招岗位（共 ${total} 个）\n\n`;

  if (isMinimalMode(flags)) {
    jobs.forEach((job, index) => {
      md += formatJobToOneLine(job, start + index - 1) + "\n";
    });
    if (total > end) {
      md += `\n_还有 ${total - end} 个岗位未显示，可通过筛选条件缩小范围_\n`;
    }
    return md;
  }

  md += `当前显示第 ${start}-${end} 条\n\n`;
  md += "---\n\n";

  jobs.forEach((job, index) => {
    md += formatJobToMarkdown(job, index, flags);
    md += "---\n\n";
  });

  return md;
}

// ============================================================================
// 工具导出
// ============================================================================

/**
 * Duliday 获取岗位列表工具（公共版，LLM 优化）
 *
 * 渐进式数据返回：根据对话阶段和用户问题，按需返回所需字段
 *
 * 返回三种格式：
 * - markdown: 格式化 Markdown 文本，适合 LLM 直接阅读
 * - rawData: API 返回的原始 JSON 数据，供程序化访问
 * - toon: TOON 格式压缩数据（Token 消耗约减少 40%），参见 https://github.com/toon-format/toon
 *
 * @param customToken 自定义的 Duliday token
 * @returns AI SDK tool instance
 */
export const dulidayJobListForLlmTool = (customToken?: string) =>
  tool({
    description: `查询在招岗位列表。支持渐进式数据返回，按需获取岗位信息。

筛选条件：城市、区域、品牌、门店、岗位类型、岗位ID
数据开关：
- includeBasicInfo（默认true）：品牌、门店、地址等基本信息
- includeJobSalary：薪资信息（基本薪资、综合薪资、结算周期等）
- includeWelfare：福利信息（餐饮、住宿、保险等）
- includeHiringRequirement：招聘要求（年龄、身高、学历等）
- includeWorkTime：工作时间（排班、班次、每周工时等）
- includeInterviewProcess：面试流程（面试轮数、地址、试工、培训等）

使用示例：
- 初次接触：无额外开关（仅基本信息）
- 用户问薪资：开启 includeJobSalary
- 面试安排：开启 includeInterviewProcess`,
    inputSchema,
    execute: async ({
      cityNameList = [],
      regionNameList = [],
      brandAliasList = [],
      storeNameList = [],
      jobCategoryList = [],
      jobIdList = [],
      includeBasicInfo = true,
      includeJobSalary = false,
      includeWelfare = false,
      includeHiringRequirement = false,
      includeWorkTime = false,
      includeInterviewProcess = false,
    }): Promise<JobListForLlmResult | { error: string }> => {
      console.log("🔍 duliday_job_list_for_llm tool called with:", {
        filters: { cityNameList, regionNameList, brandAliasList, storeNameList, jobCategoryList, jobIdList },
        flags: { includeBasicInfo, includeJobSalary, includeWelfare, includeHiringRequirement, includeWorkTime, includeInterviewProcess },
      });

      try {
        const dulidayToken = customToken || process.env.DULIDAY_TOKEN;
        if (!dulidayToken) {
          return { error: "❌ 缺少 DULIDAY_TOKEN，请在设置中配置或设置环境变量" };
        }

        const requestBody = {
          pageNum: DEFAULT_PAGE_NUM,
          pageSize: DEFAULT_PAGE_SIZE,
          cityNameList,
          regionNameList,
          brandAliasList,
          storeNameList,
          jobCategoryList,
          jobIdList,
        };

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

        const parseResult = aiJobListResponseSchema.safeParse(rawData);
        if (!parseResult.success) {
          console.error("响应数据格式错误:", parseResult.error);
          return { error: "❌ API 响应格式错误，请联系管理员" };
        }

        const data = parseResult.data;

        if (data.code !== 0) {
          return { error: `❌ API 返回错误: ${data.message || "未知错误"}` };
        }

        const jobs = data.data?.result || [];
        const total = data.data?.total || 0;

        if (jobs.length === 0) {
          let filterMsg = "未找到符合条件的岗位\n\n查询条件：";
          if (cityNameList.length > 0) filterMsg += `\n- 城市：${cityNameList.join("、")}`;
          if (regionNameList.length > 0) filterMsg += `\n- 区域：${regionNameList.join("、")}`;
          if (brandAliasList.length > 0) filterMsg += `\n- 品牌：${brandAliasList.join("、")}`;
          if (storeNameList.length > 0) filterMsg += `\n- 门店：${storeNameList.join("、")}`;
          if (jobCategoryList.length > 0) filterMsg += `\n- 岗位类型：${jobCategoryList.join("、")}`;
          if (jobIdList.length > 0) filterMsg += `\n- 岗位ID：${jobIdList.join("、")}`;
          const hasNoFilters =
            cityNameList.length === 0 &&
            regionNameList.length === 0 &&
            brandAliasList.length === 0 &&
            storeNameList.length === 0 &&
            jobCategoryList.length === 0 &&
            jobIdList.length === 0;
          if (hasNoFilters) {
            filterMsg += "\n- 无筛选条件（查询全部）";
          }
          return { error: filterMsg };
        }

        const flags: ProgressiveDisclosureFlags = {
          includeBasicInfo,
          includeJobSalary,
          includeWelfare,
          includeHiringRequirement,
          includeWorkTime,
          includeInterviewProcess,
        };

        const markdown = formatJobsToMarkdown(jobs, total, DEFAULT_PAGE_NUM, DEFAULT_PAGE_SIZE, flags);

        return {
          markdown,
          rawData: data.data,
          toon: encode(data.data),
        };
      } catch (error) {
        console.error("获取岗位列表失败:", error);
        return {
          error: `❌ 获取岗位列表失败: ${error instanceof Error ? error.message : "未知错误"}`,
        };
      }
    },
  });
