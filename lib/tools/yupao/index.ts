/**
 * Yupao automation tools exports
 */

import { getUnreadMessagesTool, GET_UNREAD_MESSAGES_ACTION } from "./get-unread-messages.tool";
import { openCandidateChatTool, OPEN_CANDIDATE_CHAT_ACTION } from "./open-candidate-chat.tool";
import { yupaoChatDetailsTool, GET_CHAT_DETAILS_ACTION } from "./get-chat-details.tool";
import { yupaoSendMessageTool, SEND_MESSAGE_ACTION } from "./send-message.tool";
import { yupaoExchangeWechatTool, EXCHANGE_WECHAT_ACTION } from "./exchange-wechat.tool";
import { yupaoGetUsername, GET_USERNAME_ACTION } from "./get-username.tool";
import { yupaoGetCandidateListTool, GET_CANDIDATE_LIST_ACTION } from "./get-candidate-list.tool";
import { yupaoSayHelloSimpleTool, SAY_HELLO_SIMPLE_ACTION } from "./say-hello-simple.tool";

// Export all tools
export const yupaoTools = {
  getUnreadMessages: getUnreadMessagesTool,
  openCandidateChat: openCandidateChatTool,
  getChatDetails: yupaoChatDetailsTool(),
  sendMessage: yupaoSendMessageTool(),
  exchangeWechat: yupaoExchangeWechatTool(),
  getUsername: yupaoGetUsername,
  getCandidateList: yupaoGetCandidateListTool(),
  sayHello: yupaoSayHelloSimpleTool(),
} as const;

// Export action names
export const YUPAO_ACTIONS = {
  GET_UNREAD_MESSAGES: GET_UNREAD_MESSAGES_ACTION,
  OPEN_CANDIDATE_CHAT: OPEN_CANDIDATE_CHAT_ACTION,
  GET_CHAT_DETAILS: GET_CHAT_DETAILS_ACTION,
  SEND_MESSAGE: SEND_MESSAGE_ACTION,
  EXCHANGE_WECHAT: EXCHANGE_WECHAT_ACTION,
  GET_USERNAME: GET_USERNAME_ACTION,
  GET_CANDIDATE_LIST: GET_CANDIDATE_LIST_ACTION,
  SAY_HELLO_SIMPLE: SAY_HELLO_SIMPLE_ACTION,
} as const;

// Export individual tools for convenience
export { getUnreadMessagesTool } from "./get-unread-messages.tool";
export { openCandidateChatTool } from "./open-candidate-chat.tool";
export { yupaoChatDetailsTool } from "./get-chat-details.tool";
export { yupaoSendMessageTool } from "./send-message.tool";
export { yupaoExchangeWechatTool } from "./exchange-wechat.tool";
export { yupaoGetUsername } from "./get-username.tool";
export { yupaoGetCandidateListTool } from "./get-candidate-list.tool";
export { yupaoSayHelloSimpleTool } from "./say-hello-simple.tool";

// Re-export types
export * from "./types";
export * from "./constants";
