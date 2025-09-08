import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_URL, SUPABASE_PUBLIC_ANON_KEY } from "@/lib/constants";
/**
 * 创建Supabase Server 客户端
 * 用于在服务器组件中创建Supabase客户端
 * @returns
 */
export const createClient = async () => {
  // 环境变量检查
  if (!SUPABASE_URL || !SUPABASE_PUBLIC_ANON_KEY) {
    throw new Error("[SUPABASE SERVER] 环境变量 SUPABASE_URL 或 SUPABASE_PUBLIC_ANON_KEY 未设置");
  }

  try {
    // 使用 await cookies() 以避免类型错误
    const cookieStore = await cookies();

    return createServerClient(SUPABASE_URL, SUPABASE_PUBLIC_ANON_KEY, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch (error) {
            // 当在 Server Component 调用 set 时会抛错
            // 如果已在 middleware 中处理刷新 session，可安全忽略
            if (process.env.NODE_ENV !== "production") {
              console.warn(
                "[SUPABASE SERVER] cookies.set 在 Server Component 中被调用，可忽略：",
                error
              );
            }
          }
        },
      },
    });
  } catch (error) {
    // 统一错误处理，输出更详尽的日志
    console.error("[SUPABASE SERVER] 创建 Supabase Server 客户端失败:", error);
    throw error instanceof Error ? error : new Error("[SUPABASE SERVER] 未知错误");
  }
};
