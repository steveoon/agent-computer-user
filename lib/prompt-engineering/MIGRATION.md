# Prompt Engineering 模块迁移指南

## 概述

将原有的 `context-engineering-prompt-builder.ts` 拆分为模块化架构，提高代码可维护性和复用性。

## 迁移状态

### ✅ 已完成迁移
- **CellularMemoryManager** → `memory/cellular-memory-manager.ts`
- **分类功能** → `core/classification-builder.ts`
- **回复功能** → `core/reply-builder.ts`
- **回复示例库** → `examples/reply-examples.ts`
- **上下文优化** → `core/reply-builder.ts` (ContextOptimizer)

### ✅ 迁移完成
原文件 `lib/loaders/context-engineering-prompt-builder.ts` 已被移除，所有功能已完全迁移到新的模块化架构。

## 使用示例

### 旧代码（已移除）
```typescript
// ⚠️ 以下代码已不可用，文件已被删除
import { 
  ContextEngineeringPromptBuilder,
  promptBuilder 
} from '@/lib/loaders/context-engineering-prompt-builder'; // ❌ 文件已删除

// 使用旧的构建器 - 已弃用
const result = promptBuilder.buildOptimizedPrompt({
  message: "工资多少？",
  classification: classification,
  contextInfo: contextInfo,
  // ...
});
```

### 新代码（推荐）
```typescript
import { 
  replyBuilder, 
  classificationBuilder 
} from '@/lib/prompt-engineering';

// 1. 分类提示构建
const classificationResult = classificationBuilder.createOptimizedClassificationPrompt({
  message: "工资多少？",
  brandData: {
    city: "上海",
    defaultBrand: "肯德基",
    availableBrands: ["肯德基", "麦当劳"]
  },
  candidateInfo: candidateInfo
});

// 2. 回复提示构建
const replyResult = replyBuilder.createOptimizedReplyPrompt({
  message: "工资多少？",
  classification: classification,
  contextInfo: contextInfo,
  systemInstruction: instruction,
  conversationHistory: history,
  candidateInfo: candidateInfo,
  targetBrand: "肯德基"
});

// 3. 更新内存（如需要）
replyBuilder.updateMemory(message, reply);
```

## 主要改进

### 1. 模块化架构
- 功能分离：分类、回复、内存管理独立
- 依赖清晰：消除循环依赖
- 易于测试：各模块可独立测试

### 2. 增强功能
- **ContextOptimizer**：智能上下文优化
- **情绪检测**：positive/neutral/negative
- **紧急度检测**：high/medium/low
- **品牌优先级**：品牌特定数据优先处理
- **智能候选人匹配**：基于服务行业特殊需求的相关性评分
- **动态信息提取**：从静态"候选人"到实际姓名提取（如"杨辉"）
- **完整候选人档案**：性别、期望薪资、健康证、活跃时间等关键信息

### 3. 类型安全
- 基于Zod的运行时验证
- 完整的TypeScript类型定义
- 统一的接口规范

## 集成步骤

### Step 1: 更新导入
```typescript
// 替换旧导入
- import { promptBuilder } from '@/lib/loaders/context-engineering-prompt-builder';
+ import { replyBuilder, classificationBuilder } from '@/lib/prompt-engineering';
```

### Step 2: 更新调用代码
```typescript
// 分类
const { system, prompt } = classificationBuilder.build({
  message: userMessage,
  brandData: brandData,
  candidateInfo: candidateInfo
});

// 回复
const replyResult = replyBuilder.build({
  message: userMessage,
  classification: classification,
  contextInfo: contextInfo,
  systemInstruction: instruction,
  conversationHistory: history
});
```

### Step 3: 使用新的内存管理
```typescript
// 更新对话内存
replyBuilder.updateMemory(userMessage, assistantReply);

// 清理过期内存
replyBuilder.cleanupMemory();
```

## 配置选项

### 预设配置
```typescript
import { HIGH_PERFORMANCE_CONFIG, HIGH_QUALITY_CONFIG } from '@/lib/prompt-engineering';

// 高性能模式（减少示例和token）
const fastBuilder = new ReplyPromptBuilder(HIGH_PERFORMANCE_CONFIG);

// 高质量模式（更多示例和上下文）
const qualityBuilder = new ReplyPromptBuilder(HIGH_QUALITY_CONFIG);
```

### 自定义配置
```typescript
const customBuilder = new ReplyPromptBuilder({
  maxExamples: 4,
  tokenBudget: 3500,
  enableMemory: true,
  experimentalFieldSupport: false
});
```

## 注意事项

1. **破坏性变更**：原文件已完全移除，必须使用新API
2. **完整迁移**：所有相关代码必须更新到新架构
3. **测试覆盖**：迁移后请运行完整测试套件
4. **性能优化**：新模块提供更好的性能和功能

## 已完成改进

- ✅ **完全移除原文件**：干净的代码库架构
- ✅ **智能候选人评分**：服务行业特化的匹配算法
- ✅ **完整测试覆盖**：131个测试用例全部通过
- ✅ **文档更新**：架构文档反映最新功能

## 后续计划

- [ ] 添加更多预设配置
- [ ] 实现Neural Field架构集成
- [ ] 增加更多语言的示例库
- [ ] 优化候选人匹配算法权重