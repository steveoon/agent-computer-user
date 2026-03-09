import { useCallback, useEffect, useState } from "react";
import {
  needsMigration,
  migrateFromHardcodedData,
  configService,
} from "@/lib/services/config.service";
import { BrandSyncManager } from "@/lib/services/brand-sync-manager";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useSyncStore } from "@/lib/stores/sync-store";
import { toast } from "sonner";

export interface ConfigMigrationState {
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  error?: string;
  needsMigration: boolean;
  needsFullResync: boolean;
  /** Token 缺失警告（非阻断性，用于显示提示） */
  tokenMissingWarning: boolean;
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
    needsFullResync: false,
    tokenMissingWarning: false,
  });
  useEffect(() => {
    let isMounted = true;

    async function checkAndMigrate() {
      try {
        const { setMigrationBlocked, clearMigrationBlocked } = useSyncStore.getState();
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

        const currentConfig = await configService.getConfig();
        const needsFullResync = currentConfig?.metadata?.needsFullResync === true;

        if (needsFullResync) {
          console.warn("⚠️ 检测到旧版本配置，需执行全量重同步");
          toast.warning("检测到旧版本配置", {
            description: "请在同步页面选择全部品牌并完成全量同步",
          });
          setMigrationBlocked(
            "检测到旧版本配置，需要完成全量同步后才能继续使用。请前往同步管理选择全部品牌进行同步。"
          );
        } else {
          clearMigrationBlocked();
        }

        // 处理品牌同步（使用已并行获取的 syncStatus）
        console.log("🔍 检查缺失的品牌...");

        let tokenMissing = false;

        if (syncStatus.missingBrands.length > 0) {
          console.log(
            `🔄 发现 ${syncStatus.missingBrands.length} 个缺失的品牌: ${syncStatus.missingBrands.join(", ")}`
          );

          const { isAuthenticated } = useAuthStore.getState();
          if (!isAuthenticated) {
            console.info("ℹ️ 当前未登录，跳过自动同步缺失品牌");
          } else if (needsFullResync) {
            console.info("ℹ️ 需要全量重同步，跳过自动同步缺失品牌");
          } else {
            // 尝试自动同步缺失的品牌
            try {
              const syncResult = await BrandSyncManager.syncMissingBrands();

              // 未登录/无权限时不作为错误处理
              if (syncResult.unauthorized) {
                console.info("ℹ️ 无权限同步品牌（可能登录态已失效），已跳过");
              } else if (syncResult.requiresFullResync) {
                if (syncResult.blockedReason) {
                  setMigrationBlocked(syncResult.blockedReason);
                }
              } else if (syncResult.tokenMissing) {
                // 检查是否因 Token 缺失而跳过同步
                tokenMissing = true;
              } else {
                if (syncResult.syncedBrands.length > 0) {
                  console.log(`✅ 成功同步品牌: ${syncResult.syncedBrands.join(", ")}`);
                }

                if (syncResult.failedBrands.length > 0) {
                  console.warn(`⚠️ 部分品牌同步失败: ${syncResult.failedBrands.join(", ")}`);
                  console.warn("失败详情:", syncResult.errors);
                  toast.warning("部分品牌自动同步失败", {
                    description: `${syncResult.failedBrands.length} 个品牌失败：${syncResult.failedBrands.slice(0, 3).join("、")}${syncResult.failedBrands.length > 3 ? "..." : ""}`,
                  });
                }
              }
            } catch (syncError) {
              console.error("❌ 品牌同步失败:", syncError);
              // 品牌同步失败不应该阻止应用启动
            }
          }
        } else {
          console.log("✅ 所有映射的品牌都已存在");
        }

        setState({
          isLoading: false,
          isSuccess: true,
          isError: false,
          needsMigration: false,
          needsFullResync,
          tokenMissingWarning: tokenMissing,
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
            replyPolicyCount: currentConfig
              ? Object.keys(currentConfig.replyPolicy || {}).length
              : 0,
            storesCount: currentConfig?.brandData?.stores?.length || 0,
          });
        } catch (debugError) {
          console.error("获取调试信息失败:", debugError);
        }

        if (!isMounted) return;

        useSyncStore.getState().setMigrationBlocked(
          `配置迁移失败，已阻断核心功能使用。请清空本地品牌数据并重新同步。` +
            (error instanceof Error ? `（${error.message}）` : "")
        );

        setState({
          isLoading: false,
          isSuccess: false,
          isError: true,
          error: error instanceof Error ? error.message : "未知错误",
          needsMigration: false,
          needsFullResync: false,
          tokenMissingWarning: false,
        });
      }
    }

    checkAndMigrate();

    return () => {
      isMounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- actions via getState() are stable
  }, []);

  /**
   * 手动重试迁移
   */
  const retryMigration = useCallback(async () => {
    setState(prev => ({
      ...prev,
      isLoading: true,
      isError: false,
      error: undefined,
    }));

    try {
      await migrateFromHardcodedData();
      const currentConfig = await configService.getConfig();
      const needsFullResync = currentConfig?.metadata?.needsFullResync === true;
      const { setMigrationBlocked, clearMigrationBlocked } = useSyncStore.getState();
      if (needsFullResync) {
        setMigrationBlocked(
          "检测到旧版本配置，需要完成全量同步后才能继续使用。请前往同步管理选择全部品牌进行同步。"
        );
      } else {
        clearMigrationBlocked();
      }
      setState({
        isLoading: false,
        isSuccess: true,
        isError: false,
        needsMigration: false,
        needsFullResync,
        tokenMissingWarning: false,
      });
    } catch (error) {
      console.error("❌ 手动重试迁移失败:", error);
      setState({
        isLoading: false,
        isSuccess: false,
        isError: true,
        error: error instanceof Error ? error.message : "未知错误",
        needsMigration: false,
        needsFullResync: false,
        tokenMissingWarning: false,
      });
    }
  }, []);

  /**
   * 获取配置状态
   */
  const getConfigStats = useCallback(async () => {
    return configService.getConfigStats();
  }, []);

  return {
    ...state,
    retryMigration,
    getConfigStats,
  };
}
