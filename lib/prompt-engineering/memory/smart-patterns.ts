/**
 * 智能模式匹配配置
 * 用于从自然语言对话中提取关键信息
 * 异步加载、高效、覆盖80%真实场景
 *
 * 基于数据库品牌映射构建，确保数据一致性
 */

import { getAllBrandMappings } from "@/actions/brand-mapping";
import { BrandDictionaryCache, isCacheValid } from "./brand-dictionary-cache";

/**
 * 品牌字典缓存（延迟初始化）
 * 改为使用独立缓存模块，便于在 Actions 中清空缓存且避免循环依赖
 */

/**
 * 餐饮品牌字典
 * 基于数据库品牌映射构建，包含常见别名
 *
 * 双重保障机制：
 * 1. 手动清空：写操作后立即失效（0 延迟）
 * 2. TTL 过期：5 分钟后自动失效（兜底保障）
 */
async function buildBrandDictionary() {
  // 如果缓存存在且有效，直接返回
  if (BrandDictionaryCache.brandDictionary && isCacheValid()) {
    return BrandDictionaryCache.brandDictionary;
  }

  // 从数据库获取品牌列表
  const brandMapping = await getAllBrandMappings();
  const actualBrands = Object.values(brandMapping);
  const actualBrandsSet = new Set(actualBrands); // 用 Set 优化性能

  // TODO: 待 Duliday 提供品牌别名查询接口后，从 API 动态获取别名数据，删除此硬编码。
  //  需注意：1) 接口数据需走 TTL 缓存；2) API 不可用时降级到品牌名本身；3) 非业务品牌（麦当劳等）可能需保留少量 fallback。
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

  // 缓存结果并记录时间戳
  BrandDictionaryCache.brandDictionary = dictionary;
  BrandDictionaryCache.sortedBrands = [...actualBrands].sort((a, b) => b.length - a.length);
  BrandDictionaryCache.actualBrandSet = actualBrandsSet;
  BrandDictionaryCache.timestamp = Date.now();

  return dictionary;
}

/**
 * 获取品牌字典（异步）
 * @deprecated 直接使用 SmartExtractor.extractBrands() 即可
 */
export async function getBrandDictionary() {
  return await buildBrandDictionary();
}

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
 * 查找文本中精确匹配的品牌（异步）
 * @param text 待匹配的文本
 * @returns 匹配到的品牌列表
 */
async function findExactMatches(text: string): Promise<string[]> {
  await buildBrandDictionary(); // 确保缓存已初始化
  return BrandDictionaryCache.sortedBrands!.filter(brand => text.includes(brand));
}

/**
 * 查找文本中通过别名匹配的品牌（异步）
 * @param text 待匹配的文本
 * @returns 匹配到的品牌列表
 */
async function findAliasMatches(text: string): Promise<string[]> {
  const dictionary = await buildBrandDictionary(); // 确保缓存已初始化
  const matches = new Set<string>();

  for (const [brand, aliases] of Object.entries(dictionary)) {
    for (const alias of aliases) {
      // 🎯 性能优化：使用 Set.has() 替代 Array.includes()，从 O(n) 降到 O(1)
      // 跳过已经是实际品牌名的别名（在第一阶段已处理）
      if (BrandDictionaryCache.actualBrandSet!.has(alias)) continue;

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
 * 用于从用户消息中识别地区关键词
 */
function buildLocationDictionary() {
  // 上海各区及其简称（用于 NLP 地区识别）
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
  for (const aliases of Object.values(districtAliasMapping)) {
    districtAliases.push(...aliases);
  }

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
   * 提取品牌信息（异步）
   * 两阶段匹配策略（合并结果）：
   * 1. 第一阶段：精确匹配实际业务品牌（数据库中定义的品牌）
   * 2. 第二阶段：别名匹配（BRAND_DICTIONARY中定义的品牌，包括非业务品牌）
   * 3. 合并两阶段结果，因为文本可能同时包含业务品牌和常见品牌别名
   * 4. 去重并过滤子串，确保结果唯一且无冗余
   *
   * 示例：
   * - "我想去肯德基或星巴克" → ["肯德基", "星巴克"]
   *   （肯德基：业务品牌 + 星巴克：常见品牌别名）
   */
  static async extractBrands(text: string): Promise<string[]> {
    // 第一阶段：精确匹配实际业务品牌
    const exactMatches = await findExactMatches(text);

    // 第二阶段：别名匹配（包括非业务品牌）
    const aliasMatches = await findAliasMatches(text);

    // 合并两个阶段的结果，因为文本可能同时包含业务品牌和常见品牌别名
    const combined = [...exactMatches, ...aliasMatches];

    // 去重并过滤子串
    return filterShadowedBrands([...new Set(combined)]);
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
   * 综合提取所有信息（异步）
   */
  static async extractAll(text: string): Promise<{
    brands: string[];
    locations: string[];
    age: number | null;
    timePreferences: string[];
    urgency: "high" | "medium" | "low" | null;
  }> {
    return {
      brands: await this.extractBrands(text),
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
 * const extracted = await SmartExtractor.extractAll(text);
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
