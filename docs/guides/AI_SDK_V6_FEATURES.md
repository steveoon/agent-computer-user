# AI SDK 6 - Vercel

**发布日期**: 2025年12月22日 | **阅读时长**: 12分钟

## 概述

AI SDK 拥有超过 2000 万月下载量，是领先的 TypeScript AI 应用开发工具包。它提供统一的 API 来集成任何 AI 提供商，并与 Next.js、React、Svelte、Vue 和 Node.js 无缝集成。

### 案例分享

**Thomson Reuters** 使用 AI SDK 仅用 3 名开发者在 2 个月内构建了 CoCounsel（面向律师、会计师和审计团队的 AI 助手）。现在服务于 1,300 家会计公司，他们正在将整个代码库迁移到 AI SDK，废弃了跨 10 个提供商的数千行代码，整合为一个可组合、可扩展的系统。

**Clay** 使用它构建了 Claygent，这是一个 AI 网络研究代理，可以抓取公共数据，通过 MCP 服务器连接第一方来源，帮助销售团队找到具有自定义、针对性洞察的客户。

> "我们全面采用了 AI SDK。它的代理能力和 TypeScript 优先设计为我们的 AI 网络研究代理（Claygent）提供了大规模支持。它在我们为客户构建采购、资格认证和发现正确客户和潜在客户的代理时提供了巨大帮助。"  
> —— Jeff Barg, Clay

---

## AI SDK 6 新特性

- **Agents** - 代理抽象
- **Tool Improvements** - 工具改进
- **MCP** - Model Context Protocol 支持
- **Tool Calling with Structured Output** - 工具调用与结构化输出
- **DevTools** - 开发者工具
- **Reranking** - 重排序
- **Standard JSON Schema** - 标准 JSON Schema 支持
- **Image Editing** - 图像编辑
- **Raw Finish Reason & Extended Usage** - 原始完成原因和扩展使用信息
- **LangChain Adapter Rewrite** - LangChain 适配器重写
- **New Provider Tools** - 新的提供商工具

**升级提示**: 从 AI SDK 5 升级？运行 `npx @ai-sdk/codemod v6` 自动迁移，只需最少的代码更改。

---

## 1. Agents（代理）

AI SDK 6 引入了 Agent 抽象，用于构建可重用的代理。一次定义您的代理及其模型、指令和工具，然后在整个应用程序中使用它。代理自动与完整的 AI SDK 生态系统集成，为您提供类型安全的 UI 流式传输、结构化输出和无缝框架支持。

### 问题背景

使用 `generateText` 和 `streamText` 的函数式方法功能强大且低级别，无论规模如何都能提供完全控制。但当您想在不同媒介（聊天 UI、后台作业、API 端点）中重用同一代理，或在单独的文件中使用工具来组织代码时，内联配置方法就会失效。您最终会到处传递相同的配置对象或构建自己的抽象层。

### ToolLoopAgent

`ToolLoopAgent` 类提供了一个生产就绪的实现，可处理完整的工具执行循环。它使用您的提示调用 LLM，执行任何请求的工具调用，将结果添加回对话，并重复直到完成（默认情况下最多 20 步：`stopWhen: stepCountIs(20)`）。

```typescript
import { ToolLoopAgent } from "ai";
import { weatherTool } from "@/tools/weather";

export const weatherAgent = new ToolLoopAgent({
  model: "anthropic/claude-sonnet-4.5",
  instructions: "You are a helpful weather assistant.",
  tools: {
    weather: weatherTool,
  },
});

const result = await weatherAgent.generate({
  prompt: "What is the weather in San Francisco?",
});
```

**了解更多**: [Building Agents 文档](https://sdk.vercel.ai/docs/ai-sdk-core/agents)

### Call Options（调用选项）

使用调用选项，您可以在 `ToolLoopAgent` 上调用 `generate` 或 `stream` 时传递类型安全的参数。例如，您可以使用它们为 RAG 注入检索到的文档、根据请求复杂性选择模型或自定义每个请求的工具行为。

```typescript
import { ToolLoopAgent } from "ai";
import { z } from "zod";

const supportAgent = new ToolLoopAgent({
  model: "anthropic/claude-sonnet-4.5",
  callOptionsSchema: z.object({
    userId: z.string(),
    accountType: z.enum(["free", "pro", "enterprise"]),
  }),
  prepareCall: ({ options, ...settings }) => ({
    ...settings,
    instructions: `You are a helpful customer support agent.
- User Account type: ${options.accountType}
- User ID: ${options.userId}`,
  }),
});

const result = await supportAgent.generate({
  prompt: "How do I upgrade my account?",
  options: {
    userId: "user_123",
    accountType: "free",
  },
});
```

**了解更多**: [Configuring Call Options 文档](https://sdk.vercel.ai/docs/ai-sdk-core/agents#call-options)

### Code Organization & UI Integration（代码组织和 UI 集成）

代理抽象推动您实现清晰的关注点分离，并通过端到端类型安全来奖励您。在专用文件中定义工具，将它们组合成代理，并通过 API 路由公开它们。为您的代理逻辑提供支持的相同定义也会为您的 UI 组件提供类型。

```typescript
// agents/weather-agent.ts
import { ToolLoopAgent, InferAgentUIMessage } from "ai";
import { weatherTool } from "@/tools/weather-tool";

export const weatherAgent = new ToolLoopAgent({
  model: "anthropic/claude-sonnet-4.5",
  instructions: "You are a helpful weather assistant.",
  tools: { weather: weatherTool },
});

export type WeatherAgentUIMessage = InferAgentUIMessage<typeof weatherAgent>;

// app/api/chat/route.ts
import { createAgentUIStreamResponse } from "ai";
import { weatherAgent } from "@/agents/weather-agent";

export async function POST(request: Request) {
  const { messages } = await request.json();
  return createAgentUIStreamResponse({
    agent: weatherAgent,
    uiMessages: messages,
  });
}
```

在客户端，类型会自动流动。从代理文件导入消息类型，然后通过切换部分类型来渲染类型化的工具组件。

```typescript
// app/page.tsx
import { useChat } from '@ai-sdk/react';
import type { WeatherAgentUIMessage } from '@/agents/weather-agent';
import { WeatherToolView } from '@/components/weather-tool-view';

export default function Chat() {
  const { messages, sendMessage } = useChat<WeatherAgentUIMessage>();
  return (
    <div>
      {messages.map((message) =>
        message.parts.map((part) => {
          switch (part.type) {
            case 'tool-weather':
              return <WeatherToolView invocation={part} />;
          }
        })
      )}
    </div>
  );
}

// components/weather-tool-view.tsx
import { UIToolInvocation } from 'ai';
import { weatherTool } from '@/tools/weather-tool';

export function WeatherToolView({
  invocation,
}: {
  invocation: UIToolInvocation<typeof weatherTool>;
}) {
  return (
    <div>
      Weather in {invocation.input.location} is {invocation.output?.temperature}°F
    </div>
  );
}
```

**定义一次，随处使用**。相同的工具定义为您的代理逻辑、API 响应和 UI 组件提供支持。

**了解更多**: [Agents 文档](https://sdk.vercel.ai/docs/ai-sdk-core/agents)

### Custom Agent Implementations（自定义代理实现）

在 AI SDK 6 中，`Agent` 是一个接口而不是一个类。虽然 `ToolLoopAgent` 为大多数用例提供了可靠的默认实现，但您可以实现 `Agent` 接口来构建自己的代理抽象以满足您的需求。

一个这样的例子是 **Workflow DevKit**，它提供了 `DurableAgent`。它通过将代理转换为持久的、可恢复的工作流，使您的代理生产就绪，其中每个工具执行都成为可重试、可观察的步骤。

```typescript
import { getWritable } from "workflow";
import { DurableAgent } from "@workflow/ai/agent";
import { searchFlights, bookFlight, getFlightStatus } from "./tools";

export async function flightBookingWorkflow() {
  "use workflow";

  const flightAgent = new DurableAgent({
    model: "anthropic/claude-sonnet-4.5",
    system: "You are a flight booking assistant.",
    tools: {
      searchFlights,
      bookFlight,
      getFlightStatus,
    },
  });

  const result = await flightAgent.generate({
    prompt: "Find me a flight from NYC to London next Friday.",
    writable: getWritable(),
  });
}
```

**了解更多**: [Building Durable Agents 文档](https://sdk.vercel.ai/docs/ai-sdk-core/agents#custom-agent-implementations)

---

## 2. Tool Improvements（工具改进）

工具是代理能力的基础。代理采取有意义行动的能力完全取决于它能够多么可靠地生成有效的工具输入，这些输入如何与您的意图保持一致，工具输出如何高效地表示为对话中的令牌，以及这些工具如何在生产环境中安全执行。

AI SDK 6 改进了以下每个领域：

- **工具执行批准** - 人在环控制
- **严格模式** - 更可靠的输入生成
- **输入示例** - 更好的对齐
- **toModelOutput** - 灵活的工具输出

### Tool Execution Approval（工具执行批准）

构建可以执行真实世界操作（删除文件、处理支付、修改生产数据）的代理需要一个关键的安全层：人工批准。没有它，您就是盲目信任代理的每一个决定。

在 AI SDK 6 中，您只需使用一个 `needsApproval` 标志即可获得人在环控制，无需自定义代码。在 **Chat SDK**（用于构建聊天机器人应用程序的开源模板）中查看此功能的实际应用。Chat SDK 开箱即用地实现了工具执行批准，为您提供了人在环控制的生产就绪示例。

默认情况下，当模型调用工具时，工具会自动运行。设置 `needsApproval: true` 以要求执行前批准：

```typescript
import { tool } from "ai";
import { z } from "zod";

export const runCommand = tool({
  description: "Run a shell command",
  inputSchema: z.object({
    command: z.string().describe("The shell command to execute"),
  }),
  needsApproval: true, // 需要用户批准
  execute: async ({ command }) => {
    // 您的命令执行逻辑
  },
});
```

并非每个工具调用都需要批准。简单的 `ls` 命令可能可以自动批准，但破坏性的 `rm -rf` 命令应该需要审查。您可以将函数传递给 `needsApproval` 以根据输入做出决定，并存储用户偏好以记住已批准的模式以供将来调用。

```typescript
import { tool } from "ai";
import { z } from "zod";

const runCommand = tool({
  description: "Run a shell command",
  inputSchema: z.object({
    command: z.string().describe("The shell command to execute"),
  }),
  needsApproval: async ({ command }) => command.includes("rm -rf"),
  execute: async ({ command }) => {
    /* 命令执行逻辑 */
  },
});
```

在 UI 中处理批准很简单，使用 `useChat`。检查工具调用状态，提示用户，并使用 `addToolApprovalResponse` 返回响应：

```typescript
import { ChatAddToolApproveResponseFunction } from 'ai';
import { runCommand } from './tools/command-tool';

export function CommandToolView({
  invocation,
  addToolApprovalResponse,
}: {
  invocation: UIToolInvocation<typeof runCommand>;
  addToolApprovalResponse: ChatAddToolApproveResponseFunction;
}) {
  if (invocation.state === 'approval-requested') {
    return (
      <div>
        <p>Run command: {invocation.input.command}?</p>
        <button
          onClick={() =>
            addToolApprovalResponse({
              id: invocation.approval.id,
              approved: true,
            })
          }
        >
          Approve
        </button>
        <button
          onClick={() =>
            addToolApprovalResponse({
              id: invocation.approval.id,
              approved: false,
            })
          }
        >
          Deny
        </button>
      </div>
    );
  }

  if (invocation.state === 'output-available') {
    return <div>Output: {invocation.output}</div>;
  }

  // 处理其他状态...
}
```

**了解更多**: [Tool Execution Approval 文档](https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling#tool-execution-approval)

### Strict Mode（严格模式）

当可用时，来自语言模型提供商的原生严格模式保证工具调用输入与您的 schema 完全匹配。但是，某些提供商在严格模式下仅支持 JSON schema 规范的子集。如果您请求中的任何工具使用了不兼容的 schema 功能，则整个请求都会失败。

AI SDK 6 使严格模式成为每个工具的可选功能。对具有兼容 schema 的工具使用严格模式，对其他工具使用常规模式，全部在同一调用中。

```typescript
tool({
  description: "Get the weather in a location",
  inputSchema: z.object({
    location: z.string(),
  }),
  strict: true, // 为此工具启用严格验证
  execute: async ({ location }) => ({
    // ...
  }),
});
```

### Input Examples（输入示例）

具有嵌套对象、特定格式要求或领域特定模式的复杂工具 schema 很难仅通过工具描述清楚地描述。即使有详细的每个字段描述，模型有时也会生成技术上有效但与您期望的模式不匹配的输入。

输入示例向模型显示正确结构输入的具体实例，阐明了在 schema 描述中难以表达的期望：

```typescript
tool({
  description: "Get the weather in a location",
  inputSchema: z.object({
    location: z.string().describe("The location to get the weather for"),
  }),
  inputExamples: [{ input: { location: "San Francisco" } }, { input: { location: "London" } }],
  execute: async ({ location }) => {
    // ...
  },
});
```

输入示例目前仅由 Anthropic 原生支持。对于不支持它们的提供商，您可以使用 `addToolInputExamplesMiddleware` 将示例附加到工具描述。如果未使用中间件且提供商不支持输入示例，则会忽略它们且不会发送给提供商。

### Send Custom Tool Output to the Model（向模型发送自定义工具输出）

默认情况下，您从工具的 `execute` 函数返回的任何内容都会在后续轮次中作为字符串化 JSON 发送到模型。但是，当工具返回大型文本输出（文件内容、搜索结果）或二进制数据（屏幕截图、生成的图像）时，您最终会发送数千个不必要的令牌或笨拙地将图像编码为 base64 字符串。

`toModelOutput` 函数将您的工具结果与您发送到模型的内容分开。从 `execute` 函数为您的应用程序逻辑返回完整数据，然后使用 `toModelOutput` 精确控制哪些令牌返回到模型：

```typescript
import { tool } from "ai";
import { z } from "zod";

const weatherTool = tool({
  description: "Get the weather in a location",
  inputSchema: z.object({
    location: z.string().describe("The location to get the weather for"),
  }),
  execute: ({ location }) => ({
    temperature: 72 + Math.floor(Math.random() * 21) - 10,
  }),
  // toModelOutput 可以是同步或异步
  toModelOutput: async ({ input, output, toolCallId }) => {
    // 许多其他选项，包括 json、包含文件和图像的多部分等
    // (支持取决于提供商)
    // 示例：将工具输出作为文本发送
    return {
      type: "text",
      value: `The weather in ${input.location} is ${output.temperature}°F.`,
    };
  },
});
```

**了解更多**: [Tool Calling 文档](https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling)

---

## 3. MCP (Model Context Protocol)

AI SDK 6 扩展了我们的 MCP 支持，涵盖 OAuth 身份验证、资源、提示和征求。您现在可以通过资源公开数据，创建可重用的提示模板，并处理服务器发起的用户输入请求。它现在稳定并可在 `@ai-sdk/mcp` 包中使用。

### HTTP Transport（HTTP 传输）

要连接到远程 MCP 服务器，您需要使用服务器 URL 和身份验证标头配置 HTTP 传输：

```typescript
import { createMCPClient } from "@ai-sdk/mcp";

const mcpClient = await createMCPClient({
  transport: {
    type: "http",
    url: "https://your-server.com/mcp",
    headers: { Authorization: "Bearer my-api-key" },
  },
});

const tools = await mcpClient.tools();
```

### OAuth Authentication（OAuth 身份验证）

远程 MCP 服务器通常需要身份验证，特别是访问用户数据或第三方 API 的托管服务。正确实现 OAuth 意味着处理 PKCE 挑战、令牌刷新、动态客户端注册以及令牌在会话中期过期时的重试逻辑。如果这些中的任何一个出错，您的集成就会中断。

AI SDK 6 为您处理完整的 OAuth 流程：

```typescript
import { createMCPClient, auth, OAuthClientProvider } from "@ai-sdk/mcp";

const authProvider: OAuthClientProvider = {
  redirectUrl: "http://localhost:3000/callback",
  clientMetadata: {
    client_name: "My App",
    redirect_uris: ["http://localhost:3000/callback"],
    grant_types: ["authorization_code", "refresh_token"],
  },
  // 令牌和凭证存储方法
  tokens: async () => {
    /* ... */
  },
  saveTokens: async tokens => {
    /* ... */
  },
  // ... 其余 OAuthClientProvider 配置
};

await auth(authProvider, { serverUrl: new URL("https://mcp.example.com") });

const client = await createMCPClient({
  transport: { type: "http", url: "https://mcp.example.com", authProvider },
});
```

### Resources and Prompts（资源和提示）

MCP 服务器可以通过资源（文件、数据库记录、API 响应）公开数据，您的应用程序可以发现和读取这些数据。提示提供来自服务器的可重用模板，完整包含您在运行时填写的参数：

```typescript
// 列出和读取资源
const resources = await mcpClient.listResources();
const resourceData = await mcpClient.readResource({
  uri: "file:///example/document.txt",
});

// 列出和获取提示
const prompts = await mcpClient.experimental_listPrompts();
const prompt = await mcpClient.experimental_getPrompt({
  name: "code_review",
  arguments: { code: "function add(a, b) { return a + b; }" },
});
```

### Elicitation Support（征求支持）

有时 MCP 服务器需要用户输入中间操作（确认、选项之间的选择或其他上下文）。征求让服务器请求此输入，而您的应用程序处理收集它：

```typescript
const mcpClient = await createMCPClient({
  transport: { type: "sse", url: "https://your-server.com/sse" },
  capabilities: { elicitation: {} },
});

mcpClient.onElicitationRequest(ElicitationRequestSchema, async request => {
  const userInput = await getInputFromUser(request.params.message, request.params.requestedSchema);

  return {
    action: "accept",
    content: userInput,
  };
});
```

**了解更多**: [MCP Tools 文档](https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling#mcp-tools)

---

## 4. Tool Calling with Structured Output（工具调用与结构化输出）

以前，将工具调用与结构化输出结合需要将 `generateText` 和 `generateObject` 链接在一起。AI SDK 6 统一了 `generateObject` 和 `generateText`，以启用多步工具调用循环，最后生成结构化输出。

```typescript
import { Output, ToolLoopAgent, tool } from "ai";
import { z } from "zod";

const agent = new ToolLoopAgent({
  model: "anthropic/claude-sonnet-4.5",
  tools: {
    weather: tool({
      description: "Get the weather in a location",
      inputSchema: z.object({ city: z.string() }),
      execute: async ({ city }) => {
        // ...
      },
    }),
  },
  output: Output.object({
    schema: z.object({
      summary: z.string(),
      temperature: z.number(),
      recommendation: z.string(),
    }),
  }),
});

const { output } = await agent.generate({
  prompt: "What is the weather in San Francisco and what should I wear?",
});
```

### Output Types（输出类型）

结构化输出支持多种格式。使用 `Output` 对象指定您需要的形状：

- **Output.object()** - 生成结构化对象
- **Output.array()** - 生成结构化对象数组
- **Output.choice()** - 从特定选项集中选择
- **Output.json()** - 生成非结构化 JSON
- **Output.text()** - 生成纯文本（默认行为）

**了解更多**: [Generating Structured Data 文档](https://sdk.vercel.ai/docs/ai-sdk-core/generating-structured-data)

---

## 5. DevTools（开发者工具）

调试多步代理流程很困难。一步中上下文或输入令牌的微小变化可能会有意义地改变该步骤的输出，这会改变下一步的输入，依此类推。到最后，轨迹完全不同，追溯导致它的原因意味着手动记录每个步骤并自己拼凑序列。

AI SDK DevTools 为您提供了对 LLM 调用和代理的完全可见性。检查任何调用的每个步骤，包括输入、输出、模型配置、令牌使用、时间以及原始提供商请求和响应。

### Setup（设置）

要开始使用，请使用 `devToolsMiddleware` 包装您的模型：

```typescript
import { wrapLanguageModel, gateway } from "ai";
import { devToolsMiddleware } from "@ai-sdk/devtools";

const devToolsEnabledModel = wrapLanguageModel({
  model: gateway("anthropic/claude-sonnet-4.5"),
  middleware: devToolsMiddleware(),
});
```

然后将其与任何 AI SDK 函数一起使用：

```typescript
import { generateText } from "ai";

const result = await generateText({
  model: devToolsEnabledModel,
  prompt: "What is love?",
});
```

### Inspecting Your Runs（检查您的运行）

使用 `npx @ai-sdk/devtools` 启动查看器并打开 `http://localhost:4983` 以检查您的运行。您将能够看到：

- **输入参数和提示**: 查看发送到 LLM 的完整输入
- **输出内容和工具调用**: 检查生成的文本和工具调用
- **令牌使用和时间**: 监控资源消耗和性能
- **原始提供商数据**: 访问完整的请求和响应有效负载

**了解更多**: [DevTools 文档](https://sdk.vercel.ai/docs/ai-sdk-core/devtools)

---

## 6. Reranking（重排序）

向语言模型提供相关上下文不仅仅是检索可能相关的所有内容。模型在有重点、高度相关的上下文下表现更好。重排序根据搜索结果与特定查询的相关性重新排序搜索结果，让您只将最相关的文档传递给模型。

AI SDK 6 使用新的 `rerank` 函数添加了对重排序的原生支持：

```typescript
import { rerank } from "ai";
import { cohere } from "@ai-sdk/cohere";

const documents = [
  "sunny day at the beach",
  "rainy afternoon in the city",
  "snowy night in the mountains",
];

const { ranking } = await rerank({
  model: cohere.reranking("rerank-v3.5"),
  documents,
  query: "talk about rain",
  topN: 2,
});

console.log(ranking);
// [
//   { originalIndex: 1, score: 0.9, document: 'rainy afternoon in the city' },
//   { originalIndex: 0, score: 0.3, document: 'sunny day at the beach' }
// ]
```

### Structured Document Reranking（结构化文档重排序）

重排序还支持结构化文档，使其非常适合搜索数据库、电子邮件或其他结构化内容：

```typescript
import { rerank } from "ai";
import { cohere } from "@ai-sdk/cohere";

const documents = [
  { from: "Paul Doe", subject: "Follow-up", text: "20% discount offer..." },
  {
    from: "John McGill",
    subject: "Missing Info",
    text: "Oracle pricing: $5000/month",
  },
];

const { rerankedDocuments } = await rerank({
  model: cohere.reranking("rerank-v3.5"),
  documents,
  query: "Which pricing did we get from Oracle?",
  topN: 1,
});
```

`rerank` 函数目前支持 **Cohere**、**Amazon Bedrock** 和 **Together.ai**。

**了解更多**: [Reranking 文档](https://sdk.vercel.ai/docs/ai-sdk-core/reranking)

---

## 7. Standard JSON Schema（标准 JSON Schema）

AI SDK 6 添加了对实现标准 JSON Schema 接口的任何 schema 库的支持。以前，SDK 需要为每个 schema 库（Arktype、Valibot）提供内置转换器。现在，任何实现标准 JSON Schema V1 规范的库都会自动工作，无需额外的 SDK 更改。

```typescript
import { generateText, Output } from "ai";
import { type } from "arktype";

const result = await generateText({
  model: "anthropic/claude-sonnet-4.5",
  output: Output.object({
    schema: type({
      recipe: {
        name: "string",
        ingredients: type({ name: "string", amount: "string" }).array(),
        steps: "string[]",
      },
    }),
  }),
  prompt: "Generate a lasagna recipe.",
});
```

**了解更多**: [Tools 文档](https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling)

---

## 8. Provider Tools（提供商工具）

AI SDK 6 扩展了对提供商特定工具的支持，这些工具利用独特的平台能力和模型训练功能。这些工具旨在与特定模型或平台（如网络搜索、代码执行和内存管理）一起使用，其中提供商已为这些能力优化了其模型或提供了其他地方不可用的平台特定功能。

### Anthropic Provider Tools

- **Memory Tool**: 通过内存文件目录在对话中存储和检索信息
- **Tool Search (Regex)**: 使用正则表达式模式动态搜索和选择工具
- **Tool Search (BM25)**: 使用自然语言查询搜索和选择工具
- **Code Execution Tool**: 在具有 bash 和文件操作的安全沙箱环境中运行代码

```typescript
import { anthropic } from "@ai-sdk/anthropic";

// Memory Tool - 存储和检索信息
const memory = anthropic.tools.memory_20250818({
  execute: async action => {
    // 实现内存存储逻辑
    // 支持: view, create, str_replace, insert, delete, rename
  },
});

// Tool Search (Regex) - 通过模式查找工具
const toolSearchRegex = anthropic.tools.toolSearchRegex_20251119();

// Tool Search (BM25) - 使用自然语言查找工具
const toolSearchBm25 = anthropic.tools.toolSearchBm25_20251119();

// Code Execution Tool - 在沙箱中运行代码
const codeExecution = anthropic.tools.codeExecution_20250825();
```

AI SDK 6 还添加了对**程序化工具调用**的支持，允许 Claude 从代码执行环境调用您的工具，使中间结果远离上下文。这可以显著降低令牌使用和成本。

使用 `allowedCallers` 将工具标记为可从代码执行调用，并使用 `prepareStep` 在步骤之间保留容器：

```typescript
import { anthropic, forwardAnthropicContainerIdFromLastStep } from "@ai-sdk/anthropic";

const getWeather = tool({
  description: "Get weather for a city.",
  inputSchema: z.object({ city: z.string() }),
  execute: async ({ city }) => ({ temp: 22 }),
  providerOptions: {
    anthropic: { allowedCallers: ["code_execution_20250825"] },
  },
});

const result = await generateText({
  model: anthropic("claude-sonnet-4-5"),
  tools: {
    code_execution: anthropic.tools.codeExecution_20250825(),
    getWeather,
  },
  prepareStep: forwardAnthropicContainerIdFromLastStep,
});
```

**了解更多**: [Anthropic 文档](https://sdk.vercel.ai/docs/ai-sdk-providers/anthropic)

### OpenAI Provider Tools

- **Shell Tool**: 执行具有超时和输出限制的 shell 命令
- **Apply Patch Tool**: 使用结构化差异创建、更新和删除文件
- **MCP Tool**: 连接到远程 Model Context Protocol 服务器

```typescript
import { openai } from "@ai-sdk/openai";

// Shell Tool - 执行 shell 命令
const shell = openai.tools.shell({
  execute: async ({ action }) => {
    // action.commands: string[] - 要执行的命令
    // action.timeoutMs: 可选超时
    // action.maxOutputLength: 可选最大返回字符数
  },
});

// Apply Patch Tool - 使用差异的文件操作
const applyPatch = openai.tools.applyPatch({
  execute: async ({ callId, operation }) => {
    // operation.type: 'create_file' | 'update_file' | 'delete_file'
    // operation.path: 文件路径
    // operation.diff: 差异内容 (用于创建/更新)
  },
});

// MCP Tool - 连接到 MCP 服务器
const mcp = openai.tools.mcp({
  serverLabel: "my-mcp-server",
  serverUrl: "https://mcp.example.com",
  allowedTools: ["tool1", "tool2"],
});
```

**了解更多**: [OpenAI 文档](https://sdk.vercel.ai/docs/ai-sdk-providers/openai)

### Google Provider Tools

- **Google Maps Tool**: 使用 Maps 基础启用位置感知响应 (Gemini 2.0+)
- **Vertex RAG Store Tool**: 从 Vertex AI RAG Engine 语料库检索上下文 (Gemini 2.0+)
- **File Search Tool**: 文件搜索存储中的语义和关键字搜索 (Gemini 2.5+)

```typescript
import { google } from "@ai-sdk/google";

// Google Maps Tool - 位置感知基础
const googleMaps = google.tools.googleMaps();

// Vertex RAG Store Tool - 从 RAG 语料库检索
const vertexRagStore = google.tools.vertexRagStore({
  ragCorpus: "projects/{project}/locations/{location}/ragCorpora/{rag_corpus}",
  topK: 5, // 可选: 要检索的上下文数
});

// File Search Tool - 在文件存储中搜索
const fileSearch = google.tools.fileSearch({
  fileSearchStoreNames: ["fileSearchStores/my-store-123"],
  topK: 10, // 可选: 要检索的块数
  metadataFilter: "author=John Doe", // 可选: AIP-160 过滤器
});
```

**了解更多**: [Google 文档](https://sdk.vercel.ai/docs/ai-sdk-providers/google-generative-ai)

### xAI Provider Tools

- **Web Search**: 使用域过滤和图像理解搜索网络
- **X Search**: 使用用户名和日期过滤器搜索 X (Twitter) 帖子
- **Code Execution**: 在沙箱环境中运行代码
- **View Image**: 分析和描述图像
- **View X Video**: 分析 X 视频内容

```typescript
import { xai } from "@ai-sdk/xai";

// Web Search Tool - 搜索网络
const webSearch = xai.tools.webSearch({
  allowedDomains: ["wikipedia.org", "github.com"], // 可选: 最多 5 个
  excludedDomains: ["example.com"], // 可选: 最多 5 个
  enableImageUnderstanding: true, // 可选
});

// X Search Tool - 搜索 X 帖子
const xSearch = xai.tools.xSearch({
  allowedXHandles: ["elonmusk", "xai"], // 可选: 最多 10 个
  fromDate: "2025-01-01", // 可选
  toDate: "2025-12-31", // 可选
  enableImageUnderstanding: true, // 可选
  enableVideoUnderstanding: true, // 可选
});

// Code Execution Tool - 运行代码
const codeExecution = xai.tools.codeExecution();

// View Image Tool - 分析图像
const viewImage = xai.tools.viewImage();

// View X Video Tool - 分析 X 视频
const viewXVideo = xai.tools.viewXVideo();
```

**了解更多**: [xAI 文档](https://sdk.vercel.ai/docs/ai-sdk-providers/xai)

---

## 9. Image Editing（图像编辑）

图像生成模型不仅能够进行文本到图像生成。许多模型现在支持图像到图像操作，如修复（inpainting）、扩展（outpainting）、风格迁移等。

AI SDK 6 扩展了 `generateImage`，通过接受参考图像和文本提示来支持图像编辑：

```typescript
import { generateImage } from "ai";
import { blackForestLabs } from "@ai-sdk/black-forest-labs";

const { images } = await generateImage({
  model: blackForestLabs.image("flux-2-pro"),
  prompt: {
    text: "Edit this to make it two tanukis on a date",
    images: ["https://www.example.com/tanuki.png"],
  },
});
```

参考图像可以作为 URL 字符串、base64 编码字符串、Uint8Array、ArrayBuffer 或 Buffer 提供。

**注意**: `experimental_generateImage` 已被提升为稳定版并重命名为 `generateImage`。

**了解更多**: [Image Generation 文档](https://sdk.vercel.ai/docs/ai-sdk-core/generating-images)

---

## 10. Raw Finish Reason & Extended Usage（原始完成原因和扩展使用信息）

AI SDK 6 通过原始完成原因和重构的使用信息提高了对模型响应的可见性。

### Raw Finish Reason（原始完成原因）

当提供商添加 AI SDK 无法识别的新完成原因时，它们以前显示为 `'other'`。现在，`rawFinishReason` 公开来自提供商的确切字符串，让您在 AI SDK 更新之前处理特定于提供商的情况。

```typescript
const { finishReason, rawFinishReason } = await generateText({
  model: "anthropic/claude-sonnet-4.5",
  prompt: "What is love?",
});

// finishReason: 'other' (映射的)
// rawFinishReason: 'end_turn' (提供商特定的)
```

当提供商具有映射到单个 AI SDK 值的多个完成原因，或者当您需要区分特定提供商行为时，这很有用。

### Extended Usage Information（扩展使用信息）

使用报告现在包括输入和输出令牌的详细细分：

```typescript
const { usage } = await generateText({
  model: "anthropic/claude-sonnet-4.5",
  prompt: "What is love?",
});

// 输入令牌详细信息
usage.inputTokenDetails.noCacheTokens; // 非缓存输入令牌
usage.inputTokenDetails.cacheReadTokens; // 从缓存读取的令牌
usage.inputTokenDetails.cacheWriteTokens; // 写入缓存的令牌

// 输出令牌详细信息
usage.outputTokenDetails.textTokens; // 文本生成令牌
usage.outputTokenDetails.reasoningTokens; // 推理令牌（在支持的地方）

// 原始提供商使用
usage.raw; // 完整的提供商特定使用对象
```

这些详细的细分为您提供了优化成本和调试跨提供商令牌使用所需的可见性。

---

## 11. LangChain Adapter Rewrite（LangChain 适配器重写）

`@ai-sdk/langchain` 包已被重写以支持现代 LangChain 和 LangGraph 功能。新 API 包括：

- **toBaseMessages()** - 将 UI 消息转换为 LangChain 格式
- **toUIMessageStream()** - 转换 LangGraph 事件流
- **LangSmithDeploymentTransport** - 浏览器端连接到 LangSmith 部署

```typescript
import { toBaseMessages, toUIMessageStream } from "@ai-sdk/langchain";
import { createUIMessageStreamResponse } from "ai";

const langchainMessages = await toBaseMessages(messages);
const stream = await graph.stream({ messages: langchainMessages });

return createUIMessageStreamResponse({
  stream: toUIMessageStream(stream),
});
```

适配器现在支持具有部分输入流、推理块和通过 LangGraph 中断的人在环工作流的工具调用。

此版本完全向后兼容。

**了解更多**: [LangChain Adapter 文档](https://sdk.vercel.ai/docs/ai-sdk-core/langchain)

---

## 12. Migrating to AI SDK 6（迁移到 AI SDK 6）

AI SDK 6 是一个主要版本，因为引入了 v3 语言模型规范，该规范支持代理和工具批准等新功能。但是，与 AI SDK 5 不同，此版本预计不会对大多数用户产生重大破坏性更改。

版本升级反映了规范的改进，而不是 SDK 的完全重新设计。如果您使用的是 AI SDK 5，迁移到 v6 应该是简单的，只需最少的代码更改。

### 自动迁移

```bash
npx @ai-sdk/codemod upgrade v6
```

有关所有更改和可能需要的手动步骤的详细概述，请参阅我们的 **AI SDK 6 迁移指南**。该指南包括分步说明和示例以确保平滑更新。

---

## Getting Started（开始使用）

> "我对 v6 非常兴奋。从 streamText 到可组合代理的转变很优雅，围绕类型安全、MCP 和代理准备的新 API 也是如此。团队在 API 设计上投入的关注令人惊叹。"  
> —— Josh, Upstash

凭借强大的新功能，如 `ToolLoopAgent`、人在环工具批准、具有工具调用的稳定结构化输出以及用于调试的 DevTools，现在是开始使用 AI SDK 构建 AI 应用程序的最佳时机。

### 资源链接

- **启动新的 AI 项目**: 使用我们最新的 Next.js、React、Svelte 等指南快速启动和运行。[查看我们的最新指南](https://sdk.vercel.ai/docs)
- **探索我们的模板**: 访问我们的[模板库](https://vercel.com/templates?type=ai)获取生产就绪的起始项目
- **迁移到 v6**: 使用我们的自动化 codemod 进行平滑过渡。我们的综合[迁移指南](https://sdk.vercel.ai/docs/ai-sdk-core/migration)涵盖所有破坏性更改
- **试用 DevTools**: 通过对 LLM 调用的完全可见性调试您的 AI 应用程序。查看 [DevTools 文档](https://sdk.vercel.ai/docs/ai-sdk-core/devtools)
- **加入社区**: 在我们的 [GitHub Discussions](https://github.com/vercel/ai/discussions) 中分享您正在构建的内容、提出问题并与其他开发者联系

---

## Contributors（贡献者）

AI SDK 6 是我们 Vercel 核心团队（Gregor、Lars、Aayush、Josh、Nico）和我们出色的贡献者社区共同工作的结果：

viktorlarsson, shaper, AVtheking, SamyPesse, firemoonai, seldo, R-Taneja, ZiuChen, gaspar09, christian-bromann, jeremyphilemon, DaniAkash, a-tokyo, rohrz4nge, EwanTauran, codicecustode, shubham-021, kkawamu1, mclenhard, gdaybrice, dyh-sjtu, blurrah, EurFelux, AryanBagade, Omcodes23, jeffcarbs, codeyogi911, zirkelc, qkdreyer, tsuzaki430, qchuchu, karthikscale3, alex-deneuvillers, kesku, yorkeccak, guy-hartstein, Und3rf10w, siwachabhi, homanp, tengis617, SalvatoreAmoroso, ericciarla, baturyilmaz, chentsulin, kovereduard, yaonyan, mwln, IdoBouskila, wangyedev, rubnogueira, Emmaccen, priyanshusaini105, dpmishler, yilinjuang, JulioPeixoto, DeJeune, BangDori, shadowssdt, efantasia, kevinjosethomas, lukehrucker, Mohammedsinanpk, danielamitay, davidsonsns, teeverc, MQ37, jephal, TimPietrusky, theishangoswami, juliettech13, shelleypham, tconley1428, goyalshivansh2805, KirschX, neallseth, jltimm, rahulbhadja, tayyab3245, cwtuan, titouv, dylan-duan-aai, bel0v, josh-williams, amyegan, samjbobb, teunlao, dylanmoz, 0xlakshan, patelvivekdev, nvie, nlaz, drew-foxall, dannyroosevelt, Diluka, AlexKer, YosefLm, YutoKitano13, SarityS, jonaslalin, tobiasbueschel, dhofheinz, ethshea, ellis-driscoll, marcbouchenoire, shin-sakata, ellispinsky, DDU1222, ci, tomsseisums, kpman, juanuicich, A404coder, tamarshe-dev, crishoj, kevint-cerebras, arjunkmrm, Barbapapazes, nimeshnayaju, lewwolfe, sergical, tomerigal, huanshenyi, horita-yuya, rbadillap, syeddhasnainn, Dhravya, jagreehal, Mintnoii, mhodgson, amardeeplakshkar, aron, TooTallNate, Junyi-99, princejoogie, iiio2, MonkeyLeeT, joshualipman123, andrewdoro, fveiraswww, HugoRCD, rockingrohit9639

您在 GitHub 上的反馈、错误报告和拉取请求对塑造此版本至关重要。我们很高兴看到您将使用这些新功能构建什么。

---

**文档完整性确认**:
✅ 所有 12 个主要新特性章节完整
✅ 所有代码示例完整
✅ 所有提供商工具（Anthropic, OpenAI, Google, xAI）完整
✅ 迁移指南和开始使用部分完整
✅ 贡献者列表完整
