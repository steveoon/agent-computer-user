#!/usr/bin/env bash

set -euo pipefail

# ============================================================================
# Multi-Agent Manager - 优雅的多 Agent 并行管理系统
# ============================================================================

# 颜色定义
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
# readonly MAGENTA='\033[0;35m'  # 暂未使用
readonly CYAN='\033[0;36m'
readonly NC='\033[0m' # No Color

# 路径配置
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
readonly CONFIG_FILE="$PROJECT_ROOT/configs/agents.json"
readonly TEMPLATE_FILE="$PROJECT_ROOT/configs/agent-templates.json"
readonly LOGS_DIR="$PROJECT_ROOT/logs/agents"
readonly PIDS_DIR="$PROJECT_ROOT/pids/agents"

# 超时与延迟配置
readonly CHROME_STARTUP_TIMEOUT=10          # Chrome 启动超时 (秒)
readonly CHROME_PROCESS_CHECK_INTERVAL=1    # Chrome 进程检查间隔 (秒)
readonly APP_STARTUP_TIMEOUT=30             # 应用启动超时 (秒)
readonly APP_HEALTH_CHECK_INTERVAL=1        # 应用健康检查间隔 (秒)
readonly AGENT_STOP_WAIT_TIME=2             # Agent 停止后等待时间 (秒)
readonly CHROME_GRACEFUL_WAIT_TIME=10        # Chrome 优雅关闭等待时间 (秒)
readonly CHROME_FORCE_WAIT_TIME=3           # Chrome 强制关闭后等待时间 (秒)
readonly AGENT_RESTART_WAIT_TIME=2          # Agent 重启前等待时间 (秒)
readonly PORT_RELEASE_WAIT_TIME=2           # 端口释放等待时间 (秒)

# ============================================================================
# 工具函数
# ============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*"
}

log_step() {
    echo -e "${CYAN}[STEP]${NC} $*"
}

# 检查依赖
check_dependencies() {
    local deps=("jq" "lsof" "node" "curl" "pnpm")
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            log_error "缺少依赖: $dep"
            case "$dep" in
                jq)
                    log_info "安装提示: brew install jq"
                    ;;
                lsof)
                    log_info "lsof 通常预装在 macOS 上"
                    ;;
                node)
                    log_info "请安装 Node.js: https://nodejs.org/"
                    ;;
                curl)
                    log_info "curl 通常预装在 macOS 上"
                    ;;
                pnpm)
                    log_info "安装提示: npm install -g pnpm"
                    ;;
            esac
            exit 1
        fi
    done
}

# 初始化配置文件
init_config() {
    # 如果 agents.json 不存在，从示例文件复制
    if [[ ! -f "$CONFIG_FILE" ]]; then
        local example_file="$PROJECT_ROOT/configs/agents.example.json"
        if [[ -f "$example_file" ]]; then
            log_info "配置文件不存在，从示例文件创建: $CONFIG_FILE"
            cp "$example_file" "$CONFIG_FILE"
            log_success "配置文件已创建，请根据需要修改"
        else
            log_error "配置文件和示例文件都不存在"
            log_info "请创建 $CONFIG_FILE 或 $example_file"
            exit 1
        fi
    fi
}

# 初始化目录
init_dirs() {
    mkdir -p "$LOGS_DIR" "$PIDS_DIR"
}

# 验证配置文件的关键设置
validate_config() {
    local setting=$1
    local setting_name=$2

    if [[ -z "$setting" || "$setting" == "null" ]]; then
        log_error "配置项 '$setting_name' 未设置或无效"
        log_info "请检查 $CONFIG_FILE 中的 settings.$setting_name"
        return 1
    fi

    # 验证数字类型（端口配置）
    if [[ "$setting_name" =~ Port$ ]]; then
        if ! [[ "$setting" =~ ^[0-9]+$ ]]; then
            log_error "配置项 '$setting_name' 必须是有效的数字: $setting"
            return 1
        fi
    fi

    return 0
}

# 检查端口是否被占用
is_port_in_use() {
    local port=$1
    lsof -i ":$port" -sTCP:LISTEN -t > /dev/null 2>&1
}

# 通过端口获取监听进程 PID
get_pid_by_port() {
    local port=$1
    lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | head -1 || true
}

# 原子更新配置文件，避免写入失败导致清空
update_config_atomic() {
    local jq_filter=$1
    shift

    local tmp_file
    tmp_file=$(mktemp "${CONFIG_FILE}.tmp.XXXXXX") || return 1

    if jq "$@" "$jq_filter" "$CONFIG_FILE" > "$tmp_file"; then
        mv "$tmp_file" "$CONFIG_FILE"
        return 0
    fi

    rm -f "$tmp_file"
    return 1
}

# 验证 Agent ID 格式
validate_agent_id() {
    local id=$1

    if [[ ! "$id" =~ ^[a-zA-Z0-9][a-zA-Z0-9_-]*$ ]]; then
        log_error "Agent ID 无效: $id"
        log_info "允许格式: ^[a-zA-Z0-9][a-zA-Z0-9_-]*$"
        return 1
    fi

    return 0
}

# 获取下一个可用端口
get_next_available_port() {
    local start_port=$1
    local current_port=$start_port

    while is_port_in_use "$current_port"; do
        ((current_port++))
    done

    echo "$current_port"
}

# 从 JSON 获取设置
get_setting() {
    local key=$1
    jq -r ".settings.$key" "$CONFIG_FILE"
}

# 获取所有 agent
get_agents() {
    jq -c '.agents[]' "$CONFIG_FILE" 2>/dev/null || echo ""
}

# 根据类型获取下一个编号
get_next_agent_number() {
    local type=$1
    local max_num=0

    while IFS= read -r agent; do
        local id=$(echo "$agent" | jq -r '.id')
        if [[ $id =~ ^${type}-([0-9]+)$ ]]; then
            local num=${BASH_REMATCH[1]}
            if (( num > max_num )); then
                max_num=$num
            fi
        fi
    done < <(get_agents)

    echo $((max_num + 1))
}

# 获取所有已使用的端口
get_used_ports() {
    jq -r '.agents[] | "\(.appPort) \(.chromePort)"' "$CONFIG_FILE" 2>/dev/null || echo ""
}

# 分配新的端口
allocate_ports() {
    local start_app_port=$(get_setting "startPort")
    local start_chrome_port=$(get_setting "startChromePort")

    # 验证端口配置
    if ! validate_config "$start_app_port" "startPort"; then
        return 1
    fi
    if ! validate_config "$start_chrome_port" "startChromePort"; then
        return 1
    fi

    local used_ports=($(get_used_ports))

    # 找到最大的已使用端口
    local max_app_port=$start_app_port
    local max_chrome_port=$start_chrome_port

    # 只在有已使用端口时才遍历
    if (( ${#used_ports[@]} > 0 )); then
        for i in $(seq 0 2 $((${#used_ports[@]} - 1))); do
            local app_port=${used_ports[$i]}
            local chrome_port=${used_ports[$((i + 1))]}

            if (( app_port >= max_app_port )); then
                max_app_port=$((app_port + 1))
            fi
            if (( chrome_port >= max_chrome_port )); then
                max_chrome_port=$((chrome_port + 1))
            fi
        done
    fi

    # 确保端口未被占用
    local app_port=$(get_next_available_port "$max_app_port")
    local chrome_port=$(get_next_available_port "$max_chrome_port")

    echo "$app_port $chrome_port"
}

# ============================================================================
# Agent 管理命令
# ============================================================================

# 检查 Agent ID 是否已存在
agent_id_exists() {
    local id=$1
    jq -e ".agents[] | select(.id == \"$id\")" "$CONFIG_FILE" > /dev/null 2>&1
}

# 添加 Agent
cmd_add() {
    local type=$1
    local custom_id=${2:-}
    local count=${3:-1}

    # 如果指定了自定义 ID，count 必须为 1
    if [[ -n "$custom_id" && "$count" -gt 1 ]]; then
        log_error "使用自定义 ID 时不能同时指定 --count"
        exit 1
    fi
    if [[ -n "$custom_id" ]]; then
        validate_agent_id "$custom_id" || exit 1
    fi

    # 验证类型
    if ! jq -e ".templates.$type" "$TEMPLATE_FILE" > /dev/null 2>&1; then
        log_error "未知的 Agent 类型: $type"
        log_info "可用类型: $(jq -r '.templates | keys[]' "$TEMPLATE_FILE" | tr '\n' ' ')"
        exit 1
    fi

    local template=$(jq -c ".templates.$type" "$TEMPLATE_FILE")
    local template_name=$(echo "$template" | jq -r '.name')

    # 验证关键配置
    local user_data_base=$(get_setting "userDataDirBase")
    local start_app_port=$(get_setting "startPort")
    local start_chrome_port=$(get_setting "startChromePort")

    validate_config "$user_data_base" "userDataDirBase" || exit 1
    validate_config "$start_app_port" "startPort" || exit 1
    validate_config "$start_chrome_port" "startChromePort" || exit 1

    log_step "添加 $count 个 $template_name..."

    for i in $(seq 1 "$count"); do
        local agent_id
        local agent_num

        if [[ -n "$custom_id" ]]; then
            # 使用自定义 ID
            agent_id="$custom_id"
            # 从自定义 ID 中提取编号用于显示名称（如果符合 type-N 格式）
            if [[ "$custom_id" =~ -([0-9]+)$ ]]; then
                agent_num=${BASH_REMATCH[1]}
            else
                agent_num=1
            fi
            # 检查 ID 是否已存在
            if agent_id_exists "$agent_id"; then
                log_error "Agent ID 已存在: $agent_id"
                exit 1
            fi
        else
            # 自动生成 ID
            agent_num=$(get_next_agent_number "$type")
            agent_id="${type}-${agent_num}"
        fi
        validate_agent_id "$agent_id" || exit 1

        # 分配端口
        local ports
        if ! ports=$(allocate_ports); then
            log_error "端口分配失败，中止添加 Agent"
            exit 1
        fi
        read -r app_port chrome_port <<< "$ports"

        # 生成用户数据目录
        local user_data_dir="${user_data_base}/${agent_id}"

        # 创建 Agent 配置
        local new_agent=$(cat <<EOF
{
  "id": "$agent_id",
  "type": "$type",
  "name": "$template_name $agent_num",
  "description": "$(echo "$template" | jq -r '.description') - 实例 $agent_num",
  "appPort": $app_port,
  "chromePort": $chrome_port,
  "userDataDir": "$user_data_dir",
  "chromeArgs": $(echo "$template" | jq -c '.chromeArgs'),
  "env": $(echo "$template" | jq -c '.env'),
  "createdAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
)

        # 添加到配置文件
        if ! update_config_atomic '.agents += [$new_agent]' --argjson new_agent "$new_agent"; then
            log_error "更新配置文件失败"
            exit 1
        fi

        log_success "已添加 Agent: $agent_id (App: $app_port, Chrome: $chrome_port)"
    done
}

# 列出所有 Agent
cmd_list() {
    log_info "当前 Agent 列表:"
    echo ""

    local count=0
    while IFS= read -r agent; do
        local id=$(echo "$agent" | jq -r '.id')
        local name=$(echo "$agent" | jq -r '.name')
        local app_port=$(echo "$agent" | jq -r '.appPort')
        local chrome_port=$(echo "$agent" | jq -r '.chromePort')
        local status="已停止"
        local color=$RED

        # 检查进程状态
        if [[ -f "$PIDS_DIR/${id}.pid" ]]; then
            local pid=$(cat "$PIDS_DIR/${id}.pid")
            if ps -p "$pid" > /dev/null 2>&1; then
                status="运行中"
                color=$GREEN
            fi
        fi

        echo -e "  ${CYAN}$id${NC}"
        echo -e "    名称: $name"
        echo -e "    应用端口: ${BLUE}$app_port${NC}"
        echo -e "    浏览器端口: ${BLUE}$chrome_port${NC}"
        echo -e "    状态: ${color}${status}${NC}"
        echo ""

        ((count++))
    done < <(get_agents)

    if (( count == 0 )); then
        log_warn "暂无 Agent，使用 'add' 命令添加"
    else
        log_info "共 $count 个 Agent"
    fi
}

# 启动 Chrome
start_chrome() {
    local agent_id=$1
    local agent=$2

    local chrome_port=$(echo "$agent" | jq -r '.chromePort')
    local user_data_dir=$(echo "$agent" | jq -r '.userDataDir')
    local chrome_exec=$(get_setting "chromeExecutable")

    # 验证 Chrome 可执行文件路径
    if [[ -z "$chrome_exec" || "$chrome_exec" == "null" ]]; then
        log_error "Chrome 可执行文件路径未配置或无效"
        log_info "请在 $CONFIG_FILE 中设置 settings.chromeExecutable"
        return 1
    fi

    if [[ ! -f "$chrome_exec" && ! -d "$chrome_exec" ]]; then
        log_error "Chrome 可执行文件不存在: $chrome_exec"
        log_info "请检查路径是否正确"
        return 1
    fi

    # 验证 userDataDir 配置
    if [[ -z "$user_data_dir" || "$user_data_dir" == "null" ]]; then
        log_error "userDataDir 未配置或无效"
        log_info "请在 $CONFIG_FILE 中设置 agents[].userDataDir"
        return 1
    fi

    # 检查是否已有 Chrome 使用同一 user-data-dir
    local existing_profile_pids=$(pgrep -f "user-data-dir=$user_data_dir" 2>/dev/null || true)
    if [[ -n "$existing_profile_pids" ]]; then
        log_error "检测到使用相同 user-data-dir 的 Chrome 仍在运行: $existing_profile_pids"
        log_info "请先 stop 相关 Agent 或稍后重试，避免 IndexedDB 目录错误"
        return 1
    fi

    if is_port_in_use "$chrome_port"; then
        local existing_pid=$(get_pid_by_port "$chrome_port")
        log_error "Chrome 调试端口 $chrome_port 已被占用${existing_pid:+ (PID: $existing_pid)}"
        log_info "请先停止占用端口的进程或调整配置"
        return 1
    fi

    # 创建用户数据目录
    mkdir -p "$user_data_dir"

    # 构建 Chrome 启动参数
    local chrome_args=(
        "--remote-debugging-port=$chrome_port"
        "--no-first-run"
        "--no-default-browser-check"
        "--disable-default-apps"
        "--user-data-dir=$user_data_dir"
    )

    # 合并 agent 自定义 Chrome 启动参数
    local extra_args=()
    while IFS= read -r arg; do
        if [[ -n "$arg" ]]; then
            arg=${arg//'{{chromePort}}'/$chrome_port}
            arg=${arg//'{{userDataDir}}'/$user_data_dir}
            extra_args+=("$arg")
        fi
    done < <(echo "$agent" | jq -r '.chromeArgs[]?' 2>/dev/null || true)
    if (( ${#extra_args[@]} > 0 )); then
        chrome_args+=("${extra_args[@]}")
    fi

    # 推导 app bundle 路径 (macOS)
    local chrome_app=""
    if [[ "$chrome_exec" == *.app ]]; then
        chrome_app="$chrome_exec"
    elif [[ "$chrome_exec" == *"/Contents/MacOS/"* ]]; then
        chrome_app="${chrome_exec%%/Contents/MacOS/*}"
    fi

    # 启动 Chrome
    # 使用 open -a 命令启动（macOS 原生方式）
    # 这样可以保留原生 UI 功能（如文件选择对话框）
    log_step "启动 Chrome (端口: $chrome_port)..."
    local chrome_pid=""

    if [[ "$OSTYPE" == "darwin"* ]]; then
        if [[ -n "$chrome_app" && -d "$chrome_app" ]]; then
            # macOS: 使用 open 命令，保留原生 UI 功能
            open -na "$chrome_app" --args "${chrome_args[@]}"
        else
            # 回退: 直接执行可执行文件
            "$chrome_exec" "${chrome_args[@]}" > "$LOGS_DIR/${agent_id}-chrome.log" 2>&1 &
            chrome_pid=$!
        fi

        # open 命令立即返回，需要等待并查找 Chrome 进程
        sleep 2
        # 通过 user-data-dir 参数查找对应的 Chrome 进程
        chrome_pid=$(pgrep -f "user-data-dir=$user_data_dir" | head -1)

        if [[ -z "$chrome_pid" ]]; then
            log_warn "无法获取 Chrome PID，使用端口检测替代"
        fi
    else
        # Linux/其他: 直接启动
        "$chrome_exec" "${chrome_args[@]}" > "$LOGS_DIR/${agent_id}-chrome.log" 2>&1 &
        chrome_pid=$!
    fi

    # 等待 Chrome 就绪
    local timeout=$CHROME_STARTUP_TIMEOUT
    local count=0
    while ! curl -s "http://localhost:$chrome_port/json/version" > /dev/null 2>&1; do
        sleep "$CHROME_PROCESS_CHECK_INTERVAL"
        ((count++))
        if (( count >= timeout )); then
            log_error "Chrome 启动超时"
            return 1
        fi
    done

    # 通过调试端口获取更可靠的 Chrome PID
    local port_pid=$(get_pid_by_port "$chrome_port")
    if [[ -n "$port_pid" ]]; then
        chrome_pid="$port_pid"
    fi

    # 保存 Chrome PID（如果获取到）
    if [[ -n "$chrome_pid" ]]; then
        echo "$chrome_pid" > "$PIDS_DIR/${agent_id}-chrome.pid"
    fi

    if [[ -n "$chrome_pid" ]]; then
        log_success "Chrome 已就绪 (PID: $chrome_pid)"
    else
        log_success "Chrome 已就绪 (端口: $chrome_port)"
    fi
    return 0
}

# 启动应用
start_app() {
    local agent_id=$1
    local agent=$2

    local app_port=$(echo "$agent" | jq -r '.appPort')
    local chrome_port=$(echo "$agent" | jq -r '.chromePort')

    # 检查 standalone 构建是否存在
    local standalone_dir="$PROJECT_ROOT/.next/standalone"
    if [[ ! -d "$standalone_dir" ]]; then
        log_error "standalone 构建不存在，请先运行 pnpm build"
        return 1
    fi

    # 为每个 Agent 创建独立的运行目录，避免多进程竞争
    local agent_runtime_dir="/tmp/agent-runtime/${agent_id}"

    # 如果运行目录已存在且有进程在用，跳过复制
    if [[ -d "$agent_runtime_dir" ]] && [[ -f "$PIDS_DIR/${agent_id}.pid" ]]; then
        local old_pid=$(cat "$PIDS_DIR/${agent_id}.pid" 2>/dev/null)
        if ps -p "$old_pid" > /dev/null 2>&1; then
            log_warn "Agent $agent_id 似乎已在运行"
            return 1
        fi
    fi

    log_step "准备 Agent 运行环境..."
    rm -rf "$agent_runtime_dir"
    mkdir -p "$agent_runtime_dir"

    # 复制 standalone 构建（使用硬链接加速，失败则普通复制）
    cp -al "$standalone_dir/." "$agent_runtime_dir/" 2>/dev/null || \
        cp -a "$standalone_dir/." "$agent_runtime_dir/"

    # 复制静态资源（standalone 模式需要）
    if [[ -d "$PROJECT_ROOT/.next/static" ]]; then
        mkdir -p "$agent_runtime_dir/.next"
        cp -al "$PROJECT_ROOT/.next/static" "$agent_runtime_dir/.next/" 2>/dev/null || \
            cp -a "$PROJECT_ROOT/.next/static" "$agent_runtime_dir/.next/"
    fi
    if [[ -d "$PROJECT_ROOT/public" ]]; then
        cp -al "$PROJECT_ROOT/public" "$agent_runtime_dir/" 2>/dev/null || \
            cp -a "$PROJECT_ROOT/public" "$agent_runtime_dir/"
    fi

    # 复制环境变量文件（standalone 模式需要）
    for env_file in "$PROJECT_ROOT"/.env*; do
        [[ -f "$env_file" ]] && cp "$env_file" "$agent_runtime_dir/"
    done

    log_step "启动应用服务器 (端口: $app_port)..."

    # 使用 standalone 模式启动
    # 注意：standalone 模式下 node server.js 不会自动加载 .env 文件
    # 使用 bash -c 在子进程中 source .env 文件后启动
    cd "$agent_runtime_dir"
    bash -c "
        set -a
        [[ -f .env ]] && source .env
        [[ -f .env.local ]] && source .env.local
        set +a
        export PORT=$app_port
        export HOSTNAME=0.0.0.0
        export CHROME_REMOTE_DEBUGGING_PORT=$chrome_port
        export AGENT_ID=$agent_id
        exec node server.js
    " > "$LOGS_DIR/${agent_id}-app.log" 2>&1 &
    local app_pid=$!

    # 保存应用 PID
    echo "$app_pid" > "$PIDS_DIR/${agent_id}.pid"

    # 等待应用就绪
    local timeout=$APP_STARTUP_TIMEOUT
    local count=0
    while ! curl -s "http://localhost:$app_port/api/health" > /dev/null 2>&1; do
        sleep "$APP_HEALTH_CHECK_INTERVAL"
        ((count++))
        if (( count >= timeout )); then
            log_error "应用启动超时"
            return 1
        fi
    done

    log_success "应用已就绪 (PID: $app_pid)"
    return 0
}

# 启动 Agent
cmd_start() {
    local target_id=${1:-}

    if [[ -z "$target_id" ]]; then
        # 启动所有
        log_info "启动所有 Agent..."
        local failed=()
        while IFS= read -r agent; do
            local id=$(echo "$agent" | jq -r '.id')
            if ! cmd_start "$id"; then
                failed+=("$id")
            fi
        done < <(get_agents)
        if (( ${#failed[@]} > 0 )); then
            log_warn "以下 Agent 启动失败: ${failed[*]}"
            return 1
        fi
        return
    fi

    validate_agent_id "$target_id" || return 1

    # 获取 Agent 配置
    local agent=$(jq -c ".agents[] | select(.id == \"$target_id\")" "$CONFIG_FILE")
    if [[ -z "$agent" ]]; then
        log_error "未找到 Agent: $target_id"
        return 1
    fi

    # 检查是否已运行
    if [[ -f "$PIDS_DIR/${target_id}.pid" ]]; then
        local pid=$(cat "$PIDS_DIR/${target_id}.pid")
        if ps -p "$pid" > /dev/null 2>&1; then
            log_warn "Agent $target_id 已在运行中 (PID: $pid)"
            return
        fi
    fi

    log_info "启动 Agent: $target_id"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # 启动 Chrome
    if ! start_chrome "$target_id" "$agent"; then
        log_error "Chrome 启动失败"
        cmd_stop "$target_id"
        return 1
    fi

    # 启动应用
    if ! start_app "$target_id" "$agent"; then
        log_error "应用启动失败"
        cmd_stop "$target_id"
        return 1
    fi

    local app_port=$(echo "$agent" | jq -r '.appPort')
    local chrome_port=$(echo "$agent" | jq -r '.chromePort')

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_success "Agent $target_id 启动成功!"
    echo -e "  ${CYAN}应用访问:${NC} http://localhost:$app_port"
    echo -e "  ${CYAN}Chrome 调试:${NC} http://localhost:$chrome_port"
    echo -e "  ${CYAN}日志目录:${NC} $LOGS_DIR"
    echo ""
}

# 停止 Agent
cmd_stop() {
    local target_id=${1:-}

    if [[ -z "$target_id" ]]; then
        # 停止所有
        log_info "停止所有 Agent..."
        local failed=()
        while IFS= read -r agent; do
            local id=$(echo "$agent" | jq -r '.id')
            if ! cmd_stop "$id"; then
                failed+=("$id")
            fi
        done < <(get_agents)
        if (( ${#failed[@]} > 0 )); then
            log_warn "以下 Agent 停止失败: ${failed[*]}"
            return 1
        fi
        return
    fi

    validate_agent_id "$target_id" || return 1
    if ! jq -e ".agents[] | select(.id == \"$target_id\")" "$CONFIG_FILE" > /dev/null 2>&1; then
        log_warn "未找到 Agent: $target_id"
        return 1
    fi

    log_info "停止 Agent: $target_id"

    # 停止应用
    if [[ -f "$PIDS_DIR/${target_id}.pid" ]]; then
        local pid=$(cat "$PIDS_DIR/${target_id}.pid")
        if ps -p "$pid" > /dev/null 2>&1; then
            log_step "停止应用 (PID: $pid)..."
            kill "$pid" 2>/dev/null || true
            sleep "$AGENT_STOP_WAIT_TIME"
            # 强制杀死
            if ps -p "$pid" > /dev/null 2>&1; then
                kill -9 "$pid" 2>/dev/null || true
            fi
        fi
        rm -f "$PIDS_DIR/${target_id}.pid"
    fi

    # 停止 Chrome (优雅关闭以保护 IndexedDB)
    local agent=$(jq -c ".agents[] | select(.id == \"$target_id\")" "$CONFIG_FILE" 2>/dev/null)
    local chrome_port=$(echo "$agent" | jq -r '.chromePort' 2>/dev/null)
    local user_data_dir=$(echo "$agent" | jq -r '.userDataDir' 2>/dev/null)

    # 尝试从 PID 文件获取 Chrome PID
    local chrome_pid=""
    if [[ -f "$PIDS_DIR/${target_id}-chrome.pid" ]]; then
        chrome_pid=$(cat "$PIDS_DIR/${target_id}-chrome.pid")
    fi

    # 如果 PID 无效，尝试通过 user-data-dir 查找
    local need_find_chrome=false
    if [[ -z "$chrome_pid" ]]; then
        need_find_chrome=true
    elif ! ps -p "$chrome_pid" > /dev/null 2>&1; then
        need_find_chrome=true
    fi

    if [[ "$need_find_chrome" == "true" ]]; then
        if [[ -n "$chrome_port" && "$chrome_port" != "null" ]]; then
            chrome_pid=$(get_pid_by_port "$chrome_port")
        fi
        if [[ -z "$chrome_pid" && -n "$user_data_dir" && "$user_data_dir" != "null" ]]; then
            chrome_pid=$(pgrep -f "user-data-dir=$user_data_dir" 2>/dev/null | head -1 || true)
        fi
    fi

    if [[ -n "$chrome_pid" ]] && ps -p "$chrome_pid" > /dev/null 2>&1; then
        log_step "停止 Chrome (PID: $chrome_pid)..."

        # 步骤1: 通过 DevTools Protocol 关闭所有标签页 (触发 IndexedDB 刷盘)
        if [[ -n "$chrome_port" && "$chrome_port" != "null" ]]; then
            log_info "  关闭所有标签页以触发 IndexedDB 刷盘..."
            local targets=$(curl -s "http://localhost:$chrome_port/json" 2>/dev/null || echo "[]")
            local target_count=$(echo "$targets" | jq -r 'length' 2>/dev/null || echo "0")

            if [[ "$target_count" -gt 0 ]]; then
                log_info "  发现 $target_count 个标签页，逐个关闭..."
                for tab_id in $(echo "$targets" | jq -r '.[].id' 2>/dev/null); do
                    curl -s "http://localhost:$chrome_port/json/close/$tab_id" > /dev/null 2>&1 || true
                done
                # 等待 IndexedDB 完成刷盘
                log_info "  等待 IndexedDB 刷盘完成..."
                sleep 2
            fi
        fi

        # 步骤2: 发送 SIGTERM 信号 (允许进程清理)
        kill -TERM "$chrome_pid" 2>/dev/null || true

        # 步骤3: 等待更长时间让 Chrome 完成 IndexedDB 写入
        local wait_count=0
        while ps -p "$chrome_pid" > /dev/null 2>&1 && (( wait_count < CHROME_GRACEFUL_WAIT_TIME )); do
            sleep 1
            ((wait_count++))
            log_info "  等待 Chrome 优雅关闭... ($wait_count/$CHROME_GRACEFUL_WAIT_TIME)"
        done

        # 步骤4: 如果还活着，强制终止所有相关进程
        if ps -p "$chrome_pid" > /dev/null 2>&1; then
            log_warn "  Chrome 未响应 SIGTERM，强制终止..."
            # 杀死主进程及其所有子进程
            pkill -9 -P "$chrome_pid" 2>/dev/null || true
            kill -9 "$chrome_pid" 2>/dev/null || true
        fi

        # 步骤5: 清理可能残留的 Chrome 进程 (使用 user-data-dir 匹配)
        if [[ -n "$user_data_dir" && "$user_data_dir" != "null" ]]; then
            local stale_pids=$(pgrep -f "user-data-dir=$user_data_dir" 2>/dev/null || true)
            if [[ -n "$stale_pids" ]]; then
                log_warn "  清理残留 Chrome 进程: $stale_pids"
                echo "$stale_pids" | xargs kill -9 2>/dev/null || true
            fi
        fi

        # 步骤6: 等待文件锁完全释放
        sleep "$CHROME_FORCE_WAIT_TIME"
    fi

    # 最终确认 Chrome 已退出并释放 profile/端口
    local wait_count=0
    while (( wait_count < CHROME_GRACEFUL_WAIT_TIME )); do
        local active_port_pid=""
        if [[ -n "$chrome_port" && "$chrome_port" != "null" ]]; then
            active_port_pid=$(get_pid_by_port "$chrome_port")
        fi
        local active_profile_pids=""
        if [[ -n "$user_data_dir" && "$user_data_dir" != "null" ]]; then
            active_profile_pids=$(pgrep -f "user-data-dir=$user_data_dir" 2>/dev/null || true)
        fi
        if [[ -z "$active_port_pid" && -z "$active_profile_pids" ]]; then
            break
        fi
        log_info "  等待 Chrome 释放 profile..."
        sleep 1
        ((wait_count++))
    done

    if (( wait_count >= CHROME_GRACEFUL_WAIT_TIME )); then
        log_warn "  Chrome 可能仍占用 user-data-dir=$user_data_dir"
    fi

    # 清理 PID 文件
    rm -f "$PIDS_DIR/${target_id}-chrome.pid"

    log_success "Agent $target_id 已停止"
}

# 清理 IndexedDB 目录
cmd_clean_indexeddb() {
    local target_id=$1

    if [[ -z "$target_id" ]]; then
        log_error "请指定要清理的 Agent ID"
        exit 1
    fi

    validate_agent_id "$target_id" || exit 1
    if ! jq -e ".agents[] | select(.id == \"$target_id\")" "$CONFIG_FILE" > /dev/null 2>&1; then
        log_warn "未找到 Agent: $target_id"
        exit 1
    fi

    # 若仍在运行，拒绝清理
    local app_pid=""
    if [[ -f "$PIDS_DIR/${target_id}.pid" ]]; then
        app_pid=$(cat "$PIDS_DIR/${target_id}.pid" 2>/dev/null || true)
    fi
    if [[ -n "$app_pid" ]] && ps -p "$app_pid" > /dev/null 2>&1; then
        log_error "Agent $target_id 正在运行中，请先 stop 后再清理"
        exit 1
    fi

    local agent=$(jq -c ".agents[] | select(.id == \"$target_id\")" "$CONFIG_FILE" 2>/dev/null)
    local chrome_port=$(echo "$agent" | jq -r '.chromePort' 2>/dev/null)
    local chrome_pid=""
    if [[ -f "$PIDS_DIR/${target_id}-chrome.pid" ]]; then
        chrome_pid=$(cat "$PIDS_DIR/${target_id}-chrome.pid" 2>/dev/null || true)
    fi
    if [[ -z "$chrome_pid" && -n "$chrome_port" && "$chrome_port" != "null" ]]; then
        chrome_pid=$(get_pid_by_port "$chrome_port")
    fi
    if [[ -n "$chrome_pid" ]] && ps -p "$chrome_pid" > /dev/null 2>&1; then
        log_error "Agent $target_id 的 Chrome 仍在运行，请先 stop 后再清理"
        exit 1
    fi

    local user_data_dir=$(echo "$agent" | jq -r '.userDataDir' 2>/dev/null)
    if [[ -z "$user_data_dir" || "$user_data_dir" == "null" ]]; then
        log_error "未配置 userDataDir，无法清理 IndexedDB"
        exit 1
    fi

    local indexeddb_dir="${user_data_dir}/Default/IndexedDB"
    if [[ -d "$indexeddb_dir" ]]; then
        log_step "清理 IndexedDB: $indexeddb_dir"
        rm -rf "$indexeddb_dir"
        log_success "IndexedDB 已清理"
    else
        log_warn "IndexedDB 目录不存在: $indexeddb_dir"
    fi
}

# 删除 Agent
cmd_remove() {
    local target_id=$1

    if [[ -z "$target_id" ]]; then
        log_error "请指定要删除的 Agent ID"
        exit 1
    fi
    validate_agent_id "$target_id" || exit 1
    if ! jq -e ".agents[] | select(.id == \"$target_id\")" "$CONFIG_FILE" > /dev/null 2>&1; then
        log_warn "未找到 Agent: $target_id"
        exit 1
    fi

    # 先停止
    cmd_stop "$target_id"

    # 从配置文件删除
    if ! update_config_atomic 'del(.agents[] | select(.id == $id))' --arg id "$target_id"; then
        log_error "更新配置文件失败"
        exit 1
    fi

    # 删除日志文件
    rm -f "$LOGS_DIR/${target_id}"*.log

    log_success "已删除 Agent: $target_id"
}

# 查看状态
cmd_status() {
    cmd_list
}

# 查看日志
cmd_logs() {
    local target_id=$1
    local log_type=${2:-app}

    if [[ -z "$target_id" ]]; then
        log_error "请指定 Agent ID"
        exit 1
    fi

    local log_file="$LOGS_DIR/${target_id}-${log_type}.log"

    if [[ ! -f "$log_file" ]]; then
        log_error "日志文件不存在: $log_file"
        exit 1
    fi

    tail -f "$log_file"
}

# 全局状态变量（用于 trap，避免局部变量被清理）
declare -a _UPDATE_RUNNING_AGENTS=()
_UPDATE_DID_STASH=false
_UPDATE_STASH_MESSAGE=""
_UPDATE_FAILED=false

# 🛡️ 错误处理函数 - 失败时恢复服务（全局函数，可访问全局状态）
_cleanup_update_on_error() {
    local exit_code=$?

    if [[ $exit_code -ne 0 ]] || [[ "$_UPDATE_FAILED" == "true" ]]; then
        log_error "更新流程失败 (退出码: $exit_code)"

        # 恢复 stash (如果有)
        if [[ "$_UPDATE_DID_STASH" == "true" ]]; then
            log_step "恢复暂存的更改..."
            cd "$PROJECT_ROOT"
            if git stash pop > /dev/null 2>&1; then
                log_success "已恢复暂存的更改"
            else
                log_warn "无法自动恢复暂存，请手动执行: git stash pop"
                log_info "暂存消息: $_UPDATE_STASH_MESSAGE"
            fi
        fi

        # 尝试重启之前运行的 Agent
        if (( ${#_UPDATE_RUNNING_AGENTS[@]} > 0 )); then
            log_warn "尝试重启之前运行的 ${#_UPDATE_RUNNING_AGENTS[@]} 个 Agent..."
            sleep "$PORT_RELEASE_WAIT_TIME"
            local restart_success=0
            for agent_id in "${_UPDATE_RUNNING_AGENTS[@]}"; do
                if cmd_start "$agent_id" 2>/dev/null; then
                    ((restart_success++))
                else
                    log_error "重启 $agent_id 失败"
                fi
            done

            if (( restart_success == ${#_UPDATE_RUNNING_AGENTS[@]} )); then
                log_success "所有 Agent 已恢复运行"
            else
                log_error "部分 Agent 恢复失败 ($restart_success/${#_UPDATE_RUNNING_AGENTS[@]})"
                log_info "请手动检查并重启失败的 Agent"
            fi
        fi

        log_error "更新流程已中止，服务已尝试恢复"

        # 清理全局状态
        _UPDATE_RUNNING_AGENTS=()
        _UPDATE_DID_STASH=false
        _UPDATE_STASH_MESSAGE=""
        _UPDATE_FAILED=false

        exit 1
    fi
}

# ============================================================================
# Update 流程私有函数
# ============================================================================

# 收集当前运行的 Agent
_collect_running_agents() {
    log_step "检测运行中的 Agent..."
    _UPDATE_RUNNING_AGENTS=()

    while IFS= read -r agent; do
        local id=$(echo "$agent" | jq -r '.id')
        if [[ -f "$PIDS_DIR/${id}.pid" ]]; then
            local pid=$(cat "$PIDS_DIR/${id}.pid")
            if ps -p "$pid" > /dev/null 2>&1; then
                _UPDATE_RUNNING_AGENTS+=("$id")
                log_info "  ✓ $id (运行中, PID: $pid)"
            fi
        fi
    done < <(get_agents)

    if (( ${#_UPDATE_RUNNING_AGENTS[@]} == 0 )); then
        log_warn "没有运行中的 Agent"
        read -p "是否继续更新？[y/N] " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "更新已取消"
            return 1
        fi
    else
        log_success "检测到 ${#_UPDATE_RUNNING_AGENTS[@]} 个运行中的 Agent"
    fi
    return 0
}

# 停止所有运行的 Agent
_stop_running_agents() {
    if (( ${#_UPDATE_RUNNING_AGENTS[@]} > 0 )); then
        log_step "停止所有运行中的 Agent..."
        for agent_id in "${_UPDATE_RUNNING_AGENTS[@]}"; do
            cmd_stop "$agent_id"
        done
        log_success "所有 Agent 已停止"
    fi
}

# 拉取代码并处理 stash
_pull_code_with_stash() {
    local skip_pull=$1

    if [[ "$skip_pull" == "true" ]]; then
        log_info "跳过代码拉取 (--skip-pull)"
        return 0
    fi

    log_step "拉取最新代码..."
    cd "$PROJECT_ROOT"

    # 保存当前分支
    local current_branch=$(git rev-parse --abbrev-ref HEAD)
    log_info "当前分支: $current_branch"

    # 检查是否有未提交的更改
    if ! git diff-index --quiet HEAD --; then
        log_warn "检测到未提交的更改"
        git status --short
        echo ""
        log_warn "选项："
        log_info "  [y] 暂存更改并继续 (自动 git stash)"
        log_info "  [n] 取消更新并恢复 Agent"
        echo ""
        read -p "是否暂存并继续？[y/N] " -n 1 -r
        echo

        if [[ $REPLY =~ ^[Yy]$ ]]; then
            _UPDATE_STASH_MESSAGE="auto-stash before update $(date +%Y%m%d_%H%M%S)"
            if git stash push -m "$_UPDATE_STASH_MESSAGE"; then
                _UPDATE_DID_STASH=true
                local stash_id=$(git stash list | head -1 | cut -d: -f1)
                log_success "更改已暂存 (ID: $stash_id, 消息: $_UPDATE_STASH_MESSAGE)"
            else
                log_error "暂存失败"
                return 1
            fi
        else
            log_error "更新已取消"
            _UPDATE_FAILED=false  # 用户主动取消，不触发错误处理
            trap - EXIT  # 清除 trap
            # 重启之前运行的 Agent
            if (( ${#_UPDATE_RUNNING_AGENTS[@]} > 0 )); then
                log_info "重启之前运行的 Agent..."
                for agent_id in "${_UPDATE_RUNNING_AGENTS[@]}"; do
                    cmd_start "$agent_id"
                done
            fi
            return 2  # 用户取消，返回特殊码
        fi
    fi

    # 拉取最新代码
    if ! git pull origin "$current_branch"; then
        log_error "代码拉取失败"
        return 1
    fi
    log_success "代码更新成功"
    return 0
}

# 安装依赖 (如果需要)
_install_dependencies_if_needed() {
    local skip_install=$1

    if [[ "$skip_install" == "true" ]]; then
        log_info "跳过依赖安装 (--skip-install)"
        return 0
    fi

    log_step "检查依赖更新..."
    cd "$PROJECT_ROOT"

    # 检测 package.json 是否有变化
    local need_install=false
    if git diff 'HEAD@{1}' HEAD --name-only 2>/dev/null | grep -q "package.json\|pnpm-lock.yaml"; then
        need_install=true
        log_warn "检测到依赖变化，需要重新安装"
    else
        log_info "依赖无变化，跳过安装"
    fi

    if [[ "$need_install" == "true" ]]; then
        log_step "安装依赖..."
        if ! pnpm install; then
            log_error "依赖安装失败"
            return 1
        fi
        log_success "依赖安装成功"
    fi
    return 0
}

# 构建项目
_build_project() {
    log_step "构建项目..."
    cd "$PROJECT_ROOT"

    if ! pnpm build; then
        log_error "项目构建失败"
        log_warn "构建失败，服务将尝试恢复"
        return 1
    fi
    log_success "项目构建成功"
    return 0
}

# 恢复 stash (如果有)
_restore_stash() {
    if [[ "$_UPDATE_DID_STASH" != "true" ]]; then
        return 0
    fi

    log_step "恢复暂存的更改..."
    cd "$PROJECT_ROOT"
    if git stash pop > /dev/null 2>&1; then
        log_success "已恢复暂存的更改"
        _UPDATE_DID_STASH=false  # 标记已恢复，防止 trap 重复恢复
    else
        log_warn "无法自动恢复暂存 (可能有冲突)"
        log_info "请手动解决冲突后执行: git stash pop"
        log_info "暂存消息: $_UPDATE_STASH_MESSAGE"
    fi
    return 0
}

# 重启 Agent 并显示统计
_restart_agents_with_stats() {
    if (( ${#_UPDATE_RUNNING_AGENTS[@]} == 0 )); then
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        log_success "更新完成！没有需要重启的 Agent"
        log_info "使用 './scripts/multi-agent.sh start' 启动 Agent"
        return 0
    fi

    log_step "重启之前运行的 Agent..."
    sleep "$PORT_RELEASE_WAIT_TIME"  # 等待端口释放

    local restart_success=0
    local restart_failed=()
    for agent_id in "${_UPDATE_RUNNING_AGENTS[@]}"; do
        log_info "重启 $agent_id..."
        if cmd_start "$agent_id" 2>/dev/null; then
            ((restart_success++))
        else
            restart_failed+=("$agent_id")
            log_error "重启 $agent_id 失败"
        fi
    done

    # 显示统计
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    if (( restart_success == ${#_UPDATE_RUNNING_AGENTS[@]} )); then
        log_success "更新完成！已成功重启 ${#_UPDATE_RUNNING_AGENTS[@]} 个 Agent"
    else
        log_warn "更新完成，但部分 Agent 重启失败 ($restart_success/${#_UPDATE_RUNNING_AGENTS[@]})"
        if (( ${#restart_failed[@]} > 0 )); then
            log_error "重启失败的 Agent: ${restart_failed[*]}"
            log_info "请手动检查日志并重启失败的 Agent"
        fi
    fi

    # 显示重启的 Agent 列表
    echo -e "\n${CYAN}已重启的 Agent:${NC}"
    for agent_id in "${_UPDATE_RUNNING_AGENTS[@]}"; do
        local agent=$(jq -c ".agents[] | select(.id == \"$agent_id\")" "$CONFIG_FILE")
        local app_port=$(echo "$agent" | jq -r '.appPort')

        # 检查是否重启失败
        local status="${GREEN}✓${NC}"
        for failed in "${restart_failed[@]}"; do
            if [[ "$failed" == "$agent_id" ]]; then
                status="${RED}✗${NC}"
                break
            fi
        done

        echo -e "  $status ${CYAN}$agent_id${NC} - http://localhost:$app_port"
    done
    return 0
}

# 更新代码并重启 - 主流程编排
cmd_update() {
    local skip_pull=${1:-false}
    local skip_install=${2:-false}

    log_info "开始更新流程..."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # 重置全局状态
    _UPDATE_RUNNING_AGENTS=()
    _UPDATE_DID_STASH=false
    _UPDATE_STASH_MESSAGE=""
    _UPDATE_FAILED=false

    # 设置 trap 捕获错误并自动清理
    trap _cleanup_update_on_error EXIT

    # Step 1: 收集运行中的 Agent
    if ! _collect_running_agents; then
        trap - EXIT
        return 0
    fi

    # Step 2: 停止所有运行的 Agent
    _stop_running_agents

    # Step 3: 拉取代码并处理 stash
    # 使用 || 捕获返回值，防止 set -e 立即退出，同时保持函数内部的 set -e 语义
    local pull_result=0
    _pull_code_with_stash "$skip_pull" || pull_result=$?

    if (( pull_result == 2 )); then
        # 用户取消，已在函数内恢复 Agent
        return 0
    elif (( pull_result != 0 )); then
        _UPDATE_FAILED=true
        return 1
    fi

    # Step 4: 安装依赖 (如果需要)
    if ! _install_dependencies_if_needed "$skip_install"; then
        _UPDATE_FAILED=true
        return 1
    fi

    # Step 5: 构建项目
    if ! _build_project; then
        _UPDATE_FAILED=true
        return 1
    fi

    # Step 6: 恢复 stash (如果有)
    _restore_stash

    # Step 7: 重启 Agent 并显示统计
    _restart_agents_with_stats

    # 清除 trap 和全局状态 (成功完成)
    trap - EXIT
    _UPDATE_RUNNING_AGENTS=()
    _UPDATE_DID_STASH=false
    _UPDATE_STASH_MESSAGE=""
    _UPDATE_FAILED=false
}

# ============================================================================
# 主函数
# ============================================================================

show_help() {
    cat <<EOF
${CYAN}Multi-Agent Manager${NC} - 优雅的多 Agent 并行管理系统

${YELLOW}用法:${NC}
  $0 <command> [options]

${YELLOW}命令:${NC}
  ${GREEN}add${NC} <type> [id] [options] 添加 Agent (类型: zhipin, yupao)
    ${YELLOW}选项:${NC}
      <id>                     自定义 Agent ID (位置参数或 --id)
      --id <id>                自定义 Agent ID
      --count N                添加 N 个 Agent (不能与自定义 ID 同时使用)
  ${GREEN}list${NC}                       列出所有 Agent
  ${GREEN}start${NC} [agent-id]           启动 Agent (不指定则启动全部)
  ${GREEN}stop${NC} [agent-id]            停止 Agent (不指定则停止全部)
  ${GREEN}restart${NC} [agent-id]         重启 Agent
  ${GREEN}remove${NC} <agent-id>          删除 Agent
  ${GREEN}clean-indexeddb${NC} <agent-id> 清理 IndexedDB 目录
  ${GREEN}status${NC}                     查看状态
  ${GREEN}logs${NC} <agent-id> [type]     查看日志 (type: app|chrome)
  ${GREEN}update${NC} [options]           更新代码并重启 Agent
    ${YELLOW}选项:${NC}
      --skip-pull              跳过 git pull (仅 build + 重启)
      --skip-install           跳过 pnpm install

${YELLOW}示例:${NC}
  ${CYAN}基础操作:${NC}
  $0 add zhipin              # 添加 1 个 BOSS直聘 Agent (自动 ID: zhipin-1)
  $0 add zhipin siwen-boss   # 添加自定义 ID 的 Agent
  $0 add zhipin --id test-1  # 使用 --id 指定自定义 ID
  $0 add zhipin --count 3    # 添加 3 个 BOSS直聘 Agent (自动 ID)
  $0 add yupao --count 2     # 添加 2 个鱼泡网 Agent
  $0 list                    # 列出所有 Agent
  $0 start                   # 启动所有 Agent
  $0 start zhipin-1          # 启动指定 Agent
  $0 stop                    # 停止所有 Agent
  $0 logs zhipin-1 app       # 查看应用日志
  $0 remove zhipin-1         # 删除 Agent

  ${CYAN}代码更新 (推荐):${NC}
  $0 update                  # 自动: pull + install + build + 重启运行的 Agent
  $0 update --skip-pull      # 仅: build + 重启 (代码已手动更新)
  $0 update --skip-install   # 跳过依赖安装 (加快速度)

EOF
}

main() {
    # 检查依赖
    check_dependencies

    # 初始化配置文件
    init_config

    # 初始化目录
    init_dirs

    # 解析命令
    local command=${1:-help}
    shift || true

    case "$command" in
        add)
            local type=$1
            shift || true
            local custom_id=""
            local count=1
            while [[ $# -gt 0 ]]; do
                case "$1" in
                    --count)
                        shift
                        count=${1:-1}
                        shift
                        ;;
                    --id)
                        shift
                        custom_id=${1:-}
                        shift
                        ;;
                    -*)
                        log_error "未知选项: $1"
                        show_help
                        exit 1
                        ;;
                    *)
                        # 位置参数作为自定义 ID
                        if [[ -z "$custom_id" ]]; then
                            custom_id=$1
                        fi
                        shift
                        ;;
                esac
            done
            cmd_add "$type" "$custom_id" "$count"
            ;;
        list)
            cmd_list
            ;;
        start)
            cmd_start "${1:-}"
            ;;
        stop)
            cmd_stop "${1:-}"
            ;;
        restart)
            local target=${1:-}
            cmd_stop "$target"
            sleep "$AGENT_RESTART_WAIT_TIME"
            cmd_start "$target"
            ;;
        remove)
            cmd_remove "${1:-}"
            ;;
        clean-indexeddb)
            cmd_clean_indexeddb "${1:-}"
            ;;
        status)
            cmd_status
            ;;
        logs)
            cmd_logs "${1:-}" "${2:-app}"
            ;;
        update)
            local skip_pull=false
            local skip_install=false
            while [[ $# -gt 0 ]]; do
                case "$1" in
                    --skip-pull)
                        skip_pull=true
                        shift
                        ;;
                    --skip-install)
                        skip_install=true
                        shift
                        ;;
                    *)
                        log_error "未知选项: $1"
                        show_help
                        exit 1
                        ;;
                esac
            done
            cmd_update "$skip_pull" "$skip_install"
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "未知命令: $command"
            show_help
            exit 1
            ;;
    esac
}

# 运行主函数
main "$@"
