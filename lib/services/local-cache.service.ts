/**
 * 本地内存缓存服务
 *
 * 替代 Redis，使用进程内 Map 实现 get/setex 语义。
 * TTL 到期后惰性删除（下次访问时清理）。
 * 注意：进程重启后缓存丢失，适合开发/单机部署场景。
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number; // ms timestamp，0 表示永不过期
}

class LocalCacheService {
  private readonly store = new Map<string, CacheEntry<unknown>>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt > 0 && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  /** 设置带 TTL（秒）的缓存，每次调用滑动更新过期时间 */
  async setex(key: string, ttlSeconds: number, value: unknown): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }
}

export const localCacheService = new LocalCacheService();
