/**
 * Tests for unified chat details types
 */

import { describe, it, expect } from "vitest";
import {
  ChatDetailsResultSchema,
  ChatMessageSchema,
  UnifiedCandidateInfoSchema,
  parseChatDetailsResult,
  isSuccessfulChatDetailsResult,
  isErrorChatDetailsResult,
  extractCandidateName,
  extractTotalMessages,
  getSenderDisplay,
  migrateToUnifiedType,
} from "../chat-details";

describe("Chat Details Type System", () => {
  describe("Schema Validation", () => {
    it("should validate a complete chat details result", () => {
      const validResult = {
        success: true,
        message: "成功获取聊天详情",
        data: {
          candidateInfo: {
            name: "张三",
            position: "前端开发",
            age: "25",
            experience: "3年",
            education: "本科",
            customField: "额外字段", // passthrough should allow this
          },
          chatMessages: [
            {
              index: 0,
              sender: "candidate",
              messageType: "text",
              content: "你好",
              time: "10:30",
              hasTime: true,
            },
            {
              index: 1,
              sender: "recruiter",
              messageType: "text",
              content: "您好，请问方便聊聊吗？",
              time: "10:31",
              hasTime: true,
            },
          ],
          stats: {
            totalMessages: 2,
            candidateMessages: 1,
            recruiterMessages: 1,
            systemMessages: 0,
            messagesWithTime: 2,
          },
        },
        summary: {
          candidateName: "张三",
          candidatePosition: "前端开发",
          totalMessages: 2,
          lastMessageTime: "10:31",
        },
        formattedHistory: ["求职者: 你好", "我: 您好，请问方便聊聊吗？"],
      };

      const parsed = ChatDetailsResultSchema.safeParse(validResult);
      expect(parsed.success).toBe(true);
    });

    it("should handle minimal valid result", () => {
      const minimalResult = {
        success: false,
        error: "未找到聊天窗口",
      };

      const parsed = ChatDetailsResultSchema.safeParse(minimalResult);
      expect(parsed.success).toBe(true);
    });

    it("should allow platform-specific fields in candidateInfo", () => {
      const candidateInfo = {
        name: "李四",
        position: "后端开发",
        // Platform-specific fields
        zhipinSpecificField: "BOSS直聘特有字段",
        yupaoSpecificField: "Yupao特有字段",
        someOtherData: { nested: "data" },
      };

      const parsed = UnifiedCandidateInfoSchema.safeParse(candidateInfo);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data).toHaveProperty("zhipinSpecificField");
        expect(parsed.data).toHaveProperty("yupaoSpecificField");
        expect(parsed.data).toHaveProperty("someOtherData");
      }
    });

    it("should validate chat message types", () => {
      const validMessages = [
        { sender: "candidate", messageType: "text" },
        { sender: "recruiter", messageType: "system" },
        { sender: "system", messageType: "resume" },
        { sender: "unknown", messageType: "wechat-exchange" },
      ];

      validMessages.forEach(msg => {
        const fullMsg = {
          ...msg,
          index: 0,
          content: "test",
          time: "",
          hasTime: false,
        };
        const parsed = ChatMessageSchema.safeParse(fullMsg);
        expect(parsed.success).toBe(true);
      });
    });
  });

  describe("Type Guards", () => {
    it("should correctly identify successful results", () => {
      const successResult = {
        success: true,
        data: {
          candidateInfo: { name: "测试" },
          chatMessages: [],
        },
      };

      expect(isSuccessfulChatDetailsResult(successResult as any)).toBe(true);
      expect(isErrorChatDetailsResult(successResult as any)).toBe(false);
    });

    it("should correctly identify error results", () => {
      const errorResult = {
        success: false,
        error: "错误信息",
      };

      expect(isSuccessfulChatDetailsResult(errorResult as any)).toBe(false);
      expect(isErrorChatDetailsResult(errorResult as any)).toBe(true);
    });
  });

  describe("Utility Functions", () => {
    it("should extract candidate name correctly", () => {
      const resultWithSummary = {
        summary: {
          candidateName: "从摘要获取",
          candidatePosition: "职位",
          totalMessages: 0,
          lastMessageTime: "",
        },
      };
      expect(extractCandidateName(resultWithSummary)).toBe("从摘要获取");

      const resultWithData = {
        data: {
          candidateInfo: { name: "从数据获取" },
        },
      };
      expect(extractCandidateName(resultWithData)).toBe("从数据获取");

      const emptyResult = {};
      expect(extractCandidateName(emptyResult)).toBe("未知");
    });

    it("should extract total messages correctly", () => {
      const resultWithSummary = {
        summary: {
          candidateName: "",
          candidatePosition: "",
          totalMessages: 10,
          lastMessageTime: "",
        },
      };
      expect(extractTotalMessages(resultWithSummary)).toBe(10);

      const resultWithStats = {
        data: {
          stats: {
            totalMessages: 20,
            candidateMessages: 10,
            recruiterMessages: 10,
            systemMessages: 0,
            messagesWithTime: 20,
          },
        },
      };
      expect(extractTotalMessages(resultWithStats)).toBe(20);

      const resultWithMessages = {
        data: {
          chatMessages: new Array(5).fill({
            index: 0,
            sender: "candidate",
            messageType: "text",
            content: "test",
            time: "",
            hasTime: false,
          }),
        },
      };
      expect(extractTotalMessages(resultWithMessages)).toBe(5);
    });

    it("should provide correct sender display info", () => {
      const candidateDisplay = getSenderDisplay("candidate");
      expect(candidateDisplay.label).toBe("候选人");
      expect(candidateDisplay.defaultColor).toContain("blue");

      const recruiterDisplay = getSenderDisplay("recruiter");
      expect(recruiterDisplay.label).toBe("招聘者");
      expect(recruiterDisplay.defaultColor).toContain("green");

      const systemDisplay = getSenderDisplay("system");
      expect(systemDisplay.label).toBe("系统");
      expect(systemDisplay.defaultColor).toContain("gray");

      const unknownDisplay = getSenderDisplay("unknown");
      expect(unknownDisplay.label).toBe("未知");
    });
  });

  describe("Migration Helper", () => {
    it("should handle already valid data", () => {
      const validData = {
        success: true,
        message: "test",
        data: {},
        summary: {
          candidateName: "test",
          candidatePosition: "test",
          totalMessages: 0,
          lastMessageTime: "",
        },
      };

      const migrated = migrateToUnifiedType(validData);
      expect(migrated).toEqual(validData);
    });

    it("should migrate old structure to new", () => {
      const oldData = {
        success: true,
        message: "old message",
        someUnknownField: "will be ignored",
      };

      const migrated = migrateToUnifiedType(oldData);
      expect(migrated.success).toBe(true);
      expect(migrated.message).toBe("old message");
    });
  });

  describe("parseChatDetailsResult", () => {
    it("should parse valid results", () => {
      const validResult = {
        success: true,
        message: "Success",
      };

      const parsed = parseChatDetailsResult(validResult);
      expect(parsed).not.toBeNull();
      expect(parsed?.success).toBe(true);
    });

    it("should return null for invalid results", () => {
      const invalidResult = {
        notAValidField: "test",
      };

      // Suppress console.warn for this test
      const originalWarn = console.warn;
      console.warn = () => {};

      const parsed = parseChatDetailsResult(invalidResult);
      expect(parsed).toBeNull();

      console.warn = originalWarn;
    });
  });
});
