/**
 * Base Prompt Builder - Context Engineering架构基础类
 * 
 * 基于Context Engineering三原则设计：
 * 1. Atomic Prompting - 原子化提示结构
 * 2. Molecular Context - 分子级上下文组织
 * 3. Cellular Memory - 细胞级记忆管理
 * 
 * 为未来Neural Field架构预留接口
 */

import type {
  AtomicPrompt,
  MolecularContext,
  Example,
  BuilderConfig,
  PromptResult,
} from '@/types/context-engineering';

// Re-export types for convenience
export type {
  AtomicPrompt,
  MolecularContext,
  Example,
  BuilderConfig,
  PromptResult,
} from '@/types/context-engineering';

// ========== 抽象基类 ==========

export abstract class BasePromptBuilder {
  protected config: BuilderConfig;
  protected memoryManager?: unknown;   // 将来集成CellularMemoryManager

  constructor(config: BuilderConfig = {}) {
    this.config = {
      maxExamples: 3,
      tokenBudget: 3000,
      enableMemory: true,
      experimentalFieldSupport: false,
      ...config
    };
  }

  /**
   * 构建原子化系统提示
   */
  abstract buildAtomicSystemPrompt(): AtomicPrompt;

  /**
   * 构建分子级用户提示
   */
  abstract buildMolecularPrompt(
    input: string,
    context: Record<string, unknown>
  ): MolecularContext;

  /**
   * 获取相关示例
   */
  abstract getRelevantExamples(
    input: string,
    context: Record<string, unknown>,
    maxExamples?: number
  ): Example[];

  /**
   * 主构建方法
   */
  abstract build(params: unknown): PromptResult;

  // ========== 通用工具方法 ==========

  /**
   * 格式化原子提示为字符串
   */
  protected formatAtomicPrompt(atomic: AtomicPrompt): string {
    const sections = [];
    
    // 角色定义（如果存在）
    if (atomic.role) {
      sections.push(`[ROLE]
身份: ${atomic.role.identity}
专业程度: ${atomic.role.expertise}
性格特点: ${atomic.role.personality}
背景经验: ${atomic.role.background}`);
    }
    
    sections.push(
      `[TASK]\n${atomic.task}`,
      `[CONSTRAINTS]\n${atomic.constraints.map((c, i) => `${i + 1}. ${c}`).join('\n')}`,
      `[OUTPUT FORMAT]\n- Language: ${atomic.outputFormat.language}\n- Format: ${atomic.outputFormat.format}`
    );

    if (atomic.outputFormat.restrictions?.length) {
      sections.push(`- Restrictions:\n${atomic.outputFormat.restrictions.map(r => `  • ${r}`).join('\n')}`);
    }

    return sections.join('\n\n');
  }

  /**
   * 格式化分子上下文为字符串
   */
  protected formatMolecularPrompt(molecular: MolecularContext): string {
    const sections = [];

    // 指令部分
    sections.push(`[INSTRUCTION]\n${molecular.instruction}`);

    // Few-shot示例
    if (molecular.examples.length > 0) {
      const examplesText = molecular.examples.map((ex, i) => 
        `Example ${i + 1}:\nInput: "${ex.input}"\nOutput: "${ex.output}"${
          ex.reasoning ? `\nReasoning: ${ex.reasoning}` : ''
        }`
      ).join('\n\n');
      sections.push(`[EXAMPLES]\n${examplesText}`);
    }

    // 结构化上下文
    const contextText = Object.entries(molecular.context)
      .map(([key, value]) => `- ${key}: ${JSON.stringify(value)}`)
      .join('\n');
    sections.push(`[CONTEXT]\n${contextText}`);

    // 新输入
    sections.push(`[NEW INPUT]\n"${molecular.newInput}"`);

    return sections.join('\n\n');
  }

  /**
   * 估算token数（简化版）
   */
  protected estimateTokens(text: string): number {
    // 简单估算：中文约2字符/token，英文约4字符/token
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const englishChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 2 + englishChars / 4);
  }

  /**
   * 优化内容以适应token预算
   */
  protected optimizeForTokenBudget(
    content: string,
    budget: number
  ): string {
    const estimated = this.estimateTokens(content);
    
    if (estimated <= budget) {
      return content;
    }

    // 简单截断策略（实际应该更智能）
    const ratio = budget / estimated;
    const targetLength = Math.floor(content.length * ratio * 0.9); // 留10%余量
    
    return content.substring(0, targetLength) + '\n[Content truncated due to token limit]';
  }

  /**
   * 计算文本相似度（简化版）
   */
  protected calculateSimilarity(text1: string, text2: string): number {
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

  // ========== Neural Field 预留接口 ==========

  /**
   * 获取语义向量（为Neural Field预留）
   */
  protected async getSemanticVector?(_text: string): Promise<Float32Array> {
    // 未来实现：调用embedding API
    throw new Error('Semantic vector generation not implemented');
  }

  /**
   * 注册到语义场（为Neural Field预留）
   */
  protected async registerToField?(
    _fieldName: string,
    _vector: Float32Array
  ): Promise<void> {
    // 未来实现：注册到Neural Field
    throw new Error('Field registration not implemented');
  }
}

