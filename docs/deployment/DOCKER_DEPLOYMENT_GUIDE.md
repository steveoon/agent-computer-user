# Docker部署指南

## 问题修复说明

我们已经修复了Puppeteer MCP服务器在Docker容器中的权限问题。主要修改包括：

### 1. Dockerfile更新

- 预创建了`/app/logs`目录并设置正确的权限
- 移除了不必要的 Chromium 安装（节省 755MB+ 空间）
- Puppeteer MCP Server 会自动管理 Chromium

### 2. MCP配置更新

- 添加了环境变量控制日志级别
- 配置了Puppeteer使用系统安装的Chromium
- 尝试禁用文件日志记录

### 3. Docker Compose配置

- 创建了docker-compose.yml文件简化部署
- 添加了健康检查
- 配置了所有必要的环境变量

### 4. 环境变量安全处理

- 更新了`.dockerignore`确保`.env`文件不会被打包进镜像
- 分离了构建时和运行时的环境变量
- `NEXT_PUBLIC_`前缀的变量在构建时注入，其他敏感变量在运行时注入

## 部署方式

本项目支持两种部署方式：本地开发部署和生产环境部署（通过 GitHub Container Registry）。

### 部署方式一：本地开发部署

适用于本地开发和测试环境。

#### 选择正确的配置文件

**macOS (Apple Silicon) 用户：**

```bash
# 使用专为 ARM64 优化的配置
docker compose -f docker-compose.local.yml build
docker compose -f docker-compose.local.yml up -d
```

**其他平台或需要测试生产镜像：**

```bash
# 使用默认配置（构建 linux/amd64 镜像）
docker compose build
docker compose up -d
```

**最简单的方式（推荐）：**

```bash
# 直接运行，避免 Docker 架构问题
pnpm dev
```

#### 2. 使用 docker 命令

```bash
# 构建镜像
docker build -t ai-sdk-computer-use .

# 运行容器
docker run -d \
  --name ai-sdk-app \
  -p 3000:3000 \
  --env-file .env \
  ai-sdk-computer-use
```

### 部署方式二：生产环境部署（GitHub Container Registry）

适用于VPS服务器部署，通过GitHub Container Registry分发镜像。

#### 本地构建和推送

```bash
# 1. 构建镜像（指定linux/amd64平台）
docker build --no-cache . --platform linux/amd64 -t ghcr.io/steveoon/ai-computer-use:latest

# 2. 推送到 GitHub Container Registry
docker push ghcr.io/steveoon/ai-computer-use:latest

# 或者使用提供的部署脚本
./scripts/deploy.sh
```

#### VPS服务器部署

在VPS服务器上，有两种运行方式：

**方式1：使用 docker-compose（推荐）**

```bash
# 1. 在 VPS 上创建项目目录
mkdir -p ~/ai-computer-use
cd ~/ai-computer-use

# 2. 复制必要文件到服务器
# 方法A：从本地使用 scp
scp docker-compose.prod.yml your-user@your-vps-ip:~/ai-computer-use/
scp .env your-user@your-vps-ip:~/ai-computer-use/

# 方法B：在服务器上手动创建这两个文件
nano docker-compose.prod.yml  # 粘贴内容
nano .env                     # 填入你的 API 密钥

# 3. 设置 .env 文件权限（保护敏感信息）
chmod 600 .env

# 4. 拉取最新镜像
docker pull ghcr.io/steveoon/ai-computer-use:latest

# 5. 使用 docker-compose 启动
docker-compose -f docker-compose.prod.yml up -d
```

**重要说明**：

- `docker-compose.prod.yml` 和 `.env` 必须在同一目录
- Docker Compose 会自动从同目录加载 `.env` 文件
- `.env` 包含敏感信息，务必通过安全方式传输

**方式2：使用 docker run**

```bash
# 拉取最新镜像
docker pull ghcr.io/steveoon/ai-computer-use:latest

# 运行容器（映射到4000端口）
docker run -d \
  --name ai-computer-use \
  --restart always \
  -p 4000:3000 \
  --env-file .env \
  ghcr.io/steveoon/ai-computer-use:latest
```

### 配置文件说明

- **docker-compose.yml** - 本地开发使用（linux/amd64），包含构建配置，映射3000端口
- **docker-compose.local.yml** - macOS 本地开发专用（自动选择架构），映射3000端口
- **docker-compose.prod.yml** - 生产环境使用，只拉取镜像，映射4000端口
- **scripts/deploy.sh** - 自动化构建和推送脚本

## 环境变量配置

### 重要安全说明 ⚠️

1. **永远不要将`.env`文件提交到代码仓库**
2. **`.env`文件不应该被打包进Docker镜像**（已通过`.dockerignore`处理）
3. **环境变量分为两类**：
   - **构建时变量**：以`NEXT_PUBLIC_`开头的变量会在构建时内联到客户端代码中，在浏览器中可见
   - **运行时变量**：其他所有变量（API密钥等）只在服务器端使用，通过运行时环境变量注入

### 创建.env文件

从`.env.example`复制并创建`.env`文件：

```bash
cp .env.example .env
```

然后编辑`.env`文件，填入实际的值：

```bash
# AI Provider Keys (至少需要一个)
ANTHROPIC_API_KEY=your_key_here
DASHSCOPE_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
OPENROUTER_API_KEY=your_key_here
GEMINI_API_KEY=your_key_here

# E2B Desktop
E2B_API_KEY=your_key_here

# Supabase (可选)
NEXT_PUBLIC_SUPABASE_URL=your_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key_here

# Feishu Integration (可选)
FEISHU_APP_ID=your_app_id
FEISHU_APP_SECRET=your_app_secret

# WeChat Bot Integration (可选)
WECHAT_BOT_ACCESS_TOKEN=your_token_here
```

## 部署后验证

### 1. 检查日志

```bash
# 本地开发环境
docker-compose logs -f

# 生产环境
docker-compose -f docker-compose.prod.yml logs -f

# 或者直接查看容器日志
docker logs -f ai-computer-use
```

### 2. 验证健康状态

```bash
# 本地环境（3000端口）
curl http://localhost:3000/api/health

# 生产环境（4000端口）
curl http://localhost:4000/api/health
```

### 3. 访问应用

- 本地环境：http://localhost:3000
- 生产环境：http://your-server-ip:4000

## 故障排除

### YAML 格式错误：services.app.volumes must be a list

如果遇到这个错误，说明 docker-compose.yml 文件有语法问题。已经修复为注释掉未使用的 volumes 配置。

### 环境变量警告

运行时看到类似警告是正常的：

```
WARN[0000] The "OPENAI_API_KEY" variable is not set. Defaulting to a blank string.
```

这些是可选的环境变量。请参考 [Docker 环境变量设置指南](./DOCKER_ENV_SETUP.md) 了解详情。

### 如果仍然出现权限错误

1. **确保Dockerfile正确构建**

   ```bash
   # 清理并重新构建
   docker-compose down
   docker-compose build --no-cache
   docker-compose up
   ```

2. **检查容器内的权限**

   ```bash
   # 进入容器检查
   docker-compose exec app sh
   ls -la /app/
   whoami
   ```

3. **手动创建日志目录（临时方案）**
   ```bash
   # 在docker-compose.yml中添加volume
   volumes:
     - ./logs:/app/logs
   ```

### 如果Puppeteer无法启动

1. **验证Chromium安装**

   ```bash
   docker-compose exec app sh -c "which chromium-browser"
   docker-compose exec app sh -c "chromium-browser --version"
   ```

2. **测试Puppeteer直接运行**
   ```bash
   docker-compose exec app sh -c "npx puppeteer-mcp-server --help"
   ```

### 调试MCP连接

1. **启用详细日志**

   修改`lib/mcp/client-manager.ts`中的环境变量：

   ```typescript
   env: {
     LOG_LEVEL: 'debug',  // 改为debug
     // ...
   }
   ```

2. **检查MCP状态**

   访问诊断端点：

   ```bash
   curl http://localhost:3000/api/diagnose
   ```

## 性能优化建议

1. **使用构建缓存**

   ```bash
   docker build --cache-from ai-sdk-computer-use:latest -t ai-sdk-computer-use .
   ```

2. **限制资源使用**

   在docker-compose.yml中添加：

   ```yaml
   services:
     app:
       deploy:
         resources:
           limits:
             cpus: "2"
             memory: 4G
   ```

3. **使用健康检查自动重启**

   容器已配置健康检查，如果服务不健康会自动重启。

## 安全建议

1. **不要在镜像中包含敏感信息**
   - 使用环境变量或secrets管理
   - 不要在Dockerfile中硬编码API密钥

2. **定期更新基础镜像**

   ```bash
   docker pull node:18-alpine
   docker-compose build --no-cache
   ```

3. **限制容器权限**
   - 容器已配置以非root用户运行
   - 考虑使用只读文件系统（除了必要的目录）

## 监控和日志

1. **查看实时日志**

   ```bash
   docker-compose logs -f --tail=100
   ```

2. **导出日志**

   ```bash
   docker-compose logs > deployment.log
   ```

3. **监控资源使用**
   ```bash
   docker stats
   ```

## 常见问题

### Q: 为什么选择Alpine Linux？

A: Alpine Linux体积小、安全性高，适合生产环境。但需要注意某些Node.js包可能需要额外的依赖。

### Q: macOS 上 Puppeteer 报错 "rosetta error: failed to open elf"

A: 这是因为在 Apple Silicon Mac (M1/M2/M3) 上运行 linux/amd64 架构的镜像导致的。

**解决方案：**

1. **使用本地开发专用配置（推荐）**

   ```bash
   # 使用专为 macOS 优化的配置
   docker compose -f docker-compose.local.yml up -d
   ```

2. **直接本地运行（最简单）**

   ```bash
   # 不使用 Docker，直接运行
   pnpm install
   pnpm dev
   ```

3. **临时禁用 Puppeteer**
   如果暂时不需要 Puppeteer 功能，可以在 `lib/mcp/client-manager.ts` 中设置 `enabled: false`

**原因说明：**

- Apple Silicon Mac 是 ARM64 架构
- 生产环境 VPS 通常是 x86_64 (amd64) 架构
- Puppeteer/Chromium 需要与运行环境架构匹配的二进制文件

### Q: 如何处理中文输入？

A: Dockerfile已包含必要的字体包（ttf-freefont），Chromium应该能够正确处理中文。

### Q: 如何更新应用？

**本地环境：**

1. 拉取最新代码
2. 重新构建镜像：`docker-compose build`
3. 重启容器：`docker-compose up -d`

**生产环境：**

1. 本地构建并推送：`./scripts/deploy.sh`
2. VPS上拉取新镜像：`docker pull ghcr.io/steveoon/ai-computer-use:latest`
3. 重启容器：
   - 使用docker-compose: `docker-compose -f docker-compose.prod.yml up -d`
   - 或直接重启: `docker restart ai-computer-use`

### Q: 如何备份数据？

A: 应用使用IndexedDB存储配置数据，这些数据存储在浏览器端。服务器端主要是无状态的。
