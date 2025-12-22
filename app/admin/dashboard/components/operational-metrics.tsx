"use client";

import { Card, CardContent } from "@/components/ui/card";
import { MessageCircleReply, Send, ArrowRightLeft, AlertCircle } from "lucide-react";
import { useDashboardStatsStore } from "@/lib/stores/dashboard-stats-store";
import { AnimatedNumber } from "@/components/ui/animated-number";

/**
 * 汇总统计数据数组
 */
function sumStats(
  stats:
    | Array<{
        unreadReplied: number;
        proactiveOutreach: number;
        proactiveResponded: number;
      }>
    | undefined
) {
  if (!stats || stats.length === 0) return null;

  const totals = stats.reduce(
    (acc, s) => ({
      unreadReplied: acc.unreadReplied + s.unreadReplied,
      proactiveOutreach: acc.proactiveOutreach + s.proactiveOutreach,
      proactiveResponded: acc.proactiveResponded + s.proactiveResponded,
    }),
    {
      unreadReplied: 0,
      proactiveOutreach: 0,
      proactiveResponded: 0,
    }
  );

  // 计算主动触达回复率（百分比 * 100）
  const proactiveResponseRate =
    totals.proactiveOutreach > 0
      ? Math.round((totals.proactiveResponded / totals.proactiveOutreach) * 10000)
      : null;

  return { ...totals, proactiveResponseRate };
}

/**
 * 运营效率指标组件
 *
 * 展示第二行运营效率相关的 KPI 指标
 */
export function OperationalMetrics() {
  const { summary, loading } = useDashboardStatsStore();

  // 汇总当前周期的所有数据
  const currentStats = sumStats(summary?.current);

  // 计算主动触达回复率（百分比形式，如 10.5）
  const proactiveResponseRatePercent =
    currentStats?.proactiveResponseRate != null
      ? currentStats.proactiveResponseRate / 100
      : 0;

  // 运营效率指标配置 - 名称对齐 docs/OPERATIONAL_METRICS_GUIDE.md
  const metrics = [
    {
      title: "未读秒回覆盖量",
      icon: MessageCircleReply,
      value: currentStats?.unreadReplied ?? 0,
      isRate: false,
      description: "Unread Instant Reply Coverage",
    },
    {
      title: "主动触达数",
      icon: Send,
      value: currentStats?.proactiveOutreach ?? 0,
      isRate: false,
      description: "Proactive Outreach",
    },
    {
      title: "主动触达回复率",
      icon: ArrowRightLeft,
      value: proactiveResponseRatePercent,
      isRate: true,
      description: "Proactive Response Rate",
      warnThreshold: 10, // 10%
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {metrics.map((metric) => {
        // 对于回复率，检查是否低于阈值
        const isWarning = metric.isRate && metric.warnThreshold && metric.value < metric.warnThreshold;

        return (
          <Card
            key={metric.title}
            className="border-0 shadow-sm bg-white hover:shadow-md transition-shadow"
          >
            <CardContent className="pt-6 pl-6">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between pr-4">
                  <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    {metric.title}
                  </span>
                  <metric.icon className="h-4 w-4 text-muted-foreground/40" />
                </div>

                {loading ? (
                  <div className="h-10 w-24 bg-muted/20 rounded animate-pulse mt-1" />
                ) : (
                  <div className="flex items-baseline gap-3 mt-1">
                    <span className="text-3xl font-bold tracking-tight text-foreground">
                      {metric.isRate ? (
                        <AnimatedNumber
                          value={metric.value}
                          decimals={1}
                          suffix="%"
                          duration={0.6}
                        />
                      ) : (
                        <AnimatedNumber
                          value={metric.value}
                          duration={0.6}
                        />
                      )}
                    </span>
                    {isWarning && (
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                    )}
                  </div>
                )}

                <p className="text-xs text-muted-foreground/80 font-light mt-2 truncate">
                  {metric.description}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
