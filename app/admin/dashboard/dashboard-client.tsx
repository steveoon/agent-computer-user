"use client";

import { useEffect, useState, useCallback } from "react";
import { BarChart3, RefreshCw, Calculator, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/ui/back-button";
import { useDashboardStatsStore } from "@/lib/stores/dashboard-stats-store";
import { triggerAggregation } from "@/actions/recruitment-stats";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { DashboardFilters } from "./components/dashboard-filters";
import { KpiCards } from "./components/kpi-cards";
import { OperationalMetrics } from "./components/operational-metrics";
import { TrendChart } from "./components/trend-chart";
import { FunnelChart } from "./components/funnel-chart";
import { StatsTable } from "./components/stats-table";
import { SchedulerStatus } from "./components/scheduler-status";
import { UnrepliedCandidates } from "./components/unreplied-candidates";

/** 自动刷新间隔：30 秒 */
const AUTO_REFRESH_INTERVAL = 30 * 1000;

/**
 * Dashboard 客户端容器组件
 *
 * 使用 Zustand Store 管理状态，协调各子组件
 * 支持自动刷新和数字动画效果
 * 深色科技风主题设计
 */
export function DashboardClient() {
  const { loading, isRefreshing, error, refresh } = useDashboardStatsStore();
  const [aggregating, setAggregating] = useState(false);
  const [aggregationMessage, setAggregationMessage] = useState<string | null>(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [mounted, setMounted] = useState(false);

  // 入场动画状态
  useEffect(() => {
    setMounted(true);
  }, []);

  // 刷新数据的回调（使用静默刷新）
  const handleRefresh = useCallback(async () => {
    await useDashboardStatsStore.getState().loadDashboardData(true);
  }, []);

  // 自动刷新 Hook
  const { countdown, isPaused } = useAutoRefresh(handleRefresh, {
    interval: AUTO_REFRESH_INTERVAL,
    enabled: autoRefreshEnabled,
    pauseOnHidden: true,
  });

  // 初始化时加载数据
  useEffect(() => {
    useDashboardStatsStore.getState().loadDashboardData();
  }, []);

  // 手动触发聚合
  const handleAggregation = async () => {
    setAggregating(true);
    setAggregationMessage(null);
    try {
      const result = await triggerAggregation();
      if (result.success) {
        const { processedCount, failedCount, duration } = result.data;
        setAggregationMessage(
          `聚合完成: ${processedCount} 条成功${failedCount > 0 ? `, ${failedCount} 条失败` : ""}, 耗时 ${duration}ms`
        );
        // 聚合后刷新数据
        refresh();
      } else {
        setAggregationMessage(`聚合失败: ${result.error}`);
      }
    } catch (err) {
      setAggregationMessage(`聚合失败: ${err instanceof Error ? err.message : "未知错误"}`);
    } finally {
      setAggregating(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full dash-bg overflow-hidden">
      {/* 网格叠加层 */}
      <div className="dash-grid-overlay" />

      {/* 主内容区域 */}
      <div className="relative z-10 container mx-auto p-6 max-w-7xl">
        {/* 页面头部 */}
        <div
          className={`flex items-center justify-between mb-8 transition-all duration-500 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
          }`}
        >
          <div className="flex items-center gap-4">
            <BackButton href="/admin/settings" title="返回设置" className="text-[var(--dash-text-secondary)] hover:text-[var(--dash-text-primary)]" />

            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-[var(--dash-text-primary)]">
                <BarChart3 className="h-6 w-6 text-dash-amber" />
                招聘统计 Dashboard
              </h1>
              <p className="text-sm text-[var(--dash-text-muted)] mt-1">实时数据监控与转化分析</p>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-3">
            {/* 自动刷新状态指示器 */}
            <div className="flex items-center gap-2 text-sm text-[var(--dash-text-secondary)]">
              {isPaused ? (
                <span className="flex items-center gap-1.5 text-dash-amber">
                  <Pause className="h-3.5 w-3.5" />
                  已暂停
                </span>
              ) : isRefreshing || loading ? (
                <span className="flex items-center gap-1.5 text-dash-cyan">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  刷新中...
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Play className="h-3.5 w-3.5 text-dash-lime" />
                  <span className="tabular-nums dash-number">{countdown}s</span>
                </span>
              )}
              <button
                onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
                aria-label={autoRefreshEnabled ? "切换为手动刷新模式" : "切换为自动刷新模式"}
                aria-pressed={autoRefreshEnabled}
                className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                  autoRefreshEnabled
                    ? "bg-dash-lime/20 text-dash-lime"
                    : "bg-[var(--dash-surface-2)] text-[var(--dash-text-muted)]"
                }`}
              >
                {autoRefreshEnabled ? "自动" : "手动"}
              </button>
            </div>

            <div className="h-6 w-px bg-[var(--dash-border)]" />

            <Button
              variant="outline"
              onClick={handleAggregation}
              disabled={aggregating || loading}
              className="bg-[var(--dash-surface-1)] border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:bg-[var(--dash-surface-2)] hover:text-[var(--dash-text-primary)] hover:border-[var(--dash-border-glow)]"
            >
              <Calculator className={`h-4 w-4 mr-2 ${aggregating ? "animate-pulse text-dash-amber" : ""}`} />
              {aggregating ? "聚合中..." : "手动聚合"}
            </Button>
            <Button
              variant="outline"
              onClick={refresh}
              disabled={loading || aggregating}
              className="bg-[var(--dash-surface-1)] border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:bg-[var(--dash-surface-2)] hover:text-[var(--dash-text-primary)] hover:border-[var(--dash-border-glow)]"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin text-dash-cyan" : ""}`} />
              刷新数据
            </Button>
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mb-6 p-4 bg-dash-rose/10 border border-dash-rose/30 rounded-lg text-dash-rose">
            <p className="text-sm font-medium">加载数据失败</p>
            <p className="text-xs mt-1 opacity-80">{error}</p>
          </div>
        )}

        {/* 聚合结果提示 */}
        {aggregationMessage && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              aggregationMessage.includes("失败")
                ? "bg-dash-rose/10 border border-dash-rose/30 text-dash-rose"
                : "bg-dash-lime/10 border border-dash-lime/30 text-dash-lime"
            }`}
          >
            <p className="text-sm">{aggregationMessage}</p>
          </div>
        )}

        {/* 筛选器 */}
        <div
          className={`mb-8 transition-all duration-500 delay-100 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <DashboardFilters />
        </div>

        {/* KPI 卡片 - 核心漏斗指标 */}
        <div
          className={`mb-8 transition-all duration-500 delay-200 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <KpiCards />
        </div>

        {/* 待回复候选人（仅在有未回复时显示） */}
        <div
          className={`mb-8 transition-all duration-500 delay-300 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <UnrepliedCandidates />
        </div>

        {/* 运营效率指标 */}
        <div
          className={`mb-8 transition-all duration-500 delay-300 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <OperationalMetrics />
        </div>

        {/* 趋势图与漏斗图 (并排) */}
        <div
          className={`grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 transition-all duration-500 delay-400 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          {/* 趋势图 (占 2/3) */}
          <div className="lg:col-span-2">
            <TrendChart />
          </div>

          {/* 转化漏斗 + 调度器状态 (占 1/3) */}
          <div className="flex flex-col gap-6">
            <FunnelChart />
            <SchedulerStatus />
          </div>
        </div>

        {/* 数据明细表 */}
        <div
          className={`transition-all duration-500 delay-500 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <StatsTable />
        </div>
      </div>
    </div>
  );
}
