import { tool } from "ai";
import { z } from "zod/v3";
import { getPuppeteerMCPClient, getPlaywrightMCPClient } from "@/lib/mcp/client-manager";
import { PuppeteerMCPResult } from "@/types/mcp";
import { compressImageServerV2 } from "@/lib/image-optimized";
import { uploadScreenshotToBailian } from "@/lib/bailian-upload";

/**
 * 环境变量控制后端选择
 */
const USE_PLAYWRIGHT_MCP = process.env.USE_PLAYWRIGHT_MCP === "true";

/**
 * 截图结果类型
 */
export interface ScreenshotResult {
  type: "image";
  url?: string;
  data?: string;
  /** 用于 UI 显示的压缩后 base64 数据（不会发送给 LLM） */
  displayData?: string;
  mcpBackend: "playwright" | "puppeteer";
}

/**
 * 统一截图工具
 *
 * 功能特性：
 * - 双后端支持 - Puppeteer MCP 和 Playwright MCP
 * - 智能压缩 - 自动压缩图片以优化 token 消耗
 * - 云端存储 - 自动上传到阿里云百炼获取公网 URL
 * - 格式兼容 - 与 analyze_screenshot 工具无缝集成
 *
 * 使用场景：
 * - 页面截图和验证
 * - 视觉内容分析
 * - 自动化测试截图
 */
export const screenshotTool = () =>
  tool({
    description: `统一截图工具，支持 Puppeteer 和 Playwright 双后端。

    功能：
    - 截取当前页面或指定元素
    - 支持全页面截图（fullPage）
    - 自动压缩和上传到云端
    - 返回图片 URL 用于后续分析

    注意：
    - 元素截图（selector）仅 Puppeteer 模式支持
    - fullPage 参数仅 Playwright 模式支持
    - 结果可直接传给 analyze_screenshot 工具进行分析`,

    inputSchema: z.object({
      // 截图类型
      fullPage: z
        .boolean()
        .optional()
        .default(false)
        .describe("是否截取整个可滚动页面（仅 Playwright 模式支持）"),

      // 元素截图
      selector: z
        .string()
        .optional()
        .describe("CSS 选择器，指定要截图的元素（仅 Puppeteer 模式支持）"),

      // 图片格式
      type: z
        .enum(["png", "jpeg"])
        .optional()
        .default("jpeg")
        .describe("图片格式"),

      // 视口尺寸（仅 Puppeteer）
      width: z.number().optional().default(1440).describe("视口宽度（仅 Puppeteer 模式）"),
      height: z.number().optional().default(1080).describe("视口高度（仅 Puppeteer 模式）"),

      // 截图名称
      name: z.string().optional().describe("截图名称，用于日志追踪"),
    }),

    execute: async (params) => {
      const { fullPage, selector, type, width, height, name } = params;
      const mcpBackend = USE_PLAYWRIGHT_MCP ? "playwright" : "puppeteer";

      console.log(`📸 执行截图操作 [${mcpBackend}]`, {
        fullPage,
        selector,
        type,
        name,
      });

      try {
        let base64Data: string;

        if (USE_PLAYWRIGHT_MCP) {
          // ========== Playwright MCP 模式 ==========
          base64Data = await executePlaywrightScreenshot({ fullPage, type });
        } else {
          // ========== Puppeteer MCP 模式 ==========
          base64Data = await executePuppeteerScreenshot({
            name: name || `screenshot-${Date.now()}`,
            selector,
            width,
            height,
          });
        }

        // 处理和上传图片
        const result = await processAndUploadImage(base64Data, name);

        return {
          ...result,
          mcpBackend,
        } as ScreenshotResult;
      } catch (error) {
        console.error(`❌ 截图失败 [${mcpBackend}]:`, error);

        return {
          type: "image" as const,
          error: error instanceof Error ? error.message : String(error),
          mcpBackend,
        };
      }
    },

    toModelOutput({ output }) {
      const result = output as ScreenshotResult & { error?: string };

      if (result.error) {
        return {
          type: "content" as const,
          value: [
            {
              type: "text" as const,
              text: `Screenshot failed: ${result.error}`,
            },
          ],
        };
      }

      if (result.url) {
        return {
          type: "content" as const,
          value: [
            {
              type: "text" as const,
              text: `Screenshot captured successfully using ${result.mcpBackend} backend.\n\nImage URL: ${result.url}\n\nNote: This screenshot is available for analysis. Use the analyze_screenshot tool with this URL to get insights.`,
            },
          ],
        };
      }

      if (result.data) {
        console.warn("⚠️ 截图未上传，仅返回文本占位以避免 prompt 过长");
        return {
          type: "content" as const,
          value: [
            {
              type: "text" as const,
              text: `Screenshot captured using ${result.mcpBackend} backend but upload failed. Image data available locally.`,
            },
          ],
        };
      }

      return {
        type: "content" as const,
        value: [
          {
            type: "text" as const,
            text: "Screenshot operation completed but no image data available.",
          },
        ],
      };
    },
  });

/**
 * 执行 Playwright 截图
 */
async function executePlaywrightScreenshot(params: {
  fullPage?: boolean;
  type?: "png" | "jpeg";
}): Promise<string> {
  const client = await getPlaywrightMCPClient();
  const tools = await client.tools();

  if (!tools.browser_take_screenshot) {
    throw new Error("browser_take_screenshot tool not available");
  }

  const screenshotParams: Record<string, unknown> = {};

  if (params.fullPage) {
    screenshotParams.fullPage = true;
  }

  if (params.type) {
    screenshotParams.type = params.type;
  }

  const result = await tools.browser_take_screenshot.execute(screenshotParams);

  // Playwright MCP 截图返回格式与 evaluate 不同，直接处理
  return extractBase64FromPlaywrightScreenshot(result);
}

/**
 * 从 Playwright MCP 截图结果中提取 base64 数据
 *
 * Playwright MCP 截图可能返回的格式：
 * 1. { content: [{ type: "image", data: "base64...", mimeType: "image/png" }] }
 * 2. { content: [{ type: "text", text: "Screenshot saved to..." }] } + 文件路径
 * 3. 直接的 base64 字符串
 */
function extractBase64FromPlaywrightScreenshot(result: unknown): string {
  if (typeof result === "object" && result !== null) {
    const obj = result as Record<string, unknown>;

    // 检查 MCP 标准格式: content 数组
    if (Array.isArray(obj.content)) {
      for (const item of obj.content) {
        if (typeof item === "object" && item !== null) {
          const contentItem = item as Record<string, unknown>;

          // 图片类型内容
          if (contentItem.type === "image" && typeof contentItem.data === "string") {
            return contentItem.data;
          }

          // 文本类型 - 可能包含 base64 或文件路径信息
          if (contentItem.type === "text" && typeof contentItem.text === "string") {
            const text = contentItem.text;

            // 检查是否是 base64 数据 URI
            const dataUriMatch = text.match(/data:image\/[a-z]+;base64,([A-Za-z0-9+/=]+)/i);
            if (dataUriMatch) {
              return dataUriMatch[1];
            }

            // 检查是否直接是 base64 字符串（无前缀）
            if (/^[A-Za-z0-9+/=]{100,}$/.test(text.replace(/\s/g, ""))) {
              return text.replace(/\s/g, "");
            }
          }
        }
      }
    }

    // 直接的 data 字段
    if (typeof obj.data === "string") {
      return obj.data;
    }

    // 嵌套的 image 字段
    if (typeof obj.image === "string") {
      return obj.image;
    }
  }

  // 如果结果本身是 base64 字符串
  if (typeof result === "string" && result.length > 100) {
    const base64Match = result.match(/^data:image\/[a-z]+;base64,(.+)$/i);
    if (base64Match) {
      return base64Match[1];
    }

    if (/^[A-Za-z0-9+/=]+$/.test(result.replace(/\s/g, ""))) {
      return result;
    }
  }

  throw new Error("Failed to extract base64 data from Playwright screenshot result");
}

/**
 * 执行 Puppeteer 截图
 */
async function executePuppeteerScreenshot(params: {
  name: string;
  selector?: string;
  width?: number;
  height?: number;
}): Promise<string> {
  const client = await getPuppeteerMCPClient();
  const tools = await client.tools();

  const tool = tools["puppeteer_screenshot"] as
    | { execute: (params: unknown) => Promise<unknown> }
    | undefined;

  if (!tool) {
    throw new Error("puppeteer_screenshot tool not available");
  }

  const mcpParams: Record<string, unknown> = {
    name: params.name,
  };

  if (params.selector) {
    mcpParams.selector = params.selector;
  }

  if (params.width) {
    mcpParams.width = params.width;
  }

  if (params.height) {
    mcpParams.height = params.height;
  }

  const result = await tool.execute(mcpParams);
  const mcpResult = result as PuppeteerMCPResult;

  // 从 Puppeteer MCP 结果中提取 base64 数据
  const imageContent = mcpResult?.content?.find((c) => c.type === "image");

  if (imageContent && imageContent.type === "image") {
    return imageContent.data;
  }

  throw new Error("No image data in Puppeteer screenshot result");
}
/**
 * 处理图片：压缩 + 上传
 *
 * 返回值说明：
 * - url: OSS URL，用于 LLM 分析
 * - displayData: 压缩后的 base64，用于 UI 显示（不会发送给 LLM）
 * - data: 仅在上传失败时使用的降级数据
 */
async function processAndUploadImage(
  base64Data: string,
  name?: string
): Promise<{ type: "image"; url?: string; data?: string; displayData?: string }> {
  // 压缩图片
  console.log(`🖼️ 原始截图大小: ${(base64Data.length / 1024).toFixed(2)}KB`);

  const { getEnvironmentLimits } = await import("@/lib/utils/environment");
  const envLimits = getEnvironmentLimits();

  const compressedData = await compressImageServerV2(base64Data, {
    targetSizeKB: envLimits.compressionTargetKB,
    maxSizeKB: envLimits.compressionMaxKB,
    maxQuality: 95,
    minQuality: 60,
    enableAdaptive: true,
    preserveText: true,
  });

  console.log(`✅ 压缩完成，当前大小: ${(compressedData.length / 1024).toFixed(2)}KB`);

  // 上传到百炼
  try {
    console.log("📤 正在上传截图到阿里云百炼...");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = name ? `${name}-${timestamp}.jpg` : `screenshot-${timestamp}.jpg`;

    const imageUrl = await uploadScreenshotToBailian(compressedData, "qwen-vl-plus", fileName);

    console.log(`✅ 上传成功: ${imageUrl}`);

    return {
      type: "image",
      url: imageUrl,
      // 保留压缩后的 base64 用于 UI 显示
      displayData: compressedData,
    };
  } catch (uploadError) {
    console.error("❌ 截图上传失败，降级为本地处理:", uploadError);

    // 降级：返回压缩后的图片数据
    return {
      type: "image",
      data: compressedData,
      displayData: compressedData,
    };
  }
}

/**
 * 快捷创建函数
 */
export const createScreenshotTool = screenshotTool;

/**
 * 工具名称常量
 */
export const SCREENSHOT_TOOL_NAME = "screenshot";
