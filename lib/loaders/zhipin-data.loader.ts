/**
 * 🎯 Boss直聘数据加载器 - 重构版
 * 从 localforage 配置服务中加载数据，替代硬编码文件
 */

import {
  ZhipinData,
  Store,
  getAllStores,
} from "../../types/zhipin";
import {
  getBrandData,
  migrateFromHardcodedData,
  needsMigration,
} from "../services/config.service";
import type { BrandResolutionInput, BrandResolutionOutput } from "../../types/brand-resolution";

/**
 * 🎯 加载Boss直聘相关数据 - 重构版
 * 优先使用传入的配置数据，仅在浏览器环境中作为备用加载器
 * @param preferredBrand 优先使用的品牌（可选）
 * @param configData 预加载的配置数据（服务端调用时必须提供）
 * @returns Promise<ZhipinData> 返回加载的数据
 */
export async function loadZhipinData(
  preferredBrand?: string,
  configData?: ZhipinData
): Promise<ZhipinData> {
  try {
    // 🎯 如果提供了配置数据，优先使用
    if (configData) {
      console.log("✅ 使用传入的配置数据");

      // 不再在这里修改 defaultBrand，保持原始配置数据不变
      // 品牌解析逻辑将在 resolveBrandConflict 中统一处理

      const allStores = getAllStores(configData);
      const totalPositions = allStores.reduce(
        (sum: number, store: Store) => sum + store.positions.length,
        0
      );
      console.log(
        `📊 数据统计: ${allStores.length} 家门店，${totalPositions} 个岗位${
          preferredBrand ? ` - UI选择品牌: ${preferredBrand}` : ""
        }`
      );
      return configData;
    }

    // 🌐 浏览器环境备用逻辑：从 localforage 加载
    if (typeof window !== "undefined") {
      console.log("🌐 浏览器环境，从 localforage 加载配置");

      // 检查是否需要迁移
      if (await needsMigration()) {
        console.log("🔄 检测到首次使用，正在自动执行数据迁移...");
        try {
          await migrateFromHardcodedData();
          console.log("✅ 数据迁移完成");
        } catch (migrationError) {
          console.error("❌ 自动迁移失败:", migrationError);
          throw new Error("浏览器环境数据迁移失败");
        }
      }

      // 从配置服务加载品牌数据
      const brandData = await getBrandData();
      if (!brandData) {
        throw new Error("浏览器环境配置数据未找到");
      }

      const allBrandStores = getAllStores(brandData);
      const totalPositions = allBrandStores.reduce(
        (sum: number, store: Store) => sum + store.positions.length,
        0
      );
      console.log(
        `✅ 已从配置服务加载 ${allBrandStores.length} 家门店数据 (${totalPositions} 个岗位)${
          preferredBrand ? ` - 请求品牌: ${preferredBrand}` : ""
        }`
      );
      return brandData;
    }

    // 🚨 服务端环境必须提供配置数据
    throw new Error("服务端环境必须提供 configData 参数，不再支持硬编码数据读取");
  } catch (error) {
    console.error("❌ 数据加载失败:", error);
    throw error; // 不再降级，明确报错
  }
}

/**
 * 模糊匹配品牌名称
 * @param inputBrand 用户输入的品牌名
 * @param availableBrands 可用的品牌列表
 * @returns 匹配的品牌名或null
 */
export function fuzzyMatchBrand(
  inputBrand: string,
  availableBrands: string[],
  aliasMap?: Map<string, string>
): string | null {
  if (!inputBrand) return null;
  const normalizeBrandName = (value: string) => value.toLowerCase().replace(/[\s._-]+/g, "");

  // 0. 别名字典查找（O(1)，优先级最高）
  if (aliasMap) {
    const aliasResult =
      aliasMap.get(normalizeBrandName(inputBrand)) || aliasMap.get(inputBrand.toLowerCase());
    if (aliasResult && availableBrands.includes(aliasResult)) {
      return aliasResult;
    }
  }

  const inputLower = inputBrand.toLowerCase();
  const inputNormalized = normalizeBrandName(inputBrand);

  // 1. 精确匹配（忽略大小写）
  const exactMatch = availableBrands.find(brand => brand.toLowerCase() === inputLower);
  if (exactMatch) {
    return exactMatch;
  }

  // 2. 精确匹配（忽略空格/常见分隔符）
  const normalizedMatch = availableBrands.find(
    brand => normalizeBrandName(brand) === inputNormalized
  );
  if (normalizedMatch) {
    return normalizedMatch;
  }

  // 3. 包含匹配（品牌名包含输入或输入包含品牌名，忽略大小写/分隔符）
  // 收集所有匹配项，然后选择最具体的（最长的）
  const containsMatches = availableBrands.filter(brand => {
    const brandLower = brand.toLowerCase();
    if (brandLower.includes(inputLower) || inputLower.includes(brandLower)) {
      return true;
    }
    const brandNormalized = normalizeBrandName(brand);
    return (
      brandNormalized.includes(inputNormalized) || inputNormalized.includes(brandNormalized)
    );
  });

  if (containsMatches.length > 0) {
    // 优先返回最长的匹配（更具体的品牌名）
    return containsMatches.sort((a, b) => b.length - a.length)[0];
  }

  // 4. 特殊处理：山姆相关的匹配
  if (inputLower.includes("山姆") || inputLower.includes("sam")) {
    const samBrand = availableBrands.find(brand => {
      const brandLower = brand.toLowerCase();
      return brandLower.includes("山姆") || brandLower.includes("sam");
    });
    if (samBrand) {
      return samBrand;
    }
  }

  return null;
}

/**
 * 解析品牌冲突，根据策略返回最终品牌
 *
 * 品牌来源优先级说明：
 * - user-selected: UI选择 → 配置默认 → 第一个可用品牌
 * - conversation-extracted: 对话提取 → UI选择 → 配置默认 → 第一个可用品牌
 * - smart: 对话提取 → UI选择 → 配置默认 → 第一个可用品牌（带智能判断）
 *
 * @param input 品牌解析输入参数
 * @returns 解析后的品牌和决策原因
 */
export function resolveBrandConflict(input: BrandResolutionInput): BrandResolutionOutput {
  const {
    uiSelectedBrand,
    configDefaultBrand,
    conversationBrand,
    availableBrands,
    strategy = "smart",
    aliasMap,
  } = input;

  // 记录解析尝试历史
  const attempts: Array<{
    source: string;
    value: string | undefined;
    matched: boolean;
    reason: string;
  }> = [];

  // 辅助函数：尝试匹配品牌
  const tryMatchBrand = (brand: string | undefined, source: string): string | undefined => {
    if (!brand) {
      attempts.push({ source, value: undefined, matched: false, reason: "未提供" });
      return undefined;
    }

    const matched = fuzzyMatchBrand(brand, availableBrands, aliasMap);
    if (matched) {
      const isExact = matched === brand;
      attempts.push({
        source,
        value: brand,
        matched: true,
        reason: isExact ? "精确匹配" : `模糊匹配 (${brand} → ${matched})`,
      });
      return matched;
    }

    attempts.push({ source, value: brand, matched: false, reason: "无法匹配到可用品牌" });
    return undefined;
  };

  // 根据策略执行不同的优先级逻辑
  switch (strategy) {
    case "user-selected": {
      // 优先级：UI选择 → 配置默认 → 第一个可用品牌
      // 1. 尝试 UI 选择的品牌
      const uiMatched = tryMatchBrand(uiSelectedBrand, "UI选择");
      if (uiMatched) {
        return {
          resolvedBrand: uiMatched,
          matchType: uiMatched === uiSelectedBrand ? "exact" : "fuzzy",
          source: "ui",
          reason: `用户选择策略: 使用UI选择的品牌 (${uiSelectedBrand}${uiMatched !== uiSelectedBrand ? ` → ${uiMatched}` : ""})`,
          originalInput: uiSelectedBrand,
        };
      }

      // 2. 尝试配置默认品牌
      const configMatched = tryMatchBrand(configDefaultBrand, "配置默认");
      if (configMatched) {
        return {
          resolvedBrand: configMatched,
          matchType: configMatched === configDefaultBrand ? "exact" : "fuzzy",
          source: "config",
          reason: `用户选择策略: UI品牌无法匹配，使用配置默认 (${configDefaultBrand}${configMatched !== configDefaultBrand ? ` → ${configMatched}` : ""})`,
          originalInput: configDefaultBrand,
        };
      }

      // 3. 使用第一个可用品牌
      const fallback = availableBrands[0];
      return {
        resolvedBrand: fallback,
        matchType: "fallback",
        source: "default",
        reason: `用户选择策略: 无有效品牌输入，使用系统默认 (${fallback})`,
      };
    }

    case "conversation-extracted": {
      // 优先级：对话提取 → UI选择 → 配置默认 → 第一个可用品牌
      // 1. 尝试对话提取的品牌
      const conversationMatched = tryMatchBrand(conversationBrand, "对话提取");
      if (conversationMatched) {
        return {
          resolvedBrand: conversationMatched,
          matchType: conversationMatched === conversationBrand ? "exact" : "fuzzy",
          source: "conversation",
          reason: `对话提取策略: 使用对话中提取的品牌 (${conversationBrand}${conversationMatched !== conversationBrand ? ` → ${conversationMatched}` : ""})`,
          originalInput: conversationBrand,
        };
      }

      // 2. 尝试 UI 选择的品牌
      const uiMatched = tryMatchBrand(uiSelectedBrand, "UI选择");
      if (uiMatched) {
        return {
          resolvedBrand: uiMatched,
          matchType: uiMatched === uiSelectedBrand ? "exact" : "fuzzy",
          source: "ui",
          reason: `对话提取策略: 对话品牌无法匹配，使用UI选择 (${uiSelectedBrand}${uiMatched !== uiSelectedBrand ? ` → ${uiMatched}` : ""})`,
          originalInput: uiSelectedBrand,
        };
      }

      // 3. 尝试配置默认品牌
      const configMatched = tryMatchBrand(configDefaultBrand, "配置默认");
      if (configMatched) {
        return {
          resolvedBrand: configMatched,
          matchType: configMatched === configDefaultBrand ? "exact" : "fuzzy",
          source: "config",
          reason: `对话提取策略: 无有效对话/UI品牌，使用配置默认 (${configDefaultBrand}${configMatched !== configDefaultBrand ? ` → ${configMatched}` : ""})`,
          originalInput: configDefaultBrand,
        };
      }

      // 4. 使用第一个可用品牌
      const fallback = availableBrands[0];
      return {
        resolvedBrand: fallback,
        matchType: "fallback",
        source: "default",
        reason: `对话提取策略: 无有效品牌输入，使用系统默认 (${fallback})`,
      };
    }

    case "smart":
    default: {
      // 优先级：对话提取 → UI选择 → 配置默认 → 第一个可用品牌
      // 特殊逻辑：如果对话品牌和UI品牌都存在且不同，进行智能判断
      const conversationMatched = tryMatchBrand(conversationBrand, "对话提取");
      const uiMatched = tryMatchBrand(uiSelectedBrand, "UI选择");

      // 如果两者都存在且不同，需要智能判断
      if (conversationMatched && uiMatched && conversationMatched !== uiMatched) {
        // 检查是否是同品牌系列
        const isSameBrandFamily =
          conversationMatched.includes(uiMatched) || uiMatched.includes(conversationMatched);

        if (isSameBrandFamily) {
          // 同系列品牌，优先使用对话提取的品牌（更符合当前上下文意图）
          return {
            resolvedBrand: conversationMatched,
            matchType: conversationMatched === conversationBrand ? "exact" : "fuzzy",
            source: "conversation",
            reason: `同系列品牌冲突，优先对话`,
            originalInput: conversationBrand,
          };
        } else {
          // 不同品牌系列，优先对话提取（因为更符合当前上下文）
          return {
            resolvedBrand: conversationMatched,
            matchType: conversationMatched === conversationBrand ? "exact" : "fuzzy",
            source: "conversation",
            reason: `不同品牌冲突，优先对话`,
            originalInput: conversationBrand,
          };
        }
      }

      // 如果只有一个存在，或两者相同，按正常优先级处理
      if (conversationMatched) {
        return {
          resolvedBrand: conversationMatched,
          matchType: conversationMatched === conversationBrand ? "exact" : "fuzzy",
          source: "conversation",
          reason: `智能策略: 使用对话中提取的品牌 (${conversationBrand}${conversationMatched !== conversationBrand ? ` → ${conversationMatched}` : ""})`,
          originalInput: conversationBrand,
        };
      }

      if (uiMatched) {
        return {
          resolvedBrand: uiMatched,
          matchType: uiMatched === uiSelectedBrand ? "exact" : "fuzzy",
          source: "ui",
          reason: `智能策略: 对话无品牌，使用UI选择 (${uiSelectedBrand}${uiMatched !== uiSelectedBrand ? ` → ${uiMatched}` : ""})`,
          originalInput: uiSelectedBrand,
        };
      }

      // 尝试配置默认品牌
      const configMatched = tryMatchBrand(configDefaultBrand, "配置默认");
      if (configMatched) {
        return {
          resolvedBrand: configMatched,
          matchType: configMatched === configDefaultBrand ? "exact" : "fuzzy",
          source: "config",
          reason: `智能策略: 无对话/UI品牌，使用配置默认 (${configDefaultBrand}${configMatched !== configDefaultBrand ? ` → ${configMatched}` : ""})`,
          originalInput: configDefaultBrand,
        };
      }

      // 使用第一个可用品牌
      const fallback = availableBrands[0];
      return {
        resolvedBrand: fallback,
        matchType: "fallback",
        source: "default",
        reason: `智能策略: 无有效品牌输入，使用系统默认 (${fallback})`,
      };
    }
  }
}
