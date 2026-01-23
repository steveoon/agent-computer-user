"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableIcon } from "lucide-react";
import { useDashboardStatsStore } from "@/lib/stores/dashboard-stats-store";

/**
 * 日期格式化器（使用 Intl.DateTimeFormat）
 * 显示为 "1月16日" 格式
 */
const tableDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "numeric",
  day: "numeric",
});

/**
 * 将 YYYY-MM-DD 格式转换为友好的日期显示
 */
function formatTableDate(dateStr: string): string {
  const date = new Date(dateStr);
  return tableDateFormatter.format(date);
}

/**
 * 根据数值获取热力图颜色
 */
function getHeatmapColor(value: number, max: number): string {
  if (max === 0 || value === 0) return "transparent";
  const ratio = value / max;
  if (ratio >= 0.7) return "rgba(251, 191, 36, 0.15)"; // Amber - 高
  if (ratio >= 0.3) return "rgba(34, 211, 238, 0.1)"; // Cyan - 中
  return "rgba(163, 230, 53, 0.08)"; // Lime - 低
}

/**
 * 统计数据明细表组件 - 深色科技风版本
 *
 * 特点：
 * - 深色背景 + 交替行背景
 * - 热力图着色（数值越高颜色越饱和）
 * - Monospace 数字字体
 */
export function StatsTable() {
  const { dailyTrend, loading } = useDashboardStatsStore();

  // 计算每列的最大值（用于热力图）
  const maxValues = dailyTrend?.reduce(
    (acc, row) => ({
      messagesReceived: Math.max(acc.messagesReceived, row.messagesReceived ?? 0),
      inboundCandidates: Math.max(acc.inboundCandidates, row.inboundCandidates),
      candidatesReplied: Math.max(acc.candidatesReplied, row.candidatesReplied),
      unreadReplied: Math.max(acc.unreadReplied, row.unreadReplied ?? 0),
      wechatExchanged: Math.max(acc.wechatExchanged, row.wechatExchanged),
      interviewsBooked: Math.max(acc.interviewsBooked, row.interviewsBooked),
      proactiveOutreach: Math.max(acc.proactiveOutreach, row.proactiveOutreach ?? 0),
      proactiveResponded: Math.max(acc.proactiveResponded, row.proactiveResponded ?? 0),
    }),
    {
      messagesReceived: 0,
      inboundCandidates: 0,
      candidatesReplied: 0,
      unreadReplied: 0,
      wechatExchanged: 0,
      interviewsBooked: 0,
      proactiveOutreach: 0,
      proactiveResponded: 0,
    }
  ) ?? {
    messagesReceived: 0,
    inboundCandidates: 0,
    candidatesReplied: 0,
    unreadReplied: 0,
    wechatExchanged: 0,
    interviewsBooked: 0,
    proactiveOutreach: 0,
    proactiveResponded: 0,
  };

  return (
    <div className="dash-card overflow-hidden">
      {/* 头部 */}
      <div className="border-b border-[var(--dash-border)] px-4 py-3">
        <h3 className="text-sm font-medium flex items-center gap-2 text-[var(--dash-text-secondary)]">
          <TableIcon className="h-4 w-4 text-dash-amber" />
          数据明细
        </h3>
      </div>

      {/* 内容 */}
      <div className="p-4">
        {loading ? (
          <div className="h-48 bg-[var(--dash-surface-2)] rounded animate-pulse" />
        ) : !dailyTrend || dailyTrend.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-[var(--dash-text-muted)]">
            暂无数据
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-[var(--dash-border)] hover:bg-transparent">
                  <TableHead className="text-[var(--dash-text-muted)] text-xs font-medium">日期</TableHead>
                  <TableHead className="text-right text-[var(--dash-text-muted)] text-xs font-medium">入站消息</TableHead>
                  <TableHead className="text-right text-[var(--dash-text-muted)] text-xs font-medium">入站候选人</TableHead>
                  <TableHead className="text-right text-[var(--dash-text-muted)] text-xs font-medium">被回复</TableHead>
                  <TableHead className="text-right text-[var(--dash-text-muted)] text-xs font-medium">未读秒回</TableHead>
                  <TableHead className="text-right text-[var(--dash-text-muted)] text-xs font-medium">微信获取</TableHead>
                  <TableHead className="text-right text-[var(--dash-text-muted)] text-xs font-medium">面试预约</TableHead>
                  <TableHead className="text-right text-[var(--dash-text-muted)] text-xs font-medium">主动触达</TableHead>
                  <TableHead className="text-right text-[var(--dash-text-muted)] text-xs font-medium">触达回复</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dailyTrend.map((row, index) => (
                  <TableRow
                    key={row.date}
                    className={`
                      border-b border-[var(--dash-border)]/50
                      hover:bg-[var(--dash-surface-2)]/50
                      transition-colors
                      ${index % 2 === 0 ? "bg-transparent" : "bg-[var(--dash-surface-2)]/30"}
                    `}
                  >
                    <TableCell className="font-medium text-[var(--dash-text-secondary)] text-sm whitespace-nowrap">
                      {formatTableDate(row.date)}
                    </TableCell>
                    <TableCell
                      className="text-right dash-number text-sm text-[var(--dash-text-primary)]"
                      style={{ backgroundColor: getHeatmapColor(row.messagesReceived ?? 0, maxValues.messagesReceived) }}
                    >
                      {row.messagesReceived ?? 0}
                    </TableCell>
                    <TableCell
                      className="text-right dash-number text-sm text-[var(--dash-text-primary)]"
                      style={{ backgroundColor: getHeatmapColor(row.inboundCandidates, maxValues.inboundCandidates) }}
                    >
                      {row.inboundCandidates}
                    </TableCell>
                    <TableCell
                      className="text-right dash-number text-sm text-[var(--dash-text-primary)]"
                      style={{ backgroundColor: getHeatmapColor(row.candidatesReplied, maxValues.candidatesReplied) }}
                    >
                      {row.candidatesReplied}
                    </TableCell>
                    <TableCell
                      className="text-right dash-number text-sm text-[var(--dash-text-primary)]"
                      style={{ backgroundColor: getHeatmapColor(row.unreadReplied ?? 0, maxValues.unreadReplied) }}
                    >
                      {row.unreadReplied ?? 0}
                    </TableCell>
                    <TableCell
                      className="text-right dash-number text-sm text-[var(--dash-text-primary)]"
                      style={{ backgroundColor: getHeatmapColor(row.wechatExchanged, maxValues.wechatExchanged) }}
                    >
                      {row.wechatExchanged}
                    </TableCell>
                    <TableCell
                      className="text-right dash-number text-sm text-[var(--dash-text-primary)]"
                      style={{ backgroundColor: getHeatmapColor(row.interviewsBooked, maxValues.interviewsBooked) }}
                    >
                      {row.interviewsBooked}
                    </TableCell>
                    <TableCell
                      className="text-right dash-number text-sm text-[var(--dash-text-primary)]"
                      style={{ backgroundColor: getHeatmapColor(row.proactiveOutreach ?? 0, maxValues.proactiveOutreach) }}
                    >
                      {row.proactiveOutreach ?? 0}
                    </TableCell>
                    <TableCell
                      className="text-right dash-number text-sm text-[var(--dash-text-primary)]"
                      style={{ backgroundColor: getHeatmapColor(row.proactiveResponded ?? 0, maxValues.proactiveResponded) }}
                    >
                      {row.proactiveResponded ?? 0}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
