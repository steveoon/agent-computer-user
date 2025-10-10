# Open API 类型改进说明

## 概览

根据 [AI SDK 文档](https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol) 的最佳实践，对 Open Chat API 的类型定义进行了改进，确保与 AI SDK 的类型系统完全兼容。

## 主要改进

### 1. UIMessage 类型使用

**改进前：**
```typescript
import { UIMessage } from "ai";  // 错误：运行时导入
```

**改进后：**
```typescript
import type { UIMessage } from "ai";  // 正确：类型导入
```

**原因：** UIMessage 是纯类型定义，应该使用 `type` 导入以避免运行时开销。

### 2. OpenChatRequest 消息字段

**改进：**
```typescript
export interface OpenChatRequest {
  /**
   * 消息数组
   * 支持两种格式：
   * 1. AI SDK 标准格式：UIMessage (推荐)
   * 2. 简化格式：{role, content} (将在服务端归一化为 UIMessage)
   */
  messages: UIMessage[] | Array<{ role: string; content: string }>;
  // ...
}
```

**说明：**
- 明确支持两种消息格式
- 优先推荐使用 AI SDK 标准的 UIMessage 格式
- 兼容简化格式以降低集成难度

### 3. OpenChatResponse 类型 - **重要修复**

**❌ 错误示例（初版 - 已修复）：**
```typescript
usage: {
  promptTokens: number;      // ❌ 错误：AI SDK 不使用这个字段名
  completionTokens: number;  // ❌ 错误：AI SDK 不使用这个字段名
  totalTokens: number;
}
```

**✅ 正确实现：**
```typescript
export interface OpenChatResponse {
  /**
   * 生成的消息数组
   * 使用 AI SDK 的 UIMessage 类型
   */
  messages: UIMessage[];

  /**
   * Token 使用情况
   * 严格遵循 AI SDK LanguageModelUsage 的字段命名
   *
   * 注意：AI SDK 使用 inputTokens/outputTokens，而非 promptTokens/completionTokens
   * 所有字段都是可选的（undefined 表示提供商未报告该值）
   */
  usage: {
    /** 输入（提示）token 数量 */
    inputTokens?: number;           // ✅ 正确
    /** 输出（生成）token 数量 */
    outputTokens?: number;          // ✅ 正确
    /** 总 token 数量 */
    totalTokens?: number;           // ✅ 正确
    /** 推理 token 数量（仅某些模型支持） */
    reasoningTokens?: number;       // ✅ 新增
    /** 缓存的输入 token 数量（仅某些提供商支持） */
    cachedInputTokens?: number;     // ✅ 新增
  };

  /**
   * 工具使用信息
   */
  tools: {
    used: string[];
    skipped: string[];
  };
}
```

**关键修复点：**
1. ✅ 使用 `inputTokens` 替代 `promptTokens`
2. ✅ 使用 `outputTokens` 替代 `completionTokens`
3. ✅ 所有字段标记为可选（`?`）- 符合 AI SDK 规范
4. ✅ 新增 `reasoningTokens` 字段（支持 OpenAI o1 等推理模型）
5. ✅ 新增 `cachedInputTokens` 字段（支持 Anthropic 等提供商的缓存功能）

**AI SDK LanguageModelUsage 接口：**
```typescript
interface LanguageModelUsage {
  inputTokens?: number;        // 输入 token
  outputTokens?: number;       // 输出 token
  totalTokens?: number;        // 总 token
  reasoningTokens?: number;    // 推理 token
  cachedInputTokens?: number;  // 缓存的输入 token
}
```

**参考：**
- [AI SDK LanguageModelUsage](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text#result.usage)
- [Stream Text Usage](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text#on-step-finish.on-step-finish-result.usage)

### 4. 消息归一化函数

**改进：**
```typescript
/**
 * 归一化消息
 * 将 {role, content} 格式转换为 AI SDK v5 UIMessage 格式
 *
 * 参考 AI SDK 文档:
 * - UIMessage 必须有 id, role, parts 字段
 * - parts 是一个数组，包含 text/file/tool 等类型的消息部分
 * - 使用 crypto.randomUUID() 生成唯一 ID
 */
export function normalizeMessages(
  messages: UIMessage[] | Array<{ role: string; content: string }>
): UIMessage[] {
  return messages.map(msg => {
    // 如果已经是 UIMessage 格式（有 parts 字段），直接返回
    if ("parts" in msg && Array.isArray(msg.parts)) {
      return msg as UIMessage;
    }

    // 如果是 {role, content} 格式，转换为 UIMessage
    if ("content" in msg && typeof msg.content === "string") {
      const normalizedMessage: UIMessage = {
        id: crypto.randomUUID(),
        role: msg.role as "user" | "assistant" | "system",
        parts: [
          {
            type: "text",
            text: msg.content,
          } as const,
        ],
      };
      return normalizedMessage;
    }

    // 其他情况直接返回（可能已经是正确的格式）
    return msg as UIMessage;
  });
}
```

**改进点：**
- 移除了不必要的 `NormalizedMessage` 接口
- 使用明确的 `UIMessage` 类型
- 添加 `as const` 确保类型收窄
- 添加详细的文档注释说明 AI SDK 规范

## AI SDK UIMessage 结构

根据 AI SDK 文档，UIMessage 的标准结构为：

```typescript
interface UIMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  parts: UIMessagePart[];
  metadata?: unknown;
  status?: 'submitted' | 'streaming' | 'ready' | 'error';
}
```

### parts 字段类型

`UIMessagePart` 可以是多种类型：
- `TextUIPart`: `{ type: 'text', text: string }`
- `FileUIPart`: `{ type: 'file', ... }`
- `ToolUIPart`: `{ type: 'tool-call' | 'tool-result', ... }`
- 其他扩展类型

## 类型安全最佳实践

1. **使用 `type` 导入纯类型**
   ```typescript
   import type { UIMessage } from "ai";  // ✅
   import { UIMessage } from "ai";       // ❌
   ```

2. **明确类型注解**
   ```typescript
   const message: UIMessage = { ... };  // ✅
   const message = { ... } as UIMessage; // 次优
   ```

3. **使用 `as const` 收窄字面量类型**
   ```typescript
   { type: "text" as const, ... }  // ✅
   { type: "text", ... }            // 类型推断不够精确
   ```

4. **引用 AI SDK 的标准类型**
   - 不要重新定义 AI SDK 已有的类型
   - 直接使用 `UIMessage`, `UIMessagePart` 等导出类型
   - 参考 AI SDK 源码和文档

## 参考资源

- [AI SDK Stream Protocol](https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol)
- [AI SDK useChat Hook](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat)
- [AI SDK Generating Text](https://ai-sdk.dev/docs/ai-sdk-core/generating-text)
- [TypeScript Type Imports](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-8.html#type-only-imports-and-export)

## 总结

通过这些改进，我们的 Open API 类型定义现在：

1. ✅ 完全遵循 AI SDK 的类型规范
2. ✅ 使用正确的类型导入方式
3. ✅ 提供清晰的文档注释
4. ✅ 支持灵活的消息格式（标准/简化）
5. ✅ 保持类型安全和编译时检查
6. ✅ 便于与 AI SDK 的其他功能集成
