# 品牌别名匹配问题 - 解决方案

## 解决方案概述

采用**两阶段匹配策略** + **清理冲突别名**的方案。

## 方案实施

### 第一步: 清理 brandAliases 中的冲突项

**问题**: 以下品牌在 `ORGANIZATION_MAPPING` 中是独立品牌，不应作为别名：

- "大连肯德基" (ID: 1167)
- "天津肯德基" (ID: 1072)
- "北京肯德基" (ID: 1043)
- "成都肯德基" (ID: 1116)
- "深圳肯德基" (ID: 1142)
- "广州肯德基" (ID: 1149)
- "杭州肯德基" (ID: 1131)
- "上海必胜客" (ID: 850)
- "北京必胜客" (ID: 1045)
- "成都必胜客" (ID: 1107)
- "佛山必胜客" (ID: 1159)

**修改 `brandAliases`**:

```typescript
const brandAliases: Record<string, string[]> = {
  // 只保留真正的别名（非正式/不完整名称）
  肯德基: ["肯德基", "KFC", "kfc"],  // 移除所有区域肯德基
  必胜客: ["必胜客", "Pizza Hut", "PizzaHut"],  // 移除区域必胜客

  // 区域品牌不设置别名，保持独立
  大连肯德基: ["大连肯德基", "大连KFC"],  // 新增
  天津肯德基: ["天津肯德基", "天津KFC"],  // 新增
  // ... 其他区域品牌类似

  // 其他品牌的真别名
  成都你六姐: ["成都你六姐", "你六姐"],  // ✓ 正确
  奥乐齐: ["奥乐齐", "ALDI", "Aldi"],  // ✓ 正确
  海底捞: ["海底捞", "海捞"],  // ✓ 正确
  // ...
};
```

### 第二步: 修改 extractBrands() 逻辑

**实现两阶段匹配**:

```typescript
static extractBrands(text: string): string[] {
  const foundBrands = new Set<string>();

  // 第一阶段: 精确匹配（优先匹配 ORGANIZATION_MAPPING 中的品牌）
  const actualBrands = Object.values(ORGANIZATION_MAPPING);
  for (const brand of actualBrands) {
    if (text.includes(brand)) {
      foundBrands.add(brand);
    }
  }

  // 第二阶段: 如果没有精确匹配，尝试别名匹配
  if (foundBrands.size === 0) {
    for (const [brand, aliases] of Object.entries(BRAND_DICTIONARY)) {
      for (const alias of aliases) {
        // 跳过精确品牌名（已在第一阶段处理）
        if (actualBrands.includes(alias)) continue;

        if (text.includes(alias)) {
          foundBrands.add(brand);
          break;
        }
      }
    }
  }

  return Array.from(foundBrands);
}
```

### 第三步: 增强 buildBrandDictionary()

**自动构建区域品牌的别名**:

```typescript
function buildBrandDictionary() {
  const actualBrands = Object.values(ORGANIZATION_MAPPING);
  const dictionary: Record<string, string[]> = {};

  // 首先添加实际业务品牌（自动生成别名）
  actualBrands.forEach(brand => {
    // 基础别名就是自己
    dictionary[brand] = [brand];

    // 如果有定义的别名，添加（但不包括其他独立品牌）
    const predefinedAliases = brandAliases[brand] || [];
    predefinedAliases.forEach(alias => {
      // 只添加非独立品牌的别名
      if (!actualBrands.includes(alias) || alias === brand) {
        dictionary[brand].push(alias);
      }
    });

    // 去重
    dictionary[brand] = Array.from(new Set(dictionary[brand]));
  });

  // 添加其他常见品牌的别名（用于识别但不在业务范围内）
  Object.entries(brandAliases).forEach(([brand, aliases]) => {
    if (!dictionary[brand]) {
      dictionary[brand] = aliases;
    }
  });

  return dictionary;
}
```

## 测试场景

### 场景 1: 独立品牌精确匹配

```typescript
// 输入: "大连肯德基有岗位吗"
// 第一阶段: 精确匹配 → 找到 "大连肯德基"
// 返回: ["大连肯德基"] ✓

// 输入: "肯德基有岗位吗"
// 第一阶段: 精确匹配 → 找到 "肯德基"
// 返回: ["肯德基"] ✓
```

### 场景 2: 别名匹配

```typescript
// 输入: "KFC有岗位吗"
// 第一阶段: 精确匹配 → 未找到
// 第二阶段: 别名匹配 → "KFC" → "肯德基"
// 返回: ["肯德基"] ✓

// 输入: "你六姐有岗位吗"
// 第一阶段: 精确匹配 → 未找到
// 第二阶段: 别名匹配 → "你六姐" → "成都你六姐"
// 返回: ["成都你六姐"] ✓
```

### 场景 3: 避免错误映射

```typescript
// 输入: "大连KFC有岗位吗"
// 第一阶段: 精确匹配 → 未找到"大连KFC"(不在ORGANIZATION_MAPPING)
// 第二阶段: 别名匹配 → "大连KFC" → "大连肯德基"
// 返回: ["大连肯德基"] ✓

// 输入: "大连肯德基和肯德基有什么区别"
// 第一阶段: 精确匹配 → 找到 "大连肯德基" 和 "肯德基"
// 返回: ["大连肯德基", "肯德基"] ✓
```

## 优点

1. **精确优先**: 独立品牌始终被准确识别
2. **向后兼容**: 别名功能仍然工作（如 "你六姐" → "成都你六姐"）
3. **自动化**: 基于 ORGANIZATION_MAPPING 自动构建字典
4. **可扩展**: 新增品牌自动获得基础支持
5. **清晰语义**: 代码逻辑清晰表达了"精确优先"的意图

## 实施步骤

1. ✅ 分析问题根源
2. ⏳ 清理 brandAliases 中的冲突项
3. ⏳ 修改 extractBrands() 实现两阶段匹配
4. ⏳ 更新 buildBrandDictionary() 自动处理
5. ⏳ 添加测试用例覆盖所有场景
6. ⏳ 验证现有功能不受影响
