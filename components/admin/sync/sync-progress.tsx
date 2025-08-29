"use client";

import { useMemo } from "react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCw, CheckCircle, XCircle, Clock, Activity, Server, Database } from "lucide-react";
import { useSyncStore, formatDuration } from "@/lib/stores/sync-store";
import { getAvailableBrands } from "@/lib/constants/organization-mapping";
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
    return { icon: "text-blue-600", badge: "default" as const };
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
    return <RefreshCw className={`${className} animate-spin text-blue-600`} aria-hidden="true" />;
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
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4" role="region" aria-label="同步统计信息">
      <div className="text-center">
        <div className="flex items-center justify-center gap-1 mb-1">
          <Server className="h-4 w-4 text-blue-600" aria-hidden="true" />
          <span className="text-sm font-medium">品牌数量</span>
        </div>
        <div className="text-2xl font-bold text-blue-600">{selectedBrandsCount}</div>
      </div>

      <div className="text-center">
        <div className="flex items-center justify-center gap-1 mb-1">
          <Database className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          <span className="text-sm font-medium">处理记录</span>
        </div>
        <div className="text-2xl font-bold text-emerald-600">{stats.totalProcessedRecords}</div>
      </div>

      <div className="text-center">
        <div className="flex items-center justify-center gap-1 mb-1">
          <CheckCircle className="h-4 w-4 text-purple-600" aria-hidden="true" />
          <span className="text-sm font-medium">门店数量</span>
        </div>
        <div className="text-2xl font-bold text-purple-600">{stats.totalStoreCount}</div>
      </div>

      <div className="text-center">
        <div className="flex items-center justify-center gap-1 mb-1">
          <Clock className="h-4 w-4 text-orange-600" aria-hidden="true" />
          <span className="text-sm font-medium">耗时</span>
        </div>
        <div className="text-2xl font-bold text-orange-600">
          <time>{formatDuration(totalDuration)}</time>
        </div>
      </div>
    </div>
  );
}

// 品牌状态列表组件
interface BrandStatusListProps {
  results: SyncResult[];
}

function BrandStatusList({ results }: BrandStatusListProps) {
  return (
    <div className="space-y-2" role="region" aria-label="各品牌同步状态">
      <h4 className="font-medium text-sm">各品牌同步状态</h4>
      <div className="space-y-2">
        {results.map((result, index) => {
          const styles = getStatusStyles(result.success);
          return (
            <div
              key={`${result.brandName}-${result.totalRecords}-${index}`}
              className={`flex items-center justify-between p-3 border rounded-lg ${styles.container}`}
              role="listitem"
            >
              <div className="flex items-center gap-2">
                <StatusIcon isSyncing={false} success={result.success} />
                <span className="font-medium text-sm">{result.brandName}</span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">{result.processedRecords} 条记录</span>
                <Badge
                  variant={result.success ? "default" : "destructive"}
                  className="text-xs text-white"
                >
                  {result.success ? "成功" : "失败"}
                </Badge>
              </div>
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

  const availableBrands = getAvailableBrands();

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
    const brand = availableBrands.find(b => b.id === currentOrganization);
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
          <Badge variant={progressStyles.badge}>{overallProgress}%</Badge>
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
