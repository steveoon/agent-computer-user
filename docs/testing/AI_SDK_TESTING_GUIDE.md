# AI SDK 测试指南

本指南介绍如何使用 AI SDK 的测试工具来测试涉及 LLM 的功能，特别是工具调用场景。

## 概述

AI SDK 4.x 提供了 `ai/test` 模块，包含以下测试工具：

- `MockLanguageModelV1` - 模拟语言模型
- `mockId` - 生成唯一 ID
- 其他测试辅助函数

## 测试设置

### 1. 测试工具库

我们创建了一个测试工具库来简化 AI SDK 的模拟：

```typescript
// lib/__tests__/test-utils/ai-mocks.ts

import { MockLanguageModelV1, mockId } from "ai/test";
import type { LanguageModelV1StreamPart } from "ai";

// 创建模拟文本流
export function createMockTextStream(
  chunks: string[],
  options: MockStreamOptions = {}
): MockLanguageModelV1;

// 创建模拟工具调用流
export function createMockToolCallStream(
  toolName: string,
  args: any,
  resultText: string = "Tool executed successfully"
): MockLanguageModelV1;
```

### 2. API 路由测试示例

```typescript
// app/api/chat/__tests__/route.test.ts

import { describe, it, expect, vi } from "vitest";
import { POST } from "../route";
import {
  createMockTextStream,
  createMockToolCallStream,
} from "@/lib/__tests__/test-utils/ai-mocks";

describe("Chat API Route", () => {
  it("should handle a simple text response", async () => {
    const mockModel = createMockTextStream(["Hello", ", ", "world!"]);
    // ... 设置 mock 和测试
  });

  it("should handle tool invocations", async () => {
    const mockModel = createMockToolCallStream(
      "wechat",
      { message: "测试消息" },
      "已发送消息到微信群"
    );
    // ... 测试工具调用
  });
});
```

## 组件测试

### 1. 测试聊天消息组件

```typescript
// components/chat/__tests__/ChatMessages.test.tsx

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Message } from "@ai-sdk/react";

describe("ChatMessages", () => {
  it("renders tool invocation messages", () => {
    const messages: Message[] = [
      {
        id: "1",
        role: "assistant",
        content: "",
        parts: [
          { type: "text", text: "Let me help you with that." },
          {
            type: "tool-invocation",
            toolInvocationId: "tool-1",
            toolName: "wechat",
            state: "result",
            result: { success: true },
          } as any,
        ],
      },
    ];
    // ... 渲染和断言
  });
});
```

## 测试最佳实践

### 1. 消息格式

AI SDK React 使用 `parts` 数组而不是 `content` 数组：

```typescript
// ✅ 正确
const message: Message = {
  id: "1",
  role: "user",
  content: "Hello",
  parts: [{ type: "text", text: "Hello" }],
};

// ❌ 错误（旧格式）
const message = {
  id: "1",
  role: "user",
  content: [{ type: "text", text: "Hello" }],
};
```

### 2. 工具调用格式

工具调用使用 `toolInvocationId` 而不是 `toolCallId`：

```typescript
// ✅ 正确
{
  type: 'tool-invocation',
  toolInvocationId: 'tool-1',
  toolName: 'wechat',
  state: 'result',
  result: { ... }
}

// ❌ 错误
{
  type: 'tool-invocation',
  toolCallId: 'tool-1',  // 应该使用 toolInvocationId
  toolName: 'wechat',
  state: 'result',
  result: { ... }
}
```

### 3. Mock 动态注册表

测试 API 路由时需要 mock 动态注册表：

```typescript
vi.mock("@/lib/model-registry/dynamic-registry", () => ({
  getDynamicRegistry: vi.fn(() => ({
    languageModel: () => mockModel,
    textEmbeddingModel: () => null as any,
    imageModel: () => null as any,
  })),
}));
```

### 4. 流式响应测试

测试流式响应时，需要正确读取和解析流：

```typescript
const response = await POST(request);
const reader = response.body?.getReader();
const chunks: string[] = [];

if (reader) {
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(new TextDecoder().decode(value));
  }
}

const responseText = chunks.join("");
expect(responseText).toContain("expected content");
```

## 工具调用测试场景

### 1. 单个工具调用

```typescript
const mockModel = createMockToolCallStream(
  "job_posting_generator",
  { position: "前厅服务员", salary: "5000-6000" },
  "招聘信息已生成"
);
```

### 2. 多个工具调用序列

```typescript
const messages: Message[] = [{
  id: '1',
  role: 'assistant',
  parts: [
    { type: 'text', text: '我将为您执行多个操作' },
    {
      type: 'tool-invocation',
      toolInvocationId: 'tool-1',
      toolName: 'zhipin_get_unread_candidates_improved',
      state: 'result',
      result: { candidates: [...] }
    },
    {
      type: 'tool-invocation',
      toolInvocationId: 'tool-2',
      toolName: 'zhipin_reply_generator',
      state: 'result',
      result: { reply: '生成的回复' }
    }
  ]
}]
```

### 3. 错误处理测试

```typescript
it("should handle errors gracefully", async () => {
  vi.mocked(getDynamicRegistry).mockImplementation(() => {
    throw new Error("Model initialization failed");
  });

  await expect(POST(request)).rejects.toThrow("Model initialization failed");
});
```

## 运行测试

```bash
# 运行所有测试
pnpm test

# 运行特定测试文件
pnpm test ChatMessages

# 查看测试覆盖率
pnpm test:coverage

# 使用 UI 界面调试
pnpm test:ui
```

## 注意事项

1. **类型安全**：某些工具调用属性可能需要使用 `as any` 进行类型断言
2. **Mock 隔离**：每个测试前使用 `vi.clearAllMocks()` 清理 mock
3. **异步处理**：流式响应测试需要正确处理异步操作
4. **组件 Props**：确保提供所有必需的 props（如 refs、状态等）

## 相关资源

- [AI SDK 测试文档](https://ai-sdk.dev/docs/ai-sdk-core/testing)
- [Vitest 文档](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro)
