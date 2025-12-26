"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/utils/supabase/server";
import { z } from 'zod/v3';

/**
 * 登录表单验证模式
 */
const loginSchema = z.object({
  email: z.string().email("请输入有效的邮箱地址"),
  password: z.string().min(6, "密码至少需要6位字符"),
});

/**
 * 注册表单验证模式
 */
const signUpSchema = z
  .object({
    email: z.string().email("请输入有效的邮箱地址"),
    password: z.string().min(6, "密码至少需要6位字符"),
    confirmPassword: z.string().min(6, "确认密码至少需要6位字符"),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: "两次密码输入不一致",
    path: ["confirmPassword"],
  });

/**
 * 操作结果类型
 */
interface ActionResult {
  readonly success: boolean;
  readonly error?: string;
  readonly details?: unknown;
}

/**
 * 用户登录Server Action
 */
export async function loginAction(formData: FormData): Promise<ActionResult> {
  try {
    // 数据验证
    const rawFormData = {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
    };

    const validatedFields = loginSchema.safeParse(rawFormData);

    if (!validatedFields.success) {
      return {
        success: false,
        error: "输入数据格式错误",
        details: validatedFields.error.flatten().fieldErrors,
      };
    }

    const { email, password } = validatedFields.data;

    // 创建Supabase客户端
    const supabase = await createClient();

    // 执行登录
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("[AUTH] Login error:", error);
      return {
        success: false,
        error:
          error.message === "Invalid login credentials" ? "邮箱或密码错误" : "登录失败，请稍后重试",
      };
    }

    if (!data.user) {
      return {
        success: false,
        error: "登录失败，未获取到用户信息",
      };
    }

    console.log("[AUTH] Login successful:", data.user.email);

    // 重新验证路径以确保服务器端状态更新
    revalidatePath("/", "layout");

    // 给session一点时间来传播
    await new Promise(resolve => setTimeout(resolve, 100));

    return { success: true };
  } catch (error) {
    console.error("[AUTH] Login error:", error);
    return {
      success: false,
      error: "登录过程中发生错误，请稍后重试",
    };
  }
}

/**
 * 用户注册Server Action
 */
export async function signUpAction(formData: FormData): Promise<ActionResult> {
  try {
    // 数据验证
    const rawFormData = {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      confirmPassword: formData.get("confirmPassword") as string,
    };

    const validatedFields = signUpSchema.safeParse(rawFormData);

    if (!validatedFields.success) {
      return {
        success: false,
        error: "输入数据格式错误",
        details: validatedFields.error.flatten().fieldErrors,
      };
    }

    const { email, password } = validatedFields.data;

    // 创建Supabase客户端
    const supabase = await createClient();

    // 执行注册
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      console.error("[AUTH] Sign up error:", error);
      return {
        success: false,
        error:
          error.message === "User already registered" ? "该邮箱已被注册" : "注册失败，请稍后重试",
      };
    }

    if (!data.user) {
      return {
        success: false,
        error: "注册失败，未创建用户",
      };
    }

    console.log("[AUTH] Sign up successful:", data.user.email);

    // 重新验证路径
    revalidatePath("/", "layout");

    return {
      success: true,
    };
  } catch (error) {
    console.error("[AUTH] Sign up error:", error);
    return {
      success: false,
      error: "注册过程中发生错误，请稍后重试",
    };
  }
}

/**
 * 用户登出Server Action
 */
export async function logoutAction(): Promise<ActionResult> {
  try {
    const supabase = await createClient();

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("[AUTH] Logout error:", error);
      return {
        success: false,
        error: "登出失败，请稍后重试",
      };
    }

    console.log("[AUTH] Logout successful");

    // 重新验证路径
    revalidatePath("/", "layout");

    return {
      success: true,
    };
  } catch (error) {
    console.error("[AUTH] Logout error:", error);
    return {
      success: false,
      error: "登出过程中发生错误，请稍后重试",
    };
  }
}
