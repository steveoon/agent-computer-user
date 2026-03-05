"use client";

import type { UIMessage } from "@ai-sdk/react";
import { AnimatePresence, motion } from "motion/react";
import { memo, type ReactNode } from "react";
import equal from "fast-deep-equal";
import { cn } from "@/lib/utils";
import { MessagePartsAdapter } from "./message-parts-adapter";

// 🎨 气泡主题定义
interface BubbleTheme {
  name: string;
  wrapperClass: string;
  bubbleClass: string;
  textClass: string;
  decoration?: ReactNode;
}

// 🎄 圣诞主题配置
const CHRISTMAS_THEME: BubbleTheme = {
  name: "christmas",
  wrapperClass: "relative group/bubble",
  bubbleClass:
    "max-w-lg bg-gradient-to-br from-red-50/90 via-white/90 to-green-50/90 dark:from-red-950/30 dark:via-zinc-900/50 dark:to-green-950/30 px-4 py-3 rounded-2xl border border-red-100/60 dark:border-red-900/30 shadow-[0_4px_15px_-3px_rgba(239,68,68,0.1)] dark:shadow-none",
  textClass:
    "prose dark:prose-invert text-zinc-800 dark:text-zinc-100 text-base font-medium leading-relaxed",
  decoration: (
    <div className="absolute -top-3 -left-2 w-7 h-7 rotate-[-10deg] z-10 pointer-events-none drop-shadow-sm filter hover:scale-110 transition-transform cursor-default">
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Hat Body */}
        <path
          d="M16 2C12 2 9 6 8 9C8 9 4 14 6 18C5 18 4 19 4 20C4 21 5 22 7 22H25C27 22 28 21 28 20C28 19 27 18 26 18C28 14 27 9 27 9C26 7 24 4 16 2Z"
          fill="#EF4444"
        />
        {/* Pom Pom */}
        <circle cx="27" cy="9" r="2.5" fill="white" />
        {/* Hat Trim */}
        <path
          d="M6 18H26C27 18 28 18.5 28 19.5C28 20.5 27 21 26 21H6C5 21 4 20.5 4 19.5C4 18.5 5 18 6 18Z"
          fill="white"
        />
        {/* Face */}
        <path d="M10 18V24C10 27.31 12.69 30 16 30C19.31 30 22 27.31 22 24V18" fill="#FEE2E2" />
        {/* Beard */}
        <path
          d="M8 22C8 22 8 26 12 28C11 29 14 31 16 31C18 31 21 29 20 28C24 26 24 22 24 22"
          fill="white"
        />
        {/* Sunglasses/Eyes */}
        <circle cx="13" cy="23" r="1.5" fill="#1F2937" />
        <circle cx="19" cy="23" r="1.5" fill="#1F2937" />
        {/* Nose */}
        <circle cx="16" cy="24.5" r="1.2" fill="#FCA5A5" />
      </svg>
    </div>
  ),
};

// 当前使用的主题
const currentTheme = CHRISTMAS_THEME;

const PurePreviewMessage = ({
  message,
  isLatestMessage,
  status,
  addToolOutput,
  sendMessage,
}: {
  message: UIMessage;
  isLoading: boolean;
  status: "error" | "submitted" | "streaming" | "ready";
  isLatestMessage: boolean;
  // HITL: 工具确认相关
  addToolOutput?: (params: { toolCallId: string; tool: string; output: unknown }) => Promise<void>;
  sendMessage?: () => void;
}) => {
  return (
    <AnimatePresence key={message.id}>
      <motion.div
        className="w-full mx-auto px-4 group/message"
        initial={{ y: 5, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        key={`message-${message.id}`}
        data-role={message.role}
      >
        <div
          className={cn(
            "flex gap-4 rounded-xl",
            message.role === "user" ? "justify-end pt-5" : "justify-start pt-2"
          )}
        >
          {message.role === "assistant" && (
            <div className="flex flex-col w-full space-y-2">
              <MessagePartsAdapter
                message={message}
                isLatestMessage={isLatestMessage}
                status={status}
                addToolOutput={addToolOutput}
                sendMessage={sendMessage}
              />
            </div>
          )}

          {message.role === "user" && (
            <div className={currentTheme.wrapperClass}>
              {/* Theme Decoration */}
              {currentTheme.decoration}

              <div className={currentTheme.bubbleClass}>
                <div className={currentTheme.textClass}>
                  {message.parts && message.parts.length > 0 && message.parts[0].type === "text"
                    ? message.parts[0].text
                    : ""}
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export const PreviewMessage = memo(PurePreviewMessage, (prevProps, nextProps) => {
  if (prevProps.isLatestMessage !== nextProps.isLatestMessage) return false;
  if (prevProps.status !== nextProps.status) return false;

  // 对于正在流式传输的 assistant 消息，总是重新渲染
  if (
    nextProps.isLatestMessage &&
    nextProps.message.role === "assistant" &&
    (nextProps.status === "streaming" || nextProps.status === "submitted")
  ) {
    return false; // 不相等，触发重新渲染
  }

  // 比较消息内容是否相同
  // 特别检查 parts 数组的变化
  if (prevProps.message.parts && nextProps.message.parts) {
    if (prevProps.message.parts.length !== nextProps.message.parts.length) {
      return false; // parts 数量变化，重新渲染
    }

    // 检查每个 part 的内容
    for (let i = 0; i < prevProps.message.parts.length; i++) {
      const prevPart = prevProps.message.parts[i];
      const nextPart = nextProps.message.parts[i];

      // 如果是文本 part，检查文本内容
      if (prevPart.type === "text" && nextPart.type === "text") {
        if (prevPart.text !== nextPart.text) {
          return false; // 文本内容变化，重新渲染
        }
      }
    }
  }

  return equal(prevProps.message, nextProps.message);
});

export function Messages({
  messages,
  isLoading,
  status,
}: {
  messages: UIMessage[];
  isLoading: boolean;
  status: "error" | "submitted" | "streaming" | "ready";
}) {
  return (
    <div className="flex flex-col gap-0 h-full">
      {messages.map((message, index) => (
        <PreviewMessage
          key={message.id}
          message={message}
          isLoading={isLoading}
          status={status}
          isLatestMessage={index === messages.length - 1}
        />
      ))}
    </div>
  );
}
