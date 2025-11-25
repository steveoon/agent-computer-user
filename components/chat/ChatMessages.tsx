"use client";

import { PreviewMessage } from "@/components/message";
import { ProjectInfo } from "@/components/project-info";
import type { UIMessage } from "@ai-sdk/react";

interface ChatMessagesProps {
  messages: UIMessage[];
  isLoading: boolean;
  status: "ready" | "error" | "submitted" | "streaming";
  containerRef: React.RefObject<HTMLDivElement | null>;
  endRef: React.RefObject<HTMLDivElement | null>;
  // HITL: 工具确认相关
  addToolOutput?: (params: {
    toolCallId: string;
    tool: string;
    output: string;
  }) => Promise<void>;
  sendMessage?: () => void;
}

export function ChatMessages({
  messages,
  isLoading,
  status,
  containerRef,
  endRef,
  addToolOutput,
  sendMessage,
}: ChatMessagesProps) {
  return (
    <div className="flex-1 space-y-6 py-4 overflow-y-auto px-4" ref={containerRef}>
      {messages.length === 0 ? <ProjectInfo /> : null}
      {messages.map((message, i) => (
        <PreviewMessage
          message={message}
          key={message.id}
          isLoading={isLoading}
          status={status}
          isLatestMessage={i === messages.length - 1}
          addToolOutput={addToolOutput}
          sendMessage={sendMessage}
        />
      ))}
      <div ref={endRef} className="pb-2" />
    </div>
  );
}
