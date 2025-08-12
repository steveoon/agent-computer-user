"use client";

import type { UIMessage } from "@ai-sdk/react";
import { AnimatePresence, motion } from "motion/react";
import { memo } from "react";
import equal from "fast-deep-equal";
import { cn } from "@/lib/utils";
import { MessagePartsAdapter } from "./message-parts-adapter";

const PurePreviewMessage = ({
  message,
  isLatestMessage,
  status,
}: {
  message: UIMessage;
  isLoading: boolean;
  status: "error" | "submitted" | "streaming" | "ready";
  isLatestMessage: boolean;
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
            message.role === "user"
              ? "justify-end pt-5"
              : "justify-start pt-2"
          )}
        >
          {message.role === "assistant" && (
            <div className="flex flex-col w-full space-y-2">
              <MessagePartsAdapter
                message={message}
                isLatestMessage={isLatestMessage}
                status={status}
              />
            </div>
          )}

          {message.role === "user" && (
            <div className="max-w-lg bg-zinc-100 dark:bg-zinc-800 px-3 py-2 rounded-md">
              <div className="prose dark:prose-invert text-zinc-900 dark:text-zinc-50">
                {message.parts && message.parts.length > 0 && message.parts[0].type === "text" 
                  ? message.parts[0].text 
                  : ""}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps, nextProps) => {
    if (prevProps.isLatestMessage !== nextProps.isLatestMessage) return false;
    if (prevProps.status !== nextProps.status) return false;
    
    // 对于正在流式传输的 assistant 消息，总是重新渲染
    if (
      nextProps.isLatestMessage && 
      nextProps.message.role === 'assistant' && 
      (nextProps.status === 'streaming' || nextProps.status === 'submitted')
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
        if (prevPart.type === 'text' && nextPart.type === 'text') {
          if (prevPart.text !== nextPart.text) {
            return false; // 文本内容变化，重新渲染
          }
        }
      }
    }
    
    return equal(prevProps.message, nextProps.message);
  }
);

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