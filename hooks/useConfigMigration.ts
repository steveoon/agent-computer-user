import { useEffect, useState } from "react";
import {
  needsMigration,
  migrateFromHardcodedData,
  configService,
} from "@/lib/services/config.service";
import { BrandSyncManager } from "@/lib/services/brand-sync-manager";

export interface ConfigMigrationState {
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  error?: string;
  needsMigration: boolean;
}

/**
 * 🔄 配置迁移 Hook
 * 专门处理浏览器环境中的配置数据迁移
 */
export function useConfigMigration() {
  const [state, setState] = useState<ConfigMigrationState>({
    isLoading: true,
    isSuccess: false,
    isError: false,
    needsMigration: false,
  });

  useEffect(() => {
    let isMounted = true;

    async function checkAndMigrate() {
      try {
        console.log("🔍 检查配置迁移状态...");

        // 🚀 并行执行迁移检查和品牌状态检查，减少瀑布流等待
        const [shouldMigrate, syncStatus] = await Promise.all([
          needsMigration(),
          BrandSyncManager.getBrandSyncStatus(),
        ]);

        if (!isMounted) return;

        // 只有需要时才执行迁移（串行，因为依赖检查结果）
        if (shouldMigrate) {
          console.log("🔄 开始执行浏览器端配置迁移...");

          setState(prev => ({
            ...prev,
            needsMigration: true,
            isLoading: true,
          }));

          await migrateFromHardcodedData();

          if (!isMounted) return;

          console.log("✅ 浏览器端配置迁移完成");
        }

        // 处理品牌同步（使用已并行获取的 syncStatus）
        console.log("🔍 检查缺失的品牌...");

        if (syncStatus.missingBrands.length > 0) {
          console.log(
            `🔄 发现 ${syncStatus.missingBrands.length} 个缺失的品牌: ${syncStatus.missingBrands.join(", ")}`
          );

          // 尝试自动同步缺失的品牌
          try {
            const syncResult = await BrandSyncManager.syncMissingBrands();

            if (syncResult.syncedBrands.length > 0) {
              console.log(`✅ 成功同步品牌: ${syncResult.syncedBrands.join(", ")}`);
            }

            if (syncResult.failedBrands.length > 0) {
              console.warn(`⚠️ 部分品牌同步失败: ${syncResult.failedBrands.join(", ")}`);
              console.warn("失败详情:", syncResult.errors);
            }
          } catch (syncError) {
            console.error("❌ 品牌同步失败:", syncError);
            // 品牌同步失败不应该阻止应用启动
          }
        } else {
          console.log("✅ 所有映射的品牌都已存在");
        }

        setState({
          isLoading: false,
          isSuccess: true,
          isError: false,
          needsMigration: false,
        });
      } catch (error) {
        console.error("❌ 配置迁移失败:", error);
        console.error("错误详情:", {
          name: error instanceof Error ? error.name : typeof error,
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });

        // 获取当前配置状态用于调试
        try {
          const currentConfig = await configService.getConfig();
          console.log("📊 当前配置状态:", {
            hasConfig: !!currentConfig,
            version: currentConfig?.metadata?.version,
            replyPromptsCount: currentConfig
              ? Object.keys(currentConfig.replyPrompts || {}).length
              : 0,
            storesCount: currentConfig?.brandData?.stores?.length || 0,
          });
        } catch (debugError) {
          console.error("获取调试信息失败:", debugError);
        }

        if (!isMounted) return;

        setState({
          isLoading: false,
          isSuccess: false,
          isError: true,
          error: error instanceof Error ? error.message : "未知错误",
          needsMigration: false,
        });
      }
    }

    checkAndMigrate();

    return () => {
      isMounted = false;
    };
  }, []);

  /**
   * 手动重试迁移
   */
  const retryMigration = async () => {
    setState(prev => ({
      ...prev,
      isLoading: true,
      isError: false,
      error: undefined,
    }));

    try {
      await migrateFromHardcodedData();
      setState({
        isLoading: false,
        isSuccess: true,
        isError: false,
        needsMigration: false,
      });
    } catch (error) {
      console.error("❌ 手动重试迁移失败:", error);
      setState({
        isLoading: false,
        isSuccess: false,
        isError: true,
        error: error instanceof Error ? error.message : "未知错误",
        needsMigration: false,
      });
    }
  };

  /**
   * 获取配置状态
   */
  const getConfigStats = async () => {
    return await configService.getConfigStats();
  };

  return {
    ...state,
    retryMigration,
    getConfigStats,
  };
}
