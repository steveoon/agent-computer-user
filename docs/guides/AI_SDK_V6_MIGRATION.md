# Migration Guide: Migrate AI SDK 5.x to 6.0

## Recommended Migration Process

1. Backup your project. If you use a versioning control system, make sure all previous versions are committed.
2. Upgrade to AI SDK 6.0.
3. Follow the breaking changes guide below.
4. Verify your project is working as expected.
5. Commit your changes.

## AI SDK 6.0 Package Versions

You need to update the following packages to the latest versions in your package.json file(s):

- `ai` package: `^6.0.0`
- `@ai-sdk/provider` package: `^3.0.0`
- `@ai-sdk/provider-utils` package: `^4.0.0`
- `@ai-sdk/*` packages: `^3.0.0`

An example upgrade command would be:

```bash
pnpm install ai@latest @ai-sdk/react@latest @ai-sdk/openai@latest
```

## Codemods

The AI SDK provides Codemod transformations to help upgrade your codebase when a feature is deprecated, removed, or otherwise changed. Codemods are transformations that run on your codebase automatically. They allow you to easily apply many changes without having to manually go through every file.

You can run all v6 codemods (v5 → v6 migration) by running the following command from the root of your project:

```bash
npx @ai-sdk/codemod v6
```

There is also an `npx @ai-sdk/codemod upgrade` command, but it runs all codemods from all versions (v4, v5, and v6). Use `v6` when upgrading from v5.

Individual codemods can be run by specifying the name of the codemod:

```bash
npx @ai-sdk/codemod <codemod-name> <path>
```

For example, to run a specific v6 codemod:

```bash
npx @ai-sdk/codemod v6/rename-text-embedding-to-embedding src/
```

Codemods are intended as a tool to help you with the upgrade process. They may not cover all of the changes you need to make. You may need to make additional changes manually.

### Codemod Table

| Codemod Name                                             | Description                                                                                        |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `rename-text-embedding-to-embedding`                     | Renames `textEmbeddingModel` to `embeddingModel` and `textEmbedding` to `embedding` on providers   |
| `rename-mock-v2-to-v3`                                   | Renames V2 mock classes from `ai/test` to V3 (e.g., `MockLanguageModelV2` → `MockLanguageModelV3`) |
| `rename-tool-call-options-to-tool-execution-options`     | Renames the `ToolCallOptions` type to `ToolExecutionOptions`                                       |
| `rename-core-message-to-model-message`                   | Renames the `CoreMessage` type to `ModelMessage`                                                   |
| `rename-converttocoremessages-to-converttomodelmessages` | Renames `convertToCoreMessages` function to `convertToModelMessages`                               |
| `rename-vertex-provider-metadata-key`                    | Renames `google` to `vertex` in `providerMetadata` and `providerOptions` for Google Vertex files   |
| `wrap-tomodeloutput-parameter`                           | Wraps `toModelOutput` parameter in object destructuring (`output` → `{ output }`)                  |
| `add-await-converttomodelmessages`                       | Adds `await` to `convertToModelMessages` calls (now async in AI SDK 6)                             |

## AI SDK Core

### Experimental_Agent to ToolLoopAgent Class

The `Experimental_Agent` class has been replaced with the `ToolLoopAgent` class. Two key changes:

- The `system` parameter has been renamed to `instructions`
- The default `stopWhen` has changed from `stepCountIs(1)` to `stepCountIs(20)`

**AI SDK 5:**

```javascript
import { Experimental_Agent as Agent, stepCountIs } from "ai";
import { deepseek } from "@ai-sdk/deepseek";

const agent = new Agent({
  model: deepseek("deepseek-v3.1"),
  system: "You are a helpful assistant.",
  tools: {
    // your tools here
  },
  stopWhen: stepCountIs(20), // Required for multi-step agent loops
});

const result = await agent.generate({
  prompt: "What is the weather in San Francisco?",
});
```

**AI SDK 6:**

```javascript
import { ToolLoopAgent } from "ai";
import { deepseek } from "@ai-sdk/deepseek";

const agent = new ToolLoopAgent({
  model: deepseek("deepseek-v3.1"),
  instructions: "You are a helpful assistant.",
  tools: {
    // your tools here
  },
  // stopWhen defaults to stepCountIs(20)
});

const result = await agent.generate({
  prompt: "What is the weather in San Francisco?",
});
```

Learn more about [building agents](#).

### CoreMessage Removal

The deprecated `CoreMessage` type and related functions have been removed (PR #10710).

Replace `convertToCoreMessages` with `convertToModelMessages`.

**AI SDK 5:**

```javascript
import { convertToCoreMessages, type CoreMessage } from 'ai';

const coreMessages = convertToCoreMessages(messages); // CoreMessage[]
```

**AI SDK 6:**

```javascript
import { convertToModelMessages, type ModelMessage } from 'ai';

const modelMessages = await convertToModelMessages(messages); // ModelMessage[]
```

Use the `rename-core-message-to-model-message` and `rename-converttocoremessages-to-converttomodelmessages` codemods to automatically update your codebase.

### generateObject and streamObject Deprecation

`generateObject` and `streamObject` have been deprecated (PR #10754). They will be removed in a future version. Use `generateText` and `streamText` with an output setting instead.

**AI SDK 5:**

```javascript
import { generateObject } from "ai";
import { deepseek } from "@ai-sdk/deepseek";
import { z } from "zod";

const { object } = await generateObject({
  model: deepseek("deepseek-v3.1"),
  schema: z.object({
    recipe: z.object({
      name: z.string(),
      ingredients: z.array(z.object({ name: z.string(), amount: z.string() })),
      steps: z.array(z.string()),
    }),
  }),
  prompt: "Generate a lasagna recipe.",
});
```

**AI SDK 6:**

```javascript
import { generateText, Output } from "ai";
import { deepseek } from "@ai-sdk/deepseek";
import { z } from "zod";

const { output } = await generateText({
  model: deepseek("deepseek-v3.1"),
  output: Output.object({
    schema: z.object({
      recipe: z.object({
        name: z.string(),
        ingredients: z.array(z.object({ name: z.string(), amount: z.string() })),
        steps: z.array(z.string()),
      }),
    }),
  }),
  prompt: "Generate a lasagna recipe.",
});
```

For streaming structured data, replace `streamObject` with `streamText`:

**AI SDK 5:**

```javascript
import { streamObject } from "ai";
import { deepseek } from "@ai-sdk/deepseek";
import { z } from "zod";

const { partialObjectStream } = streamObject({
  model: deepseek("deepseek-v3.1"),
  schema: z.object({
    recipe: z.object({
      name: z.string(),
      ingredients: z.array(z.object({ name: z.string(), amount: z.string() })),
      steps: z.array(z.string()),
    }),
  }),
  prompt: "Generate a lasagna recipe.",
});

for await (const partialObject of partialObjectStream) {
  console.log(partialObject);
}
```

**AI SDK 6:**

```javascript
import { streamText, Output } from "ai";
import { deepseek } from "@ai-sdk/deepseek";
import { z } from "zod";

const { partialOutputStream } = streamText({
  model: deepseek("deepseek-v3.1"),
  output: Output.object({
    schema: z.object({
      recipe: z.object({
        name: z.string(),
        ingredients: z.array(z.object({ name: z.string(), amount: z.string() })),
        steps: z.array(z.string()),
      }),
    }),
  }),
  prompt: "Generate a lasagna recipe.",
});

for await (const partialObject of partialOutputStream) {
  console.log(partialObject);
}
```

Learn more about [generating structured data](#).

### async convertToModelMessages

`convertToModelMessages()` is async in AI SDK 6 to support async `Tool.toModelOutput()`.

**AI SDK 5:**

```javascript
import { convertToModelMessages } from "ai";

const modelMessages = convertToModelMessages(uiMessages);
```

**AI SDK 6:**

```javascript
import { convertToModelMessages } from "ai";

const modelMessages = await convertToModelMessages(uiMessages);
```

Use the `add-await-converttomodelmessages` codemod to automatically update your codebase.

### Tool.toModelOutput changes

`toModelOutput()` receives a parameter object with an `output` property in AI SDK 6. In AI SDK 5, the output was the arguments.

**AI SDK 5:**

```javascript
import { tool } from "ai";

const someTool = tool({
  // ...
  toModelOutput: output => {
    // ...
  },
});
```

**AI SDK 6:**

```javascript
import { tool } from "ai";

const someTool = tool({
  // ...
  toModelOutput: ({ output }) => {
    // ...
  },
});
```

Use the `wrap-tomodeloutput-parameter` codemod to automatically update your codebase.

### cachedInputTokens and reasoningTokens in LanguageModelUsage Deprecation

`cachedInputTokens` and `reasoningTokens` in `LanguageModelUsage` have been deprecated. You can replace `cachedInputTokens` with `inputTokenDetails.cacheReadTokens` and `reasoningTokens` with `outputTokenDetails.reasoningTokens`.

### ToolCallOptions to ToolExecutionOptions Rename

The `ToolCallOptions` type has been renamed to `ToolExecutionOptions` and is now deprecated. Use the `rename-tool-call-options-to-tool-execution-options` codemod to automatically update your codebase.

### Per-Tool Strict Mode

Strict mode for tools is now controlled by setting `strict` on each tool (PR #10817). This enables fine-grained control over strict tool calls, which is important since strict mode depends on the specific tool input schema.

**AI SDK 5:**

```javascript
import { deepseek } from "@ai-sdk/deepseek";
import { streamText, tool } from "ai";
import { z } from "zod";

// Tool strict mode was controlled by strictJsonSchema
const result = streamText({
  model: deepseek("deepseek-v3.1"),
  tools: {
    calculator: tool({
      description: "A simple calculator",
      inputSchema: z.object({
        expression: z.string(),
      }),
      execute: async ({ expression }) => {
        const result = eval(expression);
        return { result };
      },
    }),
  },
  providerOptions: {
    openai: {
      strictJsonSchema: true, // Applied to all tools
    },
  },
});
```

**AI SDK 6:**

```javascript
import { deepseek } from "@ai-sdk/deepseek";
import { streamText, tool } from "ai";
import { z } from "zod";

const result = streamText({
  model: deepseek("deepseek-v3.1"),
  tools: {
    calculator: tool({
      description: "A simple calculator",
      inputSchema: z.object({
        expression: z.string(),
      }),
      execute: async ({ expression }) => {
        const result = eval(expression);
        return { result };
      },
      strict: true, // Control strict mode per tool
    }),
  },
});
```

### Flexible Tool Content

AI SDK 6 introduces more flexible tool output and result content support (PR #9605), enabling richer tool interactions and better support for complex tool execution patterns.

### ToolCallRepairFunction Signature

The `system` parameter in the `ToolCallRepairFunction` type now accepts `SystemModelMessage` in addition to `string` (PR #10635). This allows for more flexible system message configuration, including provider-specific options like caching.

**AI SDK 5:**

```javascript
import type { ToolCallRepairFunction } from 'ai';

const repairToolCall: ToolCallRepairFunction<MyTools> = async ({
  system, // type: string | undefined
  messages,
  toolCall,
  tools,
  inputSchema,
  error,
}) => {
  // ...
};
```

**AI SDK 6:**

```javascript
import type { ToolCallRepairFunction, SystemModelMessage } from 'ai';

const repairToolCall: ToolCallRepairFunction<MyTools> = async ({
  system, // type: string | SystemModelMessage | undefined
  messages,
  toolCall,
  tools,
  inputSchema,
  error,
}) => {
  // Handle both string and SystemModelMessage
  const systemText = typeof system === 'string' ? system : system?.content;
  // ...
};
```

### Embedding Model Method Rename

The `textEmbeddingModel` and `textEmbedding` methods on providers have been renamed to `embeddingModel` and `embedding` respectively. Additionally, generics have been removed from `EmbeddingModel`, `embed`, and `embedMany` (PR #10592).

**AI SDK 5:**

```javascript
import { openai } from "@ai-sdk/openai";
import { embed } from "ai";

// Using the full method name
const model = openai.textEmbeddingModel("text-embedding-3-small");

// Using the shorthand
const model = openai.textEmbedding("text-embedding-3-small");

const { embedding } = await embed({
  model: openai.textEmbedding("text-embedding-3-small"),
  value: "sunny day at the beach",
});
```

**AI SDK 6:**

```javascript
import { openai } from "@ai-sdk/openai";
import { embed } from "ai";

// Using the full method name
const model = openai.embeddingModel("text-embedding-3-small");

// Using the shorthand
const model = openai.embedding("text-embedding-3-small");

const { embedding } = await embed({
  model: openai.embedding("text-embedding-3-small"),
  value: "sunny day at the beach",
});
```

Use the `rename-text-embedding-to-embedding` codemod to automatically update your codebase.

### Warning Logger

AI SDK 6 introduces a warning logger that outputs deprecation warnings and best practice recommendations (PR #8343). To disable warning logging, set the `AI_SDK_LOG_WARNINGS` environment variable to `false`:

```bash
export AI_SDK_LOG_WARNINGS=false
```

### Warning Type Unification

Separate warning types for each generation function have been consolidated into a single `Warning` type exported from the `ai` package (PR #10631).

**AI SDK 5:**

```javascript
import type {
  CallWarning,
  ImageModelCallWarning,
  SpeechWarning,
  TranscriptionWarning,
} from 'ai';
```

**AI SDK 6:**

```javascript
import type { Warning } from 'ai';
```

### Finish reason "unknown" merged into "other"

The `unknown` finish reason has been removed. It is now returned as `other`.

## AI SDK UI

### Tool UI Part Helper Functions Rename

The tool UI part helper functions have been renamed to better reflect their purpose and to accommodate both static and dynamic tool parts (PR #XXXX).

#### isToolUIPart → isStaticToolUIPart

The `isToolUIPart` function has been renamed to `isStaticToolUIPart` to clarify that it checks for static tool parts only.

**AI SDK 5:**

```javascript
import { isToolUIPart } from "ai";

// Check if a part is a tool UI part
if (isToolUIPart(part)) {
  console.log(part.toolName);
}
```

**AI SDK 6:**

```javascript
import { isStaticToolUIPart } from "ai";

// Check if a part is a static tool UI part
if (isStaticToolUIPart(part)) {
  console.log(part.toolName);
}
```

#### isToolOrDynamicToolUIPart → isToolUIPart

The `isToolOrDynamicToolUIPart` function has been renamed to `isToolUIPart`. The old name is deprecated but still available.

**AI SDK 5:**

```javascript
import { isToolOrDynamicToolUIPart } from "ai";

// Check if a part is either a static or dynamic tool UI part
if (isToolOrDynamicToolUIPart(part)) {
  console.log("Tool part found");
}
```

**AI SDK 6:**

```javascript
import { isToolUIPart } from "ai";

// Check if a part is either a static or dynamic tool UI part
if (isToolUIPart(part)) {
  console.log("Tool part found");
}
```

#### getToolName → getStaticToolName

The `getToolName` function has been renamed to `getStaticToolName` to clarify that it returns the tool name from static tool parts only.

**AI SDK 5:**

```javascript
import { getToolName } from "ai";

// Get the tool name from a tool part
const name = getToolName(toolPart);
```

**AI SDK 6:**

```javascript
import { getStaticToolName } from "ai";

// Get the tool name from a static tool part
const name = getStaticToolName(toolPart);
```

#### getToolOrDynamicToolName → getToolName

The `getToolOrDynamicToolName` function has been renamed to `getToolName`. The old name is deprecated but still available.

**AI SDK 5:**

```javascript
import { getToolOrDynamicToolName } from "ai";

// Get the tool name from either a static or dynamic tool part
const name = getToolOrDynamicToolName(toolPart);
```

**AI SDK 6:**

```javascript
import { getToolName } from "ai";

// Get the tool name from either a static or dynamic tool part
const name = getToolName(toolPart);
```

## Providers

### OpenAI strictJsonSchema Defaults to True

The `strictJsonSchema` setting for JSON outputs and tool calls is enabled by default (PR #10752). This improves stability and ensures valid JSON output that matches your schema. However, strict mode is stricter about schema requirements. If you receive schema rejection errors, adjust your schema (for example, use `null` instead of `undefined`) or disable strict mode.

**AI SDK 5:**

```javascript
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

// strictJsonSchema was false by default
const result = await generateObject({
  model: openai("gpt-5.1"),
  schema: z.object({
    name: z.string(),
  }),
  prompt: "Generate a person",
});
```

**AI SDK 6:**

```javascript
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

// strictJsonSchema is true by default
const result = await generateObject({
  model: openai('gpt-5.1'),
  schema: z.object({
    name: z.string(),
  }),
  prompt: 'Generate a person',
});

// Disable strict mode if needed
const resultNoStrict = await generateObject({
  model: openai('gpt-5.1'),
  schema: z.object({
    name: z.string(),
  }),
  prompt: 'Generate a person',
  providerOptions: {
    openai: {
      strictJsonSchema: false,
    } satisfies OpenAIResponsesProviderOptions,
  },
});
```

### structuredOutputs Option Removed from Chat Model

The `structuredOutputs` provider option has been removed from chat models (PR #10752). Use `strictJsonSchema` instead.

### Azure Default Provider Uses Responses API

The `@ai-sdk/azure` provider now uses the Responses API by default when calling `azure()` (PR #9868). To use the previous Chat Completions API behavior, use `azure.chat()` instead.

**AI SDK 5:**

```javascript
import { azure } from "@ai-sdk/azure";

// Used Chat Completions API
const model = azure("gpt-4o");
```

**AI SDK 6:**

```javascript
import { azure } from "@ai-sdk/azure";

// Now uses Responses API by default
const model = azure("gpt-4o");

// Use azure.chat() for Chat Completions API
const chatModel = azure.chat("gpt-4o");

// Use azure.responses() explicitly for Responses API
const responsesModel = azure.responses("gpt-4o");
```

The Responses and Chat Completions APIs have different behavior and defaults. If you depend on the Chat Completions API, switch your model instance to `azure.chat()` and audit your configuration.

### Anthropic Structured Outputs Mode

Anthropic has introduced native structured outputs for Claude Sonnet 4.5 and later models. The `@ai-sdk/anthropic` provider now includes a `structuredOutputMode` option to control how structured outputs are generated (PR #10502). The available modes are:

- `'outputFormat'`: Use Anthropic's native `output_format` parameter
- `'jsonTool'`: Use a special JSON tool to specify the structured output format
- `'auto'` (default): Use `'outputFormat'` when supported by the model, otherwise fall back to `'jsonTool'`

**AI SDK 6:**

```javascript
import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { z } from 'zod';

const result = await generateObject({
  model: anthropic('claude-sonnet-4-5-20250929'),
  schema: z.object({
    name: z.string(),
    age: z.number(),
  }),
  prompt: 'Generate a person',
  providerOptions: {
    anthropic: {
      // Explicitly set the structured output mode (optional)
      structuredOutputMode: 'outputFormat',
    } satisfies AnthropicProviderOptions,
  },
});
```

### Google Vertex providerMetadata and providerOptions Key

The `@ai-sdk/google-vertex` provider now uses `vertex` as the key for `providerMetadata` and `providerOptions` instead of `google`. The `google` key is still supported for `providerOptions` input, but resulting `providerMetadata` output now uses `vertex`.

**AI SDK 5:**

```javascript
import { vertex } from "@ai-sdk/google-vertex";
import { generateText } from "ai";

const result = await generateText({
  model: vertex("gemini-2.5-flash"),
  providerOptions: {
    google: {
      safetySettings: [
        /* ... */
      ],
    }, // Used 'google' key
  },
  prompt: "Hello",
});

// Accessed metadata via 'google' key
console.log(result.providerMetadata?.google?.safetyRatings);
```

**AI SDK 6:**

```javascript
import { vertex } from "@ai-sdk/google-vertex";
import { generateText } from "ai";

const result = await generateText({
  model: vertex("gemini-2.5-flash"),
  providerOptions: {
    vertex: {
      safetySettings: [
        /* ... */
      ],
    }, // Now uses 'vertex' key
  },
  prompt: "Hello",
});

// Access metadata via 'vertex' key
console.log(result.providerMetadata?.vertex?.safetyRatings);
```

Use the `rename-vertex-provider-metadata-key` codemod to automatically update your codebase.

### ai/test Mock Classes V2

V2 mock classes have been removed from the `ai/test` module. Use the new V3 mock classes instead for testing.

**AI SDK 5:**

```javascript
import {
  MockEmbeddingModelV2,
  MockImageModelV2,
  MockLanguageModelV2,
  MockProviderV2,
  MockSpeechModelV2,
  MockTranscriptionModelV2,
} from "ai/test";
```

**AI SDK 6:**

```javascript
import {
  MockEmbeddingModelV3,
  MockImageModelV3,
  MockLanguageModelV3,
  MockProviderV3,
  MockSpeechModelV3,
  MockTranscriptionModelV3,
} from "ai/test";
```

Use the `rename-mock-v2-to-v3` codemod to automatically update your codebase.
