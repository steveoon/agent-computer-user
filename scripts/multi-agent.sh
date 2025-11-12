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
readonly MAGENTA='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m' # No Color

# 路径配置
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
readonly CONFIG_FILE="$PROJECT_ROOT/configs/agents.json"
readonly TEMPLATE_FILE="$PROJECT_ROOT/configs/agent-templates.json"
readonly LOGS_DIR="$PROJECT_ROOT/logs/agents"
readonly PIDS_DIR="$PROJECT_ROOT/pids/agents"

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

# 添加 Agent
cmd_add() {
    local type=$1
    local count=${2:-1}

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
        local agent_num=$(get_next_agent_number "$type")
        local agent_id="${type}-${agent_num}"

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
        local updated_config=$(jq ".agents += [$new_agent]" "$CONFIG_FILE")
        echo "$updated_config" > "$CONFIG_FILE"

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

    if [[ ! -f "$chrome_exec" ]]; then
        log_error "Chrome 可执行文件不存在: $chrome_exec"
        log_info "请检查路径是否正确"
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

    # 启动 Chrome
    log_step "启动 Chrome (端口: $chrome_port)..."
    "$chrome_exec" "${chrome_args[@]}" > "$LOGS_DIR/${agent_id}-chrome.log" 2>&1 &
    local chrome_pid=$!

    # 保存 Chrome PID
    echo "$chrome_pid" > "$PIDS_DIR/${agent_id}-chrome.pid"

    # 等待 Chrome 就绪
    local timeout=10
    local count=0
    while ! curl -s "http://localhost:$chrome_port/json/version" > /dev/null 2>&1; do
        sleep 1
        ((count++))
        if (( count >= timeout )); then
            log_error "Chrome 启动超时"
            return 1
        fi
    done

    log_success "Chrome 已就绪 (PID: $chrome_pid)"
    return 0
}

# 启动应用
start_app() {
    local agent_id=$1
    local agent=$2

    local app_port=$(echo "$agent" | jq -r '.appPort')
    local chrome_port=$(echo "$agent" | jq -r '.chromePort')

    log_step "启动应用服务器 (端口: $app_port)..."

    cd "$PROJECT_ROOT"
    PORT=$app_port CHROME_REMOTE_DEBUGGING_PORT=$chrome_port pnpm start > "$LOGS_DIR/${agent_id}-app.log" 2>&1 &
    local app_pid=$!

    # 保存应用 PID
    echo "$app_pid" > "$PIDS_DIR/${agent_id}.pid"

    # 等待应用就绪
    local timeout=30
    local count=0
    while ! curl -s "http://localhost:$app_port/api/health" > /dev/null 2>&1; do
        sleep 1
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
        while IFS= read -r agent; do
            local id=$(echo "$agent" | jq -r '.id')
            cmd_start "$id"
        done < <(get_agents)
        return
    fi

    # 获取 Agent 配置
    local agent=$(jq -c ".agents[] | select(.id == \"$target_id\")" "$CONFIG_FILE")
    if [[ -z "$agent" ]]; then
        log_error "未找到 Agent: $target_id"
        exit 1
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
        exit 1
    fi

    # 启动应用
    if ! start_app "$target_id" "$agent"; then
        log_error "应用启动失败"
        cmd_stop "$target_id"
        exit 1
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
        while IFS= read -r agent; do
            local id=$(echo "$agent" | jq -r '.id')
            cmd_stop "$id"
        done < <(get_agents)
        return
    fi

    log_info "停止 Agent: $target_id"

    # 停止应用
    if [[ -f "$PIDS_DIR/${target_id}.pid" ]]; then
        local pid=$(cat "$PIDS_DIR/${target_id}.pid")
        if ps -p "$pid" > /dev/null 2>&1; then
            log_step "停止应用 (PID: $pid)..."
            kill "$pid" 2>/dev/null || true
            sleep 2
            # 强制杀死
            if ps -p "$pid" > /dev/null 2>&1; then
                kill -9 "$pid" 2>/dev/null || true
            fi
        fi
        rm -f "$PIDS_DIR/${target_id}.pid"
    fi

    # 停止 Chrome
    if [[ -f "$PIDS_DIR/${target_id}-chrome.pid" ]]; then
        local chrome_pid=$(cat "$PIDS_DIR/${target_id}-chrome.pid")
        if ps -p "$chrome_pid" > /dev/null 2>&1; then
            log_step "停止 Chrome (PID: $chrome_pid)..."
            kill "$chrome_pid" 2>/dev/null || true
            sleep 2
            # 强制杀死
            if ps -p "$chrome_pid" > /dev/null 2>&1; then
                kill -9 "$chrome_pid" 2>/dev/null || true
            fi
        fi
        rm -f "$PIDS_DIR/${target_id}-chrome.pid"
    fi

    log_success "Agent $target_id 已停止"
}

# 删除 Agent
cmd_remove() {
    local target_id=$1

    if [[ -z "$target_id" ]]; then
        log_error "请指定要删除的 Agent ID"
        exit 1
    fi

    # 先停止
    cmd_stop "$target_id"

    # 从配置文件删除
    local updated_config=$(jq "del(.agents[] | select(.id == \"$target_id\"))" "$CONFIG_FILE")
    echo "$updated_config" > "$CONFIG_FILE"

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

# ============================================================================
# 主函数
# ============================================================================

show_help() {
    cat <<EOF
${CYAN}Multi-Agent Manager${NC} - 优雅的多 Agent 并行管理系统

${YELLOW}用法:${NC}
  $0 <command> [options]

${YELLOW}命令:${NC}
  ${GREEN}add${NC} <type> [--count N]    添加 Agent (类型: zhipin, yupao)
  ${GREEN}list${NC}                       列出所有 Agent
  ${GREEN}start${NC} [agent-id]           启动 Agent (不指定则启动全部)
  ${GREEN}stop${NC} [agent-id]            停止 Agent (不指定则停止全部)
  ${GREEN}restart${NC} [agent-id]         重启 Agent
  ${GREEN}remove${NC} <agent-id>          删除 Agent
  ${GREEN}status${NC}                     查看状态
  ${GREEN}logs${NC} <agent-id> [type]     查看日志 (type: app|chrome)

${YELLOW}示例:${NC}
  $0 add zhipin              # 添加 1 个 BOSS直聘 Agent
  $0 add zhipin --count 3    # 添加 3 个 BOSS直聘 Agent
  $0 add yupao --count 2     # 添加 2 个鱼泡网 Agent
  $0 list                    # 列出所有 Agent
  $0 start                   # 启动所有 Agent
  $0 start zhipin-1          # 启动指定 Agent
  $0 stop                    # 停止所有 Agent
  $0 logs zhipin-1 app       # 查看应用日志
  $0 remove zhipin-1         # 删除 Agent

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
            local count=1
            if [[ "${1:-}" == "--count" ]]; then
                shift
                count=${1:-1}
            fi
            cmd_add "$type" "$count"
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
            sleep 2
            cmd_start "$target"
            ;;
        remove)
            cmd_remove "${1:-}"
            ;;
        status)
            cmd_status
            ;;
        logs)
            cmd_logs "${1:-}" "${2:-app}"
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
