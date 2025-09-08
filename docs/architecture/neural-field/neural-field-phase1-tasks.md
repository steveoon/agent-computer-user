# Neural Field Architecture - Phase 1 实施任务清单

## 概述

本文档包含实施Neural Field Architecture第一阶段的核心任务，聚焦于建立基础语义场基础设施。

## 前置准备

### Task 0: 环境准备

- [ ] 创建feature分支：`feature/neural-field-architecture`
- [ ] 在 `.env.example` 中添加：`ENABLE_FIELD_ARCHITECTURE=false`
- [ ] 确保 `OPENAI_API_KEY` 环境变量已配置（用于text-embedding-3-small）
- [ ] 安装数学库（选其一）：
  - `pnpm add @tensorflow/tfjs` （推荐：GPU加速支持）
  - `pnpm add ml-matrix` （轻量级选择）
- [ ] 创建 `lib/neural-field/` 目录结构

## Phase 1 核心任务

### Task 1: 创建类型定义

创建 `types/neural-field.d.ts`：

- [ ] 定义 FieldConfig 接口（dimensions默认1536、resonanceDecay等参数）
- [ ] 定义 FieldState 接口（包含vector、energy、isStable等状态）
- [ ] 定义 AgentActivation 接口

### Task 2: 实现 SemanticField 核心类

创建 `lib/neural-field/core/semantic-field.ts`：

- [ ] 实现基础结构
  - 定义 FieldConfigSchema 和 FieldStateSchema (使用Zod)
  - 实现构造函数（初始化state、previousState、agentActivations）
- [ ] 实现核心方法
  - `inject(data, position)` - 注入信息到场
  - `evolve(iterations)` - 场演化主循环
  - `getSlice(start, end)` - 获取场切片
  - `registerActivation(agentName, activation)` - 注册Agent激活
- [ ] 实现私有方法
  - `applyResonance()` - 计算并应用Agent间共振
  - `checkStability()` - 检测场是否稳定
  - `textToVector()` - 文本转向量（调用FieldOperations）

### Task 3: 实现 FieldOperations 工具类

创建 `lib/neural-field/core/field-operations.ts`：

- [ ] 实现基础向量运算
  - `textToVector(text)` - 使用OpenAI text-embedding-3-small模型生成向量
  - `normalize(vector)` - 向量归一化（使用TensorFlow.js或ml-matrix）
  - `cosineSimilarity(vec1, vec2)` - 计算余弦相似度（使用数学库优化）
- [ ] 实现OpenAI embedding集成
  - 配置OpenAI API客户端
  - 实现错误处理和重试机制
  - 添加向量缓存（可选优化）
- [ ] 使用数学库优化运算
  - 选择并集成TensorFlow.js或ml-matrix
  - 实现批量向量运算功能
  - 确保内存管理（TensorFlow.js需要手动dispose）

### Task 4: 创建简单验证测试

创建 `lib/neural-field/__tests__/semantic-field.test.ts`：

- [ ] 测试基本功能
  - 场初始化（维度、初始状态）
  - 信息注入（字符串和向量）
  - 场演化（确保能达到稳定）
  - Agent激活注册

- [ ] 创建集成示例
  - 模拟简单的三Agent场景
  - 验证共振效应存在

### Task 5: 创建迁移适配器

创建 `lib/neural-field/orchestrator/migration-adapter.ts`：

- [ ] 实现MigrationAdapter类
  - 兼容现有 `generateSmartReplyWithLLM` 接口
  - 支持通过配置切换新旧架构
  - 保持向后兼容性

## 验收标准

### 功能验收

- SemanticField 能够成功初始化1536维语义空间（OpenAI embedding维度）
- 文本能够转换为向量并注入场中
- 场演化能够达到稳定状态
- 支持通过环境变量切换新旧架构

### 代码质量

- TypeScript类型完整且无错误
- 核心方法有错误处理
- 代码符合项目规范

## 实施建议

1. **先实现核心，后优化性能**
   - Phase 1专注于功能实现
   - 性能优化留到后续迭代

2. **渐进式集成**
   - 通过MigrationAdapter保证兼容性
   - 使用feature flag控制新功能

3. **简单验证**
   - 不追求完美的测试覆盖
   - 重点验证核心功能可用

## 后续计划

Phase 1完成后的方向：

- Phase 2: 实现三个场感知Agent
- Phase 3: 实现完整的orchestrator
- Phase 4: 性能优化和监控工具
