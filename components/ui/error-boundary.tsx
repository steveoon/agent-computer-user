"use client";

import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="p-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-900/50 flex flex-col items-center justify-center gap-4 min-h-[200px]">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="font-medium text-red-900 dark:text-red-200">组件渲染出错</h3>
            <p className="text-sm text-red-600 dark:text-red-300 max-w-sm">
              {this.state.error?.message || "发生未知错误"}
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={this.handleReset}
            className="gap-2 text-red-700 border-red-200 hover:bg-red-100 dark:text-red-300 dark:border-red-800 dark:hover:bg-red-900/30"
          >
            <RefreshCw className="w-4 h-4" />
            重试
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
