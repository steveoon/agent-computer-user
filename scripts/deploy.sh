#!/bin/bash

# 部署脚本 - 构建并推送到 GitHub Container Registry

set -euo pipefail

echo "🚀 开始部署流程..."

# 安全检查：确保 .env 文件不会被包含在镜像中
if ! awk '
  NF && $1 !~ /^#/ {
    if ($0 ~ /(^|\/)\.env($|[[:space:]]|\*)/ || $0 ~ /\*\*\/\.env/) found=1
  }
  END { exit !found }
' .dockerignore; then
    echo "❌ 错误：.dockerignore 文件中没有包含 .env"
    echo "这可能导致敏感信息被打包进 Docker 镜像！"
    echo "请检查 .dockerignore 文件"
    exit 1
fi

# 构建时需要的 NEXT_PUBLIC_ 环境变量
if [ -f .env ]; then
    echo "📋 加载构建时需要的环境变量..."
    # 只导出 NEXT_PUBLIC_ 开头的变量
    while IFS= read -r line; do
        case "$line" in
            ''|'#'*) continue ;;
            export\ NEXT_PUBLIC_*=*)
                line="${line#export }"
                ;;
            NEXT_PUBLIC_*=*)
                ;;
            *) continue ;;
        esac
        key="${line%%=*}"
        val="${line#*=}"
        export "$key=$val"
    done < .env
fi

# 1. 构建 Docker 镜像
echo "📦 构建 Docker 镜像 (linux/amd64)..."
docker build --no-cache . --platform linux/amd64 \
  --build-arg "NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL-}" \
  --build-arg "NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY-}" \
  -t ghcr.io/steveoon/ai-computer-use:latest

# 2. 推送到 GitHub Container Registry
echo "⬆️  推送镜像到 ghcr.io..."
docker push ghcr.io/steveoon/ai-computer-use:latest

# 3. 导出镜像到本地文件
echo "💾 导出镜像到本地文件..."

# 从 package.json 提取版本号（权威来源）
VERSION=$(node -p "require('./package.json').version")

if [ -z "$VERSION" ]; then
    echo "⚠️  无法从 package.json 提取版本号，使用默认版本 'latest'"
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
    exit 1
fi

# 4. 上传镜像到服务器
REMOTE_SERVER="${DEPLOY_SERVER:-aliyun-server}"
REMOTE_PATH="${DEPLOY_PATH:-/data/huajune/}"
UPLOAD_METHOD="${DEPLOY_UPLOAD_METHOD:-rsync}"

echo ""
echo "📤 上传镜像到服务器..."
echo "   目标: ${REMOTE_SERVER}:${REMOTE_PATH}"

case "$UPLOAD_METHOD" in
    rsync)
        if command -v rsync >/dev/null 2>&1; then
            RSYNC_FLAGS="${RSYNC_FLAGS:--avz --partial --info=progress2}"
            if rsync $RSYNC_FLAGS "$OUTPUT_FILE" "${REMOTE_SERVER}:${REMOTE_PATH}"; then
                echo "✅ 镜像已上传到 ${REMOTE_SERVER}:${REMOTE_PATH}"
            else
                echo "❌ 上传失败，请检查网络连接和服务器配置"
                echo "   你可以手动执行: rsync $RSYNC_FLAGS $OUTPUT_FILE ${REMOTE_SERVER}:${REMOTE_PATH}"
                exit 1
            fi
        else
            echo "⚠️  未检测到 rsync，回退到 scp"
            if scp -C "$OUTPUT_FILE" "${REMOTE_SERVER}:${REMOTE_PATH}"; then
                echo "✅ 镜像已上传到 ${REMOTE_SERVER}:${REMOTE_PATH}"
            else
                echo "❌ 上传失败，请检查网络连接和服务器配置"
                echo "   你可以手动执行: scp -C $OUTPUT_FILE ${REMOTE_SERVER}:${REMOTE_PATH}"
                exit 1
            fi
        fi
        ;;
    scp)
        if scp -C "$OUTPUT_FILE" "${REMOTE_SERVER}:${REMOTE_PATH}"; then
            echo "✅ 镜像已上传到 ${REMOTE_SERVER}:${REMOTE_PATH}"
        else
            echo "❌ 上传失败，请检查网络连接和服务器配置"
            echo "   你可以手动执行: scp -C $OUTPUT_FILE ${REMOTE_SERVER}:${REMOTE_PATH}"
            exit 1
        fi
        ;;
    *)
        echo "❌ 未知上传方式: ${UPLOAD_METHOD}（可选: rsync/scp）"
        exit 1
        ;;
esac

echo ""
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
echo ""
echo "💡 自定义上传配置："
echo "   DEPLOY_SERVER=my-server DEPLOY_PATH=/my/path/ ./scripts/deploy.sh"
echo "   DEPLOY_UPLOAD_METHOD=rsync RSYNC_FLAGS='-avz --partial --info=progress2' ./scripts/deploy.sh"
