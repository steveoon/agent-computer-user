import { create } from "zustand";
import { devtools } from "zustand/middleware";
import {
  SyncRecord,
  SyncResult,
  saveSyncRecord,
  getSyncHistory,
} from "@/lib/services/duliday-sync.service";
import { getAvailableBrands } from "@/actions/brand-mapping";
import { configService, getBrandData } from "@/lib/services/config.service";
import { CONFIG_VERSION } from "@/types";
import { ZhipinData, Brand, Store, BrandDatasetMeta, getAllStores } from "@/types/zhipin";
import { toast } from "sonner";
import { configStore } from "@/hooks/useConfigManager";
import { hasNumericCoordinates } from "@/lib/utils/coordinates";
import { consumeNdjsonStream } from "@/lib/utils/ndjson-stream";
import { createSyncStreamHandler } from "@/lib/utils/sync-stream";

/** 旧版 sample-data.ts 中使用的 Brand.id（迁移前的遗留格式） */
const LEGACY_SAMPLE_IDS = new Set(["brand_chengduniliujie", "brand_damixiansheng"]);
const isSampleBrandId = (id: string): boolean => id.startsWith("sample:") || LEGACY_SAMPLE_IDS.has(id);

/**
 * 检测现有数据是否为 sample 初始化数据或空数据
 * 用于自动将 merge 提升为 replace，避免 sample 假 Brand.id 残留
 */
function isSampleSeededData(data: ZhipinData | undefined): boolean {
  if (!data) return true;
  // 空数据集
  if (!data.brands || data.brands.length === 0) return true;
  // 明确标记为 sample 来源
  if (data.meta?.source === "sample") return true;
  // 检测 sample Brand.id（所有品牌都是 sample 数据）
  if (data.brands.every(b => isSampleBrandId(b.id))) return true;
  return false;
}

/**
 * 确保 defaultBrandId 指向 brands 中实际存在的品牌
 * 如果当前值无效，按优先级回退：同步结果 → 第一个品牌 → undefined
 */
function ensureValidDefaultBrandId(
  finalData: ZhipinData,
  syncDefaultBrandId: string | undefined
): void {
  const currentDefault = finalData.meta?.defaultBrandId;
  const brandExists = currentDefault && finalData.brands.some(b => b.id === currentDefault);
  if (brandExists) return;

  const newDefault =
    syncDefaultBrandId && finalData.brands.some(b => b.id === syncDefaultBrandId)
      ? syncDefaultBrandId
      : finalData.brands[0]?.id;

  if (currentDefault !== newDefault) {
    console.log(
      `🔄 defaultBrandId 修正: "${currentDefault ?? "(空)"}" → "${newDefault ?? "(空)"}"`
    );
    finalData.meta = { ...finalData.meta, defaultBrandId: newDefault };
  }
}

const buildFullResyncSelectionMessage = (
  totalBrands: number,
  selectedCount: number,
  missingNames: string[],
  invalidIds: string[]
): string => {
  const missingPreview =
    missingNames.length > 0
      ? `缺少：${missingNames.slice(0, 3).join("、")}${missingNames.length > 3 ? "..." : ""}`
      : "";
  const invalidPreview =
    invalidIds.length > 0
      ? `包含无效ID：${invalidIds.slice(0, 3).join("、")}${invalidIds.length > 3 ? "..." : ""}`
      : "";
  const details = [missingPreview, invalidPreview].filter(Boolean).join("；");

  return (
    `当前配置需要全量重同步，请选择全部 ${totalBrands} 个品牌后再同步。` +
    `已选 ${selectedCount} 个` +
    (details ? `，${details}` : "")
  );
};

const fetchAvailableBrandIds = async (): Promise<Array<{ id: string; name: string }>> => {
  return await getAvailableBrands();
};

const parseTimestamp = (value: string | undefined): number | undefined => {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? undefined : timestamp;
};

const mergeDatasetMeta = (
  existingMeta: BrandDatasetMeta | undefined,
  incomingData: Partial<ZhipinData>[],
  defaultBrandId: string | undefined
): BrandDatasetMeta => {
  const latestSyncedAt = incomingData.reduce<string | undefined>((latest, data) => {
    const current = data.meta?.syncedAt;
    if (!current) return latest;

    const latestTimestamp = parseTimestamp(latest);
    const currentTimestamp = parseTimestamp(current);
    if (currentTimestamp === undefined) {
      return latest;
    }
    if (latestTimestamp === undefined || currentTimestamp > latestTimestamp) {
      return current;
    }
    return latest;
  }, existingMeta?.syncedAt);

  const source =
    [...incomingData]
      .reverse()
      .map(data => data.meta?.source)
      .find((value): value is string => Boolean(value)) ?? existingMeta?.source;

  return {
    ...existingMeta,
    defaultBrandId,
    syncedAt: latestSyncedAt,
    source,
  };
};

/**
 * 同步状态接口
 */
interface SyncState {
  // 同步状态
  isSyncing: boolean;
  currentStep: string;
  overallProgress: number;
  currentOrganization: number;

  // 选中的品牌（使用 string 类型的组织ID）
  selectedBrands: string[];

  // 同步历史
  syncHistory: SyncRecord[];

  // 当前同步结果
  currentSyncResult: SyncRecord | null;

  // 错误状态
  error: string | null;
  isMigrationBlocked: boolean;
  migrationBlockReason: string | null;

  // Actions
  setSelectedBrands: (brands: string[]) => void;
  toggleBrand: (brandId: string) => void;
  selectAllBrands: (allBrandIds: string[]) => void;
  clearSelectedBrands: () => void;

  startSync: () => Promise<void>;
  updateProgress: (progress: number, currentOrg: number, message: string) => void;
  setSyncResult: (result: SyncRecord) => void;

  loadSyncHistory: () => void;
  clearHistory: () => void;

  setError: (error: string | null) => void;
  setMigrationBlocked: (reason: string) => void;
  clearMigrationBlocked: () => void;
  resetLocalBrandDataAndSync: () => Promise<void>;
  reset: () => void;
}

/**
 * 同步状态管理 Store
 */
export const useSyncStore = create<SyncState>()(
  devtools(
    (set, get) => ({
      // 初始状态
      isSyncing: false,
      currentStep: "",
      overallProgress: 0,
      currentOrganization: 0,
      selectedBrands: [],
      syncHistory: [],
      currentSyncResult: null,
      error: null,
      isMigrationBlocked: false,
      migrationBlockReason: null,

      // 品牌选择相关操作
      setSelectedBrands: brands => {
        set({ selectedBrands: brands });
      },

      toggleBrand: brandId => {
        const { selectedBrands } = get();
        const newSelectedBrands = selectedBrands.includes(brandId)
          ? selectedBrands.filter(id => id !== brandId)
          : [...selectedBrands, brandId];
        set({ selectedBrands: newSelectedBrands });
      },

      selectAllBrands: allBrandIds => {
        set({ selectedBrands: allBrandIds });
      },

      clearSelectedBrands: () => {
        set({ selectedBrands: [] });
      },

      // 同步操作
      startSync: async () => {
        const { selectedBrands } = get();
        let needsFullResync = false;

        if (selectedBrands.length === 0) {
          set({ error: "请至少选择一个品牌进行同步" });
          toast.error("请至少选择一个品牌进行同步");
          return;
        }

        try {
          const currentConfig = await configService.getConfig();
          needsFullResync = currentConfig?.metadata?.needsFullResync === true;

          if (needsFullResync) {
            const availableBrands = await fetchAvailableBrandIds();
            if (availableBrands.length === 0) {
              const message = "暂无可同步品牌，请先在品牌管理中添加品牌";
              set({ error: message });
              toast.error("全量同步校验失败", { description: message });
              return;
            }

            const availableBrandIds = new Set(availableBrands.map(brand => brand.id));
            const selectedBrandSet = new Set(selectedBrands);
            const missingBrands = availableBrands
              .filter(brand => !selectedBrandSet.has(brand.id))
              .map(brand => brand.name);
            const invalidSelections = selectedBrands.filter(
              brandId => !availableBrandIds.has(brandId)
            );

            if (missingBrands.length > 0 || invalidSelections.length > 0) {
              const message = buildFullResyncSelectionMessage(
                availableBrands.length,
                selectedBrands.length,
                missingBrands,
                invalidSelections
              );
              set({ error: message });
              toast.error("全量同步校验失败", { description: message });
              return;
            }
          }

          set({
            isSyncing: true,
            error: null,
            overallProgress: 0,
            currentStep: "准备开始同步...",
            currentSyncResult: null,
          });

          // 获取本地存储的Token
          const localToken = localStorage.getItem("duliday_token");

          // 验证 API 配置
          set({ currentStep: "验证 Duliday Token..." });
          // 构建验证URL，如果有本地Token则传递
          const validateUrl = localToken
            ? `/api/sync?token=${encodeURIComponent(localToken)}`
            : "/api/sync";
          const configResponse = await fetch(validateUrl);
          const configData = await configResponse.json();

          if (!configData.configured || !configData.tokenValid) {
            const baseMessage = configData.error || "请检查Token或环境变量";
            const helpText = !configData.configured
              ? "请前往 /admin/settings 配置 Duliday Token。"
              : "";
            throw new Error(`Duliday Token 配置无效：${baseMessage}${helpText ? ` ${helpText}` : ""}`);
          }

          if (needsFullResync) {
            toast.warning("检测到旧版本配置，需要全量重同步", {
              description: "本次同步将使用新数据完全替换本地品牌数据",
            });
          }

          toast.info("开始数据同步...", {
            description: `将同步 ${selectedBrands.length} 个品牌的数据`,
          });

          set({ currentStep: "正在同步数据...", overallProgress: 10 });

          // 获取现有数据以提取已知坐标
          const existingData = currentConfig?.brandData ?? (await getBrandData());
          const existingCoordinates: Record<string, { lat: number; lng: number }> = {};

          if (existingData) {
            getAllStores(existingData).forEach((store: Store) => {
              if (hasNumericCoordinates(store.coordinates)) {
                // 使用地址作为键
                existingCoordinates[store.location] = store.coordinates;
              }
            });
          }

          // 调用 API 端点进行同步 (流式响应)
          // ✅ 不传 cityNameList == 全量城市同步（默认允许）
          const requestBody: {
            organizationIds: string[];
            existingCoordinates: Record<string, { lat: number; lng: number }>;
            token?: string;
          } = {
            organizationIds: selectedBrands,
            existingCoordinates,
          };

          if (localToken) {
            requestBody.token = localToken;
          }

          const response = await fetch("/api/sync", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "同步请求失败");
          }

          if (!response.body) {
            throw new Error("未收到服务器响应流");
          }

          const reader = response.body.getReader();
          const { result, error } = await consumeNdjsonStream<SyncRecord>(
            reader,
            createSyncStreamHandler({
              onProgress: msg => {
                set({
                  overallProgress: msg.progress,
                  currentStep: msg.message,
                  currentOrganization: msg.currentOrg || 0,
                });
              },
              onGeocodingProgress: msg => {
                const baseProgress = 50;
                const maxProgress = 90;
                const progressRange = maxProgress - baseProgress;
                const calculatedProgress =
                  typeof msg.overallProgress === "number"
                    ? msg.overallProgress
                    : msg.total > 0
                      ? baseProgress + (msg.processed / msg.total) * progressRange
                      : baseProgress;
                const roundedProgress = Math.round(calculatedProgress * 10) / 10;
                set(state => ({
                  currentStep: `正在地理编码 [${msg.brandName}]: ${msg.processed}/${msg.total}`,
                  overallProgress: Math.min(
                    maxProgress,
                    Math.max(baseProgress, Math.max(state.overallProgress, roundedProgress))
                  ),
                }));
              },
            })
          );

          if (error) {
            console.warn("[sync-store] 同步流返回错误，但已收到结果:", error.message);
            toast.warning("同步完成但返回错误信息", {
              description: error.message,
            });
          }

          // 全量重同步：允许部分成功，失败品牌可后续单独重试
          const successfulResults = result.results.filter(r => r.success);
          const failedResults = result.results.filter(r => !r.success);

          if (needsFullResync && successfulResults.length === 0) {
            const failedBrands = failedResults.map(r => r.brandName || "未知品牌");
            throw new Error(
              `全量重同步失败，所有 ${failedBrands.length} 个品牌均未成功：${failedBrands.slice(0, 3).join("、")}${failedBrands.length > 3 ? "..." : ""}`
            );
          }

          // 处理转换后的数据并保存到本地配置
          set({ currentStep: "正在保存数据到本地...", overallProgress: 95 });

          try {
            await mergeAndSaveSyncData(result.results, {
              mode: needsFullResync ? "replace" : "merge",
            });

            // 🔄 重新加载配置以确保所有组件获取最新数据
            await configStore.getState().loadConfig();
            console.log("✅ 配置已重新加载，所有组件将看到最新数据");
          } catch (saveError) {
            const saveErrorMsg =
              saveError instanceof Error ? saveError.message : "未知保存错误";
            console.error(
              "❌ 数据保存到 IndexedDB 失败（同步数据已获取但未持久化）:",
              saveError
            );

            if (needsFullResync) {
              throw new Error(
                `全量重同步保存失败，原有数据未被覆盖，可重试。 ${saveErrorMsg}`
              );
            }

            // 非全量重同步：向用户显示保存失败警告（不再静默忽略）
            toast.error("数据保存失败", {
              description: `同步数据已获取但保存到本地失败: ${saveErrorMsg}`,
              duration: 8000,
            });
          }

          // 保存同步记录
          saveSyncRecord(result);

          set({
            currentSyncResult: result,
            isSyncing: false,
            currentStep: "同步完成",
            overallProgress: 100,
          });

          if (needsFullResync && successfulResults.length > 0) {
            get().clearMigrationBlocked();

            if (failedResults.length > 0) {
              const failedBrands = failedResults.map(r => r.brandName || "未知品牌");
              toast.warning("全量同步部分完成", {
                description: `${successfulResults.length} 个品牌已同步，${failedBrands.length} 个失败：${failedBrands.slice(0, 3).join("、")}${failedBrands.length > 3 ? "..." : ""}。失败品牌可在同步管理页面单独重试。`,
                duration: 10000,
              });
            }
          }

          // 刷新历史记录
          get().loadSyncHistory();

          // 显示结果通知
          if (result.overallSuccess) {
            const totalStores = result.results.reduce(
              (sum: number, r: SyncResult) => sum + r.storeCount,
              0
            );
            const totalRecords = result.results.reduce(
              (sum: number, r: SyncResult) => sum + r.processedRecords,
              0
            );

            toast.success("数据同步成功！", {
              description: `共同步 ${totalRecords} 条记录，${totalStores} 家门店`,
            });
          } else {
            const failedBrands = result.results.filter((r: SyncResult) => !r.success).length;
            toast.warning("数据同步部分成功", {
              description: `${failedBrands} 个品牌同步失败，请查看详细信息`,
            });
          }
        } catch (error) {
          const baseMessage = error instanceof Error ? error.message : "同步过程中发生未知错误";
          const errorMessage = needsFullResync
            ? `${baseMessage}（可重试，原有数据未被覆盖）`
            : baseMessage;

          set({
            error: errorMessage,
            isSyncing: false,
            currentStep: "同步失败",
          });

          toast.error("数据同步失败", {
            description: errorMessage,
          });

          if (needsFullResync) {
            get().setMigrationBlocked(errorMessage);
          }
        }
      },

      updateProgress: (progress, currentOrg, message) => {
        set({
          overallProgress: progress,
          currentOrganization: currentOrg,
          currentStep: message,
        });
      },

      setSyncResult: result => {
        set({ currentSyncResult: result });
      },

      // 历史记录操作
      loadSyncHistory: () => {
        const history = getSyncHistory();
        set({ syncHistory: history });
      },

      clearHistory: () => {
        try {
          // Dynamic import to avoid require()
          import("@/lib/services/duliday-sync.service").then(({ clearSyncHistory }) => {
            clearSyncHistory();
            set({ syncHistory: [] });
            toast.success("同步历史已清除");
          });
        } catch {
          toast.error("清除历史记录失败");
        }
      },

      // 错误处理
      setError: error => {
        set({ error });
      },

      setMigrationBlocked: reason => {
        set({ isMigrationBlocked: true, migrationBlockReason: reason });
      },

      clearMigrationBlocked: () => {
        set({ isMigrationBlocked: false, migrationBlockReason: null });
      },

      resetLocalBrandDataAndSync: async () => {
        if (get().isSyncing) {
          return;
        }

        try {
          await configService.clearBrandData();

          const availableBrands = await fetchAvailableBrandIds();
          if (availableBrands.length === 0) {
            throw new Error("暂无可同步品牌，请先在品牌管理中添加品牌");
          }

          set({ selectedBrands: availableBrands.map(brand => brand.id) });
          await get().startSync();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "清空本地品牌数据失败，请稍后重试";
          set({ error: message });
          toast.error("恢复失败", { description: message });
        }
      },

      // 重置状态
      reset: () => {
        set({
          isSyncing: false,
          currentStep: "",
          overallProgress: 0,
          currentOrganization: 0,
          currentSyncResult: null,
          error: null,
        });
      },
    }),
    {
      name: "sync-store",
    }
  )
);

/**
 * 格式化同步持续时间
 */
export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);

  if (minutes > 0) {
    return `${minutes}分${seconds % 60}秒`;
  }
  return `${seconds}秒`;
}

/**
 * 获取同步状态文本
 */
export function getSyncStatusText(isSuccess: boolean): string {
  return isSuccess ? "成功" : "失败";
}

/**
 * 获取同步状态颜色
 */
export function getSyncStatusColor(isSuccess: boolean): string {
  return isSuccess ? "text-green-600" : "text-red-600";
}

interface SyncSaveOptions {
  mode?: "merge" | "replace";
}

/**
 * 合并并保存同步数据到本地配置
 */
export async function mergeAndSaveSyncData(
  syncResults: SyncResult[],
  options: SyncSaveOptions = {}
): Promise<void> {
  let mode = options.mode ?? "merge";
  const currentConfig = await configService.getConfig();

  if (!currentConfig) {
    throw new Error("配置数据不存在，请先初始化");
  }

  const existingData = currentConfig.brandData;

  // 🛡️ Sample 污染检测：如果现有数据来自 sample 或为空，自动提升为 replace
  if (mode === "merge" && isSampleSeededData(existingData)) {
    console.log("🔄 检测到现有数据为 sample 初始化数据或空数据，自动提升为 replace 模式");
    mode = "replace";
  }

  // 合并所有同步结果的数据
  const allConvertedData: Partial<ZhipinData>[] = syncResults
    .filter(result => result.success && result.convertedData)
    .map(result => result.convertedData)
    .filter((data): data is Partial<ZhipinData> => data !== undefined && data !== null);

  // 收集 API 正常返回 0 岗位的品牌（需清理旧数据）
  // 区分：errors 为空 = API 正常返回空数据；errors 非空 = 网络/API 异常，保留旧数据
  const emptyBrandIds = new Set<string>();
  const emptyBrandNames = new Set<string>();
  for (const result of syncResults) {
    if (
      !result.success &&
      !result.convertedData &&
      result.errors.length === 0 &&
      result.brandName
    ) {
      if (result.organizationId !== undefined) {
        emptyBrandIds.add(String(result.organizationId));
      }
      emptyBrandNames.add(result.brandName);
    }
  }

  if (allConvertedData.length === 0 && emptyBrandNames.size === 0) {
    console.log("没有需要保存的转换数据");
    if (mode === "replace") {
      throw new Error("全量重同步未返回可保存的数据");
    }
    return;
  }

  // 仅有空品牌需要清理（无新数据）
  if (allConvertedData.length === 0 && emptyBrandNames.size > 0) {
    console.log(
      `没有新数据，但需清理 ${emptyBrandNames.size} 个已无在招岗位的品牌: ${Array.from(emptyBrandNames).join(", ")}`
    );

    const mergedBrands = (existingData?.brands || []).filter(brand => {
      if (emptyBrandIds.has(brand.id) || emptyBrandNames.has(brand.name)) {
        console.log(`🗑️ 已清理品牌 "${brand.name}" 的本地门店和配置`);
        return false;
      }
      return true;
    });

    const finalData: ZhipinData = {
      meta: existingData?.meta || {},
      brands: mergedBrands,
    };
    ensureValidDefaultBrandId(finalData, undefined);

    await configService.updateBrandData(finalData);
    const totalStores = getAllStores(finalData).length;
    console.log(`✅ 空品牌清理完成，剩余门店: ${totalStores} 个，品牌: ${mergedBrands.length} 个`);
    return;
  }

  if (mode === "replace") {
    // Determine defaultBrandId from sync results or existing data
    const mergedDefaultBrandId =
      allConvertedData.find(data => data.meta?.defaultBrandId)?.meta?.defaultBrandId ||
      existingData?.meta?.defaultBrandId;

    // Merge brands by id: later results overwrite earlier ones
    const brandMap = new Map<string, Brand>();

    for (const data of allConvertedData) {
      if (data.brands) {
        for (const brand of data.brands) {
          brandMap.set(brand.id, brand);
        }
      }
    }

    const mergedBrands = Array.from(brandMap.values());

    const finalData: ZhipinData = {
      meta: mergeDatasetMeta(existingData?.meta, allConvertedData, mergedDefaultBrandId),
      brands: mergedBrands,
    };
    ensureValidDefaultBrandId(finalData, mergedDefaultBrandId);

    await configService.saveConfig({
      ...currentConfig,
      brandData: finalData,
      metadata: {
        ...currentConfig.metadata,
        version: CONFIG_VERSION,
        migratedAt: currentConfig.metadata.migratedAt || new Date().toISOString(),
        upgradedAt: new Date().toISOString(),
        needsFullResync: false,
      },
    });

    const totalStores = getAllStores(finalData).length;
    console.log(`✅ 数据全量替换完成:`);
    console.log(`   📊 总门店数: ${totalStores} 个`);
    console.log(`   🏢 总品牌数: ${mergedBrands.length} 个`);
    return;
  }

  // 收集所有同步的品牌 ID
  const syncedBrandIds = new Set<string>();
  const syncedBrandNames = new Set<string>();
  for (const data of allConvertedData) {
    if (data.brands) {
      for (const brand of data.brands) {
        syncedBrandIds.add(brand.id);
        syncedBrandNames.add(brand.name);
      }
    }
  }

  if (emptyBrandNames.size > 0) {
    console.log(
      `🔄 开始合并数据，将替换品牌: ${Array.from(syncedBrandNames).join(", ")}；将清理空品牌: ${Array.from(emptyBrandNames).join(", ")}`
    );
  } else {
    console.log(`🔄 开始合并数据，将替换品牌: ${Array.from(syncedBrandNames).join(", ")}`);
  }

  // 基础元数据保持不变
  let mergedDefaultBrandId = existingData?.meta?.defaultBrandId;

  // 品牌数据：保留现有品牌（排除被同步的和空的），然后添加同步的品牌
  const existingBrands = (existingData?.brands || []).filter(
    brand =>
      !syncedBrandIds.has(brand.id) &&
      !emptyBrandIds.has(brand.id) &&
      !emptyBrandNames.has(brand.name)
  );

  // 清理 API 正常返回 0 岗位的品牌配置
  for (const brandName of emptyBrandNames) {
    const found = existingData?.brands?.find(
      b => emptyBrandIds.has(b.id) || b.name === brandName
    );
    if (found) {
      console.log(`🗑️ 已清理品牌 "${found.name}" 的本地配置（API 返回 0 岗位）`);
    }
  }

  console.log(`🗑️ 移除被同步品牌和空品牌，剩余品牌: ${existingBrands.length} 个`);

  // 合并新品牌数据：按 brand.id 去重（后来者覆盖）
  const newBrandMap = new Map<string, Brand>();
  for (const data of allConvertedData) {
    // 更新默认品牌（使用第一个非空的）
    if (data.meta?.defaultBrandId && !mergedDefaultBrandId) {
      mergedDefaultBrandId = data.meta.defaultBrandId;
    }

    if (data.brands) {
      for (const brand of data.brands) {
        const existingBrand = existingBrands.find(b => b.id === brand.id);
        if (existingBrand) {
          // 品牌已存在于本地：保留 aliases 等已有信息，更新门店
          newBrandMap.set(brand.id, {
            ...brand,
            aliases: brand.aliases || existingBrand.aliases,
          });
          console.log(`🔄 更新品牌 "${brand.name}" 的门店数据`);
        } else {
          // 新品牌：使用完整的新配置
          newBrandMap.set(brand.id, brand);
          console.log(`🆕 添加新品牌 "${brand.name}"`);
        }

        const storeCount = brand.stores.length;
        console.log(`➕ 添加品牌 "${brand.name}" 的门店: ${storeCount} 个`);
      }
    }
  }

  // 合并：保留的现有品牌 + 新同步的品牌
  const mergedBrands = [...existingBrands, ...Array.from(newBrandMap.values())];

  // 构建最终数据
  const finalData: ZhipinData = {
    meta: mergeDatasetMeta(existingData?.meta, allConvertedData, mergedDefaultBrandId),
    brands: mergedBrands,
  };
  ensureValidDefaultBrandId(finalData, mergedDefaultBrandId);

  // 保存到配置
  await configService.updateBrandData(finalData);

  const totalBrands = mergedBrands.length;
  const syncedBrandCount = syncedBrandIds.size;
  const totalStores = getAllStores(finalData).length;
  const newStoresCount = allConvertedData.reduce(
    (sum, data) => sum + (data.brands?.reduce((s, b) => s + b.stores.length, 0) || 0),
    0
  );

  console.log(`✅ 数据同步完成:`);
  console.log(`   📊 总门店数: ${totalStores} 个`);
  console.log(`   🏢 总品牌数: ${totalBrands} 个`);
  console.log(
    `   🔄 替换品牌: ${syncedBrandCount} 个 (${Array.from(syncedBrandNames).join(", ")})`
  );
  console.log(`   🆕 新增门店: ${newStoresCount} 个`);
}
