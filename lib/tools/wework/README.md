# 企微智能化工具集

本目录包含企业微信智能客服场景专用的 AI 工具实现。

## 文件结构

```
lib/tools/wework/
├── plan_turn.tool.ts     # 对话阶段规划工具
├── extract_facts.tool.ts # 候选人事实提取工具（三层缓存）
├── types.ts              # 工具输入/输出类型定义
└── README.md             # 本文档
```

## 工具概览

### 1. wework_plan_turn

识别当前对话阶段（stage）、检测回复需求（needs）、标记风险因子（riskFlags），并从 `stageGoals` 配置中查找当前阶段的运营目标。

**主要功能：**

- 识别候选人处于招聘漏斗的哪个阶段
- 检测候选人当前关注的信息类型（薪资/排班/地点等）
- 标记对话中的敏感问题（竞品/负面情绪等）
- 从运营后台动态配置中返回当前阶段目标

### 2. wework_extract_facts

从对话历史中累积提取候选人的结构化事实信息，包括面试信息和意向偏好。与当前对话阶段无关，全程客观收集。

**主要功能：**

- 提取面试信息（姓名、电话、性别、年龄、应聘门店/岗位、面试时间等）
- 提取意向信息（品牌、薪资、岗位、班次、城市、区域、地点）
- 三层缓存加速：内存（5min）→ Redis（30min）→ API
- 自动获取品牌列表辅助品牌名称归一化

## 工具参数详解

### wework_plan_turn 参数

| 参数名              | 类型                                | 必填 | 说明                               |
| ------------------- | ----------------------------------- | ---- | ---------------------------------- |
| message             | string                              | 是   | 候选人当前消息                     |
| conversationHistory | string[]                            | 否   | 对话历史（最近 10 轮），默认 []    |
| stageGoals          | Record\<FunnelStage, StageGoalPolicy\> | 是   | 阶段目标配置（从运营后台传入）     |
| modelConfig         | { classifyModel?: string }          | 否   | 模型配置，可指定阶段分类使用的模型 |

### wework_extract_facts 参数

| 参数名              | 类型                           | 必填 | 说明                                               |
| ------------------- | ------------------------------ | ---- | -------------------------------------------------- |
| message             | string                         | 是   | 候选人当前消息                                     |
| conversationHistory | string[]                       | 否   | 完整对话历史，默认 []                              |
| userId              | string                         | 否   | 用户 ID，与 sessionId 同时传入时启用 Redis 缓存    |
| sessionId           | string                         | 否   | 会话 ID，与 userId 同时传入时启用 Redis 缓存       |
| modelConfig         | { extractModel?: string }      | 否   | 模型配置，可指定实体提取使用的模型                 |

## 工具使用示例

### 场景 1：识别对话阶段

```
候选人：你们肯德基浦东有门店吗，薪资怎么算

LLM：使用 wework_plan_turn 工具
输入：
{
  message: "你们肯德基浦东有门店吗，薪资怎么算",
  conversationHistory: [...],
  stageGoals: { job_consultation: { primaryGoal: "回答岗位问题并提升兴趣", ... } }
}
输出：
{
  stage: "job_consultation",
  needs: ["salary", "location"],
  riskFlags: [],
  confidence: 0.92,
  reasoning: "候选人主动询问薪资和地点",
  stageGoal: { primaryGoal: "...", successCriteria: [...], ... }
}
```

### 场景 2：提取候选人信息

```
候选人：我叫李明，手机 13800138000，男，23岁，想去陆家嘴那家店当服务员

LLM：使用 wework_extract_facts 工具
输入：
{
  message: "我叫李明，手机 13800138000，男，23岁，想去陆家嘴那家店当服务员",
  conversationHistory: [...],
  userId: "wx_user_001",
  sessionId: "session_abc"
}
输出：
{
  interview_info: {
    name: "李明",
    phone: "13800138000",
    gender: "男",
    age: "23",
    applied_position: "服务员"
  },
  preferences: {
    location: ["陆家嘴"]
  },
  reasoning: "从消息中直接提取到姓名、电话、性别、年龄和意向岗位"
}
```

### 场景 3：两工具配合使用

```
典型的智能回复流程：

1. wework_plan_turn → 判断当前阶段和需求
   - stage: "interview_scheduling" → 需要安排面试
   - needs: ["interview_time", "store_location"]

2. wework_extract_facts → 获取已知候选人信息
   - 检查 interview_info 中是否已有姓名、电话、年龄等
   - 根据缺失字段决定下一步提问方向

3. 生成回复 → 根据 stageGoal + needs + 已知信息合成回复
```

## 输出数据结构

### wework_plan_turn 输出

```typescript
{
  stage: FunnelStage;           // 当前漏斗阶段
  needs: ReplyNeed[];           // 回复需求列表（≤8个）
  riskFlags: RiskFlag[];        // 风险标记列表（≤6个）
  confidence: number;           // 置信度 (0-1)
  reasoning: string;            // 分类理由
  stageGoal: StageGoalPolicy;   // 当前阶段的运营目标配置
}
```

### wework_extract_facts 输出

```typescript
{
  interview_info: {
    name?: string;                 // 姓名
    phone?: string;                // 联系方式
    gender?: string;               // 性别
    age?: string;                  // 年龄（保留原话）
    applied_store?: string;        // 应聘门店
    applied_position?: string;     // 应聘岗位
    interview_time?: string;       // 面试时间（保留原话）
    is_student?: string;           // 是否是学生
    job_id?: string;               // 岗位ID（用于预约面试）
    education?: string;            // 学历
    has_health_certificate?: string; // 健康证状态
  };
  preferences: {
    brands?: string[];             // 意向品牌（归一化为品牌名称）
    salary?: string;               // 意向薪资（保留原话）
    position?: string[];           // 意向岗位
    schedule?: string;             // 意向班次/时间
    city?: string;                 // 意向城市
    district?: string[];           // 意向区域
    location?: string[];           // 意向地点/商圈
  };
  reasoning: string;              // 提取理由
}
```

## 配置要求

### 环境变量

- `DULIDAY_TOKEN`：用于 `wework_extract_facts` 获取品牌列表数据（可选，无则跳过品牌归一化）
- Redis 连接：可选，无 Redis 时自动降级为无缓存模式

### 阶段目标配置（stageGoals）

`wework_plan_turn` 要求传入所有漏斗阶段的运营目标配置，通常由上游 API 请求的 context 参数注入：

```typescript
{
  job_consultation: {
    primaryGoal: "回答岗位问题并提升兴趣",
    successCriteria: ["候选人对岗位保持兴趣"],
    ctaStrategy: "先答核心问题，再给下一步建议",
    disallowedActions: ["编造数字或政策"],
  },
  // ... 其他阶段
}
```

## 错误处理

### 常见错误及解决方案

1. **阶段目标未配置**
   - 错误：`Stage goal not found for stage: xxx`
   - 解决：在 `stageGoals` 中补充对应阶段的配置

2. **品牌数据获取失败**
   - 行为：自动降级，返回空品牌列表，不影响提取
   - 解决：确认 `DULIDAY_TOKEN` 有效，或检查网络连接

3. **Redis 不可用**
   - 行为：自动降级为无缓存模式，不影响功能
   - 解决：检查 Redis 连接配置

4. **LLM 调用失败（extract_facts）**
   - 行为：返回降级空值 `{ interview_info: {}, preferences: {}, reasoning: "实体提取失败，使用空值降级" }`
   - 解决：检查模型 API Key 及网络

## 相关文档

- [企微 Agent 架构总览](../../../docs/wecom-agent-architecture.md)
- [企微记忆架构设计](../../../docs/wecom-memory-architecture.md)
- [阶段目标类型定义](../../../types/reply-policy.ts)
- [Fact Extraction Agent](../../agents/fact-extraction-agent.ts)
