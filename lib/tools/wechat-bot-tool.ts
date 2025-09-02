import { tool } from "ai";
import { z } from "zod";
import { sendWeChatMessage } from "@/lib/send-wechat-message";
import { weChatNotificationTypeSchema } from "@/types/wechat";

/**
 * WeChat Bot 通知工具
 *
 * @description AI可以通过此工具发送WeChat群机器人通知
 * @returns AI SDK tool instance
 */
export const weChatBotTool = () =>
  tool({
    description:
      "发送WeChat群机器人通知。支持多种通知类型和消息格式（text、markdown、markdown_v2）。当需要发送通知到WeChat群时使用此工具。",
    inputSchema: z.object({
      notification_type: weChatNotificationTypeSchema.describe("通知类型"),
      platform: z
        .enum(["boss", "yupao"])
        .optional()
        .default("boss")
        .describe("招聘平台：boss(Boss直聘) 或 yupao(鱼泡直聘)"),
      platform_username: z.string().optional().describe("招聘平台当前登录账号用户名"),
      candidate_name: z.string().optional().describe("候选人姓名（candidate_wechat类型时必需）"),
      wechat_id: z.string().optional().describe("候选人微信号（candidate_wechat类型时必需）"),
      message: z
        .string()
        .optional()
        .describe("自定义消息内容，如果不提供将根据通知类型自动生成标准格式"),
      messageType: z
        .enum(["text", "markdown", "markdown_v2"])
        .optional()
        .default("markdown")
        .describe("消息类型，默认为markdown"),
      additional_info: z.string().optional().describe("附加信息，用于生成更详细的通知内容"),
      mentioned_list: z.array(z.string()).optional().describe("需要@的成员userid列表，支持@all"),
      mentioned_mobile_list: z.array(z.string()).optional().describe("需要@的成员手机号列表"),
      use_markdown_v2: z
        .boolean()
        .optional()
        .describe("是否使用markdown_v2格式（不支持颜色和@功能）"),
    }),
    execute: async ({
      notification_type,
      platform = "boss",
      platform_username,
      candidate_name,
      wechat_id,
      message,
      messageType = "markdown",
      additional_info,
      mentioned_list,
      mentioned_mobile_list,
      use_markdown_v2,
    }) => {
      // 根据通知类型进行参数验证
      if (notification_type === "candidate_wechat") {
        if (!candidate_name || candidate_name.trim() === "") {
          return {
            type: "text" as const,
            text: "❌ 候选人微信信息推送需要提供候选人姓名",
          };
        }
        if (!wechat_id || wechat_id.trim() === "") {
          return {
            type: "text" as const,
            text: "❌ 候选人微信信息推送需要提供微信号",
          };
        }
      }

      // 根据通知类型生成消息内容
      let finalMessage = message;
      const useMarkdownV2 = use_markdown_v2 || messageType === "markdown_v2";

      if (!finalMessage) {
        const timestamp = new Date().toLocaleString("zh-CN");

        switch (notification_type) {
          case "candidate_wechat":
            const platformName = platform === "yupao" ? "鱼泡" : "Boss";
            const platformInfo = platform_username
              ? `\n> **${platformName}账号**: ${platform_username}`
              : "";

            if (useMarkdownV2) {
              finalMessage = `# 候选人微信信息\n\n**姓名**: ${candidate_name?.trim()}\n**微信**: ${wechat_id?.trim()}${platform_username ? `\n**${platformName}账号**: ${platform_username}` : ""}\n**时间**: ${timestamp}`;
            } else {
              finalMessage = `## 🎯 候选人微信信息\n\n> **姓名**: ${candidate_name?.trim()}\n> **微信**: <font color="info">${wechat_id?.trim()}</font>${platformInfo}\n> **时间**: ${timestamp}`;
            }
            break;

          case "payload_error":
            if (useMarkdownV2) {
              finalMessage = `# ⚠️ 系统警告：载荷过大错误\n\n- 检测到对话历史过长导致请求失败\n- 需要手动清理聊天历史记录\n- 发生时间: ${timestamp}${
                additional_info ? `\n- 详细信息: ${additional_info}` : ""
              }`;
            } else {
              finalMessage = `## 🚨 系统警告：载荷过大错误\n\n📝 检测到对话历史过长导致请求失败\n⚠️ 需要手动清理聊天历史记录\n⏰ 发生时间: ${timestamp}${
                additional_info
                  ? `\n📋 详细信息: <font color="warning">${additional_info}</font>`
                  : ""
              }`;
            }
            break;

          case "task_completed":
            if (useMarkdownV2) {
              finalMessage = `# ✅ 任务完成\n\n**AI助手任务执行完毕**\n\n- 状态: 就绪等待新指令\n- 完成时间: ${timestamp}${
                additional_info ? `\n- 任务详情: ${additional_info}` : ""
              }`;
            } else {
              finalMessage = `## ✅ 任务完成通知\n\n🎯 **AI助手任务执行完毕**\n📊 状态: <font color="info">就绪等待新指令</font>\n⏰ 完成时间: ${timestamp}${
                additional_info
                  ? `\n📋 任务详情: <font color="comment">${additional_info}</font>`
                  : ""
              }`;
            }
            break;

          case "task_interrupted":
            if (useMarkdownV2) {
              finalMessage = `# ⚠️ 任务中断\n\n**AI助手任务意外中断**\n\n- 任务执行过程中发生中断\n- 状态: 需要检查或重新启动\n- 中断时间: ${timestamp}${
                additional_info ? `\n- 中断原因: ${additional_info}` : ""
              }`;
            } else {
              finalMessage = `## ⚠️ 任务中断通知\n\n🔄 **AI助手任务意外中断**\n📊 状态: <font color="warning">需要检查或重新启动</font>\n⏰ 中断时间: ${timestamp}${
                additional_info
                  ? `\n📋 中断原因: <font color="warning">${additional_info}</font>`
                  : ""
              }`;
            }
            break;

          case "system_warning":
            if (useMarkdownV2) {
              finalMessage = `# ⚠️ 系统警告\n\n${
                additional_info || "系统检测到异常情况"
              }\n\n警告时间: ${timestamp}`;
            } else {
              finalMessage = `## ⚠️ 系统警告\n\n<font color="warning">${
                additional_info || "系统检测到异常情况"
              }</font>\n\n⏰ 警告时间: ${timestamp}`;
            }
            break;

          case "deployment_success":
            if (useMarkdownV2) {
              finalMessage = `# 🚀 部署成功\n\n**应用已成功部署到生产环境**\n\n- 部署时间: ${timestamp}${
                additional_info ? `\n- 版本信息: ${additional_info}` : ""
              }`;
            } else {
              finalMessage = `## 🚀 部署成功通知\n\n✅ **应用已成功部署到生产环境**\n⏰ 部署时间: ${timestamp}${
                additional_info ? `\n📦 版本信息: <font color="info">${additional_info}</font>` : ""
              }`;
            }
            break;

          case "deployment_failed":
            if (useMarkdownV2) {
              finalMessage = `# ❌ 部署失败\n\n**应用部署失败，需要立即处理**\n\n- 失败时间: ${timestamp}${
                additional_info ? `\n- 错误信息: ${additional_info}` : ""
              }`;
            } else {
              finalMessage = `## ❌ 部署失败通知\n\n🚨 **应用部署失败，需要立即处理**\n⏰ 失败时间: ${timestamp}${
                additional_info
                  ? `\n💥 错误信息: <font color="warning">${additional_info}</font>`
                  : ""
              }`;
            }
            break;

          case "test_result":
            if (useMarkdownV2) {
              finalMessage = `# 🧪 测试结果\n\n${
                additional_info || "测试执行完成"
              }\n\n执行时间: ${timestamp}`;
            } else {
              finalMessage = `## 🧪 测试结果通知\n\n${
                additional_info || "测试执行完成"
              }\n\n⏰ 执行时间: ${timestamp}`;
            }
            break;

          case "custom":
            if (useMarkdownV2) {
              finalMessage = additional_info || `# 📢 自定义通知\n\n发送时间: ${timestamp}`;
            } else {
              finalMessage = additional_info || `## 📢 自定义通知\n\n⏰ 发送时间: ${timestamp}`;
            }
            break;

          default:
            if (useMarkdownV2) {
              finalMessage = `# 📢 通知消息\n\n发送时间: ${timestamp}`;
            } else {
              finalMessage = `## 📢 通知消息\n\n⏰ 发送时间: ${timestamp}`;
            }
        }
      }

      console.log(
        `🤖 准备发送WeChat通知 [${notification_type}]: ${finalMessage.substring(
          0,
          100
        )}${finalMessage.length > 100 ? "..." : ""}`
      );

      // 发送消息
      const result = await sendWeChatMessage(
        finalMessage,
        useMarkdownV2 ? "markdown_v2" : messageType,
        {
          mentioned_list,
          mentioned_mobile_list,
          use_markdown_v2: useMarkdownV2,
        }
      );

      if (result.success) {
        const successText = `✅ WeChat通知发送成功！

📋 通知类型: ${notification_type}
📝 消息格式: ${useMarkdownV2 ? "markdown_v2" : messageType}
📊 响应状态: ${result.data?.errmsg || "success"}
⏰ 发送时间: ${new Date().toLocaleString("zh-CN")}
${mentioned_list?.length ? `👥 @成员: ${mentioned_list.join(", ")}` : ""}
${mentioned_mobile_list?.length ? `📱 @手机号: ${mentioned_mobile_list.join(", ")}` : ""}`;

        return {
          type: "text" as const,
          text: successText,
        };
      } else {
        const errorText = `❌ WeChat通知发送失败

📋 通知类型: ${notification_type}
🔍 错误信息: ${result.error}
📝 尝试发送的消息: ${finalMessage.substring(0, 200)}...
💡 请检查WECHAT_BOT_WEBHOOK环境变量是否正确配置`;

        return {
          type: "text" as const,
          text: errorText,
        };
      }
    },
  });
