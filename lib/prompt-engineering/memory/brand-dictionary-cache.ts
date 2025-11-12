/**
 * 品牌字典缓存模块（独立于 smart-patterns 与 actions，避免循环依赖）
 *
 * 双重保障机制：
 * 1. 手动清空：写操作后立即失效（0 延迟）
 * 2. TTL 过期：5 分钟后自动失效（兜底保障）
 */

/**
 * 品牌名称类型（主品牌名，如 "肯德基"、"大连肯德基"）
 */
export type BrandName = string;

/**
 * 品牌别名类型（包括主品牌名和其他别名，如 ["肯德基", "KFC", "kfc"]）
 */
export type BrandAlias = string;

/**
 * 品牌字典类型
 * 映射关系：品牌名 → 别名数组
 *
 * @example
 * {
 *   "肯德基": ["肯德基", "KFC", "kfc"],
 *   "大连肯德基": ["大连肯德基", "大连KFC", "大连kfc"],
 *   "麦当劳": ["麦当劳", "金拱门", "McDonald", "M记"]
 * }
 */
export type BrandDictionary = Record<BrandName, BrandAlias[]>;

/**
 * 品牌字典缓存状态
 */
export type BrandDictionaryCacheState = {
  /** 品牌字典：品牌名 → 别名数组的映射 */
  brandDictionary: BrandDictionary | null;
  /** 按长度降序排列的品牌名数组（用于优先匹配长品牌名） */
  sortedBrands: BrandName[] | null;
  /** 实际业务品牌集合（用于快速查找） */
  actualBrandSet: Set<BrandName> | null;
  /** 缓存时间戳（毫秒） */
  timestamp: number | null;
  /** 缓存生存时间（毫秒，默认 5 分钟） */
  ttl: number;
};

export const BrandDictionaryCache: BrandDictionaryCacheState = {
  brandDictionary: null,
  sortedBrands: null,
  actualBrandSet: null,
  timestamp: null,
  ttl: 5 * 60 * 1000, // 5 分钟（兜底保障）
};

/**
 * 检查缓存是否有效
 * @returns true 如果缓存存在且未过期
 */
export function isCacheValid(): boolean {
  if (!BrandDictionaryCache.timestamp) {
    return false;
  }

  const age = Date.now() - BrandDictionaryCache.timestamp;
  const isValid = age < BrandDictionaryCache.ttl;

  // 只在缓存过期时打印
  if (!isValid) {
    console.log('[BrandCache] TTL 过期，缓存失效');
  }

  return isValid;
}

/**
 * 手动清空缓存（写操作后立即失效）
 */
export function clearBrandDictionaryCache() {
  const hadCache = BrandDictionaryCache.brandDictionary !== null;

  BrandDictionaryCache.brandDictionary = null;
  BrandDictionaryCache.sortedBrands = null;
  BrandDictionaryCache.actualBrandSet = null;
  BrandDictionaryCache.timestamp = null;

  // 只在实际清空缓存时打印
  if (hadCache) {
    console.log('[BrandCache] 手动清空缓存');
  }
}
