# 企业微信智能回复 - 新架构设计

## 设计目标

2. **意图分类作为工具** - 每次请求都执行
3. **事实提取独立模块** - 提取结构化信息
4. **集成现有记忆系统** - 复用 CellularMemoryManager
5. **岗位数据工具更新** - 使用 `duliday_job_list_for_llm`

---

## 新架构设计

```
POST /api/v1/chat (企业微信消息)
           ↓
┌──────────────────────────────────────┐
│ 1. 意图分类工具 (每次必执行)          │
│    classify_intent                   │
│    - 识别生命周期阶段                 │
│    - 判断下一步动作                   │
│    - 提取关键事实                     │
└──────────────────────────────────────┘
           ↓
┌──────────────────────────────────────┐
│ 2. 记忆系统 (CellularMemoryManager)  │
│    - 短期记忆：对话历史               │
│    - 工作记忆：当前会话状态           │
│    - 长期记忆：提取的候选人事实       │
└──────────────────────────────────────┘
           ↓
┌──────────────────────────────────────┐
│ 3. LLM 选择工具执行                   │
│    └── duliday_job_list_for_llm      │
│        (渐进式数据返回)               │
└──────────────────────────────────────┘
           ↓
┌──────────────────────────────────────┐
│ 4. LLM 生成回复 (基于系统提示词)      │
│    - 无需单独的回复生成工具           │
│    - 系统提示词已包含沟通风格指南     │
└──────────────────────────────────────┘
```

---

## 新工具体系设计

### 工具清单（精简版）

| 工具名                     | 类型     | 执行时机   | 说明                               |
| -------------------------- | -------- | ---------- | ---------------------------------- |
| `classify_intent`          | 意图分类 | 每次必执行 | 识别阶段+提取事实                  |
| `duliday_job_list_for_llm` | 数据查询 | LLM决定    | 渐进式岗位查询，支持按需返回字段   |

**设计理念**：
- 只提供两个核心工具，职责清晰
- `classify_intent`：识别对话阶段 + 提取候选人事实
- `duliday_job_list_for_llm`：根据对话阶段和提取的事实，渐进式返回岗位数据

### duliday_job_list_for_llm 接口重新设计

#### 设计理念：渐进式数据返回

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

#### 新增入参设计

```typescript
const inputSchema = z.object({
  // ========== 筛选条件（原有）==========
  cityNameList: z.array(z.string()).optional().default([])
    .describe('城市列表，如 ["上海市", "北京市"]'),
  regionNameList: z.array(z.string()).optional().default([])
    .describe('区域列表，如 ["浦东新区", "静安区"]'),
  brandAliasList: z.array(z.string()).optional().default([])
    .describe('品牌别名列表，如 ["肯德基", "必胜客"]'),

  // ========== 筛选条件（新增）==========
  jobIdList: z.array(z.string()).optional()
    .describe('岗位ID列表，用于查询特定岗位'),
  storeNameList: z.array(z.string()).optional()
    .describe('门店名称列表，如 ["浦东陆家嘴店", "静安寺店"]'),
  jobCategoryList: z.array(z.string()).optional()
    .describe('岗位类型列表，如 ["服务员", "收银员", "厨师"]'),

  // ========== 排序（原有）==========
  sortField: z.enum(["create_time"]).optional()
    .describe('排序字段，目前支持 create_time'),
  sort: z.enum(["desc", "asc"]).optional()
    .describe('排序方式：desc 降序，asc 升序'),

  // ========== 渐进式披露：布尔开关控制 ==========
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

**字段对应关系**（与 API 返回结构一致）：

| 字段名             | API Schema            | 包含内容                                   |
| ------------------ | --------------------- | ------------------------------------------ |
| `basicInfo`        | `basicInfoSchema`     | 品牌、门店、岗位名、地址、工作内容等       |
| `jobSalary`        | `jobSalarySchema`     | 基本薪资、综合薪资、结算周期、节假日薪资等 |
| `welfare`          | `welfareSchema`       | 餐饮、住宿、交通、保险、晋升等福利         |
| `hiringRequirement`| `hiringRequirementSchema` | 性别、年龄、身高、学历、证书等要求     |
| `workTime`         | `workTimeSchema`      | 就业形式、每周工时、排班、班次等           |
| `interviewProcess` | `interviewProcessSchema` | 面试轮数、时间、地址、试工、培训等      |

#### 渐进式披露策略

| 场景               | 开启的布尔开关                                      | Token 消耗 |
| ------------------ | --------------------------------------------------- | ---------- |
| 初次接触/快速浏览  | `includeBasicInfo: true`（默认）                    | 极低       |
| 区域筛选/对比岗位  | `+ includeJobSalary: true`                          | 低         |
| 问薪资             | `+ includeJobSalary: true`                          | 低         |
| 问福利             | `+ includeWelfare: true`                            | 低         |
| 问招聘要求         | `+ includeHiringRequirement: true`                  | 低         |
| 问班次/工时        | `+ includeWorkTime: true`                           | 中         |
| 面试安排           | `+ includeInterviewProcess: true`                   | 中         |
| 需要完整信息       | 全部 6 个布尔开关设为 true                          | 高         |

#### 使用示例

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

#### 输出格式优化

根据开启的布尔开关返回不同格式：

```markdown
<!-- 仅 includeBasicInfo: true -->
# 在招岗位（共 15 个）
1. **肯德基 - 服务员** | 浦东陆家嘴店 | 陆家嘴环路1000号
2. **必胜客 - 收银员** | 静安寺店 | 南京西路1266号
...

<!-- includeBasicInfo + includeJobSalary -->
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

<!-- includeBasicInfo + includeWorkTime -->
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

### classify_intent 工具设计

#### 设计理念

```
┌─────────────────────────────────────────────────────────────┐
│ classify_intent 工具                                         │
│ ┌─────────────────┐  ┌─────────────────┐                    │
│ │ 1. 阶段识别      │  │ 2. 事实提取      │                    │
│ │ 当前处于哪个阶段 │  │ 从对话中提取信息 │                    │
│ └─────────────────┘  └─────────────────┘                    │
│              ↓                                               │
│         输出：阶段 + 事实                                     │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ LLM 自主决策（基于系统提示词）                                │
│ - 根据阶段和事实，自主决定是否调用工具                        │
│ - 根据阶段任务，生成符合阶段目标的回复                        │
└─────────────────────────────────────────────────────────────┘
```

**核心原则**：

- `classify_intent` 只负责 **识别阶段** + **提取事实**
- **不输出** `suggested_action`，工具选择由 LLM 根据系统提示词自主判断
- 保持工具职责单一，让 LLM 发挥推理能力

#### 生命周期阶段定义（完整6阶段，AI服务前3阶段）

| #   | 阶段         | 英文标识                | AI服务 | 核心任务                          |
| --- | ------------ | ----------------------- | ------ | --------------------------------- |
| 1   | 初次接触     | `initial_contact`       | ✅     | 自我介绍、询问来源/城市/区域/品牌 |
| 2   | 岗位咨询     | `job_consultation`      | ✅     | 介绍岗位/品牌/门店/薪资/班次/要求 |
| 3   | 面试安排     | `interview_arrangement` | ✅     | 确认意愿、收集信息、提交预约      |
| 4   | 面试提醒     | `interview_reminder`    | ❌     | 面试前提醒（系统自动）            |
| 5   | 面试结果跟进 | `interview_followup`    | ❌     | 面试结果确认（人工跟进）          |
| 6   | 签约入职     | `onboarding`            | ❌     | 签约流程（人工处理）              |

#### 岗位咨询阶段 - 子场景与工具调用

| 子场景       | 说明                 | 筛选条件                     | 开启的布尔开关               |
| ------------ | -------------------- | ---------------------------- | ---------------------------- |
| 地区岗位查询 | 咨询某地区是否有岗位 | cityNameList, regionNameList | `includeJobSalary`           |
| 品牌门店咨询 | 咨询意向品牌和门店   | brandAliasList, storeNameList| （仅 basicInfo）             |
| 岗位类型筛选 | 筛选特定岗位类型     | jobCategoryList              | `includeJobSalary`           |
| 班次信息咨询 | 咨询门店的班次信息   | 根据上下文筛选               | `includeWorkTime`            |
| 薪资咨询     | 咨询岗位薪资         | 根据上下文筛选               | `includeJobSalary`           |
| 福利咨询     | 咨询福利待遇         | 根据上下文筛选               | `includeWelfare`             |
| 岗位要求咨询 | 咨询年龄/学历等要求  | 根据上下文筛选               | `includeHiringRequirement`   |
| 面试安排     | 询问面试时间/地址    | jobIdList                    | `includeInterviewProcess`    |

```typescript
// 输入
interface ClassifyIntentInput {
  candidate_message: string; // 候选人最新消息
  conversation_history?: string[]; // 对话历史（可选）
}

// 输出（精简版）
interface ClassifyIntentOutput {
  // 生命周期阶段（3阶段）
  lifecycle_stage:
    | "initial_contact"
    | "job_consultation"
    | "interview_arrangement";

  // 提取的事实（累积型，从对话中提取）
  extracted_facts: CandidateFacts;

  // 分类依据（供调试）
  reasoning: string;
}

// 候选人事实（结构化，分两部分）
interface CandidateFacts {
  // ========== 面试信息（面试安排阶段收集）==========
  interview_info: {
    name?: string; // 姓名
    phone?: string; // 联系方式
    gender?: "男" | "女"; // 性别
    age?: number; // 年龄
    applied_store?: string; // 应聘门店
    applied_position?: string; // 应聘岗位
    interview_time?: string; // 面试时间
    is_student?: boolean; // 是否是学生
  };

  // ========== 意向信息（岗位咨询阶段收集）==========
  preferences: {
    brands?: string[]; // 意向品牌（可多选）
    salary?: string; // 意向薪资
    position?: string; // 意向岗位
    schedule?: string; // 意向班次
    cities?: string[]; // 意向城市（可多选）
    district?: string; // 意向区域
    location?: string; // 意向地点/商圈
  };
}
```

#### 阶段判断规则

```
判断当前阶段的依据：

1. 初次接触 → 岗位咨询
   触发条件：已获取城市/区域信息，候选人开始询问具体岗位

2. 岗位咨询 → 面试安排
   触发条件：候选人明确表达面试意愿，或已确认具体岗位

注意：
- 阶段可以跳跃（如候选人直接说"我要面试XX门店"）
- 阶段可以回退（如面试安排中又问其他岗位问题）
- 学生身份仅在面试安排阶段才确认，不提前询问
```

#### LLM 自主决策（系统提示词指导）

系统提示词中已包含各阶段的工具调用指导：

```markdown
## 岗位咨询阶段 - 必须调用工具的问题

对以下问题必须先调工具查真实数据：

- 工资/时薪/绩效/补贴/结算方式
- 上班时间/排班/是否需要加班/休息天数
- 岗位职责/工作内容/是否要推销/是否站岗/是否端盘子等
- 年龄要求/是否招学生/是否需要社保或商业保险/全职兼职区别
```

**工具调用由 LLM 根据：**

1. 当前阶段（由 `classify_intent` 输出）
2. 候选人问题类型
3. 系统提示词指导

自主决定是否调用 `duliday_job_list_for_llm` 工具，传入合适的筛选条件和布尔开关。

---

## duliday_job_list_for_llm 调用设计（详细）

### 调用决策流程

```
用户消息
    ↓
classify_intent（每次必调）
    ↓
输出：lifecycle_stage + extracted_facts
    ↓
┌─────────────────────────────────────────────────────────────────┐
│ LLM 判断是否需要调用 duliday_job_list_for_llm                     │
├─────────────────────────────────────────────────────────────────┤
│ ✅ 需要调用的情况：                                               │
│   - 用户询问岗位列表（"有什么岗位"、"浦东有吗"）                   │
│   - 用户询问具体信息但上下文无相关数据（"工资多少"但之前没查过）   │
│   - 用户切换筛选条件（从"浦东"改问"静安"）                        │
│   - 用户询问不同维度（之前只问了薪资，现在问班次）                 │
├─────────────────────────────────────────────────────────────────┤
│ ❌ 不需要调用的情况：                                             │
│   - 初次接触阶段的寒暄（"你好"、"在吗"）                          │
│   - 上下文已有完整信息可直接回答                                  │
│   - 用户在确认/表达意愿（"好的"、"我考虑一下"）                   │
│   - 面试安排阶段收集候选人信息（"你叫什么名字"）                  │
└─────────────────────────────────────────────────────────────────┘
    ↓
如果需要调用：构造参数
    ↓
┌─────────────────────────────────────────────────────────────────┐
│ 参数来源：                                                        │
│ 1. 筛选条件 ← classify_intent.extracted_facts.preferences        │
│ 2. 布尔开关 ← 用户问题类型                                        │
└─────────────────────────────────────────────────────────────────┘
```

### 参数映射规则

**筛选条件映射**（classify_intent facts → 工具参数）：

| classify_intent 输出字段        | 映射到工具参数    | 说明                     |
| ------------------------------- | ----------------- | ------------------------ |
| `preferences.cities`            | `cityNameList`    | 意向城市                 |
| `preferences.district`          | `regionNameList`  | 意向区域（需规范化）     |
| `preferences.brands`            | `brandAliasList`  | 意向品牌                 |
| `preferences.position`          | `jobCategoryList` | 意向岗位类型             |
| `preferences.location`          | `storeNameList`   | 意向地点/商圈（模糊匹配）|
| `interview_info.applied_store`  | `storeNameList`   | 应聘门店                 |
| 上下文中的 jobId                | `jobIdList`       | 特定岗位查询             |

**布尔开关选择规则**：

| 用户问题类型                 | 开启的布尔开关                              |
| ---------------------------- | ------------------------------------------- |
| 询问岗位列表                 | `includeBasicInfo`（默认）                  |
| 询问岗位+想对比              | `includeBasicInfo` + `includeJobSalary`     |
| 询问薪资/工资/时薪           | `includeJobSalary`                          |
| 询问福利/餐补/住宿           | `includeWelfare`                            |
| 询问要求/年龄/学历           | `includeHiringRequirement`                  |
| 询问班次/工时/上班时间       | `includeWorkTime`                           |
| 询问面试/预约/怎么面试       | `includeInterviewProcess`                   |
| 询问多个维度                 | 对应多个开关同时开启                        |

### 调用场景示例

```typescript
// 场景1：用户说"你好" → 不调用
// classify_intent: { lifecycle_stage: "initial_contact", facts: {} }
// LLM 直接回复自我介绍

// 场景2：用户说"有什么岗位" → 调用
// classify_intent: { lifecycle_stage: "job_consultation", facts: {} }
// 调用参数：{ includeBasicInfo: true }

// 场景3：用户说"浦东有吗" → 调用
// classify_intent: {
//   lifecycle_stage: "job_consultation",
//   facts: { preferences: { district: "浦东" } }
// }
// 调用参数：{ regionNameList: ["浦东新区"], includeJobSalary: true }

// 场景4：用户说"工资多少"（上下文已有岗位列表）→ 调用
// 如果之前只返回了 basicInfo，现在需要 jobSalary
// 调用参数：{
//   regionNameList: ["浦东新区"],  // 保持之前的筛选条件
//   includeJobSalary: true
// }

// 场景5：用户说"第一个岗位班次是什么" → 调用
// 需要根据上下文找到第一个岗位的 jobId
// 调用参数：{
//   jobIdList: ["从上下文获取的jobId"],
//   includeWorkTime: true
// }

// 场景6：用户说"好的我考虑一下" → 不调用
// LLM 直接回复鼓励性话语
```

### API 改造需求说明

**前端改造**（布尔开关 - 无需后端支持）：
- 6 个布尔开关是前端格式化层面的控制
- API 返回完整数据，前端根据开关选择性格式化输出
- **不需要后端改造**

**后端改造需求**（新增筛选条件）：

| 参数            | 当前状态   | 需求说明                           |
| --------------- | ---------- | ---------------------------------- |
| `cityNameList`  | ✅ 已支持  | -                                  |
| `regionNameList`| ✅ 已支持  | -                                  |
| `brandAliasList`| ✅ 已支持  | -                                  |
| `sortField`     | ✅ 已支持  | -                                  |
| `sort`          | ✅ 已支持  | -                                  |
| `jobIdList`     | ✅ 已支持  | 按岗位ID精确查询，面试安排阶段需要 |
| `storeNameList` | ✅ 已支持  | 按门店名模糊查询                   |
| `jobCategoryList`| ✅ 已支持 | 按岗位类型筛选                     |

### 上下文复用策略

**问题**：避免重复调用相同查询

**策略**：
1. LLM 需要记住上一轮调用的结果
2. 如果用户追问同一批岗位的不同维度，复用筛选条件，只切换布尔开关
3. 如果用户切换筛选条件（问别的区域/品牌），重新调用

**系统提示词指导**：
```markdown
## 工具调用原则

1. 如果上下文已有足够信息回答用户问题，不要重复调用工具
2. 如果用户追问同一批岗位的不同维度（如先问薪资再问班次），保持相同的筛选条件，只调整布尔开关
3. 如果用户切换了地区/品牌/岗位类型，需要重新调用
4. 每次调用工具后，记住返回的 jobId，用于后续精确查询
```

---

## 设计决策（已确认）

| 决策项           | 选择                            | 说明                                           |
| ---------------- | ------------------------------- | ---------------------------------------------- |
| 意图分类执行方式 | 系统提示词强制调用              | 作为工具，在提示词中要求每次必须调用           |
| 事实提取         | 合并到意图分类                  | `classify_intent` 同时输出意图和提取的事实     |
| 记忆方式         | **无状态设计**                  | 每次请求从 conversation_history 重建记忆       |
| 工具注册表       | **只添加新工具**                | 不改动原有配置，不移除任何工具                 |
| promptType       | **不新建**                      | 使用 allowedTools 指定工具，系统提示词单独传入 |
| 岗位数据工具     | 添加 `duliday_job_list_for_llm` | 作为新工具添加，不替代原有工具                 |

---

## 实现计划

### 第一阶段：创建 classify_intent 工具

**目标**：创建一个意图分类工具，合并事实提取功能

**文件**：`lib/tools/wecom/classify-intent-tool.ts`（新建）

**核心功能**：

1. 识别候选人当前生命周期阶段（完整6阶段，AI服务前3阶段）
2. 判断阶段内具体意图
3. 提取并累积候选人事实信息
4. 推荐下一步动作

**Zod Schema 定义**：

```typescript
// lib/tools/wecom/classify-intent-schemas.ts

import { z } from "zod/v3";

// 生命周期阶段（5个阶段）
export const LifecycleStageSchema = z.enum([
  "initial_contact",       // 初次接触
  "exploring_needs",       // 了解需求
  "job_consulting",        // 岗位咨询
  "interview_scheduling",  // 面试安排
  "follow_up",             // 后续跟进
]);

// 面试信息（面试安排阶段收集）
export const InterviewInfoSchema = z.object({
  name: z.string().optional(), // 姓名
  phone: z.string().optional(), // 联系方式
  gender: z.enum(["male", "female"]).optional(), // 性别
  age: z.number().optional(), // 年龄
  applied_store: z.string().optional(), // 应聘门店
  applied_position: z.string().optional(), // 应聘岗位
  interview_time: z.string().optional(), // 面试时间
  is_student: z.boolean().optional(), // 是否是学生
});

// 意向信息（岗位咨询阶段收集）
export const PreferencesSchema = z.object({
  brands: z.array(z.string()).optional(), // 意向品牌（可多选）
  salary: z.string().optional(), // 意向薪资
  position: z.string().optional(), // 意向岗位
  schedule: z.string().optional(), // 意向班次
  cities: z.array(z.string()).optional(), // 意向城市（可多选）
  district: z.string().optional(), // 意向区域
  location: z.string().optional(), // 意向地点/商圈
});

// 候选人事实（结构化，分两部分）
export const CandidateFactsSchema = z.object({
  interview_info: InterviewInfoSchema, // 面试信息
  preferences: PreferencesSchema, // 意向信息
});

// 完整输出（精简版 - 无 suggested_action）
export const ClassifyIntentOutputSchema = z.object({
  lifecycle_stage: LifecycleStageSchema,
  extracted_facts: CandidateFactsSchema,
  reasoning: z.string(),
});

// 类型导出
export type LifecycleStage = z.infer<typeof LifecycleStageSchema>;
export type InterviewInfo = z.infer<typeof InterviewInfoSchema>;
export type Preferences = z.infer<typeof PreferencesSchema>;
export type CandidateFacts = z.infer<typeof CandidateFactsSchema>;
export type ClassifyIntentOutput = z.infer<typeof ClassifyIntentOutputSchema>;
```

**实现方式**：使用 `safeGenerateObject` (tool-based pattern)

**分类提示词要点**：

1. 根据对话历史判断当前阶段
2. 从最新消息提取新事实，与历史事实合并
3. 学生身份仅在面试安排阶段才判断
4. 阶段可跳跃（候选人直接说要面试）
5. 阶段可回退（面试安排中又问其他岗位）

**工具调用决策**：

- 由 LLM 根据阶段 + 事实 + 系统提示词自主判断
- 不在 classify_intent 输出中指定

### 第二阶段：更新 duliday_job_list_for_llm 工具

**文件**：`lib/tools/duliday/duliday-job-list-for-llm-tool.ts`

**改动**：

1. **扩展 inputSchema**：
   - 新增筛选条件：`jobIdList`、`storeNameList`、`jobCategoryList`
   - 新增 6 个布尔开关：`includeBasicInfo`、`includeJobSalary`、`includeWelfare`、`includeHiringRequirement`、`includeWorkTime`、`includeInterviewProcess`

2. **重构格式化逻辑**：
   - 保留现有的 5 个格式化函数（已按字段拆分）
   - 新增 `formatBasicInfo()` 函数
   - 新增 `formatJobByFlags()` 函数，根据布尔开关选择性调用

3. **格式化函数调用**：
   ```typescript
   function formatJobByFlags(job: AIJobItem, flags: IncludeFlags): string {
     let md = "";
     if (flags.includeBasicInfo) md += formatBasicInfo(job);
     if (flags.includeJobSalary) md += formatSalaryInfo(job);
     if (flags.includeWelfare) md += formatWelfareInfo(job);
     if (flags.includeHiringRequirement) md += formatRequirements(job);
     if (flags.includeWorkTime) md += formatWorkTime(job);
     if (flags.includeInterviewProcess) md += formatInterviewInfo(job);
     return md;
   }
   ```

4. **新增 formatBasicInfo() 函数**：
   - 从现有 `formatJobToMarkdown()` 中提取基本信息部分
   - 输出：品牌、门店、地址、岗位类型、工作内容等

### 第三阶段：更新工具注册表

**文件**：`lib/tools/tool-registry.ts`

**改动**（只添加，不修改）：

1. 添加 `classify_intent` 工具

### 第四阶段：记忆系统集成（简化设计）

> **本期范围**：仅实现会话层记忆，完整三层架构设计见 [wecom-memory-architecture.md](./wecom-memory-architecture.md)

**记忆架构总览**：

```
┌─────────────────────────────────────────────────────────────┐
│                   智能客服 Agent 记忆架构                    │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────┐  ┌───────────────┐  ┌─────────────────┐ │
│  │  会话层记忆    │  │  用户层记忆    │  │     知识库      │ │
│  │  ✅ 本期实现   │  │  ⏳ 后期实现   │  │  ⚠️ 部分实现    │ │
│  └───────────────┘  └───────────────┘  └─────────────────┘ │
│         │                  │                   │           │
│         ▼                  ▼                   ▼           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              记忆融合层（⏳ 后期实现）                │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**本期实现范围**：

| 层级 | 状态 | 说明 |
|------|------|------|
| 会话层记忆 | ✅ 实现 | 对话历史管理、Token 优化、槽位状态 |
| 用户层记忆 | ⏳ 后期 | 跨会话用户画像、历史偏好 |
| 知识库 | ⚠️ 部分 | 岗位信息（duliday API）已有，FAQ/政策后期 |
| 记忆融合层 | ⏳ 后期 | 三层记忆合并注入 |

**核心思路**：

1. 每次请求从 `messages` 重建记忆，请求结束后不保存状态
2. **事实提取由 `classify_intent` 工具负责**，不再使用 `SmartExtractor`
3. 保留 `CellularMemoryManager` 的核心能力（对话历史管理、Token 预算优化）

**设计变更说明**：

| 组件 | 原设计 | 新设计 |
|------|--------|--------|
| 事实提取 | SmartExtractor（规则引擎） | classify_intent（LLM 工具） |
| 品牌/位置映射 | 前端字典匹配 | 透传给后端 API 处理 |
| 对话历史管理 | CellularMemoryManager | 保留（用于 Token 优化） |

**变更理由**：

- 前端不再维护品牌/位置别名字典，由后端 API 统一处理映射
- LLM 比规则引擎更擅长理解自然语言（如错别字、口语表达）
- 减少前后端重复维护，单一事实来源

```
请求流程（简化版）：
───────────────────────────────────────
POST /api/v1/chat
{
  messages: [...完整对话历史...],
  systemPrompt: "企微招聘经理系统提示词",
  allowedTools: ["classify_intent", "duliday_job_list_for_llm"]
}
      ↓
1. 创建 SimplifiedMemoryManager 实例（请求级）
      ↓
2. 从 messages 加载对话历史
   memoryManager.loadConversationHistory(messages)
      ↓
3. 获取优化后的对话上下文（Token 预算控制）
   const optimizedHistory = memoryManager.getOptimizedHistory()
      ↓
4. LLM 接收优化后的历史 + 系统提示词
      ↓
5. LLM 调用 classify_intent → 输出 extracted_facts
   （事实提取由 LLM 完成，不再使用 SmartExtractor）
      ↓
6. LLM 根据 extracted_facts 决定是否调用 duliday_job_list_for_llm
   （透传用户原话，后端 API 负责别名映射）
      ↓
7. 返回响应（不保存状态，下次请求重新构建）
```

**复用现有文件**（简化使用）：

- `lib/prompt-engineering/memory/cellular-memory-manager.ts` — 仅使用对话历史管理和 Token 优化功能
- ~~`lib/prompt-engineering/memory/smart-patterns.ts`~~ — **不再使用**

**新建辅助函数**：

```typescript
// lib/tools/wecom/utils/memory-utils.ts

import { CellularMemoryManager } from "@/lib/prompt-engineering/memory/cellular-memory-manager";
import type { UIMessage } from "ai";

/**
 * 简化的记忆管理器
 *
 * 职责：
 * 1. 对话历史管理
 * 2. Token 预算优化
 *
 * 不再负责：
 * - 事实提取（由 classify_intent 工具完成）
 * - 品牌/位置映射（由后端 API 完成）
 */
export class SimplifiedMemoryManager {
  private memoryManager: CellularMemoryManager;

  constructor() {
    this.memoryManager = new CellularMemoryManager();
  }

  /**
   * 从 UIMessage 数组加载对话历史
   */
  loadFromMessages(messages: UIMessage[]): void {
    const history = messages
      .filter(m => m.role === "user" || m.role === "assistant")
      .map(m => {
        const content = typeof m.content === "string"
          ? m.content
          : JSON.stringify(m.content);
        return `${m.role === "user" ? "用户" : "助手"}: ${content}`;
      });

    this.memoryManager.loadConversationHistory(history);
  }

  /**
   * 获取优化后的对话历史（根据 Token 预算裁剪）
   */
  getOptimizedHistory(tokenBudget?: number): string[] {
    const context = this.memoryManager.getOptimizedContext(tokenBudget);
    return context.recent;
  }

  /**
   * 获取记忆统计信息（用于调试）
   */
  getStats() {
    return this.memoryManager.getMemoryStats();
  }
}

/**
 * 格式化对话历史为系统提示词片段
 */
export function formatHistoryContext(history: string[]): string {
  if (history.length === 0) return "";

  return `\n\n## 对话历史摘要\n${history.slice(-5).join("\n")}\n`;
}
```

### 第五阶段：系统提示词处理

**不新建文件**，系统提示词由调用方传入

**Chat API 处理**：

1. 接收 `systemPrompt` 参数
2. 注入动态变量（当前时间）
3. 可选：注入优化后的对话历史摘要（长对话场景）
4. 传递给 LLM

**注意**：事实提取不再在此阶段进行，由 LLM 调用 `classify_intent` 工具完成

---

## 关键文件清单

### 目录结构

```
lib/tools/wecom/
├── classify-intent/
│   ├── classify-intent-tool.ts      # 意图分类工具
│   ├── classify-intent-schemas.ts   # Zod Schema 定义
│   └── classify-intent-prompt.ts    # 分类提示词
├── job-query/
│   ├── job-query-tool.ts            # 岗位查询工具（封装 duliday API）
│   ├── job-query-formatters.ts      # 格式化函数（按字段拆分）
│   └── job-query-schemas.ts         # 入参/出参 Schema
├── utils/
│   └── memory-utils.ts              # 记忆辅助函数
└── index.ts                         # 统一导出
```

### 文件清单

| 操作 | 文件路径                                                   | 说明                         |
| ---- | ---------------------------------------------------------- | ---------------------------- |
| 新建 | `lib/tools/wecom/classify-intent/classify-intent-tool.ts`  | 意图分类+事实提取工具        |
| 新建 | `lib/tools/wecom/classify-intent/classify-intent-schemas.ts`| Zod Schema 定义             |
| 新建 | `lib/tools/wecom/classify-intent/classify-intent-prompt.ts`| 分类提示词                   |
| 新建 | `lib/tools/wecom/job-query/job-query-tool.ts`              | 岗位查询工具                 |
| 新建 | `lib/tools/wecom/job-query/job-query-formatters.ts`        | 格式化函数                   |
| 新建 | `lib/tools/wecom/job-query/job-query-schemas.ts`           | 入参/出参 Schema             |
| 新建 | `lib/tools/wecom/utils/memory-utils.ts`                    | 简化的记忆辅助函数           |
| 新建 | `lib/tools/wecom/index.ts`                                 | 统一导出                     |
| 修改 | `lib/tools/tool-registry.ts`                               | 注册新工具                   |
| 复用 | `lib/prompt-engineering/memory/cellular-memory-manager.ts` | 记忆管理器（仅用 Token 优化）|
| ~~复用~~ | ~~`lib/prompt-engineering/memory/smart-patterns.ts`~~  | ~~智能提取器~~ **不再使用**  |
| 复用 | `lib/tools/duliday/ai-job-types.ts`                        | 岗位数据类型定义             |

---

## 验证方式

1. **单元测试**：`classify_intent` 工具的分类准确性
2. **集成测试**：完整对话流程（初次接触 → 岗位咨询 → 面试安排）
3. **手动测试**：通过 `/test-llm-reply` 页面测试
