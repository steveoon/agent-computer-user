/**
 * 懒加载工具注册表 - 用于代码分割和 bundle 优化
 *
 * 使用 React.lazy 动态导入工具组件，将初始 bundle 从 ~105KB 减少到 ~8KB
 * 组件在首次使用时才会被加载
 */
import {
  Camera,
  ScrollText,
  MessageCircle,
  MessageSquare,
  Briefcase,
  Globe,
  Bot,
  Users,
  Smartphone,
  UserCheck,
  Building2,
  FileText,
  Calendar,
  ChartBarIcon,
  RefreshCwIcon,
  ListChecks,
  ClipboardList,
  HandshakeIcon,
  Eye,
  FileSearch,
} from "lucide-react";
import { themes, type LazyToolConfig } from "./types";

// 懒加载工具注册表
export const lazyToolRegistry: Record<string, LazyToolConfig> = {
  computer: {
    icon: Camera,
    defaultTheme: themes.zinc,
    loader: () =>
      import("./computer-tool").then(m => ({ default: m.ComputerToolMessage })),
  },
  bash: {
    icon: ScrollText,
    defaultTheme: themes.zinc,
    loader: () => import("./bash-tool").then(m => ({ default: m.BashToolMessage })),
  },
  feishu: {
    icon: MessageCircle,
    defaultTheme: themes.blue,
    loader: () => import("./feishu-tool").then(m => ({ default: m.FeishuToolMessage })),
  },
  wechat: {
    icon: MessageSquare,
    defaultTheme: themes.green,
    loader: () => import("./wechat-tool").then(m => ({ default: m.WechatToolMessage })),
  },
  job_posting_generator: {
    icon: Briefcase,
    defaultTheme: themes.indigo,
    loader: () => import("./job-posting-tool").then(m => ({ default: m.JobPostingToolMessage })),
  },
  puppeteer: {
    icon: Globe,
    defaultTheme: themes.purple,
    loader: () => import("./puppeteer-tool").then(m => ({ default: m.PuppeteerToolMessage })),
  },
  zhipin_reply_generator: {
    icon: Bot,
    defaultTheme: themes.yellow,
    loader: () =>
      import("./zhipin-reply-tool").then(m => ({ default: m.ZhipinReplyToolMessage })),
  },
  // Zhipin automation tools
  zhipin_get_unread_candidates_improved: {
    icon: Users,
    defaultTheme: themes.blue,
    loader: () => import("./zhipin-tool").then(m => ({ default: m.ZhipinToolMessage })),
  },
  zhipin_open_candidate_chat_improved: {
    icon: Users,
    defaultTheme: themes.blue,
    loader: () => import("./zhipin-tool").then(m => ({ default: m.ZhipinToolMessage })),
  },
  zhipin_send_message: {
    icon: MessageSquare,
    defaultTheme: themes.blue,
    loader: () =>
      import("./zhipin-send-message-tool").then(m => ({ default: m.ZhipinSendMessageTool })),
  },
  zhipin_get_chat_details: {
    icon: ScrollText,
    defaultTheme: themes.blue,
    loader: () =>
      import("./zhipin-chat-details-tool").then(m => ({ default: m.ZhipinChatDetailsTool })),
  },
  zhipin_exchange_wechat: {
    icon: Smartphone,
    defaultTheme: themes.green,
    loader: () =>
      import("./zhipin-exchange-wechat-tool").then(m => ({
        default: m.ZhipinExchangeWechatTool,
      })),
  },
  zhipin_get_username: {
    icon: UserCheck,
    defaultTheme: themes.green,
    loader: () =>
      import("./zhipin-get-username-tool").then(m => ({ default: m.ZhipinGetUsernameTool })),
  },
  zhipin_get_candidate_list: {
    icon: ClipboardList,
    defaultTheme: themes.blue,
    loader: () => import("./zhipin-tool").then(m => ({ default: m.ZhipinToolMessage })),
  },
  zhipin_say_hello: {
    icon: HandshakeIcon,
    defaultTheme: themes.blue,
    loader: () => import("./zhipin-tool").then(m => ({ default: m.ZhipinToolMessage })),
  },
  // Duliday interview booking tools
  duliday_job_list: {
    icon: Building2,
    defaultTheme: themes.blue,
    loader: () =>
      import("./duliday-job-list-tool").then(m => ({ default: m.DulidayJobListToolMessage })),
  },
  duliday_job_details: {
    icon: FileText,
    defaultTheme: themes.purple,
    loader: () =>
      import("./duliday-job-details-tool").then(m => ({
        default: m.DulidayJobDetailsToolMessage,
      })),
  },
  duliday_interview_booking: {
    icon: Calendar,
    defaultTheme: themes.green,
    loader: () =>
      import("./duliday-interview-booking-tool").then(m => ({
        default: m.DulidayInterviewBookingToolMessage,
      })),
  },
  duliday_bi_report: {
    icon: ChartBarIcon,
    defaultTheme: themes.indigo,
    loader: () =>
      import("./duliday-bi-report-tool").then(m => ({ default: m.DulidayBiReportToolMessage })),
  },
  duliday_bi_refresh: {
    icon: RefreshCwIcon,
    defaultTheme: themes.amber,
    loader: () =>
      import("./duliday-bi-refresh-tool").then(m => ({ default: m.DulidayBiRefreshTool })),
  },
  // Yupao automation tools
  yupao_get_unread_messages: {
    icon: ListChecks,
    defaultTheme: themes.purple,
    loader: () => import("./yupao-tool").then(m => ({ default: m.YupaoToolMessage })),
  },
  yupao_open_candidate_chat: {
    icon: UserCheck,
    defaultTheme: themes.purple,
    loader: () => import("./yupao-tool").then(m => ({ default: m.YupaoToolMessage })),
  },
  yupao_get_chat_details: {
    icon: ScrollText,
    defaultTheme: themes.purple,
    loader: () =>
      import("./yupao-chat-details-tool").then(m => ({ default: m.YupaoChatDetailsTool })),
  },
  yupao_send_message: {
    icon: MessageSquare,
    defaultTheme: themes.purple,
    loader: () => import("./yupao-tool").then(m => ({ default: m.YupaoToolMessage })),
  },
  yupao_exchange_wechat: {
    icon: Smartphone,
    defaultTheme: themes.green,
    loader: () => import("./yupao-tool").then(m => ({ default: m.YupaoToolMessage })),
  },
  yupao_get_username: {
    icon: UserCheck,
    defaultTheme: themes.purple,
    loader: () => import("./yupao-tool").then(m => ({ default: m.YupaoToolMessage })),
  },
  yupao_get_candidate_list: {
    icon: ClipboardList,
    defaultTheme: themes.purple,
    loader: () => import("./yupao-tool").then(m => ({ default: m.YupaoToolMessage })),
  },
  yupao_say_hello: {
    icon: HandshakeIcon,
    defaultTheme: themes.purple,
    loader: () => import("./yupao-tool").then(m => ({ default: m.YupaoToolMessage })),
  },
  // Zhipin Canvas and Analysis tools
  zhipin_locate_resume_canvas: {
    icon: FileSearch,
    defaultTheme: themes.blue,
    loader: () =>
      import("./zhipin-locate-resume-tool").then(m => ({
        default: m.ZhipinLocateResumeToolMessage,
      })),
  },
  analyze_screenshot: {
    icon: Eye,
    defaultTheme: themes.purple,
    loader: () =>
      import("./analyze-screenshot-tool").then(m => ({
        default: m.AnalyzeScreenshotToolMessage,
      })),
  },
  screenshot: {
    icon: Camera,
    defaultTheme: themes.zinc,
    loader: () =>
      import("./screenshot-tool-message").then(m => ({ default: m.ScreenshotToolMessage })),
  },
};
