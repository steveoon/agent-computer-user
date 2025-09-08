import { getDesktop, pauseDesktop } from "@/lib/e2b/utils";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const sandboxId = searchParams.get("sandboxId");

  if (!sandboxId) {
    return NextResponse.json({ error: "No sandboxId provided" }, { status: 400 });
  }

  try {
    const desktop = await getDesktop(sandboxId);
    const pausedSandboxId = await pauseDesktop(desktop);

    // 检查是否使用了降级方案（ID相同表示延长了超时而不是真正暂停）
    const isFullPauseSupported = pausedSandboxId !== sandboxId;

    return NextResponse.json(
      {
        success: true,
        pausedSandboxId,
        isFullPauseSupported,
        message: isFullPauseSupported
          ? "Desktop paused successfully"
          : "Desktop timeout extended (pause feature not fully supported yet)",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`Failed to pause desktop: ${sandboxId}`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        message: "Failed to pause desktop. The sandbox is still running.",
      },
      { status: 500 }
    );
  }
}
