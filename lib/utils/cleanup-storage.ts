/**
 * 🧹 清理localStorage中的敏感认证数据
 *
 * 这个函数用于清理可能残留在localStorage中的用户认证信息
 * 建议在应用启动时调用，确保敏感数据不会暴露在localStorage中
 */
export const cleanupSensitiveStorage = (): void => {
  try {
    // 需要清理的敏感数据键名列表
    const sensitiveKeys = [
      "auth-storage",
      "user-storage",
      "session-storage",
      "token-storage",
      "supabase.auth.token",
      "user-data",
      "authentication",
    ];

    let cleanedCount = 0;

    sensitiveKeys.forEach(key => {
      if (localStorage.getItem(key) !== null) {
        localStorage.removeItem(key);
        cleanedCount++;
        console.log(`[CLEANUP] 已清理localStorage中的敏感数据: ${key}`);
      }
    });

    if (cleanedCount > 0) {
      console.log(`[CLEANUP] 总共清理了 ${cleanedCount} 个敏感数据项`);
    } else {
      console.log("[CLEANUP] localStorage中未发现敏感数据");
    }
  } catch (error) {
    console.error("[CLEANUP] 清理localStorage时出错:", error);
  }
};

/**
 * 🔍 检查localStorage中是否有敏感数据
 */
export const checkSensitiveStorage = (): {
  hasSensitiveData: boolean;
  keys: string[];
} => {
  const sensitiveKeys = [
    "auth-storage",
    "user-storage",
    "session-storage",
    "token-storage",
    "supabase.auth.token",
    "user-data",
    "authentication",
  ];

  const foundKeys = sensitiveKeys.filter(key => localStorage.getItem(key) !== null);

  return {
    hasSensitiveData: foundKeys.length > 0,
    keys: foundKeys,
  };
};
