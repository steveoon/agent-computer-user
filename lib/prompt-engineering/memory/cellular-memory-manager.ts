/**
 * Cellular Memory Manager - 细胞内存管理器
 *
 * 基于Context Engineering的Cellular Memory原则
 * 管理短期、工作和长期记忆系统
 */

import type {
  WorkingMemoryValue,
  LongTermFact,
  CompressedLongTermMemory,
  OptimizedMemoryContext,
} from "@/types/context-engineering";

import { MEMORY_CONSTANTS, EXTRACTION_PATTERNS } from "@/types/context-engineering";

import { SmartExtractor } from "./smart-patterns";

// 从types重新导出常量
export { MEMORY_CONSTANTS, EXTRACTION_PATTERNS } from "@/types/context-engineering";

/**
 * Cellular Memory Manager - 细胞内存管理器
 *
 * 三层记忆系统：
 * 1. 短期记忆：最近的对话历史
 * 2. 工作记忆：当前会话的临时状态
 * 3. 长期记忆：提取的关键事实
 */
export class CellularMemoryManager {
  private shortTermMemory: string[] = [];
  private workingMemory: Map<string, WorkingMemoryValue> = new Map();
  private longTermMemory: Map<string, LongTermFact> = new Map();
  private readonly TOKEN_BUDGET = MEMORY_CONSTANTS.DEFAULT_TOKEN_BUDGET;

  /**
   * 更新内存系统
   */
  updateMemory(exchange: { user: string; assistant: string }): void {
    // 保存完整对话历史，不再限制数量
    this.shortTermMemory.push(`用户: ${exchange.user}\n助手: ${exchange.assistant}`);
    // 提取到长期内存
    this.extractToLongTerm(`用户: ${exchange.user}\n助手: ${exchange.assistant}`);
  }

  /**
   * 加载对话历史到短期内存
   */
  loadConversationHistory(history: string[]): void {
    // 清空现有短期内存
    this.shortTermMemory = [];
    // 加载完整对话历史
    history.forEach(conv => {
      this.shortTermMemory.push(conv);
    });
  }

  /**
   * 提取重要信息到长期内存
   */
  private extractToLongTerm(content: string): void {
    const timestamp = Date.now();

    // 使用智能提取器提取所有信息
    const extracted = SmartExtractor.extractAll(content);

    // 存储品牌信息
    extracted.brands.forEach((brand, index) => {
      this.longTermMemory.set(`brand_${timestamp}_${index}`, brand);
    });

    // 存储位置信息
    extracted.locations.forEach((location, index) => {
      this.longTermMemory.set(`location_${timestamp}_${index}`, location);
    });

    // 存储年龄信息
    if (extracted.age !== null) {
      this.longTermMemory.set(`age_${timestamp}`, extracted.age);
    }

    // 存储时间偏好
    extracted.timePreferences.forEach((pref, index) => {
      this.longTermMemory.set(`schedule_${timestamp}_${index}`, pref);
    });

    // 存储紧急度
    if (extracted.urgency !== null) {
      this.longTermMemory.set(`urgency_${timestamp}`, extracted.urgency);
    }

    // 保留原有的正则提取作为备用（处理特殊格式）
    const patterns = EXTRACTION_PATTERNS;
    for (const [key, pattern] of Object.entries(patterns)) {
      // 只处理智能提取器未覆盖的模式
      if (!["brand", "location", "age", "schedule"].includes(key)) {
        const matches = content.matchAll(pattern);
        for (const match of matches) {
          this.longTermMemory.set(`${key}_${timestamp}_regex`, match[1]);
        }
      }
    }
  }

  /**
   * 获取优化后的内存上下文
   */
  getOptimizedContext(tokenBudget?: number): OptimizedMemoryContext {
    const budget = tokenBudget || this.TOKEN_BUDGET;

    // 预先截断对话历史以避免内存溢出
    // 根据token预算估算可以保留多少对话历史
    const maxHistorySize = Math.floor(budget * 0.3); // 30%的预算用于对话历史
    const estimatedCharsPerEntry = 120; // 每条对话估算120个字符（实际测试中较长）
    const maxEntries = Math.min(
      Math.floor(
        (maxHistorySize * MEMORY_CONSTANTS.TOKEN_ESTIMATE_DIVISOR) / estimatedCharsPerEntry
      ),
      20 // 最多保留20条对话历史
    );

    // 如果对话历史过长，只保留最近的部分
    const recentHistory =
      this.shortTermMemory.length > maxEntries
        ? this.shortTermMemory.slice(-maxEntries)
        : this.shortTermMemory;

    // 优先级排序：工作内存 > 优化后的对话历史 > 长期事实
    const context = {
      recent: recentHistory,
      facts: this.compressLongTermMemory(),
      working: Object.fromEntries(this.workingMemory),
    };

    // Token预算优化（进一步优化如果需要）
    return this.optimizeForTokenBudget(context, budget);
  }

  /**
   * 压缩长期内存
   */
  private compressLongTermMemory(): CompressedLongTermMemory {
    const compressed: CompressedLongTermMemory = {};

    // 按类型聚合事实
    for (const [key, value] of this.longTermMemory.entries()) {
      const [type] = key.split("_");
      if (!compressed[type]) {
        compressed[type] = [];
      }
      compressed[type].push(value as LongTermFact);
    }

    // 去重和压缩
    for (const type in compressed) {
      compressed[type] = [...new Set(compressed[type])].slice(-3);
    }

    return compressed;
  }

  /**
   * 根据token预算优化上下文
   */
  private optimizeForTokenBudget(
    context: OptimizedMemoryContext,
    budget: number
  ): OptimizedMemoryContext {
    // 简化实现：根据预算截断内容
    const estimatedTokens =
      JSON.stringify(context).length / MEMORY_CONSTANTS.TOKEN_ESTIMATE_DIVISOR;

    if (estimatedTokens <= budget) {
      return context;
    }

    // 如果超出预算，保留最近的对话，但至少保留指定轮数
    if (context.recent.length > MEMORY_CONSTANTS.MIN_CONVERSATION_HISTORY) {
      // 计算需要保留多少对话
      const keepRatio = budget / estimatedTokens;
      const keepCount = Math.max(
        MEMORY_CONSTANTS.MIN_CONVERSATION_HISTORY,
        Math.floor(context.recent.length * keepRatio)
      );
      context.recent = context.recent.slice(-keepCount);
    }

    return context;
  }

  /**
   * 设置工作内存
   */
  setWorkingMemory(key: string, value: WorkingMemoryValue): void {
    this.workingMemory.set(key, value);
  }

  /**
   * 获取工作内存
   */
  getWorkingMemory(key: string): WorkingMemoryValue | undefined {
    return this.workingMemory.get(key);
  }

  /**
   * 清理过期内存
   */
  cleanupMemory(): void {
    // 清理超过指定数量的长期内存
    const maxEntries = MEMORY_CONSTANTS.MAX_LONG_TERM_ENTRIES;
    if (this.longTermMemory.size > maxEntries) {
      const entries = Array.from(this.longTermMemory.entries());
      const toKeep = entries.slice(-maxEntries);

      // 清空现有Map并重新填充，而不是创建新Map
      // 这样可以保持引用不变，避免测试和其他代码的引用失效
      this.longTermMemory.clear();
      toKeep.forEach(([key, value]) => {
        this.longTermMemory.set(key, value);
      });
    }
  }

  /**
   * 重置所有内存
   */
  resetMemory(): void {
    this.shortTermMemory = [];
    this.workingMemory.clear();
    this.longTermMemory.clear();
  }

  /**
   * 获取内存统计信息
   */
  getMemoryStats(): {
    shortTermCount: number;
    workingMemoryCount: number;
    longTermCount: number;
    estimatedTokens: number;
  } {
    const context = this.getOptimizedContext();
    const estimatedTokens =
      JSON.stringify(context).length / MEMORY_CONSTANTS.TOKEN_ESTIMATE_DIVISOR;

    return {
      shortTermCount: this.shortTermMemory.length,
      workingMemoryCount: this.workingMemory.size,
      longTermCount: this.longTermMemory.size,
      estimatedTokens: Math.ceil(estimatedTokens),
    };
  }
}
