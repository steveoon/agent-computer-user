"use client";

import { Analytics } from "@vercel/analytics/react";
import { useEffect, useState } from "react";

/**
 * Vercel Analytics 包装组件
 * 只在非 Electron 环境（即 Vercel 部署环境）中加载 Analytics
 */
export function VercelAnalytics() {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    // 检测是否在 Electron 环境中
    const isElectron =
      typeof window !== "undefined" && window.electronApi?.isElectron === true;

    // 只在非 Electron 环境中加载 Analytics
    if (!isElectron) {
      setShouldRender(true);
    }
  }, []);

  if (!shouldRender) {
    return null;
  }

  return <Analytics />;
}
