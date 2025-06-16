/**
 * 🏪 品牌偏好存储工具 - 重构版
 * 不再依赖硬编码的品牌列表，支持动态品牌管理
 */

import localforage from "localforage";
import { getBrandData } from "../services/config.service";

// 💾 存储键值
const BRAND_PREFERENCE_KEY = "brand_preference";
const BRAND_HISTORY_KEY = "brand_history";

// 🏪 创建品牌存储实例
const brandStorage = localforage.createInstance({
  name: "ai-sdk-computer-use",
  storeName: "brand_preferences",
  description: "用户品牌偏好和历史记录",
});

/**
 * 💾 保存品牌偏好
 * @param brand 品牌名称
 */
export async function saveBrandPreference(brand: string): Promise<void> {
  try {
    // 验证品牌是否有效
    if (!(await isValidBrand(brand))) {
      console.warn(`尝试保存无效品牌: ${brand}`);
      return;
    }

    await brandStorage.setItem(BRAND_PREFERENCE_KEY, brand);
    await saveBrandToHistory(brand);
    console.log(`✅ 品牌偏好已保存: ${brand}`);
  } catch (error) {
    console.error("保存品牌偏好失败:", error);
    throw error;
  }
}

/**
 * 🔄 读取品牌偏好
 * @returns 保存的品牌名称或null
 */
export async function loadBrandPreference(): Promise<string | null> {
  try {
    const savedBrand = await brandStorage.getItem<string>(BRAND_PREFERENCE_KEY);

    if (savedBrand && (await isValidBrand(savedBrand))) {
      return savedBrand;
    }

    return null;
  } catch (error) {
    console.error("读取品牌偏好失败:", error);
    return null;
  }
}

/**
 * 📝 保存品牌到历史记录
 * @param brand 品牌名称
 */
async function saveBrandToHistory(brand: string): Promise<void> {
  try {
    const history = await getBrandHistory();

    // 移除重复项并添加到首位
    const updatedHistory = [brand, ...history.filter((b) => b !== brand)];

    // 限制历史记录数量为10个
    const limitedHistory = updatedHistory.slice(0, 10);

    await brandStorage.setItem(BRAND_HISTORY_KEY, limitedHistory);
  } catch (error) {
    console.error("保存品牌历史失败:", error);
  }
}

/**
 * 📜 获取品牌使用历史
 * @returns 品牌历史列表
 */
export async function getBrandHistory(): Promise<string[]> {
  try {
    const history = await brandStorage.getItem<string[]>(BRAND_HISTORY_KEY);

    if (Array.isArray(history)) {
      // 过滤掉无效的品牌
      const validHistory: string[] = [];

      for (const brand of history) {
        if (await isValidBrand(brand)) {
          validHistory.push(brand);
        }
      }

      return validHistory;
    }

    return [];
  } catch (error) {
    console.error("读取品牌历史失败:", error);
    return [];
  }
}

/**
 * 🧹 清除品牌存储
 */
export async function clearBrandStorage(): Promise<void> {
  try {
    await brandStorage.clear();
    console.log("✅ 品牌存储已清除");
  } catch (error) {
    console.error("清除品牌存储失败:", error);
    throw error;
  }
}

/**
 * 📊 获取品牌存储状态
 */
export async function getBrandStorageStatus(): Promise<{
  currentBrand: string | null;
  historyCount: number;
  availableBrands: string[];
}> {
  try {
    const [currentBrand, history, availableBrands] = await Promise.all([
      loadBrandPreference(),
      getBrandHistory(),
      getAvailableBrands(),
    ]);

    return {
      currentBrand,
      historyCount: history.length,
      availableBrands,
    };
  } catch (error) {
    console.error("获取品牌存储状态失败:", error);
    return {
      currentBrand: null,
      historyCount: 0,
      availableBrands: [],
    };
  }
}

/**
 * ✅ 验证品牌是否有效
 * @param brand 品牌名称
 * @returns 是否为有效品牌
 */
async function isValidBrand(brand: string): Promise<boolean> {
  try {
    const availableBrands = await getAvailableBrands();
    return availableBrands.includes(brand);
  } catch (error) {
    console.error("验证品牌有效性失败:", error);
    return false;
  }
}

/**
 * 🎯 获取可用品牌列表
 * @returns 可用品牌列表
 */
async function getAvailableBrands(): Promise<string[]> {
  try {
    const brandData = await getBrandData();
    return brandData ? Object.keys(brandData.brands) : [];
  } catch (error) {
    console.error("获取可用品牌列表失败:", error);
    return [];
  }
}
