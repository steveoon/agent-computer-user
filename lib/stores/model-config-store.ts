import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ModelId, ProviderConfig } from "@/lib/config/models";
import { DEFAULT_MODEL_CONFIG, DEFAULT_PROVIDER_CONFIGS, MODEL_DICTIONARY } from "@/lib/config/models";

/**
 * 🤖 模型配置管理Store
 */

interface ModelConfigState {
  // 模型配置
  chatModel: ModelId; // Chat API 使用的主模型
  classifyModel: ModelId; // 分类消息使用的模型
  replyModel: ModelId; // 生成回复使用的模型

  // Provider配置
  providerConfigs: Record<string, ProviderConfig>;
}

interface ModelConfigActions {
  // 模型配置方法
  setChatModel: (model: ModelId) => void;
  setClassifyModel: (model: ModelId) => void;
  setReplyModel: (model: ModelId) => void;

  // Provider配置方法
  updateProviderConfig: (provider: string, config: ProviderConfig) => void;
  resetProviderConfig: (provider: string) => void;
  resetAllProviderConfigs: () => void;

  // 重置方法
  resetToDefaults: () => void;
}

type ModelConfigStore = ModelConfigState & ModelConfigActions;

/**
 * 验证模型 ID 是否有效
 */
function validateModelId(modelId: ModelId | undefined, defaultModelId: ModelId): ModelId {
  if (!modelId) {
    console.warn(`[MODEL CONFIG] 模型 ID 未定义，使用默认值: ${defaultModelId}`);
    return defaultModelId;
  }
  
  if (!(modelId in MODEL_DICTIONARY)) {
    console.warn(`[MODEL CONFIG] 无效的模型 ID: ${modelId}，已重置为默认值: ${defaultModelId}`);
    return defaultModelId;
  }
  
  return modelId;
}

/**
 * 合并Provider配置：确保新增的Provider不会被localStorage中的旧数据覆盖
 */
function mergeProviderConfigs(
  savedConfigs: Record<string, ProviderConfig> | undefined,
  defaultConfigs: Record<string, ProviderConfig>
): Record<string, ProviderConfig> {
  if (!savedConfigs) {
    return { ...defaultConfigs };
  }

  const merged = { ...defaultConfigs };

  // 保留用户自定义的配置（如果存在）
  Object.keys(savedConfigs).forEach(provider => {
    if (merged[provider]) {
      merged[provider] = savedConfigs[provider];
    }
  });

  console.log("[MODEL CONFIG] 合并Provider配置完成:", {
    默认配置: Object.keys(defaultConfigs),
    保存的配置: Object.keys(savedConfigs),
    合并后配置: Object.keys(merged),
  });

  return merged;
}

export const useModelConfigStore = create<ModelConfigStore>()(
  persist(
    (set, _get) => ({
      // 初始状态
      chatModel: DEFAULT_MODEL_CONFIG.chatModel,
      classifyModel: DEFAULT_MODEL_CONFIG.classifyModel,
      replyModel: DEFAULT_MODEL_CONFIG.replyModel,
      providerConfigs: { ...DEFAULT_PROVIDER_CONFIGS },

      // 模型配置方法
      setChatModel: (model: ModelId) => {
        set({ chatModel: model });
        console.log(`[MODEL CONFIG] Chat模型已更新为: ${model}`);
      },

      setClassifyModel: (model: ModelId) => {
        set({ classifyModel: model });
        console.log(`[MODEL CONFIG] 分类模型已更新为: ${model}`);
      },

      setReplyModel: (model: ModelId) => {
        set({ replyModel: model });
        console.log(`[MODEL CONFIG] 回复模型已更新为: ${model}`);
      },

      // Provider配置方法
      updateProviderConfig: (provider: string, config: ProviderConfig) => {
        set(state => ({
          providerConfigs: {
            ...state.providerConfigs,
            [provider]: config,
          },
        }));
        console.log(`[MODEL CONFIG] Provider ${provider} 配置已更新:`, config);
      },

      resetProviderConfig: (provider: string) => {
        const defaultConfig = DEFAULT_PROVIDER_CONFIGS[provider];
        if (defaultConfig) {
          set(state => ({
            providerConfigs: {
              ...state.providerConfigs,
              [provider]: { ...defaultConfig },
            },
          }));
          console.log(`[MODEL CONFIG] Provider ${provider} 配置已重置为默认值`);
        }
      },

      resetAllProviderConfigs: () => {
        set({ providerConfigs: { ...DEFAULT_PROVIDER_CONFIGS } });
        console.log(`[MODEL CONFIG] 所有Provider配置已重置为默认值`);
      },

      // 重置所有配置
      resetToDefaults: () => {
        set({
          chatModel: DEFAULT_MODEL_CONFIG.chatModel,
          classifyModel: DEFAULT_MODEL_CONFIG.classifyModel,
          replyModel: DEFAULT_MODEL_CONFIG.replyModel,
          providerConfigs: { ...DEFAULT_PROVIDER_CONFIGS },
        });
        console.log(`[MODEL CONFIG] 所有配置已重置为默认值`);
      },
    }),
    {
      name: "model-config-storage",
      partialize: state => ({
        chatModel: state.chatModel,
        classifyModel: state.classifyModel,
        replyModel: state.replyModel,
        providerConfigs: state.providerConfigs,
      }),
      // 自定义合并逻辑：解决新增Provider被覆盖的问题和无效模型ID问题
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<ModelConfigState>;

        // 验证并修正模型 ID
        const validatedChatModel = validateModelId(
          persisted.chatModel as ModelId | undefined,
          DEFAULT_MODEL_CONFIG.chatModel
        );
        const validatedClassifyModel = validateModelId(
          persisted.classifyModel as ModelId | undefined,
          DEFAULT_MODEL_CONFIG.classifyModel
        );
        const validatedReplyModel = validateModelId(
          persisted.replyModel as ModelId | undefined,
          DEFAULT_MODEL_CONFIG.replyModel
        );

        return {
          ...currentState,
          chatModel: validatedChatModel,
          classifyModel: validatedClassifyModel,
          replyModel: validatedReplyModel,
          // 关键：智能合并Provider配置
          providerConfigs: mergeProviderConfigs(
            persisted.providerConfigs,
            DEFAULT_PROVIDER_CONFIGS
          ),
        };
      },
    }
  )
);

// 导出便捷的选择器hooks
export const useChatModel = () => useModelConfigStore(state => state.chatModel);
export const useClassifyModel = () => useModelConfigStore(state => state.classifyModel);
export const useReplyModel = () => useModelConfigStore(state => state.replyModel);
export const useProviderConfigs = () => useModelConfigStore(state => state.providerConfigs);

// 获取特定provider的配置
export const useProviderConfig = (provider: string) =>
  useModelConfigStore(state => state.providerConfigs[provider]);

// 导出完整的store供组件使用
export const useModelConfig = () => useModelConfigStore();
