/**
 * Agent 管理状态 Store
 * 用于管理 Electron 环境下的多 Agent 实例
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { toast } from "sonner";
import type {
  AgentInfo,
  AgentTemplate,
  AddAgentOptions,
  AgentStatusUpdate,
} from "@/types/agent";
import { getElectronAgentApi, isElectronEnv } from "@/types/agent";

interface AgentStoreState {
  // 状态
  agents: AgentInfo[];
  templates: Record<string, AgentTemplate>;
  loading: boolean;
  error: string | null;
  isElectron: boolean;

  // Actions
  initialize: () => Promise<void>;
  loadAgents: () => Promise<void>;
  loadTemplates: () => Promise<void>;
  addAgent: (type: string, options?: AddAgentOptions) => Promise<AgentInfo[]>;
  startAgent: (agentId?: string, autoOpenUI?: boolean) => Promise<void>;
  stopAgent: (agentId?: string) => Promise<void>;
  restartAgent: (agentId?: string) => Promise<void>;
  removeAgent: (agentId: string) => Promise<void>;
  cleanupAgent: (agentId: string) => Promise<boolean>;
  openAgentUI: (agentId: string) => Promise<{ url: string; port: number } | null>;

  // 内部更新方法
  updateAgentStatus: (agentId: string, status: AgentInfo["status"]) => void;
  addAgentsToList: (newAgents: AgentInfo[]) => void;
  removeAgentFromList: (agentId: string) => void;

  // 事件订阅
  subscribeToEvents: () => () => void;

  // 清理
  clearError: () => void;
}

export const useAgentStore = create<AgentStoreState>()(
  devtools(
    (set, get) => ({
      // 初始状态
      agents: [],
      templates: {},
      loading: false,
      error: null,
      isElectron: false,

      /**
       * 初始化 Store
       */
      initialize: async () => {
        const isElectron = isElectronEnv();
        set({ isElectron });

        if (!isElectron) {
          return;
        }

        // 加载数据
        await Promise.all([get().loadAgents(), get().loadTemplates()]);

        // 订阅事件
        get().subscribeToEvents();
      },

      /**
       * 加载 Agent 列表
       */
      loadAgents: async () => {
        const api = getElectronAgentApi();
        if (!api) return;

        set({ loading: true, error: null });
        try {
          const agents = await api.list();
          set({ agents, loading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "加载 Agent 列表失败",
            loading: false,
          });
        }
      },

      /**
       * 加载 Agent 模板
       */
      loadTemplates: async () => {
        const api = getElectronAgentApi();
        if (!api) return;

        try {
          const templates = await api.getTemplates();
          set({ templates });
        } catch (error) {
          console.error("加载 Agent 模板失败:", error);
        }
      },

      /**
       * 添加 Agent
       */
      addAgent: async (type, options) => {
        const api = getElectronAgentApi();
        if (!api) return [];

        set({ loading: true, error: null });
        try {
          const newAgents = await api.add(type, options);
          // 不需要手动更新列表，事件会自动触发
          set({ loading: false });
          return newAgents;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "添加 Agent 失败",
            loading: false,
          });
          return [];
        }
      },

      /**
       * 启动 Agent
       * @param agentId 要启动的 Agent ID，不传则启动所有
       * @param autoOpenUI 是否自动打开 UI（仅单个启动时有效）
       */
      startAgent: async (agentId, autoOpenUI = true) => {
        const api = getElectronAgentApi();
        if (!api) return;

        set({ error: null });

        // 更新状态为 starting
        if (agentId) {
          get().updateAgentStatus(agentId, "starting");
        } else {
          // 启动所有
          const { agents } = get();
          agents
            .filter((a) => a.status === "stopped")
            .forEach((a) => get().updateAgentStatus(a.id, "starting"));
        }

        try {
          await api.start(agentId);
          // 单个启动且成功后自动打开 UI
          if (agentId && autoOpenUI) {
            // 稍等一下确保服务已启动
            setTimeout(() => {
              get().openAgentUI(agentId);
            }, 2000);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "启动 Agent 失败";
          set({ error: errorMessage });
          toast.error("启动失败", { description: errorMessage });
          // 恢复状态
          await get().loadAgents();
        }
      },

      /**
       * 停止 Agent
       */
      stopAgent: async (agentId) => {
        const api = getElectronAgentApi();
        if (!api) return;

        set({ error: null });

        // 更新状态为 stopping
        if (agentId) {
          get().updateAgentStatus(agentId, "stopping");
        } else {
          // 停止所有
          const { agents } = get();
          agents
            .filter((a) => a.status === "running")
            .forEach((a) => get().updateAgentStatus(a.id, "stopping"));
        }

        try {
          await api.stop(agentId);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "停止 Agent 失败";
          set({ error: errorMessage });
          toast.error("停止失败", { description: errorMessage });
          // 恢复状态
          await get().loadAgents();
        }
      },

      /**
       * 重启 Agent
       */
      restartAgent: async (agentId) => {
        const api = getElectronAgentApi();
        if (!api) return;

        set({ error: null });
        try {
          await api.restart(agentId);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "重启 Agent 失败";
          set({ error: errorMessage });
          toast.error("重启失败", { description: errorMessage });
        }
      },

      /**
       * 删除 Agent
       */
      removeAgent: async (agentId) => {
        const api = getElectronAgentApi();
        if (!api) return;

        set({ error: null });
        try {
          await api.remove(agentId);
          toast.success("Agent 已删除");
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "删除 Agent 失败";
          set({ error: errorMessage });
          toast.error("删除失败", { description: errorMessage });
        }
      },

      /**
       * 清理 Agent 端口（杀死占用端口的进程）
       */
      cleanupAgent: async (agentId) => {
        const api = getElectronAgentApi();
        if (!api) return false;

        set({ error: null });
        try {
          const result = await api.cleanup(agentId);
          if (result.cleaned > 0) {
            toast.success("端口已清理", { description: result.message });
          } else {
            toast.info("无需清理", { description: result.message });
          }
          return result.cleaned > 0;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "清理端口失败";
          set({ error: errorMessage });
          toast.error("清理失败", { description: errorMessage });
          return false;
        }
      },

      /**
       * 打开 Agent UI
       */
      openAgentUI: async (agentId) => {
        const api = getElectronAgentApi();
        if (!api) return null;

        set({ error: null });
        try {
          const result = await api.openUI(agentId);
          return result;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "打开 Agent UI 失败";
          set({ error: errorMessage });
          toast.error("打开失败", { description: errorMessage });
          return null;
        }
      },

      /**
       * 更新单个 Agent 状态
       */
      updateAgentStatus: (agentId, status) => {
        set((state) => ({
          agents: state.agents.map((agent) =>
            agent.id === agentId ? { ...agent, status } : agent
          ),
        }));
      },

      /**
       * 添加 Agents 到列表
       */
      addAgentsToList: (newAgents) => {
        set((state) => ({
          agents: [...state.agents, ...newAgents],
        }));
      },

      /**
       * 从列表移除 Agent
       */
      removeAgentFromList: (agentId) => {
        set((state) => ({
          agents: state.agents.filter((agent) => agent.id !== agentId),
        }));
      },

      /**
       * 订阅 Electron 事件
       */
      subscribeToEvents: () => {
        const api = getElectronAgentApi();
        if (!api) return () => {};

        // 订阅状态变化
        const unsubStatus = api.onStatusChange((data: AgentStatusUpdate) => {
          const status = data.status.isRunning ? "running" : "stopped";
          get().updateAgentStatus(data.agentId, status);
        });

        // 订阅 Agent 添加
        const unsubAdded = api.onAgentsAdded((agents: AgentInfo[]) => {
          get().addAgentsToList(agents);
        });

        // 订阅 Agent 删除
        const unsubRemoved = api.onAgentRemoved((agentId: string) => {
          get().removeAgentFromList(agentId);
        });

        // 订阅 Agent 启动
        const unsubStarted = api.onAgentStarted((agentId: string) => {
          get().updateAgentStatus(agentId, "running");
        });

        // 订阅 Agent 停止
        const unsubStopped = api.onAgentStopped((agentId: string) => {
          get().updateAgentStatus(agentId, "stopped");
        });

        // 返回清理函数
        return () => {
          unsubStatus();
          unsubAdded();
          unsubRemoved();
          unsubStarted();
          unsubStopped();
        };
      },

      /**
       * 清除错误
       */
      clearError: () => {
        set({ error: null });
      },
    }),
    { name: "agent-store" }
  )
);

// ========== 选择器 ==========

/**
 * 获取运行中的 Agent 数量
 */
export const selectRunningAgentCount = (state: AgentStoreState) =>
  state.agents.filter((a) => a.status === "running").length;

/**
 * 获取已停止的 Agent 数量
 */
export const selectStoppedAgentCount = (state: AgentStoreState) =>
  state.agents.filter((a) => a.status === "stopped").length;

/**
 * 获取是否有 Agent 正在启动或停止中
 */
export const selectHasPendingOperation = (state: AgentStoreState) =>
  state.agents.some((a) => a.status === "starting" || a.status === "stopping");
