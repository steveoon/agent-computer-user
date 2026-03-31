"use client";

import { createContext, useContext, useState, type ReactNode, useEffect } from "react";
import { useConfigManager } from "@/hooks/useConfigManager";
import { saveBrandPreference, loadBrandPreference } from "../utils/brand-storage";
import type { ZhipinData } from "@/types";

// 🔧 品牌上下文类型定义
interface BrandContextType {
  currentBrand: string;
  setCurrentBrand: (brand: string) => void;
  availableBrands: readonly string[];
  brandData: ZhipinData | null;
  isLoaded: boolean;
  isConfigLoaded: boolean;
}

// 🎨 创建上下文
const BrandContext = createContext<BrandContextType | undefined>(undefined);

// 🏗️ 品牌提供者组件
interface BrandProviderProps {
  children: ReactNode;
}

export function BrandProvider({ children }: BrandProviderProps) {
  const { config, loading: configLoading } = useConfigManager();
  const [currentBrand, setCurrentBrand] = useState<string>("");
  const [isLoaded, setIsLoaded] = useState(false);

  // 🔄 从 configStore 获取品牌数据
  const brandData = config?.brandData || null;
  const isConfigLoaded = !configLoading && config !== null;

  // 🔄 当配置数据更新时，同步更新当前品牌
  useEffect(() => {
    if (!brandData) return;

    // 如果当前品牌不存在或为空，设置默认品牌
    if (!currentBrand || !brandData.brands[currentBrand]) {
      const defaultBrand = brandData.defaultBrand || Object.keys(brandData.brands)[0] || "";
      setCurrentBrand(defaultBrand);

      console.log("✅ 品牌上下文：配置数据已更新", {
        brands: Object.keys(brandData.brands),
        defaultBrand,
        stores: brandData.stores.length,
      });
    }
  }, [brandData, currentBrand]);

  // 🔄 从本地存储读取品牌选择（在配置数据加载后）
  useEffect(() => {
    if (!isConfigLoaded || !brandData) return;

    const loadSavedBrand = async () => {
      try {
        const savedBrand = await loadBrandPreference();

        // 验证保存的品牌是否在可用品牌列表中
        if (savedBrand && brandData.brands[savedBrand]) {
          setCurrentBrand(savedBrand);
          console.log("✅ 品牌上下文：已恢复保存的品牌选择:", savedBrand);
        }
      } catch (error) {
        console.warn("品牌上下文：读取保存的品牌选择失败:", error);
      } finally {
        setIsLoaded(true);
      }
    };

    loadSavedBrand();
  }, [isConfigLoaded, brandData]);

  // 📋 获取可用品牌列表（仅来自已导入的配置数据）
  const availableBrands = brandData ? Object.keys(brandData.brands).sort() : [];

  // 💾 品牌切换时保存到本地存储
  const handleSetCurrentBrand = async (brand: string) => {
    // 验证品牌是否存在
    if (!brandData || !brandData.brands[brand]) {
      console.warn("品牌上下文：尝试设置不存在的品牌:", brand);
      return;
    }

    setCurrentBrand(brand);
    try {
      await saveBrandPreference(brand, availableBrands);
      console.log("✅ 品牌上下文：品牌选择已保存:", brand);
    } catch (error) {
      console.warn("品牌上下文：保存品牌选择失败:", error);
    }
  };

  const value: BrandContextType = {
    currentBrand,
    setCurrentBrand: handleSetCurrentBrand,
    availableBrands,
    brandData,
    isLoaded,
    isConfigLoaded,
  };

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

// 🎯 Hook：使用品牌上下文
export function useBrand() {
  const context = useContext(BrandContext);
  if (context === undefined) {
    throw new Error("useBrand must be used within a BrandProvider");
  }
  return context;
}

// 🔧 Hook：获取当前品牌的数据
export function useCurrentBrandData() {
  const { currentBrand, brandData } = useBrand();

  if (!brandData) {
    return {
      brandName: currentBrand,
      brandData: null,
      storesForBrand: [],
    };
  }

  return {
    brandName: currentBrand,
    brandData: brandData.brands[currentBrand] || null,
    storesForBrand: brandData.stores.filter(store => store.brand === currentBrand),
  };
}

// 🎯 动态导出可用品牌列表（向后兼容）
export function getAvailableBrands(): string[] {
  // 这个函数现在只是一个占位符，实际的品牌列表通过 useBrand Hook 获取
  console.warn("getAvailableBrands 已废弃，请使用 useBrand Hook 的 availableBrands 属性");
  return [];
}
