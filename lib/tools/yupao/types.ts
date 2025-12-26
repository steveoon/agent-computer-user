/**
 * TypeScript interfaces for Yupao automation tools
 */

import { z } from 'zod/v3';

/**
 * Candidate information schema and type for Yupao
 */
export const YupaoCandidateInfoSchema = z.object({
  name: z.string().optional(),
  position: z.string().optional(),
  fullText: z.string().optional(),
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
  sender: "user" | "candidate";
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
  pageType: "chat" | "im" | "unknown";
  isLoaded: boolean;
  hasUnreadMessages: boolean;
}

export interface YupaoAutomationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  screenshot?: string;
}

/**
 * Candidate card information for say hello feature
 */
export interface YupaoCandidateCard {
  index: number;
  name: string;
  gender?: string;
  age?: string;
  experience?: string;
  education?: string;
  introduce?: string;
  expectedPosition?: string;
  expectedSalary?: string;
  expectedLocation?: string;
  onlineStatus?: "online" | "recently" | "offline" | "contacted";
  buttonText?: string; // "聊一聊" or "继续聊"
  tags?: string[];
}

/**
 * Result of a single greeting attempt
 */
export interface YupaoSayHelloResult {
  candidateName: string;
  success: boolean;
  message?: string;
  error?: string;
  greetingText?: string;
  timestamp?: string;
}

/**
 * Options for batch greeting
 */
export interface YupaoBatchGreetingOptions {
  maxCandidates?: number; // Maximum number of candidates to greet
  delayBetweenGreetings?: {
    min: number;
    max: number;
  };
  skipContacted?: boolean; // Skip candidates already contacted
  customPrompt?: string; // Custom LLM prompt for generating greetings
  useDefaultGreeting?: string; // Fallback greeting if LLM fails
  scrollBehavior?: boolean; // Enable random scrolling between actions
}
