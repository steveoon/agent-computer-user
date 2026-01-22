"use client";

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
 * 迷你 Sparkline 组件
 */
function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-[2px] h-4">
      {data.map((value, index) => (
        <div
          key={index}
          className="w-[2px] rounded-sm transition-all duration-300"
          style={{
            height: `${Math.max((value / max) * 100, 15)}%`,
            background: `linear-gradient(to top, ${color}40, ${color})`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * 运营效率指标配置
 */
interface MetricConfig {
  title: string;
  icon: typeof MessageCircleReply;
  value: number;
  isRate: boolean;
  description: string;
  color: string;
  warnThreshold?: number;
  sparklineKey?: "unreadReplied" | "proactiveOutreach";
}

/**
 * 运营效率指标组件 - 紧凑指标条设计
 *
 * 特点：
 * - 合并为单行指标条，竖线分隔
 * - 添加 7 天迷你 sparkline
 * - 深色科技风样式
 */
export function OperationalMetrics() {
  const { summary, loading, dailyTrend } = useDashboardStatsStore();

  // 汇总当前周期的所有数据
  const currentStats = sumStats(summary?.current);

  // 计算主动触达回复率（百分比形式，如 10.5）
  const proactiveResponseRatePercent =
    currentStats?.proactiveResponseRate != null
      ? currentStats.proactiveResponseRate / 100
      : 0;

  // 从趋势数据中提取迷你图数据
  const sparklineData = {
    unreadReplied: dailyTrend?.slice(-7).map(d => d.unreadReplied ?? 0) || [],
    proactiveOutreach: dailyTrend?.slice(-7).map(d => d.proactiveOutreach ?? 0) || [],
  };

  // 运营效率指标配置
  const metrics: MetricConfig[] = [
    {
      title: "未读秒回覆盖量",
      icon: MessageCircleReply,
      value: currentStats?.unreadReplied ?? 0,
      isRate: false,
      description: "Unread Instant Reply",
      color: "#FBBF24", // Amber
      sparklineKey: "unreadReplied",
    },
    {
      title: "主动触达数",
      icon: Send,
      value: currentStats?.proactiveOutreach ?? 0,
      isRate: false,
      description: "Proactive Outreach",
      color: "#22D3EE", // Cyan
      sparklineKey: "proactiveOutreach",
    },
    {
      title: "主动触达回复率",
      icon: ArrowRightLeft,
      value: proactiveResponseRatePercent,
      isRate: true,
      description: "Response Rate",
      color: "#A3E635", // Lime
      warnThreshold: 10,
    },
  ];

  return (
    <div className="dash-card p-4">
      <div className="flex items-center justify-between divide-x divide-[var(--dash-border)]">
        {metrics.map((metric, index) => {
          // 对于回复率，检查是否低于阈值
          const isWarning = metric.isRate && metric.warnThreshold && metric.value < metric.warnThreshold;
          const sparkData = metric.sparklineKey ? sparklineData[metric.sparklineKey] : null;

          return (
            <div
              key={metric.title}
              className={`flex-1 flex items-center justify-between px-4 ${index === 0 ? "pl-0" : ""} ${index === metrics.length - 1 ? "pr-0" : ""}`}
            >
              <div className="flex items-center gap-3">
                {/* 图标 */}
                <div
                  className="h-8 w-8 rounded-lg flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${metric.color}20, ${metric.color}10)`,
                    border: `1px solid ${metric.color}30`,
                  }}
                >
                  <metric.icon
                    className="h-4 w-4"
                    style={{ color: metric.color }}
                  />
                </div>

                {/* 标题和描述 */}
                <div>
                  <p className="text-xs font-medium text-[var(--dash-text-muted)] uppercase tracking-wider">
                    {metric.title}
                  </p>
                  <p className="text-[10px] text-[var(--dash-text-muted)] opacity-60 mt-0.5">
                    {metric.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Sparkline */}
                {sparkData && sparkData.length > 0 && (
                  <div className="opacity-50">
                    <MiniSparkline data={sparkData} color={metric.color} />
                  </div>
                )}

                {/* 数值 */}
                {loading ? (
                  <div className="h-8 w-16 bg-[var(--dash-surface-2)] rounded animate-pulse" />
                ) : (
                  <div className="flex items-center gap-2">
                    <span
                      className="text-2xl font-bold dash-number"
                      style={{
                        color: metric.color,
                        textShadow: `0 0 20px ${metric.color}40`,
                      }}
                    >
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
                      <AlertCircle className="h-4 w-4 text-dash-rose animate-pulse" aria-hidden="true" />
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
