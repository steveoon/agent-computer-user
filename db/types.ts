import { z } from "zod";
import { createSelectSchema, createInsertSchema } from "drizzle-zod";
import {
  dataDictionary,
  dictionaryTypeDefinition,
  dictionaryChangeLog,
  recruitmentEvents,
  recruitmentDailyStats,
  recruitmentAgents,
} from "./schema";

// ==================== 数据字典相关类型 ====================

/**
 * 来源系统枚举
 * 仅保留海棉系统和其他，不从 BOSS 直聘和鱼泡网同步品牌
 */
export const SourceSystem = {
  HAIMIAN: "haimian",
  OTHER: "other",
} as const;

export type SourceSystemValue = (typeof SourceSystem)[keyof typeof SourceSystem];

/**
 * 来源系统 Zod Schema
 */
export const sourceSystemSchema = z.enum(["haimian", "other"]);

/**
 * 数据字典查询 Schema（从 Drizzle Schema 生成）
 */
export const selectDataDictionarySchema = createSelectSchema(dataDictionary);

/**
 * 数据字典插入 Schema（从 Drizzle Schema 生成）
 */
export const insertDataDictionarySchema = createInsertSchema(dataDictionary, {
  // 自定义字段验证
  mappingKey: z.string().min(1, "映射键不能为空").max(100),
  mappingValue: z.string().min(1, "映射值不能为空").max(255),
  sourceSystem: sourceSystemSchema.optional(),
  description: z.string().max(1000, "描述信息过长").optional(),
  metadata: z.any().optional(), // JSON 数据
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

/**
 * 数据字典更新 Schema（所有字段可选）
 */
export const updateDataDictionarySchema = insertDataDictionarySchema.partial();

/**
 * 数据字典 TypeScript 类型
 */
export type DataDictionary = z.infer<typeof selectDataDictionarySchema>;
export type InsertDataDictionary = z.infer<typeof insertDataDictionarySchema>;
export type UpdateDataDictionary = z.infer<typeof updateDataDictionarySchema>;

/**
 * 创建品牌输入类型
 * 基于 InsertDataDictionary，移除 dictionaryType（固定为 'brand'），添加 operatedBy 用于审计
 */
export type CreateBrandInput = Omit<InsertDataDictionary, "dictionaryType"> & {
  operatedBy: string; // 操作人（用于审计日志）
};

/**
 * 字典类型枚举
 */
export const DictionaryType = {
  BRAND: "brand",
  REGION: "region",
  EDUCATION: "education",
  POSITION: "position",
  OTHER: "other",
} as const;

export type DictionaryTypeValue = (typeof DictionaryType)[keyof typeof DictionaryType];

/**
 * 类型安全的字典类型访问器
 * 解决 DictionaryType.BRAND 类型推断问题
 */
export const getDictionaryType = <K extends keyof typeof DictionaryType>(
  key: K
): (typeof DictionaryType)[K] => {
  return DictionaryType[key];
};

// ==================== 字典类型定义相关类型 ====================

export const selectDictionaryTypeDefSchema = createSelectSchema(dictionaryTypeDefinition);
export const insertDictionaryTypeDefSchema = createInsertSchema(dictionaryTypeDefinition, {
  typeCode: z.string().min(1).max(50),
  typeName: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  configuration: z.any().optional(),
  isSystem: z.boolean().optional(),
  isActive: z.boolean().optional(),
});
export const updateDictionaryTypeDefSchema = insertDictionaryTypeDefSchema.partial();

export type DictionaryTypeDefinition = z.infer<typeof selectDictionaryTypeDefSchema>;
export type InsertDictionaryTypeDefinition = z.infer<typeof insertDictionaryTypeDefSchema>;
export type UpdateDictionaryTypeDefinition = z.infer<typeof updateDictionaryTypeDefSchema>;

// ==================== 变更日志相关类型 ====================

export const selectChangeLogSchema = createSelectSchema(dictionaryChangeLog);
export const insertChangeLogSchema = createInsertSchema(dictionaryChangeLog, {
  operation: z.enum(["INSERT", "UPDATE", "DELETE", "INIT"]),
  oldData: z.any().optional(),
  newData: z.any().optional(),
  changeReason: z.string().optional(),
  operatedBy: z.string().min(1).max(100),
});

export type DictionaryChangeLog = z.infer<typeof selectChangeLogSchema>;
export type InsertDictionaryChangeLog = z.infer<typeof insertChangeLogSchema>;

// ==================== 业务相关类型 ====================

/**
 * 品牌映射类型（用于兼容现有代码）
 * 注意：organizationId 现在是 string 类型，但内容通常是数字字符串
 */
export interface BrandMapping {
  id: number;
  organizationId: string; // 改为 string 以支持不同类型的键
  brandName: string;
  sourceSystem?: SourceSystemValue; // 来源系统
  description?: string;
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 品牌映射查询参数
 */
export const brandMappingQuerySchema = z.object({
  organizationId: z.string().optional(), // 改为 string
  brandName: z.string().optional(),
  sourceSystem: sourceSystemSchema.optional(),
  isActive: z.boolean().optional(),
  limit: z.number().positive().optional(),
  offset: z.number().nonnegative().optional(),
});

export type BrandMappingQuery = z.infer<typeof brandMappingQuerySchema>;

/**
 * 批量导入数据字典的 Schema
 */
export const bulkImportDictionarySchema = z.object({
  dictionaryType: z.enum(["brand", "region", "education", "other"]),
  sourceSystem: sourceSystemSchema.optional(), // 来源系统
  mappings: z.array(
    z.object({
      key: z.string(), // 改为 string
      value: z.string().min(1),
      description: z.string().optional(),
      displayOrder: z.number().optional(),
      metadata: z.any().optional(),
    })
  ),
  replaceExisting: z.boolean().default(false), // 是否替换现有数据
});

export type BulkImportDictionary = z.infer<typeof bulkImportDictionarySchema>;

// ==================== 工具函数类型 ====================

/**
 * 转换数据字典为品牌映射格式
 */
export function dataDictionaryToBrandMapping(dict: DataDictionary): BrandMapping | null {
  if (dict.dictionaryType !== DictionaryType.BRAND) {
    return null;
  }

  // 验证 sourceSystem 是否为有效值
  const sourceSystem = dict.sourceSystem
    ? sourceSystemSchema.safeParse(dict.sourceSystem).success
      ? (dict.sourceSystem as SourceSystemValue)
      : undefined
    : undefined;

  return {
    id: dict.id,
    organizationId: dict.mappingKey, // 现在是 string 类型
    brandName: dict.mappingValue,
    sourceSystem,
    description: dict.description ?? undefined,
    isActive: dict.isActive,
    displayOrder: dict.displayOrder ?? 0,
    createdAt: new Date(dict.createdAt),
    updatedAt: new Date(dict.updatedAt),
  };
}

/**
 * 转换品牌映射为数据字典格式
 */
export function brandMappingToDataDictionary(
  brand: Omit<BrandMapping, "id" | "createdAt" | "updatedAt">
): InsertDataDictionary {
  return {
    dictionaryType: DictionaryType.BRAND,
    mappingKey: brand.organizationId, // 现在是 string 类型
    mappingValue: brand.brandName,
    sourceSystem: brand.sourceSystem,
    description: brand.description,
    isActive: brand.isActive,
    displayOrder: brand.displayOrder,
  };
}

// ==================== 招聘统计相关类型 ====================

/**
 * 事件类型枚举值
 */
export const RecruitmentEventType = {
  CANDIDATE_CONTACTED: "candidate_contacted",
  MESSAGE_SENT: "message_sent",
  MESSAGE_RECEIVED: "message_received",
  WECHAT_EXCHANGED: "wechat_exchanged",
  INTERVIEW_BOOKED: "interview_booked",
  CANDIDATE_HIRED: "candidate_hired",
} as const;

export type RecruitmentEventTypeValue =
  (typeof RecruitmentEventType)[keyof typeof RecruitmentEventType];

/**
 * 数据来源枚举
 */
export const DataSource = {
  TOOL_AUTO: "tool_auto",
  MANUAL: "manual",
  API_CALLBACK: "api_callback",
} as const;

export type DataSourceValue = (typeof DataSource)[keyof typeof DataSource];

/**
 * 来源平台枚举
 */
export const SourcePlatform = {
  ZHIPIN: "zhipin",
  YUPAO: "yupao",
  DULIDAY: "duliday",
} as const;

export type SourcePlatformValue = (typeof SourcePlatform)[keyof typeof SourcePlatform];

/**
 * API来源枚举
 * 区分请求来自网页端还是开放接口
 */
export const ApiSource = {
  WEB: "web",
  OPEN_API: "open_api",
} as const;

export type ApiSourceValue = (typeof ApiSource)[keyof typeof ApiSource];

// --- Drizzle-Zod 生成的基础类型 ---

/**
 * 招聘事件 Schema 和类型
 */
export const selectRecruitmentEventSchema = createSelectSchema(recruitmentEvents);
export const insertRecruitmentEventSchema = createInsertSchema(recruitmentEvents, {
  agentId: z.string().min(1, "Agent ID 不能为空").max(50),
  candidateKey: z.string().min(1, "候选人标识不能为空").max(255),
  sessionId: z.string().max(100).optional(),
  candidateName: z.string().max(100).optional(),
  candidatePosition: z.string().max(100).optional(),
  candidateAge: z.string().max(20).optional(),
  candidateGender: z.string().max(10).optional(),
  candidateEducation: z.string().max(50).optional(),
  candidateExpectedSalary: z.string().max(50).optional(),
  candidateExpectedLocation: z.string().max(100).optional(),
  candidateHeight: z.string().max(20).optional(),
  candidateWeight: z.string().max(20).optional(),
  candidateHealthCert: z.boolean().optional(),
  sourcePlatform: z.string().max(50).optional(),
  jobName: z.string().max(100).optional(),
  dataSource: z.string().max(20).optional(),
  apiSource: z.string().max(20).optional(),
  unreadCountBeforeReply: z.number().int().optional(),
});

export type RecruitmentEvent = z.infer<typeof selectRecruitmentEventSchema>;
export type InsertRecruitmentEvent = z.infer<typeof insertRecruitmentEventSchema>;

/**
 * 每日统计 Schema 和类型
 */
export const selectRecruitmentDailyStatsSchema = createSelectSchema(recruitmentDailyStats);
export const insertRecruitmentDailyStatsSchema = createInsertSchema(recruitmentDailyStats, {
  agentId: z.string().min(1).max(50),
});

export type RecruitmentDailyStats = z.infer<typeof selectRecruitmentDailyStatsSchema>;
export type InsertRecruitmentDailyStats = z.infer<typeof insertRecruitmentDailyStatsSchema>;

/**
 * Agent 配置 Schema 和类型
 */
export const selectRecruitmentAgentSchema = createSelectSchema(recruitmentAgents);
export const insertRecruitmentAgentSchema = createInsertSchema(recruitmentAgents, {
  agentId: z.string().min(1, "Agent ID 不能为空").max(50),
  displayName: z.string().min(1, "显示名称不能为空").max(100),
  platform: z.string().max(50).optional(),
});

export type RecruitmentAgent = z.infer<typeof selectRecruitmentAgentSchema>;
export type InsertRecruitmentAgent = z.infer<typeof insertRecruitmentAgentSchema>;

// --- eventDetails 类型安全定义（Discriminated Union）---

/**
 * 消息发送事件详情
 */
export const messageSentDetailsSchema = z.object({
  type: z.literal("message_sent"),
  content: z.string(),
  isAutoReply: z.boolean().optional(),
});

export type MessageSentDetails = z.infer<typeof messageSentDetailsSchema>;

/**
 * 入站消息事件详情（MESSAGE_RECEIVED）
 *
 * 由 get_unread_candidates 检测到未读消息时触发
 * 记录未读消息数量用于 Total Flow 计算
 */
export const messageReceivedDetailsSchema = z.object({
  type: z.literal("message_received"),
  /** 检测到的未读消息数量 */
  unreadCount: z.number().optional(),
  /** 最后一条消息预览 */
  lastMessagePreview: z.string().optional(),
});

export type MessageReceivedDetails = z.infer<typeof messageReceivedDetailsSchema>;

/**
 * 微信交换类型枚举
 *
 * 用于区分交换发起方和状态：
 * - requested: 我方发起请求，等待对方同意
 * - accepted: 我方同意对方请求，立即成功
 * - completed: 从聊天记录检测到已完成的交换
 */
export const WechatExchangeType = {
  REQUESTED: "requested",
  ACCEPTED: "accepted",
  COMPLETED: "completed",
} as const;

export type WechatExchangeTypeValue = (typeof WechatExchangeType)[keyof typeof WechatExchangeType];

/**
 * 微信交换事件详情
 */
export const wechatExchangedDetailsSchema = z.object({
  type: z.literal("wechat_exchanged"),
  wechatNumber: z.string().optional(),
  /** 交换类型：requested-我方发起/accepted-同意对方/completed-检测到已完成 */
  exchangeType: z.enum(["requested", "accepted", "completed"]).optional(),
});

export type WechatExchangedDetails = z.infer<typeof wechatExchangedDetailsSchema>;

/**
 * 面试预约事件详情
 */
export const interviewBookedDetailsSchema = z.object({
  type: z.literal("interview_booked"),
  interviewTime: z.string(),
  dulidayJobId: z.number().optional(),
  address: z.string().optional(),
  candidatePhone: z.string().optional(),
});

export type InterviewBookedDetails = z.infer<typeof interviewBookedDetailsSchema>;

/**
 * 主动打招呼事件详情（CANDIDATE_CONTACTED）
 *
 * 由 say_hello 工具成功发送初始招呼时触发
 * 用于追踪主动外联，区别于回复消息
 */
export const candidateContactedDetailsSchema = z.object({
  type: z.literal("candidate_contacted"),
});

export type CandidateContactedDetails = z.infer<typeof candidateContactedDetailsSchema>;

/**
 * 候选人上岗事件详情
 */
export const candidateHiredDetailsSchema = z.object({
  type: z.literal("candidate_hired"),
  hireDate: z.string().optional(),
  notes: z.string().optional(),
});

export type CandidateHiredDetails = z.infer<typeof candidateHiredDetailsSchema>;

/**
 * 事件详情联合类型
 */
export const eventDetailsSchema = z.discriminatedUnion("type", [
  messageSentDetailsSchema,
  messageReceivedDetailsSchema,
  wechatExchangedDetailsSchema,
  interviewBookedDetailsSchema,
  candidateContactedDetailsSchema,
  candidateHiredDetailsSchema,
]);

export type EventDetails = z.infer<typeof eventDetailsSchema>;

// --- 辅助函数 ---

/**
 * 生成候选人唯一标识（candidateKey）
 *
 * 生成规则：平台_姓名_职位
 * 注意：接受"同名同职位不同人"被合并的风险
 */
export function generateCandidateKey(params: {
  platform: string;
  candidateName: string;
  candidatePosition?: string;
}): string {
  const parts = [
    params.platform,
    params.candidateName,
    params.candidatePosition || "unknown",
  ];
  return parts.join("_");
}

/**
 * 生成会话ID（sessionId）
 *
 * 生成规则：agentId_candidateKey_YYYY-MM-DD
 * 同一候选人同一天的所有事件归为一个会话（按账号隔离）
 */
export function generateSessionId(agentId: string, candidateKey: string, eventTime: Date): string {
  const dateStr = eventTime.toISOString().split("T")[0]; // YYYY-MM-DD
  return `${agentId}_${candidateKey}_${dateStr}`;
}

/**
 * 创建招聘事件的便捷函数
 */
export function createRecruitmentEventInput(params: {
  agentId: string;
  eventType: RecruitmentEventTypeValue;
  eventTime: Date;
  candidateName: string;
  candidatePosition?: string;
  brandId?: number;
  sourcePlatform?: SourcePlatformValue;
  eventDetails?: EventDetails;
  wasUnreadBeforeReply?: boolean;
  unreadCountBeforeReply?: number;
  messageSequence?: number;
  jobId?: number;
  jobName?: string;
  dataSource?: DataSourceValue;
  apiSource?: ApiSourceValue;
}): InsertRecruitmentEvent {
  const candidateKey = generateCandidateKey({
    platform: params.sourcePlatform || SourcePlatform.ZHIPIN,
    candidateName: params.candidateName,
    candidatePosition: params.candidatePosition,
  });

  const sessionId = generateSessionId(params.agentId, candidateKey, params.eventTime);

  return {
    agentId: params.agentId,
    eventType: params.eventType,
    eventTime: params.eventTime,
    candidateKey,
    sessionId,
    candidateName: params.candidateName,
    candidatePosition: params.candidatePosition,
    brandId: params.brandId,
    sourcePlatform: params.sourcePlatform || SourcePlatform.ZHIPIN,
    eventDetails: params.eventDetails,
    wasUnreadBeforeReply: params.wasUnreadBeforeReply,
    unreadCountBeforeReply: params.unreadCountBeforeReply,
    messageSequence: params.messageSequence,
    jobId: params.jobId,
    jobName: params.jobName,
    dataSource: params.dataSource || DataSource.TOOL_AUTO,
    apiSource: params.apiSource || ApiSource.WEB,
  };
}
