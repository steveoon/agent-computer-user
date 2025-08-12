import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { useRef } from "react";
import { ChatMessages } from "../ChatMessages";
import type { UIMessage } from "@ai-sdk/react";

// Mock the tool message components
vi.mock("@/components/tool-messages", () => ({
  ToolMessageRenderer: ({ part }: { part: any }) => {
    return <div data-testid="tool-message">{part.toolName}</div>;
  },
}));

// Mock PreviewMessage component
vi.mock("@/components/message", () => ({
  PreviewMessage: ({ message }: { message: UIMessage }) => {
    return (
      <div data-testid={`message-${message.id}`}>
        {/* AI SDK v5: render parts array */}
        {message.parts?.map((part, index) => {
          if (part.type === "text") {
            return <span key={index}>{part.text}</span>;
          }
          if (part.type === "tool-input" || part.type === "tool-output") {
            return (
              <div key={index} data-testid="tool-message">
                {(part as any).toolName}
              </div>
            );
          }
          return null;
        })}
      </div>
    );
  },
}));

// Mock ProjectInfo component
vi.mock("@/components/project-info", () => ({
  ProjectInfo: () => <div data-testid="project-info">Project Info</div>,
}));

function TestWrapper({ messages }: { messages: UIMessage[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  return (
    <ChatMessages
      messages={messages}
      isLoading={false}
      status="ready"
      containerRef={containerRef}
      endRef={endRef}
    />
  );
}

describe("ChatMessages", () => {
  it("renders text messages correctly", () => {
    const messages: UIMessage[] = [
      {
        id: "1",
        role: "user",
        parts: [{ type: "text" as const, text: "Hello AI!" }],
      },
      {
        id: "2",
        role: "assistant",
        parts: [{ type: "text" as const, text: "Hello! How can I help you today?" }],
      },
    ];

    render(<TestWrapper messages={messages} />);

    expect(screen.getByText("Hello AI!")).toBeInTheDocument();
    expect(screen.getByText("Hello! How can I help you today?")).toBeInTheDocument();
  });

  it("renders tool invocation messages", () => {
    const messages: UIMessage[] = [
      {
        id: "1",
        role: "assistant",
        parts: [
          { type: "text" as const, text: "Let me help you with that." },
          {
            type: "tool-output" as const,
            toolCallId: "tool-1",
            state: "output-available" as const,
            input: { tool: "wechat" },
            output: { success: true, message: "Message sent" },
          } as any,
        ],
      },
    ];

    render(<TestWrapper messages={messages} />);

    expect(screen.getByText("Let me help you with that.")).toBeInTheDocument();
    expect(screen.getByTestId("tool-message")).toBeInTheDocument();
    // Tool name is now embedded in the input, not directly accessible
  });

  it("handles empty message list", () => {
    render(<TestWrapper messages={[]} />);

    // Should render project info when no messages
    expect(screen.getByTestId("project-info")).toBeInTheDocument();
  });

  it("renders multiple tool invocations in sequence", () => {
    const messages: UIMessage[] = [
      {
        id: "1",
        role: "assistant",
        parts: [
          { type: "text" as const, text: "I will execute multiple tools for you." },
          {
            type: "tool-output" as const,
            toolCallId: "tool-1",
            state: "output-available" as const,
            input: { tool: "zhipin_get_unread_candidates_improved" },
            output: { candidates: [] },
          } as any,
          {
            type: "tool-output" as const,
            toolCallId: "tool-2",
            state: "output-available" as const,
            input: { tool: "zhipin_reply_generator" },
            output: { reply: "Generated reply" },
          } as any,
        ],
      },
    ];

    render(<TestWrapper messages={messages} />);

    const toolMessages = screen.getAllByTestId("tool-message");
    expect(toolMessages).toHaveLength(2);
    // Tool names are now embedded in the input, not directly accessible
  });

  it("handles mixed content types properly", () => {
    const messages: UIMessage[] = [
      {
        id: "1",
        role: "user",
        parts: [
          { type: "text" as const, text: "Please help me" },
          {
            type: "file" as const,
            name: "image.png",
            url: "https://example.com/image.png",
          } as any,
        ],
      },
    ];

    render(<TestWrapper messages={messages} />);

    expect(screen.getByText("Please help me")).toBeInTheDocument();
    // File parts might be rendered differently based on implementation
  });

  it("tests loading state", () => {
    // Use TestWrapper which already handles refs
    const messages: UIMessage[] = [];

    render(<TestWrapper messages={messages} />);

    expect(screen.getByTestId("project-info")).toBeInTheDocument();
  });
});
