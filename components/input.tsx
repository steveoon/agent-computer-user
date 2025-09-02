import { ArrowUp } from "lucide-react";
import { Input as ShadcnInput } from "./ui/input";
import { useInputHistoryStore } from "@/lib/stores/input-history-store";
import { useEffect, useRef } from "react";

interface InputProps {
  input: string;
  handleInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  isInitializing: boolean;
  isLoading: boolean;
  status: string;
  stop: () => void;
  error?: Error | null;
  isAuthenticated?: boolean;
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
}: InputProps) => {
  const { navigateHistory, resetIndex, setTempInput } = useInputHistoryStore();
  const hasNavigated = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 更智能的禁用逻辑：只有在真正加载中且没有错误时才禁用，或者用户未认证
  const shouldDisable = (isLoading && !error) || isInitializing || !isAuthenticated;

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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
        } as React.ChangeEvent<HTMLInputElement>);
      }
    }
  };

  // Reset navigation state when input changes manually
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (hasNavigated.current) {
      hasNavigated.current = false;
      resetIndex();
    }
    handleInputChange(e);
  };

  // Reset navigation state when status changes
  useEffect(() => {
    if (status === "submitted") {
      hasNavigated.current = false;
    }
  }, [status]);

  return (
    <div className="relative w-full">
      <ShadcnInput
        ref={inputRef}
        className="bg-secondary py-6 w-full rounded-xl pr-12"
        value={input}
        autoFocus
        placeholder={
          !isAuthenticated
            ? "请先登录以使用AI助手..."
            : "输入提示词...使用 Ctrl/Cmd + ↑↓ 键切换输入历史"
        }
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={shouldDisable}
      />
      {status === "streaming" || status === "submitted" ? (
        <button
          type="button"
          onClick={stop}
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
      ) : (
        <button
          type="submit"
          disabled={shouldDisable || !input.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 bg-black hover:bg-zinc-800 disabled:bg-zinc-300 disabled:cursor-not-allowed transition-colors"
        >
          <ArrowUp className="h-4 w-4 text-white" />
        </button>
      )}
    </div>
  );
};
