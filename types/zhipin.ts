import { z } from 'zod/v3';
import { CoordinatesSchema } from "./geocoding";

// Boss直聘相关数据类型定义

// 🔧 结构化薪资与福利模型
export const SalaryDetailsSchema = z.object({
  base: z.number(),
  // 例如: "5250元-5750元"
  range: z.string().optional(),
  // 例如: "季度奖金1000～1500"
  bonus: z.string().optional(),
  // 保留原始文本以供参考
  memo: z.string(),
  // 从 salaryScenarioList 提炼的可读摘要（阶梯薪资/综合薪资/节假日倍数等）
  scenarioSummary: z.string().optional(),
  // 结算周期："日结"/"周结"/"月结" 等
  settlementCycle: z.string().optional(),
});

export const BenefitsSchema = z.object({
  // 一个包含关键福利的数组，如 ["五险一金", "带薪年假"]
  items: z.array(z.string()),
  // 完整的晋升福利文本
  promotion: z.string().optional(),
});

// 🔧 Duliday 原始 API 数据结构定义
export namespace DulidayRaw {
  export const MoreWelfareItemSchema = z.object({
    content: z.string(),
    image: z.string().nullable(),
  });

  export const WelfareSchema = z.object({
    id: z.number(),
    jobBasicInfoId: z.number(),
    haveInsurance: z.number(),
    accommodation: z.number(),
    accommodationSalary: z.number().nullable(),
    accommodationSalaryUnit: z.number().nullable(),
    probationAccommodationSalaryReceive: z.number().nullable(),
    catering: z.number(),
    cateringImage: z.string().nullable(),
    cateringSalary: z.number().nullable(),
    cateringSalaryUnit: z.number().nullable(),
    trafficAllowanceSalary: z.number().nullable(),
    trafficAllowanceSalaryUnit: z.number().nullable(),
    otherWelfare: z.string().nullable(),
    moreWelfares: z.array(MoreWelfareItemSchema).nullable(),
    insuranceFund: z.array(z.number()).nullable(),
    insuranceFundCityId: z.number().nullable(),
    insuranceFundCityStr: z.string().nullable(),
    insuranceFundAmount: z.number().nullable(),
    memo: z.string().nullable(),
    promotionWelfare: z.string().nullable(),
    // API 可能返回 string（如空字符串）或 number，该字段未被使用
    accommodationNum: z.union([z.number(), z.string()]).nullable(),
    commuteDistance: z.number().nullable(),
    accommodationEnv: z.string().nullable(),
    imagesDTOList: z.array(z.unknown()).nullable(),
  });

  // 新 API welfare 结构（无 id/jobBasicInfoId，字段为 string 类型）
  export const NewWelfareSchema = z
    .object({
      haveInsurance: z.string(),
      accommodation: z.string(),
      catering: z.string().optional(),
      otherWelfare: z.array(z.string()).nullable().optional(),
      accommodationAllowance: z.number().nullable().optional(),
      accommodationAllowanceUnit: z.string().nullable().optional(),
      probationAccommodationAllowanceReceive: z.string().nullable().optional(),
      cateringSalary: z.number().nullable().optional(),
      cateringSalaryUnit: z.string().nullable().optional(),
      trafficAllowanceSalary: z.number().nullable().optional(),
      trafficAllowanceSalaryUnit: z.string().nullable().optional(),
      memo: z.string().nullable().optional(),
      promotionWelfare: z.string().nullable().optional(),
      moreWelfares: z.array(MoreWelfareItemSchema).nullable().optional(),
    })
    .passthrough();

  export const WorkTimeArrangementSlotSchema = z.object({
    jobWorkTimeArrangementId: z.number(),
    startTime: z.number(),
    endTime: z.number(),
    weekdays: z.array(z.number()),
  });

  export const FixedTimeSlotSchema = z.object({
    jobWorkTimeArrangementId: z.number(),
    startTime: z.number(),
    endTime: z.number(),
  });

  export const CustomWorkTimeSchema = z.object({
    jobWorkTimeArrangementId: z.number(),
    weekdays: z.array(z.number()),
    minWorkDays: z.number().nullable(),
    maxWorkDays: z.number().nullable(),
  });

  export const WorkTimeArrangementSchema = z
    .object({
      id: z.number(),
      jobBasicInfoId: z.number(),
      employmentForm: z.number(),
      minWorkMonths: z.number().nullable(),
      temporaryEmploymentStartTime: z.string().nullable(),
      temporaryEmploymentEndTime: z.string().nullable(),
      employmentDescription: z.string().nullable(),
      monthWorkTimeRequirement: z.number(),
      perMonthMinWorkTime: z.number().nullable(),
      perMonthMinWorkTimeUnit: z.number().nullable(),
      perMonthMaxRestTime: z.number().nullable(),
      perMonthMaxRestTimeUnit: z.number().nullable(),
      weekWorkTimeRequirement: z.number(),
      perWeekNeedWorkDays: z.number().nullable(),
      perWeekWorkDays: z.number().nullable(),
      perWeekRestDays: z.number().nullable(),
      evenOddType: z.number().nullable(),
      customWorkTimes: z.array(CustomWorkTimeSchema).nullable(),
      dayWorkTimeRequirement: z.number(),
      perDayMinWorkHours: z.number().nullable(),
      arrangementType: z.number(),
      fixedArrangementTimes: z.array(FixedTimeSlotSchema).nullable(),
      combinedArrangementTimes: z.array(WorkTimeArrangementSlotSchema).nullable(),
      goToWorkStartTime: z.number().nullable(),
      goToWorkEndTime: z.number().nullable(),
      goOffWorkStartTime: z.number().nullable(),
      goOffWorkEndTime: z.number().nullable(),
      maxWorkTakingTime: z.number(),
      restTimeDesc: z.string().nullable(),
      workTimeRemark: z.string().nullable(),
    })
    .refine(
      data => {
        // 优先级1: 检查 perWeekWorkDays
        if (data.perWeekWorkDays !== null && data.perWeekWorkDays !== undefined) {
          return true;
        }

        // 优先级2: 检查 customWorkTimes.minWorkDays
        if (data.customWorkTimes && data.customWorkTimes.length > 0) {
          const hasValidMinWorkDays = data.customWorkTimes.some(
            ct => ct.minWorkDays !== null && ct.minWorkDays !== undefined
          );
          if (hasValidMinWorkDays) {
            return true;
          }
        }

        // 优先级3: 检查 perWeekNeedWorkDays
        if (data.perWeekNeedWorkDays !== null && data.perWeekNeedWorkDays !== undefined) {
          return true;
        }

        // 所有字段都为空，验证失败（但会使用默认值5）
        // 实际上这个场景也允许，因为代码中有默认值处理
        return true;
      },
      {
        message:
          "建议提供 perWeekWorkDays、customWorkTimes.minWorkDays 或 perWeekNeedWorkDays 中的至少一个",
        path: ["workTimeArrangement"],
      }
    );

  // 新 API workTime 嵌套子对象结构
  export const NewWorkTimeSchema = z
    .object({
      employmentForm: z.string(),
      minWorkMonths: z.number().nullable().optional(),
      maxWorkTakingTime: z.number().nullable().optional(),
      restTimeDesc: z.string().nullable().optional(),
      workTimeRemark: z.string().nullable().optional(),
      employmentDescription: z.string().nullable().optional(),
      weekWorkTime: z
        .object({
          weekWorkTimeRequirement: z.string().nullable().optional(),
          perWeekWorkDays: z.number().nullable().optional(),
          perWeekRestDays: z.number().nullable().optional(),
          perWeekNeedWorkDays: z.union([z.string(), z.number()]).nullable().optional(),
          workSingleDouble: z.string().nullable().optional(),
          customnWorkTimeList: z
            .array(
              z.object({
                customMinWorkDays: z.number().nullable().optional(),
                customMaxWorkDays: z.number().nullable().optional(),
                customWorkWeekdays: z.array(z.union([z.string(), z.number()])).nullable().optional(),
              }).passthrough()
            )
            .nullable()
            .optional(),
        })
        .passthrough()
        .nullable()
        .optional(),
      monthWorkTime: z
        .object({
          perMonthMinWorkTime: z.number().nullable().optional(),
          perMonthMinWorkTimeUnit: z.union([z.string(), z.number()]).nullable().optional(),
          monthWorkTimeRequirement: z.string().nullable().optional(),
          perMonthMaxRestTime: z.number().nullable().optional(),
          perMonthMaxRestTimeUnit: z.number().nullable().optional(),
        })
        .passthrough()
        .nullable()
        .optional(),
      dayWorkTime: z
        .object({
          perDayMinWorkHours: z.union([z.string(), z.number()]).nullable().optional(),
          dayWorkTimeRequirement: z.string().nullable().optional(),
        })
        .passthrough()
        .nullable()
        .optional(),
      dailyShiftSchedule: z
        .object({
          arrangementType: z.string().nullable().optional(),
          fixedScheduleList: z
            .array(
              z.object({
                fixedShiftStartTime: z.union([z.string(), z.number()]).optional(),
                fixedShiftEndTime: z.union([z.string(), z.number()]).optional(),
                startTime: z.number().optional(),
                endTime: z.number().optional(),
              }).passthrough()
            )
            .nullable()
            .optional(),
          combinedArrangement: z
            .array(
              z.object({
                CombinedArrangementWeekdays: z.union([z.string(), z.array(z.number())]).optional(),
                CombinedArrangementStartTime: z.number().optional(),
                CombinedArrangementEndTime: z.number().optional(),
                startTime: z.number().optional(),
                endTime: z.number().optional(),
                weekdays: z.array(z.number()).optional(),
              }).passthrough()
            )
            .nullable()
            .optional(),
          fixedTime: z
            .object({
              goToWorkStartTime: z.union([z.string(), z.number()]).nullable().optional(),
              goToWorkEndTime: z.union([z.string(), z.number()]).nullable().optional(),
              goOffWorkStartTime: z.union([z.string(), z.number()]).nullable().optional(),
              goOffWorkEndTime: z.union([z.string(), z.number()]).nullable().optional(),
            })
            .passthrough()
            .nullable()
            .optional(),
        })
        .passthrough()
        .nullable()
        .optional(),
      temporaryEmployment: z
        .object({
          temporaryEmploymentStartTime: z.string().nullable().optional(),
          temporaryEmploymentEndTime: z.string().nullable().optional(),
        })
        .passthrough()
        .nullable()
        .optional(),
    })
    .passthrough();

  const LegacyPositionSchema = z.object({
    jobBasicInfoId: z.number(),
    jobStoreId: z.number(),
    storeId: z.number(),
    storeName: z.string(),
    storeCityId: z.number(),
    storeRegionId: z.number(),
    jobName: z.string(),
    jobId: z.number(),
    // 兼容新旧品牌/项目追踪字段
    organizationId: z.number().optional(),
    organizationName: z.string().optional(),
    brandId: z.number().optional(),
    brandName: z.string().optional(),
    projectId: z.number().optional(),
    projectName: z.string().optional(),
    cityName: z.array(z.string()),
    salary: z.number(),
    salaryUnitStr: z.string(),
    workTimeArrangement: WorkTimeArrangementSchema,
    welfare: WelfareSchema,
    cooperationMode: z.number(),
    requirementNum: z.number(),
    thresholdNum: z.number(),
    signUpNum: z.number().nullable(),
    postTime: z.string(),
    successDuliriUserId: z.number(),
    successNameStr: z.string(),
    storeAddress: z.string(),
  });

  const NewBasicInfoSchema = z
    .object({
      // 真实新接口字段（允许额外字段）
      jobId: z.number().optional(),
      createTime: z.string().optional(),
      jobName: z.string().optional(),
      brandId: z.number().optional(),
      brandName: z.string().optional(),
      projectId: z.number().optional(),
      projectName: z.string().optional(),
      storeInfo: z
        .object({
          storeId: z.number().optional(),
          storeName: z.string().optional(),
          storeCityId: z.number().optional(),
          storeRegionId: z.number().optional(),
          storeCityName: z.string().optional(),
          storeRegionName: z.string().optional(),
          storeAddress: z.string().optional(),
          longitude: z.number().optional(),
          latitude: z.number().optional(),
        })
        .optional(),

      // 兼容历史新结构样例中的字段
      jobBasicInfoId: z.number().optional(),
      jobStoreId: z.number().optional(),
      storeId: z.number().optional(),
      storeName: z.string().optional(),
      storeCityId: z.number().optional(),
      storeRegionId: z.number().optional(),
      cityName: z.array(z.string()).optional(),
      postTime: z.string().optional(),
      successDuliriUserId: z.number().optional(),
      successNameStr: z.string().optional(),
      storeAddress: z.string().optional(),
      organizationId: z.number().optional(),
      organizationName: z.string().optional(),
    })
    .passthrough();

  const NewJobSalarySchema = z
    .object({
      salary: z.number().optional(),
      salaryUnitStr: z.string().optional(),
    })
    .passthrough();

  const NewHiringRequirementSchema = z
    .object({
      cooperationMode: z.number().optional(),
      requirementNum: z.number().optional(),
      thresholdNum: z.number().optional(),
      signUpNum: z.number().nullable().optional(),
    })
    .passthrough();

  const NewPositionSchema = z
    .object({
      basicInfo: NewBasicInfoSchema,
      jobSalary: NewJobSalarySchema,
      welfare: z.union([WelfareSchema, NewWelfareSchema]),
      hiringRequirement: NewHiringRequirementSchema,
      workTime: z.union([WorkTimeArrangementSchema, NewWorkTimeSchema]),
      interviewProcess: z.unknown().optional(),
    })
    .passthrough();

  export const PositionSchema = z.union([LegacyPositionSchema, NewPositionSchema]);

  export const ListResponseSchema = z.object({
    code: z.number(),
    message: z.string(),
    data: z.object({
      result: z.array(PositionSchema),
      total: z.number(),
    }),
  });

  // 导出类型
  export type MoreWelfareItem = z.infer<typeof MoreWelfareItemSchema>;
  export type Welfare = z.infer<typeof WelfareSchema>;
  export type NewWelfare = z.infer<typeof NewWelfareSchema>;
  export type WorkTimeArrangement = z.infer<typeof WorkTimeArrangementSchema>;
  export type NewWorkTime = z.infer<typeof NewWorkTimeSchema>;
  export type WorkTimeArrangementSlot = z.infer<typeof WorkTimeArrangementSlotSchema>;
  export type FixedTimeSlot = z.infer<typeof FixedTimeSlotSchema>;
  export type CustomWorkTime = z.infer<typeof CustomWorkTimeSchema>;
  export type Position = z.infer<typeof PositionSchema>;
  export type ListResponse = z.infer<typeof ListResponseSchema>;
}

// 预定义常见出勤模式
export const ATTENDANCE_PATTERNS = {
  WEEKENDS: [6, 7],
  WEEKDAYS: [1, 2, 3, 4, 5],
  FRIDAY_TO_SUNDAY: [5, 6, 7],
  EVERYDAY: [1, 2, 3, 4, 5, 6, 7],
} as const;

// 🔧 Zod Schema 定义

// 出勤要求Schema
export const AttendanceRequirementSchema = z.object({
  requiredDays: z.array(z.number().min(1).max(7)).optional(),
  minimumDays: z.number().min(0).optional(),
  description: z.string(),
});

// 排班类型Schema
export const ScheduleTypeSchema = z.enum(["fixed", "flexible", "rotating", "on_call"]);

// 考勤政策Schema
export const AttendancePolicySchema = z.object({
  punctualityRequired: z.boolean(),
  lateToleranceMinutes: z.number().min(0),
  attendanceTracking: z.enum(["strict", "flexible", "none"]),
  makeupShiftsAllowed: z.boolean(),
});

// 时间段可用性Schema
export const TimeSlotAvailabilitySchema = z.object({
  slot: z.string(),
  maxCapacity: z.number().min(0),
  currentBooked: z.number().min(0),
  isAvailable: z.boolean(),
  priority: z.enum(["high", "medium", "low"]),
});

// 排班灵活性Schema
export const SchedulingFlexibilitySchema = z.object({
  canSwapShifts: z.boolean(),
  advanceNoticeHours: z.number().min(0),
  partTimeAllowed: z.boolean(),
  weekendRequired: z.boolean(),
  holidayRequired: z.boolean(),
});

// 招聘要求Schema（从新 API hiringRequirement.basicPersonalRequirements 提取）
export const HiringRequirementsSchema = z.object({
  minAge: z.number().nullable().optional(),
  maxAge: z.number().nullable().optional(),
  genderRequirement: z.string().nullable().optional(),
  education: z.string().nullable().optional(),
  healthCertificate: z.string().nullable().optional(),
});

export type HiringRequirements = z.infer<typeof HiringRequirementsSchema>;

// 岗位Schema（使用结构化的薪资与福利模型）
export const PositionSchema = z.object({
  id: z.string(),
  name: z.string(),
  // 新增：品牌/项目追踪字段（IndexedDB 持久化）
  brandId: z.string().optional(),
  brandName: z.string().optional(),
  projectId: z.string().optional(),
  projectName: z.string().optional(),
  timeSlots: z.array(z.string()),
  // 🔧 使用结构化的薪资模型替代原有的 baseSalary 和 levelSalary
  salary: SalaryDetailsSchema,
  workHours: z.string(),
  // 🔧 使用结构化的福利模型替代原有的 benefits
  benefits: BenefitsSchema,
  requirements: z.array(z.string()),
  urgent: z.boolean(),
  scheduleType: ScheduleTypeSchema,
  attendancePolicy: AttendancePolicySchema,
  availableSlots: z.array(TimeSlotAvailabilitySchema),
  schedulingFlexibility: SchedulingFlexibilitySchema,
  minHoursPerWeek: z.number().min(0).optional(),
  maxHoursPerWeek: z.number().min(0).optional(),
  attendanceRequirement: AttendanceRequirementSchema.optional(),
  // 新增：结构化招聘要求（年龄/性别/学历/健康证）
  hiringRequirements: HiringRequirementsSchema.optional(),
  // 新增：岗位描述（来自 basicInfo.jobContent）
  description: z.string().optional(),
});

// 门店Schema
export const StoreSchema = z.object({
  id: z.string(),
  name: z.string(),
  city: z.string().optional(), // 门店所在城市（从 API cityName 获取）
  location: z.string(),
  district: z.string(),
  subarea: z.string(),
  coordinates: CoordinatesSchema, // 引用统一的坐标 Schema
  positions: z.array(PositionSchema),
  brand: z.string(),
});

// 用于智能回复系统的消息分类和模板匹配
export const ReplyContextSchema = z.enum([
  // 基础咨询类
  "initial_inquiry", // 初次咨询工作机会
  "location_inquiry", // 询问位置但无具体指向
  "no_location_match", // 提到位置但无法匹配
  "schedule_inquiry", // 询问工作时间安排
  "interview_request", // 表达面试意向
  "general_chat", // 一般性对话

  // 敏感信息类
  "salary_inquiry", // 询问薪资待遇
  "age_concern", // 年龄相关问题（敏感）
  "insurance_inquiry", // 保险福利问题（敏感）

  // 跟进沟通类
  "followup_chat", // 需要跟进的聊天

  // 考勤排班类（🆕 新增）
  "attendance_inquiry", // 出勤要求咨询
  "flexibility_inquiry", // 排班灵活性咨询
  "attendance_policy_inquiry", // 考勤政策咨询
  "work_hours_inquiry", // 工时要求咨询
  "availability_inquiry", // 时间段可用性咨询
  "part_time_support", // 兼职支持咨询
]);

// 基础模板Schema（仅支持标准回复类型）
export const BaseTemplatesSchema = z.record(ReplyContextSchema, z.array(z.string()));

// 可选的模板Schema
export const OptionalTemplatesSchema = BaseTemplatesSchema.optional();

// 必需的模板Schema（用于品牌配置）
export const RequiredTemplatesSchema = BaseTemplatesSchema.refine(
  val => {
    return val !== undefined && typeof val === "object";
  },
  {
    message: "品牌配置必须包含templates字段",
  }
);

// 筛选规则Schema
export const ScreeningRulesSchema = z.object({
  age: z.object({
    min: z.number().min(0),
    max: z.number().min(0),
    preferred: z.array(z.number()),
  }),
  blacklistKeywords: z.array(z.string()),
  preferredKeywords: z.array(z.string()),
});

// 品牌配置Schema
export const BrandConfigSchema = z.object({
  templates: RequiredTemplatesSchema,
});

// Boss直聘数据Schema
export const ZhipinDataSchema = z.object({
  city: z.string(),
  stores: z.array(StoreSchema),
  brands: z.record(z.string(), BrandConfigSchema),
  defaultBrand: z.string().optional(),
});

// 示例数据Schema
export const SampleDataSchema = z.object({
  zhipin: ZhipinDataSchema,
});

// 候选人信息从统一源导入，避免重复定义
export { CandidateInfoSchema } from "@/lib/tools/zhipin/types";

// 对话消息Schema
export const ConversationMessageSchema = z.object({
  role: z.enum(["candidate", "recruiter"]),
  message: z.string(),
  timestamp: z.string().optional(),
});

// LLM工具参数基础Schema
export const BaseReplyArgsSchema = z.object({
  city: z.string().optional(),
  brand: z.string().optional(),
});

// 消息分类结果Schema
export const MessageClassificationSchema = z.object({
  replyType: ReplyContextSchema,
  extractedInfo: z.object({
    mentionedBrand: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    mentionedLocations: z
      .array(
        z.object({
          location: z.string(),
          confidence: z.number(),
        })
      )
      .nullable()
      .optional(),
    mentionedDistricts: z
      .array(
        z.object({
          district: z.string().describe("区域名称"),
          confidence: z.number().min(0).max(1).describe("区域识别置信度 0-1"),
        })
      )
      .max(3)
      .nullable()
      .optional(),
    specificAge: z.number().nullable().optional(),
    hasUrgency: z.boolean().nullable().optional(),
    preferredSchedule: z.string().nullable().optional(),
  }),
  reasoningText: z.string(),
});

// 🔧 通过 z.infer 生成 TypeScript 类型

export type SalaryDetails = z.infer<typeof SalaryDetailsSchema>;
export type Benefits = z.infer<typeof BenefitsSchema>;
export type AttendanceRequirement = z.infer<typeof AttendanceRequirementSchema>;
export type ScheduleType = z.infer<typeof ScheduleTypeSchema>;
export type AttendancePolicy = z.infer<typeof AttendancePolicySchema>;
export type TimeSlotAvailability = z.infer<typeof TimeSlotAvailabilitySchema>;
export type SchedulingFlexibility = z.infer<typeof SchedulingFlexibilitySchema>;
export type Position = z.infer<typeof PositionSchema>;
export type Store = z.infer<typeof StoreSchema>;
export type Templates = z.infer<typeof BaseTemplatesSchema>;
export type ScreeningRules = z.infer<typeof ScreeningRulesSchema>;
export type BrandConfig = z.infer<typeof BrandConfigSchema>;
export type ZhipinData = z.infer<typeof ZhipinDataSchema>;
export type SampleData = z.infer<typeof SampleDataSchema>;
export type ReplyContext = z.infer<typeof ReplyContextSchema>;
export { type CandidateInfo } from "@/lib/tools/zhipin/types"; // 从统一源导出类型
export type ConversationMessage = z.infer<typeof ConversationMessageSchema>;
export type MessageClassification = z.infer<typeof MessageClassificationSchema>;
export type Extract = z.infer<typeof MessageClassificationSchema>["extractedInfo"];

// 🔧 LLM工具参数类型映射（使用类型而非Schema，因为过于复杂）
export type ReplyArgsMap = {
  initial_inquiry: z.infer<typeof BaseReplyArgsSchema> & {
    workHours?: string;
    baseSalary?: number;
    levelSalary?: string;
  };
  location_inquiry: z.infer<typeof BaseReplyArgsSchema>;
  no_location_match: {
    alternativeLocation: string;
    alternativeArea: string;
    transportInfo?: string;
  };
  salary_inquiry: {
    baseSalary: number;
    levelSalary?: string;
  };
  schedule_inquiry: z.infer<typeof BaseReplyArgsSchema>;
  interview_request: {
    storeName?: string;
  };
  age_concern: {
    ageAppropriate: boolean;
    reason?: string;
  };
  insurance_inquiry: {
    hasInsurance: boolean;
    insuranceType?: string;
  };
  followup_chat: z.infer<typeof BaseReplyArgsSchema> & {
    alternativeOption: string;
    encouragement: string;
  };
  general_chat: z.infer<typeof BaseReplyArgsSchema> & {
    defaultMessage: string;
  };
  attendance_inquiry: z.infer<typeof BaseReplyArgsSchema>;
  flexibility_inquiry: z.infer<typeof BaseReplyArgsSchema>;
  attendance_policy_inquiry: z.infer<typeof BaseReplyArgsSchema>;
  work_hours_inquiry: z.infer<typeof BaseReplyArgsSchema>;
  availability_inquiry: z.infer<typeof BaseReplyArgsSchema>;
  part_time_support: z.infer<typeof BaseReplyArgsSchema>;
};

// 联合类型，用于 LLM 工具的参数
export type LLMToolArgs = ReplyArgsMap[keyof ReplyArgsMap];

// 回复类型的中文名称映射
export const REPLY_TYPE_NAMES: Record<ReplyContext, string> = {
  // 基础咨询类
  initial_inquiry: "初次咨询",
  location_inquiry: "位置询问",
  no_location_match: "无匹配位置",
  schedule_inquiry: "时间安排",
  interview_request: "面试请求",
  general_chat: "一般对话",

  // 敏感信息类
  salary_inquiry: "薪资询问",
  age_concern: "年龄问题",
  insurance_inquiry: "保险询问",

  // 跟进沟通类
  followup_chat: "跟进对话",

  // 考勤排班类
  attendance_inquiry: "出勤要求",
  flexibility_inquiry: "排班灵活性",
  attendance_policy_inquiry: "考勤政策",
  work_hours_inquiry: "工时要求",
  availability_inquiry: "时段可用性",
  part_time_support: "兼职支持",
};
