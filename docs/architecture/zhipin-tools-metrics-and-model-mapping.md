# Zhipin Tools 指标说明与 RecruitFlow-Estimator 字段映射

本文档系统梳理当前 BOSS 直聘浏览器自动化工具可统计的数据指标、各指标的计算方法与逻辑依据，并将这些指标清晰映射到 Python 项目 `RecruitFlow-Estimator` 的训练数据字段，便于后续建模与评估。

## 工具清单

### BOSS直聘工具

- `lib/tools/zhipin/get-unread-candidates-improved.tool.ts` - 获取未读候选人列表
- `lib/tools/zhipin/get-chat-details.tool.ts` - 获取聊天详情和历史记录
- `lib/tools/zhipin/exchange-wechat.tool.ts` - 交换微信功能
- `lib/tools/zhipin/send-message.tool.ts` - 发送消息功能
- `lib/tools/zhipin/open-candidate-chat-improved.tool.ts` - 打开候选人聊天窗口

### Duliday系统工具

- `lib/tools/duliday/duliday-interview-booking-tool.ts` - 预约面试（用于统计面试转化）

## 数据采集能力矩阵

| 数据类型     | 获取能力      | 数据来源                                 | 备注                              |
| ------------ | ------------- | ---------------------------------------- | --------------------------------- |
| 候选人姓名   | ✅ 可直接获取 | `get-chat-details.tool.ts`               | candidateInfo.name                |
| 候选人职位   | ✅ 可直接获取 | `get-chat-details.tool.ts`               | candidateInfo.position            |
| 消息时间戳   | ✅ 可直接获取 | `get-chat-details.tool.ts`               | 支持 MM-DD HH:MM 格式             |
| 未读消息数   | ✅ 可直接获取 | `get-unread-candidates-improved.tool.ts` | unreadCount                       |
| 聊天记录     | ✅ 可直接获取 | `get-chat-details.tool.ts`               | chatMessages                      |
| 微信交换记录 | ✅ 可直接获取 | `get-chat-details.tool.ts`               | messageType === 'wechat-exchange' |
| 面试预约     | 🔄 间接统计   | `duliday-interview-booking-tool.ts`      | 通过调用次数统计                  |
| 候选人手机号 | ❌ 无法获取   | -                                        | 平台不显示                        |
| 候选人微信号 | ⚠️ 交换后可见 | `get-chat-details.tool.ts`               | 仅在交换成功后的消息中显示        |
| 候选人唯一ID | ❌ 无法获取   | -                                        | 平台不提供                        |
| 上岗数据     | ❌ 无法获取   | -                                        | 需要外部系统或人工输入            |
| 跨账号关联   | ❌ 无法实现   | -                                        | 只能基于姓名推断，存在重名风险    |

时间窗口说明：除特别说明外，以下"今日/当日"均指一个明确统计窗口（建议以自然日 + 时区统一）。所有计数应以"候选人入站消息事件"为基础，再派生去重、回复、微信交换等衍生指标。

---

## 事件类型模型

系统使用事件溯源模式记录招聘过程中的关键节点，事件存储在 `recruitment_events` 表中。

### 核心事件类型

| 事件类型 | 触发场景 | 语义 | `was_unread_before_reply` |
|---------|---------|------|---------------------------|
| `MESSAGE_RECEIVED` | `get_unread_candidates` 检测到未读消息 | **入站事件**：候选人 → 我们 | `true`（始终） |
| `CANDIDATE_CONTACTED` | `say_hello` 主动打招呼成功 | **主动出站事件**：我们主动联系 → 候选人 | `false`（无先前未读） |
| `MESSAGE_SENT` | `send_message` 回复候选人消息 | **回复出站事件**：我们 → 候选人 | `true`=立即回复，`false`=延迟回复 |
| `WECHAT_EXCHANGED` | 检测到微信交换成功 | **转化事件**：微信获取 | - |
| `INTERVIEW_BOOKED` | `duliday_interview_booking` 成功 | **转化事件**：面试预约 | - |

### 事件流示例

```
T1: 候选人张三发送消息
T2: get_unread_candidates 检测到 → 记录 MESSAGE_RECEIVED (unread_count=1, was_unread=true)
T3: LLM 分析后决定跳过（无事件）
T4: 用户手动回复 → 记录 MESSAGE_SENT (was_unread=false，因为 T2~T4 间隔过长)

T5: say_hello 主动向李四打招呼 → 记录 CANDIDATE_CONTACTED (was_unread=false)
T6: 李四回复
T7: get_unread_candidates 检测到 → 记录 MESSAGE_RECEIVED
T8: Agent 立即回复 → 记录 MESSAGE_SENT (was_unread=true，立即回复)
```

### 字段说明

- **`unread_count_before_reply`**：`MESSAGE_RECEIVED` 事件中记录检测到的未读消息数量，用于计算 Total Flow
- **`was_unread_before_reply`**：标识回复时是否为立即回复（`true`）还是延迟回复（`false`）
- **`message_sequence`**：同一会话中的消息序号，用于追踪对话轮次

---

## 指标定义、计算方法与逻辑依据

### 1) 入站与去重相关

- 指标：Total Flow（当日总咨询事件数）
  - 定义：统计窗口内，候选人发来的所有入站消息"事件数"（同一人多条消息均计入）。
  - 计算（基于事件表）：
    ```sql
    SELECT SUM(unread_count_before_reply)
    FROM recruitment_events
    WHERE event_type = 'message_received'
      AND event_time BETWEEN :start AND :end
    ```
  - 依据：这是需求侧真实"流量事件"，不受我方运营策略（回复频次）影响；与 RecruitFlow-Estimator 用户手册中"总咨询事件(事件数而非人数)"定义一致。
  - 数据来源：`MESSAGE_RECEIVED` 事件的 `unread_count_before_reply` 字段累加。
  - **精度说明**：由于 `get_unread_candidates` 可能在候选人发送多条消息后才被调用，`unread_count` 可能大于实际新增消息数。这是可接受的近似值。

- 指标：Inbound Candidates（入站候选人数，原 Unique Candidates / candidates_contacted）
  - 定义：统计窗口内至少有一条入站消息的候选人数量。
  - **字段名变更**：数据库字段从 `candidates_contacted` 重命名为 `inbound_candidates`，以区分主动触达场景。
  - 计算（基于事件表）：
    ```sql
    SELECT COUNT(DISTINCT candidate_key)
    FROM recruitment_events
    WHERE event_type = 'message_received'
      AND event_time BETWEEN :start AND :end
    ```
  - 依据：代表"咨询岗位的人数"（去重后的人数）。
  - 数据来源：`MESSAGE_RECEIVED` 事件按 `candidate_key` 去重计数。

- 指标：Repeat Rate（当日跨账号重复候选人率）
  - 定义：以"候选人-账号-当日"的会话为事件（会话事件），若同一候选人在同一统计日内咨询了多个账号，则视为重复。该指标衡量跨账号重复带来的"会话事件"冗余比例。
  - 计算：
    - 先构造当日"会话事件"集合 `sessions_day = {(candidate_name, account_id) | 当日该组合存在至少一条入站消息}`。
    - 令 `TotalFlow_session = |sessions_day|`，`UniqueCandidates_day = |{candidate_name}|`（基于姓名去重的候选人数）。
    - 则 `RepeatRate = (TotalFlow_session − UniqueCandidates_day) / TotalFlow_session`。
  - **实现限制**：
    - 当前只能基于候选人姓名进行跨账号去重，存在重名风险（概率较低，可接受）
    - 无法获取候选人的唯一标识（如手机号、站内ID）
    - 建议记录：候选人姓名 + 账号名称 + 时间戳作为会话标识
  - 可选细分：同岗位跨账号重复率（Same-Position Repeat Rate）
    - 仅统计候选人在"同一岗位"上跨账号重复咨询的比例
    - 需要业务层面统一规范：BOSS直聘岗位名称必须与Duliday系统保持一致
  - 依据：贴合运营现实：多个账号可能发布相同岗位，候选人跨账号咨询导致重复统计；本指标用于在"会话事件口径"上做去重修正。
  - 工具/来源：从多账号聚合的当日数据中构造 `sessions_day`，使用候选人姓名作为标识。

- 指标：Avg Repeat Degree（当日重复者平均重复次数）
  - 定义：仅在 m_i > 1 的候选人集合上的平均消息条数。
  - 计算：Avg Repeat Degree = (Σ\_{m_i>1} m_i) / |{i | m_i>1}|。
  - 依据：用于更精细地刻画重复行为，亦可作为 Python 模型 `avg_repeat_degree` 的经验估计值。
  - 工具/来源：`get-chat-details.tool.ts`。

备注：`get-unread-candidates-improved.tool.ts` 的 `unreadCount` 刻画“积压未读”，不等价于“当日总咨询事件”。应作为运营健康度/待处理工作量的侧向指标。

### 2) 回复相关

- 指标：Replied Candidates（当日被回复的入站候选人数）
  - 定义：统计窗口内，入站候选人中至少有一条我方回复消息的候选人数量。
  - 计算（基于事件表）：
    ```sql
    -- 只统计入站候选人中被回复的数量
    -- 确保 reply_rate = candidates_replied / candidates_contacted <= 100%
    SELECT COUNT(DISTINCT candidate_key)
    FROM recruitment_events
    WHERE event_type = 'message_sent'
      AND event_time BETWEEN :start AND :end
      AND candidate_key IN (
        SELECT DISTINCT candidate_key
        FROM recruitment_events
        WHERE event_type = 'message_received'
          AND event_time BETWEEN :start AND :end
      )
    ```
  - 依据：反映入站候选人的回复覆盖率。主动打招呼（CANDIDATE_CONTACTED）后的回复不计入此指标。
  - 数据来源：`MESSAGE_SENT` 事件与 `MESSAGE_RECEIVED` 事件做交集，按 `candidate_key` 去重计数。

- 指标：Reply Count（当日我方回复总次数）
  - 定义：我方发出的消息总条数。
  - 计算（基于事件表）：
    ```sql
    SELECT COUNT(*)
    FROM recruitment_events
    WHERE event_type = 'message_sent'
      AND event_time BETWEEN :start AND :end
    ```
  - 依据：反映运营强度，不用于定义 Total Flow。
  - 数据来源：`MESSAGE_SENT` 事件计数。

- 指标：Reply Rate（回复率）
  - 定义：被回复的候选人数占入站候选人数的比例。
  - 计算：`Reply Rate = Replied Candidates / Unique Candidates`
  - 依据：衡量响应覆盖程度。

- 指标：Immediate Reply Count（立即回复次数）
  - 定义：检测到未读后立即回复的消息数。
  - 计算（基于事件表）：
    ```sql
    SELECT COUNT(*)
    FROM recruitment_events
    WHERE event_type = 'message_sent'
      AND was_unread_before_reply = true
      AND event_time BETWEEN :start AND :end
    ```
  - 依据：反映 Agent 实时响应能力，用于诊断 SLA 达成率。

### 2.5) 出站漏斗（主动触达）

> **说明**：出站漏斗追踪通过 `say_hello` 工具主动打招呼的效果，与入站漏斗（候选人主动联系我们）分开统计。

- 指标：Proactive Outreach（主动触达候选人数）
  - 定义：统计窗口内通过 `say_hello` 主动打招呼的候选人数量。
  - 计算（基于事件表）：
    ```sql
    SELECT COUNT(DISTINCT candidate_key)
    FROM recruitment_events
    WHERE event_type = 'candidate_contacted'
      AND event_time BETWEEN :start AND :end
    ```
  - 数据来源：`CANDIDATE_CONTACTED` 事件按 `candidate_key` 去重计数。
  - 数据库字段：`proactive_outreach`

- 指标：Proactive Responded（主动触达后回复的候选人数）
  - 定义：我们主动打招呼后，对方回复了消息的候选人数量。
  - 计算（基于事件表）：
    ```sql
    -- 主动触达候选人中收到对方回复的数量
    SELECT COUNT(DISTINCT candidate_key)
    FROM recruitment_events
    WHERE event_type = 'message_received'
      AND event_time BETWEEN :start AND :end
      AND candidate_key IN (
        SELECT DISTINCT candidate_key
        FROM recruitment_events
        WHERE event_type = 'candidate_contacted'
          AND event_time BETWEEN :start AND :end
      )
    ```
  - 数据来源：`MESSAGE_RECEIVED` 事件与 `CANDIDATE_CONTACTED` 事件做交集，按 `candidate_key` 去重计数。
  - 数据库字段：`proactive_responded`

- 指标：Response Rate（主动触达回复率）
  - 定义：主动打招呼后对方回复的比例。
  - 计算：`Response Rate = Proactive Responded / Proactive Outreach`
  - 依据：衡量主动触达的效果，用于评估候选人列表质量和打招呼话术效果。

### 3) 微信交换相关

- 指标：WeChat Obtained Candidates（当日获取到微信号的候选人数）
  - 定义：统计窗口内发生"微信交换"事件的候选人数。
  - 计算（基于事件表）：
    ```sql
    SELECT COUNT(DISTINCT candidate_key)
    FROM recruitment_events
    WHERE event_type = 'wechat_exchanged'
      AND event_time BETWEEN :start AND :end
    ```
  - 数据来源：`WECHAT_EXCHANGED` 事件按 `candidate_key` 去重计数。
  - 触发方式：
    1. `exchange-wechat.tool.ts` 成功交换时记录
    2. `get-chat-details.tool.ts` 检测到 `messageType === 'wechat-exchange'` 时补录

- 指标：WeChat Conversion Rate（微信转化率）
  - 定义：获取微信的候选人数占入站候选人数的比例。
  - 计算：`WeChat Conversion Rate = WeChat Obtained Candidates / Unique Candidates`
  - 依据：衡量招聘漏斗第一级转化效率。

### 4) 积压/排序辅助指标（可选）

- 指标：Unread Candidates（当前有未读的候选人数）
  - 定义：当前列表中 `hasUnread === true` 的候选人数。
  - 工具/来源：`get-unread-candidates-improved.tool.ts`。

- 指标：Total Unread Count（当前未读消息总数）
  - 定义：当前列表中所有候选人的 `unreadCount` 之和。
  - 工具/来源：`get-unread-candidates-improved.tool.ts`。

---

## 计算口径与时间解析

- **时间解析能力**：
  - 当前支持格式：`\d{1,2}:\d{2}(?::\d{2})?` (HH:MM格式) 和 `\d{4}-\d{2}-\d{2}` (MM-DD格式)
  - DOM中存在时间标签：`<span class="time">08-19 14:30</span>` 或 `<span class="time">昨天 10:14</span>`
  - **建议增强**：改进正则表达式以完整捕获相对时间标记（昨天/今天/前天）
  ```javascript
  const timeMatch = msgText.match(
    /(昨天|今天|前天)?\s*(\d{1,2}:\d{2}(?::\d{2})?)|(\d{4}-\d{2}-\d{2}\s*\d{1,2}:\d{2})/
  );
  ```
- **统计窗口**：建议使用 `[startOfDay, endOfDay)` 且指定时区（如 `Asia/Shanghai`）
- **会话-候选人关系**：
  - 一个会话视为一位候选人
  - 基于候选人姓名进行去重（接受重名风险）
  - 建议记录格式：`agentId_candidateKey_YYYY-MM-DD` 作为会话唯一标识（确保账号隔离）

---

## 数据分层与默认口径

- 消息事件（message-level）：单条入站消息。适合衡量工作量与 Token 成本。
- 会话事件（session-level）：当日“候选人-账号”是否有入站消息（至多记1）。适合跨账号去重分析与模型映射。

本文档在模型映射（flows / repeat_rates）上采用“会话事件口径”（session-level）。

---

## 与 RecruitFlow-Estimator 数据字段映射

下表给出"事件表指标 → Python 训练数据字段"的映射。数据来源统一为 `recruitment_events` 表。

| 指标 | 事件表计算公式 | Python 字段 | 说明 |
|------|---------------|-------------|------|
| Total Flow | `SUM(unread_count_before_reply) WHERE event_type='message_received'` | flows | 入站消息总数 |
| Unique Candidates | `COUNT(DISTINCT candidate_key) WHERE event_type='message_received'` | - | 用于计算转化率 |
| Replied Candidates | `COUNT(DISTINCT candidate_key) WHERE event_type='message_sent'` | - | 被回复的候选人数 |
| Reply Rate | `Replied Candidates / Unique Candidates` | - | 响应覆盖率 |
| WeChat Obtained | `COUNT(DISTINCT candidate_key) WHERE event_type='wechat_exchanged'` | - | 获取微信的候选人数 |
| WeChat Conversion Rate | `WeChat Obtained / Unique Candidates` | wechat_conversions | 微信转化率 |
| Interview Booked | `COUNT(DISTINCT candidate_key) WHERE event_type='interview_booked'` | - | 预约面试的候选人数 |
| Interview Rate | `Interview Booked / WeChat Obtained` | interview_rates | 面试转化率 |
| Onboard Rate | 外部系统数据 | onboard_rates | 需人工输入 |

### 聚合字段映射（recruitment_daily_stats 表）

| 聚合字段 | 计算公式 | 说明 |
|---------|---------|------|
| `messages_received` | `SUM(unread_count_before_reply) WHERE event_type='message_received'` | Total Flow（入站消息总数） |
| `inbound_candidates` | `COUNT(DISTINCT candidate_key) WHERE event_type='message_received'` | 入站候选人数 |
| `messages_sent` | `COUNT(*) WHERE event_type='message_sent'` | 发送消息次数 |
| `candidates_replied` | `COUNT(DISTINCT candidate_key) WHERE event_type='message_sent' AND candidate_key IN (入站候选人)` | 被回复的入站候选人数 |
| `wechats_exchanged` | `COUNT(DISTINCT candidate_key) WHERE event_type='wechat_exchanged'` | 获取微信的候选人数 |
| `interviews_booked` | `COUNT(DISTINCT candidate_key) WHERE event_type='interview_booked'` | 预约面试的候选人数 |

说明：
- `messages_received` 字段名保持不变以兼容现有代码，但语义改为 Total Flow（入站消息总数）
- `inbound_candidates` 统计入站候选人数（区别于 `proactive_outreach` 主动触达候选人数）

---

## 指标到模型的落地公式

基于 `recruitment_events` 表的事件驱动计算：

```sql
-- 统计窗口: 当日 [startOfDay, endOfDay) Asia/Shanghai

-- Total Flow（入站消息总数）
SELECT SUM(unread_count_before_reply) AS total_flow
FROM recruitment_events
WHERE event_type = 'message_received'
  AND event_time BETWEEN :start AND :end;

-- Unique Candidates（入站候选人数，去重）
SELECT COUNT(DISTINCT candidate_key) AS unique_candidates
FROM recruitment_events
WHERE event_type = 'message_received'
  AND event_time BETWEEN :start AND :end;

-- WeChat Obtained（获取微信的候选人数）
SELECT COUNT(DISTINCT candidate_key) AS wechat_obtained
FROM recruitment_events
WHERE event_type = 'wechat_exchanged'
  AND event_time BETWEEN :start AND :end;

-- 转化率计算
wechat_conversions = wechat_obtained / unique_candidates
```

以上值可直接作为 `RecruitFlow-Estimator` 的训练样本输入。

---

## 指标采集参考实现

### 事件记录（工具层）

事件在工具执行时自动记录，无需手动采集：

```ts
// 1) get_unread_candidates 检测到未读时记录 MESSAGE_RECEIVED
// lib/services/recruitment-event/step-handlers.ts
export async function handleUnreadCandidatesEvent(ctx: RecruitmentContext, result: unknown) {
  for (const candidate of unreadCandidates) {
    const event = recruitmentEventService
      .event(ctx)
      .candidate({ name: candidate.name, position: candidate.position })
      .withUnreadContext(candidate.unreadCount || 0)
      .messageReceived(candidate.unreadCount || 0, candidate.preview); // MESSAGE_RECEIVED 事件
    recruitmentEventService.recordAsync(event);
  }
}

// 2) send_message 回复时记录 MESSAGE_SENT
// lib/tools/zhipin/send-message.tool.ts
await recordMessageSentEvent({
  platform: SourcePlatform.ZHIPIN,
  candidate: { name, position },
  unreadCount: unreadCountBeforeReply, // 决定 was_unread_before_reply
  message: content,
});

// 3) say_hello 主动打招呼时记录 CANDIDATE_CONTACTED
// lib/tools/zhipin/say-hello-simple.tool.ts
await recordCandidateContactedEvent({
  platform: SourcePlatform.ZHIPIN,
  candidate: { name, position },
});

// 4) exchange_wechat 或检测到微信交换时记录 WECHAT_EXCHANGED
await recordWechatExchangedEvent({
  platform: SourcePlatform.ZHIPIN,
  candidate: { name, position },
  wechatNumber,
});
```

### 指标聚合（定时任务）

```ts
// lib/services/recruitment-stats/aggregation.service.ts
const stats = await db
  .select({
    // Total Flow: 入站消息总数
    messagesReceived: sql<number>`COALESCE(SUM(${recruitmentEvents.unreadCountBeforeReply})
      FILTER (WHERE ${recruitmentEvents.eventType} = 'message_received'), 0)`,

    // Unique Candidates: 入站候选人数
    candidatesContacted: sql<number>`COUNT(DISTINCT ${recruitmentEvents.candidateKey})
      FILTER (WHERE ${recruitmentEvents.eventType} = 'message_received')`,

    // Replied Candidates: 被回复的入站候选人数
    // 注意：需要单独查询，使用子查询与入站候选人做交集
    // candidatesReplied = COUNT(DISTINCT candidate_key)
    //   WHERE event_type='message_sent'
    //   AND candidate_key IN (SELECT candidate_key WHERE event_type='message_received')

    // WeChat Obtained: 获取微信的候选人数
    wechatsExchanged: sql<number>`COUNT(DISTINCT ${recruitmentEvents.candidateKey})
      FILTER (WHERE ${recruitmentEvents.eventType} = 'wechat_exchanged')`,
  })
  .from(recruitmentEvents)
  .where(and(
    gte(recruitmentEvents.eventTime, startOfDay),
    lt(recruitmentEvents.eventTime, endOfDay),
  ));
```

---

## 设计选择的理由（Why）

- Total Flow 采用“候选人入站事件数”而非“回复次数/咨询人数”：
  - 回复次数受运营节奏影响，不能代表需求侧真实流量；
  - 咨询人数（去重后）会丢失重复咨询强度这一关键信号；
  - 因此以“事件数”为基础更有辨识力，并与 Python 模型定义一致。

- 微信获取以聊天记录为准：
  - 点击成功并不等于对方接受；聊天记录包含平台生成的“微信交换”卡片与内容，事实性更强；
  - 点击回执用于冗余校验与过程监控。

- 未读指标单独建模：
  - `unreadCount` 反映当前积压，不应混入“当日入站流量”；
  - 但它可用于解释“延迟回复 → 转化下降”的因果迹象。

---

## 数据质量与工程建议

### 时间处理

- **当前能力**：支持提取 `MM-DD HH:MM` 和 `昨天/今天 HH:MM` 格式
- **建议增强**：改进正则表达式以完整识别相对时间标记，转换为绝对时间戳
- **实现建议**：在采集时记录系统时间作为参考基准

### 候选人去重策略

- **当前限制**：只能基于候选人姓名进行去重
- **风险说明**：存在重名可能性，但概率较低（可接受）
- **记录格式**：`agentId_candidateKey_YYYY-MM-DD` 作为会话唯一标识
- **未来优化**：若能获取微信号（交换后），可作为辅助去重依据

### 数据采集埋点

- **Unread Replied指标**：需要在Agent层实现发送前的数据采集
- **面试转化统计**：在Agent层统计 `duliday_interview_booking` 调用次数
- **微信交换验证**：以聊天记录中的 `messageType === 'wechat-exchange'` 为准

### 岗位归一化

- **业务规范**：BOSS直聘发布的岗位名称必须与Duliday系统保持一致
- **技术方案**：建立岗位名称映射表（已在 Schema `dictionaryTypeEnum` 中添加 `position` 类型支持）
- **降级策略**：无法映射时，使用原始岗位名称

### 账号维度采集

- 若能按账号采集，则 `flows` 可直接取"账号平均值"，避免等分误差
- 建议记录每个账号的独立统计数据，便于分析账号质量差异

## 实施优先级建议

### 立即可实现 ✅

1. 基于姓名的候选人去重统计
2. 消息时间戳提取和统计
3. 微信交换数据统计（从聊天记录）
4. 基础的流量和回复统计

### 需要Agent层配合 🔄

1. Unread Replied指标（发送前记录未读数）
2. 面试转化率统计（统计Duliday工具调用）
3. 跨账号数据聚合

### 需要业务流程改进 ⚠️

1. 岗位名称统一规范
2. 上岗数据收集流程
3. 账号质量分级体系

### 未来优化方向 🚀

1. 增强时间解析能力
2. 基于微信号的辅助去重（交换后）
3. 接入外部系统获取上岗数据
4. 建立完整的数据追踪体系

---

以上口径与映射确保前端工具的可观测指标能无缝对接 Python 端的训练数据结构，支撑稳定、可复现的建模与预测流程。文档明确标注了当前能力边界和实施限制，为后续迭代优化提供清晰指引。
