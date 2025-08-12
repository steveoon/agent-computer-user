import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { DulidayInterviewBookingToolMessage } from "../duliday-interview-booking-tool";
import type { ToolMessageProps } from "../types";

// Mock the base tool message component
vi.mock("../base-tool-message", () => ({
  BaseToolMessage: ({ children, label, detail, state }: any) => (
    <div data-testid="base-tool-message" data-state={state}>
      <div data-testid="label">{label}</div>
      <div data-testid="detail">{detail}</div>
      {children}
    </div>
  ),
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  Calendar: () => <div data-testid="calendar-icon" />,
  CheckCircle: () => <div data-testid="check-circle-icon" />,
  XCircle: () => <div data-testid="x-circle-icon" />,
  AlertCircle: () => <div data-testid="alert-circle-icon" />,
}));

describe("DulidayInterviewBookingToolMessage", () => {
  const defaultProps: ToolMessageProps = {
    toolName: "duliday_interview_booking",
    input: {
      name: "李青",
      phone: "13585516989",
      age: "39",
      genderId: 1,
      education: "大专",
      jobId: 523302,
      interviewTime: "2025-07-22 13:00:00",
    },
    state: "output-available",
    output: null,
    isLatestMessage: true,
    status: "completed",
    messageId: "test-message-1",
    partIndex: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Success Cases", () => {
    it("renders success response with notice", () => {
      const successResult = {
        type: "object",
        object: {
          success: true,
          code: 0,
          message: "操作成功",
          notice: "已发送消息告知项目经理：吴越，如有问题渠道运营会联系您",
          errorList: null,
          requestInfo: {
            name: "李青",
            phone: "13585516989",
            age: "39",
            genderId: 1,
            education: "大专",
            jobId: 523302,
            interviewTime: "2025-07-22 13:00:00",
          },
        },
      };

      render(<DulidayInterviewBookingToolMessage {...defaultProps} output={successResult} />);

      // Check success message
      expect(screen.getByText("操作成功")).toBeInTheDocument();
      expect(screen.getByText("响应代码: 0")).toBeInTheDocument();
      expect(screen.getByTestId("check-circle-icon")).toBeInTheDocument();

      // Check notice
      expect(
        screen.getByText("已发送消息告知项目经理：吴越，如有问题渠道运营会联系您")
      ).toBeInTheDocument();
      expect(screen.getByTestId("alert-circle-icon")).toBeInTheDocument();

      // Check booking details
      expect(screen.getByText("预约信息")).toBeInTheDocument();
      expect(screen.getByText("李青")).toBeInTheDocument();
      expect(screen.getByText("13585516989")).toBeInTheDocument();
      expect(screen.getByText("大专")).toBeInTheDocument();
      expect(screen.getByText("523302")).toBeInTheDocument();
      expect(screen.getByText("2025-07-22 13:00:00")).toBeInTheDocument();
    });

    it("renders success response without notice", () => {
      const successResult = {
        type: "object",
        object: {
          success: true,
          code: 0,
          message: "操作成功",
          notice: null,
          errorList: null,
          requestInfo: {
            name: "张三",
            phone: "13800138000",
            age: "25",
            genderId: 1,
            education: "本科",
            jobId: 123456,
            interviewTime: "2025-07-23 14:00:00",
          },
        },
      };

      render(<DulidayInterviewBookingToolMessage {...defaultProps} output={successResult} />);

      expect(screen.getByText("操作成功")).toBeInTheDocument();
      expect(screen.queryByTestId("alert-circle-icon")).not.toBeInTheDocument();
    });
  });

  describe("Error Cases", () => {
    it("renders duplicate booking error", () => {
      const errorResult = {
        type: "object",
        object: {
          success: false,
          code: 30003,
          message: "您已为用户报名该岗位",
          notice: null,
          errorList: null,
          requestInfo: defaultProps.input,
        },
      };

      render(<DulidayInterviewBookingToolMessage {...defaultProps} output={errorResult} />);

      expect(screen.getByText("您已为用户报名该岗位")).toBeInTheDocument();
      expect(screen.getByText("响应代码: 30003")).toBeInTheDocument();
      expect(screen.getByTestId("x-circle-icon")).toBeInTheDocument();
      expect(screen.queryByText("预约信息")).not.toBeInTheDocument();
    });

    it("renders validation errors", () => {
      const validationErrors = [
        { code: 10000, message: "姓名不能为空" },
        { code: 10000, message: "联系电话不能为空" },
        { code: 10000, message: "岗位不能为空" },
        { code: 10000, message: "岗位不存在或已下架" },
      ];

      validationErrors.forEach(({ code, message }) => {
        const { unmount } = render(
          <DulidayInterviewBookingToolMessage
            {...defaultProps}
            output={{
              type: "object",
              object: {
                success: false,
                code,
                message,
                notice: null,
                errorList: null,
                requestInfo: defaultProps.input,
              },
            }}
          />
        );

        expect(screen.getByText(message)).toBeInTheDocument();
        expect(screen.getByText(`响应代码: ${code}`)).toBeInTheDocument();
        expect(screen.getByTestId("x-circle-icon")).toBeInTheDocument();

        unmount();
      });
    });

    it("renders server error", () => {
      const serverErrorResult = {
        type: "object",
        object: {
          success: false,
          code: 50000,
          message: "麻麻呀，服务器暂时跑丢了～",
          notice: null,
          errorList: null,
          requestInfo: defaultProps.input,
        },
      };

      render(<DulidayInterviewBookingToolMessage {...defaultProps} output={serverErrorResult} />);

      expect(screen.getByText("麻麻呀，服务器暂时跑丢了～")).toBeInTheDocument();
      expect(screen.getByText("响应代码: 50000")).toBeInTheDocument();
      expect(screen.getByTestId("x-circle-icon")).toBeInTheDocument();
    });
  });

  describe("State Handling", () => {
    it("renders loading state", () => {
      render(
        <DulidayInterviewBookingToolMessage
          {...defaultProps}
          state="input-available"
          output={null}
        />
      );

      const baseMessage = screen.getByTestId("base-tool-message");
      expect(baseMessage).toHaveAttribute("data-state", "input-available");
      expect(screen.getByTestId("label")).toHaveTextContent("预约面试");
      expect(screen.getByTestId("detail").textContent).toContain("李青");
    });

    it("renders partial-call state", () => {
      render(
        <DulidayInterviewBookingToolMessage
          {...defaultProps}
          state="input-streaming"
          output={null}
        />
      );

      const baseMessage = screen.getByTestId("base-tool-message");
      expect(baseMessage).toHaveAttribute("data-state", "input-streaming");
    });

    it("does not render result content when not in result state", () => {
      const successResult = {
        type: "object",
        object: {
          success: true,
          code: 0,
          message: "操作成功",
          notice: "已发送消息告知项目经理",
          errorList: null,
          requestInfo: defaultProps.input,
        },
      };

      render(
        <DulidayInterviewBookingToolMessage
          {...defaultProps}
          state="input-available"
          output={successResult}
        />
      );

      expect(screen.queryByText("操作成功")).not.toBeInTheDocument();
      expect(screen.queryByText("已发送消息告知项目经理")).not.toBeInTheDocument();
    });
  });

  describe("Format Handling", () => {
    it("handles direct result format", () => {
      const directResult = {
        success: true,
        code: 0,
        message: "操作成功",
        notice: "测试通知",
        errorList: null,
        requestInfo: defaultProps.input,
      };

      render(<DulidayInterviewBookingToolMessage {...defaultProps} output={directResult} />);

      expect(screen.getByText("操作成功")).toBeInTheDocument();
      expect(screen.getByText("测试通知")).toBeInTheDocument();
    });

    it("handles null result gracefully", () => {
      render(<DulidayInterviewBookingToolMessage {...defaultProps} output={null} />);

      expect(screen.queryByText("预约信息")).not.toBeInTheDocument();
      expect(screen.queryByTestId("check-circle-icon")).not.toBeInTheDocument();
      expect(screen.queryByTestId("x-circle-icon")).not.toBeInTheDocument();
    });

    it("handles invalid result format", () => {
      const invalidResult = {
        type: "text",
        text: "Some error message",
      };

      render(<DulidayInterviewBookingToolMessage {...defaultProps} output={invalidResult} />);

      expect(screen.queryByText("预约信息")).not.toBeInTheDocument();
      expect(screen.queryByTestId("check-circle-icon")).not.toBeInTheDocument();
    });
  });

  describe("Detail Formatting", () => {
    it("formats interview time correctly", () => {
      const props = {
        ...defaultProps,
        input: {
          ...defaultProps.input,
          interviewTime: "2025-07-22 13:00:00",
        },
      };

      render(<DulidayInterviewBookingToolMessage {...props} />);

      const detail = screen.getByTestId("detail");
      expect(detail.textContent).toContain("7月22日");
      expect(detail.textContent).toContain("13:00");
    });

    it("handles invalid date format gracefully", () => {
      const props = {
        ...defaultProps,
        input: {
          ...defaultProps.input,
          interviewTime: "invalid-date",
        },
      };

      render(<DulidayInterviewBookingToolMessage {...props} />);

      const detail = screen.getByTestId("detail");
      // When date is invalid, toLocaleString returns "Invalid Date"
      expect(detail.textContent).toContain("Invalid Date");
    });

    it("builds detail string with all fields", () => {
      render(<DulidayInterviewBookingToolMessage {...defaultProps} />);

      const detail = screen.getByTestId("detail");
      expect(detail.textContent).toContain("李青");
      expect(detail.textContent).toContain("大专");
      expect(detail.textContent).toContain("岗位523302");
    });

    it("shows default detail when no args provided", () => {
      const props = {
        ...defaultProps,
        input: {},
      };

      render(<DulidayInterviewBookingToolMessage {...props} />);

      const detail = screen.getByTestId("detail");
      expect(detail.textContent).toBe("预约面试");
    });
  });
});
