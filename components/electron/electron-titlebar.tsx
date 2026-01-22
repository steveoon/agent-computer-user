"use client";

import { useEffect, useState } from "react";

interface PlatformInfo {
  platform: string;
  arch: string;
  version: string;
}

/**
 * Electron 窗口标题栏
 * 为 macOS 系统按钮（红绿灯）预留空间，并提供窗口拖拽区域
 * 仅在 Electron 环境中渲染
 */
export function ElectronTitlebar() {
  const [isElectron, setIsElectron] = useState(false);
  const [platform, setPlatform] = useState<string>("unknown");

  useEffect(() => {
    // 检测 Electron 环境
    const electronEnv =
      typeof window !== "undefined" && window.electronApi?.isElectron === true;
    setIsElectron(electronEnv);

    // 异步获取平台信息
    if (electronEnv && window.electronApi?.system) {
      const systemApi = window.electronApi.system as {
        getPlatform?: () => Promise<PlatformInfo>;
      };
      if (typeof systemApi.getPlatform === "function") {
        systemApi.getPlatform().then((info) => {
          setPlatform(info.platform);
        });
      }
    }
  }, []);

  // 非 Electron 环境不渲染
  if (!isElectron) {
    return null;
  }

  // macOS 需要为系统按钮预留更多空间
  const isMac = platform === "darwin";

  return (
    <div
      className="electron-titlebar flex-shrink-0 select-none bg-transparent"
      style={{
        height: isMac ? "28px" : "32px",
        // CSS 属性让这个区域可以拖拽窗口
        WebkitAppRegion: "drag",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any}
    >
      {/* macOS: 左侧为系统按钮（红绿灯）留出空间，这个区域不可拖拽 */}
      {isMac && (
        <div
          className="h-full"
          style={{
            width: "70px",
            WebkitAppRegion: "no-drag",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any}
        />
      )}
    </div>
  );
}
