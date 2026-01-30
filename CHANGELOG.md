# Changelog

All notable changes to AI SDK Computer Use will be documented in this file.

# [1.29.0-develop.2](https://github.com/steveoon/agent-computer-user/compare/v1.29.0-develop.1...v1.29.0-develop.2) (2026-01-30)


### Bug Fixes

* **electron:** use require.resolve fallback for pnpm isolated mode ([3ffa94e](https://github.com/steveoon/agent-computer-user/commit/3ffa94ee15a00ea3b68900c42552cedf70e8d77c))

# [1.29.0-develop.1](https://github.com/steveoon/agent-computer-user/compare/v1.28.1-develop.2...v1.29.0-develop.1) (2026-01-30)


### Features

* **electron:** enhance build process and add standalone resolver for Windows ([a4942e9](https://github.com/steveoon/agent-computer-user/commit/a4942e9d498632d00bee1d96a81c7fe442f8ce0d))

## [1.28.1-develop.2](https://github.com/steveoon/agent-computer-user/compare/v1.28.1-develop.1...v1.28.1-develop.2) (2026-01-29)


### Bug Fixes

* **electron:** improve Windows Chrome profile detection ([b989163](https://github.com/steveoon/agent-computer-user/commit/b989163d1ad00330b376e1b78aa335d9addd6f5d))

## [1.28.1-develop.1](https://github.com/steveoon/agent-computer-user/compare/v1.28.0...v1.28.1-develop.1) (2026-01-29)


### Bug Fixes

* disable electron-builder auto publish to avoid GH_TOKEN error ([9369b8f](https://github.com/steveoon/agent-computer-user/commit/9369b8f1ddf3f7352b1da5ceef32c3f14232aa90))

# [1.28.0](https://github.com/steveoon/agent-computer-user/compare/v1.27.0...v1.28.0) (2026-01-29)


### Features

* add GitHub Actions workflow for Windows x64 build ([bc8ee42](https://github.com/steveoon/agent-computer-user/commit/bc8ee4204f83905b68397efdfa8a8c77489b129f))
* 添加 Token 缺失友好提示并支持 Windows 构建 ([8e75486](https://github.com/steveoon/agent-computer-user/commit/8e754860bce4a0ba6f5b8171ec0da6b9573d4212))

# [1.28.0-develop.2](https://github.com/steveoon/agent-computer-user/compare/v1.28.0-develop.1...v1.28.0-develop.2) (2026-01-29)


### Features

* add GitHub Actions workflow for Windows x64 build ([bc8ee42](https://github.com/steveoon/agent-computer-user/commit/bc8ee4204f83905b68397efdfa8a8c77489b129f))

# [1.28.0-develop.1](https://github.com/steveoon/agent-computer-user/compare/v1.27.0...v1.28.0-develop.1) (2026-01-27)


### Features

* 添加 Token 缺失友好提示并支持 Windows 构建 ([8e75486](https://github.com/steveoon/agent-computer-user/commit/8e754860bce4a0ba6f5b8171ec0da6b9573d4212))

# [1.27.0](https://github.com/steveoon/agent-computer-user/compare/v1.26.0...v1.27.0) (2026-01-27)


### Bug Fixes

* **electron:** 修复 preload.ts 类型定义导致的打包错误 ([90cdf35](https://github.com/steveoon/agent-computer-user/commit/90cdf35086c88b2966b925980bae7707fef1c423))


### Features

* **agent:** 增强 Agent 清理功能并添加启动认证检查 ([a991d94](https://github.com/steveoon/agent-computer-user/commit/a991d945c864a7e5de6326c0b64f41fbd3913150))
* **dashboard:** 添加岗位多选筛选功能 ([8de150e](https://github.com/steveoon/agent-computer-user/commit/8de150e2783e0b7899be6e76242f743a9a85b24b))
* **deploy:** 增强部署脚本健壮性并支持自动上传 ([4d8c4a3](https://github.com/steveoon/agent-computer-user/commit/4d8c4a3fba8bc6246fd33a4049f3d62cf24b346a))

# [1.27.0-develop.2](https://github.com/steveoon/agent-computer-user/compare/v1.27.0-develop.1...v1.27.0-develop.2) (2026-01-27)


### Bug Fixes

* **electron:** 修复 preload.ts 类型定义导致的打包错误 ([90cdf35](https://github.com/steveoon/agent-computer-user/commit/90cdf35086c88b2966b925980bae7707fef1c423))


### Features

* **agent:** 增强 Agent 清理功能并添加启动认证检查 ([a991d94](https://github.com/steveoon/agent-computer-user/commit/a991d945c864a7e5de6326c0b64f41fbd3913150))
* **dashboard:** 添加岗位多选筛选功能 ([8de150e](https://github.com/steveoon/agent-computer-user/commit/8de150e2783e0b7899be6e76242f743a9a85b24b))

# [1.27.0-develop.1](https://github.com/steveoon/agent-computer-user/compare/v1.26.0...v1.27.0-develop.1) (2026-01-23)


### Features

* **deploy:** 增强部署脚本健壮性并支持自动上传 ([4d8c4a3](https://github.com/steveoon/agent-computer-user/commit/4d8c4a3fba8bc6246fd33a4049f3d62cf24b346a))

# [1.26.0](https://github.com/steveoon/agent-computer-user/compare/v1.25.0...v1.26.0) (2026-01-23)


### Bug Fixes

* **chat:** 修复停止生成逻辑和地理编码城市验证 ([7a1b5a7](https://github.com/steveoon/agent-computer-user/commit/7a1b5a78cc1c033e4908dd44ea83ac4d9dae8651))
* **dashboard:** 修复日期筛选时区偏差并优化选择器 UX ([4af0bb5](https://github.com/steveoon/agent-computer-user/commit/4af0bb50bc17b8a20ac636032ad7125a94731e7b))


### Features

* **dashboard:** 深色科技风主题重构与日期样式优化 ([14eeec9](https://github.com/steveoon/agent-computer-user/commit/14eeec943f0ad5828d099273f1dc181aecd7dad6))

# [1.26.0-develop.2](https://github.com/steveoon/agent-computer-user/compare/v1.26.0-develop.1...v1.26.0-develop.2) (2026-01-23)


### Bug Fixes

* **chat:** 修复停止生成逻辑和地理编码城市验证 ([7a1b5a7](https://github.com/steveoon/agent-computer-user/commit/7a1b5a78cc1c033e4908dd44ea83ac4d9dae8651))

# [1.26.0-develop.1](https://github.com/steveoon/agent-computer-user/compare/v1.25.0...v1.26.0-develop.1) (2026-01-23)


### Bug Fixes

* **dashboard:** 修复日期筛选时区偏差并优化选择器 UX ([4af0bb5](https://github.com/steveoon/agent-computer-user/commit/4af0bb50bc17b8a20ac636032ad7125a94731e7b))


### Features

* **dashboard:** 深色科技风主题重构与日期样式优化 ([14eeec9](https://github.com/steveoon/agent-computer-user/commit/14eeec943f0ad5828d099273f1dc181aecd7dad6))

# [1.25.0](https://github.com/steveoon/agent-computer-user/compare/v1.24.0...v1.25.0) (2026-01-22)


### Bug Fixes

* **agent:** 修复 Agent 管理 UI 和后端状态同步问题 ([d54ffc3](https://github.com/steveoon/agent-computer-user/commit/d54ffc30fbbcfe50d32b4753d9d06871eaca560c))
* **agent:** 统一 Agent ID 生成规则并优化添加对话框 ([151c539](https://github.com/steveoon/agent-computer-user/commit/151c539ed86685dabc584f508419022b3c6b48e0))
* **electron:** 修复 macOS GUI 应用 PATH 环境变量缺失问题 ([78ef372](https://github.com/steveoon/agent-computer-user/commit/78ef372091901e2997c091385a8666482b72e2f9))
* **playwright:** 增强 browser_tabs 错误处理和超时机制 ([09ce92f](https://github.com/steveoon/agent-computer-user/commit/09ce92f18a01462a58401073668c747e41823d8f))
* **sync:** 改进同步进度计算精度 ([d25d6e6](https://github.com/steveoon/agent-computer-user/commit/d25d6e61ef3a00f906fb1baac4e08b1708e657cb))


### Features

* **config:** 支持主 App 配置 agentId 标识符 ([dc7de56](https://github.com/steveoon/agent-computer-user/commit/dc7de5646c6e1c023be99ffa76ade5453e665f82))
* **electron:** 完成 Electron Desktop 客户端集成 ([9ea071b](https://github.com/steveoon/agent-computer-user/commit/9ea071b3df5652dd9afcbd94a2e2718b3ecd741a))
* **smart-reply:** 增强错误处理和 LLM 统计信息 ([b7cf26a](https://github.com/steveoon/agent-computer-user/commit/b7cf26a94f07058092558eaea0f5d92e6b755260))
* 添加 ToolLoopAgent 实现和浏览器自动化技能文档 ([447e86f](https://github.com/steveoon/agent-computer-user/commit/447e86f1d10c9ab0df10380f3cc90c84513c32af))


### Performance Improvements

* 应用 Vercel React 最佳实践优化 ([21fb3ef](https://github.com/steveoon/agent-computer-user/commit/21fb3ef84eedc3ffd070cbbb1c9b3f7c9c476623))

# [1.25.0-develop.6](https://github.com/steveoon/agent-computer-user/compare/v1.25.0-develop.5...v1.25.0-develop.6) (2026-01-22)


### Performance Improvements

* 应用 Vercel React 最佳实践优化 ([21fb3ef](https://github.com/steveoon/agent-computer-user/commit/21fb3ef84eedc3ffd070cbbb1c9b3f7c9c476623))

# [1.25.0-develop.5](https://github.com/steveoon/agent-computer-user/compare/v1.25.0-develop.4...v1.25.0-develop.5) (2026-01-19)


### Bug Fixes

* **agent:** 统一 Agent ID 生成规则并优化添加对话框 ([151c539](https://github.com/steveoon/agent-computer-user/commit/151c539ed86685dabc584f508419022b3c6b48e0))

# [1.25.0-develop.4](https://github.com/steveoon/agent-computer-user/compare/v1.25.0-develop.3...v1.25.0-develop.4) (2026-01-19)


### Bug Fixes

* **electron:** 修复 macOS GUI 应用 PATH 环境变量缺失问题 ([78ef372](https://github.com/steveoon/agent-computer-user/commit/78ef372091901e2997c091385a8666482b72e2f9))


### Features

* **config:** 支持主 App 配置 agentId 标识符 ([dc7de56](https://github.com/steveoon/agent-computer-user/commit/dc7de5646c6e1c023be99ffa76ade5453e665f82))

# [1.25.0-develop.3](https://github.com/steveoon/agent-computer-user/compare/v1.25.0-develop.2...v1.25.0-develop.3) (2026-01-16)


### Bug Fixes

* **agent:** 修复 Agent 管理 UI 和后端状态同步问题 ([d54ffc3](https://github.com/steveoon/agent-computer-user/commit/d54ffc30fbbcfe50d32b4753d9d06871eaca560c))

# [1.25.0-develop.2](https://github.com/steveoon/agent-computer-user/compare/v1.25.0-develop.1...v1.25.0-develop.2) (2026-01-15)


### Features

* **electron:** 完成 Electron Desktop 客户端集成 ([9ea071b](https://github.com/steveoon/agent-computer-user/commit/9ea071b3df5652dd9afcbd94a2e2718b3ecd741a))

# [1.25.0-develop.1](https://github.com/steveoon/agent-computer-user/compare/v1.24.0...v1.25.0-develop.1) (2026-01-14)


### Bug Fixes

* **playwright:** 增强 browser_tabs 错误处理和超时机制 ([09ce92f](https://github.com/steveoon/agent-computer-user/commit/09ce92f18a01462a58401073668c747e41823d8f))
* **sync:** 改进同步进度计算精度 ([d25d6e6](https://github.com/steveoon/agent-computer-user/commit/d25d6e61ef3a00f906fb1baac4e08b1708e657cb))


### Features

* **smart-reply:** 增强错误处理和 LLM 统计信息 ([b7cf26a](https://github.com/steveoon/agent-computer-user/commit/b7cf26a94f07058092558eaea0f5d92e6b755260))
* 添加 ToolLoopAgent 实现和浏览器自动化技能文档 ([447e86f](https://github.com/steveoon/agent-computer-user/commit/447e86f1d10c9ab0df10380f3cc90c84513c32af))

# [1.24.0](https://github.com/steveoon/agent-computer-user/compare/v1.23.2...v1.24.0) (2026-01-13)


### Bug Fixes

* **loader:** 修复品牌名称空格导致的匹配失败 ([20cbdd6](https://github.com/steveoon/agent-computer-user/commit/20cbdd6200fd8e2409a3d65d00765aa56f258084))
* **scripts:** improve multi-agent.sh security and reliability ([2a597e8](https://github.com/steveoon/agent-computer-user/commit/2a597e8129404ec3c7057bf21c5133121e9b2a47))


### Features

* **admin:** 添加配置文件拖拽导入功能 ([79c9c16](https://github.com/steveoon/agent-computer-user/commit/79c9c16114bdc22e45e7c26c6431193ac8e864a7))
* **agent:** 添加 IndexedDB 清理命令及稳定性改进 ([77ddf0d](https://github.com/steveoon/agent-computer-user/commit/77ddf0d976512ce2771bf2b3f544376faa09485f))
* **types:** add duliday-sync type definitions ([1eaa4ad](https://github.com/steveoon/agent-computer-user/commit/1eaa4adc2a76d290b1f39d8c74e287ca303af212))

# [1.24.0-develop.2](https://github.com/steveoon/agent-computer-user/compare/v1.24.0-develop.1...v1.24.0-develop.2) (2026-01-13)


### Bug Fixes

* **loader:** 修复品牌名称空格导致的匹配失败 ([20cbdd6](https://github.com/steveoon/agent-computer-user/commit/20cbdd6200fd8e2409a3d65d00765aa56f258084))


### Features

* **admin:** 添加配置文件拖拽导入功能 ([79c9c16](https://github.com/steveoon/agent-computer-user/commit/79c9c16114bdc22e45e7c26c6431193ac8e864a7))
* **agent:** 添加 IndexedDB 清理命令及稳定性改进 ([77ddf0d](https://github.com/steveoon/agent-computer-user/commit/77ddf0d976512ce2771bf2b3f544376faa09485f))

# [1.24.0-develop.1](https://github.com/steveoon/agent-computer-user/compare/v1.23.2...v1.24.0-develop.1) (2026-01-13)


### Bug Fixes

* **scripts:** improve multi-agent.sh security and reliability ([2a597e8](https://github.com/steveoon/agent-computer-user/commit/2a597e8129404ec3c7057bf21c5133121e9b2a47))


### Features

* **types:** add duliday-sync type definitions ([1eaa4ad](https://github.com/steveoon/agent-computer-user/commit/1eaa4adc2a76d290b1f39d8c74e287ca303af212))

## [1.23.2](https://github.com/steveoon/agent-computer-user/compare/v1.23.1...v1.23.2) (2026-01-08)


### Bug Fixes

* **mcp:** remove beforeExit handler to prevent premature cleanup ([aeb36fa](https://github.com/steveoon/agent-computer-user/commit/aeb36faddd6e8587e0aed48739a648410d23b047))

## [1.23.2-develop.1](https://github.com/steveoon/agent-computer-user/compare/v1.23.1...v1.23.2-develop.1) (2026-01-08)


### Bug Fixes

* **mcp:** remove beforeExit handler to prevent premature cleanup ([aeb36fa](https://github.com/steveoon/agent-computer-user/commit/aeb36faddd6e8587e0aed48739a648410d23b047))

## [1.23.1](https://github.com/steveoon/agent-computer-user/compare/v1.23.0...v1.23.1) (2026-01-08)


### Bug Fixes

* **types:** allow minWorkMonths to be nullable in DulidayRaw schema ([e5e8062](https://github.com/steveoon/agent-computer-user/commit/e5e8062a6b46d89de977a39c0e0004ebe27f5a80))

## [1.23.1-develop.1](https://github.com/steveoon/agent-computer-user/compare/v1.23.0...v1.23.1-develop.1) (2026-01-08)


### Bug Fixes

* **types:** allow minWorkMonths to be nullable in DulidayRaw schema ([e5e8062](https://github.com/steveoon/agent-computer-user/commit/e5e8062a6b46d89de977a39c0e0004ebe27f5a80))

# [1.23.0](https://github.com/steveoon/agent-computer-user/compare/v1.22.0...v1.23.0) (2026-01-07)


### Bug Fixes

* **stats:** resolve timezone issues and prevent duplicate records ([4239a7e](https://github.com/steveoon/agent-computer-user/commit/4239a7e48bf4b7265717d6424adf157ab9cf02c2))


### Features

* add Model Context Protocol SDK and integrate into client manager ([94ccef8](https://github.com/steveoon/agent-computer-user/commit/94ccef8e7fa986ca20727e7c4cca11695c237155))
* **ai:** add unified structured output error handling with tool-based pattern ([b3d6b80](https://github.com/steveoon/agent-computer-user/commit/b3d6b80ebb4803e36c0a5dceb96a0df89aa4a7a0))
* **mcp:** add CHROME_HOST env var for Docker deployment ([5fb1380](https://github.com/steveoon/agent-computer-user/commit/5fb1380ac2fce4cb8b2c32a327bac12ed4ba04d3))
* **mcp:** add Playwright CDP mode for multi-agent support ([8899f7b](https://github.com/steveoon/agent-computer-user/commit/8899f7bc6f6a03a8341b4747488a418256119389))
* **mcp:** add Playwright MCP support with dual-backend screenshot tool ([874d57e](https://github.com/steveoon/agent-computer-user/commit/874d57e687cb497bfdad668b9c5af800fc147acb))

# [1.23.0-develop.4](https://github.com/steveoon/agent-computer-user/compare/v1.23.0-develop.3...v1.23.0-develop.4) (2026-01-07)


### Bug Fixes

* **stats:** resolve timezone issues and prevent duplicate records ([4239a7e](https://github.com/steveoon/agent-computer-user/commit/4239a7e48bf4b7265717d6424adf157ab9cf02c2))

# [1.23.0-develop.3](https://github.com/steveoon/agent-computer-user/compare/v1.23.0-develop.2...v1.23.0-develop.3) (2026-01-06)


### Features

* **mcp:** add CHROME_HOST env var for Docker deployment ([5fb1380](https://github.com/steveoon/agent-computer-user/commit/5fb1380ac2fce4cb8b2c32a327bac12ed4ba04d3))

# [1.23.0-develop.2](https://github.com/steveoon/agent-computer-user/compare/v1.23.0-develop.1...v1.23.0-develop.2) (2026-01-06)


### Features

* **mcp:** add Playwright CDP mode for multi-agent support ([8899f7b](https://github.com/steveoon/agent-computer-user/commit/8899f7bc6f6a03a8341b4747488a418256119389))
* **mcp:** add Playwright MCP support with dual-backend screenshot tool ([874d57e](https://github.com/steveoon/agent-computer-user/commit/874d57e687cb497bfdad668b9c5af800fc147acb))

# [1.23.0-develop.1](https://github.com/steveoon/agent-computer-user/compare/v1.22.0...v1.23.0-develop.1) (2026-01-04)


### Features

* add Model Context Protocol SDK and integrate into client manager ([94ccef8](https://github.com/steveoon/agent-computer-user/commit/94ccef8e7fa986ca20727e7c4cca11695c237155))
* **ai:** add unified structured output error handling with tool-based pattern ([b3d6b80](https://github.com/steveoon/agent-computer-user/commit/b3d6b80ebb4803e36c0a5dceb96a0df89aa4a7a0))

# [1.22.0](https://github.com/steveoon/agent-computer-user/compare/v1.21.2...v1.22.0) (2025-12-26)


### Bug Fixes

* **scripts:** use package.json as version source for image export ([bb03e3e](https://github.com/steveoon/agent-computer-user/commit/bb03e3ef4000566dc829fece92ddbb7e1bdbe17e))


### Features

* **ai-sdk:** upgrade to AI SDK v6 with comprehensive tool updates ([782eac6](https://github.com/steveoon/agent-computer-user/commit/782eac6e346fe598a905d4b303f2c3a1760357ca))

# [1.22.0-develop.1](https://github.com/steveoon/agent-computer-user/compare/v1.21.2...v1.22.0-develop.1) (2025-12-26)


### Bug Fixes

* **scripts:** use package.json as version source for image export ([bb03e3e](https://github.com/steveoon/agent-computer-user/commit/bb03e3ef4000566dc829fece92ddbb7e1bdbe17e))


### Features

* **ai-sdk:** upgrade to AI SDK v6 with comprehensive tool updates ([782eac6](https://github.com/steveoon/agent-computer-user/commit/782eac6e346fe598a905d4b303f2c3a1760357ca))

## [1.21.2](https://github.com/steveoon/agent-computer-user/compare/v1.21.1...v1.21.2) (2025-12-24)


### Bug Fixes

* **types:** allow string type for welfare.accommodationNum field ([423d166](https://github.com/steveoon/agent-computer-user/commit/423d166ba7220d0bcebb7edf4a150caad8d705b0))

## [1.21.2-develop.1](https://github.com/steveoon/agent-computer-user/compare/v1.21.1...v1.21.2-develop.1) (2025-12-24)


### Bug Fixes

* **types:** allow string type for welfare.accommodationNum field ([423d166](https://github.com/steveoon/agent-computer-user/commit/423d166ba7220d0bcebb7edf4a150caad8d705b0))

## [1.21.1](https://github.com/steveoon/agent-computer-user/compare/v1.21.0...v1.21.1) (2025-12-22)


### Bug Fixes

* **dashboard:** pause marquee at current position on hover ([30129ce](https://github.com/steveoon/agent-computer-user/commit/30129cefaac6802632f7ff1753b56f7dfcd96e4f))

## [1.21.1-develop.1](https://github.com/steveoon/agent-computer-user/compare/v1.21.0...v1.21.1-develop.1) (2025-12-22)


### Bug Fixes

* **dashboard:** pause marquee at current position on hover ([30129ce](https://github.com/steveoon/agent-computer-user/commit/30129cefaac6802632f7ff1753b56f7dfcd96e4f))

# [1.21.0](https://github.com/steveoon/agent-computer-user/compare/v1.20.1...v1.21.0) (2025-12-22)


### Features

* **dashboard:** add auto-refresh with animated number transitions ([0d64882](https://github.com/steveoon/agent-computer-user/commit/0d64882dd2425bd1bf385f3ac6af9ad4b83a2e82))

# [1.21.0-develop.1](https://github.com/steveoon/agent-computer-user/compare/v1.20.1...v1.21.0-develop.1) (2025-12-22)


### Features

* **dashboard:** add auto-refresh with animated number transitions ([0d64882](https://github.com/steveoon/agent-computer-user/commit/0d64882dd2425bd1bf385f3ac6af9ad4b83a2e82))

## [1.20.1](https://github.com/steveoon/agent-computer-user/compare/v1.20.0...v1.20.1) (2025-12-19)


### Bug Fixes

* 修复生产环境调度器状态不共享问题 ([69572c6](https://github.com/steveoon/agent-computer-user/commit/69572c63f3e45853a80dcc0e9f11520328377a51))

## [1.20.1-develop.1](https://github.com/steveoon/agent-computer-user/compare/v1.20.0...v1.20.1-develop.1) (2025-12-19)


### Bug Fixes

* 修复生产环境调度器状态不共享问题 ([69572c6](https://github.com/steveoon/agent-computer-user/commit/69572c63f3e45853a80dcc0e9f11520328377a51))

# [1.20.0](https://github.com/steveoon/agent-computer-user/compare/v1.19.1...v1.20.0) (2025-12-19)


### Bug Fixes

* **security:** 升级 Next.js 和 React 修复安全漏洞 ([8a8ae33](https://github.com/steveoon/agent-computer-user/commit/8a8ae336d40d902d026ddd0ce780ba4614fa890f))
* 优化聚合逻辑与工具参数 ([568d720](https://github.com/steveoon/agent-computer-user/commit/568d720f3d8d0433f0a274d232d895cf6cf059da))
* 修复 zhipin 平台 candidate_key 匹配问题 ([dd540d9](https://github.com/steveoon/agent-computer-user/commit/dd540d9f79aefb18b44a80e1c32b6c6685908b11))


### Features

* Add recruitment event tracking system for yupao and zhipin platforms ([3510a85](https://github.com/steveoon/agent-computer-user/commit/3510a850b4ab14929206b418840f552181d37bf2))
* **dashboard:** 添加待回复候选人组件与图表颜色修复 ([e3230fb](https://github.com/steveoon/agent-computer-user/commit/e3230fb7a0a90378a4abfa0aeceeb0583cb3c0bf))

# [1.20.0-develop.1](https://github.com/steveoon/agent-computer-user/compare/v1.19.1...v1.20.0-develop.1) (2025-12-19)


### Bug Fixes

* **security:** 升级 Next.js 和 React 修复安全漏洞 ([8a8ae33](https://github.com/steveoon/agent-computer-user/commit/8a8ae336d40d902d026ddd0ce780ba4614fa890f))
* 优化聚合逻辑与工具参数 ([568d720](https://github.com/steveoon/agent-computer-user/commit/568d720f3d8d0433f0a274d232d895cf6cf059da))
* 修复 zhipin 平台 candidate_key 匹配问题 ([dd540d9](https://github.com/steveoon/agent-computer-user/commit/dd540d9f79aefb18b44a80e1c32b6c6685908b11))


### Features

* Add recruitment event tracking system for yupao and zhipin platforms ([3510a85](https://github.com/steveoon/agent-computer-user/commit/3510a850b4ab14929206b418840f552181d37bf2))
* **dashboard:** 添加待回复候选人组件与图表颜色修复 ([e3230fb](https://github.com/steveoon/agent-computer-user/commit/e3230fb7a0a90378a4abfa0aeceeb0583cb3c0bf))

## [1.19.1](https://github.com/steveoon/agent-computer-user/compare/v1.19.0...v1.19.1) (2025-12-10)


### Bug Fixes

* **chat:** add abortSignal to streamText for proper client-side stop support ([8c6aacb](https://github.com/steveoon/agent-computer-user/commit/8c6aacbabe693edb4117c1f5e4896ab25bc44539))

## [1.19.1-develop.1](https://github.com/steveoon/agent-computer-user/compare/v1.19.0...v1.19.1-develop.1) (2025-12-09)


### Bug Fixes

* **chat:** add abortSignal to streamText for proper client-side stop support ([8c6aacb](https://github.com/steveoon/agent-computer-user/commit/8c6aacbabe693edb4117c1f5e4896ab25bc44539))

# [1.19.0](https://github.com/steveoon/agent-computer-user/compare/v1.18.0...v1.19.0) (2025-12-08)


### Bug Fixes

* **security:** upgrade Next.js to 15.4.8 for CVE-2025-55182 (React2Shell) ([07cbe00](https://github.com/steveoon/agent-computer-user/commit/07cbe0088aa40d3a61b69d76775baa3b119cc486))


### Features

* add `BackButton` component and apply new background styling to sync page. ([83e3238](https://github.com/steveoon/agent-computer-user/commit/83e32387783a8c8aee86ae775d538bc1c9c3ae9c))
* Add DeepSeek model support, update AI SDK dependencies, and refactor agent configuration page UI. ([f5c78ac](https://github.com/steveoon/agent-computer-user/commit/f5c78acc15d89fa219bd6b4327b28ddd415a4c97))
* Add structured error handling system with error chain preservation ([039cc89](https://github.com/steveoon/agent-computer-user/commit/039cc897f294ea7a5f6eff6fb00ef81e554745e5))
* **multi-agent:** 添加 standalone 模式和 Chrome 优雅关闭 ([6afa797](https://github.com/steveoon/agent-computer-user/commit/6afa797e2ecc306a1fd2bd634bf7cbcbda93c1e4))

# [1.19.0-develop.1](https://github.com/steveoon/agent-computer-user/compare/v1.18.0...v1.19.0-develop.1) (2025-12-08)


### Bug Fixes

* **security:** upgrade Next.js to 15.4.8 for CVE-2025-55182 (React2Shell) ([07cbe00](https://github.com/steveoon/agent-computer-user/commit/07cbe0088aa40d3a61b69d76775baa3b119cc486))


### Features

* add `BackButton` component and apply new background styling to sync page. ([83e3238](https://github.com/steveoon/agent-computer-user/commit/83e32387783a8c8aee86ae775d538bc1c9c3ae9c))
* Add DeepSeek model support, update AI SDK dependencies, and refactor agent configuration page UI. ([f5c78ac](https://github.com/steveoon/agent-computer-user/commit/f5c78acc15d89fa219bd6b4327b28ddd415a4c97))
* Add structured error handling system with error chain preservation ([039cc89](https://github.com/steveoon/agent-computer-user/commit/039cc897f294ea7a5f6eff6fb00ef81e554745e5))
* **multi-agent:** 添加 standalone 模式和 Chrome 优雅关闭 ([6afa797](https://github.com/steveoon/agent-computer-user/commit/6afa797e2ecc306a1fd2bd634bf7cbcbda93c1e4))

# [1.18.0](https://github.com/steveoon/agent-computer-user/compare/v1.17.0...v1.18.0) (2025-11-28)


### Features

* Add ErrorBoundary component to enhance error handling in RootLayout and ChatPanel ([78eca3d](https://github.com/steveoon/agent-computer-user/commit/78eca3d8b0867c2e15a1b255c8c1ec59a0d97769))
* Enhance UI with glassmorphism effects and improve layout for chat and admin settings pages ([7d9b825](https://github.com/steveoon/agent-computer-user/commit/7d9b825dc478d3d0940eab46460407a378594c3e))
* Implement Human-in-the-Loop (HITL) for tool confirmation and add agent computer use rules. ([5bad522](https://github.com/steveoon/agent-computer-user/commit/5bad5229882732cda1089be3de2507119b203867))
* Introduce geocoding service with sync statistics display and enhance brand data editor to infer and show store cities. ([0d0ad4a](https://github.com/steveoon/agent-computer-user/commit/0d0ad4aeccfdee75b75bebafaa8f383a13346045))
* 实现消息分类和基于门店数据的上下文构建逻辑，并为测试页面和API添加品牌冲突解析及详细调试信息。 ([5c6b1ab](https://github.com/steveoon/agent-computer-user/commit/5c6b1ab2b3f028f8c0702904d3090ff7d9b3ce66))

# [1.18.0-develop.2](https://github.com/steveoon/agent-computer-user/compare/v1.18.0-develop.1...v1.18.0-develop.2) (2025-11-28)


### Features

* Add ErrorBoundary component to enhance error handling in RootLayout and ChatPanel ([78eca3d](https://github.com/steveoon/agent-computer-user/commit/78eca3d8b0867c2e15a1b255c8c1ec59a0d97769))

# [1.18.0-develop.1](https://github.com/steveoon/agent-computer-user/compare/v1.17.0...v1.18.0-develop.1) (2025-11-28)


### Features

* Enhance UI with glassmorphism effects and improve layout for chat and admin settings pages ([7d9b825](https://github.com/steveoon/agent-computer-user/commit/7d9b825dc478d3d0940eab46460407a378594c3e))
* Implement Human-in-the-Loop (HITL) for tool confirmation and add agent computer use rules. ([5bad522](https://github.com/steveoon/agent-computer-user/commit/5bad5229882732cda1089be3de2507119b203867))
* Introduce geocoding service with sync statistics display and enhance brand data editor to infer and show store cities. ([0d0ad4a](https://github.com/steveoon/agent-computer-user/commit/0d0ad4aeccfdee75b75bebafaa8f383a13346045))
* 实现消息分类和基于门店数据的上下文构建逻辑，并为测试页面和API添加品牌冲突解析及详细调试信息。 ([5c6b1ab](https://github.com/steveoon/agent-computer-user/commit/5c6b1ab2b3f028f8c0702904d3090ff7d9b3ce66))

# [1.17.0](https://github.com/steveoon/agent-computer-user/compare/v1.16.0...v1.17.0) (2025-11-21)


### Features

* **ui:** 优化 Puppeteer 工具消息组件显示参数 ([4fad072](https://github.com/steveoon/agent-computer-user/commit/4fad07200ca998f786c1144db7d9f2f0df2f1869))
* **yupao:** 优化候选人匹配和弹窗处理逻辑 ([db39cc6](https://github.com/steveoon/agent-computer-user/commit/db39cc6912c03dd12dce8cd039930cc314d16c3b))
* **yupao:** 优化微信交换流程和聊天详情解析 ([00a6c85](https://github.com/steveoon/agent-computer-user/commit/00a6c85c7f99418ccc2a1a78af09670e22931f72))

# [1.17.0-develop.2](https://github.com/steveoon/agent-computer-user/compare/v1.17.0-develop.1...v1.17.0-develop.2) (2025-11-21)


### Features

* **yupao:** 优化微信交换流程和聊天详情解析 ([00a6c85](https://github.com/steveoon/agent-computer-user/commit/00a6c85c7f99418ccc2a1a78af09670e22931f72))

# [1.17.0-develop.1](https://github.com/steveoon/agent-computer-user/compare/v1.16.0...v1.17.0-develop.1) (2025-11-21)


### Features

* **ui:** 优化 Puppeteer 工具消息组件显示参数 ([4fad072](https://github.com/steveoon/agent-computer-user/commit/4fad07200ca998f786c1144db7d9f2f0df2f1869))
* **yupao:** 优化候选人匹配和弹窗处理逻辑 ([db39cc6](https://github.com/steveoon/agent-computer-user/commit/db39cc6912c03dd12dce8cd039930cc314d16c3b))

# [1.16.0](https://github.com/steveoon/agent-computer-user/compare/v1.15.0...v1.16.0) (2025-11-19)


### Bug Fixes

* **monitor:** 修复鱼泡未读消息检测的 __name 序列化错误 ([86a669e](https://github.com/steveoon/agent-computer-user/commit/86a669e32eaea52393c22b2a07fea3711e821faf))


### Features

* **monitor:** 复用已有浏览器标签页并修复 viewport 问题 ([6f65607](https://github.com/steveoon/agent-computer-user/commit/6f6560767acf75a2202e815c3628caf701953ed4))

# [1.16.0-develop.1](https://github.com/steveoon/agent-computer-user/compare/v1.15.1-develop.1...v1.16.0-develop.1) (2025-11-19)


### Features

* **monitor:** 复用已有浏览器标签页并修复 viewport 问题 ([6f65607](https://github.com/steveoon/agent-computer-user/commit/6f6560767acf75a2202e815c3628caf701953ed4))

## [1.15.1-develop.1](https://github.com/steveoon/agent-computer-user/compare/v1.15.0...v1.15.1-develop.1) (2025-11-19)


### Bug Fixes

* **monitor:** 修复鱼泡未读消息检测的 __name 序列化错误 ([86a669e](https://github.com/steveoon/agent-computer-user/commit/86a669e32eaea52393c22b2a07fea3711e821faf))

# [1.15.0](https://github.com/steveoon/agent-computer-user/compare/v1.14.1...v1.15.0) (2025-11-19)


### Features

* 添加Agent步数限制后的"继续"按钮及可配置maxSteps ([8d708b1](https://github.com/steveoon/agent-computer-user/commit/8d708b18bf58da84ec6f61fd749894c004877453))

# [1.15.0-develop.1](https://github.com/steveoon/agent-computer-user/compare/v1.14.1...v1.15.0-develop.1) (2025-11-19)


### Features

* 添加Agent步数限制后的"继续"按钮及可配置maxSteps ([8d708b1](https://github.com/steveoon/agent-computer-user/commit/8d708b18bf58da84ec6f61fd749894c004877453))

## [1.14.1](https://github.com/steveoon/agent-computer-user/compare/v1.14.0...v1.14.1) (2025-11-17)


### Bug Fixes

* 修复同系列品牌匹配逻辑，优先使用LLM提取的品牌 ([fba0970](https://github.com/steveoon/agent-computer-user/commit/fba09703d89003620bc95a35eb0aee9e3c3f4032))

## [1.14.1-develop.1](https://github.com/steveoon/agent-computer-user/compare/v1.14.0...v1.14.1-develop.1) (2025-11-17)


### Bug Fixes

* 修复同系列品牌匹配逻辑，优先使用LLM提取的品牌 ([fba0970](https://github.com/steveoon/agent-computer-user/commit/fba09703d89003620bc95a35eb0aee9e3c3f4032))

# [1.14.0](https://github.com/steveoon/agent-computer-user/compare/v1.13.0...v1.14.0) (2025-11-13)


### Bug Fixes

* 修复 test-llm-reply API 参数顺序并添加字段过滤设计文档 ([60692e1](https://github.com/steveoon/agent-computer-user/commit/60692e136601b9fa3b552469742ab114b2869d1d))


### Features

* refactor multi-agent script with config constants and modular update workflow ([649dbeb](https://github.com/steveoon/agent-computer-user/commit/649dbeb922578d089dee4d81749e6665e283d8d8))

# [1.14.0-develop.1](https://github.com/steveoon/agent-computer-user/compare/v1.13.1-develop.1...v1.14.0-develop.1) (2025-11-13)


### Features

* refactor multi-agent script with config constants and modular update workflow ([649dbeb](https://github.com/steveoon/agent-computer-user/commit/649dbeb922578d089dee4d81749e6665e283d8d8))

## [1.13.1-develop.1](https://github.com/steveoon/agent-computer-user/compare/v1.13.0...v1.13.1-develop.1) (2025-11-13)


### Bug Fixes

* 修复 test-llm-reply API 参数顺序并添加字段过滤设计文档 ([60692e1](https://github.com/steveoon/agent-computer-user/commit/60692e136601b9fa3b552469742ab114b2869d1d))

# [1.13.0](https://github.com/steveoon/agent-computer-user/compare/v1.12.0...v1.13.0) (2025-11-12)


### Bug Fixes

* allow Next.js build without DATABASE_URL ([6880564](https://github.com/steveoon/agent-computer-user/commit/68805644be37c38f4daf45001dfb8f80fc95c289))
* improve error handling and fix CI test environment ([064b153](https://github.com/steveoon/agent-computer-user/commit/064b153233aa0d4114c73a41e4f585071ebae825))


### Features

* 品牌映射迁移到数据库 + 完整 CRUD 功能 ([9ddfa68](https://github.com/steveoon/agent-computer-user/commit/9ddfa68eb8f4bfc44d27d3565bd12a458376aa1f))

# [1.13.0-develop.1](https://github.com/steveoon/agent-computer-user/compare/v1.12.0...v1.13.0-develop.1) (2025-11-12)


### Bug Fixes

* allow Next.js build without DATABASE_URL ([6880564](https://github.com/steveoon/agent-computer-user/commit/68805644be37c38f4daf45001dfb8f80fc95c289))
* improve error handling and fix CI test environment ([064b153](https://github.com/steveoon/agent-computer-user/commit/064b153233aa0d4114c73a41e4f585071ebae825))


### Features

* 品牌映射迁移到数据库 + 完整 CRUD 功能 ([9ddfa68](https://github.com/steveoon/agent-computer-user/commit/9ddfa68eb8f4bfc44d27d3565bd12a458376aa1f))

# [1.12.0](https://github.com/steveoon/agent-computer-user/compare/v1.11.0...v1.12.0) (2025-11-07)


### Features

* 优化配置管理和类型定义 ([c4dfa5e](https://github.com/steveoon/agent-computer-user/commit/c4dfa5eebb32f5181a429fce972c31209845e076))

# [1.12.0-develop.1](https://github.com/steveoon/agent-computer-user/compare/v1.11.0...v1.12.0-develop.1) (2025-11-07)


### Features

* 优化配置管理和类型定义 ([c4dfa5e](https://github.com/steveoon/agent-computer-user/commit/c4dfa5eebb32f5181a429fce972c31209845e076))

# [1.11.0](https://github.com/steveoon/agent-computer-user/compare/v1.10.0...v1.11.0) (2025-11-03)


### Bug Fixes

* 添加自建 Supabase 域名到 CSP 白名单 ([68574d1](https://github.com/steveoon/agent-computer-user/commit/68574d112d967db50fe977783103a2bbe1d2ef97))


### Features

* 添加多 Agent 并行管理系统 ([be7f12f](https://github.com/steveoon/agent-computer-user/commit/be7f12f31b632a8a989dd3986fe6d837e25e5eda))

# [1.11.0-develop.2](https://github.com/steveoon/agent-computer-user/compare/v1.11.0-develop.1...v1.11.0-develop.2) (2025-11-03)


### Bug Fixes

* 添加自建 Supabase 域名到 CSP 白名单 ([68574d1](https://github.com/steveoon/agent-computer-user/commit/68574d112d967db50fe977783103a2bbe1d2ef97))

# [1.11.0-develop.1](https://github.com/steveoon/agent-computer-user/compare/v1.10.0...v1.11.0-develop.1) (2025-10-28)


### Features

* 添加多 Agent 并行管理系统 ([be7f12f](https://github.com/steveoon/agent-computer-user/commit/be7f12f31b632a8a989dd3986fe6d837e25e5eda))

# [1.10.0](https://github.com/steveoon/agent-computer-user/compare/v1.9.0...v1.10.0) (2025-10-27)


### Features

* 优化 Supabase 中间件性能和工作天数计算逻辑 ([ac96d19](https://github.com/steveoon/agent-computer-user/commit/ac96d19f99aab9c0632ed2173f002e6a257cf633))

# [1.10.0-develop.1](https://github.com/steveoon/agent-computer-user/compare/v1.9.0...v1.10.0-develop.1) (2025-10-27)


### Features

* 优化 Supabase 中间件性能和工作天数计算逻辑 ([ac96d19](https://github.com/steveoon/agent-computer-user/commit/ac96d19f99aab9c0632ed2173f002e6a257cf633))

# [1.9.0](https://github.com/steveoon/agent-computer-user/compare/v1.8.0...v1.9.0) (2025-10-16)


### Bug Fixes

* **bailian-upload:** 修复 Blob 构造器的类型兼容性问题 ([9de3066](https://github.com/steveoon/agent-computer-user/commit/9de30669842cb4955e4969823b73cdfa0e21dbc5))
* **duliday:** 修复 BI 报表工具 500 错误并添加企业字段支持 ([7af6761](https://github.com/steveoon/agent-computer-user/commit/7af676183daf563cb04b9d95f10f2e8768bc5f4a))
* 修复 TypeScript 类型错误 ([ce92b2b](https://github.com/steveoon/agent-computer-user/commit/ce92b2be9e2af47464be3df42e79ea068d6a4ad6))
* 修复登录后立即访问受保护路由时认证失败的问题 ([bfb9a4d](https://github.com/steveoon/agent-computer-user/commit/bfb9a4db3a7030d72fd3995f598e7d86407ac247))
* 修复非流式模式丢失工具调用历史的问题 ([0c4beb2](https://github.com/steveoon/agent-computer-user/commit/0c4beb2670eae6e4338dc199e0974a495c6b55fa))


### Features

* **api:** 实现 Open API v1 接口及鉴权和 CORS 支持 ([836e949](https://github.com/steveoon/agent-computer-user/commit/836e94907e61c842037caa7562d09ba4ea3599fc))
* **models:** 添加 Claude Sonnet 4.5 模型支持 ([ac86fbb](https://github.com/steveoon/agent-computer-user/commit/ac86fbbc1ffa839b9f013fc6ba81ed26d79de2b3))
* **ui:** BI 报表工具消息组件添加新字段显示 ([dbde2e3](https://github.com/steveoon/agent-computer-user/commit/dbde2e3bc5f8d7381892dae672e2595b65b88ad6))
* 增强智能回复工具的 configData 验证 ([29ab232](https://github.com/steveoon/agent-computer-user/commit/29ab23295a74bbafff1449bdb8c8c159d5bcde36))
* 实现 GET /api/v1/models API 端点 ([0f42595](https://github.com/steveoon/agent-computer-user/commit/0f42595b7e01132e395fb1063707435762ab692a))
* 实现 Open API Agent 系统核心接口 ([a506109](https://github.com/steveoon/agent-computer-user/commit/a506109e8240e283e84c1a926dd695a400657fdd))
* 实现花卷品牌升级和沙盒面板折叠功能 ([8583bba](https://github.com/steveoon/agent-computer-user/commit/8583bba82a0e6bbfb64b7ce3f9e9fa8e0ffd3caf)), closes [#F59E0](https://github.com/steveoon/agent-computer-user/issues/F59E0)
* 改进 UX 反馈和导航体验 ([127f584](https://github.com/steveoon/agent-computer-user/commit/127f584a55f4ac1266c78d5d89780692388551b4))

# [1.9.0-develop.7](https://github.com/steveoon/agent-computer-user/compare/v1.9.0-develop.6...v1.9.0-develop.7) (2025-10-16)


### Bug Fixes

* 修复登录后立即访问受保护路由时认证失败的问题 ([bfb9a4d](https://github.com/steveoon/agent-computer-user/commit/bfb9a4db3a7030d72fd3995f598e7d86407ac247))


### Features

* 实现花卷品牌升级和沙盒面板折叠功能 ([8583bba](https://github.com/steveoon/agent-computer-user/commit/8583bba82a0e6bbfb64b7ce3f9e9fa8e0ffd3caf)), closes [#F59E0](https://github.com/steveoon/agent-computer-user/issues/F59E0)

# [1.9.0-develop.6](https://github.com/steveoon/agent-computer-user/compare/v1.9.0-develop.5...v1.9.0-develop.6) (2025-10-15)


### Bug Fixes

* 修复非流式模式丢失工具调用历史的问题 ([0c4beb2](https://github.com/steveoon/agent-computer-user/commit/0c4beb2670eae6e4338dc199e0974a495c6b55fa))


### Features

* 增强智能回复工具的 configData 验证 ([29ab232](https://github.com/steveoon/agent-computer-user/commit/29ab23295a74bbafff1449bdb8c8c159d5bcde36))

# [1.9.0-develop.5](https://github.com/steveoon/agent-computer-user/compare/v1.9.0-develop.4...v1.9.0-develop.5) (2025-10-10)


### Bug Fixes

* 修复 TypeScript 类型错误 ([ce92b2b](https://github.com/steveoon/agent-computer-user/commit/ce92b2be9e2af47464be3df42e79ea068d6a4ad6))


### Features

* 实现 Open API Agent 系统核心接口 ([a506109](https://github.com/steveoon/agent-computer-user/commit/a506109e8240e283e84c1a926dd695a400657fdd))

# [1.9.0-develop.4](https://github.com/steveoon/agent-computer-user/compare/v1.9.0-develop.3...v1.9.0-develop.4) (2025-10-10)


### Features

* 改进 UX 反馈和导航体验 ([127f584](https://github.com/steveoon/agent-computer-user/commit/127f584a55f4ac1266c78d5d89780692388551b4))

# [1.9.0-develop.3](https://github.com/steveoon/agent-computer-user/compare/v1.9.0-develop.2...v1.9.0-develop.3) (2025-09-30)


### Bug Fixes

* **duliday:** 修复 BI 报表工具 500 错误并添加企业字段支持 ([7af6761](https://github.com/steveoon/agent-computer-user/commit/7af676183daf563cb04b9d95f10f2e8768bc5f4a))


### Features

* **models:** 添加 Claude Sonnet 4.5 模型支持 ([ac86fbb](https://github.com/steveoon/agent-computer-user/commit/ac86fbbc1ffa839b9f013fc6ba81ed26d79de2b3))
* **ui:** BI 报表工具消息组件添加新字段显示 ([dbde2e3](https://github.com/steveoon/agent-computer-user/commit/dbde2e3bc5f8d7381892dae672e2595b65b88ad6))

# [1.9.0-develop.2](https://github.com/steveoon/agent-computer-user/compare/v1.9.0-develop.1...v1.9.0-develop.2) (2025-09-28)


### Features

* 实现 GET /api/v1/models API 端点 ([0f42595](https://github.com/steveoon/agent-computer-user/commit/0f42595b7e01132e395fb1063707435762ab692a))

# [1.9.0-develop.1](https://github.com/steveoon/agent-computer-user/compare/v1.8.1-develop.1...v1.9.0-develop.1) (2025-09-28)


### Features

* **api:** 实现 Open API v1 接口及鉴权和 CORS 支持 ([836e949](https://github.com/steveoon/agent-computer-user/commit/836e94907e61c842037caa7562d09ba4ea3599fc))

## [1.8.1-develop.1](https://github.com/steveoon/agent-computer-user/compare/v1.8.0...v1.8.1-develop.1) (2025-09-17)


### Bug Fixes

* **bailian-upload:** 修复 Blob 构造器的类型兼容性问题 ([9de3066](https://github.com/steveoon/agent-computer-user/commit/9de30669842cb4955e4969823b73cdfa0e21dbc5))

# [1.8.0](https://github.com/steveoon/agent-computer-user/compare/v1.7.0...v1.8.0) (2025-09-15)


### Bug Fixes

* 优化截图上传功能，增加重试机制和跨环境兼容性 ([1d1889e](https://github.com/steveoon/agent-computer-user/commit/1d1889ef0ea8f3da80c771d94f239372b675b428))
* 修复zhipin打招呼工具兼容性和类型安全问题 ([3c9f4ae](https://github.com/steveoon/agent-computer-user/commit/3c9f4aebfaea61b4788e362b520940aeae83291f))
* 替换window.confirm为toast确认组件并修复模型ID验证问题 ([fdbda6a](https://github.com/steveoon/agent-computer-user/commit/fdbda6a52e7ade1688efd417a100dfb254320387))
* 添加缺失的 msw 测试依赖 ([596a56e](https://github.com/steveoon/agent-computer-user/commit/596a56eb22f711264138b9be65cf0ff901221c55))


### Features

* 添加配置页面快速入口和导航优化 ([624f5d4](https://github.com/steveoon/agent-computer-user/commit/624f5d40c503b7de928670743ba7489481dc550c))
* 添加镜像导出功能到部署脚本 ([791761e](https://github.com/steveoon/agent-computer-user/commit/791761ef00878fffab2f6585a22c6a802ec0f805))

# [1.8.0-develop.1](https://github.com/steveoon/agent-computer-user/compare/v1.7.0...v1.8.0-develop.1) (2025-09-12)


### Bug Fixes

* 优化截图上传功能，增加重试机制和跨环境兼容性 ([1d1889e](https://github.com/steveoon/agent-computer-user/commit/1d1889ef0ea8f3da80c771d94f239372b675b428))
* 修复zhipin打招呼工具兼容性和类型安全问题 ([3c9f4ae](https://github.com/steveoon/agent-computer-user/commit/3c9f4aebfaea61b4788e362b520940aeae83291f))
* 替换window.confirm为toast确认组件并修复模型ID验证问题 ([fdbda6a](https://github.com/steveoon/agent-computer-user/commit/fdbda6a52e7ade1688efd417a100dfb254320387))
* 添加缺失的 msw 测试依赖 ([596a56e](https://github.com/steveoon/agent-computer-user/commit/596a56eb22f711264138b9be65cf0ff901221c55))


### Features

* 添加配置页面快速入口和导航优化 ([624f5d4](https://github.com/steveoon/agent-computer-user/commit/624f5d40c503b7de928670743ba7489481dc550c))
* 添加镜像导出功能到部署脚本 ([791761e](https://github.com/steveoon/agent-computer-user/commit/791761ef00878fffab2f6585a22c6a802ec0f805))

# [1.7.0](https://github.com/steveoon/agent-computer-user/compare/v1.6.0...v1.7.0) (2025-09-08)

### Bug Fixes

- 更新订单状态枚举值为完整列表 ([63cc6ea](https://github.com/steveoon/agent-computer-user/commit/63cc6ea3bd842626a7c911eef0cfed6775f1dc09))

### Features

- 升级输入组件为多行 Textarea 并增强用户体验 ([7a923b7](https://github.com/steveoon/agent-computer-user/commit/7a923b78db47fbe270aaaa5444775b49b25e66ea))
- 添加 BOSS直聘聊天详情样本数据和品牌选择历史功能 ([5f3a7f9](https://github.com/steveoon/agent-computer-user/commit/5f3a7f98a48a85f9808c607442474be8a3d04155))
- 添加微信号配置管理和修复Yupao交换微信功能 ([8e1d972](https://github.com/steveoon/agent-computer-user/commit/8e1d9728854954d3fbf05b6db54de6f570f09be6))

# [1.7.0-develop.2](https://github.com/steveoon/agent-computer-user/compare/v1.7.0-develop.1...v1.7.0-develop.2) (2025-09-08)

### Features

- 添加微信号配置管理和修复Yupao交换微信功能 ([8e1d972](https://github.com/steveoon/agent-computer-user/commit/8e1d9728854954d3fbf05b6db54de6f570f09be6))

# [1.7.0-develop.1](https://github.com/steveoon/agent-computer-user/compare/v1.6.0...v1.7.0-develop.1) (2025-09-04)

### Bug Fixes

- 更新订单状态枚举值为完整列表 ([63cc6ea](https://github.com/steveoon/agent-computer-user/commit/63cc6ea3bd842626a7c911eef0cfed6775f1dc09))

### Features

- 升级输入组件为多行 Textarea 并增强用户体验 ([7a923b7](https://github.com/steveoon/agent-computer-user/commit/7a923b78db47fbe270aaaa5444775b49b25e66ea))
- 添加 BOSS直聘聊天详情样本数据和品牌选择历史功能 ([5f3a7f9](https://github.com/steveoon/agent-computer-user/commit/5f3a7f98a48a85f9808c607442474be8a3d04155))

# [1.6.0](https://github.com/steveoon/agent-computer-user/compare/v1.5.0...v1.6.0) (2025-09-01)

### Features

- 实现部分成功同步策略及优化同步结果 UI ([bec4095](https://github.com/steveoon/agent-computer-user/commit/bec40953df7948a14af3fb0a007fb8d80afd2b57))

# [1.6.0-develop.1](https://github.com/steveoon/agent-computer-user/compare/v1.5.0...v1.6.0-develop.1) (2025-09-01)

### Features

- 实现部分成功同步策略及优化同步结果 UI ([bec4095](https://github.com/steveoon/agent-computer-user/commit/bec40953df7948a14af3fb0a007fb8d80afd2b57))

# [1.5.0](https://github.com/steveoon/agent-computer-user/compare/v1.4.0...v1.5.0) (2025-08-26)

### Bug Fixes

- resolve Duliday API data validation issues with nullable work days ([135a354](https://github.com/steveoon/agent-computer-user/commit/135a35406a991bc6d04b411513d3faac7090b381))

### Features

- add toggle functionality to StorageDebug component ([498bf3b](https://github.com/steveoon/agent-computer-user/commit/498bf3b66a28196d314e23c95396a0599338f2f5))
- enhance brand display in zhipin-reply-tool ([526bc15](https://github.com/steveoon/agent-computer-user/commit/526bc15ad58993344297905e4da2ffb6f45f0b08))

# [1.5.0-develop.1](https://github.com/steveoon/agent-computer-user/compare/v1.4.0...v1.5.0-develop.1) (2025-08-26)

### Bug Fixes

- resolve Duliday API data validation issues with nullable work days ([135a354](https://github.com/steveoon/agent-computer-user/commit/135a35406a991bc6d04b411513d3faac7090b381))

### Features

- add toggle functionality to StorageDebug component ([498bf3b](https://github.com/steveoon/agent-computer-user/commit/498bf3b66a28196d314e23c95396a0599338f2f5))
- enhance brand display in zhipin-reply-tool ([526bc15](https://github.com/steveoon/agent-computer-user/commit/526bc15ad58993344297905e4da2ffb6f45f0b08))

# [1.4.0](https://github.com/steveoon/agent-computer-user/compare/v1.3.1...v1.4.0) (2025-08-22)

### Bug Fixes

- improve zhipin parsing and add five-insurance constraint ([2159806](https://github.com/steveoon/agent-computer-user/commit/21598069d94f4d2c130214f778df182e003f1860))
- resolve template reference sharing bug and improve toast messages ([85d616d](https://github.com/steveoon/agent-computer-user/commit/85d616d4661d9a86e8810f98afdbddf74b6d72d6))

### Features

- add Boss直聘 candidate list and batch greeting tools ([afe3ba8](https://github.com/steveoon/agent-computer-user/commit/afe3ba8ba159971c0d188a212702cc0545ddfe58))
- add brand template copier for admin settings ([d665534](https://github.com/steveoon/agent-computer-user/commit/d66553435854d5fc2e17e28027a236fad1204483))
- add toast notifications for config operations ([361f261](https://github.com/steveoon/agent-computer-user/commit/361f26124ab078cddc2cf603e9b0631d6319e7fd))
- add WeChat exchange guidance constraint to reply builder ([0fd467e](https://github.com/steveoon/agent-computer-user/commit/0fd467e6b85ee20444dc39fbed79e081e587cdad))
- enhance contact extraction and multi-platform support ([eab7c94](https://github.com/steveoon/agent-computer-user/commit/eab7c94fd59f6717ade5a2dff3a393fc33738f80))
- improve token estimation with js-tiktoken integration ([54af119](https://github.com/steveoon/agent-computer-user/commit/54af1199bc2907707996038b23e053febbd5523b))
- optimize system prompt to enforce zhipin_reply_generator tool usage ([3b8b3be](https://github.com/steveoon/agent-computer-user/commit/3b8b3bed8b26bcf08f25ba0ea2c4f20dc41e01c1))
- refactor E2B desktop initialization and enhance security ([1fe00e8](https://github.com/steveoon/agent-computer-user/commit/1fe00e883349951b3f943e4b4154f06f0e97cbd2))

# [1.4.0-develop.3](https://github.com/steveoon/agent-computer-user/compare/v1.4.0-develop.2...v1.4.0-develop.3) (2025-08-22)

### Bug Fixes

- improve zhipin parsing and add five-insurance constraint ([2159806](https://github.com/steveoon/agent-computer-user/commit/21598069d94f4d2c130214f778df182e003f1860))

### Features

- add WeChat exchange guidance constraint to reply builder ([0fd467e](https://github.com/steveoon/agent-computer-user/commit/0fd467e6b85ee20444dc39fbed79e081e587cdad))

# [1.4.0-develop.2](https://github.com/steveoon/agent-computer-user/compare/v1.4.0-develop.1...v1.4.0-develop.2) (2025-08-20)

### Features

- add Boss直聘 candidate list and batch greeting tools ([afe3ba8](https://github.com/steveoon/agent-computer-user/commit/afe3ba8ba159971c0d188a212702cc0545ddfe58))
- refactor E2B desktop initialization and enhance security ([1fe00e8](https://github.com/steveoon/agent-computer-user/commit/1fe00e883349951b3f943e4b4154f06f0e97cbd2))

# [1.4.0-develop.1](https://github.com/steveoon/agent-computer-user/compare/v1.3.1...v1.4.0-develop.1) (2025-08-19)

### Bug Fixes

- resolve template reference sharing bug and improve toast messages ([85d616d](https://github.com/steveoon/agent-computer-user/commit/85d616d4661d9a86e8810f98afdbddf74b6d72d6))

### Features

- add brand template copier for admin settings ([d665534](https://github.com/steveoon/agent-computer-user/commit/d66553435854d5fc2e17e28027a236fad1204483))
- add toast notifications for config operations ([361f261](https://github.com/steveoon/agent-computer-user/commit/361f26124ab078cddc2cf603e9b0631d6319e7fd))
- enhance contact extraction and multi-platform support ([eab7c94](https://github.com/steveoon/agent-computer-user/commit/eab7c94fd59f6717ade5a2dff3a393fc33738f80))
- improve token estimation with js-tiktoken integration ([54af119](https://github.com/steveoon/agent-computer-user/commit/54af1199bc2907707996038b23e053febbd5523b))
- optimize system prompt to enforce zhipin_reply_generator tool usage ([3b8b3be](https://github.com/steveoon/agent-computer-user/commit/3b8b3bed8b26bcf08f25ba0ea2c4f20dc41e01c1))

## [1.3.1](https://github.com/steveoon/agent-computer-user/compare/v1.3.0...v1.3.1) (2025-08-15)

### Bug Fixes

- 改进配置导入导出的版本管理和数据修复机制 ([448f799](https://github.com/steveoon/agent-computer-user/commit/448f799e28653a91bceb4ba1eb8e16cef21527ab))

## [1.3.1-develop.1](https://github.com/steveoon/agent-computer-user/compare/v1.3.0...v1.3.1-develop.1) (2025-08-15)

### Bug Fixes

- 改进配置导入导出的版本管理和数据修复机制 ([448f799](https://github.com/steveoon/agent-computer-user/commit/448f799e28653a91bceb4ba1eb8e16cef21527ab))

# [1.3.0](https://github.com/steveoon/agent-computer-user/compare/v1.2.3...v1.3.0) (2025-08-13)

### Bug Fixes

- make Claude Code Review intelligent about semantic-release commits ([9b1995c](https://github.com/steveoon/agent-computer-user/commit/9b1995c42e0cd734f0261b83a55a82107c866719))
- 使用strictObject解决空对象验证问题 ([9f5cc85](https://github.com/steveoon/agent-computer-user/commit/9f5cc850c50d5122ca9945ea4ff09a337addd76f))

### Features

- 新增Yupao候选人列表和打招呼工具 ([fcefbfe](https://github.com/steveoon/agent-computer-user/commit/fcefbfe5228a05e984fe97ee0791f7758dfb5b6d))

# [1.3.0-develop.1](https://github.com/steveoon/agent-computer-user/compare/v1.2.3...v1.3.0-develop.1) (2025-08-13)

### Bug Fixes

- make Claude Code Review intelligent about semantic-release commits ([9b1995c](https://github.com/steveoon/agent-computer-user/commit/9b1995c42e0cd734f0261b83a55a82107c866719))
- 使用strictObject解决空对象验证问题 ([9f5cc85](https://github.com/steveoon/agent-computer-user/commit/9f5cc850c50d5122ca9945ea4ff09a337addd76f))

### Features

- 新增Yupao候选人列表和打招呼工具 ([fcefbfe](https://github.com/steveoon/agent-computer-user/commit/fcefbfe5228a05e984fe97ee0791f7758dfb5b6d))

## [1.2.3](https://github.com/steveoon/agent-computer-user/compare/v1.2.2...v1.2.3) (2025-08-13)

### Bug Fixes

- improve semantic-release sync script reliability ([b532507](https://github.com/steveoon/agent-computer-user/commit/b53250717d529f95660f32f7463e85710344e2d3))

## [1.2.3-develop.1](https://github.com/steveoon/agent-computer-user/compare/v1.2.2...v1.2.3-develop.1) (2025-08-13)

### Bug Fixes

- improve semantic-release sync script reliability ([b532507](https://github.com/steveoon/agent-computer-user/commit/b53250717d529f95660f32f7463e85710344e2d3))

## [1.2.2](https://github.com/steveoon/agent-computer-user/compare/v1.2.1...v1.2.2) (2025-08-13)

### Bug Fixes

- handle null return from execSync when using stdio inherit ([b671f94](https://github.com/steveoon/agent-computer-user/commit/b671f9457e55ef05d77c79f39f6782f605ed4170))

## [1.2.2-develop.1](https://github.com/steveoon/agent-computer-user/compare/v1.2.1...v1.2.2-develop.1) (2025-08-12)

### Bug Fixes

- handle null return from execSync when using stdio inherit ([b671f94](https://github.com/steveoon/agent-computer-user/commit/b671f9457e55ef05d77c79f39f6782f605ed4170))

## [1.2.1](https://github.com/steveoon/agent-computer-user/compare/v1.2.0...v1.2.1) (2025-08-12)

### Bug Fixes

- 改进类型安全性和 hydration 处理 ([cbaa456](https://github.com/steveoon/agent-computer-user/commit/cbaa456a17a662cb13f992940c10d4ba9996bc09))

## [1.2.1-develop.1](https://github.com/steveoon/agent-computer-user/compare/v1.2.0...v1.2.1-develop.1) (2025-08-12)

### Bug Fixes

- 改进类型安全性和 hydration 处理 ([cbaa456](https://github.com/steveoon/agent-computer-user/commit/cbaa456a17a662cb13f992940c10d4ba9996bc09))

# [1.2.0](https://github.com/steveoon/agent-computer-user/compare/v1.1.0...v1.2.0) (2025-08-12)

### Features

- 优化 Yupao 工具的 CSS 选择器适配能力 ([13b4d43](https://github.com/steveoon/agent-computer-user/commit/13b4d43376ba6f683147def927659762aff3ddef))
- 升级 AI SDK 到 v5 和 Zod 到 v4 ([bee9212](https://github.com/steveoon/agent-computer-user/commit/bee9212739e7161f4ace4a8f80b44333522c8892))
- 添加 Duliday BI 报表查询建议模板并修复编辑器字段消失问题 ([40a281b](https://github.com/steveoon/agent-computer-user/commit/40a281b59b09f1e1b246b4adea30fe1fc5ed8739))

# [1.2.0-develop.1](https://github.com/steveoon/agent-computer-user/compare/v1.1.0...v1.2.0-develop.1) (2025-08-12)

### Features

- 优化 Yupao 工具的 CSS 选择器适配能力 ([13b4d43](https://github.com/steveoon/agent-computer-user/commit/13b4d43376ba6f683147def927659762aff3ddef))
- 升级 AI SDK 到 v5 和 Zod 到 v4 ([bee9212](https://github.com/steveoon/agent-computer-user/commit/bee9212739e7161f4ace4a8f80b44333522c8892))
- 添加 Duliday BI 报表查询建议模板并修复编辑器字段消失问题 ([40a281b](https://github.com/steveoon/agent-computer-user/commit/40a281b59b09f1e1b246b4adea30fe1fc5ed8739))

# [1.1.0-develop.5](https://github.com/steveoon/agent-computer-user/compare/v1.1.0-develop.4...v1.1.0-develop.5) (2025-08-12)

### Features

- 优化 Yupao 工具的 CSS 选择器适配能力 ([13b4d43](https://github.com/steveoon/agent-computer-user/commit/13b4d43376ba6f683147def927659762aff3ddef))
- 升级 AI SDK 到 v5 和 Zod 到 v4 ([bee9212](https://github.com/steveoon/agent-computer-user/commit/bee9212739e7161f4ace4a8f80b44333522c8892))

# [1.1.0-develop.4](https://github.com/steveoon/agent-computer-user/compare/v1.1.0-develop.3...v1.1.0-develop.4) (2025-08-11)

### Features

- 添加 Duliday BI 报表查询建议模板并修复编辑器字段消失问题 ([40a281b](https://github.com/steveoon/agent-computer-user/commit/40a281b59b09f1e1b246b4adea30fe1fc5ed8739))

# [1.1.0](https://github.com/steveoon/agent-computer-user/compare/v1.0.1...v1.1.0) (2025-08-08)

### Bug Fixes

- 修复 semantic-release 无法推送到受保护分支的问题 ([a60d2de](https://github.com/steveoon/agent-computer-user/commit/a60d2de09f1bf66cb97c82663140c4f0d313f600))
- 修复yupao send-message工具的降级方案问题 ([316093b](https://github.com/steveoon/agent-computer-user/commit/316093b885d15e6bdebc8299a94160b030dc52ca))
- 修复智能回复生成的数组限制问题并优化系统提示词 ([b548ace](https://github.com/steveoon/agent-computer-user/commit/b548ace7f554e2fa44b2372c0f35b797667d30f8))
- 创建通用的 Duliday 错误格式化工具 ([41af4e3](https://github.com/steveoon/agent-computer-user/commit/41af4e32bde535bdf2cfddf6e8274892b8aa611d))

### Features

- 添加 Duliday BI 报表数据获取和刷新工具 ([521f4e9](https://github.com/steveoon/agent-computer-user/commit/521f4e9cd9e681b1042dacccfe5c3d66adb64105))
- 添加 Yupao (鱼泡网) 自动化工具集 ([3c01ee8](https://github.com/steveoon/agent-computer-user/commit/3c01ee83080f8fd09026ae0400743a2d55e3d737))
- 添加 Yupao get-username 工具 ([ec8fb30](https://github.com/steveoon/agent-computer-user/commit/ec8fb30497b1014b4104864fae18b77624a5812a))

# [1.1.0-develop.3](https://github.com/steveoon/agent-computer-user/compare/v1.1.0-develop.2...v1.1.0-develop.3) (2025-08-08)

### Bug Fixes

- 修复 semantic-release 无法推送到受保护分支的问题 ([a60d2de](https://github.com/steveoon/agent-computer-user/commit/a60d2de09f1bf66cb97c82663140c4f0d313f600))

# [1.1.0-develop.2](https://github.com/steveoon/agent-computer-user/compare/v1.1.0-develop.1...v1.1.0-develop.2) (2025-08-08)

### Features

- 添加 Duliday BI 报表数据获取和刷新工具 ([521f4e9](https://github.com/steveoon/agent-computer-user/commit/521f4e9cd9e681b1042dacccfe5c3d66adb64105))

# [1.1.0-develop.1](https://github.com/steveoon/agent-computer-user/compare/v1.0.2-develop.1...v1.1.0-develop.1) (2025-08-06)

### Bug Fixes

- 修复yupao send-message工具的降级方案问题 ([316093b](https://github.com/steveoon/agent-computer-user/commit/316093b885d15e6bdebc8299a94160b030dc52ca))
- 修复智能回复生成的数组限制问题并优化系统提示词 ([b548ace](https://github.com/steveoon/agent-computer-user/commit/b548ace7f554e2fa44b2372c0f35b797667d30f8))

### Features

- 添加 Yupao (鱼泡网) 自动化工具集 ([3c01ee8](https://github.com/steveoon/agent-computer-user/commit/3c01ee83080f8fd09026ae0400743a2d55e3d737))
- 添加 Yupao get-username 工具 ([ec8fb30](https://github.com/steveoon/agent-computer-user/commit/ec8fb30497b1014b4104864fae18b77624a5812a))

## [1.0.2-develop.1](https://github.com/steveoon/agent-computer-user/compare/v1.0.1...v1.0.2-develop.1) (2025-07-28)

### Bug Fixes

- 创建通用的 Duliday 错误格式化工具 ([41af4e3](https://github.com/steveoon/agent-computer-user/commit/41af4e32bde535bdf2cfddf6e8274892b8aa611d))

## [1.0.1](https://github.com/steveoon/agent-computer-user/compare/v1.0.0...v1.0.1) (2025-07-28)

### Bug Fixes

- use pinned GitHub Actions versions for security ([6d5a4b0](https://github.com/steveoon/agent-computer-user/commit/6d5a4b070fbd059ce16e0722c3f70bce642b991b))

# 1.0.0 (2025-07-28)

### Bug Fixes

- add input history recording for prompt suggestions ([93feef3](https://github.com/steveoon/agent-computer-user/commit/93feef3cdfc2ad70740bd5953cc398fcf40f40b3))
- correct district filtering condition to use brand-specific store count ([0e8e02e](https://github.com/steveoon/agent-computer-user/commit/0e8e02eb1626552065f62b55177c04b5085fd0a8))
- Eslint校验和修复所有类型问题 ([2a0b4ff](https://github.com/steveoon/agent-computer-user/commit/2a0b4ffc30c60defd82d999e9ce2a0d5968c4a9f))
- hide Storage debug info ([e83fa98](https://github.com/steveoon/agent-computer-user/commit/e83fa985d896fccc6124c27154a3904e63aa47b5))
- model provider method updated ([1252e5a](https://github.com/steveoon/agent-computer-user/commit/1252e5a4b62725d4736a4b0ff39c8c642dd2bde2))
- pause-desktop类型不匹配问题 ([e1bbe35](https://github.com/steveoon/agent-computer-user/commit/e1bbe35516a93b6f9449cd25e4160eb8ed6f89d0))
- remove config dev in next config setting ([4aece4c](https://github.com/steveoon/agent-computer-user/commit/4aece4cb66f6d3be3319d72aeaae3ae620aa67bf))
- resolve Next.js Image component errors and implement responsive images ([7008d52](https://github.com/steveoon/agent-computer-user/commit/7008d52a079f9b64c4be515c094a85eeb04c208e))
- scroll-to-buttom函数的逻辑问题修正 ([a460244](https://github.com/steveoon/agent-computer-user/commit/a460244df876ce96fceb3bf6a9b0d35d7e5570e1))
- 优化image压缩的参数控制 ([dba6211](https://github.com/steveoon/agent-computer-user/commit/dba621190a10a5aad656fd97edd14c5b1078a13f))
- 优化Vercel部署的请求限制问题 ([8f65329](https://github.com/steveoon/agent-computer-user/commit/8f6532927a4cfd636b7cd425e600d1617c6f795d))
- 优化回复的提示词 ([c37776b](https://github.com/steveoon/agent-computer-user/commit/c37776bfd2b970add3a953b5d2ad78f64a276f82))
- 优化岗位推送工具的品牌选择逻辑 ([e5bb7f1](https://github.com/steveoon/agent-computer-user/commit/e5bb7f14f3a82a438668c1f1ccd6760511df7ffe))
- 优化提示词并添加飞书通知 ([0461ffc](https://github.com/steveoon/agent-computer-user/commit/0461ffcd8f9f22e4e6083529a06e59d4f5777664))
- 优化智能清理逻辑，解决聊天中断问题 ([41c0ae9](https://github.com/steveoon/agent-computer-user/commit/41c0ae9f5443f8b879aa850192f1b5bf215c03e8))
- 优化模型配置和消息过多的错误处理机制 ([a60deff](https://github.com/steveoon/agent-computer-user/commit/a60deff3e15da0eae3f67d3636b5ae16ab79dc14))
- 优化沙盒初始化类型问题 ([3e3c78d](https://github.com/steveoon/agent-computer-user/commit/3e3c78d2265de88594392cd512e3ef107f0d43d2))
- 修复 BOSS直聘交换微信功能的确认按钮选择器问题 ([37cc28d](https://github.com/steveoon/agent-computer-user/commit/37cc28d5b71b5bc6089540f9d3b8f8d9fded6f90))
- 修复 Claude Code CLI 调用方式 ([776ba3e](https://github.com/steveoon/agent-computer-user/commit/776ba3ec34a73a3bfe80b4774e8bf8232aa7f140))
- 修复 Duliday API 响应中可空字段的 Zod 验证错误 ([c096fe1](https://github.com/steveoon/agent-computer-user/commit/c096fe1d1d0ca85ef91d3ea0964edaf5df87fd0c))
- 修复 Duliday 工具的 TypeScript 类型错误 ([14481f9](https://github.com/steveoon/agent-computer-user/commit/14481f95b355231fea3c25f24ecb930eaf9ff35f))
- 修复 ESLint 错误 ([3a0151a](https://github.com/steveoon/agent-computer-user/commit/3a0151a8526f9fec292d1a8d853a18afd8269723))
- 修复 ESLint 错误以通过构建检查 ([9447b15](https://github.com/steveoon/agent-computer-user/commit/9447b15fe1834fb1f1f6194b7c4956ab5e195286))
- 修复 generate_zhipin_reply 工具的 conversation_history 参数类型错误 ([7dfefe6](https://github.com/steveoon/agent-computer-user/commit/7dfefe6e5d3035a130db6a9eeede5ec93cfd0ef2))
- 修复 mergeAndSaveSyncData 函数的 TypeScript 类型错误 ([9b3a4bd](https://github.com/steveoon/agent-computer-user/commit/9b3a4bd211ce0947687ef50a2b9ebe7a7006e31b))
- 修复any类型问题 ([7541f3d](https://github.com/steveoon/agent-computer-user/commit/7541f3df35ca71a0613ce91b2abd4743af5f1687))
- 修复ESLint类型错误和代码质量问题 ([dfed2c7](https://github.com/steveoon/agent-computer-user/commit/dfed2c71618285da7fa84105e3ce73c95609b5f1))
- 修复sandbox还不支持暂停和回复的功能 ([91c6f0b](https://github.com/steveoon/agent-computer-user/commit/91c6f0bf07479721e2f2532333efd4cf28bcc1bd))
- 修复图像压缩算法类型问题 ([2f23c83](https://github.com/steveoon/agent-computer-user/commit/2f23c83f8c1810cad3fe6b07f1e4cc9e12f88e7a))
- 修复工具调用时生成回复不能按配置的LLM请求 ([d98fc46](https://github.com/steveoon/agent-computer-user/commit/d98fc464f5317b357dd417130c5ab30b006b8154))
- 修复沙盒初始化错误的问题 ([749b8fa](https://github.com/steveoon/agent-computer-user/commit/749b8fa35c70af7a5e6ded0c64dd561becbc8453))
- 修复没有品牌时的数据获取问题以及next配置 ([5478398](https://github.com/steveoon/agent-computer-user/commit/547839828021b171d0f2fb533c0222c28fe8505a))
- 修复浏览器环境 CSP 错误，改用 API 路由同步品牌 ([d3ab1b7](https://github.com/steveoon/agent-computer-user/commit/d3ab1b7c792244fceaad30c1671dee9c47fa56f9))
- 修复环境变量名称不一致导致的 Supabase 连接问题 ([6272a7a](https://github.com/steveoon/agent-computer-user/commit/6272a7a826417f23afc82cbcc61c873687e6e70a))
- 修复类型错误 ([de3d713](https://github.com/steveoon/agent-computer-user/commit/de3d7137f7ea26286078098686da91e5ff7ffe97))
- 修复类型错误 ([e3098cf](https://github.com/steveoon/agent-computer-user/commit/e3098cff5ef2ed988f2eae5d436d6cdb961d1639))
- 修复部署错误 ([a9f441f](https://github.com/steveoon/agent-computer-user/commit/a9f441fc60f5d10b3bb1fac670e5ce208cc0dd02))
- 修改Input提示和建议指令 ([7037ba6](https://github.com/steveoon/agent-computer-user/commit/7037ba699a14d2007a1ad7f9b6dc1d538bcc82b6))
- 修改元数据的介绍 ([b29b44b](https://github.com/steveoon/agent-computer-user/commit/b29b44b61fdc1903511ef0c8e9b5dc174e7bbdf8))
- 修改本地浏览器像素大小 ([628c13c](https://github.com/steveoon/agent-computer-user/commit/628c13cdb3cde0d9cb419360511776c11badb441))
- 修改模型 ([2a67e25](https://github.com/steveoon/agent-computer-user/commit/2a67e25699628e25a4ee02e68675732821f7e0d9))
- 修改模型 ([1ef83d9](https://github.com/steveoon/agent-computer-user/commit/1ef83d9317ce2fa9ddb26a83fde58fb8448af717))
- 压缩图片节省tokens ([0e0b901](https://github.com/steveoon/agent-computer-user/commit/0e0b901d71b8b8fefb8016ccb55118a0f89788a6))
- 扩展岗位类型枚举以支持更多岗位 ([273793b](https://github.com/steveoon/agent-computer-user/commit/273793b714fcdf99c713c07d039a062544db12c4))
- 改进 Supabase fetch failed 错误诊断和处理 ([6d07468](https://github.com/steveoon/agent-computer-user/commit/6d07468127048cc0fd9b73ef60e01910a87b7a10))
- 无法启动E2b因为tiktoken依赖在Serverless环境的问题 ([e9f1f2c](https://github.com/steveoon/agent-computer-user/commit/e9f1f2c80f421287c7c28b010de5ad3d9040d4e9))
- 智能回复不能随配置的品牌变更 ([601043d](https://github.com/steveoon/agent-computer-user/commit/601043d070f136e1d4e6bd64f3bf7cf0e409a51a))
- 智能回复降级后的分类问题优化 ([7dbfa83](https://github.com/steveoon/agent-computer-user/commit/7dbfa83d8cc76d36808b72eda4d558aaf3d33c5f))
- 替换tiktoken为js-tiktoken ([70fc9c0](https://github.com/steveoon/agent-computer-user/commit/70fc9c0a7dee0b5e53b75bba58d3c11378c17cc4))
- 模型配置页面添加保护 ([fbaac53](https://github.com/steveoon/agent-computer-user/commit/fbaac53c40c67fbcd683e9810dff5f64beb1a127))
- 添加通知飞书的能力并修复一下问题 ([3f16abd](https://github.com/steveoon/agent-computer-user/commit/3f16abd78aa972aaf45e0d7e202b6780b02f319a))
- 移除env exapmple不需要的变量 ([6014ac4](https://github.com/steveoon/agent-computer-user/commit/6014ac41b66bff51f389f395e5c05369c4938abe))
- 移除不必要的环境变量 ([c61abf9](https://github.com/steveoon/agent-computer-user/commit/c61abf902052d2f43bd076de02bb1b3f0d536ac3))
- 移除导致 Node.js 18+ fetch 错误的 keep-alive headers ([a63ec93](https://github.com/steveoon/agent-computer-user/commit/a63ec933d5f69c3c54b505f288cbea2d99e28dd0))
- 移除用于敏感信息的context ([9bc500e](https://github.com/steveoon/agent-computer-user/commit/9bc500e635ea90a3357f4102a436f61bf114c50f))
- 部署状态的判断修改 ([fb88908](https://github.com/steveoon/agent-computer-user/commit/fb88908a868395969bbb5c86a4481edacaafb5fc))
- 重构page页面使结构更清晰 ([d0039aa](https://github.com/steveoon/agent-computer-user/commit/d0039aa8df5cf5e2fd1dcdcf0132bb89a5c93528))

### Features

- add input history navigation with keyboard arrows ([772bc41](https://github.com/steveoon/agent-computer-user/commit/772bc4130575828cd3cb86356d859b463fb8ea5a))
- add semantic release integration ([dad2f46](https://github.com/steveoon/agent-computer-user/commit/dad2f46fc29f7d75966bc787b32d4e0bbb29c301))
- enhance data mapping with fallback logic and improved district mapping ([91f74a0](https://github.com/steveoon/agent-computer-user/commit/91f74a0baa27df3d8e3bd748a848af423529e5ba))
- 为 Duliday 面试预约工具添加单元测试 ([8d8031c](https://github.com/steveoon/agent-computer-user/commit/8d8031c78e80b03fef1f9c41dbbd030bc17e7181))
- 为门店配置列表添加搜索和分页功能 ([bff00eb](https://github.com/steveoon/agent-computer-user/commit/bff00eb4b393728e6f9e695eed83ecdcaad22fe6))
- 优化 get-chat-details.tool.ts 反机器人检测能力 ([8840d9f](https://github.com/steveoon/agent-computer-user/commit/8840d9fe354f4c0552c5c0c05bfbc2f72f9f4458))
- 优化BOSS直聘工具反机器人检测能力 ([729afcc](https://github.com/steveoon/agent-computer-user/commit/729afcce5ae0183777d6178c11fc9958d5455d3c))
- 优化中文输入的速度 ([af13875](https://github.com/steveoon/agent-computer-user/commit/af138758e1679b5e847debdfb379c8e0c5c28912))
- 优化品牌数据编辑器并集成Zustand状态管理 ([82a740d](https://github.com/steveoon/agent-computer-user/commit/82a740d11b0daa849334260f51129545081f0346))
- 优化图片压缩函数和E2B工具 - 重构image-optimized.ts：实现智能二分查找压缩算法 - 添加自适应压缩策略，提升LLM截图处理效率 - 新增图像特征分析器，针对不同图像类型优化 - 改进E2B工具函数，增强稳定性 - 添加Cursor规则配置文件 ([8727ffb](https://github.com/steveoon/agent-computer-user/commit/8727ffb67bc2631b8b7b0e972aa5bbb023bd319e))
- 优化招聘回复系统 - 动态年龄处理与返回类型增强 ([4c531b1](https://github.com/steveoon/agent-computer-user/commit/4c531b1c45bca1eb10a59ebeac2cc5718679c1d9))
- 优化提示词和添加中文输入的速度以及一些快捷键BUG ([ac15cd7](https://github.com/steveoon/agent-computer-user/commit/ac15cd71cf1661571121f3c744483338d8cd083d))
- 优化配置管理和品牌持久化系统 - 重构配置管理hooks和服务，提升稳定性 - 优化品牌存储和数据迁移功能 - 改进智联招聘数据加载器和类型定义 - 完善管理员界面和提示编辑器 - 新增考勤排期增强文档 - 重构配置类型定义文件结构 ([bbd291e](https://github.com/steveoon/agent-computer-user/commit/bbd291ee94fdfe452892915e6cd56f764eb553bb))
- 全面优化 BOSS 直聘工具反机器人检测能力 ([a24eca3](https://github.com/steveoon/agent-computer-user/commit/a24eca3787cc14a9ed7c4f64faf0de8412109fac))
- 创建完整的 BOSS直聘自动化工具套件 ([c71f001](https://github.com/steveoon/agent-computer-user/commit/c71f001b37c7e83e47945593ca29701430d8c455))
- 增加登录认证功能 ([0384d52](https://github.com/steveoon/agent-computer-user/commit/0384d52b8f4e717e5a8536b6a6aaa62c5b726783))
- 增强错误处理和Duliday工具功能 ([8640b99](https://github.com/steveoon/agent-computer-user/commit/8640b99d4748ad585d294d5682bba03d156ac892))
- 完善 Docker 部署方案和环境变量管理 ([35c922a](https://github.com/steveoon/agent-computer-user/commit/35c922ade766508aae763a226cc1d74f942cc8d1))
- 完善 Docker 部署配置和网络性能优化 ([3a80693](https://github.com/steveoon/agent-computer-user/commit/3a80693591a2dc4127a59e7e2dfad6d1c739d4fa))
- 完善系统提示词管理和配置服务 ([96e1484](https://github.com/steveoon/agent-computer-user/commit/96e148413a1168a167e5b906e724cfb835a1215e))
- 实现 Duliday API 数据同步系统 ([f5f37b5](https://github.com/steveoon/agent-computer-user/commit/f5f37b5308bda54f952ea373937008ecad5c174d))
- 实现基于系统提示词的工具过滤系统 ([2aaee7a](https://github.com/steveoon/agent-computer-user/commit/2aaee7a21aef30dbc050b9aed800422969c9d663))
- 将tiktoken移至服务端，解决Vercel部署WASM问题 ([4d6738c](https://github.com/steveoon/agent-computer-user/commit/4d6738cd07d82f5bc1fb4449f2ac307f18a0e8b3))
- 引入结构化数据模型和完善 API 映射关系 ([8568052](https://github.com/steveoon/agent-computer-user/commit/8568052a73fe367309cadf327eac47e78da8bc7f))
- 支持导入配置包含额外品牌，完善品牌同步和导入逻辑 ([9a520dd](https://github.com/steveoon/agent-computer-user/commit/9a520dd7eee89e06de1b439aaf267b27a489c087))
- 改进智能回复分类系统和测试页面 ([3bcc579](https://github.com/steveoon/agent-computer-user/commit/3bcc57963c037e503ae80cc00f8f075f98985b28))
- 改进本地 bash 命令执行的安全性和用户体验 ([ea28de9](https://github.com/steveoon/agent-computer-user/commit/ea28de92a01cafca8bec4b727a89483338fc5d29))
- 新增可自主选择品牌的功能并修复messages过多时导致的错误 ([32594a2](https://github.com/steveoon/agent-computer-user/commit/32594a2ead247db18cf3cacb67fab5dc7c1cf864))
- 新增门店排班管理系统并优化数据同步机制 ([57c2e0f](https://github.com/steveoon/agent-computer-user/commit/57c2e0f301d47af3d7eb30716a92bc54dad7ea21))
- 添加 AI SDK 测试基础设施和实践 ([295da92](https://github.com/steveoon/agent-computer-user/commit/295da9240fb9f35cd216378b897779f301d9df5d))
- 添加 Claude Code Review GitHub Actions 集成 ([498639e](https://github.com/steveoon/agent-computer-user/commit/498639e4a30087a9d134e66e20f5521f453216d3))
- 添加 Duliday 面试预约工具集 ([194b27a](https://github.com/steveoon/agent-computer-user/commit/194b27ae670d70ca00cf1662b99c3bf2481b8dcc))
- 添加 Puppeteer MCP 工具集成与视觉组件 ([8399786](https://github.com/steveoon/agent-computer-user/commit/839978620000b4abbea1ae097c0a6627fabf1f33))
- 添加 Vitest 测试框架支持 ([9348ce6](https://github.com/steveoon/agent-computer-user/commit/9348ce648e40b1203467d95f362e372a79614d49))
- 添加E2B环境诊断功能和工具 - 新增E2B诊断API和诊断按钮组件 - 实现全面的E2B环境测试功能（截图、鼠标、键盘、命令执行） - 添加沙盒状态和暂停桌面API - 优化E2B工具函数和缓存管理 - 添加模型注册表功能 - 更新相关依赖和配置 ([9b52393](https://github.com/steveoon/agent-computer-user/commit/9b52393fbcb9166a64de2d7fdd36ad1daf1cce11))
- 添加中文输入支持和字体优化功能 - 新增中文输入指南文档 - 添加字体包管理功能 - 优化输入组件和提示建议 - 改进E2B工具和API路由 - 提升中文字符显示和输入体验 ([2bd0e9e](https://github.com/steveoon/agent-computer-user/commit/2bd0e9ec7eca8ab590f18ab9fd150148bbd7053b))
- 添加信息模型配置页面和动态模型参数配置 ([3ca0e35](https://github.com/steveoon/agent-computer-user/commit/3ca0e352b4df755dd37b327457fb82d5d8e94681))
- 添加智联招聘智能回复系统和工具优化 - 新增智联招聘数据加载器和类型定义 - 实现智能回复API和测试页面 - 添加VSCode调试配置和操作指南文档 - 优化E2B工具和图像压缩函数 - 改进token优化和模型注册功能 - 更新依赖包和配置文件 ([490581c](https://github.com/steveoon/agent-computer-user/commit/490581c369d937c04067b57c9f362737714c784f))
- 添加智联招聘自动化工具集成 ([0f1f043](https://github.com/steveoon/agent-computer-user/commit/0f1f0437e1b458ac805c1ed373e988056705c137))
- 添加灵活的提示词模板编辑器 ([484f203](https://github.com/steveoon/agent-computer-user/commit/484f203880a7afcdc5086d736abae2fa3b758981))
- 添加获取BOSS直聘用户名工具并修复OpenRouter Kimi K2兼容性问题 ([0df04d6](https://github.com/steveoon/agent-computer-user/commit/0df04d6e2c0558ab98ac2ea67d66aad9825fd1bc))
- 让 ORGANIZATION_MAPPING 成为品牌数据的唯一数据源 ([f034f42](https://github.com/steveoon/agent-computer-user/commit/f034f421296cf27c6d13a60e4290bf973f90432a))

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Semantic Release integration for automated versioning and changelog generation
- GitHub Actions workflow for continuous integration and release
- Automated changelog generation based on conventional commits

### Changed

- Updated package.json with semantic-release scripts

### Security

- Added proper permission controls in GitHub Actions workflow
