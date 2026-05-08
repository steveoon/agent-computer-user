import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthDialog } from "../auth-dialog";

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  setError: vi.fn(),
  clearError: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/utils/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mocks.signInWithPassword,
    },
  }),
}));

vi.mock("@/lib/stores/auth-store", () => ({
  useAuthStore: () => ({
    setError: mocks.setError,
    clearError: mocks.clearError,
  }),
}));

vi.mock("@/lib/actions/auth-actions", () => ({
  signUpAction: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
    success: vi.fn(),
  },
}));

describe("AuthDialog", () => {
  let consoleErrorSpy: { mockRestore: () => void };

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.useFakeTimers();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.useRealTimers();
  });

  it("登录请求超时后应该恢复提交按钮", async () => {
    mocks.signInWithPassword.mockReturnValue(new Promise(() => undefined));

    render(<AuthDialog open={true} onOpenChange={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("邮箱"), {
      target: { value: "timeout@example.com" },
    });
    fireEvent.change(screen.getByLabelText("密码"), {
      target: { value: "password123" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "登录" }));
    });

    expect(screen.getByRole("button", { name: "登录中..." })).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });

    expect(screen.getByRole("button", { name: "登录" })).toBeEnabled();
    expect(mocks.setError).toHaveBeenCalledWith("登录请求超时，请检查网络或稍后重试");
    expect(mocks.toastError).toHaveBeenCalledWith("登录请求超时，请检查网络或稍后重试");
  });
});
