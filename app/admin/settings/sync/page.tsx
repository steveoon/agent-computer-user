"use client";

import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Database,
  TrendingUp,
  Store,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useSyncStore, formatDuration } from "@/lib/stores/sync-store";
import { BrandSelector } from "@/components/admin/sync/brand-selector";
import { SyncProgress } from "@/components/admin/sync/sync-progress";
import { SyncHistory } from "@/components/admin/sync/sync-history";
import { SyncErrorDisplay } from "@/components/sync/sync-error-display";
import { BrandSyncResultCard } from "@/components/admin/sync/brand-sync-result-card";

export default function SyncPage() {
  const router = useRouter();

  const {
    isSyncing,
    currentStep,
    overallProgress,
    selectedBrands,
    currentSyncResult,
    error,
    startSync,
    loadSyncHistory,
    reset,
  } = useSyncStore();

  // 加载同步历史
  useEffect(() => {
    loadSyncHistory();
  }, [loadSyncHistory]);

  const handleStartSync = async () => {
    reset();
    await startSync();
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* 页面头部 */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            返回设置
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">数据同步管理</h1>
            <p className="text-muted-foreground mt-2">
              从 Duliday API 同步品牌和门店数据到本地数据库
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：同步控制面板 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 品牌选择 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                选择同步品牌
              </CardTitle>
              <CardDescription>选择需要同步的品牌数据，支持多选</CardDescription>
            </CardHeader>
            <CardContent>
              <BrandSelector />
            </CardContent>
          </Card>

          {/* 同步进度 */}
          {(isSyncing || currentSyncResult) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {isSyncing ? (
                    <RefreshCw className="h-5 w-5 animate-spin" />
                  ) : currentSyncResult?.overallSuccess ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                  同步进度
                </CardTitle>
                <CardDescription>
                  {isSyncing
                    ? `正在同步 ${selectedBrands.length} 个品牌的数据...`
                    : currentSyncResult?.overallSuccess
                      ? "同步已成功完成"
                      : "同步过程中发生错误"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SyncProgress />
              </CardContent>
            </Card>
          )}

          {/* 同步结果详情 */}
          {currentSyncResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  同步结果详情
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 总体统计 - 使用 shadcn/ui 配色 */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="relative p-3 bg-slate-50 dark:bg-slate-900/20 rounded-lg border border-slate-200 dark:border-slate-800">
                    <Database className="absolute top-3 left-3 h-4 w-4 text-slate-500 dark:text-slate-400" />
                    <div className="ml-6">
                      <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                        {currentSyncResult.results.length}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400">品牌</div>
                    </div>
                  </div>
                  
                  <div className="relative p-3 bg-violet-50 dark:bg-violet-900/20 rounded-lg border border-violet-200 dark:border-violet-800">
                    <Store className="absolute top-3 left-3 h-4 w-4 text-violet-500 dark:text-violet-400" />
                    <div className="ml-6">
                      <div className="text-2xl font-bold text-violet-900 dark:text-violet-100">
                        {currentSyncResult.results.reduce((sum, r) => sum + r.storeCount, 0)}
                      </div>
                      <div className="text-xs text-violet-600 dark:text-violet-400">门店</div>
                    </div>
                  </div>
                  
                  <div className="relative p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle className="absolute top-3 left-3 h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                    <div className="ml-6">
                      <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                        {currentSyncResult.results.reduce((sum, r) => sum + r.processedRecords, 0)}
                      </div>
                      <div className="text-xs text-emerald-600 dark:text-emerald-400">成功岗位</div>
                    </div>
                  </div>
                  
                  <div className="relative p-3 bg-rose-50 dark:bg-rose-900/20 rounded-lg border border-rose-200 dark:border-rose-800">
                    <XCircle className="absolute top-3 left-3 h-4 w-4 text-rose-500 dark:text-rose-400" />
                    <div className="ml-6">
                      <div className="text-2xl font-bold text-rose-900 dark:text-rose-100">
                        {currentSyncResult.results.reduce((sum, r) => sum + (r.totalRecords - r.processedRecords), 0)}
                      </div>
                      <div className="text-xs text-rose-600 dark:text-rose-400">失败岗位</div>
                    </div>
                  </div>
                  
                  <div className="relative p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <Clock className="absolute top-3 left-3 h-4 w-4 text-amber-500 dark:text-amber-400" />
                    <div className="ml-6">
                      <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                        {formatDuration(currentSyncResult.totalDuration)}
                      </div>
                      <div className="text-xs text-amber-600 dark:text-amber-400">总耗时</div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* 使用新的品牌同步结果卡片组件 */}
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    各品牌同步详情
                  </h4>
                  <div className="space-y-3">
                    {currentSyncResult.results.map((result, index) => (
                      <BrandSyncResultCard 
                        key={index} 
                        result={result} 
                        index={index}
                      />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 错误信息 */}
          {error && (
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="text-red-600 flex items-center gap-2">
                  <XCircle className="h-5 w-5" />
                  同步错误
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-red-700 bg-red-50 p-4 rounded-lg">
                  <SyncErrorDisplay error={error} />
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* 右侧：操作面板和历史记录 */}
        <div className="space-y-6">
          {/* 操作面板 */}
          <Card>
            <CardHeader>
              <CardTitle>操作面板</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={handleStartSync}
                disabled={isSyncing || selectedBrands.length === 0}
                className="w-full"
                size="lg"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    同步中...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    开始同步
                  </>
                )}
              </Button>

              {selectedBrands.length === 0 && (
                <p className="text-sm text-muted-foreground text-center">请至少选择一个品牌</p>
              )}

              {isSyncing && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>总进度</span>
                    <span>{overallProgress}%</span>
                  </div>
                  <Progress value={overallProgress} className="w-full" />
                  <p className="text-sm text-muted-foreground">{currentStep}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 同步说明 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                同步说明
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div>• 数据同步是单向操作，只从 Duliday 拉取数据</div>
              <div>• 同步会自动合并新的门店和岗位信息</div>
              <div>• 现有的品牌配置和模板不会被覆盖</div>
              <div>• 建议在业务低峰期进行大批量同步</div>
              <div>• 同步过程可能需要几分钟时间，请耐心等待</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 同步历史记录 */}
      <div className="mt-8">
        <SyncHistory />
      </div>
    </div>
  );
}
