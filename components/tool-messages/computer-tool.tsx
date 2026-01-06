"use client";

import {
  Camera,
  MousePointer,
  MousePointerClick,
  Keyboard,
  KeyRound,
  ScrollText,
  Clock,
  MonitorCheck,
  Type,
  Play,
  type LucideIcon,
} from "lucide-react";
import { BaseToolMessage } from "./base-tool-message";
import { ScreenshotToolMessage } from "./screenshot-tool-message";
import { themes, type ToolMessageProps } from "./types";

const actionIcons: Record<string, LucideIcon> = {
  screenshot: Camera,
  left_click: MousePointerClick,
  double_click: MousePointerClick,
  right_click: MousePointerClick,
  middle_click: MousePointer,
  triple_click: MousePointerClick,
  mouse_move: MousePointer,
  left_mouse_down: MousePointer,
  left_mouse_up: MousePointer,
  type: Keyboard,
  key: KeyRound,
  hold_key: KeyRound,
  left_click_drag: MousePointer,
  cursor_position: MousePointer,
  scroll: ScrollText,
  wait: Clock,
  diagnose: MonitorCheck,
  check_fonts: Type,
  setup_chinese_input: Keyboard,
  launch_app: Play,
  generate_zhipin_reply: Keyboard,
};

const actionLabels: Record<string, string> = {
  screenshot: "截屏",
  left_click: "点击",
  double_click: "双击",
  right_click: "右键点击",
  middle_click: "中键点击",
  triple_click: "三击",
  mouse_move: "移动鼠标",
  left_mouse_down: "按下鼠标",
  left_mouse_up: "释放鼠标",
  type: "输入文字",
  key: "按键",
  hold_key: "按住键",
  left_click_drag: "拖拽",
  cursor_position: "光标位置",
  scroll: "滚动",
  wait: "等待",
  diagnose: "诊断",
  check_fonts: "检查字体",
  setup_chinese_input: "设置中文输入",
  launch_app: "启动应用",
  generate_zhipin_reply: "生成智能回复",
};

export function ComputerToolMessage(props: ToolMessageProps) {
  const { input, state, output, isLatestMessage, status, messageId, partIndex } = props;
  const action = (input.action as string) || "screenshot";
  const coordinate = input.coordinate as number[] | undefined;
  const text = input.text as string | undefined;
  const duration = input.duration as number | undefined;

  const Icon = actionIcons[action] || Camera;
  const label = actionLabels[action] || action;

  let detail = "";
  if (coordinate) {
    detail = `(${coordinate[0]}, ${coordinate[1]})`;
  } else if (text && action === "type") {
    detail = text.length > 20 ? `"${text.substring(0, 20)}..."` : `"${text}"`;
  } else if (text && action === "key") {
    detail = text;
  } else if (duration && action === "wait") {
    detail = `${duration}秒`;
  }

  // 对截屏工具使用特殊的紧凑横向布局
  if (action === "screenshot") {
    return (
      <ScreenshotToolMessage
        {...props}
        icon={Icon}
        label={label}
        theme={themes.zinc}
        imageFormat="jpeg"
        maxHeight="600px"
      />
    );
  }

  // 其他工具使用默认布局（大多数情况下没有特殊内容）
  return (
    <BaseToolMessage
      icon={Icon}
      label={label}
      detail={detail}
      theme={themes.zinc}
      state={state}
      output={output}
      isLatestMessage={isLatestMessage}
      status={status}
      messageId={messageId}
      partIndex={partIndex}
    />
  );
}
