import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { getBrands, getAvailableBrands } from "@/actions/brand-mapping";
import type { DataDictionary, SourceSystemValue } from "@/db/types";

/**
 * 品牌查询参数接口
 */
export interface BrandQueryParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  sourceSystem?: SourceSystemValue;
  isActive?: boolean;
  sortBy?: 'createdAt' | 'updatedAt' | 'displayOrder';
  sortOrder?: 'asc' | 'desc';
}

/**
 * 品牌列表响应数据
 */
export interface BrandListData {
  items: DataDictionary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * 品牌管理状态接口
 */
interface BrandManagementState {
  // 数据状态
  brands: BrandListData | null;
  loading: boolean;
  error: string | null;

  // 简化的品牌列表（用于下拉框、列表展示等）
  availableBrands: Array<{ id: string; name: string }>;
  availableBrandsLoading: boolean;

  // 查询参数
  params: BrandQueryParams;

  // Actions
  setParams: (params: BrandQueryParams | ((prev: BrandQueryParams) => BrandQueryParams)) => void;
  loadBrands: () => Promise<void>;
  refreshBrands: () => Promise<void>;
  loadAvailableBrands: () => Promise<void>;
  setError: (error: string | null) => void;
  reset: () => void;
}

/**
 * 初始查询参数
 */
const initialParams: BrandQueryParams = {
  page: 1,
  pageSize: 10,
  isActive: true,
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

/**
 * 品牌管理 Store
 */
export const useBrandManagementStore = create<BrandManagementState>()(
  devtools(
    (set, get) => ({
      // 初始状态
      brands: null,
      loading: false,
      error: null,
      availableBrands: [],
      availableBrandsLoading: false,
      params: initialParams,

      // 设置查询参数
      setParams: (params) => {
        set((state) => ({
          params: typeof params === 'function' ? params(state.params) : params
        }));
      },

      // 加载品牌列表
      loadBrands: async () => {
        const { params } = get();
        set({ loading: true, error: null });

        try {
          const result = await getBrands(params);

          if (result.success && result.data) {
            set({ brands: result.data, loading: false });
          } else {
            set({
              error: result.error || "加载失败",
              loading: false,
            });
          }
        } catch (error) {
          console.error("加载品牌列表失败:", error);
          set({
            error: error instanceof Error ? error.message : "未知错误",
            loading: false,
          });
        }
      },

      // 刷新品牌列表（使用当前参数）
      refreshBrands: async () => {
        await get().loadBrands();
      },

      // 加载简化的品牌列表（用于下拉框等场景）
      loadAvailableBrands: async () => {
        set({ availableBrandsLoading: true });

        try {
          const brands = await getAvailableBrands();
          set({ availableBrands: brands, availableBrandsLoading: false });
        } catch (error) {
          console.error("加载品牌列表失败:", error);
          set({ availableBrands: [], availableBrandsLoading: false });
        }
      },

      // 设置错误信息
      setError: (error) => {
        set({ error });
      },

      // 重置状态
      reset: () => {
        set({
          brands: null,
          loading: false,
          error: null,
          availableBrands: [],
          availableBrandsLoading: false,
          params: initialParams,
        });
      },
    }),
    { name: "brand-management-store" }
  )
);
