# 配置导出 API 文档

## 接口概述

提供一个开放的 HTTP 接口，用于获取应用的完整配置数据。

## 接口详情

### 端点

```
GET /api/config/export
```

### 请求方式

- **HTTP Method**: `GET`
- **Content-Type**: `application/json`
- **认证**: 无需认证（公开接口）

### 请求示例

```bash
# 使用 curl
curl http://localhost:3000/api/config/export

# 使用 wget
wget -qO- http://localhost:3000/api/config/export

# 使用 httpie
http GET http://localhost:3000/api/config/export

# 格式化 JSON 输出
curl -s http://localhost:3000/api/config/export | jq '.'
```

### 响应格式

#### 成功响应 (200 OK)

```json
{
  "success": true,
  "data": {
    "brandData": {
      "city": "上海",
      "defaultBrand": "肯德基",
      "brands": {
        "肯德基": {
          "name": "肯德基",
          "description": "全球知名快餐连锁品牌",
          "templates": { ... },
          "screening": { ... }
        },
        "麦当劳": { ... }
      },
      "stores": [
        {
          "id": "store-1",
          "brand": "肯德基",
          "name": "肯德基(人民广场店)",
          "address": "黄浦区南京东路123号",
          "positions": [ ... ]
        }
      ]
    },
    "systemPrompts": {
      "bossZhipinSystemPrompt": "...",
      "generalComputerSystemPrompt": "...",
      "bossZhipinLocalSystemPrompt": "..."
    },
    "replyPrompts": {
      "initial_inquiry": "...",
      "location_inquiry": "...",
      "salary_inquiry": "...",
      ...
    },
    "activeSystemPrompt": "bossZhipinSystemPrompt",
    "brandPriorityStrategy": "smart",
    "metadata": {
      "version": "1.2.1",
      "lastUpdated": "2025-01-11T03:00:00.000Z",
      "migratedAt": "2025-01-11T03:00:00.000Z"
    }
  },
  "timestamp": "2025-01-11T03:00:00.000Z",
  "version": "1.2.1"
}
```

#### 错误响应 (500 Internal Server Error)

```json
{
  "success": false,
  "error": "错误信息描述",
  "timestamp": "2025-01-11T03:00:00.000Z"
}
```

### 响应字段说明

| 字段路径 | 类型 | 说明 |
|---------|------|------|
| `success` | boolean | 请求是否成功 |
| `data` | object | 配置数据对象 |
| `data.brandData` | object | 品牌和门店数据 |
| `data.brandData.city` | string | 主要运营城市 |
| `data.brandData.defaultBrand` | string | 默认品牌名称 |
| `data.brandData.brands` | object | 品牌配置字典 |
| `data.brandData.stores` | array | 门店列表 |
| `data.systemPrompts` | object | 系统级提示词配置 |
| `data.systemPrompts.bossZhipinSystemPrompt` | string | Boss直聘系统提示词 |
| `data.systemPrompts.generalComputerSystemPrompt` | string | 通用计算机使用提示词 |
| `data.systemPrompts.bossZhipinLocalSystemPrompt` | string | Boss直聘本地版提示词 |
| `data.replyPrompts` | object | 智能回复指令字典 |
| `data.activeSystemPrompt` | string | 当前激活的系统提示词类型 |
| `data.brandPriorityStrategy` | string | 品牌优先级策略 (`smart` / `user-selected` / `conversation-extracted`) |
| `data.metadata` | object | 配置元信息 |
| `data.metadata.version` | string | 配置版本号 |
| `data.metadata.lastUpdated` | string | 最后更新时间 (ISO 8601) |
| `data.metadata.migratedAt` | string | 迁移时间 (ISO 8601) |
| `timestamp` | string | 响应时间戳 (ISO 8601) |
| `version` | string | 配置版本号 |

### 品牌优先级策略说明

| 策略值 | 说明 | 优先级顺序 |
|--------|------|-----------|
| `smart` | 智能判断（推荐） | 职位识别 → UI选择 → 配置默认 → 第一个可用 |
| `user-selected` | 用户选择优先 | UI选择 → 配置默认 → 第一个可用 |
| `conversation-extracted` | 职位识别优先 | 职位识别 → UI选择 → 配置默认 → 第一个可用 |

### CORS 支持

该接口支持跨域请求（CORS），允许从任何域名访问：

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

### 使用场景

1. **配置备份**: 定期获取配置数据进行备份
2. **配置同步**: 将配置数据同步到其他系统
3. **配置分析**: 分析配置数据，生成报表
4. **系统集成**: 第三方系统获取配置信息
5. **开发调试**: 快速查看当前配置状态

### 与前端导出的区别

| 特性 | 前端导出 (`exportConfig()`) | API 接口 (`/api/config/export`) |
|------|---------------------------|--------------------------------|
| **数据来源** | 浏览器 IndexedDB (用户个性化配置) | 服务器端默认配置 |
| **访问方式** | 浏览器前端 JavaScript | HTTP API 请求 |
| **数据内容** | 用户当前的配置数据 | 系统默认配置数据 |
| **用途** | 用户备份、恢复个人配置 | 系统集成、配置模板获取 |
| **认证要求** | 需要访问浏览器环境 | 无需认证，公开访问 |

### 示例用法

#### JavaScript/TypeScript

```typescript
// 获取配置数据
const response = await fetch('http://localhost:3000/api/config/export');
const { success, data, version } = await response.json();

if (success) {
  console.log('配置版本:', version);
  console.log('品牌数量:', Object.keys(data.brandData.brands).length);
  console.log('门店数量:', data.brandData.stores.length);
}
```

#### Python

```python
import requests

response = requests.get('http://localhost:3000/api/config/export')
data = response.json()

if data['success']:
    config = data['data']
    print(f"配置版本: {data['version']}")
    print(f"品牌数量: {len(config['brandData']['brands'])}")
    print(f"门店数量: {len(config['brandData']['stores'])}")
```

#### Shell Script

```bash
#!/bin/bash

# 下载配置到文件
curl -s http://localhost:3000/api/config/export \
  | jq '.data' \
  > config-backup-$(date +%Y%m%d).json

echo "配置已保存到 config-backup-$(date +%Y%m%d).json"
```

### 注意事项

1. **性能考虑**: 配置数据可能较大（包含完整的门店和提示词信息），建议在需要时调用，不要频繁轮询
2. **数据一致性**: 该接口返回服务器端的默认配置，不包含用户浏览器中的个性化修改
3. **版本兼容**: 配置数据结构可能随版本升级而变化，建议检查 `version` 字段确保兼容性
4. **安全性**: 当前接口无认证机制，如部署到生产环境，建议添加认证或限制访问

### 相关文档

- [配置管理系统文档](../guides/CONFIG_MANAGEMENT.md)
- [品牌优先级策略](../guides/BRAND_PRIORITY_STRATEGY.md)
- [API 路由规范](./API_ROUTES.md)

### 版本历史

- **v1.0.0** (2025-01-11): 初始版本，支持完整配置导出
