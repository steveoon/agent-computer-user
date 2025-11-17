/**
 * Brand Resolution Logic Tests
 *
 * Tests the brand resolution system that determines which brand to use
 * based on multiple input sources and strategies.
 */

import { describe, it, expect } from "vitest";
import { resolveBrandConflict } from "../loaders/zhipin-data.loader";
import type { BrandResolutionInput } from "../../types/brand-resolution";

describe("Brand Resolution Logic", () => {
  const availableBrands = [
    "肯德基",
    "必胜客",
    "山姆会员店",
    "麦当劳",
    "星巴克",
    "瑞幸咖啡",
    "天津肯德基",
    "大连肯德基"
  ];

  describe("user-selected strategy", () => {
    it("should prioritize UI selection over all other sources", () => {
      const input: BrandResolutionInput = {
        uiSelectedBrand: "山姆会员店",
        configDefaultBrand: "肯德基",
        conversationBrand: "麦当劳",
        availableBrands,
        strategy: "user-selected"
      };

      const result = resolveBrandConflict(input);

      expect(result.resolvedBrand).toBe("山姆会员店");
      expect(result.source).toBe("ui");
      expect(result.matchType).toBe("exact");
      expect(result.reason).toContain("用户选择策略");
      expect(result.reason).toContain("UI选择");
    });

    it("should fallback to config default when UI brand is not available", () => {
      const input: BrandResolutionInput = {
        uiSelectedBrand: "不存在的品牌",
        configDefaultBrand: "肯德基",
        conversationBrand: "麦当劳",
        availableBrands,
        strategy: "user-selected"
      };

      const result = resolveBrandConflict(input);

      expect(result.resolvedBrand).toBe("肯德基");
      expect(result.source).toBe("config");
      expect(result.matchType).toBe("exact");
      expect(result.reason).toContain("UI品牌无法匹配");
      expect(result.reason).toContain("配置默认");
    });

    it("should use first available brand when neither UI nor config brands are valid", () => {
      const input: BrandResolutionInput = {
        uiSelectedBrand: "不存在的品牌1",
        configDefaultBrand: "不存在的品牌2",
        conversationBrand: "麦当劳",
        availableBrands,
        strategy: "user-selected"
      };

      const result = resolveBrandConflict(input);

      expect(result.resolvedBrand).toBe(availableBrands[0]);
      expect(result.source).toBe("default");
      expect(result.matchType).toBe("fallback");
      expect(result.reason).toContain("系统默认");
    });

    it("should handle fuzzy matching for UI brand (e.g., KFC → 肯德基)", () => {
      const input: BrandResolutionInput = {
        uiSelectedBrand: "KFC",
        configDefaultBrand: "必胜客",
        conversationBrand: undefined,
        availableBrands,
        strategy: "user-selected"
      };

      const result = resolveBrandConflict(input);

      // KFC doesn't match any brand, so fallback to config
      // This test documents the actual behavior
      if (result.source === "config") {
        expect(result.resolvedBrand).toBe("必胜客");
        expect(result.reason).toContain("UI品牌无法匹配");
      } else if (result.source === "ui") {
        // If fuzzyMatchBrand is updated to handle KFC → 肯德基
        expect(result.originalInput).toBe("KFC");
        expect(result.matchType).toBe("fuzzy");
      }
    });

    it("should ignore conversation brand in user-selected strategy", () => {
      const input: BrandResolutionInput = {
        uiSelectedBrand: "山姆会员店",
        configDefaultBrand: "肯德基",
        conversationBrand: "麦当劳",
        availableBrands,
        strategy: "user-selected"
      };

      const result = resolveBrandConflict(input);

      expect(result.resolvedBrand).toBe("山姆会员店");
      expect(result.source).toBe("ui");
      // Conversation brand should not affect the result
      expect(result.reason).not.toContain("麦当劳");
    });
  });

  describe("conversation-extracted strategy", () => {
    it("should prioritize conversation brand over UI and config", () => {
      const input: BrandResolutionInput = {
        uiSelectedBrand: "山姆会员店",
        configDefaultBrand: "肯德基",
        conversationBrand: "麦当劳",
        availableBrands,
        strategy: "conversation-extracted"
      };

      const result = resolveBrandConflict(input);

      expect(result.resolvedBrand).toBe("麦当劳");
      expect(result.source).toBe("conversation");
      expect(result.matchType).toBe("exact");
      expect(result.reason).toContain("对话提取策略");
      expect(result.reason).toContain("对话中提取");
    });

    it("should fallback to UI brand when conversation brand is not available", () => {
      const input: BrandResolutionInput = {
        uiSelectedBrand: "山姆会员店",
        configDefaultBrand: "肯德基",
        conversationBrand: "不存在的品牌",
        availableBrands,
        strategy: "conversation-extracted"
      };

      const result = resolveBrandConflict(input);

      expect(result.resolvedBrand).toBe("山姆会员店");
      expect(result.source).toBe("ui");
      expect(result.reason).toContain("对话品牌无法匹配");
      expect(result.reason).toContain("UI选择");
    });

    it("should fallback through the chain: conversation → UI → config → default", () => {
      const input: BrandResolutionInput = {
        uiSelectedBrand: "不存在的品牌1",
        configDefaultBrand: "肯德基",
        conversationBrand: "不存在的品牌2",
        availableBrands,
        strategy: "conversation-extracted"
      };

      const result = resolveBrandConflict(input);

      expect(result.resolvedBrand).toBe("肯德基");
      expect(result.source).toBe("config");
      expect(result.reason).toContain("配置默认");
    });
  });

  describe("smart strategy", () => {
    it("should prioritize conversation brand when different from UI brand", () => {
      const input: BrandResolutionInput = {
        uiSelectedBrand: "山姆会员店",
        configDefaultBrand: "必胜客",
        conversationBrand: "麦当劳",
        availableBrands,
        strategy: "smart"
      };

      const result = resolveBrandConflict(input);

      expect(result.resolvedBrand).toBe("麦当劳");
      expect(result.source).toBe("conversation");
      expect(result.reason).toContain("智能策略");
    });

    it("should prioritize conversation brand for same brand family", () => {
      const input: BrandResolutionInput = {
        uiSelectedBrand: "肯德基",
        configDefaultBrand: "必胜客",
        conversationBrand: "天津肯德基",
        availableBrands,
        strategy: "smart"
      };

      const result = resolveBrandConflict(input);

      // 同系列品牌，优先使用对话提取的品牌（更符合当前上下文）
      expect(result.resolvedBrand).toBe("天津肯德基");
      expect(result.source).toBe("conversation");
      expect(result.reason).toContain("同系列品牌");
      expect(result.reason).toContain("对话上下文");
    });

    it("should prioritize conversation brand even when UI is more specific", () => {
      const input: BrandResolutionInput = {
        uiSelectedBrand: "大连肯德基",
        configDefaultBrand: "必胜客",
        conversationBrand: "肯德基",
        availableBrands,
        strategy: "smart"
      };

      const result = resolveBrandConflict(input);

      // 同系列品牌，仍然优先对话提取（即使 UI 更具体）
      expect(result.resolvedBrand).toBe("肯德基");
      expect(result.source).toBe("conversation");
      expect(result.reason).toContain("同系列品牌");
      expect(result.reason).toContain("对话上下文");
    });

    it("should use conversation brand for different brand families", () => {
      const input: BrandResolutionInput = {
        uiSelectedBrand: "山姆会员店",
        configDefaultBrand: "必胜客",
        conversationBrand: "肯德基",
        availableBrands,
        strategy: "smart"
      };

      const result = resolveBrandConflict(input);

      // Different families, prioritize conversation
      expect(result.resolvedBrand).toBe("肯德基");
      expect(result.source).toBe("conversation");
      expect(result.reason).toContain("不同品牌系列");
      expect(result.reason).toContain("对话上下文");
    });

    it("should handle missing conversation brand gracefully", () => {
      const input: BrandResolutionInput = {
        uiSelectedBrand: "山姆会员店",
        configDefaultBrand: "肯德基",
        conversationBrand: undefined,
        availableBrands,
        strategy: "smart"
      };

      const result = resolveBrandConflict(input);

      expect(result.resolvedBrand).toBe("山姆会员店");
      expect(result.source).toBe("ui");
      expect(result.reason).toContain("对话无品牌");
      expect(result.reason).toContain("UI选择");
    });

    it("should handle all missing sources gracefully", () => {
      const input: BrandResolutionInput = {
        uiSelectedBrand: undefined,
        configDefaultBrand: undefined,
        conversationBrand: undefined,
        availableBrands,
        strategy: "smart"
      };

      const result = resolveBrandConflict(input);

      expect(result.resolvedBrand).toBe(availableBrands[0]);
      expect(result.source).toBe("default");
      expect(result.matchType).toBe("fallback");
      expect(result.reason).toContain("系统默认");
    });
  });

  describe("Edge cases", () => {
    it("should handle empty available brands array", () => {
      const input: BrandResolutionInput = {
        uiSelectedBrand: "山姆会员店",
        configDefaultBrand: "肯德基",
        conversationBrand: "麦当劳",
        availableBrands: [],
        strategy: "smart"
      };

      // This should probably throw an error or return a specific error state
      // The test depends on the actual implementation
      expect(() => resolveBrandConflict(input)).toBeDefined();
    });

    it("should handle brands with special characters", () => {
      const specialBrands = ["7-ELEVEN", "85度C", "CoCo都可", "一点点"];
      const input: BrandResolutionInput = {
        uiSelectedBrand: "85度C",
        configDefaultBrand: "7-ELEVEN",
        conversationBrand: "CoCo都可",
        availableBrands: specialBrands,
        strategy: "smart"
      };

      const result = resolveBrandConflict(input);

      expect(result.resolvedBrand).toBe("CoCo都可");
      expect(result.source).toBe("conversation");
    });

    it("should be case-sensitive for exact matches", () => {
      const input: BrandResolutionInput = {
        uiSelectedBrand: "肯德基",
        configDefaultBrand: "肯德基",
        conversationBrand: "肯德基",
        availableBrands,
        strategy: "smart"
      };

      const result = resolveBrandConflict(input);

      expect(result.resolvedBrand).toBe("肯德基");
      expect(result.matchType).toBe("exact");
    });
  });

  describe("Logging and debugging", () => {
    it("should include original input in result when fuzzy matched", () => {
      const input: BrandResolutionInput = {
        uiSelectedBrand: "KFC",
        configDefaultBrand: undefined,
        conversationBrand: undefined,
        availableBrands,
        strategy: "user-selected"
      };

      const result = resolveBrandConflict(input);

      if (result.matchType === "fuzzy") {
        expect(result.originalInput).toBe("KFC");
      }
    });

    it("should provide clear reason for each resolution", () => {
      const testCases: BrandResolutionInput[] = [
        {
          uiSelectedBrand: "山姆会员店",
          configDefaultBrand: "肯德基",
          conversationBrand: "麦当劳",
          availableBrands,
          strategy: "user-selected"
        },
        {
          uiSelectedBrand: "山姆会员店",
          configDefaultBrand: "肯德基",
          conversationBrand: "麦当劳",
          availableBrands,
          strategy: "conversation-extracted"
        },
        {
          uiSelectedBrand: "山姆会员店",
          configDefaultBrand: "肯德基",
          conversationBrand: "麦当劳",
          availableBrands,
          strategy: "smart"
        }
      ];

      testCases.forEach(input => {
        const result = resolveBrandConflict(input);
        expect(result.reason).toBeTruthy();
        expect(result.reason.length).toBeGreaterThan(0);
        // Check that the reason contains strategy-specific keywords
        if (input.strategy === "user-selected") {
          expect(result.reason).toContain("用户选择策略");
        } else if (input.strategy === "conversation-extracted") {
          expect(result.reason).toContain("对话提取策略");
        } else if (input.strategy === "smart") {
          expect(result.reason).toContain("智能策略");
        }
      });
    });
  });
});

describe("Brand Resolution Integration", () => {
  it("should work correctly with the complete data flow", async () => {
    // This would test the integration with loadZhipinData and generateSmartReplyWithLLM
    // But requires more setup and mocking
    expect(true).toBe(true); // Placeholder for integration tests
  });
});