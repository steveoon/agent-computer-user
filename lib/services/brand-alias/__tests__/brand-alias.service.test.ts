import { describe, it, expect } from "vitest";
import { _buildMapsFromApiData } from "../brand-alias.service";
import type { DulidayBrandItem } from "../types";

describe("buildMapsFromApiData", () => {
  const sampleApiData: DulidayBrandItem[] = [
    { id: 1, name: "肯德基", aliases: ["KFC", "kfc", "肯记"], projectIdList: [5] },
    { id: 2, name: "必胜客", aliases: ["Pizza Hut", "PizzaHut"], projectIdList: [6] },
    { id: 3, name: "大连肯德基", aliases: ["大连KFC", "大连kfc"], projectIdList: [1167] },
    { id: 4, name: "奥乐齐", aliases: ["ALDI", "Aldi"], projectIdList: [100] },
  ];

  const actualBrands = new Set(["肯德基", "必胜客", "大连肯德基", "奥乐齐"]);

  it("should build forward dictionary with brand name included in aliases", () => {
    const { dictionary } = _buildMapsFromApiData(sampleApiData, actualBrands);

    expect(dictionary["肯德基"]).toContain("肯德基");
    expect(dictionary["肯德基"]).toContain("KFC");
    expect(dictionary["肯德基"]).toContain("kfc");
    expect(dictionary["必胜客"]).toContain("Pizza Hut");
  });

  it("should build reverse alias map (lowercase keys)", () => {
    const { aliasMap } = _buildMapsFromApiData(sampleApiData, actualBrands);

    expect(aliasMap.get("kfc")).toBe("肯德基");
    expect(aliasMap.get("肯德基")).toBe("肯德基");
    expect(aliasMap.get("pizza hut")).toBe("必胜客");
    expect(aliasMap.get("pizzahut")).toBe("必胜客");
    expect(aliasMap.get("大连kfc")).toBe("大连肯德基");
    expect(aliasMap.get("aldi")).toBe("奥乐齐");
  });

  it("should resolve alias conflicts by preferring longer brand name", () => {
    const conflictData: DulidayBrandItem[] = [
      { id: 1, name: "肯德基", aliases: ["鸡"], projectIdList: [5] },
      { id: 2, name: "大连肯德基", aliases: ["鸡"], projectIdList: [1167] },
    ];

    const { aliasMap } = _buildMapsFromApiData(conflictData, new Set(["肯德基", "大连肯德基"]));

    // "鸡" should map to the longer brand name
    expect(aliasMap.get("鸡")).toBe("大连肯德基");
  });

  it("should include DB brands not in API response", () => {
    const partialApiData: DulidayBrandItem[] = [
      { id: 1, name: "肯德基", aliases: ["KFC"], projectIdList: [5] },
    ];
    const brandsWithExtra = new Set(["肯德基", "海底捞"]);

    const { dictionary, aliasMap } = _buildMapsFromApiData(partialApiData, brandsWithExtra);

    expect(dictionary["海底捞"]).toEqual(["海底捞"]);
    expect(aliasMap.get("海底捞")).toBe("海底捞");
  });

  it("should sort business brands by name length descending", () => {
    const { sortedBrands } = _buildMapsFromApiData(sampleApiData, actualBrands);

    // "大连肯德基" (5) > "肯德基" (3) = "必胜客" (3) = "奥乐齐" (3)
    expect(sortedBrands[0]).toBe("大连肯德基");
  });

  it("should handle empty API data", () => {
    const { dictionary, aliasMap, sortedBrands } = _buildMapsFromApiData([], actualBrands);

    // All actual brands should be in dictionary with self-only aliases
    expect(Object.keys(dictionary)).toHaveLength(actualBrands.size);
    for (const brand of actualBrands) {
      expect(dictionary[brand]).toEqual([brand]);
    }
    expect(aliasMap.size).toBe(actualBrands.size);
    expect(sortedBrands).toHaveLength(actualBrands.size);
  });

  it("should handle empty actual brands", () => {
    const { dictionary, aliasMap } = _buildMapsFromApiData(sampleApiData, new Set());

    // API data should still be in dictionary
    expect(dictionary["肯德基"]).toContain("KFC");
    expect(aliasMap.get("kfc")).toBe("肯德基");
  });
});
