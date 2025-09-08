"use client";

import { ChatPanel } from "./ChatPanel";
import type { UIMessage } from "@ai-sdk/react";
import type { ModelId } from "@/lib/config/models";

interface MobileChatLayoutProps {
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

  // 来自其他地方
  currentBrand?: string;
  sandboxStatus: "running" | "paused" | "unknown";
  isInitializing: boolean;
  isAuthenticated: boolean;
  chatModel: ModelId;
  classifyModel: ModelId;
  replyModel: ModelId;
}

export function MobileChatLayout(props: MobileChatLayoutProps) {
  return (
    <div className="w-full lg:hidden flex flex-col h-full">
      <ChatPanel {...props} />
    </div>
  );
}
