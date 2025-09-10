"use client"

import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useEffect } from "react"

interface ToastConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void | Promise<void>
  onCancel?: () => void
  variant?: "default" | "destructive"
  closeButton?: boolean
  enableKeyboard?: boolean
}

/**
 * 显示一个确认对话框，使用 toast 代替 window.confirm
 * 适用于 Tauri 桌面应用和 Web 环境
 * 
 * @param title - 对话框标题
 * @param description - 可选的描述文本
 * @param confirmLabel - 确认按钮文本，默认"确定"
 * @param cancelLabel - 取消按钮文本，默认"取消"
 * @param onConfirm - 确认回调函数，支持异步
 * @param onCancel - 可选的取消回调函数
 * @param variant - 按钮样式，默认"default"，可选"destructive"用于危险操作
 * @param closeButton - 是否显示关闭按钮，默认true
 * @param enableKeyboard - 是否启用键盘快捷键（Enter确认，Escape取消），默认true
 * @returns toast ID，可用于手动关闭
 */
export function toastConfirm({
  title,
  description,
  confirmLabel = "确定",
  cancelLabel = "取消",
  onConfirm,
  onCancel,
  variant = "default",
  closeButton = true,
  enableKeyboard = true,
}: ToastConfirmOptions) {
  const ToastContent = () => {
    useEffect(() => {
      if (!enableKeyboard) return

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault()
          toast.dismiss(toastId)
          onConfirm()
        } else if (e.key === "Escape") {
          e.preventDefault()
          toast.dismiss(toastId)
          onCancel?.()
        }
      }

      window.addEventListener("keydown", handleKeyDown)
      return () => window.removeEventListener("keydown", handleKeyDown)
    }, [])

    return (
      <div className="flex flex-col gap-3">
        <div>
          <div className="font-semibold">{title}</div>
          {description && (
            <div className="text-sm text-muted-foreground mt-1">{description}</div>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={variant}
            onClick={async () => {
              toast.dismiss(toastId)
              await onConfirm()
            }}
            autoFocus
          >
            {confirmLabel}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              toast.dismiss(toastId)
              onCancel?.()
            }}
          >
            {cancelLabel}
          </Button>
        </div>
      </div>
    )
  }

  const toastId = toast(<ToastContent />, {
    duration: Infinity,
    position: "top-center",
    closeButton,
    onDismiss: onCancel,
  })
  
  return toastId
}