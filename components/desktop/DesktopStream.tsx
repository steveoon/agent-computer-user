"use client";

import { Button } from "@/components/ui/button";
import { Bot } from "lucide-react";

interface DesktopStreamProps {
  streamUrl: string | null;
  sandboxStatus: "running" | "paused" | "unknown";
  isInitializing: boolean;
  isPausing: boolean;
  isAuthenticated: boolean;
  manualInit: boolean;
  onRefresh: () => void;
  onPause: () => void;
  onResume: () => void;
  onInitialize: () => void;
  setManualInit: (manual: boolean) => void;
}

export function DesktopStream({
  streamUrl,
  sandboxStatus,
  isInitializing,
  isPausing,
  isAuthenticated,
  manualInit,
  onRefresh,
  onPause,
  onResume,
  onInitialize,
  setManualInit,
}: DesktopStreamProps) {
  // 未登录状态
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-white p-8">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-6 bg-blue-600/20 rounded-full flex items-center justify-center">
            <Bot className="w-8 h-8 text-blue-400" />
          </div>
          <h2 className="text-xl font-semibold mb-3">AI 助手沙盒环境</h2>
          <p className="text-gray-300 mb-6 leading-relaxed">
            沙盒环境需要用户登录后才能启动。请先登录您的账户以使用完整的 AI 助手功能。
          </p>
          <div className="space-y-3 text-sm text-gray-400">
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
              <span>安全的隔离环境</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span>实时屏幕操作</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
              <span>AI 智能控制</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 已登录且有沙盒
  if (streamUrl) {
    return (
      <>
        <iframe
          src={streamUrl}
          className="w-full h-full"
          style={{
            transformOrigin: "center",
            width: "100%",
            height: "100%",
          }}
          allow="autoplay"
        />
        <Button
          onClick={onRefresh}
          className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white px-3 py-1 rounded text-sm z-10"
          disabled={isInitializing}
        >
          {isInitializing ? "Creating desktop..." : "New desktop"}
        </Button>

        {/* 状态显示和暂停按钮 */}
        <div className="absolute top-2 left-2 flex gap-2 z-10">
          <div
            className={`px-2 py-1 rounded text-xs font-medium ${
              sandboxStatus === "running"
                ? "bg-green-500/80 text-white"
                : sandboxStatus === "paused"
                  ? "bg-yellow-500/80 text-white"
                  : "bg-gray-500/80 text-white"
            }`}
          >
            {sandboxStatus === "running"
              ? "运行中"
              : sandboxStatus === "paused"
                ? "已暂停"
                : "未知状态"}
          </div>

          {sandboxStatus === "running" && (
            <Button
              onClick={onPause}
              className="bg-yellow-500/80 hover:bg-yellow-600/80 text-white px-2 py-1 rounded text-xs"
              disabled={isPausing}
            >
              {isPausing ? "暂停中..." : "暂停"}
            </Button>
          )}

          {sandboxStatus === "paused" && (
            <Button
              onClick={onResume}
              className="bg-blue-500/80 hover:bg-blue-600/80 text-white px-2 py-1 rounded text-xs"
              disabled={isInitializing}
            >
              {isInitializing ? "恢复中..." : "恢复桌面"}
            </Button>
          )}
        </div>
      </>
    );
  }

  // 已登录但沙盒未初始化
  if (manualInit && !streamUrl && !isInitializing) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-white p-8">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-6 bg-green-600/20 rounded-full flex items-center justify-center">
            <Bot className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-xl font-semibold mb-3">准备启动沙盒环境</h2>
          <p className="text-gray-300 mb-6 leading-relaxed">
            点击下方按钮启动远程沙盒环境。如果您只需要使用本地浏览器工具，可以暂时不启动沙盒。
          </p>
          <Button
            onClick={onInitialize}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded"
            disabled={isInitializing}
          >
            {isInitializing ? "正在启动..." : "启动沙盒环境"}
          </Button>
          <div className="mt-4">
            <Button
              onClick={() => setManualInit(false)}
              variant="link"
              className="text-gray-400 hover:text-gray-300 text-sm"
            >
              设置为自动启动
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 已登录且沙盒正在初始化
  return (
    <div className="flex items-center justify-center h-full text-white">
      {isInitializing ? "Initializing desktop..." : "Loading stream..."}
    </div>
  );
}
