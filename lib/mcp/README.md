# MCP客户端管理器

这个模块提供了一个统一的MCP (Model Context Protocol) 客户端管理系统，用于集中管理浏览器自动化服务。

## 🌟 主要特性

- **🔄 单例模式** - 避免重复连接，优化资源使用
- **🧹 自动清理** - 进程退出时自动关闭所有连接
- **🔧 统一管理** - 集中管理多种MCP客户端
- **⚡ 按需连接** - 客户端懒加载，提升启动性能
- **🛡️ 错误恢复** - 完善的错误处理和重连机制

## 📋 支持的服务

### Playwright MCP

- **功能**: 现代化的浏览器自动化，Docker友好
- **命令**: `node node_modules/@playwright/mcp/cli.js ...`
- **特点**:
  - 使用项目内固定版本（避免 `@latest` 漂移）
  - 若本地 CLI 不存在，回退到 `npx -y @playwright/mcp@0.0.68`
  - 更好的 Docker 支持
  - 自动管理浏览器实例
- **用途**: 网页抓取、表单填充、页面截图、UI测试

## 🚀 快速开始

### 基础用法

```typescript
import mcpClientManager from "@/lib/mcp/client-manager";

// 获取客户端状态
const status = mcpClientManager.getStatus();
console.log("可用客户端:", status.availableClients);

// 获取Playwright客户端
const playwrightClient = await mcpClientManager.getPlaywrightMCPClient();

// 获取Playwright工具
const playwrightTools = await mcpClientManager.getPlaywrightMCPTools();
```


## 🔧 API参考

### MCPClientManager

#### 方法

- `getInstance()` - 获取单例实例
- `getMCPClient(clientName)` - 获取指定MCP客户端
- `getMCPTools(clientName, schemas?)` - 获取MCP工具
- `closeMCPClient(clientName)` - 关闭指定客户端
- `reconnectClient(clientName)` - 重连客户端
- `getStatus()` - 获取状态信息
- `isClientConnected(clientName)` - 检查连接状态

#### 快捷方法

- `getPlaywrightMCPClient()` - 获取Playwright客户端
- `getPlaywrightMCPTools()` - 获取Playwright工具

## 📁 文件结构

```
lib/mcp/
├── README.md                  # 本文档
└── client-manager.ts          # MCP客户端管理器

lib/tools/
├── zhipin/                    # BOSS直聘自动化工具集
├── duliday/                   # Duliday招聘系统工具集
├── feishu-bot-tool.ts         # 飞书机器人工具
├── wechat-bot-tool.ts         # 微信机器人工具
└── job-posting-generator-tool.ts  # 职位发布生成工具

types/
└── mcp.ts                     # MCP相关类型定义
```

## 🧪 测试

### 运行MCP连接测试

```bash
pnpm test:mcp-connection
```

这会运行MCP服务器和客户端管理器的连接测试，验证：

- MCP客户端初始化
- 工具可用性检查
- 连接状态验证
- 资源清理功能

**注意**: 这个测试不包含实际的浏览器操作，仅测试MCP基础连接功能。

### 直接运行测试

```bash
# MCP连接测试
pnpm test:mcp-connection
```

## 🐛 故障排除

### 环境变量问题

**错误**: `缺少必需的环境变量`

**解决方案**:

1. 检查 `.env` 文件是否存在
2. 确认环境变量名称正确
3. 重启应用程序以加载新的环境变量

### MCP服务启动问题

**错误**: MCP服务启动失败

**解决方案**:

1. 确认网络连接正常
2. 检查是否安装了必需的依赖
3. 尝试手动运行MCP命令
4. 查看控制台输出获取详细错误信息

### Docker环境问题

**错误**: 在Docker中无法连接浏览器

**解决方案**:

1. Playwright MCP 会自动下载和管理浏览器
2. 确保Docker镜像有足够的权限

### 错误处理

1. 总是捕获工具执行的错误
2. 提供有意义的错误信息
3. 实现重试机制
4. 记录详细的日志

## 🤝 贡献

欢迎提交Issue和Pull Request来改进这个模块！

## 📝 更新日志

### v3.0.0

- 迁移至 Playwright MCP 专用架构
- 移除 Puppeteer MCP 支持

### v2.0.0

- 新增 Playwright MCP 支持
- 改进 Docker 环境兼容性

### v1.0.0

- 初始版本
- 基础的浏览器自动化功能
