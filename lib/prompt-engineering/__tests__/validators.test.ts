/**
 * 验证器功能测试
 */

import { describe, it, expect } from 'vitest';
import { 
  createValidator,
  BuilderConfigSchema,
  BuilderConfigValidator,
  WorkingMemoryValidator,
  ClassificationParamsValidator,
} from '@/types/context-engineering';

describe('Type Validators', () => {
  describe('createValidator', () => {
    it('should create a validator with all methods', () => {
      const validator = createValidator(BuilderConfigSchema);
      
      expect(validator).toHaveProperty('parse');
      expect(validator).toHaveProperty('safeParse');
      expect(validator).toHaveProperty('isValid');
      expect(validator).toHaveProperty('getDefault');
      expect(validator).toHaveProperty('partial');
    });

    it('should validate valid data', () => {
      const validConfig = {
        maxExamples: 5,
        tokenBudget: 3000,
        enableMemory: true,
      };

      expect(BuilderConfigValidator.isValid(validConfig)).toBe(true);
      
      const result = BuilderConfigValidator.safeParse(validConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validConfig);
      }
    });

    it('should reject invalid data', () => {
      const invalidConfig = {
        maxExamples: 'not a number', // 应该是 number
        tokenBudget: 3000,
      };

      expect(BuilderConfigValidator.isValid(invalidConfig)).toBe(false);
      
      const result = BuilderConfigValidator.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should parse with optional fields', () => {
      const minimalConfig = {}; // 所有字段都是可选的

      expect(BuilderConfigValidator.isValid(minimalConfig)).toBe(true);
      
      const parsed = BuilderConfigValidator.parse(minimalConfig);
      expect(parsed).toEqual({});
    });
  });

  describe('WorkingMemoryValidator', () => {
    it('should validate primitive values', () => {
      expect(WorkingMemoryValidator.isValid('string')).toBe(true);
      expect(WorkingMemoryValidator.isValid(123)).toBe(true);
      expect(WorkingMemoryValidator.isValid(true)).toBe(true);
      expect(WorkingMemoryValidator.isValid(null)).toBe(true);
    });

    it('should validate nested structures', () => {
      const nestedData = {
        key1: 'value1',
        key2: {
          nested: 'value',
          number: 42,
        },
        key3: [1, 2, 'three'],
      };

      expect(WorkingMemoryValidator.isValid(nestedData)).toBe(true);
    });

    it('should reject invalid types', () => {
      expect(WorkingMemoryValidator.isValid(undefined)).toBe(false);
      expect(WorkingMemoryValidator.isValid(Symbol('test'))).toBe(false);
      expect(WorkingMemoryValidator.isValid(() => {})).toBe(false);
    });
  });

  describe('ClassificationParamsValidator', () => {
    it('should validate complete params', () => {
      const params = {
        message: 'Test message',
        conversationHistory: ['msg1', 'msg2'],
        brandData: {
          city: 'Beijing',
          defaultBrand: 'BrandA',
          availableBrands: ['BrandA', 'BrandB'],
          storeCount: 10,
        },
        candidateInfo: {
          name: 'John',
          position: 'Developer',
          age: '25', // 必须是 string
          experience: '3 years',
          education: 'Bachelor',
        },
      };

      expect(ClassificationParamsValidator.isValid(params)).toBe(true);
    });

    it('should validate minimal params', () => {
      const minimalParams = {
        message: 'Test message',
      };

      expect(ClassificationParamsValidator.isValid(minimalParams)).toBe(true);
    });

    it('should reject params with wrong types', () => {
      const invalidParams = {
        message: 123, // 应该是 string
      };

      expect(ClassificationParamsValidator.isValid(invalidParams)).toBe(false);
    });

    it('should handle partial validation', () => {
      // partial 方法对于 z.object schema 使用 .partial() 转换
      const validPartialData = {
        message: 'Valid message', // 必需字段
      };

      // 使用 partial 方法 - 应该成功因为 message 是唯一必需的字段
      const partial = ClassificationParamsValidator.partial(validPartialData);
      expect(partial).toBeTruthy();
      expect(partial?.message).toBe('Valid message');

      // 测试带有额外字段的数据
      const dataWithExtra = {
        message: 'Another message',
        unknownField: 'value', // 这个字段会被忽略
      };
      
      const partialWithExtra = ClassificationParamsValidator.partial(dataWithExtra);
      expect(partialWithExtra).toBeTruthy();
      expect(partialWithExtra?.message).toBe('Another message');
      
      // 测试无效数据类型
      const invalidTypeData = 123; // 不是对象
      const invalidPartial = ClassificationParamsValidator.partial(invalidTypeData);
      expect(invalidPartial).toBe(null);
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain deprecated function compatibility', async () => {
      // 动态导入以测试向后兼容性
      const { 
        isWorkingMemoryValue, 
        isOptimizedMemoryContext, 
        isExtractedFacts 
      } = await import('@/types/context-engineering');

      // 这些废弃的函数应该仍然工作
      expect(isWorkingMemoryValue('test')).toBe(true);
      expect(isWorkingMemoryValue(undefined)).toBe(false);

      expect(isOptimizedMemoryContext({ 
        recent: [], 
        facts: {}, 
        working: {} 
      })).toBe(true);
      expect(isOptimizedMemoryContext(null)).toBe(false);

      expect(isExtractedFacts({})).toBe(true);
      expect(isExtractedFacts(null)).toBe(false);
    });
  });
});