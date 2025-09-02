import { z } from "zod";

/**
 * WeChat Bot 消息类型枚举
 *
 * @description 支持的消息类型，对应WeChat Bot API规范
 */
export const weChatMessageTypeSchema = z.enum([
  "text",
  "markdown",
  "markdown_v2",
  "image",
  "news",
  "file",
  "voice",
  "template_card",
]);

export type WeChatMessageType = z.infer<typeof weChatMessageTypeSchema>;

/**
 * WeChat Bot 通知类型枚举
 *
 * @description 支持的通知场景，用于区分不同的消息推送场景
 */
export const weChatNotificationTypeSchema = z.enum([
  "candidate_wechat", // 候选人微信信息推送
  "payload_error", // 载荷过大错误警告
  "task_completed", // 任务完成通知
  "task_interrupted", // 任务中断通知
  "system_warning", // 系统警告通知
  "deployment_success", // 部署成功通知
  "deployment_failed", // 部署失败通知
  "test_result", // 测试结果通知
  "custom", // 自定义通知
]);

export type WeChatNotificationType = z.infer<typeof weChatNotificationTypeSchema>;

/**
 * WeChat Bot 文本消息参数
 */
export const weChatTextMessageSchema = z.object({
  msgtype: z.literal("text"),
  text: z.object({
    content: z.string().max(2048).describe("文本内容，最长不超过2048个字节"),
    mentioned_list: z.array(z.string()).optional().describe("@的成员列表"),
    mentioned_mobile_list: z.array(z.string()).optional().describe("@的手机号列表"),
  }),
});

/**
 * WeChat Bot Markdown消息参数
 */
export const weChatMarkdownMessageSchema = z.object({
  msgtype: z.literal("markdown"),
  markdown: z.object({
    content: z.string().max(4096).describe("markdown内容，最长不超过4096个字节"),
  }),
});

/**
 * WeChat Bot Markdown V2消息参数
 */
export const weChatMarkdownV2MessageSchema = z.object({
  msgtype: z.literal("markdown_v2"),
  markdown_v2: z.object({
    content: z.string().max(4096).describe("markdown_v2内容，最长不超过4096个字节"),
  }),
});

/**
 * WeChat Bot 图片消息参数
 */
export const weChatImageMessageSchema = z.object({
  msgtype: z.literal("image"),
  image: z.object({
    base64: z.string().describe("图片内容的base64编码"),
    md5: z.string().describe("图片内容（base64编码前）的md5值"),
  }),
});

/**
 * WeChat Bot 图文消息参数
 */
export const weChatNewsMessageSchema = z.object({
  msgtype: z.literal("news"),
  news: z.object({
    articles: z
      .array(
        z.object({
          title: z.string().max(128).describe("标题，不超过128个字节"),
          description: z.string().max(512).optional().describe("描述，不超过512个字节"),
          url: z.string().url().describe("点击后跳转的链接"),
          picurl: z.string().url().optional().describe("图文消息的图片链接"),
        })
      )
      .min(1)
      .max(8)
      .describe("图文消息，支持1到8条图文"),
  }),
});

/**
 * WeChat Bot 文件消息参数
 */
export const weChatFileMessageSchema = z.object({
  msgtype: z.literal("file"),
  file: z.object({
    media_id: z.string().describe("文件id，通过文件上传接口获取"),
  }),
});

/**
 * WeChat Bot 语音消息参数
 */
export const weChatVoiceMessageSchema = z.object({
  msgtype: z.literal("voice"),
  voice: z.object({
    media_id: z.string().describe("语音文件id，通过文件上传接口获取"),
  }),
});

/**
 * WeChat Bot 消息联合类型
 */
export const weChatMessageSchema = z.union([
  weChatTextMessageSchema,
  weChatMarkdownMessageSchema,
  weChatMarkdownV2MessageSchema,
  weChatImageMessageSchema,
  weChatNewsMessageSchema,
  weChatFileMessageSchema,
  weChatVoiceMessageSchema,
]);

export type WeChatMessage = z.infer<typeof weChatMessageSchema>;

/**
 * WeChat Bot API 响应类型
 */
export const weChatApiResponseSchema = z.object({
  errcode: z.number(),
  errmsg: z.string(),
});

export type WeChatApiResponse = z.infer<typeof weChatApiResponseSchema>;

/**
 * WeChat Bot 消息发送结果
 */
export interface WeChatMessageResult {
  readonly success: boolean;
  readonly data?: WeChatApiResponse;
  readonly error?: string;
}

/**
 * WeChat Bot 通知选项配置
 */
export const weChatNotificationOptionsSchema = z.object({
  candidate_name: z.string().optional().describe("候选人姓名"),
  wechat_id: z.string().optional().describe("候选人微信号"),
  additional_info: z.string().optional().describe("附加信息"),
  message: z.string().optional().describe("自定义消息内容"),
  messageType: weChatMessageTypeSchema.optional().describe("消息类型"),
  mentioned_list: z.array(z.string()).optional().describe("@的成员列表"),
  mentioned_mobile_list: z.array(z.string()).optional().describe("@的手机号列表"),
  use_markdown_v2: z.boolean().optional().describe("是否使用markdown_v2格式"),
});

export type WeChatNotificationOptions = z.infer<typeof weChatNotificationOptionsSchema>;

/**
 * WeChat Bot 工具参数
 */
export const weChatToolParamsSchema = z.object({
  notification_type: weChatNotificationTypeSchema,
  messageType: weChatMessageTypeSchema.optional().default("text"),
  candidate_name: z.string().optional(),
  wechat_id: z.string().optional(),
  additional_info: z.string().optional(),
  message: z.string().optional(),
  mentioned_list: z.array(z.string()).optional(),
  mentioned_mobile_list: z.array(z.string()).optional(),
  use_markdown_v2: z.boolean().optional(),
});

export type WeChatToolParams = z.infer<typeof weChatToolParamsSchema>;

/**
 * WeChat Bot 通知标签映射
 */
export const WECHAT_NOTIFICATION_LABELS = {
  candidate_wechat: "候选人微信通知",
  payload_error: "载荷过大错误通知",
  task_completed: "任务完成通知",
  task_interrupted: "任务中断通知",
  system_warning: "系统警告通知",
  deployment_success: "部署成功通知",
  deployment_failed: "部署失败通知",
  test_result: "测试结果通知",
  custom: "自定义通知",
} as const satisfies Record<WeChatNotificationType, string>;

/**
 * WeChat Bot 错误代码映射
 */
export const WECHAT_ERROR_MESSAGES: Record<number, string> = {
  0: "发送成功",
  93000: "机器人被停用",
  93004: "机器人没有权限发送消息",
  93008: "不在群聊中",
  45009: "接口调用超过限制（20条/分钟）",
  40003: "无效的参数",
  40008: "无效的消息类型",
  48002: "API接口无权限调用",
};
