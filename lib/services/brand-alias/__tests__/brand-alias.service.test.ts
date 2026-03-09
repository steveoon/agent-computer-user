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

  it("should build reverse alias map with normalized keys", () => {
    const { aliasMap } = _buildMapsFromApiData(sampleApiData, actualBrands);

    expect(aliasMap.get("kfc")).toBe("肯德基");
    expect(aliasMap.get("肯德基")).toBe("肯德基");
    expect(aliasMap.get("pizzahut")).toBe("必胜客");
    expect(aliasMap.get("大连kfc")).toBe("大连肯德基");
    expect(aliasMap.get("aldi")).toBe("奥乐齐");
  });

  it("should filter empty aliases from dictionary and alias map", () => {
    const dirtyApiData: DulidayBrandItem[] = [
      { id: 1, name: "肯德基", aliases: ["", "   ", "KFC"], projectIdList: [5] },
    ];
    const { dictionary, aliasMap } = _buildMapsFromApiData(dirtyApiData, new Set(["肯德基"]));

    expect(dictionary["肯德基"]).toEqual(["肯德基", "KFC"]);
    expect(aliasMap.has("")).toBe(false);
    expect(aliasMap.get("kfc")).toBe("肯德基");
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

describe("buildMapsFromApiData - 区域品牌别名继承", () => {
  // 模拟真实场景：API 只有"肯德基"，projectIdList 包含区域品牌的 orgId
  const apiData: DulidayBrandItem[] = [
    {
      id: 10005,
      name: "肯德基",
      aliases: ["KFC", "kfc", "K记", "肯记", "开封菜"],
      projectIdList: [5, 1142, 1167, 1072, 1149],
    },
    {
      id: 10006,
      name: "必胜客",
      aliases: ["Pizza Hut", "PizzaHut"],
      projectIdList: [6, 2001],
    },
  ];

  // DB 中的品牌映射：orgId → brandName
  const brandMapping: Record<string, string> = {
    "5": "肯德基",
    "1142": "深圳肯德基",
    "1167": "大连肯德基",
    "1072": "天津肯德基",
    "1149": "广州肯德基",
    "6": "必胜客",
    "2001": "上海必胜客",
  };

  const actualBrands = new Set(Object.values(brandMapping));

  it("should generate regional aliases from projectIdList + DB mapping", () => {
    const { aliasMap } = _buildMapsFromApiData(apiData, actualBrands, brandMapping);

    // 深圳肯德基 应有 "深圳kfc", "深圳k记" 等别名
    expect(aliasMap.get("深圳kfc")).toBe("深圳肯德基");
    expect(aliasMap.get("深圳k记")).toBe("深圳肯德基");
    expect(aliasMap.get("深圳肯记")).toBe("深圳肯德基");

    // 大连肯德基
    expect(aliasMap.get("大连kfc")).toBe("大连肯德基");

    // 天津肯德基
    expect(aliasMap.get("天津kfc")).toBe("天津肯德基");

    // 上海必胜客
    expect(aliasMap.get("上海pizzahut")).toBe("上海必胜客");
    expect(aliasMap.get("上海pizzahut")).toBe("上海必胜客");
  });

  it("should include regional brands in forward dictionary", () => {
    const { dictionary } = _buildMapsFromApiData(apiData, actualBrands, brandMapping);

    expect(dictionary["深圳肯德基"]).toContain("深圳肯德基");
    expect(dictionary["深圳肯德基"]).toContain("深圳KFC");
    expect(dictionary["深圳肯德基"]).toContain("深圳kfc");

    expect(dictionary["上海必胜客"]).toContain("上海必胜客");
    expect(dictionary["上海必胜客"]).toContain("上海Pizza Hut");
  });

  it("should still map base brand aliases correctly", () => {
    const { aliasMap } = _buildMapsFromApiData(apiData, actualBrands, brandMapping);

    // 基础品牌别名不受影响
    expect(aliasMap.get("kfc")).toBe("肯德基");
    expect(aliasMap.get("pizzahut")).toBe("必胜客");
  });

  it("should prefer regional brand over base brand for prefixed aliases", () => {
    const { aliasMap } = _buildMapsFromApiData(apiData, actualBrands, brandMapping);

    // "深圳kfc" 应该映射到 "深圳肯德基"（更长），而不是 "肯德基"
    expect(aliasMap.get("深圳kfc")).toBe("深圳肯德基");
    expect(aliasMap.get("深圳kfc")).not.toBe("肯德基");
  });

  it("should skip regional alias generation when local name does not contain parent name", () => {
    const mixedApiData: DulidayBrandItem[] = [
      {
        id: 10005,
        name: "肯德基",
        aliases: ["KFC"],
        projectIdList: [5, 999],
      },
    ];
    const mixedMapping: Record<string, string> = {
      "5": "肯德基",
      "999": "百胜餐饮", // 不包含 "肯德基"，不应生成区域别名
    };
    const brands = new Set(Object.values(mixedMapping));

    const { aliasMap, dictionary } = _buildMapsFromApiData(mixedApiData, brands, mixedMapping);

    // "百胜餐饮KFC" 不应存在
    expect(aliasMap.has("百胜餐饮kfc")).toBe(false);
    // "百胜餐饮" 应该只有自身别名（来自 DB 兜底逻辑）
    expect(dictionary["百胜餐饮"]).toEqual(["百胜餐饮"]);
  });

  it("should work without brandMapping (backward compatible)", () => {
    const { aliasMap } = _buildMapsFromApiData(apiData, actualBrands);

    // 无 brandMapping 时不生成区域别名，只有基础别名
    expect(aliasMap.get("kfc")).toBe("肯德基");
    expect(aliasMap.has("深圳kfc")).toBe(false);
  });
});
