/**
 * Reply Prompt Builder - 回复提示构建器
 *
 * 基于Context Engineering原则优化回复生成提示构建
 * 集成Cellular Memory管理和Few-shot学习
 */

import { BasePromptBuilder } from "./base-prompt-builder";
import type {
  AtomicPrompt,
  MolecularContext,
  Example,
  BuilderConfig,
  StructuredContext,
  ExtractedFacts,
  ConversationState,
  OptimizedMemoryContext,
  WorkingMemoryValue,
  ReplyBuilderParams,
  ReplyResult,
  ContextOptimizerConfig,
} from "@/types/context-engineering";
import { CellularMemoryManager } from "../memory/cellular-memory-manager";
import { ReplyExampleRepository } from "../examples/reply-examples";
// CandidateInfo 用于 ContextOptimizer 内部方法
import type { CandidateInfo } from "@/lib/tools/zhipin/types";

// 类型已经在 @/types/context-engineering 中统一定义
// 导出以保持向后兼容
export type {
  ReplyBuilderParams,
  ReplyResult,
  ContextOptimizerConfig,
} from "@/types/context-engineering";

// ========== 上下文优化器 ==========

class ContextOptimizer {
  private config: ContextOptimizerConfig;

  constructor(config?: Partial<ContextOptimizerConfig>) {
    this.config = {
      prioritizeBrandSpecific: false, // 默认不过滤，保留完整上下文
      includeConversationHistory: true,
      maxHistoryLength: 5,
      includeExtractedFacts: true,
      ...config,
    };
  }

  /**
   * 优化上下文信息
   */
  optimizeContext(params: ReplyBuilderParams): StructuredContext {
    const conversationState: ConversationState = {
      replyType: params.classification.replyType,
      urgency: this.detectUrgency(params.message),
      sentiment: this.detectSentiment(params.message),
    };

    // 业务数据（优先品牌特定信息）
    let businessData = params.contextInfo;
    if (params.targetBrand && this.config.prioritizeBrandSpecific) {
      businessData = this.extractBrandSpecificData(params.contextInfo, params.targetBrand);
    }

    // 候选人信息
    const candidateProfile = params.candidateInfo
      ? this.formatCandidateInfo(params.candidateInfo)
      : undefined;

    // 提取的事实
    const extractedFacts =
      this.config.includeExtractedFacts && params.classification.extractedInfo
        ? this.prioritizeExtractedFacts(params.classification.extractedInfo)
        : {};

    return {
      conversationState,
      businessData,
      candidateProfile,
      extractedFacts: extractedFacts as ExtractedFacts,
    };
  }

  /**
   * 检测紧急程度
   */
  private detectUrgency(message: string): "high" | "medium" | "low" {
    const urgentKeywords = ["急", "马上", "立刻", "现在", "今天", "赶紧"];
    const moderateKeywords = ["尽快", "最近", "这几天", "本周"];

    const lowerMessage = message.toLowerCase();

    for (const keyword of urgentKeywords) {
      if (lowerMessage.includes(keyword)) return "high";
    }

    for (const keyword of moderateKeywords) {
      if (lowerMessage.includes(keyword)) return "medium";
    }

    return "low";
  }

  /**
   * 检测情绪倾向
   */
  private detectSentiment(message: string): "positive" | "neutral" | "negative" {
    const positiveKeywords = ["好的", "可以", "行", "想", "要", "感兴趣"];
    const negativeKeywords = ["不", "没", "算了", "不用了", "太"];

    let positiveCount = 0;
    let negativeCount = 0;

    for (const keyword of positiveKeywords) {
      if (message.includes(keyword)) positiveCount++;
    }

    for (const keyword of negativeKeywords) {
      if (message.includes(keyword)) negativeCount++;
    }

    if (positiveCount > negativeCount) return "positive";
    if (negativeCount > positiveCount) return "negative";
    return "neutral";
  }

  /**
   * 提取品牌特定数据
   */
  private extractBrandSpecificData(contextInfo: string, targetBrand: string): string {
    // 检查是否包含品牌相关信息
    if (!contextInfo.includes(targetBrand)) {
      return contextInfo; // 如果没有品牌信息，返回原始数据
    }

    // 智能提取：保留品牌相关的段落而不是单行
    const sections = contextInfo.split("\n\n"); // 按段落分割
    const relevantSections: string[] = [];
    let captureNext = false;

    for (const section of sections) {
      // 如果这个段落包含品牌名，或者是紧跟品牌段落的详细信息
      if (section.includes(targetBrand) || captureNext) {
        relevantSections.push(section);
        // 如果段落包含品牌标题（如"默认推荐品牌"或"品牌专属话术"），则捕获下一段
        captureNext = section.includes("品牌") && section.includes(targetBrand);
      }
      // 总是包含关键段落（如"匹配到的门店信息"）
      else if (
        section.includes("门店信息") ||
        section.includes("职位") ||
        section.includes("薪资")
      ) {
        relevantSections.push(section);
      }
    }

    // 如果找到相关段落，返回它们；否则返回原始信息
    return relevantSections.length > 0 ? relevantSections.join("\n\n") : contextInfo;
  }

  /**
   * 格式化候选人信息
   */
  private formatCandidateInfo(info: CandidateInfo): Record<string, unknown> {
    return {
      // 基本信息
      name: info.name || "未知",
      gender: info.gender,
      age: info.age,
      
      // 职业信息
      position: info.position,
      expectedSalary: info.expectedSalary,
      expectedLocation: info.expectedLocation,
      experience: info.experience,
      education: info.education,
      
      // 身体条件
      height: info.height,
      weight: info.weight,
      healthCertificate: info.healthCertificate,
      
      // 活跃度
      activeTime: info.activeTime,
      
      // 其他信息
      info: info.info,
      
      // 计算相关性分数
      relevanceScore: this.calculateRelevanceScore(info),
    };
  }

  /**
   * 计算候选人相关性分数
   * 更智能的匹配度计算，考虑服务行业的特殊需求
   */
  private calculateRelevanceScore(info: CandidateInfo): number {
    let score = 0;
    const weights = {
      // 基础信息权重
      name: 0.05,        // 有真实姓名
      position: 0.15,    // 期望职位匹配
      age: 0.10,         // 年龄信息
      gender: 0.02,      // 性别信息
      
      // 关键匹配因素权重
      expectedSalary: 0.15,     // 薪资期望
      expectedLocation: 0.15,   // 工作地点期望
      healthCertificate: 0.20,  // 健康证（服务行业关键）
      
      // 其他因素权重
      experience: 0.08,   // 工作经验
      education: 0.05,    // 学历
      activeTime: 0.05,   // 活跃度（越近越好）
    };

    // 基础信息评分
    if (info.name && info.name !== "未知" && info.name !== "候选人") {
      score += weights.name;
    }
    
    if (info.position) {
      score += weights.position;
      // 如果职位包含"店员"、"服务员"等关键词，额外加分
      if (info.position.includes("店员") || info.position.includes("服务员") || 
          info.position.includes("营业员") || info.position.includes("补货")) {
        score += 0.05;
      }
    }
    
    if (info.age) {
      score += weights.age;
      // 如果年龄在18-45岁之间（服务行业黄金年龄），额外加分
      const ageNum = parseInt(info.age);
      if (!isNaN(ageNum) && ageNum >= 18 && ageNum <= 45) {
        score += 0.03;
      }
    }
    
    if (info.gender) {
      score += weights.gender;
    }

    // 关键匹配因素评分
    if (info.expectedSalary) {
      score += weights.expectedSalary;
      // 如果薪资期望在合理范围内（如6000-8000），额外加分
      if (info.expectedSalary.includes("6000") || info.expectedSalary.includes("7000") || 
          info.expectedSalary.includes("8000")) {
        score += 0.05;
      }
    }
    
    if (info.expectedLocation) {
      score += weights.expectedLocation;
      // 如果期望地点是"上海"或包含具体区域，额外加分
      if (info.expectedLocation.includes("上海") || info.expectedLocation.includes("区")) {
        score += 0.03;
      }
    }
    
    // 健康证 - 服务行业最重要的因素之一
    if (info.healthCertificate === true) {
      score += weights.healthCertificate;
      score += 0.10; // 有健康证额外大幅加分
    } else if (info.healthCertificate === false) {
      // 明确没有健康证要扣分
      score -= 0.05;
    }

    // 其他因素评分
    if (info.experience) {
      score += weights.experience;
    }
    
    if (info.education) {
      score += weights.education;
    }
    
    // 活跃度评分 - 越近期越好
    if (info.activeTime) {
      score += weights.activeTime;
      if (info.activeTime.includes("刚刚") || info.activeTime.includes("分钟")) {
        score += 0.05; // 非常活跃
      } else if (info.activeTime.includes("小时")) {
        score += 0.03; // 较活跃
      } else if (info.activeTime.includes("昨天") || info.activeTime.includes("1天")) {
        score += 0.01; // 一般活跃
      }
    }
    
    // 身高体重（某些岗位可能有要求）
    if (info.height) {
      score += 0.02;
    }
    if (info.weight) {
      score += 0.01;
    }
    
    // 其他信息完整度
    if (info.info && Array.isArray(info.info) && info.info.length > 0) {
      score += 0.02 * Math.min(info.info.length, 3); // 最多加0.06分
    }

    // 确保分数在0-1之间
    return Math.min(Math.max(score, 0), 1);
  }

  /**
   * 优先级排序提取的事实
   */
  private prioritizeExtractedFacts(facts: unknown): Record<string, unknown> {
    const prioritized: Record<string, unknown> = {};

    // 按重要性排序
    const priorityOrder = [
      "hasUrgency",
      "specificAge",
      "mentionedBrand",
      "mentionedLocations",
      "mentionedDistricts",
      "preferredSchedule",
      "city",
    ];

    if (facts && typeof facts === "object") {
      const factsObj = facts as Record<string, unknown>;
      for (const key of priorityOrder) {
        if (factsObj[key] !== null && factsObj[key] !== undefined) {
          prioritized[key] = factsObj[key];
        }
      }
    }

    return prioritized;
  }
}

// ========== 回复提示构建器 ==========

export class ReplyPromptBuilder extends BasePromptBuilder {
  protected memoryManager: CellularMemoryManager;
  protected exampleRepo: ReplyExampleRepository;
  protected contextOptimizer: ContextOptimizer;

  constructor(
    config?: BuilderConfig & { contextOptimizerConfig?: Partial<ContextOptimizerConfig> }
  ) {
    super(config);
    this.memoryManager = new CellularMemoryManager();
    this.exampleRepo = new ReplyExampleRepository();
    this.contextOptimizer = new ContextOptimizer(config?.contextOptimizerConfig);
  }

  /**
   * 构建原子化系统提示
   */
  buildAtomicSystemPrompt(): AtomicPrompt {
    return {
      role: {
        identity: "资深餐饮连锁招聘专员",
        expertise: "3年以上餐饮行业招聘经验，成功招聘800+名员工",
        personality: "说话接地气、口语化、像朋友聊天一样自然",
        background: "熟悉各岗位要求，了解候选人关切点，擅长快速匹配人岗",
      },
      task: "生成专业招聘助手对候选人的回复",
      constraints: [
        "基于提供的策略与上下文生成回复",
        "品牌专属话术优先于通用指令",
        "敏感问题使用固定安全话术",
        "不编造事实，信息不足时追问",
        "微信号询问时不要编造，引导使用平台交换微信功能",
        "年龄问题先确认可行性再引导",
        "兼职岗位不提供五险一金，严禁承诺五险一金福利",
        "使用口语化表达，像日常聊天一样自然",
        "用'你'而不是'您'，避免过度客气",
        "避免使用感叹号、省略号等特殊标点",
        "回复要简洁明了，避免冗长",
        "语气轻松随和，不要太正式",
      ],
      outputFormat: {
        language: "中文",
        length: { min: 10, max: 100 },
        format: "plain_text",
        restrictions: [
          "单行纯文本",
          "无解释说明",
          "无前后缀",
          "无特殊符号",
          "无表情符号",
          "口语化表达",
          "使用逗号和句号即可，避免感叹号",
          "像平常聊天一样自然"
        ],
      },
    };
  }

  /**
   * 构建分子级用户提示
   */
  buildMolecularPrompt(_input: string, context: Record<string, unknown>): MolecularContext {
    const params = context as unknown as ReplyBuilderParams;

    // 加载对话历史到内存管理器
    if (params.conversationHistory.length > 0) {
      this.memoryManager.loadConversationHistory(params.conversationHistory);
    }

    // 获取优化的上下文
    const optimizedContext = this.contextOptimizer.optimizeContext(params);

    // 获取相关示例（传递上下文信息以智能选择）
    const examples = this.exampleRepo.getSimilarExamples(
      params.message,
      params.classification.replyType,
      this.config.maxExamples || 2,
      params.contextInfo
    );

    return {
      instruction: params.systemInstruction || "",
      examples,
      context: optimizedContext,
      newInput: params.message,
    };
  }

  /**
   * 获取相关示例
   */
  getRelevantExamples(
    input: string,
    context: Record<string, unknown>,
    maxExamples?: number
  ): Example[] {
    const params = context as unknown as ReplyBuilderParams;

    return this.exampleRepo.getSimilarExamples(
      input,
      params.classification.replyType,
      maxExamples || this.config.maxExamples || 2,
      params.contextInfo
    );
  }

  /**
   * 主构建方法
   */
  build(params: ReplyBuilderParams): ReplyResult {
    // 构建原子提示
    const atomic = this.buildAtomicSystemPrompt();
    const systemPrompt = this.formatAtomicPrompt(atomic);

    // 添加品牌信息到系统提示
    const finalSystemPrompt = params.targetBrand
      ? `${systemPrompt}\n\n[当前品牌]\n${params.targetBrand}`
      : systemPrompt;

    // 构建分子提示
    const molecular = this.buildMolecularPrompt(
      params.message,
      params as unknown as Record<string, unknown>
    );

    // 获取内存上下文
    const memoryContext = this.memoryManager.getOptimizedContext(this.config.tokenBudget);

    // 格式化完整提示
    const userPrompt = this.formatMolecularPromptWithMemory(molecular, memoryContext);

    // 优化token预算
    const optimizedPrompt = this.optimizeForTokenBudget(
      userPrompt,
      this.config.tokenBudget || 3000
    );

    return {
      system: finalSystemPrompt,
      prompt: optimizedPrompt,
      metadata: {
        estimatedTokens: this.estimateTokens(finalSystemPrompt + optimizedPrompt),
        usedExamples: molecular.examples.length,
        memoryUsage: Object.keys(memoryContext.facts).length,
      },
    };
  }


  /**
   * 格式化带记忆的分子提示
   */
  private formatMolecularPromptWithMemory(
    molecular: MolecularContext,
    memoryContext: OptimizedMemoryContext
  ): string {
    let prompt = "";

    // 1. 任务指令
    prompt += `[指令]\n${molecular.instruction}\n\n`;

    // 2. Few-shot示例
    if (molecular.examples.length > 0) {
      prompt += `[参考示例]\n`;
      molecular.examples.forEach((example, index) => {
        prompt += `示例${index + 1}：\n`;
        prompt += `场景: ${example.scenario}\n`;
        prompt += `输入: "${example.input}"\n`;
        prompt += `输出: ${example.output}\n`;
        if (example.reasoning) {
          prompt += `思路: ${example.reasoning}\n`;
        }
        prompt += "\n";
      });
    }

    // 3. 当前上下文
    prompt += `[当前上下文]\n`;
    const ctx = molecular.context;

    if (ctx.conversationState) {
      prompt += `- 对话类型: ${ctx.conversationState.replyType}\n`;
      prompt += `- 紧急程度: ${ctx.conversationState.urgency || "一般"}\n`;
      prompt += `- 情绪倾向: ${ctx.conversationState.sentiment || "中性"}\n`;
    }

    // 4. 对话历史（来自内存）
    if (memoryContext.recent.length > 0) {
      prompt += `\n[对话历史]\n${memoryContext.recent.join("\n")}\n\n`;
    }

    // 5. 长期记忆事实
    if (Object.keys(memoryContext.facts).length > 0) {
      prompt += `[已知事实]\n`;
      for (const [key, values] of Object.entries(memoryContext.facts)) {
        if (Array.isArray(values) && values.length > 0) {
          prompt += `- ${key}: ${values.join("、")}\n`;
        }
      }
      prompt += "\n";
    }

    // 6. 业务数据
    if (ctx.businessData) {
      prompt += `[招聘数据]\n${ctx.businessData}\n\n`;
    }

    // 7. 候选人信息
    if (ctx.candidateProfile) {
      const profile = ctx.candidateProfile;
      prompt += `[候选人资料]\n`;
      
      // 基本信息
      prompt += `- 姓名: ${profile.name || "未知"}\n`;
      if (profile.gender) prompt += `- 性别: ${profile.gender}\n`;
      if (profile.age) prompt += `- 年龄: ${profile.age}\n`;
      
      // 职业信息
      if (profile.position) prompt += `- 期望职位: ${profile.position}\n`;
      if (profile.expectedSalary) prompt += `- 期望薪资: ${profile.expectedSalary}\n`;
      if (profile.expectedLocation) prompt += `- 期望工作地: ${profile.expectedLocation}\n`;
      if (profile.experience) prompt += `- 工作经验: ${profile.experience}\n`;
      if (profile.education) prompt += `- 学历: ${profile.education}\n`;
      
      // 身体条件（服务行业重要）
      if (profile.height) prompt += `- 身高: ${profile.height}\n`;
      if (profile.weight) prompt += `- 体重: ${profile.weight}\n`;
      if (profile.healthCertificate !== undefined) {
        prompt += `- 健康证: ${profile.healthCertificate ? "有" : "无"}\n`;
      }
      
      // 活跃度信息
      if (profile.activeTime) prompt += `- 最近活跃: ${profile.activeTime}\n`;
      
      // 其他信息
      if (profile.info && Array.isArray(profile.info) && profile.info.length > 0) {
        prompt += `- 其他信息: ${profile.info.join("、")}\n`;
      }
      
      // 匹配度评分
      if ("relevanceScore" in profile && typeof profile.relevanceScore === "number") {
        prompt += `- 匹配度: ${(profile.relevanceScore * 100).toFixed(0)}%\n`;
      }
      
      prompt += "\n";
    }

    // 8. 提取的信息
    if (ctx.extractedFacts) {
      prompt += `[识别信息]\n`;
      prompt += `- 意图类型: ${ctx.conversationState?.replyType}\n`;

      const facts = ctx.extractedFacts;
      if (facts.hasUrgency) prompt += `- 紧急需求: 是\n`;
      if (facts.specificAge) prompt += `- 年龄: ${facts.specificAge}岁\n`;
      if (facts.mentionedBrand) prompt += `- 品牌: ${facts.mentionedBrand}\n`;
      if (facts.preferredSchedule) prompt += `- 时间偏好: ${facts.preferredSchedule}\n`;

      prompt += "\n";
    }

    // 9. 新输入
    prompt += `[候选人消息]\n"${molecular.newInput}"\n\n`;

    // 10. 输出要求
    prompt += `[输出要求]\n`;
    prompt += `直接输出回复内容，不要包含任何解释或前后缀。\n`;
    prompt += `重要：使用口语化表达，用'你'不用'您'，避免感叹号，语气轻松自然。\n`;
    prompt += `请基于以上信息，生成符合要求的回复。`;

    return prompt;
  }

  /**
   * 更新对话内存
   */
  updateMemory(userMessage: string, assistantReply: string): void {
    this.memoryManager.updateMemory({
      user: userMessage,
      assistant: assistantReply,
    });
  }

  /**
   * 设置工作内存
   */
  setWorkingMemory(key: string, value: WorkingMemoryValue): void {
    this.memoryManager.setWorkingMemory(key, value);
  }

  /**
   * 清理内存
   */
  cleanupMemory(): void {
    this.memoryManager.cleanupMemory();
  }

  /**
   * 创建优化的回复提示
   */
  createOptimizedReplyPrompt(params: ReplyBuilderParams): {
    system: string;
    prompt: string;
    updateMemory?: (reply: string) => void;
  } {
    const result = this.build(params);

    return {
      system: result.system,
      prompt: result.prompt,
      updateMemory: (reply: string) => {
        this.updateMemory(params.message, reply);
      },
    };
  }
}

// ========== 导出实例 ==========

export const replyBuilder = new ReplyPromptBuilder({
  maxExamples: 2,
  tokenBudget: 3000,
  enableMemory: true,
});
