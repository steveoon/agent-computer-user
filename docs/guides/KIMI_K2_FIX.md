# Kimi K2 Tool Calls 修复说明

## 问题描述

通过 OpenRouter 使用 Kimi K2 模型时，当模型返回 tool_calls 时会出现类型验证错误：

```
Type validation failed: Value: {"tool_calls":[{"type":"","function":{...}}]}
Error: Invalid literal value, expected "function"
```

问题原因：Kimi K2 返回的 `tool_calls` 中 `type` 字段为空字符串 `""`，但 AI SDK 期望该字段为 `"function"`。

## 解决方案

创建了自定义的 OpenRouter provider (`lib/model-registry/providers/openrouter-custom.ts`)，通过以下方式修复：

1. **拦截 HTTP 响应**：对 Kimi K2 模型的请求使用自定义的 fetch 函数
2. **流式数据转换**：实时解析 SSE (Server-Sent Events) 数据流
3. **修复响应格式**：将 `type: ""` 替换为 `type: "function"`
4. **透明处理**：对其他模型保持原有行为不变

## 实现细节

```typescript
// 检测到 tool_calls 时的处理逻辑
if (data.choices?.[0]?.delta?.tool_calls) {
  data.choices[0].delta.tool_calls = data.choices[0].delta.tool_calls.map((toolCall: any) => {
    if (toolCall.type === "") {
      return { ...toolCall, type: "function" };
    }
    return toolCall;
  });
}
```

## 使用方式

在 `dynamic-registry.ts` 中已自动配置，无需额外操作。当使用 `openrouter/moonshotai/kimi-k2` 模型时，修复会自动生效。

## 注意事项

- 仅对 Kimi K2 模型生效，不影响其他 OpenRouter 模型
- 修复在流式响应层面进行，性能影响极小
- 如果 OpenRouter 或 Kimi 官方修复了此问题，可以移除此自定义实现
