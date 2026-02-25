# 渐进式岗位查询设计

> 本文档描述 `duliday_job_list_for_llm` 工具的渐进式数据返回设计思想。

## 设计背景

### 问题

在智能客服场景中，传统的岗位查询接口存在以下问题：

| 问题 | 描述 |
|------|------|
| **Token 浪费** | 每次返回完整岗位信息，大部分字段用户并不关心 |
| **响应冗长** | LLM 生成的回复过于详细，用户体验差 |
| **上下文污染** | 无关字段占用 LLM 上下文窗口 |
| **一刀切** | 无法根据对话阶段返回合适粒度的数据 |

### 解决方案

**渐进式数据返回**：根据对话阶段和用户问题，按需返回所需字段。

```
用户意图明确度：低 ────────────────────────────────> 高
数据粒度：      粗 ────────────────────────────────> 细
Token 消耗：    少 ────────────────────────────────> 多

初次接触        区域筛选        具体问题        面试安排
   │               │               │               │
   ▼               ▼               ▼               ▼
 品牌+门店     +薪资概览       +详细字段       +面试流程
```

---

## 核心设计

### 渐进式披露策略

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 对话阶段                     │ 返回数据                                │
├─────────────────────────────────────────────────────────────────────────┤
│ 初次接触                     │ 简要列表：品牌+门店+地址（快速概览）    │
│ 岗位咨询 - 地区/品牌筛选     │ 摘要列表：+岗位名+综合薪资（初步筛选）  │
│ 岗位咨询 - 具体问题          │ 单字段详情：只返回问到的字段            │
│ 面试安排                     │ 预约信息：面试时间+地址+要求            │
└─────────────────────────────────────────────────────────────────────────┘
```

### 布尔开关控制

通过 6 个布尔开关控制返回的数据字段：

```typescript
const inputSchema = z.object({
  // ========== 筛选条件 ==========
  cityNameList: z.array(z.string()).optional()
    .describe('城市列表，如 ["上海市", "北京市"]'),
  regionNameList: z.array(z.string()).optional()
    .describe('区域列表，如 ["浦东新区", "静安区"]'),
  brandAliasList: z.array(z.string()).optional()
    .describe('品牌别名列表，如 ["肯德基", "KFC"]'),
  storeNameList: z.array(z.string()).optional()
    .describe('门店名称列表，如 ["浦东陆家嘴店"]'),
  jobCategoryList: z.array(z.string()).optional()
    .describe('岗位类型列表，如 ["服务员", "收银员"]'),
  jobIdList: z.array(z.string()).optional()
    .describe('岗位ID列表，用于查询特定岗位'),

  // ========== 渐进式披露：布尔开关 ==========
  includeBasicInfo: z.boolean().optional().default(true)
    .describe('返回基本信息（品牌、门店、岗位名、地址等）- 默认true'),
  includeJobSalary: z.boolean().optional().default(false)
    .describe('返回薪资信息'),
  includeWelfare: z.boolean().optional().default(false)
    .describe('返回福利信息'),
  includeHiringRequirement: z.boolean().optional().default(false)
    .describe('返回招聘要求'),
  includeWorkTime: z.boolean().optional().default(false)
    .describe('返回工作时间/班次'),
  includeInterviewProcess: z.boolean().optional().default(false)
    .describe('返回面试流程'),
});
```

### 字段对应关系

| 布尔开关 | API Schema | 包含内容 |
|----------|------------|----------|
| `includeBasicInfo` | `basicInfoSchema` | 品牌、门店、岗位名、地址、工作内容等 |
| `includeJobSalary` | `jobSalarySchema` | 基本薪资、综合薪资、结算周期、节假日薪资等 |
| `includeWelfare` | `welfareSchema` | 餐饮、住宿、交通、保险、晋升等福利 |
| `includeHiringRequirement` | `hiringRequirementSchema` | 性别、年龄、身高、学历、证书等要求 |
| `includeWorkTime` | `workTimeSchema` | 就业形式、每周工时、排班、班次等 |
| `includeInterviewProcess` | `interviewProcessSchema` | 面试轮数、时间、地址、试工、培训等 |

---

## 场景与开关映射

### Token 消耗对比

| 场景 | 开启的布尔开关 | Token 消耗 |
|------|----------------|------------|
| 初次接触/快速浏览 | `includeBasicInfo: true`（默认） | 极低 |
| 区域筛选/对比岗位 | `+ includeJobSalary: true` | 低 |
| 问薪资 | `+ includeJobSalary: true` | 低 |
| 问福利 | `+ includeWelfare: true` | 低 |
| 问招聘要求 | `+ includeHiringRequirement: true` | 低 |
| 问班次/工时 | `+ includeWorkTime: true` | 中 |
| 面试安排 | `+ includeInterviewProcess: true` | 中 |
| 需要完整信息 | 全部 6 个布尔开关设为 true | 高 |

### 使用示例

```typescript
// 场景1：初次接触 - 用户问"你们有什么岗位"
{
  // includeBasicInfo 默认为 true，无需显式传
  // 返回：品牌+门店+岗位名+地址，每条约 50 字
}

// 场景2：区域筛选 - 用户说"我想在浦东找工作"
{
  cityNameList: ["上海市"],
  regionNameList: ["浦东新区"],
  includeJobSalary: true
  // 返回：基本信息 + 薪资概览
}

// 场景3：门店筛选 - 用户说"陆家嘴那边有吗"
{
  storeNameList: ["陆家嘴"],  // 模糊匹配
  includeJobSalary: true
}

// 场景4：岗位类型筛选 - 用户说"有没有收银员的岗位"
{
  jobCategoryList: ["收银员"],
  includeJobSalary: true
}

// 场景5：具体问题 - 用户问"工资怎么算的"
{
  brandAliasList: ["肯德基"],  // 根据上下文筛选
  includeJobSalary: true
  // 返回：基本信息 + 详细薪资
}

// 场景6：具体问题 - 用户问"几点上班"
{
  includeWorkTime: true
  // 返回：基本信息 + 工时班次
}

// 场景7：面试安排 - 用户想预约面试
{
  jobIdList: ["123456"],  // 明确的岗位ID
  includeInterviewProcess: true
  // 返回：基本信息 + 面试流程
}

// 场景8：完整信息 - 用户需要所有详情
{
  jobIdList: ["123456"],
  includeJobSalary: true,
  includeWelfare: true,
  includeHiringRequirement: true,
  includeWorkTime: true,
  includeInterviewProcess: true
}
```

---

## 输出格式设计

根据开启的布尔开关返回不同格式：

### 仅基本信息（极简模式）

```markdown
# 在招岗位（共 15 个）
1. **肯德基 - 服务员** | 浦东陆家嘴店 | 陆家嘴环路1000号
2. **必胜客 - 收银员** | 静安寺店 | 南京西路1266号
3. **奥乐齐 - 理货员** | 虹桥店 | 延安西路2299号
...
```

### 基本信息 + 薪资

```markdown
# 在招岗位（共 15 个）

## 1. 肯德基 - 服务员（浦东陆家嘴店）
### 基本信息
- **门店**: 浦东陆家嘴店
- **地址**: 陆家嘴环路1000号
- **就业形式**: 全职

### 薪资信息
- **基本薪资**: 22元/小时
- **综合薪资**: 4500-6000 元/月
- **结算周期**: 月结，15日发薪
- **节假日薪资**: 1.5倍

---

## 2. 必胜客 - 收银员（静安寺店）
...
```

### 基本信息 + 工作时间

```markdown
# 在招岗位（共 3 个）

## 1. 肯德基 - 服务员（浦东陆家嘴店）
### 基本信息
- **门店**: 浦东陆家嘴店
- **地址**: 陆家嘴环路1000号

### 工作时间
- **就业形式**: 全职
- **每周工时**: 每周5天，休2天
- **排班类型**: 轮班制
- **固定班次**: 09:00-18:00、14:00-23:00
```

---

## 设计优势

### 1. Token 效率

```
传统方式：每次返回 ~2000 tokens/岗位
渐进式：
  - 基本信息：~50 tokens/岗位
  - +薪资：~100 tokens/岗位
  - +全字段：~500 tokens/岗位

节省比例：75%-97.5%
```

### 2. 响应质量

| 维度 | 传统方式 | 渐进式 |
|------|----------|--------|
| 信息密度 | 低（大量无关信息） | 高（精准返回） |
| 用户体验 | 差（冗长难读） | 好（简洁明了） |
| LLM 理解 | 易混淆 | 清晰聚焦 |

### 3. 灵活性

- **按需组合**：任意组合 6 个布尔开关
- **上下文感知**：根据对话阶段自动调整
- **透传设计**：筛选条件直接透传后端 API

---

## 与 classify_intent 的协作

```
┌─────────────────────────────────────────────────────────────────────┐
│                         协作流程                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  用户消息: "浦东有什么工作，工资怎么样"                              │
│                     ↓                                               │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ classify_intent                                              │   │
│  │ 输出: {                                                      │   │
│  │   lifecycle_stage: "job_consulting",                         │   │
│  │   extracted_facts: {                                         │   │
│  │     preferences: {                                           │   │
│  │       cities: ["上海市"],                                    │   │
│  │       district: "浦东新区"                                   │   │
│  │     }                                                        │   │
│  │   }                                                          │   │
│  │ }                                                            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                     ↓                                               │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ LLM 推理                                                     │   │
│  │ - 用户在岗位咨询阶段                                          │   │
│  │ - 用户问了"工资怎么样" → 需要薪资信息                         │   │
│  │ - 决定调用 duliday_job_list_for_llm                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                     ↓                                               │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ duliday_job_list_for_llm                                     │   │
│  │ 入参: {                                                      │   │
│  │   cityNameList: ["上海市"],                                  │   │
│  │   regionNameList: ["浦东新区"],                              │   │
│  │   includeJobSalary: true  // 用户问了薪资                    │   │
│  │ }                                                            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                     ↓                                               │
│  返回：浦东地区岗位列表 + 薪资信息                                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 实现要点

### 1. 筛选条件透传

用户提到的品牌、位置等关键词直接透传给后端 API：

```typescript
// LLM 提取的用户原话
const facts = classifyResult.extracted_facts.preferences;

// 直接透传，不做前端映射
const jobs = await jobListForLLM({
  brandAliasList: facts.brands,        // "KFC" 原样传
  regionNameList: [facts.district],    // "浦东" 原样传
  includeJobSalary: true,
});

// 后端 API 负责映射：
// "KFC" → "肯德基"
// "浦东" → "浦东新区"
```

### 2. 默认值设计

```typescript
// 只有 includeBasicInfo 默认为 true
// 其他开关默认为 false，按需开启
includeBasicInfo: z.boolean().optional().default(true),
includeJobSalary: z.boolean().optional().default(false),
includeWelfare: z.boolean().optional().default(false),
// ...
```

### 3. 格式化函数

```typescript
// 根据布尔开关选择性调用格式化函数
function formatJobByFlags(job: Job, flags: Flags): string {
  let result = "";

  if (flags.includeBasicInfo) {
    result += formatBasicInfo(job);
  }
  if (flags.includeJobSalary) {
    result += formatJobSalary(job);
  }
  if (flags.includeWelfare) {
    result += formatWelfare(job);
  }
  // ...

  return result;
}
```

---

## 相关文档

- [Agent 架构设计](./wecom-agent-architecture.md)
- [记忆系统架构](./wecom-memory-architecture.md)
