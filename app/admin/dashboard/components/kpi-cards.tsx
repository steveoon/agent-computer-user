"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  MessageSquare,
  ArrowRightLeft,
  CalendarCheck,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
} from "lucide-react";
import { useDashboardStatsStore } from "@/lib/stores/dashboard-stats-store";
import { AnimatedNumber } from "@/components/ui/animated-number";

/**
 * 格式化趋势变化
 */
function formatTrend(value: number | null | undefined): {
  text: string;
  type: "up" | "down" | "neutral";
} {
  if (value === null || value === undefined) {
    return { text: "N/A", type: "neutral" };
  }
  if (value > 0) {
    return { text: `+${value}%`, type: "up" };
  }
  if (value < 0) {
    return { text: `${value}%`, type: "down" };
  }
  return { text: "0%", type: "neutral" };
}

/**
 * 趋势指示器组件
 */
function TrendIndicator({
  value,
  invertColors = false,
}: {
  value: number | null | undefined;
  invertColors?: boolean;
}) {
  const { text, type } = formatTrend(value);

  const getColorClass = () => {
    if (type === "neutral") return "text-muted-foreground";
    // invertColors 用于"下降是好事"的指标（如错误率）
    const isPositive = invertColors ? type === "down" : type === "up";
    return isPositive ? "text-green-600" : "text-red-600";
  };

  const getIcon = () => {
    if (type === "up") return <TrendingUp className="h-3 w-3" />;
    if (type === "down") return <TrendingDown className="h-3 w-3" />;
    return <Minus className="h-3 w-3" />;
  };

  return (
    <Badge variant="outline" className={`${getColorClass()} text-xs gap-1`}>
      {getIcon()}
      {text}
    </Badge>
  );
}

/**
 * KPI 卡片组组件
 */
export function KpiCards() {
  const { summary, loading } = useDashboardStatsStore();

  // 计算当前周期的汇总值
  const currentStats = summary?.current || [];

  // 汇总所有维度的数值
  const totals = currentStats.reduce(
    (acc, curr) => ({
      messagesReceived: acc.messagesReceived + (curr.messagesReceived || 0),
      inboundCandidates: acc.inboundCandidates + (curr.inboundCandidates || 0),
      wechatExchanged: acc.wechatExchanged + (curr.wechatExchanged || 0),
      candidatesReplied: acc.candidatesReplied + (curr.candidatesReplied || 0),
    }),
    {
      messagesReceived: 0,
      inboundCandidates: 0,
      wechatExchanged: 0,
      candidatesReplied: 0,
    }
  );

  // 计算回复率（百分比形式，如 85.5）
  const replyRatePercent =
    totals.inboundCandidates > 0
      ? (totals.candidatesReplied / totals.inboundCandidates) * 100
      : 0;

  const trend = summary?.trend;

  // KPI 配置 - 对齐 docs/OPERATIONAL_METRICS_GUIDE.md
  const kpis = [
    {
      title: "入站消息总数",
      icon: Users,
      value: totals.messagesReceived,
      isRate: false,
      trendKey: "messagesReceived" as const,
      description: "Total Flow / Messages Received",
    },
    {
      title: "入站候选人数",
      icon: MessageSquare,
      value: totals.inboundCandidates,
      isRate: false,
      trendKey: "inboundCandidates" as const,
      description: "Inbound Candidates",
    },
    {
      title: "回复率",
      icon: ArrowRightLeft,
      value: replyRatePercent,
      isRate: true,
      trendKey: null,
      description: "Reply Rate",
      warnThreshold: 50, // 50%
    },
    {
      title: "微信获取数",
      icon: CalendarCheck,
      value: totals.wechatExchanged,
      isRate: false,
      trendKey: "wechatExchanged" as const,
      description: "WeChat Obtained",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {kpis.map((kpi, index) => {
        // 对于回复率，检查是否低于阈值
        const isWarning = kpi.isRate && kpi.warnThreshold && kpi.value < kpi.warnThreshold;

        return (
          <Card
            key={kpi.title}
            className="relative border-0 shadow-sm bg-white hover:shadow-md transition-shadow overflow-hidden"
          >
            {/* 左侧彩色装饰条 - 模拟参考图的 Impact 风格 */}
            <div
              className={`absolute left-0 top-0 bottom-0 w-1 ${
                index === 0
                  ? "bg-blue-500"
                  : index === 1
                    ? "bg-indigo-500"
                    : index === 2
                      ? "bg-emerald-500"
                      : "bg-violet-500"
              }`}
            />

            <CardContent className="pt-6 pl-6">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  {kpi.title}
                </span>

                {loading ? (
                  <div className="h-10 w-24 bg-muted/20 rounded animate-pulse mt-1" />
                ) : (
                  <div className="flex items-baseline gap-3 mt-1">
                    <span className="text-3xl font-bold tracking-tight text-foreground">
                      {kpi.isRate ? (
                        <AnimatedNumber
                          value={kpi.value}
                          decimals={1}
                          suffix="%"
                          duration={0.6}
                        />
                      ) : (
                        <AnimatedNumber
                          value={kpi.value}
                          duration={0.6}
                        />
                      )}
                    </span>
                    {isWarning && (
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                    )}
                    {kpi.trendKey && trend && (
                      <div className="scale-90 origin-left">
                        <TrendIndicator value={trend[kpi.trendKey]} />
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-1.5 mt-2">
                  <kpi.icon className="h-3.5 w-3.5 text-muted-foreground/60" />
                  <p className="text-xs text-muted-foreground/80 font-light truncate">
                    {kpi.description}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
