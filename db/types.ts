import { z } from "zod";
import { createSelectSchema, createInsertSchema } from "drizzle-zod";
import {
  dataDictionary,
  dictionaryTypeDefinition,
  dictionaryChangeLog
} from "./schema";

// ==================== 数据字典相关类型 ====================

/**
 * 来源系统枚举
 * 仅保留海棉系统和其他，不从 BOSS 直聘和鱼泡网同步品牌
 */
export const SourceSystem = {
  HAIMIAN: 'haimian',
  OTHER: 'other',
} as const;

export type SourceSystemValue = typeof SourceSystem[keyof typeof SourceSystem];

/**
 * 来源系统 Zod Schema
 */
export const sourceSystemSchema = z.enum(['haimian', 'other']);

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
export type CreateBrandInput = Omit<InsertDataDictionary, 'dictionaryType'> & {
  operatedBy: string;  // 操作人（用于审计日志）
};

/**
 * 字典类型枚举
 */
export const DictionaryType = {
  BRAND: 'brand',
  REGION: 'region',
  EDUCATION: 'education',
  OTHER: 'other'
} as const;

export type DictionaryTypeValue = typeof DictionaryType[keyof typeof DictionaryType];

/**
 * 类型安全的字典类型访问器
 * 解决 DictionaryType.BRAND 类型推断问题
 */
export const getDictionaryType = <K extends keyof typeof DictionaryType>(
  key: K
): typeof DictionaryType[K] => {
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
  operation: z.enum(['INSERT', 'UPDATE', 'DELETE', 'INIT']),
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
  organizationId: string;  // 改为 string 以支持不同类型的键
  brandName: string;
  sourceSystem?: SourceSystemValue;   // 来源系统
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
  organizationId: z.string().optional(),  // 改为 string
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
  dictionaryType: z.enum(['brand', 'region', 'education', 'other']),
  sourceSystem: sourceSystemSchema.optional(),  // 来源系统
  mappings: z.array(z.object({
    key: z.string(),  // 改为 string
    value: z.string().min(1),
    description: z.string().optional(),
    displayOrder: z.number().optional(),
    metadata: z.any().optional(),
  })),
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
    organizationId: dict.mappingKey,  // 现在是 string 类型
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
  brand: Omit<BrandMapping, 'id' | 'createdAt' | 'updatedAt'>
): InsertDataDictionary {
  return {
    dictionaryType: DictionaryType.BRAND,
    mappingKey: brand.organizationId,  // 现在是 string 类型
    mappingValue: brand.brandName,
    sourceSystem: brand.sourceSystem,
    description: brand.description,
    isActive: brand.isActive,
    displayOrder: brand.displayOrder,
  };
}