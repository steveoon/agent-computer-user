"use client";

import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  AlertTriangle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useSyncStore, formatDuration, getSyncStatusText } from "@/lib/stores/sync-store";
import { BrandSelector } from "@/components/admin/sync/brand-selector";
import { SyncProgress } from "@/components/admin/sync/sync-progress";
import { SyncHistory } from "@/components/admin/sync/sync-history";
import { SyncErrorDisplay, SyncErrorList } from "@/components/sync/sync-error-display";

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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {currentSyncResult.results.length}
                    </div>
                    <div className="text-sm text-muted-foreground">品牌数量</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {currentSyncResult.results.reduce((sum, r) => sum + r.processedRecords, 0)}
                    </div>
                    <div className="text-sm text-muted-foreground">处理记录</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {currentSyncResult.results.reduce((sum, r) => sum + r.storeCount, 0)}
                    </div>
                    <div className="text-sm text-muted-foreground">门店数量</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {formatDuration(currentSyncResult.totalDuration)}
                    </div>
                    <div className="text-sm text-muted-foreground">总耗时</div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <h4 className="font-medium">各品牌同步状态</h4>
                  {currentSyncResult.results.map((result, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {result.success ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                        <div>
                          <div className="font-medium">{result.brandName}</div>
                          <div className="text-sm text-muted-foreground">
                            {result.processedRecords} 条记录，{result.storeCount} 家门店
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={result.success ? "default" : "destructive"}>
                          {getSyncStatusText(result.success)}
                        </Badge>
                        <div className="text-sm text-muted-foreground mt-1">
                          {formatDuration(result.duration)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 错误信息 */}
                {currentSyncResult.results.some(r => r.errors.length > 0) && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-red-600 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      错误详情
                    </h4>
                    {currentSyncResult.results
                      .filter(r => r.errors.length > 0)
                      .map((result, index) => (
                        <div key={index} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                          <div className="font-medium text-red-900">{result.brandName}</div>
                          <SyncErrorList errors={result.errors} />
                        </div>
                      ))}
                  </div>
                )}
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
