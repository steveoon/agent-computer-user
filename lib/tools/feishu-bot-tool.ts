import { tool } from "ai";
import { z } from "zod";
import { sendFeishuMessage } from "../send-feishu-message";

// 飞书机器人工具
export const feishuBotTool = () =>
  tool({
    description:
      "向飞书机器人发送通知消息，支持候选人微信信息推送、系统警告、任务完成提醒等多种场景",
    inputSchema: z.object({
      notification_type: z
        .enum([
          "candidate_wechat", // 候选人微信信息
          "payload_error", // 载荷过大错误
          "task_completed", // 任务完成
          "task_interrupted", // 任务中断
          "system_warning", // 系统警告
          "custom", // 自定义消息
        ])
        .describe("通知类型"),
      platform: z
        .enum(["boss", "yupao"])
        .optional()
        .default("boss")
        .describe("招聘平台：boss(Boss直聘) 或 yupao(鱼泡直聘)"),
      boss_username: z.string().describe("招聘平台当前登录账号用户名（必填）"),
      candidate_name: z.string().optional().describe("候选人姓名（candidate_wechat类型时必需）"),
      wechat_id: z.string().optional().describe("候选人微信号（candidate_wechat类型时必需）"),
      candidate_info: z
        .object({
          age: z.union([z.number(), z.string()]).optional().describe("候选人年龄"),
          experience: z.string().optional().describe("工作经验"),
          education: z.string().optional().describe("学历"),
        })
        .optional()
        .describe("候选人详细信息"),
      position_intent: z
        .object({
          position: z.string().optional().describe("意向岗位"),
          location: z.string().optional().describe("工作地点"),
          schedule: z.string().optional().describe("工作时间"),
          salary: z.string().optional().describe("薪资待遇"),
        })
        .optional()
        .describe("意向岗位信息（如有）"),
      communication_status: z
        .string()
        .optional()
        .describe("沟通状态，如：已交换微信，候选人确认感兴趣等"),
      message: z
        .string()
        .optional()
        .describe("自定义消息内容，如果不提供将根据通知类型自动生成标准格式"),
      messageType: z
        .enum(["text", "rich_text"])
        .optional()
        .default("text")
        .describe("消息类型，默认为text"),
      additional_info: z.string().optional().describe("附加信息，用于生成更详细的通知内容"),
    }),
    execute: async ({
      notification_type,
      platform = "boss",
      boss_username,
      candidate_name,
      wechat_id,
      candidate_info,
      position_intent,
      communication_status,
      message,
      messageType = "text",
      additional_info,
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

      if (!finalMessage) {
        const timestamp = new Date().toLocaleString("zh-CN");

        switch (notification_type) {
          case "candidate_wechat":
            // 构建候选人微信通知的详细模板
            let candidateMessage = `📋 候选人微信通知${candidate_name ? ` - ${candidate_name.trim()}` : ""}\n\n`;

            // 平台账号信息
            const platformName = platform === "yupao" ? "鱼泡" : "Boss";
            candidateMessage += `${platformName}账号：${boss_username}\n\n`;

            // 候选人基本信息
            candidateMessage += `候选人信息：\n`;
            candidateMessage += `- 姓名：${candidate_name?.trim() || "未知"}`;

            // 添加详细信息（如果有）
            if (candidate_info) {
              const infoDetails = [];
              if (candidate_info.age) infoDetails.push(`${candidate_info.age}岁`);
              if (candidate_info.experience) infoDetails.push(candidate_info.experience);
              if (candidate_info.education) infoDetails.push(candidate_info.education);

              if (infoDetails.length > 0) {
                candidateMessage += `（${infoDetails.join("，")}）`;
              }
            }

            candidateMessage += `\n- 微信号：${wechat_id?.trim() || "未知"}\n`;

            // 意向岗位信息（如果有）
            if (position_intent && Object.values(position_intent).some(v => v)) {
              candidateMessage += `\n意向岗位：\n`;
              if (position_intent.position)
                candidateMessage += `- 岗位：${position_intent.position}\n`;
              if (position_intent.location)
                candidateMessage += `- 地点：${position_intent.location}\n`;
              if (position_intent.schedule)
                candidateMessage += `- 时间：${position_intent.schedule}\n`;
              if (position_intent.salary) candidateMessage += `- 薪资：${position_intent.salary}\n`;
            }

            // 沟通状态（如果有）
            if (communication_status) {
              candidateMessage += `\n沟通状态：${communication_status}`;
            }

            // 添加时间戳
            candidateMessage += `\n\n⏰ 记录时间：${timestamp}`;

            finalMessage = candidateMessage;
            break;

          case "payload_error":
            finalMessage = `🚨 【系统警告】载荷过大错误\n\n📝 检测到对话历史过长导致请求失败\n⚠️ 需要手动清理聊天历史记录\n⏰ 发生时间: ${timestamp}${
              additional_info ? `\n📋 详细信息: ${additional_info}` : ""
            }`;
            break;

          case "task_completed":
            finalMessage = `✅ 【任务完成】AI助手任务执行完毕\n\n🎯 本轮任务已成功完成\n📊 状态: 就绪等待新指令\n⏰ 完成时间: ${timestamp}${
              additional_info ? `\n📋 任务详情: ${additional_info}` : ""
            }`;
            break;

          case "task_interrupted":
            finalMessage = `⚠️ 【任务中断】AI助手任务意外中断\n\n🔄 任务执行过程中发生中断\n📊 状态: 需要检查或重新启动\n⏰ 中断时间: ${timestamp}${
              additional_info ? `\n📋 中断原因: ${additional_info}` : ""
            }`;
            break;

          case "system_warning":
            finalMessage = `⚠️ 【系统警告】\n\n${
              additional_info || "系统检测到异常情况"
            }\n⏰ 警告时间: ${timestamp}`;
            break;

          case "custom":
            finalMessage = additional_info || `📢 【自定义通知】\n⏰ 发送时间: ${timestamp}`;
            break;

          default:
            finalMessage = `📢 【通知消息】\n⏰ 发送时间: ${timestamp}`;
        }
      }

      console.log(
        `🤖 准备发送飞书通知 [${notification_type}]: ${finalMessage.substring(
          0,
          100
        )}${finalMessage.length > 100 ? "..." : ""}`
      );

      // 发送消息
      const result = await sendFeishuMessage(finalMessage, messageType);

      if (result.success) {
        const successText = `✅ 飞书通知发送成功！\n\n📋 通知类型: ${notification_type}\n📝 消息内容: ${finalMessage}\n📊 响应状态: ${
          result.data?.StatusMessage || result.data?.msg || "success"
        }\n⏰ 发送时间: ${new Date().toLocaleString("zh-CN")}`;

        return {
          type: "text" as const,
          text: successText,
        };
      } else {
        const errorText = `❌ 飞书通知发送失败\n\n📋 通知类型: ${notification_type}\n🔍 错误信息: ${result.error}\n📝 尝试发送的消息: ${finalMessage}\n💡 请检查FEISHU_BOT_WEBHOOK环境变量是否正确配置`;

        return {
          type: "text" as const,
          text: errorText,
        };
      }
    },
  });
