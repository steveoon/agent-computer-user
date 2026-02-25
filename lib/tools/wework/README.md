# 企微智能回复工具集

本目录包含企业微信智能客服场景专用工具的实现。

## 文件结构

```
lib/tools/wework/
├── classify_intent.tool.ts        # classify_intent 工具实现（双任务并行架构）
├── ai-job-types.ts                  # WeWork 岗位列表类型
├── job-list-for-llm-tool.ts         # 企微岗位列表查询（LLM 渐进式披露）
├── index.ts                        # 工具导出
├── README.md                       # 本文档
└── __tests__/
    └── classify_intent.test.ts     # 集成测试
```

## classify_intent 工具

### 功能概述

`classify_intent` 是企微智能回复系统的核心工具，负责：

1. **识别对话阶段（stage）** - 确定候选人处于招聘漏斗的哪个阶段
2. **检测回复需求（needs）** - 识别候选人需要了解的信息类型
3. **标记风险因子（riskFlags）** - 检测对话中的敏感问题
4. **提取候选人事实信息** - 收集面试信息和意向偏好

### 核心特性

- ✅ **双任务并行**：阶段规划和实体提取并行执行，性能提升 50%
- ✅ **配置驱动**：阶段目标从运营后台动态注入，灵活可配置
- ✅ **结构化输出**：基于 Zod Schema 的类型安全保障
- ✅ **Policy-First**：规则层 + LLM 层双重保障，确保关键需求不遗漏

### 输入参数

```typescript
{
  message: string;                    // 候选人当前消息
  conversationHistory: string[];      // 对话历史（最近 10 轮）
  stageGoals: Record<FunnelStage, StageGoalPolicy>;  // 阶段目标配置
  modelConfig?: {                     // 模型配置（可选）
    classifyModel?: string;           // 阶段分类模型
    extractModel?: string;            // 实体提取模型
  };
}
```

### 输出结构

```typescript
{
  planning: {
    stage: FunnelStage;              // 当前阶段
    needs: ReplyNeed[];              // 回复需求（≤8个）
    riskFlags: RiskFlag[];           // 风险标记（≤6个）
    confidence: number;              // 置信度 (0-1)
    reasoning: string;               // 分类理由
    stageGoal: StageGoalPolicy;      // 当前阶段的目标配置
  };
  extraction: {
    interview_info: InterviewInfo;   // 面试信息
    preferences: Preferences;         // 意向信息
    reasoning: string;                // 提取理由/说明
  };
}
```

### 使用示例

```typescript
import { weworkClassifyIntentTool } from '@/lib/tools/wework';

// 在 AI SDK 工具调用中使用
const result = await weworkClassifyIntentTool.execute({
  message: "你们肯德基浦东有门店吗，薪资怎么算",
  conversationHistory: [
    "候选人: 你好，想找份兼职",
    "HR: 您好！我们有多个品牌在招聘，请问您对哪个品牌感兴趣呢？",
  ],
  stageGoals: {
    job_consultation: {
      primaryGoal: "回答岗位问题并提升兴趣",
      successCriteria: ["候选人对岗位保持兴趣"],
      ctaStrategy: "先答核心问题，再给下一步建议",
      disallowedActions: ["编造数字或政策"],
    },
    // ... 其他阶段配置
  },
});

console.log(result.planning.stage);  // "job_consultation"
console.log(result.planning.needs);  // ["salary", "location"]
console.log(result.extraction.preferences.brands);  // ["肯德基"]
```

## wework_job_list_for_llm 工具

### 功能概述

用于企微场景的岗位列表查询，支持渐进式披露字段，降低 Token 消耗。

### 使用示例

```typescript
import { weworkJobListForLlmTool } from '@/lib/tools/wework';

const result = await weworkJobListForLlmTool().execute({
  cityNameList: ["上海市"],
  brandAliasList: ["肯德基", "KFC"],
  includeBasicInfo: true,
  includeJobSalary: false,
});

console.log(result.type); // "text"
```

## 相关文档

- [企微 Agent 架构总览](../../../docs/wecom-agent-architecture.md)
- [classify_intent 实现规范](../../../docs/classify-intent-implementation-spec.md)
- [实体提取类型定义](../../agents/types.ts)

## 性能优化

### 并行执行

工具采用 Promise.all 并行执行阶段规划和实体提取两个任务：

```typescript
const [fullPlan, extractionResult] = await Promise.all([
  planTurn(message, options),           // 任务 A
  extractCandidateFacts(message, opts), // 任务 B
]);
```

**性能收益**：响应时间 ≈ 单次 LLM 调用时间（而非 2 倍）

### 模型选择

可以为不同任务指定不同模型以优化成本：

```typescript
{
  modelConfig: {
    classifyModel: 'qwen-plus',      // 阶段识别用更强的模型
    extractModel: 'qwen-turbo',      // 实体提取用更便宜的模型
  }
}
```

## 测试

运行测试：

```bash
# 运行所有测试
pnpm test lib/tools/wework/__tests__/classify_intent.test.ts

# 运行单个测试
pnpm test lib/tools/wework/__tests__/classify_intent.test.ts -t "should return both planning and extraction results"
```

## 维护指南

### 添加新的阶段

1. 在 `types/reply-policy.ts` 中添加新阶段到 `FunnelStageSchema`
2. 在运营后台配置中添加对应的 `StageGoalPolicy`
3. 更新 `classification-agent.ts` 中的阶段识别逻辑

### 添加新的需求类型

1. 在 `types/reply-policy.ts` 中添加到 `ReplyNeedSchema`
2. 在 `classification-agent.ts` 的 `NEED_RULES` 中添加检测规则

### 添加新的实体字段

1. 在 `lib/agents/types.ts` 中更新 Schema
2. 在 `wework-entity-extraction-agent.ts` 的提示词中添加字段说明
3. 添加对应的单元测试

## 注意事项

- ⚠️ **品牌数据获取**：调用 `https://test-k8s.duliday.com/persistence/ai/api/brand/list`，需配置 `DULIDAY_TOKEN`
- ⚠️ **配置注入**：企微场景下配置从 API 请求的 context 参数传入
- ⚠️ **错误处理**：工具内部有降级策略，LLM 失败时会返回默认值
- ⚠️ **类型安全**：所有输入输出都经过 Zod 验证

## 版本历史

- **v1.0.0** (2025-02-25) - 初始实现
  - 双任务并行架构
  - 完整的类型定义和测试覆盖
  - 支持配置化阶段目标
