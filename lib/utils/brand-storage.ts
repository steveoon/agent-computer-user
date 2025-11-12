/**
 * 🏪 品牌偏好存储工具 - 重构版
 *
 * 职责：仅负责品牌偏好的持久化存储
 * - 不获取业务数据（如可用品牌列表）
 * - 不验证业务逻辑（由调用者负责）
 * - 专注于存储操作：保存、读取、清理
 */

import localforage from "localforage";

// 💾 存储键值
const BRAND_PREFERENCE_KEY = "brand_preference";
const BRAND_HISTORY_KEY = "brand_history";

// 🏪 创建品牌存储实例
const brandStorage = localforage.createInstance({
  name: "ai-sdk-computer-use",
  storeName: "brand_preferences",
  description: "用户品牌偏好和历史记录",
});

// 🧹 旧键名清理（历史遗留数据）
const LEGACY_KEYS = ["brand-history", "selected-brand"];
const CLEANUP_FLAG_KEY = "__legacy_cleanup_done";
let hasCleanedLegacy = false;

/**
 * 🧹 清理旧的存储键名
 * 避免IndexedDB中出现重复的键
 */
async function cleanLegacyStorage(): Promise<void> {
  // 避免重复清理
  if (hasCleanedLegacy) return;

  try {
    // 检查是否已经清理过
    const cleanupDone = await brandStorage.getItem(CLEANUP_FLAG_KEY);
    if (cleanupDone) {
      hasCleanedLegacy = true;
      return;
    }

    let cleaned = false;
    for (const legacyKey of LEGACY_KEYS) {
      const exists = await brandStorage.getItem(legacyKey);
      if (exists !== null) {
        console.log(`🧹 清理旧存储键: ${legacyKey}`);
        await brandStorage.removeItem(legacyKey);
        cleaned = true;
      }
    }

    if (cleaned) {
      console.log("✅ 旧存储键清理完成");
    }

    // 标记清理完成
    await brandStorage.setItem(CLEANUP_FLAG_KEY, true);
    hasCleanedLegacy = true;
  } catch (error) {
    console.warn("清理旧存储键失败:", error);
  }
}

/**
 * 💾 保存品牌偏好
 * @param brand 品牌名称
 * @param availableBrands 可用品牌列表（由调用者提供）
 */
export async function saveBrandPreference(brand: string, availableBrands: string[]): Promise<void> {
  try {
    // 验证品牌是否有效（由调用者提供验证列表）
    if (!availableBrands.includes(brand)) {
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
 * @returns 保存的品牌名称或null（可能包含已删除的品牌，调用者需验证）
 */
export async function loadBrandPreference(): Promise<string | null> {
  try {
    const savedBrand = await brandStorage.getItem<string>(BRAND_PREFERENCE_KEY);
    return savedBrand || null;
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
    const updatedHistory = [brand, ...history.filter(b => b !== brand)];

    // 限制历史记录数量为10个
    const limitedHistory = updatedHistory.slice(0, 10);

    await brandStorage.setItem(BRAND_HISTORY_KEY, limitedHistory);
  } catch (error) {
    console.error("保存品牌历史失败:", error);
  }
}

/**
 * 📜 获取品牌使用历史
 * @returns 品牌历史列表（未过滤，包含所有历史记录）
 *
 * 注意：返回的历史可能包含已删除的品牌，调用者需要自行过滤
 */
export async function getBrandHistory(): Promise<string[]> {
  try {
    // 🧹 一次性清理旧存储键（仅在首次调用时）
    await cleanLegacyStorage();

    const history = await brandStorage.getItem<string[]>(BRAND_HISTORY_KEY);
    return Array.isArray(history) ? history : [];
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
}> {
  try {
    const [currentBrand, history] = await Promise.all([
      loadBrandPreference(),
      getBrandHistory(),
    ]);

    return {
      currentBrand,
      historyCount: history.length,
    };
  } catch (error) {
    console.error("获取品牌存储状态失败:", error);
    return {
      currentBrand: null,
      historyCount: 0,
    };
  }
}

