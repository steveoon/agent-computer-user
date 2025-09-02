"use server";

import type { FeishuApiResponse, FeishuMessageResult } from "@/types";

// 飞书机器人消息发送函数
export const sendFeishuMessage = async (
  message: string,
  messageType: "text" | "rich_text" = "text"
): Promise<FeishuMessageResult> => {
  try {
    // 获取飞书机器人webhook地址
    const webhookUrl = process.env.FEISHU_BOT_WEBHOOK;

    if (!webhookUrl) {
      throw new Error("FEISHU_BOT_WEBHOOK environment variable is not set");
    }

    // 构建请求体
    const requestBody = {
      msg_type: messageType,
      content: {
        text: message,
      },
    };

    console.log("🚀 正在发送飞书消息:", {
      url: webhookUrl.substring(0, 50) + "...", // 只显示前50个字符保护隐私
      messageType,
      messageLength: message.length,
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

    const result = (await response.json()) as FeishuApiResponse;

    console.log("📨 飞书API响应:", result);

    // 检查飞书API返回的状态 - 优先使用code字段（推荐字段）
    if (result.code === 0) {
      console.log("✅ 飞书消息发送成功");
      return {
        success: true,
        data: result,
      };
    } else {
      // 失败情况，提取错误信息
      const errorMsg = result.msg || result.StatusMessage || "Unknown error from Feishu API";
      console.error(`❌ 飞书API返回错误: code=${result.code}, msg=${errorMsg}`);

      // 提供常见错误的友好提示
      let friendlyError = errorMsg;
      switch (result.code) {
        case 9499:
          friendlyError = "请求格式错误，请检查消息内容格式";
          break;
        case 19024:
          friendlyError = "机器人没有权限发送消息到该群组";
          break;
        case 19001:
          friendlyError = "无效的机器人webhook地址";
          break;
        default:
          friendlyError = errorMsg;
      }

      return {
        success: false,
        error: `飞书API错误 (${result.code}): ${friendlyError}`,
        data: result,
      };
    }
  } catch (error) {
    console.error("❌ 飞书消息发送失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};
