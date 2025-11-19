# 未读消息监听服务使用指南

## 概述

未读消息监听服务是一个自动化工具，用于监测 Boss直聘和鱼泡平台的未读消息，并自动在 Huajune 聊天界面触发处理流程。

### 工作原理

```
┌─────────────────────────────────────────────┐
│  监听服务 (Puppeteer)                        │
│  - 保持浏览器会话                             │
│  - 定期检测未读消息                           │
│  - 智能去重：只在未读数增加时触发              │
└─────────────────────────────────────────────┘
         ↓ 每 30 秒轮询
┌─────────────────────────────────────────────┐
│  Boss直聘/鱼泡标签页                         │
│  - 检测未读数量                              │
│  - 对比上次记录的未读数                       │
└─────────────────────────────────────────────┘
         ↓ 未读数增加时触发
┌─────────────────────────────────────────────┐
│  localhost:3000 (Huajune)                   │
│  1. 填充输入框: "处理 Boss直聘 的 3 条未读"  │
│  2. 可选：自动提交                           │
│  3. 记录触发状态，避免重复                    │
└─────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────┐
│  Agent 自动处理                              │
│  - 用户可在界面看到完整过程                   │
│  - 处理完成后，未读数减少，不会重复触发        │
└─────────────────────────────────────────────┘
```

### 核心特性

✅ **智能去重**：只在未读数增加时触发，避免重复处理
✅ **状态追踪**：自动记录每个品牌的未读数，不会打断正在进行的对话
✅ **自动重置**：未读消息清空后，自动重置状态，等待新消息
✅ **多品牌并行**：支持同时监听多个平台，互不干扰
✅ **兜底检查**：定期检查未回复消息，解决停留在聊天详情页时无未读标记的问题
✅ **键盘控制**：支持快捷键暂停/恢复/查看状态

### 快捷键

| 按键 | 功能 |
|------|------|
| `Space` | 暂停/恢复监听 |
| `i` | 查看当前状态（未读数、下次检测时间等） |
| `r` | 立即触发检测 |
| `Ctrl+C` | 退出服务 |

## 快速开始

### 方式 1：配合 multi-agent.sh 使用（推荐 ⭐）

**适用场景**：使用 `multi-agent.sh` 管理多个 Agent 实例

```bash
# 1. 启动 Agent（例如 Boss直聘 Agent）
pnpm agent:start zhipin-1

# 2. 启动对应的监听服务（自动从 configs/agents.json 读取配置）
AGENT_ID=zhipin-1 pnpm monitor:start

# 🎯 就这么简单！无需手动配置端口和 URL
```

**工作原理**：
- 监听服务自动从 `configs/agents.json` 读取 `zhipin-1` 的配置
- 自动获取：浏览器端口（`chromePort`）、Agent 端口（`appPort`）、品牌类型（`type`）
- 自动映射：`zhipin` → `boss-zhipin`，`yupao` → `yupao`

**多品牌监听**：
```bash
# 启动 Boss直聘 Agent 和监听
pnpm agent:start zhipin-1
AGENT_ID=zhipin-1 pnpm monitor:start &

# 启动鱼泡 Agent 和监听
pnpm agent:start yupao-1
AGENT_ID=yupao-1 pnpm monitor:start &

# ✅ 每个品牌独立监听，互不干扰
```

---

### 方式 2：手动配置环境变量

**适用场景**：不使用 multi-agent.sh，或需要高级自定义配置

```bash
BROWSER_URL=http://localhost:9222 \
AGENT_URL=http://localhost:3000 \
ENABLED_BRANDS=boss-zhipin \
pnpm monitor:start
```

---

### 重要：浏览器架构说明

**监听服务和 Agent 必须使用同一个浏览器实例！**

```
Chrome 启动（multi-agent.sh 或手动启动，CDP 端口 9222）
  ├─ 监听脚本连接 → 检测 Boss直聘/鱼泡未读消息
  └─ Agent (MCP Puppeteer) 连接 → 处理消息
```

**正确的启动顺序：**

1. **先启动 Chrome** (multi-agent.sh 或手动启动)
2. **再启动监听服务** (连接到已有 Chrome)
3. Agent 自动连接到同一个 Chrome 实例

有两种方式启动 Chrome：

**方式 1: 使用 multi-agent.sh 启动（推荐）**
```bash
pnpm agent:start zhipin-1
# Chrome 会在配置的端口启动（默认 9222）
```

**方式 2: 手动启动 Chrome**
```bash
# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/chrome-monitor

# Linux
google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-monitor

# Windows
"C:\Program Files\Google\Chrome\Application\chrome.exe" ^
  --remote-debugging-port=9222 ^
  --user-data-dir=C:\tmp\chrome-monitor
```

---

### 1. 启动 Chrome（必须先执行）

**使用 multi-agent.sh 启动（推荐）：**
```bash
pnpm agent:start zhipin-1
# 查看端口配置
pnpm agent:list
```

**或手动启动 Chrome：**
```bash
export BROWSER_URL=http://localhost:9222
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/chrome-monitor
```

### 2. 启动监听服务（手动确认模式）

**推荐首次使用**：
```bash
pnpm monitor:start
```

监听服务会：
- ✅ 连接到已启动的 Chrome (端口 9222)
- ✅ 自动填充提示词到聊天输入框
- ⏸️ **不会自动提交，等待用户手动确认**
- 💡 适合初次使用，确保不会误操作

### 3. 启动监听服务（自动模式）

**完全自动化模式**：
```bash
pnpm monitor:start:auto
```

此模式下：
- ✅ 自动填充提示词
- ✅ **自动提交并触发 Agent 处理**
- ⚠️ 适合稳定运行后使用

### 4. 自定义浏览器端口

如果 Chrome 在其他端口：
```bash
BROWSER_URL=http://localhost:9223 pnpm monitor:start
```

## 使用步骤

### 步骤 1: 启动 Huajune 应用

```bash
pnpm dev
```

确保应用运行在 `http://localhost:3000`。

### 步骤 2: 启动 Chrome 浏览器

**使用 multi-agent.sh（推荐）：**
```bash
pnpm agent:start zhipin-1
```

**或手动启动：**
```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/chrome-monitor
```

### 步骤 3: 启动监听服务

```bash
pnpm monitor:start
```

服务会自动：
1. 连接到已启动的 Chrome (端口 9222)
2. 在 Chrome 中打开 Huajune 聊天页面
3. 在 Chrome 中打开 Boss直聘/鱼泡页面

### 步骤 4: 手动登录

浏览器打开后，你会看到多个标签页：

- **Tab 1**: localhost:3000 (Huajune 聊天界面)
- **Tab 2**: Boss直聘聊天页面
- **Tab 3**: 鱼泡消息页面（如果启用）

**请在 30 秒内完成登录**：
- 在 Boss直聘/鱼泡标签页中手动登录
- 完成二维码扫码或账号登录
- 登录成功后，监听服务会自动开始工作

### 步骤 5: 监听运行

登录完成后，服务会：
- 每 30 秒检测一次未读消息
- 发现未读后，自动切换到 Huajune 页面
- 填充提示词（如 "处理 Boss直聘 的 3 条未读消息"）
- 等待用户确认或自动提交（取决于模式）

### 步骤 6: 运行中控制

服务运行后，可使用快捷键：
- `Space` - 暂停/恢复
- `i` - 查看状态
- `r` - 立即检测
- `Ctrl+C` - 退出（Chrome 保持运行）

## 配置选项

### 环境变量

| 变量 | 默认值 | 说明 | 优先级 |
|------|--------|------|--------|
| `AGENT_ID` | - | Agent ID（从 configs/agents.json 自动加载配置）⭐ **推荐** | 最高 |
| `BROWSER_URL` | `http://localhost:9222` | 浏览器 CDP 地址 | 中 |
| `AGENT_URL` | `http://localhost:3000` | Huajune Agent 页面地址 | 中 |
| `ENABLED_BRANDS` | `["boss-zhipin"]` | 启用的品牌（逗号分隔：`boss-zhipin,yupao`） | 中 |
| `POLL_INTERVAL` | `30000` | 轮询间隔（毫秒，最小 10000） | 低 |
| `AUTO_SUBMIT` | `false` | 是否自动提交消息 | 低 |
| `BROWSER_WS_ENDPOINT` | - | 浏览器 WebSocket 端点（优先级高于 BROWSER_URL） | 中 |
| `FALLBACK_CHECK_INTERVAL` | `600000` | 兜底检查间隔（毫秒，最小 60000，默认 10 分钟） | 低 |
| `FALLBACK_PROMPT` | 见下方 | 兜底检查时发送的指令 | 低 |

**兜底检查默认指令**：`检查对话列表，找出对方发送了消息但我们还没有回复的候选人，并逐个回复`

**已移除的环境变量**（connect 模式下无效）：
- ~~`HEADLESS`~~ - 请在启动 Chrome 时使用 `--headless` 参数
- ~~`USER_DATA_DIR`~~ - 请在启动 Chrome 时使用 `--user-data-dir` 参数

### 自定义配置示例

**推荐方式（使用 AGENT_ID）：**
```bash
# 基础使用
AGENT_ID=zhipin-1 pnpm monitor:start

# 自动提交模式
AGENT_ID=zhipin-1 AUTO_SUBMIT=true pnpm monitor:start

# 自定义轮询间隔
AGENT_ID=zhipin-1 POLL_INTERVAL=60000 pnpm monitor:start

# 自定义兜底检查间隔（5分钟）
AGENT_ID=zhipin-1 FALLBACK_CHECK_INTERVAL=300000 pnpm monitor:start

# 高级用户可以覆盖自动加载的配置
AGENT_ID=zhipin-1 BROWSER_URL=http://localhost:9999 pnpm monitor:start
```

**手动配置方式：**
```bash
# 每 60 秒检测一次，自动提交
POLL_INTERVAL=60000 \
AUTO_SUBMIT=true \
BROWSER_URL=http://localhost:9222 \
AGENT_URL=http://localhost:3000 \
ENABLED_BRANDS=boss-zhipin \
pnpm monitor:start

# 多品牌监听（不推荐，建议用方案 A 独立监听）
ENABLED_BRANDS=boss-zhipin,yupao pnpm monitor:start
```

## 工作时间限制

可以在脚本中配置工作时间，避免非工作时间打扰：

```typescript
// scripts/unread-monitor.ts
const config: MonitorConfig = {
  ...DEFAULT_CONFIG,
  workingHours: {
    start: "09:00",
    end: "18:00",
  },
};
```

非工作时间内，监听服务会跳过检测。

## 高级用法

### 1. 保持登录态

在启动 Chrome 时使用 `--user-data-dir` 参数保存浏览器数据：

**方式 1：使用 multi-agent（推荐）**
在 `configs/agents.json` 中配置 `userDataDir`，multi-agent.sh 会自动传递给 Chrome。

**方式 2：手动启动 Chrome**
```bash
# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir=~/.chrome-monitor

# 然后启动监听服务（连接到已启动的 Chrome）
pnpm monitor:start
```

> ⚠️ 注意：`USER_DATA_DIR` 环境变量在 connect 模式下无效，必须在启动 Chrome 时指定。

### 2. 集成到 Multi-Agent 系统

可以将监听服务集成到现有的 `multi-agent` 系统中：

```bash
# 在 scripts/multi-agent.sh 中添加监听服务启动逻辑
# 每个 Agent 实例可以独立启用监听
```

### 3. 自定义未读检测逻辑

如果 Boss直聘/鱼泡的页面结构变化，可以修改检测函数：

```typescript
// scripts/unread-monitor.ts
async function checkBossZhipinUnread(page: Page): Promise<UnreadMessage | null> {
  // 根据最新的 DOM 结构调整选择器
  const unreadBadge = await page.$(".your-new-selector");
  // ...
}
```

## 故障排除

### 问题 1: 浏览器启动失败

**症状**: 提示找不到 Chromium 或启动超时

**解决方案**:
```bash
# 手动安装 Chromium
npx puppeteer browsers install chrome
```

### 问题 2: 未检测到未读消息

**原因**: 页面选择器可能已变化

**解决方案**:
1. 打开浏览器开发者工具
2. 检查未读消息的 DOM 结构
3. 更新 `checkBossZhipinUnread` 函数中的选择器

### 问题 3: 输入框填充失败

**症状**: 提示 "未找到聊天输入框"

**解决方案**:
- 确保 Huajune 应用已启动并完成登录
- 检查输入框的 `aria-label` 是否仍为 "聊天输入框"

### 问题 4: 登录态丢失

**解决方案**:
- 启动 Chrome 时使用 `--user-data-dir` 参数保存登录态
- 或增加登录等待时间（修改脚本中的 30 秒延迟）

## 日志说明

监听服务会输出详细的日志，包括智能去重的决策过程：

### 基本运行日志

```
[2025-01-17 10:00:00] ℹ️  🚀 启动未读消息监听服务...
[2025-01-17 10:00:02] ✅ 浏览器已启动
[2025-01-17 10:00:05] ✅ 已打开聊天页面: http://localhost:3000
[2025-01-17 10:00:08] ℹ️  已打开 Boss直聘 聊天页面，请手动登录
[2025-01-17 10:00:40] ℹ️  🔍 开始检测未读消息...
```

### 首次发现未读（触发处理）

```
[2025-01-17 10:00:45] ℹ️  Boss直聘发现 3 条未读消息
[2025-01-17 10:00:45] ℹ️  boss-zhipin: 首次检测到 3 条未读，准备触发处理
[2025-01-17 10:00:48] ✅ 触发处理流程...
[2025-01-17 10:00:50] ✅ 已填充提示词: "处理 Boss直聘 的 3 条未读消息"
[2025-01-17 10:00:50] ℹ️  已填充提示词，等待用户手动确认
[2025-01-17 10:00:51] ✅ boss-zhipin: 已记录触发状态（未读数 3）
[2025-01-17 10:01:20] ℹ️  本轮检测完成
```

### 未读数不变（不触发，避免重复）

```
[2025-01-17 10:01:50] ℹ️  🔍 开始检测未读消息...
[2025-01-17 10:01:52] ℹ️  Boss直聘发现 3 条未读消息
[2025-01-17 10:01:52] ℹ️  boss-zhipin: 未读数保持 3 条，跳过处理
[2025-01-17 10:02:00] ℹ️  本轮检测完成
```

### 未读数增加（再次触发）

```
[2025-01-17 10:02:30] ℹ️  🔍 开始检测未读消息...
[2025-01-17 10:02:32] ℹ️  Boss直聘发现 5 条未读消息
[2025-01-17 10:02:32] ℹ️  boss-zhipin: 未读数从 3 增加到 5，准备触发处理
[2025-01-17 10:02:35] ✅ 触发处理流程...
[2025-01-17 10:02:37] ✅ 已填充提示词: "处理 Boss直聘 的 5 条未读消息"
[2025-01-17 10:02:37] ✅ boss-zhipin: 已记录触发状态（未读数 5）
```

### 未读数减少（更新状态，不触发）

```
[2025-01-17 10:03:10] ℹ️  🔍 开始检测未读消息...
[2025-01-17 10:03:12] ℹ️  Boss直聘发现 2 条未读消息
[2025-01-17 10:03:12] ℹ️  boss-zhipin: 未读数从 5 减少到 2，更新状态
[2025-01-17 10:03:20] ℹ️  本轮检测完成
```

### 未读消息清空（重置状态）

```
[2025-01-17 10:03:50] ℹ️  🔍 开始检测未读消息...
[2025-01-17 10:03:52] ℹ️  boss-zhipin: 未读消息已清空，重置状态
[2025-01-17 10:04:00] ℹ️  本轮检测完成
```

### 兜底检查（定时触发）

```
[2025-01-17 10:10:00] ℹ️  ⏰ 执行兜底检查（检查未回复的消息）...
[2025-01-17 10:10:02] ✅ 兜底检查指令已发送
```

## 性能优化

### 调整轮询间隔

根据业务需求调整检测频率：

- **高频场景**（招聘高峰期）: 15-30 秒
- **正常场景**: 30-60 秒
- **低频场景**（非工作时间）: 60-120 秒

```bash
# 15 秒检测一次
POLL_INTERVAL=15000 pnpm monitor:start
```

### 避免频繁请求

- 检测未读消息时，避免额外的网络请求
- 只读取 DOM 元素，不触发页面刷新
- 使用 `waitForSelector` 超时限制

## 安全注意事项

⚠️ **重要提示**：

1. **不要在公共网络使用**: 监听服务需要保持登录态，避免在不安全的网络环境运行
2. **保护用户数据目录**: Chrome 的 `--user-data-dir` 目录包含敏感信息，确保权限设置正确
3. **避免过度自动化**: 频繁的自动操作可能触发平台风控，建议合理设置轮询间隔
4. **定期检查日志**: 监控异常行为，及时调整配置

## 最佳实践

1. **首次使用**: 使用手动确认模式（`pnpm monitor:start`），确保流程正确
2. **稳定后**: 切换到自动模式（`pnpm monitor:start:auto`）
3. **生产环境**: 启动 Chrome 时使用 `--user-data-dir` 保持登录态
4. **配置工作时间**: 避免非工作时间的无效检测
5. **监控日志**: 定期检查日志，确保服务正常运行

## 扩展开发

### 添加新平台支持

1. 创建检测函数:
```typescript
async function checkNewPlatformUnread(page: Page): Promise<UnreadMessage | null> {
  // 实现检测逻辑
}
```

2. 在 `poll()` 方法中添加:
```typescript
if (brand === "new-platform") {
  unread = await checkNewPlatformUnread(page);
}
```

3. 更新配置:
```typescript
enabledBrands: ["boss-zhipin", "yupao", "new-platform"]
```

### 添加通知功能

可以集成飞书/企微通知：

```typescript
// 发现未读后，发送通知
if (unread) {
  await sendFeishuNotification(`发现 ${unread.brand} 未读消息 ${unread.count} 条`);
}
```

## 相关文档

- [Multi-Agent 管理指南](./MULTI_AGENT_GUIDE.md)
- [Puppeteer MCP 集成](../../examples/puppeteer-usage.ts)
- [项目使用说明](../../CLAUDE.md)

## 常见问题 (FAQ)

**Q: 监听服务会影响性能吗？**
A: 影响很小。定期轮询只读取 DOM，不执行复杂操作。建议设置合理的轮询间隔。

**Q: 可以同时监听多个账号吗？**
A: 可以。使用 `multi-agent` 系统启动多个监听实例，每个实例配置不同的 `userDataDir`（在 `configs/agents.json` 中）。

**Q: 如何调试未读检测逻辑？**
A: 使用非无头模式（`pnpm monitor:start`），打开开发者工具查看页面结构。

**Q: 监听服务会被平台检测吗？**
A: Puppeteer 使用真实浏览器，检测风险较低。但仍建议：
- 使用合理的轮询间隔
- 避免频繁的自动操作
- 模拟真人行为（如延迟输入）

## 反馈与贡献

如有问题或建议，请提交 Issue 或 Pull Request。
