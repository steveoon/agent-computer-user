# 品牌别名匹配问题分析

## 问题描述

当用户提到"大连肯德基"时,系统会错误地使用"肯德基"的岗位和话术数据，而不是"大连肯德基"的数据。

## 问题根源

### 1. 别名映射逻辑

**文件**: `lib/prompt-engineering/memory/smart-patterns.ts:200-213`

```typescript
static extractBrands(text: string): string[] {
  const foundBrands = new Set<string>();

  for (const [brand, aliases] of Object.entries(BRAND_DICTIONARY)) {
    for (const alias of aliases) {
      if (text.includes(alias)) {
        foundBrands.add(brand);  // ← 添加的是字典的 key
        break;
      }
    }
  }

  return Array.from(foundBrands);
}
```

### 2. 品牌别名配置

**文件**: `lib/prompt-engineering/memory/smart-patterns.ts:24-30`

```typescript
const brandAliases: Record<string, string[]> = {
  肯德基: ["肯德基", "KFC", "kfc", "天津肯德基", "大连肯德基"], // 问题所在
  // ...
};
```

### 3. 上下文提取逻辑

**文件**: `lib/prompt-engineering/core/reply-builder.ts:64`

```typescript
if (params.targetBrand && this.config.prioritizeBrandSpecific) {
  businessData = this.extractBrandSpecificData(params.contextInfo, params.targetBrand);
  // targetBrand = "肯德基" (来自别名映射)
  // 在 contextInfo 中搜索 "肯德基" 而不是 "大连肯德基"
}
```

## 问题场景

### 场景 1: 错误场景（当前问题）

**用户输入**: "大连肯德基有岗位吗"

**流程**:
1. `SmartExtractor.extractBrands()` 提取品牌
2. 匹配到别名 "大连肯德基" → 返回 `["肯德基"]`
3. `extractBrandSpecificData(contextInfo, "肯德基")`
4. 提取 "肯德基" 的岗位数据（错误！应该是"大连肯德基"）

### 场景 2: 正确场景（别名真正的目的）

**用户输入**: "你六姐有岗位吗"

**流程**:
1. `SmartExtractor.extractBrands()` 提取品牌
2. 匹配到别名 "你六姐" → 返回 `["成都你六姐"]`
3. `extractBrandSpecificData(contextInfo, "成都你六姐")`
4. 提取 "成都你六姐" 的岗位数据（正确！）

## 问题本质

- **设计初衷**: 别名是为了将**不完整或非正式的品牌名**映射到**标准品牌名**
  - 正确: "你六姐" → "成都你六姐"
  - 正确: "KFC" → "肯德基"

- **当前问题**: 将**独立品牌**错误地映射为**另一个品牌**
  - 错误: "大连肯德基" → "肯德基"（这两个是独立品牌，不应该映射）

## 数据结构对比

### ORGANIZATION_MAPPING (独立品牌)

```typescript
export const ORGANIZATION_MAPPING: Record<number, string> = {
  5: "肯德基",          // 组织 ID 5
  1167: "大连肯德基",   // 组织 ID 1167 (独立品牌)
  1043: "北京肯德基",   // 组织 ID 1043 (独立品牌)
  1116: "成都肯德基",   // 组织 ID 1116 (独立品牌)
  941: "成都你六姐",    // 组织 ID 941
  // ...
};
```

### BRAND_DICTIONARY (别名映射)

```typescript
const brandAliases: Record<string, string[]> = {
  肯德基: ["肯德基", "KFC", "kfc", "天津肯德基", "大连肯德基"],
  成都你六姐: ["成都你六姐", "你六姐"],
  // ...
};
```

**冲突**: `ORGANIZATION_MAPPING` 中的独立品牌被错误地作为 `BRAND_DICTIONARY` 的别名。

## 影响范围

1. **智能回复系统**: 使用错误品牌的话术模板
2. **岗位推荐**: 推荐错误品牌的岗位
3. **品牌数据**: 提取错误品牌的门店和配置
4. **用户体验**: 用户询问A品牌，系统回复B品牌的信息

## 解决方案思路

### 方案 1: 精确品牌优先（推荐）

在 `SmartExtractor.extractBrands()` 中，优先匹配 `ORGANIZATION_MAPPING` 中的精确品牌名。

### 方案 2: 分离别名类型

区分两种别名：
- **真别名**: 不完整/非正式名称 (如 "你六姐" → "成都你六姐")
- **区域品牌**: 独立的区域品牌 (如 "大连肯德基" 不应映射)

### 方案 3: 重构 BRAND_DICTIONARY

从 brandAliases 中移除所有 `ORGANIZATION_MAPPING` 中的独立品牌。

## 建议方案

**结合方案 1 和方案 3**:

1. 清理 `brandAliases`，移除独立品牌
2. 修改 `extractBrands()` 逻辑，优先精确匹配
3. 添加测试覆盖这些场景
