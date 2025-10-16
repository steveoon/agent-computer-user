/**
 * GET /api/v1/tools 接口测试用例
 */

import { describe, it, expect } from "vitest";
import { GET } from "../route";

describe("GET /api/v1/tools", () => {
  it("应该返回成功响应", async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toBeDefined();
  });

  it("应该返回工具列表", async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.data).toHaveProperty("tools");
    expect(Array.isArray(data.data.tools)).toBe(true);
  });

  it("每个工具应该有必需的字段", async () => {
    const response = await GET();
    const data = await response.json();

    const tools = data.data.tools;
    expect(tools.length).toBeGreaterThan(0);

    tools.forEach((tool: unknown) => {
      expect(tool).toHaveProperty("name");
      expect(tool).toHaveProperty("description");
      expect(tool).toHaveProperty("category");
      expect(tool).toHaveProperty("requiresSandbox");

      const t = tool as {
        name: string;
        description: string;
        category: string;
        requiresSandbox: boolean;
        requiredContext?: string[];
      };

      expect(typeof t.name).toBe("string");
      expect(typeof t.description).toBe("string");
      expect(typeof t.category).toBe("string");
      expect(typeof t.requiresSandbox).toBe("boolean");

      if (t.requiredContext) {
        expect(Array.isArray(t.requiredContext)).toBe(true);
      }
    });
  });

  it("应该包含常见的工具", async () => {
    const response = await GET();
    const data = await response.json();

    const tools = data.data.tools;
    const toolNames = tools.map((t: { name: string }) => t.name);

    // 应该包含一些基础工具
    expect(toolNames).toContain("bash");
  });

  it("requiresSandbox=true 的工具应该有 sandboxId 在 requiredContext 中", async () => {
    const response = await GET();
    const data = await response.json();

    const tools = data.data.tools;

    tools.forEach((tool: { name: string; requiresSandbox: boolean; requiredContext?: string[] }) => {
      if (tool.requiresSandbox) {
        expect(tool.requiredContext).toBeDefined();
        expect(tool.requiredContext).toContain("sandboxId");
      }
    });
  });

  it("应该提供有用的描述信息", async () => {
    const response = await GET();
    const data = await response.json();

    const tools = data.data.tools;

    tools.forEach((tool: { description: string }) => {
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.description.length).toBeLessThan(500); // 合理的长度
    });
  });
});
