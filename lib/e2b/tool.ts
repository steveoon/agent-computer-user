import { anthropic } from "@ai-sdk/anthropic";
import { tool } from "ai";
import { z } from "zod";
import { getDesktop, withTimeout } from "./utils";
import { mapKeySequence } from "../utils";
import { diagnoseE2BEnvironment } from "./diagnostic";
import { compressImageServerV2 } from "../image-optimized";
import { loadZhipinData } from "../loaders/zhipin-data.loader";
import { generateSmartReply } from "@/lib/agents";
import { activeConfig } from "./display-config";
import type { Store } from "../../types/zhipin";
import type { ModelConfig } from "../config/models";
import type { ZhipinData, ReplyPolicyConfig } from "@/types";

const wait = async (seconds: number) => {
  await new Promise(resolve => setTimeout(resolve, seconds * 1000));
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

// 使用可配置的显示设置
export const resolution = activeConfig.resolution;
export const dpi = activeConfig.dpi;

// 启动时显示当前配置
console.log(`🖥️ E2B Desktop Configuration:
  • Resolution: ${resolution.x}x${resolution.y}
  • DPI: ${dpi}
  • Profile: ${activeConfig.description}`);

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
  const containsChinese = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/.test(text);

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
      throw new Error(`Input failed: ${error instanceof Error ? error.message : String(error)}`);
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

          console.log(`🖼️ 截图原始大小: ${(base64Data.length / 1024).toFixed(2)}KB`);

          const compressedData = await compressImageServerV2(base64Data, {
            targetSizeKB: 350,
            maxSizeKB: 400,
            enableAdaptive: true,
            preserveText: true,
          });

          console.log(
            `✅ 服务端压缩完成，当前大小: ${(compressedData.length / 1024).toFixed(2)}KB`
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
          if (!coordinate) throw new Error("Coordinate required for mouse move action");
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
          if (!coordinate) throw new Error("Coordinate required for drag action");
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
    toModelOutput({ output }) {
      // AI SDK v5 格式：返回带有 type: 'content' 的对象
      if (typeof output === "string") {
        return {
          type: "content" as const,
          value: [{ type: "text" as const, text: output }],
        };
      }
      if (output.type === "image" && output.data) {
        return {
          type: "content" as const,
          value: [
            {
              type: "media" as const,
              data: output.data,
              mediaType: "image/jpeg",
            },
          ],
        };
      }
      if (output.type === "text" && output.text) {
        return {
          type: "content" as const,
          value: [{ type: "text" as const, text: output.text }],
        };
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
          console.log(`🖼️ 截图原始大小: ${(base64Data.length / 1024).toFixed(2)}KB`);
          const compressedData = await compressImageServerV2(base64Data, {
            targetSizeKB: 350,
            maxSizeKB: 400,
            enableAdaptive: true,
            preserveText: true,
          });
          console.log(
            `✅ 服务端压缩完成，当前大小: ${(compressedData.length / 1024).toFixed(2)}KB`
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
          if (!coordinate) throw new Error("Coordinate required for left click action");
          const [x, y] = coordinate;
          await desktop.moveMouse(x, y);
          await desktop.leftClick();
          return { type: "text" as const, text: `Left clicked at ${x}, ${y}` };
        }
        case "double_click": {
          if (!coordinate) throw new Error("Coordinate required for double click action");
          const [x, y] = coordinate;
          await desktop.moveMouse(x, y);
          await desktop.doubleClick();
          return {
            type: "text" as const,
            text: `Double clicked at ${x}, ${y}`,
          };
        }
        case "right_click": {
          if (!coordinate) throw new Error("Coordinate required for right click action");
          const [x, y] = coordinate;
          await desktop.moveMouse(x, y);
          await desktop.rightClick();
          return { type: "text" as const, text: `Right clicked at ${x}, ${y}` };
        }
        case "mouse_move": {
          if (!coordinate) throw new Error("Coordinate required for mouse move action");
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
          if (!scroll_direction) throw new Error("Scroll direction required for scroll action");
          if (!scroll_amount) throw new Error("Scroll amount required for scroll action");

          await desktop.scroll(scroll_direction as "up" | "down", scroll_amount);
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
    toModelOutput({ output }) {
      // AI SDK v5 格式：返回带有 type: 'content' 的对象
      if (typeof output === "string") {
        return {
          type: "content" as const,
          value: [{ type: "text" as const, text: output }],
        };
      }
      if (output.type === "image" && output.data) {
        return {
          type: "content" as const,
          value: [
            {
              type: "media" as const,
              data: output.data,
              mediaType: "image/jpeg",
            },
          ],
        };
      }
      if (output.type === "text" && output.text) {
        return {
          type: "content" as const,
          value: [{ type: "text" as const, text: output.text }],
        };
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
        return result.stdout || "(Command executed successfully with no output)";
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
        return result.stdout || "(Command executed successfully with no output)";
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
  replyPolicy?: ReplyPolicyConfig,
  defaultWechatId?: string
) =>
  tool({
    description:
      "Use a computer to interact with applications and websites. Takes screenshots, clicks, types, and performs other computer actions.",
    inputSchema: z.object({
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
      duration: z.number().optional().describe("Duration in seconds for wait/hold actions"),
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
          "Extract the candidate's latest message from the right chat area. Look for the most recent message bubble on the left side (candidate's side) of the conversation"
        ),

      auto_input: z
        .boolean()
        .optional()
        .describe("Whether to automatically input the generated reply into the chat interface"),
      conversation_history: z
        .array(z.string())
        .optional()
        .describe(
          "Comprehensive context from the interface including: 1) Candidate profile info from top-right (name, age, experience, education) - AGE IS CRITICAL for role matching, 2) Recent conversation messages from right chat area (last 3-5 exchanges), 3) Job position details from the interface. Format as context strings like 'Candidate: 陈洁, 30岁, 1年经验, 高中学历, 应聘店员职位' followed by message history"
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
      auto_input,
      conversation_history,
    }) => {
      const desktop = await getDesktop(sandboxId);

      switch (action) {
        case "screenshot": {
          const image = await desktop.screenshot();
          const base64Data = Buffer.from(image).toString("base64");

          console.log(`🖼️ 截图原始大小: ${(base64Data.length / 1024).toFixed(2)}KB`);
          // 🌍 根据环境动态调整压缩参数
          const { getEnvironmentLimits } = await import("@/lib/utils/environment");
          const envLimits = getEnvironmentLimits();

          const compressedData = await compressImageServerV2(base64Data, {
            targetSizeKB: envLimits.compressionTargetKB, // 环境自适应目标大小
            maxSizeKB: envLimits.compressionMaxKB, // 环境自适应最大大小
            maxQuality: 95, // 通用最高质量 (JPEG范围: 1-100)
            minQuality: 60, // 通用最低质量 (确保可接受的图像质量)
            enableAdaptive: true,
            preserveText: true,
          });
          console.log(
            `✅ 服务端压缩完成，当前大小: ${(compressedData.length / 1024).toFixed(2)}KB`
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
          if (!coordinate) throw new Error("Coordinate required for mouse move action");
          const [x, y] = coordinate;

          const { x: finalX, y: finalY } = await moveMouseWithVisualUpdate(desktop, x, y);
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
          if (!duration) throw new Error("Duration required for hold key action");
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
          if (!scroll_direction) throw new Error("Scroll direction required for scroll action");
          if (!scroll_amount) throw new Error("Scroll amount required for scroll action");

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
              const scrollKey = scroll_direction === "up" ? "Page_Up" : "Page_Down";
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
                  fallbackError instanceof Error ? fallbackError.message : "Unknown error"
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
            throw new Error("Start and end coordinates required for drag action");
          const [startX, startY] = start_coordinate;
          const [endX, endY] = coordinate;

          try {
            // 确保坐标在有效范围内
            const clampedStartX = Math.max(0, Math.min(startX, resolution.x - 1));
            const clampedStartY = Math.max(0, Math.min(startY, resolution.y - 1));
            const clampedEndX = Math.max(0, Math.min(endX, resolution.x - 1));
            const clampedEndY = Math.max(0, Math.min(endY, resolution.y - 1));

            // 添加超时保护
            await withTimeout(
              desktop.drag([clampedStartX, clampedStartY], [clampedEndX, clampedEndY]),
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
            const { getFontStatus, detectAvailableFontPackages } = await import("./font-packages");

            const status = await getFontStatus(desktop);
            const available = await detectAvailableFontPackages(desktop);

            let report = "📊 字体状态报告:\n";
            report += `• 字体工具: ${status.hasFontTools ? "✅ 可用" : "❌ 不可用"}\n`;
            report += `• 系统字体总数: ${status.totalFonts}\n`;
            report += `• 中文字体数量: ${status.chineseFonts}\n`;
            report += `• 已安装字体包: ${status.installedPackages.join(", ") || "无"}\n`;
            report += `• 可安装字体包: ${available.map(p => p.description).join(", ") || "无"}`;

            return {
              type: "text" as const,
              text: report,
            };
          } catch (error) {
            return {
              type: "text" as const,
              text: `字体检查失败: ${error instanceof Error ? error.message : "未知错误"}`,
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
                const fontResult = await desktop.commands.run("fc-list | wc -l", {
                  timeoutMs: 5000,
                });
                const fontCount = parseInt(fontResult.stdout?.trim() || "0");
                report += `📊 系统字体总数: ${fontCount}\n`;

                if (fontCount > 0) {
                  const chineseFontResult = await desktop.commands.run("fc-list :lang=zh | wc -l", {
                    timeoutMs: 5000,
                  });
                  const chineseFontCount = parseInt(chineseFontResult.stdout?.trim() || "0");
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
            (desktop as unknown as { _chineseInputConfigured?: boolean })._chineseInputConfigured =
              true;

            report += "\n🎉 中文输入环境配置指南生成完成！\n";

            return report;
          } catch (error) {
            return {
              type: "text" as const,
              text: `中文输入环境配置失败: ${error instanceof Error ? error.message : "未知错误"}`,
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

            // 处理 conversation_history 参数，兼容字符串和数组格式
            let processedHistory: string[] = [];
            if (conversation_history) {
              if (typeof conversation_history === "string") {
                try {
                  // 尝试解析 JSON 字符串
                  processedHistory = JSON.parse(conversation_history);
                  console.log("📋 解析了字符串格式的对话历史");
                } catch (_e) {
                  // 如果解析失败，将字符串作为单个元素的数组
                  processedHistory = [conversation_history];
                  console.log("📋 将字符串转换为单元素数组");
                }
              } else if (Array.isArray(conversation_history)) {
                processedHistory = conversation_history;
              }
            }

            // 生成回复 - 使用新的 Agent-based 智能回复
            const replyResult = await generateSmartReply({
              candidateMessage: candidate_message || "",
              conversationHistory: processedHistory,
              preferredBrand,
              modelConfig,
              configData: configData!, // 配置数据
              replyPolicy, // 回复指令
              defaultWechatId, // 默认微信号
            });

            console.log(`📝 生成的回复内容: ${replyResult.suggestedReply}`);
            console.log(`🎯 阶段: ${replyResult.turnPlan.stage}`);
            console.log(`📌 Needs: ${replyResult.turnPlan.needs.join("、") || "none"}`);
            console.log(`💬 候选人消息: ${candidate_message}`);
            console.log(`📝 对话历史: ${processedHistory.length}条消息`);
            console.log(`⚙️ 自动输入: ${auto_input ? "是" : "否"}`);

            // 为了显示统计信息，使用传入的配置数据或重新加载
            const storeDatabase = configData || (await loadZhipinData());

            let resultText = `✅ Boss直聘回复已生成：\n\n"${
              replyResult.suggestedReply
            }"\n\n📊 生成详情:\n• 候选人消息: ${
              candidate_message || "无"
            }\n• 阶段: ${replyResult.turnPlan.stage}\n• Needs: ${
              replyResult.turnPlan.needs.join("、") || "none"
            }\n• 对话历史: ${processedHistory.length}条消息\n• 使用数据: ${
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
                const inputResult = await handleChineseInput(desktop, replyResult.suggestedReply);
                resultText += `\n✅ 自动输入完成: ${inputResult}`;
                resultText += "\n\n💡 提示: 现在可以按回车键发送消息，或手动检查后发送";
              } catch (inputError) {
                console.error("自动输入失败:", inputError);
                resultText += `\n❌ 自动输入失败: ${
                  inputError instanceof Error ? inputError.message : "未知错误"
                }`;
                resultText += `\n🔄 请手动使用 type 操作输入以下内容: "${replyResult.suggestedReply}"`;
              }
            } else {
              resultText += `\n\n🚀 下一步操作: 请使用 type 动作输入以下回复内容：\n"${replyResult.suggestedReply}"\n\n💡 建议流程: 1. 执行 type 操作输入回复 → 2. 按回车发送`;
            }

            return {
              type: "text" as const,
              text: resultText,
            };
          } catch (error) {
            console.error("❌ Boss直聘回复生成失败:", error);
            return {
              type: "text" as const,
              text: `Boss直聘回复生成失败: ${error instanceof Error ? error.message : "未知错误"}`,
            };
          }
        }
        default:
          throw new Error(`Unsupported action: ${action}`);
      }
    },
    toModelOutput({ output }) {
      // AI SDK v5 格式：返回带有 type: 'content' 的对象
      if (typeof output === "string") {
        return {
          type: "content" as const,
          value: [{ type: "text" as const, text: output }],
        };
      }
      if (output.type === "image" && output.data) {
        return {
          type: "content" as const,
          value: [
            {
              type: "media" as const,
              data: output.data,
              mediaType: "image/jpeg",
            },
          ],
        };
      }
      if (output.type === "text" && output.text) {
        return {
          type: "content" as const,
          value: [{ type: "text" as const, text: output.text }],
        };
      }
      throw new Error("Invalid result format");
    },
  });

// ============================================================================
// BASH TOOL - Human-in-the-Loop (HITL) Implementation
// ============================================================================

/**
 * Bash tool for E2B sandbox mode - Auto-executes commands
 * Has execute function, so commands run automatically without confirmation
 */
export const bashToolSandbox = (sandboxId: string) =>
  tool({
    description: "Execute bash commands in the E2B sandbox",
    inputSchema: z.object({
      command: z.string().describe("The bash command to execute"),
      description: z
        .string()
        .max(50)
        .describe(
          "Brief description of what this command does (max 50 chars, e.g. '启动Chrome远程调试')"
        ),
    }),
    execute: async ({ command }) => {
      const desktop = await getDesktop(sandboxId);
      try {
        const result = await desktop.commands.run(command);
        return result.stdout || "(Command executed successfully with no output)";
      } catch (error) {
        console.error("Bash command failed in sandbox:", error);
        if (error instanceof Error) {
          return `Error executing command: ${error.message}`;
        } else {
          return `Error executing command: ${String(error)}`;
        }
      }
    },
  });

/**
 * Bash tool for local mode - Requires human confirmation (HITL)
 * No execute function, triggers frontend confirmation UI
 * Actual execution happens in API route after user confirms
 */
export const bashToolLocal = () =>
  tool({
    description:
      "Execute bash commands on the local system. Requires user confirmation before execution.",
    inputSchema: z.object({
      command: z.string().describe("The bash command to execute"),
      description: z
        .string()
        .max(50)
        .describe(
          "Brief description of what this command does (max 50 chars, e.g. '启动Chrome远程调试')"
        ),
    }),
    // outputSchema is required for tools without execute function
    outputSchema: z.string().describe("The command output or error message"),
    // No execute function - triggers HITL flow
    // Frontend will show confirmation UI
    // Backend will execute after user confirms
  });

/**
 * Universal bash tool factory - Returns appropriate version based on context
 * @param sandboxId - If provided, returns sandbox version (auto-execute)
 *                   If not provided, returns local version (HITL)
 */
export const bashTool = (sandboxId?: string) => {
  if (sandboxId) {
    return bashToolSandbox(sandboxId);
  }
  return bashToolLocal();
};

// Backward compatibility aliases
export const anthropicComputerTool35 = computerTool35;
export const anthropicBashTool35 = bashTool35;
