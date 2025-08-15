/**
 * Reply Examples Repository - 回复示例库
 * 
 * 为回复生成提供高质量的Few-shot示例
 * 基于真实业务场景设计
 */

import type { Example } from '../core/base-prompt-builder';

/**
 * 回复示例仓库
 */
export class ReplyExampleRepository {
  private examples: Map<string, Example[]> = new Map();

  constructor() {
    this.initializeExamples();
  }

  /**
   * 初始化高质量示例
   */
  private initializeExamples(): void {
    // 初次咨询示例
    this.examples.set("initial_inquiry", [
      {
        scenario: "初次咨询-积极意向",
        input: "有什么兼职工作吗？",
        output: "徐汇区肯德基有服务员岗位，22元/时，排班灵活，你在哪个区？",
        reasoning: "候选人有明确意向，提供具体信息并询问位置以匹配门店",
        metadata: { context: "徐汇区肯德基，服务员岗位，22元/时" }
      },
      {
        scenario: "初次咨询-探索性",
        input: "想了解一下",
        output: "上海各区都有门店岗位空缺，兼职全职都可以，你想做什么岗位呢？",
        reasoning: "候选人意向不明确，先了解岗位偏好",
        metadata: { context: "多个门店有空缺" }
      }
    ]);

    // 位置咨询示例
    this.examples.set("location_inquiry", [
      {
        scenario: "明确位置",
        input: "浦东有吗？",
        output: "浦东张江高科地铁站旁有门店，早晚班都缺人，方便过来面试吗？",
        reasoning: "有匹配门店，提供具体位置并推进面试",
        metadata: { context: "浦东新区张江店有空缺" }
      },
      {
        scenario: "模糊位置",
        input: "离我近的有吗？",
        output: "你在哪个区？我帮你查下最近的门店",
        reasoning: "需要先获取位置信息",
        metadata: { context: "需要了解候选人位置" }
      }
    ]);

    // 薪资咨询示例
    this.examples.set("salary_inquiry", [
      {
        scenario: "直接询问薪资",
        input: "工资多少？",
        output: "服务员22-25元/时，满勤另有200元奖金，月入4000-5000元",
        reasoning: "提供完整薪资信息包括奖金",
        metadata: { context: "服务员22-25元/时，有奖金" }
      },
      {
        scenario: "薪资咨询-信息不足",
        input: "工资怎么样？",
        output: "你想了解哪个岗位的工资？不同岗位薪资不同",
        reasoning: "信息不足时先询问具体岗位",
        metadata: { context: "需要了解具体岗位" }
      }
    ]);

    // 年龄敏感话题示例
    this.examples.set("age_concern", [
      {
        scenario: "年龄偏大",
        input: "我50岁了能做吗？",
        output: "洗碗工岗位不限年龄，50岁完全可以，工作轻松，你考虑吗？",
        reasoning: "积极回应，提供合适岗位",
        metadata: { context: "洗碗工岗位年龄不限" }
      },
      {
        scenario: "年龄偏小",
        input: "我才18岁可以吗？",
        output: "18岁可以的，带上身份证来面试就行",
        reasoning: "确认符合要求，推进面试",
        metadata: { context: "需要年满18岁" }
      }
    ]);

    // 排班相关示例
    this.examples.set("schedule_inquiry", [
      {
        scenario: "询问排班灵活性",
        input: "可以只做周末吗？",
        output: "可以只做周末，周六日都有班次空缺，一天8小时，你方便哪天？",
        reasoning: "确认可行性，询问具体时间",
        metadata: { context: "支持兼职，周末班有空缺" }
      }
    ]);

    // 面试请求示例
    this.examples.set("interview_request", [
      {
        scenario: "主动要求面试",
        input: "我想去面试",
        output: "好的，明天上午10点到下午5点都可以面试，你什么时候方便？",
        reasoning: "积极响应，安排具体时间",
        metadata: { context: "可安排面试" }
      }
    ]);

    // 保险福利咨询
    this.examples.set("insurance_inquiry", [
      {
        scenario: "询问社保",
        input: "有五险一金吗？",
        output: "全职有社保，兼职按小时计费，你想做全职还是兼职？",
        reasoning: "说明福利政策，了解工作意向",
        metadata: { context: "全职有社保，兼职无" }
      }
    ]);

    // 出勤相关
    this.examples.set("attendance_inquiry", [
      {
        scenario: "询问出勤要求",
        input: "需要每天都上班吗？",
        output: "不需要，可以根据你的时间安排，每周至少3天就行",
        reasoning: "说明灵活性，降低门槛",
        metadata: { context: "灵活排班" }
      }
    ]);

    // 跟进对话
    this.examples.set("followup_chat", [
      {
        scenario: "继续了解",
        input: "还有其他要求吗？",
        output: "主要就是认真负责，有服务意识就行，其他都可以培训",
        reasoning: "降低顾虑，强调可培训",
        metadata: { context: "基础要求" }
      }
    ]);

    // 一般对话
    this.examples.set("general_chat", [
      {
        scenario: "一般咨询",
        input: "好的",
        output: "还有什么想了解的吗？我可以帮你详细介绍",
        reasoning: "保持对话继续，提供更多信息机会",
        metadata: { context: "保持沟通" }
      }
    ]);
  }

  /**
   * 获取指定类型的示例
   */
  getExamplesForType(replyType: string): Example[] {
    return this.examples.get(replyType) || [];
  }

  /**
   * 根据相似度获取示例
   */
  getSimilarExamples(
    input: string,
    replyType: string,
    maxExamples: number = 2,
    contextInfo?: string
  ): Example[] {
    let typeExamples = this.examples.get(replyType) || [];
    
    // 如果上下文信息不足，优先过滤掉包含具体数字的示例
    if (!contextInfo || contextInfo.trim() === '') {
      const genericExamples = typeExamples.filter(example => 
        !this.containsSpecificNumbers(example.output)
      );
      
      if (genericExamples.length > 0) {
        typeExamples = genericExamples;
      }
    }
    
    // 简单的关键词匹配相似度
    const scored = typeExamples.map(example => ({
      example,
      score: this.calculateSimilarity(input, example.input)
    }));

    // 按相似度排序
    scored.sort((a, b) => b.score - a.score);
    
    return scored.slice(0, maxExamples).map(s => s.example);
  }

  /**
   * 获取所有示例（用于调试或导出）
   */
  getAllExamples(): Map<string, Example[]> {
    return new Map(this.examples);
  }

  /**
   * 添加新示例
   */
  addExample(replyType: string, example: Example): void {
    if (!this.examples.has(replyType)) {
      this.examples.set(replyType, []);
    }
    const examples = this.examples.get(replyType);
    if (examples) {
      examples.push(example);
    }
  }

  /**
   * 检查文本是否包含具体数字（薪资、时间等）
   */
  private containsSpecificNumbers(text: string): boolean {
    // 检查薪资数字模式
    const salaryPattern = /\d+(-\d+)?元\/时/;
    const agePattern = /\d+岁/;
    const timePattern = /\d+小时/;
    const moneyPattern = /\d+元/;
    
    return salaryPattern.test(text) || 
           agePattern.test(text) || 
           timePattern.test(text) ||
           moneyPattern.test(text);
  }

  /**
   * 计算相似度（简化版，支持中文）
   */
  private calculateSimilarity(text1: string, text2: string): number {
    const getTokens = (text: string): Set<string> => {
      // 移除标点符号
      const cleaned = text.replace(/[？。！，；：""''（）【】\s\?\.\!\,\;\:\"\']/g, '');
      
      // 如果包含中文，按字符分割
      if (/[\u4e00-\u9fff]/.test(cleaned)) {
        return new Set(cleaned.split(''));
      }
      
      // 否则按空格分割
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

// 导出单例实例
export const replyExampleRepository = new ReplyExampleRepository();