import { MockLanguageModelV2, mockId } from "ai/test";
import { simulateReadableStream } from "ai";

interface MockToolCall {
  toolCallId: string;
  toolName: string;
  args: any;
}

interface MockStreamOptions {
  includeUsage?: boolean;
  delay?: number;
  toolCalls?: MockToolCall[];
}

export function createMockTextStream(
  chunks: string[],
  options: MockStreamOptions = {}
): MockLanguageModelV2 {
  const { includeUsage = true, delay = 100, toolCalls = [] } = options;

  return new MockLanguageModelV2({
    doStream: async _options => {
      const streamChunks: any[] = [];

      // Add text chunks - AI SDK v5 format
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

      // Add tool calls if any - AI SDK v5 format
      toolCalls.forEach(({ toolCallId, toolName, args }) => {
        // Start tool call
        streamChunks.push({
          type: "tool-input-start",
          id: toolCallId,
          toolName,
        });

        // Tool call arguments delta
        streamChunks.push({
          type: "tool-input-args-delta",
          id: toolCallId,
          argsTextDelta: JSON.stringify(args),
        });
      });

      // Add finish event
      streamChunks.push({
        type: "finish",
        finishReason: "stop",
        usage: includeUsage
          ? {
              inputTokens: 100,
              outputTokens: 50,
              totalTokens: 150,
            }
          : undefined,
        warnings: [],
      });

      return {
        stream: simulateReadableStream({
          chunks: streamChunks,
          chunkDelayInMs: delay,
        }),
        warnings: [],
      };
    },
  });
}

export function createMockToolCallStream(
  toolName: string,
  args: any,
  resultText: string = "Tool executed successfully",
  delay: number = 100
): MockLanguageModelV2 {
  // For now, simplify to just return text mentioning the tool was called
  // This avoids the complexity of mocking the exact tool call format v5 expects
  return new MockLanguageModelV2({
    doGenerate: async _options => ({
      content: [
        {
          type: "text" as const,
          text: `[Simulated tool call: ${toolName}(${JSON.stringify(args)})] Result: ${resultText}`,
        }
      ],
      finishReason: "stop" as const,
      usage: {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      },
      warnings: [],
    }),
    doStream: async _options => {
      const streamChunks: any[] = [
        // Text response mentioning tool call
        {
          type: "text-delta",
          textDelta: `[Simulated tool call: ${toolName}(${JSON.stringify(args)})] Result: ${resultText}`,
        },
        // Finish event
        {
          type: "finish",
          finishReason: "stop",
          usage: {
            inputTokens: 100,
            outputTokens: 50,
            totalTokens: 150,
          },
          warnings: [],
        },
      ];

      return {
        stream: simulateReadableStream({
          chunks: streamChunks,
          chunkDelayInMs: delay,
        }),
        warnings: [],
      };
    },
  });
}

export function createMockErrorStream(error: Error): MockLanguageModelV2 {
  return new MockLanguageModelV2({
    doStream: async () => {
      throw error;
    },
  });
}

// Mock for generateObject (used in classification)
export function createMockObjectGeneration<T>(object: T): MockLanguageModelV2 {
  return new MockLanguageModelV2({
    doGenerate: async _options => ({
      finishReason: "stop",
      usage: {
        inputTokens: 50,
        outputTokens: 20,
        totalTokens: 70,
      },
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(object),
        },
      ],
      warnings: [],
    }),
  });
}

// Mock for simple text generation
export function createMockTextGeneration(text: string): MockLanguageModelV2 {
  return new MockLanguageModelV2({
    doGenerate: async _options => ({
      finishReason: "stop",
      usage: {
        inputTokens: 50,
        outputTokens: 20,
        totalTokens: 70,
      },
      content: [
        {
          type: "text" as const,
          text,
        },
      ],
      warnings: [],
    }),
  });
}

// Helper to create mock model registry
export function createMockModelRegistry(mockModel: MockLanguageModelV2) {
  return {
    languageModel: () => mockModel,
    textEmbeddingModel: () => null as any, // Type casting for test purposes
    imageModel: () => null as any, // Required by ProviderRegistryProvider
  };
}
