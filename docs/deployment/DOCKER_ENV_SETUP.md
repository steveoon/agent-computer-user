# Docker 环境变量设置指南

## 重要说明 ✨

**如果你的项目根目录已经有 `.env` 文件，Docker Compose 会自动读取它！你不需要复制到任何地方。**

## 工作原理

Docker Compose 会自动从项目根目录查找并读取 `.env` 文件：

```
你的项目目录/
├── .env                 <-- Docker Compose 自动读取这个
├── docker-compose.yml   <-- 运行 docker compose up 的地方
└── 其他文件...
```

## 环境变量警告说明

当运行 `docker compose up -d` 时，你可能会看到类似这样的警告：

```
WARN[0000] The "OPENAI_API_KEY" variable is not set. Defaulting to a blank string.
WARN[0000] The "FEISHU_APP_ID" variable is not set. Defaulting to a blank string.
```

**这些警告可以忽略**，因为：

1. 这些是可选服务的环境变量
2. 如果你不使用 OpenAI、飞书等服务，不需要设置它们
3. 只要你设置了至少一个 AI Provider（如 ANTHROPIC_API_KEY），应用就能正常工作

## 必需的环境变量

至少需要设置以下其中一个 AI Provider：

```bash
# AI Provider Keys (至少需要一个)
ANTHROPIC_API_KEY=your_key
# 或
DASHSCOPE_API_KEY=your_key
# 或
GEMINI_API_KEY=your_key
```

以及：

```bash
# E2B Desktop (用于桌面自动化)
E2B_API_KEY=your_key
```

## 快速设置步骤

1. **复制环境变量模板**

   ```bash
   cp .env.example .env
   ```

2. **编辑 .env 文件**

   ```bash
   # 编辑并填入你的 API 密钥
   nano .env
   # 或
   vim .env
   ```

3. **最小配置示例**

   ```bash
   # .env 文件内容
   ANTHROPIC_API_KEY=sk-ant-xxxxx
   E2B_API_KEY=e2b_xxxxx
   ```

4. **运行 Docker Compose**
   ```bash
   docker compose up -d
   ```

## 可选环境变量

以下环境变量是可选的，如果不使用相应服务可以忽略警告：

- `OPENAI_API_KEY` - OpenAI API
- `FEISHU_APP_ID` & `FEISHU_APP_SECRET` - 飞书集成
- `WECHAT_BOT_ACCESS_TOKEN` - 微信机器人集成
- `NEXT_PUBLIC_SUPABASE_URL` & `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase 认证

## 验证环境变量

运行以下命令检查环境变量是否正确加载：

```bash
# 查看当前环境变量
docker compose config

# 或者进入容器检查
docker compose exec app env | grep API_KEY
```

## 故障排除

### 问题：仍然显示环境变量警告

即使设置了 .env 文件，仍然看到警告。

**解决方案**：

1. 确保 .env 文件在项目根目录
2. 检查 .env 文件权限：`ls -la .env`
3. 确保变量名拼写正确

### 问题：API 调用失败

应用运行但 API 调用失败。

**解决方案**：

1. 检查 API 密钥是否有效
2. 查看容器日志：`docker compose logs -f`
3. 确保至少有一个 AI Provider 密钥设置正确
