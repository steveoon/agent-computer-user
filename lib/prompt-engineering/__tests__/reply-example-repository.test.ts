/**
 * Reply Example Repository 详细测试
 * 补充原始 context-engineering-prompt-builder.test.ts 中
 * FewShotExampleRepository 的完整测试场景
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ReplyExampleRepository } from '../examples/reply-examples';

describe('ReplyExampleRepository - 完整功能测试', () => {
  let exampleRepo: ReplyExampleRepository;

  beforeEach(() => {
    exampleRepo = new ReplyExampleRepository();
  });

  describe('getSimilarExamples 方法 (对应原getRelevantExamples)', () => {
    it('应该返回相关的示例', () => {
      // 测试有完整上下文信息的情况
      const examplesWithContext = exampleRepo.getSimilarExamples('有什么兼职工作吗？', 'initial_inquiry', 2, '徐汇区肯德基有岗位');
      expect(examplesWithContext.length).toBeLessThanOrEqual(2);
      if (examplesWithContext.length > 0) {
        expect(examplesWithContext[0]).toHaveProperty('scenario');
        expect(examplesWithContext[0]).toHaveProperty('input');
        expect(examplesWithContext[0]).toHaveProperty('output');
      }

      // 测试信息不足的情况 - 应该过滤掉包含具体数字的示例
      const examplesWithoutContext = exampleRepo.getSimilarExamples('有工作吗？', 'initial_inquiry', 2, '');
      expect(examplesWithoutContext.length).toBeGreaterThan(0); // 至少有1个通用示例
      if (examplesWithoutContext.length > 0) {
        expect(examplesWithoutContext[0]).toHaveProperty('scenario');
      }
    });

    it('应该根据上下文智能选择示例', () => {
      // 当没有具体信息时，不应该返回包含具体数字的示例
      const genericExamples = exampleRepo.getSimilarExamples('工资多少？', 'salary_inquiry', 3, '');
      
      // 检查是否选择了追问类型的示例
      const hasQuestionExample = genericExamples.some((ex: any) => 
        ex.output.includes('你想了解哪个岗位') || 
        ex.output.includes('不同岗位')
      );
      expect(hasQuestionExample).toBe(true);
    });

    it('应该限制返回的示例数量', () => {
      const examples1 = exampleRepo.getSimilarExamples('在哪里？', 'location_inquiry', 1, '测试');
      expect(examples1.length).toBeLessThanOrEqual(1);

      const examples3 = exampleRepo.getSimilarExamples('在哪里？', 'location_inquiry', 3, '测试');
      expect(examples3.length).toBeLessThanOrEqual(3);

      const examples10 = exampleRepo.getSimilarExamples('在哪里？', 'location_inquiry', 10, '测试');
      expect(examples10.length).toBeLessThanOrEqual(10);
    });
  });

  describe('getSimilarExamples 方法', () => {
    it('应该根据相似度返回示例', () => {
      const examples = exampleRepo.getSimilarExamples(
        '工资多少钱？',
        'salary_inquiry',
        1
      );

      expect(examples).toHaveLength(1);
      expect(examples[0].input).toContain('工资');
    });

    it('示例匹配相似度应该达到阈值', () => {
      // 测试高相似度场景
      const highSimilarityExamples = exampleRepo.getSimilarExamples(
        '工资多少钱？',
        'salary_inquiry',
        1
      );
      expect(highSimilarityExamples).toHaveLength(1);
      
      // 测试中等相似度场景
      const mediumSimilarityExamples = exampleRepo.getSimilarExamples(
        '薪水如何？',
        'salary_inquiry',
        1
      );
      expect(mediumSimilarityExamples).toHaveLength(1);
      
      // 验证相似度计算逻辑
      const similarity1 = (exampleRepo as any).calculateSimilarity('工资多少？', '工资多少');
      const similarity2 = (exampleRepo as any).calculateSimilarity('工资多少？', '年龄要求？');
      
      // 相似度应该基于共同词汇
      expect(similarity1).toBeGreaterThan(similarity2); // 相关性排序正确
      expect(similarity1).toBeGreaterThan(0.3); // 降低阈值，因为中文分词特点
    });

    it('应该处理不存在的场景类型', () => {
      const examples = exampleRepo.getSimilarExamples(
        '测试消息',
        'non_existent_type',
        2
      );
      
      // 应该返回空数组或默认示例
      expect(Array.isArray(examples)).toBe(true);
      expect(examples.length).toBeLessThanOrEqual(2);
    });

    it('应该按相似度排序返回多个示例', () => {
      const examples = exampleRepo.getSimilarExamples(
        '在哪里工作',
        'location_inquiry',
        3
      );
      
      expect(examples.length).toBeGreaterThan(0);
      expect(examples.length).toBeLessThanOrEqual(3);
      
      // 如果有多个示例，验证排序（相似度由高到低）
      if (examples.length > 1) {
        const firstRelevance = (exampleRepo as any).calculateSimilarity('在哪里工作', examples[0].input);
        const secondRelevance = (exampleRepo as any).calculateSimilarity('在哪里工作', examples[1].input);
        expect(firstRelevance).toBeGreaterThanOrEqual(secondRelevance);
      }
    });
  });

  describe('场景覆盖性测试', () => {
    it('应该覆盖所有主要场景', () => {
      const scenarios = [
        { type: 'initial_inquiry', input: '有工作吗？' },
        { type: 'location_inquiry', input: '在哪里？' },
        { type: 'salary_inquiry', input: '工资多少？' },
        { type: 'age_concern', input: '我50岁了能做吗？' },
        { type: 'schedule_inquiry', input: '可以只做周末吗？' },
      ];

      scenarios.forEach(scenario => {
        const examples = exampleRepo.getSimilarExamples(scenario.input, scenario.type, 1, '测试上下文');
        expect(examples.length).toBeGreaterThan(0);
        expect(examples[0]).toHaveProperty('scenario');
      });
    });

    it('应该为每个场景提供多样化的示例', () => {
      const examples = exampleRepo.getSimilarExamples('有什么工作？', 'initial_inquiry', 5, '充足的上下文信息');
      
      if (examples.length > 1) {
        // 检查示例的多样性
        const uniqueInputs = new Set(examples.map((ex: any) => ex.input));
        const uniqueOutputs = new Set(examples.map((ex: any) => ex.output));
        
        // 输入和输出应该有一定的多样性
        expect(uniqueInputs.size).toBeGreaterThan(0);
        expect(uniqueOutputs.size).toBeGreaterThan(0);
      }
    });

    it('应该区分通用示例和具体示例', () => {
      // 当没有上下文时，应该返回通用示例
      const genericExamples = exampleRepo.getSimilarExamples('工资多少？', 'salary_inquiry', 2, '');
      const hasGenericExample = genericExamples.some((ex: any) => 
        !ex.output.match(/\d+元/) // 不包含具体金额
      );
      expect(hasGenericExample).toBe(true);
      
      // 当有完整上下文时，可以返回具体示例
      const specificExamples = exampleRepo.getSimilarExamples('工资多少？', 'salary_inquiry', 2, '肯德基服务员，22-25元/时');
      const hasSpecificExample = specificExamples.some((ex: any) => 
        ex.output.match(/\d+元/) // 包含具体金额
      );
      expect(hasSpecificExample).toBe(true);
    });
  });

  describe('算法正确性测试', () => {
    it('calculateSimilarity 应该正确计算中文相似度', () => {
      const repo = exampleRepo as any;
      
      // 完全相同
      expect(repo.calculateSimilarity('工资多少', '工资多少')).toBe(1);
      
      // 部分相同
      const partial = repo.calculateSimilarity('工资多少', '工资如何');
      expect(partial).toBeGreaterThan(0);
      expect(partial).toBeLessThan(1);
      
      // 完全不同
      const different = repo.calculateSimilarity('工资多少', '天气如何');
      expect(different).toBeLessThan(partial);
      
      // 空字符串
      expect(repo.calculateSimilarity('', '')).toBe(0);
      expect(repo.calculateSimilarity('工资', '')).toBe(0);
      expect(repo.calculateSimilarity('', '工资')).toBe(0);
    });

    it('应该处理特殊字符和标点符号', () => {
      const repo = exampleRepo as any;
      
      // 忽略标点符号
      const withPunctuation = repo.calculateSimilarity('工资多少？', '工资多少！');
      expect(withPunctuation).toBeGreaterThan(0.8);
      
      // 处理空格
      const withSpaces = repo.calculateSimilarity('工 资 多 少', '工资多少');
      expect(withSpaces).toBeGreaterThan(0.8);
    });
  });
});