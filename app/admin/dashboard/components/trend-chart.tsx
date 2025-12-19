"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart } from "@tremor/react";
import { TrendingUp } from "lucide-react";
import { useDashboardStatsStore } from "@/lib/stores/dashboard-stats-store";

/**
 * 颜色映射：指标名称 -> CSS 颜色值
 */
const COLOR_MAP: Record<string, string> = {
  入站候选人: "#3b82f6", // blue-500
  被回复: "#10b981",     // emerald-500
  微信获取: "#8b5cf6",   // violet-500
};

/**
 * 趋势图组件
 *
 * 使用 Tremor AreaChart 展示日粒度趋势数据
 */
export function TrendChart() {
  const { dailyTrend, loading } = useDashboardStatsStore();

  // 转换数据格式以适配 Tremor
  const chartData =
    dailyTrend?.map(item => ({
      date: item.date.slice(5), // 只显示 MM-DD
      入站候选人: item.inboundCandidates,
      被回复: item.candidatesReplied,
      微信获取: item.wechatExchanged,
    })) ?? [];

  return (
    <Card className="border-0 shadow-sm bg-white overflow-hidden h-full flex flex-col">
      <CardHeader className="border-b bg-gray-50/50 pb-3 pt-4 flex-none">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-foreground/70">
            <TrendingUp className="h-4 w-4 text-blue-500/70" />
            数据趋势
          </CardTitle>

          {/* 自定义图例 */}
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              <span className="text-xs text-muted-foreground/70">入站候选人</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-xs text-muted-foreground/70">被回复</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-violet-500" />
              <span className="text-xs text-muted-foreground/70">微信获取</span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 pt-4 pb-2 min-h-[320px]">
        {loading ? (
          <div className="h-full bg-muted/30 rounded animate-pulse" />
        ) : chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground/50 text-sm">
            暂无数据
          </div>
        ) : (
          <div className="h-full w-full tremor-chart-colors">
            <AreaChart
              className="h-full w-full"
              data={chartData}
            index="date"
            categories={["入站候选人", "被回复", "微信获取"]}
            colors={["blue", "emerald", "violet"]}
            valueFormatter={value => String(value)}
            showLegend={false}
            showGridLines={false}
            showAnimation={true}
            curveType="monotone"
            showYAxis={true}
            yAxisWidth={32}
            autoMinValue={true}
            customTooltip={props => {
              if (!props.active || !props.payload) return null;
              return (
                <div className="rounded-lg border border-gray-100 bg-white shadow-lg p-3 min-w-[140px]">
                  <p className="text-xs font-medium text-gray-500 mb-2 pb-2 border-b border-gray-100">
                    {props.label}
                  </p>
                  <div className="space-y-1.5">
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
                          <span className="text-xs text-gray-500">{item.name}</span>
                        </div>
                        <span className="text-xs font-semibold text-gray-700 tabular-nums">
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
      </CardContent>
    </Card>
  );
}
