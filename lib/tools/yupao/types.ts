/**
 * TypeScript interfaces for Yupao automation tools
 */

import { z } from "zod";

/**
 * Candidate information schema and type for Yupao
 */
export const YupaoCandidateInfoSchema = z.object({
  name: z.string().optional(),
  position: z.string().optional(),
  fullText: z.string().optional()
});

export type YupaoCandidateInfo = z.infer<typeof YupaoCandidateInfoSchema>;

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

export interface YupaoChatMsg {
  sender: 'user' | 'candidate';
  message: string;
  timestamp?: string;
  isSystemMessage?: boolean;
}

export interface YupaoConversation {
  candidateName: string;
  messages: YupaoChatMsg[];
  lastMessageTime?: string;
  unreadCount?: number;
}

export interface YupaoPageState {
  url: string;
  pageType: 'chat' | 'im' | 'unknown';
  isLoaded: boolean;
  hasUnreadMessages: boolean;
}

export interface YupaoAutomationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  screenshot?: string;
}