#!/bin/bash

# 部署脚本 - 构建并推送到 GitHub Container Registry

set -e

echo "🚀 开始部署流程..."

# 安全检查：确保 .env 文件不会被包含在镜像中
if ! grep -q "^\.env$" .dockerignore; then
    echo "❌ 错误：.dockerignore 文件中没有包含 .env"
    echo "这可能导致敏感信息被打包进 Docker 镜像！"
    echo "请检查 .dockerignore 文件"
    exit 1
fi

# 构建时需要的 NEXT_PUBLIC_ 环境变量
if [ -f .env ]; then
    echo "📋 加载构建时需要的环境变量..."
    # 只导出 NEXT_PUBLIC_ 开头的变量
    export $(grep -E '^NEXT_PUBLIC_' .env | xargs)
fi

# 1. 构建 Docker 镜像
echo "📦 构建 Docker 镜像 (linux/amd64)..."
docker build --no-cache . --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
  -t ghcr.io/steveoon/ai-computer-use:latest

# 2. 推送到 GitHub Container Registry
echo "⬆️  推送镜像到 ghcr.io..."
docker push ghcr.io/steveoon/ai-computer-use:latest

# 3. 导出镜像到本地文件
echo "💾 导出镜像到本地文件..."

# 从 CHANGELOG.md 提取最新版本号
VERSION=$(grep -E "^# \[[0-9]+\.[0-9]+\.[0-9]+\]" CHANGELOG.md | head -1 | sed 's/.*\[\(.*\)\].*/\1/')

if [ -z "$VERSION" ]; then
    echo "⚠️  无法从 CHANGELOG.md 提取版本号，使用默认版本 'latest'"
    VERSION="latest"
fi

# 确保 Downloads 目录存在
mkdir -p ~/Downloads

# 导出镜像文件
OUTPUT_FILE=~/Downloads/ai-computer-use-${VERSION}.tar
echo "📦 导出镜像到: $OUTPUT_FILE"
docker save -o "$OUTPUT_FILE" ghcr.io/steveoon/ai-computer-use:latest

# 显示文件信息
if [ -f "$OUTPUT_FILE" ]; then
    FILE_SIZE=$(ls -lh "$OUTPUT_FILE" | awk '{print $5}')
    echo "✅ 镜像已导出: $OUTPUT_FILE (大小: $FILE_SIZE)"
else
    echo "❌ 镜像导出失败"
fi

echo "✅ 部署完成!"
echo ""
echo "🖥️  在 VPS 上运行以下命令部署："
echo ""
echo "1. 准备环境变量文件："
echo "   创建 .env 文件，包含所有必要的环境变量（参考 .env.example）"
echo ""
echo "2. 拉取最新镜像："
echo "   docker pull ghcr.io/steveoon/ai-computer-use:latest"
echo ""
echo "3. 使用 docker-compose 启动（强烈推荐）："
echo "   docker-compose -f docker-compose.prod.yml up -d"
echo ""
echo "   ⚡ docker-compose.prod.yml 包含了网络性能优化配置："
echo "   - 增大连接队列 (somaxconn=1024)"
echo "   - TCP keepalive 优化 (keepalive_time=600)"
echo "   - 文件描述符限制提升 (nofile=65536)"
echo ""
echo "4. 或者直接使用 docker run（不推荐，缺少网络优化）："
echo "   docker run -d \\"
echo "     --name ai-computer-use \\"
echo "     --restart always \\"
echo "     -p 4000:3000 \\"
echo "     --env-file .env \\"
echo "     --sysctl net.core.somaxconn=1024 \\"
echo "     --sysctl net.ipv4.tcp_keepalive_time=600 \\"
echo "     --ulimit nofile=65536:65536 \\"
echo "     ghcr.io/steveoon/ai-computer-use:latest"
echo ""
echo "⚠️  重要提醒："
echo "   - 确保 VPS 上有正确的 .env 文件"
echo "   - 不要将 .env 文件提交到代码仓库"
echo "   - 定期更新环境变量和镜像"