import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod/v3";
import { NoObjectGeneratedError } from "ai";
import { safeGenerateObject } from "../structured-output";
import { createMockObjectGeneration } from "@/lib/__tests__/test-utils/ai-mocks";
import { ErrorCode } from "@/lib/errors";

// Mock generateText from ai
vi.mock("ai", async () => {
  const actual = await vi.importActual("ai");
  return {
    ...actual,
    generateText: vi.fn(),
  };
});

import { generateText } from "ai";

const mockedGenerateText = vi.mocked(generateText);

// 测试 Schema
const TestSchema = z.object({
  name: z.string(),
  age: z.number(),
});

type TestType = z.infer<typeof TestSchema>;

// 工具名称常量（与实现保持一致）
const SUBMIT_OBJECT_TOOL_NAME = "submit_structured_output";

// 创建成功的 tool call 响应
function createSuccessfulToolCallResponse<T>(data: T) {
  return {
    toolCalls: [
      {
        toolName: SUBMIT_OBJECT_TOOL_NAME,
        input: data,
      },
    ],
    usage: { promptTokens: 100, completionTokens: 50 },
    text: "",
  } as unknown as Awaited<ReturnType<typeof generateText>>;
}

// 创建模型未调用工具的响应
function createNoToolCallResponse(text: string = "") {
  return {
    toolCalls: [],
    usage: { promptTokens: 100, completionTokens: 50 },
    text,
  } as unknown as Awaited<ReturnType<typeof generateText>>;
}

// 创建 NoObjectGeneratedError 的辅助函数
function createNoObjectError(rawText: string, cause?: Error) {
  // 使用 as unknown as 来绕过复杂的类型要求
  return new NoObjectGeneratedError({
    message: "Failed to generate object",
    text: rawText,
    cause: cause ?? new SyntaxError("Unexpected token"),
    response: {
      id: "test-response-id",
      timestamp: new Date(),
      modelId: "test-model",
    },
    usage: {
      inputTokens: 100,
      inputTokenDetails: {
        noCacheTokens: undefined,
        cacheReadTokens: undefined,
        cacheWriteTokens: undefined,
      },
      outputTokens: 50,
      outputTokenDetails: {
        textTokens: undefined,
        reasoningTokens: undefined,
      },
      totalTokens: 150,
    },
    finishReason: { unified: "error" as const },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

describe("safeGenerateObject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("成功场景", () => {
    it("应该返回成功结果和正确的数据", async () => {
      const mockData: TestType = { name: "张三", age: 25 };
      const mockModel = createMockObjectGeneration(mockData);

      mockedGenerateText.mockResolvedValueOnce(createSuccessfulToolCallResponse(mockData));

      const result = await safeGenerateObject({
        model: mockModel,
        schema: TestSchema,
        schemaName: "TestSchema",
        prompt: "Generate a test user",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockData);
      }
    });

    it("应该正确传递 system 和 prompt 参数", async () => {
      const mockData: TestType = { name: "李四", age: 30 };
      const mockModel = createMockObjectGeneration(mockData);

      mockedGenerateText.mockResolvedValueOnce(createSuccessfulToolCallResponse(mockData));

      await safeGenerateObject({
        model: mockModel,
        schema: TestSchema,
        schemaName: "TestSchema",
        system: "You are a helpful assistant",
        prompt: "Generate a test user",
      });

      expect(mockedGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          system: "You are a helpful assistant",
          prompt: "Generate a test user",
          tools: expect.objectContaining({
            [SUBMIT_OBJECT_TOOL_NAME]: expect.anything(),
          }),
        })
      );
    });

    it("应该使用 tool-based pattern 调用 generateText", async () => {
      const mockData: TestType = { name: "王五", age: 35 };
      const mockModel = createMockObjectGeneration(mockData);

      mockedGenerateText.mockResolvedValueOnce(createSuccessfulToolCallResponse(mockData));

      await safeGenerateObject({
        model: mockModel,
        schema: TestSchema,
        schemaName: "TestSchema",
        prompt: "Generate a test user",
      });

      // 验证使用了 tools 和 stopWhen
      expect(mockedGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: expect.any(Object),
          stopWhen: expect.anything(),
        })
      );
    });
  });

  describe("模型未调用工具", () => {
    it("应该在模型未调用工具时返回失败结果", async () => {
      const mockModel = createMockObjectGeneration({ name: "test", age: 1 });

      mockedGenerateText.mockResolvedValueOnce(createNoToolCallResponse("I cannot help with that"));

      const result = await safeGenerateObject({
        model: mockModel,
        schema: TestSchema,
        schemaName: "TestSchema",
        prompt: "Generate a test user",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.LLM_RESPONSE_PARSE_ERROR);
      }
    });
  });

  describe("NoObjectGeneratedError 处理", () => {
    it("应该捕获 NoObjectGeneratedError 并返回失败结果", async () => {
      const mockModel = createMockObjectGeneration({ name: "test", age: 1 });
      const rawText = '```json\n{"name": "invalid"}\n```';

      mockedGenerateText.mockRejectedValueOnce(createNoObjectError(rawText));

      const result = await safeGenerateObject({
        model: mockModel,
        schema: TestSchema,
        schemaName: "TestSchema",
        prompt: "Generate a test user",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.rawText).toBe(rawText);
        expect(result.error.code).toBe(ErrorCode.LLM_RESPONSE_PARSE_ERROR);
      }
    });

    it("应该检测 markdown 格式并设置 isMarkdownFormat", async () => {
      const mockModel = createMockObjectGeneration({ name: "test", age: 1 });
      const markdownText = '```json\n{"name": "张三", "age": 25}\n```';

      mockedGenerateText.mockRejectedValueOnce(
        createNoObjectError(markdownText, new SyntaxError("Unexpected token `"))
      );

      const result = await safeGenerateObject({
        model: mockModel,
        schema: TestSchema,
        schemaName: "TestSchema",
        prompt: "Generate a test user",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.details).toBeDefined();
        const details = result.error.details as Record<string, unknown>;
        expect(details.isMarkdownFormat).toBe(true);
      }
    });
  });

  describe("onError 回调", () => {
    it("应该在错误发生时调用 onError 回调", async () => {
      const mockModel = createMockObjectGeneration({ name: "test", age: 1 });
      const onError = vi.fn();
      const rawText = "invalid json";

      mockedGenerateText.mockRejectedValueOnce(createNoObjectError(rawText));

      await safeGenerateObject({
        model: mockModel,
        schema: TestSchema,
        schemaName: "TestSchema",
        prompt: "Generate a test user",
        onError,
      });

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          code: ErrorCode.LLM_RESPONSE_PARSE_ERROR,
        }),
        rawText
      );
    });

    it("不应该在成功时调用 onError 回调", async () => {
      const mockData: TestType = { name: "王五", age: 35 };
      const mockModel = createMockObjectGeneration(mockData);
      const onError = vi.fn();

      mockedGenerateText.mockResolvedValueOnce(createSuccessfulToolCallResponse(mockData));

      await safeGenerateObject({
        model: mockModel,
        schema: TestSchema,
        schemaName: "TestSchema",
        prompt: "Generate a test user",
        onError,
      });

      expect(onError).not.toHaveBeenCalled();
    });
  });

  describe("schemaName 处理", () => {
    it("应该将 schemaName 添加到错误 details 中", async () => {
      const mockModel = createMockObjectGeneration({ name: "test", age: 1 });
      const schemaName = "MyCustomSchema";

      mockedGenerateText.mockRejectedValueOnce(createNoObjectError("invalid"));

      const result = await safeGenerateObject({
        model: mockModel,
        schema: TestSchema,
        schemaName,
        prompt: "Generate a test user",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const details = result.error.details as Record<string, unknown>;
        expect(details.schemaName).toBe(schemaName);
      }
    });
  });

  describe("通用错误处理", () => {
    it("应该正确处理非 NoObjectGeneratedError 错误", async () => {
      const mockModel = createMockObjectGeneration({ name: "test", age: 1 });
      const genericError = new Error("Network error");

      mockedGenerateText.mockRejectedValueOnce(genericError);

      const result = await safeGenerateObject({
        model: mockModel,
        schema: TestSchema,
        schemaName: "TestSchema",
        prompt: "Generate a test user",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.rawText).toBeUndefined();
        expect(result.error).toBeDefined();
      }
    });
  });
});
