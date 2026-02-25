# 企业微信智能客服 - 记忆系统架构设计

> 本文档描述完整的三层记忆架构设计，作为后续迭代的参考蓝图。

## 架构总览

```
┌─────────────────────────────────────────────────────────────┐
│                   智能客服 Agent 记忆架构                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────────┐  ┌───────────────┐  ┌─────────────────┐ │
│  │  会话层记忆    │  │  用户层记忆    │  │     知识库      │ │
│  │  (Session)    │  │  (User)       │  │  (Knowledge)    │ │
│  │               │  │               │  │                 │ │
│  │ - 当前对话历史 │  │ - 用户画像    │  │ - 岗位信息      │ │
│  │ - 对话上下文  │  │ - 历史偏好    │  │ - FAQ 常见问题  │ │
│  │ - 槽位填充状态 │  │ - 过往咨询记录 │  │ - 招聘政策规则  │ │
│  │ - 当前意图    │  │ - 互动统计    │  │ - 品牌/门店信息 │ │
│  └───────────────┘  └───────────────┘  └─────────────────┘ │
│         │                  │                   │           │
│         ▼                  ▼                   ▼           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    记忆融合层                        │   │
│  │  mergeContext(sessionMemory, userMemory, knowledge)  │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                               │
│                            ▼                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              LLM + 工具执行 + 响应生成                │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                               │
│                            ▼                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    记忆更新层                        │   │
│  │  updateMemories(response, extractedFacts)            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 第一层：会话层记忆 (Session Memory)

### 职责

- 管理当前会话的对话历史
- 维护对话上下文和槽位状态
- Token 预算优化（长对话裁剪）

### 生命周期

- 创建：用户发起新会话
- 存在：会话进行中
- 销毁：会话结束或超时

### 数据结构

```typescript
interface SessionMemory {
  sessionId: string;
  userId: string;

  // 对话历史
  messages: UIMessage[];

  // 当前轮次提取的事实（classify_intent 输出）
  currentFacts: {
    lifecycle_stage: LifecycleStage;
    extracted_facts: CandidateFacts;
  } | null;

  // 槽位填充状态（从 extracted_facts 派生）
  slots: {
    brand: string | null;
    location: string | null;
    jobType: string | null;
    interviewTime: string | null;
  };

  // 元数据
  createdAt: Date;
  lastActiveAt: Date;
  messageCount: number;
}

// 生命周期阶段（5个阶段）
type LifecycleStage =
  | 'initial_contact'       // 初次接触
  | 'exploring_needs'       // 了解需求
  | 'job_consulting'        // 岗位咨询
  | 'interview_scheduling'  // 面试安排
  | 'follow_up';            // 后续跟进

// 候选人事实（分两部分）
interface CandidateFacts {
  interview_info: InterviewInfo;   // 面试信息
  preferences: Preferences;        // 意向信息
}

// 面试信息（面试安排阶段收集）
interface InterviewInfo {
  name?: string;                   // 姓名
  phone?: string;                  // 联系方式
  gender?: 'male' | 'female';      // 性别
  age?: number;                    // 年龄
  applied_store?: string;          // 应聘门店
  applied_position?: string;       // 应聘岗位
  interview_time?: string;         // 面试时间
  is_student?: boolean;            // 是否是学生
}

// 意向信息（岗位咨询阶段收集）
interface Preferences {
  brands?: string[];               // 意向品牌（可多选，用户原话）
  salary?: string;                 // 意向薪资
  position?: string;               // 意向岗位
  schedule?: string;               // 意向班次
  cities?: string[];               // 意向城市（可多选）
  district?: string;               // 意向区域
  location?: string;               // 意向地点/商圈
}
```

### 存储方案

- **本期实现**：内存（请求级，通过 messages 参数传递）
- **后期优化**：Redis（支持会话恢复）

### SimplifiedMemoryManager

本期实现的会话层记忆管理器，是对 `CellularMemoryManager` 的简化封装。

**核心能力**：

| 能力 | 方法 | 说明 |
|------|------|------|
| 对话历史加载 | `loadFromMessages()` | 从 UIMessage[] 转换并加载 |
| Token 预算优化 | `getOptimizedHistory()` | 长对话自动裁剪 |
| 统计信息 | `getStats()` | 调试用 |

**不再负责**（改由其他组件处理）：

| 能力 | 原实现 | 现归属 |
|------|--------|--------|
| 事实提取 | SmartExtractor | `classify_intent` 工具 |
| 品牌/位置映射 | 字典匹配 | 后端 API |

**代码结构**：

```typescript
class SimplifiedMemoryManager {
  private memoryManager: CellularMemoryManager;

  constructor();

  // 从 UIMessage[] 加载对话历史
  loadFromMessages(messages: UIMessage[]): void;

  // 获取优化后的对话历史（根据 Token 预算裁剪）
  getOptimizedHistory(tokenBudget?: number): string[];

  // 获取记忆统计信息（调试用）
  getStats(): MemoryStats;
}
```

**使用流程**：

```
请求到达
    ↓
new SimplifiedMemoryManager()
    ↓
loadFromMessages(request.messages)
    ↓
getOptimizedHistory(tokenBudget)  // 返回裁剪后的对话历史
    ↓
注入 LLM 上下文
    ↓
请求结束，实例销毁（无状态）
```

### 实现状态

- [x] **本期实现** - SimplifiedMemoryManager

---

## 第二层：用户层记忆 (User Memory)

### 职责

- 跨会话持久化用户信息
- 积累用户画像和偏好
- 记录历史咨询和互动

### 生命周期

- 创建：用户首次咨询
- 存在：永久（或设置过期策略）
- 更新：每次会话结束时

### 数据结构

```typescript
interface UserMemory {
  userId: string;           // 企业微信用户 ID

  // 用户画像（从历史对话积累）
  profile: {
    name: string | null;
    age: number | null;
    location: string | null;          // 常住地
    preferredBrands: string[];        // 偏好品牌
    preferredLocations: string[];     // 偏好工作地点
    preferredJobTypes: string[];      // 偏好岗位类型
    preferredSchedule: string[];      // 时间偏好（早班/晚班/周末）
    isStudent: boolean | null;
  };

  // 历史咨询记录
  history: {
    totalConversations: number;
    lastConversationAt: Date;
    consultedJobs: string[];          // 咨询过的岗位 ID
    appliedJobs: string[];            // 申请过的岗位 ID
    scheduledInterviews: string[];    // 已安排的面试
  };

  // 互动质量标签
  tags: {
    responseRate: 'high' | 'medium' | 'low';
    intentClarity: 'clear' | 'vague';
    urgencyLevel: 'high' | 'medium' | 'low';
  };

  // 元数据
  createdAt: Date;
  updatedAt: Date;
}
```

### 存储方案

- **推荐**：PostgreSQL（已有 Drizzle ORM）
- **备选**：Redis（快速读写）+ PostgreSQL（持久化）

### 更新策略

```typescript
// 每次会话结束时，合并新提取的事实到用户画像
async function updateUserMemory(
  userId: string,
  sessionFacts: CandidateFacts
): Promise<void> {
  const existing = await loadUserMemory(userId);

  // 合并策略：新值覆盖旧值，数组追加去重
  const merged = {
    ...existing.profile,
    age: sessionFacts.age ?? existing.profile.age,
    preferredBrands: [...new Set([
      ...existing.profile.preferredBrands,
      ...sessionFacts.mentioned_brands
    ])],
    // ...
  };

  await saveUserMemory(userId, merged);
}
```

### 实现状态

- [ ] **后期实现** - Phase 2

---

## 第三层：知识库 (Knowledge Base)

### 职责

- 提供岗位信息查询
- 存储 FAQ 常见问题
- 维护招聘政策规则

### 数据来源

| 知识类型 | 来源 | 更新频率 |
|----------|------|----------|
| 岗位信息 | DuLiDay API | 实时 |
| FAQ | 运营配置 | 按需 |
| 招聘政策 | 系统配置 | 低频 |
| 品牌/门店 | 数据库 | 低频 |

### 数据结构

```typescript
// FAQ 条目
interface FAQEntry {
  id: string;
  question: string;           // 问题模板
  answer: string;             // 回答模板
  keywords: string[];         // 匹配关键词
  category: 'salary' | 'schedule' | 'requirement' | 'process' | 'other';
  priority: number;
}

// 招聘政策
interface RecruitmentPolicy {
  id: string;
  brand: string;
  rules: {
    minAge: number;
    maxAge: number;
    requireStudentId: boolean;
    workPermitRequired: boolean;
    // ...
  };
}
```

### 检索方式

```typescript
// 基于关键词的简单检索（本期可用）
function searchFAQ(query: string): FAQEntry[] {
  return faqEntries.filter(entry =>
    entry.keywords.some(kw => query.includes(kw))
  );
}

// 基于向量的语义检索（后期优化）
async function semanticSearchFAQ(query: string): Promise<FAQEntry[]> {
  const embedding = await getEmbedding(query);
  return vectorStore.similaritySearch(embedding, topK: 3);
}
```

### 实现状态

- [x] **本期实现** - 岗位信息（duliday_job_list_for_llm）
- [ ] **后期实现** - FAQ、政策规则

---

## 记忆融合层

### 职责

将三层记忆合并为统一的上下文，注入 LLM。

### 融合策略

```typescript
interface MergedContext {
  // 来自会话层
  recentMessages: string[];           // 最近 N 轮对话
  currentIntent: LifecycleStage;      // 当前意图
  currentSlots: Record<string, any>;  // 已填充的槽位

  // 来自用户层
  userProfile: UserProfile | null;    // 用户画像摘要
  userHistory: string | null;         // 历史咨询摘要

  // 来自知识库
  relevantFAQs: FAQEntry[];           // 相关 FAQ
  relevantPolicies: string[];         // 相关政策
}

function mergeMemories(
  session: SessionMemory,
  user: UserMemory | null,
  knowledge: KnowledgeQueryResult
): MergedContext {
  return {
    // 会话层：保留最近对话
    recentMessages: session.messages.slice(-10),
    currentIntent: session.currentFacts?.lifecycle_stage ?? 'initial_contact',
    currentSlots: session.slots,

    // 用户层：生成画像摘要
    userProfile: user ? summarizeProfile(user.profile) : null,
    userHistory: user ? summarizeHistory(user.history) : null,

    // 知识库：相关内容
    relevantFAQs: knowledge.faqs,
    relevantPolicies: knowledge.policies,
  };
}
```

### 注入系统提示词

```typescript
function formatMergedContext(ctx: MergedContext): string {
  let prompt = "";

  // 用户画像（如果有）
  if (ctx.userProfile) {
    prompt += `\n## 用户画像\n${ctx.userProfile}\n`;
  }

  // 历史咨询（如果有）
  if (ctx.userHistory) {
    prompt += `\n## 历史咨询\n${ctx.userHistory}\n`;
  }

  // 相关 FAQ
  if (ctx.relevantFAQs.length > 0) {
    prompt += `\n## 参考问答\n`;
    ctx.relevantFAQs.forEach(faq => {
      prompt += `Q: ${faq.question}\nA: ${faq.answer}\n\n`;
    });
  }

  return prompt;
}
```

### 实现状态

- [ ] **后期实现** - Phase 2

---

## 记忆更新层

### 职责

每次对话后更新各层记忆。

### 更新流程

```
对话结束
    ↓
1. 更新会话层
   - 追加新消息
   - 更新槽位状态
   - 更新当前意图
    ↓
2. 更新用户层（异步，不阻塞响应）
   - 合并新提取的事实到用户画像
   - 记录本次咨询的岗位
   - 更新互动统计
    ↓
3. 更新知识库（可选）
   - 记录高频问题（用于 FAQ 优化）
   - 标记无法回答的问题
```

### 实现状态

- [ ] **后期实现** - Phase 2

---

## 实现路线图

### Phase 1：会话层记忆（本期）

- [x] SimplifiedMemoryManager
- [x] Token 预算优化
- [x] classify_intent 事实提取
- [x] 槽位状态管理（通过 extracted_facts）

### Phase 2：用户层记忆

- [ ] UserMemory 数据模型
- [ ] 数据库表设计（Drizzle schema）
- [ ] 用户画像积累逻辑
- [ ] 跨会话记忆加载

### Phase 3：知识库增强

- [ ] FAQ 管理后台
- [ ] FAQ 关键词检索
- [ ] 招聘政策规则配置
- [ ] （可选）向量检索

### Phase 4：记忆融合优化

- [ ] 完整的 mergeMemories 实现
- [ ] 上下文压缩优化
- [ ] 记忆过期策略

---

## 附录：与现有代码的关系

| 现有文件 | 作用 | 本架构中的位置 |
|----------|------|----------------|
| `cellular-memory-manager.ts` | 三层记忆管理 | 可复用部分逻辑，但需简化 |
| `smart-patterns.ts` | 规则引擎提取 | **不再使用**，改用 LLM 提取 |
| `duliday-job-list-for-llm-tool.ts` | 岗位查询 | 知识库层的岗位信息来源 |
| `classify-intent-tool.ts`（新建） | 意图分类+事实提取 | 会话层的核心工具 |
