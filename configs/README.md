# Multi-Agent 配置目录

本目录包含多 Agent 管理系统的配置文件。

## 📁 文件说明

- **agents.json** - Agent 实例配置（自动管理，不要手动编辑）
- **agent-templates.json** - Agent 类型模板（zhipin、yupao）

## 🚀 快速开始

```bash
# 添加 Agent
pnpm agent:add zhipin --count 3    # 添加 3 个 BOSS直聘 Agent
pnpm agent:add yupao --count 2     # 添加 2 个鱼泡网 Agent

# 管理 Agent
pnpm agent:list                    # 查看列表
pnpm agent:start                   # 启动全部
pnpm agent:stop zhipin-1           # 停止指定

# 查看状态和日志
pnpm agent:status
pnpm agent:logs zhipin-1           # 查看 app 日志
pnpm agent:logs zhipin-1 chrome    # 查看 Chrome 日志
```

**完整文档：** [docs/guides/MULTI_AGENT_GUIDE.md](../docs/guides/MULTI_AGENT_GUIDE.md)

## ⚙️ 自定义配置

编辑 `agent-templates.json` 自定义 Chrome 参数：

```json
{
  "templates": {
    "zhipin": {
      "chromeArgs": [
        "--window-size=1920,1080",
        "--disable-blink-features=AutomationControlled"
      ]
    }
  }
}
```
