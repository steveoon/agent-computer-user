# Tool Messages 架构说明

这个目录包含了所有工具消息的 UI 组件实现。

## 架构设计

```
tool-messages/
├── index.ts              # 工具注册表
├── types.ts              # 类型定义和主题配置
├── base-tool-message.tsx # 基础工具消息组件
└── [tool-name]-tool.tsx  # 各个工具的具体实现
```

## 添加新工具的步骤

### 1. 创建工具组件文件

在 `tool-messages/` 目录下创建 `[tool-name]-tool.tsx`：

```tsx
"use client";

import { Globe } from "lucide-react"; // 选择合适的图标
import { BaseToolMessage } from "./base-tool-message";
import { themes, type ToolMessageProps } from "./types";

export function MyNewToolMessage(props: ToolMessageProps) {
  const { args, state, result, isLatestMessage, status, messageId, partIndex } = props;

  // 从 args 中提取需要显示的信息
  const { param1, param2 } = args;

  return (
    <BaseToolMessage
      icon={Globe}
      label="我的新工具"
      detail={param1 || param2}
      theme={themes.blue} // 选择主题颜色
      state={state}
      result={result}
      isLatestMessage={isLatestMessage}
      status={status}
      messageId={messageId}
      partIndex={partIndex}
    />
  );
}
```

### 2. 注册工具

在 `index.ts` 中添加工具注册：

```tsx
import { MyNewToolMessage } from "./my-new-tool";
import { Globe } from "lucide-react";

export const toolRegistry: Record<string, ToolConfig> = {
  // ... 其他工具
  my_new_tool: {
    icon: Globe,
    defaultTheme: themes.blue,
    render: MyNewToolMessage,
  },
};
```

## 可用的主题颜色

- `themes.zinc` - 灰色（默认）
- `themes.green` - 绿色
- `themes.blue` - 蓝色
- `themes.purple` - 紫色
- `themes.red` - 红色
- `themes.yellow` - 黄色
- `themes.orange` - 橙色
- `themes.indigo` - 靛蓝色

## 高级用法

### 自定义渲染内容

如果需要在基础样式之外添加自定义内容（如图片、进度条等），可以使用 `children` 属性：

```tsx
return (
  <BaseToolMessage
  // ... 其他属性
  >
    <div className="mt-2">
      {/* 自定义内容 */}
      <img src={result.imageUrl} alt="Result" />
    </div>
  </BaseToolMessage>
);
```

### 动态主题

根据工具状态或参数动态选择主题：

```tsx
const theme = args.status === "error" ? themes.red : themes.green;
```

## 维护说明

1. 保持工具组件的独立性，每个工具一个文件
2. 复用 `BaseToolMessage` 组件以保持一致的视觉风格
3. 使用预定义的主题颜色而不是自定义颜色
4. 工具名称在注册表中应与 API 中的工具名称完全匹配
