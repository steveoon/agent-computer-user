<h1 align="center">AI智能招聘与办公自动化平台</h1>

<p align="center">
  基于Next.js 15构建的企业级智能招聘助手，集成了多模型AI对话、桌面自动化、智能回复生成等功能，助力HR提升招聘效率和候选人体验。
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black" alt="Next.js 15" />
  <img src="https://img.shields.io/badge/TypeScript-5.0+-blue" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React-19-61dafb" alt="React 19" />
  <img src="https://img.shields.io/badge/AI_SDK-3.0-green" alt="AI SDK" />
</p>

<p align="center">
  <a href="#功能特性"><strong>功能特性</strong></a> ·
  <a href="#本地开发"><strong>本地开发</strong></a> ·
  <a href="#配置说明"><strong>配置说明</strong></a> ·
  <a href="#部署指南"><strong>部署指南</strong></a>
</p>
<br/>

## 功能特性

### 🤖 多模型AI智能对话

- **智能回复生成**：两阶段AI架构（分类→生成），支持16种招聘和考勤场景的智能回复
- **多模型集成**：
  - Anthropic Claude (支持Computer Use功能)
  - 阿里通义千问 (qwen-turbo/qwen-plus/qwen-max)
  - OpenAI GPT系列
  - Google Gemini
  - DeepSeek
  - OpenRouter (聚合多模型)
- **动态模型切换**：运行时切换AI模型，无需重启应用
- **智能降级机制**：AI服务不可用时自动降级到规则引擎

### 🖥️ 桌面自动化能力

- **E2B集成**：通过E2B沙箱环境实现安全的桌面自动化
- **Computer Use**：支持Claude的计算机使用功能，可以像人一样操作电脑
- **截图与交互**：支持屏幕截图、鼠标点击、键盘输入等桌面操作
- **中文输入支持**：完善的中文IME支持，适配国内应用场景

### 💼 招聘业务定制

- **Boss直聘集成**：完整的招聘流程自动化，包含反检测措施
- **DulidayHR系统**：职位管理、面试预约等功能集成
- **职位信息生成**：智能生成格式化的招聘信息，支持多种岗位类型
- **多品牌支持**：动态品牌检测和切换，支持多租户架构

### 🔧 企业级配置管理

- **统一配置服务**：基于LocalForage的持久化配置管理
- **三层数据结构**：品牌数据、系统提示词、回复提示词分层管理
- **可视化管理界面**：`/admin/settings` 提供完整的配置管理UI
- **数据迁移系统**：从硬编码到持久化存储的自动迁移
- **配置版本控制**：支持配置的导入、导出、版本管理

### 🔗 第三方集成

- **通信工具**：
  - 飞书群机器人（支持富文本消息）
  - 企业微信机器人（支持图片附件）
- **MCP协议**：支持Model Context Protocol，集成Puppeteer、Google Maps等
- **浏览器自动化**：Puppeteer集成，支持网页抓取和自动化测试

### 🚀 技术架构亮点

- **Next.js 15 App Router**：最新的React服务端渲染框架
- **TypeScript严格模式**：100%类型安全，禁用any类型
- **Zod模式驱动**：运行时验证与编译时类型推导统一
- **单例模式服务**：核心服务采用单例模式，防止内存泄漏
- **React 19特性**：利用最新React特性提升性能

### 🔒 安全与合规

- **沙箱执行环境**：危险命令在E2B沙箱中隔离执行
- **命令黑名单**：内置危险命令检测和拦截
- **环境变量隔离**：构建时和运行时变量严格分离
- **生产环境保护**：生产环境下的额外安全限制

## 本地开发

### 环境要求

- Node.js 18.18+
- pnpm 8+ (推荐) 或 npm/yarn
- Docker (可选，用于容器化部署)

### 快速开始

1. **克隆项目并安装依赖**

   ```bash
   git clone <repository-url>
   cd ai-sdk-computer-use
   pnpm install  # 推荐使用pnpm
   ```

2. **配置环境变量**

   复制环境变量模板并配置：

   ```bash
   cp .env.example .env.local
   ```

   编辑 `.env.local` 文件，配置必要的环境变量：

   ```bash
   # AI模型API密钥（至少配置一个）
   ANTHROPIC_API_KEY=your_anthropic_key        # Claude模型
   DASHSCOPE_API_KEY=your_dashscope_key        # 通义千问
   DEEPSEEK_API_KEY=your_deepseek_key          # DeepSeek（可选）
   OPENROUTER_API_KEY=your_openrouter_key      # OpenRouter（可选）
   GEMINI_API_KEY=your_google_gemini_key       # Google Gemini（可选）

   # E2B桌面自动化（Computer Use功能必需）
   E2B_API_KEY=your_e2b_key

   # Supabase认证（可选，不配置则以独立模式运行）
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key

   # 第三方集成（可选）
   FEISHU_BOT_WEBHOOK=your_feishu_webhook      # 飞书机器人
   WECHAT_BOT_WEBHOOK=your_wechat_webhook      # 企微机器人
   WECHAT_BOT_ACCESS_TOKEN=your_wechat_token
   DULIDAY_TOKEN=your_duliday_token            # DulidayHR系统

   # MCP集成（可选）
   EXA_API_KEY=your_exa_search_key             # Exa搜索
   ```

3. **启动开发服务器**

   ```bash
   pnpm dev  # 使用Turbopack加速开发构建
   ```

4. **访问应用**
   - 主应用: [http://localhost:3000](http://localhost:3000)
   - 配置管理: [http://localhost:3000/admin/settings](http://localhost:3000/admin/settings)
   - LLM测试: [http://localhost:3000/test-llm-reply](http://localhost:3000/test-llm-reply)
   - 健康检查: [http://localhost:3000/api/health](http://localhost:3000/api/health)

### 开发命令

```bash
# 开发
pnpm dev              # 启动开发服务器（Turbopack）
pnpm build            # 构建生产版本
pnpm start            # 启动生产服务器

# 测试
pnpm test             # 运行单元测试（watch模式）
pnpm test:run         # 运行单元测试（单次）
pnpm test:ui          # 可视化测试界面
pnpm test:coverage    # 生成测试覆盖率报告
pnpm test:mcp         # 测试MCP连接

# 代码质量
pnpm lint             # ESLint检查
pnpm format           # Prettier格式化
pnpm format:check     # 检查格式化
npx tsc --noEmit      # TypeScript类型检查

# Docker部署
./scripts/deploy.sh   # 自动构建并推送到GitHub Container Registry
```

### 调试技巧

#### 🔧 配置管理调试

1. 访问 `/admin/settings` 进行可视化配置
2. 浏览器DevTools > Application > IndexedDB查看存储的配置
3. 使用 `ConfigInitializer` 组件确保配置初始化
4. 清除IndexedDB可强制重新初始化配置

#### 🤖 AI功能调试

1. 使用 `/test-llm-reply` 测试智能回复功能
2. 检查 `useModelConfigStore` 中的模型配置状态
3. 查看网络请求确认AI API调用情况
4. 测试降级机制：故意使用错误的API密钥

#### 🖥️ Desktop自动化调试

1. 确保E2B_API_KEY配置正确
2. 使用 `/api/diagnose` 检查E2B连接状态
3. 查看 `lib/e2b/tool.ts` 中的日志输出
4. 测试中文输入时参考 `docs/CHINESE_INPUT_GUIDE.md`

#### 🐛 常见问题

- **TypeScript错误**: 运行 `npx tsc --noEmit` 检查类型
- **配置不生效**: 检查 `ConfigInitializer` 是否正确加载
- **工具组件不渲染**: 确认使用 `message.parts` 而非 `message.content`
- **Docker构建失败**: 检查是否使用正确的docker-compose文件（ARM64 vs AMD64）

## 架构设计

### 核心设计原则

1. **Zod Schema-First**: 所有数据结构从Zod schema派生类型

   ```typescript
   const schema = z.object({...})
   type SchemaType = z.infer<typeof schema>
   ```

2. **单例模式服务**: 核心服务使用单例模式防止资源泄漏
   - `configService`: 配置管理
   - `mcpClientManager`: MCP连接管理

3. **零容忍any类型**: 使用unknown和类型收窄替代any

4. **智能降级机制**: AI不可用时自动降级到规则引擎

### 数据流架构

1. **配置加载**: `ConfigInitializer` → `configService` → Components
2. **智能回复**: Message → Classification → Reply Generation
3. **桌面自动化**: User Action → E2B Tools → Desktop → Result
4. **模型选择**: `useModelConfigStore` → Provider → AI SDK

### 目录结构

```
├── app/                    # Next.js App Router
│   ├── api/               # API路由
│   └── (routes)/          # 页面路由
├── components/            # React组件
│   ├── ui/               # 通用UI组件
│   └── tool-messages/    # 工具消息组件
├── lib/                   # 核心逻辑
│   ├── services/         # 单例服务
│   ├── stores/           # Zustand状态管理
│   ├── tools/            # AI工具集成
│   └── e2b/              # 桌面自动化
└── types/                # TypeScript类型定义
```

## 部署指南

### Docker部署（推荐）

1. **本地测试**（macOS ARM64）

   ```bash
   docker compose -f docker-compose.local.yml up -d
   ```

2. **生产构建**

   ```bash
   ./scripts/deploy.sh  # 自动构建并推送到GitHub Container Registry
   ```

3. **VPS部署**
   ```bash
   # 在VPS上拉取并运行
   docker compose -f docker-compose.prod.yml up -d
   ```

### Vercel部署

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-repo/ai-sdk-computer-use&env=ANTHROPIC_API_KEY,DASHSCOPE_API_KEY)

配置环境变量后即可一键部署。

### 手动部署

1. **构建应用**

   ```bash
   pnpm build
   ```

2. **启动服务**

   ```bash
   pnpm start  # 或使用PM2: pm2 start ecosystem.config.js
   ```

3. **配置Nginx反向代理**
   ```nginx
   location / {
     proxy_pass http://localhost:3000;
     proxy_http_version 1.1;
     proxy_set_header Upgrade $http_upgrade;
     proxy_set_header Connection 'upgrade';
   }
   ```

### 部署检查清单

- [ ] 环境变量配置完整
- [ ] 数据库连接正常（如使用Supabase）
- [ ] 健康检查端点响应正常
- [ ] SSL证书配置正确
- [ ] 日志和监控配置完成

## 测试

### 运行测试

```bash
# 单元测试
pnpm test              # Watch模式
pnpm test:run          # 单次运行
pnpm test:coverage     # 覆盖率报告

# 集成测试
pnpm test:mcp          # MCP连接测试

# E2E测试
curl http://localhost:3000/api/health  # 健康检查
```

### 测试覆盖率要求

- 语句覆盖率: 80%
- 分支覆盖率: 80%
- 函数覆盖率: 80%
- 行覆盖率: 80%

## 性能优化

### 开发环境

- 使用Turbopack加速构建
- React 19并发特性
- 懒加载重型组件

### 生产环境

- 缓存AI provider实例
- 单例模式防止重复创建
- MCP延迟连接建立
- 自动资源清理

## 安全最佳实践

1. **环境变量安全**
   - 使用 `.env.local` 存储敏感信息
   - 构建时变量使用 `NEXT_PUBLIC_` 前缀
   - 运行时变量通过服务端传递

2. **命令执行安全**
   - 危险命令黑名单检测
   - E2B沙箱隔离执行
   - 生产环境额外限制

3. **数据安全**
   - 配置数据本地加密存储
   - API密钥不在前端暴露
   - 请求签名验证

## 故障排查

### 常见问题

1. **Puppeteer在macOS上报错**
   - 使用 `docker-compose.local.yml` 替代
   - 或安装Chrome: `pnpm playwright install chromium`

2. **配置不生效**
   - 清除浏览器IndexedDB
   - 检查 `ConfigInitializer` 加载
   - 访问 `/admin/settings` 重新配置

3. **AI模型调用失败**
   - 检查API密钥配置
   - 验证网络连接
   - 查看API配额限制

4. **Docker构建失败**
   - 确认使用正确的compose文件
   - 检查环境变量文件位置
   - 验证镜像架构匹配

## 贡献指南

### 开发流程

1. Fork项目并创建功能分支
2. 遵循[Conventional Commits](https://conventionalcommits.org/)规范
3. 确保测试通过和类型检查无误
4. 提交Pull Request并等待代码审查

### 代码规范

- TypeScript严格模式，禁用any
- 使用Zod schema定义数据结构
- 遵循ESLint和Prettier配置
- 组件使用明确的Props接口
- 中文场景必须测试

### 提交规范

```
feat: 添加新功能
fix: 修复问题
docs: 文档更新
style: 代码格式调整
refactor: 代码重构
test: 测试相关
chore: 构建或辅助工具变动
```

## 相关资源

- [Next.js文档](https://nextjs.org/docs)
- [AI SDK文档](https://sdk.vercel.ai/docs)
- [E2B文档](https://e2b.dev/docs)
- [项目Wiki](./docs/)
- [更新日志](./CHANGELOG.md)

## 许可证

本项目采用双重许可模式：

### 非商业用途
本项目对个人学习、研究和非商业用途免费开放，遵循 Apache License 2.0。

### 商业用途
任何商业用途（包括但不限于）：
- 将本软件集成到商业产品或服务中
- 使用本软件为客户提供付费服务
- 在商业环境中部署使用本软件

**必须获得我们的商业授权许可**。

如需商业授权，请联系：rensiwen@duliday.com

未经授权的商业使用将被视为侵权行为。

详见 [LICENSE](./LICENSE) 文件。
