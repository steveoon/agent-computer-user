import { describe, it, expect, beforeEach } from "vitest";
import { createToolsWithStrategy } from "@/lib/utils/open-chat-utils";
import type { ToolCreationContext } from "@/types/tool-common";
import type { ZhipinData } from "@/types/zhipin";
import type { ReplyPolicyConfig } from "@/types/config";
import { DEFAULT_REPLY_POLICY } from "@/types";
import { DEFAULT_MODEL_CONFIG } from "@/lib/config/models";

describe("zhipinReplyTool - 创建期 Schema 验证", () => {
  let baseContext: ToolCreationContext;
  let validConfigData: ZhipinData;
  let validReplyPrompts: ReplyPolicyConfig;

  beforeEach(() => {
    validReplyPrompts = DEFAULT_REPLY_POLICY;

    // 完整的 ZhipinData（新结构：{ meta, brands[] }）
    validConfigData = {
      meta: { defaultBrandId: "test_brand" },
      brands: [
        {
          id: "test_brand",
          name: "测试品牌",
          stores: [],
        },
      ],
    };

    baseContext = {
      sandboxId: null,
      preferredBrand: "测试品牌",
      modelConfig: DEFAULT_MODEL_CONFIG,
      replyPolicy: validReplyPrompts,
      configData: validConfigData,
    };
  });

  describe("contextStrategy = error", () => {
    it("缺少 brands 字段应抛出错误", () => {
      const incompleteConfigData = {
        meta: { defaultBrandId: "test_brand" },
        // 缺少 brands
      } as unknown as ZhipinData;

      expect(() => {
        createToolsWithStrategy(
          ["zhipin_reply_generator"],
          { ...baseContext, configData: incompleteConfigData },
          {},
          "error"
        );
      }).toThrow(/brands.*Required/);
    });

    it("缺少 meta 字段应抛出错误", () => {
      const incompleteConfigData = {
        brands: [],
        // 缺少 meta
      } as unknown as ZhipinData;

      expect(() => {
        createToolsWithStrategy(
          ["zhipin_reply_generator"],
          { ...baseContext, configData: incompleteConfigData },
          {},
          "error"
        );
      }).toThrow(/meta.*Required/);
    });

    it("brands 中缺少必需字段应抛出错误", () => {
      const incompleteConfigData: ZhipinData = {
        meta: {},
        brands: [
          {
            // 缺少 id, name, stores
          } as never,
        ],
      };

      expect(() => {
        createToolsWithStrategy(
          ["zhipin_reply_generator"],
          { ...baseContext, configData: incompleteConfigData },
          {},
          "error"
        );
      }).toThrow(/Invalid context data structure/i);
    });

    it("完整的 configData 应成功创建工具", () => {
      const result = createToolsWithStrategy(
        ["zhipin_reply_generator"],
        baseContext,
        {},
        "error"
      );

      expect(result.used).toContain("zhipin_reply_generator");
      expect(result.tools["zhipin_reply_generator"]).toBeDefined();
      expect(result.skipped).toHaveLength(0);
    });
  });

  describe("contextStrategy = skip", () => {
    it("缺少 brands 字段应跳过工具", () => {
      const incompleteConfigData = {
        meta: { defaultBrandId: "test_brand" },
        // 缺少 brands
      } as unknown as ZhipinData;

      const result = createToolsWithStrategy(
        ["zhipin_reply_generator"],
        { ...baseContext, configData: incompleteConfigData },
        {},
        "skip"
      );

      expect(result.used).not.toContain("zhipin_reply_generator");
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0].name).toBe("zhipin_reply_generator");
      expect(result.skipped[0].reason).toBe("Invalid context data structure");
      expect(result.skipped[0].structureErrors).toBeDefined();
      expect(result.skipped[0].structureErrors).toHaveLength(1);
      expect(result.skipped[0].structureErrors![0].field).toBe("configData");
    });

    it("缺少 meta 字段应跳过工具", () => {
      const incompleteConfigData = {
        brands: [],
        // 缺少 meta
      } as unknown as ZhipinData;

      const result = createToolsWithStrategy(
        ["zhipin_reply_generator"],
        { ...baseContext, configData: incompleteConfigData },
        {},
        "skip"
      );

      expect(result.used).not.toContain("zhipin_reply_generator");
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0].structureErrors).toBeDefined();
    });

    it("完整的 configData 应成功创建工具", () => {
      const result = createToolsWithStrategy(
        ["zhipin_reply_generator"],
        baseContext,
        {},
        "skip"
      );

      expect(result.used).toContain("zhipin_reply_generator");
      expect(result.tools["zhipin_reply_generator"]).toBeDefined();
      expect(result.skipped).toHaveLength(0);
    });
  });

  describe("contextStrategy = report", () => {
    it("缺少 brands 字段应记录到验证报告", () => {
      const incompleteConfigData = {
        meta: { defaultBrandId: "test_brand" },
        // 缺少 brands
      } as unknown as ZhipinData;

      const result = createToolsWithStrategy(
        ["zhipin_reply_generator"],
        { ...baseContext, configData: incompleteConfigData },
        {},
        "report"
      );

      expect(result.used).not.toContain("zhipin_reply_generator");
      expect(result.validationReport).toBeDefined();
      expect(result.validationReport?.valid).toBe(false);
      expect(result.validationReport?.tools).toHaveLength(1);
      expect(result.validationReport?.tools[0].valid).toBe(false);
      expect(result.validationReport?.tools[0].name).toBe("zhipin_reply_generator");
      expect(result.validationReport?.tools[0].structureErrors).toBeDefined();
      expect(result.validationReport?.tools[0].structureErrors).toHaveLength(1);
    });

    it("缺少 meta 字段应记录到验证报告", () => {
      const incompleteConfigData = {
        brands: [],
        // 缺少 meta
      } as unknown as ZhipinData;

      const result = createToolsWithStrategy(
        ["zhipin_reply_generator"],
        { ...baseContext, configData: incompleteConfigData },
        {},
        "report"
      );

      expect(result.validationReport).toBeDefined();
      expect(result.validationReport?.valid).toBe(false);
      expect(result.validationReport?.tools[0].structureErrors).toBeDefined();
    });

    it("完整的 configData 应报告验证通过并创建工具", () => {
      const result = createToolsWithStrategy(
        ["zhipin_reply_generator"],
        baseContext,
        {},
        "report"
      );

      // report 模式下，验证通过时会创建工具
      expect(result.used).toContain("zhipin_reply_generator");
      expect(result.tools["zhipin_reply_generator"]).toBeDefined();
      expect(result.validationReport).toBeDefined();
      expect(result.validationReport?.tools).toHaveLength(1);
      expect(result.validationReport?.tools[0].valid).toBe(true);
      expect(result.validationReport?.tools[0].name).toBe("zhipin_reply_generator");
    });
  });

  describe("缺失必需上下文", () => {
    it("contextStrategy=error: 缺少 configData 应抛出错误", () => {
      const contextWithoutConfigData = {
        ...baseContext,
        configData: undefined,
      };

      expect(() => {
        createToolsWithStrategy(
          ["zhipin_reply_generator"],
          contextWithoutConfigData,
          {},
          "error"
        );
      }).toThrow(/Missing required context.*configData/i);
    });

    it("contextStrategy=skip: 缺少 configData 应跳过工具", () => {
      const contextWithoutConfigData = {
        ...baseContext,
        configData: undefined,
      };

      const result = createToolsWithStrategy(
        ["zhipin_reply_generator"],
        contextWithoutConfigData,
        {},
        "skip"
      );

      expect(result.used).not.toContain("zhipin_reply_generator");
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0].missingContext).toContain("configData");
    });

    it("contextStrategy=report: 缺少 configData 应记录到报告", () => {
      const contextWithoutConfigData = {
        ...baseContext,
        configData: undefined,
      };

      const result = createToolsWithStrategy(
        ["zhipin_reply_generator"],
        contextWithoutConfigData,
        {},
        "report"
      );

      expect(result.validationReport).toBeDefined();
      expect(result.validationReport?.valid).toBe(false);
      expect(result.validationReport?.tools[0].missingContext).toContain("configData");
    });
  });

  describe("空数组的有效性", () => {
    it("configData.brands 为空数组应成功创建工具", () => {
      const configWithEmptyBrands: ZhipinData = {
        meta: {},
        brands: [], // 空数组是有效的
      };

      const result = createToolsWithStrategy(
        ["zhipin_reply_generator"],
        { ...baseContext, configData: configWithEmptyBrands },
        {},
        "error"
      );

      expect(result.used).toContain("zhipin_reply_generator");
      expect(result.tools["zhipin_reply_generator"]).toBeDefined();
    });
  });
});
