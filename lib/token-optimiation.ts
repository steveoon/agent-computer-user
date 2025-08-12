import type { UIMessage, UIMessagePart, UIDataTypes, UITools } from "ai";
import type { ToolPart } from "@/types/tool-common";
import { parseToolOutput } from "@/types/tool-common";
import { encodeTextServer, cleanupEncodingServer } from "./token-server";

// 🧠 智能Token分析器 v2.3 (服务端优化版)
export class TokenAnalyzer {
  /**
   * 🧹 清理资源
   */
  public async cleanup(): Promise<void> {
    try {
      await cleanupEncodingServer();
    } catch (error) {
      console.warn("⚠️ 清理服务端资源失败:", error);
    }
  }

  /**
   * 🔧 安全编码文本内容 (使用服务端)
   */
  private async safeEncode(text: string): Promise<number> {
    try {
      return await encodeTextServer(text);
    } catch (error) {
      console.warn("⚠️ 服务端编码失败，使用本地估算:", error);
      // 降级估算: 1 token ≈ 4 字符
      return Math.ceil(text.length / 4);
    }
  }

  /**
   * 🛠️ 精确计算工具调用的Token消耗
   */
  private async calculateToolInvocationTokens(part: UIMessagePart<UIDataTypes, UITools>): Promise<{
    tokens: number;
    imageTokens: number;
  }> {
    let tokens = 0;
    let imageTokens = 0;

    try {
      // 检查是否为工具调用部分
      if (!part.type.startsWith("tool-")) {
        return { tokens: 0, imageTokens: 0 };
      }

      // 使用类型守卫来确保是工具部分
      const toolPart = part as ToolPart;

      // 1. 🏷️ 工具名称 tokens (从 type 中提取)
      const toolName = part.type.replace("tool-", "");
      tokens += await this.safeEncode(toolName);

      // 2. 📝 工具参数 tokens (input 阶段)
      if (
        "state" in toolPart &&
        (toolPart.state === "input-streaming" || toolPart.state === "input-available") &&
        "input" in toolPart &&
        toolPart.input
      ) {
        try {
          const inputString = JSON.stringify(toolPart.input);
          tokens += await this.safeEncode(inputString);
        } catch (error) {
          console.warn("⚠️ 序列化工具参数失败:", error);
          // 降级估算: 假设input占用约20个token
          tokens += 20;
        }
      }

      // 3. 📊 工具调用ID和状态的结构开销
      tokens += 10; // 固定开销：toolCallId, state等字段

      // 4. 🎯 工具结果 tokens (最重要的部分)
      if (
        "state" in toolPart &&
        toolPart.state === "output-available" &&
        "output" in toolPart &&
        toolPart.output
      ) {
        const output = toolPart.output;

        if (typeof output === "string") {
          // 简单字符串结果 (如bash命令输出)
          tokens += await this.safeEncode(output);
        } else if (output && typeof output === "object") {
          // 结构化结果对象
          const outputObj = parseToolOutput(output);
          if (outputObj && outputObj.type === "image" && outputObj.data) {
            // 🖼️ 图片结果处理
            // 验证 data 是字符串类型（base64编码的图片）
            const base64Data = String(outputObj.data);
            const imageKB = (base64Data.length * 3) / 4 / 1024;
            const imageTokens_calc = Math.round(imageKB * 15); // 约15 tokens per KB

            imageTokens += imageTokens_calc;
            tokens += imageTokens_calc;

            // 图片元数据的少量token开销
            tokens += 5;
          } else if (outputObj && outputObj.type === "text" && outputObj.data) {
            // 📝 文本结果处理
            tokens += await this.safeEncode(String(outputObj.data));
            tokens += 3; // type字段等结构开销
          } else {
            // 其他类型的结构化结果
            try {
              const resultString = JSON.stringify(output);
              tokens += await this.safeEncode(resultString);
            } catch (error) {
              console.warn("⚠️ 序列化工具结果失败:", error);
              tokens += 50; // 降级估算
            }
          }
        }
      } else if (
        "state" in toolPart &&
        toolPart.state === "output-error" &&
        "errorText" in toolPart &&
        toolPart.errorText
      ) {
        // 错误信息的tokens
        tokens += await this.safeEncode(toolPart.errorText);
        tokens += 5; // 错误结构开销
      } else if (
        "state" in toolPart &&
        (toolPart.state === "input-streaming" || toolPart.state === "input-available")
      ) {
        // 工具调用请求阶段(还没有结果)
        tokens += 2; // state字段开销
      }
    } catch (error) {
      console.warn("⚠️ 计算工具调用token失败:", error);
      // 降级到改进的固定估算
      tokens = 80; // 比原来的50稍高，考虑到实际情况
    }

    return { tokens, imageTokens };
  }

  /**
   * 📊 估算消息的Token使用情况 (服务端版本)
   */
  async estimateMessageTokens(
    messages: UIMessage[],
    optimizationThreshold: number = 80000
  ): Promise<{
    totalTokens: number;
    needsOptimization: boolean;
    imageTokens: number;
    breakdown?: {
      textTokens: number;
      toolTokens: number;
      imageTokens: number;
    };
  }> {
    let totalTokens = 0;
    let imageTokens = 0;
    let textTokens = 0;
    let toolTokens = 0;

    try {
      for (const message of messages) {
        // 📝 在 v5 中，所有内容都在 parts 数组中，不再使用 content 属性

        // 🔍 分析parts中的内容
        if (message.parts) {
          for (const part of message.parts) {
            if (part.type === "text" && part.text) {
              const tokens = await this.safeEncode(part.text);
              textTokens += tokens;
              totalTokens += tokens;
            } else if (part.type.startsWith("tool-")) {
              // 🛠️ 精确计算工具调用tokens
              const toolResult = await this.calculateToolInvocationTokens(part);

              toolTokens += toolResult.tokens;
              totalTokens += toolResult.tokens;

              if (toolResult.imageTokens > 0) {
                imageTokens += toolResult.imageTokens;
                // 注意：imageTokens已经包含在toolResult.tokens中，不要重复计算
              }
            } else if (part.type === "step-start") {
              // step-start标记的小开销
              totalTokens += 2;
              textTokens += 2;
            }
          }
        }

        // 🏷️ 消息角色和元数据的开销
        totalTokens += 5; // role字段等基础结构
      }
    } catch (error) {
      console.error("🚨 Token分析失败:", error);
      // 降级到改进的简单估算
      const estimatedTokens = this.fallbackTokenEstimation(messages);
      return {
        totalTokens: estimatedTokens,
        imageTokens: Math.round(estimatedTokens * 0.3), // 假设30%是图片
        needsOptimization: estimatedTokens > optimizationThreshold,
        breakdown: {
          textTokens: Math.round(estimatedTokens * 0.5),
          toolTokens: Math.round(estimatedTokens * 0.2),
          imageTokens: Math.round(estimatedTokens * 0.3),
        },
      };
    }

    return {
      totalTokens,
      imageTokens,
      needsOptimization: totalTokens > optimizationThreshold,
      breakdown: {
        textTokens,
        toolTokens,
        imageTokens,
      },
    };
  }

  /**
   * 🆘 降级token估算方法 (改进版)
   */
  private fallbackTokenEstimation(messages: UIMessage[]): number {
    let totalChars = 0;

    messages.forEach(message => {
      // 在 v5 中，所有内容都在 parts 数组中，不再使用 content 属性

      if (message.parts) {
        message.parts.forEach(part => {
          if (part.type === "text" && part.text) {
            totalChars += part.text.length;
          } else if (part.type.startsWith("tool-")) {
            // 改进的工具调用估算
            let toolChars = 50; // 基础结构
            const toolPart = part as ToolPart;

            // 工具名称
            const toolName = part.type.replace("tool-", "");
            toolChars += toolName.length;

            // 工具参数
            if (
              "state" in toolPart &&
              (toolPart.state === "input-streaming" || toolPart.state === "input-available") &&
              "input" in toolPart &&
              toolPart.input
            ) {
              try {
                toolChars += JSON.stringify(toolPart.input).length;
              } catch {
                toolChars += 100; // 估算
              }
            }

            // 工具结果
            if (
              "state" in toolPart &&
              toolPart.state === "output-available" &&
              "output" in toolPart &&
              toolPart.output
            ) {
              const output = toolPart.output;
              if (typeof output === "string") {
                toolChars += output.length;
              } else if (output && typeof output === "object") {
                // 定义工具输出的可能结构
                const outputObj = parseToolOutput(output);
                if (outputObj && outputObj.type === "image" && outputObj.data) {
                  // 对于图片数据，假设是 base64 字符串
                  const dataLength = typeof outputObj.data === 'string' 
                    ? outputObj.data.length 
                    : String(outputObj.data).length;
                  const imageKB = (dataLength * 3) / 4 / 1024;
                  toolChars += imageKB * 60; // 粗略估算图片字符数
                } else if (outputObj && outputObj.type === "text" && outputObj.data) {
                  // 对于文本数据，获取字符串长度
                  const textLength = typeof outputObj.data === 'string'
                    ? outputObj.data.length
                    : String(outputObj.data).length;
                  toolChars += textLength;
                } else {
                  try {
                    toolChars += JSON.stringify(output).length;
                  } catch {
                    toolChars += 200; // 估算
                  }
                }
              }
            } else if (
              "state" in toolPart &&
              toolPart.state === "output-error" &&
              "errorText" in toolPart &&
              toolPart.errorText
            ) {
              toolChars += toolPart.errorText.length;
            }

            totalChars += toolChars;
          }
        });
      }
    });

    // 1 token ≈ 4 字符 (保守估算)
    return Math.ceil(totalChars / 4);
  }
}

export const analyzer = new TokenAnalyzer();
