/**
 * Selector constants for Zhipin automation
 */

// Unread candidates selectors
export const UNREAD_SELECTORS = {
  // Main container for unread items
  container: ".chat-list-wrap",

  // List item containers
  listItem: '[role="listitem"]',
  geekItemWrap: ".geek-item-wrap",

  // Individual unread item
  item: ".chat-item",

  // Unread badge/count - 根据实际 HTML 结构更新
  unreadBadge: ".badge-count", // 主要的未读徽章类
  unreadBadgeNew: ".badge-count.badge-count-common-less", // 特定的未读样式
  unreadBadgeWithData: "[data-v-ddb4f62c].badge-count", // 带有 data-v 属性的版本
  unreadBadgeSpan: ".badge-count span", // 未读数字在 span 内
  unreadDot: ".red-dot",

  // Badge 容器 (包含头像和未读数)
  figure: ".figure",
  badge: ".badge",

  // Candidate name in list
  candidateName: ".candidate-name",
  candidateNameAlt: ".chat-item-name",
  candidateNameSelectors: '[class*="name"], .nickname, .geek-name',
  candidateNameNew: ".geek-name",

  // Job title
  jobTitle: ".source-job",

  // Last message preview
  lastMessage: ".push-text",
  lastMessageAlt: ".chat-last-msg",

  // Time
  messageTime: ".time, .time-shadow",

  // Click target area
  clickArea: ".chat-item-content",

  // Main selector for unread candidates (optimized based on testing)
  unreadCandidates: ".geek-item",
} as const;

// Chat page selectors
export const CHAT_SELECTORS = {
  // Chat container
  chatContainer: ".chat-container",
  messageList: ".message-list",

  // Individual messages
  messageItem: ".message-item",
  messageContent: ".message-content",
  messageText: ".text-content",

  // Message sender identification
  userMessage: ".message-right",
  candidateMessage: ".message-left",

  // Message metadata
  messageTime: ".message-time",
  senderName: ".sender-name",

  // Input area
  inputBox: ".chat-input",
  inputTextarea: "textarea.chat-input",
  inputEditorId: "#boss-chat-editor-input", // 主要的输入框ID
  sendButton: ".btn-send",

  // 发送相关的选择器 - 基于用户提供的路径
  conversationEditor: ".conversation-editor",
  // 发送按钮内部的 .submit 才是真正的点击目标
  submitButton: ".submit-content .submit",
  submitButtonActive: ".submit-content .submit.active",
  submitContent: ".submit-content",
  sendButtonPath:
    "#container > div:nth-child(1) > div > div.chat-box > div.chat-container > div.chat-conversation > div.conversation-box > div.conversation-operate > div.conversation-editor > div.submit-content",
  sendButtonAlt: ".conversation-editor .submit-content",
  sendIcon: ".submit-content .icon-send",

  // System messages
  systemMessage: ".system-msg",
} as const;

// Chat details selectors
export const CHAT_DETAILS_SELECTORS = {
  // Candidate info container
  candidateInfoContainer:
    ".base-info-single-container, .base-info-content, #container > div:nth-child(1) > div > div.chat-box > div.chat-container > div.chat-conversation > div.conversation-box > div.conversation-main > div.base-info-content",

  // Candidate info elements
  candidateName: ".name-box, .geek-name, .base-name",
  candidateInfoItem: ".geek-info-item, .base-info-item, .base-info-single-detial > div",
  candidateTag: ".geek-tag, .high-light-boss",
  // 沟通职位（待招岗位）- "沟通职位：肯德基-兼职-全市可安排"
  communicationPosition: ".position-name",
  communicationPositionAlt: ".position-item:not(.expect) .value.high-light-boss",
  // 候选人期望信息（来自"最近关注"）- "上海 · 服务员 3-8K"
  candidateExpectContainer: ".position-item.expect",
  candidateExpectValue: ".position-item.expect .value.job",
  candidateExpectSalary: ".position-item.expect .high-light-orange",
  // Legacy selectors for backward compatibility
  candidatePosition: ".geek-position, .position-name",
  candidatePositionAlt: ".position-content .value, .position-item .value",

  // Chat message container
  chatMessageContainer:
    ".conversation-message, .message-list, #container > div:nth-child(1) > div > div.chat-box > div.chat-container > div.chat-conversation > div.conversation-box > div.conversation-main > div.conversation-message",

  // Message elements
  messageItem: ".message-item",
  messageTime: ".message-time .time",
  messageTextSpan: ".text span",

  // Message types
  systemMessage: ".item-system",
  friendMessage: ".item-friend",
  myMessage: ".item-myself",
  resumeMessage: ".item-resume",

  // Message status
  readStatus: ".status-read",
} as const;

// Exchange WeChat selectors
export const EXCHANGE_WECHAT_SELECTORS = {
  // Exchange button
  exchangeButton: '.operate-btn:contains("换微信")',
  exchangeButtonPath:
    "#container > div:nth-child(1) > div > div.chat-box > div.chat-container > div.chat-conversation > div.conversation-box > div.conversation-operate > div.toolbar-box > div.toolbar-box-right > div.operate-exchange-left > div:nth-child(3) > span.operate-btn",

  // Confirm dialog - 更新为基于 DOM 树的正确结构
  confirmDialog: ".exchange-tooltip",
  confirmButton: ".exchange-tooltip .btn-box .boss-btn-primary.boss-btn",
  confirmButtonPath:
    "#container > div:nth-child(1) > div > div.chat-box > div.chat-container > div.chat-conversation > div.conversation-box > div.conversation-operate > div.toolbar-box > div.toolbar-box-right > div.operate-exchange-left > div:nth-child(3) > div > div > span.boss-btn-primary.boss-btn",
  cancelButton: ".exchange-tooltip .btn-box .boss-btn-outline.boss-btn",
} as const;

// Timing constants
export const TIMING = {
  // Wait timeouts (ms)
  pageLoad: 5000,
  elementWait: 3000,
  shortWait: 1000,

  // Animation delays (ms)
  clickDelay: 200,
  typeDelay: 50,
  scrollDelay: 300,

  // Retry settings
  maxRetries: 3,
  retryDelay: 1000,
} as const;
