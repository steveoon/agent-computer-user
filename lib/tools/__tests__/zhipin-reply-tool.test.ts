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

    // 完整的 ZhipinData
    // 注意：templates 的类型是 Record<ReplyContext, string[]>，而不是 ReplyPolicyConfig
    validConfigData = {
      city: "上海",
      stores: [],
      brands: {
        测试品牌: {
          templates: {
            initial_inquiry: ["你好！我们正在招聘..."],
            location_inquiry: ["请问您在哪个区域？"],
            no_location_match: ["很抱歉，该区域暂无职位"],
            schedule_inquiry: ["工作时间为..."],
            interview_request: ["欢迎来面试！"],
            general_chat: ["有什么可以帮到您？"],
            salary_inquiry: ["薪资待遇为..."],
            age_concern: ["年龄要求..."],
            insurance_inquiry: ["我们提供五险一金"],
            followup_chat: ["请问还有其他问题吗？"],
            attendance_inquiry: ["出勤要求为..."],
            flexibility_inquiry: ["排班较为灵活"],
            attendance_policy_inquiry: ["考勤制度为..."],
            work_hours_inquiry: ["每周工作..."],
            availability_inquiry: ["目前有空缺..."],
            part_time_support: ["支持兼职"],
          },
          screening: {
            age: { min: 18, max: 50, preferred: [25, 30, 35] },
            blacklistKeywords: ["不合适"],
            preferredKeywords: ["有经验"],
          },
        },
      },
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
    it("缺少 stores 字段应抛出错误", () => {
      const incompleteConfigData = {
        city: "上海",
        brands: validConfigData.brands,
        // 缺少 stores
      } as unknown as ZhipinData;

      expect(() => {
        createToolsWithStrategy(
          ["zhipin_reply_generator"],
          { ...baseContext, configData: incompleteConfigData },
          {},
          "error"
        );
      }).toThrow(/stores.*Required/);
    });

    it("缺少 brands 字段应抛出错误", () => {
      const incompleteConfigData = {
        city: "上海",
        stores: [],
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

    it("缺少 city 字段应抛出错误", () => {
      const incompleteConfigData = {
        stores: [],
        brands: validConfigData.brands,
        // 缺少 city
      } as unknown as ZhipinData;

      expect(() => {
        createToolsWithStrategy(
          ["zhipin_reply_generator"],
          { ...baseContext, configData: incompleteConfigData },
          {},
          "error"
        );
      }).toThrow(/city.*Required/);
    });

    it("brands 中缺少 templates 字段应抛出错误", () => {
      const incompleteConfigData: ZhipinData = {
        city: "上海",
        stores: [],
        brands: {
          测试品牌: {
            // 缺少 templates
            screening: {
              age: { min: 18, max: 50, preferred: [25, 30, 35] },
              blacklistKeywords: ["不合适"],
              preferredKeywords: ["有经验"],
            },
          } as never,
        },
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
    it("缺少 stores 字段应跳过工具", () => {
      const incompleteConfigData = {
        city: "上海",
        brands: validConfigData.brands,
        // 缺少 stores
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

    it("缺少 brands 字段应跳过工具", () => {
      const incompleteConfigData = {
        city: "上海",
        stores: [],
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
    it("缺少 stores 字段应记录到验证报告", () => {
      const incompleteConfigData = {
        city: "上海",
        brands: validConfigData.brands,
        // 缺少 stores
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

    it("缺少 brands 字段应记录到验证报告", () => {
      const incompleteConfigData = {
        city: "上海",
        stores: [],
        // 缺少 brands
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
    it("configData.stores 为空数组应成功创建工具", () => {
      const configWithEmptyStores: ZhipinData = {
        ...validConfigData,
        stores: [], // 空数组是有效的
      };

      const result = createToolsWithStrategy(
        ["zhipin_reply_generator"],
        { ...baseContext, configData: configWithEmptyStores },
        {},
        "error"
      );

      expect(result.used).toContain("zhipin_reply_generator");
      expect(result.tools["zhipin_reply_generator"]).toBeDefined();
    });
  });
});
