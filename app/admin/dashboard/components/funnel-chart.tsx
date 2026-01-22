"use client";

import { Filter, ChevronDown } from "lucide-react";
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
 * 漏斗阶段配置
 */
interface FunnelStage {
  label: string;
  value: number;
  color: string;
}

/**
 * 计算漏斗阶段宽度百分比
 */
function getStageWidth(value: number, max: number): number {
  if (max === 0) return 20; // 最小宽度
  return Math.max((value / max) * 100, 20);
}

/**
 * 转化漏斗组件 - 垂直漏斗设计
 *
 * 特点：
 * - 垂直漏斗形状（上宽下窄梯形）
 * - 渐变填充 (amber → cyan → lime)
 * - 阶段间流失率显示
 * - 流动线条动画
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

  // 漏斗阶段配置 - 渐变色系
  const funnelStages: FunnelStage[] = [
    { label: "入站候选人", value: inbound, color: "#FBBF24" },    // Amber
    { label: "被回复", value: replied, color: "#22D3EE" },       // Cyan
    { label: "微信获取", value: wechat, color: "#A3E635" },      // Lime
    { label: "面试预约", value: interview, color: "#FB7185" },   // Rose
  ];

  // 计算阶段间转化率
  const getConversionRate = (from: number, to: number): number | null => {
    if (from === 0) return null;
    return Math.round((to / from) * 100);
  };

  return (
    <div className="dash-card overflow-hidden h-full flex flex-col">
      {/* 头部 */}
      <div className="border-b border-[var(--dash-border)] px-4 py-3 flex-none">
        <h3 className="text-sm font-medium flex items-center gap-2 text-[var(--dash-text-secondary)]">
          <Filter className="h-4 w-4 text-dash-amber" />
          转化漏斗
        </h3>
      </div>

      {/* 内容 */}
      <div className="flex-1 p-4 flex flex-col">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            {[100, 75, 50, 30].map((width, i) => (
              <div
                key={i}
                className="h-10 bg-[var(--dash-surface-2)] rounded animate-pulse"
                style={{ width: `${width}%` }}
              />
            ))}
          </div>
        ) : !hasData ? (
          <div className="flex-1 flex items-center justify-center text-[var(--dash-text-muted)] text-sm">
            暂无数据
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-1">
            {funnelStages.map((stage, index) => {
              const widthPercent = getStageWidth(stage.value, maxValue);
              const nextStage = funnelStages[index + 1];
              const conversionRate = nextStage
                ? getConversionRate(stage.value, nextStage.value)
                : null;

              return (
                <div key={stage.label} className="flex flex-col items-center">
                  {/* 漏斗阶段 */}
                  <div
                    className="relative h-12 rounded-lg flex items-center justify-between px-4 transition-all duration-500"
                    style={{
                      width: `${widthPercent}%`,
                      background: `linear-gradient(135deg, ${stage.color}30, ${stage.color}15)`,
                      borderLeft: `3px solid ${stage.color}`,
                      boxShadow: `0 0 20px ${stage.color}10`,
                    }}
                  >
                    {/* 标签 */}
                    <span className="text-xs font-medium text-[var(--dash-text-secondary)]">
                      {stage.label}
                    </span>

                    {/* 数值 */}
                    <span
                      className="text-lg font-bold dash-number"
                      style={{
                        color: stage.color,
                        textShadow: `0 0 10px ${stage.color}40`,
                      }}
                    >
                      {stage.value.toLocaleString()}
                    </span>
                  </div>

                  {/* 转化率指示器（阶段之间） */}
                  {conversionRate !== null && (
                    <div className="flex flex-col items-center py-1 relative">
                      {/* 流动线条 */}
                      <div className="w-px h-4 bg-gradient-to-b from-[var(--dash-border)] to-transparent relative overflow-hidden">
                        <div className="absolute w-full h-2 bg-dash-amber/50 dash-flow-line" />
                      </div>

                      {/* 转化率标签 */}
                      <div className="flex items-center gap-1 text-[10px]">
                        <ChevronDown
                          className="h-3 w-3"
                          style={{ color: nextStage?.color }}
                        />
                        <span
                          className="font-medium dash-number"
                          style={{ color: nextStage?.color }}
                        >
                          {conversionRate}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 底部汇总 */}
        {hasData && !loading && (
          <div className="mt-4 pt-4 border-t border-[var(--dash-border)]">
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "回复率", value: getConversionRate(inbound, replied), color: "#22D3EE" },
                { label: "微信率", value: getConversionRate(inbound, wechat), color: "#A3E635" },
                { label: "预约率", value: getConversionRate(inbound, interview), color: "#FB7185" },
              ].map(rate => (
                <div key={rate.label} className="text-center">
                  <p
                    className="text-base font-bold dash-number"
                    style={{
                      color: rate.color,
                      textShadow: `0 0 10px ${rate.color}30`,
                    }}
                  >
                    {rate.value !== null ? `${rate.value}%` : "—"}
                  </p>
                  <p className="text-[10px] text-[var(--dash-text-muted)] mt-0.5">
                    {rate.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
