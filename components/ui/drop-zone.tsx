"use client";

import { useState, useRef, useEffect, type DragEvent, type ReactNode } from "react";
import { Upload } from "lucide-react";

type DropZoneProps = {
  children: ReactNode;
  onFileDrop: (file: File) => Promise<void>;
  onError?: (error: Error) => void;
  accept?: string;
  hint?: string;
  className?: string;
};

export function DropZone({
  children,
  onFileDrop,
  onError,
  accept = ".json,application/json",
  hint = "拖拽配置文件到此处导入",
  className = "",
}: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const resetDragState = () => {
    dragCounter.current = 0;
    setIsDragging(false);
  };

  // Fix: Reset drag state when user drags file outside window
  useEffect(() => {
    const handleDragEnd = () => resetDragState();
    const handleDocumentDragLeave = (event: globalThis.DragEvent) => {
      if (!event.relatedTarget) {
        resetDragState();
      }
    };
    const handleWindowBlur = () => resetDragState();
    const handleWindowDrop = () => resetDragState();

    document.addEventListener("dragend", handleDragEnd);
    document.addEventListener("dragleave", handleDocumentDragLeave);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("drop", handleWindowDrop);

    return () => {
      document.removeEventListener("dragend", handleDragEnd);
      document.removeEventListener("dragleave", handleDocumentDragLeave);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("drop", handleWindowDrop);
    };
  }, []);

  const hasFileDrag = (event: DragEvent) =>
    Array.from(event.dataTransfer.types || []).includes("Files");

  const isAcceptedFile = (file: File): boolean => {
    if (!accept) return true;
    const acceptTypes = accept.split(",").map(t => t.trim().toLowerCase());
    const fileExtension = `.${file.name.split(".").pop()?.toLowerCase()}`;
    const fileMimeType = file.type.toLowerCase();
    return acceptTypes.some(type => type === fileExtension || type === fileMimeType);
  };

  const handleDragEnter = (event: DragEvent) => {
    if (!hasFileDrag(event)) return;
    event.preventDefault();
    dragCounter.current += 1;
    setIsDragging(true);
  };

  const handleDragOver = (event: DragEvent) => {
    if (!hasFileDrag(event)) return;
    event.preventDefault();
  };

  const handleDragLeave = (event: DragEvent) => {
    if (!hasFileDrag(event)) return;
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      resetDragState();
    }
  };

  const handleDrop = async (event: DragEvent) => {
    if (!hasFileDrag(event)) return;
    event.preventDefault();
    resetDragState();

    const file = event.dataTransfer.files?.[0];
    if (file && isAcceptedFile(file)) {
      try {
        await onFileDrop(file);
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    }
  };

  return (
    <div
      className={`relative ${className}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="fixed inset-0 z-30 pointer-events-none">
          <div className="absolute inset-0 bg-black/10 backdrop-blur-sm" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center justify-center rounded-lg border border-dashed px-6 py-4 text-sm font-medium shadow-lg bg-background/80 text-foreground border-primary/60 backdrop-blur-sm">
              {hint}
            </div>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

export function DropZoneHint({ hint = "可将 .json 配置文件拖拽到页面任意位置快速导入" }) {
  return (
    <div className="mb-4 flex items-center justify-center gap-2 py-2 px-4 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 text-sm text-muted-foreground">
      <Upload className="h-4 w-4" />
      <span>{hint}</span>
    </div>
  );
}
