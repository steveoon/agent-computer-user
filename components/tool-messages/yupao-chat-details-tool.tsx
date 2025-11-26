"use client";

import { BaseToolMessage } from "./base-tool-message";
import { FileText, User, MessageSquare, Clock, Phone, MessageCircle, MapPin } from "lucide-react";
import { ToolMessageProps } from "./types";
import {
  getSenderDisplay,
  parseChatDetailsResult,
  type ChatMessageSender,
} from "@/types/chat-details";

/**
 * Yupao聊天详情工具的显示组件
 * 使用统一的类型定义，保持平台特色的紫色主题
 */
export function YupaoChatDetailsTool(props: ToolMessageProps) {
  const { state, output, isLatestMessage, messageId, partIndex } = props;

  // 类型安全的结果 - 使用统一的类型定义
  const typedResult = parseChatDetailsResult(output) ?? undefined;

  // 选择合适的主题 - 使用紫色主题保持Yupao一致性
  const theme = typedResult?.success
    ? {
        bgColor: "bg-purple-50 dark:bg-purple-950/20",
        borderColor: "border-purple-200 dark:border-purple-900",
        iconBgColor: "bg-purple-100 dark:bg-purple-900/50",
        iconColor: "text-purple-600 dark:text-purple-400",
        textColor: "text-purple-800 dark:text-purple-200",
        loaderColor: "text-purple-600 dark:text-purple-400",
      }
    : {
        bgColor: "bg-red-50 dark:bg-red-950/20",
        borderColor: "border-red-200 dark:border-red-900",
        iconBgColor: "bg-red-100 dark:bg-red-900/50",
        iconColor: "text-red-600 dark:text-red-400",
        textColor: "text-red-800 dark:text-red-200",
        loaderColor: "text-red-600 dark:text-red-400",
      };

  // 格式化消息发送者 - 使用统一的工具函数，并自定义紫色主题
  const getSenderDisplayWithTheme = (sender: string) => {
    const baseDisplay = getSenderDisplay(sender as ChatMessageSender);
    // 对于 Yupao，候选人使用紫色主题
    if (sender === "candidate") {
      return { ...baseDisplay, color: "text-purple-600 dark:text-purple-400" };
    }
    return { ...baseDisplay, color: baseDisplay.defaultColor };
  };

  if (state === "input-streaming" || state === "input-available") {
    return (
      <BaseToolMessage
        icon={FileText}
        label="获取聊天详情"
        detail="正在获取候选人信息和聊天记录..."
        theme={theme}
        state={state}
        messageId={messageId}
        partIndex={partIndex}
        isLatestMessage={isLatestMessage}
      />
    );
  }

  const candidateInfo = typedResult?.data?.candidateInfo;
  const chatMessages = typedResult?.data?.chatMessages || [];
  const stats = typedResult?.data?.stats;

  return (
    <BaseToolMessage
      icon={FileText}
      label="获取聊天详情"
      detail={typedResult?.message || (typedResult?.success ? "成功获取聊天详情" : "获取失败")}
      theme={theme}
      state={state}
      output={typedResult}
      messageId={messageId}
      partIndex={partIndex}
      isLatestMessage={isLatestMessage}
    >
      {typedResult?.success && (
        <div className="space-y-4 mt-3">
          {/* 候选人信息 */}
          {candidateInfo && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">候选人信息</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex gap-2">
                      <span className="text-gray-500 dark:text-gray-400 min-w-[60px]">姓名：</span>
                      <span className="text-gray-700 dark:text-gray-300">
                        {candidateInfo.name || "未知"}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-gray-500 dark:text-gray-400 min-w-[60px]">职位：</span>
                      <span className="text-gray-700 dark:text-gray-300">
                        {candidateInfo.position || "未知"}
                      </span>
                    </div>
                    {candidateInfo.age && (
                      <div className="flex gap-2">
                        <span className="text-gray-500 dark:text-gray-400 min-w-[60px]">
                          年龄：
                        </span>
                        <span className="text-gray-700 dark:text-gray-300">
                          {candidateInfo.age}岁
                        </span>
                      </div>
                    )}
                    {candidateInfo.experience && (
                      <div className="flex gap-2">
                        <span className="text-gray-500 dark:text-gray-400 min-w-[60px]">
                          经验：
                        </span>
                        <span className="text-gray-700 dark:text-gray-300">
                          {candidateInfo.experience}
                        </span>
                      </div>
                    )}
                    {candidateInfo.education && (
                      <div className="flex gap-2">
                        <span className="text-gray-500 dark:text-gray-400 min-w-[60px]">
                          学历：
                        </span>
                        <span className="text-gray-700 dark:text-gray-300">
                          {candidateInfo.education}
                        </span>
                      </div>
                    )}
                    {candidateInfo.jobAddress && (
                      <div className="flex gap-2">
                        <span className="text-gray-500 dark:text-gray-400 min-w-[60px] flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          地址：
                        </span>
                        <span className="text-gray-700 dark:text-gray-300">
                          {candidateInfo.jobAddress}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 聊天记录 */}
          {chatMessages.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-start gap-3">
                <MessageSquare className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">聊天记录</h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {chatMessages.map((msg, index) => {
                      const senderInfo = getSenderDisplayWithTheme(msg.sender);
                      return (
                        <div
                          key={index}
                          className="border-b border-gray-100 dark:border-gray-700 pb-2 last:border-0"
                        >
                          <div className="flex items-start gap-2 text-sm">
                            {msg.time && (
                              <span className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                <Clock className="w-3 h-3 inline mr-1" />
                                {msg.time}
                              </span>
                            )}
                            <span className={`font-medium ${senderInfo.color}`}>
                              {senderInfo.label}:
                            </span>
                            <span className="text-gray-700 dark:text-gray-300 flex-1">
                              {msg.content}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 交换的联系方式 */}
          {stats &&
            ((stats.phoneNumbers && stats.phoneNumbers.length > 0) ||
              (stats.wechatIds && stats.wechatIds.length > 0)) && (
              <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4 border border-blue-200 dark:border-blue-900">
                <div className="space-y-2">
                  {stats.phoneNumbers && stats.phoneNumbers.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        电话号码: {stats.phoneNumbers.join(", ")}
                      </span>
                    </div>
                  )}
                  {stats.wechatIds && stats.wechatIds.length > 0 && (
                    <div className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        微信号: {stats.wechatIds.join(", ")}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

          {/* 统计信息 */}
          {stats && (
            <div className="text-xs text-gray-500 dark:text-gray-400 flex gap-4 flex-wrap">
              <span>总消息数: {stats.totalMessages}</span>
              <span>候选人: {stats.candidateMessages}</span>
              <span>招聘者: {stats.recruiterMessages}</span>
              <span>系统: {stats.systemMessages}</span>
              {stats.phoneExchangeCount && stats.phoneExchangeCount > 0 && (
                <span>交换电话: {stats.phoneExchangeCount}</span>
              )}
              {stats.wechatExchangeCount && stats.wechatExchangeCount > 0 && (
                <span>交换微信: {stats.wechatExchangeCount}</span>
              )}
            </div>
          )}

          {/* 格式化历史（用于reply-tool） */}
          {typedResult?.formattedHistory && typedResult.formattedHistory.length > 0 && (
            <details className="mt-3">
              <summary className="text-xs text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
                查看格式化对话历史 (用于智能回复)
              </summary>
              <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded text-xs font-mono space-y-1">
                {typedResult.formattedHistory.map((line, index) => (
                  <div key={index} className="text-gray-600 dark:text-gray-400">
                    {line}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* 错误信息 */}
      {typedResult?.error && (
        <div className="mt-3 text-sm text-red-600 dark:text-red-400">错误: {typedResult.error}</div>
      )}
    </BaseToolMessage>
  );
}
