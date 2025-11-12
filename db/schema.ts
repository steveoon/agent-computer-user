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
  uniqueIndex
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * 定义项目专属的 PostgreSQL Schema
 * 用于多项目共用数据库时的逻辑隔离
 */
export const appSchema = pgSchema('app_huajune');

/**
 * 数据字典类型枚举
 * 用于标识不同类型的映射关系
 */
export const dictionaryTypeEnum = appSchema.enum('dictionary_type', [
  'brand',           // 品牌映射
  'region',          // 区域映射
  'education',       // 学历映射
  'other'            // 其他自定义映射
]);

/**
 * 数据字典主表
 * 存储所有类型的映射关系，如品牌、区域、学历等
 * 设计为通用的键值对存储，支持未来扩展
 */
export const dataDictionary = appSchema.table("data_dictionary", {
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
}, (table) => [
  // 创建索引以提高查询性能
  index("idx_dictionary_type").on(table.dictionaryType),
  index("idx_type_key").on(table.dictionaryType, table.mappingKey),
  index("idx_is_active").on(table.isActive),

  // 部分唯一索引：仅对生效记录（is_active = true）保证唯一性
  // 这样允许历史记录（已删除的）可以重复，但当前生效的记录必须唯一
  uniqueIndex("unique_active_type_key")
    .on(table.dictionaryType, table.mappingKey)
    .where(sql`${table.isActive} = true`),
]);

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
export const dictionaryChangeLog = appSchema.table("dictionary_change_log", {
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
}, (table) => [
  // 创建索引
  index("idx_change_dictionary").on(table.dictionaryId),
  index("idx_change_operated_at").on(table.operatedAt),
]);