/**
 * 地理编码服务
 *
 * 功能特性：
 * - 🗺️ 地址转坐标 - 调用高德地图 maps_geo API
 * - 📏 距离计算 - 使用 Haversine 公式计算直线距离
 * - 🔄 批量处理 - 并发控制 + 失败重试
 * - 💾 单例模式 - 避免重复创建客户端
 */

import { getAmapMCPTools } from "@/lib/mcp/client-manager";
import type { Store } from "@/types/zhipin";
import type {
  Coordinates,
  StoreWithDistance,
  BatchGeocodingResult,
  AmapMCPTools,
  MapsGeoResult,
  MapsTextSearchResult,
  MapsSearchDetailResult,
} from "@/types/geocoding";
import { CHINA_BOUNDS } from "@/types/geocoding";

// 重新导出类型供其他模块使用
export type { Coordinates, StoreWithDistance, BatchGeocodingResult } from "@/types/geocoding";

// ============ 常量配置 ============
// 高德地图地理编码 API 限制: 3次/秒
// 使用串行处理 + 400ms 延迟 ≈ 2.5次/秒，确保不超限

const CONCURRENCY = 1; // 串行处理，避免并发超限
const MAX_RETRIES = 3; // 最大重试次数
const RETRY_DELAY = 2000; // 重试间隔 (ms)
const RATE_LIMIT_DELAY = 5000; // 遇到限流时的额外等待 (ms)

// 中国大陆坐标范围从 types/geocoding.ts 导入

// ============ 工具函数 ============

/**
 * 角度转弧度
 */
function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * 休眠函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 检查坐标是否有效
 */
export function isValidCoordinates(coords: Coordinates | undefined | null): boolean {
  if (!coords) return false;
  if (coords.lat === 0 && coords.lng === 0) return false;

  // 检查是否在中国范围内
  return (
    coords.lat >= CHINA_BOUNDS.minLat &&
    coords.lat <= CHINA_BOUNDS.maxLat &&
    coords.lng >= CHINA_BOUNDS.minLng &&
    coords.lng <= CHINA_BOUNDS.maxLng
  );
}

/**
 * 从地址中提取城市名
 * 例如: "辽宁省大连市-金州区-辽河西路117号" → "大连"
 */
export function extractCityFromAddress(address: string): string {
  // 匹配 "XX市" 或 "XX省XX市" 格式
  const cityMatch = address.match(/([^省]+)(?:省|自治区)?([^市]+)市/);
  if (cityMatch && cityMatch[2]) {
    return cityMatch[2];
  }

  // 直辖市处理
  const directCities = ["北京", "上海", "天津", "重庆"];
  for (const city of directCities) {
    if (address.includes(city)) {
      return city;
    }
  }

  return "";
}

/**
 * 清理城市名，避免传入无效值（如"当地"）影响地理编码
 */
function normalizeCityForGeocoding(city?: string): string | undefined {
  if (!city) return undefined;
  const trimmed = city.trim();
  const invalidCities = new Set([
    "当地",
    "本地",
    "未知",
    "市辖区",
    "附近",
    "周边",
    "就近",
    "本市",
  ]);

  if (!trimmed || invalidCities.has(trimmed) || trimmed.length < 2) {
    return undefined;
  }

  return trimmed;
}

/**
 * 从地址中提取更“像地址”的内容（优先括号内）
 * 例如: "XX店（中山区鲁迅路29号，地铁青泥洼桥附近）" → "中山区鲁迅路29号"
 */
function extractAddressHint(address: string): string | undefined {
  const match = address.match(/[（(]([^）)]*)[）)]/);
  if (!match || !match[1]) return undefined;
  const hint = match[1].trim();
  if (!hint) return undefined;

  // 括号内容包含路/街/道/巷/号/弄等更像地址时才采用
  if (/路|街|道|巷|号|弄/.test(hint)) {
    return hint;
  }

  return undefined;
}

/**
 * 清理地址字符串，移除干扰地理编码的内容
 * 例如: "北京市-朝阳区-安慧里二区4号1, 2, 3层肯德基(亚运村店)"
 *    → "北京市朝阳区安慧里二区4号"
 */
function cleanAddressForGeocoding(address: string): string {
  const cleaned = address
    // 移除品牌名称（括号内的店名）
    .replace(/[（(][^）)]*店[）)]/g, "")
    .replace(/肯德基|麦当劳|必胜客|KFC|McDonald's/gi, "")
    // 移除面积描述
    .replace(/\d+平米/g, "")
    .replace(/平米/g, "")
    // 移除楼层描述（保留基本的X号）
    .replace(/[一二三四五六七八九十]层/g, "")
    .replace(/\d+层/g, "")
    .replace(/地下[一二三四五六七八九十\d]*层?/g, "")
    // 移除复杂的楼栋描述
    .replace(/[,，]\s*\d+层?/g, "")
    .replace(/\d+号楼?\d*[,，\s]+\d+/g, match => match.split(/[,，\s]+/)[0])
    // 移除分隔符
    .replace(/-/g, "")
    // 移除多余空格和括号
    .replace(/[（()）]/g, "")
    .replace(/\s+/g, "")
    .trim();

  return cleaned;
}

/**
 * 获取数组中出现最多的元素
 */
export function mostFrequent<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined;

  const counts = new Map<T, number>();
  let maxCount = 0;
  let maxItem: T | undefined;

  for (const item of arr) {
    if (!item) continue;
    const count = (counts.get(item) || 0) + 1;
    counts.set(item, count);
    if (count > maxCount) {
      maxCount = count;
      maxItem = item;
    }
  }

  return maxItem;
}

// ============ Haversine 距离计算 ============

/**
 * 使用 Haversine 公式计算两点之间的直线距离
 * @param coord1 第一个坐标点
 * @param coord2 第二个坐标点
 * @returns 距离（米）
 */
function haversineDistance(coord1: Coordinates, coord2: Coordinates): number {
  const R = 6371000; // 地球半径（米）

  const dLat = toRad(coord2.lat - coord1.lat);
  const dLng = toRad(coord2.lng - coord1.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coord1.lat)) *
      Math.cos(toRad(coord2.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // 返回米
}

// ============ 地理编码服务类 ============

/**
 * 地理编码服务
 * 单例模式，提供地址转坐标和距离计算功能
 */
class GeocodingService {
  private static instance: GeocodingService;
  private mcpToolsPromise: ReturnType<typeof getAmapMCPTools> | null = null;

  private constructor() {
    // 私有构造函数
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): GeocodingService {
    if (!GeocodingService.instance) {
      GeocodingService.instance = new GeocodingService();
    }
    return GeocodingService.instance;
  }

  /**
   * 获取高德 MCP 工具（懒加载）
   */
  private async getMCPTools() {
    if (!this.mcpToolsPromise) {
      this.mcpToolsPromise = getAmapMCPTools();
    }
    return this.mcpToolsPromise;
  }

  /**
   * 使用 POI 搜索获取位置坐标（两步调用）
   * 1. 先用 maps_text_search 搜索获取 POI id
   * 2. 再用 maps_search_detail 获取详细信息（包含 location）
   *
   * @param keyword 搜索关键词（如"万科西山"）
   * @param city 城市名（提高精度）
   * @returns 坐标对象，失败返回 null
   */
  async searchLocationByPOI(keyword: string, city?: string): Promise<Coordinates | null> {
    try {
      const tools = (await this.getMCPTools()) as AmapMCPTools;

      // Step 1: 使用 maps_text_search 搜索 POI
      const searchTool = tools.maps_text_search;
      if (!searchTool) {
        console.warn("⚠️ 高德 maps_text_search 工具不可用，跳过 POI 搜索");
        return null;
      }

      const normalizedCity = normalizeCityForGeocoding(city);

      // 清理关键词：移除括号注释（如"万科西山（最近门店）" → "万科西山"）
      const cleanedKeyword = keyword.replace(/[（(][^）)]*[）)]/g, "").trim();

      // 构建搜索关键词
      const searchKeyword = normalizedCity
        ? `${normalizedCity}${cleanedKeyword}`
        : cleanedKeyword;
      console.log(`   POI搜索: ${searchKeyword}`);

      const searchResult = await searchTool.execute({
        keywords: searchKeyword,
        ...(normalizedCity ? { city: normalizedCity } : {}),
      });

      if (searchResult.isError) {
        console.warn(`⚠️ POI 搜索失败: ${keyword}`, searchResult);
        return null;
      }

      // 解析搜索结果
      const searchTextContent = searchResult.content.find(c => c.type === "text");
      if (!searchTextContent) return null;

      const searchData = JSON.parse(searchTextContent.text) as MapsTextSearchResult;

      if (!searchData.pois || searchData.pois.length === 0) {
        console.log(`   POI搜索: 无结果`);
        return null;
      }

      // 获取第一个 POI 的 id
      const firstPOI = searchData.pois[0];
      console.log(`   找到POI: ${firstPOI.name}`);

      // Step 2: 使用 maps_search_detail 获取详细信息
      const detailTool = tools.maps_search_detail;
      if (!detailTool) {
        console.warn("⚠️ 高德 maps_search_detail 工具不可用");
        return null;
      }

      const detailResult = await detailTool.execute({ id: firstPOI.id });

      if (detailResult.isError) {
        console.warn(`⚠️ POI 详情获取失败: ${firstPOI.id}`, detailResult);
        return null;
      }

      // 解析详情结果
      const detailTextContent = detailResult.content.find(c => c.type === "text");
      if (!detailTextContent) return null;

      const detailData = JSON.parse(detailTextContent.text) as MapsSearchDetailResult;

      if (!detailData.location) {
        console.warn(`⚠️ POI 详情无坐标: ${firstPOI.name}`);
        return null;
      }

      // 解析坐标（格式: "经度,纬度"）
      const [lngStr, latStr] = detailData.location.split(",");
      const lng = parseFloat(lngStr);
      const lat = parseFloat(latStr);

      if (isNaN(lng) || isNaN(lat)) return null;

      const coords = { lat, lng };

      if (!isValidCoordinates(coords)) {
        console.warn(`⚠️ POI 返回无效坐标: ${keyword} → ${detailData.location}`);
        return null;
      }

      console.log(
        `   ✅ 坐标: ${lat.toFixed(4)}, ${lng.toFixed(4)} (${detailData.name || firstPOI.name})`
      );
      return coords;
    } catch (error) {
      console.error(`❌ POI 搜索异常: ${keyword}`, error);
      return null;
    }
  }

  /**
   * 智能位置编码：优先 POI 搜索，失败后降级到地理编码
   * 适用于候选人提到的位置（可能是小区名、地标、街道等）
   * @param location 位置描述
   * @param city 城市名
   * @returns 坐标对象，失败返回 null
   */
  async smartGeocode(location: string, city?: string): Promise<Coordinates | null> {
    // 判断是否像小区/楼盘名（包含"小区"、"花园"、"XX苑"等，或不包含"路"、"街"、"号"）
    const isPOILike =
      /小区|花园|苑$|城$|湾$|府$|庭$|庄$|园$|居$|里$|坊$|楼$|万科|保利|绿地|恒大|碧桂园|融创|中海/.test(
        location
      ) || !/路|街|道|号|弄/.test(location);

    if (isPOILike) {
      console.log(`   类型: POI (小区/楼盘)`);

      // 先尝试 POI 搜索
      const poiResult = await this.searchLocationByPOI(location, city);
      if (poiResult) {
        return poiResult;
      }

      console.log(`   POI失败，降级地理编码`);
    } else {
      console.log(`   类型: 标准地址`);
    }

    // 降级到传统地理编码
    return this.geocodeAddress(location, city);
  }

  /**
   * 地址转坐标（传统地理编码）
   * 适用于标准地址格式（XX省XX市XX区XX路XX号）
   * @param address 地址字符串
   * @param city 可选的城市名（提高精度）
   * @returns 坐标对象，失败返回 null
   */
  async geocodeAddress(address: string, city?: string): Promise<Coordinates | null> {
    try {
      const tools = (await this.getMCPTools()) as AmapMCPTools;
      const geoTool = tools.maps_geo;

      if (!geoTool) {
        console.error("❌ 高德 maps_geo 工具不可用");
        return null;
      }

      const normalizedCity = normalizeCityForGeocoding(city);
      const addressHint = extractAddressHint(address);
      const addressSource = addressHint || address;

      // 清理地址，移除干扰地理编码的内容
      const cleanedAddress = cleanAddressForGeocoding(addressSource);

      // 🔧 如果地址不包含城市名，将城市名拼接到地址前面
      // 这样可以确保高德 API 正确识别目标区域
      let fullAddress = cleanedAddress;
      if (normalizedCity && !cleanedAddress.includes(normalizedCity.replace(/市$/, ""))) {
        // 城市名去掉"市"后缀再检查，避免 "大连" vs "大连市" 的问题
        const cityWithoutSuffix = normalizedCity.replace(/市$/, "");
        if (!cleanedAddress.includes(cityWithoutSuffix)) {
          fullAddress = `${normalizedCity}${cleanedAddress}`;
        }
      }

      const result = await geoTool.execute({
        address: fullAddress,
        ...(normalizedCity ? { city: normalizedCity } : {}),
      });

      if (result.isError) {
        // 检查是否为限流错误，抛出异常以触发重试
        const errorText = result.content?.[0]?.text || "";
        if (errorText.includes("EXCEEDED_THE_LIMIT")) {
          throw new Error(`Rate limit exceeded: ${errorText}`);
        }
        console.warn(`⚠️ 地理编码失败: ${address}`, result);
        return null;
      }

      // 解析返回结果
      const textContent = result.content.find(c => c.type === "text");
      if (!textContent) return null;

      const data = JSON.parse(textContent.text) as MapsGeoResult;
      if (!data.return || data.return.length === 0) return null;

      // 解析经纬度 (格式: "经度,纬度")
      const locationStr = data.return[0].location;
      const [lngStr, latStr] = locationStr.split(",");
      const lng = parseFloat(lngStr);
      const lat = parseFloat(latStr);

      if (isNaN(lng) || isNaN(lat)) return null;

      const coords = { lat, lng };

      // 验证坐标是否有效
      if (!isValidCoordinates(coords)) {
        console.warn(`⚠️ 无效坐标: ${address} → ${locationStr}`);
        return null;
      }

      console.log(`   ✅ 坐标: ${lat.toFixed(4)}, ${lng.toFixed(4)} (地理编码)`);
      return coords;
    } catch (error) {
      console.error(`❌ 地理编码异常: ${address}`, error);
      return null;
    }
  }

  /**
   * 批量地理编码门店（返回统计信息）
   * @param stores 门店列表
   * @param onProgress 进度回调
   * @returns 更新坐标后的门店列表和统计信息
   */
  async batchGeocodeStoresWithStats(
    stores: Store[],
    onProgress?: (processed: number, total: number, stats: BatchGeocodingResult["stats"]) => void
  ): Promise<BatchGeocodingResult> {
    // 过滤需要地理编码的门店
    const needsGeocode = stores.filter(s => !isValidCoordinates(s.coordinates));
    const alreadyHaveCoords = stores.filter(s => isValidCoordinates(s.coordinates));

    const stats = {
      total: stores.length,
      needsGeocoding: needsGeocode.length,
      success: 0,
      failed: 0,
      skipped: alreadyHaveCoords.length,
      failedStores: [] as string[],
    };

    if (needsGeocode.length === 0) {
      console.log("✅ 所有门店都已有有效坐标，跳过地理编码");
      if (onProgress) onProgress(stores.length, stores.length, stats);
      return { stores, stats };
    }

    console.log(`🗺️ 开始批量地理编码: ${needsGeocode.length}/${stores.length} 个门店需要处理`);

    // 并发队列处理
    const results: Store[] = [];

    // 分批处理
    for (let i = 0; i < needsGeocode.length; i += CONCURRENCY) {
      const batch = needsGeocode.slice(i, i + CONCURRENCY);

      const batchResults = await Promise.all(
        batch.map(async store => {
          let retries = 0;
          const city = extractCityFromAddress(store.location);

          while (retries < MAX_RETRIES) {
            try {
              const coords = await this.geocodeAddress(store.location, city);
              if (coords) {
                // Note: stats.success++ is not atomic but we are running with CONCURRENCY = 1
                // If concurrency > 1, this should be handled carefully
                stats.success++;
                return { ...store, coordinates: coords };
              }
              break; // API 成功但无结果，不重试
            } catch (error) {
              retries++;
              const isRateLimitError =
                error instanceof Error &&
                (error.message?.includes("EXCEEDED_THE_LIMIT") ||
                  error.message?.includes("Rate limit"));

              if (retries < MAX_RETRIES) {
                const delay = isRateLimitError ? RATE_LIMIT_DELAY : RETRY_DELAY * retries;
                console.log(
                  `⏳ 重试 ${retries}/${MAX_RETRIES}: ${store.name}${isRateLimitError ? " (限流等待)" : ""}`
                );
                await sleep(delay);
              } else {
                console.warn(`❌ 超过最大重试次数 (${MAX_RETRIES}): ${store.name}`);
                // Force break to avoid infinite loop if something goes wrong with retry logic
                break;
              }
            }
          }

          stats.failed++;
          stats.failedStores.push(store.name);
          console.warn(`⚠️ 地理编码失败: ${store.name}`);
          return store; // 保留原坐标
        })
      );

      results.push(...batchResults);

      // 更新进度
      if (onProgress) {
        const processedCount = alreadyHaveCoords.length + results.length;
        onProgress(processedCount, stores.length, stats);
      }

      // 请求间延迟 - 增加到 1000ms 以避免限流
      if (i + CONCURRENCY < needsGeocode.length) {
        await sleep(1000);
      }
    }

    console.log(`🗺️ 批量地理编码完成: 成功 ${stats.success}，失败 ${stats.failed}`);

    return {
      stores: [...alreadyHaveCoords, ...results],
      stats,
    };
  }

  /**
   * 批量计算门店到目标点的距离
   * @param stores 门店列表
   * @param target 目标坐标
   * @returns 带距离信息的门店列表（按距离升序排序）
   */
  calculateDistancesToTarget(stores: Store[], target: Coordinates): StoreWithDistance[] {
    return stores
      .map(store => {
        // 跳过无效坐标的门店
        if (!isValidCoordinates(store.coordinates)) {
          return {
            store,
            distance: Infinity, // 无效坐标排到最后
          };
        }

        const distance = haversineDistance(store.coordinates, target);
        return { store, distance };
      })
      .sort((a, b) => a.distance - b.distance);
  }

  /**
   * 格式化距离显示
   * @param meters 距离（米），undefined 表示无法计算
   * @returns 格式化的距离字符串
   */
  formatDistance(meters: number | undefined): string {
    if (meters === undefined || meters === Infinity) return "未知";
    if (meters < 1000) {
      return `${Math.round(meters)}米`;
    }
    return `${(meters / 1000).toFixed(1)}公里`;
  }
}

// ============ 导出 ============

export const geocodingService = GeocodingService.getInstance();

export default geocodingService;
