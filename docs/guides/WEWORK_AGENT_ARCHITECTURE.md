# 企微智能 Agent 架构设计

> 如何用一个 API 端点，撑起一整套私域招聘运营 Agent？

---

## 1. 架构总览

```
                        ┌─────────────────┐
                        │     企微平台      │
                        │  （外部调用方）    │
                        └────────┬────────┘
                                 │
                          POST /api/v1/chat
                    promptType: "weworkSystemPrompt"
                                 │
                                 ▼
  ┌──────────────────────────────────────────────────────────┐
  │                                                          │
  │                    路由编排层 (Orchestrator)                │
  │            app/api/v1/chat/route.ts                       │
  │                                                          │
  │     校验 → 标准化 → 预处理 → 工具构建 → LLM → 后处理       │
  │                                                          │
  └───────┬──────────┬───────────┬──────────┬────────────────┘
          │          │           │          │
          ▼          ▼           ▼          ▼
     ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
     │ 预处理  │ │ 工具集  │ │ 模型层  │ │ 记忆层  │
     │  器层   │ │        │ │        │ │        │
     │        │ │ 回合规划 │ │ 3 模型  │ │ 事实   │
     │ 插件式  │ │ 岗位推荐 │ │ 协作调度 │ │ 累积   │
     └────────┘ └────────┘ └────────┘ └────────┘
```

一句话概括：**路由层是指挥官，不做业务判断；业务智能分散在预处理器、工具、记忆三个可插拔模块中。**

---

## 2. 设计哲学：三个核心原则

### 原则一：确定性优先，LLM 兜底

> "能用规则解决的，绝不交给概率。"

以回合规划（`wework_plan_turn`）为例：

```
用户消息: "工资多少？"

第 1 层 — 正则规则 (detectRuleNeeds):
  命中关键词 "工资" → 确定性标记 needs = [salary]
  ✅ 零延迟，不漏检

第 2 层 — LLM 补充 (safeGenerateObject):
  分析上下文 → 判断 stage = job_consultation
  可能追加 needs = [schedule]（用户之前也问过排班）

合并策略 (sanitizePlan):
  规则标记的 needs 不可被 LLM 覆盖，只能追加
```

用户问了薪资，系统必须 100% 识别到——这不是"大概率能识别"就够的场景。规则层保证下限，LLM 提升上限。

### 原则二：场景隔离，零耦合扩展

> "加一个新场景，不应该改一行路由代码。"

```
                   路由层 (route.ts)
                       │
          promptType 分发（纯查表）
           ┌───────────┼───────────┐
           ▼           ▼           ▼
      企微预处理    Boss预处理    未来：抖音？
     (自注册插件)  (自注册插件)   (新建文件即可)
```

新增场景只需 3 步：

1. 新建 `lib/preprocessors/xxx-preprocessor.ts`，调用 `registerPreprocessor("xxx", handler)` — import 即注册
2. 在 `tool-registry.ts` 的 `PROMPT_TOOL_MAPPING` 配置工具映射
3. 调用时传 `promptType: "xxx"`

**路由层零改动。**

### 原则三：记忆是 Agent 的灵魂

> "没有记忆的 Agent，每一轮都是陌生人。"

候选人说过的信息不应该反复追问。Agent 需要跨轮次记住：

- **你是谁** — 姓名、电话、性别、年龄、是否学生、学历、健康证
- **你想要什么** — 意向城市/区域、期望薪资、岗位偏好、用工形式
- **上次推荐了什么** — 避免重复推荐

这就是记忆系统要解决的核心问题。

---

## 3. 核心组件

### 3.1 路由编排层（Orchestrator）

`app/api/v1/chat/route.ts` — 唯一入口，纯编排不做业务判断。

| 步骤 | 动作 | 实现位置 |
|------|------|----------|
| ① 校验 | 请求体 Zod 校验 + 模型白名单检查 | `OpenChatRequestSchema` / `validateModel()` |
| ② 标准化 | `{role, content}` → AI SDK v6 `UIMessage` 格式 | `normalizeMessages()` |
| ③ 预处理 | 按 `promptType` 分发到预处理器 | `runPreprocessor()` |
| ④ 工具构建 | 查映射表 + `allowedTools`，工厂创建 | `buildToolSet()` |
| ⑤ 系统提示词组装 | 基础提示词 + 预处理器 suffix（记忆） | `context.systemPrompts[promptType]` + suffix |
| ⑥ LLM 调用 | `streamText()` / `generateText()`，最大 30 步 | AI SDK v6 |
| ⑦ 后处理 | 异步触发事实提取 | `preprocessorResult.afterResponse()` |

### 3.2 预处理器层

`lib/preprocessors/registry.ts` — 插件式注册表。

```typescript
interface PreprocessorResult {
  systemPromptSuffix: string;                   // 追加到系统提示词（记忆段落）
  onJobsFetched?: (jobs: unknown[]) => void;    // 岗位查询结果回调
  afterResponse?: () => void;                   // LLM 响应后异步后处理
}
```

**企微预处理器** (`lib/preprocessors/wework-preprocessor.ts`) 职责：

```
时序：读缓存 → [冷启动? 同步提取] → 格式化记忆 → 返回 → （LLM 后）异步提取事实

① 创建 WeworkSessionMemory(userId, sessionId)
② 从 localCacheService 加载上一轮缓存的 facts + lastRecommendedJobs
③ 冷启动检测：历史消息 > 2 条但 facts 为空 → 同步 extractAndSaveFacts()
④ formatSessionMemoryForPrompt(state) → systemPromptSuffix
⑤ 注册 onJobsFetched 回调（推荐结果写入记忆）
⑥ 注册 afterResponse 回调（异步提取新事实，下一轮生效）
```

### 3.3 多模型协作 — "三个角色，各司其职"

一次用户消息的处理，最多调度 3 个模型：

```
┌─────────────────────────────────────────────────┐
│               一次请求的模型调度                     │
│                                                   │
│   extractModel        classifyModel    chatModel  │
│   (gpt-5-mini)        (gpt-5-mini)    (claude)   │
│       │                    │               │      │
│   提取候选人事实        规划回合策略       生成最终回复  │
│   "他叫张三,想去上海"   "当前在岗位咨询阶段"  "您好张三…" │
│                                                   │
│   成本: ~$0.001        成本: ~$0.001    成本: ~$0.01│
│                                                   │
│   时序: ①(异步后处理) ──→ ②(工具调用) ──→ ③(主流程)  │
└─────────────────────────────────────────────────┘
```

- 提取和分类是**结构化任务**，小模型足够且便宜 10 倍
- 对话生成需要**语言质量**，用高质量模型保证体验
- 三个模型可各自独立升级，通过 `ModelConfig` 动态配置

### 3.4 工具层

`lib/tools/tool-registry.ts` — 中央注册表，工厂模式创建。

**企微场景工具映射** (`PROMPT_TOOL_MAPPING["weworkSystemPrompt"]`)：

```
["wework_plan_turn", "duliday_job_list_for_llm"]
```

仅两个工具。事实提取已从工具迁移到预处理器（确定性触发，不占工具位）。

#### 3.4.1 wework_plan_turn — 回合规划

`lib/tools/wework/plan_turn.tool.ts` + `lib/agents/classification-agent.ts`

```
┌─────────────────────────────────────────────────────┐
│                  wework_plan_turn                     │
├─────────────────────────────────────────────────────┤
│ 输入：z.object({})（空 schema，对话历史通过工厂闭包注入）│
│                                                       │
│ 内部流程：                                             │
│   ① detectRuleNeeds() — 9 条正则规则检测 needs          │
│   ② safeGenerateObject() — classifyModel LLM 分析      │
│   ③ sanitizePlan() — 规则 needs 不可被 LLM 覆盖        │
│   ④ 查 stageGoals[stage] — 获取当前阶段运营策略         │
│                                                       │
│ 输出：WeworkPlanTurnOutput                             │
│   {                                                   │
│     stage:     "job_consultation"                     │
│     needs:     ["salary", "location"]                 │
│     riskFlags: ["insurance_promise_risk"]             │
│     confidence: 0.85                                  │
│     reasoning: "用户询问了薪资和门店位置..."            │
│     stageGoal: { primaryGoal, ctaStrategy, ... }     │
│   }                                                   │
│                                                       │
│ 降级：LLM 失败 → 退回 trust_building + 纯规则 needs    │
└─────────────────────────────────────────────────────┘
```

9 条规则覆盖的 needs：

| 关键词模式 | 触发 need |
|-----------|-----------|
| 薪资/工资/时薪/底薪/提成/奖金/补贴/收入 | `salary` |
| 排班/班次/几点/上班/下班/工时/周末 | `schedule` |
| 五险一金/社保/保险/合同/考勤/试用期 | `policy` |
| 还有名额/空位/什么时候能上/明天能面 | `availability` |
| 在哪/位置/地址/附近/地铁/门店/哪个区 | `location` |
| 门店/哪家店/哪些店/有店吗 | `stores` |
| 要求/条件/年龄/经验/学历/健康证 | `requirements` |
| 面试/到店/约时间/约面 | `interview` |
| 微信/vx/私聊/联系方式/加你 | `wechat` |

#### 3.4.2 duliday_job_list_for_llm — 岗位查询

`lib/tools/duliday-job-list-for-llm.tool.ts`

```
┌─────────────────────────────────────────────────────┐
│              duliday_job_list_for_llm                 │
├─────────────────────────────────────────────────────┤
│ 输入参数：                                             │
│   city, region, brand, store, jobCategory, jobId     │
│   outputFormat: "toon" | "markdown" | "rawData"      │
│   6 个 boolean 控制返回内容段（渐进式披露）              │
│                                                       │
│ 特点：                                                │
│   - 透传用户原话，后端 API 负责模糊匹配                 │
│   - 门店名精确匹配失败时自动降级为模糊匹配回退           │
│   - toon 格式节省 ~40% token                          │
│   - onJobsFetched 回调 → 推荐结果写入会话记忆           │
│                                                       │
│ 输出：格式化的岗位列表（markdown/toon/rawData）         │
└─────────────────────────────────────────────────────┘
```

#### 3.4.3 duliday_interview_booking — 面试预约

`lib/tools/duliday/duliday-interview-booking-tool.ts`

```
┌─────────────────────────────────────────────────────┐
│              duliday_interview_booking                │
├─────────────────────────────────────────────────────┤
│ 输入：name, phone, age, genderId, jobId,             │
│       interviewTime, education, hasHealthCertificate │
│ 输出：预约结果                                        │
│ 状态：✅ 已实现，注册在全局 tool-registry              │
│ 备注：当前未加入企微场景工具映射，后续按需启用           │
└─────────────────────────────────────────────────────┘
```

### 3.5 记忆层

#### 3.5.1 会话记忆 — WeworkSessionMemory

`lib/memory/wework/session-memory.ts`

```
┌─────────────────────────────────────────────────────┐
│              WeworkSessionMemory                      │
├─────────────────────────────────────────────────────┤
│                                                       │
│  缓存键:   wework_session:{userId}:{sessionId}        │
│  TTL:      24 小时                                    │
│  存储后端: localCacheService（进程内 Map，可替换 Redis） │
│  并发控制: 串行写锁（writeLock），防止并发覆盖           │
│                                                       │
│  WeworkSessionState {                                 │
│    facts: EntityExtractionResult | null               │
│    lastRecommendedJobs: RecommendedJobSummary[] | null│
│  }                                                    │
│                                                       │
│  读/写方式:                                            │
│    facts → 预处理器写入（extractAndSaveFacts）          │
│    lastRecommendedJobs → 岗位工具通过 onJobsFetched 写入│
│    读取 → 预处理器 load() → formatSessionMemoryForPrompt│
│                                                       │
└─────────────────────────────────────────────────────┘
```

格式化为系统提示词后的样子：

```
[会话记忆 — 使用指引]

## 候选人已知信息
- 姓名: 张三
- 联系方式: 13800138000
- 是否学生: 是
- 学历: 本科在读
- 意向城市: 上海
- 意向品牌: 肯德基、麦当劳

## 上轮已推荐岗位
1. [jobId:123] 品牌:肯德基 - 岗位:服务员 | 门店:浦东陆家嘴店 | 薪资:20-25 元/时
2. [jobId:456] 品牌:麦当劳 - 岗位:收银员 | 门店:静安寺店 | 薪资:18-22 元/时
```

#### 3.5.2 事实提取管道 — extractAndSaveFacts

`lib/memory/wework/fact-extraction.ts`

```
流程：读历史 facts → 确定消息窗口 → 获取品牌数据 → LLM 提取 → 深度合并 → 写入

① 从 UIMessage[] 提取对话文本
② fetchBrandData(dulidayToken) — 品牌别名数据（30min 内存缓存）
③ 增量策略：有缓存 → 扫描最近 10 条；无缓存 → 扫描最近 50 条（节省 ~80% token）
④ 构建提取提示词（含品牌别名映射 + 推理指导）
⑤ safeGenerateObject(extractModel) → EntityExtractionResult
⑥ deepMerge(previousFacts, newFacts) — 核心合并逻辑
⑦ sessionMemory.saveFacts(mergedFacts)
```

**增量记忆合并示例：**

```
Turn 1:  用户: "我叫张三，想在上海找兼职"
         → 提取: { name: "张三", city: "上海" }

Turn 2:  用户: "最好是餐饮行业的"
         → 提取: { name: null, city: null, brands: ["餐饮"] }
         → 合并: { name: "张三", city: "上海", brands: ["餐饮"] }
                          ↑                          ↑
                    null 不覆盖旧值              新值追加

Turn 3:  用户: "海底捞或者肯德基都行"
         → 提取: { brands: ["海底捞", "肯德基"] }
         → 合并: { name: "张三", city: "上海", brands: ["餐饮", "海底捞", "肯德基"] }
                                                          ↑
                                                      数组去重累积
```

**关键决策：null 不覆盖** — `null` 的语义 = "本轮没提到"，而非"用户主动否认"。

**冷启动保护：**

```
场景：候选人昨天聊了 20 轮，今天又发了一条消息

没有冷启动保护:
  缓存过期(24h TTL) → facts = null → LLM 不知道候选人是谁 → 重新询问 → 体验差

有冷启动保护:
  缓存过期 → 检测到历史消息 > 2 条 → 同步提取一次 → 首轮即恢复记忆
  代价: 首轮多一次 LLM 调用（~200ms）
  收益: 候选人感受到"你还记得我"
```

---

## 4. 对话生命周期

### 4.1 漏斗 6 阶段

```
候选人旅程（漏斗 6 阶段）:

  ┌─────────────────────────────────┐
  │        🤝 建立信任               │  "你好，请问是招聘吗？"
  │         trust_building          │
  ├─────────────────────────────────┤
  │       📱 引导私域                │  "可以加微信聊吗？"
  │        private_channel          │  企微场景自动流转到 job_consultation
  ├─────────────────────────────────┤
  │       📋 资质了解                │  "我是大学生，可以做兼职吗？"
  │       qualify_candidate         │
  ├─────────────────────────────────┤
  │       💼 岗位咨询                │  "有哪些岗位？工资多少？"
  │       job_consultation          │
  ├─────────────────────────────────┤
  │       📅 面试预约                │  "我想去面试"
  │     interview_scheduling        │
  ├─────────────────────────────────┤
  │       ✅ 入职跟进                │  "面试过了，什么时候上班？"
  │       onboard_followup          │
  └─────────────────────────────────┘
```

每个阶段有明确的 **StageGoalPolicy**：

```typescript
interface StageGoalPolicy {
  primaryGoal: string;         // "回答岗位问题并提升兴趣"
  successCriteria: string[];   // ["候选人对岗位保持兴趣"]
  ctaStrategy: string;         // "先答核心问题，再给下一步建议"
  disallowedActions?: string[];// ["编造数字或政策"]
}
```

通过 `context.replyPolicy.stageGoals` 或 `toolContext.wework_plan_turn.stageGoals` 从运营后台动态注入。

### 4.2 阶段与工具 / needs 映射

| 阶段 | 典型 needs | 工具调用 |
|------|-----------|---------|
| `trust_building` | `none` | 无（直接回复） |
| `private_channel` | `wechat` | → 自动流转到 `job_consultation` |
| `qualify_candidate` | `requirements` | 无（基于记忆回复） |
| `job_consultation` | `salary`, `schedule`, `location`, `stores` | `duliday_job_list_for_llm` |
| `interview_scheduling` | `interview`, `availability` | 后续启用 `duliday_interview_booking` |
| `onboard_followup` | `none` | 视情况而定 |

### 4.3 合规风控

```
5 种风险标记 (RiskFlag):

  insurance_promise_risk  →  兼职不能承诺五险一金
  age_sensitive           →  涉及年龄歧视风险
  confrontation_emotion   →  候选人情绪激动
  urgency_high            →  不切实际的时间要求
  qualification_mismatch  →  资质明显不符

处理方式:
  标记 + 硬约束策略注入 → LLM 在生成时遵守约束
  不是"检测到了就不回"，而是"检测到了就换一种说法"
```

---

## 5. 数据流设计

### 5.1 单次请求完整流程

```
候选人在企微发送: "上海有什么兼职岗位？最好是餐饮的"
                            │
                            ▼
 ┌─ ① 请求到达 ────────────────────────────────────────────┐
 │  POST /api/v1/chat                                       │
 │  {                                                       │
 │    model: "anthropic/claude-haiku-4-5",                  │
 │    messages: [...],                                      │
 │    promptType: "weworkSystemPrompt",                     │
 │    context: {                                            │
 │      userId: "wx_zhang3",                                │
 │      sessionId: "s001",                                  │
 │      systemPrompts: { weworkSystemPrompt: "..." },       │
 │      modelConfig: { classifyModel, extractModel },       │
 │      dulidayToken: "...",                                │
 │    },                                                    │
 │    toolContext: {                                         │
 │      wework_plan_turn: { stageGoals: { ... } }           │
 │    }                                                     │
 │  }                                                       │
 └──────────────────────────────┬───────────────────────────┘
                                │
                                ▼
 ┌─ ② 预处理器（wework-preprocessor）─────────────────────┐
 │                                                          │
 │  加载会话记忆:                                             │
 │    facts = { name: "张三", is_student: true }  ← 之前积累的│
 │    lastRecommendedJobs = null                             │
 │                                                          │
 │  冷启动检测:                                               │
 │    历史消息 > 2 条 && facts == null → 同步提取一次          │
 │                                                          │
 │  格式化注入系统提示词:                                      │
 │    "## 候选人已知信息                                       │
 │     - 姓名: 张三                                           │
 │     - 是否学生: 是"                                        │
 │                                                          │
 │  注册回调:                                                 │
 │    onJobsFetched → 推荐结果写入记忆                         │
 │    afterResponse → 异步提取新事实                            │
 └──────────────────────────────┬───────────────────────────┘
                                │
                                ▼
 ┌─ ③ 工具构建 ────────────────────────────────────────────┐
 │  "weworkSystemPrompt" → ["wework_plan_turn",             │
 │                          "duliday_job_list_for_llm"]     │
 │                                                          │
 │  wework_plan_turn: 注入 stageGoals + classifyModel       │
 │  duliday_job_list_for_llm: 注入 dulidayToken + 回调       │
 └──────────────────────────────┬───────────────────────────┘
                                │
                                ▼
 ┌─ ④ LLM 主流程（chatModel = Claude）────────────────────┐
 │                                                          │
 │  系统提示词 = 运营话术 + 候选人记忆 + 阶段策略               │
 │                                                          │
 │  LLM 决定调用工具:                                         │
 │                                                          │
 │  ┌─ Tool Call: wework_plan_turn ─────────────────────┐   │
 │  │  classifyModel(gpt-5-mini) 分析:                   │   │
 │  │  → stage: job_consultation                         │   │
 │  │  → needs: [stores, salary]                         │   │
 │  │  → riskFlags: []                                   │   │
 │  │  → stageGoal: { primaryGoal: "回答岗位问题..." }    │   │
 │  └───────────────────────────────────────────────────┘   │
 │                                                          │
 │  ┌─ Tool Call: duliday_job_list_for_llm ─────────────┐   │
 │  │  查询: 上海 + 餐饮 → 返回 5 个岗位                   │   │
 │  │  回调: onJobsFetched → 写入 sessionMemory            │   │
 │  └───────────────────────────────────────────────────┘   │
 │                                                          │
 │  LLM 生成回复:                                             │
 │  "张三你好！上海目前有这些餐饮兼职岗位...                      │
 │   1. 海底捞·人民广场店 - 服务员 20-25元/时                   │
 │   2. 肯德基·陆家嘴店 - 收银员 18-22元/时 ..."               │
 └──────────────────────────────┬───────────────────────────┘
                                │
                                ▼
 ┌─ ⑤ 响应返回 + 异步后处理 ────────────────────────────────┐
 │                                                          │
 │  → 回复立即返回给候选人（不等后处理）                         │
 │                                                          │
 │  → 异步 extractAndSaveFacts():                            │
 │    extractModel 从本轮对话提取:                              │
 │    { city: "上海", brands: ["餐饮"], labor_form: "兼职" }   │
 │    deepMerge 合并到已有 facts                               │
 │    → 下一轮对话时，LLM 就知道候选人想去上海做餐饮              │
 └──────────────────────────────────────────────────────────┘
```

### 5.2 数据结构定义

#### 请求结构

```typescript
// types/api.ts — OpenChatRequestSchema
interface OpenChatRequest {
  model: string;                    // 模型 ID（如 "anthropic/claude-haiku-4-5"）
  messages: UIMessage[];            // 完整对话历史
  stream?: boolean;                 // 是否流式返回
  promptType?: string;              // 场景类型（如 "weworkSystemPrompt"）
  allowedTools?: string[];          // 额外允许的工具
  toolContext?: Record<string, unknown>; // 按工具名注入额外上下文
  contextStrategy?: string;         // 上下文缺失策略 (error/skip/report)
  context?: {
    userId?: string;
    sessionId?: string;
    preferredBrand?: string;
    brandPriorityStrategy?: BrandPriorityStrategy;
    modelConfig?: ModelConfig;       // chatModel, classifyModel, extractModel
    systemPrompts?: Record<string, string>;
    replyPolicy?: ReplyPolicyConfig; // stageGoals, persona, hardConstraints
    dulidayToken?: string;
    defaultWechatId?: string;
    industryVoiceId?: string;
  };
}
```

#### 事实提取输出

```typescript
// lib/tools/wework/types.ts — EntityExtractionResult
interface EntityExtractionResult {
  interview_info: InterviewInfo;
  preferences: Preferences;
  reasoning: string;               // 提取推理说明
}

interface InterviewInfo {
  name: string | null;             // 姓名
  phone: string | null;            // 联系方式
  gender: string | null;           // 性别
  age: string | null;              // 年龄（保留原话）
  applied_store: string | null;    // 应聘门店
  applied_position: string | null; // 应聘岗位
  interview_time: string | null;   // 面试时间
  is_student: boolean | null;      // 是否学生
  education: string | null;        // 学历
  has_health_certificate: string | null; // 健康证
}

interface Preferences {
  brands: string[] | null;         // 意向品牌（数组，统一为品牌名称）
  salary: string | null;           // 意向薪资
  position: string[] | null;       // 意向岗位（数组）
  schedule: string | null;         // 意向班次
  city: string | null;             // 意向城市
  district: string[] | null;       // 意向区域（数组）
  location: string[] | null;       // 意向地点/商圈（数组）
  labor_form: string | null;       // 用工形式
}
```

#### 回合规划输出

```typescript
// lib/tools/wework/types.ts — WeworkPlanTurnOutput
interface WeworkPlanTurnOutput {
  stage: FunnelStage;              // 当前阶段
  needs: ReplyNeed[];              // 用户想知道什么
  riskFlags: RiskFlag[];           // 合规风险标记
  confidence: number;              // 0-1 置信度
  reasoning: string;               // 分类推理说明
  stageGoal: StageGoalPolicy;      // 当前阶段运营策略
}

// 完整的 TurnPlan（classification-agent 内部使用，含更多字段）
interface TurnPlan {
  stage: FunnelStage;
  subGoals: string[];              // 子目标列表（最多 6 个）
  needs: ReplyNeed[];
  riskFlags: RiskFlag[];
  confidence: number;
  extractedInfo: TurnExtractedInfo; // 快速提取的实体信息
  reasoningText: string;
}
```

#### 工具创建上下文

```typescript
// types/tool-common.ts — ToolCreationContext
interface ToolCreationContext {
  sandboxId: string | null;
  preferredBrand?: string;
  brandPriorityStrategy?: BrandPriorityStrategy;
  modelConfig?: ModelConfig;
  replyPolicy?: ReplyPolicyConfig;
  dulidayToken?: string;
  processedMessages?: UIMessage[];   // 完整对话，工具内部转换
  userId?: string;
  sessionId?: string;
  stageGoals?: StageGoals;           // 通过 toolContext 注入
  onJobsFetched?: (jobs: unknown[]) => void; // 预处理器注入
}
```

---

## 6. 降级与容错

> "任何一个环节挂了，Agent 不能哑巴。"

| 挂了什么 | 降级策略 | 用户感知 |
|---------|---------|---------|
| 事实提取失败 | 返回全 null FALLBACK，主流程不受影响 | 无感知（只是少了记忆） |
| 回合规划 LLM 失败 | 退回 `trust_building` + 纯规则 needs + confidence=0.35 | 略粗糙但不出错 |
| 岗位 API 不可用 | 工具返回空，LLM 文字兜底 | "目前没有查到合适岗位" |
| 品牌数据获取失败 | 空数组，提取继续（不崩溃） | 品牌别名映射缺失 |
| 缓存过期 | 冷启动保护同步恢复 | 首轮稍慢（~200ms） |
| stageGoal 配置缺失 | 抛 ConfigError（ErrorCode.CONFIG_MISSING_FIELD） | 返回错误信息 |

**设计原则：每个组件的失败都不应该阻断主流程。宁可降级回答，不可无回答。**

---

## 7. 可观测性

```
每个请求都带这些信号:

  响应头:
    X-Correlation-Id: abc-123           // 全链路追踪
    X-Tools-Skipped: duliday_job_list   // 哪些工具被跳过了
    X-Message-Pruned: true              // 消息是否被裁剪

  响应体:
    usage.inputTokens: 2340             // Token 消耗明细
    usage.outputTokens: 580
    tools.used: ["wework_plan_turn"]    // 实际使用了哪些工具
    tools.skipped: [...]                // 跳过了哪些（附原因）

  日志:
    cold start detected                 // 冷启动触发
    Cache hit / miss                    // 记忆命中率
    fact extraction: 12 messages        // 提取窗口大小
    injected memory (256 chars)         // 注入记忆大小
```

---

## 8. 架构的扩展性

### 加一个新场景？

```
场景: 要支持"抖音招聘"渠道

需要做的:
  1. 新建 lib/preprocessors/douyin-preprocessor.ts
     registerPreprocessor("douyinSystemPrompt", handler)
  2. route.ts 加一行 import（仅此而已）
  3. 配置工具映射
     PROMPT_TOOL_MAPPING["douyinSystemPrompt"] = [...]

不需要做的:
  ✗ 改路由逻辑
  ✗ 改消息处理流程
  ✗ 改 LLM 调用方式
```

### 加一个新工具？

```
场景: 要加一个"附近门店查询"工具

需要做的:
  1. 新建 lib/tools/nearby-stores.tool.ts
  2. 在 tool-registry.ts 注册
  3. 加入场景映射

工具通过 create(context) 工厂函数创建
缺必要上下文时返回 null → 自动跳过，不报错
```

### 换持久化方案？

```
当前: 进程内 Map（localCacheService，单机够用）
未来: 只需实现 get/setex 接口

  get<T>(key: string): Promise<T | null>
  setex(key: string, ttl: number, value: unknown): Promise<void>

替换为 Redis/数据库，上层代码零改动
```

---

## 9. 设计取舍

| 我们选择了 | 而不是 | 因为 |
|-----------|--------|------|
| 预处理器提取事实 | LLM 工具提取 | 确定性触发，不占工具位，异步不阻塞 |
| tool-based 结构化输出 (safeGenerateObject) | Output.object() | 兼容更多模型（部分模型不支持原生 structured output） |
| 规则层先于 LLM | 纯 LLM 判断 | 关键需求 100% 识别率 > 99% 概率识别 |
| null 不覆盖旧值 | null 清除字段 | "没提到" ≠ "主动否认"，避免信息丢失 |
| 进程内缓存 | Redis | 当前单机部署够用，接口预留替换能力 |
| 冷启动阈值 > 2 条消息 | > 1 | 2 条消息信息量少，提取成本不值得 |
| 空 inputSchema (plan_turn) | 完整参数 schema | 对话历史通过工厂闭包注入，简化 LLM 交互 |
| private_channel → job_consultation 自动流转 | 保留独立阶段 | 企微场景已在私域，无需引导 |

---

## 10. 技术栈一览

| 层 | 技术 |
|----|------|
| 运行时 | Next.js 15 + Node.js 18+ |
| AI 集成 | Vercel AI SDK v6 |
| 模型 | Claude (对话) + GPT-5-mini (提取/分类) |
| Schema | Zod v3 (运行时校验 + 类型推导) |
| 缓存 | LocalCacheService (进程内 Map, 可替换) |
| 错误处理 | 结构化 AppError + 错误链追踪 |
| 可观测 | correlationId + 响应头 + 结构化日志 |

---

## 11. 关键文件索引

| 组件 | 文件路径 |
|------|---------|
| Chat API 路由 | `app/api/v1/chat/route.ts` |
| API 类型定义 | `types/api.ts` |
| Open Chat 工具函数 | `lib/utils/open-chat-utils.ts` |
| 工具注册表 | `lib/tools/tool-registry.ts` |
| 工具通用类型 | `types/tool-common.ts` |
| 预处理器注册表 | `lib/preprocessors/registry.ts` |
| 企微预处理器 | `lib/preprocessors/wework-preprocessor.ts` |
| 回合规划工具 | `lib/tools/wework/plan_turn.tool.ts` |
| 企微工具类型 | `lib/tools/wework/types.ts` |
| 分类 Agent | `lib/agents/classification-agent.ts` |
| Agent 类型 | `lib/agents/types.ts` |
| 事实提取管道 | `lib/memory/wework/fact-extraction.ts` |
| 会话记忆 | `lib/memory/wework/session-memory.ts` |
| 本地缓存服务 | `lib/services/local-cache.service.ts` |
| 回复策略类型 | `types/reply-policy.ts` |
| 模型配置 | `lib/config/models.ts` |
| 岗位查询工具 | `lib/tools/duliday-job-list-for-llm.tool.ts` |
| 面试预约工具 | `lib/tools/duliday/duliday-interview-booking-tool.ts` |

---

## 12. 总结

```
                    ┌──────────────────────┐
                    │   企微智能 Agent      │
                    │                      │
                    │  记住人 → 增量记忆    │
                    │  看懂场 → 漏斗规划    │
                    │  守住线 → 风险标记    │
                    │                      │
                    │  可扩展 → 插件注册表   │
                    │  可降级 → 每层有兜底   │
                    │  可观测 → 全链路追踪   │
                    └──────────────────────┘
```

**一个 API 端点，插件式场景扩展，三模型协作，增量记忆累积。**

这就是我们的企微 Agent 架构。
