/**
 * Reply Prompt Builder 单元测试
 * 基于原有的 context-engineering-prompt-builder.test.ts 测试用例
 * 验证新的模块化实现是否保持功能一致性
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ReplyPromptBuilder } from '../core/reply-builder';
import type { ReplyBuilderParams } from '@/types/context-engineering';
import type { CandidateInfo } from '@/lib/tools/zhipin/types';

describe('ReplyPromptBuilder', () => {
  let replyBuilder: ReplyPromptBuilder;

  beforeEach(() => {
    replyBuilder = new ReplyPromptBuilder();
  });

  describe('核心功能测试', () => {
    describe('buildAtomicSystemPrompt', () => {
      it('应该构建正确的原子化系统提示', () => {
        const atomicPrompt = replyBuilder.buildAtomicSystemPrompt();
        
        expect(atomicPrompt.task).toBe('生成专业招聘助手对候选人的回复');
        expect(atomicPrompt.constraints).toContain('品牌专属话术优先于通用指令');
        expect(atomicPrompt.constraints).toContain('敏感问题使用固定安全话术');
        expect(atomicPrompt.constraints).toContain('不编造事实，信息不足时追问');
        expect(atomicPrompt.outputFormat.language).toBe('中文');
        expect(atomicPrompt.outputFormat.length.min).toBe(10);
        expect(atomicPrompt.outputFormat.length.max).toBe(100);
      });
    });

    describe('build方法 - 完整提示构建', () => {
      it('应该正确包含品牌岗位数据的上下文', () => {
        const params: ReplyBuilderParams = {
          message: '工资多少？',
          classification: {
            replyType: 'salary_inquiry',
            extractedInfo: {
              mentionedBrand: '奥乐齐',
            },
            reasoningText: '询问薪资',
          },
          contextInfo: `默认推荐品牌：奥乐齐
匹配到的门店信息：
• 1083曲阳666（虹口区1083曲阳666）：上海市-虹口区-虹口曲阳路666号新神州商厦
  职位：晚班补货，时间：22:00-07:00，薪资：30元/时
  福利：五险一金
  排班类型：灵活排班（可换班）

📋 奥乐齐品牌专属话术模板（薪资咨询）：
晚班补货30元/时，满勤另有200元奖金，月入4000-5000元`,
          systemInstruction: '回复薪资信息',
          conversationHistory: ['用户: 你好', '助手: 你好，有什么可以帮助你的吗？'],
          targetBrand: '奥乐齐'
        };

        const result = replyBuilder.build(params);
        
        // 验证系统提示 - 新版本使用英文标签
        expect(result.system).toContain('[TASK]');
        expect(result.system).toContain('[CONSTRAINTS]');
        expect(result.system).toContain('[OUTPUT FORMAT]');
        expect(result.system).toContain('奥乐齐'); // 应包含品牌
        
        // 验证用户提示包含招聘数据
        expect(result.prompt).toContain('[招聘数据]');
        expect(result.prompt).toContain('1083曲阳666'); // 门店信息
        expect(result.prompt).toContain('晚班补货'); // 职位信息
        expect(result.prompt).toContain('30元/时'); // 薪资信息
        expect(result.prompt).toContain('五险一金'); // 福利信息
        expect(result.prompt).toContain('奥乐齐品牌专属话术'); // 品牌话术
        
        // 验证其他关键部分
        expect(result.prompt).toContain('[指令]');
        expect(result.prompt).toContain('[当前上下文]');
        expect(result.prompt).toContain('[对话历史]');
        expect(result.prompt).toContain('[候选人消息]');
        expect(result.prompt).toContain('工资多少？');
      });

      it('应该包含候选人信息', () => {
        const candidateInfo: CandidateInfo = {
          name: '张三',
          position: '服务员',
          age: '25',
          experience: '2年',
          education: '大专',
        };

        const params: ReplyBuilderParams = {
          message: '有什么工作？',
          classification: {
            replyType: 'initial_inquiry',
            extractedInfo: {},
            reasoningText: '初次咨询',
          },
          contextInfo: '上海各区有门店岗位空缺',
          systemInstruction: '友好回复',
          conversationHistory: [],
          candidateInfo,
        };

        const result = replyBuilder.build(params);
        
        expect(result.prompt).toContain('[候选人资料]');
        expect(result.prompt).toContain('张三');
        expect(result.prompt).toContain('服务员');
        expect(result.prompt).toContain('25');
        expect(result.prompt).toContain('2年');
        expect(result.prompt).toContain('大专');
      });

      it('应该包含完整的候选人信息（含新字段）', () => {
        const candidateInfo: CandidateInfo = {
          name: '杨辉',
          position: '店员/营业员',
          age: '24岁',
          gender: '男',
          experience: '',
          education: '',
          expectedSalary: '6000-7000元',
          expectedLocation: '上海',
          height: '170cm',
          weight: '120kg',
          healthCertificate: true,
          activeTime: '1小时前活跃',
          info: ['便利店', '身高170cm', '体重120kg', '健康证'],
        };

        const params: ReplyBuilderParams = {
          message: '有什么工作？',
          classification: {
            replyType: 'initial_inquiry',
            extractedInfo: {},
            reasoningText: '初次咨询',
          },
          contextInfo: '上海各区有门店岗位空缺',
          systemInstruction: '友好回复',
          conversationHistory: [],
          candidateInfo,
        };

        const result = replyBuilder.build(params);
        
        // 验证候选人资料部分
        expect(result.prompt).toContain('[候选人资料]');
        
        // 验证基本信息
        expect(result.prompt).toContain('姓名: 杨辉');
        expect(result.prompt).toContain('性别: 男');
        expect(result.prompt).toContain('年龄: 24岁');
        
        // 验证职业信息
        expect(result.prompt).toContain('期望职位: 店员/营业员');
        expect(result.prompt).toContain('期望薪资: 6000-7000元');
        expect(result.prompt).toContain('期望工作地: 上海');
        
        // 验证身体条件
        expect(result.prompt).toContain('身高: 170cm');
        expect(result.prompt).toContain('体重: 120kg');
        expect(result.prompt).toContain('健康证: 有');
        
        // 验证活跃度
        expect(result.prompt).toContain('最近活跃: 1小时前活跃');
        
        // 验证其他信息
        expect(result.prompt).toContain('其他信息: 便利店、身高170cm、体重120kg、健康证');
        
        // 验证匹配度分数（应该很高，因为有健康证等关键信息）
        expect(result.prompt).toContain('匹配度:');
        
        // 通过正则表达式检查匹配度是否在合理范围内（应该大于60%）
        const matchScoreMatch = result.prompt.match(/匹配度: (\d+)%/);
        expect(matchScoreMatch).toBeTruthy();
        if (matchScoreMatch) {
          const score = parseInt(matchScoreMatch[1]);
          expect(score).toBeGreaterThan(60); // 有健康证等信息，分数应该较高
        }
      });

      it('应该正确计算不同情况的候选人匹配度', () => {
        // 测试有健康证的候选人 - 应该得高分
        const candidateWithHealthCert: CandidateInfo = {
          name: '李四',
          position: '服务员',
          age: '28岁',
          gender: '女',
          expectedSalary: '7000元',
          expectedLocation: '上海徐汇',
          healthCertificate: true,
          activeTime: '刚刚活跃',
        };

        const params1: ReplyBuilderParams = {
          message: '测试',
          classification: {
            replyType: 'general_chat',
            extractedInfo: {},
            reasoningText: '测试',
          },
          contextInfo: '测试',
          systemInstruction: '测试',
          conversationHistory: [],
          candidateInfo: candidateWithHealthCert,
        };

        const result1 = replyBuilder.build(params1);
        const matchScore1 = result1.prompt.match(/匹配度: (\d+)%/);
        expect(matchScore1).toBeTruthy();
        if (matchScore1) {
          const score = parseInt(matchScore1[1]);
          expect(score).toBeGreaterThan(70); // 有健康证，分数应该很高
        }

        // 测试没有健康证的候选人 - 分数应该较低
        const candidateWithoutHealthCert: CandidateInfo = {
          name: '王五',
          position: '收银员',
          age: '35岁',
          healthCertificate: false,
          activeTime: '3天前活跃',
        };

        const params2: ReplyBuilderParams = {
          message: '测试',
          classification: {
            replyType: 'general_chat',
            extractedInfo: {},
            reasoningText: '测试',
          },
          contextInfo: '测试',
          systemInstruction: '测试',
          conversationHistory: [],
          candidateInfo: candidateWithoutHealthCert,
        };

        const result2 = replyBuilder.build(params2);
        const matchScore2 = result2.prompt.match(/匹配度: (\d+)%/);
        expect(matchScore2).toBeTruthy();
        if (matchScore2) {
          const score = parseInt(matchScore2[1]);
          expect(score).toBeLessThan(50); // 没有健康证，分数应该较低
        }

        // 测试信息完整的理想候选人 - 应该得最高分
        const idealCandidate: CandidateInfo = {
          name: '赵六',
          position: '店员/营业员',
          age: '25岁',
          gender: '男',
          experience: '2年餐饮经验',
          education: '高中',
          expectedSalary: '6500元',
          expectedLocation: '上海',
          height: '175cm',
          weight: '70kg',
          healthCertificate: true,
          activeTime: '5分钟前活跃',
          info: ['有经验', '有健康证', '可立即上岗'],
        };

        const params3: ReplyBuilderParams = {
          message: '测试',
          classification: {
            replyType: 'general_chat',
            extractedInfo: {},
            reasoningText: '测试',
          },
          contextInfo: '测试',
          systemInstruction: '测试',
          conversationHistory: [],
          candidateInfo: idealCandidate,
        };

        const result3 = replyBuilder.build(params3);
        const matchScore3 = result3.prompt.match(/匹配度: (\d+)%/);
        expect(matchScore3).toBeTruthy();
        if (matchScore3) {
          const score = parseInt(matchScore3[1]);
          expect(score).toBeGreaterThan(85); // 理想候选人，分数应该最高
        }
      });

      it('应该正确处理对话历史', () => {
        const conversationHistory = [
          '用户: 有兼职吗？',
          '助手: 有的，我们有多个兼职岗位',
          '用户: 工作时间是怎样的？',
        ];

        const params: ReplyBuilderParams = {
          message: '薪资待遇如何？',
          classification: {
            replyType: 'salary_inquiry',
            extractedInfo: {},
            reasoningText: '询问薪资',
          },
          contextInfo: '兼职22-25元/时',
          systemInstruction: '回复薪资',
          conversationHistory,
        };

        const result = replyBuilder.build(params);
        
        expect(result.prompt).toContain('[对话历史]');
        expect(result.prompt).toContain('有兼职吗？');
        expect(result.prompt).toContain('有的，我们有多个兼职岗位');
        expect(result.prompt).toContain('工作时间是怎样的？');
      });

      it('应该包含提取的信息', () => {
        const params: ReplyBuilderParams = {
          message: '我18岁可以做吗？',
          classification: {
            replyType: 'age_concern',
            extractedInfo: {
              specificAge: 18,
              hasUrgency: true,
              preferredSchedule: '兼职',
            },
            reasoningText: '年龄询问',
          },
          contextInfo: '需要年满18岁',
          systemInstruction: '回复年龄要求',
          conversationHistory: [],
        };

        const result = replyBuilder.build(params);
        
        expect(result.prompt).toContain('[识别信息]');
        expect(result.prompt).toContain('意图类型: age_concern');
        expect(result.prompt).toContain('年龄: 18岁');
        expect(result.prompt).toContain('紧急需求: 是');
        expect(result.prompt).toContain('时间偏好: 兼职');
      });
    });

    describe('内存管理', () => {
      it('应该正确更新和管理对话内存', () => {
        const builder = new ReplyPromptBuilder();
        
        // 更新内存
        builder.updateMemory('你好', '你好，有什么可以帮助你的？');
        builder.updateMemory('有兼职吗？', '有的，我们有多个兼职岗位');
        
        // 构建提示时应包含历史记忆
        const params: ReplyBuilderParams = {
          message: '工资多少？',
          classification: {
            replyType: 'salary_inquiry',
            extractedInfo: {},
            reasoningText: '询问薪资',
          },
          contextInfo: '22-25元/时',
          systemInstruction: '回复薪资',
          conversationHistory: [],
        };
        
        const result = builder.build(params);
        
        // 虽然 conversationHistory 为空，但内存中应该有历史
        expect(result.metadata?.memoryUsage).toBeGreaterThanOrEqual(0);
      });

      it('应该支持内存清理', () => {
        const builder = new ReplyPromptBuilder();
        
        // 添加一些记忆
        for (let i = 0; i < 10; i++) {
          builder.updateMemory(`消息${i}`, `回复${i}`);
        }
        
        // 清理内存
        builder.cleanupMemory();
        
        // 验证清理效果（通过构建提示来间接验证）
        const params: ReplyBuilderParams = {
          message: '测试',
          classification: {
            replyType: 'general_chat',
            extractedInfo: {},
            reasoningText: '一般对话',
          },
          contextInfo: '测试数据',
          systemInstruction: '测试指令',
          conversationHistory: [],
        };
        
        const result = builder.build(params);
        expect(result).toBeDefined();
        expect(result.metadata?.memoryUsage).toBeGreaterThanOrEqual(0);
      });
    });

    describe('元数据生成', () => {
      it('应该生成正确的元数据', () => {
        const params: ReplyBuilderParams = {
          message: '测试消息',
          classification: {
            replyType: 'general_chat',
            extractedInfo: {},
            reasoningText: '测试',
          },
          contextInfo: '测试上下文',
          systemInstruction: '测试指令',
          conversationHistory: [],
        };

        const result = replyBuilder.build(params);
        
        expect(result.metadata).toBeDefined();
        expect(result.metadata?.estimatedTokens).toBeGreaterThan(0);
        expect(result.metadata?.usedExamples).toBeGreaterThanOrEqual(0);
        expect(result.metadata?.memoryUsage).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('边界情况处理', () => {
    it('应该处理空对话历史', () => {
      const params: ReplyBuilderParams = {
        message: '你好',
        classification: {
          replyType: 'general_chat',
          extractedInfo: {},
          reasoningText: '打招呼',
        },
        contextInfo: '',
        systemInstruction: '友好回复',
        conversationHistory: [],
      };

      const result = replyBuilder.build(params);
      expect(result.prompt).toBeDefined();
      expect(result.system).toBeDefined();
    });

    it('应该处理没有候选人信息的情况', () => {
      const params: ReplyBuilderParams = {
        message: '有工作吗？',
        classification: {
          replyType: 'initial_inquiry',
          extractedInfo: {},
          reasoningText: '询问工作',
        },
        contextInfo: '有岗位空缺',
        systemInstruction: '回复',
        conversationHistory: [],
        candidateInfo: undefined,
      };

      const result = replyBuilder.build(params);
      expect(result.prompt).toBeDefined();
      expect(result.prompt).not.toContain('[候选人资料]');
    });

    it('应该处理没有品牌信息的情况', () => {
      const params: ReplyBuilderParams = {
        message: '工作时间？',
        classification: {
          replyType: 'schedule_inquiry',
          extractedInfo: {},
          reasoningText: '询问时间',
        },
        contextInfo: '早晚班都有',
        systemInstruction: '回复时间',
        conversationHistory: [],
        targetBrand: undefined,
      };

      const result = replyBuilder.build(params);
      expect(result.prompt).toBeDefined();
      expect(result.system).toBeDefined();
    });
  });
});