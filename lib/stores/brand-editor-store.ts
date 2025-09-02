/**
 * 🎯 品牌数据编辑器状态管理 Store
 * 集中管理 brand-data-editor 和 template-editor 组件的状态
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { ZhipinData, ScheduleType, SchedulingFlexibility } from "@/types";

interface BrandEditorState {
  // 核心数据
  originalData: ZhipinData | undefined;
  localData: ZhipinData | undefined;
  jsonData: string;

  // UI 状态
  editMode: "overview" | "json";
  editingBrand: string | null;
  editingType: "templates" | "schedule" | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // 编辑状态追踪
  hasUnsavedChanges: boolean;

  // Actions
  initializeData: (data: ZhipinData) => void;
  setEditMode: (mode: "overview" | "json") => void;
  setEditingBrand: (brand: string | null) => void;
  setEditingType: (type: "templates" | "schedule" | null) => void;
  updateTemplates: (brandName: string, templates: Record<string, string[]>) => ZhipinData | null;
  updateSchedulingInfo: (
    brandName: string,
    scheduleType: ScheduleType,
    schedulingFlexibility: SchedulingFlexibility,
    targetType: "all" | "store",
    storeIndex?: number,
    positionIndex?: number
  ) => ZhipinData | null;
  updateJsonData: (json: string) => void;
  syncJsonToLocal: () => void;
  saveData: (onSave: (data: ZhipinData) => Promise<void>) => Promise<void>;
  resetData: () => void;
  setError: (error: string | null) => void;
}

export const useBrandEditorStore = create<BrandEditorState>()(
  devtools(
    (set, get) => ({
      // 初始状态
      originalData: undefined,
      localData: undefined,
      jsonData: "",
      editMode: "overview",
      editingBrand: null,
      editingType: null,
      isLoading: false,
      isSaving: false,
      error: null,
      hasUnsavedChanges: false,

      // 初始化数据
      initializeData: data => {
        set({
          originalData: data,
          localData: structuredClone(data),
          jsonData: JSON.stringify(data, null, 2),
          hasUnsavedChanges: false,
          error: null,
        });
      },

      // 设置编辑模式
      setEditMode: mode => {
        set({ editMode: mode });
      },

      // 设置正在编辑的品牌
      setEditingBrand: brand => {
        set({ editingBrand: brand });
      },

      // 设置编辑类型
      setEditingType: type => {
        set({ editingType: type });
      },

      // 更新品牌话术模板
      updateTemplates: (brandName, templates) => {
        const { localData } = get();
        if (!localData) return null;

        // 深拷贝模板以确保每个品牌有独立的副本
        const clonedTemplates = structuredClone(templates);

        const updatedData = {
          ...localData,
          brands: {
            ...localData.brands,
            [brandName]: {
              ...localData.brands[brandName],
              templates: clonedTemplates,
            },
          },
        };

        set({
          localData: updatedData,
          jsonData: JSON.stringify(updatedData, null, 2),
          hasUnsavedChanges: true,
        });

        // 返回更新后的数据
        return updatedData;
      },

      // 更新排班信息
      updateSchedulingInfo: (
        brandName,
        scheduleType,
        schedulingFlexibility,
        targetType,
        storeIndex,
        positionIndex
      ) => {
        const { localData } = get();
        if (!localData) return null;

        const updatedStores = [...localData.stores];

        if (targetType === "all") {
          // 批量更新该品牌下所有门店的所有岗位
          updatedStores.forEach(store => {
            if (store.brand === brandName) {
              store.positions.forEach(position => {
                position.scheduleType = scheduleType;
                position.schedulingFlexibility = { ...schedulingFlexibility };
              });
            }
          });
        } else if (targetType === "store" && storeIndex !== undefined) {
          // 更新指定门店的所有岗位
          if (positionIndex !== undefined) {
            // 更新指定岗位
            if (updatedStores[storeIndex]?.positions[positionIndex]) {
              updatedStores[storeIndex].positions[positionIndex].scheduleType = scheduleType;
              updatedStores[storeIndex].positions[positionIndex].schedulingFlexibility = {
                ...schedulingFlexibility,
              };
            }
          } else {
            // 更新门店下所有岗位
            if (updatedStores[storeIndex]) {
              updatedStores[storeIndex].positions.forEach(position => {
                position.scheduleType = scheduleType;
                position.schedulingFlexibility = { ...schedulingFlexibility };
              });
            }
          }
        }

        const updatedData = {
          ...localData,
          stores: updatedStores,
        };

        set({
          localData: updatedData,
          jsonData: JSON.stringify(updatedData, null, 2),
          hasUnsavedChanges: true,
        });

        // 返回更新后的数据
        return updatedData;
      },

      // 更新 JSON 数据
      updateJsonData: json => {
        set({ jsonData: json, hasUnsavedChanges: true });

        // 尝试解析并同步到 localData
        try {
          const parsed = JSON.parse(json);
          set({ localData: parsed, error: null });
        } catch {
          // JSON 无效时不同步，但不报错（用户可能正在编辑）
        }
      },

      // 同步 JSON 到本地数据
      syncJsonToLocal: () => {
        const { jsonData } = get();
        try {
          const parsed = JSON.parse(jsonData);
          set({ localData: parsed, error: null });
        } catch {
          set({ error: "JSON 格式错误，请检查语法" });
        }
      },

      // 保存数据
      saveData: async onSave => {
        set({ isSaving: true, error: null });

        try {
          const { editMode, jsonData, localData } = get();
          let dataToSave: ZhipinData;

          if (editMode === "json") {
            // JSON 模式：解析 JSON 数据
            try {
              dataToSave = JSON.parse(jsonData);
            } catch {
              throw new Error("JSON 格式错误，请检查语法");
            }
          } else {
            // 概览模式：使用本地数据
            if (!localData) {
              throw new Error("没有数据可保存");
            }
            dataToSave = localData;
          }

          // 基本验证
          if (!dataToSave.brands || !dataToSave.stores) {
            throw new Error("数据格式不正确，必须包含 brands 和 stores 字段");
          }

          // 调用保存函数
          await onSave(dataToSave);

          // 更新原始数据并清除未保存标记
          set({
            originalData: dataToSave,
            localData: structuredClone(dataToSave),
            jsonData: JSON.stringify(dataToSave, null, 2),
            hasUnsavedChanges: false,
          });

          console.log("✅ 品牌数据保存成功");
        } catch (error) {
          console.error("❌ 品牌数据保存失败:", error);
          set({ error: error instanceof Error ? error.message : "保存失败" });
          throw error;
        } finally {
          set({ isSaving: false });
        }
      },

      // 重置到原始数据
      resetData: () => {
        const { originalData } = get();
        if (!originalData) return;

        set({
          localData: structuredClone(originalData),
          jsonData: JSON.stringify(originalData, null, 2),
          editingBrand: null,
          editingType: null,
          error: null,
          hasUnsavedChanges: false,
        });
      },

      // 设置错误信息
      setError: error => {
        set({ error });
      },
    }),
    {
      name: "brand-editor-store",
    }
  )
);
