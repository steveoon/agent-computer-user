import { tool } from "ai";
import { z } from "zod/v3";
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
  // 确保 value 是非空字符串
  if (hasValue(value) && typeof value === "string") {
    const cleaned = cleanText(value);
    if (cleaned) {
      lines.push(`- **${label}**: ${cleaned}`);
    }
  } else if (hasValue(value)) {
    // 处理可能的非字符串情况（虽然类型定义限制了 string | null | undefined）
    lines.push(`- **${label}**: ${value}`);
  }
}

// ============================================================================
// 薪资信息格式化
// ============================================================================

/**
 * 格式化薪资信息 - 完整版
 */
function formatSalaryInfo(job: AIJobItem): string {
  const salary = job.jobSalary;
  if (!salary) return "";

  const lines: string[] = [];

  // 处理所有薪资场景（正式/试用期/培训期）
  salary.salaryScenarioList?.forEach((scenario) => {
    // 统一使用阶段前缀格式：正式期、试用期、培训期
    const salaryType = scenario.salaryType;
    const stagePrefix = salaryType ? `${salaryType}期` : "";

    // 基本薪资（新结构：嵌套对象）
    const basicSalaryObj = scenario.basicSalary;
    if (basicSalaryObj && hasValue(basicSalaryObj.basicSalary)) {
      const basicStr = `${basicSalaryObj.basicSalary}${basicSalaryObj.basicSalaryUnit || "元"}`;
      addLine(lines, `${stagePrefix}基本薪资`, basicStr);
    }

    // 综合薪资（新结构：嵌套对象）
    const compSalaryObj = scenario.comprehensiveSalary;
    if (compSalaryObj && (hasValue(compSalaryObj.minComprehensiveSalary) || hasValue(compSalaryObj.maxComprehensiveSalary))) {
      const min = compSalaryObj.minComprehensiveSalary ?? "?";
      const max = compSalaryObj.maxComprehensiveSalary ?? "?";
      const unit = compSalaryObj.comprehensiveSalaryUnit || "元/月";
      addLine(lines, `${stagePrefix}综合薪资`, `${min}-${max} ${unit}`);
    }

    // 结算周期 + 发薪日
    const periodParts = [scenario.salaryPeriod, scenario.payday ? `${scenario.payday}发薪` : null];
    const periodStr = joinParts(periodParts, "，");
    if (periodStr) {
      addLine(lines, `${stagePrefix}结算周期`, periodStr);
    }

    // 阶梯薪资
    if (scenario.stairSalaries?.length) {
      const stairInfo = scenario.stairSalaries
        .filter(s => hasValue(s.salary))
        .map(s => {
          // 强制显示阈值，避免 "超出后" 无上下文
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

    // 节假日薪资
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

    // 加班薪资
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

    // 其他薪资（提成、全勤、绩效）
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

    // 自定义薪资项
    scenario.customSalaries?.forEach(custom => {
      if (hasValue(custom.name) && hasValue(custom.salary)) {
        addLine(lines, `${stagePrefix}${custom.name}`, custom.salary);
      }
    });
  });

  // 试工期薪资（注意：不是试用期，试用期薪资在 salaryScenarioList 中 salaryType="试用期" 的场景）
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

/**
 * 格式化福利信息 - 完整版
 */
function formatWelfareInfo(job: AIJobItem): string {
  const welfare = job.welfare;
  if (!welfare) return "";

  const lines: string[] = [];

  // 餐饮福利 + 餐补金额
  if (hasValue(welfare.catering) && welfare.catering !== "无餐饮福利") {
    let cateringStr = welfare.catering;
    if (hasValue(welfare.cateringSalary)) {
      cateringStr += `（餐补${welfare.cateringSalary}${welfare.cateringSalaryUnit || "元"}）`;
    }
    addLine(lines, "餐饮", cateringStr);
  }

  // 住宿福利 + 住宿补贴
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

  // 交通补贴
  if (hasValue(welfare.trafficAllowanceSalary)) {
    addLine(
      lines,
      "交通补贴",
      `${welfare.trafficAllowanceSalary}${welfare.trafficAllowanceSalaryUnit || "元"}`
    );
  }

  // 保险
  if (hasValue(welfare.haveInsurance)) {
    addLine(lines, "保险", welfare.haveInsurance);
  }

  // 晋升福利
  if (hasValue(welfare.promotionWelfare)) {
    addLine(lines, "晋升", welfare.promotionWelfare);
  }

  // 其他福利
  const otherWelfareItems = welfare.otherWelfare?.filter(w => hasValue(w));
  if (otherWelfareItems?.length) {
    addLine(lines, "其他福利", otherWelfareItems.join("、"));
  }

  // 福利备注（重要！）
  if (hasValue(welfare.memo)) {
    addLine(lines, "福利说明", welfare.memo);
  }

  return lines.length > 0 ? lines.join("\n") + "\n" : "";
}

// ============================================================================
// 招聘要求格式化
// ============================================================================

/**
 * 格式化招聘要求 - 完整版
 */
function formatRequirements(job: AIJobItem): string {
  const req = job.hiringRequirement;
  if (!req) return "";

  const lines: string[] = [];

  // === 基本个人要求 ===
  const basic = req.basicPersonalRequirements;
  if (basic) {
    // 性别要求
    if (hasValue(basic.genderRequirement) && basic.genderRequirement !== "不限") {
      addLine(lines, "性别", basic.genderRequirement);
    }

    // 年龄要求
    if (hasValue(basic.minAge) || hasValue(basic.maxAge)) {
      const ageStr = `${basic.minAge ?? "不限"}-${basic.maxAge ?? "不限"}岁`;
      addLine(lines, "年龄", ageStr);
    }

    // 身高要求（男/女分开）
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

  // 形象要求
  if (hasValue(req.figure)) {
    addLine(lines, "形象", req.figure);
  }

  // === 证书要求 ===
  const cert = req.certificate;
  if (cert) {
    // 学历
    if (hasValue(cert.education) && cert.education !== "不限") {
      addLine(lines, "学历", `${cert.education}及以上`);
    }

    // 健康证
    if (hasValue(cert.healthCertificate)) {
      addLine(lines, "健康证", cert.healthCertificate);
    }

    // 其他证书
    if (hasValue(cert.certificates)) {
      addLine(lines, "证书", cert.certificates);
    }

    // 驾照
    if (hasValue(cert.driverLicenseType)) {
      addLine(lines, "驾照", cert.driverLicenseType);
    }
  }

  // === 籍贯/民族要求 ===
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

  // === 婚育/社保要求 ===
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

  // === 能力/经验要求 ===
  const comp = req.competencyRequirements;
  if (comp) {
    if (hasValue(comp.workExperienceJobType)) {
      let expStr = comp.workExperienceJobType;
      if (hasValue(comp.minWorkTime)) {
        // minWorkTimeUnit 是数字类型，需要映射
        const unitMap: Record<number, string> = { 1: "月", 2: "年" };
        const unit = comp.minWorkTimeUnit ? unitMap[comp.minWorkTimeUnit] || "" : "";
        expStr += `（至少${comp.minWorkTime}${unit}）`;
      }
      addLine(lines, "工作经验", expStr);
    }
  }

  // === 语言要求 ===
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

  // === 招聘要求备注（重要！）===
  if (req.remark) {
    addLine(lines, "其他要求", req.remark);
  }

  return lines.length > 0 ? lines.join("\n") + "\n" : "";
}

// ============================================================================
// 工作时间格式化
// ============================================================================

/**
 * 格式化工作时间 - 完整版
 */
function formatWorkTime(job: AIJobItem): string {
  const wt = job.workTime;
  if (!wt) return "";

  const lines: string[] = [];

  // 就业形式 + 说明
  if (hasValue(wt.employmentForm)) {
    let formStr = wt.employmentForm;
    if (hasValue(wt.employmentDescription)) {
      formStr += `（${wt.employmentDescription}）`;
    }
    addLine(lines, "就业形式", formStr);
  }

  // 最少工作月数
  if (hasValue(wt.minWorkMonths)) {
    addLine(lines, "最少工作", `${wt.minWorkMonths}个月`);
  }

  // 临时工/短期工周期
  const temp = wt.temporaryEmployment;
  if (temp && hasValue(temp.temporaryEmploymentStartTime)) {
    const start = temp.temporaryEmploymentStartTime?.split("T")[0] || "";
    const end = temp.temporaryEmploymentEndTime?.split("T")[0] || "";
    addLine(lines, "工作周期", `${start} 至 ${end}`);
  }

  // 每周工作时间
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

    // 自定义工作时间
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

  // 每月工作时间
  const month = wt.monthWorkTime;
  if (month) {
    if (hasValue(month.perMonthMinWorkTime)) {
      // 直接使用 API 返回的原始单位，不做防御性转换，暴露数据问题
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

  // 每日工时
  const day = wt.dayWorkTime;
  if (day) {
    if (hasValue(day.perDayMinWorkHours)) {
      addLine(lines, "每日工时", `${day.perDayMinWorkHours}小时`);
    }
    if (hasValue(day.dayWorkTimeRequirement)) {
      addLine(lines, "日工时要求", day.dayWorkTimeRequirement);
    }
  }

  // 排班安排
  // 覆盖逻辑：如果工时备注有值，优先使用工时备注，跳过班次详情
  const hasWorkTimeRemark = hasValue(wt.workTimeRemark);

  const schedule = wt.dailyShiftSchedule;
  if (schedule) {
    if (hasValue(schedule.arrangementType)) {
      addLine(lines, "排班类型", schedule.arrangementType);
    }

    // 仅当没有工时备注时，才显示班次详情
    if (!hasWorkTimeRemark) {
      // 固定班次
      if (schedule.fixedScheduleList?.length) {
        const shifts = schedule.fixedScheduleList
          .filter(s => hasValue(s.fixedShiftStartTime) && hasValue(s.fixedShiftEndTime))
          .map(s => `${s.fixedShiftStartTime}-${s.fixedShiftEndTime}`)
          .join("、");
        if (shifts) {
          addLine(lines, "固定班次", shifts);
        }
      }

      // 组合班次
      if (schedule.combinedArrangement?.combinedArrangementList?.length) {
        const combined = schedule.combinedArrangement.combinedArrangementList
          .filter(s => hasValue(s.combinedShiftStartTime) && hasValue(s.combinedShiftEndTime))
          .map(s => `${s.combinedShiftStartTime}-${s.combinedShiftEndTime}`)
          .join("、");
        if (combined) {
          addLine(lines, "组合班次", combined);
        }
      }

      // 弹性上下班
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

  // 休息时间说明
  if (hasValue(wt.restTimeDesc)) {
    addLine(lines, "休息说明", wt.restTimeDesc);
  }

  // 工时备注（覆盖班次详情，作为权威时间信息）
  if (hasWorkTimeRemark) {
    addLine(lines, "工时备注", wt.workTimeRemark);
  }

  return lines.length > 0 ? lines.join("\n") + "\n" : "";
}

// ============================================================================
// 面试信息格式化
// ============================================================================

/**
 * 格式化面试信息 - 完整版
 */
function formatInterviewInfo(job: AIJobItem): string {
  const ip = job.interviewProcess;
  if (!ip) return "";

  const lines: string[] = [];

  // 面试轮数
  if (hasValue(ip.interviewTotal)) {
    addLine(lines, "面试轮数", `${ip.interviewTotal}轮`);
  }

  // === 一面信息 ===
  const first = ip.firstInterview;
  if (first) {
    // 面试方式
    if (hasValue(first.firstInterviewWay)) {
      addLine(lines, "一面方式", first.firstInterviewWay);
    }

    // 面试地址
    if (hasValue(first.interviewAddress)) {
      addLine(lines, "一面地址", first.interviewAddress);
    }

    // 面试要求
    if (hasValue(first.interviewDemand)) {
      addLine(lines, "面试要求", first.interviewDemand);
    }

    // 面试说明
    if (hasValue(first.firstInterviewDesc)) {
      addLine(lines, "一面说明", first.firstInterviewDesc);
    }

    // 截止日期
    if (hasValue(first.fixedDeadline)) {
      addLine(lines, "报名截止", first.fixedDeadline);
    }

    // 面试时间模式
    if (hasValue(first.interviewTimeMode)) {
      addLine(lines, "时间模式", first.interviewTimeMode);
    }

    // 固定面试时间
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

    // 周期性面试时间
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

  // === 二面信息 ===
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

  // === 三面信息 ===
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

  // === 面试补充说明 ===
  ip.interviewSupplement?.forEach(supp => {
    if (hasValue(supp.interviewSupplement)) {
      addLine(lines, "面试补充", supp.interviewSupplement);
    }
  });

  // === 试工信息 ===
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

  // === 培训信息 ===
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

  // === 流程说明（重要！）===
  if (ip.processDesc) {
    addLine(lines, "流程说明", ip.processDesc);
  }

  // === 面试备注（重要！）===
  if (ip.remark) {
    addLine(lines, "面试备注", ip.remark);
  }

  return lines.length > 0 ? lines.join("\n") + "\n" : "";
}

// ============================================================================
// 岗位格式化
// ============================================================================

/**
 * 格式化单个岗位为 Markdown - 完整版
 */
function formatJobToMarkdown(job: AIJobItem, index: number): string {
  const basicInfo = job.basicInfo;
  const store = basicInfo.storeInfo;

  // 标题：岗位名称 + 岗位别名
  const titleParts = [basicInfo.jobName || "未命名岗位"];
  if (hasValue(basicInfo.jobNickName) && basicInfo.jobNickName !== basicInfo.jobName) {
    titleParts.push(`(${basicInfo.jobNickName})`);
  }
  let md = `## ${index + 1}. ${titleParts.join(" ")}\n\n`;

  // 基本信息
  const basicLines: string[] = [];

  // 品牌
  if (hasValue(basicInfo.brandName)) {
    addLine(basicLines, "品牌", basicInfo.brandName);
  }

  // 门店信息
  if (store) {
    if (hasValue(store.storeName)) {
      addLine(basicLines, "门店", store.storeName);
    }
    if (hasValue(store.storeAddress)) {
      addLine(basicLines, "地址", store.storeAddress);
    }
  }

  // 岗位类型
  if (hasValue(basicInfo.jobCategoryName)) {
    addLine(basicLines, "岗位类型", basicInfo.jobCategoryName);
  }

  // 用工形式
  if (hasValue(basicInfo.laborForm)) {
    addLine(basicLines, "用工形式", basicInfo.laborForm);
  }

  // 工作内容（完整显示，不截断）
  if (basicInfo.jobContent) {
    addLine(basicLines, "工作内容", basicInfo.jobContent);
  }

  // 试用期
  if (hasValue(basicInfo.haveProbation) && basicInfo.haveProbation !== "无试用期") {
    addLine(basicLines, "试用期", basicInfo.haveProbation);
  }

  // 是否需要试工
  if (hasValue(basicInfo.needProbationWork) && basicInfo.needProbationWork !== "不需要试工") {
    addLine(basicLines, "试工", basicInfo.needProbationWork);
  }

  // 是否需要培训
  if (hasValue(basicInfo.needTraining) && basicInfo.needTraining !== "不需要培训") {
    addLine(basicLines, "培训", basicInfo.needTraining);
  }

  if (basicLines.length > 0) {
    md += "### 基本信息\n";
    md += basicLines.join("\n") + "\n";
    md += "\n";
  }

  // 薪资福利
  const salaryInfo = formatSalaryInfo(job);
  const welfareInfo = formatWelfareInfo(job);
  if (salaryInfo || welfareInfo) {
    md += "### 薪资福利\n";
    md += salaryInfo;
    md += welfareInfo;
    md += "\n";
  }

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
    md += "### 面试流程\n";
    md += interview;
    md += "\n";
  }

  // 岗位标识（用于预约）
  md += "### 岗位标识\n";
  md += `- **jobId**: ${basicInfo.jobId}\n`;
  md += "\n";

  return md;
}

/**
 * 格式化岗位列表为 Markdown
 */
function formatJobsToMarkdown(
  jobs: AIJobItem[],
  total: number,
  pageNum: number,
  pageSize: number
): string {
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
    execute: async ({ cityNameList = [], regionNameList = [], brandAliasList = [] }) => {
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
          if (
            cityNameList.length === 0 &&
            regionNameList.length === 0 &&
            brandAliasList.length === 0
          ) {
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
