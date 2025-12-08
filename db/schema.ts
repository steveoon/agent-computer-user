import {
  pgSchema,
  serial,
  integer,
  text,
  timestamp,
  uuid,
  varchar,
  boolean,
  index,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * 定义项目专属的 PostgreSQL Schema
 * 用于多项目共用数据库时的逻辑隔离
 */
export const appSchema = pgSchema("app_huajune");

/**
 * 数据字典类型枚举
 * 用于标识不同类型的映射关系
 */
export const dictionaryTypeEnum = appSchema.enum("dictionary_type", [
  "brand", // 品牌映射
  "region", // 区域映射
  "education", // 学历映射
  "position", // 岗位映射
  "other", // 其他自定义映射
]);

/**
 * 数据字典主表
 * 存储所有类型的映射关系，如品牌、区域、学历等
 * 设计为通用的键值对存储，支持未来扩展
 */
export const dataDictionary = appSchema.table(
  "data_dictionary",
  {
    // 主键：使用自增序列 ID
    id: serial("id").primaryKey(),

    // 字典类型：品牌、区域、学历等
    dictionaryType: dictionaryTypeEnum("dictionary_type").notNull(),

    // 映射键：对应原始的组织ID、区域ID等
    // 使用 varchar 以支持不同类型的键（数字、字符串等）
    mappingKey: varchar("mapping_key", { length: 100 }).notNull(),

    // 映射值：对应的名称（品牌名、区域名等）
    mappingValue: varchar("mapping_value", { length: 255 }).notNull(),

    // 来源系统：标识数据来自哪个外部系统（如 duliday、zhipin 等）
    sourceSystem: varchar("source_system", { length: 50 }),

    // 额外信息：可存储如区域代码、品牌描述等附加数据
    metadata: jsonb("metadata"),

    // 显示顺序：用于在列表中排序
    displayOrder: integer("display_order").default(0),

    // 是否启用：软删除标记
    isActive: boolean("is_active").default(true).notNull(),

    // 描述信息
    description: text("description"),

    // 审计字段
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: varchar("created_by", { length: 100 }),
    updatedBy: varchar("updated_by", { length: 100 }),
  },
  table => [
    // 创建索引以提高查询性能
    index("idx_dictionary_type").on(table.dictionaryType),
    index("idx_type_key").on(table.dictionaryType, table.mappingKey),
    index("idx_is_active").on(table.isActive),

    // 部分唯一索引：仅对生效记录（is_active = true）保证唯一性
    // 这样允许历史记录（已删除的）可以重复，但当前生效的记录必须唯一
    uniqueIndex("unique_active_type_key")
      .on(table.dictionaryType, table.mappingKey)
      .where(sql`${table.isActive} = true`),
  ]
);

/**
 * 字典类型定义表
 * 用于管理可用的字典类型，支持动态添加新的映射类型
 */
export const dictionaryTypeDefinition = appSchema.table("dictionary_type_definition", {
  // 主键：使用自增序列 ID
  id: serial("id").primaryKey(),

  // 类型代码：与枚举值对应（如 'brand', 'region' 等）
  typeCode: varchar("type_code", { length: 50 }).notNull().unique(),

  // 类型名称：显示名称（如 "品牌映射", "区域映射" 等）
  typeName: varchar("type_name", { length: 100 }).notNull(),

  // 类型描述
  description: text("description"),

  // 配置信息：可存储该类型的特殊配置
  configuration: jsonb("configuration"),

  // 是否系统内置：内置类型不可删除
  isSystem: boolean("is_system").default(false).notNull(),

  // 是否启用
  isActive: boolean("is_active").default(true).notNull(),

  // 审计字段
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 数据字典变更历史表
 * 记录所有字典数据的变更历史，用于审计和回溯
 */
export const dictionaryChangeLog = appSchema.table(
  "dictionary_change_log",
  {
    // 主键：使用 UUID
    id: uuid("id").primaryKey().defaultRandom(),

    // 关联的字典记录 ID
    dictionaryId: integer("dictionary_id").notNull(),

    // 操作类型
    operation: varchar("operation", { length: 20 }).notNull(), // INSERT, UPDATE, DELETE

    // 变更前的数据
    oldData: jsonb("old_data"),

    // 变更后的数据
    newData: jsonb("new_data"),

    // 变更原因
    changeReason: text("change_reason"),

    // 操作者
    operatedBy: varchar("operated_by", { length: 100 }).notNull(),

    // 操作时间
    operatedAt: timestamp("operated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  table => [
    // 创建索引
    index("idx_change_dictionary").on(table.dictionaryId),
    index("idx_change_operated_at").on(table.operatedAt),
  ]
);

// =====================================================
// 招聘数据统计相关表
// =====================================================

/**
 * 事件类型枚举
 * 定义招聘流程中的关键事件节点
 */
export const recruitmentEventTypeEnum = appSchema.enum("recruitment_event_type", [
  "candidate_contacted", // 候选人首次接触（获取未读消息）
  "message_sent", // 发送消息
  "message_received", // 收到消息
  "wechat_exchanged", // 微信交换成功
  "interview_booked", // 面试预约成功
  "candidate_hired", // 候选人上岗（需人工录入或API回调）
]);

/**
 * 招聘事件记录表（核心事件日志）
 *
 * 设计思路：采用事件溯源模式，记录每一个原子事件
 * 便于灵活聚合统计和历史数据回溯
 */
export const recruitmentEvents = appSchema.table(
  "recruitment_events",
  {
    // 主键
    id: uuid("id").primaryKey().defaultRandom(),

    // === 关联信息 ===
    // Agent ID（对应 BOSS 直聘账号标识，如 "zhipin-001"）
    agentId: varchar("agent_id", { length: 50 }).notNull(),

    // 候选人唯一标识（用于跨事件关联同一候选人）
    // 生成规则：平台_姓名_职位_品牌ID
    candidateKey: varchar("candidate_key", { length: 255 }).notNull(),

    // 会话ID（同一候选人同一天的所有事件归为一个会话）
    // 生成规则：agentId_candidateKey_YYYY-MM-DD
    sessionId: varchar("session_id", { length: 100 }),

    // === 事件信息 ===
    eventType: recruitmentEventTypeEnum("event_type").notNull(),

    // 事件发生时间（从工具返回的时间戳解析）
    eventTime: timestamp("event_time", { withTimezone: true }).notNull(),

    // === 候选人快照（蓝领场景优化）===
    // 事件发生时的候选人信息快照（便于历史查询）
    candidateName: varchar("candidate_name", { length: 100 }),
    candidatePosition: varchar("candidate_position", { length: 100 }),
    candidateAge: varchar("candidate_age", { length: 20 }),
    candidateGender: varchar("candidate_gender", { length: 10 }),
    candidateEducation: varchar("candidate_education", { length: 50 }),
    candidateExpectedSalary: varchar("candidate_expected_salary", { length: 50 }),
    candidateExpectedLocation: varchar("candidate_expected_location", { length: 100 }),
    candidateHeight: varchar("candidate_height", { length: 20 }),
    candidateWeight: varchar("candidate_weight", { length: 20 }),
    candidateHealthCert: boolean("candidate_health_cert"),

    // === 事件详情（JSON）===
    // 根据事件类型存储不同的详情，类型定义见 db/types.ts
    eventDetails: jsonb("event_details"),

    // === 来源信息 ===
    // 来源平台（zhipin, yupao 等）
    sourcePlatform: varchar("source_platform", { length: 50 }).default("zhipin"),

    // 岗位信息（从聊天详情或面试预约获取）
    jobId: integer("job_id"),
    jobName: varchar("job_name", { length: 100 }),
    brandId: integer("brand_id"), // 关联 data_dictionary 中的品牌

    // === 统计辅助字段 ===
    // 是否为"未读回复"（发送消息时该候选人有未读消息）
    wasUnreadBeforeReply: boolean("was_unread_before_reply"),
    // 回复前的未读消息数量（用于累加统计 Unread Replied 指标）
    unreadCountBeforeReply: integer("unread_count_before_reply").default(0),

    // 会话中的消息序号（便于计算对话轮次）
    messageSequence: integer("message_sequence"),

    // === 审计字段 ===
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),

    // 数据来源（tool_auto: 工具自动记录, manual: 人工录入, api_callback: API回调）
    dataSource: varchar("data_source", { length: 20 }).default("tool_auto"),

    // API来源（web: 网页端, open_api: 开放接口）
    apiSource: varchar("api_source", { length: 20 }).default("web"),
  },
  table => [
    // 查询优化索引
    index("idx_re_agent").on(table.agentId),
    index("idx_re_time").on(table.eventTime),
    index("idx_re_type").on(table.eventType),
    index("idx_re_candidate").on(table.candidateKey),
    index("idx_re_session").on(table.sessionId),

    // 复合索引：支持 Dashboard 常见查询
    index("idx_re_agent_type_time").on(table.agentId, table.eventType, table.eventTime),
  ]
);

/**
 * 每日统计汇总表（预聚合，加速 Dashboard 查询）
 *
 * 设计思路：由定时任务每日凌晨从 recruitment_events 聚合生成
 * 支持快速查询日/周/月报表，避免实时聚合大量事件记录
 */
export const recruitmentDailyStats = appSchema.table(
  "recruitment_daily_stats",
  {
    // 主键
    id: serial("id").primaryKey(),

    // === 维度 ===
    agentId: varchar("agent_id", { length: 50 }).notNull(),
    statDate: timestamp("stat_date", { withTimezone: true }).notNull(), // 统计日期（当天0点）
    brandId: integer("brand_id"), // 可选：按品牌细分
    jobId: integer("job_id"), // 可选：按岗位细分

    // === 流量指标 ===
    totalEvents: integer("total_events").default(0).notNull(), // 总事件数
    uniqueCandidates: integer("unique_candidates").default(0).notNull(), // 独立候选人数
    uniqueSessions: integer("unique_sessions").default(0).notNull(), // 独立会话数

    // === 消息指标 ===
    messagesSent: integer("messages_sent").default(0).notNull(), // 发送消息数
    messagesReceived: integer("messages_received").default(0).notNull(), // 收到消息数
    candidatesContacted: integer("candidates_contacted").default(0).notNull(), // 接触候选人数
    candidatesReplied: integer("candidates_replied").default(0).notNull(), // 回复的候选人数
    unreadReplied: integer("unread_replied").default(0).notNull(), // 未读回复数

    // === 转化指标 ===
    wechatExchanged: integer("wechat_exchanged").default(0).notNull(), // 微信交换数
    interviewsBooked: integer("interviews_booked").default(0).notNull(), // 面试预约数
    candidatesHired: integer("candidates_hired").default(0).notNull(), // 上岗人数

    // === 计算指标（百分比 * 100，如 85.5% 存储为 8550）===
    replyRate: integer("reply_rate"), // 回复率
    wechatRate: integer("wechat_rate"), // 微信转化率
    interviewRate: integer("interview_rate"), // 面试转化率

    // === 审计与状态 ===
    isDirty: boolean("is_dirty").default(false).notNull(), // 是否需要重算
    aggregatedAt: timestamp("aggregated_at", { withTimezone: true }), // 聚合计算时间
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  table => [
    // 唯一约束：每个 agent 每天每个维度只有一条记录
    uniqueIndex("unique_daily_stats").on(table.agentId, table.statDate, table.brandId, table.jobId),

    // 查询索引
    index("idx_rds_agent").on(table.agentId),
    index("idx_rds_date").on(table.statDate),
    index("idx_rds_agent_date").on(table.agentId, table.statDate),
    index("idx_rds_dirty").on(table.isDirty),
  ]
);

/**
 * Agent（账号）配置表
 *
 * 存储各 Agent 的基本信息，便于 Dashboard 展示和数据关联
 */
export const recruitmentAgents = appSchema.table("recruitment_agents", {
  // 主键：Agent ID（如 "zhipin-001"）
  agentId: varchar("agent_id", { length: 50 }).primaryKey(),

  // 显示名称（如 "BOSS直聘-深圳1号"）
  displayName: varchar("display_name", { length: 100 }).notNull(),

  // 关联平台
  platform: varchar("platform", { length: 50 }).default("zhipin").notNull(),

  // 关联品牌（主要负责的品牌）
  primaryBrandId: integer("primary_brand_id"),

  // 账号状态
  isActive: boolean("is_active").default(true).notNull(),

  // 配置信息（如工作时间段、自动回复规则等）
  configuration: jsonb("configuration"),

  // 最后活跃时间
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }),

  // 最后一次成功同步数据的时间（运维监控用）
  lastSyncTime: timestamp("last_sync_time", { withTimezone: true }),

  // 审计字段
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
