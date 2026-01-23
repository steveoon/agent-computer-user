import { ArrowUp, Play } from "lucide-react";
import { Textarea } from "./ui/textarea";
import { useInputHistoryStore } from "@/lib/stores/input-history-store";
import { useEffect, useRef, useState } from "react";
import type { FinishReason } from "@/types";

// Constants for textarea dimensions
const MIN_HEIGHT = 52;
const MAX_HEIGHT = 200;

interface InputProps {
  input: string;
  handleInputChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  isInitializing: boolean;
  isLoading: boolean;
  status: string;
  stop: () => void;
  error?: Error | null;
  isAuthenticated?: boolean;
  lastFinishReason?: FinishReason;
  onContinue?: () => void;
}

export const Input = ({
  input,
  handleInputChange,
  isInitializing,
  isLoading,
  status,
  stop,
  error,
  isAuthenticated = true,
  lastFinishReason,
  onContinue,
}: InputProps) => {
  const { navigateHistory, resetIndex, setTempInput, history } = useInputHistoryStore();
  const hasNavigated = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stopCooldownRef = useRef<number | null>(null);
  const [dynamicPlaceholder, setDynamicPlaceholder] = useState<string | null>(null);
  const [isStopping, setIsStopping] = useState(false);

  // 更智能的禁用逻辑：只有在真正加载中且没有错误时才禁用，或者用户未认证
  const shouldDisable = (isLoading && !error) || isInitializing || !isAuthenticated;

  // 判断是否应该显示"继续"按钮
  // 条件：状态为 ready，且 lastFinishReason 为 "tool-calls"（被步数限制中断）
  const shouldShowContinue = status === "ready" && lastFinishReason === "tool-calls" && onContinue;

  // Unified function to adjust textarea height
  const adjustTextareaHeight = (element: HTMLTextAreaElement | null, scrollToBottom = false) => {
    if (!element) return;
    element.style.height = "auto";
    const newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, element.scrollHeight));
    element.style.height = `${newHeight}px`;
    if (scrollToBottom) {
      element.scrollTop = element.scrollHeight;
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle ArrowUp key to fill last history when input is empty
    if (e.key === "ArrowUp" && !input && history.length > 0 && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const lastHistory = history[history.length - 1];
      if (lastHistory) {
        handleInputChange({
          target: { value: lastHistory },
        } as React.ChangeEvent<HTMLTextAreaElement>);
        // Force resize after filling
        setTimeout(() => {
          adjustTextareaHeight(inputRef.current, true);
        }, 0);
      }
      return;
    }

    // Handle shift+enter for new line
    if (e.shiftKey && e.key === "Enter") {
      // Allow default behavior for shift+enter (new line)
      return;
    }

    // Prevent default enter behavior (form submission) when not holding shift
    if (e.key === "Enter" && !e.shiftKey) {
      // Critical: Don't submit during IME composition (Chinese/Japanese input)
      const nativeEvent = e.nativeEvent as KeyboardEvent;
      if ("isComposing" in nativeEvent && nativeEvent.isComposing) {
        return;
      }
      e.preventDefault();
      // Submit the form by finding the parent form and dispatching submit event
      const form = inputRef.current?.closest("form");
      if (form && input.trim()) {
        form.requestSubmit();
      }
      return;
    }

    // Check for Ctrl/Cmd + Arrow keys
    const isModifierPressed = e.ctrlKey || e.metaKey;

    if (isModifierPressed && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();

      // Save current input if this is the first navigation
      if (!hasNavigated.current && input.trim()) {
        setTempInput(input);
      }
      hasNavigated.current = true;

      const historicalInput = navigateHistory(e.key === "ArrowUp" ? "up" : "down");
      if (historicalInput !== null) {
        handleInputChange({
          target: { value: historicalInput },
        } as React.ChangeEvent<HTMLTextAreaElement>);
      }
    }
  };

  // Reset navigation state when input changes manually
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (hasNavigated.current) {
      hasNavigated.current = false;
      resetIndex();
    }
    handleInputChange(e);

    // Auto-resize textarea
    adjustTextareaHeight(inputRef.current, !!e.target.value);
  };

  // Auto-resize on mount and when input changes
  useEffect(() => {
    adjustTextareaHeight(inputRef.current, !!input);
  }, [input]);

  // Handle focus and blur for dynamic placeholder
  const handleFocus = () => {
    if (!input && history.length > 0) {
      const lastHistory = history[history.length - 1];
      if (lastHistory) {
        setDynamicPlaceholder(`${lastHistory} (按↑键填充)`);
      }
    }
  };

  const handleBlur = () => {
    setDynamicPlaceholder(null);
  };

  // Reset navigation state when status changes
  useEffect(() => {
    if (status === "submitted") {
      hasNavigated.current = false;
    }
  }, [status]);

  // Reset stop cooldown when streaming ends
  useEffect(() => {
    if (status !== "streaming" && status !== "submitted") {
      setIsStopping(false);
      if (stopCooldownRef.current !== null) {
        window.clearTimeout(stopCooldownRef.current);
        stopCooldownRef.current = null;
      }
    }
  }, [status]);

  const handleStopClick = () => {
    if (isStopping) return;
    setIsStopping(true);
    stop();

    if (stopCooldownRef.current !== null) {
      window.clearTimeout(stopCooldownRef.current);
    }

    stopCooldownRef.current = window.setTimeout(() => {
      setIsStopping(false);
      stopCooldownRef.current = null;
    }, 800);
  };

  return (
    <div className="relative w-full">
      <Textarea
        ref={inputRef}
        className="bg-secondary px-3 py-4 min-h-[52px] max-h-[200px] w-full rounded-xl pr-12 resize-none overflow-hidden leading-normal"
        value={input}
        autoFocus
        aria-label="聊天输入框"
        placeholder={
          dynamicPlaceholder ||
          (!isAuthenticated
            ? "请先登录以使用AI助手..."
            : "输入提示词...使用 Ctrl/Cmd + ↑↓ 键切换输入历史，Shift+Enter 换行")
        }
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        disabled={shouldDisable}
        rows={1}
      />
      {status === "streaming" || status === "submitted" ? (
        <button
          type="button"
          onClick={handleStopClick}
          disabled={isStopping}
          aria-label="停止生成"
          className="cursor-pointer absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 bg-black hover:bg-zinc-800 disabled:bg-zinc-300 disabled:cursor-not-allowed transition-colors"
        >
          <div className="animate-spin h-4 w-4">
            <svg className="h-4 w-4 text-white" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        </button>
      ) : shouldShowContinue ? (
        <button
          type="button"
          onClick={onContinue}
          aria-label="继续处理"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 bg-green-600 hover:bg-green-700 transition-colors"
        >
          <Play className="h-4 w-4 text-white" />
        </button>
      ) : (
        <button
          type="submit"
          disabled={shouldDisable || !input.trim()}
          aria-label="发送消息"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 bg-black hover:bg-zinc-800 disabled:bg-zinc-300 disabled:cursor-not-allowed transition-colors"
        >
          <ArrowUp className="h-4 w-4 text-white" />
        </button>
      )}
    </div>
  );
};
