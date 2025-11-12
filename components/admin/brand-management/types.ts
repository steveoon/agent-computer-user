/**
 * 品牌管理相关的类型定义
 * 尽可能复用 db/types.ts 中已定义的类型
 */

// 从 db/types.ts 导入已有类型
export type { DataDictionary as Brand } from "@/db/types";
export type { InsertDataDictionary } from "@/db/types";
export type { SourceSystemValue as SourceSystem } from "@/db/types";
import type { SourceSystemValue } from "@/db/types";

// 从 store 导入查询参数和响应类型
export type {
  BrandQueryParams,
  BrandListData as BrandListResponse,
} from "@/lib/stores/brand-management-store";

/**
 * 创建品牌的表单数据
 * 基于 InsertDataDictionary，但只包含表单需要的字段
 */
export interface CreateBrandFormData {
  mappingKey: string; // 组织ID（必填）
  mappingValue: string; // 品牌名称（必填）
  sourceSystem: SourceSystemValue; // 来源系统（必填，默认 "manual"）
  displayOrder: number; // 显示顺序（可选，默认 0）
  description: string; // 描述（可选）
}

/**
 * 来源系统选项
 */
export const SOURCE_SYSTEMS = [
  { label: "海棉系统", value: "haimian" },
  { label: "其他", value: "other" },
] satisfies ReadonlyArray<{ label: string; value: SourceSystemValue }>;

/**
 * 类型守卫：判断是否为受支持的来源系统
 */
export function isSourceSystem(value: unknown): value is SourceSystemValue {
  return SOURCE_SYSTEMS.some(s => s.value === value);
}
