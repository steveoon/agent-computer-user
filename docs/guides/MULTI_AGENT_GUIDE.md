# Multi-Agent Manager 使用指南

## 📖 概述

Multi-Agent Manager 是一个优雅的多 Agent 并行管理系统，允许你轻松管理多个自动化 Agent 实例，每个 Agent 运行在独立的应用端口和浏览器实例上。

## ✨ 核心特性

- 🚀 **一键添加** - 使用模板快速创建新 Agent
- 🎯 **自动编号** - 智能递增编号（zhipin-1, zhipin-2...）
- 🔌 **端口管理** - 自动分配和检测端口冲突
- 🏥 **健康检查** - 启动时自动验证服务就绪
- 📊 **进程管理** - PID 追踪和优雅关闭
- 📝 **日志管理** - 独立日志文件，彩色输出
- 🔒 **资源隔离** - 每个 Agent 独立的浏览器用户数据目录

## 🎯 使用场景

- 同时管理多个 BOSS直聘账号进行招聘自动化
- 并行操作多个鱼泡网账号
- 在不同浏览器会话中登录不同账号，避免冲突

## 📋 前置要求

### 系统依赖

```bash
# macOS 上安装依赖
brew install jq

# 验证所有依赖（脚本会自动检查）
jq --version      # JSON 解析
curl --version    # 健康检查
pnpm --version    # 包管理器
node --version    # Node.js 运行时
lsof -v           # 端口检测

# 如果缺少 pnpm
npm install -g pnpm
```

### 环境准备

确保项目已正确配置：
- Node.js 和 pnpm 已安装
- 项目依赖已安装（`pnpm install`）
- 应用可以正常构建和运行（`pnpm build`）

## 💡 调用方式

本工具支持两种调用方式，效果完全相同：

### 方式 1: 直接调用脚本（推荐用于脚本和自动化）
```bash
./scripts/multi-agent.sh <command> [options]
```

### 方式 2: 使用 pnpm 快捷命令（推荐日常使用）
```bash
pnpm agent:<command> [options]
```

**示例对照：**
```bash
# 两种方式等价
./scripts/multi-agent.sh add zhipin --count 3
pnpm agent:add zhipin --count 3

./scripts/multi-agent.sh logs zhipin-1 chrome
pnpm agent:logs zhipin-1 chrome
```

**注意：** 使用 pnpm 命令时，参数直接跟在命令后面，无需 `--` 分隔符。

## 🚀 快速开始

### 1. 添加第一个 Agent

```bash
# 添加一个 BOSS直聘 Agent
./scripts/multi-agent.sh add zhipin

# 添加一个鱼泡网 Agent
./scripts/multi-agent.sh add yupao
```

### 2. 批量添加 Agent

```bash
# 一次性添加 3 个 BOSS直聘 Agent
./scripts/multi-agent.sh add zhipin --count 3

# 一次性添加 2 个鱼泡网 Agent
./scripts/multi-agent.sh add yupao --count 2
```

### 3. 查看 Agent 列表

```bash
./scripts/multi-agent.sh list
```

输出示例：
```
[INFO] 当前 Agent 列表:

  zhipin-1
    名称: BOSS直聘代理 1
    应用端口: 3000
    浏览器端口: 9222
    状态: 已停止

  zhipin-2
    名称: BOSS直聘代理 2
    应用端口: 3001
    浏览器端口: 9223
    状态: 已停止
```

### 4. 启动 Agent

```bash
# 启动所有 Agent
./scripts/multi-agent.sh start

# 启动指定 Agent
./scripts/multi-agent.sh start zhipin-1
```

### 5. 停止 Agent

```bash
# 停止所有 Agent
./scripts/multi-agent.sh stop

# 停止指定 Agent
./scripts/multi-agent.sh stop zhipin-1
```

### 6. 查看日志

```bash
# 查看应用日志
./scripts/multi-agent.sh logs zhipin-1 app

# 查看浏览器日志
./scripts/multi-agent.sh logs zhipin-1 chrome
```

### 7. 删除 Agent

```bash
# 删除指定 Agent
./scripts/multi-agent.sh remove zhipin-1
```

## 📚 完整命令参考

### add - 添加 Agent

```bash
./scripts/multi-agent.sh add <type> [--count N]
```

- `<type>`: Agent 类型，可选值：`zhipin` | `yupao`
- `--count N`: 批量添加数量，默认为 1

**示例：**
```bash
./scripts/multi-agent.sh add zhipin
./scripts/multi-agent.sh add zhipin --count 5
./scripts/multi-agent.sh add yupao --count 2
```

### list - 列出所有 Agent

```bash
./scripts/multi-agent.sh list
```

显示所有 Agent 的详细信息，包括 ID、名称、端口、运行状态等。

### start - 启动 Agent

```bash
./scripts/multi-agent.sh start [agent-id]
```

- 不指定 `agent-id` 则启动所有 Agent
- 指定 `agent-id` 启动特定 Agent

**示例：**
```bash
./scripts/multi-agent.sh start              # 启动全部
./scripts/multi-agent.sh start zhipin-1     # 启动指定
```

### stop - 停止 Agent

```bash
./scripts/multi-agent.sh stop [agent-id]
```

- 不指定 `agent-id` 则停止所有 Agent
- 指定 `agent-id` 停止特定 Agent

**示例：**
```bash
./scripts/multi-agent.sh stop              # 停止全部
./scripts/multi-agent.sh stop zhipin-1     # 停止指定
```

### restart - 重启 Agent

```bash
./scripts/multi-agent.sh restart [agent-id]
```

**示例：**
```bash
./scripts/multi-agent.sh restart zhipin-1
```

### remove - 删除 Agent

```bash
./scripts/multi-agent.sh remove <agent-id>
```

**警告：** 删除操作会：
1. 停止 Agent 进程
2. 从配置文件中移除
3. 删除日志文件
4. 无法恢复

**示例：**
```bash
./scripts/multi-agent.sh remove zhipin-1
```

### status - 查看状态

```bash
./scripts/multi-agent.sh status
```

等同于 `list` 命令。

### logs - 查看日志

```bash
./scripts/multi-agent.sh logs <agent-id> [type]
```

- `<agent-id>`: Agent ID
- `[type]`: 日志类型，可选值：`app` | `chrome`，默认为 `app`

**示例：**
```bash
./scripts/multi-agent.sh logs zhipin-1 app
./scripts/multi-agent.sh logs zhipin-1 chrome
```

## 🎨 典型工作流

### 场景 1: 开发测试单个 Agent

```bash
# 1. 添加一个测试 Agent
./scripts/multi-agent.sh add zhipin

# 2. 启动
./scripts/multi-agent.sh start zhipin-1

# 3. 访问应用
open http://localhost:3000

# 4. 查看日志（如果有问题）
./scripts/multi-agent.sh logs zhipin-1 app

# 5. 测试完成后停止
./scripts/multi-agent.sh stop zhipin-1
```

### 场景 2: 批量部署多个 Agent

```bash
# 1. 批量创建 5 个 BOSS直聘 Agent
./scripts/multi-agent.sh add zhipin --count 5

# 2. 创建 2 个鱼泡网 Agent
./scripts/multi-agent.sh add yupao --count 2

# 3. 查看列表确认
./scripts/multi-agent.sh list

# 4. 启动全部
./scripts/multi-agent.sh start

# 5. 在浏览器中分别访问每个 Agent
# http://localhost:3000  (zhipin-1)
# http://localhost:3001  (zhipin-2)
# http://localhost:3002  (zhipin-3)
# ...
```

### 场景 3: 逐个登录不同账号

```bash
# 1. 启动第一个 Agent
./scripts/multi-agent.sh start zhipin-1

# 2. 访问 http://localhost:3000，使用 Chrome DevTools 登录第一个账号

# 3. 启动第二个 Agent
./scripts/multi-agent.sh start zhipin-2

# 4. 访问 http://localhost:3001，登录第二个账号

# 5. 依此类推...
```

### 场景 4: 维护和清理

```bash
# 1. 查看所有 Agent 状态
./scripts/multi-agent.sh status

# 2. 停止不再使用的 Agent
./scripts/multi-agent.sh stop zhipin-3

# 3. 删除不需要的 Agent
./scripts/multi-agent.sh remove zhipin-3

# 4. 重启有问题的 Agent
./scripts/multi-agent.sh restart zhipin-1
```

## 🔧 配置文件说明

### agents.json

存储所有 Agent 的配置信息：

```json
{
  "agents": [
    {
      "id": "zhipin-1",
      "type": "zhipin",
      "name": "BOSS直聘代理 1",
      "description": "用于操作BOSS直聘平台的自动化Agent - 实例 1",
      "appPort": 3000,
      "chromePort": 9222,
      "userDataDir": "/tmp/chrome-agent-profiles/zhipin-1",
      "chromeArgs": [...],
      "env": {},
      "createdAt": "2025-10-28T10:30:00Z"
    }
  ],
  "settings": {
    "chromeExecutable": "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "userDataDirBase": "/tmp/chrome-agent-profiles",
    "logsDir": "./logs/agents",
    "pidsDir": "./pids/agents",
    "healthCheckTimeout": 30,
    "healthCheckInterval": 2,
    "startPort": 3000,
    "startChromePort": 9222
  }
}
```

### agent-templates.json

定义不同类型 Agent 的模板：

```json
{
  "templates": {
    "zhipin": {
      "name": "BOSS直聘代理",
      "description": "用于操作BOSS直聘平台的自动化Agent",
      "chromeArgs": [...],
      "env": {}
    },
    "yupao": {
      "name": "鱼泡网代理",
      "description": "用于操作鱼泡网平台的自动化Agent",
      "chromeArgs": [...],
      "env": {}
    }
  }
}
```

## 📁 目录结构

```
ai-sdk-computer-use/
├── configs/
│   ├── agents.json              # Agent 配置
│   └── agent-templates.json     # Agent 模板
├── scripts/
│   └── multi-agent.sh           # 主控制脚本
├── logs/
│   └── agents/
│       ├── zhipin-1-app.log     # 应用日志
│       ├── zhipin-1-chrome.log  # Chrome 日志
│       └── ...
└── pids/
    └── agents/
        ├── zhipin-1.pid         # 应用进程 ID
        ├── zhipin-1-chrome.pid  # Chrome 进程 ID
        └── ...
```

## 🐛 故障排查

### 问题 1: 端口被占用

**症状：** 启动时提示端口冲突

**解决方案：**
```bash
# 检查端口占用
lsof -i :3000

# 杀死占用进程
kill -9 <PID>

# 或者删除 Agent 重新添加（会自动分配新端口）
./scripts/multi-agent.sh remove zhipin-1
./scripts/multi-agent.sh add zhipin
```

### 问题 2: Chrome 启动失败

**症状：** Chrome 无法启动或调试端口无响应

**解决方案：**
```bash
# 1. 查看 Chrome 日志
./scripts/multi-agent.sh logs zhipin-1 chrome

# 2. 检查 Chrome 可执行文件路径
ls "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# 3. 手动测试 Chrome 启动
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9999 \
  --user-data-dir=/tmp/test-chrome

# 4. 清理用户数据目录
rm -rf /tmp/chrome-agent-profiles/zhipin-1
```

### 问题 3: 应用启动超时

**症状：** 应用启动超过 30 秒仍未就绪

**解决方案：**
```bash
# 1. 检查应用日志
./scripts/multi-agent.sh logs zhipin-1 app

# 2. 手动测试应用启动
cd /path/to/project
PORT=3000 pnpm start

# 3. 检查依赖是否安装
pnpm install

# 4. 检查构建是否成功
pnpm build
```

### 问题 4: 进程未正确清理

**症状：** 停止后进程仍在运行

**解决方案：**
```bash
# 1. 查找残留进程
ps aux | grep -E "(node|chrome)" | grep -E "(3000|9222)"

# 2. 手动清理
pkill -f "PORT=3000"
pkill -f "remote-debugging-port=9222"

# 3. 清理 PID 文件
rm -rf pids/agents/*.pid
```

### 问题 5: 缺少系统依赖

**症状：** 执行脚本提示 `command not found`（jq、curl、pnpm 等）

**解决方案：**
```bash
# 脚本会在启动时自动检查所有依赖
# 根据提示安装缺失的工具

# macOS 安装
brew install jq           # JSON 解析器
npm install -g pnpm       # 包管理器

# curl 和 lsof 通常已预装
```

### 问题 6: Chrome 配置路径错误

**症状：** 提示 "Chrome 可执行文件路径未配置或无效"

**解决方案：**
```bash
# 检查 Chrome 路径
ls "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# 如果路径不同，编辑配置文件
vim configs/agents.json
# 修改 settings.chromeExecutable 为正确路径
```

### 问题 7: 配置文件损坏

**症状：**
- "配置项 'startPort' 未设置或无效"
- "配置项 'startPort' 必须是有效的数字"
- "配置项 'userDataDirBase' 未设置或无效"

**解决方案：**
```bash
# 脚本会自动验证所有关键配置
# 检查配置文件中的必需字段

cat configs/agents.json | jq '.settings'

# 确保以下配置项存在且有效：
# - startPort: 必须是数字（如 3000）
# - startChromePort: 必须是数字（如 9222）
# - userDataDirBase: 必须是有效路径（如 "/tmp/chrome-agent-profiles"）
# - chromeExecutable: 必须是 Chrome 可执行文件路径

# 如果配置损坏，重新创建：
cat > configs/agents.json <<'EOF'
{
  "agents": [],
  "settings": {
    "chromeExecutable": "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "userDataDirBase": "/tmp/chrome-agent-profiles",
    "logsDir": "./logs/agents",
    "pidsDir": "./pids/agents",
    "healthCheckTimeout": 30,
    "healthCheckInterval": 2,
    "startPort": 3000,
    "startChromePort": 9222
  }
}
EOF
```

## 💡 最佳实践

### 1. 端口规划

- 应用端口从 3000 开始
- Chrome 调试端口从 9222 开始
- 每个 Agent 自动递增

### 2. 资源管理

- 不使用的 Agent 及时停止
- 定期清理日志文件
- 删除不需要的 Agent 释放资源

### 3. 日志管理

```bash
# 定期清理旧日志
find logs/agents -name "*.log" -mtime +7 -delete

# 或者手动清理
rm -f logs/agents/*.log
```

### 4. 浏览器会话隔离

- 每个 Agent 使用独立的 `userDataDir`
- 避免浏览器数据混淆
- 可以同时登录多个账号

### 5. 健康监控

```bash
# 定期检查 Agent 状态
./scripts/multi-agent.sh status

# 检查端口响应
curl http://localhost:3000/api/health
curl http://localhost:9222/json/version
```

## 🚀 进阶用法

### 自定义 Chrome 启动参数

编辑 `configs/agent-templates.json`，修改 `chromeArgs`：

```json
{
  "templates": {
    "zhipin": {
      "chromeArgs": [
        "--remote-debugging-port={{chromePort}}",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-default-apps",
        "--user-data-dir={{userDataDir}}",
        "--window-size=1920,1080",
        "--disable-blink-features=AutomationControlled"
      ]
    }
  }
}
```

### 环境变量传递

在模板中添加自定义环境变量：

```json
{
  "templates": {
    "zhipin": {
      "env": {
        "CUSTOM_VAR": "value",
        "DEBUG": "true"
      }
    }
  }
}
```

### 批量操作脚本

创建自定义脚本批量管理：

```bash
#!/bin/bash

# 启动所有 zhipin Agent
for i in {1..5}; do
    ./scripts/multi-agent.sh start zhipin-$i
    sleep 5  # 避免同时启动太多进程
done
```

## 📞 支持与反馈

如有问题或建议，请：
1. 查看本文档的故障排查章节
2. 检查日志文件获取详细错误信息
3. 在项目仓库提交 Issue

## 📄 许可证

本工具遵循项目主许可证。
