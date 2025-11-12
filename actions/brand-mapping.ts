"use server";

import { db } from "@/db";
import { dataDictionary, dictionaryChangeLog } from "@/db/schema";
import { eq, and, or, like, desc, asc, count, inArray } from "drizzle-orm";
import { getDictionaryType } from "@/db/types";
import type { DataDictionary, SourceSystemValue, CreateBrandInput } from "@/db/types";
import { clearBrandDictionaryCache } from "@/lib/prompt-engineering/memory/brand-dictionary-cache";

/**
 * 品牌映射相关的 Server Actions
 * 用于替换硬编码的 ORGANIZATION_MAPPING
 */

/**
 * 获取所有活跃的品牌映射
 * @returns 品牌映射对象 { organizationId: brandName }
 */
export async function getAllBrandMappings(): Promise<Record<string, string>> {
  try {
    const brands = await db
      .select({
        mappingKey: dataDictionary.mappingKey,
        mappingValue: dataDictionary.mappingValue,
      })
      .from(dataDictionary)
      .where(
        and(
          eq(dataDictionary.dictionaryType, getDictionaryType("BRAND")),
          eq(dataDictionary.isActive, true)
        )
      )
      .orderBy(dataDictionary.displayOrder);

    // 转换为兼容的 Record 格式
    const mapping: Record<string, string> = {};
    brands.forEach(brand => {
      mapping[brand.mappingKey] = brand.mappingValue;
    });

    return mapping;
  } catch (error) {
    console.error("获取品牌映射失败:", error);
    return {};
  }
}

/**
 * 根据组织ID获取品牌名称
 * @param orgId - 组织ID（数字或字符串）
 * @returns 品牌名称，如果未找到返回 undefined
 */
export async function getBrandNameByOrgId(orgId: number | string): Promise<string | undefined> {
  try {
    const key = typeof orgId === "number" ? String(orgId) : orgId;

    const result = await db
      .select({
        mappingValue: dataDictionary.mappingValue,
      })
      .from(dataDictionary)
      .where(
        and(
          eq(dataDictionary.dictionaryType, getDictionaryType("BRAND")),
          eq(dataDictionary.mappingKey, key),
          eq(dataDictionary.isActive, true)
        )
      )
      .limit(1);

    return result[0]?.mappingValue;
  } catch (error) {
    console.error(`获取品牌名称失败 (orgId: ${orgId}):`, error);
    return undefined;
  }
}

/**
 * 根据品牌名称获取组织ID
 * @param brandName - 品牌名称
 * @returns 组织ID（字符串），如果未找到返回 undefined
 */
export async function getOrgIdByBrandName(brandName: string): Promise<string | undefined> {
  try {
    const result = await db
      .select({
        mappingKey: dataDictionary.mappingKey,
      })
      .from(dataDictionary)
      .where(
        and(
          eq(dataDictionary.dictionaryType, getDictionaryType("BRAND")),
          eq(dataDictionary.mappingValue, brandName),
          eq(dataDictionary.isActive, true)
        )
      )
      .limit(1);

    return result[0]?.mappingKey;
  } catch (error) {
    console.error(`获取组织ID失败 (brandName: ${brandName}):`, error);
    return undefined;
  }
}

/**
 * 获取所有可用品牌列表
 * @returns 品牌列表数组 [{ id: string, name: string }]
 */
export async function getAvailableBrands(): Promise<Array<{ id: string; name: string }>> {
  try {
    const brands = await db
      .select({
        mappingKey: dataDictionary.mappingKey,
        mappingValue: dataDictionary.mappingValue,
      })
      .from(dataDictionary)
      .where(
        and(
          eq(dataDictionary.dictionaryType, getDictionaryType("BRAND")),
          eq(dataDictionary.isActive, true)
        )
      )
      .orderBy(dataDictionary.displayOrder);

    return brands.map(brand => ({
      id: brand.mappingKey,
      name: brand.mappingValue,
    }));
  } catch (error) {
    console.error("获取可用品牌列表失败:", error);
    return [];
  }
}

/**
 * 批量获取品牌名称
 * @param orgIds - 组织ID数组
 * @returns 品牌映射对象 { organizationId: brandName }
 */
export async function getBrandNamesByOrgIds(
  orgIds: Array<number | string>
): Promise<Record<string, string>> {
  try {
    const keys = orgIds.map(id => (typeof id === "number" ? String(id) : id));

    const brands = await db
      .select({
        mappingKey: dataDictionary.mappingKey,
        mappingValue: dataDictionary.mappingValue,
      })
      .from(dataDictionary)
      .where(
        and(
          eq(dataDictionary.dictionaryType, getDictionaryType("BRAND")),
          eq(dataDictionary.isActive, true),
          inArray(dataDictionary.mappingKey, keys)
        )
      );

    // 过滤出请求的 IDs
    const mapping: Record<string, string> = {};
    brands.forEach(brand => {
      // keys 已在 where 中过滤，这里直接映射
      mapping[brand.mappingKey] = brand.mappingValue;
    });

    return mapping;
  } catch (error) {
    console.error("批量获取品牌名称失败:", error);
    return {};
  }
}

/**
 * 创建新品牌
 * @param data - 品牌数据（基于 InsertDataDictionary，添加 operatedBy 用于审计）
 * @returns 创建结果
 */
export async function createBrand(
  data: CreateBrandInput
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    // 1. 检查组织ID是否已存在（仅检查启用的）
    const existing = await db
      .select()
      .from(dataDictionary)
      .where(
        and(
          eq(dataDictionary.dictionaryType, getDictionaryType("BRAND")),
          eq(dataDictionary.mappingKey, data.mappingKey),
          eq(dataDictionary.isActive, true)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return {
        success: false,
        error: `组织ID "${data.mappingKey}" 已存在`,
      };
    }

    // 2. 插入新品牌
    const [newBrand] = await db
      .insert(dataDictionary)
      .values({
        dictionaryType: getDictionaryType("BRAND"),
        mappingKey: data.mappingKey,
        mappingValue: data.mappingValue,
        sourceSystem: data.sourceSystem || "manual",
        displayOrder: data.displayOrder || 0,
        description: data.description,
        metadata: data.metadata,
        isActive: true,
        createdBy: data.operatedBy,
        updatedBy: data.operatedBy,
      })
      .returning();

    // 3. 记录变更日志
    await db.insert(dictionaryChangeLog).values({
      dictionaryId: newBrand.id,
      operation: "INSERT",
      newData: newBrand,
      changeReason: "新增品牌",
      operatedBy: data.operatedBy,
    });

    // 4. 清空品牌字典缓存
    clearBrandDictionaryCache();

    return { success: true, data: newBrand };
  } catch (error) {
    console.error("创建品牌失败:", error);
    // 处理唯一约束冲突（PostgreSQL 23505）
    const isUniqueViolation =
      typeof error === "object" &&
      error !== null &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (error as any).code === "23505";
    if (isUniqueViolation) {
      return {
        success: false,
        error: `组织ID "${data.mappingKey}" 已存在`,
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "未知错误",
    };
  }
}

/**
 * 分页查询品牌列表
 * @param params - 查询参数
 * @returns 品牌列表和总数
 */
export async function getBrands(params?: {
  page?: number; // 页码（从 1 开始）
  pageSize?: number; // 每页数量
  keyword?: string; // 搜索关键词（组织ID或品牌名称）
  sourceSystem?: SourceSystemValue; // 来源系统筛选
  isActive?: boolean; // 是否启用（默认 true）
  sortBy?: "createdAt" | "updatedAt" | "displayOrder"; // 排序字段
  sortOrder?: "asc" | "desc"; // 排序方向
}): Promise<{
  success: boolean;
  data?: {
    items: DataDictionary[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  error?: string;
}> {
  try {
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 10;
    const offset = (page - 1) * pageSize;
    const isActive = params?.isActive !== undefined ? params.isActive : true;
    const sortBy = params?.sortBy || "createdAt";
    const sortOrder = params?.sortOrder || "desc";

    // 构建查询条件
    const conditions = [
      eq(dataDictionary.dictionaryType, getDictionaryType("BRAND")),
      eq(dataDictionary.isActive, isActive),
    ];

    // 添加关键词搜索
    if (params?.keyword) {
      const keywordCondition = or(
        like(dataDictionary.mappingKey, `%${params.keyword}%`),
        like(dataDictionary.mappingValue, `%${params.keyword}%`)
      );
      if (keywordCondition) {
        conditions.push(keywordCondition);
      }
    }

    // 添加来源系统筛选
    if (params?.sourceSystem) {
      conditions.push(eq(dataDictionary.sourceSystem, params.sourceSystem));
    }

    // 查询总数
    const [totalResult] = await db
      .select({ count: count() })
      .from(dataDictionary)
      .where(and(...conditions));

    const total = totalResult?.count || 0;

    // 确定排序字段
    const sortField =
      sortBy === "createdAt"
        ? dataDictionary.createdAt
        : sortBy === "updatedAt"
          ? dataDictionary.updatedAt
          : dataDictionary.displayOrder;

    // 查询数据
    const rows = await db
      .select()
      .from(dataDictionary)
      .where(and(...conditions))
      .orderBy(sortOrder === "asc" ? asc(sortField) : desc(sortField))
      .limit(pageSize)
      .offset(offset);
    // 由于 drizzle-zod 在 Next SSR 下可能出现 _zod 解析问题，暂不做运行时 zod 校验
    const items = rows as DataDictionary[];

    return {
      success: true,
      data: {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  } catch (error) {
    console.error("查询品牌列表失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "未知错误",
    };
  }
}

/**
 * 删除品牌（软删除）
 * @param id - 品牌ID
 * @param operatedBy - 操作人
 * @returns 删除结果
 */
export async function deleteBrand(
  id: number,
  operatedBy: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const result = await db.transaction(async tx => {
      // 1) 获取并校验为品牌类型的原始数据
      const [oldBrand] = await tx
        .select()
        .from(dataDictionary)
        .where(
          and(
            eq(dataDictionary.id, id),
            eq(dataDictionary.dictionaryType, getDictionaryType("BRAND"))
          )
        )
        .limit(1);

      if (!oldBrand) {
        return { success: false, error: "品牌不存在" } as const;
      }

      if (!oldBrand.isActive) {
        return { success: false, error: "品牌已停用，无需重复操作" } as const;
      }

      // 2) 软删除（设置 isActive = false）
      const [deletedBrand] = await tx
        .update(dataDictionary)
        .set({
          isActive: false,
          updatedBy: operatedBy,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(dataDictionary.id, id),
            eq(dataDictionary.dictionaryType, getDictionaryType("BRAND"))
          )
        )
        .returning();

      // 3) 记录变更日志
      await tx.insert(dictionaryChangeLog).values({
        dictionaryId: id,
        operation: "UPDATE",
        oldData: oldBrand,
        newData: deletedBrand,
        changeReason: "删除品牌（逻辑删除）",
        operatedBy,
      });

      return {
        success: true,
        message: "品牌已停用，历史配置数据已保留",
      } as const;
    });

    // 删除成功，清空品牌字典缓存
    if (result.success) {
      clearBrandDictionaryCache();
    }

    return result;
  } catch (error) {
    console.error("删除品牌失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "未知错误",
    };
  }
}

/**
 * 恢复品牌（取消软删除）
 * @param id - 品牌ID
 * @param operatedBy - 操作人
 * @returns 恢复结果
 */
export async function restoreBrand(
  id: number,
  operatedBy: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const result = await db.transaction(async tx => {
      // 1) 获取并校验为品牌类型的原始数据
      const [oldBrand] = await tx
        .select()
        .from(dataDictionary)
        .where(
          and(
            eq(dataDictionary.id, id),
            eq(dataDictionary.dictionaryType, getDictionaryType("BRAND"))
          )
        )
        .limit(1);

      if (!oldBrand) {
        return { success: false, error: "品牌不存在" } as const;
      }

      if (oldBrand.isActive) {
        return { success: false, error: "品牌已经是活跃状态，无需恢复" } as const;
      }

      // 2) 恢复品牌（设置 isActive = true）
      const [restoredBrand] = await tx
        .update(dataDictionary)
        .set({
          isActive: true,
          updatedBy: operatedBy,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(dataDictionary.id, id),
            eq(dataDictionary.dictionaryType, getDictionaryType("BRAND"))
          )
        )
        .returning();

      // 3) 记录变更日志
      await tx.insert(dictionaryChangeLog).values({
        dictionaryId: id,
        operation: "UPDATE",
        oldData: oldBrand,
        newData: restoredBrand,
        changeReason: "恢复品牌",
        operatedBy,
      });

      return {
        success: true,
        message: "品牌已恢复，可以重新使用",
      } as const;
    });

    // 恢复成功，清空品牌字典缓存
    if (result.success) {
      clearBrandDictionaryCache();
    }

    return result;
  } catch (error) {
    console.error("恢复品牌失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "未知错误",
    };
  }
}
