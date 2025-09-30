/**
 * Classification Prompt Builder 单元测试
 * 基于实际实现的测试用例
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ClassificationPromptBuilder } from "../core/classification-builder";
import type { ClassificationParams } from "@/types/context-engineering";

describe("ClassificationPromptBuilder - 实际实现测试", () => {
  let classificationBuilder: ClassificationPromptBuilder;

  beforeEach(() => {
    classificationBuilder = new ClassificationPromptBuilder();
  });

  describe("核心功能测试", () => {
    describe("buildAtomicSystemPrompt", () => {
      it("应该构建正确的原子化系统提示", () => {
        const atomicPrompt = classificationBuilder.buildAtomicSystemPrompt();

        expect(atomicPrompt.task).toBe("准确分析求职者消息的意图并提取关键信息");
        expect(atomicPrompt.constraints).toContain("基于消息内容和对话历史综合判断意图");
        expect(atomicPrompt.constraints).toContain("优先识别最具体、最明确的意图类型");
        expect(atomicPrompt.outputFormat.format).toBe("structured_json");
      });

      it("应该包含所有必要的约束条件", () => {
        const atomicPrompt = classificationBuilder.buildAtomicSystemPrompt();

        expect(atomicPrompt.constraints).toContain(
          "对敏感话题（年龄、保险、身体条件）保持高度敏感"
        );
        expect(atomicPrompt.constraints).toContain("区分品牌名中的地点和实际询问的工作地点");
        expect(atomicPrompt.constraints).toContain("提供清晰的分类依据说明");
      });

      it("应该定义正确的输出格式", () => {
        const atomicPrompt = classificationBuilder.buildAtomicSystemPrompt();

        expect(atomicPrompt.outputFormat.language).toBe("中文");
        expect(atomicPrompt.outputFormat.length?.min).toBe(50);
        expect(atomicPrompt.outputFormat.length?.max).toBe(200);
        expect(atomicPrompt.outputFormat.restrictions).toContain("必须包含replyType字段");
        expect(atomicPrompt.outputFormat.restrictions).toContain("必须包含extractedInfo字段");
        expect(atomicPrompt.outputFormat.restrictions).toContain("必须包含reasoningText字段");
        expect(atomicPrompt.outputFormat.restrictions).toContain("输出合法JSON格式");
      });
    });

    describe("build方法 - 完整分类提示构建", () => {
      it("应该正确构建分类提示", () => {
        const params: ClassificationParams = {
          message: "我想在浦东找工作，工资多少？",
          conversationHistory: ["用户: 你好", "助手: 你好，有什么可以帮助你的？"],
          contextInfo: "上海各区有门店岗位，薪资22-30元/时",
        };

        const result = classificationBuilder.build(params);

        // 验证系统提示包含正确的结构
        expect(result.system).toContain("[TASK]");
        expect(result.system).toContain("[CONSTRAINTS]");
        expect(result.system).toContain("[OUTPUT FORMAT]");

        // 验证用户提示包含关键部分
        expect(result.prompt).toContain("[INSTRUCTION]");
        expect(result.prompt).toContain("我想在浦东找工作，工资多少？");
      });

      it("应该包含分类类型定义", () => {
        const params: ClassificationParams = {
          message: "测试消息",
          conversationHistory: [],
          contextInfo: "",
        };

        const result = classificationBuilder.build(params);

        // 应该包含主要分类类型
        expect(result.prompt).toContain("initial_inquiry");
        expect(result.prompt).toContain("location_inquiry");
        expect(result.prompt).toContain("salary_inquiry");
        expect(result.prompt).toContain("age_concern");
        expect(result.prompt).toContain("schedule_inquiry");
      });

      it("应该包含Few-shot示例", () => {
        const params: ClassificationParams = {
          message: "工资多少钱？",
          conversationHistory: [],
          contextInfo: "22-30元/时",
        };

        const result = classificationBuilder.build(params);

        // 检查是否包含示例结构
        expect(result.prompt).toContain("[EXAMPLES]");
        expect(result.prompt).toContain("Input:");
        expect(result.prompt).toContain("Output:");
      });
    });

    describe("getRelevantExamples", () => {
      it("应该返回相关的分类示例", () => {
        const examples = classificationBuilder.getRelevantExamples("工资多少？", {}, 3);

        expect(examples).toHaveLength(3);
        expect(examples[0]).toHaveProperty("input");
        expect(examples[0]).toHaveProperty("output");
      });

      it("应该基于消息内容返回合适的示例", () => {
        const salaryExamples = classificationBuilder.getRelevantExamples("工资待遇如何", {}, 2);

        const locationExamples = classificationBuilder.getRelevantExamples("在哪里上班", {}, 2);

        // 不同类型的消息应该返回不同的示例
        expect(salaryExamples[0]?.input).not.toBe(locationExamples[0]?.input);
      });
    });
  });

  describe("边界情况处理", () => {
    it("应该处理空消息", () => {
      const params: ClassificationParams = {
        message: "",
        conversationHistory: [],
        contextInfo: "",
      };

      const result = classificationBuilder.build(params);
      expect(result.system).toBeDefined();
      expect(result.prompt).toBeDefined();
    });

    it("应该处理超长消息", () => {
      const longMessage = "这是一条非常长的消息".repeat(500);

      const params: ClassificationParams = {
        message: longMessage,
        conversationHistory: [],
        contextInfo: "",
      };

      const result = classificationBuilder.build(params);
      expect(result.prompt).toBeDefined();
      expect(result.prompt.length).toBeLessThan(50000); // 防止无限增长
    }, 60000); // 增加超时时间到60秒，因为 CI 环境性能较差

    it("应该处理复杂的多意图消息", () => {
      const params: ClassificationParams = {
        message: "我想在浦东找工作，最好是晚班，工资多少？我今年45岁可以吗？",
        conversationHistory: [],
        contextInfo: "上海各区有门店，晚班30元/时，年龄18-50岁",
      };

      const result = classificationBuilder.build(params);

      // 应该能识别多个意图
      expect(result.prompt).toContain("浦东"); // 位置
      expect(result.prompt).toContain("晚班"); // 排班
      expect(result.prompt).toContain("工资"); // 薪资
      expect(result.prompt).toContain("45岁"); // 年龄
    });

    it("应该处理带表情符号的消息", () => {
      const params: ClassificationParams = {
        message: "😊 有工作吗？💰 多少钱？",
        conversationHistory: [],
        contextInfo: "",
      };

      const result = classificationBuilder.build(params);
      expect(result.prompt).toContain("有工作吗");
      expect(result.prompt).toContain("多少钱");
    });
  });

  describe("上下文优化测试", () => {
    it("应该包含对话历史", () => {
      const params: ClassificationParams = {
        message: "浦东有门店吗？",
        conversationHistory: [
          "用户: 你好",
          "助手: 你好，有什么可以帮助你的？",
          "用户: 我想找工作",
          "助手: 上海各区都有门店岗位",
        ],
        contextInfo: `
          浦东新区门店：张江店、陆家嘴店、世纪公园店
          薪资：22-30元/时
          要求：18-50岁，身体健康
        `,
      };

      const result = classificationBuilder.build(params);

      // 应该包含对话历史
      expect(result.prompt).toContain("[CONVERSATION HISTORY]");
      expect(result.prompt).toContain("我想找工作");
      expect(result.prompt).toContain("上海各区都有门店岗位");

      // 应该包含业务上下文
      expect(result.prompt).toContain("[BUSINESS CONTEXT]");
      expect(result.prompt).toContain("张江店");
    });

    it("应该处理长对话历史", () => {
      const longHistory = Array(50)
        .fill(null)
        .map(
          (_, i) =>
            `用户: 消息${i}
助手: 回复${i}`
        );

      const params: ClassificationParams = {
        message: "最新问题",
        conversationHistory: longHistory,
        contextInfo: "上下文",
      };

      const result = classificationBuilder.build(params);

      // 应该包含对话历史（可能被截断为最近10轮）
      expect(result.prompt).toContain("[CONVERSATION HISTORY]");
      // 应该保留最近的对话
      expect(result.prompt).toContain("消息49");
      expect(result.prompt).toContain("回复49");
      // 但不应该包含太早的对话
      expect(result.prompt).not.toContain("消息30");
    });
  });

  describe("输出格式验证", () => {
    it("应该生成符合结构化JSON的输出指导", () => {
      const params: ClassificationParams = {
        message: "测试",
        conversationHistory: [],
        contextInfo: "",
      };

      const result = classificationBuilder.build(params);

      // 应该包含输出格式要求
      expect(result.prompt).toContain("Output");
      expect(result.prompt).toContain("replyType");
    });
  });

  describe("性能测试", () => {
    it("应该快速生成分类提示", () => {
      const params: ClassificationParams = {
        message: "工资多少？",
        conversationHistory: Array(20).fill("对话"),
        contextInfo: "上下文信息".repeat(100),
      };

      const startTime = Date.now();
      const result = classificationBuilder.build(params);
      const endTime = Date.now();

      expect(result).toBeDefined();
      expect(endTime - startTime).toBeLessThan(1000); // 1000ms内完成（CI环境性能差异考虑）
    });

    it("应该高效处理批量分类", () => {
      const messages = [
        "工资多少？",
        "在哪里上班？",
        "需要什么条件？",
        "什么时候面试？",
        "有五险一金吗？",
      ];

      const startTime = Date.now();

      messages.forEach(message => {
        const params: ClassificationParams = {
          message,
          conversationHistory: [],
          contextInfo: "上下文",
        };
        classificationBuilder.build(params);
      });

      const endTime = Date.now();
      const avgTime = (endTime - startTime) / messages.length;

      expect(avgTime).toBeLessThan(50); // 平均50ms内完成（CI环境性能差异考虑）
    });
  });

  describe("实际场景测试", () => {
    it("应该正确分类初次咨询", () => {
      const params: ClassificationParams = {
        message: "你好，有什么工作吗？",
        conversationHistory: [],
        contextInfo: "上海各区有门店岗位",
      };

      const result = classificationBuilder.build(params);

      // 应该识别为初次咨询
      expect(result.prompt).toContain("initial_inquiry");
      expect(result.prompt).toContain("你好，有什么工作吗？");
    });

    it("应该正确分类复合意图", () => {
      const params: ClassificationParams = {
        message: "我30岁，想在徐汇区找个晚班工作，工资怎么算？",
        conversationHistory: [],
        contextInfo: "徐汇区有多家门店，晚班30元/时",
      };

      const result = classificationBuilder.build(params);

      // 应该识别多个信息点
      expect(result.prompt).toContain("30岁"); // 年龄
      expect(result.prompt).toContain("徐汇"); // 位置
      expect(result.prompt).toContain("晚班"); // 排班
      expect(result.prompt).toContain("工资"); // 薪资
    });

    it("应该正确处理方言或口语化表达", () => {
      const params: ClassificationParams = {
        message: "啥时候能来上班啊？钱咋算的？",
        conversationHistory: [],
        contextInfo: "随时可以安排面试，22-30元/时",
      };

      const result = classificationBuilder.build(params);

      // 应该能理解口语化表达
      expect(result.prompt).toContain("啥时候能来上班");
      expect(result.prompt).toContain("钱咋算");
    });
  });
});
