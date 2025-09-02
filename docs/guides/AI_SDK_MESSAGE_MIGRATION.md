# AI SDK 消息结构迁移指南

## 问题背景

在从 `ai` 包迁移到 `@ai-sdk/react` 包时，消息数据结构发生了重要变化，导致工具调用组件无法正确渲染。

## 关键差异

### 1. 消息结构变化

**旧版本 (ai 包)**：

```typescript
interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string | Array<TextPart | ToolCallPart>;
}
```

**新版本 (@ai-sdk/react 包)**：

```typescript
interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string; // 始终是字符串
  parts?: Array<{
    // 新增 parts 数组
    type: "text" | "tool-invocation" | "step-start";
    text?: string;
    toolInvocation?: {
      toolName: string;
      toolCallId: string;
      args: any;
      state: "call" | "result" | "partial-call";
      result?: any;
    };
  }>;
}
```

### 2. 实际数据示例

```json
{
  "id": "lSccmxH",
  "role": "assistant",
  "content": "我来帮您生成空缺岗位的推送消息。",
  "parts": [
    {
      "type": "text",
      "text": "我来帮您生成后厨空缺岗位的推送消息。"
    },
    {
      "type": "tool-invocation",
      "toolInvocation": {
        "state": "result",
        "toolCallId": "call_tNkBdPf5K8YQ1234",
        "toolName": "job_posting_generator",
        "args": {
          "positionType": "后厨",
          "limit": 10
        },
        "result": {
          "message": "【后厨岗位空缺通知】\\n..."
        }
      }
    }
  ]
}
```

## 问题分析

### 原始代码的问题

```typescript
// ❌ 错误的实现
export function MessagePartsAdapter({ message }: Props) {
  // 先检查 content 类型
  if (typeof message.content === "string") {
    return <Markdown>{message.content}</Markdown>;
  }

  // 再检查 content 数组（永远不会执行到这里）
  if (Array.isArray(message.content)) {
    // 渲染工具组件...
  }
}
```

问题在于：

1. 在新版本中，`message.content` **始终是字符串**
2. 工具调用信息存储在 `message.parts` 数组中
3. 代码优先检查 `content` 类型，导致永远无法处理 `parts`

### 正确的实现

```typescript
// ✅ 正确的实现
export function MessagePartsAdapter({ message }: Props) {
  // 优先检查 parts 数组
  const parts = (message as any).parts;

  if (parts && Array.isArray(parts) && parts.length > 0) {
    return (
      <div className="w-full">
        {parts.map((part: any, i: number) => {
          if (part.type === "text") {
            return <Markdown key={i}>{part.text}</Markdown>;
          }

          if (part.type === "tool-invocation" && part.toolInvocation) {
            const { toolName, args, state, result } = part.toolInvocation;
            // 渲染工具组件
            const ToolComponent = toolRegistry[toolName]?.render;
            if (ToolComponent) {
              return <ToolComponent key={i} {...props} />;
            }
          }

          return null;
        })}
      </div>
    );
  }

  // 回退到字符串内容
  if (typeof message.content === "string") {
    return <Markdown>{message.content}</Markdown>;
  }

  return null;
}
```

## 迁移要点

1. **更新导入**：

   ```typescript
   // 旧
   import type { Message } from "ai";

   // 新
   import type { Message } from "@ai-sdk/react";
   ```

2. **适配消息结构**：
   - 检查 `parts` 数组而不是 `content` 数组
   - 处理新的 `tool-invocation` 类型
   - 保留对旧格式的兼容（字符串 content）

3. **工具状态映射**：
   - `call` → 正在调用
   - `result` → 调用完成
   - `partial-call` → 部分调用

## 调试技巧

1. **检查消息结构**：

   ```typescript
   console.log("message:", message);
   console.log("parts:", (message as any).parts);
   ```

2. **验证工具注册**：

   ```typescript
   console.log("Tool registry:", Object.keys(toolRegistry));
   ```

3. **追踪渲染流程**：
   - 在每个条件分支添加日志
   - 使用临时的调试样式（边框、背景色）
   - 逐步还原真实组件

## 总结

这次迁移的核心是理解 AI SDK 新版本的消息结构变化。`parts` 数组是新的标准方式来存储结构化内容，包括文本和工具调用。正确的实现需要优先处理 `parts` 数组，然后才回退到字符串 `content`。
