# 意图驱动的字段过滤系统设计文档

## 📋 文档概述

**文档版本**: v1.0
**创建日期**: 2025-11-13
**作者**: Claude Code
**相关模块**: `lib/loaders/zhipin-data.loader.ts`, `lib/prompt-engineering/core/reply-builder.ts`

## 🎯 问题描述

### 当前问题

在 `buildContextInfo()` 函数中，门店数据使用硬编码的 `slice(0, 3)` 截取前3个门店：

```typescript
relevantStores.slice(0, 3).forEach(store => {
  // 构建门店信息...
});
```

**痛点**：

1. **不适应品牌差异**：像"成都你六姐"有57个门店，只显示3个门店信息不足；而小品牌可能只有1-2个门店
2. **Token 浪费**：所有意图都显示完整字段，即使用户只问薪资也会返回排班、考勤等无关信息
3. **Context Window 溢出**：大品牌的门店数据会导致 prompt 被截断，影响生成质量

### 症状示例

当用户询问"成都你六姐"的薪资时，系统返回：

```
[招聘数据]
匹配到的门店信息：
• 上海长泰广场店...
  职位：收银员，时间：11:00~13:30，薪资：24元/时
  福利：五险一金
  排班类型：灵活排班（可换班）
  可预约时段：11:00~13:30(0/1人，中优先级)
  排班特点：可换班、兼职
  每周工时：21-21小时
  出勤要求：...
• 上海鑫耀光环店...
  [大量字段信息]
...
[Content truncated due to token limit]
```

**问题分析**：
- 用户只关心薪资，但系统返回了排班、考勤、福利等所有字段
- 导致 token 消耗过大，超过 3000 token 预算被截断
- 截断后的 prompt 可能缺少关键信息，影响回复质量

## 🏗️ 解决方案设计

### 核心思路

采用 **"意图驱动的字段过滤 + Token 预算管理"** 混合方案：

1. **意图驱动**：根据 16 种 `ReplyContext` 意图，决定显示哪些字段
2. **Token 预算**：为门店数据分配固定 token 预算，动态添加门店直到达到预算上限
3. **分层展示**：前 N 个门店显示详细信息，其余显示摘要

### 架构改动点

```
lib/loaders/zhipin-data.loader.ts:
  └── buildContextInfo() 函数
      ├── 新增: getFieldDisplayConfig(replyType)  // 获取字段显示配置
      ├── 新增: estimateTokens(text)             // 估算 token 数量
      ├── 新增: buildStoreInfo(store, config)    // 根据配置构建门店信息
      └── 修改: 主循环逻辑 - 基于 token 预算动态添加门店
```

## 📊 16种意图的字段显示策略

### 字段清单

门店职位包含的所有字段：

| 字段分类 | 字段名称 | Token 估算 | 说明 |
|---------|---------|-----------|------|
| **基础信息** | 门店名称 | 20 | 门店名称 + 地址 |
| | 职位名称 | 10 | 岗位名称 |
| **薪资福利** | 薪资 | 30 | 基础薪资 + 范围 + memo |
| | 奖金 | 15 | 奖金说明 |
| | 福利 | 25 | 五险一金、晋升等 |
| **时间相关** | 工作时段 | 15 | 时间段列表 |
| | 排班类型 | 20 | 固定/灵活/轮班 + 可换班 |
| | 可预约时段 | 40 | 详细的时间段 + 容量 + 优先级 |
| | 每周工时 | 15 | 最小/最大工时要求 |
| | 工作日偏好 | 15 | 偏好的工作日 |
| **考勤要求** | 考勤政策 | 25 | 准时到岗、迟到容忍等 |
| | 出勤要求 | 40 | 详细描述 + 必需天数 + 最少天数 |
| **灵活性** | 排班灵活性 | 30 | 可换班、兼职、需周末等 |

**单个门店完整信息估算**: ~300 tokens
**单个门店摘要估算**: ~50 tokens（仅门店名+地址+岗位数）

### 意图-字段映射表

#### 1. 基础咨询类（6种）

##### `initial_inquiry` - 初次咨询

**场景**: "你好，我想找工作"、"有什么岗位吗"

**显示字段**:
- ✅ 门店基础信息（名称、地址）
- ✅ 职位名称
- ✅ 薪资（简化）
- ✅ 工作时段
- ✅ 福利（主要福利）
- ✅ 排班类型
- ❌ 详细考勤政策
- ❌ 可预约时段
- ❌ 出勤要求

**Token 预算**: 1200 tokens
**门店数量**: 最多 5 个
**详细门店数**: 前 3 个详细，其余摘要

**理由**: 初次咨询需要概览性信息，避免信息过载

---

##### `location_inquiry` - 位置询问

**场景**: "杨浦区有门店吗"、"五角场附近有吗"

**显示字段**:
- ✅ 门店基础信息（名称、地址）
- ✅ 职位名称
- ✅ 薪资（简化）
- ✅ 工作时段
- ❌ 福利
- ❌ 考勤政策
- ❌ 排班类型
- ❌ 灵活性信息

**Token 预算**: 1200 tokens
**门店数量**: 最多 8 个
**详细门店数**: 前 5 个详细，其余摘要

**理由**: 位置咨询重点在"哪里有"，可以显示更多门店数量但减少单个门店的字段

---

##### `no_location_match` - 无位置匹配

**场景**: 用户询问的区域没有门店

**显示字段**:
- ✅ 门店基础信息（名称、地址）
- ✅ 职位名称
- ✅ 薪资（简化）
- ✅ 工作时段
- ✅ 交通信息（重要）
- ❌ 其他详细信息

**Token 预算**: 1000 tokens
**门店数量**: 最多 3 个
**详细门店数**: 全部详细

**理由**: 无匹配时显示少量推荐门店，重点突出交通便利性

---

##### `schedule_inquiry` - 排班咨询

**场景**: "工作时间怎么安排"、"需要每天上班吗"

**显示字段**:
- ✅ 门店基础信息
- ✅ 职位名称
- ✅ 工作时段
- ✅ 排班类型
- ✅ 排班灵活性（可换班、兼职等）
- ✅ 每周工时
- ✅ 工作日偏好
- ❌ 薪资
- ❌ 福利
- ❌ 详细考勤政策

**Token 预算**: 1200 tokens
**门店数量**: 最多 5 个
**详细门店数**: 全部详细

**理由**: 排班咨询需要详细的时间和灵活性信息

---

##### `interview_request` - 面试请求

**场景**: "可以去面试吗"、"什么时候可以面试"

**显示字段**:
- ✅ 门店基础信息（名称、地址）
- ✅ 职位名称
- ✅ 可预约时段
- ❌ 所有其他字段

**Token 预算**: 600 tokens
**门店数量**: 最多 1 个（通常针对特定门店）
**详细门店数**: 1 个详细

**理由**: 面试请求只需要地址和可预约时段

---

##### `general_chat` - 一般对话

**场景**: "好的"、"谢谢"、"我考虑一下"

**显示字段**:
- ✅ 门店基础信息
- ✅ 职位名称
- ✅ 薪资（简化）
- ✅ 工作时段
- ❌ 其他详细信息

**Token 预算**: 800 tokens
**门店数量**: 最多 3 个
**详细门店数**: 全部详细

**理由**: 一般对话保持信息简洁

---

#### 2. 敏感信息类（3种）

##### `salary_inquiry` - 薪资询问

**场景**: "薪资多少"、"工资怎么算"

**显示字段**:
- ✅ 门店基础信息
- ✅ 职位名称
- ✅ 薪资（完整：base + range + memo）
- ✅ 奖金
- ✅ 福利（仅薪资相关福利）
- ❌ 所有排班、考勤信息

**Token 预算**: 1200 tokens
**门店数量**: 最多 8 个
**详细门店数**: 全部详细

**理由**: 薪资信息字段少，可以显示更多门店让候选人对比

---

##### `age_concern` - 年龄问题

**场景**: "我45岁了可以吗"、"有年龄限制吗"

**显示字段**:
- ✅ 门店基础信息
- ✅ 职位名称
- ❌ 所有其他字段

**Token 预算**: 400 tokens
**门店数量**: 最多 1 个
**详细门店数**: 0 个（仅摘要）

**理由**: 年龄问题不需要详细门店信息，主要依靠固定话术回复

---

##### `insurance_inquiry` - 保险询问

**场景**: "有五险一金吗"、"有保险吗"

**显示字段**:
- ✅ 门店基础信息
- ✅ 职位名称
- ✅ 福利（完整）
- ❌ 其他所有字段

**Token 预算**: 1000 tokens
**门店数量**: 最多 6 个
**详细门店数**: 全部详细

**理由**: 保险询问只关注福利信息

---

#### 3. 跟进沟通类（1种）

##### `followup_chat` - 跟进对话

**场景**: 持续对话中的跟进

**显示字段**:
- ✅ 门店基础信息
- ✅ 职位名称
- ✅ 薪资（简化）
- ✅ 工作时段
- ✅ 排班类型
- ❌ 详细考勤、灵活性

**Token 预算**: 1000 tokens
**门店数量**: 最多 3 个
**详细门店数**: 全部详细

**理由**: 跟进对话保持中等信息量

---

#### 4. 考勤排班类（6种）

##### `attendance_inquiry` - 出勤要求咨询

**场景**: "一周要上几天班"、"需要每天都来吗"

**显示字段**:
- ✅ 门店基础信息
- ✅ 职位名称
- ✅ 工作时段
- ✅ 出勤要求（完整：描述 + 必需天数 + 最少天数）
- ✅ 排班类型
- ✅ 每周工时
- ❌ 薪资
- ❌ 福利
- ❌ 可预约时段

**Token 预算**: 1200 tokens
**门店数量**: 最多 6 个
**详细门店数**: 全部详细

**理由**: 出勤要求需要详细的天数和时间信息

---

##### `flexibility_inquiry` - 排班灵活性咨询

**场景**: "可以换班吗"、"支持兼职吗"、"时间灵活吗"

**显示字段**:
- ✅ 门店基础信息
- ✅ 职位名称
- ✅ 工作时段
- ✅ 排班类型
- ✅ 排班灵活性（完整：可换班、兼职、需周末、需节假日）
- ✅ 每周工时
- ❌ 薪资
- ❌ 福利
- ❌ 考勤政策

**Token 预算**: 1200 tokens
**门店数量**: 最多 6 个
**详细门店数**: 全部详细

**理由**: 灵活性咨询需要完整的排班灵活性信息

---

##### `attendance_policy_inquiry` - 考勤政策咨询

**场景**: "迟到怎么办"、"考勤严格吗"

**显示字段**:
- ✅ 门店基础信息
- ✅ 职位名称
- ✅ 考勤政策（完整：准时到岗、迟到容忍、考勤跟踪、补班）
- ❌ 所有其他字段

**Token 预算**: 1000 tokens
**门店数量**: 最多 6 个
**详细门店数**: 全部详细

**理由**: 考勤政策咨询专注于考勤规则

---

##### `work_hours_inquiry` - 工时要求咨询

**场景**: "一周要工作多少小时"、"最少工作多久"

**显示字段**:
- ✅ 门店基础信息
- ✅ 职位名称
- ✅ 工作时段
- ✅ 每周工时（完整：最小-最大）
- ✅ 排班类型
- ✅ 排班灵活性（兼职相关）
- ❌ 薪资
- ❌ 福利

**Token 预算**: 1200 tokens
**门店数量**: 最多 6 个
**详细门店数**: 全部详细

**理由**: 工时咨询需要详细的时间和工时信息

---

##### `availability_inquiry` - 时间段可用性咨询

**场景**: "中午12点的班还招人吗"、"晚班还有名额吗"

**显示字段**:
- ✅ 门店基础信息
- ✅ 职位名称
- ✅ 工作时段
- ✅ 可预约时段（完整：时段 + 当前人数 + 最大容量 + 优先级）
- ❌ 所有其他字段

**Token 预算**: 1000 tokens
**门店数量**: 最多 5 个
**详细门店数**: 全部详细

**理由**: 时间段可用性需要详细的预约状态

---

##### `part_time_support` - 兼职支持咨询

**场景**: "可以做兼职吗"、"支持兼职吗"

**显示字段**:
- ✅ 门店基础信息
- ✅ 职位名称
- ✅ 薪资（简化）
- ✅ 工作时段
- ✅ 排班类型
- ✅ 排班灵活性（兼职相关）
- ✅ 每周工时
- ❌ 福利（兼职不提供五险一金）
- ❌ 考勤政策

**Token 预算**: 1000 tokens
**门店数量**: 最多 5 个
**详细门店数**: 全部详细

**理由**: 兼职咨询需要薪资和灵活性信息，但不含福利

---

## 🔧 Token 预算管理方案

### 整体预算分配

```
总预算: 3000 tokens

分配方案:
├── [指令] (系统指令)                    ~200 tokens
├── [对话分析]                           ~50 tokens
├── [对话历史] (最近5条)                 ~300 tokens
├── [已知事实]                           ~100 tokens
├── [招聘数据] (门店信息)                ~1200 tokens ⭐ 动态区域
├── [候选人资料]                         ~200 tokens
├── [识别信息]                           ~50 tokens
├── [候选人消息]                         ~50 tokens
└── [输出要求]                           ~150 tokens
    ─────────────────────────────────────
    预留缓冲                              ~700 tokens
```

### 门店数据动态分配策略

```typescript
interface TokenBudgetConfig {
  totalBudget: number;           // 整体预算 (3000)
  storeDataBudget: number;       // 门店数据预算 (1200)
  minimumStoreTokens: number;    // 单个门店最小 tokens (50，仅摘要)
  detailedStoreTokens: number;   // 单个门店详细 tokens (根据字段配置计算)
}

// 根据意图计算门店数据预算
function calculateStoreTokenBudget(replyType: ReplyContext): number {
  const budgetMap: Record<ReplyContext, number> = {
    // 高预算场景（需要展示更多门店）
    salary_inquiry: 1500,          // 薪资信息简单，可显示更多
    location_inquiry: 1400,        // 位置咨询需要多门店

    // 中等预算场景
    initial_inquiry: 1200,         // 初次咨询平衡信息量
    schedule_inquiry: 1200,        // 排班咨询需要详细信息
    attendance_inquiry: 1200,      // 出勤要求需要详细信息
    flexibility_inquiry: 1200,     // 灵活性咨询需要详细信息
    work_hours_inquiry: 1200,      // 工时咨询需要详细信息
    insurance_inquiry: 1000,       // 保险咨询字段少
    availability_inquiry: 1000,    // 时间段可用性
    part_time_support: 1000,       // 兼职支持
    attendance_policy_inquiry: 1000, // 考勤政策
    followup_chat: 1000,           // 跟进对话

    // 低预算场景
    no_location_match: 800,        // 无匹配时少量推荐
    general_chat: 800,             // 一般对话简洁
    interview_request: 600,        // 面试请求针对单一门店
    age_concern: 400,              // 年龄问题不需详细信息
  };

  return budgetMap[replyType] || 1000;
}
```

### 动态门店添加算法

```typescript
function buildStoresWithTokenBudget(
  stores: Store[],
  fieldConfig: FieldDisplayConfig,
  tokenBudget: number
): string {
  let context = "";
  let usedTokens = 0;
  let storeIndex = 0;

  while (storeIndex < stores.length && usedTokens < tokenBudget) {
    const store = stores[storeIndex];

    // 判断是详细信息还是摘要
    const isDetailed = storeIndex < fieldConfig.detailedStores;

    // 构建门店信息
    const storeInfo = isDetailed
      ? buildDetailedStoreInfo(store, fieldConfig)
      : buildStoreSummary(store);

    // 估算 tokens
    const storeTokens = estimateTokens(storeInfo);

    // 检查是否超出预算
    if (usedTokens + storeTokens > tokenBudget) {
      // 如果还没添加任何门店，至少添加一个摘要
      if (storeIndex === 0) {
        context += buildStoreSummary(store);
        break;
      }
      // 预算用完，停止添加
      break;
    }

    // 添加门店信息
    context += storeInfo;
    usedTokens += storeTokens;
    storeIndex++;
  }

  // 如果还有剩余门店，添加统计信息
  const remainingStores = stores.length - storeIndex;
  if (remainingStores > 0) {
    context += `\n还有 ${remainingStores} 个门店未展示，可根据需要进一步询问。\n`;
  }

  return context;
}
```

## 📍 调用链影响分析

### 调用链路径

```
用户输入
  ↓
app/api/test-llm-reply/route.ts (API 路由)
  ↓
lib/loaders/zhipin-data.loader.ts:generateSmartReplyWithLLM()
  ↓
lib/loaders/zhipin-data.loader.ts:buildContextInfo()  ⭐ 改动点
  ↓
lib/prompt-engineering/core/reply-builder.ts:build()
  ↓
lib/prompt-engineering/core/reply-builder.ts:formatMolecularPromptWithMemory()
  ↓
AI SDK generateText()
  ↓
返回智能回复
```

### 影响范围评估

| 模块 | 改动类型 | 影响程度 | 说明 |
|------|---------|---------|------|
| `buildContextInfo()` | 🔴 **重大改动** | High | 核心改动点，增加字段过滤逻辑 |
| `generateSmartReplyWithLLM()` | 🟡 **接口不变** | Low | 函数签名不变，仅内部调用受影响 |
| `ReplyPromptBuilder` | 🟢 **无改动** | None | 仅消费 contextInfo，不受影响 |
| API 路由 | 🟢 **无改动** | None | 接口签名不变 |
| 前端调用 | 🟢 **无改动** | None | 无需前端改动 |
| 测试用例 | 🟡 **需更新** | Medium | 需要更新快照测试 |

### 向后兼容性

✅ **完全向后兼容**：
- 函数签名不变
- 外部调用接口不变
- 仅内部实现优化

## 🚀 实施方案

### Phase 1: 核心工具函数实现

**文件**: `lib/loaders/zhipin-data.loader.ts`

#### 1.1 新增接口定义

```typescript
/**
 * 字段显示配置接口
 */
interface FieldDisplayConfig {
  // 字段开关
  showSalary: boolean;
  showBonus: boolean;
  showBenefits: boolean;
  showTimeSlots: boolean;
  showScheduleType: boolean;
  showAttendancePolicy: boolean;
  showFlexibility: boolean;
  showAvailableSlots: boolean;
  showWorkHours: boolean;
  showPreferredDays: boolean;
  showAttendanceRequirement: boolean;

  // 门店控制
  maxStores: number;          // 最多显示几个门店
  detailedStores: number;     // 前几个门店显示详细信息
  tokenBudget: number;        // 为门店数据分配的 token 预算
}
```

#### 1.2 字段配置映射

```typescript
/**
 * 根据对话意图获取字段显示配置
 */
function getFieldDisplayConfig(replyType: ReplyContext): FieldDisplayConfig {
  const configs: Record<ReplyContext, FieldDisplayConfig> = {
    // ... 按照前面映射表的配置
  };

  return configs[replyType] || configs.general_chat;
}
```

#### 1.3 Token 估算工具

```typescript
/**
 * 粗略估算文本的 token 数量
 * 中文字符 ≈ 2 tokens，英文/数字 ≈ 0.5 tokens
 */
function estimateTokens(text: string): number {
  const chineseChars = text.match(/[\u4e00-\u9fa5]/g)?.length || 0;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars * 2 + otherChars * 0.5);
}
```

#### 1.4 条件字段构建器

```typescript
/**
 * 根据配置有条件地构建职位信息
 */
function buildPositionInfo(
  pos: Position,
  config: FieldDisplayConfig
): string {
  let info = `  职位：${pos.name}`;

  // 时间段
  if (config.showTimeSlots && pos.timeSlots.length > 0) {
    info += `，时间：${pos.timeSlots.join("、")}`;
  }

  // 薪资
  if (config.showSalary) {
    const salaryInfo = buildSalaryDescription(pos.salary);
    info += `，薪资：${salaryInfo}`;
  }

  info += "\n";

  // 奖金
  if (config.showBonus && pos.salary.bonus) {
    info += `  奖金：${pos.salary.bonus}\n`;
  }

  // 福利
  if (config.showBenefits && pos.benefits?.items?.length > 0) {
    const benefitsList = pos.benefits.items.filter(item => item !== "无");
    if (benefitsList.length > 0) {
      info += `  福利：${benefitsList.join("、")}\n`;
    }
  }

  // 排班类型
  if (config.showScheduleType) {
    const scheduleTypeText = getScheduleTypeText(pos.scheduleType);
    const canSwapText = pos.schedulingFlexibility.canSwapShifts
      ? "（可换班）"
      : "（不可换班）";
    info += `  排班类型：${scheduleTypeText}${canSwapText}\n`;
  }

  // 可预约时段
  if (config.showAvailableSlots) {
    const availableSlots = pos.availableSlots.filter(slot => slot.isAvailable);
    if (availableSlots.length > 0) {
      info += `  可预约时段：${availableSlots
        .map(slot =>
          `${slot.slot}(${slot.currentBooked}/${slot.maxCapacity}人，${getPriorityText(slot.priority)}优先级)`
        )
        .join("、")}\n`;
    }
  }

  // 考勤政策
  if (config.showAttendancePolicy && pos.attendancePolicy.punctualityRequired) {
    info += `  考勤要求：准时到岗，最多迟到${pos.attendancePolicy.lateToleranceMinutes}分钟\n`;
  }

  // 排班灵活性
  if (config.showFlexibility) {
    const flexibility = pos.schedulingFlexibility;
    const flexibilityFeatures = [];
    if (flexibility.canSwapShifts) flexibilityFeatures.push("可换班");
    if (flexibility.partTimeAllowed) flexibilityFeatures.push("兼职");
    if (flexibility.weekendRequired) flexibilityFeatures.push("需周末");
    if (flexibility.holidayRequired) flexibilityFeatures.push("需节假日");

    if (flexibilityFeatures.length > 0) {
      info += `  排班特点：${flexibilityFeatures.join("、")}\n`;
    }
  }

  // 每周工时
  if (config.showWorkHours && (pos.minHoursPerWeek || pos.maxHoursPerWeek)) {
    info += `  每周工时：${pos.minHoursPerWeek || 0}-${pos.maxHoursPerWeek || "不限"}小时\n`;
  }

  // 偏好工作日
  if (config.showPreferredDays && pos.preferredDays?.length > 0) {
    info += `  工作日偏好：${pos.preferredDays.map(day => getDayText(day)).join("、")}\n`;
  }

  // 出勤要求
  if (config.showAttendanceRequirement && pos.attendanceRequirement) {
    const req = pos.attendanceRequirement;
    let reqText = `出勤要求：${req.description}`;

    if (req.requiredDays && req.requiredDays.length > 0) {
      const dayNames = req.requiredDays.map(dayNum => getDayNumberText(dayNum));
      reqText += `（需要：${dayNames.join("、")}）`;
    }

    if (req.minimumDays) {
      reqText += `，最少${req.minimumDays}天/周`;
    }

    info += `  ${reqText}\n`;
  }

  return info;
}
```

#### 1.5 门店摘要构建器

```typescript
/**
 * 构建门店摘要信息（用于超出详细展示数量的门店）
 */
function buildStoreSummary(store: Store): string {
  const positionCount = store.positions.length;
  const positionNames = [...new Set(store.positions.map(p => p.name))].join("、");

  return `• ${store.name}（${store.district}${store.subarea}）：${positionCount}个岗位（${positionNames}）\n`;
}
```

#### 1.6 主构建函数改造

```typescript
/**
 * 构建上下文信息（改造版）
 */
function buildContextInfo(
  data: ZhipinData,
  classification: MessageClassification,
  uiSelectedBrand?: string,
  toolBrand?: string,
  brandPriorityStrategy?: BrandPriorityStrategy
): { contextInfo: string; resolvedBrand: string } {
  // ... 现有的品牌解析和门店过滤逻辑保持不变 ...

  // 获取字段显示配置
  const fieldConfig = getFieldDisplayConfig(classification.replyType);

  // 构建上下文信息
  let context = `默认推荐品牌：${targetBrand}\n`;

  if (relevantStores.length > 0) {
    context += `匹配到的门店信息：\n`;

    // 基于 token 预算动态添加门店
    let usedTokens = 0;
    let storeIndex = 0;

    while (
      storeIndex < relevantStores.length &&
      storeIndex < fieldConfig.maxStores &&
      usedTokens < fieldConfig.tokenBudget
    ) {
      const store = relevantStores[storeIndex];

      // 判断是详细信息还是摘要
      const isDetailed = storeIndex < fieldConfig.detailedStores;

      let storeInfo = "";

      if (isDetailed) {
        // 详细信息
        storeInfo = `• ${store.name}（${store.district}${store.subarea}）：${store.location}\n`;
        store.positions.forEach(pos => {
          storeInfo += buildPositionInfo(pos, fieldConfig);
        });
      } else {
        // 摘要信息
        storeInfo = buildStoreSummary(store);
      }

      // 估算 tokens
      const storeTokens = estimateTokens(storeInfo);

      // 检查是否超出预算
      if (usedTokens + storeTokens > fieldConfig.tokenBudget) {
        // 如果还没添加任何门店，至少添加一个摘要
        if (storeIndex === 0) {
          context += buildStoreSummary(store);
        }
        break;
      }

      // 添加门店信息
      context += storeInfo;
      usedTokens += storeTokens;
      storeIndex++;
    }

    // 添加统计信息
    const remainingStores = relevantStores.length - storeIndex;
    if (remainingStores > 0) {
      context += `\n还有 ${remainingStores} 个门店未展示，可根据候选人需要进一步推荐。\n`;
    }

    console.log(`📊 门店数据 token 使用情况: ${usedTokens}/${fieldConfig.tokenBudget} tokens，已展示 ${storeIndex}/${relevantStores.length} 个门店`);
  } else {
    // 无匹配门店的逻辑保持不变
    context += `暂无完全匹配的门店，可推荐其他区域门店\n`;
    context += `⚠️ 无匹配时必须：主动要微信联系方式，告知"以后有其他门店空了可以再推给你"\n`;
  }

  // 品牌模板话术逻辑保持不变...

  return {
    contextInfo: context,
    resolvedBrand: targetBrand,
  };
}
```

### Phase 2: 测试验证

#### 2.1 单元测试

**文件**: `lib/loaders/__tests__/field-filtering.spec.ts`

```typescript
describe("意图驱动字段过滤", () => {
  describe("getFieldDisplayConfig", () => {
    test("salary_inquiry 应只显示薪资相关字段", () => {
      const config = getFieldDisplayConfig("salary_inquiry");

      expect(config.showSalary).toBe(true);
      expect(config.showBenefits).toBe(true);
      expect(config.showScheduleType).toBe(false);
      expect(config.showAttendancePolicy).toBe(false);
    });

    test("schedule_inquiry 应只显示排班相关字段", () => {
      const config = getFieldDisplayConfig("schedule_inquiry");

      expect(config.showScheduleType).toBe(true);
      expect(config.showFlexibility).toBe(true);
      expect(config.showWorkHours).toBe(true);
      expect(config.showSalary).toBe(false);
    });
  });

  describe("estimateTokens", () => {
    test("应正确估算纯中文文本", () => {
      const tokens = estimateTokens("上海市浦东新区");
      expect(tokens).toBeGreaterThan(10);
      expect(tokens).toBeLessThan(20);
    });

    test("应正确估算混合文本", () => {
      const tokens = estimateTokens("薪资：24元/时");
      expect(tokens).toBeGreaterThan(10);
    });
  });

  describe("buildContextInfo with field filtering", () => {
    test("大品牌门店应根据 token 预算截断", () => {
      // 模拟"成都你六姐" 57个门店的情况
      const result = buildContextInfo(mockLargeBrandData, {
        replyType: "salary_inquiry",
        // ...
      });

      // 验证返回的门店数量合理
      const storeCount = (result.contextInfo.match(/• /g) || []).length;
      expect(storeCount).toBeLessThanOrEqual(8);

      // 验证 token 预算控制
      const tokens = estimateTokens(result.contextInfo);
      expect(tokens).toBeLessThanOrEqual(1500);
    });
  });
});
```

#### 2.2 集成测试

**测试场景**:

| 场景 | 品牌 | 意图 | 预期结果 |
|------|------|------|---------|
| 大品牌薪资询问 | 成都你六姐 (57店) | salary_inquiry | 显示 8 个门店，仅薪资福利字段 |
| 小品牌初次咨询 | ZARA (3店) | initial_inquiry | 显示 3 个门店，完整基础信息 |
| 排班咨询 | 肯德基 (20店) | schedule_inquiry | 显示 5 个门店，仅排班相关字段 |
| 面试请求 | 必胜客 | interview_request | 显示 1 个门店，仅地址和时段 |

#### 2.3 性能监控

```typescript
// 添加性能日志
console.log(`📊 门店数据 token 使用情况: ${usedTokens}/${fieldConfig.tokenBudget} tokens，已展示 ${storeIndex}/${relevantStores.length} 个门店`);
console.log(`⏱️ buildContextInfo 耗时: ${elapsedTime}ms`);
```

### Phase 3: 文档和监控

#### 3.1 更新 CLAUDE.md

在项目根目录的 `CLAUDE.md` 中添加：

```markdown
## 意图驱动的字段过滤系统

### 核心机制

智能回复系统根据 16 种对话意图动态调整门店信息的显示字段：

- **Token 预算管理**: 为每种意图分配合理的 token 预算（400-1500 tokens）
- **字段过滤**: 仅显示与当前意图相关的字段
- **动态门店数量**: 根据 token 消耗自适应添加门店，避免硬编码

### 示例

```typescript
// 薪资询问 - 只显示薪资相关信息
salary_inquiry → {
  showSalary: true,
  showBenefits: true,
  showSchedule: false,  // 🚫 不显示排班
  tokenBudget: 1500,    // 可显示更多门店
  maxStores: 8
}

// 排班咨询 - 只显示排班相关信息
schedule_inquiry → {
  showSalary: false,    // 🚫 不显示薪资
  showSchedule: true,
  showFlexibility: true,
  tokenBudget: 1200,
  maxStores: 5
}
```

详见: `docs/architecture/INTENT_DRIVEN_FIELD_FILTERING.md`
```

#### 3.2 监控指标

建议添加监控指标：

```typescript
interface FieldFilteringMetrics {
  replyType: ReplyContext;
  totalStores: number;           // 总门店数
  displayedStores: number;       // 展示的门店数
  detailedStores: number;        // 详细展示的门店数
  summaryStores: number;         // 摘要展示的门店数
  usedTokens: number;            // 实际使用的 tokens
  budgetTokens: number;          // 分配的 token 预算
  utilizationRate: number;       // token 利用率 (usedTokens / budgetTokens)
  truncated: boolean;            // 是否被截断
}
```

## ⚠️ 风险评估

### 高风险项

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Token 估算不准确 | 仍然可能超出预算 | 使用实际 tokenizer 而非粗略估算 |
| 字段配置遗漏 | 关键信息缺失 | 充分测试所有 16 种意图 |
| 性能下降 | 增加计算时间 | 使用缓存优化，监控性能指标 |

### 中风险项

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 配置复杂度高 | 维护困难 | 提供配置验证和文档 |
| 测试覆盖不足 | 回归问题 | 补充集成测试和快照测试 |
| 向后兼容性 | 现有调用受影响 | 保持函数签名不变 |

### 低风险项

- ✅ 代码可读性：使用清晰的命名和注释
- ✅ 可扩展性：新增意图只需添加配置
- ✅ 调试友好：添加详细的日志输出

## 📈 性能优化建议

### 优化点 1: Token 估算精确化

**当前方案**：粗略估算（中文 * 2 + 其他 * 0.5）

**改进方案**：使用实际 tokenizer

```typescript
import { encode } from "gpt-tokenizer"; // 或使用 tiktoken

function estimateTokensAccurate(text: string): number {
  return encode(text).length;
}
```

**权衡**：
- ✅ 更精确的 token 计数
- ❌ 增加依赖和计算开销

**建议**：先使用粗略估算验证方案，后期优化

---

### 优化点 2: 配置缓存

```typescript
// 缓存字段配置，避免重复计算
const fieldConfigCache = new Map<ReplyContext, FieldDisplayConfig>();

function getFieldDisplayConfig(replyType: ReplyContext): FieldDisplayConfig {
  if (!fieldConfigCache.has(replyType)) {
    fieldConfigCache.set(replyType, computeFieldConfig(replyType));
  }
  return fieldConfigCache.get(replyType)!;
}
```

---

### 优化点 3: 分层构建策略

对于门店数量特别多的品牌（>20个门店），可以使用更激进的策略：

```typescript
if (relevantStores.length > 20) {
  // 超大品牌：只显示前 3 个详细 + 5 个摘要
  fieldConfig.detailedStores = 3;
  fieldConfig.maxStores = 8;
} else if (relevantStores.length > 10) {
  // 大品牌：显示前 5 个详细 + 剩余摘要
  fieldConfig.detailedStores = 5;
  fieldConfig.maxStores = 10;
}
```

## 🧪 测试计划

### 测试矩阵

| 测试维度 | 测试用例数 | 覆盖率目标 |
|---------|-----------|-----------|
| 16种意图 × 字段配置 | 16 | 100% |
| Token 预算管理 | 10 | 边界情况 |
| 大中小品牌适配 | 15 | 1店 / 5店 / 20店 / 50店 |
| 区域过滤 + 字段过滤 | 8 | 组合场景 |
| 性能基准 | 5 | < 50ms |

### 回归测试清单

- [ ] 所有现有 API 测试通过
- [ ] 前端交互无变化
- [ ] 智能回复质量不下降
- [ ] Token 消耗在预算内
- [ ] 无性能回归

## 📚 参考资料

### 相关文档

- `lib/prompt-engineering/core/reply-builder.ts` - Prompt 构建器实现
- `types/zhipin.ts` - 类型定义和 Schema
- `CLAUDE.md` - 项目开发指南

### 外部参考

- [OpenAI Tokenizer](https://platform.openai.com/tokenizer)
- [Context Engineering 原则](./PROMPT_ENGINEERING_ARCHITECTURE.md)

## ✅ 实施检查清单

### Phase 1: 核心实现

- [ ] 定义 `FieldDisplayConfig` 接口
- [ ] 实现 `getFieldDisplayConfig()` 函数（16种意图配置）
- [ ] 实现 `estimateTokens()` 函数
- [ ] 实现 `buildPositionInfo()` 条件构建器
- [ ] 实现 `buildStoreSummary()` 摘要构建器
- [ ] 改造 `buildContextInfo()` 主函数

### Phase 2: 测试验证

- [ ] 编写单元测试（字段配置、token 估算）
- [ ] 编写集成测试（大中小品牌场景）
- [ ] 运行回归测试套件
- [ ] 性能基准测试

### Phase 3: 文档和监控

- [ ] 更新 `CLAUDE.md`
- [ ] 添加代码注释和 JSDoc
- [ ] 添加性能监控日志
- [ ] 创建示例和使用指南

### Phase 4: 部署和观察

- [ ] 在测试环境部署
- [ ] A/B 测试对比
- [ ] 收集用户反馈
- [ ] 根据数据调整配置

## 🔄 迭代优化路线图

### v1.0 - MVP（当前文档）

- ✅ 基础字段过滤
- ✅ Token 预算管理
- ✅ 分层展示策略

### v1.1 - 优化

- 🔲 精确 token 计数（使用 tokenizer）
- 🔲 智能字段优先级排序
- 🔲 基于用户反馈的配置调优

### v2.0 - 智能化

- 🔲 根据用户交互历史动态调整字段
- 🔲 A/B 测试不同配置策略
- 🔲 基于点击率优化门店排序

---

## 📞 联系方式

如有问题或建议，请联系：

- 项目仓库: [GitHub Issues](https://github.com/your-repo/issues)
- 文档维护: Claude Code
