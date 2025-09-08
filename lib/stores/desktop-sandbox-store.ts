import { create, StateCreator } from "zustand";
import { devtools } from "zustand/middleware";

interface DesktopSandboxState {
  // 状态
  sandboxId: string | null;
  streamUrl: string | null;
  sandboxStatus: "running" | "paused" | "unknown";
  isInitializing: boolean;
  isPausing: boolean;
  manualInit: boolean; // 控制是否需要手动初始化

  // Actions
  setSandboxId: (id: string | null) => void;
  setStreamUrl: (url: string | null) => void;
  setSandboxStatus: (status: "running" | "paused" | "unknown") => void;
  setIsInitializing: (initializing: boolean) => void;
  setIsPausing: (pausing: boolean) => void;
  setManualInit: (manual: boolean) => void;
  reset: () => void;
}

const initialState = {
  sandboxId: null,
  streamUrl: null,
  sandboxStatus: "unknown" as const,
  isInitializing: false,
  isPausing: false,
  manualInit: true, // 默认需要手动初始化
};

// 检查是否可以安全使用 devtools
const canUseDevtools = () => {
  if (typeof window === "undefined") return false;

  // 检查是否在开发环境
  if (process.env.NODE_ENV !== "development") return false;

  // 尝试访问 localStorage 以确保没有权限问题
  try {
    const testKey = "__zustand_devtools_test__";
    window.localStorage.setItem(testKey, "test");
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    console.warn("Cannot access localStorage, disabling Zustand devtools");
    return false;
  }
};

// 创建 store 的函数
const createStore = () => {
  const storeCreator: StateCreator<DesktopSandboxState> = set => ({
    ...initialState,

    setSandboxId: (id: string | null) => set({ sandboxId: id }),
    setStreamUrl: (url: string | null) => set({ streamUrl: url }),
    setSandboxStatus: (status: "running" | "paused" | "unknown") => set({ sandboxStatus: status }),
    setIsInitializing: (initializing: boolean) => set({ isInitializing: initializing }),
    setIsPausing: (pausing: boolean) => set({ isPausing: pausing }),
    setManualInit: (manual: boolean) => set({ manualInit: manual }),

    reset: () => set(initialState),
  });

  // 只在可以使用 devtools 时才包装
  if (canUseDevtools()) {
    return create<DesktopSandboxState>()(
      devtools(storeCreator, {
        name: "desktop-sandbox-store",
      })
    );
  }

  // 否则直接创建 store
  return create<DesktopSandboxState>()(storeCreator);
};

export const useDesktopSandboxStore = createStore();
