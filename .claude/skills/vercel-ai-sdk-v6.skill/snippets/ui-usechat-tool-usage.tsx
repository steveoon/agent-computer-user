"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, getToolName, isToolUIPart } from "ai";
import { useState } from "react";

export function ChatToolUsageExample() {
  const { messages, sendMessage, status, stop, error, addToolApprovalResponse } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
    }),
  });
  const [input, setInput] = useState("");

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-4">
        {messages.map(message => (
          <div key={message.id} className="space-y-2">
            <div className="text-xs uppercase text-zinc-500">{message.role}</div>
            <div className="space-y-2">
              {message.parts.map((part, index) => {
                if (part.type === "text") {
                  return (
                    <p key={index} className="text-sm text-zinc-900">
                      {part.text}
                    </p>
                  );
                }

                if (isToolUIPart(part)) {
                  const toolName = getToolName(part);
                  return (
                    <div key={index} className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
                      <div className="text-xs font-semibold text-zinc-700">{toolName}</div>
                      <div className="text-xs text-zinc-500">state: {part.state}</div>
                      {part.input != null && (
                        <pre className="mt-2 whitespace-pre-wrap text-xs text-zinc-700">
                          {JSON.stringify(part.input, null, 2)}
                        </pre>
                      )}
                      {part.output != null && (
                        <pre className="mt-2 whitespace-pre-wrap text-xs text-emerald-700">
                          {JSON.stringify(part.output, null, 2)}
                        </pre>
                      )}
                      {part.errorText && (
                        <div className="mt-2 text-xs text-red-600">{part.errorText}</div>
                      )}
                      {part.state === "approval-requested" && part.approval?.id && (
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            className="rounded-md bg-zinc-900 px-2 py-1 text-xs text-white"
                            onClick={() =>
                              addToolApprovalResponse({
                                id: part.approval.id,
                                approved: true,
                                reason: "User approved in UI.",
                              })
                            }
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700"
                            onClick={() =>
                              addToolApprovalResponse({
                                id: part.approval.id,
                                approved: false,
                                reason: "User denied in UI.",
                              })
                            }
                          >
                            Deny
                          </button>
                        </div>
                      )}
                    </div>
                  );
                }

                return null;
              })}
            </div>
          </div>
        ))}
      </div>

      {error && <div className="text-sm text-red-600">Something went wrong.</div>}

      {(status === "submitted" || status === "streaming") && (
        <button type="button" onClick={stop} className="self-start text-sm text-zinc-600">
          Stop
        </button>
      )}

      <form
        className="flex gap-2"
        onSubmit={event => {
          event.preventDefault();
          if (!input.trim()) return;
          sendMessage({ text: input });
          setInput("");
        }}
      >
        <input
          className="flex-1 rounded-md border border-zinc-200 px-3 py-2 text-sm"
          placeholder="Say something..."
          value={input}
          onChange={event => setInput(event.target.value)}
          disabled={status !== "ready"}
        />
        <button
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white"
          type="submit"
          disabled={status !== "ready"}
        >
          Send
        </button>
      </form>
    </div>
  );
}
