import { describe, it, expect, beforeEach, vi } from "vitest";
import { localCacheService } from "../local-cache.service";

describe("LocalCacheService", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  describe("get", () => {
    it("should return null for non-existent key", async () => {
      const result = await localCacheService.get("non-existent-key");
      expect(result).toBeNull();
    });

    it("should return stored value", async () => {
      await localCacheService.setex("test-key", 60, { name: "张三" });
      const result = await localCacheService.get<{ name: string }>("test-key");
      expect(result).toEqual({ name: "张三" });
    });

    it("should return null for expired entry", async () => {
      vi.useFakeTimers();
      await localCacheService.setex("expire-key", 1, "value");

      // 模拟 1001ms 后
      vi.advanceTimersByTime(1001);

      const result = await localCacheService.get("expire-key");
      expect(result).toBeNull();
    });

    it("should not expire entry before TTL", async () => {
      vi.useFakeTimers();
      await localCacheService.setex("alive-key", 60, "alive");

      vi.advanceTimersByTime(30_000); // 30 秒，未到期

      const result = await localCacheService.get("alive-key");
      expect(result).toBe("alive");
    });
  });

  describe("setex", () => {
    it("should update TTL on repeated setex (sliding expiry)", async () => {
      vi.useFakeTimers();
      await localCacheService.setex("slide-key", 60, "v1");

      vi.advanceTimersByTime(50_000); // 50 秒后重新写入，刷新 TTL
      await localCacheService.setex("slide-key", 60, "v2");

      vi.advanceTimersByTime(50_000); // 再过 50 秒，总计 100 秒，但 TTL 从第 50 秒重置

      const result = await localCacheService.get("slide-key");
      expect(result).toBe("v2"); // 仍有效
    });

    it("should overwrite existing value", async () => {
      await localCacheService.setex("overwrite-key", 60, "old");
      await localCacheService.setex("overwrite-key", 60, "new");
      const result = await localCacheService.get("overwrite-key");
      expect(result).toBe("new");
    });
  });

  describe("del", () => {
    it("should remove entry", async () => {
      await localCacheService.setex("del-key", 60, "value");
      await localCacheService.del("del-key");
      const result = await localCacheService.get("del-key");
      expect(result).toBeNull();
    });

    it("should not throw when deleting non-existent key", async () => {
      await expect(localCacheService.del("ghost-key")).resolves.toBeUndefined();
    });
  });
});
