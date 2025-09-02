/**
 * 系统提示词加载器 - 重构版
 * 从 localforage 配置服务中加载系统提示词，替代硬编码函数
 */

import { getSystemPrompts } from "../services/config.service";
import * as defaultSystemPrompts from "../system-prompts";

/**
 * Boss直聘招聘BP系统提示词 - 重构版
 * 从配置服务中加载，支持动态修改
 */
export async function getBossZhipinSystemPrompt(): Promise<string> {
  // 🌐 服务端环境检测：直接使用默认提示词
  if (typeof window === "undefined") {
    console.log("🖥️ 服务端环境，使用默认 Boss直聘系统提示词");
    return defaultSystemPrompts.getBossZhipinSystemPrompt();
  }

  try {
    const systemPrompts = await getSystemPrompts();

    if (!systemPrompts?.bossZhipinSystemPrompt) {
      console.warn("⚠️ Boss直聘系统提示词未找到，降级使用默认提示词");
      return defaultSystemPrompts.getBossZhipinSystemPrompt();
    }

    console.log("✅ 已从配置服务加载 Boss直聘系统提示词");
    return systemPrompts.bossZhipinSystemPrompt;
  } catch (_error) {
    console.error("❌ Boss直聘系统提示词加载失败:", _error);

    // 降级到默认提示词（保持向后兼容）
    console.warn("⚠️ 降级使用默认 Boss直聘系统提示词");
    return defaultSystemPrompts.getBossZhipinSystemPrompt();
  }
}

/**
 * Boss直聘本地版系统提示词 - 重构版
 * 从配置服务中加载，支持动态修改
 */
export async function getBossZhipinLocalSystemPrompt(): Promise<string> {
  // 🌐 服务端环境检测：直接使用默认提示词
  if (typeof window === "undefined") {
    console.log("🖥️ 服务端环境，使用默认 Boss直聘本地版系统提示词");
    return defaultSystemPrompts.getBossZhipinLocalSystemPrompt();
  }

  try {
    const systemPrompts = await getSystemPrompts();

    if (!systemPrompts?.bossZhipinLocalSystemPrompt) {
      console.warn("⚠️ Boss直聘本地版系统提示词未找到，降级使用默认提示词");
      return defaultSystemPrompts.getBossZhipinLocalSystemPrompt();
    }

    console.log("✅ 已从配置服务加载 Boss直聘本地版系统提示词");
    return systemPrompts.bossZhipinLocalSystemPrompt;
  } catch (_error) {
    console.error("❌ Boss直聘本地版系统提示词加载失败:", _error);

    // 降级到默认提示词（保持向后兼容）
    console.warn("⚠️ 降级使用默认 Boss直聘本地版系统提示词");
    return defaultSystemPrompts.getBossZhipinLocalSystemPrompt();
  }
}

/**
 * 通用计算机使用系统提示词 - 重构版
 * 从配置服务中加载，支持动态修改
 */
export async function getGeneralComputerSystemPrompt(): Promise<string> {
  try {
    const systemPrompts = await getSystemPrompts();

    if (!systemPrompts?.generalComputerSystemPrompt) {
      throw new Error(
        "通用计算机系统提示词未找到，请先执行数据迁移 (运行 scripts/migrate-to-localstorage.ts)"
      );
    }

    console.log("✅ 已从配置服务加载 通用计算机系统提示词");
    return systemPrompts.generalComputerSystemPrompt;
  } catch (_error) {
    console.error("❌ 通用计算机系统提示词加载失败:", _error);

    // 降级到默认提示词（保持向后兼容）
    console.warn("⚠️ 降级使用默认 通用计算机系统提示词");
    return defaultSystemPrompts.getGeneralComputerSystemPrompt();
  }
}

/**
 * 便捷函数：获取所有系统提示词（用于管理界面）
 */
export async function getAllSystemPrompts() {
  try {
    const systemPrompts = await getSystemPrompts();
    return systemPrompts;
  } catch (_error) {
    console.error("获取所有系统提示词失败:", _error);
    return null;
  }
}

/**
 * 便捷函数：检查系统提示词是否已配置
 */
export async function isSystemPromptsConfigured(): Promise<boolean> {
  try {
    const systemPrompts = await getSystemPrompts();
    return !!(
      systemPrompts?.bossZhipinSystemPrompt &&
      systemPrompts?.generalComputerSystemPrompt &&
      systemPrompts?.bossZhipinLocalSystemPrompt
    );
  } catch (_error) {
    return false;
  }
}
