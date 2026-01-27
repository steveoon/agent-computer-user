"use client";

import { useConfigMigration } from "@/hooks/useConfigMigration";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Info, X } from "lucide-react";
import Link from "next/link";

const DISMISS_KEY = "duliday_token_warning_dismissed";

/**
 * 🔧 配置初始化组件
 * 在应用启动时自动处理配置数据迁移
 */
export function ConfigInitializer() {
  const { isSuccess, isError, error, tokenMissingWarning } = useConfigMigration();
  const [isDismissed, setIsDismissed] = useState(true); // 默认隐藏，避免闪烁

  // 检查是否已关闭过提示
  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISS_KEY);
    setIsDismissed(dismissed === "true");
  }, []);

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
