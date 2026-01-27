import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { getDashboardData, getFilterOptions } from "@/actions/recruitment-stats";
import { toBeijingDateString } from "@/lib/utils/beijing-timezone";
import type { AgentOption, BrandOption, JobOption } from "@/actions/recruitment-stats";
import type {
  DashboardFilters,
  DashboardSummary,
  DailyTrendItem,
} from "@/lib/services/recruitment-stats/types";

/**
 * Dashboard 统计数据 Store
 *
 * 使用 Zustand 管理 Dashboard 跨组件共享状态
 * 参考: lib/stores/brand-management-store.ts
 */

/**
 * 初始筛选参数（默认最近 7 天，使用北京时间）
 */
const initialFilters: DashboardFilters = {
  startDate: toBeijingDateString(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)),
  endDate: toBeijingDateString(new Date()),
  preset: "last7days",
};

/**
 * Dashboard Store 状态接口
 */
interface DashboardStatsState {
  // 数据状态
  summary: DashboardSummary | null;
  dailyTrend: DailyTrendItem[] | null;
  /** 初次加载状态（显示 skeleton） */
  loading: boolean;
  /** 静默刷新状态（不显示 skeleton，数据更新后数字动画过渡） */
  isRefreshing: boolean;
  error: string | null;

  // 筛选参数
  filters: DashboardFilters;

  // 筛选选项（Agent、Brand 和 Job 列表）
  availableAgents: AgentOption[];
  availableBrands: BrandOption[];
  availableJobs: JobOption[];
  filterOptionsLoading: boolean;

  // Actions
  setFilters: (filters: Partial<DashboardFilters>) => void;
  setPreset: (preset: DashboardFilters["preset"]) => void;
  setCustomDateRange: (startDate: string, endDate: string) => void;
  setAgentFilter: (agentId?: string) => void;
  setBrandFilter: (brandId?: number) => void;
  setJobFilter: (jobNames?: string[]) => void;
  clearDimensionFilters: () => void;
  loadFilterOptions: () => Promise<void>;
  loadDashboardData: (silent?: boolean) => Promise<void>;
  refresh: () => Promise<void>;
  reset: () => void;
}

/**
 * Dashboard 统计数据 Store
 */
export const useDashboardStatsStore = create<DashboardStatsState>()(
  devtools(
    (set, get) => ({
      // 初始状态
      summary: null,
      dailyTrend: null,
      loading: false,
      isRefreshing: false,
      error: null,
      filters: initialFilters,

      // 筛选选项初始状态
      availableAgents: [],
      availableBrands: [],
      availableJobs: [],
      filterOptionsLoading: false,

      /**
       * 设置筛选参数
       * 设置后自动重新加载数据
       */
      setFilters: (newFilters) => {
        set((state) => ({
          filters: { ...state.filters, ...newFilters },
        }));
        // 自动重新加载数据
        get().loadDashboardData();
      },

      /**
       * 设置 Agent 筛选
       * undefined 表示"全部"
       */
      setAgentFilter: (agentId) => {
        set((state) => ({
          filters: { ...state.filters, agentId },
        }));
        get().loadDashboardData();
      },

      /**
       * 设置 Brand 筛选
       * undefined 表示"全部"
       */
      setBrandFilter: (brandId) => {
        set((state) => ({
          filters: { ...state.filters, brandId },
        }));
        get().loadDashboardData();
      },

      /**
       * 设置 Job 筛选（多选）
       * undefined 或空数组表示"全部"
       */
      setJobFilter: (jobNames) => {
        set((state) => ({
          filters: {
            ...state.filters,
            jobNames: jobNames && jobNames.length > 0 ? jobNames : undefined,
          },
        }));
        get().loadDashboardData();
      },

      /**
       * 清除维度筛选（Agent + Brand + Job）
       * 保留时间范围筛选
       */
      clearDimensionFilters: () => {
        set((state) => ({
          filters: {
            ...state.filters,
            agentId: undefined,
            brandId: undefined,
            jobNames: undefined,
          },
        }));
        get().loadDashboardData();
      },

      /**
       * 加载筛选选项（Agent、Brand 和 Job 列表）
       */
      loadFilterOptions: async () => {
        set({ filterOptionsLoading: true });

        try {
          const result = await getFilterOptions();

          if (result.success) {
            set({
              availableAgents: result.data.agents,
              availableBrands: result.data.brands,
              availableJobs: result.data.jobs,
              filterOptionsLoading: false,
            });
          } else {
            console.error("[DashboardStatsStore] loadFilterOptions failed:", result.error);
            set({ filterOptionsLoading: false });
          }
        } catch (error) {
          console.error("[DashboardStatsStore] loadFilterOptions failed:", error);
          set({ filterOptionsLoading: false });
        }
      },

      /**
       * 设置自定义日期范围
       * 设置后 preset 变为 undefined
       */
      setCustomDateRange: (startDate: string, endDate: string) => {
        set({
          filters: {
            ...get().filters,
            preset: undefined,
            startDate,
            endDate,
          },
        });
        get().loadDashboardData();
      },

      /**
       * 设置预设时间范围
       * 快捷方法，设置后自动计算日期并加载数据
       */
      setPreset: (preset) => {
        const now = new Date();
        let startDate: string;
        let endDate: string = toBeijingDateString(now);

        switch (preset) {
          case "today":
            startDate = endDate;
            break;
          case "yesterday": {
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            startDate = toBeijingDateString(yesterday);
            endDate = startDate;
            break;
          }
          case "last7days": {
            const start = new Date(now);
            start.setDate(start.getDate() - 6);
            startDate = toBeijingDateString(start);
            break;
          }
          case "last14days": {
            const start = new Date(now);
            start.setDate(start.getDate() - 13);
            startDate = toBeijingDateString(start);
            break;
          }
          case "last30days": {
            const start = new Date(now);
            start.setDate(start.getDate() - 29);
            startDate = toBeijingDateString(start);
            break;
          }
          default:
            return;
        }

        set({
          filters: {
            ...get().filters,
            preset,
            startDate,
            endDate,
          },
        });
        get().loadDashboardData();
      },

      /**
       * 加载 Dashboard 数据
       * @param silent - 是否静默刷新（不显示 loading skeleton）
       */
      loadDashboardData: async (silent = false) => {
        const { filters, summary } = get();

        // 如果已有数据，使用静默刷新；否则显示 loading skeleton
        const isSilent = silent || summary !== null;

        if (isSilent) {
          set({ isRefreshing: true, error: null });
        } else {
          set({ loading: true, error: null });
        }

        try {
          const result = await getDashboardData(filters);

          if (result.success) {
            set({
              summary: result.data.summary,
              dailyTrend: result.data.dailyTrend,
              loading: false,
              isRefreshing: false,
            });
          } else {
            set({
              error: result.error,
              loading: false,
              isRefreshing: false,
            });
          }
        } catch (error) {
          console.error("[DashboardStatsStore] loadDashboardData failed:", error);
          set({
            error: error instanceof Error ? error.message : "加载失败",
            loading: false,
            isRefreshing: false,
          });
        }
      },

      /**
       * 刷新数据（使用当前筛选参数）
       */
      refresh: async () => {
        await get().loadDashboardData();
      },

      /**
       * 重置状态
       */
      reset: () => {
        set({
          summary: null,
          dailyTrend: null,
          loading: false,
          isRefreshing: false,
          error: null,
          filters: initialFilters,
          availableAgents: [],
          availableBrands: [],
          availableJobs: [],
          filterOptionsLoading: false,
        });
      },
    }),
    { name: "dashboard-stats-store" }
  )
);
