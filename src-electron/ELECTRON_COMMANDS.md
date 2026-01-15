# Electron 命令说明

本文档说明项目中 Electron 相关的 npm scripts 用途和使用方式。

## 命令流程概览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           开发 → 构建 → 分发 流程                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  开发调试          构建测试              打包分发                            │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  electron:dev  →  electron:pack  →  electron:dist:mac / electron:dist:win  │
│      ↓                 ↓                      ↓                             │
│  实时热更新        生成 .app 目录        生成 .dmg / .exe 安装包             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 命令详解

| 命令 | 用途 | 输出 | 使用场景 |
|------|------|------|----------|
| `pnpm electron:dev` | 开发模式 | 无文件输出 | **日常开发**，支持热更新 |
| `pnpm electron:build` | 仅编译 | `build/` + `.next/standalone/` | 编译但不打包 |
| `pnpm electron:start` | 运行编译后代码 | 无 | 测试生产模式（需先 build） |
| `pnpm electron:pack` | 打包成目录 | `dist/mac-arm64/*.app` | **快速测试**打包结果 |
| `pnpm electron:dist` | 完整打包 | `dist/*.app` + `dist/*.dmg` | 生成所有格式 |
| `pnpm electron:dist:mac` | macOS 打包 | `dist/*.app` + `dist/*.dmg` | **正式分发** macOS |
| `pnpm electron:dist:win` | Windows 打包 | `dist/*.exe` | **正式分发** Windows |

## 命令内部逻辑

### electron:dev

```bash
concurrently \
  "next dev" \                              # 1. 启动 Next.js 开发服务器
  "tsc -w -p tsconfig-electron.json" \      # 2. TypeScript watch 模式编译
  "wait-on http://localhost:3000 && ... electron ."  # 3. 等待 Next.js 就绪后启动 Electron
```

### electron:build

```bash
next build && \                             # 1. 构建 Next.js 生产版本
cp -r .next/static .next/standalone/.next/ && \  # 2. 复制静态资源到 standalone
cp -r public/* .next/standalone/public/ && \     # 3. 复制 public 资源
tsc -p tsconfig-electron.json               # 4. 编译 Electron TypeScript
```

### electron:pack / electron:dist

```bash
pnpm electron:build && \                    # 1. 先执行完整构建
electron-builder --dir                      # 2. 打包成目录（pack）或完整安装包（dist）
```

## 常用工作流

### 1. 日常开发（推荐）

```bash
pnpm electron:dev
```

启动后会同时运行：
- Next.js dev server (http://localhost:3000)
- TypeScript watch 编译
- Electron 窗口

修改代码后自动刷新。

### 2. 快速测试打包是否正常

```bash
pnpm electron:pack
```

生成 `dist/mac-arm64/AI Recruitment Assistant.app`，可以直接双击运行测试。

**注意**：首次运行需要移除 macOS quarantine 属性：

```bash
xattr -dr com.apple.quarantine "dist/mac-arm64/AI Recruitment Assistant.app"
```

### 3. 生成可分发的安装包

```bash
# macOS
pnpm electron:dist:mac
# 生成: dist/AI Recruitment Assistant-x.x.x.dmg

# Windows
pnpm electron:dist:win
# 生成: dist/AI Recruitment Assistant Setup x.x.x.exe
```

## 输出目录说明

| 目录 | 内容 | 是否提交 Git |
|------|------|-------------|
| `build/` | 编译后的 Electron JS 代码 | ❌ 已在 .gitignore |
| `.next/` | Next.js 构建输出 | ❌ 已在 .gitignore |
| `dist/` | 打包后的可分发应用 | ❌ 已在 .gitignore |

## 调试模式

应用支持调试模式，可以输出详细日志用于排查问题。

### 启用方式

**方式 1：环境变量（推荐）**

```bash
DEBUG_MODE=true "/Applications/AI Recruitment Assistant.app/Contents/MacOS/AI Recruitment Assistant"
```

**方式 2：命令行参数**

```bash
"/Applications/AI Recruitment Assistant.app/Contents/MacOS/AI Recruitment Assistant" --verbose
```

### 日志级别说明

| 模式 | 控制台输出 | 文件输出 |
|------|-----------|----------|
| **正常模式** | 仅 error | `app.log`（仅 error/warn） |
| **调试模式** | 全部日志 | `debug.log`（全部） + `app.log` |

### 日志文件位置

```
~/Library/Application Support/ai-sdk-computer-use/logs/
├── app.log      # 关键事件日志（始终记录）
└── debug.log    # 详细调试日志（仅调试模式）
```

### 调试模式特性

1. **详细日志**：记录所有 debug/info/warn/error 级别的日志
2. **Next.js 请求日志**：显示每个 HTTP 请求的处理状态
3. **弹窗提示**：启动时显示调试模式通知和日志文件位置

## 多 Agent 架构

Electron 打包后支持运行多个独立的 Agent 实例，每个 Agent 拥有：

- 独立的 Next.js 进程（运行在不同端口）
- 独立的 Chrome 浏览器实例（独立的调试端口和用户数据目录）
- 独立的 MCP 连接
- 独立的环境变量（AGENT_ID, CHROME_REMOTE_DEBUGGING_PORT）

### 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│ Electron 主进程 (AgentManager)                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Agent-1                    Agent-2                    Agent-3  │
│  ┌───────────────────┐     ┌───────────────────┐     ┌────────│
│  │ Next.js :3001     │     │ Next.js :3002     │     │ ...    │
│  │ Chrome  :9222     │     │ Chrome  :9223     │     │        │
│  │ Runtime: /tmp/... │     │ Runtime: /tmp/... │     │        │
│  └───────────────────┘     └───────────────────┘     └────────│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 核心组件

| 组件 | 文件 | 职责 |
|------|------|------|
| AgentManager | `agent-manager/index.ts` | Agent 生命周期管理 |
| RuntimeManager | `agent-manager/runtime-manager.ts` | 运行时目录管理 |
| AppLauncher | `agent-manager/app-launcher.ts` | Next.js 进程启动 |
| ChromeLauncher | `agent-manager/chrome-launcher.ts` | Chrome 进程启动 |

### 运行时目录

每个 Agent 启动时会复制 `.next/standalone` 到临时目录：

```
/tmp/agent-runtime/
├── zhipin_1/           # Agent 1 的运行时
│   ├── server.js
│   ├── .next/
│   └── node_modules/
├── zhipin_2/           # Agent 2 的运行时
└── ...
```

### IPC 接口

前端可通过以下 IPC 通道管理 Agent：

| 通道 | 参数 | 说明 |
|------|------|------|
| `agent:list` | - | 获取所有 Agent 列表 |
| `agent:add` | `(type, options)` | 添加 Agent |
| `agent:remove` | `(agentId)` | 删除 Agent |
| `agent:start` | `(agentId?)` | 启动 Agent |
| `agent:stop` | `(agentId?)` | 停止 Agent |
| `agent:restart` | `(agentId?)` | 重启 Agent |
| `agent:logs:read` | `(agentId, lines?)` | 读取 Agent 日志 |
| `agent:runtime:check` | - | 检查 standalone 是否可用 |

### 资源占用

| 配置 | 内存占用 | 说明 |
|------|---------|------|
| Electron 主进程 | ~100MB | 控制面板 |
| 每个 Agent | ~200-300MB | Next.js + Chrome |
| 3 个 Agent | ~700-1000MB | 推荐配置 |
| 5 个 Agent | ~1.1-1.6GB | 需要 8GB+ RAM |

## 注意事项

1. **首次运行** `electron:dev` 前不需要先 build
2. **打包前** 确保 `pnpm install` 已完成
3. **Windows 打包** 需要在 Windows 系统上执行，或配置 Wine
4. **macOS 签名** 正式分发需要 Apple Developer 账号进行签名和公证
5. **调试日志** 包含详细信息，请勿分享给不可信的第三方
6. **多 Agent** 每个 Agent 需要约 200-300MB 内存，请根据系统资源合理配置数量

## 相关文档

- [ELECTRON_INTEGRATION_GUIDE.md](./ELECTRON_INTEGRATION_GUIDE.md) - 踩坑指南
- [electron-builder.yml](../electron-builder.yml) - 打包配置
- [tsconfig-electron.json](../tsconfig-electron.json) - TypeScript 配置

---

_最后更新: 2026-01-15_
