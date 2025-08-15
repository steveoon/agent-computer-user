/**
 * 智能模式匹配配置
 * 用于从自然语言对话中提取关键信息
 * 同步、高效、覆盖80%真实场景
 * 
 * 基于实际业务数据 (organization-mapping.ts) 构建，确保数据一致性
 */

import { ORGANIZATION_MAPPING, SHANGHAI_REGION_MAPPING } from '@/lib/constants/organization-mapping';

/**
 * 餐饮品牌字典
 * 基于 ORGANIZATION_MAPPING 构建，包含常见别名
 * 当 ORGANIZATION_MAPPING 更新时，这里会自动包含新品牌
 */
function buildBrandDictionary() {
  // 从实际业务数据获取品牌列表
  const actualBrands = Object.values(ORGANIZATION_MAPPING);
  
  // 为每个实际品牌定义别名
  const brandAliases: Record<string, string[]> = {
    '肯德基': ['肯德基', 'KFC', 'kfc', '天津肯德基'], // 包含天津肯德基
    '必胜客': ['必胜客', 'Pizza Hut', 'PizzaHut', '上海必胜客'], // 包含上海必胜客
    '奥乐齐': ['奥乐齐', 'ALDI', 'Aldi'],
    '大米先生': ['大米先生'],
    '成都你六姐': ['成都你六姐', '你六姐'],
    
    // 常见品牌别名（即使不在 ORGANIZATION_MAPPING 中，也可能在对话中提到）
    '麦当劳': ['麦当劳', '金拱门', 'McDonald', 'M记'],
    '星巴克': ['星巴克', 'Starbucks', '星爸爸'],
    '汉堡王': ['汉堡王', 'Burger King', 'BK'],
    '海底捞': ['海底捞'],
    '瑞幸': ['瑞幸', 'luckin', 'Luckin'],
    'Manner': ['Manner', 'manner'],
    '蜜雪冰城': ['蜜雪冰城', '蜜雪'],
    '喜茶': ['喜茶', 'HEYTEA'],
    '奈雪': ['奈雪', '奈雪的茶'],
    '全家': ['全家', 'FamilyMart'],
    '罗森': ['罗森', 'LAWSON', 'Lawson'],
    '7-11': ['7-11', '711', 'Seven Eleven'],
  };
  
  // 构建最终字典，优先包含实际业务品牌
  const dictionary: Record<string, string[]> = {};
  
  // 首先添加实际业务品牌
  actualBrands.forEach(brand => {
    dictionary[brand] = brandAliases[brand] || [brand];
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
 * 上海地区字典
 * 基于 SHANGHAI_REGION_MAPPING 构建真实的行政区划数据
 */
function buildLocationDictionary() {
  // 从实际业务数据获取区域列表
  const actualDistricts = Object.values(SHANGHAI_REGION_MAPPING);
  
  // 预定义的区域简称映射表（基于实际使用习惯）
  const districtAliasMapping: Record<string, string[]> = {
    '黄浦区': ['黄浦区', '黄浦'],
    '徐汇区': ['徐汇区', '徐汇'],
    '长宁区': ['长宁区', '长宁'],
    '静安区': ['静安区', '静安'],
    '普陀区': ['普陀区', '普陀'],
    '闸北区': ['闸北区', '闸北'], // 历史区域
    '虹口区': ['虹口区', '虹口'],
    '杨浦区': ['杨浦区', '杨浦'],
    '闵行区': ['闵行区', '闵行'],
    '宝山区': ['宝山区', '宝山'],
    '嘉定区': ['嘉定区', '嘉定'],
    '浦东新区': ['浦东新区', '浦东'], // 特殊：新区简称为浦东
    '金山区': ['金山区', '金山'],
    '松江区': ['松江区', '松江'],
    '青浦区': ['青浦区', '青浦'],
    '奉贤区': ['奉贤区', '奉贤'],
    '崇明区': ['崇明区', '崇明'],
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
      if (district.endsWith('区')) {
        districtAliases.push(district.slice(0, -1));
      }
    }
  });
  
  return {
    // 实际行政区划
    districts: districtAliases,
    
    // 知名商圈和地标（保留，因为用户常用这些描述位置）
    areas: [
      '陆家嘴', '张江', '世纪公园', '花木', '川沙', '周浦', '康桥',
      '徐家汇', '漕河泾', '田林', '康健',
      '南京西路', '人民广场', '南京东路', '外滩', '豫园',
      '中山公园', '江苏路', '镇宁路',
      '五角场', '大学路', '复旦', '同济',
      '淮海路', '新天地', '打浦桥',
      '七宝', '莘庄', '春申', '颛桥',
      '九亭', '泗泾', '佘山', '新桥',
    ],
    
    // 地铁站（部分常见的）
    stations: [
      '人民广场站', '陆家嘴站', '静安寺站', '徐家汇站',
      '中山公园站', '虹桥站', '龙阳路站', '世纪大道站',
      '南京东路站', '南京西路站', '张江高科站', '九亭站',
    ],
  };
}

export const LOCATION_DICTIONARY = buildLocationDictionary();

/**
 * 时间偏好关键词
 */
export const TIME_PATTERNS = {
  '早班': ['早班', '早上', '上午', '白天'],
  '晚班': ['晚班', '夜班', '晚上', '夜里', '通宵'],
  '周末': ['周末', '周六', '周日', '双休'],
  '兼职': ['兼职', '临时', '短期'],
  '全职': ['全职', '长期', '正式'],
  '灵活': ['灵活', '弹性', '自由安排'],
};

/**
 * 紧急度关键词
 */
export const URGENCY_PATTERNS = {
  high: ['急', '马上', '立刻', '现在', '今天', '赶紧', '急需', '尽快'],
  medium: ['最近', '这几天', '本周', '近期'],
  low: ['看看', '了解', '咨询', '随便问问'],
};

/**
 * 智能提取工具类
 */
export class SmartExtractor {
  /**
   * 提取品牌信息
   */
  static extractBrands(text: string): string[] {
    const foundBrands = new Set<string>();
    
    for (const [brand, aliases] of Object.entries(BRAND_DICTIONARY)) {
      for (const alias of aliases) {
        if (text.includes(alias)) {
          foundBrands.add(brand);
          break; // 找到一个别名就够了
        }
      }
    }
    
    return Array.from(foundBrands);
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
      if (age >= 16 && age <= 70) { // 合理的工作年龄范围
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
  static extractUrgency(text: string): 'high' | 'medium' | 'low' | null {
    for (const keyword of URGENCY_PATTERNS.high) {
      if (text.includes(keyword)) {
        return 'high';
      }
    }
    
    for (const keyword of URGENCY_PATTERNS.medium) {
      if (text.includes(keyword)) {
        return 'medium';
      }
    }
    
    for (const keyword of URGENCY_PATTERNS.low) {
      if (text.includes(keyword)) {
        return 'low';
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
    urgency: 'high' | 'medium' | 'low' | null;
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