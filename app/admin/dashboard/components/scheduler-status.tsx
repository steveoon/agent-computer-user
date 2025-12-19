"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Zap, Clock, Activity } from "lucide-react";
import {
  getSchedulerStatus,
  type SerializedSchedulerStatus,
} from "@/actions/recruitment-stats";

/**
 * 格式化时间为简短格式
 */
function formatTime(isoString: string | null): string {
  if (!isoString) return "未执行";
  const date = new Date(isoString);
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * 计算距离下次执行的时间
 */
function getTimeUntil(isoString: string | null): string {
  if (!isoString) return "未调度";
  const target = new Date(isoString);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();

  if (diffMs <= 0) return "即将";

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * 调度器状态组件
 *
 * 紧凑型设计，显示定时聚合任务的关键状态
 */
export function SchedulerStatus() {
  const [status, setStatus] = useState<SerializedSchedulerStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getSchedulerStatus();
      if (result.success) {
        setStatus(result.data);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取状态失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 60000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  if (error) {
    return (
      <Card className="border-0 shadow-sm bg-white">
        <CardContent className="p-4">
          <div className="text-xs text-destructive text-center">{error}</div>
        </CardContent>
      </Card>
    );
  }

  if (!status) {
    return (
      <Card className="border-0 shadow-sm bg-white">
        <CardContent className="p-4">
          <div className="h-20 bg-muted/20 rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-sm bg-white overflow-hidden">
      <CardContent className="p-0">
        {/* 头部状态栏 */}
        <div
          className={`px-4 py-2.5 flex items-center justify-between ${
            status.isRunning
              ? "bg-gradient-to-r from-emerald-50 to-teal-50"
              : "bg-gradient-to-r from-gray-50 to-slate-50"
          }`}
        >
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                status.isRunning ? "bg-emerald-500 animate-pulse" : "bg-gray-300"
              }`}
            />
            <span className="text-xs font-medium text-foreground/80">
              定时聚合
            </span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                status.isRunning
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {status.isRunning ? "运行中" : "未启动"}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchStatus}
            disabled={loading}
            className="h-6 w-6 p-0 hover:bg-white/50"
          >
            <RefreshCw
              className={`h-3 w-3 text-muted-foreground ${loading ? "animate-spin" : ""}`}
            />
          </Button>
        </div>

        {/* 主体内容 - 三列布局 */}
        <div className="px-4 pt-3 pb-4 grid grid-cols-3 gap-3">
          {/* 执行间隔 */}
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
            </div>
            <div className="text-sm font-semibold text-foreground">
              {status.config.dirtyIntervalMinutes}min
            </div>
            <div className="text-[10px] text-muted-foreground">增量间隔</div>
          </div>

          {/* 最近执行 */}
          <div className="text-center border-x border-gray-100">
            <div className="flex items-center justify-center mb-1">
              <Clock className="h-3.5 w-3.5 text-blue-500" />
            </div>
            <div className="text-sm font-semibold text-foreground">
              {formatTime(status.lastRunTime)}
            </div>
            <div className="text-[10px] text-muted-foreground">最近执行</div>
          </div>

          {/* 下次主聚合 */}
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <Activity className="h-3.5 w-3.5 text-purple-500" />
            </div>
            <div className="text-sm font-semibold text-foreground">
              {getTimeUntil(status.nextMainAggregationTime)}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {status.config.mainAggregationHour}:00 主聚合
            </div>
          </div>
        </div>

        {/* 最近结果（如果有） */}
        {status.lastResult && (
          <div className="px-4 py-2 bg-gray-50/50 border-t border-gray-100">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">最近结果</span>
              <div className="flex items-center gap-2">
                {status.lastResult.success ? (
                  <span className="text-emerald-600 font-medium">
                    {status.lastResult.processedCount} 条成功
                  </span>
                ) : (
                  <span className="text-destructive font-medium">
                    {status.lastResult.failedCount} 条失败
                  </span>
                )}
                <span className="text-muted-foreground">
                  {status.lastResult.duration}ms
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
