## Open API Agent Implementation Spec (v1)

目的：本规范面向 AI 编码代理（非人类开发者），读完即可按步骤实现一套对外开放的 Agent 聊天 OpenAPI，与内部 `/api/chat` 解耦，但复用核心能力（模型注册、工具系统、可选消息剪裁与流式输出）。

重点：最小可用默认仅文本对话；通过参数渐进启用剪裁、工具、沙盒、不同流式协议。

### 1. 范围与目标

- 实现对外主入口：`POST /api/v1`（当前已存在文件：`app/api/v1/route.ts`）。
- 提供三类能力：
  - 文本对话（必选）
  - 工具调用（可选，按白名单精确启用）
  - 流式输出（默认 SSE；支持非流式 JSON）
- 提供枚举与发现接口：
  - `GET /api/v1/models`：对外许可模型列表
  - `GET /api/v1/tools`：对外可用工具清单、`requiredContext`、`requiresSandbox`
  - `GET /api/v1/config-schema`：对外公开的上下文/配置字段说明（不含敏感值）

### 2. 兼容性与复用策略

- 模型：沿用动态模型注册（`getDynamicRegistry(...).languageModel(modelId)`）。对外约定 `model` 为 `provider/model`（可多段，如 `openrouter/openai/gpt-4o`）。当未在许可列表中，返回 `403`。
- 消息剪裁：将内部 `prunedMessages()` 作为可选优化；默认不启用。
- 工具：不直接使用内部的 `promptType` 全量映射；对外优先以 `allowedTools` 精确白名单启用。保留 `promptType` 仅匹配“对外公共模板”（若未命中则忽略）。
- 沙盒：`sandboxId` 可选；需要沙盒的工具若启用且缺失，`400`。
- 流式：默认 SSE（`text/event-stream`）；支持非流式 JSON（`stream=false` 或 `response.format=json`）。

### 3. 接口契约（API Contracts）

#### 3.1 POST /api/v1

- 鉴权：`Authorization: Bearer <token>`（若缺失或无效 → `401`）。
- 请求体（JSON）：

```json
{
  "model": "anthropic/claude-3-7-sonnet-20250219",
  "messages": [
    // 支持两种格式，其一：
    { "role": "user", "content": "你好" },
    // 或 AI SDK v5 兼容格式：
    { "role": "user", "parts": [{ "type": "text", "text": "你好" }] }
  ],
  "stream": true,
  "prune": false,
  "pruneOptions": {
    "maxOutputTokens": 15000,
    "targetTokens": 8000,
    "preserveRecentMessages": 2
  },
  "allowedTools": ["bash", "zhipin_reply_generator"],
  "promptType": "bossZhipinSystemPrompt",
  "sandboxId": null,
  "context": {
    "preferredBrand": "蜀地源冒菜",
    "modelConfig": {
      "chatModel": "anthropic/claude-3-7-sonnet-20250219",
      "classifyModel": "qwen/qwen-max-latest",
      "replyModel": "qwen/qwen-plus-latest"
    },
    "configData": {
      "city": "上海",
      "stores": [],
      "brands": {
        "蜀地源冒菜": {
          "templates": {
            "general_chat": ["您好，这里是蜀地源冒菜招聘，请问有什么可以帮助您？"]
          },
          "screening": {
            "age": { "min": 18, "max": 55, "preferred": [] },
            "blacklistKeywords": [],
            "preferredKeywords": []
          }
        }
      },
      "defaultBrand": "蜀地源冒菜"
    },
    "replyPrompts": {
      "general_chat": "你是连锁餐饮招聘助手，请用简洁礼貌的语气与候选人沟通。",
      "initial_inquiry": "向候选人简要介绍品牌与岗位，并询问其城市与时间安排。",
      "schedule_inquiry": "用要点列出出勤安排与班次信息，避免冗长。",
      "salary_inquiry": "提供基础薪资与可能的补贴说明，避免承诺不可兑现的条款。",
      "interview_request": "给出面试可选时间段与地点/视频会议方式，并礼貌确认。",
      "availability_inquiry": "确认候选人的可用时间段，如不匹配则给备选方案。"
    },
    "dulidayToken": null,
    "defaultWechatId": "hr_001"
  },
  "toolContext": {
    "zhipin_reply_generator": {
      "replyPrompts": {
        "general_chat": "你是连锁餐饮招聘助手，请用简洁礼貌的语气与候选人沟通。"
      }
    }
  },
  "contextStrategy": "error", // error | skip | report
  "validateOnly": false
}
```

- 语义与校验：
  - `model`：必须在许可列表内（由 `/api/v1/models` 返回）。
  - `messages`：若仅有 `{role, content}`，需在服务端归一化为 AI SDK v5 `UIMessage`（将 `content` 转为 `parts=[{type:"text"}]`）。
  - `prune`：`true` 时调用 `prunedMessages(messages, pruneOptions)`，响应头附带 `X-Message-Pruned: true`。
  - `allowedTools`：精确启用的工具名集合；为空或缺省表示“禁用所有工具”（仅文本对话）。
  - `toolContext`：按工具名补充特定上下文；与顶层 `context` 合并（后者为默认，前者覆盖冲突字段）。
  - `contextStrategy`：
    - `error`（默认）：如某启用工具缺少其 `requiredContext` → `400`，体内列出缺失字段
    - `skip`：跳过无法实例化的工具，继续（响应头 `X-Tools-Skipped` 列表）
    - `report`：不执行，仅返回缺失上下文清单（等价 `validateOnly=true`）
  - `validateOnly`：`true` 时不产生内容，仅返回可机读的“缺失上下文/非法参数报告”（`200`）。
  - `promptType`：仅当命中“对外公共模板”时生效，用其工具集与上下文提示；否则忽略。
  - `promptType`：仅当命中“对外公共模板”时生效，用其工具集与上下文提示；否则忽略。
    - 可选值（项目内真实键名）：
      - `bossZhipinSystemPrompt`
      - `bossZhipinLocalSystemPrompt`
      - `generalComputerSystemPrompt`
  - `replyPrompts`：键必须来自 `ReplyContextSchema`（见 `types/zhipin.ts`），如：
    `general_chat`、`initial_inquiry`、`schedule_inquiry`、`salary_inquiry`、
    `interview_request`、`availability_inquiry`、`followup_chat`、`age_concern` 等。
    - 类型为 `Record<ReplyContext, string>`（值为字符串而非数组）。
    - 当使用 `zhipin_reply_generator` 工具时，服务端必须同时提供 `configData` 与 `replyPrompts`，否则返回 400（或按 `contextStrategy` 配置处理）。

- 响应（流式，默认 SSE）：
  - `Content-Type: text/event-stream; charset=utf-8`
  - 可能的事件：
    - `event: text`
      - `data: {"type":"text.delta","delta":"..."}`
    - `event: tool`
      - `data: {"type":"tool.start","name":"zhipin_reply_generator","args":{...}}`
      - `data: {"type":"tool.output","name":"zhipin_reply_generator","output":{...}}`
      - `data: {"type":"tool.error","name":"...","message":"..."}`
    - `event: usage`
      - `data: {"type":"usage.final","promptTokens":123,"completionTokens":45,"totalTokens":168}`
    - `event: done`
      - `data: {"type":"done"}`
    - `event: error`
      - `data: {"type":"error","code":"rate_limit","message":"..."}`
  - 头部建议：`Cache-Control: no-cache`, `X-Accel-Buffering: no`（避免代理缓冲）。
  - 实现要点：使用 `streamText({...}).toUIMessageStreamResponse({...})` 输出 UI Message 数据流，兼容 AI SDK `useChat` 协议与工具调用。

（已简化：不提供 NDJSON 模式）

- 响应（非流式 JSON，`stream=false` 或 `response.format=json`）：

```json
{
  "messages": [{ "role": "assistant", "parts": [{ "type": "text", "text": "..." }] }],
  "usage": { "promptTokens": 123, "completionTokens": 45, "totalTokens": 168 },
  "tools": { "used": ["zhipin_reply_generator"], "skipped": [] }
}
```

- 实现要点：
  - 文本一次性生成：优先使用 `generateText({ model, system, prompt })`，将文本封装为单条 `UIMessage` 放入 `messages` 数组返回；或直接返回 `{ text, usage }`（若不需要 `UIMessage` 结构）。
  - 结构化一次性生成（如需）：使用 `generateObject({ model, schema, system, prompt })`，返回 `{ object, usage }` 或将 `object` 转为 `messages` 中的文本/JSON 片段。
  - 当 `stream=false` 时，不应调用 `toUIMessageStreamResponse`；直接构造标准 JSON 响应并附带 `usage`。

- 失败响应（统一格式）：

```json
{
  "error": "InvalidParameter",
  "message": "sandboxId is required for tools: computer",
  "details": { "missing": ["sandboxId"], "tools": ["computer"] },
  "statusCode": 400,
  "correlationId": "req-xxxx"
}
```

#### 3.2 GET /api/v1/models

- 返回对外许可模型列表（ModelId 与描述）。

```json
{
  "success": true,
  "data": {
    "models": [
      {
        "id": "anthropic/claude-3-7-sonnet-20250219",
        "name": "Claude 3.7 Sonnet",
        "categories": ["chat", "general"]
      }
    ]
  }
}
```

#### 3.3 GET /api/v1/tools

- 返回对外可用工具清单：

```json
{
  "success": true,
  "data": {
    "tools": [
      { "name": "bash", "requiresSandbox": false, "requiredContext": [] },
      { "name": "computer", "requiresSandbox": true, "requiredContext": ["sandboxId"] },
      {
        "name": "zhipin_reply_generator",
        "requiresSandbox": false,
        "requiredContext": ["configData", "replyPrompts"]
      }
    ]
  }
}
```

#### 3.4 GET /api/v1/config-schema

- 返回对外公开的上下文/配置字段说明（仅字段与示例，不含私密值）：

```json
{
  "success": true,
  "data": {
    "context": {
      "preferredBrand": { "type": "string", "required": false },
      "configData": { "type": "ZhipinData", "required": "按工具需要" },
      "replyPrompts": { "type": "ReplyPromptsConfig", "required": "按工具需要" },
      "dulidayToken": { "type": "string|null", "required": "按工具需要" },
      "defaultWechatId": { "type": "string|null", "required": false },
      "sandboxId": { "type": "string|null", "required": "当启用 requiresSandbox 工具时" }
    }
  }
}
```

#### 3.5 鉴权机制（外部服务 + Next.js Middleware）

- 背景：鉴权接口已在外部服务托管（例如：`GET https://wolian.cc/api/v1/validate-key`），本项目不实现该接口。所有开放 API 的鉴权在到达业务路由前由 Next.js `middleware` 完成。

- 流程：
  1. 调用方向本项目任一 OpenAPI（如 `POST /api/v1`）发起请求，携带 `Authorization: Bearer <API_KEY>`。
  2. Next.js `middleware` 拦截受保护路径（如 `/api/v1/**`），将请求头中的 `Authorization` 原样转发至外部鉴权服务（如：`GET https://wolian.cc/api/v1/validate-key`）。
  3. 外部服务返回：
     - `200 {"isSuccess":true,...}` → 放行进入实际业务路由；
     - `401 {...}` 或非成功 → 直接返回 `401 Unauthorized`（建议响应体：`{"error":"Unauthorized","message":"API key invalid"}`）。

- 中间件要点：
  - 仅匹配受保护路径（如 `/api/v1/**`）；健康检查/静态资源等可放行。
  - 转发时不改写 `Authorization`，避免二次包装。
  - 外部服务超时/异常时，采用“安全优先”策略返回 401，或按需返回 503（需与运维约定）。
  - 可对校验结果做短期内存缓存（例如 60 秒）以降低外部调用频次；缓存键使用完整 Bearer Token。
  - 本项目暂不接入 Redis，默认使用“进程内内存缓存（in-memory cache）”。如需多副本一致性，可再接入集中式缓存。
  - SSE/长连接只在建立时校验一次，不对流式分片重复校验。

```ts
// middleware.ts（伪代码：外部服务校验 + 进程内内存缓存）
const tokenCache = new Map<string, number>(); // token -> expiresAt (ms)
const TOKEN_TTL_MS = 60_000; // 60s，可按需调整

export async function middleware(req: Request) {
  const url = new URL(req.url);
  if (!url.pathname.startsWith("/api/v1/")) return; // 非受保护路由放行

  const auth = req.headers.get("authorization");
  if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  // 进程内缓存命中则放行
  const now = Date.now();
  const cachedExpiry = tokenCache.get(auth);
  if (cachedExpiry && cachedExpiry > now) return; // 命中缓存

  // 外部服务校验（如 wolian.cc），成功则写入内存缓存
  const res = await fetch("https://wolian.cc/api/v1/validate-key", {
    method: "GET",
    headers: { Authorization: auth, "Content-Type": "application/json" },
  });
  if (res.ok) {
    tokenCache.set(auth, now + TOKEN_TTL_MS);
    return; // 放行
  }
  return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
}
```

### 4. 实现规范（服务端 Pipeline）

1. 解析与基础校验

- 读取 `Authorization`，无/无效 → `401`。
- 解析 JSON 体，校验必须字段：`model`, `messages`。
- 如 `validateOnly=true`，仅进行后续“静态校验”，不执行流式/模型调用。

2. 模型解析与许可校验

- 校验 `model` 字符串格式（`provider/.../model`）。
- 检查是否在许可列表，不在则 `403`。
- 构建 `dynamicRegistry` 并取 `languageModel(model)`。

3. 消息归一化与可选剪裁

- 将 `{role, content}` 归一化为 `parts=[{type:"text",text:content}]`。
- `prune=true` → 调用 `prunedMessages(messages, pruneOptions)`，记录节省比例并设置 `X-Message-Pruned`。

4. 工具集合构建与上下文合并

- 初始工具集合为空。
- 若提供 `promptType` 且命中“对外公共模板”，按模板并集入工具名。
- 合并 `allowedTools`（若为空则保持无工具）。
- 对每个待启用工具：
  - 计算 `effectiveContext = { ...context, ...(toolContext[name]||{}) }`。
  - 读取工具定义中的 `requiredContext` 与 `requiresSandbox`（来自工具注册表）。
  - 静态校验：缺失字段按 `contextStrategy` 处理（error/skip/report）。
  - 通过安全创建器实例化（失败则按 `contextStrategy` 处理）。

5. 生成与流式输出

- 使用 `streamText({ model, system?, messages, tools, providerOptions?, stopWhen? })`。
- 流式：输出 SSE（`toUIMessageStreamResponse`）；非流式：返回 JSON（通过 `stream=false` 或 `response.format=json`）。
- 错误映射：
  - 400：参数/上下文问题
  - 401：鉴权
  - 403：模型/工具不被允许
  - 409：沙盒状态问题
  - 429：频率限制
  - 500：内部错误（带 `correlationId`）

6. 清理逻辑

- 若流式/工具执行触发沙箱错误（根据项目已有 `shouldCleanupSandbox` 判定），尝试清理并记录日志。

### 5. 对外工具策略（Required Context）

- 统一通过工具定义上的 `requiredContext: (keyof ToolCreationContext)[]` 声明创建期必需上下文，服务端在实例化前做静态校验。
- 典型示例：
  - `computer`：`["sandboxId"]`
  - `zhipin_reply_generator`：`["configData","replyPrompts"]`
  - `duliday_*`：`["dulidayToken"]`
- 可通过 `/api/v1/tools` 提前发现要求；通过 `validateOnly=true` 做干跑校验；通过 `toolContext[name]` 为个别工具补齐上下文而不影响全局。

### 6. 安全与限流

- 必须使用 HTTPS。
- 鉴权：通过 Next.js `middleware` 调用外部鉴权服务（如 `GET https://wolian.cc/api/v1/validate-key`）验证 `Authorization: Bearer <token>`；本项目不实现鉴权接口。SSE 连接在建立时校验一次。
- 令牌缓存：验证通过的 Token 采用“进程内内存缓存（默认 30~120 秒）”降低外部调用压力；如需跨副本一致性再接入 Redis 等集中式缓存。
- 限流：建议在网关层实现；服务内可加简单令牌桶或并发上限。

### 7. 可观测性

- 为每次请求分配 `correlationId`（请求头透传或服务生成）。
- 统一结构化日志：模型、启用工具、被跳过工具、是否剪裁、用量统计、错误类型。

### 8. AI 代理执行任务清单（按序）

1. 类型与契约

- 在 `types/api.ts` 新增/导出 OpenAPI 请求/响应类型（可命名：`OpenChatRequest`, `OpenChatResponse`）。
- 定义消息归一化工具：将 `{role, content}` 转为 `UIMessage`（`parts`）。

2. 模型与枚举接口

- 新增 `GET /api/v1/models` 路由：读取许可模型（可基于现有 `MODEL_DICTIONARY` 与一份对外白名单），返回 `id/name/categories`。

3. 工具发现接口

- 新增 `GET /api/v1/tools` 路由：
  - 维护一份“对外工具白名单”常量（建议放置 `lib/tools/open-api-whitelist.ts`）。
  - 从注册表取每个工具的 `requiresSandbox` 与 `requiredContext` 并筛选白名单输出。

4. 配置 Schema 接口

- 新增 `GET /api/v1/config-schema`：返回可公开的上下文字段说明（静态结构即可）。

5. 主路由 `POST /api/v1`

- 解析与鉴权；校验必填字段。
- 归一化消息；可选剪裁。
- 解析工具：合并 `promptType`（公共模板）与 `allowedTools`；对每个工具合并 `context + toolContext[name]`，执行静态校验与实例化（依据 `contextStrategy`）。
- 调用 `streamText` 并基于 `stream`/`response.format` 输出 SSE 或 JSON。
- 映射错误码与错误体；设置头部（`X-Message-Pruned`, `X-Tools-Skipped`）。

6. 测试

- 为主路由添加单测/契约测试：
  - 文本对话（无工具）SSE/非流式 JSON
  - `allowedTools` 缺少上下文 → 400（error 策略）
  - `contextStrategy=skip` 生效并返回跳过列表
  - `validateOnly=true` 返回缺失清单
  - 非法模型/工具 → 403

### 9. 示例（最小可用调用）

请求：

```bash
curl -N -X POST \
  -H "Authorization: Bearer sk_xxx" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  https://your.domain/api/v1 \
  -d '{
    "model":"anthropic/claude-3-7-sonnet-20250219",
    "messages":[{"role":"user","content":"你好，帮我总结下本周进展"}],
    "stream":true
  }'
```

SSE 片段：

```text
event: text
data: {"type":"text.delta","delta":"好的，我来总结..."}

event: done
data: {"type":"done"}
```

### 10. 注意事项

- 若未来对外启用 `promptType` 模板，需在文档中明确“公共模板”ID 和对应工具集，否则一律忽略 `promptType`。
- 对外工具白名单与模型白名单应集中配置，便于审计与灰度。
- 对不能安全降级的上下文字段（如 `sandboxId`, `dulidayToken`）务必列入工具的 `requiredContext`。

—— 以上规范即为 AI 代理的实施蓝图，可直接按“任务清单”逐项落地实现。
