/**
 * 组织和区域映射配置
 *
 * 注意：品牌映射已迁移到数据库，请使用 @/actions/brand-mapping 中的函数
 * 注意：区域映射已由 Duliday API 的 storeRegionName 字段替代，不再硬编码
 */

/**
 * 学历ID到学历名称的映射
 */
export const EDUCATION_MAPPING: Record<number, string> = {
  9: "初中以下",
  5: "初中",
  4: "高中",
  8: "中专/技校/职高",
  10: "高职",
  3: "大专",
  2: "本科",
  6: "硕士",
} as const;

/**
 * 根据学历名称获取学历ID
 * @param educationName 学历名称
 * @returns 学历ID，如果未找到返回undefined
 */
export function getEducationIdByName(educationName: string): number | undefined {
  // 标准化输入
  const normalizedName = educationName.trim().toLowerCase();

  // 创建别名映射
  const aliases: Record<string, number> = {
    初中以下: 9,
    小学: 9,
    初中: 5,
    高中: 4,
    中专: 8,
    技校: 8,
    职高: 8,
    "中专/技校/职高": 8,
    高职: 10,
    大专: 3,
    专科: 3,
    本科: 2,
    学士: 2,
    硕士: 6,
    研究生: 6,
  };

  // 查找匹配
  for (const [alias, id] of Object.entries(aliases)) {
    if (
      alias.toLowerCase().includes(normalizedName) ||
      normalizedName.includes(alias.toLowerCase())
    ) {
      return id;
    }
  }

  return undefined;
}

/**
 * 根据学历ID获取学历名称
 */
export function getEducationNameById(educationId: number): string | undefined {
  return EDUCATION_MAPPING[educationId];
}
