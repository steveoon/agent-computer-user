/**
 * Middleware 鉴权和 CORS 逻辑测试
 *
 * 注意：这个测试模拟外部鉴权服务的响应
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { middleware, clearTokenCache } from "../middleware";

// Mock fetch 全局函数
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock Supabase middleware
vi.mock("../lib/utils/supabase/middleware", () => ({
  updateSession: vi.fn(() => NextResponse.next()),
}));

describe("Middleware - CORS 处理", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    clearTokenCache(); // 清理 token 缓存
  });

  afterEach(() => {
    vi.useRealTimers();
    clearTokenCache(); // 清理 token 缓存
  });

  describe("OPTIONS 预检请求", () => {
    it("应该正确处理 OPTIONS 请求并返回 CORS 头", async () => {
      const request = new NextRequest("http://localhost:3000/api/v1/tools", {
        method: "OPTIONS",
        headers: {
          "Origin": "http://localhost:3001",
        },
      });

      const response = await middleware(request);

      // 应该返回 200 状态码
      expect(response.status).toBe(200);

      // 应该包含必要的 CORS 头
      expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET,DELETE,PATCH,POST,PUT,OPTIONS");
      expect(response.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
      expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
      expect(response.headers.get("Access-Control-Max-Age")).toBe("86400");
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3001");
    });

    it("OPTIONS 请求不应该进行鉴权检查", async () => {
      const request = new NextRequest("http://localhost:3000/api/v1/tools", {
        method: "OPTIONS",
        // 没有 Authorization header
        headers: {
          "Origin": "http://localhost:3001",
        },
      });

      const response = await middleware(request);

      // 应该返回 200 而不是 401
      expect(response.status).toBe(200);
      // 不应该调用外部鉴权服务
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("CORS 头设置", () => {
    it("成功请求应该包含 CORS 头", async () => {
      // Mock 外部服务返回成功
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ isSuccess: true }),
      });

      const request = new NextRequest("http://localhost:3000/api/v1/tools", {
        headers: {
          "Authorization": "Bearer valid-token",
          "Origin": "http://localhost:3001",
        },
      });

      const response = await middleware(request);

      // 应该包含 CORS 头
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3001");
      expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
      expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET,DELETE,PATCH,POST,PUT,OPTIONS");
    });

    it("错误响应也应该包含 CORS 头", async () => {
      const request = new NextRequest("http://localhost:3000/api/v1/tools", {
        headers: {
          // 没有 Authorization header
          "Origin": "http://localhost:3001",
        },
      });

      const response = await middleware(request);

      // 应该返回 401
      expect(response?.status).toBe(401);
      // 错误响应也应该包含 CORS 头
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3001");
      expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    });

    it("只允许白名单中的源", async () => {
      // Mock 外部服务返回成功
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ isSuccess: true }),
      });

      // 来自非白名单源的请求
      const request = new NextRequest("http://localhost:3000/api/v1/tools", {
        headers: {
          "Authorization": "Bearer valid-token",
          "Origin": "https://evil.com",
        },
      });

      const response = await middleware(request);

      // 不应该设置 Access-Control-Allow-Origin
      expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
      // 但其他 CORS 头应该存在
      expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    });

    it("允许的源应该正确设置 CORS", async () => {
      // Mock 外部服务返回成功
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ isSuccess: true }),
      });

      // 测试 localhost:3000（在默认白名单中）
      const request1 = new NextRequest("http://localhost:3000/api/v1/tools", {
        headers: {
          "Authorization": "Bearer valid-token",
          "Origin": "http://localhost:3000",
        },
      });

      const response1 = await middleware(request1);
      expect(response1.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3000");

      // 测试 localhost:3001（也在默认白名单中）
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ isSuccess: true }),
      });

      const request2 = new NextRequest("http://localhost:3000/api/v1/tools", {
        headers: {
          "Authorization": "Bearer valid-token",
          "Origin": "http://localhost:3001",
        },
      });

      const response2 = await middleware(request2);
      expect(response2.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3001");
    });

    it("非 /api 路径不应该添加 CORS 头", async () => {
      const request = new NextRequest("http://localhost:3000/dashboard", {
        headers: {
          "Origin": "http://localhost:3001",
        },
      });

      const response = await middleware(request);

      // 非 API 路径不应该有 CORS 头
      expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
      expect(response.headers.get("Access-Control-Allow-Methods")).toBeNull();
    });

    it("其他 /api 路径也应该添加 CORS 头", async () => {
      const request = new NextRequest("http://localhost:3000/api/chat", {
        headers: {
          "Origin": "http://localhost:3001",
        },
      });

      const response = await middleware(request);

      // 其他 API 路径也应该有 CORS 头
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3001");
      expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    });
  });
});

describe("Middleware - Open API 鉴权", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset(); // 完全重置 mock
    vi.useFakeTimers();
    clearTokenCache(); // 清理 token 缓存
  });

  afterEach(() => {
    vi.useRealTimers();
    clearTokenCache(); // 清理 token 缓存
    mockFetch.mockReset(); // 完全重置 mock
  });

  describe("/api/v1/* 路径鉴权", () => {
    it("应该拒绝没有 Authorization header 的请求", async () => {
      const request = new NextRequest("http://localhost:3000/api/v1/tools");

      const response = await middleware(request);
      expect(response?.status).toBe(401);

      const body = await response?.json();
      expect(body).toEqual({
        error: "Unauthorized",
        message: "Missing authorization header",
        statusCode: 401,
      });
    });

    it("应该拒绝错误格式的 Authorization header", async () => {
      const request = new NextRequest("http://localhost:3000/api/v1/tools", {
        headers: {
          "Authorization": "InvalidFormat",
        },
      });

      const response = await middleware(request);
      expect(response?.status).toBe(401);

      const body = await response?.json();
      expect(body).toEqual({
        error: "Unauthorized",
        message: "Invalid authorization format. Use: Bearer <token>",
        statusCode: 401,
      });
    });

    it("应该调用外部服务验证 token", async () => {
      // Mock 外部服务返回成功
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ isSuccess: true }),
      });

      const request = new NextRequest("http://localhost:3000/api/v1/tools", {
        headers: {
          "Authorization": "Bearer valid-token",
        },
      });

      const response = await middleware(request);

      // 应该放行请求
      expect(response.status).toBe(200); // NextResponse.next() 返回 200
      expect(response.headers.get("x-middleware-next")).toBe("1");

      // 验证调用了外部服务
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("validate-key"),
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            "Authorization": "Bearer valid-token",
          }),
        })
      );
    });

    it("应该缓存已验证的 token", async () => {
      // Mock 外部服务返回成功
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ isSuccess: true }),
      });

      const request1 = new NextRequest("http://localhost:3000/api/v1/tools", {
        headers: {
          "Authorization": "Bearer cached-token",
        },
      });

      // 第一次请求
      await middleware(request1);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // 第二次请求（应该从缓存读取）
      const request2 = new NextRequest("http://localhost:3000/api/v1/models", {
        headers: {
          "Authorization": "Bearer cached-token",
        },
      });

      await middleware(request2);
      // 不应该再次调用外部服务
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("应该处理外部服务不可用的情况", async () => {
      // Mock 外部服务超时
      mockFetch.mockRejectedValue(new Error("Network error"));

      const request = new NextRequest("http://localhost:3000/api/v1/tools", {
        headers: {
          "Authorization": "Bearer test-token-network-error",
        },
      });

      const response = await middleware(request);
      expect(response?.status).toBe(401);

      const body = await response?.json();
      expect(body.error).toBe("Unauthorized");
      expect(body.message).toBe("Invalid or expired API key");
    });

    it("应该拒绝无效的 token", async () => {
      // Mock 外部服务返回失败
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const request = new NextRequest("http://localhost:3000/api/v1/tools", {
        headers: {
          "Authorization": "Bearer invalid-token",
        },
      });

      const response = await middleware(request);
      expect(response?.status).toBe(401);

      const body = await response?.json();
      expect(body).toEqual({
        error: "Unauthorized",
        message: "Invalid or expired API key",
        statusCode: 401,
      });
    });

    it("缓存应该在 60 秒后过期", async () => {
      // 设置 mock
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ isSuccess: true }),
      });

      const request = new NextRequest("http://localhost:3000/api/v1/tools", {
        headers: {
          "Authorization": "Bearer expiring-token-unique",
        },
      });

      // 第一次请求，应该调用外部服务
      await middleware(request);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // 59秒后，仍然使用缓存
      vi.advanceTimersByTime(59 * 1000);
      await middleware(request);
      expect(mockFetch).toHaveBeenCalledTimes(1); // 仍然是1次，因为使用了缓存

      // 61秒后，缓存过期，需要重新验证
      vi.advanceTimersByTime(2 * 1000);
      await middleware(request);
      expect(mockFetch).toHaveBeenCalledTimes(2); // 现在应该是2次，因为缓存过期了
    });
  });

  describe("非 /api/v1/* 路径", () => {
    it("应该使用 Supabase 会话更新逻辑", async () => {
      const { updateSession } = await import("../lib/utils/supabase/middleware");
      const request = new NextRequest("http://localhost:3000/dashboard");

      await middleware(request);

      // 应该调用 Supabase 的 updateSession
      expect(updateSession).toHaveBeenCalledWith(request);
      // 不应该调用外部鉴权服务
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("不应该检查 Authorization header", async () => {
      const request = new NextRequest("http://localhost:3000/");
      // 没有 Authorization header，但应该正常处理

      const response = await middleware(request);
      // 不应该返回 401
      expect(response?.status).not.toBe(401);
    });
  });

  describe("缓存清理", () => {
    it("应该定期清理过期的缓存项", async () => {
      // Mock 外部服务返回成功
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ isSuccess: true }),
      });

      // 添加多个 token 到缓存
      const tokens = ["token1", "token2", "token3"];
      for (const token of tokens) {
        const request = new NextRequest("http://localhost:3000/api/v1/tools", {
          headers: { "Authorization": `Bearer ${token}` },
        });
        await middleware(request);
      }

      // 验证调用了外部服务3次
      expect(mockFetch).toHaveBeenCalledTimes(3);

      // 使部分 token 过期
      vi.advanceTimersByTime(61 * 1000);

      // 触发清理（通过新请求）
      const newRequest = new NextRequest("http://localhost:3000/api/v1/tools", {
        headers: { "Authorization": "Bearer new-token" },
      });
      await middleware(newRequest);

      // 验证过期的 token 被清理（通过再次请求验证）
      for (const token of tokens) {
        mockFetch.mockClear();
        const request = new NextRequest("http://localhost:3000/api/v1/tools", {
          headers: { "Authorization": `Bearer ${token}` },
        });
        await middleware(request);
        // 应该重新调用外部服务（因为缓存已过期）
        expect(mockFetch).toHaveBeenCalledTimes(1);
      }
    });
  });
});