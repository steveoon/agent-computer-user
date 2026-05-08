# Recruitment Events Open API

## 结论

`POST /api/v1/recruitment-events` 是统一的招聘埋点写入接口，所有 zhipin/yupao/Duliday/人工补录统计事件都通过 `eventType + details` 区分，不开放任何 `zhipin_*` 浏览器自动化工具。

## 三层架构

```text
外部系统 / Bot / RPA / 后台
  -> POST /api/v1/recruitment-events
  -> app_huajune.recruitment_events
  -> GET /api/v1/recruitment-stats/summary | trend
```

| 层级 | 接口 | 作用 |
|---|---|---|
| 写入层 | `POST /api/v1/recruitment-events` | 写入招聘事件 |
| 汇总查询 | `GET /api/v1/recruitment-stats/summary` | 查询 Dashboard 汇总 |
| 趋势查询 | `GET /api/v1/recruitment-stats/trend` | 查询日趋势 |

## 环境地址

| 环境 | Base URL | 说明 |
|---|---|---|
| 生产 | `https://huajune.duliday.com` | 正式接入地址 |

后续示例统一使用环境变量：

```bash
export OPEN_API_BASE_URL="https://huajune.duliday.com"
export OPEN_API_TOKEN="<OPEN_API_TOKEN>"
```

## 鉴权

所有 `/api/v1/*` 请求都需要：

```http
Authorization: Bearer <OPEN_API_TOKEN>
Content-Type: application/json
```

当前阶段外部鉴权服务只负责验证 token 是否有效：

```json
{
  "isSuccess": true,
  "message": "验证成功"
}
```

暂不做 `key -> agentId` 数据范围控制。认证通过后，项目会临时按 `allowedAgentIds: ["*"]` 处理，因此请求中的 `agentId` 可直接使用需要写入或查询的 Agent 标识。

后续如果要做细粒度数据权限，应在本项目内维护 `key -> allowedAgentIds` 映射，而不是要求 `OPEN_API_AUTH_URL` 返回业务授权范围。

## 写入端

### 接口

```http
POST /api/v1/recruitment-events
```

### 通用请求结构

```json
{
  "events": [
    {
      "idempotencyKey": "source-system-event-id",
      "agentId": "siwen-zhipin-1",
      "sourcePlatform": "zhipin",
      "dataSource": "api_callback",
      "eventType": "message_sent",
      "eventTime": "2026-05-07T10:00:00+08:00",
      "candidate": {
        "name": "张三",
        "position": "服务员",
        "age": "21岁",
        "gender": "男",
        "education": "本科",
        "expectedSalary": "3000-4000元",
        "expectedLocation": "上海"
      },
      "job": {
        "jobId": 7,
        "jobName": "肯德基服务员"
      },
      "brandId": 88,
      "details": {}
    }
  ]
}
```

### 通用字段

| 字段 | 必填 | 说明 |
|---|---:|---|
| `events` | 是 | 事件数组，最多 `100` 条 |
| `idempotencyKey` | 建议 | 外部事件唯一键；同一 `agentId + idempotencyKey` 重复调用返回 `existing` |
| `agentId` | 是 | Agent/账号标识；当前阶段 token 只做有效性校验，暂不限制可访问的 `agentId` 范围 |
| `sourcePlatform` | 否 | `zhipin`、`yupao`、`duliday`；默认 `zhipin` |
| `dataSource` | 否 | `api_callback`、`manual`；默认 `api_callback` |
| `eventType` | 是 | 事件类型，见下方事件清单 |
| `eventTime` | 否 | ISO 时间；默认服务端当前时间 |
| `candidate.name` | 是 | 候选人姓名 |
| `candidate.position` | 否 | 候选人职位或沟通职位；缺省时会用 `job.jobName` 参与 `candidateKey` |
| `job.jobId` | 否 | 外部岗位 ID |
| `job.jobName` | 否 | 岗位名；可用于自动识别 `brandId` |
| `brandId` | 否 | 品牌整数 ID；传入优先，否则按 `jobName` 自动识别 |
| `details` | 按事件 | 每种 `eventType` 的事件详情 |

### 返回结构

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "idempotencyKey": "zhipin-msg-001",
        "status": "created",
        "eventId": "5f4f7e0e-0000-4000-9000-000000000001",
        "agentId": "siwen-zhipin-1",
        "eventType": "message_sent",
        "eventTime": "2026-05-07T02:52:00.000Z",
        "candidateKey": "zhipin_张三_肯德基服务员",
        "candidateName": "张三",
        "sessionId": "siwen-zhipin-1_zhipin_张三_肯德基服务员_2026-05-07",
        "sourcePlatform": "zhipin",
        "jobId": 900001,
        "jobName": "肯德基服务员",
        "apiSource": "open_api",
        "dataSource": "api_callback"
      }
    ]
  }
}
```

`created` 和 `existing` 都会返回同一组事件摘要字段，调用方无需再查库即可确认创建/命中的事件类型、时间、候选人和岗位。

| `status` | 含义 |
|---|---|
| `created` | 已创建新事件 |
| `existing` | `agentId + idempotencyKey` 已存在，返回已有事件 |
| `error` | 单条事件失败，其他事件不回滚 |

单条失败示例：

```json
{
  "idempotencyKey": "bad-event-001",
  "status": "error",
  "error": {
    "code": "InvalidEventTime",
    "message": "eventTime cannot be more than 5 minutes in the future"
  }
}
```

## 事件清单

### 1. `message_received`

记录候选人入站消息，等价于 zhipin 工具检测到未读消息。

| 字段 | 必填 | 说明 |
|---|---:|---|
| `eventType` | 是 | 固定 `message_received` |
| `details.unreadCount` | 否 | 检测到的未读消息数 |
| `details.lastMessagePreview` | 否 | 最后一条消息预览 |

```json
{
  "events": [
    {
      "idempotencyKey": "zhipin-unread-20260507-001",
      "agentId": "siwen-zhipin-1",
      "sourcePlatform": "zhipin",
      "eventType": "message_received",
      "eventTime": "2026-05-07T10:00:00+08:00",
      "candidate": {
        "name": "张三",
        "position": "肯德基服务员"
      },
      "job": {
        "jobName": "肯德基服务员"
      },
      "details": {
        "unreadCount": 2,
        "lastMessagePreview": "您好，我想了解一下这个岗位"
      }
    }
  ]
}
```

### 2. `message_sent`

记录我方发送消息，等价于 `zhipin_send_message` 的发送成功埋点。

| 字段 | 必填 | 说明 |
|---|---:|---|
| `eventType` | 是 | 固定 `message_sent` |
| `details.content` | 是 | 发送内容 |
| `details.isAutoReply` | 否 | 是否自动回复 |
| `details.unreadCountBeforeReply` | 否 | 回复前未读数；影响 `unreadReplied` 统计 |

```json
{
  "events": [
    {
      "idempotencyKey": "zhipin-send-20260507-001",
      "agentId": "siwen-zhipin-1",
      "sourcePlatform": "zhipin",
      "eventType": "message_sent",
      "eventTime": "2026-05-07T10:01:00+08:00",
      "candidate": {
        "name": "张三",
        "age": "21岁",
        "education": "本科",
        "expectedSalary": "3000-4000元",
        "expectedLocation": "上海"
      },
      "job": {
        "jobId": 7,
        "jobName": "肯德基服务员"
      },
      "details": {
        "content": "您好，可以沟通一下岗位吗？",
        "isAutoReply": true,
        "unreadCountBeforeReply": 2
      }
    }
  ]
}
```

### 3. `candidate_contacted`

记录主动触达候选人，等价于 `zhipin_say_hello` 打招呼成功。

| 字段 | 必填 | 说明 |
|---|---:|---|
| `eventType` | 是 | 固定 `candidate_contacted` |
| `details` | 否 | 可传 `{}` |

```json
{
  "events": [
    {
      "idempotencyKey": "zhipin-hello-20260507-001",
      "agentId": "siwen-zhipin-1",
      "sourcePlatform": "zhipin",
      "eventType": "candidate_contacted",
      "eventTime": "2026-05-07T10:05:00+08:00",
      "candidate": {
        "name": "李四",
        "position": "服务员",
        "age": "25岁",
        "education": "大专"
      },
      "job": {
        "jobName": "麦当劳服务员"
      },
      "details": {}
    }
  ]
}
```

### 4. `wechat_exchanged`

记录微信交换。`exchangeType` 会影响转化统计口径。

| 字段 | 必填 | 说明 |
|---|---:|---|
| `eventType` | 是 | 固定 `wechat_exchanged` |
| `details.wechatNumber` | 否 | 微信号 |
| `details.exchangeType` | 否 | `requested`、`accepted`、`completed` |

`exchangeType` 语义：

| 值 | 说明 | 是否计入成功交换 |
|---|---|---:|
| `requested` | 我方发起换微信请求，等待对方同意 | 否 |
| `accepted` | 我方同意对方请求 | 是 |
| `completed` | 已从聊天记录或外部回调确认完成 | 是 |

```json
{
  "events": [
    {
      "idempotencyKey": "zhipin-wechat-20260507-001",
      "agentId": "siwen-zhipin-1",
      "sourcePlatform": "zhipin",
      "eventType": "wechat_exchanged",
      "eventTime": "2026-05-07T10:10:00+08:00",
      "candidate": {
        "name": "张三",
        "position": "肯德基服务员"
      },
      "job": {
        "jobName": "肯德基服务员"
      },
      "details": {
        "wechatNumber": "wx_zhangsan",
        "exchangeType": "completed"
      }
    }
  ]
}
```

### 5. `interview_booked`

记录面试预约成功。

| 字段 | 必填 | 说明 |
|---|---:|---|
| `eventType` | 是 | 固定 `interview_booked` |
| `details.interviewTime` | 是 | 面试时间 |
| `details.address` | 否 | 面试地址 |
| `details.candidatePhone` | 否 | 候选人手机号 |

```json
{
  "events": [
    {
      "idempotencyKey": "duliday-interview-20260507-001",
      "agentId": "siwen-zhipin-1",
      "sourcePlatform": "duliday",
      "eventType": "interview_booked",
      "eventTime": "2026-05-07T10:20:00+08:00",
      "candidate": {
        "name": "张三",
        "position": "肯德基服务员"
      },
      "job": {
        "jobId": 7,
        "jobName": "肯德基服务员"
      },
      "details": {
        "interviewTime": "2026-05-08 14:00",
        "address": "上海市浦东新区 XX 路",
        "candidatePhone": "13800138000"
      }
    }
  ]
}
```

### 6. `candidate_hired`

记录候选人上岗，通常来自人工后台补录或外部系统回调。

| 字段 | 必填 | 说明 |
|---|---:|---|
| `eventType` | 是 | 固定 `candidate_hired` |
| `dataSource` | 建议 | 人工补录用 `manual`，系统回调用 `api_callback` |
| `details.hireDate` | 否 | 上岗日期 |
| `details.notes` | 否 | 备注 |

```json
{
  "events": [
    {
      "idempotencyKey": "manual-hired-20260507-001",
      "agentId": "siwen-zhipin-1",
      "sourcePlatform": "zhipin",
      "dataSource": "manual",
      "eventType": "candidate_hired",
      "eventTime": "2026-05-07T11:00:00+08:00",
      "candidate": {
        "name": "张三",
        "position": "肯德基服务员"
      },
      "job": {
        "jobId": 7,
        "jobName": "肯德基服务员"
      },
      "details": {
        "hireDate": "2026-05-10",
        "notes": "已确认到店上岗"
      }
    }
  ]
}
```

## 批量写入

同一个请求最多 `100` 条事件。批量写入非事务，单条失败不会回滚其他条目。

```json
{
  "events": [
    {
      "idempotencyKey": "batch-001",
      "agentId": "siwen-zhipin-1",
      "eventType": "candidate_contacted",
      "candidate": { "name": "张三" }
    },
    {
      "idempotencyKey": "batch-002",
      "agentId": "siwen-zhipin-1",
      "eventType": "message_received",
      "candidate": { "name": "张三" },
      "details": { "unreadCount": 1 }
    }
  ]
}
```

## Curl 示例

```bash
curl -X POST "$OPEN_API_BASE_URL/api/v1/recruitment-events" \
  -H "Authorization: Bearer $OPEN_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "events": [
      {
        "idempotencyKey": "zhipin-send-20260507-001",
        "agentId": "siwen-zhipin-1",
        "sourcePlatform": "zhipin",
        "eventType": "message_sent",
        "eventTime": "2026-05-07T10:01:00+08:00",
        "candidate": { "name": "张三" },
        "job": { "jobName": "肯德基服务员" },
        "details": {
          "content": "您好，可以沟通一下岗位吗？",
          "unreadCountBeforeReply": 1
        }
      }
    ]
  }'
```

## 统计查询

### 1. 汇总查询

```http
GET /api/v1/recruitment-stats/summary
```

参数：

| 参数 | 必填 | 说明 |
|---|---:|---|
| `agentId` | 是 | 要查询的 Agent |
| `days` | 否 | 截至 `endDate` 往前统计几天，默认 `7` |
| `endDate` | 否 | 统计窗口结束日期；支持 `YYYY-MM-DD` 或 ISO 时间 |
| `brandId` | 否 | 品牌整数 ID |
| `jobNames` | 否 | 岗位名，多选支持重复参数或逗号分隔 |

示例：

```bash
curl "$OPEN_API_BASE_URL/api/v1/recruitment-stats/summary?agentId=siwen-zhipin-1&days=7&endDate=2026-05-07&jobNames=肯德基服务员&jobNames=麦当劳服务员" \
  -H "Authorization: Bearer $OPEN_API_TOKEN"
```

返回：

```json
{
  "success": true,
  "data": {
    "summary": {
      "current": [
        {
          "agentId": "siwen-zhipin-1",
          "totalEvents": 120,
          "messagesReceived": 35,
          "candidatesReplied": 28,
          "wechatExchanged": 12,
          "interviewsBooked": 5,
          "candidatesHired": 2
        }
      ],
      "previous": [],
      "trend": {}
    }
  }
}
```

如果 `agentId + 日期范围` 下没有汇总数据，HTTP 仍返回 `200`，并带明确 `message`：

```json
{
  "success": true,
  "data": {
    "summary": {
      "current": [],
      "previous": [],
      "trend": {}
    }
  },
  "message": "No recruitment stats found for the requested agent and date range"
}
```

### 2. 日趋势查询

```http
GET /api/v1/recruitment-stats/trend
```

参数：

| 参数 | 必填 | 说明 |
|---|---:|---|
| `agentId` | 是 | 要查询的 Agent |
| `startDate` | 是 | 开始日期；支持 `YYYY-MM-DD` 或 ISO 时间 |
| `endDate` | 是 | 结束日期；支持 `YYYY-MM-DD` 或 ISO 时间 |
| `brandId` | 否 | 品牌整数 ID |
| `jobNames` | 否 | 岗位名，多选支持重复参数或逗号分隔 |

示例：

```bash
curl "$OPEN_API_BASE_URL/api/v1/recruitment-stats/trend?agentId=siwen-zhipin-1&startDate=2026-05-01&endDate=2026-05-07&jobNames=肯德基服务员,麦当劳服务员" \
  -H "Authorization: Bearer $OPEN_API_TOKEN"
```

返回：

```json
{
  "success": true,
  "data": {
    "trend": [
      {
        "date": "2026-05-01",
        "messagesReceived": 5,
        "inboundCandidates": 4,
        "candidatesReplied": 3,
        "wechatExchanged": 1,
        "interviewsBooked": 0,
        "unreadReplied": 3,
        "proactiveOutreach": 10,
        "proactiveResponded": 2
      }
    ]
  }
}
```

如果 `agentId + 日期范围` 下没有趋势数据，HTTP 仍返回 `200`，并带明确 `message`：

```json
{
  "success": true,
  "data": {
    "trend": []
  },
  "message": "No recruitment trend data found for the requested agent and date range"
}
```

## 指标映射

| API 事件 | 主要影响指标 |
|---|---|
| `message_received` | `messagesReceived`, `inboundCandidates`, `proactiveResponded` |
| `message_sent` | `messagesSent`, `candidatesReplied`, `unreadReplied` |
| `candidate_contacted` | `proactiveOutreach` |
| `wechat_exchanged` | `wechatExchanged` |
| `interview_booked` | `interviewsBooked` |
| `candidate_hired` | `candidatesHired` |

## 边界条件

| 条件 | 规则 |
|---|---|
| `agentId` | 当前阶段只校验 token 有效性，不限制 API key 可访问的 `agentId`；后续如开启数据范围控制，应改为校验 `key -> allowedAgentIds` |
| `eventTime` | 不能晚于服务端当前时间 5 分钟，不能早于 90 天 |
| `idempotencyKey` | 建议必填；缺失时不提供请求级幂等 |
| 批量写入 | 非事务逐条处理，单条失败不回滚其他事件 |
| 趋势粒度 | 当前只支持日粒度，不支持 `week/month` |
| `messageSequence` | `message_sent` 使用现有 `MAX(seq)+1` 逻辑；跨请求并发重复序号按现状容忍 |

## 双写约束

同一个 `agentId` 如果正在运行 zhipin 工具自动化，不应再通过 Open API 写同一渠道的 `message_received` / `message_sent`，否则会和工具内部埋点形成双写。Open API 主要用于非工具渠道、第三方回调、企微 bot 或人工后台补录。

## 生产验证建议

生产联调时建议使用独立测试 `agentId` 和唯一 `idempotencyKey`，避免污染真实业务 Agent：

```bash
SMOKE_ID="smoke-test-$(date -u +%Y%m%d%H%M%S)"

curl -X POST "$OPEN_API_BASE_URL/api/v1/recruitment-events" \
  -H "Authorization: Bearer $OPEN_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data "{
    \"events\": [
      {
        \"idempotencyKey\": \"$SMOKE_ID\",
        \"agentId\": \"openapi-smoke-test\",
        \"sourcePlatform\": \"zhipin\",
        \"dataSource\": \"api_callback\",
        \"eventType\": \"candidate_contacted\",
        \"candidate\": {
          \"name\": \"接口测试候选人\",
          \"position\": \"接口测试岗位\"
        },
        \"job\": {
          \"jobId\": 990001,
          \"jobName\": \"接口测试岗位\"
        },
        \"details\": {
          \"testRun\": true
        }
      }
    ]
  }"
```

同一个请求再次发送时，预期返回：

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "idempotencyKey": "<SMOKE_ID>",
        "status": "existing"
      }
    ]
  }
}
```

如需清理测试数据，可按测试 `agentId` 删除事件和对应聚合行：

```sql
delete from app_huajune.recruitment_events
where agent_id = 'openapi-smoke-test';

delete from app_huajune.recruitment_daily_stats
where agent_id = 'openapi-smoke-test';
```
