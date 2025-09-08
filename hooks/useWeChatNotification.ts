"use client";

import { useCallback } from "react";
import type { WeChatNotificationType, WeChatNotificationOptions } from "@/types/wechat";
import { WECHAT_NOTIFICATION_LABELS } from "@/types/wechat";

interface UseWeChatNotificationProps {
  append: (message: { role: "user"; content: string }) => void;
}

export function useWeChatNotification({ append }: UseWeChatNotificationProps) {
  // 🏷️ 获取通知类型的中文标签
  const getNotificationLabel = (type: WeChatNotificationType): string => {
    return WECHAT_NOTIFICATION_LABELS[type] || "通知";
  };

  // 📢 统一的WeChat通知发送函数
  const sendWeChatNotification = useCallback(
    (notificationType: WeChatNotificationType, options: WeChatNotificationOptions = {}) => {
      const {
        candidate_name,
        wechat_id,
        additional_info,
        message: customMessage,
        messageType = "markdown",
        mentioned_list,
        mentioned_mobile_list,
        use_markdown_v2,
      } = options;

      // 构建工具参数
      const toolParams: Record<string, unknown> = {
        notification_type: notificationType,
        messageType,
      };

      // 根据通知类型添加必要参数
      if (candidate_name) toolParams.candidate_name = candidate_name;
      if (wechat_id) toolParams.wechat_id = wechat_id;
      if (additional_info) toolParams.additional_info = additional_info;
      if (customMessage) toolParams.message = customMessage;
      if (mentioned_list) toolParams.mentioned_list = mentioned_list;
      if (mentioned_mobile_list) toolParams.mentioned_mobile_list = mentioned_mobile_list;
      if (use_markdown_v2) toolParams.use_markdown_v2 = use_markdown_v2;

      // 生成格式化的消息内容
      const formattedContent = `请使用wechat工具发送${getNotificationLabel(notificationType)}：
${JSON.stringify(toolParams, null, 2)}`;

      console.log(`📢 准备发送WeChat通知 [${notificationType}]`);

      // 发送消息到LLM
      append({
        role: "user",
        content: formattedContent,
      });
    },
    [append]
  );

  // 便捷方法：发送候选人微信信息
  const sendCandidateWeChatInfo = useCallback(
    (candidateName: string, wechatId: string, additionalInfo?: string) => {
      sendWeChatNotification("candidate_wechat", {
        candidate_name: candidateName,
        wechat_id: wechatId,
        additional_info: additionalInfo,
      });
    },
    [sendWeChatNotification]
  );

  // 便捷方法：发送系统警告
  const sendSystemWarning = useCallback(
    (warningMessage: string, options?: { mentioned_list?: string[] }) => {
      sendWeChatNotification("system_warning", {
        additional_info: warningMessage,
        mentioned_list: options?.mentioned_list,
      });
    },
    [sendWeChatNotification]
  );

  // 便捷方法：发送任务完成通知
  const sendTaskCompleted = useCallback(
    (taskDetails?: string) => {
      sendWeChatNotification("task_completed", {
        additional_info: taskDetails,
      });
    },
    [sendWeChatNotification]
  );

  // 便捷方法：发送部署通知
  const sendDeploymentNotification = useCallback(
    (success: boolean, details?: string, mentionedList?: string[]) => {
      sendWeChatNotification(success ? "deployment_success" : "deployment_failed", {
        additional_info: details,
        mentioned_list: mentionedList || (success ? [] : ["@all"]), // 失败时默认@所有人
      });
    },
    [sendWeChatNotification]
  );

  return {
    sendWeChatNotification,
    sendCandidateWeChatInfo,
    sendSystemWarning,
    sendTaskCompleted,
    sendDeploymentNotification,
  };
}
