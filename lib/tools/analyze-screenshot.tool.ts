import { tool } from "ai";
import { z } from 'zod/v3';
import type { AutomationResult } from "./zhipin/types";

/**
 * 截图分析结果类型
 */
type ScreenshotAnalysis = {
  summary: string;
  details: string;
  keyElements: string[];
  extractedText?: string;
  suggestions?: string;
};

/**
 * 尝试解析结构化响应
 */
function parseStructuredResponse(content: string): Partial<ScreenshotAnalysis> | null {
  try {
    // 尝试找到JSON块
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      return JSON.parse(jsonMatch[1]);
    }

    // 尝试直接解析为JSON
    const trimmedContent = content.trim();
    if (trimmedContent.startsWith("{") && trimmedContent.endsWith("}")) {
      return JSON.parse(trimmedContent);
    }
  } catch {
    // JSON解析失败，返回null
  }
  return null;
}

/**
 * 从非结构化文本中提取关键信息
 */
function extractFromUnstructuredText(content: string): ScreenshotAnalysis {
  // 提取第一段作为摘要
  const paragraphs = content.split("\n").filter(p => p.trim().length > 0);
  const summary = paragraphs[0]?.substring(0, 200) || "图片分析完成";

  // 提取包含关键词的段落作为关键元素
  const keyElements: string[] = [];
  const keywords = ["界面", "按钮", "菜单", "标题", "输入框", "列表", "图标", "文字", "内容"];

  paragraphs.forEach(p => {
    if (keywords.some(kw => p.includes(kw)) && keyElements.length < 5) {
      keyElements.push(p.substring(0, 100));
    }
  });

  return {
    summary,
    details: content,
    keyElements: keyElements.length > 0 ? keyElements : ["已识别图片内容"],
    extractedText: undefined,
    suggestions: undefined,
  };
}

/**
 * 截图分析工具
 *
 * 功能：
 * - 接收图片URL（通常来自截图工具）
 * - 使用视觉模型分析截图内容
 * - 返回结构化的分析结果
 */
export const analyzeScreenshotTool = () =>
  tool({
    description: `截图分析工具
    
    功能：
    - 分析通过URL提供的截图内容
    - 识别截图中的关键元素和文本
    - 提供基于视觉内容的分析和建议
    
    使用场景：
    - 分析网页截图
    - 识别UI元素和布局
    - 提取截图中的文本信息
    - 验证操作结果
    
    注意：
    - 图片URL必须是公网可访问的
    - 支持常见图片格式（JPG、PNG等）
    - 使用阿里云百炼视觉模型进行分析`,

    inputSchema: z.object({
      imageUrl: z.string().describe("要分析的截图URL（如：oss://bucket/path/screenshot.jpg）"),
      analysisPrompt: z.string().optional().describe("分析提示（可选），指定要重点关注的内容"),
      modelName: z
        .string()
        .optional()
        .default("qwen-vl-plus")
        .describe("百炼视觉模型名称，如：qwen-vl-plus, qwen-vl-max"),
    }),

    execute: async ({
      imageUrl,
      analysisPrompt,
      modelName = "qwen-vl-plus",
    }): Promise<AutomationResult<ScreenshotAnalysis>> => {
      try {
        console.log(`🔍 开始分析截图: ${imageUrl}`);
        console.log(`🤖 使用百炼视觉模型: ${modelName}`);

        // 从环境变量获取API Key
        const apiKey = process.env.DASHSCOPE_API_KEY;
        if (!apiKey) {
          throw new Error("请设置 DASHSCOPE_API_KEY 环境变量");
        }

        // 构建结构化分析提示
        const structuredPrompt = `请分析这张截图，并按以下JSON格式返回结果：
\`\`\`json
{
  "summary": "一句话概述图片内容",
  "details": "详细描述图片内容，包括布局、元素、颜色等",
  "keyElements": ["关键元素1", "关键元素2", "..."],
  "extractedText": "识别出的重要文字内容",
  "suggestions": "基于内容的操作建议或分析结论"
}
\`\`\`

${analysisPrompt ? `特别关注：${analysisPrompt}` : ""}`;

        const finalPrompt =
          analysisPrompt && !analysisPrompt.includes("JSON") ? analysisPrompt : structuredPrompt;

        // 使用百炼视觉API进行分析
        const response = await fetch(
          "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              "X-DashScope-OssResourceResolve": "enable", // 重要：启用OSS资源解析
            },
            body: JSON.stringify({
              model: modelName,
              messages: [
                {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: finalPrompt,
                    },
                    {
                      type: "image_url",
                      image_url: { url: imageUrl },
                    },
                  ],
                },
              ],
              temperature: 0.3,
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`百炼API调用失败: ${response.status} ${errorText}`);
        }

        const result = await response.json();

        if (!result.choices || !result.choices[0]) {
          throw new Error("百炼API返回格式异常");
        }

        const content = result.choices[0].message.content;
        console.log(`✅ 百炼视觉分析完成，内容长度: ${content.length}字符`);

        // 尝试解析结构化响应
        const structuredData = parseStructuredResponse(content);

        let analysis: ScreenshotAnalysis;

        if (structuredData && structuredData.summary && structuredData.details) {
          // 使用结构化数据
          analysis = {
            summary: structuredData.summary || "图片分析完成",
            details: structuredData.details || content,
            keyElements: structuredData.keyElements || [],
            extractedText: structuredData.extractedText,
            suggestions: structuredData.suggestions,
          };
          console.log("📊 成功解析结构化响应");
        } else {
          // 降级到非结构化文本提取
          analysis = extractFromUnstructuredText(content);
          console.log("📝 使用非结构化文本提取");
        }

        return {
          success: true,
          data: analysis,
        };
      } catch (error) {
        console.error("❌ 截图分析失败:", error);

        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error occurred",
        };
      }
    },
  });

/**
 * 快捷创建函数
 */
export const createAnalyzeScreenshotTool = analyzeScreenshotTool;

// 导出工具
export const ANALYZE_SCREENSHOT_ACTION = "analyze_screenshot";
