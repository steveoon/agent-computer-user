"use client";

import { useMemo, useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  Server,
  Database,
  ChevronDown,
  ChevronUp,
  MapPin,
} from "lucide-react";
import { useSyncStore, formatDuration } from "@/lib/stores/sync-store";
import { useBrandManagementStore } from "@/lib/stores/brand-management-store";
import { SyncResult } from "@/lib/services/duliday-sync.service";

// 类型定义
interface SyncStatsData {
  totalProcessedRecords: number;
  totalStoreCount: number;
  successCount: number;
  failedCount: number;
}

interface SyncProgressProps {
  className?: string;
}

// 工具函数：获取状态样式
const getStatusStyles = (success: boolean) => ({
  container: success ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50",
  icon: success ? "text-emerald-600" : "text-rose-600",
});

// 工具函数：获取进度状态样式
const getProgressStatusStyles = (isSyncing: boolean, overallSuccess?: boolean) => {
  if (isSyncing) {
    return { icon: "text-brand-primary", badge: "default" as const };
  }
  return overallSuccess
    ? { icon: "text-emerald-600", badge: "default" as const }
    : { icon: "text-rose-600", badge: "destructive" as const };
};

// 状态图标组件
interface StatusIconProps {
  isSyncing: boolean;
  success?: boolean;
  className?: string;
}

function StatusIcon({ isSyncing, success, className = "h-4 w-4" }: StatusIconProps) {
  if (isSyncing) {
    return (
      <RefreshCw className={`${className} animate-spin text-brand-primary`} aria-hidden="true" />
    );
  }
  return success ? (
    <CheckCircle className={`${className} text-emerald-600`} aria-hidden="true" />
  ) : (
    <XCircle className={`${className} text-rose-600`} aria-hidden="true" />
  );
}

// 统计信息组件
interface SyncStatsProps {
  stats: SyncStatsData;
  totalDuration: number;
  selectedBrandsCount: number;
}

function SyncStats({ stats, totalDuration, selectedBrandsCount }: SyncStatsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3" role="region" aria-label="同步统计信息">
      <div className="p-3 bg-slate-50 dark:bg-slate-900/20 rounded-lg border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 mb-1">
          <Server className="h-3.5 w-3.5 text-brand-primary" aria-hidden="true" />
          <span className="text-xs font-medium text-muted-foreground">品牌</span>
        </div>
        <div className="text-xl font-bold text-brand-primary">{selectedBrandsCount}</div>
      </div>

      <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
        <div className="flex items-center gap-2 mb-1">
          <Database className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
          <span className="text-xs font-medium text-muted-foreground">记录</span>
        </div>
        <div className="text-xl font-bold text-emerald-600">{stats.totalProcessedRecords}</div>
      </div>

      <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
        <div className="flex items-center gap-2 mb-1">
          <CheckCircle className="h-3.5 w-3.5 text-purple-600" aria-hidden="true" />
          <span className="text-xs font-medium text-muted-foreground">门店</span>
        </div>
        <div className="text-xl font-bold text-purple-600">{stats.totalStoreCount}</div>
      </div>

      <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
        <div className="flex items-center gap-2 mb-1">
          <Clock className="h-3.5 w-3.5 text-orange-600" aria-hidden="true" />
          <span className="text-xs font-medium text-muted-foreground">耗时</span>
        </div>
        <div className="text-xl font-bold text-orange-600">
          <time>{formatDuration(totalDuration)}</time>
        </div>
      </div>
    </div>
  );
}

// 品牌状态列表组件
function BrandStatusList({ results }: { results: SyncResult[] }) {
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const toggleExpand = (brandName: string) => {
    setExpandedItems(prev => ({
      ...prev,
      [brandName]: !prev[brandName],
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
        <span>品牌列表 ({results.length})</span>
        <span>状态</span>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar pr-2">
        {results.map((result, index) => {
          const styles = getStatusStyles(result.success);
          const isExpanded = expandedItems[result.brandName];
          const hasGeocodingFailures = result.geocodingStats && result.geocodingStats.failed > 0;

          return (
            <div
              key={`${result.brandName}-${result.totalRecords}-${index}`}
              className={`border rounded-lg ${styles.container} transition-all duration-200`}
              role="listitem"
            >
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-2">
                  <StatusIcon isSyncing={false} success={result.success} />
                  <span className="font-medium text-sm">{result.brandName}</span>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">{result.processedRecords} 条记录</span>
                  <Badge
                    variant={result.success ? "default" : "destructive"}
                    className="text-xs text-white"
                  >
                    {result.success ? "成功" : "失败"}
                  </Badge>

                  {hasGeocodingFailures && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => toggleExpand(result.brandName)}
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              </div>

              {/* 地理编码统计详情 */}
              {result.geocodingStats && (
                <div className="px-3 pb-3 text-xs text-muted-foreground border-t border-border/50 pt-2 mt-0">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      地理编码:
                    </span>
                    <span className="text-green-600">成功 {result.geocodingStats.success}</span>
                    <span
                      className={result.geocodingStats.failed > 0 ? "text-red-600 font-medium" : ""}
                    >
                      失败 {result.geocodingStats.failed}
                    </span>
                    <span>跳过 {result.geocodingStats.skipped}</span>
                  </div>

                  {/* 失败详情展开 */}
                  {isExpanded && hasGeocodingFailures && result.geocodingStats.failedStores && (
                    <div className="mt-2 bg-background/50 p-2 rounded border border-border/50">
                      <div className="font-medium mb-1 text-red-500">失败列表:</div>
                      <div className="grid grid-cols-1 gap-1 max-h-32 overflow-y-auto">
                        {result.geocodingStats.failedStores.map((storeName, i) => (
                          <div key={i} className="truncate" title={storeName}>
                            • {storeName}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const SyncProgress = ({ className }: SyncProgressProps = {}) => {
  const {
    isSyncing,
    currentStep,
    overallProgress,
    currentOrganization,
    selectedBrands,
    currentSyncResult,
  } = useSyncStore();

  // 从 Store 获取品牌列表
  const availableBrands = useBrandManagementStore(state => state.availableBrands);
  const loadAvailableBrands = useBrandManagementStore(state => state.loadAvailableBrands);

  // 初次加载品牌列表
  useEffect(() => {
    if (availableBrands.length === 0) {
      loadAvailableBrands();
    }
  }, [availableBrands.length, loadAvailableBrands]);

  // 使用useMemo优化计算性能
  const stats = useMemo((): SyncStatsData | null => {
    if (!currentSyncResult) return null;

    return {
      totalProcessedRecords: currentSyncResult.results.reduce(
        (sum, r) => sum + r.processedRecords,
        0
      ),
      totalStoreCount: currentSyncResult.results.reduce((sum, r) => sum + r.storeCount, 0),
      successCount: currentSyncResult.results.filter(r => r.success).length,
      failedCount: currentSyncResult.results.filter(r => !r.success).length,
    };
  }, [currentSyncResult]);

  // 获取当前品牌名称
  const currentBrandName = useMemo(() => {
    if (currentOrganization === 0) return "";
    const brand = availableBrands.find(b => b.id === String(currentOrganization));
    return brand?.name || `组织 ${currentOrganization}`;
  }, [currentOrganization, availableBrands]);

  // 进度状态样式
  const progressStyles = useMemo(
    () => getProgressStatusStyles(isSyncing, currentSyncResult?.overallSuccess),
    [isSyncing, currentSyncResult?.overallSuccess]
  );

  // 空状态处理
  if (!isSyncing && !currentSyncResult) {
    return null;
  }

  return (
    <div className={`space-y-4 ${className}`} role="region" aria-label="同步进度">
      {/* 总体进度 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusIcon isSyncing={isSyncing} success={currentSyncResult?.overallSuccess} />
            <span className="font-medium">{isSyncing ? "同步进行中..." : "同步已完成"}</span>
          </div>
          <Badge variant={progressStyles.badge}>{overallProgress.toFixed(1)}%</Badge>
        </div>

        <Progress value={overallProgress} className="w-full" aria-label="总体进度" />

        <div className="text-sm text-muted-foreground" role="status" aria-live="polite">
          {currentStep}
        </div>
      </div>

      {/* 当前同步的品牌信息 */}
      {isSyncing && currentOrganization > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-primary animate-pulse" aria-hidden="true" />
              <div>
                <div className="font-medium">正在同步: {currentBrandName}</div>
                <div className="text-sm text-muted-foreground">
                  组织ID: <span className="font-mono">{currentOrganization}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 同步统计信息 */}
      {stats && currentSyncResult && (
        <SyncStats
          stats={stats}
          totalDuration={currentSyncResult.totalDuration}
          selectedBrandsCount={selectedBrands.length}
        />
      )}

      {/* 品牌同步状态列表 */}
      {currentSyncResult && currentSyncResult.results.length > 0 && (
        <BrandStatusList results={currentSyncResult.results} />
      )}
    </div>
  );
};
