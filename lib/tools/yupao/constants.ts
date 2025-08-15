/**
 * Selector constants for Yupao automation
 */

// Unread messages selectors
export const YUPAO_UNREAD_SELECTORS = {
  // Main container for conversation list
  container: '._convList_1qq7t_27',
  convListWrap: '._convListWrap_1qq7t_27',
  
  // Individual conversation item
  convItem: '._convItem_1qq7t_48',
  
  // Unread badge/count
  unreadNum: '._unreadNum_1qq7t_98',
  
  // Image box container (contains avatar and unread badge)
  imageBox: '._imageBox_1qq7t_81',
  
  // Candidate name
  candidateName: '._name-text_1qq7t_134',
  
  // Job position/title  
  jobTitle: '._title-dec_1qq7t_137',
  
  // Message content area
  content: '._content_1qq7t_112',
  
  // Title wrap (contains name and time)
  titleWrap: '._titleWrap_1qq7t_116',
  nameWrap: '._nameWrap_1qq7t_121',
  nameBox: '._nameBox_1qq7t_127',
  
  // Time
  messageTime: '._time_1qq7t_153',
  
  // Latest message info
  latestMsgInfo: '._latestMsgInfo_1qq7t_161',
  
  // Message status (送达、新招呼等)
  statusUnread: '._status-unread_1qq7t_174',
  
  // Message text
  msgText: '._msg-text_1qq7t_182',
  
  // More icon button
  moreIconBtn: '._moreIconBtn_1qq7t_63',
  
  // Finished indicator
  finished: '._finished_1qq7t_291',
} as const;

// Chat details selectors
export const YUPAO_CHAT_DETAILS_SELECTORS = {
  // Chat record container
  chatRecordPage: '.chat-record-page',
  chatRecordBody: '.chat-record-body',
  
  // Candidate info section (top of chat)
  topInfo: '._top-info_1qq7t_356',
  userInfo: '._user-info_1qq7t_365',
  baseInfo: '._base-info_1qq7t_370',
  candidateName: '._name_1qq7t_121',  // 候选人姓名
  candidateStats: '._stats_1qq7t_379', // 活跃时间等
  
  // Candidate resume card
  topInfoWrap: '._top-info-wrap_1ttbp_11',
  cardWrap: '._card-wrap_1ttbp_15',
  innerBox: '._inner-box_1ttbp_23',
  occName: '._occ-name_1ttbp_53', // 期望职位
  resumeTag: '._resume-tag_1ttbp_63', // 性别、年龄、期望地等标签
  salary: '._salary_1ttbp_40', // 期望薪资
  
  // Additional candidate info tags
  extraInfo: '._extra_1ttbp_87',
  tagsContainer: '._tags_1ttbp_96',
  tagItem: '._tag_1ttbp_96',
  tagValue: '._it-val_1ttbp_118', // 身高、体重、健康证等
  
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
  // Exchange button - 更新为新的hash值
  exchangeButton: '._exchange-tel-btn_1rf60_85._exchange-active_1rf60_101',
  exchangeButtonContains: '换微信',
  
  // Confirmation dialog - 更新为新的hash值
  exchangeTipPop: '._exchangeTipPop_1rf60_108._wechatPop_1rf60_171',
  dialogTitle: '._title_1rf60_119',
  dialogContent: '._content_1rf60_124',
  
  // Buttons
  confirmButton: '._btn_1fwp4_11._primary_1fwp4_21',
  cancelButton: '._btn_1fwp4_11._lightGreyStroke_1fwp4_90',
  buttonBox: '._btns_1rf60_135',
  
  // Inner box  
  innerBox: '._inner-box_1rf60_140',
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

// Say Hello page selectors (牛人打招呼页面)
export const YUPAO_SAY_HELLO_SELECTORS = {
  // Main container
  container: '.ant-spin-container',
  
  // Candidate card - uses dynamic hash
  candidateCard: '._card_xejow_11',
  candidateCardAlt: '[class*="_card_"]',
  
  // Candidate info elements
  candidateName: '._name_xejow_104',
  candidateNameAlt: '[class*="_name_"]:not([class*="_nameR_"])',
  
  // Basic info (gender, age, experience)
  baseInfoStr: '._baseInfoStr_xejow_168',
  baseInfoStrAlt: '[class*="_baseInfoStr_"]',
  
  // Introduction text
  introduce: '._introduce_xejow_182',
  introduceAlt: '[class*="_introduce_"]',
  
  // Expected job info
  expectedInfo: '._cardMRI_xejow_199',
  expectedInfoAlt: '[class*="_cardMRI_"]',
  expectedTitle: '._cardMRIT_xejow_208',
  expectedTitleAlt: '[class*="_cardMRIT_"]',
  salary: '._salary_xejow_217',
  salaryAlt: '[class*="_salary_"]',
  
  // Online status
  onlineYes: '._onlineYes_xejow_51',
  online: '._online_xejow_51',
  relation: '._relation_xejow_38',
  onlineAlt: '[class*="_online"][class*="_xejow_"]',
  
  // Chat button
  chatBtn: '._chatBtn_xejow_256',
  chatBtnAlt: '[class*="_chatBtn_"]',
  chatBtnText: '聊一聊',
  continueChatText: '继续聊',
  
  // Call button
  callBtn: '._callBtn_xejow_256',
  callBtnAlt: '[class*="_callBtn_"]',
  
  // Button container
  buttonBox: '._buttonBox_xejow_289',
  buttonBoxAlt: '[class*="_buttonBox_"]',
  
  // Tags container (skills, preferences)
  tagsR: '._tagsR_xejow_231',
  tag: '._tag_xejow_116',
  tagsAlt: '[class*="_tagsR_"]',
  tagAlt: '[class*="_tag_"]:not([class*="_tagsR_"])',
  
  // Loading indicator
  loadingBox: '._loading-box_1rmzv_11',
  infiniteScroll: '._infinite-scroll_1951k_101',
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