"use client";

import { Suspense } from "react";
import { DesktopStream } from "@/components/desktop/DesktopStream";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { MobileChatLayout } from "@/components/chat/MobileChatLayout";
import { AuthToastHandler } from "@/components/auth-toast-handler";
import { useDesktopSandbox } from "@/hooks/useDesktopSandbox";
import { useCustomChat } from "@/hooks/useCustomChat";
import { useBrand } from "@/lib/contexts/brand-context";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useModelConfig } from "@/lib/stores/model-config-store";
import { StorageDebug } from "@/components/storage-debug";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

/**
 * 🏠 主聊天界面组件（内部实现）
 */
function ChatPageContent() {
  // 🔐 用户认证状态
  const { isAuthenticated } = useAuthStore();

  // 🏪 品牌管理
  const { currentBrand } = useBrand();

  // 🤖 模型配置
  const { chatModel, classifyModel, replyModel } = useModelConfig();

  // 使用桌面沙盒 Hook
  const desktop = useDesktopSandbox();

  // 使用自定义聊天 Hook
  const chat = useCustomChat({
    sandboxId: desktop.sandboxId,
    sandboxStatus: desktop.sandboxStatus,
  });

  // 聊天面板的通用 props
  const chatPanelProps = {
    ...chat,
    currentBrand,
    sandboxStatus: desktop.sandboxStatus,
    isInitializing: desktop.isInitializing,
    isAuthenticated,
    chatModel,
    classifyModel,
    replyModel,
  };

  return (
    <>
      {/* 认证 Toast 处理 */}
      <Suspense fallback={null}>
        <AuthToastHandler />
      </Suspense>

      <div className="flex h-dvh relative">
        {/* Mobile/tablet banner */}
        <div className="flex items-center justify-center fixed left-1/2 -translate-x-1/2 top-5 shadow-md text-xs mx-auto rounded-lg h-8 w-fit bg-blue-600 text-white px-3 py-2 text-left z-50 lg:hidden">
          <span>Headless mode</span>
        </div>

        {/* Resizable Panels - Desktop View */}
        <div className="w-full hidden lg:block">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            {/* Desktop Stream Panel */}
            <ResizablePanel
              defaultSize={60}
              minSize={40}
              className="bg-black relative items-center justify-center"
            >
              <DesktopStream
                streamUrl={desktop.streamUrl}
                sandboxStatus={desktop.sandboxStatus}
                isInitializing={desktop.isInitializing}
                isPausing={desktop.isPausing}
                isAuthenticated={isAuthenticated}
                manualInit={desktop.manualInit}
                onRefresh={desktop.refreshDesktop}
                onPause={desktop.pauseDesktop}
                onResume={desktop.resumeDesktop}
                onInitialize={desktop.initializeDesktop}
                setManualInit={desktop.setManualInit}
              />
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Chat Interface Panel */}
            <ResizablePanel defaultSize={30} minSize={25}>
              <ChatPanel {...chatPanelProps} />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

        {/* Mobile View (Chat Only) */}
        <MobileChatLayout {...chatPanelProps} />

        {/* Debug component - remove in production */}
        {process.env.NODE_ENV === "development" && <StorageDebug />}
      </div>
    </>
  );
}

/**
 * 🏠 主聊天界面组件（导出）
 *
 * 集成了桌面沙盒、AI助手对话、飞书通知等功能
 * 支持智能载荷管理、任务状态监控和自动通知推送
 */
export default function ChatPageWrapper() {
  return <ChatPageContent />;
}
