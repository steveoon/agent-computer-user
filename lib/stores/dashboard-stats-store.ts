import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { getDashboardData } from "@/actions/recruitment-stats";
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
 * 初始筛选参数（默认最近 7 天）
 */
const initialFilters: DashboardFilters = {
  startDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0],
  endDate: new Date().toISOString().split("T")[0],
  preset: "last7days",
};

/**
 * Dashboard Store 状态接口
 */
interface DashboardStatsState {
  // 数据状态
  summary: DashboardSummary | null;
  dailyTrend: DailyTrendItem[] | null;
  loading: boolean;
  error: string | null;

  // 筛选参数
  filters: DashboardFilters;

  // Actions
  setFilters: (filters: Partial<DashboardFilters>) => void;
  setPreset: (preset: DashboardFilters["preset"]) => void;
  loadDashboardData: () => Promise<void>;
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
      error: null,
      filters: initialFilters,

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
       * 设置预设时间范围
       * 快捷方法，设置后自动计算日期并加载数据
       */
      setPreset: (preset) => {
        const now = new Date();
        let startDate: string;
        let endDate: string = now.toISOString().split("T")[0];

        switch (preset) {
          case "today":
            startDate = endDate;
            break;
          case "yesterday": {
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            startDate = yesterday.toISOString().split("T")[0];
            endDate = startDate;
            break;
          }
          case "last7days": {
            const start = new Date(now);
            start.setDate(start.getDate() - 6);
            startDate = start.toISOString().split("T")[0];
            break;
          }
          case "last14days": {
            const start = new Date(now);
            start.setDate(start.getDate() - 13);
            startDate = start.toISOString().split("T")[0];
            break;
          }
          case "last30days": {
            const start = new Date(now);
            start.setDate(start.getDate() - 29);
            startDate = start.toISOString().split("T")[0];
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
       */
      loadDashboardData: async () => {
        const { filters } = get();
        set({ loading: true, error: null });

        try {
          const result = await getDashboardData(filters);

          if (result.success) {
            set({
              summary: result.data.summary,
              dailyTrend: result.data.dailyTrend,
              loading: false,
            });
          } else {
            set({
              error: result.error,
              loading: false,
            });
          }
        } catch (error) {
          console.error("[DashboardStatsStore] loadDashboardData failed:", error);
          set({
            error: error instanceof Error ? error.message : "加载失败",
            loading: false,
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
          error: null,
          filters: initialFilters,
        });
      },
    }),
    { name: "dashboard-stats-store" }
  )
);
