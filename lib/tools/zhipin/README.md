# Zhipin Automation Tools

基于 AI SDK + Puppeteer MCP 的 BOSS直聘自动化工具集，包含反检测机制。

## 📁 文件结构

```
lib/tools/zhipin/
├── README.md                               # 使用说明文档
├── index.ts                                # 工具导出文件
├── types.ts                                # TypeScript 类型定义
├── constants.ts                            # 选择器常量
├── helpers.ts                              # 辅助函数
├── anti-detection-utils.ts                 # 反检测工具函数
├── get-unread-candidates-improved.tool.ts  # 获取未读候选人列表（改进版）
├── open-candidate-chat-improved.tool.ts    # 打开候选人聊天窗口（改进版）
├── get-chat-details.tool.ts                # 获取聊天详情
├── send-message.tool.ts                    # 发送消息
├── exchange-wechat.tool.ts                 # 交换微信号
└── zhipin-get-username.ts                  # 获取当前登录用户名
```

## 🔧 工具概览

| 工具名称 | 功能描述 | 主要特性 |
|---------|----------|---------|
| **getUnreadCandidatesImproved** | 获取未读候选人列表的改进版 | 精确选择器、未读状态检测、过滤排序、反检测机制 |
| **openCandidateChatImproved** | 打开指定候选人聊天窗口 | 支持按姓名/索引查找、自动检测未读徽章、返回详细信息 |
| **getChatDetails** | 获取候选人信息和聊天记录 | 提取候选人基本信息、完整聊天历史、自动识别发送者 |
| **sendMessage** | 发送消息到聊天窗口 | 自动查找输入框、支持多行消息、验证发送状态 |
| **exchangeWechat** | 交换微信号功能 | 自动点击换微信按钮、处理确认对话框、完成交换流程 |
| **getUsername** | 获取当前登录用户名 | 从页面提取当前登录账号信息 |

## 🛡️ 反检测机制

### 核心功能
- **人性化延迟**: 模拟真实用户操作节奏，包含随机停顿
- **脚本混淆**: 包装执行脚本以规避检测
- **分批处理**: 大量数据分批处理，避免一次性加载
- **随机滚动**: 模拟用户自然滚动行为
- **操作间隔**: 在操作之间添加随机延迟

### 使用的反检测工具
```typescript
import { 
  randomDelay,           // 生成随机延迟
  humanDelay,           // 人性化延迟
  wrapAntiDetectionScript,  // 脚本包装
  generateBatchProcessingScript,  // 分批处理
  performRandomScroll,  // 随机滚动
  performInitialScrollPattern  // 初始滚动模式
} from "./anti-detection-utils";
```

## 📋 类型定义

### UnreadCandidate
```typescript
export interface UnreadCandidate {
  name: string;
  time?: string;
  preview?: string;
  lastMessage?: string;
  unreadCount: number;
  hasUnread: boolean;
  index: number;
  clickTarget?: {
    x: number;
    y: number;
  };
}
```

### CandidateInfo (使用 Zod Schema)
```typescript
export const CandidateInfoSchema = z.object({
  name: z.string().optional(),
  position: z.string().optional(),
  age: z.string().optional(),
  experience: z.string().optional(),
  education: z.string().optional(),
  info: z.array(z.string()).optional(),
  fullText: z.string().optional()
});
```

### ChatMsg
```typescript
export interface ChatMsg {
  sender: 'user' | 'candidate';
  message: string;
  timestamp?: string;
  isSystemMessage?: boolean;
}
```

### Conversation
```typescript
export interface Conversation {
  candidateName: string;
  messages: ChatMsg[];
  lastMessageTime?: string;
  unreadCount?: number;
  candidateDetail?: CandidateDetail;
}
```

## 🚀 使用示例

### 1. 获取未读候选人列表（改进版）

```typescript
import { zhipinTools } from '@/lib/tools/zhipin';

// 获取未读候选人，支持过滤和排序
const result = await zhipinTools.getUnreadCandidatesImproved.execute({
  max: 10,              // 最多返回10个
  onlyUnread: true,     // 只返回有未读消息的
  sortBy: 'unreadCount' // 按未读数量排序
});

console.log(result.candidates);
```

### 2. 打开候选人聊天（改进版）

```typescript
// 按姓名打开
const result = await zhipinTools.openCandidateChatImproved.execute({
  candidateName: "张三"
});

// 或按索引打开
const result = await zhipinTools.openCandidateChatImproved.execute({
  index: 0  // 打开第一个候选人
});
```

### 3. 获取聊天详情

```typescript
const details = await zhipinTools.getChatDetails.execute({
  includeMessages: true,
  messageLimit: 50
});

console.log('候选人信息:', details.candidateInfo);
console.log('聊天记录:', details.messages);
```

### 4. 发送消息

```typescript
const result = await zhipinTools.sendMessage.execute({
  message: "您好，很高兴认识您！\n请问您对我们的职位感兴趣吗？",
  pressEnter: true  // 自动按回车发送
});
```

### 5. 交换微信

```typescript
const result = await zhipinTools.exchangeWechat.execute({
  waitForConfirm: true  // 等待确认对话框
});

if (result.success) {
  console.log('微信交换成功');
}
```

### 6. 获取当前用户名

```typescript
const result = await zhipinTools.getUsername.execute({});
console.log('当前登录用户:', result.username);
```

## 🔍 工具特性

### 1. 改进的选择器策略
- 使用更精确的选择器查找元素
- 多重备选方案防止选择器失效
- 支持自定义选择器覆盖

### 2. 反检测措施
- 人性化的操作延迟
- 随机滚动和鼠标移动
- 分批处理大量数据
- 混淆的日志输出

### 3. 错误处理
- 完善的错误捕获机制
- 详细的错误信息反馈
- 自动重试逻辑
- 优雅的降级处理

### 4. 性能优化
- 批量操作时的智能延迟
- 资源自动清理
- 内存使用优化
- 并发控制

## 📝 注意事项

1. **登录状态**: 使用前确保已登录 BOSS直聘
2. **页面准备**: 大部分工具需要在聊天列表页面使用
3. **网络稳定**: 建议在网络稳定的环境下使用
4. **频率控制**: 避免过于频繁的操作，使用提供的延迟函数
5. **反检测**: 使用工具时会自动应用反检测措施

## 🔧 配置项

### 选择器配置（constants.ts）
```typescript
export const SELECTORS = {
  CHAT_LIST: {
    CONTAINER: '.chat-list, .message-list',
    ITEM: '.chat-item, .message-item',
    NAME: '.name, .geek-name',
    UNREAD_BADGE: '.badge, .unread-count',
    // ... 更多选择器
  }
};
```

### 时间配置
```typescript
export const DELAYS = {
  FAST: { min: 300, max: 500 },
  NORMAL: { min: 500, max: 1000 },
  SLOW: { min: 1000, max: 2000 },
  HUMAN: { min: 800, max: 3000 }
};
```

## 🤝 扩展开发

要添加新的工具，请遵循以下步骤：

1. 在 `types.ts` 中定义相关类型（使用 Zod Schema）
2. 在 `constants.ts` 中添加必要的选择器
3. 创建工具文件，使用 anti-detection-utils 中的函数
4. 在 `index.ts` 中导出新工具
5. 更新此 README 文档

### 工具模板
```typescript
import { tool } from "ai";
import { z } from "zod";
import { getPuppeteerMCPClient } from "@/lib/mcp/client-manager";
import { humanDelay, wrapAntiDetectionScript } from "./anti-detection-utils";

export const newZhipinTool = tool({
  description: "工具描述",
  parameters: z.object({
    // 参数定义
  }),
  execute: async (params) => {
    const client = await getPuppeteerMCPClient();
    
    // 添加人性化延迟
    await humanDelay();
    
    // 使用反检测包装脚本
    const script = wrapAntiDetectionScript(`
      // 你的脚本逻辑
    `);
    
    // 执行并返回结果
  }
});
```

## 📈 版本历史

- **v2.0.0**: 重构版本，添加反检测机制
  - 所有工具升级为"改进版"
  - 添加 anti-detection-utils 模块
  - 优化选择器策略
  - 改进错误处理

- **v1.0.0**: 初始版本
  - 基础的候选人管理功能
  - 简单的消息发送功能

---

*本工具集专为 BOSS直聘平台优化，包含完善的反检测机制，支持中文内容处理和复杂的 DOM 结构解析。*