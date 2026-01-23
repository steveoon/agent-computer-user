"use client";

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
 * 趋势指示器组件 - 深色主题版
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
    if (type === "neutral") return "text-[var(--dash-text-muted)]";
    // invertColors 用于"下降是好事"的指标（如错误率）
    const isPositive = invertColors ? type === "down" : type === "up";
    return isPositive ? "text-dash-lime" : "text-dash-rose";
  };

  const getIcon = () => {
    if (type === "up") return <TrendingUp className="h-3 w-3" />;
    if (type === "down") return <TrendingDown className="h-3 w-3" />;
    return <Minus className="h-3 w-3" />;
  };

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${getColorClass()}`}>
      {getIcon()}
      <span className="dash-number">{text}</span>
    </span>
  );
}

/**
 * 迷你 Sparkline 组件
 */
function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-[2px] h-5">
      {data.map((value, index) => (
        <div
          key={index}
          className="w-[3px] rounded-sm transition-all duration-300"
          style={{
            height: `${Math.max((value / max) * 100, 10)}%`,
            background: `linear-gradient(to top, ${color}40, ${color})`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * KPI 卡片配置类型
 */
interface KpiConfig {
  title: string;
  icon: typeof Users;
  value: number;
  isRate: boolean;
  trendKey: "messagesReceived" | "inboundCandidates" | "wechatExchanged" | null;
  description: string;
  color: string;
  glowClass: string;
  isHero?: boolean;
  warnThreshold?: number;
}

/**
 * KPI 卡片组组件 - 深色科技风版本
 *
 * 特点：
 * - Hero 卡片模式：首个指标占 2 列
 * - 深色表面 + 微妙渐变 + 边框发光
 * - Monospace 数字字体 + 发光效果
 * - 3D 悬浮动效
 */
export function KpiCards() {
  const { summary, loading, dailyTrend } = useDashboardStatsStore();

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

  // 从趋势数据中提取迷你图数据
  const sparklineData = {
    messagesReceived: dailyTrend?.slice(-7).map(d => d.messagesReceived ?? 0) || [],
    inboundCandidates: dailyTrend?.slice(-7).map(d => d.inboundCandidates) || [],
    wechatExchanged: dailyTrend?.slice(-7).map(d => d.wechatExchanged) || [],
  };

  // KPI 配置 - 新配色方案（4 等分布局）
  const kpis: KpiConfig[] = [
    {
      title: "入站消息总数",
      icon: Users,
      value: totals.messagesReceived,
      isRate: false,
      trendKey: "messagesReceived",
      description: "Total Messages",
      color: "#FBBF24", // Amber
      glowClass: "glow-amber",
    },
    {
      title: "入站候选人",
      icon: MessageSquare,
      value: totals.inboundCandidates,
      isRate: false,
      trendKey: "inboundCandidates",
      description: "Inbound Candidates",
      color: "#22D3EE", // Cyan
      glowClass: "glow-cyan",
    },
    {
      title: "回复率",
      icon: ArrowRightLeft,
      value: replyRatePercent,
      isRate: true,
      trendKey: null,
      description: "Reply Rate",
      color: "#A3E635", // Lime
      glowClass: "glow-lime",
      warnThreshold: 50,
    },
    {
      title: "微信获取",
      icon: CalendarCheck,
      value: totals.wechatExchanged,
      isRate: false,
      trendKey: "wechatExchanged",
      description: "WeChat Obtained",
      color: "#FB7185", // Rose
      glowClass: "glow-rose",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi, index) => {
        // 对于回复率，检查是否低于阈值
        const isWarning = kpi.isRate && kpi.warnThreshold && kpi.value < kpi.warnThreshold;
        const sparkData = kpi.trendKey ? sparklineData[kpi.trendKey] : null;

        return (
          <div
            key={kpi.title}
            className={`
              relative overflow-hidden rounded-xl
              bg-[var(--dash-surface-1)] border border-[var(--dash-border)]
              transition-all duration-300 ease-out
              hover:border-[var(--dash-border-glow)] hover:shadow-lg
              dash-card-3d
              dash-animate-scale-in dash-delay-${index + 1}
            `}
            style={{
              "--card-glow": kpi.color,
            } as React.CSSProperties}
          >
            {/* 顶部渐变光条 */}
            <div
              className="absolute top-0 left-0 right-0 h-[2px]"
              style={{
                background: `linear-gradient(90deg, transparent, ${kpi.color}80, transparent)`,
              }}
            />

            {/* 背景渐变 */}
            <div
              className="absolute inset-0 opacity-5"
              style={{
                background: `radial-gradient(ellipse at top right, ${kpi.color}, transparent 70%)`,
              }}
            />

            <div className="relative p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* 标题 */}
                  <div className="flex items-center gap-2 mb-1">
                    <kpi.icon
                      className="h-4 w-4"
                      style={{ color: kpi.color }}
                    />
                    <span className="text-xs font-medium text-[var(--dash-text-muted)] uppercase tracking-wider">
                      {kpi.title}
                    </span>
                  </div>

                  {/* 数值 */}
                  {loading ? (
                    <div className={`h-12 w-28 bg-[var(--dash-surface-2)] rounded animate-pulse mt-2 ${kpi.isHero ? "lg:h-16 lg:w-36" : ""}`} />
                  ) : (
                    <div className="flex items-baseline gap-3 mt-2">
                      <span
                        className={`
                          dash-number font-bold tracking-tight
                          ${kpi.isHero ? "text-4xl lg:text-5xl" : "text-3xl"}
                        `}
                        style={{
                          color: kpi.color,
                          textShadow: `0 0 30px ${kpi.color}50`,
                        }}
                      >
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
                        <AlertCircle className="h-4 w-4 text-dash-rose animate-pulse" aria-hidden="true" />
                      )}
                    </div>
                  )}

                  {/* 趋势 + 描述 */}
                  <div className="flex items-center gap-3 mt-3">
                    {kpi.trendKey && trend && (
                      <TrendIndicator value={trend[kpi.trendKey]} />
                    )}
                    <span className="text-xs text-[var(--dash-text-muted)]">
                      {kpi.description}
                    </span>
                  </div>
                </div>

                {/* Sparkline */}
                {sparkData && sparkData.length > 0 && (
                  <div className="ml-4 opacity-60">
                    <MiniSparkline data={sparkData} color={kpi.color} />
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
