# 🏪 品牌偏好持久化功能

## 概述

本项目集成了 `localforage` 来实现品牌选择的持久化存储，用户的品牌偏好会自动保存到浏览器本地存储中，并在下次访问时自动恢复。

## 🚀 核心功能

### ✅ 自动保存品牌选择

- 用户切换品牌时，选择会立即保存到本地存储
- 支持跨浏览器会话的数据持久化
- 使用 IndexedDB/WebSQL/localStorage 作为存储后端（localforage 自动选择最佳方案）

### ✅ 智能品牌恢复

- 页面加载时自动读取保存的品牌偏好
- 验证品牌有效性（防止数据不一致）
- 优雅降级到默认品牌（如果保存的品牌不再可用）

### ✅ 历史记录追踪

- 记录最近使用的品牌历史（最多 10 条）
- 品牌选择器可选择显示历史记录
- 历史记录去重和排序

### ✅ 完整的管理接口

- 查看当前存储状态和统计信息
- 一键清除所有偏好数据
- 开发友好的调试工具

## 📁 文件结构

```
lib/
├── utils/
│   └── brand-storage.ts          # 品牌存储工具模块
├── contexts/
│   └── brand-context.tsx         # 品牌上下文（集成持久化）
components/
└── brand-selector.tsx            # 品牌选择器（支持历史记录）
```

## 🔧 API 接口

### Brand Storage Utils (`lib/utils/brand-storage.ts`)

```typescript
// 💾 保存品牌偏好
await saveBrandPreference(brandName);

// 📖 读取品牌偏好
const savedBrand = await loadBrandPreference();

// 📊 获取历史记录
const history = await getBrandHistory();

// 📈 获取统计信息
const stats = await getBrandStats();

// 🗑️ 清除所有数据
await clearBrandPreferences();
```

### Brand Context (`lib/contexts/brand-context.tsx`)

```typescript
const { currentBrand, setCurrentBrand, availableBrands, isLoaded } = useBrand();

// isLoaded: 标识是否已从本地存储加载完成
// setCurrentBrand: 自动保存到本地存储
```

### Brand Selector (`components/brand-selector.tsx`)

```typescript
// 基础使用
<BrandSelector />

// 启用历史记录显示
<BrandSelector showHistory={true} />
```

## 🎯 在测试页面中的集成

测试页面 (`app/test-llm-reply/page.tsx`) 展示了完整的功能：

1. **品牌选择器**：显示历史记录和持久化状态指示器
2. **统计信息**：实时查看当前品牌和历史记录数量
3. **清除功能**：开发时重置偏好设置
4. **自动恢复**：刷新页面时保持品牌选择

## 💡 使用场景

### 🔄 用户体验优化

- 用户无需每次重新选择品牌
- 减少重复操作，提升使用流畅度
- 跨会话保持工作状态

### 🧪 开发和测试

- 测试时自动恢复到常用品牌
- 快速切换不同品牌进行对比测试
- 开发时保持一致的测试环境

### 📊 用户行为分析

- 记录品牌使用偏好
- 分析用户最常使用的品牌
- 为产品优化提供数据支持

## 🛡️ 技术特性

### ✅ 错误处理

- 优雅的错误降级机制
- 本地存储失败时不影响基本功能
- 详细的错误日志和用户友好的提示

### ✅ 性能优化

- 异步加载，不阻塞页面渲染
- 延迟加载历史记录数据
- 最小化存储读写操作

### ✅ 数据安全

- 仅存储必要的品牌标识符
- 不存储敏感或个人信息
- 客户端本地存储，无网络传输

### ✅ 向后兼容

- 新功能不影响现有组件使用
- 渐进式增强用户体验
- 可选功能开关

## 🔍 调试和开发

### 开发者工具

```javascript
// 浏览器控制台中查看存储内容
import("localforage").then(lf => {
  lf.getItem("brand_preference").then(console.log);
  lf.getItem("brand_history").then(console.log);
});
```

### 测试场景

1. **品牌切换**：选择不同品牌，刷新页面验证恢复
2. **历史记录**：多次切换品牌，查看历史记录排序
3. **错误处理**：清空本地存储，验证降级行为
4. **跨会话**：关闭浏览器重新打开，验证数据持久性

## 🚀 未来扩展

- 🌐 云端同步用户偏好
- 📱 响应式设计优化
- 🎨 品牌主题自动切换
- 📈 更详细的使用统计

---

_这个持久化功能确保了用户体验的连续性，让品牌切换更加智能和便捷！_
