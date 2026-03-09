/**
 * 共享品牌别名服务（服务端单例）
 *
 * 从 Duliday API 获取品牌别名数据，构建：
 * 1. 正向字典 (brandName → aliases[]) — 供 SmartExtractor 文本提取使用
 * 2. 反向别名 Map (alias → brandName) — 供 fuzzyMatchBrand 品牌解析使用
 *
 * 复用 BrandDictionaryCache 实现 5 分钟 TTL 缓存。
 * API 不可用时抛出 AppError，不降级。
 */

import { getAllBrandMappings } from "@/actions/brand-mapping";
import { AppError } from "@/lib/errors/app-error";
import { ErrorCode } from "@/lib/errors/error-codes";
import {
  BrandDictionaryCache,
  isCacheValid,
  type BrandDictionary,
} from "@/lib/prompt-engineering/memory/brand-dictionary-cache";
import {
  DulidayBrandListResponseSchema,
  type BrandAliasMap,
  type DulidayBrandItem,
} from "./types";

// ========== Constants ==========

const DULIDAY_BRAND_LIST_URL = "https://k8s.duliday.com/persistence/ai/api/brand/list";
const REQUEST_TIMEOUT_MS = 30_000;

// ========== API Fetch ==========

/**
 * 从 Duliday API 获取品牌列表（含别名）
 * @throws AppError 当 Token 缺失、网络错误或响应格式异常时
 */
async function fetchBrandAliasesFromApi(dulidayToken?: string): Promise<DulidayBrandItem[]> {
  const token = dulidayToken || process.env.DULIDAY_TOKEN;
  if (!token) {
    throw new AppError({
      code: ErrorCode.CONFIG_MISSING_FIELD,
      message: "DULIDAY_TOKEN 未配置，无法获取品牌别名数据",
      userMessage: "品牌别名数据加载失败：缺少 Duliday Token 配置",
    });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(DULIDAY_BRAND_LIST_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Duliday-Token": token,
      },
      body: JSON.stringify({ pageNum: 1, pageSize: 1000 }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new AppError({
        code: ErrorCode.NETWORK_HTTP_ERROR,
        message: `Duliday 品牌列表 API 返回 HTTP ${response.status}: ${response.statusText}`,
        userMessage: `品牌别名数据加载失败：服务端返回 ${response.status}`,
        details: { url: DULIDAY_BRAND_LIST_URL, status: response.status },
      });
    }

    const json: unknown = await response.json();
    const parsed = DulidayBrandListResponseSchema.safeParse(json);

    if (!parsed.success) {
      throw new AppError({
        code: ErrorCode.VALIDATION_SCHEMA_ERROR,
        message: `Duliday 品牌列表响应格式校验失败: ${parsed.error.message}`,
        userMessage: "品牌别名数据加载失败：响应格式异常",
        details: { zodError: parsed.error.issues },
      });
    }

    const { result, total } = parsed.data.data;

    if (total > result.length) {
      console.warn(
        `[BrandAliasService] API 返回总数 ${total} 超过当前页结果 ${result.length}，部分品牌可能未加载`
      );
    }

    return result;
  } catch (error) {
    // 已经是 AppError 则直接抛出
    if (error instanceof AppError) throw error;

    // AbortController 超时
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new AppError({
        code: ErrorCode.NETWORK_TIMEOUT,
        message: `Duliday 品牌列表 API 请求超时 (${REQUEST_TIMEOUT_MS}ms)`,
        userMessage: "品牌别名数据加载超时，请稍后重试",
        cause: error,
      });
    }

    // 其他网络错误
    throw new AppError({
      code: ErrorCode.SYSTEM_DEPENDENCY_FAILED,
      message: `获取品牌别名数据失败: ${error instanceof Error ? error.message : String(error)}`,
      userMessage: "品牌别名数据加载失败，请检查网络连接",
      cause: error instanceof Error ? error : undefined,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

// ========== Map Builders ==========

/**
 * 从 API 数据构建正向字典和反向别名 Map
 *
 * 核心逻辑：
 * 1. API 品牌直接注册别名
 * 2. 通过 projectIdList 关联本地区域品牌，自动继承父品牌别名并加城市前缀
 *    例：API 返回 肯德基(aliases=["KFC"], projectIdList=[5, 1142])
 *        DB 有 mappingKey=1142 → 深圳肯德基
 *        → 自动生成 "深圳kfc" → "深圳肯德基"
 *
 * @param apiData API 返回的品牌列表
 * @param actualBrands 数据库中的实际业务品牌集合
 * @param brandMapping 数据库品牌映射 { orgId/projectId: brandName }
 */
function buildMapsFromApiData(
  apiData: DulidayBrandItem[],
  actualBrands: Set<string>,
  brandMapping?: Record<string, string>
): {
  dictionary: BrandDictionary;
  aliasMap: BrandAliasMap;
  sortedBrands: string[];
  actualBrandSet: Set<string>;
} {
  const dictionary: BrandDictionary = {};
  const aliasMap: BrandAliasMap = new Map();
  const normalizeAlias = (value: string): string => value.trim();
  const toAliasMapKey = (value: string): string =>
    normalizeAlias(value).toLowerCase().replace(/[\s._-]+/g, "");

  // 辅助：注册别名到反向 Map（冲突时保留更长品牌名）
  const registerAlias = (alias: string, brandName: string): void => {
    const key = toAliasMapKey(alias);
    if (!key) return;
    const existing = aliasMap.get(key);
    if (!existing || brandName.length > existing.length) {
      aliasMap.set(key, brandName);
    }
  };

  // 按品牌名称长度降序处理，确保长品牌名优先注册别名
  const sortedApiData = [...apiData].sort((a, b) => b.name.length - a.name.length);

  for (const item of sortedApiData) {
    const brandName = normalizeAlias(item.name);
    if (!brandName) continue;

    // 构建正向字典: brandName → [brandName, ...aliases]
    const allAliases = Array.from(
      new Set(
        [brandName, ...item.aliases.map(normalizeAlias).filter(Boolean)].filter(
          alias => alias !== brandName
        )
      )
    );
    allAliases.unshift(brandName);
    dictionary[brandName] = allAliases;

    // 注册反向别名
    for (const alias of allAliases) {
      registerAlias(alias, brandName);
    }

    // 通过 projectIdList 为区域品牌自动生成别名
    if (brandMapping && item.projectIdList.length > 0) {
      for (const projectId of item.projectIdList) {
        const localBrandName = brandMapping[String(projectId)];
        if (!localBrandName || localBrandName === brandName) continue;

        // 提取城市前缀：如 "深圳肯德基" 去掉 "肯德基" = "深圳"
        // 仅当本地品牌名包含父品牌名时才生成区域别名（防止不相关品牌名产生垃圾别名）
        if (!localBrandName.includes(brandName)) continue;
        const prefix = localBrandName.replace(brandName, "");
        if (!prefix) continue;

        // 为区域品牌生成别名：品牌名自身 + 前缀 + 父品牌别名
        const regionalAliases = [localBrandName];
        for (const parentAlias of allAliases) {
          if (parentAlias === brandName) continue;
          regionalAliases.push(`${prefix}${parentAlias}`);
        }

        // 注册区域品牌到字典和反向 Map
        if (!dictionary[localBrandName]) {
          dictionary[localBrandName] = regionalAliases;
        } else {
          // 合并新生成的别名到已有条目
          const existing = new Set(dictionary[localBrandName]);
          for (const alias of regionalAliases) {
            if (!existing.has(alias)) {
              dictionary[localBrandName].push(alias);
            }
          }
        }

        for (const alias of regionalAliases) {
          registerAlias(alias, localBrandName);
        }
      }
    }
  }

  // 确保数据库中的业务品牌即使 API 未返回也在字典中（以品牌名自身为唯一别名）
  for (const brand of actualBrands) {
    if (!dictionary[brand]) {
      dictionary[brand] = [brand];
      registerAlias(brand, brand);
    }
  }

  // 业务品牌按名称长度降序排列（用于 SmartExtractor 的贪婪匹配）
  const sortedBrands = [...actualBrands].sort((a, b) => b.length - a.length);

  return { dictionary, aliasMap, sortedBrands, actualBrandSet: actualBrands };
}

// ========== Public API ==========

/**
 * 确保缓存已填充（fetch + build + cache）
 * @throws AppError 当 API 不可用时
 */
async function ensureCachePopulated(dulidayToken?: string): Promise<void> {
  if (BrandDictionaryCache.brandDictionary && BrandDictionaryCache.aliasMap && isCacheValid()) {
    return;
  }

  // 并行获取 API 数据和数据库品牌映射
  const [apiData, brandMapping] = await Promise.all([
    fetchBrandAliasesFromApi(dulidayToken),
    getAllBrandMappings(),
  ]);

  const actualBrands = new Set(Object.values(brandMapping));
  const { dictionary, aliasMap, sortedBrands, actualBrandSet } = buildMapsFromApiData(
    apiData,
    actualBrands,
    brandMapping
  );

  // 写入缓存
  BrandDictionaryCache.brandDictionary = dictionary;
  BrandDictionaryCache.aliasMap = aliasMap;
  BrandDictionaryCache.sortedBrands = sortedBrands;
  BrandDictionaryCache.actualBrandSet = actualBrandSet;
  BrandDictionaryCache.timestamp = Date.now();
}

/**
 * 获取品牌正向字典 (brandName → aliases[])
 * @throws AppError 当 API 不可用时
 */
export async function getSharedBrandDictionary(dulidayToken?: string): Promise<BrandDictionary> {
  await ensureCachePopulated(dulidayToken);
  return BrandDictionaryCache.brandDictionary!;
}

/**
 * 获取品牌反向别名 Map (alias → brandName)
 * @throws AppError 当 API 不可用时
 */
export async function getSharedBrandAliasMap(dulidayToken?: string): Promise<BrandAliasMap> {
  await ensureCachePopulated(dulidayToken);
  return BrandDictionaryCache.aliasMap!;
}

// 用于测试
export { buildMapsFromApiData as _buildMapsFromApiData };
export { fetchBrandAliasesFromApi as _fetchBrandAliasesFromApi };
