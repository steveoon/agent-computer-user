/**
 * 使用示例 - 展示如何使用新的Prompt Engineering模块
 */

import { 
  classificationBuilder, 
  replyBuilder,
  createClassificationBuilder,
  createReplyBuilder,
  HIGH_QUALITY_CONFIG
} from '../index';
import type { MessageClassification } from '@/types/zhipin';
import type { CandidateInfo } from '@/lib/tools/zhipin/types';

/**
 * 示例1：消息分类
 */
export function classifyMessage(message: string) {
  const result = classificationBuilder.createOptimizedClassificationPrompt({
    message: message,
    conversationHistory: [],
    brandData: {
      city: "上海",
      defaultBrand: "肯德基",
      availableBrands: ["肯德基", "麦当劳", "必胜客"],
      storeCount: 50
    },
    candidateInfo: {
      name: "张三",
      position: "服务员",
      age: "25岁",
      gender: "男",
      experience: "1年",
      education: "大专",
      expectedSalary: "6000-7000元",
      expectedLocation: "上海徐汇",
      height: "175cm",
      weight: "70kg",
      healthCertificate: true,
      activeTime: "5分钟前活跃",
      info: ["有经验", "有健康证", "可立即上岗"]
    }
  });

  console.log("分类系统提示:", result.system);
  console.log("分类用户提示:", result.prompt);
  
  return result;
}

/**
 * 示例2：生成回复
 */
export function generateReply(
  message: string,
  classification: MessageClassification
) {
  const result = replyBuilder.createOptimizedReplyPrompt({
    message: message,
    classification: classification,
    contextInfo: `
      肯德基徐汇店：
      - 服务员: 22-25元/时
      - 后厨: 23-26元/时
      - 排班: 早班(6:00-14:00), 晚班(14:00-22:00)
      - 要求: 18岁以上，健康证
    `,
    systemInstruction: "你是专业的招聘助手，帮助候选人了解工作机会",
    conversationHistory: [
      "用户: 有什么工作吗？",
      "助手: 有服务员和后厨岗位，你想了解哪个？"
    ],
    candidateInfo: {
      name: "李四",
      position: "店员/营业员",
      age: "20岁",
      gender: "女",
      experience: "",
      education: "高中",
      expectedSalary: "6500元",
      expectedLocation: "上海",
      height: "165cm",
      weight: "50kg",
      healthCertificate: true,
      activeTime: "刚刚活跃",
      info: ["可立即上岗", "有健康证"]
    } as CandidateInfo,
    targetBrand: "肯德基"
  });

  // 更新内存（可选）
  if (result.updateMemory) {
    result.updateMemory("这是生成的回复内容");
  }

  return result;
}

/**
 * 示例3：使用自定义配置
 */
export function createCustomBuilders() {
  // 创建高质量配置的构建器
  const qualityClassifier = createClassificationBuilder(HIGH_QUALITY_CONFIG);
  const qualityReplyBuilder = createReplyBuilder(HIGH_QUALITY_CONFIG);

  // 创建自定义配置的构建器
  const customReplyBuilder = createReplyBuilder({
    maxExamples: 5,
    tokenBudget: 4000,
    enableMemory: true,
    experimentalFieldSupport: false
  });

  return {
    qualityClassifier,
    qualityReplyBuilder,
    customReplyBuilder
  };
}

/**
 * 示例4：完整的对话流程
 */
export async function handleConversation(userMessage: string) {
  // Step 1: 分类消息
  const classificationPrompt = classificationBuilder.createOptimizedClassificationPrompt({
    message: userMessage,
    brandData: {
      city: "上海",
      defaultBrand: "肯德基",
      availableBrands: ["肯德基", "麦当劳"]
    }
  });

  // 假设这里调用LLM获取分类结果
  const mockClassification: MessageClassification = {
    replyType: "salary_inquiry",
    extractedInfo: {
      mentionedBrand: null,
      city: "上海",
      hasUrgency: false
    },
    reasoningText: "用户询问薪资信息"
  };

  // Step 2: 生成回复
  const replyPrompt = replyBuilder.createOptimizedReplyPrompt({
    message: userMessage,
    classification: mockClassification,
    contextInfo: "服务员22-25元/时，满勤奖200元",
    systemInstruction: "生成友好专业的回复",
    conversationHistory: [],
    targetBrand: "肯德基"
  });

  // Step 3: 更新内存
  const mockReply = "服务员22-25元/时，满勤另有200元奖金，月入4000-5000元";
  replyBuilder.updateMemory(userMessage, mockReply);

  return {
    classification: mockClassification,
    reply: mockReply,
    prompts: {
      classification: classificationPrompt,
      reply: replyPrompt
    }
  };
}

/**
 * 示例5：内存管理和候选人评分展示
 */
export function demonstrateMemoryManagement() {
  // 设置工作内存
  replyBuilder.setWorkingMemory("currentBrand", "肯德基");
  replyBuilder.setWorkingMemory("candidateLocation", "徐汇区");
  replyBuilder.setWorkingMemory("preferredPosition", "服务员");

  // 清理过期内存
  replyBuilder.cleanupMemory();

  console.log("内存管理完成");
}

/**
 * 示例6：智能候选人匹配展示
 */
export function demonstrateCandidateMatching() {
  // 理想候选人（应该得高分85%+）
  const idealCandidate: CandidateInfo = {
    name: "王小明",
    position: "店员/营业员", 
    age: "25岁",
    gender: "男",
    experience: "2年餐饮经验",
    education: "高中",
    expectedSalary: "6500元",
    expectedLocation: "上海",
    height: "175cm",
    weight: "70kg",
    healthCertificate: true,
    activeTime: "5分钟前活跃",
    info: ["有经验", "有健康证", "可立即上岗"]
  };

  // 普通候选人（无健康证，应该得分<50%）
  const normalCandidate: CandidateInfo = {
    name: "李小华",
    position: "收银员",
    age: "35岁",
    healthCertificate: false,
    activeTime: "3天前活跃"
  };

  const replyResult1 = replyBuilder.build({
    message: "测试匹配度",
    classification: {
      replyType: "general_chat",
      extractedInfo: {},
      reasoningText: "测试"
    },
    contextInfo: "测试数据",
    systemInstruction: "测试",
    conversationHistory: [],
    candidateInfo: idealCandidate
  });

  const replyResult2 = replyBuilder.build({
    message: "测试匹配度",
    classification: {
      replyType: "general_chat",
      extractedInfo: {},
      reasoningText: "测试"
    },
    contextInfo: "测试数据", 
    systemInstruction: "测试",
    conversationHistory: [],
    candidateInfo: normalCandidate
  });

  console.log("理想候选人提示:", replyResult1.prompt);
  console.log("普通候选人提示:", replyResult2.prompt);
}