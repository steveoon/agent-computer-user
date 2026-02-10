/**
 * Classification Prompt Builder - 分类提示构建器（Legacy）
 *
 * 基于Context Engineering原则优化消息分类提示构建。
 * 兼容16种招聘场景意图识别，Policy-first 主路径请使用 TurnPlanningPromptBuilder 或 planTurn。
 */

import { BasePromptBuilder } from "./base-prompt-builder";
import type {
  AtomicPrompt,
  MolecularContext,
  Example,
  PromptResult,
  BuilderConfig,
  StructuredContext,
  ClassificationType,
  ClassificationParams,
  ExtractedFacts,
} from "@/types/context-engineering";
import { ClassificationTypes } from "@/types/context-engineering";

// 类型已经在 @/types/context-engineering 中统一定义
// 导出以保持向后兼容
export {
  ClassificationTypes,
  type ClassificationType,
  type ClassificationParams,
} from "@/types/context-engineering";
export type ExtractedInfo = ExtractedFacts; // 使用统一的ExtractedFacts类型

// ========== 分类示例库 ==========

class ClassificationExampleRepository {
  private examples: Map<ClassificationType, Example[]> = new Map();

  constructor() {
    this.initializeExamples();
  }

  private initializeExamples(): void {
    // 初次咨询
    this.examples.set(ClassificationTypes.INITIAL_INQUIRY, [
      {
        scenario: "初次询问工作机会",
        input: "有什么兼职工作吗？",
        output: "initial_inquiry",
        reasoningText: "候选人初次询问工作机会，没有具体指向",
      },
      {
        scenario: "探索性咨询",
        input: "想了解一下",
        output: "initial_inquiry",
        reasoningText: "候选人表达了解意向，属于初步咨询",
      },
    ]);

    // 位置咨询
    this.examples.set(ClassificationTypes.LOCATION_INQUIRY, [
      {
        scenario: "询问具体区域",
        input: "浦东有吗？",
        output: "location_inquiry",
        reasoningText: "询问特定区域是否有工作机会",
      },
      {
        scenario: "询问就近位置",
        input: "离我近的有吗？",
        output: "location_inquiry",
        reasoningText: "询问就近位置，需要了解候选人位置",
      },
    ]);

    // 薪资咨询
    this.examples.set(ClassificationTypes.SALARY_INQUIRY, [
      {
        scenario: "直接询问薪资",
        input: "工资多少？",
        output: "salary_inquiry",
        reasoningText: "直接询问薪资待遇",
      },
      {
        scenario: "询问薪资范围",
        input: "一个月能挣多少钱？",
        output: "salary_inquiry",
        reasoningText: "询问月收入，属于薪资咨询",
      },
    ]);

    // 年龄敏感话题
    this.examples.set(ClassificationTypes.AGE_CONCERN, [
      {
        scenario: "年龄偏大担忧",
        input: "我50岁了能做吗？",
        output: "age_concern",
        reasoningText: "提及年龄并询问是否合适，属于年龄敏感话题",
      },
      {
        scenario: "年龄偏小询问",
        input: "我才18岁可以吗？",
        output: "age_concern",
        reasoningText: "询问年龄是否符合要求",
      },
    ]);

    // 排班咨询
    this.examples.set(ClassificationTypes.SCHEDULE_INQUIRY, [
      {
        scenario: "询问排班灵活性",
        input: "可以只做周末吗？",
        output: "schedule_inquiry",
        reasoningText: "询问特定时间段的工作安排",
      },
      {
        scenario: "询问工作时间",
        input: "几点上班几点下班？",
        output: "schedule_inquiry",
        reasoningText: "询问具体工作时间安排",
      },
    ]);

    // 面试请求
    this.examples.set(ClassificationTypes.INTERVIEW_REQUEST, [
      {
        scenario: "主动要求面试",
        input: "我想去面试",
        output: "interview_request",
        reasoningText: "明确表达面试意向",
      },
      {
        scenario: "询问面试时间",
        input: "什么时候可以面试？",
        output: "interview_request",
        reasoningText: "询问面试安排，表达面试意向",
      },
    ]);

    // 保险福利咨询
    this.examples.set(ClassificationTypes.INSURANCE_INQUIRY, [
      {
        scenario: "询问社保",
        input: "有五险一金吗？",
        output: "insurance_inquiry",
        reasoningText: "询问保险福利，属于敏感话题",
      },
    ]);

    // 出勤相关
    this.examples.set(ClassificationTypes.ATTENDANCE_INQUIRY, [
      {
        scenario: "询问出勤要求",
        input: "需要每天都上班吗？",
        output: "attendance_inquiry",
        reasoningText: "询问出勤频率要求",
      },
    ]);

    // 兼职支持
    this.examples.set(ClassificationTypes.PART_TIME_SUPPORT, [
      {
        scenario: "询问兼职",
        input: "支持兼职吗？",
        output: "part_time_support",
        reasoningText: "询问是否支持兼职工作",
      },
    ]);
  }

  getExamplesForType(type: ClassificationType): Example[] {
    return this.examples.get(type) || [];
  }

  getAllExamples(): Example[] {
    const allExamples: Example[] = [];
    this.examples.forEach(examples => {
      allExamples.push(...examples);
    });
    return allExamples;
  }

  getMostRelevantExamples(message: string, maxExamples: number = 3): Example[] {
    const allExamples = this.getAllExamples();

    // 计算相似度并排序
    const scored = allExamples.map(example => ({
      example,
      score: this.calculateSimilarity(message, example.input),
    }));

    scored.sort((a, b) => b.score - a.score);

    // 返回最相关的示例，确保不同类型的多样性
    const selected: Example[] = [];
    const usedTypes = new Set<string>();

    for (const { example } of scored) {
      if (selected.length >= maxExamples) break;

      // 优先选择不同类型的示例以增加多样性
      if (!usedTypes.has(example.output)) {
        selected.push(example);
        usedTypes.add(example.output);
      }
    }

    // 如果还没达到maxExamples，补充其他示例
    for (const { example } of scored) {
      if (selected.length >= maxExamples) break;
      if (!selected.includes(example)) {
        selected.push(example);
      }
    }

    return selected;
  }

  private calculateSimilarity(text1: string, text2: string): number {
    const getTokens = (text: string): Set<string> => {
      const cleaned = text.replace(/[？。！，；：""''（）【】\s\?\.\!\,\;\:\"\']/g, "");

      // 中文按字符分割
      if (/[\u4e00-\u9fff]/.test(cleaned)) {
        return new Set(cleaned.split(""));
      }

      // 英文按空格分割
      return new Set(cleaned.split(/\s+/).filter(word => word.length > 0));
    };

    const tokens1 = getTokens(text1);
    const tokens2 = getTokens(text2);

    let common = 0;
    for (const token of tokens1) {
      if (tokens2.has(token)) common++;
    }

    const maxSize = Math.max(tokens1.size, tokens2.size);
    return maxSize > 0 ? common / maxSize : 0;
  }
}

// ========== 分类提示构建器 ==========

export class ClassificationPromptBuilder extends BasePromptBuilder {
  private exampleRepo: ClassificationExampleRepository;

  constructor(config?: BuilderConfig) {
    super(config);
    this.exampleRepo = new ClassificationExampleRepository();
  }

  /**
   * 构建原子化系统提示
   */
  buildAtomicSystemPrompt(): AtomicPrompt {
    return {
      task: "准确分析求职者消息的意图并提取关键信息",
      constraints: [
        "基于消息内容和对话历史综合判断意图",
        "优先识别最具体、最明确的意图类型",
        "对敏感话题（年龄、保险、身体条件）保持高度敏感",
        "区分品牌名中的地点和实际询问的工作地点",
        "提供清晰的分类依据说明",
      ],
      outputFormat: {
        language: "中文",
        length: { min: 50, max: 200 },
        format: "structured",
        restrictions: [
          "必须包含replyType字段",
          "必须包含extractedInfo字段",
          "必须包含reasoningText字段",
          // 注意：不需要添加"输出JSON格式"等指令，tool-based pattern 通过 tool calling 自动处理
        ],
      },
    };
  }

  /**
   * 构建分子级用户提示
   */
  buildMolecularPrompt(_input: string, context: ClassificationParams): MolecularContext {
    // 获取最相关的示例
    const examples = this.exampleRepo.getMostRelevantExamples(
      context.message,
      this.config.maxExamples || 3
    );

    // 构建结构化上下文，包含对话历史
    const structuredContext: StructuredContext & { conversationHistory?: string[] } = {
      conversationState: {
        replyType: "pending_classification",
      },
      businessData: context.contextInfo || "",
      candidateProfile: context.candidateInfo,
      extractedFacts: {},
      conversationHistory: context.conversationHistory,
    };

    return {
      instruction: this.buildInstruction(),
      examples,
      context: structuredContext,
      newInput: context.message,
    };
  }

  /**
   * 获取相关示例
   */
  getRelevantExamples(
    input: string,
    _context: Record<string, unknown>,
    maxExamples?: number
  ): Example[] {
    // _context 参数在当前实现中未使用，但保留以符合基类接口
    return this.exampleRepo.getMostRelevantExamples(
      input,
      maxExamples || this.config.maxExamples || 3
    );
  }

  /**
   * 主构建方法
   */
  build(context: ClassificationParams): PromptResult {
    // 构建原子提示
    const atomic = this.buildAtomicSystemPrompt();
    const systemPrompt = this.formatAtomicPrompt(atomic);

    // 构建分子提示
    const molecular = this.buildMolecularPrompt(context.message, context);
    const userPrompt = this.formatClassificationPrompt(molecular, context);

    // 优化token预算
    const optimizedPrompt = this.optimizeForTokenBudget(
      userPrompt,
      this.config.tokenBudget || 2000
    );

    return {
      system: systemPrompt,
      prompt: optimizedPrompt,
      metadata: {
        estimatedTokens: this.estimateTokens(systemPrompt + optimizedPrompt),
        usedExamples: molecular.examples.length,
      },
    };
  }

  /**
   * 格式化分类提示，包含对话历史
   */
  protected formatClassificationPrompt(
    molecular: MolecularContext,
    params: ClassificationParams
  ): string {
    const sections = [];

    // 指令部分
    sections.push(`[INSTRUCTION]\n${molecular.instruction}`);

    // Few-shot示例
    if (molecular.examples.length > 0) {
      const examplesText = molecular.examples
        .map(
          (ex, i) =>
            `Example ${i + 1}:\nInput: "${ex.input}"\nOutput: "${ex.output}"${
              ex.reasoningText ? `\nReasoning: ${ex.reasoningText}` : ""
            }`
        )
        .join("\n\n");
      sections.push(`[EXAMPLES]\n${examplesText}`);
    }

    // 对话历史
    if (params.conversationHistory && params.conversationHistory.length > 0) {
      // 限制历史长度，保留最近的10轮对话
      const recentHistory = params.conversationHistory.slice(-10);
      sections.push(`[CONVERSATION HISTORY]\n${recentHistory.join("\n")}`);
    }

    // 业务上下文
    if (params.contextInfo) {
      sections.push(`[BUSINESS CONTEXT]\n${params.contextInfo}`);
    }

    // 结构化上下文（简化版）
    const contextText = [
      `- conversationState: {"replyType":"pending_classification"}`,
      params.candidateInfo ? `- candidateProfile: ${JSON.stringify(params.candidateInfo)}` : null,
      params.brandData ? `- brandData: ${JSON.stringify(params.brandData)}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    if (contextText) {
      sections.push(`[CONTEXT]\n${contextText}`);
    }

    // 新输入
    sections.push(`[NEW INPUT]\n"${params.message}"`);

    return sections.join("\n\n");
  }

  /**
   * 构建详细指令
   */
  private buildInstruction(): string {
    return `分析求职者消息意图，识别以下16种类型之一：

招聘咨询类（1-10）：
- initial_inquiry: 初次咨询工作机会
- location_inquiry: 询问位置信息
- no_location_match: 位置无法匹配
- salary_inquiry: 询问薪资待遇
- schedule_inquiry: 询问工作时间
- interview_request: 表达面试意向
- age_concern: 年龄相关敏感话题
- insurance_inquiry: 保险福利咨询
- followup_chat: 需要跟进的对话
- general_chat: 一般性对话

出勤排班类（11-16）：
- attendance_inquiry: 询问出勤要求
- flexibility_inquiry: 询问排班灵活性
- attendance_policy_inquiry: 询问考勤政策
- work_hours_inquiry: 询问工时要求
- availability_inquiry: 询问时间段可用性
- part_time_support: 询问兼职支持

敏感话题关键词：
- 年龄：岁、多大、老了、小了
- 保险：保险、社保、五险一金
- 身体：残疾、身体、健康问题`;
  }

  /**
   * 创建优化的分类提示
   */
  createOptimizedClassificationPrompt(context: ClassificationParams): {
    system: string;
    prompt: string;
  } {
    const result = this.build(context);
    return {
      system: result.system,
      prompt: result.prompt,
    };
  }
}

// ========== 导出实例 ==========

export const classificationBuilder = new ClassificationPromptBuilder({
  maxExamples: 3,
  tokenBudget: 2000,
  enableMemory: false, // 分类不需要记忆管理
});
