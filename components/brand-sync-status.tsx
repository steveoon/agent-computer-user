"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RefreshCw, AlertCircle, CheckCircle } from "lucide-react";
import { BrandSyncManager } from "@/lib/services/brand-sync-manager";
import { useRouter } from "next/navigation";

interface SyncStatus {
  totalMapped: number;
  totalSynced: number;
  missingBrands: string[];
  syncedBrands: string[];
}

/**
 * 品牌同步状态组件
 * 显示当前品牌同步状态，并提供快速同步缺失品牌的功能
 */
export function BrandSyncStatus() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const router = useRouter();

  // 加载同步状态
  const loadSyncStatus = async () => {
    try {
      const status = await BrandSyncManager.getBrandSyncStatus();
      setSyncStatus(status);
    } catch (error) {
      console.error("加载品牌同步状态失败:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSyncStatus();
  }, []);

  // 同步缺失的品牌
  const handleSyncMissingBrands = async () => {
    if (!syncStatus || syncStatus.missingBrands.length === 0) return;

    setIsSyncing(true);
    try {
      const result = await BrandSyncManager.syncMissingBrands();

      if (result.syncedBrands.length > 0) {
        // 重新加载状态
        await loadSyncStatus();
      }

      if (result.failedBrands.length > 0) {
        console.error("部分品牌同步失败:", result.errors);
      }
    } catch (error) {
      console.error("同步品牌失败:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading || !syncStatus) {
    return null;
  }

  const hasMissingBrands = syncStatus.missingBrands.length > 0;

  return (
    <div className="space-y-2">
      {/* 同步状态指示器 */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">品牌同步状态:</span>
        <Badge variant={hasMissingBrands ? "secondary" : "default"}>
          {syncStatus.totalSynced} / {syncStatus.totalMapped}
        </Badge>
        {hasMissingBrands && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleSyncMissingBrands}
            disabled={isSyncing}
            className="h-6 px-2"
          >
            {isSyncing ? (
              <>
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                同步中...
              </>
            ) : (
              <>
                <RefreshCw className="h-3 w-3 mr-1" />
                同步缺失品牌
              </>
            )}
          </Button>
        )}
      </div>

      {/* 缺失品牌提示 */}
      {hasMissingBrands && (
        <Alert className="py-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <div className="font-medium mb-1">
              发现 {syncStatus.missingBrands.length} 个品牌尚未同步
            </div>
            <div className="text-muted-foreground">
              缺失品牌: {syncStatus.missingBrands.join("、")}
            </div>
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                variant="default"
                onClick={handleSyncMissingBrands}
                disabled={isSyncing}
              >
                立即同步
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push("/admin/settings/sync")}
              >
                前往同步管理
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* 全部同步完成提示 */}
      {!hasMissingBrands && (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle className="h-4 w-4" />
          <span>所有品牌数据已同步</span>
        </div>
      )}
    </div>
  );
}
