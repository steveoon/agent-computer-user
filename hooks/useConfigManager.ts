"use client";

import React from "react";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import {
  configService,
  migrateFromHardcodedData,
} from "@/lib/services/config.service";
import type {
  AppConfigData,
  ZhipinData,
  ReplyPromptsConfig,
  SystemPromptsConfig,
} from "@/types";
// 🔧 导入预定义的 Zod Schema，避免重复定义
import { AppConfigDataSchema } from "@/types/config";

interface ConfigState {
  // 配置数据
  config: AppConfigData | null;
  loading: boolean;
  error: string | null;

  // 操作方法
  loadConfig: () => Promise<void>;
  updateBrandData: (brandData: ZhipinData) => Promise<void>;
  updateReplyPrompts: (replyPrompts: ReplyPromptsConfig) => Promise<void>;
  updateSystemPrompts: (systemPrompts: SystemPromptsConfig) => Promise<void>;
  updateActiveSystemPrompt: (
    promptType: keyof SystemPromptsConfig
  ) => Promise<void>;
  exportConfig: () => void;
  importConfig: (file: File) => Promise<void>;
  resetConfig: () => Promise<void>;
  setError: (error: string | null) => void;
}

const useConfigStore = create<ConfigState>()(
  devtools(
    (set, get) => ({
      config: null,
      loading: false,
      error: null,

      loadConfig: async () => {
        set({ loading: true, error: null });

        try {
          console.log("🔄 开始加载应用配置...");
          const config = await configService.getConfig();

          if (!config) {
            set({
              config: null,
              loading: false,
              error: "配置数据未找到，请确保已完成数据迁移",
            });
            return;
          }

          console.log("✅ 应用配置加载成功", {
            brands: Object.keys(config.brandData?.brands || {}).length,
            stores: config.brandData?.stores?.length || 0,
            systemPrompts: Object.keys(config.systemPrompts || {}).length,
            replyPrompts: Object.keys(config.replyPrompts || {}).length,
          });

          set({ config, loading: false, error: null });
        } catch (error) {
          console.error("❌ 配置加载失败:", error);
          set({
            config: null,
            loading: false,
            error: error instanceof Error ? error.message : "未知错误",
          });
        }
      },

      updateBrandData: async (brandData: ZhipinData) => {
        const { config } = get();
        if (!config) {
          set({ error: "配置未加载，无法更新品牌数据" });
          return;
        }

        try {
          console.log("🔄 更新品牌数据...");
          const updatedConfig: AppConfigData = {
            ...config,
            brandData,
            metadata: {
              ...config.metadata,
              lastUpdated: new Date().toISOString(),
            },
          };

          await configService.saveConfig(updatedConfig);
          set({ config: updatedConfig, error: null });

          console.log("✅ 品牌数据更新成功", {
            brands: Object.keys(brandData.brands).length,
            stores: brandData.stores.length,
          });
        } catch (error) {
          console.error("❌ 品牌数据更新失败:", error);
          set({ error: error instanceof Error ? error.message : "更新失败" });
        }
      },

      updateReplyPrompts: async (replyPrompts: ReplyPromptsConfig) => {
        const { config } = get();
        if (!config) {
          set({ error: "配置未加载，无法更新回复指令" });
          return;
        }

        try {
          console.log("🔄 更新回复指令...");
          const updatedConfig: AppConfigData = {
            ...config,
            replyPrompts,
            metadata: {
              ...config.metadata,
              lastUpdated: new Date().toISOString(),
            },
          };

          await configService.saveConfig(updatedConfig);
          set({ config: updatedConfig, error: null });

          console.log("✅ 回复指令更新成功", {
            count: Object.keys(replyPrompts).length,
          });
        } catch (error) {
          console.error("❌ 回复指令更新失败:", error);
          set({ error: error instanceof Error ? error.message : "更新失败" });
        }
      },

      updateSystemPrompts: async (systemPrompts: SystemPromptsConfig) => {
        const { config } = get();
        if (!config) {
          set({ error: "配置未加载，无法更新系统提示词" });
          return;
        }

        try {
          console.log("🔄 更新系统提示词...");
          const updatedConfig: AppConfigData = {
            ...config,
            systemPrompts,
            metadata: {
              ...config.metadata,
              lastUpdated: new Date().toISOString(),
            },
          };

          await configService.saveConfig(updatedConfig);
          set({ config: updatedConfig, error: null });

          console.log("✅ 系统提示词更新成功", {
            count: Object.keys(systemPrompts).length,
          });
        } catch (error) {
          console.error("❌ 系统提示词更新失败:", error);
          set({ error: error instanceof Error ? error.message : "更新失败" });
        }
      },

      updateActiveSystemPrompt: async (
        promptType: keyof SystemPromptsConfig
      ) => {
        const { config } = get();
        if (!config) {
          set({ error: "配置未加载，无法更新活动系统提示词" });
          return;
        }

        try {
          console.log(`🔄 切换活动系统提示词到: ${promptType}...`);
          const updatedConfig: AppConfigData = {
            ...config,
            activeSystemPrompt: promptType,
            metadata: {
              ...config.metadata,
              lastUpdated: new Date().toISOString(),
            },
          };

          await configService.saveConfig(updatedConfig);
          set({ config: updatedConfig, error: null });

          console.log(
            `✅ 已切换到 ${
              promptType === "bossZhipinSystemPrompt"
                ? "Boss直聘"
                : "通用计算机"
            } 系统提示词`
          );
        } catch (error) {
          console.error("❌ 活动系统提示词更新失败:", error);
          set({ error: error instanceof Error ? error.message : "更新失败" });
        }
      },

      exportConfig: () => {
        const { config } = get();
        if (!config) {
          set({ error: "没有可导出的配置数据" });
          return;
        }

        try {
          const dataStr = JSON.stringify(config, null, 2);
          const dataBlob = new Blob([dataStr], { type: "application/json" });
          const url = URL.createObjectURL(dataBlob);

          const link = document.createElement("a");
          link.href = url;
          link.download = `app-config-${
            new Date().toISOString().split("T")[0]
          }.json`;
          link.click();

          URL.revokeObjectURL(url);
          console.log("✅ 配置导出成功");
        } catch (error) {
          console.error("❌ 配置导出失败:", error);
          set({ error: error instanceof Error ? error.message : "导出失败" });
        }
      },

      importConfig: async (file: File) => {
        set({ loading: true, error: null });

        try {
          console.log("🔄 导入配置文件...");
          const text = await file.text();

          // 先尝试解析JSON
          let parsedData: unknown;
          try {
            parsedData = JSON.parse(text);
          } catch (parseError) {
            throw new Error("配置文件不是有效的JSON格式");
          }

          console.log("🔍 开始严格数据格式校验...");

          // 🔧 使用Zod Schema进行严格校验
          const validationResult = AppConfigDataSchema.safeParse(parsedData);

          if (!validationResult.success) {
            console.error("❌ 数据格式校验失败:", validationResult.error);

            // 生成用户友好的错误信息
            const errorMessages = validationResult.error.errors
              .map((err) => {
                const path =
                  err.path.length > 0 ? err.path.join(".") : "根级别";
                return `• ${path}: ${err.message}`;
              })
              .slice(0, 10); // 限制显示前10个错误

            const errorSummary = [
              `配置文件数据格式校验失败，发现以下问题:`,
              ...errorMessages,
              validationResult.error.errors.length > 10
                ? `... 还有 ${
                    validationResult.error.errors.length - 10
                  } 个其他错误`
                : "",
            ]
              .filter(Boolean)
              .join("\n");

            throw new Error(errorSummary);
          }

          const importedConfig = validationResult.data;
          console.log("✅ 数据格式校验通过");

          // 📊 额外的业务逻辑检查
          const brands = Object.keys(importedConfig.brandData.brands);
          const stores = importedConfig.brandData.stores;
          const replyPrompts = Object.keys(
            importedConfig.replyPrompts
          ) as (keyof ReplyPromptsConfig)[];
          const systemPrompts = Object.keys(importedConfig.systemPrompts);

          console.log("📊 导入数据统计:", {
            brands: brands.length,
            stores: stores.length,
            replyPrompts: replyPrompts.length,
            systemPrompts: systemPrompts.length,
          });

          // 检查品牌一致性
          const storesBrands = [...new Set(stores.map((store) => store.brand))];
          const missingBrands = storesBrands.filter(
            (brand) => !brands.includes(brand)
          );

          if (missingBrands.length > 0) {
            throw new Error(
              `门店数据中引用了未定义的品牌: ${missingBrands.join(", ")}`
            );
          }

          // 检查必要的回复指令
          const requiredReplyPrompts: (keyof ReplyPromptsConfig)[] = [
            "initial_inquiry",
            "location_inquiry",
            "no_location_match",
            "salary_inquiry",
            "schedule_inquiry",
            "interview_request",
            "age_concern",
            "insurance_inquiry",
            "followup_chat",
            "general_chat",
            "attendance_inquiry",
            "flexibility_inquiry",
            "attendance_policy_inquiry",
            "work_hours_inquiry",
            "availability_inquiry",
            "part_time_support",
          ];

          const missingPrompts = requiredReplyPrompts.filter((prompt) => {
            const replyPromptsRecord = importedConfig.replyPrompts as Record<
              string,
              string
            >;
            const promptValue = replyPromptsRecord[prompt];
            return !promptValue || !promptValue.trim();
          });

          if (missingPrompts.length > 0) {
            throw new Error(`缺少必要的回复指令: ${missingPrompts.join(", ")}`);
          }

          // 添加导入时间戳
          const configWithTimestamp: AppConfigData = {
            ...importedConfig,
            metadata: {
              ...importedConfig.metadata,
              lastUpdated: new Date().toISOString(),
            },
          };

          await configService.saveConfig(configWithTimestamp);
          set({ config: configWithTimestamp, loading: false, error: null });

          console.log("✅ 配置导入成功", {
            brands: Object.keys(configWithTimestamp.brandData.brands).length,
            stores: configWithTimestamp.brandData.stores.length,
            systemPrompts: Object.keys(configWithTimestamp.systemPrompts)
              .length,
            replyPrompts: Object.keys(configWithTimestamp.replyPrompts).length,
          });
        } catch (error) {
          console.error("❌ 配置导入失败:", error);
          set({
            loading: false,
            error: error instanceof Error ? error.message : "导入失败",
          });
        }
      },

      resetConfig: async () => {
        set({ loading: true, error: null });

        try {
          console.log("🔄 重置配置到默认状态...");

          // 清空本地存储
          await configService.clearConfig();

          // 重新初始化配置（从硬编码数据迁移）
          await migrateFromHardcodedData();

          // 重新加载配置
          await get().loadConfig();

          console.log("✅ 配置重置成功");
        } catch (error) {
          console.error("❌ 配置重置失败:", error);
          set({
            loading: false,
            error: error instanceof Error ? error.message : "重置失败",
          });
        }
      },

      setError: (error: string | null) => {
        set({ error });
      },
    }),
    {
      name: "config-manager-store",
    }
  )
);

// 导出hook
export const useConfigManager = () => {
  const store = useConfigStore();

  // 组件挂载时自动加载配置
  React.useEffect(() => {
    if (!store.config && !store.loading) {
      store.loadConfig();
    }
  }, [store]);

  return store;
};

// 用于组件外部使用的store实例
export const configStore = useConfigStore;
