import { anthropic } from "@ai-sdk/anthropic";
import { tool } from "ai";
import { z } from "zod";
import { getDesktop, withTimeout } from "./utils";
import { mapKeySequence } from "../utils";
import { diagnoseE2BEnvironment } from "./diagnostic";
import { compressImageServerV2 } from "../image-optimized";
import {
  loadZhipinData,
  generateSmartReplyWithLLM,
} from "../loaders/zhipin-data.loader";
import type { Store, ReplyContext } from "../../types/zhipin";
import { sendFeishuMessage } from "../send-feishu-message";
import type { ModelConfig } from "../config/models";
import type { ZhipinData, ReplyPromptsConfig } from "@/types";

const wait = async (seconds: number) => {
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
};

// 改进的鼠标移动函数，确保指针可见性
const moveMouseWithVisualUpdate = async (
  desktop: { moveMouse: (x: number, y: number) => Promise<void> },
  x: number,
  y: number
) => {
  // 确保坐标在有效范围内
  const clampedX = Math.max(0, Math.min(x, resolution.x - 1));
  const clampedY = Math.max(0, Math.min(y, resolution.y - 1));

  // 移动鼠标
  await desktop.moveMouse(clampedX, clampedY);

  return { x: clampedX, y: clampedY };
};

export const resolution = { x: 1024, y: 768 };

// 公共的中文输入处理函数 - 返回字符串
const handleChineseInput = async (
  desktop: {
    commands: {
      run: (
        cmd: string,
        options?: { timeoutMs?: number }
      ) => Promise<{ exitCode: number; stdout?: string }>;
    };
    press: (key: string) => Promise<void>;
    write: (text: string) => Promise<void>;
  },
  text: string
): Promise<string> => {
  // 检测是否包含中文字符
  const containsChinese = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/.test(
    text
  );

  if (containsChinese) {
    console.log("🔤 检测到中文字符，选择最优输入策略...");

    // 策略1: 尝试使用剪贴板方法（最快）
    try {
      // 检查xclip是否可用
      const xclipCheck = await desktop.commands.run("which xclip", {
        timeoutMs: 1000,
      });

      if (xclipCheck.exitCode === 0) {
        console.log("📋 使用剪贴板方法快速输入中文...");

        // 将文本写入剪贴板
        await desktop.commands.run(
          `echo -n "${text.replace(/"/g, '\\"')}" | xclip -selection clipboard`,
          { timeoutMs: 2000 }
        );

        // 粘贴内容
        await desktop.press("ctrl+v");
        await wait(0.1); // 给粘贴操作一点时间

        console.log("✅ 剪贴板方法输入成功");
        return `Typed (clipboard method): ${text}`;
      }
    } catch (_clipboardError) {
      console.log("⚠️ 剪贴板方法不可用，切换到备用方法");
    }

    // 策略2: 优化的Unicode输入（分段处理）
    console.log("🔤 使用优化的Unicode编码输入...");

    try {
      let currentSegment = "";
      let isAsciiSegment = false;

      // 将文本分段处理：连续的ASCII字符作为一段，连续的非ASCII字符作为另一段
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const isAscii = char.charCodeAt(0) < 128;

        // 如果字符类型改变，先处理当前段
        if (currentSegment && isAscii !== isAsciiSegment) {
          if (isAsciiSegment) {
            // ASCII段直接输入
            await desktop.write(currentSegment);
          } else {
            // 非ASCII段逐字符Unicode输入（但延迟更短）
            for (const c of currentSegment) {
              const unicode = c.charCodeAt(0).toString(16).padStart(4, "0");
              await desktop.press("ctrl+shift+u");
              await wait(0.01); // 减少延迟

              // 快速输入unicode码
              await desktop.write(unicode);
              await wait(0.01);

              await desktop.press("space");
              await wait(0.02); // 减少延迟
            }
          }
          currentSegment = "";
        }

        currentSegment += char;
        isAsciiSegment = isAscii;
      }

      // 处理最后一段
      if (currentSegment) {
        if (isAsciiSegment) {
          await desktop.write(currentSegment);
        } else {
          for (const c of currentSegment) {
            const unicode = c.charCodeAt(0).toString(16).padStart(4, "0");
            await desktop.press("ctrl+shift+u");
            await wait(0.01);
            await desktop.write(unicode);
            await wait(0.01);
            await desktop.press("space");
            await wait(0.02);
          }
        }
      }

      console.log("✅ 优化的Unicode编码输入完成");
      return `Typed (optimized Unicode): ${text}`;
    } catch (error) {
      console.error("❌ Unicode输入失败:", error);

      // 策略3: 降级到逐字符输入（最慢但最可靠）
      try {
        console.log("🔤 降级到逐字符输入模式...");
        for (const char of text) {
          try {
            if (char.charCodeAt(0) < 128) {
              await desktop.write(char);
            } else {
              const unicode = char.charCodeAt(0).toString(16).padStart(4, "0");
              await desktop.press("ctrl+shift+u");
              await wait(0.03);
              for (const digit of unicode) {
                await desktop.press(digit);
                await wait(0.01);
              }
              await desktop.press("space");
              await wait(0.03);
            }
          } catch (charError) {
            console.warn(`⚠️ 字符 '${char}' 输入失败:`, charError);
          }
        }
        return `Typed (fallback character-by-character): ${text}`;
      } catch (fallbackError) {
        return `中文输入失败: ${
          fallbackError instanceof Error ? fallbackError.message : "未知错误"
        }`;
      }
    }
  } else {
    // 对于纯ASCII文本，直接输入
    try {
      await desktop.write(text);
      return `Typed: ${text}`;
    } catch (error) {
      console.warn("⚠️ 常规输入失败:", error);
      throw new Error(
        `Input failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
};

// 公共的中文输入处理函数 - 返回对象格式（用于anthropic工具）
const handleChineseInputWithObject = async (
  desktop: {
    commands: {
      run: (
        cmd: string,
        options?: { timeoutMs?: number }
      ) => Promise<{ exitCode: number; stdout?: string }>;
    };
    press: (key: string) => Promise<void>;
    write: (text: string) => Promise<void>;
  },
  text: string
): Promise<{ type: "text"; text: string }> => {
  const result = await handleChineseInput(desktop, text);
  return { type: "text" as const, text: result };
};

// Claude 3.5 compatible computer tool
export const computerTool35 = (sandboxId: string) =>
  anthropic.tools.computer_20241022({
    displayWidthPx: resolution.x,
    displayHeightPx: resolution.y,
    displayNumber: 1,
    execute: async ({ action, coordinate, text }) => {
      const desktop = await getDesktop(sandboxId);

      switch (action) {
        case "screenshot": {
          const image = await desktop.screenshot();
          const base64Data = Buffer.from(image).toString("base64");

          console.log(
            `🖼️ 截图原始大小: ${(base64Data.length / 1024).toFixed(2)}KB`
          );

          const compressedData = await compressImageServerV2(base64Data, {
            targetSizeKB: 350,
            maxSizeKB: 400,
            enableAdaptive: true,
            preserveText: true,
          });

          console.log(
            `✅ 服务端压缩完成，当前大小: ${(
              compressedData.length / 1024
            ).toFixed(2)}KB`
          );

          return {
            type: "image" as const,
            data: compressedData,
          };
        }
        case "left_click": {
          // Claude 3.5 的 computer_20241022 版本中，left_click 不需要 coordinate 参数
          // 需要先用 mouse_move 移动到位置，然后调用 left_click
          await desktop.leftClick();
          return { type: "text" as const, text: `Left clicked` };
        }
        case "double_click": {
          // Claude 3.5 的 computer_20241022 版本中，double_click 不需要 coordinate 参数
          await desktop.doubleClick();
          return {
            type: "text" as const,
            text: `Double clicked`,
          };
        }
        case "right_click": {
          // Claude 3.5 的 computer_20241022 版本中，right_click 不需要 coordinate 参数
          await desktop.rightClick();
          return { type: "text" as const, text: `Right clicked` };
        }
        case "middle_click": {
          // Claude 3.5 的 computer_20241022 版本中，middle_click 不需要 coordinate 参数
          // E2B可能没有middleClick方法，使用替代方案
          try {
            if (typeof desktop.middleClick === "function") {
              await desktop.middleClick();
            } else {
              // 使用按键模拟中键点击
              await desktop.press("Button2");
            }
          } catch (error) {
            console.warn("Middle click not supported:", error);
          }
          return { type: "text" as const, text: `Middle clicked` };
        }
        case "cursor_position": {
          // 获取当前鼠标位置 - E2B可能没有这个方法
          return {
            type: "text" as const,
            text: `Cursor position query not supported in this environment`,
          };
        }
        case "mouse_move": {
          if (!coordinate)
            throw new Error("Coordinate required for mouse move action");
          const [x, y] = coordinate;
          await desktop.moveMouse(x, y);
          return { type: "text" as const, text: `Moved mouse to ${x}, ${y}` };
        }
        case "type": {
          if (!text) throw new Error("Text required for type action");
          return await handleChineseInput(desktop, text);
        }
        case "key": {
          if (!text) throw new Error("Key required for key action");

          // 使用键映射函数处理特殊字符
          const mappedKey = mapKeySequence(text);

          try {
            await desktop.press(mappedKey);
          } catch (error) {
            console.warn(`按键失败，尝试原始键序列: ${text}`, error);
            // 如果映射的键失败，尝试原始键序列
            await desktop.press(text === "Return" ? "enter" : text);
          }

          return {
            type: "text" as const,
            text: `Pressed key: ${text} (mapped to: ${mappedKey})`,
          };
        }
        case "left_click_drag": {
          if (!coordinate)
            throw new Error("Coordinate required for drag action");
          const [x, y] = coordinate;
          await desktop.moveMouse(x, y);
          return {
            type: "text" as const,
            text: `Dragged to ${x}, ${y}`,
          };
        }
        default:
          throw new Error(`Unsupported action: ${action}`);
      }
    },
    experimental_toToolResultContent(result) {
      if (typeof result === "string") {
        return [{ type: "text", text: result }];
      }
      if (result.type === "image" && result.data) {
        return [
          {
            type: "image",
            data: result.data,
            mimeType: "image/jpeg",
          },
        ];
      }
      if (result.type === "text" && result.text) {
        return [{ type: "text", text: result.text }];
      }
      throw new Error("Invalid result format");
    },
  });

// Claude 3.7/4 compatible computer tool (Anthropic-specific)
export const anthropicComputerTool = (sandboxId: string) =>
  anthropic.tools.computer_20250124({
    displayWidthPx: resolution.x,
    displayHeightPx: resolution.y,
    displayNumber: 1,
    execute: async ({
      action,
      coordinate,
      text,
      duration,
      scroll_amount,
      scroll_direction,
      start_coordinate,
    }) => {
      const desktop = await getDesktop(sandboxId);

      switch (action) {
        case "screenshot": {
          const image = await desktop.screenshot();
          const base64Data = Buffer.from(image).toString("base64");

          // 直接使用服务端压缩函数以减少 token 使用
          console.log(
            `🖼️ 截图原始大小: ${(base64Data.length / 1024).toFixed(2)}KB`
          );
          const compressedData = await compressImageServerV2(base64Data, {
            targetSizeKB: 350,
            maxSizeKB: 400,
            enableAdaptive: true,
            preserveText: true,
          });
          console.log(
            `✅ 服务端压缩完成，当前大小: ${(
              compressedData.length / 1024
            ).toFixed(2)}KB`
          );

          return {
            type: "image" as const,
            data: compressedData,
          };
        }
        case "wait": {
          if (!duration) throw new Error("Duration required for wait action");
          const actualDuration = Math.min(duration, 2);
          await wait(actualDuration);
          return {
            type: "text" as const,
            text: `Waited for ${actualDuration} seconds`,
          };
        }
        case "left_click": {
          if (!coordinate)
            throw new Error("Coordinate required for left click action");
          const [x, y] = coordinate;
          await desktop.moveMouse(x, y);
          await desktop.leftClick();
          return { type: "text" as const, text: `Left clicked at ${x}, ${y}` };
        }
        case "double_click": {
          if (!coordinate)
            throw new Error("Coordinate required for double click action");
          const [x, y] = coordinate;
          await desktop.moveMouse(x, y);
          await desktop.doubleClick();
          return {
            type: "text" as const,
            text: `Double clicked at ${x}, ${y}`,
          };
        }
        case "right_click": {
          if (!coordinate)
            throw new Error("Coordinate required for right click action");
          const [x, y] = coordinate;
          await desktop.moveMouse(x, y);
          await desktop.rightClick();
          return { type: "text" as const, text: `Right clicked at ${x}, ${y}` };
        }
        case "mouse_move": {
          if (!coordinate)
            throw new Error("Coordinate required for mouse move action");
          const [x, y] = coordinate;
          await desktop.moveMouse(x, y);
          return { type: "text" as const, text: `Moved mouse to ${x}, ${y}` };
        }
        case "type": {
          if (!text) throw new Error("Text required for type action");
          return await handleChineseInputWithObject(desktop, text);
        }
        case "key": {
          if (!text) throw new Error("Key required for key action");
          await desktop.press(text === "Return" ? "enter" : text);
          return { type: "text" as const, text: `Pressed key: ${text}` };
        }
        case "scroll": {
          if (!scroll_direction)
            throw new Error("Scroll direction required for scroll action");
          if (!scroll_amount)
            throw new Error("Scroll amount required for scroll action");

          await desktop.scroll(
            scroll_direction as "up" | "down",
            scroll_amount
          );
          return { type: "text" as const, text: `Scrolled ${text}` };
        }
        case "left_click_drag": {
          if (!start_coordinate || !coordinate)
            throw new Error("Coordinate required for mouse move action");
          const [startX, startY] = start_coordinate;
          const [endX, endY] = coordinate;

          await desktop.drag([startX, startY], [endX, endY]);
          return {
            type: "text" as const,
            text: `Dragged mouse from ${startX}, ${startY} to ${endX}, ${endY}`,
          };
        }
        default:
          throw new Error(`Unsupported action: ${action}`);
      }
    },
    experimental_toToolResultContent(result) {
      if (typeof result === "string") {
        return [{ type: "text", text: result }];
      }
      if (result.type === "image" && result.data) {
        return [
          {
            type: "image",
            data: result.data,
            mimeType: "image/jpeg",
          },
        ];
      }
      if (result.type === "text" && result.text) {
        return [{ type: "text", text: result.text }];
      }
      throw new Error("Invalid result format");
    },
  });

// Claude 3.5 compatible bash tool
export const bashTool35 = (sandboxId?: string) =>
  anthropic.tools.bash_20241022({
    execute: async ({ command }) => {
      const desktop = await getDesktop(sandboxId);

      try {
        const result = await desktop.commands.run(command);
        return (
          result.stdout || "(Command executed successfully with no output)"
        );
      } catch (error) {
        console.error("Bash command failed:", error);
        if (error instanceof Error) {
          return `Error executing command: ${error.message}`;
        } else {
          return `Error executing command: ${String(error)}`;
        }
      }
    },
  });

// Claude 3.7/4 compatible bash tool (Anthropic-specific)
export const anthropicBashTool = (sandboxId?: string) =>
  anthropic.tools.bash_20250124({
    execute: async ({ command }) => {
      const desktop = await getDesktop(sandboxId);

      try {
        const result = await desktop.commands.run(command);
        return (
          result.stdout || "(Command executed successfully with no output)"
        );
      } catch (error) {
        console.error("Bash command failed:", error);
        if (error instanceof Error) {
          return `Error executing command: ${error.message}`;
        } else {
          return `Error executing command: ${String(error)}`;
        }
      }
    },
  });

// Universal computer tool compatible with all providers
export const computerTool = (
  sandboxId: string,
  preferredBrand: string,
  modelConfig: ModelConfig,
  configData?: ZhipinData,
  replyPrompts?: ReplyPromptsConfig
) =>
  tool({
    description:
      "Use a computer to interact with applications and websites. Takes screenshots, clicks, types, and performs other computer actions.",
    parameters: z.object({
      action: z
        .enum([
          "screenshot",
          "left_click",
          "double_click",
          "right_click",
          "middle_click",
          "triple_click",
          "mouse_move",
          "left_mouse_down",
          "left_mouse_up",
          "type",
          "key",
          "hold_key",
          "left_click_drag",
          "cursor_position",
          "scroll",
          "wait",
          "diagnose",
          "check_fonts",
          "setup_chinese_input",
          "launch_app",
          "generate_zhipin_reply",
        ])
        .describe("The action to perform"),
      coordinate: z
        .array(z.number())
        .length(2)
        .optional()
        .describe("The [x, y] coordinates for mouse actions"),
      start_coordinate: z
        .array(z.number())
        .length(2)
        .optional()
        .describe("The [x, y] start coordinates for drag actions"),
      text: z.string().optional().describe("Text to type or key to press"),
      duration: z
        .number()
        .optional()
        .describe("Duration in seconds for wait/hold actions"),
      scroll_direction: z
        .enum(["up", "down", "left", "right"])
        .optional()
        .describe("Direction to scroll"),
      scroll_amount: z.number().optional().describe("Amount to scroll"),
      app_name: z
        .enum(["google-chrome", "firefox", "vscode"])
        .optional()
        .describe("Name of the app to launch"),
      candidate_message: z
        .string()
        .optional()
        .describe(
          "Based on the screenshot, the candidate's message content for generating reply, usually is the latest message at the left side of the chat bubble"
        ),
      reply_context: z
        .custom<ReplyContext>()
        .optional()
        .describe(
          "The context/type of reply needed (imported from @/types/zhipin ReplyContext)"
        ),
      auto_input: z
        .boolean()
        .optional()
        .describe(
          "Whether to automatically input the generated reply into the chat interface"
        ),
      conversation_history: z
        .array(z.string())
        .optional()
        .describe(
          "Previous conversation messages to provide context for better reply generation, usually the last 3-5 messages"
        ),
    }),
    execute: async ({
      action,
      coordinate,
      start_coordinate,
      text,
      duration,
      scroll_direction,
      scroll_amount,
      app_name,
      candidate_message,
      reply_context,
      auto_input,
      conversation_history,
    }) => {
      const desktop = await getDesktop(sandboxId);

      switch (action) {
        case "screenshot": {
          const image = await desktop.screenshot();
          const base64Data = Buffer.from(image).toString("base64");

          // 直接使用服务端压缩函数以减少 token 使用
          console.log(
            `🖼️ 截图原始大小: ${(base64Data.length / 1024).toFixed(2)}KB`
          );
          // 🌍 根据环境动态调整压缩参数
          const { getEnvironmentLimits } = await import(
            "@/lib/utils/environment"
          );
          const envLimits = getEnvironmentLimits();

          const compressedData = await compressImageServerV2(base64Data, {
            targetSizeKB: envLimits.compressionTargetKB, // 环境自适应目标大小
            maxSizeKB: envLimits.compressionMaxKB, // 环境自适应最大大小
            maxQuality: 90, // 通用最高质量
            minQuality: 50, // 通用最低质量
            enableAdaptive: true,
            preserveText: true,
          });
          console.log(
            `✅ 服务端压缩完成，当前大小: ${(
              compressedData.length / 1024
            ).toFixed(2)}KB`
          );

          // 返回结构化的图片数据，让 AI SDK 处理
          return {
            type: "image" as const,
            data: compressedData,
          };
        }
        case "left_click": {
          if (coordinate) {
            const [x, y] = coordinate;
            await moveMouseWithVisualUpdate(desktop, x, y);
            // 添加短暂延迟确保鼠标移动完成
            await wait(0.15);
          }

          // 尝试点击，如果失败则重试
          try {
            await desktop.leftClick();
          } catch (error) {
            console.warn("First click attempt failed, retrying...", error);
            await wait(0.1);
            await desktop.leftClick();
          }

          // 添加点击后的短暂延迟
          await wait(0.1);
          return {
            type: "text" as const,
            text: coordinate
              ? `Left clicked at ${coordinate[0]}, ${coordinate[1]}`
              : "Left clicked",
          };
        }
        case "double_click": {
          if (coordinate) {
            const [x, y] = coordinate;
            await moveMouseWithVisualUpdate(desktop, x, y);
            await wait(0.1);
          }
          await desktop.doubleClick();
          await wait(0.2);
          return {
            type: "text" as const,
            text: coordinate
              ? `Double clicked at ${coordinate[0]}, ${coordinate[1]}`
              : "Double clicked",
          };
        }
        case "right_click": {
          if (coordinate) {
            const [x, y] = coordinate;
            await moveMouseWithVisualUpdate(desktop, x, y);
            await wait(0.1);
          }
          await desktop.rightClick();
          await wait(0.1);
          return {
            type: "text" as const,
            text: coordinate
              ? `Right clicked at ${coordinate[0]}, ${coordinate[1]}`
              : "Right clicked",
          };
        }
        case "middle_click": {
          if (coordinate) {
            const [x, y] = coordinate;
            await desktop.moveMouse(x, y);
          }
          try {
            if (typeof desktop.middleClick === "function") {
              await desktop.middleClick();
            } else {
              await desktop.press("Button2");
            }
          } catch (error) {
            console.warn("Middle click not supported:", error);
          }
          return {
            type: "text" as const,
            text: coordinate
              ? `Middle clicked at ${coordinate[0]}, ${coordinate[1]}`
              : "Middle clicked",
          };
        }
        case "cursor_position": {
          return {
            type: "text" as const,
            text: "Cursor position query not supported in this environment",
          };
        }
        case "mouse_move": {
          if (!coordinate)
            throw new Error("Coordinate required for mouse move action");
          const [x, y] = coordinate;

          const { x: finalX, y: finalY } = await moveMouseWithVisualUpdate(
            desktop,
            x,
            y
          );
          await wait(0.1);
          return {
            type: "text" as const,
            text: `Moved mouse to ${finalX}, ${finalY}`,
          };
        }
        case "type": {
          if (!text) throw new Error("Text required for type action");
          const result = await handleChineseInput(desktop, text);
          return {
            type: "text" as const,
            text: result,
          };
        }
        case "key": {
          if (!text) throw new Error("Key required for key action");

          // 使用键映射函数处理特殊字符
          const mappedKey = mapKeySequence(text);

          try {
            await desktop.press(mappedKey);
          } catch (error) {
            console.warn(`按键失败，尝试原始键序列: ${text}`, error);
            // 如果映射的键失败，尝试原始键序列
            await desktop.press(text === "Return" ? "enter" : text);
          }

          return {
            type: "text" as const,
            text: `Pressed key: ${text} (mapped to: ${mappedKey})`,
          };
        }
        case "triple_click": {
          if (coordinate) {
            const [x, y] = coordinate;
            await desktop.moveMouse(x, y);
            await wait(0.1);
          }
          // 执行三次点击，间隔适当时间
          await desktop.leftClick();
          await wait(0.05);
          await desktop.leftClick();
          await wait(0.05);
          await desktop.leftClick();
          await wait(0.1);
          return {
            type: "text" as const,
            text: coordinate
              ? `Triple clicked at ${coordinate[0]}, ${coordinate[1]}`
              : "Triple clicked",
          };
        }
        case "left_mouse_down": {
          if (coordinate) {
            const [x, y] = coordinate;
            await desktop.moveMouse(x, y);
          }
          // 使用 mousePress 方法代替 mouseDown
          try {
            await desktop.mousePress("left");
          } catch (error) {
            console.warn("Mouse press not supported:", error);
          }
          return {
            type: "text" as const,
            text: coordinate
              ? `Left mouse down at ${coordinate[0]}, ${coordinate[1]}`
              : "Left mouse down",
          };
        }
        case "left_mouse_up": {
          if (coordinate) {
            const [x, y] = coordinate;
            await desktop.moveMouse(x, y);
          }
          // 使用 mouseRelease 方法代替 mouseUp
          try {
            await desktop.mouseRelease("left");
          } catch (error) {
            console.warn("Mouse release not supported:", error);
          }
          return {
            type: "text" as const,
            text: coordinate
              ? `Left mouse up at ${coordinate[0]}, ${coordinate[1]}`
              : "Left mouse up",
          };
        }
        case "hold_key": {
          if (!text) throw new Error("Key required for hold key action");
          if (!duration)
            throw new Error("Duration required for hold key action");
          const actualDuration = Math.min(duration, 5); // 限制最大5秒

          // 使用键映射函数处理特殊字符
          const mappedKey = mapKeySequence(text);

          // E2B 可能没有直接的 holdKey 方法，使用按下-等待-释放
          try {
            await desktop.press(mappedKey);
            await wait(actualDuration);
          } catch (error) {
            console.warn("Hold key not fully supported:", error);
            // 如果映射失败，尝试原始键序列
            await desktop.press(text === "Return" ? "enter" : text);
            await wait(actualDuration);
          }
          return {
            type: "text" as const,
            text: `Held key: ${text} (mapped to: ${mappedKey}) for ${actualDuration} seconds`,
          };
        }
        case "scroll": {
          if (!scroll_direction)
            throw new Error("Scroll direction required for scroll action");
          if (!scroll_amount)
            throw new Error("Scroll amount required for scroll action");

          try {
            await withTimeout(
              desktop.scroll(scroll_direction as "up" | "down", scroll_amount),
              5000,
              "Scroll"
            );
            await wait(0.2);
            return {
              type: "text" as const,
              text: `Scrolled ${scroll_direction} by ${scroll_amount}`,
            };
          } catch (error) {
            console.warn("Scroll operation failed:", error);
            // 如果滚动失败，尝试使用键盘滚动作为备选方案
            try {
              const scrollKey =
                scroll_direction === "up" ? "Page_Up" : "Page_Down";
              for (let i = 0; i < Math.min(scroll_amount, 3); i++) {
                await desktop.press(scrollKey);
                await wait(0.1);
              }
              return {
                type: "text" as const,
                text: `Scrolled ${scroll_direction} using keyboard (fallback method)`,
              };
            } catch (fallbackError) {
              console.error("Fallback scroll also failed:", fallbackError);
              return {
                type: "text" as const,
                text: `Scroll attempt failed: ${
                  fallbackError instanceof Error
                    ? fallbackError.message
                    : "Unknown error"
                }`,
              };
            }
          }
        }
        case "wait": {
          if (!duration) throw new Error("Duration required for wait action");
          const actualDuration = Math.min(duration, 3); // 限制最大3秒
          await wait(actualDuration);
          return {
            type: "text" as const,
            text: `Waited for ${actualDuration} seconds`,
          };
        }
        case "left_click_drag": {
          if (!start_coordinate || !coordinate)
            throw new Error(
              "Start and end coordinates required for drag action"
            );
          const [startX, startY] = start_coordinate;
          const [endX, endY] = coordinate;

          try {
            // 确保坐标在有效范围内
            const clampedStartX = Math.max(
              0,
              Math.min(startX, resolution.x - 1)
            );
            const clampedStartY = Math.max(
              0,
              Math.min(startY, resolution.y - 1)
            );
            const clampedEndX = Math.max(0, Math.min(endX, resolution.x - 1));
            const clampedEndY = Math.max(0, Math.min(endY, resolution.y - 1));

            // 添加超时保护
            await withTimeout(
              desktop.drag(
                [clampedStartX, clampedStartY],
                [clampedEndX, clampedEndY]
              ),
              10000,
              "Drag"
            );
            await wait(0.2);

            return {
              type: "text" as const,
              text: `Dragged from ${clampedStartX}, ${clampedStartY} to ${clampedEndX}, ${clampedEndY}`,
            };
          } catch (error) {
            console.warn("Drag operation failed:", error);
            return {
              type: "text" as const,
              text: `Drag attempt failed: ${
                error instanceof Error ? error.message : "Unknown error"
              }`,
            };
          }
        }
        case "diagnose": {
          // 运行 E2B 环境诊断
          await diagnoseE2BEnvironment(sandboxId);
          return {
            type: "text" as const,
            text: "E2B 环境诊断完成，请查看控制台输出获取详细信息",
          };
        }
        case "check_fonts": {
          // 检查和诊断字体状态
          try {
            const { getFontStatus, detectAvailableFontPackages } = await import(
              "./font-packages"
            );

            const status = await getFontStatus(desktop);
            const available = await detectAvailableFontPackages(desktop);

            let report = "📊 字体状态报告:\n";
            report += `• 字体工具: ${
              status.hasFontTools ? "✅ 可用" : "❌ 不可用"
            }\n`;
            report += `• 系统字体总数: ${status.totalFonts}\n`;
            report += `• 中文字体数量: ${status.chineseFonts}\n`;
            report += `• 已安装字体包: ${
              status.installedPackages.join(", ") || "无"
            }\n`;
            report += `• 可安装字体包: ${
              available.map((p) => p.description).join(", ") || "无"
            }`;

            return {
              type: "text" as const,
              text: report,
            };
          } catch (error) {
            return {
              type: "text" as const,
              text: `字体检查失败: ${
                error instanceof Error ? error.message : "未知错误"
              }`,
            };
          }
        }
        case "setup_chinese_input": {
          // 专门用于配置中文输入环境
          try {
            console.log("🚀 开始配置中文输入环境...");
            let report = "🔧 中文输入环境配置报告:\n\n";

            report += "💡 重要说明：\n";
            report += "为了确保安装成功，建议使用bash工具执行以下命令：\n\n";

            // 1. 生成推荐的bash命令
            const bashCommands = [
              "# 更新包管理器",
              "sudo apt-get update",
              "",
              "# 安装剪贴板工具（中文输入必需）",
              "sudo apt-get install -y xclip xsel",
              "",
              "# 安装基础字体工具",
              "sudo apt-get install -y fontconfig",
              "",
              "# 安装中文字体（可选，建议至少安装一个）",
              "sudo apt-get install -y fonts-wqy-zenhei    # 文泉驿正黑",
              "# sudo apt-get install -y fonts-wqy-microhei  # 文泉驿微米黑",
              "# sudo apt-get install -y fonts-arphic-uming  # 文鼎宋体",
              "",
              "# 设置UTF-8环境变量",
              "export LANG=C.UTF-8",
              "export LC_ALL=C.UTF-8",
              "export PYTHONIOENCODING=utf-8",
              "",
              "# 刷新字体缓存",
              "fc-cache -fv",
              "",
              "# 验证安装",
              "echo '验证工具安装：'",
              "which xclip && echo '✅ xclip 已安装' || echo '❌ xclip 缺失'",
              "which xsel && echo '✅ xsel 已安装' || echo '❌ xsel 缺失'",
              "fc-list | wc -l | xargs echo '字体总数：'",
              "fc-list :lang=zh | wc -l | xargs echo '中文字体数量：'",
            ];

            report += bashCommands.join("\n") + "\n\n";

            // 2. 尝试基本检查（不安装，只检查）
            try {
              report += "📋 当前环境检查:\n";

              // 检查工具可用性
              const tools = ["xclip", "xsel", "fc-list"];
              for (const tool of tools) {
                try {
                  await desktop.commands.run(`which ${tool}`, {
                    timeoutMs: 3000,
                  });
                  report += `✅ ${tool} 已安装\n`;
                } catch {
                  report += `❌ ${tool} 未安装\n`;
                }
              }

              // 检查字体状态
              try {
                const fontResult = await desktop.commands.run(
                  "fc-list | wc -l",
                  { timeoutMs: 5000 }
                );
                const fontCount = parseInt(fontResult.stdout?.trim() || "0");
                report += `📊 系统字体总数: ${fontCount}\n`;

                if (fontCount > 0) {
                  const chineseFontResult = await desktop.commands.run(
                    "fc-list :lang=zh | wc -l",
                    { timeoutMs: 5000 }
                  );
                  const chineseFontCount = parseInt(
                    chineseFontResult.stdout?.trim() || "0"
                  );
                  report += `🇨🇳 中文字体数量: ${chineseFontCount}\n`;
                }
              } catch (fontError) {
                report += `⚠️ 字体检查失败: ${fontError}\n`;
              }
            } catch (checkError) {
              report += `⚠️ 环境检查失败: ${checkError}\n`;
            }

            // 3. 提供使用建议
            report += "\n🎯 使用建议:\n";
            report += "1. 📝 复制上面的bash命令\n";
            report += "2. 🔧 使用bash工具逐个或批量执行\n";
            report += "3. ✅ bash工具比内置命令更可靠\n";
            report += "4. 🔄 执行完成后可重新运行此检查命令\n";

            report += "\n🚀 快速安装命令（推荐使用bash工具执行）:\n";
            report += "```bash\n";
            report +=
              "sudo apt-get update && sudo apt-get install -y xclip fontconfig fonts-wqy-zenhei\n";
            report += "export LANG=C.UTF-8 && export LC_ALL=C.UTF-8\n";
            report += "fc-cache -fv\n";
            report += "```\n";

            // 标记配置完成
            (
              desktop as unknown as { _chineseInputConfigured?: boolean }
            )._chineseInputConfigured = true;

            report += "\n🎉 中文输入环境配置指南生成完成！\n";

            return report;
          } catch (error) {
            return {
              type: "text" as const,
              text: `中文输入环境配置失败: ${
                error instanceof Error ? error.message : "未知错误"
              }`,
            };
          }
        }
        case "launch_app": {
          if (!app_name) throw new Error("App name required for launch action");
          await desktop.launch(app_name);
          return {
            type: "text" as const,
            text: `Launched ${app_name}`,
          };
        }
        case "generate_zhipin_reply": {
          // Boss直聘回复生成工具
          try {
            console.log("🤖 开始生成Boss直聘回复...");

            // 生成回复 - 优先使用传入的配置数据
            const generatedReply = await generateSmartReplyWithLLM(
              candidate_message || "",
              conversation_history || [],
              preferredBrand,
              modelConfig,
              configData, // 传递配置数据
              replyPrompts // 传递回复指令
            );

            console.log(`📝 生成的回复内容: ${generatedReply}`);
            console.log(
              `🎯 传入的回复上下文: ${reply_context || "未指定(LLM自动识别)"}`
            );
            console.log(`💬 候选人消息: ${candidate_message}`);
            console.log(
              `📝 对话历史: ${conversation_history?.length || 0}条消息`
            );
            console.log(`⚙️ 自动输入: ${auto_input ? "是" : "否"}`);

            // 为了显示统计信息，使用传入的配置数据或重新加载
            const storeDatabase = configData || (await loadZhipinData());

            let resultText = `✅ Boss直聘回复已生成：\n\n"${generatedReply}"\n\n📊 生成详情:\n• 候选人消息: ${
              candidate_message || "无"
            }\n• 回复类型: ${reply_context || "auto_detected"}\n• 对话历史: ${
              conversation_history?.length || 0
            }条消息\n• 使用数据: ${
              storeDatabase.stores.length
            }家门店，${storeDatabase.stores.reduce(
              (sum: number, store: Store) => sum + store.positions.length,
              0
            )}个岗位`;

            // 如果启用自动输入，尝试输入回复内容
            if (auto_input) {
              try {
                resultText += "\n\n🚀 正在自动输入回复内容...";

                // 自动输入生成的回复
                const inputResult = await handleChineseInput(
                  desktop,
                  generatedReply
                );
                resultText += `\n✅ 自动输入完成: ${inputResult}`;
                resultText +=
                  "\n\n💡 提示: 现在可以按回车键发送消息，或手动检查后发送";
              } catch (inputError) {
                console.error("自动输入失败:", inputError);
                resultText += `\n❌ 自动输入失败: ${
                  inputError instanceof Error ? inputError.message : "未知错误"
                }`;
                resultText += `\n🔄 请手动使用 type 操作输入以下内容: "${generatedReply}"`;
              }
            } else {
              resultText += `\n\n🚀 下一步操作: 请使用 type 动作输入以下回复内容：\n"${generatedReply}"\n\n💡 建议流程: 1. 执行 type 操作输入回复 → 2. 按回车发送`;
            }

            return {
              type: "text" as const,
              text: resultText,
            };
          } catch (error) {
            console.error("❌ Boss直聘回复生成失败:", error);
            return {
              type: "text" as const,
              text: `Boss直聘回复生成失败: ${
                error instanceof Error ? error.message : "未知错误"
              }`,
            };
          }
        }
        default:
          throw new Error(`Unsupported action: ${action}`);
      }
    },
    experimental_toToolResultContent(result) {
      if (typeof result === "string") {
        return [{ type: "text", text: result }];
      }
      if (result.type === "image" && result.data) {
        return [
          {
            type: "image",
            data: result.data,
            mimeType: "image/jpeg",
          },
        ];
      }
      if (result.type === "text" && result.text) {
        return [{ type: "text", text: result.text }];
      }
      throw new Error("Invalid result format");
    },
  });

// Universal bash tool compatible with all providers
export const bashTool = (sandboxId?: string) =>
  tool({
    description: "Execute bash commands on the computer system",
    parameters: z.object({
      command: z.string().describe("The bash command to execute"),
    }),
    execute: async ({ command }) => {
      const desktop = await getDesktop(sandboxId);

      try {
        const result = await desktop.commands.run(command);
        return (
          result.stdout || "(Command executed successfully with no output)"
        );
      } catch (error) {
        console.error("Bash command failed:", error);
        if (error instanceof Error) {
          return `Error executing command: ${error.message}`;
        } else {
          return `Error executing command: ${String(error)}`;
        }
      }
    },
  });

// 飞书机器人工具
export const feishuBotTool = () =>
  tool({
    description:
      "向飞书机器人发送通知消息，支持候选人微信信息推送、系统警告、任务完成提醒等多种场景",
    parameters: z.object({
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
      candidate_name: z
        .string()
        .optional()
        .describe("候选人姓名（candidate_wechat类型时必需）"),
      wechat_id: z
        .string()
        .optional()
        .describe("候选人微信号（candidate_wechat类型时必需）"),
      message: z
        .string()
        .optional()
        .describe("自定义消息内容，如果不提供将根据通知类型自动生成标准格式"),
      messageType: z
        .enum(["text", "rich_text"])
        .optional()
        .default("text")
        .describe("消息类型，默认为text"),
      additional_info: z
        .string()
        .optional()
        .describe("附加信息，用于生成更详细的通知内容"),
    }),
    execute: async ({
      notification_type,
      candidate_name,
      wechat_id,
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
            finalMessage = `【候选人微信】\n👤 姓名: ${candidate_name?.trim()}\n💬 微信: ${wechat_id?.trim()}\n⏰ 时间: ${timestamp}`;
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
            finalMessage =
              additional_info || `📢 【自定义通知】\n⏰ 发送时间: ${timestamp}`;
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

// Backward compatibility aliases
export const anthropicComputerTool35 = computerTool35;
export const anthropicBashTool35 = bashTool35;
