# Docker 配置文件快速指南

## 🎯 选择正确的配置文件

| 场景           | 使用的文件                 | 命令                                               |
| -------------- | -------------------------- | -------------------------------------------------- |
| macOS 本地开发 | `docker-compose.local.yml` | `docker compose -f docker-compose.local.yml up -d` |
| 构建生产镜像   | `docker-compose.yml`       | `./scripts/deploy.sh`                              |
| VPS 生产部署   | `docker-compose.prod.yml`  | `docker compose -f docker-compose.prod.yml up -d`  |

## 📁 配置文件说明

### docker-compose.yml

- **架构**：linux/amd64 (x86_64)
- **镜像**：`ghcr.io/steveoon/ai-computer-use:latest`
- **用途**：构建用于生产环境的镜像
- **注意**：在 Apple Silicon Mac 上可能导致 Puppeteer 错误

### docker-compose.local.yml

- **架构**：自动检测（macOS 上为 ARM64）
- **镜像**：`ai-computer-use:local`
- **用途**：macOS 本地开发
- **优势**：避免架构不兼容问题

### docker-compose.prod.yml

- **架构**：不构建，只拉取镜像
- **镜像**：`ghcr.io/steveoon/ai-computer-use:latest`
- **用途**：VPS 生产环境部署
- **端口**：4000:3000

## 🚀 常用命令

### macOS 本地开发

```bash
# 方式1：使用 Docker（ARM64 镜像）
docker compose -f docker-compose.local.yml up -d

# 方式2：直接运行（推荐）
pnpm dev
```

### 构建和部署到生产

```bash
# 自动构建并推送
./scripts/deploy.sh

# 或手动构建
docker compose build
docker push ghcr.io/steveoon/ai-computer-use:latest
```

### VPS 生产部署

```bash
# 在 VPS 上
docker compose -f docker-compose.prod.yml up -d
```

## ⚠️ 注意事项

1. **不要**在 macOS 上使用 `docker-compose.yml` 运行，会导致 Puppeteer 架构错误
2. **始终**使用 `deploy.sh` 构建生产镜像，它会处理环境变量和安全检查
3. **确保** `.env` 文件不被提交到代码仓库
