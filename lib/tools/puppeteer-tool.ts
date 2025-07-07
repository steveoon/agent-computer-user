import { tool } from "ai";
import { z } from "zod";
import { getPuppeteerMCPClient } from "@/lib/mcp/client-manager";
import {
  PuppeteerResult,
  PuppeteerMCPResult,
  PuppeteerResultSchema,
  isPuppeteerTextResult,
  isPuppeteerImageResult,
} from "@/types/mcp";
import { compressImageServerV2 } from "@/lib/image-optimized";

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
      
      主要功能：
      - 连接到现有Chrome浏览器或创建新实例
      - 导航到指定URL
      - 截取页面或元素截图
      - 执行点击、填充、选择等页面交互
      - 运行JavaScript代码
      - 捕获控制台日志
      
      注意：使用前请确保Chrome浏览器已启动并开启远程调试模式。
    `,
    parameters: z.object({
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
      width: z.number().optional().describe("视口宽度（像素），默认1920"),
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
        height = 900,
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
        const tool = tools[toolName];
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

              const imageResult: PuppeteerResult = {
                type: "image",
                data: compressedData,
              };
              return PuppeteerResultSchema.parse(imageResult);
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
          if (error.message.includes("Could not connect")) {
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
    experimental_toToolResultContent(result: PuppeteerResult) {
      // 验证结果类型
      const validatedResult = PuppeteerResultSchema.parse(result);

      if (isPuppeteerTextResult(validatedResult)) {
        return [{ type: "text" as const, text: validatedResult.text }];
      }
      if (isPuppeteerImageResult(validatedResult)) {
        return [
          {
            type: "image" as const,
            data: validatedResult.data,
            mimeType: "image/jpeg",
          },
        ];
      }
      throw new Error("Invalid Puppeteer result format");
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
