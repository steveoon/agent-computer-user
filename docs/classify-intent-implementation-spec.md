# classify_intent 工具实现架构规范

## 1. 概述

### 1.1 工具定位

`classify_intent` 是企微智能回复系统的核心工具，负责：
- 识别对话阶段（stage）
- 检测回复需求（needs）
- 标记风险因子（riskFlags）
- 提取候选人事实信息（interview_info + preferences）

### 1.2 核心特性

- **双任务并行**：阶段规划 + 实体提取同时进行
- **配置驱动**：阶段目标从运营后台动态注入
- **结构化输出**：基于 Zod Schema 的类型安全
- **Policy-First**：规则层 + LLM 层双重保障

---

## 2. 工具接口设计

### 2.1 输入参数

```typescript
interface ClassifyIntentInput {
  // 候选人当前消息
  message: string;

  // 对话历史（最近 10 轮）
  conversationHistory: string[];

  // 运营后台配置的阶段目标信息
  stageGoals: Record<FunnelStage, StageGoalPolicy>;

  // 模型配置（可选）
  modelConfig?: {
    classifyModel: string;
    extractModel?: string; // 实体提取可以用不同的模型
  };
}
```

### 2.2 输出结构

```typescript
interface ClassifyIntentOutput {
  // 任务 A：阶段规划结果（直接使用 planTurn）
  planning: {
    stage: FunnelStage;           // 当前阶段
    needs: ReplyNeed[];           // 回复需求（≤8个）
    riskFlags: RiskFlag[];        // 风险标记（≤6个）
    confidence: number;           // 置信度 (0-1)
    reasoning: string;            // 分类理由
    stageGoal: StageGoalPolicy;   // 当前阶段的目标配置
  };

  // 任务 B：实体提取结果（来自 extractCandidateFacts）
  extraction: {
    interview_info: InterviewInfo;  // 面试信息
    preferences: Preferences;        // 意向信息
    reasoning: string;               // 提取理由/说明
  };
}
```

### 2.3 类型定义

#### InterviewInfo（面试安排阶段收集）

```typescript
interface InterviewInfo {
  name?: string;         // 姓名
  phone?: string;        // 联系方式
  gender?: string;       // 性别（如："男"、"女"）
  age?: string;          // 年龄（如："18"、"25岁"）
  applied_store?: string;     // 应聘门店
  applied_position?: string;  // 应聘岗位
  interview_time?: string;    // 面试时间
  is_student?: string;        // 是否是学生（如："是"、"学生"、"否"）
}
```

**字段说明**：
- 所有字段均为字符串类型，保留用户原话
- 不做类型转换（如 "18岁" 不转换为数字 18）
- 不做标准化（如 "男" 不转换为枚举 "male"）

#### Preferences（岗位咨询阶段收集）

```typescript
interface Preferences {
  brands?: string[];    // 意向品牌（数组，保留用户原话，如：用户说"KFC"就提取["KFC"]）
  salary?: string;      // 意向薪资（如："时薪20"、"4000-5000"）
  position?: string;    // 意向岗位（如："服务员"、"收银员"）
  schedule?: string;    // 意向班次（如："周末"、"晚班"）
  cities?: string[];    // 意向城市（数组，如：["上海", "杭州"]）
  district?: string;    // 意向区域（如："浦东"、"徐汇"）
  location?: string;    // 意向地点/商圈（如："人民广场"、"陆家嘴"）
}
```

**字段说明**：
- 单值字段使用 `string`
- 多值字段使用 `string[]`（brands, cities）
- **所有内容保留用户原话**，包括品牌（不做映射或标准化）
- **品牌列表的作用**：仅用于帮助识别哪些词是品牌实体，不用于映射

#### CandidateFacts（候选人事实）

```typescript
interface CandidateFacts {
  interview_info: InterviewInfo;  // 面试信息
  preferences: Preferences;        // 意向信息
}
```

---

## 3. 核心组件架构

### 3.1 整体流程

```
┌─────────────────────────────────────────────────────────────┐
│              classify_intent 执行流程                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 输入验证                                                 │
│     ├─ 验证 message, conversationHistory                   │
│     └─ 验证 stageGoals 配置完整性                           │
│                            ↓                                │
│  ─────────────────────────────────────────────────────────  │
│                            ↓                                │
│  2. 获取品牌数据                                             │
│     └─ HTTP 请求: GET /api/brands                          │
│                            ↓                                │
│  ─────────────────────────────────────────────────────────  │
│                            ↓                                │
│  3. 并行执行两个任务                                         │
│     ┌──────────────────────┐  ┌──────────────────────┐     │
│     │  任务 A: planTurn     │  │ 任务 B: extractFacts │     │
│     │  (阶段规划)           │  │ (实体提取)           │     │
│     └──────────────────────┘  └──────────────────────┘     │
│              ↓                          ↓                   │
│  ─────────────────────────────────────────────────────────  │
│                            ↓                                │
│  4. 阶段映射 & 结果合并                                      │
│     ├─ 获取 stageGoal: stageGoals[stage]                  │
│     ├─ planning: { stage, needs, riskFlags, stageGoal }   │
│     └─ extraction: { interview_info, preferences, ... }    │
│                            ↓                                │
│  ─────────────────────────────────────────────────────────  │
│                            ↓                                │
│  5. 输出结果                                                 │
│     返回 ClassifyIntentOutput                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 任务 A：阶段规划（直接使用 planTurn）

#### 职责

阶段识别和需求检测，复用现有的 `planTurn` 函数。

#### 实现方式

**调用 planTurn 进行阶段识别**：

```typescript
// 调用 planTurn（不传入 stageGoals 和 brandData）
const fullPlan = await planTurn(message, {
  conversationHistory,
  modelConfig,
});

// 根据识别出的阶段，从 stageGoals 中获取对应配置
const currentStageGoal = stageGoals[fullPlan.stage];

// 组装 planning 结果
const planning = {
  stage: fullPlan.stage,
  needs: fullPlan.needs,
  riskFlags: fullPlan.riskFlags,
  confidence: fullPlan.confidence,
  reasoning: fullPlan.reasoningText,
  stageGoal: currentStageGoal,
};
```

**关键点**：
- **planTurn 不需要 stageGoals 和 brandData**：只传入 message、conversationHistory、modelConfig
- **阶段映射**：根据 planTurn 返回的 stage，从 stageGoals 中查找对应配置
- **字段重命名**：`reasoningText` → `reasoning`
- **返回阶段目标**：将当前阶段的目标配置一起返回

### 3.3 获取品牌数据（fetchBrandData）

#### 职责

通过 HTTP 请求获取当前公司合作的品牌数据，用于实体提取。

#### 实现方式

```typescript
async function fetchBrandData(): Promise<Array<{ name: string; aliases: string[] }>> {
  // 调用 HTTP 接口获取品牌数据
  const response = await fetch('/api/brands');
  const data = await response.json();

  // 返回格式：[{ name: "肯德基", aliases: ["KFC", "开封菜"] }, ...]
  return data.brands;
}
```

**关键点**：
- **独立获取**：在工具内部通过 HTTP 请求获取，不依赖外部传入
- **格式化数据**：返回包含品牌名称和别名的数组
- **错误处理**：请求失败时返回空数组，保证流程不中断

### 3.4 任务 B：extractCandidateFacts（实体提取）

#### 职责

从对话历史中提取候选人的事实信息，分为面试信息和意向信息两部分。

#### 函数签名

```typescript
async function extractCandidateFacts(
  message: string,
  options: {
    conversationHistory: string[];
    brandData: Array<{ name: string; aliases: string[] }>;
    modelConfig?: ModelConfig;
  }
): Promise<{
  interview_info: InterviewInfo;
  preferences: Preferences;
  reasoning: string;
}>
```

**核心原则**：
- **与阶段无关**：事实提取独立于对话阶段，只分析对话历史中的客观信息
- **全面提取**：只要对话中提到了任何字段信息，都应该提取出来
- **累积式**：从整个对话历史中累积所有事实信息

#### 实现要点

**1. 提示词构建（无阶段依赖）**

```typescript
function buildExtractionPrompt(
  message: string,
  history: string[],
  brandData: Array<{ name: string; aliases: string[] }>
): { system: string; prompt: string } {

  const system = [
    '你是招聘对话实体提取器。',
    '从对话历史中提取候选人的所有事实信息。',
    '分为两部分：interview_info（面试信息）和 preferences（意向信息）。',
    '',
    '提取原则：',
    '- 全面提取：只要对话中提到的信息都要提取',
    '- 客观真实：只提取明确提到的信息，不推测不编造',
    '- 累积式：从整个对话历史中累积所有信息',
    '- 保留原话：所有字段（包括品牌）都保留用户的原始表述',
  ].join('\n');

  // 构建品牌信息提示
  const brandInfo = brandData.map(brand =>
    `- ${brand.name}（别称：${brand.aliases.join('、')}）`
  ).join('\n');

  const prompt = [
    '[可用品牌信息]',
    '当前公司合作的品牌及其常见别称：',
    brandInfo,
    '说明：品牌列表仅用于帮助你识别对话中哪些词是品牌实体，提取时保留候选人的原话。',
    '',
    '[提取字段定义]',
    '',
    'interview_info（面试信息）:',
    '- name: 姓名（如："张三"）',
    '- phone: 联系方式（如："13800138000"）',
    '- gender: 性别（如："男"、"女"）',
    '- age: 年龄（保留原话，如："18"、"25岁"）',
    '- applied_store: 应聘门店（如："人民广场店"）',
    '- applied_position: 应聘岗位（如："服务员"）',
    '- interview_time: 面试时间（如："明天下午2点"）',
    '- is_student: 是否是学生（如："是"、"学生"、"否"）',
    '',
    'preferences（意向信息）:',
    '- brands: 意向品牌（数组，保留原话，如：用户说"KFC"就提取["KFC"]，说"肯德基"就提取["肯德基"]）',
    '- salary: 意向薪资（保留原话，如："时薪20"、"4000-5000"）',
    '- position: 意向岗位（如："服务员"、"收银员"）',
    '- schedule: 意向班次/时间（如："周末"、"晚班"）',
    '- cities: 意向城市（数组，如：["上海", "杭州"]）',
    '- district: 意向区域（如："浦东"、"徐汇"）',
    '- location: 意向地点/商圈（如："人民广场"、"陆家嘴"）',
    '',
    '[提取规则]',
    '- 只提取明确提到的信息，不推测不编造',
    '- 保留用户原话：所有字段（包括品牌）都保留用户的原始表述',
    '- 品牌识别：利用品牌列表识别哪些词是品牌，但提取时保持原词（如用户说"KFC"，就提取"KFC"）',
    '- 未提及的字段省略，不要猜测',
    '- 所有字段都用字符串类型（不要转换类型）',
    '- 多个值用数组（如：["KFC", "麦当劳"]）',
    '',
    '[历史对话]',
    history.join('\n') || '无',
    '',
    '[当前消息]',
    message,
    '',
    '[输出格式]',
    'JSON 对象，包含三个字段：',
    '- interview_info: 对象（未提及的字段省略）',
    '- preferences: 对象（未提及的字段省略）',
    '- reasoning: 简短说明提取了哪些信息',
  ].join('\n');

  return { system, prompt };
}
```

**2. LLM 推理**

```typescript
const result = await safeGenerateObject({
  model,
  schema: z.object({
    interview_info: InterviewInfoSchema,
    preferences: PreferencesSchema,
    reason: z.string().describe('提取理由/说明'),
  }),
  schemaName: 'CandidateFactsExtraction',
  system: prompts.system,
  prompt: prompts.prompt,
});
```

**3. 完整实现**

```typescript
async function extractCandidateFacts(
  message: string,
  options: {
    conversationHistory: string[];
    brandData: Array<{ name: string; aliases: string[] }>;
    modelConfig?: ModelConfig;
  }
): Promise<{
  interview_info: InterviewInfo;
  preferences: Preferences;
  reasoning: string;
}> {
  // 1. 构建提示词（注入 brandData）
  const prompts = buildExtractionPrompt(
    message,
    options.conversationHistory,
    options.brandData
  );

  // 2. LLM 推理
  const result = await safeGenerateObject({
    model,
    schema: z.object({
      interview_info: InterviewInfoSchema,
      preferences: PreferencesSchema,
      reasoning: z.string().describe('提取理由/说明'),
    }),
    schemaName: 'CandidateFactsExtraction',
    system: prompts.system,
    prompt: prompts.prompt,
  });

  // 3. 降级策略
  if (!result.success) {
    return {
      interview_info: {},
      preferences: {},
      reasoning: '实体提取失败，使用空值降级',
    };
  }

  return result.data;
}
```

**累积提取示例**：

```typescript
// 对话历史
conversationHistory = [
  '候选人: 我18岁，想找份兼职',                    // 轮次1: 提取 age=18
  'HR: 好的，您对哪个品牌感兴趣呢？',
  '候选人: 肯德基或者麦当劳都可以',                // 轮次2: 提取 brands=['肯德基', '麦当劳']
  'HR: 您方便在哪个区域工作呢？',
  '候选人: 浦东这边，时薪20以上',                 // 轮次3: 提取 district='浦东', salary='时薪20以上'
];

// 当前消息
message = '我是学生，周末可以上班';

// 提取结果应该包含所有历史信息 + 当前信息
{
  interview_info: {
    age: "18",         // ← 从历史对话提取（字符串类型）
    is_student: "是",  // ← 从当前消息提取（中文文本）
  },
  preferences: {
    brands: ['肯德基', '麦当劳'],  // ← 从历史对话提取
    district: '浦东',              // ← 从历史对话提取
    salary: '时薪20以上',          // ← 从历史对话提取
    schedule: '周末',              // ← 从当前消息提取
  },
  reasoning: '累积提取：年龄18、学生身份、品牌偏好肯德基/麦当劳、浦东区域、薪资预期、周末排班',
}
```

**4. 降级策略**

```typescript
if (!result.success) {
  // 降级：返回空对象
  return {
    interview_info: {},
    preferences: {},
    reason: '实体提取失败，使用空值降级',
  };
}

return result.data;
```

### 3.4 工具封装层

#### 完整实现

```typescript
// lib/tools/wework/classify_intent.tool.ts

import { tool } from 'ai';
import { z } from 'zod/v3';
import { planTurn } from '@/lib/agents/classification-agent';
import { extractCandidateFacts } from '@/lib/agents/entity-extraction';
import {
  FunnelStageSchema,
  ReplyNeedSchema,
  RiskFlagSchema,
  InterviewInfoSchema,
  PreferencesSchema,
} from '@/types/reply-policy';

export const classifyIntentTool = tool({
  description: '阶段分类+回合规划+事实提取+风险标记',

  parameters: z.object({
    message: z.string().describe('候选人当前消息'),
    conversationHistory: z.array(z.string())
      .default([])
      .describe('对话历史（最近 10 轮）'),
    stageGoals: z.record(
      FunnelStageSchema,
      z.object({
        primaryGoal: z.string(),
        successCriteria: z.array(z.string()),
        ctaStrategy: z.string(),
        disallowedActions: z.array(z.string()).optional(),
      })
    ).describe('阶段目标配置（从运营后台传入）'),
    modelConfig: z.object({
      classifyModel: z.string(),
      extractModel: z.string().optional(),
    }).optional(),
  }),

  execute: async ({
    message,
    conversationHistory,
    stageGoals,
    modelConfig,
  }) => {
    // 1. 获取品牌数据（HTTP 请求）
    const brandData = await fetchBrandData();

    // 2. 任务 A & B：并行执行（性能最优）
    const [fullPlan, extractionResult] = await Promise.all([
      // 任务 A：阶段规划（不需要 brandData）
      planTurn(message, {
        conversationHistory,
        modelConfig,
      }),

      // 任务 B：实体提取（需要 brandData）
      extractCandidateFacts(message, {
        conversationHistory,
        brandData,
        modelConfig,
      }),
    ]);

    // 3. 根据识别出的阶段，获取对应的目标配置
    const currentStageGoal = stageGoals[fullPlan.stage];

    // 合并结果
    return {
      planning: {
        stage: fullPlan.stage,
        needs: fullPlan.needs,
        riskFlags: fullPlan.riskFlags,
        confidence: fullPlan.confidence,
        reasoning: fullPlan.reasoningText,
        stageGoal: currentStageGoal,  // 添加阶段目标配置
      },
      extraction: {
        interview_info: extractionResult.interview_info,
        preferences: extractionResult.preferences,
        reasoning: extractionResult.reasoning,
      },
    };
  },
});
```

---

## 4. 数据流示例

### 4.1 场景：岗位咨询阶段

**输入**

```json
{
  "message": "你们肯德基浦东有门店吗，薪资怎么算",
  "conversationHistory": [
    "候选人: 你好，想找份兼职",
    "HR: 您好！我们有多个品牌在招聘，请问您对哪个品牌感兴趣呢？",
  ],
  "stageGoals": {
    "job_consultation": {
      "primaryGoal": "回答岗位问题并提升兴趣",
      "successCriteria": ["候选人对岗位保持兴趣"],
      "ctaStrategy": "先答核心问题，再给下一步建议",
      "disallowedActions": ["编造数字或政策"]
    },
    // ... 其他阶段
  }
}
```

**执行过程**

```
0. 获取品牌数据
   └─ HTTP 请求: GET /api/brands → [{ name: "肯德基", aliases: ["KFC", "开封菜"] }, ...]

1. 任务 A (planTurn)
   ├─ 规则层检测: /薪资|工资/ → needs: ['salary']
   ├─ 规则层检测: /门店|哪家店/ → needs: ['stores']
   ├─ 规则层检测: /位置|在哪/ → needs: ['location']
   └─ LLM 推理:
       - 识别阶段: job_consultation
       - 识别需求: ['salary', 'stores', 'location']
       - 风险标记: []
       - 置信度: 0.88
       - 推理: "候选人询问肯德基浦东门店和薪资，处于岗位咨询阶段"

2. 任务 B (extractCandidateFacts)
   ├─ 全面提取所有事实信息（与阶段无关）
   └─ LLM 推理:
       - interview_info: {}
       - preferences: {
           brands: ['肯德基'],
           cities: ['上海'],
           district: '浦东',
           salary: '想了解薪资'
         }
       - reasoning: "候选人明确提及肯德基品牌和浦东位置偏好，询问薪资情况"
```

**输出**

```json
{
  "planning": {
    "stage": "job_consultation",
    "needs": ["salary", "stores", "location"],
    "riskFlags": [],
    "confidence": 0.88,
    "reasoning": "候选人询问肯德基浦东门店和薪资，处于岗位咨询阶段",
    "stageGoal": {
      "primaryGoal": "回答岗位问题并提升兴趣",
      "successCriteria": ["候选人对岗位保持兴趣"],
      "ctaStrategy": "先答核心问题，再给下一步建议",
      "disallowedActions": ["编造数字或政策"]
    }
  },
  "extraction": {
    "interview_info": {},
    "preferences": {
      "brands": ["肯德基"],
      "cities": ["上海"],
      "district": "浦东",
      "salary": "想了解薪资"
    },
    "reasoning": "候选人明确提及肯德基品牌和浦东位置偏好，询问薪资情况"
  }
}
```

### 4.2 场景：面试安排阶段

**输入**

```json
{
  "message": "我叫张三，手机13800138000，明天下午2点可以去面试",
  "conversationHistory": [
    "候选人: 想去浦东那家店面试",
    "HR: 好的，请问您叫什么名字，方便留个联系方式吗？",
  ],
  "stageGoals": {
    "interview_scheduling": {
      "primaryGoal": "推动面试预约",
      "successCriteria": ["候选人给出可面试时间"],
      "ctaStrategy": "给出明确时间选项并确认"
    },
    // ...
  }
}
```

**输出**

```json
{
  "planning": {
    "stage": "interview_scheduling",
    "needs": ["interview", "availability"],
    "riskFlags": [],
    "confidence": 0.92,
    "reasoning": "候选人提供了姓名、电话和面试时间，处于面试安排阶段"
  },
  "extraction": {
    "interview_info": {
      "name": "张三",
      "phone": "13800138000",
      "interview_time": "明天下午2点"
    },
    "preferences": {
      "location": "浦东"
    },
    "reasoning": "候选人提供了完整的面试预约信息（姓名、电话、时间）"
  }
}
```

---

## 5. 关键设计要点

### 6.1 为什么分两个任务？

| 任务 | 职责 | LLM 调用 | 输出 |
|-----|------|---------|------|
| **planTurn** | 阶段识别、需求检测 | 1 次 | stage, needs, riskFlags |
| **extractCandidateFacts** | 实体提取 | 1 次 | interview_info, preferences |

**优势**：
1. **职责分离**：阶段规划和实体提取是不同的任务，分开更清晰
2. **可并行**：两个任务可以并行执行（Promise.all），提升性能
3. **可复用**：planTurn 可以单独用于不需要实体提取的场景
4. **易调试**：分开后可以单独测试和调优每个任务

### 6.2 为什么直接使用 planTurn 而不创建新函数？

**原因**：
- **减少重复代码**：`planTurn` 已包含完整的规则检测、LLM 推理、结果合并逻辑
- **保持一致性**：直接使用 planTurn，确保阶段识别逻辑一致
- **易于维护**：只需维护一套核心逻辑，bug 修复自动同步
- **轻量级封装**：在工具层解构需要的字段，代码更简洁

### 6.3 为什么工具层只返回部分字段？

**原因**：
- `subGoals` 在企微场景中价值有限，暂不需要
- `extractedInfo`（如 mentionedBrand, mentionedLocations）已经被 `CandidateFacts` 替代
- 简化输出，只关注核心信息（stage, needs, riskFlags, confidence, reasoning）

### 6.4 为什么事实提取与阶段无关？

**核心原则**：
- **事实是客观的**：候选人提到的信息（姓名、电话、品牌偏好等）是客观事实，与对话处于哪个阶段无关
- **全面提取**：不管在哪个阶段，只要对话中提到了信息，都应该提取出来
- **避免遗漏**：如果根据阶段选择性提取，可能会遗漏重要信息

**示例说明**：
```typescript
// 场景：在 trust_building 阶段，候选人主动说出了电话
候选人: "你好，我叫张三，电话13800138000，想找份工作"

// ❌ 错误：根据阶段选择性提取
// trust_building 阶段不提取 interview_info
{
  interview_info: {},  // 遗漏了姓名和电话！
  preferences: {}
}

// ✅ 正确：全面提取所有事实
{
  interview_info: {
    name: "张三",
    phone: "13800138000"
  },
  preferences: {}
}
```

### 6.5 并行执行的性能优势

由于事实提取与阶段无关，两个任务可以完全并行执行：

```typescript
const [planningResult, extractionResult] = await Promise.all([
  planTurn(...),             // 阶段规划
  extractCandidateFacts(...) // 事实提取
]);
```

**优势**：
- ✅ 响应时间更快（2次 LLM 调用并行，总时间≈单次调用时间）
- ✅ 无依赖关系（事实提取不需要等待阶段识别完成）
- ✅ 实现简洁（不需要条件判断或串行等待）

### 5.6 降级策略

| 场景 | 降级策略 | 返回值示例 |
|-----|---------|-----------|
| planTurn 失败 | 返回 stage='trust_building'，保留规则层 needs，confidence=0.35 | `{stage: 'trust_building', needs: ['salary'], riskFlags: [], confidence: 0.35, reasoning: 'LLM失败，使用规则降级'}` |
| extractCandidateFacts 失败 | 返回空对象 | `{interview_info: {}, preferences: {}, reasoning: '实体提取失败，使用空值降级'}` |
| 两者都失败 | 系统仍可用，只是置信度低 | 两个降级结果组合 |

---

## 6. 配置注入路径

### 6.1 企微场景（通过 API context 传入）

```typescript
// POST /api/v1/chat
{
  "messages": [...],
  "allowedTools": ["classify_intent"],
  "context": {
    "replyPolicy": {
      "stageGoals": {
        "trust_building": { ... },
        "job_consultation": { ... },
        // ... 共 6 个阶段
      }
    }
  }
}
```

### 6.2 本地开发场景（从 ConfigService 加载）

```typescript
// lib/tools/wework/classify_intent.tool.ts

import { configService } from '@/lib/services/config.service';

export const classifyIntentTool = tool({
  // ...
  execute: async (params) => {
    // 优先使用传入的 stageGoals，否则从 ConfigService 加载
    const stageGoals = params.stageGoals ||
      (await configService.getConfig()).stageGoals;

    // ...
  },
});
```

---

## 7. 测试用例

### 7.1 单元测试（planTurn - 阶段规划）

```typescript
describe('planTurn', () => {
  it('should classify job_consultation stage correctly', async () => {
    const result = await planTurn('你们薪资多少', {
      conversationHistory: [],
      stageGoals: MOCK_STAGE_GOALS,
    });

    expect(result.stage).toBe('job_consultation');
    expect(result.needs).toContain('salary');
  });

  it('should merge rule-based and LLM needs', async () => {
    const result = await planTurn('你们薪资多少，在哪上班', {
      conversationHistory: [],
      stageGoals: MOCK_STAGE_GOALS,
    });

    expect(result.needs).toContain('salary');
    expect(result.needs).toContain('location');
  });

  it('should fallback gracefully when LLM fails', async () => {
    // Mock LLM 失败
    jest.spyOn(safeGenerateObject).mockResolvedValue({ success: false });

    const result = await planTurn('你们薪资多少', {
      conversationHistory: [],
      stageGoals: MOCK_STAGE_GOALS,
    });

    expect(result.stage).toBe('trust_building');
    expect(result.confidence).toBeLessThan(0.5);
  });
});
```

### 7.2 单元测试（extractCandidateFacts）

```typescript
describe('extractCandidateFacts', () => {
  it('should extract all facts from conversation history', async () => {
    const result = await extractCandidateFacts('我是学生，周末可以上班', {
      conversationHistory: [
        '候选人: 我18岁，想找份兼职',
        'HR: 好的，您对哪个品牌感兴趣呢？',
        '候选人: 肯德基或者麦当劳都可以',
        'HR: 您方便在哪个区域工作呢？',
        '候选人: 浦东这边，时薪20以上',
      ],
    });

    // 应该累积提取所有历史信息（所有字段都是字符串）
    expect(result.interview_info.age).toBe('18');  // 字符串类型
    expect(result.interview_info.is_student).toBe('是');  // 中文文本
    expect(result.preferences.brands).toEqual(['肯德基', '麦当劳']);
    expect(result.preferences.district).toBe('浦东');
    expect(result.preferences.salary).toContain('20');
    expect(result.preferences.schedule).toBe('周末');
  });

  it('should extract both interview_info and preferences when mentioned', async () => {
    const result = await extractCandidateFacts(
      '我叫张三，手机13800138000，想找肯德基的工作',
      {
        conversationHistory: [],
      }
    );

    // 同时提取面试信息和意向信息
    expect(result.interview_info.name).toBe('张三');
    expect(result.interview_info.phone).toBe('13800138000');
    expect(result.preferences.brands).toContain('肯德基');
  });

  it('should return empty objects when extraction fails', async () => {
    jest.spyOn(safeGenerateObject).mockResolvedValue({ success: false });

    const result = await extractCandidateFacts('测试', {
      conversationHistory: [],
    });

    expect(result.interview_info).toEqual({});
    expect(result.preferences).toEqual({});
    expect(result.reasoning).toContain('失败');
  });

  it('should preserve user original words', async () => {
    const result = await extractCandidateFacts('想去KFC工作', {
      conversationHistory: [],
    });

    // 保留用户原话，不做映射
    expect(result.preferences.brands).toContain('KFC');
    // 不应该自动转换为"肯德基"
  });
});
```

### 7.3 集成测试（classifyIntentTool）

```typescript
describe('classifyIntentTool', () => {
  it('should return both planning and extraction results', async () => {
    // Mock fetchBrandData
    jest.spyOn(global, 'fetchBrandData').mockResolvedValue([
      { name: '肯德基', aliases: ['KFC', '开封菜'] },
      { name: '麦当劳', aliases: ["McDonald's", '金拱门'] },
    ]);

    const result = await classifyIntentTool.execute({
      message: '你们肯德基浦东有门店吗，薪资怎么算',
      conversationHistory: [],
      stageGoals: MOCK_STAGE_GOALS,
    });

    // 验证 planning 结果
    expect(result.planning.stage).toBe('job_consultation');
    expect(result.planning.needs).toContain('salary');
    expect(result.planning.needs).toContain('location');

    // 验证 extraction 结果
    expect(result.extraction.preferences.brands).toContain('肯德基');
    expect(result.extraction.preferences.district).toBe('浦东');
  });
});
```

---

## 8. 性能优化

### 8.1 并行执行

```typescript
// ❌ 串行执行（慢）
const planningResult = await planTurn(...);
const extractionResult = await extractCandidateFacts(...);

// ✅ 并行执行（快）
const [planningResult, extractionResult] = await Promise.all([
  planTurn(...),
  extractCandidateFacts(...),
]);
```

### 8.2 模型选择

```typescript
{
  modelConfig: {
    classifyModel: 'qwen-plus',      // 阶段识别用 qwen-plus
    extractModel: 'qwen-turbo',      // 实体提取用更便宜的 qwen-turbo
  }
}
```

### 8.3 缓存优化

```typescript
// 对于同一个 message + history，可以缓存结果
const cacheKey = hash({ message, conversationHistory });
const cached = cache.get(cacheKey);
if (cached) return cached;

const result = await classifyIntentTool.execute(...);
cache.set(cacheKey, result, { ttl: 60 }); // 缓存 60 秒
```

---

## 9. 监控指标

| 指标 | 目标值 | 监控方式 |
|-----|--------|---------|
| **响应时间** | < 2s (P95) | 记录总执行时间 |
| **planTurn 成功率** | > 95% | 统计 LLM 调用成功率 |
| **extractCandidateFacts 成功率** | > 90% | 统计 LLM 调用成功率 |
| **降级率** | < 5% | 统计使用 fallback 的比例 |
| **置信度分布** | 平均 > 0.7 | 记录 confidence 分布 |

---

## 10. 实现检查清单

### 10.1 类型定义

- [ ] `InterviewInfoSchema` (Zod schema)
- [ ] `PreferencesSchema` (Zod schema)
- [ ] `CandidateFactsSchema` (Zod schema)
- [ ] `ClassifyIntentOutput` 接口

### 10.2 核心函数

- [ ] 直接使用现有的 `planTurn()` - 阶段规划（在工具层解构字段）
- [ ] `fetchBrandData()` - 获取品牌数据（HTTP 请求）
- [ ] `extractCandidateFacts()` - 实体提取（需要 brandData 参数）
- [ ] `buildExtractionPrompt()` - 实体提取提示词（注入 brandData）

### 10.3 工具封装

- [ ] `classifyIntentTool` - Vercel AI SDK 工具定义
- [ ] 参数验证
- [ ] 结果合并逻辑
- [ ] 错误处理

### 10.4 测试

- [ ] `planTurn` 单元测试（验证现有测试覆盖阶段规划场景）
- [ ] `extractCandidateFacts` 单元测试（至少 5 个用例）
- [ ] `classifyIntentTool` 集成测试（至少 3 个场景）

### 10.5 文档

- [ ] 函数注释（JSDoc）
- [ ] 使用示例
- [ ] 配置说明
- [ ] 错误处理说明

---

## 11. 参考资料

- [企微 Agent 架构总览](./wecom-agent-architecture.md)
- [原 classify_intent 架构文档](./classify-intent-architecture.md)
- [现有 planTurn 实现](../lib/agents/classification-agent.ts)
- [Reply Policy 类型定义](../types/reply-policy.ts)

---

**文档版本**: v1.0
**创建日期**: 2025-01-XX
**维护者**: AI 架构团队
