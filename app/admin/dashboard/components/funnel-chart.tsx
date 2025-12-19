"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Filter } from "lucide-react";
import { useDashboardStatsStore } from "@/lib/stores/dashboard-stats-store";

/**
 * 汇总统计数据数组
 */
function sumStats(
  stats:
    | Array<{
        inboundCandidates: number;
        candidatesReplied: number;
        wechatExchanged: number;
        interviewsBooked: number;
      }>
    | undefined
) {
  if (!stats || stats.length === 0) return null;

  return stats.reduce(
    (acc, s) => ({
      inboundCandidates: acc.inboundCandidates + s.inboundCandidates,
      candidatesReplied: acc.candidatesReplied + s.candidatesReplied,
      wechatExchanged: acc.wechatExchanged + s.wechatExchanged,
      interviewsBooked: acc.interviewsBooked + s.interviewsBooked,
    }),
    {
      inboundCandidates: 0,
      candidatesReplied: 0,
      wechatExchanged: 0,
      interviewsBooked: 0,
    }
  );
}

/**
 * 计算百分比宽度
 */
function getBarWidth(value: number, max: number): number {
  if (max === 0) return 0;
  return Math.max((value / max) * 100, value > 0 ? 8 : 0); // 最小 8% 宽度确保可见
}

/**
 * 转化漏斗组件
 *
 * 自定义漏斗条形图，统一配色
 */
export function FunnelChart() {
  const { summary, loading } = useDashboardStatsStore();

  const currentStats = sumStats(summary?.current);

  const inbound = currentStats?.inboundCandidates ?? 0;
  const replied = currentStats?.candidatesReplied ?? 0;
  const wechat = currentStats?.wechatExchanged ?? 0;
  const interview = currentStats?.interviewsBooked ?? 0;

  const hasData = inbound > 0;
  const maxValue = inbound;

  // 漏斗数据配置
  const funnelItems = [
    { label: "入站候选人", value: inbound, color: "bg-blue-500" },
    { label: "被回复候选人", value: replied, color: "bg-blue-400" },
    { label: "微信获取", value: wechat, color: "bg-blue-300" },
    { label: "面试预约", value: interview, color: "bg-blue-200" },
  ];

  // 转化率数据
  const conversionRates = [
    { label: "回复率", value: inbound > 0 ? Math.round((replied / inbound) * 100) : null },
    { label: "微信获取率", value: inbound > 0 ? Math.round((wechat / inbound) * 100) : null },
    { label: "面试预约率", value: inbound > 0 ? Math.round((interview / inbound) * 100) : null },
  ];

  return (
    <Card className="border-0 shadow-sm bg-white overflow-hidden h-full flex flex-col">
      <CardHeader className="border-b bg-gray-50/50 pb-3 pt-4 flex-none">
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-foreground/70">
          <Filter className="h-4 w-4 text-blue-500/70" />
          转化漏斗
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col pt-5 pb-4">
        {loading ? (
          <div className="space-y-4 flex-1">
            {[100, 70, 40, 20].map((width, i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-3 w-20 bg-muted/40 rounded animate-pulse" />
                <div
                  className="h-7 bg-muted/40 rounded animate-pulse"
                  style={{ width: `${width}%` }}
                />
              </div>
            ))}
          </div>
        ) : !hasData ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground/50 text-sm">
            暂无数据
          </div>
        ) : (
          <>
            {/* 漏斗条形图 */}
            <div className="flex-1 space-y-3">
              {funnelItems.map(item => (
                <div key={item.label} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{item.label}</span>
                    <span className="text-xs font-semibold text-gray-700 tabular-nums">
                      {item.value}
                    </span>
                  </div>
                  <div className="h-6 w-full bg-gray-100 rounded overflow-hidden">
                    <div
                      className={`h-full ${item.color} rounded transition-all duration-500`}
                      style={{ width: `${getBarWidth(item.value, maxValue)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* 转化率统计 */}
            <div className="mt-5 pt-4 border-t border-gray-100">
              <div className="grid grid-cols-3 gap-3">
                {conversionRates.map(rate => (
                  <div key={rate.label} className="text-center">
                    <p className="text-lg font-semibold text-gray-800 tabular-nums">
                      {rate.value !== null ? `${rate.value}%` : "—"}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">
                      {rate.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
