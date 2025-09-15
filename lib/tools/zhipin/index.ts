/**
 * Zhipin automation tools exports
 */

export * from "./types";
export * from "./constants";
export * from "./helpers";
export * from "./get-unread-candidates-improved.tool";
export * from "./open-candidate-chat-improved.tool";
export * from "./send-message.tool";
export * from "./get-chat-details.tool";
export * from "./exchange-wechat.tool";
export * from "./zhipin-get-username";
export * from "./say-hello-simple.tool";
export * from "./get-candidate-list.tool";
export * from "./open-resume.tool";
export * from "./locate-resume-canvas.tool";
export * from "./close-resume-detail.tool";

// Re-export tools for convenience
import { getUnreadCandidatesImprovedTool } from "./get-unread-candidates-improved.tool";
import { openCandidateChatImprovedTool } from "./open-candidate-chat-improved.tool";
import { zhipinSendMessageTool } from "./send-message.tool";
import { zhipinGetChatDetailsTool } from "./get-chat-details.tool";
import { zhipinExchangeWechatTool } from "./exchange-wechat.tool";
import { zhipinGetUsername } from "./zhipin-get-username";
import { zhipinSayHelloSimpleTool } from "./say-hello-simple.tool";
import { zhipinGetCandidateListTool } from "./get-candidate-list.tool";
import { zhipinOpenResumeTool } from "./open-resume.tool";
import { zhipinLocateResumeCanvasTool } from "./locate-resume-canvas.tool";
import { zhipinCloseResumeDetailTool } from "./close-resume-detail.tool";

/**
 * All available Zhipin tools
 */
export const zhipinTools = {
  getUnreadCandidatesImproved: getUnreadCandidatesImprovedTool,
  openCandidateChatImproved: openCandidateChatImprovedTool,
  sendMessage: zhipinSendMessageTool,
  getChatDetails: zhipinGetChatDetailsTool,
  exchangeWechat: zhipinExchangeWechatTool,
  getUsername: zhipinGetUsername,
  sayHelloSimple: zhipinSayHelloSimpleTool,
  getCandidateList: zhipinGetCandidateListTool,
  openResume: zhipinOpenResumeTool,
  locateResumeCanvas: zhipinLocateResumeCanvasTool,
  closeResumeDetail: zhipinCloseResumeDetailTool,
  // Add more tools here as they are created
} as const;
