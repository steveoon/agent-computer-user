import { tool } from "ai";
import { z } from "zod/v3";
import { getPuppeteerMCPClient } from "@/lib/mcp/client-manager";
import {
  PuppeteerResult,
  PuppeteerMCPResult,
  PuppeteerResultSchema,
  isPuppeteerTextResult,
  isPuppeteerImageResult,
} from "@/types/mcp";
import { compressImageServerV2 } from "@/lib/image-optimized";
import { uploadScreenshotToBailian } from "@/lib/bailian-upload";

/**
 * Puppeteer浏览器自动化工具
 *
 * 功能特性：
 * - 🌐 本地浏览器控制 - 连接和操控本地Chrome浏览器
 * - 📸 页面截图 - 支持全页面和元素截图
 * - 🖱️ 页面交互 - 点击、填充、选择、悬停等操作
 * - 📝 JavaScript执行 - 在页面上下文中执行自定义脚本
 * - 🔄 智能等待 - 自动等待元素出现和页面加载
 * - 📋 控制台日志 - 自动捕获和记录控制台输出
 *
 * 使用场景：
 * - 网页自动化测试
 * - 数据抓取和表单填充
 * - 页面截图和监控
 * - 网站功能验证
 */
export const puppeteerTool = () =>
  tool({
    description: `
      Puppeteer浏览器自动化工具，用于控制本地Chrome浏览器执行各种自动化操作。
      
      支持的操作类型：
      - connect_active_tab: 连接到浏览器标签页
      - navigate: 导航到指定URL
      - screenshot: 截取页面或元素截图
      - click: 点击页面元素
      - fill: 填充表单字段
      - select: 选择下拉选项
      - hover: 悬停在元素上
      - evaluate: 执行JavaScript代码
      
      ⚠️ 重要限制：
      - 不支持 wait 操作
      - 如需等待，请使用 evaluate 操作执行 JavaScript 等待代码
      
      注意：使用前请确保Chrome浏览器已启动并开启远程调试模式。
    `,
    inputSchema: z.object({
      action: z
        .enum([
          "connect_active_tab",
          "navigate",
          "screenshot",
          "click",
          "fill",
          "select",
          "hover",
          "evaluate",
        ])
        .describe("要执行的Puppeteer操作"),

      // 连接相关参数
      targetUrl: z.string().optional().describe("目标标签页URL，不指定则连接第一个可用标签页"),
      debugPort: z.number().optional().describe("Chrome远程调试端口，默认9222"),

      // 导航参数
      url: z.string().optional().describe("要导航到的完整URL地址"),

      // 截图参数
      name: z.string().optional().describe("截图名称，用于后续引用"),
      selector: z.string().optional().describe("CSS选择器，指定要截图的元素"),
      width: z.number().optional().describe("视口宽度（像素），默认1440"),
      height: z.number().optional().describe("视口高度（像素），默认1080"),

      // 交互参数
      value: z.string().optional().describe("要填充的文本内容或选择的option值"),

      // JavaScript执行参数
      script: z.string().optional().describe("要执行的JavaScript代码"),
    }),
    execute: async (params, _context) => {
      // 参数解构与默认值设置
      const {
        action,
        targetUrl,
        debugPort = 9222,
        url,
        name,
        selector,
        width = 1440,
        height = 1080,
        value,
        script,
      } = params;

      // 动态参数验证 - 根据操作类型验证必需参数
      const validateParams = () => {
        switch (action) {
          case "navigate":
            if (!url) throw new Error("导航操作需要url参数");
            break;
          case "screenshot":
            if (!name) throw new Error("截图操作需要name参数");
            break;
          case "click":
          case "hover":
            if (!selector) throw new Error(`${action}操作需要selector参数`);
            break;
          case "fill":
          case "select":
            if (!selector || !value) {
              throw new Error(`${action}操作需要selector和value参数`);
            }
            break;
          case "evaluate":
            if (!script) throw new Error("JavaScript执行需要script参数");
            break;
          // connect_active_tab 不需要额外验证
        }
      };

      try {
        // 执行参数验证
        validateParams();
        console.log(`🎭 执行Puppeteer操作: ${action}`);

        // 获取Puppeteer MCP客户端
        const client = await getPuppeteerMCPClient();

        // 构建MCP工具调用参数
        let mcpParams: Record<string, unknown> = {};

        switch (action) {
          case "connect_active_tab":
            mcpParams = {
              ...(targetUrl && { targetUrl }),
              ...(debugPort && { debugPort }),
            };
            break;

          case "navigate":
            mcpParams = { url };
            break;

          case "screenshot":
            mcpParams = {
              name,
              ...(selector && { selector }),
              ...(width && { width }),
              ...(height && { height }),
            };
            break;

          case "click":
          case "hover":
            mcpParams = { selector };
            break;

          case "fill":
          case "select":
            mcpParams = { selector, value };
            break;

          case "evaluate":
            mcpParams = { script };
            break;

          default:
            throw new Error(`不支持的操作: ${action}`);
        }

        // 获取MCP工具并调用
        const tools = await client.tools();
        const toolName = `puppeteer_${action}`;
        console.log(`🔧 调用MCP工具: ${toolName}`, mcpParams);

        if (!tools[toolName]) {
          throw new Error(`MCP工具 ${toolName} 不存在。可用工具: ${Object.keys(tools).join(", ")}`);
        }

        // AI SDK MCP工具调用方式
        const tool = tools[toolName] as { execute: (params: unknown) => Promise<unknown> };
        const result = await tool.execute(mcpParams);

        console.log(`✅ Puppeteer操作 ${action} 执行成功`);
        // console.log(`🔍 结果结构:`, result);

        // 处理结果（使用类型验证）
        const mcpResult = result as PuppeteerMCPResult;
        if (mcpResult && mcpResult.content && mcpResult.content.length > 0) {
          // 对于截图操作，优先查找 image 类型的内容
          if (action === "screenshot") {
            const imageContent = mcpResult.content.find(content => content.type === "image");

            if (imageContent && imageContent.type === "image") {
              // 压缩图片数据
              console.log(
                `🖼️ Puppeteer截图原始大小: ${(imageContent.data.length / 1024).toFixed(2)}KB`
              );

              const { getEnvironmentLimits } = await import("@/lib/utils/environment");
              const envLimits = getEnvironmentLimits();

              const compressedData = await compressImageServerV2(imageContent.data, {
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

              // 上传到百炼获取公网URL，避免图片字节进入模型上下文
              try {
                console.log("📤 正在上传截图到阿里云百炼...");
                const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
                const fileName = `screenshot-${timestamp}.jpg`;

                const imageUrl = await uploadScreenshotToBailian(
                  compressedData,
                  "qwen-vl-plus",
                  fileName
                );

                const imageResult: PuppeteerResult = {
                  type: "image",
                  url: imageUrl,
                  // displayData 用于 UI 显示，不会发送给 LLM（toModelOutput 只返回文本）
                  displayData: compressedData,
                };
                return PuppeteerResultSchema.parse(imageResult);
              } catch (uploadError) {
                console.error("❌ 截图上传失败，降级为本地处理:", uploadError);

                // 降级：仍然返回压缩后的图片数据
                const imageResult: PuppeteerResult = {
                  type: "image",
                  data: compressedData,
                  displayData: compressedData,
                };
                return PuppeteerResultSchema.parse(imageResult);
              }
            }
          }

          // 对于非截图操作，或者截图操作但没找到图片数据时，返回文本结果
          const textContent = mcpResult.content.find(content => content.type === "text");

          if (textContent && textContent.type === "text") {
            const textResult: PuppeteerResult = {
              type: "text",
              text: textContent.text,
            };
            return PuppeteerResultSchema.parse(textResult);
          }
        }

        // 如果结果格式不标准，尝试直接返回
        if (result && typeof result === "object") {
          const fallbackResult: PuppeteerResult = {
            type: "text",
            text: `Puppeteer操作 ${action} 执行完成: ${JSON.stringify(result, null, 2)}`,
          };
          return PuppeteerResultSchema.parse(fallbackResult);
        }

        const defaultResult: PuppeteerResult = {
          type: "text",
          text: `Puppeteer操作 ${action} 执行完成`,
        };
        return PuppeteerResultSchema.parse(defaultResult);
      } catch (error) {
        console.error(`❌ Puppeteer操作 ${action} 失败:`, error);

        // 提供详细的错误信息和解决建议
        let errorMessage = `Puppeteer操作失败: ${
          error instanceof Error ? error.message : String(error)
        }`;

        // 根据不同错误类型提供解决建议
        if (error instanceof Error) {
          // 检查是否是不支持的操作类型错误
          if (error.message.includes("Invalid enum value") && error.message.includes("wait")) {
            errorMessage = `❌ Puppeteer工具不支持 "wait" 操作。

            📝 支持的操作类型：
            - connect_active_tab: 连接浏览器标签页
            - navigate: 导航到URL
            - screenshot: 截图
            - click: 点击元素
            - fill: 填充表单
            - select: 选择下拉选项
            - hover: 悬停元素
            - evaluate: 执行JavaScript代码

            💡 如需等待，请使用以下替代方案：
            1. 使用 evaluate 操作执行 JavaScript 等待：
              script: "await new Promise(resolve => setTimeout(resolve, 3000))"
            2. 使用 evaluate 操作等待元素出现：
              script: "await new Promise(resolve => { const check = () => { if (document.querySelector('selector')) resolve(); else setTimeout(check, 100); }; check(); })"`;
          } else if (error.message.includes("Could not connect")) {
            errorMessage += `\n\n💡 解决建议：\n1. 确保Chrome浏览器已启动\n2. 启动Chrome时添加远程调试参数：\n   - Windows: chrome.exe --remote-debugging-port=${debugPort}\n   - Mac: /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=${debugPort}`;
          } else if (error.message.includes("Cannot find element")) {
            errorMessage += `\n\n💡 解决建议：\n1. 检查CSS选择器是否正确\n2. 确认元素是否存在于页面中\n3. 等待页面完全加载后再操作`;
          } else if (error.message.includes("Navigation timeout")) {
            errorMessage += `\n\n💡 解决建议：\n1. 检查网络连接\n2. 确认URL是否正确\n3. 检查目标网站是否可访问`;
          }
        }

        const errorResult: PuppeteerResult = {
          type: "text",
          text: errorMessage,
        };
        return PuppeteerResultSchema.parse(errorResult);
      }
    },
    toModelOutput({ output }) {
      try {
        // 如果result是字符串，将其包装为text类型的结果
        if (typeof output === "string") {
          console.warn("⚠️ Puppeteer工具返回了字符串而非对象，自动包装为text类型");
          // AI SDK v5 格式
          return {
            type: "content" as const,
            value: [{ type: "text" as const, text: output }],
          };
        }

        // 验证结果类型
        const validatedResult = PuppeteerResultSchema.parse(output);

        if (isPuppeteerTextResult(validatedResult)) {
          // AI SDK v5 格式
          return {
            type: "content" as const,
            value: [{ type: "text" as const, text: validatedResult.text }],
          };
        }
        if (isPuppeteerImageResult(validatedResult)) {
          // 优先使用 URL 方式，避免图片字节进入模型上下文
          if (validatedResult.url) {
            // 返回文本结果，包含图片URL信息，让上层应用处理图片展示
            // 注意：工具输出不直接支持图片URL，需要在消息层面处理
            return {
              type: "content" as const,
              value: [
                {
                  type: "text" as const,
                  text: `Screenshot captured and uploaded successfully.\n\nImage URL: ${validatedResult.url}\n\nNote: This screenshot is available for analysis. The image has been uploaded to a temporary storage and is accessible via the provided URL.`,
                },
              ],
            };
          }

          // 降级：如果只有 data 没有 URL，返回文本占位（避免 prompt too long）
          if (validatedResult.data) {
            console.warn("⚠️ 截图未上传，仅返回文本占位以避免 prompt 过长");
            return {
              type: "content" as const,
              value: [
                {
                  type: "text" as const,
                  text: "Screenshot captured but not uploaded. Image data available locally but not accessible to avoid context length limits.",
                },
              ],
            };
          }

          // 异常情况：既没有 URL 也没有 data
          return {
            type: "content" as const,
            value: [
              {
                type: "text" as const,
                text: "Screenshot operation completed but no image data available.",
              },
            ],
          };
        }
        throw new Error("Invalid Puppeteer result format");
      } catch (error) {
        console.error("❌ Puppeteer结果处理失败:", error);

        // 降级处理：无论如何都返回一个文本结果
        const errorText = error instanceof Error ? error.message : String(error);
        const fallbackText =
          typeof output === "string" ? output : `Puppeteer操作完成，但结果格式异常: ${errorText}`;

        // AI SDK v5 格式
        return {
          type: "content" as const,
          value: [{ type: "text" as const, text: fallbackText }],
        };
      }
    },
  });

/**
 * Puppeteer工具的快捷创建函数
 * @returns Puppeteer工具实例
 */
export const createPuppeteerTool = puppeteerTool;

/**
 * Puppeteer工具使用示例
 *
 * ```typescript
 * // 1. 连接到浏览器
 * await puppeteerTool.execute({
 *   action: "connect_active_tab"
 * });
 *
 * // 2. 导航到网站
 * await puppeteerTool.execute({
 *   action: "navigate",
 *   url: "https://example.com"
 * });
 *
 * // 3. 填充表单
 * await puppeteerTool.execute({
 *   action: "fill",
 *   selector: "#username",
 *   value: "user@example.com"
 * });
 *
 * // 4. 点击按钮
 * await puppeteerTool.execute({
 *   action: "click",
 *   selector: "#submit-button"
 * });
 *
 * // 5. 截图
 * await puppeteerTool.execute({
 *   action: "screenshot",
 *   name: "result",
 *   selector: ".main-content"
 * });
 * ```
 */
export const PUPPETEER_USAGE_EXAMPLES = {
  connect: { action: "connect_active_tab" as const },
  navigate: { action: "navigate" as const, url: "https://example.com" },
  fillInput: {
    action: "fill" as const,
    selector: "#username",
    value: "user@example.com",
  },
  clickButton: { action: "click" as const, selector: "#submit-button" },
  screenshot: {
    action: "screenshot" as const,
    name: "result",
    selector: ".main-content",
  },
  runScript: { action: "evaluate" as const, script: "return document.title" },
} as const;
