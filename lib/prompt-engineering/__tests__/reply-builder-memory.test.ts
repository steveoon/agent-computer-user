/**
 * Reply Prompt Builder 内存管理详细测试
 * 补充原始 context-engineering-prompt-builder.test.ts 中
 * 内存管理的完整测试场景
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ReplyPromptBuilder } from "../core/reply-builder";
import { CellularMemoryManager } from "../memory/cellular-memory-manager";
import type { ReplyBuilderParams } from "@/types/context-engineering";

describe("ReplyPromptBuilder - 内存管理详细测试", () => {
  describe("CellularMemoryManager 完整功能", () => {
    let memoryManager: CellularMemoryManager;

    beforeEach(() => {
      memoryManager = new CellularMemoryManager();
    });

    describe("shortTermMemory 短期记忆测试", () => {
      it("应该正确存储对话交换格式", () => {
        memoryManager.updateMemory({
          user: "有什么工作？",
          assistant: "上海各区有门店岗位",
        });

        // 直接访问shortTermMemory验证格式
        const shortTermMemory = (memoryManager as any).shortTermMemory as string[];
        expect(shortTermMemory).toHaveLength(1);
        expect(shortTermMemory[0]).toBe("用户: 有什么工作？\n助手: 上海各区有门店岗位");
      });

      it("应该累积多轮对话到shortTermMemory", () => {
        memoryManager.updateMemory({
          user: "有工作吗？",
          assistant: "有多个岗位",
        });

        memoryManager.updateMemory({
          user: "薪资多少？",
          assistant: "22元/时",
        });

        const shortTermMemory = (memoryManager as any).shortTermMemory as string[];
        expect(shortTermMemory).toHaveLength(2);
        expect(shortTermMemory[0]).toBe("用户: 有工作吗？\n助手: 有多个岗位");
        expect(shortTermMemory[1]).toBe("用户: 薪资多少？\n助手: 22元/时");
      });

      it("loadConversationHistory应该重置并加载历史", () => {
        // 先添加一些内存
        memoryManager.updateMemory({
          user: "旧消息",
          assistant: "旧回复",
        });

        const history = [
          "用户: 你好",
          "助手: 你好，有什么可以帮助你的？",
          "用户: 我想找工作",
          "助手: 上海各区有门店岗位",
        ];

        memoryManager.loadConversationHistory(history);

        const shortTermMemory = (memoryManager as any).shortTermMemory as string[];
        expect(shortTermMemory).toHaveLength(4);
        expect(shortTermMemory).toEqual(history);
        expect(shortTermMemory[0]).toBe("用户: 你好");
      });

      it("应该处理大量对话历史", () => {
        const longHistory = Array(100)
          .fill(null)
          .map((_, i) => `第${i}轮 - 用户: 消息${i} | 助手: 回复${i}`);

        memoryManager.loadConversationHistory(longHistory);

        const shortTermMemory = (memoryManager as any).shortTermMemory as string[];
        expect(shortTermMemory).toHaveLength(100);
        expect(shortTermMemory[99]).toContain("第99轮");
      });
    });

    it("应该正确更新内存", () => {
      memoryManager.updateMemory({
        user: "有什么工作？",
        assistant: "上海各区有门店岗位",
      });

      const context = memoryManager.getOptimizedContext();
      expect(context.recent).toHaveLength(1);
      expect(context.recent[0]).toContain("有什么工作？");
    });

    it("应该保留完整对话历史", () => {
      const history = [
        "用户: 你好",
        "助手: 你好，有什么可以帮助你的？",
        "用户: 我想找工作",
        "助手: 上海各区有门店岗位",
        "用户: 薪资多少？",
        "助手: 22元/时",
      ];

      memoryManager.loadConversationHistory(history);
      const context = memoryManager.getOptimizedContext();

      expect(context.recent).toHaveLength(6);
      expect(context.recent).toEqual(history);
    });

    describe("longTermMemory 长期记忆测试", () => {
      it("应该正确提取位置信息", async () => {
        memoryManager.updateMemory({
          user: "我在浦东张江工作",
          assistant: "张江有好几家门店",
        });

        // 等待异步提取完成
        await memoryManager.waitForExtractions();

        const longTermMemory = (memoryManager as any).longTermMemory as Map<string, any>;
        const entries = Array.from(longTermMemory.entries());

        // 验证位置信息被提取
        const locationEntries = entries.filter(([key]) => key.startsWith("location_"));
        expect(locationEntries.length).toBeGreaterThan(0);

        // 验证存储格式：key是 ${type}_${timestamp}_${index}
        expect(locationEntries[0][0]).toMatch(/^location_\d+_\d+$/);

        // 应该提取到"浦东"和"张江"
        const locations = locationEntries.map(([_, value]) => value);
        expect(locations).toContain("浦东");
        expect(locations).toContain("张江");
      });

      it("应该正确提取年龄信息", async () => {
        memoryManager.updateMemory({
          user: "我今年45岁",
          assistant: "45岁可以工作",
        });

        // 等待异步提取完成
        await memoryManager.waitForExtractions();

        const longTermMemory = (memoryManager as any).longTermMemory as Map<string, any>;
        const entries = Array.from(longTermMemory.entries());

        const ageEntries = entries.filter(([key]) => key.startsWith("age_"));
        expect(ageEntries.length).toBeGreaterThan(0);
        expect(ageEntries[0][1]).toBe(45); // SmartExtractor返回数字，不是字符串
      });

      it("应该智能提取真实对话中的品牌信息", async () => {
        // 测试场景1：直接询问品牌
        memoryManager.updateMemory({
          user: "肯德基有岗位吗？",
          assistant: "有的，肯德基多个门店在招",
        });

        // 等待异步提取完成
        await memoryManager.waitForExtractions();

        let longTermMemory = (memoryManager as any).longTermMemory as Map<string, any>;
        let brandEntries = Array.from(longTermMemory.entries()).filter(([key]) =>
          key.startsWith("brand_")
        );

        expect(brandEntries.length).toBeGreaterThan(0);
        expect(brandEntries.some(([_, value]) => value === "肯德基")).toBe(true);

        // 测试场景2：工作经历中的品牌
        memoryManager.updateMemory({
          user: "我之前在麦当劳干过两年",
          assistant: "有餐饮经验很好",
        });

        // 等待异步提取完成
        await memoryManager.waitForExtractions();

        longTermMemory = (memoryManager as any).longTermMemory as Map<string, any>;
        brandEntries = Array.from(longTermMemory.entries()).filter(([key]) =>
          key.startsWith("brand_")
        );

        expect(brandEntries.some(([_, value]) => value === "麦当劳")).toBe(true);

        // 测试场景3：品牌别名识别
        memoryManager.updateMemory({
          user: "除了KFC，还有其他快餐店吗",
          assistant: "还有汉堡王和必胜客",
        });

        // 等待异步提取完成
        await memoryManager.waitForExtractions();

        longTermMemory = (memoryManager as any).longTermMemory as Map<string, any>;
        brandEntries = Array.from(longTermMemory.entries()).filter(([key]) =>
          key.startsWith("brand_")
        );

        // KFC应该被识别为肯德基
        expect(brandEntries.some(([_, value]) => value === "肯德基")).toBe(true);
        expect(brandEntries.some(([_, value]) => value === "汉堡王")).toBe(true);
        expect(brandEntries.some(([_, value]) => value === "必胜客")).toBe(true);
      });

      it("应该智能提取复杂对话中的多个品牌", async () => {
        memoryManager.updateMemory({
          user: "星巴克环境比较好，但海底捞太累了，我更想去肯德基或麦当劳",
          assistant: "了解，快餐店确实相对轻松一些",
        });

        // 等待异步提取完成
        await memoryManager.waitForExtractions();

        const longTermMemory = (memoryManager as any).longTermMemory as Map<string, any>;
        const brandEntries = Array.from(longTermMemory.entries())
          .filter(([key]) => key.startsWith("brand_"))
          .map(([_, value]) => value);

        // 应该提取到所有提到的品牌
        expect(brandEntries).toContain("星巴克");
        expect(brandEntries).toContain("海底捞");
        expect(brandEntries).toContain("肯德基");
        expect(brandEntries).toContain("麦当劳");
      });

      it("应该正确提取时间安排信息", async () => {
        memoryManager.updateMemory({
          user: "时间：晚班比较合适",
          assistant: "有晚班岗位",
        });

        // 等待异步提取完成
        await memoryManager.waitForExtractions();

        const longTermMemory = (memoryManager as any).longTermMemory as Map<string, any>;
        const entries = Array.from(longTermMemory.entries());

        const scheduleEntries = entries.filter(([key]) => key.startsWith("schedule_"));
        expect(scheduleEntries.length).toBeGreaterThan(0);
        // SmartExtractor提取时间偏好关键词，而不是完整句子
        expect(scheduleEntries[0][1]).toBe("晚班");

        // 同时也验证旧的正则模式仍然工作（作为备用）
        const regexEntries = entries.filter(([key]) => key.includes("_regex"));
        if (regexEntries.length > 0) {
          // 正则模式可能提取"晚班比较合适"
          expect(regexEntries[0][1]).toBeDefined();
        }
      });

      it("应该在压缩时按类型聚合并去重", async () => {
        // 添加多个同类型的事实
        memoryManager.updateMemory({
          user: "我在浦东",
          assistant: "好的",
        });

        memoryManager.updateMemory({
          user: "地址：浦东新区",
          assistant: "了解",
        });

        memoryManager.updateMemory({
          user: "在浦东工作",
          assistant: "知道了",
        });

        // 等待异步提取完成
        await memoryManager.waitForExtractions();

        const context = memoryManager.getOptimizedContext();

        // 验证压缩后的结构
        expect(context.facts.location).toBeDefined();
        expect(Array.isArray(context.facts.location)).toBe(true);

        // 应该去重并最多保留3个
        expect(context.facts.location.length).toBeLessThanOrEqual(3);
        expect(context.facts.location.length).toBeGreaterThan(0);
      });

      it("应该在cleanupMemory时清理超出限制的长期记忆", () => {
        // 直接向longTermMemory添加数据以测试清理功能
        // （因为当前的extractToLongTerm实现有限，难以生成大量记忆）
        const longTermMemory = (memoryManager as any).longTermMemory as Map<string, any>;

        // 直接添加超过30条的长期记忆
        for (let i = 0; i < 50; i++) {
          longTermMemory.set(`test_fact_${i}`, `value_${i}`);
        }

        // 验证添加成功
        expect(longTermMemory.size).toBe(50);

        // 执行清理
        memoryManager.cleanupMemory();

        // 验证清理后的数量不超过30
        expect(longTermMemory.size).toBeLessThanOrEqual(30);

        // 验证保留的是最新的条目（key值较大的）
        const remainingKeys = Array.from(longTermMemory.keys());
        if (remainingKeys.length > 0) {
          // 应该保留的是 test_fact_20 到 test_fact_49
          const numbers = remainingKeys
            .filter(k => k.startsWith("test_fact_"))
            .map(k => parseInt(k.replace("test_fact_", "")));

          const minNumber = Math.min(...numbers);
          expect(minNumber).toBeGreaterThanOrEqual(20); // 应该保留后面的条目
        }
      });
    });

    it("应该提取长期记忆事实", async () => {
      memoryManager.updateMemory({
        user: "我50岁了，在浦东",
        assistant: "年龄没问题，浦东有门店",
      });

      // 等待异步提取完成
      await memoryManager.waitForExtractions();

      const context = memoryManager.getOptimizedContext();
      expect(context.facts).toBeDefined();
      expect(Object.keys(context.facts).length).toBeGreaterThan(0);
    });

    it("应该管理工作内存", () => {
      memoryManager.setWorkingMemory("currentBrand", "肯德基");
      memoryManager.setWorkingMemory("replyType", "initial_inquiry");

      const context = memoryManager.getOptimizedContext();
      expect(context.working.currentBrand).toBe("肯德基");
      expect(context.working.replyType).toBe("initial_inquiry");
    });

    it("应该在超出token预算时优化内存", () => {
      const longHistory = Array(100)
        .fill(null)
        .map((_, i) => `用户: 这是第${i}条消息，包含很多很多很多很多很多很多很多很多很多很多内容`);

      memoryManager.loadConversationHistory(longHistory);
      const context = memoryManager.getOptimizedContext(1000);

      // 应该保留至少5轮对话
      expect(context.recent.length).toBeGreaterThanOrEqual(5);
      // 但不应该保留全部100条
      expect(context.recent.length).toBeLessThan(100);
    });

    it("应该清理过期内存", () => {
      // 添加大量长期记忆
      for (let i = 0; i < 50; i++) {
        memoryManager.updateMemory({
          user: `消息${i}`,
          assistant: `回复${i}`,
        });
      }

      memoryManager.cleanupMemory();
      const context = memoryManager.getOptimizedContext();

      // 长期记忆应该被限制在合理范围内
      const totalFacts = Object.values(context.facts).reduce(
        (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0),
        0
      );
      expect(totalFacts).toBeLessThanOrEqual(30);
    });

    describe("getMemoryStats 内存统计测试", () => {
      it("应该返回正确的内存统计信息", async () => {
        // 添加各种类型的内存数据
        memoryManager.updateMemory({
          user: "我25岁，在浦东",
          assistant: "了解你的情况",
        });

        // 等待异步提取完成
        await memoryManager.waitForExtractions();

        memoryManager.setWorkingMemory("brand", "肯德基");
        memoryManager.setWorkingMemory("urgency", "high");

        const stats = memoryManager.getMemoryStats();

        // 验证统计信息结构
        expect(stats).toHaveProperty("shortTermCount");
        expect(stats).toHaveProperty("workingMemoryCount");
        expect(stats).toHaveProperty("longTermCount");
        expect(stats).toHaveProperty("estimatedTokens");

        // 验证具体数值
        expect(stats.shortTermCount).toBe(1); // 一轮对话
        expect(stats.workingMemoryCount).toBe(2); // 两个工作内存项
        expect(stats.longTermCount).toBeGreaterThan(0); // 应该提取了一些长期事实
        expect(stats.estimatedTokens).toBeGreaterThan(0); // 应该有token估算
      });

      it("应该在大量数据时返回合理的统计信息", async () => {
        // 添加大量数据
        for (let i = 0; i < 10; i++) {
          memoryManager.updateMemory({
            user: `用户消息${i}，我${i + 20}岁`,
            assistant: `助手回复${i}`,
          });
          memoryManager.setWorkingMemory(`key${i}`, `value${i}`);
        }

        // 等待异步提取完成
        await memoryManager.waitForExtractions();

        const stats = memoryManager.getMemoryStats();

        expect(stats.shortTermCount).toBe(10);
        expect(stats.workingMemoryCount).toBe(10);
        expect(stats.longTermCount).toBeGreaterThan(0);
        expect(stats.estimatedTokens).toBeGreaterThan(100); // 大量数据应该有较高的token估算
      });

      it("应该在重置后返回零统计", () => {
        // 先添加一些数据
        memoryManager.updateMemory({
          user: "测试",
          assistant: "回复",
        });
        memoryManager.setWorkingMemory("test", "value");

        // 重置内存
        memoryManager.resetMemory();

        const stats = memoryManager.getMemoryStats();

        expect(stats.shortTermCount).toBe(0);
        expect(stats.workingMemoryCount).toBe(0);
        expect(stats.longTermCount).toBe(0);
        expect(stats.estimatedTokens).toBeGreaterThanOrEqual(0); // 即使为0也应该是有效数字
      });
    });

    describe("三种内存类型交互关系测试", () => {
      it("应该正确处理内存间的数据流转", async () => {
        // 1. 通过updateMemory添加对话（影响shortTerm和longTerm）
        memoryManager.updateMemory({
          user: "我30岁，在浦东工作，想找肯德基的岗位",
          assistant: "好的，已了解您的需求",
        });

        // 等待异步提取完成
        await memoryManager.waitForExtractions();

        // 2. 设置工作内存
        memoryManager.setWorkingMemory("currentSession", "active");
        memoryManager.setWorkingMemory("priority", "high");

        // 3. 验证三种内存都有数据
        const stats = memoryManager.getMemoryStats();
        expect(stats.shortTermCount).toBe(1);
        expect(stats.workingMemoryCount).toBe(2);
        expect(stats.longTermCount).toBeGreaterThan(0);

        // 4. 验证getOptimizedContext整合了所有内存
        const context = memoryManager.getOptimizedContext();
        expect(context.recent.length).toBe(1);
        expect(Object.keys(context.working).length).toBe(2);
        expect(Object.keys(context.facts).length).toBeGreaterThan(0);

        // 5. 验证工作内存的具体内容
        expect(context.working.currentSession).toBe("active");
        expect(context.working.priority).toBe("high");
      });

      it("应该在token预算限制下平衡三种内存", async () => {
        // 添加大量不同类型的内存
        for (let i = 0; i < 20; i++) {
          memoryManager.updateMemory({
            user: `消息${i}，我${i + 20}岁，在地区${i}`,
            assistant: `回复${i}`,
          });
        }

        for (let i = 0; i < 15; i++) {
          memoryManager.setWorkingMemory(`session${i}`, `value${i}`);
        }

        // 等待异步提取完成
        await memoryManager.waitForExtractions();

        // 使用较小的token预算
        const context = memoryManager.getOptimizedContext(1000);

        // 验证在预算限制下仍保持数据完整性
        expect(context.recent.length).toBeGreaterThan(0);
        expect(context.recent.length).toBeLessThan(20); // 应该被截断
        expect(Object.keys(context.working).length).toBe(15); // 工作内存应该完整保留
        expect(Object.keys(context.facts).length).toBeGreaterThan(0); // 长期事实应该被压缩但存在
      });

      it("应该支持内存重置后的完全清理", () => {
        // 添加各种内存数据
        memoryManager.updateMemory({
          user: "测试消息",
          assistant: "测试回复",
        });
        memoryManager.setWorkingMemory("test", "value");

        // 验证内存有数据
        let stats = memoryManager.getMemoryStats();
        expect(
          stats.shortTermCount + stats.workingMemoryCount + stats.longTermCount
        ).toBeGreaterThan(0);

        // 重置内存
        memoryManager.resetMemory();

        // 验证完全清理
        stats = memoryManager.getMemoryStats();
        expect(stats.shortTermCount).toBe(0);
        expect(stats.workingMemoryCount).toBe(0);
        expect(stats.longTermCount).toBe(0);

        const context = memoryManager.getOptimizedContext();
        expect(context.recent.length).toBe(0);
        expect(Object.keys(context.working).length).toBe(0);
        expect(Object.keys(context.facts).length).toBe(0);
      });
    });
  });

  describe("ReplyPromptBuilder 与内存管理集成", () => {
    let builder: ReplyPromptBuilder;

    beforeEach(() => {
      builder = new ReplyPromptBuilder();
    });

    it("应该在构建提示时使用内存上下文", async () => {
      // 先添加一些历史记忆
      builder.updateMemory("你好", "你好，有什么可以帮助你的？");
      builder.updateMemory("我在浦东", "浦东有多家门店");
      builder.updateMemory("我50岁", "年龄符合要求");

      // 等待异步提取完成
      await (builder as any).memoryManager.waitForExtractions();

      const params: ReplyBuilderParams = {
        message: "有什么岗位？",
        classification: {
          replyType: "initial_inquiry",
          extractedInfo: {},
          reasoningText: "询问岗位",
        },
        contextInfo: "服务员、后厨等岗位",
        systemInstruction: "推荐合适岗位",
        conversationHistory: [], // 故意留空，测试内存是否生效
      };

      const result = builder.build(params);

      // 验证内存使用情况
      expect(result.metadata?.memoryUsage).toBeGreaterThan(0);

      // 内存应该影响生成的提示（通过元数据间接验证）
      expect(result.metadata?.estimatedTokens).toBeGreaterThan(100);
    });

    it("应该支持设置工作内存并在构建时使用", () => {
      const builder = new ReplyPromptBuilder();

      // 模拟设置工作内存（通过内部方法）
      const memoryManager = (builder as any).memoryManager as CellularMemoryManager;
      memoryManager.setWorkingMemory("targetBrand", "奥乐齐");
      memoryManager.setWorkingMemory("candidateAge", "45");
      memoryManager.setWorkingMemory("urgencyLevel", "high");

      const params: ReplyBuilderParams = {
        message: "急需工作",
        classification: {
          replyType: "initial_inquiry",
          extractedInfo: { hasUrgency: true },
          reasoningText: "紧急求职",
        },
        contextInfo: "奥乐齐晚班补货",
        systemInstruction: "快速响应",
        conversationHistory: [],
      };

      const result = builder.build(params);

      // 工作内存应该被考虑（通过结果验证）
      expect(result).toBeDefined();
      expect(result.metadata?.memoryUsage).toBeGreaterThanOrEqual(0);
    });

    it("应该在大量对话后智能压缩内存", () => {
      const builder = new ReplyPromptBuilder();

      // 添加大量对话
      for (let i = 0; i < 200; i++) {
        builder.updateMemory(
          `这是第${i}条很长的用户消息，包含大量内容`,
          `这是第${i}条很长的助手回复，也包含大量内容`
        );
      }

      // 构建提示，触发内存优化
      const params: ReplyBuilderParams = {
        message: "最新问题",
        classification: {
          replyType: "general_chat",
          extractedInfo: {},
          reasoningText: "一般对话",
        },
        contextInfo: "测试数据",
        systemInstruction: "测试指令",
        conversationHistory: [],
      };

      const result = builder.build(params);

      // 验证内存被优化到合理范围
      const estimatedTokens = result.metadata?.estimatedTokens || 0;
      expect(estimatedTokens).toBeLessThan(3500); // Token预算内

      // 验证prompt结构完整
      expect(result.prompt).toBeDefined();
      expect(result.prompt.length).toBeGreaterThan(0);

      // 验证包含关键部分
      expect(result.prompt).toContain("[指令]");
      expect(result.prompt).toContain("[对话分析]"); // 原 [当前上下文] 重命名为 [对话分析]
      expect(result.prompt).toContain("[对话历史]");
      expect(result.prompt).toContain("[候选人消息]");
      expect(result.prompt).toContain("最新问题");

      // 验证对话历史被压缩（不应该包含所有200条）
      const historyMatches = result.prompt.match(/这是第\d+条/g) || [];
      expect(historyMatches.length).toBeLessThan(200); // 对话历史应该被压缩
    });
  });
});
