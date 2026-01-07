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
  connect_active_tab: Globe,
  connect: Globe,
  navigate: Globe,
  screenshot: Camera,
  click: MousePointerClick,
  fill: Keyboard,
  select: Keyboard,
  hover: Hand,
  evaluate: Terminal,
};

const actionLabels: Record<string, string> = {
  connect_active_tab: "连接浏览器",
  connect: "连接浏览器",
  navigate: "访问页面",
  screenshot: "截屏",
  click: "点击元素",
  fill: "填写表单",
  select: "选择选项",
  hover: "悬停",
  evaluate: "执行脚本",
};

const truncate = (str: string, length: number) =>
  str.length > length ? str.substring(0, length) + "..." : str;

const formatUrl = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return truncate(url, 30);
  }
};

export function PuppeteerToolMessage(props: ToolMessageProps) {
  const { input, state, output, isLatestMessage, status, messageId, partIndex } = props;
  const action = (input.action as string) || "navigate";
  const url = input.url as string | undefined;
  const targetUrl = input.targetUrl as string | undefined;
  const debugPort = input.debugPort as number | undefined;
  const selector = input.selector as string | undefined;
  const value = input.value as string | undefined;
  const script = input.script as string | undefined;

  const Icon = actionIcons[action] || Globe;
  const label = actionLabels[action] || action;

  const getDetail = () => {
    if (action === "connect_active_tab") {
      return targetUrl ? formatUrl(targetUrl) : `端口 ${debugPort || 9222}`;
    }
    if (action === "navigate" && url) {
      return formatUrl(url);
    }
    if (action === "evaluate" && script) {
      return truncate(script, 30);
    }
    if (selector) {
      return truncate(selector, 30);
    }
    if (value && (action === "fill" || action === "select")) {
      return truncate(value, 20);
    }
    return "";
  };

  const detail = getDetail();

  // 对截屏工具使用特殊的紧凑横向布局
  if (action === "screenshot") {
    return (
      <ScreenshotToolMessage
        {...props}
        icon={Icon}
        label={label}
        theme={themes.purple}
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
