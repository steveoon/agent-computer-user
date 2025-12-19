"use client";

import { useEffect, useState } from "react";
import { BarChart3, RefreshCw, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/ui/back-button";
import { useDashboardStatsStore } from "@/lib/stores/dashboard-stats-store";
import { triggerAggregation } from "@/actions/recruitment-stats";
import { DashboardFilters } from "./components/dashboard-filters";
import { KpiCards } from "./components/kpi-cards";
import { OperationalMetrics } from "./components/operational-metrics";
import { TrendChart } from "./components/trend-chart";
import { FunnelChart } from "./components/funnel-chart";
import { StatsTable } from "./components/stats-table";
import { SchedulerStatus } from "./components/scheduler-status";
import { UnrepliedCandidates } from "./components/unreplied-candidates";

/**
 * Dashboard 客户端容器组件
 *
 * 使用 Zustand Store 管理状态，协调各子组件
 */
export function DashboardClient() {
  const { loading, error, refresh } = useDashboardStatsStore();
  const [aggregating, setAggregating] = useState(false);
  const [aggregationMessage, setAggregationMessage] = useState<string | null>(null);

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
    <div className="relative min-h-screen w-full bg-background">
      {/* 纯净背景 */}
      <div className="fixed inset-0 bg-gray-50/50 pointer-events-none" />

      {/* 主内容区域 */}
      <div className="relative z-10 container mx-auto p-6 max-w-7xl">
        {/* 页面头部 */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <BackButton href="/admin/settings" title="返回设置" />

            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <BarChart3 className="h-6 w-6" />
                招聘统计 Dashboard
              </h1>
              <p className="text-sm text-muted-foreground mt-1">查看招聘数据统计和转化漏斗</p>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleAggregation}
              disabled={aggregating || loading}
              className="glass-button"
            >
              <Calculator className={`h-4 w-4 mr-2 ${aggregating ? "animate-pulse" : ""}`} />
              {aggregating ? "聚合中..." : "手动聚合"}
            </Button>
            <Button variant="outline" onClick={refresh} disabled={loading || aggregating} className="glass-button">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              刷新数据
            </Button>
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
            <p className="text-sm font-medium">加载数据失败</p>
            <p className="text-xs mt-1">{error}</p>
          </div>
        )}

        {/* 聚合结果提示 */}
        {aggregationMessage && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              aggregationMessage.includes("失败")
                ? "bg-destructive/10 border border-destructive/20 text-destructive"
                : "bg-green-50 border border-green-200 text-green-700"
            }`}
          >
            <p className="text-sm">{aggregationMessage}</p>
          </div>
        )}

        {/* 筛选器 */}
        <div className="mb-6">
          <DashboardFilters />
        </div>

        {/* KPI 卡片 - 核心漏斗指标 */}
        <div className="mb-6">
          <KpiCards />
        </div>

        {/* 待回复候选人（仅在有未回复时显示） */}
        <div className="mb-6">
          <UnrepliedCandidates />
        </div>

        {/* 运营效率指标 */}
        <div className="mb-6">
          <OperationalMetrics />
        </div>

        {/* 趋势图与漏斗图 (并排) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
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
        <StatsTable />
      </div>
    </div>
  );
}
