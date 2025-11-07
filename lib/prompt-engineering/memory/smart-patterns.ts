/**
 * 智能模式匹配配置
 * 用于从自然语言对话中提取关键信息
 * 同步、高效、覆盖80%真实场景
 *
 * 基于实际业务数据 (organization-mapping.ts) 构建，确保数据一致性
 */

import {
  ORGANIZATION_MAPPING,
  SHANGHAI_REGION_MAPPING,
} from "@/lib/constants/organization-mapping";

/**
 * 餐饮品牌字典
 * 基于 ORGANIZATION_MAPPING 构建，包含常见别名
 * 当 ORGANIZATION_MAPPING 更新时，这里会自动包含新品牌
 */
function buildBrandDictionary() {
  // 从实际业务数据获取品牌列表
  const actualBrands = Object.values(ORGANIZATION_MAPPING);
  const actualBrandsSet = new Set(actualBrands); // 用 Set 优化性能

  // 为每个实际品牌定义别名（只包含真正的别名，不包含独立品牌）
  const brandAliases: Record<string, string[]> = {
    // 基础品牌（只保留真别名，不包含区域品牌）
    肯德基: ["肯德基", "KFC", "kfc"],
    必胜客: ["必胜客", "Pizza Hut", "PizzaHut"],
    奥乐齐: ["奥乐齐", "ALDI", "Aldi"],
    大米先生: ["大米先生"],
    成都你六姐: ["成都你六姐", "你六姐"], // ✓ 真别名
    海底捞: ["海底捞", "海捞"],

    // 区域品牌（每个都是独立品牌，有自己的变体）
    大连肯德基: ["大连肯德基", "大连KFC", "大连kfc"],
    天津肯德基: ["天津肯德基", "天津KFC", "天津kfc"],
    北京肯德基: ["北京肯德基", "北京KFC", "北京kfc"],
    成都肯德基: ["成都肯德基", "成都KFC", "成都kfc"],
    深圳肯德基: ["深圳肯德基", "深圳KFC", "深圳kfc"],
    广州肯德基: ["广州肯德基", "广州KFC", "广州kfc"],
    杭州肯德基: ["杭州肯德基", "杭州KFC", "杭州kfc"],
    上海必胜客: ["上海必胜客", "上海Pizza Hut", "上海PizzaHut"],
    北京必胜客: ["北京必胜客", "北京Pizza Hut", "北京PizzaHut"],
    成都必胜客: ["成都必胜客", "成都Pizza Hut", "成都PizzaHut"],
    佛山必胜客: ["佛山必胜客", "佛山Pizza Hut", "佛山PizzaHut"],

    // 常见品牌别名（即使不在 ORGANIZATION_MAPPING 中，也可能在对话中提到）
    麦当劳: ["麦当劳", "金拱门", "McDonald", "M记"],
    星巴克: ["星巴克", "Starbucks", "星爸爸"],
    汉堡王: ["汉堡王", "Burger King", "BK"],
    瑞幸: ["瑞幸", "luckin", "Luckin"],
    Manner: ["Manner", "manner"],
    蜜雪冰城: ["蜜雪冰城", "蜜雪"],
    喜茶: ["喜茶", "HEYTEA"],
    奈雪: ["奈雪", "奈雪的茶"],
    全家: ["全家", "FamilyMart"],
    罗森: ["罗森", "LAWSON", "Lawson"],
    "7-11": ["7-11", "711", "Seven Eleven"],
  };

  // 构建最终字典，优先包含实际业务品牌
  const dictionary: Record<string, string[]> = {};

  // 首先添加所有实际业务品牌
  actualBrands.forEach(brand => {
    // 获取预定义的别名
    const predefinedAliases = brandAliases[brand] || [];

    // 过滤掉那些同时也是独立品牌的别名（除了自己）
    const validAliases = predefinedAliases.filter(
      alias => !actualBrandsSet.has(alias) || alias === brand
    );

    // 如果没有别名，至少包含自己
    dictionary[brand] = validAliases.length > 0 ? validAliases : [brand];
  });

  // 然后添加其他常见品牌（用于识别但不在业务范围内）
  Object.entries(brandAliases).forEach(([brand, aliases]) => {
    if (!dictionary[brand]) {
      dictionary[brand] = aliases;
    }
  });

  return dictionary;
}

export const BRAND_DICTIONARY = buildBrandDictionary();

/**
 * 预计算的品牌常量（避免每次调用都重新计算和排序）
 */
const ACTUAL_BRANDS = Object.values(ORGANIZATION_MAPPING);
const SORTED_BRANDS = [...ACTUAL_BRANDS].sort((a, b) => b.length - a.length);

/**
 * 过滤掉被其他品牌包含的子串品牌
 * 使用按长度降序 + 线性扫描的方式，避免 O(n²) 双重循环
 *
 * @param brands 待过滤的品牌列表
 * @returns 过滤后的品牌列表（只保留不是其他品牌子串的品牌）
 */
function filterShadowedBrands(brands: string[]): string[] {
  if (brands.length === 0) return [];

  const sorted = [...brands].sort((a, b) => b.length - a.length);
  const result: string[] = [];

  for (const brand of sorted) {
    // 只保留不是已有元素子串的品牌
    if (!result.some(existing => existing.includes(brand))) {
      result.push(brand);
    }
  }

  return result;
}

/**
 * 查找文本中精确匹配的品牌
 * @param text 待匹配的文本
 * @returns 匹配到的品牌列表
 */
function findExactMatches(text: string): string[] {
  return SORTED_BRANDS.filter(brand => text.includes(brand));
}

/**
 * 查找文本中通过别名匹配的品牌
 * @param text 待匹配的文本
 * @returns 匹配到的品牌列表
 */
function findAliasMatches(text: string): string[] {
  const matches = new Set<string>();

  for (const [brand, aliases] of Object.entries(BRAND_DICTIONARY)) {
    for (const alias of aliases) {
      // 跳过已经是实际品牌名的别名（在第一阶段已处理）
      if (ACTUAL_BRANDS.includes(alias)) continue;

      if (text.includes(alias)) {
        matches.add(brand);
        break; // 找到一个别名就够了
      }
    }
  }

  return Array.from(matches);
}

/**
 * 上海地区字典
 * 基于 SHANGHAI_REGION_MAPPING 构建真实的行政区划数据
 */
function buildLocationDictionary() {
  // 从实际业务数据获取区域列表
  const actualDistricts = Object.values(SHANGHAI_REGION_MAPPING);

  // 预定义的区域简称映射表（基于实际使用习惯）
  const districtAliasMapping: Record<string, string[]> = {
    黄浦区: ["黄浦区", "黄浦"],
    徐汇区: ["徐汇区", "徐汇"],
    长宁区: ["长宁区", "长宁"],
    静安区: ["静安区", "静安"],
    普陀区: ["普陀区", "普陀"],
    闸北区: ["闸北区", "闸北"], // 历史区域
    虹口区: ["虹口区", "虹口"],
    杨浦区: ["杨浦区", "杨浦"],
    闵行区: ["闵行区", "闵行"],
    宝山区: ["宝山区", "宝山"],
    嘉定区: ["嘉定区", "嘉定"],
    浦东新区: ["浦东新区", "浦东"], // 特殊：新区简称为浦东
    金山区: ["金山区", "金山"],
    松江区: ["松江区", "松江"],
    青浦区: ["青浦区", "青浦"],
    奉贤区: ["奉贤区", "奉贤"],
    崇明区: ["崇明区", "崇明"],
  };

  // 构建最终的区域别名列表
  const districtAliases: string[] = [];
  actualDistricts.forEach(district => {
    const aliases = districtAliasMapping[district];
    if (aliases) {
      districtAliases.push(...aliases);
    } else {
      // 如果没有预定义，使用默认规则作为fallback
      districtAliases.push(district);
      if (district.endsWith("区")) {
        districtAliases.push(district.slice(0, -1));
      }
    }
  });

  return {
    // 实际行政区划
    districts: districtAliases,

    // 知名商圈和地标（保留，因为用户常用这些描述位置）
    areas: [
      "陆家嘴",
      "张江",
      "世纪公园",
      "花木",
      "川沙",
      "周浦",
      "康桥",
      "徐家汇",
      "漕河泾",
      "田林",
      "康健",
      "南京西路",
      "人民广场",
      "南京东路",
      "外滩",
      "豫园",
      "中山公园",
      "江苏路",
      "镇宁路",
      "五角场",
      "大学路",
      "复旦",
      "同济",
      "淮海路",
      "新天地",
      "打浦桥",
      "七宝",
      "莘庄",
      "春申",
      "颛桥",
      "九亭",
      "泗泾",
      "佘山",
      "新桥",
    ],

    // 地铁站（部分常见的）
    stations: [
      "人民广场站",
      "陆家嘴站",
      "静安寺站",
      "徐家汇站",
      "中山公园站",
      "虹桥站",
      "龙阳路站",
      "世纪大道站",
      "南京东路站",
      "南京西路站",
      "张江高科站",
      "九亭站",
    ],
  };
}

export const LOCATION_DICTIONARY = buildLocationDictionary();

/**
 * 时间偏好关键词
 */
export const TIME_PATTERNS = {
  早班: ["早班", "早上", "上午", "白天"],
  晚班: ["晚班", "夜班", "晚上", "夜里", "通宵"],
  周末: ["周末", "周六", "周日", "双休"],
  兼职: ["兼职", "临时", "短期"],
  全职: ["全职", "长期", "正式"],
  灵活: ["灵活", "弹性", "自由安排"],
};

/**
 * 紧急度关键词
 */
export const URGENCY_PATTERNS = {
  high: ["急", "马上", "立刻", "现在", "今天", "赶紧", "急需", "尽快"],
  medium: ["最近", "这几天", "本周", "近期"],
  low: ["看看", "了解", "咨询", "随便问问"],
};

/**
 * 智能提取工具类
 */
export class SmartExtractor {
  /**
   * 提取品牌信息
   * 两阶段匹配策略：
   * 1. 第一阶段：精确匹配实际业务品牌（按长度降序，避免子串误匹配）
   * 2. 第二阶段：如果没找到，使用别名匹配（fallback）
   */
  static extractBrands(text: string): string[] {
    // 第一阶段：精确匹配
    const exactMatches = filterShadowedBrands(findExactMatches(text));
    if (exactMatches.length > 0) return exactMatches;

    // 第二阶段：别名匹配（fallback）
    return filterShadowedBrands(findAliasMatches(text));
  }

  /**
   * 提取位置信息
   */
  static extractLocations(text: string): string[] {
    const foundLocations = new Set<string>();

    // 检查行政区
    for (const district of LOCATION_DICTIONARY.districts) {
      if (text.includes(district)) {
        foundLocations.add(district);
      }
    }

    // 检查商圈
    for (const area of LOCATION_DICTIONARY.areas) {
      if (text.includes(area)) {
        foundLocations.add(area);
      }
    }

    // 检查地铁站
    for (const station of LOCATION_DICTIONARY.stations) {
      if (text.includes(station)) {
        foundLocations.add(station);
      }
    }

    return Array.from(foundLocations);
  }

  /**
   * 提取年龄信息
   */
  static extractAge(text: string): number | null {
    const ageMatch = text.match(/(\d{1,2})岁/);
    if (ageMatch) {
      const age = parseInt(ageMatch[1]);
      if (age >= 16 && age <= 70) {
        // 合理的工作年龄范围
        return age;
      }
    }
    return null;
  }

  /**
   * 提取时间偏好
   */
  static extractTimePreferences(text: string): string[] {
    const preferences = new Set<string>();

    for (const [preference, keywords] of Object.entries(TIME_PATTERNS)) {
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          preferences.add(preference);
          break;
        }
      }
    }

    return Array.from(preferences);
  }

  /**
   * 判断紧急度
   */
  static extractUrgency(text: string): "high" | "medium" | "low" | null {
    for (const keyword of URGENCY_PATTERNS.high) {
      if (text.includes(keyword)) {
        return "high";
      }
    }

    for (const keyword of URGENCY_PATTERNS.medium) {
      if (text.includes(keyword)) {
        return "medium";
      }
    }

    for (const keyword of URGENCY_PATTERNS.low) {
      if (text.includes(keyword)) {
        return "low";
      }
    }

    return null;
  }

  /**
   * 综合提取所有信息
   */
  static extractAll(text: string): {
    brands: string[];
    locations: string[];
    age: number | null;
    timePreferences: string[];
    urgency: "high" | "medium" | "low" | null;
  } {
    return {
      brands: this.extractBrands(text),
      locations: this.extractLocations(text),
      age: this.extractAge(text),
      timePreferences: this.extractTimePreferences(text),
      urgency: this.extractUrgency(text),
    };
  }
}

/**
 * 使用示例：
 *
 * const text = "我想去肯德基工作，住在浦东张江，今年25岁，急需找个晚班";
 * const extracted = SmartExtractor.extractAll(text);
 *
 * // 结果：
 * {
 *   brands: ['肯德基'],
 *   locations: ['浦东', '张江'],
 *   age: 25,
 *   timePreferences: ['晚班'],
 *   urgency: 'high'
 * }
 */
