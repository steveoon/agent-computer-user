/**
 * 清理旧版数据的脚本
 * 在浏览器控制台中执行以清理废弃的字段
 *
 * 使用方法：
 * 1. 打开应用网页
 * 2. 打开浏览器开发者工具（F12）
 * 3. 切换到控制台（Console）标签
 * 4. 复制粘贴此脚本并执行
 */

(async function cleanupLegacyData() {
  console.log("🧹 开始清理旧版数据...");

  try {
    // 确保 localforage 可用
    if (typeof localforage === "undefined") {
      console.error("❌ localforage 未找到，请确保在应用页面中执行此脚本");
      return;
    }

    // 创建配置存储实例
    const configStorage = localforage.createInstance({
      name: "ai-sdk-computer-use",
      storeName: "app_config",
      description: "应用配置数据存储",
    });

    // 获取当前配置
    const config = await configStorage.getItem("APP_CONFIG_DATA");

    if (!config) {
      console.log("ℹ️ 未找到配置数据，无需清理");
      return;
    }

    console.log("📊 当前配置版本:", config.metadata?.version || "未知");

    let hasChanges = false;

    // 清理 brandData 中的顶层 templates 和 screening
    if (config.brandData) {
      if ("templates" in config.brandData) {
        delete config.brandData.templates;
        console.log("✅ 已移除 brandData.templates");
        hasChanges = true;
      }

      if ("screening" in config.brandData) {
        delete config.brandData.screening;
        console.log("✅ 已移除 brandData.screening");
        hasChanges = true;
      }

      // 将旧版顶层 stores 迁移到 brands[].stores 后，删除遗留字段
      if ("stores" in config.brandData && Array.isArray(config.brandData.stores)) {
        delete config.brandData.stores;
        console.log("✅ 已移除 brandData.stores（旧版扁平结构）");
        hasChanges = true;
      }

      if ("city" in config.brandData) {
        delete config.brandData.city;
        console.log("✅ 已移除 brandData.city（已由 brands[].stores.city 推导）");
        hasChanges = true;
      }

      if ("defaultBrand" in config.brandData) {
        delete config.brandData.defaultBrand;
        console.log("✅ 已移除 brandData.defaultBrand（已迁移为 meta.defaultBrandId）");
        hasChanges = true;
      }
    }

    // 清理旧版 replyPrompts 字段（v2.0.0 迁移为 replyPolicy）
    if (config.replyPrompts && config.replyPolicy) {
      delete config.replyPrompts;
      console.log("✅ 已移除旧版 replyPrompts（已迁移至 replyPolicy）");
      hasChanges = true;
    }

    // 如果有变更，保存配置
    if (hasChanges) {
      // 更新版本号和时间戳
      config.metadata = {
        ...config.metadata,
        version: "2.0.0",
        lastUpdated: new Date().toISOString(),
        cleanedAt: new Date().toISOString(),
      };

      await configStorage.setItem("APP_CONFIG_DATA", config);
      console.log("✅ 配置已更新并保存");
      console.log("📊 新版本:", config.metadata.version);

      // 显示清理统计
      console.log("\n📈 清理完成统计:");
      const brands = Array.isArray(config.brandData?.brands) ? config.brandData.brands : [];
      const storeCount = brands.reduce((sum, brand) => sum + (brand.stores?.length || 0), 0);
      console.log("- 品牌数量:", brands.length);
      console.log("- 门店数量:", storeCount);
      console.log("- 回复策略阶段数:", config.replyPolicy?.stageGoals ? Object.keys(config.replyPolicy.stageGoals).length : "N/A");
      console.log("- 系统提示词数量:", Object.keys(config.systemPrompts).length);

      console.log("\n🎉 数据清理完成！请刷新页面以应用更改。");
    } else {
      console.log("✅ 数据已是最新，无需清理");
    }
  } catch (error) {
    console.error("❌ 清理过程中出错:", error);
    console.error("错误详情:", {
      message: error.message,
      stack: error.stack,
    });
  }
})();
