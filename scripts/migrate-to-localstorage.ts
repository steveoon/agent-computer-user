#!/usr/bin/env tsx

/**
 * 🚚 一次性数据迁移脚本
 * 将硬编码的数据文件迁移到 localforage 存储
 */

import { configService } from "../lib/services/config.service";
import { CONFIG_VERSION } from "@/types";
import { zhipinData } from "../lib/data/sample-data";
import {
  getBossZhipinSystemPrompt,
  getGeneralComputerSystemPrompt,
  getBossZhipinLocalSystemPrompt,
} from "../lib/system-prompts";
import { DEFAULT_REPLY_POLICY, type AppConfigData } from "@/types";

/**
 * 执行迁移
 */
async function migrate() {
  console.log("🚚 开始数据迁移...");

  try {
    // 检查是否已经迁移过
    const isConfigured = await configService.isConfigured();
    if (isConfigured) {
      console.log("⚠️ 数据已存在，是否要覆盖？(y/N)");
      // 在实际使用中，这里可以添加用户确认逻辑
      // 暂时跳过，允许覆盖
      console.log("继续覆盖现有数据...");
    }

    // 聚合所有配置数据
    const configData: AppConfigData = {
      // 品牌和门店数据
      brandData: zhipinData,

      // 系统级提示词
      systemPrompts: {
        bossZhipinSystemPrompt: getBossZhipinSystemPrompt(),
        generalComputerSystemPrompt: getGeneralComputerSystemPrompt(),
        bossZhipinLocalSystemPrompt: getBossZhipinLocalSystemPrompt(),
      },

      // 智能回复指令
      replyPolicy: DEFAULT_REPLY_POLICY,

      // 品牌优先级策略（默认智能判断）
      brandPriorityStrategy: "smart",

      // 配置元信息
      metadata: {
        version: CONFIG_VERSION,
        lastUpdated: new Date().toISOString(),
        migratedAt: new Date().toISOString(),
      },
    };

    // 保存到 localforage
    await configService.saveConfig(configData);

    // 验证迁移结果
    const savedConfig = await configService.getConfig();
    if (savedConfig) {
      console.log("✅ 数据迁移成功！");
      console.log(`📊 统计信息:`);
      console.log(`  - 品牌数量: ${savedConfig.brandData.brands.length}`);
      console.log(`  - 门店数量: ${savedConfig.brandData.brands.flatMap((b: { stores: unknown[] }) => b.stores).length}`);
      console.log(`  - 系统提示词: ${Object.keys(savedConfig.systemPrompts).length} 个`);
      console.log(`  - 回复指令: ${Object.keys(savedConfig.replyPolicy).length} 个`);
      console.log(`  - 配置版本: ${savedConfig.metadata.version}`);
      console.log(`  - 迁移时间: ${savedConfig.metadata.migratedAt}`);
    } else {
      throw new Error("迁移验证失败");
    }
  } catch (error) {
    console.error("❌ 数据迁移失败:", error);
    process.exit(1);
  }
}

/**
 * 主函数
 */
async function main() {
  console.log("📋 AI-SDK Computer Use 配置数据迁移工具");
  console.log("目标：将硬编码数据迁移到 localforage 存储\n");

  await migrate();

  console.log("\n🎉 迁移完成！");
  console.log("💡 提示：现在可以使用 /admin/settings 页面来管理配置");
}

// 执行迁移（如果直接运行此脚本）
if (require.main === module) {
  main().catch(error => {
    console.error("迁移脚本执行失败:", error);
    process.exit(1);
  });
}

export { migrate };
