"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
 * 统计数据明细表组件
 */
export function StatsTable() {
  const { dailyTrend, loading } = useDashboardStatsStore();

  return (
    <Card className="border-0 shadow-sm bg-white overflow-hidden">
      <CardHeader className="border-b bg-gray-50/50 pb-4">
        <CardTitle className="text-base font-semibold flex items-center gap-2 text-foreground/80">
          <TableIcon className="h-4 w-4 text-muted-foreground" />
          数据明细
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-48 bg-muted/50 rounded animate-pulse" />
        ) : !dailyTrend || dailyTrend.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-muted-foreground">
            暂无数据
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>日期</TableHead>
                  <TableHead className="text-right">入站消息总数</TableHead>
                  <TableHead className="text-right">入站候选人数</TableHead>
                  <TableHead className="text-right">被回复候选人数</TableHead>
                  <TableHead className="text-right">未读秒回覆盖量</TableHead>
                  <TableHead className="text-right">微信获取数</TableHead>
                  <TableHead className="text-right">面试预约数</TableHead>
                  <TableHead className="text-right">主动触达数</TableHead>
                  <TableHead className="text-right">主动触达回复数</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dailyTrend.map(row => (
                  <TableRow key={row.date}>
                    <TableCell className="font-medium">{row.date}</TableCell>
                    <TableCell className="text-right">{row.messagesReceived}</TableCell>
                    <TableCell className="text-right">{row.inboundCandidates}</TableCell>
                    <TableCell className="text-right">{row.candidatesReplied}</TableCell>
                    <TableCell className="text-right">{row.unreadReplied}</TableCell>
                    <TableCell className="text-right">{row.wechatExchanged}</TableCell>
                    <TableCell className="text-right">{row.interviewsBooked}</TableCell>
                    <TableCell className="text-right">{row.proactiveOutreach}</TableCell>
                    <TableCell className="text-right">{row.proactiveResponded}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
