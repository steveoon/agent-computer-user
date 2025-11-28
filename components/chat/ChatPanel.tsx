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

  // 🎯 检查是否为请求过大错误
  const isPayloadTooLargeError = (error: Error | undefined) => {
    if (!error) return false;
    return (
      error.message.includes("Request Entity Too Large") ||
      error.message.includes("FUNCTION_PAYLOAD_TOO_LARGE") ||
      error.message.includes("Payload Too Large") ||
      error.message.includes("413")
    );
  };

  // 🎯 检查是否为服务过载错误
  const isOverloadedError = (error: Error | undefined) => {
    if (!error) return false;
    return error.message.includes("AI服务当前负载过高");
  };

  // 🎯 检查是否为频率限制错误
  const isRateLimitError = (error: Error | undefined) => {
    if (!error) return false;
    return error.message.includes("请求频率过高");
  };

  // 🎯 获取错误标题
  const getErrorTitle = (error: Error | undefined) => {
    if (isPayloadTooLargeError(error)) return "请求内容过大";
    if (isOverloadedError(error)) return "服务繁忙";
    if (isRateLimitError(error)) return "请求过于频繁";
    return "Something went wrong";
  };

  // 🎯 获取错误描述
  const getErrorDescription = (error: Error | undefined) => {
    if (isPayloadTooLargeError(error)) {
      return "对话历史过长，请清理部分消息后重试";
    }
    if (isOverloadedError(error)) {
      return "AI服务当前负载较高，请稍后重试";
    }
    if (isRateLimitError(error)) {
      return "您的请求过于频繁，请稍后再试";
    }
    return "Please try again. If the problem persists, refresh the page.";
  };

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
        {error && (
          <div className="mx-4 mb-4">
            <div
              className={`border rounded-lg p-3 ${
                isOverloadedError(error) || isRateLimitError(error)
                  ? "bg-yellow-50 border-yellow-200"
                  : "bg-red-50 border-red-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      isOverloadedError(error) || isRateLimitError(error)
                        ? "bg-yellow-500"
                        : "bg-red-500"
                    }`}
                  ></div>
                  <span
                    className={`text-sm font-medium ${
                      isOverloadedError(error) || isRateLimitError(error)
                        ? "text-yellow-700"
                        : "text-red-700"
                    }`}
                  >
                    {getErrorTitle(error)}
                  </span>
                </div>
                <div className="flex gap-2">
                  {isPayloadTooLargeError(error) && (
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
                      isOverloadedError(error) || isRateLimitError(error)
                        ? "border-yellow-200 text-yellow-700 hover:bg-yellow-50"
                        : "border-red-200 text-red-700 hover:bg-red-50"
                    }`}
                  >
                    {isOverloadedError(error) || isRateLimitError(error) ? "稍后重试" : "Retry"}
                  </Button>
                </div>
              </div>
              <p
                className={`text-xs mt-1 ${
                  isOverloadedError(error) || isRateLimitError(error)
                    ? "text-yellow-600"
                    : "text-red-600"
                }`}
              >
                {getErrorDescription(error)}
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
