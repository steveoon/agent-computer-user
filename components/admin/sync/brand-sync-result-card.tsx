"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Clock, AlertTriangle, Eye, EyeOff, Database, MapPin, ChevronDown, ChevronUp } from "lucide-react";
import { SyncResult, GeocodingStats } from "@/lib/services/duliday-sync.service";
import { formatDuration } from "@/lib/stores/sync-store";
import { SyncErrorList } from "@/components/sync/sync-error-display";

// 类型定义
interface SyncStats {
  totalRecords: number;
  processedRecords: number;
  failedCount: number;
  successRate: number;
  storeCount: number;
}

interface BrandSyncResultCardProps {
  result: SyncResult;
  forceShowErrors?: boolean; // 用于批量操作
}

// 工具函数：获取进度条颜色
const getProgressColor = (successRate: number): string => {
  if (successRate >= 80) return "[&>div]:bg-emerald-500";
  if (successRate >= 50) return "[&>div]:bg-amber-500";
  return "[&>div]:bg-rose-500";
};

// 工具函数：获取状态样式
const getStatusStyles = (success: boolean, showErrors: boolean) => ({
  container: `border rounded-lg transition-all duration-200 ${
    success ? "border-emerald-200 dark:border-emerald-800" : "border-rose-200 dark:border-rose-800"
  } ${showErrors ? "shadow-md" : "shadow-sm hover:shadow-md"}`,

  header: success
    ? "bg-gradient-to-r from-emerald-50/50 to-transparent dark:from-emerald-900/10"
    : "bg-gradient-to-r from-rose-50/50 to-transparent dark:from-rose-900/10",

  icon: success ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
});

// 统计信息组件
interface StatsDisplayProps {
  stats: SyncStats;
}

function StatsDisplay({ stats }: StatsDisplayProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div>
        <div className="text-2xl font-bold">{stats.totalRecords}</div>
        <div className="text-xs text-muted-foreground">总岗位</div>
      </div>
      <div>
        <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
          {stats.processedRecords}
        </div>
        <div className="text-xs text-muted-foreground">成功</div>
      </div>
      <div>
        <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
          {stats.failedCount}
        </div>
        <div className="text-xs text-muted-foreground">失败</div>
      </div>
      <div>
        <div className="text-2xl font-bold text-violet-600 dark:text-violet-400">
          {stats.storeCount}
        </div>
        <div className="text-xs text-muted-foreground">门店</div>
      </div>
    </div>
  );
}

// 进度条组件
interface ProgressSectionProps {
  totalRecords: number;
  successRate: number;
}

function ProgressSection({ totalRecords, successRate }: ProgressSectionProps) {
  if (totalRecords === 0) return null;

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-sm">
        <span className="text-muted-foreground">成功率</span>
        <span className="font-medium">{successRate}%</span>
      </div>
      <Progress value={successRate} className={`h-2 ${getProgressColor(successRate)}`} />
    </div>
  );
}

// 错误详情组件
interface ErrorDetailsSectionProps {
  errors: SyncResult["errors"];
}

function ErrorDetailsSection({ errors }: ErrorDetailsSectionProps) {
  // 组件只在需要显示时才被挂载，无需再检查 showErrors
  return (
    <div className="border-t border-rose-200 dark:border-rose-800 overflow-hidden">
      <div className="max-h-[300px] overflow-y-auto w-full">
        <div className="p-4 bg-rose-50/30 dark:bg-rose-900/10">
          <SyncErrorList errors={errors} />
        </div>
      </div>
    </div>
  );
}

// 地理编码统计组件
interface GeocodingStatsSectionProps {
  stats: GeocodingStats;
}

function GeocodingStatsSection({ stats }: GeocodingStatsSectionProps) {
  const [showFailedStores, setShowFailedStores] = useState(false);
  const hasFailedStores = stats.failedStores && stats.failedStores.length > 0;
  const successRate = stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 100;

  return (
    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-2 mb-2">
        <MapPin className="h-4 w-4 text-blue-500" />
        <span className="text-sm font-medium">地理编码</span>
        {stats.total === 0 && stats.skipped > 0 && (
          <Badge variant="secondary" className="text-xs">已有坐标</Badge>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2 text-sm">
        <div className="text-center p-2 bg-slate-50 dark:bg-slate-900/30 rounded">
          <div className="font-semibold">{stats.total + stats.skipped}</div>
          <div className="text-xs text-muted-foreground">总门店</div>
        </div>
        <div className="text-center p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded">
          <div className="font-semibold text-emerald-600 dark:text-emerald-400">{stats.success}</div>
          <div className="text-xs text-muted-foreground">编码成功</div>
        </div>
        <div className="text-center p-2 bg-amber-50 dark:bg-amber-900/20 rounded">
          <div className="font-semibold text-amber-600 dark:text-amber-400">{stats.skipped}</div>
          <div className="text-xs text-muted-foreground">已有坐标</div>
        </div>
        <div className="text-center p-2 bg-rose-50 dark:bg-rose-900/20 rounded">
          <div className="font-semibold text-rose-600 dark:text-rose-400">{stats.failed}</div>
          <div className="text-xs text-muted-foreground">编码失败</div>
        </div>
      </div>

      {/* 编码成功率进度条 */}
      {stats.total > 0 && (
        <div className="mt-2 space-y-1">
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground">编码成功率</span>
            <span className="font-medium">{successRate}%</span>
          </div>
          <Progress
            value={successRate}
            className={`h-1.5 ${successRate >= 80 ? "[&>div]:bg-blue-500" : successRate >= 50 ? "[&>div]:bg-amber-500" : "[&>div]:bg-rose-500"}`}
          />
        </div>
      )}

      {/* 失败门店列表 */}
      {hasFailedStores && (
        <div className="mt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFailedStores(!showFailedStores)}
            className="w-full justify-between text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 h-7"
          >
            <span className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              查看 {stats.failedStores.length} 个编码失败的门店
            </span>
            {showFailedStores ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>

          {showFailedStores && (
            <div className="mt-2 p-2 bg-rose-50/50 dark:bg-rose-900/10 rounded text-xs max-h-[150px] overflow-y-auto">
              <ul className="space-y-1">
                {stats.failedStores.map((storeName, index) => (
                  <li key={index} className="flex items-start gap-1 text-rose-700 dark:text-rose-300">
                    <XCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span>{storeName}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function BrandSyncResultCard({ result, forceShowErrors = false }: BrandSyncResultCardProps) {
  const [showErrors, setShowErrors] = useState(false);

  // 使用forceShowErrors来控制显示状态（用于批量操作）
  const isErrorsVisible = forceShowErrors || showErrors;

  // 使用useMemo优化计算性能
  const stats = useMemo((): SyncStats => {
    const failedCount = result.totalRecords - result.processedRecords;
    const successRate =
      result.totalRecords > 0
        ? Math.round((result.processedRecords / result.totalRecords) * 100)
        : 0;

    return {
      totalRecords: result.totalRecords,
      processedRecords: result.processedRecords,
      failedCount,
      successRate,
      storeCount: result.storeCount,
    };
  }, [result.totalRecords, result.processedRecords, result.storeCount]);

  const styles = useMemo(
    () => getStatusStyles(result.success, isErrorsVisible),
    [result.success, isErrorsVisible]
  );
  const hasErrors = result.errors.length > 0;

  const handleToggleErrors = () => {
    if (!forceShowErrors) {
      setShowErrors(!showErrors);
    }
  };

  return (
    <div className={styles.container} role="region" aria-label={`${result.brandName} 同步结果`}>
      {/* 卡片头部 - 总是显示 */}
      <div className={`p-4 ${styles.header}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            {result.success ? (
              <CheckCircle
                className={`h-5 w-5 mt-0.5 flex-shrink-0 ${styles.icon}`}
                aria-hidden="true"
              />
            ) : (
              <XCircle
                className={`h-5 w-5 mt-0.5 flex-shrink-0 ${styles.icon}`}
                aria-hidden="true"
              />
            )}

            <div className="flex-1 space-y-3">
              {/* 品牌名称和状态 */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-lg">{result.brandName}</span>
                  <Badge
                    variant={result.success ? "default" : "destructive"}
                    className="text-xs text-white"
                  >
                    {result.success ? "成功" : "失败"}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  <time>{formatDuration(result.duration)}</time>
                </div>
              </div>

              {/* 统计信息 */}
              <StatsDisplay stats={stats} />

              {/* 进度条 */}
              <ProgressSection totalRecords={stats.totalRecords} successRate={stats.successRate} />

              {/* 地理编码统计 - 如果有统计数据 */}
              {result.geocodingStats && (
                <GeocodingStatsSection stats={result.geocodingStats} />
              )}

              {/* 错误信息按钮 - 如果有错误 */}
              {hasErrors && (
                <div className="pt-2 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleToggleErrors}
                    disabled={forceShowErrors}
                    className="w-full justify-between text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                    aria-expanded={isErrorsVisible}
                    aria-controls={`error-details-${result.brandName}`}
                  >
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                      查看 {result.errors.length} 个错误详情
                    </span>
                    {isErrorsVisible ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 错误详情 - 条件渲染优化性能 */}
      {hasErrors && isErrorsVisible && <ErrorDetailsSection errors={result.errors} />}
    </div>
  );
}

// 批量操作组件
interface BrandSyncResultCardsProps {
  results: SyncResult[] | null | undefined;
  isLoading?: boolean;
}

export function BrandSyncResultCards({ results, isLoading = false }: BrandSyncResultCardsProps) {
  const [expandedAll, setExpandedAll] = useState(false);

  // 空状态处理
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center p-8">
          <div className="text-center space-y-2">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto" />
            <p className="text-sm text-muted-foreground">加载同步结果中...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!results || results.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center p-8">
          <div className="text-center space-y-2">
            <Database className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">暂无同步结果</p>
          </div>
        </div>
      </div>
    );
  }

  const hasAnyErrors = results.some(r => r.errors.length > 0);
  const totalResults = results.length;
  const successCount = results.filter(r => r.success).length;
  const errorCount = totalResults - successCount;

  return (
    <div className="space-y-4" role="region" aria-label="品牌同步结果列表">
      {/* 头部操作栏和统计信息 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h4 className="font-medium flex items-center gap-2">
            <Database className="h-4 w-4" aria-hidden="true" />
            各品牌同步详情
          </h4>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>共 {totalResults} 个品牌</span>
            <span className="text-emerald-600 dark:text-emerald-400">{successCount} 成功</span>
            {errorCount > 0 && (
              <span className="text-rose-600 dark:text-rose-400">{errorCount} 失败</span>
            )}
          </div>
        </div>

        {/* 批量操作按钮 - 只在有错误时显示 */}
        {hasAnyErrors && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpandedAll(!expandedAll)}
            className="text-xs"
            aria-expanded={expandedAll}
            aria-controls="sync-results-list"
          >
            {expandedAll ? (
              <>
                <EyeOff className="h-3 w-3 mr-1" aria-hidden="true" />
                隐藏所有错误
              </>
            ) : (
              <>
                <Eye className="h-3 w-3 mr-1" aria-hidden="true" />
                显示所有错误
              </>
            )}
          </Button>
        )}
      </div>

      {/* 品牌卡片列表 */}
      <div className="space-y-3" id="sync-results-list">
        {results.map((result, index) => (
          <BrandSyncResultCard
            key={`${result.brandName}-${result.totalRecords}-${index}`}
            result={result}
            forceShowErrors={expandedAll && result.errors.length > 0}
          />
        ))}
      </div>
    </div>
  );
}
