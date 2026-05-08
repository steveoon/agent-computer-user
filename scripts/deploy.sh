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
    FILE_SIZE=$(du -h "$OUTPUT_FILE" | awk '{print $1}')
    echo "✅ 镜像已导出: $OUTPUT_FILE (大小: $FILE_SIZE)"
else
    echo "❌ 镜像导出失败"
    exit 1
fi

# 4. 上传镜像到服务器
REMOTE_SERVER="${DEPLOY_SERVER:-aliyun-server}"
REMOTE_PATH="${DEPLOY_PATH:-/data/huajune/}"
UPLOAD_METHOD="${DEPLOY_UPLOAD_METHOD:-rsync}"
REMOTE_DEPLOY_DIR="${DEPLOY_REMOTE_DIR:-${REMOTE_PATH%/}}"
REMOTE_COMPOSE_FILE="${DEPLOY_COMPOSE_FILE:-docker-compose.prod.yml}"
REMOTE_CONTAINER_NAME="${DEPLOY_CONTAINER_NAME:-ai-computer-use}"
REMOTE_IMAGE_FILE="${REMOTE_PATH%/}/$(basename "$OUTPUT_FILE")"
HEALTH_TIMEOUT="${DEPLOY_HEALTH_TIMEOUT:-180}"
HEALTH_INTERVAL="${DEPLOY_HEALTH_INTERVAL:-5}"
CLEANUP_REMOTE_TAR="${DEPLOY_CLEANUP_REMOTE_TAR:-true}"
PRUNE_DANGLING_IMAGES="${DEPLOY_PRUNE_DANGLING_IMAGES:-false}"

echo ""
echo "📤 上传镜像到服务器..."
echo "   目标: ${REMOTE_SERVER}:${REMOTE_PATH}"

case "$UPLOAD_METHOD" in
    rsync)
        if command -v rsync >/dev/null 2>&1; then
            RSYNC_FLAGS="${RSYNC_FLAGS:--avz --partial --info=progress2}"
            read -r -a RSYNC_FLAGS_ARRAY <<< "$RSYNC_FLAGS"
            if rsync "${RSYNC_FLAGS_ARRAY[@]}" "$OUTPUT_FILE" "${REMOTE_SERVER}:${REMOTE_PATH}"; then
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
echo "🐳 在服务器加载镜像并重启服务..."
echo "   镜像文件: ${REMOTE_SERVER}:${REMOTE_IMAGE_FILE}"
echo "   部署目录: ${REMOTE_SERVER}:${REMOTE_DEPLOY_DIR}"
echo "   Compose 文件: ${REMOTE_COMPOSE_FILE}"
echo "   容器名称: ${REMOTE_CONTAINER_NAME}"

if ssh "$REMOTE_SERVER" "bash -s" -- \
    "$REMOTE_IMAGE_FILE" \
    "$REMOTE_DEPLOY_DIR" \
    "$REMOTE_COMPOSE_FILE" \
    "$REMOTE_CONTAINER_NAME" \
    "$HEALTH_TIMEOUT" \
    "$HEALTH_INTERVAL" \
    "$CLEANUP_REMOTE_TAR" \
    "$PRUNE_DANGLING_IMAGES" <<'REMOTE_DEPLOY_SCRIPT'
set -euo pipefail

REMOTE_IMAGE_FILE="$1"
REMOTE_DEPLOY_DIR="$2"
REMOTE_COMPOSE_FILE="$3"
REMOTE_CONTAINER_NAME="$4"
HEALTH_TIMEOUT="$5"
HEALTH_INTERVAL="$6"
CLEANUP_REMOTE_TAR="$7"
PRUNE_DANGLING_IMAGES="$8"

if [ ! -f "$REMOTE_IMAGE_FILE" ]; then
    echo "❌ 服务器上未找到镜像文件: $REMOTE_IMAGE_FILE"
    exit 1
fi

if [ ! -d "$REMOTE_DEPLOY_DIR" ]; then
    echo "❌ 服务器部署目录不存在: $REMOTE_DEPLOY_DIR"
    echo "   可通过 DEPLOY_REMOTE_DIR=/your/deploy/dir 覆盖"
    exit 1
fi

echo "📦 加载 Docker 镜像..."
docker load -i "$REMOTE_IMAGE_FILE"

cd "$REMOTE_DEPLOY_DIR"

if [ ! -f "$REMOTE_COMPOSE_FILE" ]; then
    echo "❌ Compose 文件不存在: $REMOTE_DEPLOY_DIR/$REMOTE_COMPOSE_FILE"
    echo "   可通过 DEPLOY_COMPOSE_FILE=docker-compose.prod.yml 覆盖文件名"
    exit 1
fi

if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD=(docker-compose)
else
    echo "❌ 服务器未安装 docker compose 或 docker-compose"
    exit 1
fi

echo "🔁 重启服务..."
"${COMPOSE_CMD[@]}" -f "$REMOTE_COMPOSE_FILE" up -d

echo "🩺 等待健康检查通过..."
DEADLINE=$((SECONDS + HEALTH_TIMEOUT))
LAST_STATUS="unknown"
LAST_HEALTH="unknown"

while [ "$SECONDS" -lt "$DEADLINE" ]; do
    LAST_STATUS=$(docker inspect -f '{{.State.Status}}' "$REMOTE_CONTAINER_NAME" 2>/dev/null || true)
    LAST_HEALTH=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$REMOTE_CONTAINER_NAME" 2>/dev/null || true)

    if [ "$LAST_HEALTH" = "healthy" ]; then
        echo "✅ 容器健康检查通过: $REMOTE_CONTAINER_NAME"
        break
    fi

    if [ -z "$LAST_HEALTH" ] && [ "$LAST_STATUS" = "running" ]; then
        if docker exec "$REMOTE_CONTAINER_NAME" wget --quiet --tries=1 --spider "http://localhost:3000/api/health" >/dev/null 2>&1; then
            echo "✅ HTTP 健康检查通过: $REMOTE_CONTAINER_NAME"
            break
        fi
    fi

    if [ "$LAST_STATUS" = "exited" ] || [ "$LAST_STATUS" = "dead" ]; then
        echo "❌ 容器状态异常: status=$LAST_STATUS health=${LAST_HEALTH:-none}"
        docker logs --tail 120 "$REMOTE_CONTAINER_NAME" || true
        exit 1
    fi

    printf "   当前状态: status=%s health=%s\n" "${LAST_STATUS:-missing}" "${LAST_HEALTH:-none}"
    sleep "$HEALTH_INTERVAL"
done

FINAL_HEALTH=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$REMOTE_CONTAINER_NAME" 2>/dev/null || true)
FINAL_STATUS=$(docker inspect -f '{{.State.Status}}' "$REMOTE_CONTAINER_NAME" 2>/dev/null || true)

if [ "$FINAL_HEALTH" != "healthy" ]; then
    if ! { [ -z "$FINAL_HEALTH" ] && [ "$FINAL_STATUS" = "running" ] && docker exec "$REMOTE_CONTAINER_NAME" wget --quiet --tries=1 --spider "http://localhost:3000/api/health" >/dev/null 2>&1; }; then
        echo "❌ 健康检查超时或失败: status=${FINAL_STATUS:-missing} health=${FINAL_HEALTH:-none}"
        docker ps --filter "name=$REMOTE_CONTAINER_NAME"
        docker logs --tail 120 "$REMOTE_CONTAINER_NAME" || true
        exit 1
    fi
fi

if [ "$CLEANUP_REMOTE_TAR" = "true" ]; then
    echo "🧹 删除服务器上的镜像 tar 文件..."
    rm -f "$REMOTE_IMAGE_FILE"
fi

if [ "$PRUNE_DANGLING_IMAGES" = "true" ]; then
    echo "🧹 清理服务器上的 dangling Docker images..."
    docker image prune -f
fi

echo "✅ 服务器部署完成"
REMOTE_DEPLOY_SCRIPT
then
    echo "✅ 远端服务已加载最新镜像并通过健康检查"
else
    echo "❌ 远端部署失败，请检查上面的错误信息"
    exit 1
fi

echo ""
echo "✅ 部署完成!"
echo ""
echo "⚠️  重要提醒："
echo "   - 确保 VPS 上有正确的 .env 文件"
echo "   - 不要将 .env 文件提交到代码仓库"
echo "   - 定期更新环境变量和镜像"
echo ""
echo "💡 自定义上传配置："
echo "   DEPLOY_SERVER=my-server DEPLOY_PATH=/my/path/ ./scripts/deploy.sh"
echo "   DEPLOY_UPLOAD_METHOD=rsync RSYNC_FLAGS='-avz --partial --info=progress2' ./scripts/deploy.sh"
echo "   DEPLOY_REMOTE_DIR=/data/huajune DEPLOY_COMPOSE_FILE=docker-compose.prod.yml ./scripts/deploy.sh"
echo "   DEPLOY_HEALTH_TIMEOUT=240 DEPLOY_HEALTH_INTERVAL=5 ./scripts/deploy.sh"
echo "   DEPLOY_CLEANUP_REMOTE_TAR=true DEPLOY_PRUNE_DANGLING_IMAGES=false ./scripts/deploy.sh"
