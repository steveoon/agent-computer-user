/**
 * Duliday 组织ID到品牌名称的映射表
 *
 * 这个映射表用于将 Duliday API 中的 organizationId 转换为我们系统中的品牌名称
 * 请根据实际的组织ID手动维护这个映射关系
 */
export const ORGANIZATION_MAPPING: Record<number, string> = {
  // 原有品牌
  5: "肯德基",
  746: "来伊份",
  850: "上海必胜客",
  865: "奥乐齐",
  941: "成都你六姐",
  985: "大米先生",
  1072: "天津肯德基",
  1102: "嘉定山姆",
  1107: "成都必胜客",
  1161: "M Stand",

  // 新增品牌 (2025-01-24)
  77: "ZARA",
  183: "西贝莜面村",
  188: "哈根达斯",
  744: "波司登",
  883: "李维斯",
  887: "摩提工房-西树泡芙",
  1043: "北京肯德基",
  1045: "北京必胜客",
  1097: "Drunk Baker",
  1110: "小肥羊",
  1111: "黄记煌",
  1116: "成都肯德基",
  1131: "杭州肯德基",
  1142: "深圳肯德基",
  1149: "广州肯德基",
  1150: "高科西山姆",
  1151: "嘉松中路山姆",
  1152: "普陀真如山姆",
  1159: "佛山必胜客",
  1164: "塔可贝尔",
  1165: "左庭右院",
  1170: "可可牛",
  1167: "大连肯德基",
  870: "海底捞",
};

/**
 * 获取所有可同步的品牌列表
 */
export function getAvailableBrands(): Array<{ id: number; name: string }> {
  return Object.entries(ORGANIZATION_MAPPING).map(([id, name]) => ({
    id: parseInt(id),
    name,
  }));
}

/**
 * 根据组织ID获取品牌名称
 */
export function getBrandNameByOrgId(orgId: number): string | undefined {
  return ORGANIZATION_MAPPING[orgId];
}

/**
 * 根据品牌名称获取组织ID
 */
export function getOrgIdByBrandName(brandName: string): number | undefined {
  const entry = Object.entries(ORGANIZATION_MAPPING).find(([_, name]) => name === brandName);
  return entry ? parseInt(entry[0]) : undefined;
}

/**
 * 上海市区域ID到区域名称的映射
 * 基于 Duliday API 的 storeRegionId 字段
 */
export const SHANGHAI_REGION_MAPPING: Record<number, string> = {
  310101: "黄浦区",
  310104: "徐汇区",
  310105: "长宁区",
  310106: "静安区",
  310107: "普陀区",
  310108: "闸北区", // 已并入静安区，保留以防数据中仍有使用
  310109: "虹口区",
  310110: "杨浦区",
  310112: "闵行区",
  310113: "宝山区",
  310114: "嘉定区",
  310115: "浦东新区",
  310116: "金山区",
  310117: "松江区",
  310118: "青浦区",
  310120: "奉贤区",
  310151: "崇明区",
} as const;

/**
 * 根据区域ID获取区域名称
 */
export function getDistrictByRegionId(regionId: number): string {
  return SHANGHAI_REGION_MAPPING[regionId] || "未知区域";
}

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
