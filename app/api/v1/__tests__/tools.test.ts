/**
 * /api/v1/tools 接口测试用例
 *
 * 注意：根据文档规范，鉴权由 Next.js middleware 在路由前处理
 * 业务路由接收到的请求已经通过了鉴权验证
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "../tools/route";
import type { APISuccessResponse } from "@/types/api";

// Mock 工具注册表
vi.mock("@/lib/tools/tool-registry", () => ({
  // 添加 OPEN_API_PROMPT_TYPES 常量
  OPEN_API_PROMPT_TYPES: [
    "bossZhipinSystemPrompt",
    "bossZhipinLocalSystemPrompt",
    "generalComputerSystemPrompt",
  ],
  getToolMetadataList: vi.fn().mockReturnValue([
    {
      name: "bash",
      requiresSandbox: false,
      requiredContext: [],
    },
    {
      name: "computer",
      requiresSandbox: true,
      requiredContext: ["sandboxId"],
    },
    {
      name: "zhipin_reply_generator",
      requiresSandbox: false,
      requiredContext: ["configData", "replyPrompts"],
    },
    {
      name: "duliday_job_list",
      requiresSandbox: false,
      requiredContext: ["dulidayToken"],
    },
  ]),
  getToolsForPrompt: vi.fn((promptType: string) => {
    // 模拟对外公开的 promptType 工具集
    const mapping: Record<string, string[]> = {
      bossZhipinSystemPrompt: [
        "bash",
        "computer",
        "zhipin_reply_generator",
        "duliday_job_list",
      ],
      bossZhipinLocalSystemPrompt: [
        "bash",
        "zhipin_reply_generator",
        "duliday_job_list",
      ],
      generalComputerSystemPrompt: ["bash", "computer"],
    };
    return mapping[promptType] || [];
  }),
}));

// 工具元数据类型
interface ToolMetadata {
  name: string;
  requiresSandbox: boolean;
  requiredContext: string[];
}

describe("GET /api/v1/tools", () => {
  // 创建一个模拟的 GET 函数包装器，因为实际的 GET 不接受参数
  const callGET = async () => {
    return await GET();
  };
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("成功场景", () => {
    it("应该返回对外开放的工具列表", async () => {
      // 注意：根据文档，请求到达这里时已经通过了 middleware 鉴权
      const response = await callGET();
      const data = await response.json() as APISuccessResponse<{ tools: ToolMetadata[] }>;

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data.tools)).toBe(true);

      // 验证返回的工具包含必要字段
      data.data.tools.forEach(tool => {
        expect(tool).toHaveProperty("name");
        expect(tool).toHaveProperty("requiresSandbox");
        expect(tool).toHaveProperty("requiredContext");
        expect(Array.isArray(tool.requiredContext)).toBe(true);
      });
    });

    it("应该正确处理空工具列表", async () => {
      const { getToolMetadataList } = await import("@/lib/tools/tool-registry");
      vi.mocked(getToolMetadataList).mockReturnValueOnce([]);

      const response = await callGET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        data: {
          tools: [],
        },
      });
    });

    it("应该只返回对外白名单中的工具", async () => {
      const { getToolMetadataList } = await import("@/lib/tools/tool-registry");

      // 模拟返回包含内部工具的完整列表
      vi.mocked(getToolMetadataList).mockReturnValueOnce([
        { name: "bash", description: "Execute bash commands", category: "automation", requiresSandbox: false, requiredContext: [] },
        { name: "computer", description: "Computer use tool", category: "automation", requiresSandbox: true, requiredContext: ["sandboxId"] },
        { name: "internal_debug_tool", description: "Internal debug tool", category: "debug", requiresSandbox: false, requiredContext: [] },
        { name: "zhipin_reply_generator", description: "Generate Zhipin reply", category: "business", requiresSandbox: false, requiredContext: ["configData", "replyPrompts"] },
      ]);

      const response = await callGET();
      const data = await response.json() as APISuccessResponse<{ tools: ToolMetadata[] }>;

      expect(response.status).toBe(200);

      // 验证内部工具被过滤
      const toolNames = data.data.tools.map(t => t.name);
      expect(toolNames).not.toContain("internal_debug_tool");

      // 验证白名单工具存在
      expect(toolNames).toContain("bash");
      expect(toolNames).toContain("computer");
      expect(toolNames).toContain("zhipin_reply_generator");
    });
  });

  // 注意：根据文档，鉴权由 middleware 处理，这里不需要测试鉴权场景
  // 如果请求能到达路由，说明已经通过了鉴权

  describe("错误处理", () => {
    it("应该处理内部服务器错误", async () => {
      const { getToolMetadataList } = await import("@/lib/tools/tool-registry");
      vi.mocked(getToolMetadataList).mockImplementationOnce(() => {
        throw new Error("Failed to load tool registry");
      });

      const response = await callGET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toMatchObject({
        error: "InternalServerError",
        message: expect.stringContaining("Failed to retrieve tool metadata"),
        statusCode: 500,
        correlationId: expect.stringMatching(/^req-/),
      });
    });

    it("应该处理未知错误", async () => {
      const { getToolMetadataList } = await import("@/lib/tools/tool-registry");
      vi.mocked(getToolMetadataList).mockImplementationOnce(() => {
        throw "Unexpected error type";
      });

      const response = await callGET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toHaveProperty("error", "InternalServerError");
      expect(data).toHaveProperty("statusCode", 500);
    });
  });

  describe("响应格式", () => {
    it("应该包含正确的响应头", async () => {
      const response = await callGET();

      expect(response.headers.get("Content-Type")).toBe("application/json");
      expect(response.headers.get("Cache-Control")).toBe("public, max-age=3600");
    });

    it("应该符合文档定义的响应格式", async () => {
      const response = await callGET();
      const data = await response.json();

      // 验证顶层结构
      expect(data).toHaveProperty("success", true);
      expect(data).toHaveProperty("data");
      expect(data.data).toHaveProperty("tools");
      expect(Array.isArray(data.data.tools)).toBe(true);

      // 验证每个工具的结构符合文档规范
      data.data.tools.forEach((tool: ToolMetadata) => {
        expect(typeof tool.name).toBe("string");
        expect(typeof tool.requiresSandbox).toBe("boolean");
        expect(Array.isArray(tool.requiredContext)).toBe(true);

        // requiredContext 数组中的每个元素应该是字符串
        tool.requiredContext.forEach(ctx => {
          expect(typeof ctx).toBe("string");
        });
      });
    });
  });
});