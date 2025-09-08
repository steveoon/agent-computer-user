"use client";

import { MessageSquare } from "lucide-react";
import { BaseToolMessage } from "./base-tool-message";
import { themes, type ToolMessageProps, type ToolTheme } from "./types";

const notificationThemes: Record<string, ToolTheme> = {
  candidate_wechat: themes.green,
  payload_error: themes.red,
  task_completed: themes.green,
  task_interrupted: themes.yellow,
  system_warning: themes.orange,
};

const notificationLabels: Record<string, string> = {
  candidate_wechat: "推送候选人微信",
  payload_error: "系统错误警告",
  task_completed: "任务完成通知",
  task_interrupted: "任务中断通知",
  system_warning: "系统警告通知",
};

export function WechatToolMessage(props: ToolMessageProps) {
  const { input, state, output, isLatestMessage, status, messageId, partIndex } = props;
  const notification_type = input.notification_type as string | undefined;
  const msgContent = input.message as string | undefined;
  const candidate_name = input.candidate_name as string | undefined;
  const wechat_id = input.wechat_id as string | undefined;

  // 微信默认使用绿色主题
  const theme =
    notification_type && notificationThemes[notification_type]
      ? notificationThemes[notification_type]
      : themes.green;

  const label =
    notification_type && notificationLabels[notification_type]
      ? notificationLabels[notification_type]
      : "发送微信消息";

  let detail = "";
  if (notification_type === "candidate_wechat") {
    detail = candidate_name || wechat_id || "";
  } else if (notification_type === "payload_error") {
    detail = "载荷过大错误";
  } else if (notification_type === "task_completed") {
    detail = "AI助手任务已完成";
  } else if (notification_type === "task_interrupted") {
    detail = "AI助手任务被中断";
  } else if (notification_type === "system_warning") {
    detail = "系统异常警告";
  }

  if (msgContent) {
    detail = msgContent.slice(0, 30) + (msgContent.length > 30 ? "..." : "");
  }

  return (
    <BaseToolMessage
      icon={MessageSquare}
      label={label}
      detail={detail}
      theme={theme}
      state={state}
      output={output}
      isLatestMessage={isLatestMessage}
      status={status}
      messageId={messageId}
      partIndex={partIndex}
    />
  );
}
