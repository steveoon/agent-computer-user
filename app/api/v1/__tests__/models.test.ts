/**
 * /api/v1/models 接口测试用例
 *
 * 注意：根据文档规范，鉴权由 Next.js middleware 在路由前处理
 * 业务路由接收到的请求已经通过了鉴权验证
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "../models/route";
import type { APISuccessResponse } from "@/types/api";
import type { ModelsResponseBody, ModelInfo } from "@/types/api";

// Mock 模型配置
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
    {
      id: "openai/gpt-4o",
      name: "GPT-4o",
      categories: ["general"],
    },
    {
      id: "moonshotai/kimi-k2-0905-preview",
      name: "Kimi K2 0905 Preview",
      categories: ["chat", "general"],
    },
  ]),
}));

describe("GET /api/v1/models", () => {
  // 创建一个模拟的 GET 函数包装器，因为实际的 GET 不接受参数
  const callGET = async () => {
    return await GET();
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("成功场景", () => {
    it("应该返回对外开放的模型列表", async () => {
      // 注意：根据文档，请求到达这里时已经通过了 middleware 鉴权
      const response = await callGET();
      const data = await response.json() as APISuccessResponse<ModelsResponseBody>;

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data.models)).toBe(true);

      // 验证返回的模型包含必要字段
      data.data.models.forEach(model => {
        expect(model).toHaveProperty("id");
        expect(model).toHaveProperty("name");
        expect(model).toHaveProperty("categories");
        expect(Array.isArray(model.categories)).toBe(true);
      });
    });

    it("应该返回正确的模型数据", async () => {
      const response = await callGET();
      const data = await response.json() as APISuccessResponse<ModelsResponseBody>;

      expect(response.status).toBe(200);
      expect(data.data.models).toHaveLength(4);

      // 验证特定模型存在
      const modelIds = data.data.models.map(m => m.id);
      expect(modelIds).toContain("anthropic/claude-3-7-sonnet-20250219");
      expect(modelIds).toContain("qwen/qwen-max-latest");
      expect(modelIds).toContain("openai/gpt-4o");
      expect(modelIds).toContain("moonshotai/kimi-k2-0905-preview");
    });

    it("应该正确处理空模型列表", async () => {
      const { getOpenApiModels } = await import("@/lib/config/models");
      vi.mocked(getOpenApiModels).mockReturnValueOnce([]);

      const response = await callGET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        data: {
          models: [],
        },
      });
    });

    it("应该包含不同类别的模型", async () => {
      const response = await callGET();
      const data = await response.json() as APISuccessResponse<ModelsResponseBody>;

      expect(response.status).toBe(200);

      // 验证存在 chat 类别的模型
      const chatModels = data.data.models.filter(m => m.categories.includes("chat"));
      expect(chatModels.length).toBeGreaterThan(0);

      // 验证存在 general 类别的模型
      const generalModels = data.data.models.filter(m => m.categories.includes("general"));
      expect(generalModels.length).toBeGreaterThan(0);

      // 验证特定模型的类别
      const claudeModel = data.data.models.find(m => m.id === "anthropic/claude-3-7-sonnet-20250219");
      expect(claudeModel?.categories).toEqual(["chat", "general"]);

      const qwenModel = data.data.models.find(m => m.id === "qwen/qwen-max-latest");
      expect(qwenModel?.categories).toEqual(["general"]);
    });
  });

  describe("错误处理", () => {
    it("应该处理内部服务器错误", async () => {
      const { getOpenApiModels } = await import("@/lib/config/models");
      vi.mocked(getOpenApiModels).mockImplementationOnce(() => {
        throw new Error("Failed to load model configuration");
      });

      const response = await callGET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toMatchObject({
        error: "InternalServerError",
        message: expect.stringContaining("Failed to retrieve model list"),
        statusCode: 500,
        correlationId: expect.stringMatching(/^req-/),
      });
    });

    it("应该处理未知错误", async () => {
      const { getOpenApiModels } = await import("@/lib/config/models");
      vi.mocked(getOpenApiModels).mockImplementationOnce(() => {
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
      expect(data.data).toHaveProperty("models");
      expect(Array.isArray(data.data.models)).toBe(true);

      // 验证每个模型的结构符合文档规范
      data.data.models.forEach((model: ModelInfo) => {
        expect(typeof model.id).toBe("string");
        expect(typeof model.name).toBe("string");
        expect(Array.isArray(model.categories)).toBe(true);

        // categories 数组中的每个元素应该是字符串
        model.categories.forEach(category => {
          expect(typeof category).toBe("string");
          expect(["chat", "general"]).toContain(category); // 验证类别是已知的类型
        });

        // id 应该遵循 provider/model 格式
        expect(model.id).toMatch(/^[^/]+\/[^/]+/);
      });
    });

    it("应该符合 OpenAPI 规范定义的响应格式", async () => {
      const response = await callGET();
      const data = await response.json() as APISuccessResponse<ModelsResponseBody>;

      expect(response.status).toBe(200);

      // 验证响应结构符合规范示例
      expect(data).toMatchObject({
        success: true,
        data: {
          models: expect.arrayContaining([
            expect.objectContaining({
              id: expect.stringMatching(/^[^/]+\/[^/]+/),
              name: expect.any(String),
              categories: expect.arrayContaining([
                expect.stringMatching(/^(chat|general)$/),
              ]),
            }),
          ]),
        },
      });

      // 验证第一个模型的完整结构
      if (data.data.models.length > 0) {
        const firstModel = data.data.models[0];
        expect(firstModel).toEqual({
          id: expect.any(String),
          name: expect.any(String),
          categories: expect.any(Array),
        });
      }
    });
  });

  describe("业务逻辑验证", () => {
    it("模型ID应该唯一", async () => {
      const response = await callGET();
      const data = await response.json() as APISuccessResponse<ModelsResponseBody>;

      const modelIds = data.data.models.map(m => m.id);
      const uniqueIds = new Set(modelIds);

      expect(modelIds.length).toBe(uniqueIds.size);
    });

    it("模型名称应该非空", async () => {
      const response = await callGET();
      const data = await response.json() as APISuccessResponse<ModelsResponseBody>;

      data.data.models.forEach(model => {
        expect(model.name.trim()).not.toBe("");
        expect(model.name.length).toBeGreaterThan(0);
      });
    });

    it("每个模型应该至少有一个类别", async () => {
      const response = await callGET();
      const data = await response.json() as APISuccessResponse<ModelsResponseBody>;

      data.data.models.forEach(model => {
        expect(model.categories.length).toBeGreaterThan(0);
      });
    });

    it("应该包含来自不同提供商的模型", async () => {
      const response = await callGET();
      const data = await response.json() as APISuccessResponse<ModelsResponseBody>;

      const providers = new Set(data.data.models.map(m => m.id.split("/")[0]));

      // 验证至少有多个不同的提供商
      expect(providers.size).toBeGreaterThan(1);
      expect(providers).toContain("anthropic");
      expect(providers).toContain("qwen");
      expect(providers).toContain("openai");
      expect(providers).toContain("moonshotai");
    });
  });
});