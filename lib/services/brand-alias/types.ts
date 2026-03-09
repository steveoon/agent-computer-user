/**
 * Duliday 品牌别名服务 — 类型定义
 *
 * 对应 API: POST /ai/api/brand/list
 */

import { z } from "zod/v3";
import type { BrandDictionary } from "@/lib/prompt-engineering/memory/brand-dictionary-cache";

/**
 * Duliday 品牌列表响应项
 */
export const DulidayBrandItemSchema = z.object({
  /** 新品牌 ID */
  id: z.number(),
  /** 品牌标准名称 */
  name: z.string(),
  /** 品牌别名列表 */
  aliases: z.array(z.string()),
  /** 旧接口的品牌 ID（组织 ID） */
  projectIdList: z.array(z.number()),
});

export type DulidayBrandItem = z.infer<typeof DulidayBrandItemSchema>;

/**
 * Duliday 品牌列表 API 响应
 */
export const DulidayBrandListResponseSchema = z.object({
  code: z.number(),
  message: z.string().optional(),
  data: z.object({
    result: z.array(DulidayBrandItemSchema),
    total: z.number(),
  }),
});

export type DulidayBrandListResponse = z.infer<typeof DulidayBrandListResponseSchema>;

/**
 * 别名反向查找 Map: alias (lowercase) → 品牌标准名称
 */
export type BrandAliasMap = Map<string, string>;

/**
 * 品牌别名服务构建结果
 */
export interface BrandAliasData {
  /** 正向字典: brandName → aliases[] */
  dictionary: BrandDictionary;
  /** 反向查找: alias → brandName */
  aliasMap: BrandAliasMap;
  /** 实际业务品牌集合 */
  actualBrandSet: Set<string>;
  /** 按名称长度降序排列的业务品牌 */
  sortedBrands: string[];
}
