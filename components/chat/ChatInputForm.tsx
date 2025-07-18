"use client";

import { useState } from "react";
import { Input } from "@/components/input";
import { PromptSuggestions, type PromptSuggestion } from "@/components/prompt-suggestions";
import { TemplateEditor } from "./TemplateEditor";
import { toast } from "sonner";
import { useInputHistoryStore } from "@/lib/stores/input-history-store";

interface ChatInputFormProps {
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isInitializing: boolean;
  isLoading: boolean;
  status: "ready" | "error" | "submitted" | "streaming";
  stop: () => void;
  error: Error | undefined;
  isAuthenticated: boolean;
  append: (message: { role: "user"; content: string }) => void;
}

interface TemplateState {
  template: string;
  editableFields?: PromptSuggestion['editableFields'];
}

export function ChatInputForm({
  input,
  handleInputChange,
  handleSubmit,
  isInitializing,
  isLoading,
  status,
  stop,
  error,
  isAuthenticated,
  append,
}: ChatInputFormProps) {
  const { addToHistory } = useInputHistoryStore();
  const [templateState, setTemplateState] = useState<TemplateState | null>(null);
  
  const handlePromptClick = (suggestion: PromptSuggestion) => {
    if (!isAuthenticated) {
      toast.error("请先登录", {
        description: "您需要登录后才能使用AI助手功能",
        richColors: true,
        position: "top-center",
      });
      return;
    }

    // Check if the suggestion is marked as editable
    if (suggestion.editable) {
      // Open template editor with configured fields
      setTemplateState({
        template: suggestion.prompt,
        editableFields: suggestion.editableFields,
      });
    } else {
      // Direct submit for non-editable prompts
      addToHistory(suggestion.prompt);
      append({ role: "user", content: suggestion.prompt });
    }
  };

  const handleTemplateSubmit = (editedContent: string) => {
    addToHistory(editedContent);
    append({ role: "user", content: editedContent });
    setTemplateState(null);
  };

  return (
    <>
      {/* PromptSuggestions 始终显示在输入框上方 */}
      <PromptSuggestions
        disabled={isInitializing || !isAuthenticated}
        submitPrompt={handlePromptClick}
      />

      <div className="bg-white relative">
        {/* Template Editor */}
        {templateState && (
          <TemplateEditor
            template={templateState.template}
            editableFields={templateState.editableFields}
            onSubmit={handleTemplateSubmit}
            onClose={() => setTemplateState(null)}
          />
        )}

        <form onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) {
            addToHistory(input);
          }
          handleSubmit(e);
        }} className="p-4">
          <Input
            handleInputChange={handleInputChange}
            input={input}
            isInitializing={isInitializing}
            isLoading={isLoading}
            status={status}
            stop={stop}
            error={error}
            isAuthenticated={isAuthenticated}
          />
        </form>
      </div>
    </>
  );
}
