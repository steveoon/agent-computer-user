"use client";

import {
  Globe,
  Camera,
  MousePointerClick,
  Keyboard,
  Hand,
  Terminal,
  type LucideIcon,
} from "lucide-react";
import { BaseToolMessage } from "./base-tool-message";
import { ScreenshotToolMessage } from "./screenshot-tool-message";
import { themes, type ToolMessageProps } from "./types";

const actionIcons: Record<string, LucideIcon> = {
  connect: Globe,
  navigate: Globe,
  screenshot: Camera,
  click: MousePointerClick,
  fill: Keyboard,
  hover: Hand,
  evaluate: Terminal,
};

const actionLabels: Record<string, string> = {
  connect: "连接浏览器",
  navigate: "访问页面",
  screenshot: "截屏",
  click: "点击元素",
  fill: "填写表单",
  hover: "悬停",
  evaluate: "执行脚本",
};

export function PuppeteerToolMessage(props: ToolMessageProps) {
  const { input, state, output, isLatestMessage, status, messageId, partIndex } = props;
  const action = (input.action as string) || "navigate";
  const url = input.url as string | undefined;
  const selector = input.selector as string | undefined;
  const value = input.value as string | undefined;

  const Icon = actionIcons[action] || Globe;
  const label = actionLabels[action] || action;

  let detail = "";
  if (action === "navigate" && url) {
    // 提取域名显示
    try {
      const urlObj = new URL(url);
      detail = urlObj.hostname;
    } catch {
      detail = url.length > 30 ? url.substring(0, 30) + "..." : url;
    }
  } else if (selector) {
    detail = selector.length > 30 ? selector.substring(0, 30) + "..." : selector;
  } else if (value && action === "fill") {
    detail = value.length > 20 ? value.substring(0, 20) + "..." : value;
  }

  // 对截屏工具使用特殊的紧凑横向布局
  if (action === "screenshot") {
    return (
      <ScreenshotToolMessage
        icon={Icon}
        label={label}
        theme={themes.purple}
        state={state}
        input={input}
        output={output}
        isLatestMessage={isLatestMessage}
        status={status}
        messageId={messageId}
        partIndex={partIndex}
        imageFormat="png"
      />
    );
  }

  // 其他工具使用默认布局
  return (
    <BaseToolMessage
      icon={Icon}
      label={label}
      detail={detail}
      theme={themes.purple}
      state={state}
      output={output}
      isLatestMessage={isLatestMessage}
      status={status}
      messageId={messageId}
      partIndex={partIndex}
    />
  );
}
