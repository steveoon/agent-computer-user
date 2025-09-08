"use client";

import { useCallback } from "react";
import type { FeishuNotificationType, FeishuNotificationOptions } from "@/types";
import { FEISHU_NOTIFICATION_LABELS } from "@/types";

interface UseFeishuNotificationProps {
  append: (message: { role: "user"; content: string }) => void;
}

export function useFeishuNotification({ append }: UseFeishuNotificationProps) {
  // 🏷️ 获取通知类型的中文标签
  const getNotificationLabel = (type: FeishuNotificationType): string => {
    return FEISHU_NOTIFICATION_LABELS[type] || "通知";
  };

  // 📢 统一的飞书通知发送函数
  const sendFeishuNotification = useCallback(
    (notificationType: FeishuNotificationType, options: FeishuNotificationOptions = {}) => {
      const {
        candidate_name,
        wechat_id,
        additional_info,
        message: customMessage,
        messageType = "text",
      } = options;

      // 构建工具参数
      const toolParams: Record<string, string | undefined> = {
        notification_type: notificationType,
        messageType,
      };

      // 根据通知类型添加必要参数
      if (candidate_name) toolParams.candidate_name = candidate_name;
      if (wechat_id) toolParams.wechat_id = wechat_id;
      if (additional_info) toolParams.additional_info = additional_info;
      if (customMessage) toolParams.message = customMessage;

      // 生成格式化的消息内容
      const formattedContent = `请使用feishu工具发送${getNotificationLabel(notificationType)}：
${JSON.stringify(toolParams, null, 2)}`;

      console.log(`📢 准备发送飞书通知 [${notificationType}]`);

      // 发送消息到LLM
      append({
        role: "user",
        content: formattedContent,
      });
    },
    [append]
  );

  return {
    sendFeishuNotification,
  };
}
