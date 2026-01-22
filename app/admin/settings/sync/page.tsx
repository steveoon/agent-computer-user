"use client";

import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, CheckCircle, XCircle, Database } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { useSyncStore, formatDuration } from "@/lib/stores/sync-store";
import { BrandSelector } from "@/components/admin/sync/brand-selector";
import { SyncProgress } from "@/components/admin/sync/sync-progress";
import { SyncHistory } from "@/components/admin/sync/sync-history";
import { SyncErrorDisplay } from "@/components/sync/sync-error-display";

export default function SyncPage() {
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
    <div className="relative min-h-screen w-full bg-background">
      {/* 背景光斑效果 - 固定定位 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="bg-blob bg-blob-1" />
        <div className="bg-blob bg-blob-2" />
        <div className="bg-blob bg-blob-3" />
      </div>

      <div className="relative z-10 container mx-auto p-6 max-w-6xl">
        {/* 页面头部 */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <BackButton size="sm" className="flex items-center gap-2" title="返回设置" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">数据同步管理</h1>
              <p className="text-muted-foreground mt-2">
                从 Duliday API 同步品牌和门店数据到本地数据库
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 左侧：配置与操作 (1/3 宽度) */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="flex flex-col h-full glass-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Database className="h-5 w-5 text-primary" />
                  同步配置
                </CardTitle>
                <CardDescription>选择品牌并开始同步</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 space-y-6">
                <BrandSelector />

                <Separator />

                <div className="space-y-4">
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

                  {isSyncing && (
                    <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>总进度</span>
                        <span>{overallProgress.toFixed(1)}%</span>
                      </div>
                      <Progress value={overallProgress} className="h-2" />
                      <p className="text-xs text-muted-foreground truncate">{currentStep}</p>
                    </div>
                  )}
                </div>

                <div className="text-xs text-muted-foreground space-y-2 pt-2 border-t">
                  <div className="font-medium text-foreground">同步说明：</div>
                  <div className="flex gap-2">
                    <span className="text-primary">•</span>
                    <span>数据单向从 Duliday 拉取</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-primary">•</span>
                    <span>自动合并新门店和岗位</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-primary">•</span>
                    <span>同步后自动进行地理编码</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 右侧：进度与历史 (2/3 宽度) */}
          <div className="lg:col-span-8 space-y-6">
            {/* 错误信息 */}
            {error && (
              <Card className="border-red-200 bg-red-50/50 glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-red-600 flex items-center gap-2 text-base">
                    <XCircle className="h-5 w-5" />
                    同步错误
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <SyncErrorDisplay error={error} />
                </CardContent>
              </Card>
            )}

            {/* 同步进度与结果 */}
            {(isSyncing || currentSyncResult) && (
              <Card className="glass-card">
                <CardHeader className="pb-3 border-b bg-muted/20">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      {isSyncing ? (
                        <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                      ) : currentSyncResult?.overallSuccess ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                      {isSyncing ? "同步进行中" : "本次同步结果"}
                    </CardTitle>
                    <div className="text-sm text-muted-foreground">
                      {isSyncing
                        ? `正在处理 ${selectedBrands.length} 个品牌`
                        : formatDuration(currentSyncResult?.totalDuration || 0)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <SyncProgress />
                </CardContent>
              </Card>
            )}

            {/* 同步历史记录 */}
            <SyncHistory />
          </div>
        </div>
      </div>
    </div>
  );
}
