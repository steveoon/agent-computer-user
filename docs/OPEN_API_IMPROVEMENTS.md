# Open API 改进建议

**日期**: 2025-10-10
**状态**: 待讨论

---

## 问题概述

在完成高优先级和中优先级任务后，发现以下三个需要讨论的问题：

### 1. promptType 描述信息的维护问题

**当前实现**:
```typescript
// app/api/v1/prompt-types/route.ts
function getPromptTypeDescription(type: string): string {
  const descriptions: Record<string, string> = {
    bossZhipinSystemPrompt: "BOSS直聘招聘助手系统提示词",
    bossZhipinLocalSystemPrompt: "BOSS直聘本地招聘助手系统提示词",
    generalComputerSystemPrompt: "通用计算机助手系统提示词",
  };
  return descriptions[type] || "未知类型";
}
```

**问题**:
- 描述信息硬编码在接口中
- 与 `lib/loaders/system-prompts.loader.ts` 中的提示词名称重复
- 新增 promptType 时需要在多处修改

**改进方案 A: 集中元数据管理**（推荐）

创建 `lib/constants/prompt-types.ts`:
```typescript
export const PROMPT_TYPE_METADATA: Record<string, {
  id: string;
  description: string;
  category: "recruitment" | "general" | "local";
  loader?: () => Promise<string>; // 可选：关联到 loader 函数
}> = {
  bossZhipinSystemPrompt: {
    id: "bossZhipinSystemPrompt",
    description: "BOSS直聘招聘助手系统提示词",
    category: "recruitment",
    loader: getBossZhipinSystemPrompt,
  },
  // ...
};
```

**改进方案 B: 从 loader 导出元数据**

在 `lib/loaders/system-prompts.loader.ts` 中导出：
```typescript
export const SYSTEM_PROMPTS_META = {
  bossZhipinSystemPrompt: {
    name: "Boss直聘招聘助手",
    description: "BOSS直聘招聘助手系统提示词",
  },
  // ...
};
```

**建议**: 采用方案 A，元数据与实现分离，便于维护

---

### 2. config-schema 接口的实际价值

**当前实现**:
```typescript
// app/api/v1/config-schema/route.ts
export async function GET() {
  return createSuccessResponse({
    context: {
      preferredBrand: {
        type: "string",
        required: false,
        description: "首选品牌名称",
      },
      // ... 硬编码的字段说明
    },
  });
}
```

**问题**:
1. **维护成本高**: 类型变更时需要手动同步更新
2. **容易遗漏**: 新增字段可能忘记更新这里
3. **信息重复**: 与 TypeScript 类型定义和 Zod Schema 重复

**改进方案 A: 从 Zod Schema 自动生成**（推荐）

```typescript
import { zodToJsonSchema } from "zod-to-json-schema";
import { OpenChatRequestSchema } from "@/types/api";

export async function GET() {
  const jsonSchema = zodToJsonSchema(OpenChatRequestSchema, "OpenChatRequest");

  return createSuccessResponse({
    schema: jsonSchema,
    version: "1.0.0",
  });
}
```

**优点**:
- ✅ 自动同步，零维护成本
- ✅ 类型安全，不会遗漏
- ✅ 符合 JSON Schema 标准

**缺点**:
- ⚠️ 需要引入 `zod-to-json-schema` 依赖
- ⚠️ 生成的 schema 可能过于详细

**改进方案 B: 移除该接口**

直接提供 OpenAPI/Swagger 文档，例如:
- 使用 `@asteasolutions/zod-to-openapi`
- 生成标准的 OpenAPI 3.0 文档
- 通过 `/api/v1/openapi.json` 提供

**改进方案 C: 简化为字段列表**

只返回字段名和是否必需，不包含详细描述：
```typescript
export async function GET() {
  return createSuccessResponse({
    fields: {
      required: ["model", "messages"],
      optional: ["stream", "prune", "systemPrompt", "promptType", ...],
    },
  });
}
```

**建议**:
1. 短期: 保持现状，文档化维护流程
2. 长期: 考虑方案 A（Zod → JSON Schema）或方案 B（OpenAPI 文档）

---

### 3. 测试失败问题

**测试结果**:
```
✅ 通过: 288 个测试
❌ 失败: 32 个测试
⏭️ 跳过: 3 个测试
```

**失败原因分析**:

所有失败测试都返回 403 状态码，根本原因是 **Mock 配置问题**:

```typescript
// 测试中的 mock
vi.mock("@/lib/config/models", () => ({
  getOpenApiModels: vi.fn().mockReturnValue([...]), // ❌ 在某些测试中返回 undefined
}));
```

**具体失败的测试**:
1. 非流式响应完整性测试 (3个)
2. 负例补充测试 (5个)
3. systemPrompt 相关测试 (5个)
4. 其他边界场景 (19个)

**解决方案**:

**方案 A: 修复全局 Mock**（推荐）

在 `vitest.setup.ts` 或测试文件顶部统一配置：
```typescript
// app/api/v1/chat/__tests__/route.test.ts
beforeAll(() => {
  vi.mock("@/lib/config/models", () => ({
    getOpenApiModels: vi.fn().mockReturnValue([
      { id: "anthropic/claude-3-7-sonnet-20250219", name: "Claude 3.7 Sonnet", categories: ["chat"] },
      { id: "qwen/qwen-max-latest", name: "Qwen Max Latest", categories: ["general"] },
    ]),
    DEFAULT_PROVIDER_CONFIGS: { /* ... */ },
  }));
});
```

**方案 B: 使用真实的 getOpenApiModels**

移除 mock，使用实际实现：
```typescript
// 不 mock getOpenApiModels，让它使用真实逻辑
// 确保测试环境有正确的配置
```

**方案 C: 每个测试独立 Mock**

在需要的测试中单独配置：
```typescript
it("should work", async () => {
  const { getOpenApiModels } = await import("@/lib/config/models");
  (getOpenApiModels as any).mockReturnValueOnce([...]);
  // test code
});
```

**建议**: 采用方案 A，在测试文件的 beforeAll 中统一配置

---

## 优先级建议

| 问题 | 优先级 | 工作量 | 建议方案 |
|------|--------|--------|----------|
| 1. promptType 描述维护 | 🟡 中 | 1小时 | 方案 A: 集中元数据管理 |
| 2. config-schema 价值 | 🟢 低 | 讨论决定 | 短期保持现状，长期考虑 OpenAPI |
| 3. 测试失败修复 | 🔴 高 | 2小时 | 方案 A: 修复全局 Mock |

---

## 下一步行动

### 立即执行（必需）
1. **修复测试 Mock 配置**（2小时）
   - 在测试文件中添加 beforeAll 配置
   - 确保 getOpenApiModels 返回有效数据
   - 运行测试验证所有用例通过

### 短期改进（建议）
2. **优化 promptType 元数据管理**（1小时）
   - 创建 `lib/constants/prompt-types.ts`
   - 集中管理元数据
   - 更新 prompt-types 接口使用新元数据

### 长期优化（可选）
3. **考虑 OpenAPI 文档方案**（讨论）
   - 评估是否需要完整的 OpenAPI 文档
   - 如需要，引入 `@asteasolutions/zod-to-openapi`
   - 移除或替换 config-schema 接口

---

## 总结

**当前状态**:
- ✅ 核心功能 100% 实现
- ✅ 文档符合度 100%
- ⚠️ 测试覆盖率 89%（288/323 通过）
- ⚠️ 部分代码存在维护性问题

**建议优先处理**: 测试 Mock 修复 > promptType 元数据优化 > config-schema 长期方案讨论
