/**
 * GET /api/v1/config-schema 接口测试用例
 */

import { describe, it, expect } from "vitest";
import { GET } from "../route";

describe("GET /api/v1/config-schema", () => {
  it("应该返回成功响应", async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toBeDefined();
  });

  it("应该包含 context 字段说明", async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.data).toHaveProperty("context");
    const context = data.data.context;

    // 验证所有必需字段
    expect(context).toHaveProperty("preferredBrand");
    expect(context).toHaveProperty("brandPriorityStrategy");
    expect(context).toHaveProperty("modelConfig");
    expect(context).toHaveProperty("configData");
    expect(context).toHaveProperty("systemPrompts");
    expect(context).toHaveProperty("replyPolicy");
    expect(context).toHaveProperty("industryVoiceId");
    expect(context).toHaveProperty("dulidayToken");
    expect(context).toHaveProperty("defaultWechatId");
  });

  it("应该包含 sandboxId 字段说明", async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.data).toHaveProperty("sandboxId");
    expect(data.data.sandboxId).toHaveProperty("type");
    expect(data.data.sandboxId).toHaveProperty("required");
    expect(data.data.sandboxId).toHaveProperty("description");
  });

  it("应该包含 toolContext 字段说明", async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.data).toHaveProperty("toolContext");
    expect(data.data.toolContext).toHaveProperty("type");
    expect(data.data.toolContext).toHaveProperty("required");
    expect(data.data.toolContext).toHaveProperty("description");
  });

  it("每个 context 字段应该有完整的元数据", async () => {
    const response = await GET();
    const data = await response.json();

    const context = data.data.context;

    Object.keys(context).forEach(key => {
      const field = context[key];
      expect(field).toHaveProperty("type");
      expect(field).toHaveProperty("required");
      expect(field).toHaveProperty("description");
      expect(typeof field.type).toBe("string");
      expect(typeof field.description).toBe("string");
    });
  });

  it("preferredBrand 应该标记为非必需", async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.data.context.preferredBrand.required).toBe(false);
  });

  it("dulidayToken 应该标记为按工具需要", async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.data.context.dulidayToken.required).toBe("按工具需要");
  });

  it("sandboxId 应该标记为特定条件下必需", async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.data.sandboxId.required).toBe("当启用 requiresSandbox 工具时");
  });

  it("应该包含新增的 systemPrompts 字段", async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.data.context).toHaveProperty("systemPrompts");
    expect(data.data.context.systemPrompts.type).toBe("Record<string, string>");
    expect(data.data.context.systemPrompts.required).toBe(false);
  });

  it("不应该包含敏感信息", async () => {
    const response = await GET();
    const data = await response.json();

    // 确保响应中不包含实际的敏感值
    const responseText = JSON.stringify(data);
    expect(responseText).not.toContain("sk-");
    expect(responseText).not.toContain("token:");
    expect(responseText).not.toContain("password");
  });

  describe("字段一致性验证", () => {
    it("FIELD_DESCRIPTIONS 应包含 OpenChatRequestSchema.context 中的所有字段", async () => {
      const response = await GET();
      const data = await response.json();

      // 预期的字段列表（与 OpenChatRequestSchema.shape.context.shape 保持一致）
      const expectedFields = [
        "preferredBrand",
        "brandPriorityStrategy",
        "modelConfig",
        "configData",
        "systemPrompts",
        "replyPolicy",
        "industryVoiceId",
        "dulidayToken",
        "defaultWechatId",
      ];

      const descriptionFields = Object.keys(data.data.context);

      // 检查是否有遗漏的字段
      const missingFields = expectedFields.filter(field => !descriptionFields.includes(field));
      expect(missingFields).toEqual([]);
    });

    it("FIELD_DESCRIPTIONS 不应包含 Schema 中不存在的字段", async () => {
      const response = await GET();
      const data = await response.json();

      // 预期的字段列表（与 OpenChatRequestSchema.shape.context.shape 保持一致）
      const expectedFields = [
        "preferredBrand",
        "brandPriorityStrategy",
        "modelConfig",
        "configData",
        "systemPrompts",
        "replyPolicy",
        "industryVoiceId",
        "dulidayToken",
        "defaultWechatId",
      ];

      const descriptionFields = Object.keys(data.data.context);

      // 检查是否有多余的字段
      const extraFields = descriptionFields.filter(field => !expectedFields.includes(field));
      expect(extraFields).toEqual([]);
    });

    it("应该验证顶层字段也与 Schema 一致", async () => {
      const { OpenChatRequestSchema } = await import("@/types/api");
      const response = await GET();
      const data = await response.json();

      const schemaTopLevelFields = Object.keys(OpenChatRequestSchema.shape);
      const descriptionTopLevelFields = Object.keys(data.data);

      // 只验证我们在描述中包含的顶层字段
      const expectedTopLevelFields = ["context", "sandboxId", "toolContext"];

      expectedTopLevelFields.forEach(field => {
        expect(schemaTopLevelFields).toContain(field);
        expect(descriptionTopLevelFields).toContain(field);
      });
    });
  });
});
