import { z } from "zod";

/**
 * 岗位列表项 Schema
 */
export const jobItemSchema = z.object({
  jobBasicInfoId: z.number(),
  jobId: z.number(),
  jobName: z.string(),
  jobNickName: z.string(),
  organizationId: z.number(),
  organizationName: z.string(),
  jobTypePid: z.number(),
  jobTypePname: z.string(),
  jobTypeId: z.number(),
  jobTypeName: z.string(),
  laborForm: z.number(),
  laborFormName: z.string(),
  storeId: z.number(),
  storeName: z.string(),
  storeCityId: z.number(),
  storeAddress: z.string(),
  storeExactAddress: z.string(),
  storeCityName: z.string(),
  storeRegionId: z.number(),
  storeRegionName: z.string(),
  requirementNum: z.number(),
  thresholdNum: z.number(),
  genderIds: z.string(),
  minAge: z.number(),
  maxAge: z.number(),
  salary: z.number(),
  salaryUnitId: z.number(),
  salaryUnitName: z.string(),
  minComprehensiveSalary: z.number().nullable(),
  maxComprehensiveSalary: z.number().nullable(),
  comprehensiveSalaryUnitId: z.number().nullable(),
  comprehensiveSalaryUnitName: z.string().nullable(),
  insuranceFund: z.string().nullable(),
  insuranceFundName: z.string().nullable(),
  accommodation: z.number(),
  catering: z.number(),
  signUpNum: z.number(),
  jobAddress: z.string(),
  jobAddressCityId: z.number(),
  jobAddressRegionId: z.number(),
  latitude: z.number(),
  longitude: z.number(),
  commuteTime: z.number().nullable(),
  cyclingCommuteTime: z.number().nullable(),
  walkCommuteTime: z.number().nullable(),
  distance: z.number().nullable(),
  sortSalary: z.number().nullable(),
  needCheckThreshold: z.boolean(),
});

/**
 * 岗位列表响应 Schema
 */
export const jobListResponseSchema = z.object({
  code: z.number(),
  message: z.string(),
  data: z
    .object({
      result: z.array(jobItemSchema),
      total: z.number(),
    })
    .nullable(),
});

/**
 * 面试时间段 Schema
 */
export const interviewTimeSchema = z.object({
  id: z.number().nullable(),
  interviewDate: z.string().nullable(),
  interviewTime: z.string().nullable(),
  interviewDateTime: z.string().nullable(),
  weekdays: z.array(z.number()),
  start: z.number().nullable(),
  end: z.number().nullable(),
  times: z.array(
    z.object({
      start: z.number(),
      end: z.number(),
      fixedDeadline: z.string().nullable(),
      cycleDeadlineDay: z.number(),
      cycleDeadlineEnd: z.number(),
    })
  ),
});

/**
 * 岗位详情 Schema
 */
export const jobDetailsSchema = z.object({
  id: z.number(),
  jobBasicInfoId: z.number(),
  jobName: z.string(),
  storeId: z.number(),
  storeName: z.string(),
  storeAddress: z.string().nullable(),
  storeExactAddress: z.string().nullable(),
  newStore: z.boolean().nullable(),
  requirementNum: z.number(),
  thresholdNum: z.number(),
  interviewTimeMode: z.number(),
  interviewAddressMode: z.number().nullable(),
  secondInterviewAddressMode: z.number().nullable(),
  thirdInterviewAddressMode: z.number().nullable(),
  firstInterviewWay: z.string().nullable(),
  secondInterviewWay: z.string().nullable(),
  thirdInterviewWay: z.string().nullable(),
  interviewTimes: z.array(interviewTimeSchema),
  interviewAddressRegionId: z.number().nullable(),
  interviewAddressRegionStr: z.string().nullable(),
  interviewAddressCityStr: z.string().nullable(),
  interviewAddressText: z.string().nullable(),
  secondInterviewAddressText: z.string().nullable(),
  thirdInterviewAddressText: z.string().nullable(),
  probationWorkAddressMode: z.number().nullable(),
  probationWorkAddressRegionId: z.number().nullable(),
  probationWorkAddressRegionStr: z.string().nullable(),
  probationWorkAddressCityStr: z.string().nullable(),
  probationWorkAddressText: z.string().nullable(),
  trainAddressMode: z.number().nullable(),
  trainAddress: z.string().nullable(),
});

/**
 * 岗位详情响应 Schema
 */
export const jobDetailsResponseSchema = z.object({
  code: z.number(),
  message: z.string(),
  data: jobDetailsSchema.nullable(),
});

/**
 * 面试预约响应 Schema
 */
export const interviewBookingResponseSchema = z.object({
  code: z.number(),
  message: z.string(),
  data: z
    .object({
      notice: z.string().optional(),
      errorList: z.array(z.string()).nullable(),
    })
    .nullable(),
});

// 导出类型
export type JobItem = z.infer<typeof jobItemSchema>;
export type JobListResponse = z.infer<typeof jobListResponseSchema>;
export type InterviewTime = z.infer<typeof interviewTimeSchema>;
export type JobDetails = z.infer<typeof jobDetailsSchema>;
export type JobDetailsResponse = z.infer<typeof jobDetailsResponseSchema>;
export type InterviewBookingResponse = z.infer<typeof interviewBookingResponseSchema>;
