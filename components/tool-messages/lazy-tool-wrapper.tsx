"use client";

/**
 * 懒加载工具包装组件
 *
 * 使用 React.lazy + Suspense 实现工具组件的按需加载
 * 配合 ToolLoadingSkeleton 提供加载时的视觉反馈
 */
import { lazy, Suspense, useMemo, type ComponentType } from "react";
import type { ToolMessageProps, LazyToolConfig } from "./types";
import { ToolLoadingSkeleton } from "./tool-loading-skeleton";

interface LazyToolWrapperProps extends ToolMessageProps {
  config: LazyToolConfig;
}

export function LazyToolWrapper({ config, ...props }: LazyToolWrapperProps) {
  // 使用 useMemo 缓存懒加载组件，避免每次渲染都创建新的 lazy 组件
  const LazyComponent = useMemo(
    () => lazy(config.loader) as ComponentType<ToolMessageProps>,
    [config]
  );

  return (
    <Suspense
      fallback={
        <ToolLoadingSkeleton
          toolName={props.toolName}
          icon={config.icon}
          theme={config.defaultTheme}
        />
      }
    >
      <LazyComponent {...props} />
    </Suspense>
  );
}
