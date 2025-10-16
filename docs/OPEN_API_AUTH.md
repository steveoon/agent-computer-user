# Open API 鉴权说明

## 概述

本项目的 Open API（`/api/v1/*`）使用外部鉴权服务进行 API Key 验证，通过 Next.js middleware 实现请求拦截和鉴权。

## 鉴权流程

1. **请求拦截**：所有 `/api/v1/*` 路径的请求都会被 middleware 拦截
2. **Header 检查**：验证请求是否包含 `Authorization: Bearer <token>` 格式的认证头
3. **缓存查询**：首先检查进程内内存缓存，如果 token 在缓存中且未过期，直接放行
4. **外部验证**：缓存未命中时，调用外部鉴权服务进行验证
5. **缓存更新**：验证成功后，将 token 缓存 60 秒，减少外部服务调用
6. **请求放行**：鉴权通过后，请求继续传递给业务路由处理

## 配置

### 环境变量

```bash
# 外部鉴权服务地址
# 默认值: https://wolian.cc/api/v1/validate-key
OPEN_API_AUTH_URL=https://wolian.cc/api/v1/validate-key
```

### 外部鉴权服务要求

外部鉴权服务需要：
- 接受 GET 请求
- 从请求头读取 `Authorization`
- 成功时返回 `200 OK` 和 JSON：`{"isSuccess": true, ...}`
- 失败时返回非 2xx 状态码

## 缓存机制

- **缓存类型**：进程内内存缓存（Map）
- **TTL**：60 秒
- **清理机制**：每 5 分钟自动清理过期项
- **缓存键**：完整的 Authorization header 值

## 错误响应

鉴权失败时返回标准化的错误响应：

```json
{
  "error": "Unauthorized",
  "message": "错误详情",
  "statusCode": 401
}
```

错误类型：
- 缺少 Authorization header
- Authorization 格式错误
- Token 无效或过期
- 外部服务不可用

## 测试

### 单元测试

```bash
# 运行 middleware 测试
pnpm test:run __tests__/middleware.test.ts
```

### 手动测试

```bash
# 成功请求（需要有效的 token）
curl -H "Authorization: Bearer your-valid-token" \
     http://localhost:3000/api/v1/tools

# 失败请求（无 token）
curl http://localhost:3000/api/v1/tools
# 返回 401

# 失败请求（格式错误）
curl -H "Authorization: InvalidFormat" \
     http://localhost:3000/api/v1/tools
# 返回 401
```

## Mock 鉴权服务

开发环境可以搭建本地 Mock 服务：

```javascript
// mock-auth-server.js
const express = require('express');
const app = express();

app.get('/api/validate-key', (req, res) => {
  const auth = req.headers.authorization;

  // 简单验证逻辑
  if (auth === 'Bearer test-token') {
    res.json({ isSuccess: true });
  } else {
    res.status(401).json({ isSuccess: false });
  }
});

app.listen(3001, () => {
  console.log('Mock auth server running on port 3001');
});
```

然后设置环境变量：
```bash
OPEN_API_AUTH_URL=http://localhost:3001/api/validate-key
```

## 注意事项

1. **SSE/长连接**：只在连接建立时验证一次，不对流式数据分片重复验证
2. **安全优先**：外部服务不可用时，拒绝所有请求（fail closed）
3. **性能优化**：合理使用缓存，减少外部服务调用
4. **监控建议**：记录鉴权失败日志，便于排查问题

## 相关文件

- `middleware.ts` - Middleware 实现
- `lib/utils/api-response.ts` - 标准化响应工具
- `app/api/v1/tools/route.ts` - 示例 API 端点
- `__tests__/middleware.test.ts` - 测试文件