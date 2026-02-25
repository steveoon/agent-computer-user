import { create } from "zustand";
import { devtools } from "zustand/middleware";
import {
  SyncRecord,
  SyncResult,
  saveSyncRecord,
  getSyncHistory,
} from "@/lib/services/duliday-sync.service";
import { configService, getBrandData } from "@/lib/services/config.service";
import { ZhipinData } from "@/types/zhipin";
import { toast } from "sonner";
import { configStore } from "@/hooks/useConfigManager";

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

        if (selectedBrands.length === 0) {
          set({ error: "请至少选择一个品牌进行同步" });
          toast.error("请至少选择一个品牌进行同步");
          return;
        }

        set({
          isSyncing: true,
          error: null,
          overallProgress: 0,
          currentStep: "准备开始同步...",
          currentSyncResult: null,
        });

        try {
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
            throw new Error(
              `Duliday Token 配置无效：${configData.error || "请检查Token或环境变量"}`
            );
          }

          toast.info("开始数据同步...", {
            description: `将同步 ${selectedBrands.length} 个品牌的数据`,
          });

          set({ currentStep: "正在同步数据...", overallProgress: 10 });

          // 获取现有数据以提取已知坐标
          const existingData = await getBrandData();
          const existingCoordinates: Record<string, { lat: number; lng: number }> = {};

          if (existingData?.stores) {
            existingData.stores.forEach(store => {
              if (store.coordinates && store.coordinates.lat !== 0 && store.coordinates.lng !== 0) {
                // 使用地址作为键
                existingCoordinates[store.location] = store.coordinates;
              }
            });
          }

          const normalizedCityName = (existingData?.city || "上海市").trim();
          const cityNameList = normalizedCityName ? [normalizedCityName] : ["上海市"];

          // 调用 API 端点进行同步 (流式响应)
          const response = await fetch("/api/sync", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              organizationIds: selectedBrands,
              cityNameList,
              token: localToken,
              existingCoordinates, // 发送已知坐标
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "同步请求失败");
          }

          if (!response.body) {
            throw new Error("未收到服务器响应流");
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let result: SyncRecord | null = null;
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");

            // Keep the last line in the buffer as it might be incomplete
            // unless the stream is done (which is handled by the loop exit)
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.trim() === "") continue;

              try {
                const data = JSON.parse(line);

                if (data.type === "progress") {
                  set({
                    overallProgress: data.progress,
                    currentStep: data.message,
                    currentOrganization: data.currentOrg || 0,
                  });
                } else if (data.type === "geocoding_progress") {
                  // 地理编码阶段进度 (50% - 90%)
                  const baseProgress = 50;
                  const maxProgress = 90;
                  const progressRange = maxProgress - baseProgress;
                  const calculatedProgress =
                    typeof data.overallProgress === "number"
                      ? data.overallProgress
                      : data.total > 0
                        ? baseProgress + (data.processed / data.total) * progressRange
                        : baseProgress;
                  const roundedProgress = Math.round(calculatedProgress * 10) / 10;
                  set(state => ({
                    currentStep: `正在地理编码 [${data.brandName}]: ${data.processed}/${data.total}`,
                    overallProgress: Math.min(
                      maxProgress,
                      Math.max(
                        baseProgress,
                        Math.max(state.overallProgress, roundedProgress)
                      )
                    ),
                  }));
                } else if (data.type === "result") {
                  result = data.data;
                } else if (data.type === "error") {
                  throw new Error(data.error);
                }
              } catch (e) {
                console.error("解析流数据失败:", e);
              }
            }
          }

          // Process any remaining buffer
          if (buffer.trim()) {
            try {
              const data = JSON.parse(buffer);
              if (data.type === "result") {
                result = data.data;
              } else if (data.type === "error") {
                throw new Error(data.error);
              }
            } catch (e) {
              console.error("解析剩余缓冲数据失败:", e);
            }
          }

          if (!result) {
            throw new Error("未收到同步结果数据");
          }

          // 处理转换后的数据并保存到本地配置
          set({ currentStep: "正在保存数据到本地...", overallProgress: 95 });

          try {
            await mergeAndSaveSyncData(result.results);

            // 🔄 重新加载配置以确保所有组件获取最新数据
            await configStore.getState().loadConfig();
            console.log("✅ 配置已重新加载，所有组件将看到最新数据");
          } catch (saveError) {
            console.warn("数据保存失败，但同步已完成:", saveError);
            // 即使保存失败，也不影响同步的成功状态
          }

          // 保存同步记录
          saveSyncRecord(result);

          set({
            currentSyncResult: result,
            isSyncing: false,
            currentStep: "同步完成",
            overallProgress: 100,
          });

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
          const errorMessage = error instanceof Error ? error.message : "同步过程中发生未知错误";

          set({
            error: errorMessage,
            isSyncing: false,
            currentStep: "同步失败",
          });

          toast.error("数据同步失败", {
            description: errorMessage,
          });
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

/**
 * 合并并保存同步数据到本地配置
 */
export async function mergeAndSaveSyncData(syncResults: SyncResult[]): Promise<void> {
  // 获取现有配置
  const existingData = await getBrandData();

  // 合并所有同步结果的数据
  const allConvertedData: Partial<ZhipinData>[] = syncResults
    .filter(result => result.success && result.convertedData)
    .map(result => result.convertedData)
    .filter((data): data is Partial<ZhipinData> => data !== undefined && data !== null);

  if (allConvertedData.length === 0) {
    console.log("没有需要保存的转换数据");
    return;
  }

  // 收集所有同步的品牌名称
  const syncedBrandNames = new Set<string>();
  for (const data of allConvertedData) {
    if (data.brands) {
      Object.keys(data.brands).forEach(brandName => syncedBrandNames.add(brandName));
    }
  }

  console.log(`🔄 开始合并数据，将替换品牌: ${Array.from(syncedBrandNames).join(", ")}`);

  // 基础数据保持不变
  let mergedCity = existingData?.city || "上海市";
  let mergedDefaultBrand = existingData?.defaultBrand;

  // 品牌数据：保留现有品牌 + 完全替换同步的品牌
  const mergedBrands = { ...(existingData?.brands || {}) };

  // 门店数据：移除被同步品牌的现有门店，然后添加新门店
  let mergedStores = [...(existingData?.stores || [])];

  // 第一步：移除所有即将被同步品牌的现有门店
  mergedStores = mergedStores.filter(store => !syncedBrandNames.has(store.brand));

  console.log(`🗑️ 移除现有门店数据，剩余门店: ${mergedStores.length} 个`);

  // 第二步：处理每个同步结果的数据
  for (const data of allConvertedData) {
    // 更新城市（使用第一个非空的）
    if (data.city && !mergedCity) {
      mergedCity = data.city;
    }

    // 更新默认品牌（使用第一个非空的）
    if (data.defaultBrand && !mergedDefaultBrand) {
      mergedDefaultBrand = data.defaultBrand;
    }

    // 智能合并品牌配置：保留现有品牌的话术模板，只更新其他配置
    if (data.brands) {
      const brands = data.brands;
      Object.keys(brands).forEach(brandName => {
        const newBrandConfig = brands[brandName];
        const existingBrandConfig = mergedBrands[brandName];

        if (existingBrandConfig) {
          // 品牌已存在：保留现有的 templates（用户可能已修改），只更新其他配置
          mergedBrands[brandName] = {
            ...newBrandConfig,
            templates: existingBrandConfig.templates, // 保留用户修改过的话术
          };
          console.log(`🔄 保留品牌 "${brandName}" 的现有话术模板`);
        } else {
          // 新品牌：使用完整的新配置（包括默认话术）
          mergedBrands[brandName] = newBrandConfig;
          console.log(`🆕 添加新品牌 "${brandName}" 及其默认话术模板`);
        }
      });
    }

    // 添加新的门店数据（完全替换）
    if (data.stores) {
      mergedStores.push(...data.stores);
      console.log(`➕ 添加品牌 "${data.stores[0]?.brand}" 的门店: ${data.stores.length} 个`);
    }
  }

  // 构建最终数据
  const finalData: ZhipinData = {
    city: mergedCity,
    stores: mergedStores,
    brands: mergedBrands,
    defaultBrand: mergedDefaultBrand,
  };

  // 保存到配置
  await configService.updateBrandData(finalData);

  const totalBrands = Object.keys(mergedBrands).length;
  const syncedBrandCount = syncedBrandNames.size;
  const newStoresCount = allConvertedData.reduce(
    (sum, data) => sum + (data.stores?.length || 0),
    0
  );

  console.log(`✅ 数据同步完成:`);
  console.log(`   📊 总门店数: ${mergedStores.length} 个`);
  console.log(`   🏢 总品牌数: ${totalBrands} 个`);
  console.log(
    `   🔄 替换品牌: ${syncedBrandCount} 个 (${Array.from(syncedBrandNames).join(", ")})`
  );
  console.log(`   🆕 新增门店: ${newStoresCount} 个`);
}
