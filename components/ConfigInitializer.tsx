"use client";

import { useConfigMigration } from "@/hooks/useConfigMigration";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Info, ShieldAlert, X } from "lucide-react";
import Link from "next/link";
import { useSyncStore } from "@/lib/stores/sync-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { usePathname, useRouter } from "next/navigation";
import { AuthDialog } from "@/components/auth-dialog";

const DISMISS_KEY = "duliday_token_warning_dismissed";

/**
 * 🔧 配置初始化组件
 * 在应用启动时自动处理配置数据迁移
 */
export function ConfigInitializer() {
  const { isSuccess, isError, error, tokenMissingWarning } = useConfigMigration();
  const [isDismissed, setIsDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(DISMISS_KEY) === "true";
  });
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const isMigrationBlocked = useSyncStore(state => state.isMigrationBlocked);
  const migrationBlockReason = useSyncStore(state => state.migrationBlockReason);
  const isSyncing = useSyncStore(state => state.isSyncing);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const isAuthLoading = useAuthStore(state => state.isLoading);

  useEffect(() => {
    if (isSuccess) {
      console.log("✅ 应用配置初始化完成");
    }

    if (isError && error) {
      console.error("❌ 应用配置初始化失败:", error);
    }
  }, [isSuccess, isError, error]);

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem(DISMISS_KEY, "true");
  };

  const requireAuth = (): boolean => {
    if (isAuthenticated) return true;
    setAuthDialogOpen(true);
    return false;
  };

  const handleGoToSettings = () => {
    if (!requireAuth()) return;
    router.push("/admin/settings");
  };

  const handleGoToSync = () => {
    if (!requireAuth()) return;
    router.push("/admin/settings/sync");
  };

  const handleResetAndSync = () => {
    if (!requireAuth()) return;
    useSyncStore.getState().resetLocalBrandDataAndSync().catch(() => undefined);
    router.push("/admin/settings/sync");
  };

  const allowMigrationBypass = pathname?.startsWith("/admin/settings");

  if (isMigrationBlocked && !allowMigrationBypass) {
    const blockMessage = !isAuthenticated
      ? "当前登录态已失效。为了执行数据版本升级产生的强制全量同步，请先登录。登录后可继续配置 Duliday Token、进入同步管理，或清空本地品牌数据并重新同步。"
      : migrationBlockReason ||
        "检测到旧版本配置，需要完成全量同步后才能继续使用。部分品牌失败不会阻断使用，可后续单独重试。";

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="w-full max-w-xl mx-4 rounded-lg border bg-card p-6 shadow-lg">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-red-500" />
            <h2 className="text-lg font-semibold text-foreground">数据迁移未完成</h2>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{blockMessage}</p>
          <div className="mt-5 flex flex-col gap-2">
            {!isAuthenticated ? (
              <Button onClick={() => setAuthDialogOpen(true)} disabled={isAuthLoading}>
                {isAuthLoading ? "检查登录状态..." : "先登录后同步"}
              </Button>
            ) : (
              <>
                <Button variant="secondary" onClick={handleGoToSettings}>
                  前往通用配置设置 Token
                </Button>
                <Button onClick={handleResetAndSync} disabled={isSyncing}>
                  {isSyncing ? "同步进行中..." : "清空本地品牌数据并重试同步"}
                </Button>
                <Button variant="outline" onClick={handleGoToSync} disabled={isSyncing}>
                  前往同步管理
                </Button>
              </>
            )}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            {isAuthenticated
              ? "若仍无法同步，可手动清理浏览器存储（localStorage / IndexedDB）后刷新页面重试。"
              : "登录成功后，此页面会继续显示强制同步操作。"}
          </p>
        </div>
        <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
      </div>
    );
  }

  // 显示 Token 缺失提示（可关闭的顶部横条）
  if (tokenMissingWarning && !isDismissed) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-blue-50 dark:bg-blue-950 border-b border-blue-200 dark:border-blue-800">
        <div className="flex items-center justify-center gap-2 px-4 py-1.5 text-sm">
          <Info className="h-4 w-4 text-blue-500 shrink-0" />
          <span className="text-blue-700 dark:text-blue-300">
            如需同步品牌数据，请先
            <Link
              href="/admin/settings"
              className="text-blue-600 dark:text-blue-400 hover:underline mx-1 font-medium"
            >
              配置 Duliday Token
            </Link>
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 ml-2 text-blue-500 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900"
            onClick={handleDismiss}
            aria-label="关闭提示"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
