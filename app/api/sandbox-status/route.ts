import { checkSandboxStatus } from "@/lib/e2b/utils";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sandboxId = searchParams.get("sandboxId");

  if (!sandboxId) {
    return NextResponse.json({ error: "No sandboxId provided" }, { status: 400 });
  }

  try {
    const status = await checkSandboxStatus(sandboxId);

    return NextResponse.json(status, { status: 200 });
  } catch (error) {
    console.error(`Failed to check sandbox status: ${sandboxId}`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        isRunning: false,
        sandboxId,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
