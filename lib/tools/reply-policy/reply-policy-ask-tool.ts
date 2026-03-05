import { tool } from "ai";
import { z } from "zod/v3";

/**
 * HITL 策略配置提问工具
 *
 * 无 execute 函数 → AI SDK 自动暂停流，设置 state: "input-available"
 * 前端 component 渲染选项卡片，用户选择后通过 addToolOutput + sendMessage 恢复流
 */
export const replyPolicyAskTool = () =>
  tool({
    description: `向用户展示策略配置选项并等待选择。每次只针对一个配置项提问。
用户会看到推荐选项按钮和自定义输入框。选择后会返回结构化 patch：{ module, value, keepCurrent }。
关键要求：
- module 必须是可写入 ReplyPolicyConfig 的精确路径（如 persona.tone、factGate.mode）
- options 中尽量提供 machine-readable 的 value（布尔值、数组、枚举原值）
- 用户点“跳过”时 keepCurrent=true，表示保留原值
注意：每次调用只问一个配置项，不要在一次调用中问多个问题。`,
    inputSchema: z.object({
      module: z
        .string()
        .describe("配置模块路径，如 persona.tone、stageGoals.trust_building、factGate.mode"),
      question: z.string().describe("向用户展示的问题（中文口语化，解释这个配置项的作用）"),
      options: z
        .array(
          z.object({
            label: z.string().describe("选项标签"),
            description: z.string().describe("选项的简要说明"),
            value: z.any().optional().describe("机器可读值，建议传枚举/布尔/数组/字符串"),
          })
        )
        .max(4)
        .describe("推荐选项（最多 4 个），用户也可以自定义输入"),
    }),
    outputSchema: z.object({
      module: z.string().describe("被修改的配置路径"),
      value: z.any().optional().describe("用户确认的值"),
      keepCurrent: z.boolean().optional().describe("true 表示跳过并保留原值"),
      displayValue: z.string().optional().describe("用于 UI 显示的人类可读文本"),
    }),
    // 无 execute → HITL 模式：流暂停，等待前端 addToolOutput
  });
