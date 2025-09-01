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

| 数据类型 | 获取能力 | 数据来源 | 备注 |
|---------|---------|---------|-----|
| 候选人姓名 | ✅ 可直接获取 | `get-chat-details.tool.ts` | candidateInfo.name |
| 候选人职位 | ✅ 可直接获取 | `get-chat-details.tool.ts` | candidateInfo.position |
| 消息时间戳 | ✅ 可直接获取 | `get-chat-details.tool.ts` | 支持 MM-DD HH:MM 格式 |
| 未读消息数 | ✅ 可直接获取 | `get-unread-candidates-improved.tool.ts` | unreadCount |
| 聊天记录 | ✅ 可直接获取 | `get-chat-details.tool.ts` | chatMessages |
| 微信交换记录 | ✅ 可直接获取 | `get-chat-details.tool.ts` | messageType === 'wechat-exchange' |
| 面试预约 | 🔄 间接统计 | `duliday-interview-booking-tool.ts` | 通过调用次数统计 |
| 候选人手机号 | ❌ 无法获取 | - | 平台不显示 |
| 候选人微信号 | ⚠️ 交换后可见 | `get-chat-details.tool.ts` | 仅在交换成功后的消息中显示 |
| 候选人唯一ID | ❌ 无法获取 | - | 平台不提供 |
| 上岗数据 | ❌ 无法获取 | - | 需要外部系统或人工输入 |
| 跨账号关联 | ❌ 无法实现 | - | 只能基于姓名推断，存在重名风险 |

时间窗口说明：除特别说明外，以下"今日/当日"均指一个明确统计窗口（建议以自然日 + 时区统一）。所有计数应以"候选人入站消息事件"为基础，再派生去重、回复、微信交换等衍生指标。

---

## 指标定义、计算方法与逻辑依据

### 1) 入站与去重相关

- 指标：Total Flow（当日总咨询事件数）
  - 定义：统计窗口内，候选人发来的所有入站消息“事件数”（同一人多条消息均计入）。
  - 计算：对每个会话统计 `sender === 'candidate'` 的消息条数 `m_i`，Total Flow = Σ m_i。
  - 依据：这是需求侧真实“流量事件”，不受我方运营策略（回复频次）影响；与 RecruitFlow-Estimator 用户手册中“总咨询事件(事件数而非人数)”定义一致。
  - 工具/来源：`get-chat-details.tool.ts` 返回的 `chatMessages` 中按 `sender` 判定。

- 指标：Unique Candidates（当日独特候选人数）
  - 定义：统计窗口内至少有一条入站消息的候选人数量。
  - 计算：Unique Candidates（当日）= 当日内“存在至少一条 `sender==='candidate'` 且时间落入统计窗口”的会话数量。仅存在历史（非当日）消息而当日无入站的会话不计入。
  - 模式：
    - 严格模式（推荐）：仅当消息带可解析为当日的绝对/规范化时间戳才计入，否则不计入。
    - 宽松模式（备选）：对无日期仅有“HH:MM”的消息，结合页面“今天/昨天”分隔或最新系统分隔标签推断当日；无法推断时不计入。
  - 依据：代表“咨询岗位的人数”（去重后的人数）。
  - 工具/来源：`get-chat-details.tool.ts`（每个会话代表一位候选人）。

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

- 指标：Replied Candidates（当日被回复的候选人数）
  - 定义：统计窗口内至少有一条我方消息的候选人数量。
  - 计算：计数会话中 `sender === 'recruiter'` 且时间落在窗口内。
  - 依据：反映覆盖率。
  - 工具/来源：`get-chat-details.tool.ts`。

- 指标：Reply Count（当日我方回复总次数）
  - 定义：我方发出的消息总条数。
  - 计算：Σ 会话内 `sender === 'recruiter'` 的消息条数。
  - 依据：反映运营强度，不用于定义 Total Flow。
  - 工具/来源：`get-chat-details.tool.ts`。

- 指标：Unread Replied（当次回复时未读消息合计）
  - 定义：对当日每次"发送前"抓取该会话的 `unreadCount` 累加。
  - 计算：在Agent调用层实现，发送动作前调用 `get-unread-candidates-improved.tool.ts` 获取目标候选人的 `unreadCount`，累加到统计中。
  - **实现方案**：
    ```javascript
    // Agent层实现示例
    const unreadList = await getUnreadCandidatesImproved();
    const candidate = unreadList.find(c => c.name === targetName);
    const unreadCount = candidate?.unreadCount || 0;
    await sendMessage(message);
    stats.unreadReplied += unreadCount;
    ```
  - 依据：反映"回复时积压强度"，便于诊断 SLA 与漏斗损耗。
  - 工具/来源：`get-unread-candidates-improved.tool.ts`（需要在Agent层实现发送前的数据采集）。

### 3) 微信交换相关

- 指标：WeChat Obtained Candidates（当日获取到微信号的候选人数）
  - 定义：统计窗口内发生“微信交换”事件的候选人数。
  - 计算：
    1. `get-chat-details.tool.ts` 中 `messageType === 'wechat-exchange'` 的会话计数；
    2. 与 `exchange-wechat.tool.ts` 的成功回执交叉验证（若存在差异，以聊天记录为准）。
  - 依据：聊天记录是事实来源，点击回执作为冗余校验。
  - 工具/来源：两者联合，主以 `get-chat-details.tool.ts` 为准。

- 指标：WeChat Exchange Events（当日微信交换事件次数）
  - 定义：发生“微信交换”的事件总数（同一会话多次也累计）。
  - 计算：统计 `messageType === 'wechat-exchange'` 的消息条数。
  - 依据：反映操作频度与重复尝试。
  - 工具/来源：`get-chat-details.tool.ts`。

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
  - 建议记录格式：`候选人姓名_账号名称_日期` 作为会话唯一标识

---

## 数据分层与默认口径

- 消息事件（message-level）：单条入站消息。适合衡量工作量与 Token 成本。
- 会话事件（session-level）：当日“候选人-账号”是否有入站消息（至多记1）。适合跨账号去重分析与模型映射。

本文档在模型映射（flows / repeat_rates）上采用“会话事件口径”（session-level）。

---

## 与 RecruitFlow-Estimator 数据字段映射

下表给出“工具侧指标 → Python 训练数据字段”的一对一或一对多映射。若为多账号聚合，需先按账号分摊/归一。

| 工具侧指标                      | 定义/窗口（默认会话事件口径）                | 计算公式                                                       | 逻辑依据                                       | Python 字段           | 跨账号聚合口径                            |
| ------------------------------- | -------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------- | --------------------- | ----------------------------------------- |
| Total Flow（会话事件）          | 当日"候选人-账号"存在入站消息的事件总数      | TotalFlow_session = \|sessions_day\|                           | 会话事件更贴近"咨询会话"流量，避免消息粒度噪声 | flows（单账号日流量） | flows = TotalFlow_session / 账号数        |
| Unique Candidates（人数）       | 当日至少一次入站消息的候选人数（跨账号去重） | UniqueCandidates_day = \|{candidate_id}\|                      | 人数口径（去重后）                             | （不直接入表）        | 用于推导 repeat_rates 与转化率            |
| Repeat Rate（跨账号重复候选人） | 跨账号重复导致的会话事件冗余比例             | (TotalFlow_session − UniqueCandidates_day) / TotalFlow_session | 贴合"同一候选人多账号咨询"的现实重复问题       | repeat_rates          | 直接以全量计算后作为当日值                |
| Avg Repeat Degree               | 重复者平均重复次数（消息口径，参考）         | Σ\_{m_i>1} m_i / count(m_i>1)                                  | 补充刻画重复强度（消息层），可做分析特征       | （可选）              | 可作为分析特征，模型中默认2.5             |
| WeChat Conversion Rate          | 微信转化率                                   | WeChatObtained / UniqueCandidates_day                          | RecruitFlow-Estimator 的 wechat_conversions    | wechat_conversions    | WeChatObtained 为"当日获得微信的候选人数" |
| Interview Rate                  | 面试转化率                                   | duliday_interview_booking调用次数 / wechat_adds                | 通过Duliday工具调用统计                        | interview_rates       | 使用duliday-interview-booking-tool.ts统计 |
| Onboard Rate                    | 上岗转化率                                   | onboards / interviews                                          | 需要外部系统或人工输入                         | onboard_rates         | 暂时通过人工预估或默认分布采样             |

说明：

- flows 的“单账号日流量”需由总事件数按账号数均分（或直接按账号维度采集后再求均值）。
- wechat_conversions 的分母应为 Unique Candidates（独特人数），对应用户手册与模型实现。

---

## 指标到模型的落地公式

设（会话事件口径）：

- 账号数 `A`，统计窗口为 1 天；
- `sessions_day = {(candidate_id, account_id) | 当日该组合存在至少一条入站消息}`；
- `WeChatObtained` 为当日有 `wechat-exchange` 的候选人数（按候选人去重）。

则：

```
TotalFlow_session = |sessions_day|
UniqueCandidates_day = |{ candidate_id }|
RepeatRate = (TotalFlow_session − UniqueCandidates_day) / TotalFlow_session

flows (per-account) = TotalFlow_session / A
wechat_conversions = WeChatObtained / UniqueCandidates_day
```

以上两列值（`flows`, `repeat_rates`, `wechat_conversions`）即可直接作为 `RecruitFlow-Estimator` 的训练样本输入；`interview_rates`, `onboard_rates` 如暂无，可留空或以先验 Beta 分布采样。

---

## 指标采集参考实现（伪代码）

```ts
// 1) 拉取会话详情（需包含消息方向与时间），按账号分别执行
//    注意：仅当某会话当日存在至少一条候选人入站消息，才视为一条"会话事件"
const sessionsDay: Array<{ 
  accountId: string; 
  candidateName: string;  // 使用姓名作为标识
  positionKey?: string 
}> = [];

// 面试预约统计
let interviewBookings = 0;

for (const account of allAccounts) {
  const { chatMessages, candidateInfo } = await getChatDetails(account);

  // 2) 过滤统计窗口内的候选人入站消息
  const inboundToday = chatMessages.filter(m => m.sender === "candidate" && inDateRange(m.time));

  if (inboundToday.length > 0) {
    // 使用候选人姓名作为标识（接受重名风险）
    const candidateName = candidateInfo?.name || "未知";
    const positionKey = candidateInfo?.position;  // 岗位名称需要与Duliday保持一致
    
    sessionsDay.push({ 
      accountId: account.id, 
      candidateName, 
      positionKey 
    });
  }
}

// 3) 会话事件与候选人聚合（基于姓名去重）
const totalFlowSession = sessionsDay.length;
const uniqueCandidatesDay = new Set(sessionsDay.map(s => s.candidateName)).size;

// 4) 跨账号重复率（会话事件口径）
const repeatRate =
  totalFlowSession > 0 ? (totalFlowSession - uniqueCandidatesDay) / totalFlowSession : 0;

// 5) 微信新增（按候选人姓名去重）
const wechatObtainedCandidates = countWeChatObtainedCandidatesInDay();
const wechatConversionRate =
  uniqueCandidatesDay > 0 ? wechatObtainedCandidates / uniqueCandidatesDay : 0;

// 6) 面试转化率（通过Duliday工具统计）
// 注意：需要在Agent层统计duliday_interview_booking的调用次数
const interviewRate = 
  wechatObtainedCandidates > 0 ? interviewBookings / wechatObtainedCandidates : 0;

// 7) 映射到模型字段
const flowsPerAccount = totalFlowSession / accountCount;
const sample = {
  flows: flowsPerAccount,
  repeat_rates: repeatRate,
  wechat_conversions: wechatConversionRate,
  interview_rates: interviewRate,
  onboard_rates: 0.08  // 暂时使用默认值或人工输入
};
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
- **记录格式**：`候选人姓名_账号名称_日期` 作为会话唯一标识
- **未来优化**：若能获取微信号（交换后），可作为辅助去重依据

### 数据采集埋点
- **Unread Replied指标**：需要在Agent层实现发送前的数据采集
- **面试转化统计**：在Agent层统计 `duliday_interview_booking` 调用次数
- **微信交换验证**：以聊天记录中的 `messageType === 'wechat-exchange'` 为准

### 岗位归一化
- **业务规范**：BOSS直聘发布的岗位名称必须与Duliday系统保持一致
- **技术方案**：建立岗位名称映射表（需要业务层面维护）
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
