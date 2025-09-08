"use server";

import type {
  WeChatMessage,
  WeChatApiResponse,
  WeChatMessageResult,
  WeChatMessageType,
} from "@/types/wechat";
import { weChatApiResponseSchema } from "@/types/wechat";
import { WECHAT_ERROR_MESSAGES } from "@/types/wechat";

/**
 * 发送 WeChat Bot 消息
 *
 * @param message - 要发送的消息内容（文本或Markdown格式）
 * @param messageType - 消息类型，默认为text
 * @param options - 额外的消息选项（如@成员列表等）
 * @returns 发送结果
 */
export const sendWeChatMessage = async (
  message: string,
  messageType: WeChatMessageType = "text",
  options?: {
    mentioned_list?: string[];
    mentioned_mobile_list?: string[];
    use_markdown_v2?: boolean;
  }
): Promise<WeChatMessageResult> => {
  try {
    // 获取 WeChat 机器人 webhook 地址
    const webhookUrl = process.env.WECHAT_BOT_WEBHOOK;

    if (!webhookUrl) {
      throw new Error("WECHAT_BOT_WEBHOOK environment variable is not set");
    }

    // 构建请求体
    let requestBody: WeChatMessage;

    switch (messageType) {
      case "text":
        requestBody = {
          msgtype: "text",
          text: {
            content: message,
            ...(options?.mentioned_list && { mentioned_list: options.mentioned_list }),
            ...(options?.mentioned_mobile_list && {
              mentioned_mobile_list: options.mentioned_mobile_list,
            }),
          },
        };
        break;

      case "markdown":
        requestBody = {
          msgtype: "markdown",
          markdown: {
            content: message,
          },
        };
        break;

      case "markdown_v2":
        requestBody = {
          msgtype: "markdown_v2",
          markdown_v2: {
            content: message,
          },
        };
        break;

      default:
        throw new Error(`Unsupported message type: ${messageType}`);
    }

    console.log("🚀 正在发送WeChat消息:", {
      url: webhookUrl.substring(0, 50) + "...", // 只显示前50个字符保护隐私
      messageType,
      messageLength: message.length,
      hasAtList: !!(options?.mentioned_list?.length || options?.mentioned_mobile_list?.length),
    });

    // 发送POST请求
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    // 验证响应格式
    const validatedResult = weChatApiResponseSchema.parse(result) as WeChatApiResponse;

    console.log("📨 WeChat API响应:", validatedResult);

    // 检查WeChat API返回的状态
    if (validatedResult.errcode === 0) {
      console.log("✅ WeChat消息发送成功");
      return {
        success: true,
        data: validatedResult,
      };
    } else {
      // 失败情况，提取错误信息
      const errorMsg = validatedResult.errmsg || "Unknown error from WeChat API";
      const friendlyError = WECHAT_ERROR_MESSAGES[validatedResult.errcode] || errorMsg;

      console.error(`❌ WeChat API返回错误: code=${validatedResult.errcode}, msg=${errorMsg}`);

      return {
        success: false,
        error: `WeChat API错误 (${validatedResult.errcode}): ${friendlyError}`,
        data: validatedResult,
      };
    }
  } catch (error) {
    console.error("❌ WeChat消息发送失败:", error);

    if (error instanceof Error) {
      // 特殊处理Zod验证错误
      if (error.name === "ZodError") {
        return {
          success: false,
          error: "WeChat API响应格式不正确",
        };
      }
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: false,
      error: "Unknown error",
    };
  }
};

/**
 * 发送格式化的Markdown消息
 *
 * @param title - 消息标题
 * @param content - 消息内容
 * @param options - 消息选项
 * @returns 发送结果
 */
export const sendWeChatMarkdownMessage = async (
  title: string,
  content: string,
  options?: {
    level?: 1 | 2 | 3;
    use_v2?: boolean;
    color?: "warning" | "info" | "comment";
  }
): Promise<WeChatMessageResult> => {
  const { level = 1, use_v2 = false, color } = options || {};

  // 构建Markdown内容
  let markdownContent = `${"#".repeat(level)} ${title}\n\n${content}`;

  // 如果不是v2版本，可以添加颜色标签
  if (!use_v2 && color) {
    markdownContent = markdownContent.replace(/(\d+)/g, `<font color="${color}">$1</font>`);
  }

  // 添加时间戳
  const timestamp = new Date().toLocaleString("zh-CN");
  markdownContent += `\n\n> 发送时间: ${timestamp}`;

  return sendWeChatMessage(markdownContent, use_v2 ? "markdown_v2" : "markdown");
};
