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
import { toolRegistry } from "./tool-messages";
import { Markdown } from "./markdown";

interface MessagePartsAdapterProps {
  message: UIMessage;
  isLatestMessage?: boolean;
  status?: string;
  // HITL: 工具确认相关
  addToolOutput?: (params: {
    toolCallId: string;
    tool: string;
    output: string;
  }) => Promise<void>;
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
              <div key={`text-${i}`} className="mb-2">
                <Markdown>{part.text}</Markdown>
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

            // 查找对应的工具配置
            const toolConfig = toolRegistry[toolName];
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

            // 使用工具配置渲染 - AI SDK v5 格式
            const ToolComponent = toolConfig.render;
            return (
              <div key={`${toolCallId}-${i}`} className="mb-3">
                <ToolComponent
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
