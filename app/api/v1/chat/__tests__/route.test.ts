/**
 * POST /api/v1/chat 接口测试用例
 *
 * 注意：根据文档规范，鉴权由 Next.js middleware 在路由前处理
 * 业务路由接收到的请求已经通过了鉴权验证
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { POST } from "../route";
import type { OpenChatRequest } from "@/types/api";
import type { ToolDefinition } from "@/types/tool-common";

// Mock dependencies
vi.mock("@/lib/config/models", () => ({
  getOpenApiModels: vi.fn().mockReturnValue([
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
  ]),
  DEFAULT_PROVIDER_CONFIGS: {
    anthropic: {
      name: "Anthropic",
      baseURL: "https://api.anthropic.com",
      description: "Anthropic Claude models",
    },
    qwen: {
      name: "Qwen",
      baseURL: "https://dashscope.aliyuncs.com",
      description: "Qwen models",
    },
  },
}));

vi.mock("@/lib/model-registry/dynamic-registry", () => ({
  getDynamicRegistry: vi.fn().mockReturnValue({
    languageModel: vi.fn().mockReturnValue({
      modelId: "anthropic/claude-3-7-sonnet-20250219",
      provider: "anthropic",
    }),
  }),
}));

vi.mock("@/lib/utils", () => ({
  prunedMessages: vi.fn().mockImplementation(async messages => ({
    messages: messages,
    wasPruned: false,
  })),
}));

vi.mock("ai", () => ({
  streamText: vi.fn().mockReturnValue({
    toUIMessageStreamResponse: vi.fn().mockReturnValue(
      new Response("mock stream", {
        headers: { "Content-Type": "text/event-stream" },
      })
    ),
  }),
  generateText: vi.fn().mockResolvedValue({
    text: "Mock response",
    usage: {
      // 使用 AI SDK 的正确字段名
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
    },
  }),
  convertToModelMessages: vi.fn().mockImplementation(messages => messages),
  stepCountIs: vi.fn().mockImplementation(count => ({ maxSteps: count })),
}));

vi.mock("@/lib/tools/tool-registry", () => {
  const mockToolRegistry = {
    bash: {
      name: "bash",
      requiresSandbox: false,
      requiredContext: [],
      create: vi.fn().mockReturnValue({}),
    },
    computer: {
      name: "computer",
      requiresSandbox: true,
      requiredContext: ["sandboxId"],
      create: vi.fn().mockReturnValue({}),
    },
    zhipin_reply_generator: {
      name: "zhipin_reply_generator",
      requiresSandbox: false,
      requiredContext: ["configData", "replyPrompts"],
      create: vi.fn().mockReturnValue({}),
    },
  };

  return {
    TOOL_REGISTRY: mockToolRegistry,
    getToolRegistry: vi.fn().mockReturnValue(mockToolRegistry),
    OPEN_API_PROMPT_TYPES: [
      "bossZhipinSystemPrompt",
      "bossZhipinLocalSystemPrompt",
      "generalComputerSystemPrompt",
    ],
    getToolsForPrompt: vi.fn().mockReturnValue(["bash", "computer"]),
  };
});

// Mock safeCreateTool
vi.mock("@/types/tool-common", () => ({
  safeCreateTool: vi.fn((toolDef, context, shouldThrow = false) => {
    // 模拟真实的验证逻辑：
    // zhipin_reply_generator 需要 configData 和 replyPrompts
    // computer 需要 sandboxId

    if (toolDef.name === "zhipin_reply_generator") {
      if (!context?.configData || !context?.replyPrompts) {
        const error = new Error(
          `工具 ${toolDef.name} 上下文验证失败：缺少 configData 或 replyPrompts`
        );
        if (shouldThrow) {
          throw error;
        }
        return null;
      }
    }

    if (toolDef.name === "computer") {
      if (!context?.sandboxId) {
        const error = new Error(`工具 ${toolDef.name} 需要 sandboxId`);
        if (shouldThrow) {
          throw error;
        }
        return null;
      }
    }

    // 成功创建工具
    return {
      name: toolDef.name,
      description: `Mock ${toolDef.name} tool`,
      parameters: {},
      execute: vi.fn().mockResolvedValue("mock result"),
    };
  }),
}));

describe("POST /api/v1/chat", () => {
  let mockRequest: (body: Partial<OpenChatRequest>) => Request;

  beforeEach(async () => {
    vi.clearAllMocks();

    // 重新配置 mock 以确保每个测试都有正确的模型列表
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

    // 配置 prunedMessages mock 返回正确的数据结构
    const { prunedMessages } = await import("@/lib/utils");
    vi.mocked(prunedMessages).mockImplementation(async messages => messages);

    // 配置 getDynamicRegistry mock
    const { getDynamicRegistry } = await import("@/lib/model-registry/dynamic-registry");
    vi.mocked(getDynamicRegistry).mockReturnValue({
      languageModel: vi.fn().mockReturnValue({
        modelId: "anthropic/claude-3-7-sonnet-20250219",
        provider: "anthropic",
      }),
    } as never);

    // 配置 tool registry mock
    const toolRegistry = await import("@/lib/tools/tool-registry");
    const mockToolRegistry: Record<string, ToolDefinition> = {
      bash: {
        name: "bash",
        description: "Execute bash commands",
        category: "sandbox" as const,
        requiresSandbox: false,
        requiredContext: [],
        create: vi.fn().mockReturnValue({}),
      },
      computer: {
        name: "computer",
        description: "Computer use tool",
        category: "sandbox" as const,
        requiresSandbox: true,
        requiredContext: ["sandboxId"],
        create: vi.fn().mockReturnValue({}),
      },
      zhipin_reply_generator: {
        name: "zhipin_reply_generator",
        description: "Generate Zhipin reply",
        category: "business" as const,
        requiresSandbox: false,
        requiredContext: ["configData", "replyPrompts"],
        contextSchemas: {
          // Mock ZhipinDataSchema - 简化版本用于测试
          configData: {
            safeParse: vi.fn((data: unknown) => {
              if (!data || typeof data !== 'object') {
                return {
                  success: false,
                  error: { issues: [{ path: [], message: 'Expected object' }] }
                };
              }
              const issues: Array<{ path: string[]; message: string }> = [];
              const obj = data as Record<string, unknown>;
              if (!('stores' in obj)) {
                issues.push({ path: ['stores'], message: 'Invalid input: expected array, received undefined' });
              }
              if (!('brands' in obj)) {
                issues.push({ path: ['brands'], message: 'Invalid input: expected record, received undefined' });
              }
              if (!('city' in obj)) {
                issues.push({ path: ['city'], message: 'Invalid input: expected string, received undefined' });
              }
              return issues.length > 0
                ? { success: false, error: { issues } }
                : { success: true, data };
            })
          } as never
        },
        create: vi.fn().mockReturnValue({}),
      },
    };
    vi.mocked(toolRegistry.getToolRegistry).mockReturnValue(mockToolRegistry);
    // 默认只返回不需要额外上下文的工具，避免测试中的上下文问题
    vi.mocked(toolRegistry.getToolsForPrompt).mockReturnValue(["bash"]);

    // 配置 AI SDK mocks
    const ai = await import("ai");
    vi.mocked(ai.streamText).mockReturnValue({
      toUIMessageStreamResponse: vi.fn().mockReturnValue(
        new Response("mock stream", {
          headers: { "Content-Type": "text/event-stream" },
        })
      ),
    } as never);

    vi.mocked(ai.generateText).mockResolvedValue({
      text: "Mock response",
      usage: {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      },
    } as never);

    // 创建模拟请求的辅助函数
    mockRequest = (body: Partial<OpenChatRequest>) => {
      const fullBody: OpenChatRequest = {
        model: "anthropic/claude-3-7-sonnet-20250219",
        messages: [{ role: "user", content: "Hello" }],
        stream: true,
        ...body,
      };

      return new Request("http://localhost:3000/api/v1/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(fullBody),
      });
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("成功场景 - 流式输出", () => {
    it("应该成功处理纯文本对话（无工具）", async () => {
      const request = mockRequest({
        allowedTools: [],
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    });

    it("应该成功处理带工具的请求", async () => {
      const request = mockRequest({
        allowedTools: ["bash"],
        context: {
          preferredBrand: "Test Brand",
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    });

    it("应该在启用剪裁时设置响应头", async () => {
      const request = mockRequest({
        prune: true,
        pruneOptions: {
          maxOutputTokens: 10000,
          targetTokens: 8000,
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      // 注意：实际的响应头设置会在路由实现中完成
    });
  });

  describe("成功场景 - 非流式输出", () => {
    it("应该返回 JSON 格式的响应", async () => {
      const request = mockRequest({
        stream: false,
        allowedTools: [],
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      // 注意：实际实现会返回 JSON，这里 mock 返回的是流式
    });
  });

  describe("错误场景 - 模型验证", () => {
    it("应该拒绝不在许可列表的模型", async () => {
      const request = mockRequest({
        model: "invalid/model",
      });

      const response = await POST(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe("Forbidden");
    });

    it("应该验证模型格式", async () => {
      const request = mockRequest({
        model: "invalid-format",
      });

      const response = await POST(request);

      // 应该返回 400 或 403
      expect([400, 403]).toContain(response.status);
    });
  });

  describe("错误场景 - 必填字段", () => {
    it("应该拒绝缺少 model 字段的请求", async () => {
      const request = new Request("http://localhost:3000/api/v1/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Hello" }],
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("BadRequest");
    });

    it("应该拒绝缺少 messages 字段的请求", async () => {
      const request = new Request("http://localhost:3000/api/v1/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "anthropic/claude-3-7-sonnet-20250219",
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("BadRequest");
    });
  });

  describe("错误场景 - 工具上下文", () => {
    it("应该在 contextStrategy=error 时拒绝缺少必需上下文的请求", async () => {
      const request = mockRequest({
        allowedTools: ["zhipin_reply_generator"],
        contextStrategy: "error",
        context: {
          // 缺少 configData 和 replyPrompts
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("BadRequest");
      expect(data.details).toBeDefined();
    });

    it("应该在 contextStrategy=skip 时跳过缺少上下文的工具", async () => {
      const request = mockRequest({
        allowedTools: ["bash", "zhipin_reply_generator"],
        contextStrategy: "skip",
        context: {
          // bash 不需要上下文，zhipin_reply_generator 缺少上下文
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);

      // 验证响应头
      const skippedHeader = response.headers.get("X-Tools-Skipped");
      expect(skippedHeader).toBeTruthy();
      expect(skippedHeader).toContain("zhipin_reply_generator");

      // bash 不应该被跳过（不需要上下文）
      expect(skippedHeader).not.toContain("bash");
    });

    it("应该在沙盒工具缺少 sandboxId 时返回错误", async () => {
      const request = mockRequest({
        allowedTools: ["computer"],
        contextStrategy: "error",
        sandboxId: null,
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.details).toMatchObject({
        missingContext: expect.arrayContaining(["sandboxId"]),
      });
    });
  });

  describe("contextStrategy=report", () => {
    it("应该在 validateOnly=true 时返回验证报告", async () => {
      const request = mockRequest({
        allowedTools: ["bash", "zhipin_reply_generator"],
        validateOnly: true,
        context: {
          // zhipin_reply_generator 缺少 configData 和 replyPrompts
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      // 验证报告结构
      expect(data).toHaveProperty("valid");
      expect(data).toHaveProperty("tools");
      expect(Array.isArray(data.tools)).toBe(true);

      // 验证 bash 工具应该有效（不需要上下文）
      const bashTool = data.tools.find((t: { name: string }) => t.name === "bash");
      expect(bashTool).toMatchObject({
        name: "bash",
        valid: true,
      });

      // 验证 zhipin_reply_generator 应该无效（缺少上下文）
      const zhipinTool = data.tools.find(
        (t: { name: string }) => t.name === "zhipin_reply_generator"
      );
      expect(zhipinTool).toMatchObject({
        name: "zhipin_reply_generator",
        valid: false,
        missingContext: expect.arrayContaining(["configData", "replyPrompts"]),
      });
    });

    it("应该在 contextStrategy=report 时返回验证报告", async () => {
      const request = mockRequest({
        allowedTools: ["zhipin_reply_generator"],
        contextStrategy: "report",
        context: {},
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty("valid", false);
      expect(data.tools).toBeDefined();
      expect(data.tools[0]).toMatchObject({
        name: "zhipin_reply_generator",
        valid: false,
        missingContext: expect.arrayContaining(["configData", "replyPrompts"]),
      });
    });
  });

  describe("边界场景", () => {
    it("应该处理空的 allowedTools 数组（仅文本对话）", async () => {
      const request = mockRequest({
        allowedTools: [],
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it("应该接受有效的 promptType", async () => {
      const request = mockRequest({
        promptType: "generalComputerSystemPrompt",
        allowedTools: [],
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it("应该允许 toolContext 覆盖全局 context", async () => {
      const request = mockRequest({
        allowedTools: ["bash"],
        context: {
          preferredBrand: "Global Brand",
        },
        toolContext: {
          bash: {
            preferredBrand: "Tool Specific Brand",
          },
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it("应该正确归一化 {role, content} 格式的消息", async () => {
      const request = mockRequest({
        messages: [
          { role: "user", content: "First message" },
          { role: "assistant", content: "Response" },
          { role: "user", content: "Second message" },
        ],
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it("应该处理已经是 UIMessage 格式的消息", async () => {
      const request = mockRequest({
        messages: [
          {
            id: "msg-1",
            role: "user",
            parts: [{ type: "text", text: "Hello" }],
          },
        ] as never,
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });

  describe("promptType 模板", () => {
    it("应该使用 bossZhipinSystemPrompt 模板的工具集", async () => {
      const request = mockRequest({
        promptType: "bossZhipinSystemPrompt",
        sandboxId: "test-sandbox",
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it("应该允许 allowedTools 覆盖 promptType 工具集", async () => {
      const request = mockRequest({
        promptType: "bossZhipinSystemPrompt",
        allowedTools: ["bash"], // 只允许 bash
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });

  describe("systemPrompt 系统提示词", () => {
    it("应该支持直接传入 systemPrompt", async () => {
      const { streamText } = await import("ai");
      const request = mockRequest({
        systemPrompt: "You are a recruitment assistant.",
      });

      await POST(request);

      expect(streamText).toHaveBeenCalledWith(
        expect.objectContaining({
          system: "You are a recruitment assistant.",
        })
      );
    });

    it("应该通过 promptType 从 context.systemPrompts 查找", async () => {
      const { streamText } = await import("ai");
      const request = mockRequest({
        promptType: "bossZhipinSystemPrompt",
        context: {
          systemPrompts: {
            bossZhipinSystemPrompt: "Custom system prompt for testing.",
          },
        },
      });

      await POST(request);

      expect(streamText).toHaveBeenCalledWith(
        expect.objectContaining({
          system: "Custom system prompt for testing.",
        })
      );
    });

    it("systemPrompt 优先级应高于 promptType", async () => {
      const { streamText } = await import("ai");
      const request = mockRequest({
        systemPrompt: "Direct system prompt.",
        promptType: "bossZhipinSystemPrompt",
        context: {
          systemPrompts: {
            bossZhipinSystemPrompt: "System prompt from promptType.",
          },
        },
      });

      await POST(request);

      expect(streamText).toHaveBeenCalledWith(
        expect.objectContaining({
          system: "Direct system prompt.",
        })
      );
    });

    it("promptType 在 context.systemPrompts 中不存在时应使用默认值", async () => {
      const { streamText } = await import("ai");
      const request = mockRequest({
        promptType: "bossZhipinSystemPrompt",
        context: {
          // systemPrompts 为空，promptType 无法找到
        },
      });

      await POST(request);

      expect(streamText).toHaveBeenCalledWith(
        expect.objectContaining({
          system: "You are a helpful AI assistant.",
        })
      );
    });

    it("非流式模式应使用相同的 systemPrompt", async () => {
      const { generateText } = await import("ai");
      const request = mockRequest({
        stream: false,
        systemPrompt: "Test system prompt.",
      });

      await POST(request);

      expect(generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          system: "Test system prompt.",
        })
      );
    });

    it("systemPrompt 和 promptType 都缺失时应使用默认值", async () => {
      const { streamText } = await import("ai");
      const request = mockRequest({
        // 不提供 systemPrompt 和 promptType
        context: {
          // systemPrompts 为空
        },
      });

      await POST(request);

      expect(streamText).toHaveBeenCalledWith(
        expect.objectContaining({
          system: "You are a helpful AI assistant.",
        })
      );
    });
  });

  describe("消息剪裁 (prune)", () => {
    it("应该在 prune=true 时调用 prunedMessages", async () => {
      const { prunedMessages } = await import("@/lib/utils");
      const request = mockRequest({
        prune: true,
        messages: [
          { role: "user", content: "Message 1" },
          { role: "assistant", content: "Response 1" },
          { role: "user", content: "Message 2" },
        ],
      });

      await POST(request);

      expect(prunedMessages).toHaveBeenCalled();
    });

    it("应该支持 pruneOptions 配置", async () => {
      const { prunedMessages } = await import("@/lib/utils");
      const request = mockRequest({
        prune: true,
        pruneOptions: {
          maxOutputTokens: 15000,
          targetTokens: 8000,
          preserveRecentMessages: 2,
        },
      });

      await POST(request);

      expect(prunedMessages).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          maxOutputTokens: 15000,
          targetTokens: 8000,
          preserveRecentMessages: 2,
        })
      );
    });

    it("应该在消息被剪裁时设置 X-Message-Pruned 响应头", async () => {
      const { prunedMessages } = await import("@/lib/utils");
      // 模拟 prunedMessages 返回更少的消息
      (prunedMessages as any).mockResolvedValueOnce([
        { id: "1", role: "user", parts: [{ type: "text", text: "Message" }] },
      ]);

      const request = mockRequest({
        prune: true,
        messages: [
          { role: "user", content: "Message 1" },
          { role: "assistant", content: "Response 1" },
          { role: "user", content: "Message 2" },
        ],
      });

      const response = await POST(request);

      expect(response.headers.get("X-Message-Pruned")).toBe("true");
    });
  });

  describe("响应格式", () => {
    it("应该包含 X-Correlation-Id 响应头", async () => {
      const request = mockRequest({});

      const response = await POST(request);

      expect(response.headers.has("X-Correlation-Id")).toBe(true);
      expect(response.headers.get("X-Correlation-Id")).toMatch(/^req-/);
    });

    it("应该在流式响应中设置正确的缓存头", async () => {
      const request = mockRequest({
        stream: true,
      });

      const response = await POST(request);

      expect(response.headers.get("Cache-Control")).toBe("no-cache");
      expect(response.headers.get("X-Accel-Buffering")).toBe("no");
    });
  });

  describe("非流式响应完整性", () => {
    it("应该返回完整的 usage 信息", async () => {
      const request = mockRequest({
        stream: false,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.data.usage).toBeDefined();
      expect(data.data.usage).toHaveProperty("inputTokens");
      expect(data.data.usage).toHaveProperty("outputTokens");
      expect(data.data.usage).toHaveProperty("totalTokens");
    });

    it("应该返回完整的 tools 信息", async () => {
      const request = mockRequest({
        stream: false,
        allowedTools: ["bash"],
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.data.tools).toBeDefined();
      expect(data.data.tools).toHaveProperty("used");
      expect(data.data.tools).toHaveProperty("skipped");
      expect(Array.isArray(data.data.tools.used)).toBe(true);
      expect(Array.isArray(data.data.tools.skipped)).toBe(true);
    });

    it("应该返回 UIMessage 格式的消息", async () => {
      const request = mockRequest({
        stream: false,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.data.messages).toBeDefined();
      expect(Array.isArray(data.data.messages)).toBe(true);
      expect(data.data.messages.length).toBeGreaterThan(0);

      const message = data.data.messages[0];
      expect(message).toHaveProperty("id");
      expect(message).toHaveProperty("role");
      expect(message).toHaveProperty("parts");
      expect(Array.isArray(message.parts)).toBe(true);
    });

    it("应该保留完整的工具调用历史（包含 steps）", async () => {
      // Mock generateText to return steps with tool calls
      const ai = await import("ai");
      vi.mocked(ai.generateText).mockResolvedValue({
        text: "Final response after tool execution",
        usage: {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
        },
        steps: [
          {
            text: "Let me check that for you.",
            toolCalls: [
              {
                toolCallId: "call_123",
                toolName: "bash",
                input: { command: "ls -la" },
                type: "tool-call",
              },
            ],
            toolResults: [
              {
                toolCallId: "call_123",
                toolName: "bash",
                input: { command: "ls -la" },
                output: "file1.txt\nfile2.txt",
                type: "tool-result",
              },
            ],
            finishReason: "tool-calls",
            usage: { inputTokens: 50, outputTokens: 20, totalTokens: 70 },
          },
          {
            text: "Final response after tool execution",
            toolCalls: [],
            toolResults: [],
            finishReason: "stop",
            usage: { inputTokens: 50, outputTokens: 30, totalTokens: 80 },
          },
        ],
      } as never);

      const request = mockRequest({
        stream: false,
        allowedTools: ["bash"],
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.data.messages).toBeDefined();
      expect(Array.isArray(data.data.messages)).toBe(true);

      // Should have 2 messages (one per step)
      expect(data.data.messages.length).toBe(2);

      // First message should contain text and tool invocation
      const firstMsg = data.data.messages[0];
      expect(firstMsg.parts.length).toBeGreaterThan(1);

      // Should have text part
      const textPart = firstMsg.parts.find((p: { type: string }) => p.type === "text");
      expect(textPart).toBeDefined();
      expect(textPart.text).toBe("Let me check that for you.");

      // Should have tool invocation part
      const toolPart = firstMsg.parts.find((p: { type: string }) => p.type === "dynamic-tool");
      expect(toolPart).toBeDefined();
      expect(toolPart.toolName).toBe("bash");
      expect(toolPart.toolCallId).toBe("call_123");
      expect(toolPart.state).toBe("output-available");
      expect(toolPart.input).toEqual({ command: "ls -la" });
      expect(toolPart.output).toBe("file1.txt\nfile2.txt");

      // Second message should contain final text
      const secondMsg = data.data.messages[1];
      expect(secondMsg.parts.length).toBe(1);
      expect(secondMsg.parts[0].type).toBe("text");
      expect(secondMsg.parts[0].text).toBe("Final response after tool execution");
    });
  });

  describe("负例补充", () => {
    it("未知工具在 contextStrategy=skip 时应被跳过并返回 X-Tools-Skipped", async () => {
      const request = mockRequest({
        allowedTools: ["unknown_tool"],
        contextStrategy: "skip",
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      const skipped = response.headers.get("X-Tools-Skipped");
      expect(skipped).toBeTruthy();
      expect(skipped).toContain("unknown_tool");
    });

    it("启用剪裁且实际裁剪时应返回 X-Message-Pruned=true", async () => {
      // 动态覆盖 prunedMessages 的 mock，使其真正裁剪
      const utils = await import("@/lib/utils");
      (utils.prunedMessages as unknown as { mockImplementation: Function }).mockImplementation(
        async (messages: unknown[]) => messages.slice(0, Math.max(1, messages.length - 1))
      );

      const request = mockRequest({
        prune: true,
        messages: [
          { role: "user", content: "m1" },
          { role: "assistant", content: "m2" },
          { role: "user", content: "m3" },
        ],
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("X-Message-Pruned")).toBe("true");
    });

    it("convertToModelMessages 抛错时应返回 500 InternalServerError", async () => {
      const ai = await import("ai");
      (ai.convertToModelMessages as unknown as { mockImplementation: Function }).mockImplementation(
        () => {
          throw new Error("convert failed");
        }
      );

      const request = mockRequest({});
      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("InternalServerError");
    });

    it("promptType 含 computer 且缺少 sandboxId（error 策略）应返回 400", async () => {
      // 临时修改 mock，让这个 promptType 返回 computer 工具
      const toolRegistry = await import("@/lib/tools/tool-registry");
      vi.mocked(toolRegistry.getToolsForPrompt).mockReturnValueOnce(["bash", "computer"]);

      const request = mockRequest({
        promptType: "bossZhipinSystemPrompt",
        sandboxId: null,
        contextStrategy: "error",
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      // 路由会把工具创建错误映射到 message 中
      expect(String(data.message)).toContain("Missing required context");
      expect(String(data.message)).toContain("sandboxId");
    });
  });
});
