# Yupao Automation Tools

基于 AI SDK + Puppeteer MCP 的 Yupao (yupao.com) 自动化工具集，专注于招聘消息管理。

## 📁 文件结构

```
lib/tools/yupao/
├── README.md                    # 使用说明文档
├── index.ts                     # 工具导出文件
├── types.ts                     # TypeScript 类型定义
├── constants.ts                 # 选择器常量
├── get-unread-messages.tool.ts  # 获取未读消息列表
├── open-candidate-chat.tool.ts  # 打开候选人聊天窗口
├── get-chat-details.tool.ts     # 获取聊天详情
├── send-message.tool.ts         # 发送消息
├── exchange-wechat.tool.ts      # 交换微信
└── get-username.tool.ts         # 获取用户名
```

## 🔧 工具概览

| 工具名称 | 功能描述 | 主要特性 |
|---------|----------|---------|
| **getUnreadMessages** | 获取未读消息候选人列表 | 精确选择器、未读状态检测、消息状态标签识别、过滤排序 |
| **openCandidateChat** | 打开指定候选人聊天窗口 | 支持按姓名/索引查找、自动检测未读状态、鼠标轨迹模拟、防检测机制 |
| **getChatDetails** | 获取聊天详情和候选人信息 | 提取岗位信息、完整聊天记录、自动识别发送者、返回格式与zhipin一致 |
| **sendMessage** | 发送消息到聊天窗口 | 支持fb-editor输入、自动清空输入框、多行消息、发送验证 |
| **exchangeWechat** | 交换微信号 | 两步操作：点击换微信按钮、确认对话框、反检测延迟 |
| **getUsername** | 获取当前登录用户名 | 多选择器查找、返回格式与zhipin一致、包含验证逻辑 |

## 🛡️ 反检测机制

本工具集复用了 zhipin 工具的反检测机制：
- **人性化延迟**: 模拟真实用户操作节奏
- **脚本混淆**: 包装执行脚本以规避检测
- **分批处理**: 大量数据分批处理，避免一次性加载
- **随机滚动**: 模拟用户自然滚动行为

## 📋 类型定义

### YupaoUnreadCandidate
```typescript
export interface YupaoUnreadCandidate {
  name: string;
  position?: string;
  time?: string;
  preview?: string;
  lastMessage?: string;
  unreadCount: number;
  hasUnread: boolean;
  messageStatus?: string; // [送达], [新招呼] 等状态
  index: number;
}
```

## 🚀 使用示例

### 获取未读消息列表

```typescript
import { yupaoTools } from '@/lib/tools/yupao';

// 获取所有候选人
const result = await yupaoTools.getUnreadMessages.execute({});

// 只获取有未读消息的候选人
const unreadResult = await yupaoTools.getUnreadMessages.execute({
  onlyUnread: true,
  max: 10,
  sortBy: 'unreadCount'
});

// 查看结果
console.log('未读候选人:', unreadResult.candidates);
console.log('统计信息:', unreadResult.stats);
```

### 打开候选人聊天窗口

```typescript
// 按姓名打开
const result = await yupaoTools.openCandidateChat.execute({
  candidateName: "李女士"
});

// 按索引打开（第一个未读消息）
const result = await yupaoTools.openCandidateChat.execute({
  index: 0,
  preferUnread: true
});

// 只列出候选人，不执行点击
const listResult = await yupaoTools.openCandidateChat.execute({
  listOnly: true
});

// 查看结果
if (result.success) {
  console.log('成功打开:', result.clickedCandidate);
} else {
  console.log('可用候选人:', result.candidates);
}
```

### 获取聊天详情

```typescript
// 打开聊天窗口后获取详情
const details = await yupaoTools.getChatDetails.execute({
  maxMessages: 50,  // 最多返回50条消息
  includeHtml: false // 不包含原始HTML
});

// 查看结果
if (details.success) {
  console.log('候选人信息:', details.data.candidateInfo);
  console.log('聊天记录:', details.data.chatMessages);
  console.log('统计信息:', details.data.stats);
  console.log('格式化历史:', details.formattedHistory);
}
```

### 发送消息

```typescript
// 发送简单消息
const result = await yupaoTools.sendMessage.execute({
  message: "您好，请问您什么时候方便来面试？"
});

// 发送多行消息
const multiLineResult = await yupaoTools.sendMessage.execute({
  message: "您好！\n我们的职位非常适合您\n期待与您进一步沟通",
  clearBefore: true,  // 发送前清空输入框
  waitAfterSend: 1500 // 发送后等待1.5秒
});

// 查看结果
if (result.success) {
  console.log('消息发送成功');
  console.log('详情:', result.details);
}
```

### 交换微信

```typescript
// 交换微信 - 两步操作
const result = await yupaoTools.exchangeWechat.execute({
  waitBetweenClicksMin: 400,  // 两次点击之间最小等待
  waitBetweenClicksMax: 800,  // 两次点击之间最大等待
  waitAfterExchangeMin: 800,  // 交换完成后最小等待
  waitAfterExchangeMax: 1500  // 交换完成后最大等待
});

// 查看结果
if (result.success) {
  console.log('成功交换微信');
  console.log('使用的选择器:', result.details);
} else {
  console.log('交换失败:', result.error);
}
```

### 获取用户名

```typescript
// 获取当前登录的用户名
const result = await yupaoTools.getUsername.execute({});

// 结果格式与 zhipin 一致
console.log(result);
// 成功: { type: "text", text: "✅ 成功获取Yupao用户名：李先生\n🔍 使用选择器：._name_1o1k9_11" }
// 失败: { type: "text", text: "❌ 获取用户名失败：未找到用户名元素\n💡 提示：请确保已登录Yupao账号" }
```

### 结果示例

```javascript
{
  success: true,
  candidates: [
    {
      name: "李女士",
      position: "肯德基-兼职服务员或后厨-市区就近安排",
      time: "13:23",
      lastMessage: "[位置]重庆渝中区ELK·Bistro&Bar·麋鹿餐厅(解放碑店)",
      messageStatus: "",
      hasUnread: true,
      unreadCount: 2,
      index: 0
    },
    {
      name: "刘菊",
      position: "奥乐齐-分拣打包员-7千起步-全市可安排",
      time: "12:49",
      lastMessage: "老板您好，我刚刚查看过您的职位信息...",
      messageStatus: "[新招呼]",
      hasUnread: true,
      unreadCount: 1,
      index: 5
    }
  ],
  count: 2,
  stats: {
    total: 12,
    withName: 12,
    withUnread: 7,
    returned: 2
  }
}
```

## 🔍 工具特性

### 1. 未读状态识别
- 识别未读数字标记（在头像容器内的 `<span class="_unreadNum_1rm6c_97">2</span>`）
- 只有存在未读数字标签时才判断为有未读消息
- 状态标签（[送达]、[新招呼] 等）仅用于显示消息状态，不影响未读判断

### 2. 选择器策略
- 使用 Yupao 特定的 CSS 类名
- 精确匹配对话项结构
- 支持自定义选择器覆盖

### 3. 数据提取
- 候选人姓名
- 职位信息
- 消息时间
- 最新消息内容
- 消息状态标签

### 4. 过滤和排序
- 支持只显示未读消息
- 按时间、未读数量、姓名排序
- 限制返回数量

## 📝 注意事项

1. **登录状态**: 使用前确保已登录 yupao.com
2. **页面位置**: 需要在 /web/im 聊天页面使用
3. **网络稳定**: 建议在网络稳定的环境下使用
4. **频率控制**: 内置反检测延迟，避免操作过快

## 🔧 配置项

### 选择器配置（constants.ts）
```typescript
export const YUPAO_UNREAD_SELECTORS = {
  convItem: '._convItem_1rm6c_48',
  unreadNum: '._unreadNum_1rm6c_97',
  candidateName: '._name-text_1rm6c_133',
  // ... 更多选择器
};

export const YUPAO_INPUT_SELECTORS = {
  fbEditor: '.fb-editor',
  sendButton: '.btn-send',
  charCount: '._fbChatCount_917gb_11 span',
  // ... 更多选择器
};

export const YUPAO_EXCHANGE_WECHAT_SELECTORS = {
  exchangeButton: '._exchange-tel-btn_fdply_71._exchange-active_fdply_84',
  exchangeTipPop: '._exchangeTipPop_fdply_91._wechatPop_fdply_155',
  confirmButton: '._btn_1fwp4_11._primary_1fwp4_21',
  // ... 更多选择器
};

export const YUPAO_USER_SELECTORS = {
  userName: '._name_1o1k9_11',
  avatarBox: '._avatar-box_1o1k9_17',
  avatarImage: '._avatar_1o1k9_17 img',
  // ... 更多选择器
};
```

## 🤝 扩展开发

要添加新的 Yupao 工具：

1. 在 `types.ts` 中定义相关类型
2. 在 `constants.ts` 中添加必要的选择器
3. 创建新的工具文件
4. 在 `index.ts` 中导出新工具
5. 更新此 README 文档

---

*本工具集专为 yupao.com 平台优化，支持中文内容处理和招聘场景的特定需求。*