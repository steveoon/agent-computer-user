/**
 * GET /api/v1/models 接口测试用例
 */

import { describe, it, expect } from "vitest";
import { GET } from "../route";

describe("GET /api/v1/models", () => {
  it("应该返回成功响应", async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toBeDefined();
  });

  it("应该返回模型列表", async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.data).toHaveProperty("models");
    expect(Array.isArray(data.data.models)).toBe(true);
  });

  it("每个模型应该有必需的字段", async () => {
    const response = await GET();
    const data = await response.json();

    const models = data.data.models;
    expect(models.length).toBeGreaterThan(0);

    models.forEach((model: unknown) => {
      expect(model).toHaveProperty("id");
      expect(model).toHaveProperty("name");
      expect(model).toHaveProperty("categories");

      const m = model as { id: string; name: string; categories: string[] };
      expect(typeof m.id).toBe("string");
      expect(typeof m.name).toBe("string");
      expect(Array.isArray(m.categories)).toBe(true);
    });
  });

  it("应该包含常见的模型", async () => {
    const response = await GET();
    const data = await response.json();

    const models = data.data.models;
    const modelIds = models.map((m: { id: string }) => m.id);

    // 至少应该包含一个 anthropic 模型
    expect(modelIds.some((id: string) => id.includes("anthropic"))).toBe(true);
  });

  it("模型 ID 应该符合 provider/model 格式", async () => {
    const response = await GET();
    const data = await response.json();

    const models = data.data.models;

    models.forEach((model: { id: string }) => {
      expect(model.id).toContain("/");
      const parts = model.id.split("/");
      expect(parts.length).toBeGreaterThanOrEqual(2);
    });
  });
});
