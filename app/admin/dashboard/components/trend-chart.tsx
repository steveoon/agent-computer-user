"use client";

import { AreaChart } from "@tremor/react";
import { TrendingUp } from "lucide-react";
import { useDashboardStatsStore } from "@/lib/stores/dashboard-stats-store";

/**
 * 颜色映射：指标名称 -> CSS 颜色值
 */
const COLOR_MAP: Record<string, string> = {
  入站候选人: "#FBBF24", // Amber
  被回复: "#22D3EE",     // Cyan
  微信获取: "#A3E635",   // Lime
};

/**
 * 日期格式化器（使用 Intl.DateTimeFormat）
 */
const chartDateFormatter = new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" });

/**
 * 趋势图组件 - 深色科技风版本
 *
 * 特点：
 * - 深色背景 + 渐变描边线图
 * - 深色毛玻璃 Tooltip
 * - 自定义图例样式
 */
export function TrendChart() {
  const { dailyTrend, loading } = useDashboardStatsStore();

  // 转换数据格式以适配 Tremor（使用 Intl.DateTimeFormat）
  const chartData =
    dailyTrend?.map(item => ({
      date: chartDateFormatter.format(new Date(item.date)),
      入站候选人: item.inboundCandidates,
      被回复: item.candidatesReplied,
      微信获取: item.wechatExchanged,
    })) ?? [];

  return (
    <div className="dash-card overflow-hidden h-full flex flex-col">
      {/* 头部 */}
      <div className="border-b border-[var(--dash-border)] px-4 py-3 flex-none">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium flex items-center gap-2 text-[var(--dash-text-secondary)]">
            <TrendingUp className="h-4 w-4 text-dash-amber" />
            数据趋势
          </h3>

          {/* 自定义图例 */}
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-dash-amber" />
              <span className="text-xs text-[var(--dash-text-muted)]">入站候选人</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-dash-cyan" />
              <span className="text-xs text-[var(--dash-text-muted)]">被回复</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-dash-lime" />
              <span className="text-xs text-[var(--dash-text-muted)]">微信获取</span>
            </div>
          </div>
        </div>
      </div>

      {/* 内容 */}
      <div className="flex-1 p-4 min-h-[320px]">
        {loading ? (
          <div className="h-full bg-[var(--dash-surface-2)] rounded animate-pulse" />
        ) : chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[var(--dash-text-muted)] text-sm">
            暂无数据
          </div>
        ) : (
          <div className="h-full w-full pl-2 [&_.recharts-cartesian-grid-horizontal_line]:stroke-[var(--dash-border)] [&_.recharts-cartesian-grid-vertical_line]:stroke-[var(--dash-border)] [&_.recharts-cartesian-axis-tick-value]:fill-[var(--dash-text-muted)] [&_.recharts-cartesian-axis-line]:stroke-[var(--dash-border)]">
            <AreaChart
              className="h-full w-full"
              data={chartData}
              index="date"
              categories={["入站候选人", "被回复", "微信获取"]}
              colors={["amber", "cyan", "lime"]}
              valueFormatter={value => String(value)}
              showLegend={false}
              showGridLines={true}
              showAnimation={true}
              curveType="monotone"
              showYAxis={true}
              yAxisWidth={42}
              autoMinValue={true}
              customTooltip={props => {
                if (!props.active || !props.payload) return null;
                return (
                  <div className="dash-glass rounded-lg p-3 min-w-[160px] shadow-xl">
                    <p className="text-xs font-medium text-[var(--dash-text-secondary)] mb-2 pb-2 border-b border-[var(--dash-border)]">
                      {props.label}
                    </p>
                    <div className="space-y-2">
                      {props.payload.map((item, index) => (
                        <div
                          key={String(item.name ?? index)}
                          className="flex items-center justify-between gap-4"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: COLOR_MAP[String(item.name)] ?? item.color }}
                            />
                            <span className="text-xs text-[var(--dash-text-muted)]">{item.name}</span>
                          </div>
                          <span
                            className="text-xs font-bold dash-number"
                            style={{ color: COLOR_MAP[String(item.name)] ?? item.color }}
                          >
                            {item.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
