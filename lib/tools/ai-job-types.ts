/**
 * 企微智能化 - 岗位数据类型定义
 *
 * 对应 API: POST https://k8s.duliday.com/persistence/ai/api/job/list
 * 该 API 返回已清洗的岗位数据，用于 LLM 自动回复求职者场景
 */

import { z } from 'zod/v3';

// ============================================================================
// 基本信息 (basicInfo)
// ============================================================================

export const storeInfoSchema = z.object({
  storeName: z.string().nullable(),
  storeCityName: z.string().nullable(),
  storeRegionName: z.string().nullable(),
  storeAddress: z.string().nullable(),
  longitude: z.number().nullable(),
  latitude: z.number().nullable(),
});

export const basicInfoSchema = z.object({
  jobId: z.number(),
  storeInfo: storeInfoSchema.nullable(),
  brandName: z.string().nullable(),
  createTime: z.string().nullable(),
  jobName: z.string().nullable(),
  jobNickName: z.string().nullable(),
  jobCategoryName: z.string().nullable(),
  jobContent: z.string().nullable(),
  laborForm: z.string().nullable(),
  needProbationWork: z.string().nullable(),
  needTraining: z.string().nullable(),
  haveProbation: z.string().nullable(),
});

// ============================================================================
// 薪资信息 (jobSalary)
// ============================================================================

export const stairSalarySchema = z.object({
  description: z.string().nullable(),
  perTimeUnit: z.string().nullable(),
  fullWorkTime: z.number().nullable(),
  fullWorkTimeUnit: z.string().nullable(),
  salary: z.number().nullable(),
  salaryUnit: z.string().nullable(),
});

export const holidaySalarySchema = z.object({
  holidaySalaryType: z.string().nullable(),
  holidaySalaryMultiple: z.number().nullable(),
  holidayFixedSalary: z.number().nullable(),
  holidayFixedSalaryUnit: z.string().nullable(),
  holidaySalaryDesc: z.string().nullable(),
});

export const overtimeSalarySchema = z.object({
  overtimeSalaryType: z.string().nullable(),
  overtimeSalaryMultiple: z.number().nullable(),
  overtimeFixedSalary: z.number().nullable(),
  overtimeFixedSalaryUnit: z.string().nullable(),
  overtimeSalaryDesc: z.string().nullable(),
});

export const otherSalarySchema = z.object({
  commission: z.string().nullable(),
  attendanceSalary: z.number().nullable(),
  attendanceSalaryUnit: z.string().nullable(),
  performance: z.string().nullable(),
});

export const customSalarySchema = z.object({
  name: z.string().nullable(),
  salary: z.string().nullable(),
});

// 基本薪资对象
export const basicSalaryObjectSchema = z.object({
  basicSalary: z.number().nullable(),
  basicSalaryUnit: z.string().nullable(),
});

// 综合薪资对象
export const comprehensiveSalaryObjectSchema = z.object({
  minComprehensiveSalary: z.number().nullable(),
  maxComprehensiveSalary: z.number().nullable(),
  comprehensiveSalaryUnit: z.string().nullable(),
});

export const salaryScenarioSchema = z.object({
  salaryType: z.string().nullable(),
  salaryPeriod: z.string().nullable(),
  basicSalary: basicSalaryObjectSchema.nullable(),
  hasStairSalary: z.string().nullable(),
  stairSalaries: z.array(stairSalarySchema).nullable(),
  holidaySalary: holidaySalarySchema.nullable(),
  overtimeSalary: overtimeSalarySchema.nullable(),
  otherSalary: otherSalarySchema.nullable(),
  comprehensiveSalary: comprehensiveSalaryObjectSchema.nullable(),
  payday: z.string().nullable(),
  customSalaries: z.array(customSalarySchema).nullable(),
});

export const probationSalarySchema = z.object({
  salary: z.number().nullable(),
  salaryUnit: z.string().nullable(),
  salaryDescription: z.string().nullable(),
});

export const jobSalarySchema = z.object({
  salaryScenarioList: z.array(salaryScenarioSchema).nullable(),
  probationSalary: probationSalarySchema.nullable(),
});

// ============================================================================
// 福利信息 (welfare)
// ============================================================================

export const welfareSchema = z.object({
  haveInsurance: z.string().nullable(),
  accommodation: z.string().nullable(),
  accommodationAllowance: z.number().nullable(),
  accommodationAllowanceUnit: z.string().nullable(),
  probationAccommodationAllowanceReceive: z.string().nullable(),
  catering: z.string().nullable(),
  cateringSalary: z.number().nullable(),
  cateringSalaryUnit: z.string().nullable(),
  trafficAllowanceSalary: z.number().nullable(),
  trafficAllowanceSalaryUnit: z.string().nullable(),
  promotionWelfare: z.string().nullable(),
  otherWelfare: z.array(z.string()).nullable(),
  memo: z.string().nullable(),
});

// ============================================================================
// 招聘要求 (hiringRequirement)
// ============================================================================

export const basicPersonalRequirementsSchema = z.object({
  manMinHeight: z.number().nullable(),
  manMaxHeight: z.number().nullable(),
  womanMinHeight: z.number().nullable(),
  womanMaxHeight: z.number().nullable(),
  genderRequirement: z.string().nullable(),
  minAge: z.number().nullable(),
  maxAge: z.number().nullable(),
});

export const requirementsForHometownSchema = z.object({
  countryRequirementType: z.string().nullable(),
  nationRequirementType: z.string().nullable(),
  nations: z.array(z.string()).nullable(),
  nativePlaceRequirementType: z.string().nullable(),
  nativePlaces: z.array(z.string()).nullable(),
});

export const marriageBearingAndSocialSecuritySchema = z.object({
  marriageBearingType: z.string().nullable(),
  marriageBearing: z.string().nullable(),
  socialSecurityList: z.string().nullable(),
  socialSecurityRequirementType: z.string().nullable(),
});

export const competencyRequirementsSchema = z.object({
  workExperienceJobType: z.string().nullable(),
  minWorkTime: z.number().nullable(),
  minWorkTimeUnit: z.number().nullable(),
});

export const languageSchema = z.object({
  languages: z.string().nullable(),
  languageRemark: z.string().nullable(),
});

export const certificateSchema = z.object({
  education: z.string().nullable(),
  certificates: z.string().nullable(),
  healthCertificate: z.string().nullable(),
  driverLicenseType: z.string().nullable(),
});

export const hiringRequirementSchema = z.object({
  figure: z.string().nullable(),
  basicPersonalRequirements: basicPersonalRequirementsSchema.nullable(),
  requirementsForHometown: requirementsForHometownSchema.nullable(),
  marriageBearingAndSocialSecurity: marriageBearingAndSocialSecuritySchema.nullable(),
  competencyRequirements: competencyRequirementsSchema.nullable(),
  language: languageSchema.nullable(),
  certificate: certificateSchema.nullable(),
  remark: z.string().nullable(),
});

// ============================================================================
// 工作时间 (workTime)
// ============================================================================

export const temporaryEmploymentSchema = z.object({
  temporaryEmploymentStartTime: z.string().nullable(),
  temporaryEmploymentEndTime: z.string().nullable(),
});

export const customWorkTimeSchema = z.object({
  customMinWorkDays: z.number().nullable(),
  customMaxWorkDays: z.number().nullable(),
  customWorkWeekdays: z.array(z.string()).nullable(),
});

export const weekWorkTimeSchema = z.object({
  weekWorkTimeRequirement: z.string().nullable(),
  perWeekWorkDays: z.number().nullable(),
  perWeekRestDays: z.number().nullable(),
  perWeekNeedWorkDays: z.string().nullable(),
  workSingleDouble: z.string().nullable(),
  customnWorkTimeList: z.array(customWorkTimeSchema).nullable(),
});

export const monthWorkTimeSchema = z.object({
  perMonthMinWorkTime: z.number().nullable(),
  perMonthMinWorkTimeUnit: z.string().nullable(),
  monthWorkTimeRequirement: z.string().nullable(),
  perMonthMaxRestTime: z.number().nullable(),
  perMonthMaxRestTimeUnit: z.number().nullable(),
});

export const dayWorkTimeSchema = z.object({
  perDayMinWorkHours: z.string().nullable(),
  dayWorkTimeRequirement: z.string().nullable(),
});

export const fixedScheduleSchema = z.object({
  fixedShiftStartTime: z.string().nullable(),
  fixedShiftEndTime: z.string().nullable(),
});

export const fixedTimeSchema = z.object({
  goToWorkStartTime: z.string().nullable(),
  goToWorkEndTime: z.string().nullable(),
  goOffWorkStartTime: z.string().nullable(),
  goOffWorkEndTime: z.string().nullable(),
});

export const combinedArrangementItemSchema = z.object({
  combinedShiftStartTime: z.string().nullable(),
  combinedShiftEndTime: z.string().nullable(),
});

export const combinedArrangementSchema = z.object({
  combinedArrangementList: z.array(combinedArrangementItemSchema).nullable(),
});

/**
 * API 返回 combinedArrangement 时有两种格式：
 * 1. 对象: { combinedArrangementList: [...] }
 * 2. 数组: [{ combinedArrangementWeekdays, combinedArrangementStartTime, combinedArrangementEndTime }]
 * 使用 preprocess 统一归一化为对象格式
 */
interface CombinedArrangementRawItem {
  combinedArrangementWeekdays?: string | null;
  combinedArrangementStartTime?: number | null;
  combinedArrangementEndTime?: number | null;
}

function secondsToTimeStr(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const normalizedCombinedArrangementSchema = z.preprocess((val) => {
  if (Array.isArray(val)) {
    return {
      combinedArrangementList: val.map((item: CombinedArrangementRawItem) => ({
        combinedShiftStartTime: typeof item.combinedArrangementStartTime === "number"
          ? secondsToTimeStr(item.combinedArrangementStartTime)
          : null,
        combinedShiftEndTime: typeof item.combinedArrangementEndTime === "number"
          ? secondsToTimeStr(item.combinedArrangementEndTime)
          : null,
      })),
    };
  }
  return val;
}, combinedArrangementSchema);

export const dailyShiftScheduleSchema = z.object({
  arrangementType: z.string().nullable(),
  fixedScheduleList: z.array(fixedScheduleSchema).nullable(),
  combinedArrangement: normalizedCombinedArrangementSchema.nullable(),
  fixedTime: fixedTimeSchema.nullable(),
});

export const workTimeSchema = z.object({
  employmentForm: z.string().nullable(),
  employmentDescription: z.string().nullable(),
  minWorkMonths: z.number().nullable(),
  temporaryEmployment: temporaryEmploymentSchema.nullable(),
  weekWorkTime: weekWorkTimeSchema.nullable(),
  monthWorkTime: monthWorkTimeSchema.nullable(),
  dayWorkTime: dayWorkTimeSchema.nullable(),
  dailyShiftSchedule: dailyShiftScheduleSchema.nullable(),
  restTimeDesc: z.string().nullable(),
  workTimeRemark: z.string().nullable(),
});

// ============================================================================
// 面试流程 (interviewProcess)
// ============================================================================

export const interviewTimeSlotSchema = z.object({
  interviewStartTime: z.string().nullable(),
  interviewEndTime: z.string().nullable(),
});

export const fixedInterviewTimeSchema = z.object({
  interviewDate: z.string().nullable(),
  interviewTimes: z.array(interviewTimeSlotSchema).nullable(),
});

export const periodicInterviewTimeSchema = z.object({
  interviewWeekday: z.string().nullable(),
  interviewTimes: z.array(interviewTimeSlotSchema).nullable(),
});

export const firstInterviewSchema = z.object({
  firstInterviewWay: z.string().nullable(),
  interviewAddress: z.string().nullable(),
  interviewDemand: z.string().nullable(),
  firstInterviewDesc: z.string().nullable(),
  fixedDeadline: z.string().nullable(),
  interviewTimeMode: z.string().nullable(),
  fixedInterviewTimes: z.array(fixedInterviewTimeSchema).nullable(),
  periodicInterviewTimes: z.array(periodicInterviewTimeSchema).nullable(),
});

export const secondInterviewSchema = z.object({
  secondInterviewDemand: z.string().nullable(),
  secondInterviewWay: z.string().nullable(),
  secondInterviewAddress: z.string().nullable(),
});

export const thirdInterviewSchema = z.object({
  thirdInterviewDemand: z.string().nullable(),
  thirdInterviewWay: z.string().nullable(),
  thirdInterviewAddress: z.string().nullable(),
});

export const interviewSupplementSchema = z.object({
  interviewSupplement: z.string().nullable(),
  interviewSupplementId: z.number().nullable(),
});

export const probationWorkSchema = z.object({
  probationWorkPeriod: z.number().nullable(),
  probationWorkPeriodUnit: z.string().nullable(),
  probationWorkAddress: z.string().nullable(),
  probationWorkAssessment: z.string().nullable(),
  probationWorkAssessmentText: z.string().nullable(),
});

export const trainingSchema = z.object({
  trainingAddress: z.string().nullable(),
  trainingPeriod: z.number().nullable(),
  trainingPeriodUnit: z.string().nullable(),
  trainingDesc: z.string().nullable(),
});

export const interviewProcessSchema = z.object({
  interviewTotal: z.number().nullable(),
  firstInterview: firstInterviewSchema.nullable(),
  secondInterview: secondInterviewSchema.nullable(),
  thirdInterview: thirdInterviewSchema.nullable(),
  interviewSupplement: z.array(interviewSupplementSchema).nullable(),
  probationWork: probationWorkSchema.nullable(),
  training: trainingSchema.nullable(),
  processDesc: z.string().nullable(),
  remark: z.string().nullable(),
});

// ============================================================================
// 岗位完整数据 (JobItem)
// ============================================================================

export const aiJobItemSchema = z.object({
  basicInfo: basicInfoSchema,
  jobSalary: jobSalarySchema.nullable(),
  welfare: welfareSchema.nullable(),
  hiringRequirement: hiringRequirementSchema.nullable(),
  workTime: workTimeSchema.nullable(),
  interviewProcess: interviewProcessSchema.nullable(),
});

// ============================================================================
// API 响应
// ============================================================================

export const aiJobListResponseSchema = z.object({
  code: z.number(),
  message: z.string(),
  errorParamMessage: z.string().optional(),
  data: z
    .object({
      result: z.array(aiJobItemSchema),
      total: z.number(),
    })
    .nullable(),
});

// ============================================================================
// 导出类型
// ============================================================================

export type StoreInfo = z.infer<typeof storeInfoSchema>;
export type BasicInfo = z.infer<typeof basicInfoSchema>;
export type SalaryScenario = z.infer<typeof salaryScenarioSchema>;
export type ProbationSalary = z.infer<typeof probationSalarySchema>;
export type JobSalary = z.infer<typeof jobSalarySchema>;
export type Welfare = z.infer<typeof welfareSchema>;
export type HiringRequirement = z.infer<typeof hiringRequirementSchema>;
export type WorkTime = z.infer<typeof workTimeSchema>;
export type InterviewProcess = z.infer<typeof interviewProcessSchema>;
export type AIJobItem = z.infer<typeof aiJobItemSchema>;
export type AIJobListResponse = z.infer<typeof aiJobListResponseSchema>;
