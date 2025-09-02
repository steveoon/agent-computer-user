# 工具过滤指南

## 概述

工具过滤系统根据当前激活的系统提示词自动过滤可用的工具集，避免 LLM 在不合适的场景下调用错误的工具。

## 工具分组

### 1. 通用工具（所有场景可用）

- `bash` - 命令行执行
  - E2B 模式：在沙箱环境中安全执行
  - 本地模式：在本地系统执行（开发环境显示警告，生产环境禁用）
- `feishu` - 飞书通知
- `wechat` - 微信通知

### 2. E2B 桌面自动化工具

- `computer` - 桌面控制（截图、点击、输入等）

### 3. Boss 直聘业务工具

- `job_posting_generator` - 生成招聘信息
- `zhipin_reply_generator` - 生成智能回复

### 4. Puppeteer 浏览器自动化工具

- `puppeteer` - 浏览器自动化
- `zhipin_get_unread_candidates_improved` - 获取未读候选人
- `zhipin_open_candidate_chat_improved` - 打开候选人聊天
- `zhipin_send_message` - 发送消息
- `zhipin_get_chat_details` - 获取聊天详情
- `zhipin_exchange_wechat` - 交换微信

## 系统提示词与工具映射

### bossZhipinSystemPrompt（Boss 直聘 E2B 版）

可用工具：

- ✅ 通用工具（bash, feishu, wechat）
- ✅ E2B 工具（computer）
- ✅ Boss 直聘业务工具（job_posting_generator, zhipin_reply_generator）
- ❌ Puppeteer 相关工具

### bossZhipinLocalSystemPrompt（Boss 直聘本地版）

可用工具：

- ✅ 通用工具（bash, feishu, wechat）
- ✅ Boss 直聘业务工具（job_posting_generator, zhipin_reply_generator）
- ✅ Puppeteer 及所有 zhipin\_\* 工具
- ❌ E2B 工具（computer）

### generalComputerSystemPrompt（通用计算机使用）

可用工具：

- ✅ 通用工具（bash, feishu, wechat）
- ✅ E2B 工具（computer）
- ✅ Puppeteer 工具
- ❌ Boss 直聘相关工具

## 验证方法

### 1. 控制台日志

工具过滤器会在控制台输出过滤结果：

```
🔧 工具过滤: bossZhipinSystemPrompt - 从 13 个工具过滤为 6 个工具
✅ 可用工具: bash, feishu, wechat, computer, job_posting_generator, zhipin_reply_generator
```

### 2. 在不同场景下测试

1. **Boss 直聘 E2B 模式**：
   - 设置系统提示词为 `bossZhipinSystemPrompt`
   - 验证只能使用 E2B computer 工具，无法使用 puppeteer 工具

2. **Boss 直聘本地模式**：
   - 设置系统提示词为 `bossZhipinLocalSystemPrompt`
   - 验证只能使用 puppeteer 工具，无法使用 computer 工具

3. **通用模式**：
   - 设置系统提示词为 `generalComputerSystemPrompt`
   - 验证无法使用任何 Boss 直聘相关工具

### 3. 添加新工具

如需添加新工具，请更新 `/lib/tools/tool-filter.ts` 中的：

1. `TOOL_GROUPS` - 添加工具到相应分组
2. `PROMPT_TOOL_MAPPING` - 更新系统提示词映射

## 安全说明

### Bash 工具安全机制

1. **E2B 沙箱模式**（有 sandboxId）：
   - 命令在隔离的沙箱环境中执行
   - 不会影响本地系统
   - 自动执行并返回结果

2. **本地执行模式**（无 sandboxId）：
   - **生产环境**：自动禁用，返回错误提示
   - **开发环境**：
     - 返回命令预览界面
     - 提供复制按钮方便用户手动执行
     - 禁止执行危险命令（如 rm -rf /）
     - 显示安全警告和执行指南
     - 用户需手动在终端中执行命令

## 故障排除

1. **工具未被过滤**：检查工具名称是否与过滤器中定义的完全匹配
2. **新工具未显示**：确保已在 `tool-filter.ts` 中添加映射
3. **意外的工具可用**：检查是否使用了正确的系统提示词
4. **本地 bash 命令失败**：
   - 检查是否在生产环境（会被禁用）
   - 查看控制台输出的警告信息
   - 确认命令不在危险命令列表中
