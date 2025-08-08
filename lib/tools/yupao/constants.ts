/**
 * Selector constants for Yupao automation
 */

// Unread messages selectors
export const YUPAO_UNREAD_SELECTORS = {
  // Main container for conversation list
  container: '._convList_1rm6c_27',
  convListWrap: '._convListWrap_1rm6c_27',
  
  // Individual conversation item
  convItem: '._convItem_1rm6c_48',
  
  // Unread badge/count
  unreadNum: '._unreadNum_1rm6c_97',
  
  // Image box container (contains avatar and unread badge)
  imageBox: '._imageBox_1rm6c_81',
  
  // Candidate name
  candidateName: '._name-text_1rm6c_133',
  
  // Job position/title  
  jobTitle: '._title-dec_1rm6c_136',
  
  // Message content area
  content: '._content_1rm6c_111',
  
  // Title wrap (contains name and time)
  titleWrap: '._titleWrap_1rm6c_115',
  nameWrap: '._nameWrap_1rm6c_120',
  nameBox: '._nameBox_1rm6c_126',
  
  // Time
  messageTime: '._time_1rm6c_152',
  
  // Latest message info
  latestMsgInfo: '._latestMsgInfo_1rm6c_160',
  
  // Message status (送达、新招呼等)
  statusUnread: '._status-unread_1rm6c_173',
  
  // Message text
  msgText: '._msg-text_1rm6c_181',
  
  // More icon button
  moreIconBtn: '._moreIconBtn_1rm6c_63',
  
  // Finished indicator
  finished: '._finished_1rm6c_290',
} as const;

// Chat details selectors
export const YUPAO_CHAT_DETAILS_SELECTORS = {
  // Chat record container
  chatRecordPage: '.chat-record-page',
  chatRecordBody: '.chat-record-body',
  
  // Message containers
  msgWrap: '.msg-wrap',
  msgInner: '.msg-inner',
  msgInnerSelf: '.msg-inner.msg-self', // 招聘者（我）的消息
  
  // Time elements
  extraTime: '.extra-time',
  
  // Message content
  messageTextBox: '.message-text-box',
  messageText: '.message-text',
  messageTextContent: '.message-text pre p',
  
  // Job information
  messageJobBox: '.message-job-box',
  jobTitle: '.message-job-box .title',
  jobTags: '.message-job-box .tag-item',
  jobAddress: '.message-job-box .address',
  jobDescription: '.message-job-box .dec',
  
  // Message metadata
  statusRead: '.status-read',
  
  // System messages
  msgTip: '.msg-tip',
  
  // Avatar
  messageAvatar: '.message-avatar img',
} as const;

// Message input selectors
export const YUPAO_INPUT_SELECTORS = {
  // Editor container
  chatEditor: '.fb-chat-editor',
  editorContainer: '.fb-editor-container',
  
  // Input box - fb-editor
  fbEditor: '.fb-editor',
  fbEditorScroll: '.fb-editor-scroll',
  
  // Input box content nodes
  fbEditorElement: '.fb-editor p[data-fish-node="element"]',
  
  // Toolbar and buttons
  chatToolbar: '.fb-chat-toolbar',
  sendButton: '.btn-send',
  chatFooter: '.fb-chat-footer',
  
  // Quick action buttons
  askResume: '._exchange-tel-btn_fdply_71:contains("求简历")',
  exchangeTel: '._exchange-tel-btn_fdply_71:contains("换电话")',
  exchangeWechat: '._exchange-tel-btn_fdply_71:contains("换微信")',
  scheduleInterview: '._exchange-tel-btn_fdply_71:contains("约面试")',
  
  // Character count
  charCount: '._fbChatCount_917gb_11 span',
  
  // Placeholder
  placeholder: '.fb-placeholder',
} as const;

// Exchange WeChat selectors  
export const YUPAO_EXCHANGE_WECHAT_SELECTORS = {
  // Exchange button
  exchangeButton: '._exchange-tel-btn_fdply_71._exchange-active_fdply_84',
  exchangeButtonContains: '换微信',
  
  // Confirmation dialog
  exchangeTipPop: '._exchangeTipPop_fdply_91._wechatPop_fdply_155',
  dialogTitle: '._title_fdply_102',
  dialogContent: '._content_fdply_108',
  
  // Buttons
  confirmButton: '._btn_1fwp4_11._primary_1fwp4_21',
  cancelButton: '._btn_1fwp4_11._lightGreyStroke_1fwp4_90',
  buttonBox: '._btns_fdply_119',
  
  // Inner box
  innerBox: '._inner-box_fdply_124',
} as const;

// User info selectors
export const YUPAO_USER_SELECTORS = {
  // Avatar box container
  avatarBox: '._avatar-box_1o1k9_17',
  
  // Username
  userName: '._name_1o1k9_11',
  
  // Avatar image
  avatarImage: '._avatar_1o1k9_17 img',
  
  // Alternative selectors
  userNameAlt: '[class*="_name_"][class*="_1o1k9_"]',
  avatarBoxAlt: '[class*="_avatar-box_"]',
} as const;

// Timing constants
export const YUPAO_TIMING = {
  // Wait timeouts (ms)
  pageLoad: 5000,
  elementWait: 3000,
  shortWait: 1000,
  
  // Animation delays (ms)
  clickDelay: 200,
  scrollDelay: 300,
  
  // Retry settings
  maxRetries: 3,
  retryDelay: 1000,
} as const;