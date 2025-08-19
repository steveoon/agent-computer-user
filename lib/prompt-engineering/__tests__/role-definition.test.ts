/**
 * 角色定义功能测试
 * 验证Context Engineering中角色定义的完整性和正确性
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ReplyPromptBuilder } from '../core/reply-builder';
import { ClassificationPromptBuilder } from '../core/classification-builder';
import type { ReplyBuilderParams } from '@/types/context-engineering';

describe('角色定义功能测试', () => {
  describe('ReplyPromptBuilder 角色定义', () => {
    let builder: ReplyPromptBuilder;

    beforeEach(() => {
      builder = new ReplyPromptBuilder();
    });

    it('应该包含完整的角色定义结构', () => {
      const atomic = builder.buildAtomicSystemPrompt();
      
      expect(atomic.role).toBeDefined();
      expect(atomic.role?.identity).toBe('资深餐饮连锁招聘专员');
      expect(atomic.role?.expertise).toBe('3年以上餐饮行业招聘经验，成功招聘800+名员工');
      expect(atomic.role?.personality).toBe('说话接地气、口语化、像朋友聊天一样自然');
      expect(atomic.role?.background).toBe('熟悉各岗位要求，了解候选人关切点，擅长快速匹配人岗');
    });

    it('角色定义应该是可衡量和具体的', () => {
      const atomic = builder.buildAtomicSystemPrompt();
      const role = atomic.role!;
      
      // 专业程度包含可衡量指标
      expect(role.expertise).toMatch(/\d+年/); // 包含年限
      expect(role.expertise).toMatch(/\d+\+名/); // 包含数量
      
      // 身份明确具体
      expect(role.identity).toContain('招聘专员');
      
      // 性格特点清晰
      expect(role.personality.split('、')).toHaveLength(3); // 3个特点
      
      // 背景经验实用
      expect(role.background).toContain('熟悉');
      expect(role.background).toContain('擅长');
    });

    it('格式化的系统提示应该包含角色信息', () => {
      const atomic = builder.buildAtomicSystemPrompt();
      const formatted = (builder as any).formatAtomicPrompt(atomic);
      
      expect(formatted).toContain('[ROLE]');
      expect(formatted).toContain('身份: 资深餐饮连锁招聘专员');
      expect(formatted).toContain('专业程度: 3年以上餐饮行业招聘经验');
      expect(formatted).toContain('性格特点: 说话接地气、口语化、像朋友聊天一样自然');
      expect(formatted).toContain('背景经验: 熟悉各岗位要求');
    });

    it('完整构建结果应该包含角色信息', () => {
      const params: ReplyBuilderParams = {
        message: '有什么工作？',
        classification: {
          replyType: 'initial_inquiry',
          extractedInfo: {},
          reasoningText: '初次咨询',
        },
        contextInfo: '测试上下文',
        systemInstruction: '测试指令',
        conversationHistory: [],
      };

      const result = builder.build(params);
      
      expect(result.system).toContain('[ROLE]');
      expect(result.system).toContain('资深餐饮连锁招聘专员');
    });
  });

  describe('ClassificationPromptBuilder 角色定义', () => {
    let builder: ClassificationPromptBuilder;

    beforeEach(() => {
      builder = new ClassificationPromptBuilder();
    });

    it('分类构建器可以选择不包含角色定义', () => {
      const atomic = builder.buildAtomicSystemPrompt();
      
      // ClassificationPromptBuilder 可能不需要角色定义，这是可选的
      // 如果没有角色定义，也是合法的
      if (atomic.role) {
        expect(atomic.role).toHaveProperty('identity');
        expect(atomic.role).toHaveProperty('expertise');
        expect(atomic.role).toHaveProperty('personality');
        expect(atomic.role).toHaveProperty('background');
      }
    });

    it('如果包含角色定义，应该符合分类任务特点', () => {
      const atomic = builder.buildAtomicSystemPrompt();
      
      if (atomic.role) {
        // 分类任务的角色应该体现分析能力
        expect(
          atomic.role.identity.includes('分析') || 
          atomic.role.expertise.includes('分析') ||
          atomic.role.background.includes('分析')
        ).toBe(true);
      }
    });
  });

  describe('角色定义格式化测试', () => {
    it('应该正确处理缺少角色定义的情况', () => {
      const mockBuilder = new ReplyPromptBuilder();
      const atomicWithoutRole = {
        task: '测试任务',
        constraints: ['约束1', '约束2'],
        outputFormat: {
          language: '中文',
          length: { min: 10, max: 100 },
          format: 'plain_text',
          restrictions: ['限制1']
        }
      };

      const formatted = (mockBuilder as any).formatAtomicPrompt(atomicWithoutRole);
      
      expect(formatted).not.toContain('[ROLE]');
      expect(formatted).toContain('[TASK]');
      expect(formatted).toContain('[CONSTRAINTS]');
      expect(formatted).toContain('[OUTPUT FORMAT]');
    });

    it('角色定义格式应该清晰易读', () => {
      const builder = new ReplyPromptBuilder();
      const atomic = builder.buildAtomicSystemPrompt();
      const formatted = (builder as any).formatAtomicPrompt(atomic);
      
      // 检查格式结构
      const roleSection = formatted.split('[TASK]')[0];
      expect(roleSection).toContain('身份:');
      expect(roleSection).toContain('专业程度:');
      expect(roleSection).toContain('性格特点:');
      expect(roleSection).toContain('背景经验:');
      
      // 每行应该有明确的标签
      const lines = roleSection.split('\n').filter((line: string) => line.trim());
      const roleLines = lines.filter((line: string) => line.includes(':'));
      expect(roleLines.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('类型安全测试', () => {
    it('RoleDefinition类型应该被正确导出', () => {
      const builder = new ReplyPromptBuilder();
      const atomic = builder.buildAtomicSystemPrompt();
      
      if (atomic.role) {
        // TypeScript 应该能正确推断类型
        const identity: string = atomic.role.identity;
        const expertise: string = atomic.role.expertise;
        const personality: string = atomic.role.personality;
        const background: string = atomic.role.background;
        
        expect(typeof identity).toBe('string');
        expect(typeof expertise).toBe('string');
        expect(typeof personality).toBe('string');
        expect(typeof background).toBe('string');
      }
    });
  });
});