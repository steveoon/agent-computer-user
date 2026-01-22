"use client";

import type { UIMessage } from "ai";
import {
  isToolPart,
  getToolPartState,
  extractToolName,
  getToolPartInput,
  getToolPartOutput,
  getToolPartErrorText,
} from "@/types/tool-common";
import { lazyToolRegistry } from "./tool-messages/lazy-registry";
import { LazyToolWrapper } from "./tool-messages/lazy-tool-wrapper";
import { Markdown } from "./markdown";
import type { ReactNode } from "react";

// 🤖 Agent 主题定义
interface AgentTheme {
  name: string;
  wrapperClass: string;
  bubbleClass: string;
  textClass: string;
  decoration?: ReactNode;
}

// 🧊 机器人主题配置
const ROBOT_THEME: AgentTheme = {
  name: "robot_winter",
  wrapperClass: "relative group/agent-bubble mb-3 pl-2",
  bubbleClass:
    "bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/10 rounded-2xl rounded-tl-sm px-5 py-3.5",
  textClass:
    "prose dark:prose-invert text-zinc-600 dark:text-zinc-300 max-w-none text-base font-normal leading-snug prose-p:my-1.5 prose-li:my-0.5",
  decoration: (
    <div className="absolute -top-3 -left-3 w-8 h-8 z-10 pointer-events-none drop-shadow-sm filter hover:scale-110 transition-transform cursor-default">
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Antenna */}
        <path d="M16 2V6" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" />
        <circle cx="16" cy="2" r="1.5" fill="#3B82F6" />
        {/* Head */}
        <rect x="5" y="6" width="22" height="20" rx="6" fill="white" />
        <rect x="5" y="6" width="22" height="20" rx="6" stroke="#EFF6FF" strokeWidth="1" />
        {/* Face Screen */}
        <rect x="8" y="11" width="16" height="10" rx="3" fill="#EBF5FF" />
        {/* Eyes */}
        <circle cx="12" cy="15" r="1.5" fill="#3B82F6" />
        <circle cx="20" cy="15" r="1.5" fill="#3B82F6" />
        {/* Mouth (Smile) */}
        <path
          d="M13 18C13 18 14.5 19.5 16 19.5C17.5 19.5 19 18 19 18"
          stroke="#3B82F6"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        {/* Cheeks */}
        <circle cx="9" cy="16" r="1" fill="#93C5FD" opacity="0.5" />
        <circle cx="23" cy="16" r="1" fill="#93C5FD" opacity="0.5" />
      </svg>
    </div>
  ),
};

// 当前使用的 Agent 主题
const currentAgentTheme = ROBOT_THEME;

interface MessagePartsAdapterProps {
  message: UIMessage;
  isLatestMessage?: boolean;
  status?: string;
  // HITL: 工具确认相关
  addToolOutput?: (params: { toolCallId: string; tool: string; output: string }) => Promise<void>;
  sendMessage?: () => void;
}

export function MessagePartsAdapter({
  message,
  isLatestMessage,
  status,
  addToolOutput,
  sendMessage,
}: MessagePartsAdapterProps) {
  // 优先检查 parts 数组（新的消息格式）
  const parts = message.parts;

  // 如果有 parts 数组，使用它来渲染
  if (parts && Array.isArray(parts) && parts.length > 0) {
    return (
      <div className="w-full">
        {parts.map((part, i) => {
          // 跳过 step-start 类型
          if (part.type === "step-start") {
            return null;
          }

          // 文本消息
          if (part.type === "text" && part.text) {
            return (
              <div key={`text-${i}`} className={currentAgentTheme.wrapperClass}>
                {/* Theme Decoration */}
                {currentAgentTheme.decoration}

                <div className={currentAgentTheme.bubbleClass}>
                  <div className={currentAgentTheme.textClass}>
                    <Markdown>{part.text}</Markdown>
                  </div>
                </div>
              </div>
            );
          }

          // 工具调用消息 - AI SDK v5 格式
          if (isToolPart(part)) {
            const toolName = extractToolName(part);
            const state = getToolPartState(part);
            const input = getToolPartInput(part);
            const output = getToolPartOutput(part);
            const errorText = getToolPartErrorText(part);
            const toolCallId =
              "toolCallId" in part
                ? (part as unknown as { toolCallId: string }).toolCallId
                : `tool-${i}`;

            // 查找对应的懒加载工具配置
            const toolConfig = lazyToolRegistry[toolName];
            if (!toolConfig) {
              // 未注册的工具，显示基本信息
              return (
                <div
                  key={`${toolCallId}-${i}`}
                  className="p-3 mb-2 bg-gray-100 dark:bg-gray-800 rounded-lg"
                >
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Unknown tool: {toolName}
                  </div>
                </div>
              );
            }

            // 使用懒加载包装器渲染工具组件
            return (
              <div key={`${toolCallId}-${i}`} className="mb-3">
                <LazyToolWrapper
                  config={toolConfig}
                  toolName={toolName}
                  input={(input || {}) as Record<string, unknown>}
                  state={state || "input-available"}
                  output={output}
                  errorText={errorText}
                  isLatestMessage={isLatestMessage}
                  status={status}
                  messageId={message.id}
                  partIndex={i}
                  toolCallId={toolCallId}
                  addToolOutput={addToolOutput}
                  sendMessage={sendMessage}
                />
              </div>
            );
          }

          // 未知类型 - 生产环境不显示
          return null;
        })}
      </div>
    );
  }

  // AI SDK v5 不再使用 content 属性，所有内容都在 parts 中

  // 无内容
  return null;
}
