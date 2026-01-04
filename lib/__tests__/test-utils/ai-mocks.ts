import { MockLanguageModelV3, MockProviderV3, mockId } from "ai/test";
import { simulateReadableStream } from "ai";
import type {
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamPart,
  LanguageModelV3FinishReason,
  LanguageModelV3Usage,
  LanguageModelV3Text,
  LanguageModelV3ToolCall,
  SharedV3Warning,
} from "@ai-sdk/provider";

/**
 * AI SDK v6 类型安全的 Mock 工具集
 *
 * 使用 SDK 定义的类型而非 any，确保端到端类型安全
 */

// ========== 类型定义 ==========

interface MockToolCall {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

interface MockStreamOptions {
  includeUsage?: boolean;
  delay?: number;
  toolCalls?: MockToolCall[];
}

// AI SDK v6 使用新的 FinishReason 结构
const createFinishReason = (
  unified: LanguageModelV3FinishReason["unified"],
  raw?: string
): LanguageModelV3FinishReason => ({
  unified,
  raw,
});

/**
 * AI SDK v6 的 Usage 结构更复杂，包含详细的 token 分类
 * 用于测试时创建标准的 usage 对象
 */
const createUsage = (inputTokens: number, outputTokens: number): LanguageModelV3Usage => ({
  inputTokens: {
    total: inputTokens,
    noCache: inputTokens,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: {
    total: outputTokens,
    text: outputTokens,
    reasoning: undefined,
  },
});

// 空警告数组
const emptyWarnings: SharedV3Warning[] = [];

// ========== Mock 函数 ==========

/**
 * 创建文本流 Mock
 * 用于模拟 AI 模型的流式文本响应
 */
export function createMockTextStream(
  chunks: string[],
  options: MockStreamOptions = {}
): MockLanguageModelV3 {
  const { includeUsage = true, delay = 100, toolCalls = [] } = options;

  return new MockLanguageModelV3({
    doStream: async () => {
      const streamChunks: LanguageModelV3StreamPart[] = [];

      // Add text chunks - AI SDK v6 format
      if (chunks.length > 0) {
        const textId = mockId({ prefix: "text" })();
        // Start text part
        streamChunks.push({
          type: "text-start",
          id: textId,
        });

        // Add text deltas
        chunks.forEach(chunk => {
          streamChunks.push({
            type: "text-delta",
            id: textId,
            delta: chunk,
          });
        });
      }

      // Add tool calls if any - AI SDK v6 format
      toolCalls.forEach(({ toolCallId, toolName, args }) => {
        streamChunks.push({
          type: "tool-input-start",
          id: toolCallId,
          toolName,
        });

        streamChunks.push({
          type: "tool-input-delta",
          id: toolCallId,
          delta: JSON.stringify(args),
        });
      });

      // Add finish event - usage is required in finish part
      const finishPart: LanguageModelV3StreamPart = {
        type: "finish",
        finishReason: createFinishReason("stop"),
        usage: createUsage(100, 50),
      };

      // If usage should not be included, we still need to provide it (SDK requirement)
      // but tests can ignore it
      if (!includeUsage) {
        finishPart.usage = createUsage(0, 0);
      }

      streamChunks.push(finishPart);

      return {
        stream: simulateReadableStream({
          chunks: streamChunks,
          chunkDelayInMs: delay,
        }),
      };
    },
  });
}

/**
 * 创建工具调用流 Mock
 * 用于模拟 AI 模型触发工具调用的场景
 */
export function createMockToolCallStream(
  toolName: string,
  args: Record<string, unknown>,
  _resultText: string = "Tool executed successfully",
  delay: number = 100
): MockLanguageModelV3 {
  const toolCallId = mockId({ prefix: "call" })();
  const toolInputId = mockId({ prefix: "tool" })();

  // AI SDK v6: ToolCall.input 是 JSON 字符串，不是对象
  const toolCall: LanguageModelV3ToolCall = {
    type: "tool-call",
    toolCallId,
    toolName,
    input: JSON.stringify(args),
  };

  // 创建符合 LanguageModelV3GenerateResult 的结果
  const generateResult: LanguageModelV3GenerateResult = {
    content: [toolCall],
    finishReason: createFinishReason("tool-calls"),
    usage: createUsage(100, 50),
    warnings: emptyWarnings,
  };

  return new MockLanguageModelV3({
    doGenerate: generateResult,
    doStream: async () => {
      const streamChunks: LanguageModelV3StreamPart[] = [
        // Tool input start
        {
          type: "tool-input-start",
          id: toolInputId,
          toolName,
        },
        // Tool input delta - stream the arguments
        {
          type: "tool-input-delta",
          id: toolInputId,
          delta: JSON.stringify(args),
        },
        // Tool input end
        {
          type: "tool-input-end",
          id: toolInputId,
        },
        // Finish event
        {
          type: "finish",
          finishReason: createFinishReason("tool-calls"),
          usage: createUsage(100, 50),
        },
      ];

      return {
        stream: simulateReadableStream({
          chunks: streamChunks,
          chunkDelayInMs: delay,
        }),
      };
    },
  });
}

/**
 * 创建错误流 Mock
 * 用于测试错误处理场景
 */
export function createMockErrorStream(error: Error): MockLanguageModelV3 {
  return new MockLanguageModelV3({
    doStream: async () => {
      throw error;
    },
  });
}

/**
 * 内部工具名称常量，与 safeGenerateObject 保持一致
 */
const SUBMIT_OBJECT_TOOL_NAME = "submit_structured_output";

/**
 * 创建对象生成 Mock
 * 用于测试 safeGenerateObject 场景（如分类）
 *
 * 注意：safeGenerateObject 使用 tool-based pattern，
 * 所以 mock 需要返回一个工具调用而不是纯文本
 */
export function createMockObjectGeneration<T extends Record<string, unknown>>(
  object: T
): MockLanguageModelV3 {
  const toolCallId = mockId({ prefix: "call" })();

  // AI SDK v6: 返回工具调用结果
  const toolCall: LanguageModelV3ToolCall = {
    type: "tool-call",
    toolCallId,
    toolName: SUBMIT_OBJECT_TOOL_NAME,
    input: JSON.stringify(object),
  };

  const generateResult: LanguageModelV3GenerateResult = {
    finishReason: createFinishReason("tool-calls"),
    usage: createUsage(50, 20),
    content: [toolCall],
    warnings: emptyWarnings,
  };

  return new MockLanguageModelV3({
    doGenerate: generateResult,
  });
}

/**
 * 创建简单文本生成 Mock
 * 用于测试 generateText 场景
 */
export function createMockTextGeneration(text: string): MockLanguageModelV3 {
  const textContent: LanguageModelV3Text = {
    type: "text",
    text,
  };

  const generateResult: LanguageModelV3GenerateResult = {
    finishReason: createFinishReason("stop"),
    usage: createUsage(50, 20),
    content: [textContent],
    warnings: emptyWarnings,
  };

  return new MockLanguageModelV3({
    doGenerate: generateResult,
  });
}

/**
 * 创建 Mock Provider Registry
 * 使用 AI SDK v6 的 MockProviderV3 确保类型安全
 */
export function createMockModelRegistry(mockModel: MockLanguageModelV3): MockProviderV3 {
  return new MockProviderV3({
    languageModels: {
      default: mockModel,
    },
  });
}
