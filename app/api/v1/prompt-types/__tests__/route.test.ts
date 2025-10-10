/**
 * GET /api/v1/prompt-types 接口测试用例
 */

import { describe, it, expect } from "vitest";
import { GET } from "../route";

describe("GET /api/v1/prompt-types", () => {
  it("应该返回所有可用的 promptType", async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty("promptTypes");
    expect(Array.isArray(data.data.promptTypes)).toBe(true);
  });

  it("应该包含必需的 promptType 值", async () => {
    const response = await GET();
    const data = await response.json();

    const promptTypes = data.data.promptTypes;
    const ids = promptTypes.map((p: { id: string }) => p.id);

    expect(ids).toContain("bossZhipinSystemPrompt");
    expect(ids).toContain("bossZhipinLocalSystemPrompt");
    expect(ids).toContain("generalComputerSystemPrompt");
  });

  it("每个 promptType 应该有 id 和 description", async () => {
    const response = await GET();
    const data = await response.json();

    const promptTypes = data.data.promptTypes;

    promptTypes.forEach((type: unknown) => {
      expect(type).toHaveProperty("id");
      expect(type).toHaveProperty("description");
      expect(typeof (type as { id: string }).id).toBe("string");
      expect(typeof (type as { description: string }).description).toBe("string");
    });
  });

  it("应该返回正确数量的 promptType", async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.data.promptTypes).toHaveLength(3);
  });
});
