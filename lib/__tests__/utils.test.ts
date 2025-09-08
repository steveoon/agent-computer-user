import { describe, it, expect } from "vitest";
import { cn, ABORTED, shouldCleanupSandbox, mapKeySequence } from "../utils";

describe("utils", () => {
  describe("cn", () => {
    it("should merge class names correctly", () => {
      expect(cn("foo", "bar")).toBe("foo bar");
    });

    it("should handle conditional classes", () => {
      expect(cn("foo", false && "bar", "baz")).toBe("foo baz");
    });

    it("should merge tailwind classes correctly", () => {
      expect(cn("px-2", "px-4")).toBe("px-4");
      expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
    });

    it("should handle arrays and objects", () => {
      expect(cn(["foo", "bar"], { baz: true, qux: false })).toBe("foo bar baz");
    });

    it("should handle empty input", () => {
      expect(cn()).toBe("");
      expect(cn("")).toBe("");
    });
  });

  describe("ABORTED", () => {
    it('should be "User aborted"', () => {
      expect(ABORTED).toBe("User aborted");
    });
  });

  describe("shouldCleanupSandbox", () => {
    it("should return true for sandbox-related errors", () => {
      expect(shouldCleanupSandbox("sandbox error")).toBe(true);
      expect(shouldCleanupSandbox("desktop connection lost")).toBe(true);
      expect(shouldCleanupSandbox({ type: "sandbox_error" })).toBe(true);
    });

    it("should return false for external service errors", () => {
      expect(shouldCleanupSandbox({ type: "rate_limit_error" })).toBe(false);
      expect(shouldCleanupSandbox({ type: "api_error" })).toBe(false);
    });

    it("should handle error objects with messages", () => {
      expect(
        shouldCleanupSandbox({
          message: "E2B connection failed",
        })
      ).toBe(true);

      expect(
        shouldCleanupSandbox({
          message: "Network timeout",
        })
      ).toBe(false);
    });

    it("should handle critical system errors", () => {
      const error = new Error("Out of memory");
      expect(shouldCleanupSandbox(error)).toBe(true);
    });
  });

  describe("mapKeySequence", () => {
    it("should map problematic characters", () => {
      expect(mapKeySequence("-")).toBe("minus");
      // Note: '+' alone has special handling due to split('+') behavior
      expect(mapKeySequence("=")).toBe("equal");
      expect(mapKeySequence("[")).toBe("bracketleft");
      expect(mapKeySequence("]")).toBe("bracketright");
    });

    it("should handle combination keys", () => {
      expect(mapKeySequence("ctrl+-")).toBe("ctrl+minus");
      expect(mapKeySequence("alt+=")).toBe("alt+equal");
    });

    it("should preserve normal characters", () => {
      expect(mapKeySequence("a")).toBe("a");
      expect(mapKeySequence("Enter")).toBe("Enter");
      expect(mapKeySequence("ctrl+c")).toBe("ctrl+c");
    });

    it("should map Return to Enter", () => {
      expect(mapKeySequence("Return")).toBe("Enter");
    });
  });
});
