# 测试修复说明

**日期**: 2025-10-10
**状态**: 需要修复

---

## 问题总结

### 测试结果
- ✅ **通过**: 288 个测试 (89%)
- ❌ **失败**: 32 个测试 (10%)
- ⏭️ **跳过**: 3 个测试 (1%)

### 根本原因

**所有失败测试返回 403** - 模型验证失败

```
getOpenApiModels() returned invalid data: undefined
Model validation failed: Failed to load allowed models list
```

**原因分析**:
1. Mock 配置存在，但没有被正确应用
2. `validateModel()` 函数调用 `getOpenApiModels()` 时，mock 未生效
3. 可能是 Vitest 的 mock 时机问题

---

## 修复方案

### 方案 1: 修改 validateModel 使其可测试（推荐）

**修改** `lib/utils/open-chat-utils.ts`:

```typescript
/**
 * 验证模型是否在允许列表中
 *
 * @param modelId - 模型 ID
 * @param allowedModels - 可选的允许模型列表（用于测试注入）
 */
export function validateModel(
  modelId: string,
  allowedModels?: Array<{ id: string; name: string; categories: string[] }>
): {
  valid: boolean;
  error?: string;
} {
  const models = allowedModels || getOpenApiModels();

  if (!models || !Array.isArray(models)) {
    console.error("getOpenApiModels() returned invalid data:", models);
    return {
      valid: false,
      error: "Failed to load allowed models list",
    };
  }

  const isAllowed = models.some(model => model.id === modelId);

  if (!isAllowed) {
    return {
      valid: false,
      error: `Model '${modelId}' is not in the allowed list.`,
    };
  }

  return { valid: true };
}
```

**修改** `app/api/v1/chat/route.ts`:

```typescript
// Step 2: Model validation
const modelValidation = validateModel(model);  // 保持不变，使用默认行为
```

**修改** `app/api/v1/chat/__tests__/route.test.ts`:

```typescript
// 不再需要 mock getOpenApiModels
// 测试时直接传入允许的模型列表

// 或者保持 mock，但添加 beforeEach 重置
beforeEach(() => {
  vi.clearAllMocks();

  const { getOpenApiModels } = await import("@/lib/config/models");
  vi.mocked(getOpenApiModels).mockReturnValue([
    {
      id: "anthropic/claude-3-7-sonnet-20250219",
      name: "Claude 3.7 Sonnet",
      categories: ["chat", "general"],
    },
    {
      id: "qwen/qwen-max-latest",
      name: "Qwen Max Latest",
      categories: ["general"],
    },
  ]);
});
```

---

### 方案 2: 使用 vi.mocked() 确保 mock 生效

**修改** `app/api/v1/chat/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { POST } from "../route";

// Mock dependencies
vi.mock("@/lib/config/models");
vi.mock("@/lib/model-registry/dynamic-registry");
vi.mock("@/lib/utils");
vi.mock("ai");
vi.mock("@/lib/tools/tool-registry");

describe("POST /api/v1/chat", () => {
  beforeEach(async () => {
    // 动态导入并设置 mock
    const models = await import("@/lib/config/models");
    vi.mocked(models.getOpenApiModels).mockReturnValue([
      {
        id: "anthropic/claude-3-7-sonnet-20250219",
        name: "Claude 3.7 Sonnet",
        categories: ["chat", "general"],
      },
      {
        id: "qwen/qwen-max-latest",
        name: "Qwen Max Latest",
        categories: ["general"],
      },
    ]);

    const ai = await import("ai");
    vi.mocked(ai.streamText).mockReturnValue({
      toUIMessageStreamResponse: () => new Response("mock stream", {
        headers: { "Content-Type": "text/event-stream" },
      }),
    } as any);

    vi.mocked(ai.generateText).mockResolvedValue({
      text: "Mock response",
      usage: {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      },
    } as any);

    // ... 其他 mock 配置
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // 测试用例...
});
```

---

### 方案 3: 使用 MSW (Mock Service Worker)

为 API 层提供完整的 mock：

```typescript
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

const server = setupServer(
  http.get('/api/v1/models', () => {
    return HttpResponse.json({
      success: true,
      data: {
        models: [
          { id: "anthropic/claude-3-7-sonnet-20250219", name: "Claude", categories: ["chat"] },
        ],
      },
    });
  }),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

---

## 推荐方案

**优先级**: 方案 1 > 方案 2 > 方案 3

**理由**:
1. **方案 1** - 最简单，改动最小，提升可测试性
2. **方案 2** - 需要重写测试配置，但不改变生产代码
3. **方案 3** - 最完整，但引入新依赖

---

## 实施步骤

### 步骤 1: 修改 validateModel 函数（10分钟）
```bash
# 编辑 lib/utils/open-chat-utils.ts
# 添加可选参数 allowedModels
```

### 步骤 2: 添加 beforeEach hook（20分钟）
```bash
# 编辑 app/api/v1/chat/__tests__/route.test.ts
# 添加 beforeEach 配置 mock
```

### 步骤 3: 运行测试验证（10分钟）
```bash
pnpm test -- app/api/v1/chat/__tests__/route.test.ts --run
# 预期: 所有测试通过
```

### 步骤 4: 清理和优化（20分钟）
```bash
# 移除冗余的 mock 配置
# 确保测试隔离性
```

**预计总时间**: 1小时

---

## 附加建议

1. **测试隔离性**
   - 每个测试应该独立运行
   - 使用 `beforeEach` 和 `afterEach` 确保清理

2. **Mock 最佳实践**
   - Mock 应该在测试文件顶部声明
   - 使用 `vi.mocked()` 确保类型安全
   - 在 `beforeEach` 中重置 mock 状态

3. **测试可读性**
   - 使用描述性的测试名称
   - 将 mock 配置提取为辅助函数
   - 添加注释说明 mock 的目的

---

## 相关文档

- [Vitest Mocking Guide](https://vitest.dev/guide/mocking.html)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [OPEN_API_IMPROVEMENTS.md](./OPEN_API_IMPROVEMENTS.md)
