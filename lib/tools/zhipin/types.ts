/**
 * TypeScript interfaces for Zhipin automation tools
 */

import { z } from 'zod/v3';

/**
 * Candidate information schema and type
 */
export const CandidateInfoSchema = z.object({
  name: z.string().optional(),
  position: z.string().optional(), // 期望职位
  age: z.string().optional(),
  gender: z.string().optional(), // 性别
  experience: z.string().optional(),
  education: z.string().optional(),
  expectedSalary: z.string().optional(), // 期望薪资
  expectedLocation: z.string().optional(), // 期望工作地
  jobAddress: z.string().optional(), // 岗位地址（从聊天详情DOM解析）
  height: z.string().optional(), // 身高
  weight: z.string().optional(), // 体重
  healthCertificate: z.boolean().optional(), // 是否有健康证
  activeTime: z.string().optional(), // 最近活跃时间
  info: z.array(z.string()).optional(), // 其他标签信息
  fullText: z.string().optional(),
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
  sender: "user" | "candidate";
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
  pageType: "chat" | "candidate-list" | "candidate-detail" | "unknown";
  isLoaded: boolean;
  hasUnreadMessages: boolean;
}

export interface AutomationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  screenshot?: string;
  mcpBackend?: "playwright" | "puppeteer";
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
