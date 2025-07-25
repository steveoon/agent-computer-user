/**
 * TypeScript interfaces for Zhipin automation tools
 */

import { z } from "zod";

/**
 * Candidate information schema and type
 */
export const CandidateInfoSchema = z.object({
  name: z.string().optional(),
  position: z.string().optional(),
  age: z.string().optional(),
  experience: z.string().optional(),
  education: z.string().optional(),
  info: z.array(z.string()).optional(),
  fullText: z.string().optional()
});

export type CandidateInfo = z.infer<typeof CandidateInfoSchema>;

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

export interface CandidateDetail {
  name: string;
  position: string;
  company: string;
  salary: string;
  experience: string;
  education: string;
  location: string;
  age?: string;
  status?: string;
  expectedPosition?: string;
  expectedSalary?: string;
  skills?: string[];
  introduction?: string;
}

export interface ChatMsg {
  sender: 'user' | 'candidate';
  message: string;
  timestamp?: string;
  isSystemMessage?: boolean;
}

export interface Conversation {
  candidateName: string;
  messages: ChatMsg[];
  lastMessageTime?: string;
  unreadCount?: number;
  candidateDetail?: CandidateDetail;
}

export interface ZhipinPageState {
  url: string;
  pageType: 'chat' | 'candidate-list' | 'candidate-detail' | 'unknown';
  isLoaded: boolean;
  hasUnreadMessages: boolean;
}

export interface AutomationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  screenshot?: string;
}

export interface WaitOptions {
  timeout?: number;
  interval?: number;
  visible?: boolean;
}

export interface ClickOptions {
  offsetX?: number;
  offsetY?: number;
  delay?: number;
}