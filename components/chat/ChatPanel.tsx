"use client";

import { ChatHeader } from "./ChatHeader";
import { ChatMessages } from "./ChatMessages";
import { ChatInputForm } from "./ChatInputForm";
import { ChatStatusBar } from "./ChatStatusBar";
import { useScrollToBottom } from "@/lib/use-scroll-to-bottom";
import { Button } from "@/components/ui/button";
import type { UIMessage } from "@ai-sdk/react";
import type { ModelId } from "@/lib/config/models";
import type { FinishReason } from "@/types";
import { ErrorBoundary } from "@/components/ui/error-boundary";

// 🎯 错误处理策略模式 - 提取到组件外部避免重渲染时重新创建
interface ErrorMatcher {
  readonly test: (msg: string) => boolean;
  readonly title: string;
  readonly description: string;
  readonly variant: "error" | "warning";
  readonly showSmartClean?: boolean;
}

const ERROR_MATCHERS: readonly ErrorMatcher[] = [
  {
    test: (msg: string) =>
      msg.includes("Request Entity Too Large") ||
      msg.includes("FUNCTION_PAYLOAD_TOO_LARGE") ||
      msg.includes("Payload Too Large") ||
      msg.includes("413"),
    title: "请求内容过大",
    description: "对话历史过长，请清理部分消息后重试",
    variant: "error",
    showSmartClean: true,
  },
  {
    test: (msg: string) => msg.includes("AI服务当前负载过高"),
    title: "服务繁忙",
    description: "AI服务当前负载较高，请稍后重试",
    variant: "warning",
  },
  {
    test: (msg: string) => msg.includes("请求频率过高"),
    title: "请求过于频繁",
    description: "您的请求过于频繁，请稍后再试",
    variant: "warning",
  },
] as const;

const DEFAULT_ERROR: Omit<ErrorMatcher, "test"> = {
  title: "Something went wrong",
  description: "Please try again. If the problem persists, refresh the page.",
  variant: "error",
};

function getErrorInfo(error: Error | undefined): (Omit<ErrorMatcher, "test"> & { showSmartClean?: boolean }) | null {
  if (!error) return null;
  const msg = error.message;
  const matched = ERROR_MATCHERS.find(m => m.test(msg));
  return matched ?? DEFAULT_ERROR;
}

interface ChatPanelProps {
  // 来自 useCustomChat
  messages: UIMessage[];
  input: string;
  status: "ready" | "error" | "submitted" | "streaming";
  error: Error | undefined;
  isLoading: boolean;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  stop: () => void;
  append: (message: { role: "user"; content: string }) => void;
  reload: () => void;
  clearMessages: () => void;
  smartClean: () => void;
  envInfo: {
    environment: string;
    description: string;
  };
  lastFinishReason?: FinishReason;
  // HITL: 工具确认相关
  addToolOutput?: (params: { toolCallId: string; tool: string; output: string }) => Promise<void>;
  sendMessage?: () => void;

  // 来自其他地方
  currentBrand?: string;
  sandboxStatus: "running" | "paused" | "unknown";
  isInitializing: boolean;
  isAuthenticated: boolean;
  chatModel: ModelId;
  classifyModel: ModelId;
  replyModel: ModelId;
  isDesktopCollapsed?: boolean;
  onToggleDesktop?: () => void;
}

export function ChatPanel({
  messages,
  input,
  status,
  error,
  isLoading,
  handleInputChange,
  handleSubmit,
  stop,
  append,
  reload,
  clearMessages,
  smartClean,
  envInfo,
  lastFinishReason,
  addToolOutput,
  sendMessage,
  currentBrand,
  sandboxStatus,
  isInitializing,
  isAuthenticated,
  chatModel,
  classifyModel,
  replyModel,
  isDesktopCollapsed,
  onToggleDesktop,
}: ChatPanelProps) {
  const [containerRef, endRef] = useScrollToBottom();

  // 🎯 使用策略模式获取错误信息（函数引用稳定，不会导致重渲染）
  const errorInfo = getErrorInfo(error);
  const isWarning = errorInfo?.variant === "warning";

  return (
    <ErrorBoundary>
      <div className="flex flex-col border-l border-white/20 h-full glass bg-white/40">
        <ChatHeader
          currentBrand={currentBrand}
          messagesCount={messages.length}
          sandboxStatus={sandboxStatus}
          isLoading={isLoading}
          chatModel={chatModel}
          classifyModel={classifyModel}
          replyModel={replyModel}
          envInfo={envInfo}
          onSmartClean={smartClean}
          onClear={clearMessages}
          isDesktopCollapsed={isDesktopCollapsed}
          onToggleDesktop={onToggleDesktop}
        />

        <ChatMessages
          messages={messages}
          isLoading={isLoading}
          status={status}
          containerRef={containerRef}
          endRef={endRef}
          addToolOutput={addToolOutput}
          sendMessage={sendMessage}
        />

        {/* 错误状态显示 */}
        {errorInfo && (
          <div className="mx-4 mb-4">
            <div
              className={`border rounded-lg p-3 ${
                isWarning ? "bg-yellow-50 border-yellow-200" : "bg-red-50 border-red-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${isWarning ? "bg-yellow-500" : "bg-red-500"}`}
                  ></div>
                  <span
                    className={`text-sm font-medium ${
                      isWarning ? "text-yellow-700" : "text-red-700"
                    }`}
                  >
                    {errorInfo.title}
                  </span>
                </div>
                <div className="flex gap-2">
                  {errorInfo.showSmartClean && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={smartClean}
                      className="text-xs h-7 px-2 border-brand-primary/30 text-brand-primary hover:bg-brand-primary/10"
                    >
                      智能清理
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => reload()}
                    className={`text-xs h-7 px-2 ${
                      isWarning
                        ? "border-yellow-200 text-yellow-700 hover:bg-yellow-50"
                        : "border-red-200 text-red-700 hover:bg-red-50"
                    }`}
                  >
                    {isWarning ? "稍后重试" : "Retry"}
                  </Button>
                </div>
              </div>
              <p className={`text-xs mt-1 ${isWarning ? "text-yellow-600" : "text-red-600"}`}>
                {errorInfo.description}
              </p>
            </div>
          </div>
        )}

        <ChatInputForm
          input={input}
          handleInputChange={handleInputChange}
          handleSubmit={handleSubmit}
          isInitializing={isInitializing}
          isLoading={isLoading}
          status={status}
          stop={stop}
          error={error}
          isAuthenticated={isAuthenticated}
          append={append}
          lastFinishReason={lastFinishReason}
        />

        {/* 状态栏 - 移动端显示 */}
        <div className="flex items-center justify-end px-4 pb-2 xl:hidden">
          <ChatStatusBar isLoading={isLoading} />
        </div>
      </div>
    </ErrorBoundary>
  );
}
