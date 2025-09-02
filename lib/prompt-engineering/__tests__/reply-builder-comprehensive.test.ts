/**
 * Reply Prompt Builder 综合测试套件
 * 补充原有 context-engineering-prompt-builder.test.ts 中的全部测试用例
 * 确保新实现的功能完整性
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ReplyPromptBuilder } from "../core/reply-builder";
import { ReplyExampleRepository } from "../examples/reply-examples";
import type { ReplyBuilderParams } from "@/types/context-engineering";
import type { CandidateInfo } from "@/lib/tools/zhipin/types";

describe("ReplyPromptBuilder - 综合测试套件", () => {
  let replyBuilder: ReplyPromptBuilder;

  beforeEach(() => {
    replyBuilder = new ReplyPromptBuilder();
  });

  // ========== 3. 性能边界测试 ==========
  describe("性能边界测试", () => {
    it("应该处理极长的对话历史", () => {
      const longHistory = Array(1000)
        .fill(null)
        .map(
          (_, i) =>
            `用户: 消息${i}
助手: 回复${i}`
        );

      const params: ReplyBuilderParams = {
        message: "最新消息",
        classification: {
          replyType: "general_chat",
          extractedInfo: {},
          reasoningText: "一般对话",
        },
        contextInfo: "上下文信息",
        systemInstruction: "指令",
        conversationHistory: longHistory,
      };

      const startTime = Date.now();
      const result = replyBuilder.build(params);
      const endTime = Date.now();

      expect(result.prompt).toBeDefined();
      expect(endTime - startTime).toBeLessThan(1000); // 应该在1秒内完成
    });

    it("应该处理大量候选人信息", () => {
      const candidateInfo: CandidateInfo = {
        name: "张三",
        position: "服务员",
        age: "25",
        experience: "3年餐饮经验，熟悉各种服务流程，有良好的沟通能力",
        education: "大专",
        info: Array(50).fill("额外信息"),
        fullText: "这是一段非常非常长的候选人完整信息...".repeat(100),
      };

      const params: ReplyBuilderParams = {
        message: "我想应聘",
        classification: {
          replyType: "initial_inquiry",
          extractedInfo: {},
          reasoningText: "初次咨询",
        },
        contextInfo: "上下文",
        systemInstruction: "指令",
        conversationHistory: [],
        candidateInfo,
      };

      const result = replyBuilder.build(params);
      expect(result.prompt).toContain("张三");
      expect(result.prompt.length).toBeLessThan(20000); // 防止prompt过长
    });

    it("应该优化token使用", () => {
      const builder = new ReplyPromptBuilder();

      // 添加大量内容
      for (let i = 0; i < 100; i++) {
        builder.updateMemory(
          `这是一条很长很长很长的消息${i}`.repeat(10),
          `这是一条很长很长很长的回复${i}`.repeat(10)
        );
      }

      const params: ReplyBuilderParams = {
        message: "测试",
        classification: {
          replyType: "general_chat",
          extractedInfo: {},
          reasoningText: "测试",
        },
        contextInfo: "测试",
        systemInstruction: "测试",
        conversationHistory: [],
      };

      const result = builder.build(params);

      // 估算token数应该在预算范围内
      const estimatedTokens = result.metadata?.estimatedTokens || 0;
      expect(estimatedTokens).toBeLessThanOrEqual(3500); // 留一些余量
    });
  });

  // ========== 4. 异常处理测试 ==========
  describe("异常处理测试", () => {
    it("应该处理空消息输入", () => {
      const params: ReplyBuilderParams = {
        message: "",
        classification: {
          replyType: "general_chat",
          extractedInfo: {},
          reasoningText: "",
        },
        contextInfo: "",
        systemInstruction: "",
        conversationHistory: [],
      };

      const result = replyBuilder.build(params);
      expect(result.system).toBeDefined();
      expect(result.prompt).toBeDefined();
    });

    it("应该处理格式错误的对话历史", () => {
      const malformedHistory = [
        "没有格式的文本",
        null as any,
        undefined as any,
        123 as any,
        { invalid: "object" } as any,
      ].filter(Boolean);

      const builder = new ReplyPromptBuilder();

      // 加载错误格式的历史（通过updateMemory间接测试）
      malformedHistory.forEach(item => {
        if (typeof item === "string") {
          // 尝试解析为对话
          const parts = item.split(":");
          if (parts.length >= 2) {
            builder.updateMemory(parts[1] || "", "自动回复");
          }
        }
      });

      const params: ReplyBuilderParams = {
        message: "测试",
        classification: {
          replyType: "general_chat",
          extractedInfo: {},
          reasoningText: "测试",
        },
        contextInfo: "测试",
        systemInstruction: "测试",
        conversationHistory: malformedHistory,
      };

      const result = builder.build(params);
      expect(result).toBeDefined();
      expect(result.prompt).toBeDefined();
    });

    it("应该处理extractedInfo中的null值", () => {
      const params: ReplyBuilderParams = {
        message: "在哪里？",
        classification: {
          replyType: "location_inquiry",
          extractedInfo: {
            mentionedBrand: null,
            city: null,
            mentionedLocations: null,
            mentionedDistricts: null,
            specificAge: null,
            hasUrgency: null,
            preferredSchedule: null,
          },
          reasoningText: "位置咨询",
        },
        contextInfo: "上海",
        systemInstruction: "回复位置",
        conversationHistory: [],
      };

      const result = replyBuilder.build(params);
      expect(result.prompt).toBeDefined();
      expect(result.prompt).toContain("location_inquiry");
    });

    it("应该处理超长的品牌名称", () => {
      const longBrandName = "这是一个非常非常非常长的品牌名称".repeat(50);

      const params: ReplyBuilderParams = {
        message: "咨询",
        classification: {
          replyType: "initial_inquiry",
          extractedInfo: {},
          reasoningText: "初次咨询",
        },
        contextInfo: "上下文",
        systemInstruction: "指令",
        conversationHistory: [],
        targetBrand: longBrandName,
      };

      const result = replyBuilder.build(params);
      expect(result.system).toContain(longBrandName);
      expect(result.system.length).toBeLessThan(100000); // 防止无限增长
    });
  });

  // ========== 5. 输出质量测试 (补充) ==========
  describe("输出质量测试 - 补充", () => {
    it("生成的prompt应该结构清晰", () => {
      const params: ReplyBuilderParams = {
        message: "我想在浦东找兼职",
        classification: {
          replyType: "location_inquiry",
          extractedInfo: {
            mentionedLocations: [
              {
                location: "浦东",
                confidence: 0.9,
              },
            ],
          },
          reasoningText: "位置咨询",
        },
        contextInfo: "浦东有3家门店",
        systemInstruction: "友好回复",
        conversationHistory: ["用户: 你好", "助手: 你好"],
      };

      const result = replyBuilder.build(params);
      const sections = result.prompt.split("\n\n");

      // 应该包含多个清晰分隔的部分
      expect(sections.length).toBeGreaterThan(3);

      // 检查关键部分
      expect(result.prompt).toMatch(/\[指令\]/);
      expect(result.prompt).toMatch(/\[当前上下文\]/);
      expect(result.prompt).toMatch(/\[候选人消息\]/);
    });

    it("应该正确检测紧急程度", () => {
      const urgentMessage = "急急急！马上需要工作！";
      const normalMessage = "想了解一下工作机会";

      // 测试紧急消息
      const urgentParams: ReplyBuilderParams = {
        message: urgentMessage,
        classification: {
          replyType: "initial_inquiry",
          extractedInfo: { hasUrgency: true },
          reasoningText: "紧急咨询",
        },
        contextInfo: "上下文",
        systemInstruction: "指令",
        conversationHistory: [],
      };

      // 测试普通消息
      const normalParams: ReplyBuilderParams = {
        message: normalMessage,
        classification: {
          replyType: "initial_inquiry",
          extractedInfo: { hasUrgency: false },
          reasoningText: "普通咨询",
        },
        contextInfo: "上下文",
        systemInstruction: "指令",
        conversationHistory: [],
      };

      const urgentResult = replyBuilder.build(urgentParams);
      const normalResult = replyBuilder.build(normalParams);

      // 紧急消息应该体现紧急程度
      expect(urgentResult.prompt).toContain("紧急需求: 是");
      // 普通消息不应该标记为紧急
      expect(normalResult.prompt).not.toContain("紧急需求: 是");
    });

    it("应该保持输出格式一致性", () => {
      const scenarios = [
        { replyType: "initial_inquiry" as const, message: "找工作" },
        { replyType: "salary_inquiry" as const, message: "工资多少" },
        { replyType: "location_inquiry" as const, message: "在哪里" },
      ];

      const prompts = scenarios.map(scenario => {
        return replyBuilder.build({
          message: scenario.message,
          classification: {
            replyType: scenario.replyType,
            extractedInfo: {},
            reasoningText: "测试",
          },
          contextInfo: "上下文",
          systemInstruction: "指令",
          conversationHistory: [],
        });
      });

      // 所有prompt应该有相同的基本结构
      prompts.forEach(prompt => {
        // 新版本使用英文标签
        expect(prompt.system).toContain("[TASK]");
        expect(prompt.system).toContain("[CONSTRAINTS]");
        expect(prompt.system).toContain("[OUTPUT FORMAT]");
      });
    });

    describe("示例仓库测试", () => {
      let exampleRepo: ReplyExampleRepository;

      beforeEach(() => {
        exampleRepo = new ReplyExampleRepository();
      });

      it("应该覆盖所有主要场景", () => {
        const scenarios = [
          "initial_inquiry",
          "location_inquiry",
          "salary_inquiry",
          "age_concern",
          "schedule_inquiry",
        ];

        scenarios.forEach(scenario => {
          const examples = exampleRepo.getSimilarExamples("测试消息", scenario, 1);
          expect(examples.length).toBeGreaterThan(0);
        });
      });

      it("示例匹配相似度应该达到阈值", () => {
        // 测试高相似度场景
        const highSimilarityExamples = exampleRepo.getSimilarExamples(
          "工资多少钱？",
          "salary_inquiry",
          1
        );
        expect(highSimilarityExamples).toHaveLength(1);

        // 测试中等相似度场景
        const mediumSimilarityExamples = exampleRepo.getSimilarExamples(
          "薪水如何？",
          "salary_inquiry",
          1
        );
        expect(mediumSimilarityExamples).toHaveLength(1);
      });
    });
  });

  // ========== 6. 集成测试 ==========
  describe("集成测试", () => {
    it("应该正确处理完整的对话流程", () => {
      // 模拟多轮对话
      const conversation = [
        { user: "你好", assistant: "你好，有什么可以帮助你的？" },
        { user: "我想找兼职", assistant: "上海各区有门店岗位" },
        { user: "浦东有吗？", assistant: "浦东张江有门店" },
        { user: "工资多少？", assistant: "22元/时" },
      ];

      // 逐步更新内存
      conversation.forEach(exchange => {
        replyBuilder.updateMemory(exchange.user, exchange.assistant);
      });

      // 生成新的prompt
      const params: ReplyBuilderParams = {
        message: "什么时候可以面试？",
        classification: {
          replyType: "interview_request",
          extractedInfo: {
            mentionedLocations: [
              {
                location: "浦东",
                confidence: 0.8,
              },
            ],
          },
          reasoningText: "面试邀约",
        },
        contextInfo: "浦东张江店，服务员岗位，22元/时",
        systemInstruction: "邀请面试",
        conversationHistory: conversation.map(
          e =>
            `用户: ${e.user}
助手: ${e.assistant}`
        ),
      };

      const result = replyBuilder.build(params);

      // 应该包含历史信息
      expect(result.prompt).toContain("浦东");
      expect(result.prompt).toContain("22元/时");
      expect(result.prompt).toContain("面试");
    });

    it("应该在内存清理后仍能正常工作", () => {
      // 添加大量数据
      for (let i = 0; i < 100; i++) {
        replyBuilder.updateMemory(`消息${i}`, `回复${i}`);
      }

      // 清理内存
      replyBuilder.cleanupMemory();

      // 应该仍能生成prompt
      const params: ReplyBuilderParams = {
        message: "新消息",
        classification: {
          replyType: "general_chat",
          extractedInfo: {},
          reasoningText: "一般对话",
        },
        contextInfo: "上下文",
        systemInstruction: "指令",
        conversationHistory: [],
      };

      const result = replyBuilder.build(params);
      expect(result).toBeDefined();
      expect(result.system).toBeDefined();
      expect(result.prompt).toBeDefined();
    });
  });

  // ========== 7. 关键业务场景测试 ==========
  describe("关键业务场景测试", () => {
    // ========== 品牌专属话术优先级测试 ==========
    describe("品牌专属话术优先级", () => {
      it("应该优先使用品牌专属话术而非通用规则", () => {
        const params: ReplyBuilderParams = {
          message: "需要什么条件？日结吗？",
          classification: {
            replyType: "schedule_inquiry",
            extractedInfo: {
              mentionedBrand: "奥乐齐",
              preferredSchedule: "日结",
            },
            reasoningText: "询问排班条件",
          },
          contextInfo: "奥乐齐晚班补货，30元/时，排班灵活",
          systemInstruction: "使用品牌专属话术回复",
          conversationHistory: [
            "用户: 岗位信息: 奥乐齐-晚班补货-时薪30-全市可安排",
            "助手: 您好，这个岗位很适合您",
          ],
          targetBrand: "奥乐齐",
        };

        const result = replyBuilder.build(params);

        // 应该在系统提示中包含品牌信息
        expect(result.system).toContain("[当前品牌]");
        expect(result.system).toContain("奥乐齐");

        // 应该在用户提示中体现品牌相关信息
        expect(result.prompt).toContain("奥乐齐");
        expect(result.prompt).toContain("排班");
        expect(result.prompt).toContain("日结");
      });

      it("应该为不同品牌生成不同的提示结构", () => {
        const kfcParams: ReplyBuilderParams = {
          message: "工资多少？",
          classification: {
            replyType: "salary_inquiry",
            extractedInfo: { mentionedBrand: "肯德基" },
            reasoningText: "询问薪资",
          },
          contextInfo: "肯德基服务员22-25元/时",
          systemInstruction: "回复薪资信息",
          conversationHistory: [],
          targetBrand: "肯德基",
        };

        const aldiParams: ReplyBuilderParams = {
          ...kfcParams,
          contextInfo: "奥乐齐晚班补货30元/时",
          targetBrand: "奥乐齐",
        };

        const kfcResult = replyBuilder.build(kfcParams);
        const aldiResult = replyBuilder.build(aldiParams);

        // 品牌信息应该不同
        expect(kfcResult.system).toContain("肯德基");
        expect(aldiResult.system).toContain("奥乐齐");

        // 上下文信息应该反映不同品牌
        expect(kfcResult.prompt).toContain("22-25元/时");
        expect(aldiResult.prompt).toContain("30元/时");
      });
    });

    // ========== 信息不足追问逻辑测试 ==========
    describe("信息不足追问逻辑", () => {
      it("应该在信息不足时追问而非编造", () => {
        const params: ReplyBuilderParams = {
          message: "工资多少？",
          classification: {
            replyType: "salary_inquiry",
            extractedInfo: {},
            reasoningText: "询问薪资但缺少岗位信息",
          },
          contextInfo: "", // 故意留空
          systemInstruction: "不编造事实，信息不足时追问",
          conversationHistory: [],
        };

        const result = replyBuilder.build(params);

        // 系统提示应该强调不编造事实
        expect(result.system).toContain("不编造事实");
        expect(result.system).toContain("信息不足时追问");

        // 当contextInfo为空时，不会包含[招聘数据]部分
        // 这是预期行为，因为没有数据可显示
        if (params.contextInfo) {
          expect(result.prompt).toContain("[招聘数据]");
          // 验证系统在信息不足时不会在招聘数据部分提供具体薪资信息
          const dataSection = result.prompt.split("[招聘数据]")[1]?.split("\n")[0];
          expect(dataSection?.trim()).toBe(""); // 招聘数据部分应该为空
        } else {
          // 当没有contextInfo时，不应该有[招聘数据]部分
          expect(result.prompt).not.toContain("[招聘数据]");
        }
      });

      it("应该在缺少候选人信息时提示需要了解更多", () => {
        const params: ReplyBuilderParams = {
          message: "我想应聘",
          classification: {
            replyType: "initial_inquiry",
            extractedInfo: {},
            reasoningText: "初次咨询",
          },
          contextInfo: "多个门店有岗位空缺",
          systemInstruction: "了解候选人背景后推荐合适岗位",
          conversationHistory: [],
          candidateInfo: undefined, // 故意不提供
        };

        const result = replyBuilder.build(params);

        // 不应该包含候选人资料部分
        expect(result.prompt).not.toContain("[候选人资料]");

        // 应该引导了解候选人信息
        expect(result.prompt).toContain("[招聘数据]");
      });
    });

    // ========== 真实业务场景端到端测试 ==========
    describe("真实业务场景端到端", () => {
      it("应该正确处理45岁候选人奥乐齐晚班补货咨询场景", () => {
        // 模拟真实对话历史
        const realConversationHistory = [
          "用户: 岗位信息: 奥乐齐-晚班补货-时薪30-全市可安排",
          "助手: 您好，我仔细阅读了您发布的这个职位，觉得比较适合自己",
          "用户: 主要干啥？",
          "助手: 主要是晚班补货工作，就是把白天卖完的商品重新补到货架上",
        ];

        const candidateProfile: CandidateInfo = {
          name: "候选人",
          position: "奥乐齐-晚班补货-时薪30-全市可安排",
          age: "45",
          experience: "有相关工作经验",
          education: "高中",
          info: [],
          fullText: "",
        };

        const params: ReplyBuilderParams = {
          message: "需要什么条件？日结吗？",
          classification: {
            replyType: "schedule_inquiry",
            extractedInfo: {
              mentionedBrand: "奥乐齐",
              specificAge: 45,
              preferredSchedule: "日结",
            },
            reasoningText: "45岁候选人询问奥乐齐晚班补货的工作条件和薪资结算",
          },
          contextInfo: `匹配到的门店信息：
1. 奥乐齐浦东店 - 晚班补货 - 30元/时
2. 奥乐齐徐汇店 - 晚班补货 - 30元/时
3. 奥乐齐静安店 - 晚班补货 - 30元/时`,
          systemInstruction: "基于候选人年龄和岗位要求，专业回复排班条件",
          conversationHistory: realConversationHistory,
          candidateInfo: candidateProfile,
          targetBrand: "奥乐齐",
        };

        const result = replyBuilder.build(params);

        // 验证系统提示完整性 - 新版本使用英文标签
        expect(result.system).toContain("[TASK]");
        expect(result.system).toContain("生成专业招聘助手对候选人的回复");
        expect(result.system).toContain("品牌专属话术优先于通用指令");
        expect(result.system).toContain("年龄问题先确认可行性再引导");
        expect(result.system).toContain("[当前品牌]");
        expect(result.system).toContain("奥乐齐");

        // 验证用户提示结构
        expect(result.prompt).toContain("[指令]");
        expect(result.prompt).toContain("[参考示例]");
        expect(result.prompt).toContain("[当前上下文]");
        expect(result.prompt).toContain("schedule_inquiry");
        expect(result.prompt).toContain("[对话历史]");
        expect(result.prompt).toContain("[招聘数据]");
        expect(result.prompt).toContain("[候选人资料]");
        expect(result.prompt).toContain("[识别信息]");
        expect(result.prompt).toContain("[候选人消息]");

        // 验证关键业务信息传递
        expect(result.prompt).toContain("奥乐齐");
        expect(result.prompt).toContain("45");
        expect(result.prompt).toContain("日结");
        expect(result.prompt).toContain("30元/时");
        expect(result.prompt).toContain("晚班补货");
        expect(result.prompt).toContain("需要什么条件？日结吗？");

        // 验证对话历史完整保留
        realConversationHistory.forEach(historyItem => {
          expect(result.prompt).toContain(historyItem);
        });
      });

      it("应该处理多品牌候选人的岗位匹配场景", () => {
        const params: ReplyBuilderParams = {
          message: "有什么适合我的工作吗？",
          classification: {
            replyType: "initial_inquiry",
            extractedInfo: {
              specificAge: 28,
            },
            reasoningText: "年轻候选人询问合适岗位",
          },
          contextInfo: `匹配到的门店信息：
1. 肯德基浦东店 - 服务员 - 22-25元/时
2. 奥乐齐徐汇店 - 晚班补货 - 30元/时
3. 麦当劳静安店 - 后厨 - 24元/时`,
          systemInstruction: "根据候选人条件推荐最合适的岗位",
          conversationHistory: ["用户: 我28岁，想找份兼职", "助手: 好的，了解您的情况了"],
          candidateInfo: {
            name: "候选人",
            position: "",
            age: "28",
            experience: "2年服务业经验",
            education: "大专",
            info: [],
            fullText: "",
          },
        };

        const result = replyBuilder.build(params);

        // 应该包含多品牌信息
        expect(result.prompt).toContain("肯德基");
        expect(result.prompt).toContain("奥乐齐");
        expect(result.prompt).toContain("麦当劳");

        // 应该包含候选人年龄信息
        expect(result.prompt).toContain("28");

        // 应该有推荐逻辑指导
        expect(result.prompt).toContain("推荐");
      });
    });

    // ========== Token预算精确验证 ==========
    describe("Token预算精确验证", () => {
      it("应该精确控制各部分token使用", () => {
        const params: ReplyBuilderParams = {
          message: "工资多少？",
          classification: {
            replyType: "salary_inquiry",
            extractedInfo: { mentionedBrand: "肯德基" },
            reasoningText: "询问薪资",
          },
          contextInfo: "肯德基服务员22-25元/时，满勤另有200元奖金",
          systemInstruction: "提供完整薪资信息包括奖金",
          conversationHistory: Array(10)
            .fill(null)
            .map(
              (_, i) =>
                `用户: 消息${i}
助手: 回复${i}`
            ),
          targetBrand: "肯德基",
        };

        const result = replyBuilder.build(params);

        // 估算token数（中文约2字符/token，英文约4字符/token）
        const systemTokens = Math.ceil(result.system.length / 3); // 混合中英文
        const userTokens = Math.ceil(result.prompt.length / 3);
        const totalTokens = systemTokens + userTokens;

        // 验证系统提示token数在合理范围
        expect(systemTokens).toBeGreaterThan(50); // 至少包含基本结构
        expect(systemTokens).toBeLessThan(500); // 不应过长

        // 验证用户提示token数
        expect(userTokens).toBeGreaterThan(100); // 包含足够上下文
        expect(userTokens).toBeLessThan(2500); // 控制在预算内

        // 验证总token数
        expect(totalTokens).toBeLessThan(3000); // 总体控制

        // 验证关键信息密度
        expect(result.prompt.length / result.prompt.split("\n").length).toBeGreaterThan(8); // 每行平均长度
      });

      it("应该在超出预算时智能压缩", () => {
        // 创建超长对话历史
        const longHistory = Array(100)
          .fill(null)
          .map(
            (_, i) =>
              `用户: 这是第${i}条很长很长很长很长很长的消息内容
助手: 这是第${i}条很长很长很长很长很长的回复内容`
          );

        const params: ReplyBuilderParams = {
          message: "最新消息",
          classification: {
            replyType: "general_chat",
            extractedInfo: {},
            reasoningText: "一般对话",
          },
          contextInfo: "上下文信息".repeat(100), // 超长上下文
          systemInstruction: "指令",
          conversationHistory: longHistory,
        };

        const result = replyBuilder.build(params);
        const totalLength = result.system.length + result.prompt.length;

        // 应该被压缩到合理范围
        expect(totalLength).toBeLessThan(15000); // 总长度控制

        // 但应该保留最重要的信息
        expect(result.prompt).toContain("最新消息");
        expect(result.prompt).toContain("[候选人消息]");
      });

      it("应该准确估算不同类型文本的token数", () => {
        // 测试纯中文文本
        const chineseText = "你好，请问贵公司的工作时间是什么时候？我想了解一下薪资待遇。";
        // @ts-ignore - 访问受保护的方法用于测试
        const chineseTokens = replyBuilder.estimateTokens(chineseText);
        // 使用 tiktoken 后，期望更精确的结果
        // 中文文本通常每个字符1-2个tokens，整体约为字符数的1.5-2倍
        expect(chineseTokens).toBeGreaterThan(25); // 至少25个tokens
        expect(chineseTokens).toBeLessThan(70); // 不超过70个tokens

        // 测试纯英文文本
        const englishText =
          "Hello, I would like to know about the working hours and salary for this position.";
        // @ts-ignore - 访问受保护的方法用于测试
        const englishTokens = replyBuilder.estimateTokens(englishText);
        // 英文文本通常每个单词约1.3个tokens（约16个单词）
        expect(englishTokens).toBeGreaterThan(15); // 至少15个tokens
        expect(englishTokens).toBeLessThan(30); // 不超过30个tokens

        // 测试混合文本（中英文混合）
        const mixedText = "肯德基KFC招聘part-time服务员，薪资22-25元/hour，欢迎join我们的team！";
        // @ts-ignore - 访问受保护的方法用于测试
        const mixedTokens = replyBuilder.estimateTokens(mixedText);
        // 混合文本应该在合理范围内
        expect(mixedTokens).toBeGreaterThan(20);
        expect(mixedTokens).toBeLessThan(60);

        // 验证 token 估算的一致性
        const testText = "测试文本进行token估算";
        // @ts-ignore - 访问受保护的方法用于测试
        const tokens1 = replyBuilder.estimateTokens(testText);
        // @ts-ignore - 访问受保护的方法用于测试
        const tokens2 = replyBuilder.estimateTokens(testText);
        expect(tokens1).toBe(tokens2); // 相同文本应该返回相同的估算值

        // 测试精确性：已知的简单案例
        const simpleText = "hello";
        // @ts-ignore - 访问受保护的方法用于测试
        const simpleTokens = replyBuilder.estimateTokens(simpleText);
        expect(simpleTokens).toBe(1); // "hello" 在 cl100k_base 中是1个token

        // 测试空字符串
        const emptyText = "";
        // @ts-ignore - 访问受保护的方法用于测试
        const emptyTokens = replyBuilder.estimateTokens(emptyText);
        expect(emptyTokens).toBe(0); // 空字符串应该是0个tokens
      });
    });
  });

  // ========== 性能基准测试 ==========
  describe.skip("性能基准测试", () => {
    it("应该在合理时间内处理1000条对话", () => {
      const builder = new ReplyPromptBuilder();
      const startTime = performance.now();

      for (let i = 0; i < 1000; i++) {
        builder.updateMemory(`用户消息${i}`, `助手回复${i}`);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      console.log(`处理1000条对话耗时: ${duration}ms`);
      expect(duration).toBeLessThan(5000); // 5秒内完成
    });

    it("应该高效生成prompt", () => {
      const builder = new ReplyPromptBuilder();
      const params: ReplyBuilderParams = {
        message: "测试消息",
        classification: {
          replyType: "initial_inquiry",
          extractedInfo: {},
          reasoningText: "测试",
        },
        contextInfo: "上下文".repeat(1000),
        systemInstruction: "指令",
        conversationHistory: Array(100).fill("对话"),
      };

      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        builder.build(params);
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      console.log(`平均生成时间: ${avgTime}ms`);
      expect(avgTime).toBeLessThan(50); // 平均50ms内生成
    });
  });
});
