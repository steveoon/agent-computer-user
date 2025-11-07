/**
 * Smart Patterns 测试
 * 调试位置提取逻辑
 */

import { describe, it, expect } from "vitest";
import { SmartExtractor, LOCATION_DICTIONARY, BRAND_DICTIONARY } from "../memory/smart-patterns";
import { SHANGHAI_REGION_MAPPING } from "@/lib/constants/organization-mapping";

describe("SmartExtractor - 调试位置提取", () => {
  describe("LOCATION_DICTIONARY 构建验证", () => {
    it("应该包含浦东新区的完整名称和简称", () => {
      console.log("=== SHANGHAI_REGION_MAPPING 中的值 ===");
      const regions = Object.values(SHANGHAI_REGION_MAPPING);
      console.log(regions);

      console.log("\n=== LOCATION_DICTIONARY.districts ===");
      console.log(LOCATION_DICTIONARY.districts);

      // 验证浦东新区被正确处理
      expect(regions).toContain("浦东新区");
      expect(LOCATION_DICTIONARY.districts).toContain("浦东新区");
      expect(LOCATION_DICTIONARY.districts).toContain("浦东");
    });

    it("应该包含张江在areas中", () => {
      console.log("\n=== LOCATION_DICTIONARY.areas ===");
      console.log(LOCATION_DICTIONARY.areas);

      expect(LOCATION_DICTIONARY.areas).toContain("张江");
    });

    it("应该正确构建所有区的简称", () => {
      const regions = Object.values(SHANGHAI_REGION_MAPPING);
      console.log("\n=== 所有区域及其简称验证 ===");

      // 特殊处理的区域简称映射
      const specialShortNames: Record<string, string> = {
        浦东新区: "浦东", // 特殊：浦东新区简称为浦东
      };

      regions.forEach(region => {
        // 获取实际的简称
        let shortName: string | undefined;
        if (specialShortNames[region]) {
          shortName = specialShortNames[region];
        } else if (region.endsWith("区")) {
          shortName = region.slice(0, -1);
        }

        console.log(`${region} -> 应该包含: ${region}, ${shortName || "无简称"}`);

        expect(LOCATION_DICTIONARY.districts).toContain(region);
        if (shortName) {
          expect(LOCATION_DICTIONARY.districts).toContain(shortName);
        }
      });
    });
  });

  describe("SmartExtractor.extractLocations 调试", () => {
    it('应该从"我在浦东张江工作"中提取浦东和张江', () => {
      const text = "我在浦东张江工作";
      console.log("\n=== 调试位置提取 ===");
      console.log("输入文本:", text);
      console.log('text.includes("浦东"):', text.includes("浦东"));
      console.log('text.includes("张江"):', text.includes("张江"));

      // 逐步检查districts
      console.log("\n=== 检查districts中的匹配 ===");
      LOCATION_DICTIONARY.districts.forEach(district => {
        if (text.includes(district)) {
          console.log(`✓ 找到district: "${district}"`);
        }
      });

      // 逐步检查areas
      console.log("\n=== 检查areas中的匹配 ===");
      LOCATION_DICTIONARY.areas.forEach(area => {
        if (text.includes(area)) {
          console.log(`✓ 找到area: "${area}"`);
        }
      });

      const extracted = SmartExtractor.extractLocations(text);
      console.log("\n=== 最终提取结果 ===");
      console.log("提取到的位置:", extracted);

      // 验证预期结果
      expect(extracted).toContain("浦东");
      expect(extracted).toContain("张江");
      expect(extracted).toHaveLength(2);
    });

    it("应该测试其他位置提取场景", () => {
      const testCases = [
        { text: "我住在徐汇", expected: ["徐汇"] },
        { text: "在静安区工作", expected: ["静安区", "静安"] },
        { text: "陆家嘴金融中心", expected: ["陆家嘴"] },
        { text: "松江九亭地铁站", expected: ["松江", "九亭"] }, // 文本中只有"松江"，没有"松江区"
      ];

      testCases.forEach(({ text, expected }) => {
        console.log(`\n测试: "${text}"`);
        const extracted = SmartExtractor.extractLocations(text);
        console.log("提取结果:", extracted);
        console.log("期望包含:", expected);

        expected.forEach(location => {
          expect(extracted).toContain(location);
        });
      });
    });

    it("应该验证提取逻辑的每个步骤", () => {
      const text = "我在浦东张江工作";
      const foundLocations = new Set<string>();

      console.log("\n=== 逐步验证提取逻辑 ===");

      // 步骤1: 检查行政区
      console.log("步骤1: 检查行政区");
      for (const district of LOCATION_DICTIONARY.districts) {
        if (text.includes(district)) {
          console.log(`  匹配district: "${district}"`);
          foundLocations.add(district);
        }
      }

      // 步骤2: 检查商圈
      console.log("步骤2: 检查商圈");
      for (const area of LOCATION_DICTIONARY.areas) {
        if (text.includes(area)) {
          console.log(`  匹配area: "${area}"`);
          foundLocations.add(area);
        }
      }

      // 步骤3: 检查地铁站
      console.log("步骤3: 检查地铁站");
      for (const station of LOCATION_DICTIONARY.stations) {
        if (text.includes(station)) {
          console.log(`  匹配station: "${station}"`);
          foundLocations.add(station);
        }
      }

      const result = Array.from(foundLocations);
      console.log("手动逻辑结果:", result);

      const extractorResult = SmartExtractor.extractLocations(text);
      console.log("SmartExtractor结果:", extractorResult);

      // 两个结果应该一致
      expect(extractorResult.sort()).toEqual(result.sort());
    });
  });

  describe("品牌提取验证", () => {
    it("应该验证BRAND_DICTIONARY基于ORGANIZATION_MAPPING构建", () => {
      console.log("\n=== BRAND_DICTIONARY验证 ===");
      console.log("品牌字典:", Object.keys(BRAND_DICTIONARY));

      // 验证实际业务品牌都被包含
      const actualBrands = [
        "肯德基",
        "成都你六姐",
        "大米先生",
        "天津肯德基",
        "上海必胜客",
        "奥乐齐",
      ];

      actualBrands.forEach(brand => {
        expect(BRAND_DICTIONARY).toHaveProperty(brand);
        console.log(`✓ 包含品牌: ${brand}, 别名: ${BRAND_DICTIONARY[brand]}`);
      });
    });

    it("应该正确提取品牌", () => {
      const testCases = [
        { text: "肯德基有岗位吗", expected: ["肯德基"] },
        { text: "KFC怎么样", expected: ["肯德基"] },
        { text: "我想去麦当劳或星巴克", expected: ["麦当劳", "星巴克"] },
      ];

      testCases.forEach(({ text, expected }) => {
        console.log(`\n测试品牌提取: "${text}"`);
        const extracted = SmartExtractor.extractBrands(text);
        console.log("提取结果:", extracted);

        expected.forEach(brand => {
          expect(extracted).toContain(brand);
        });
      });
    });

    it("应该优先精确匹配区域品牌（避免子串误匹配）", () => {
      const testCases = [
        {
          text: "大连肯德基有岗位吗",
          expected: ["大连肯德基"],
          notExpected: ["肯德基"],
          reason: "应该匹配 '大连肯德基' 而不是 '肯德基'",
        },
        {
          text: "天津肯德基工资怎么样",
          expected: ["天津肯德基"],
          notExpected: ["肯德基"],
          reason: "应该匹配 '天津肯德基' 而不是 '肯德基'",
        },
        {
          text: "上海必胜客待遇如何",
          expected: ["上海必胜客"],
          notExpected: ["必胜客"],
          reason: "应该匹配 '上海必胜客' 而不是 '必胜客'",
        },
        {
          text: "肯德基有岗位吗",
          expected: ["肯德基"],
          notExpected: ["大连肯德基", "天津肯德基"],
          reason: "只提到 '肯德基' 时应该匹配基础品牌",
        },
      ];

      testCases.forEach(({ text, expected, notExpected, reason }) => {
        console.log(`\n测试: "${text}"`);
        console.log(`原因: ${reason}`);
        const extracted = SmartExtractor.extractBrands(text);
        console.log("提取结果:", extracted);

        // 验证应该包含的品牌
        expected.forEach(brand => {
          expect(extracted).toContain(brand);
        });

        // 验证不应该包含的品牌
        notExpected.forEach(brand => {
          expect(extracted).not.toContain(brand);
        });
      });
    });

    it("应该正确处理区域品牌的变体", () => {
      const testCases = [
        {
          text: "大连KFC有岗位吗",
          expected: ["大连肯德基"],
          notExpected: ["肯德基"],
          reason: "别名 '大连KFC' 应该映射到 '大连肯德基'",
        },
        {
          text: "大连kfc工资高吗",
          expected: ["大连肯德基"],
          notExpected: ["肯德基"],
          reason: "小写别名 '大连kfc' 也应该映射到 '大连肯德基'",
        },
        {
          text: "上海Pizza Hut怎么样",
          expected: ["上海必胜客"],
          notExpected: ["必胜客"],
          reason: "英文别名应该映射到中文品牌名",
        },
      ];

      testCases.forEach(({ text, expected, notExpected, reason }) => {
        console.log(`\n测试: "${text}"`);
        console.log(`原因: ${reason}`);
        const extracted = SmartExtractor.extractBrands(text);
        console.log("提取结果:", extracted);

        expected.forEach(brand => {
          expect(extracted).toContain(brand);
        });

        notExpected.forEach(brand => {
          expect(extracted).not.toContain(brand);
        });
      });
    });

    it("应该处理多个独立区域品牌同时提及的情况", () => {
      const testCases = [
        {
          text: "大连肯德基和天津肯德基有什么区别",
          expected: ["大连肯德基", "天津肯德基"],
          reason: "应该同时识别两个独立的区域品牌",
        },
        {
          text: "天津肯德基、北京肯德基哪个好",
          expected: ["天津肯德基", "北京肯德基"],
          reason: "应该识别所有提到的区域品牌",
        },
        {
          text: "上海必胜客和北京必胜客的待遇对比",
          expected: ["上海必胜客", "北京必胜客"],
          reason: "应该识别不同区域的同类品牌",
        },
      ];

      testCases.forEach(({ text, expected, reason }) => {
        console.log(`\n测试: "${text}"`);
        console.log(`原因: ${reason}`);
        const extracted = SmartExtractor.extractBrands(text);
        console.log("提取结果:", extracted);

        expected.forEach(brand => {
          expect(extracted).toContain(brand);
        });

        expect(extracted.length).toBe(expected.length);
      });
    });

    it("子串品牌匹配行为说明（设计权衡）", () => {
      // 注意：当文本包含 "大连肯德基" 时，由于 "肯德基" 是 "大连肯德基" 的子串，
      // 为了避免误匹配，系统会优先匹配更长的品牌名，并过滤掉子串品牌。
      // 这是一个设计权衡：优先保证常见场景的准确性。

      const testCases = [
        {
          text: "大连肯德基和肯德基有什么区别",
          expected: ["大连肯德基"],
          notExpected: ["肯德基"],
          reason: "只识别最长匹配，避免子串误匹配（权衡设计）",
        },
      ];

      testCases.forEach(({ text, expected, notExpected, reason }) => {
        console.log(`\n测试: "${text}"`);
        console.log(`原因: ${reason}`);
        const extracted = SmartExtractor.extractBrands(text);
        console.log("提取结果:", extracted);
        console.log("设计说明: 这是为了避免 '大连肯德基有岗位吗' 误匹配到 '肯德基'");

        expected.forEach(brand => {
          expect(extracted).toContain(brand);
        });

        notExpected.forEach(brand => {
          expect(extracted).not.toContain(brand);
        });
      });
    });

    it("应该正确处理真别名（不完整/非正式名称）", () => {
      const testCases = [
        {
          text: "你六姐有岗位吗",
          expected: ["成都你六姐"],
          reason: "不完整名称 '你六姐' 应该映射到完整名称 '成都你六姐'",
        },
        {
          text: "海捞待遇怎么样",
          expected: ["海底捞"],
          reason: "俗称 '海捞' 应该映射到 '海底捞'",
        },
        {
          text: "ALDI有什么岗位",
          expected: ["奥乐齐"],
          reason: "英文名 'ALDI' 应该映射到中文品牌名",
        },
      ];

      testCases.forEach(({ text, expected, reason }) => {
        console.log(`\n测试: "${text}"`);
        console.log(`原因: ${reason}`);
        const extracted = SmartExtractor.extractBrands(text);
        console.log("提取结果:", extracted);

        expected.forEach(brand => {
          expect(extracted).toContain(brand);
        });
      });
    });
  });
});
