import { NextRequest, NextResponse } from "next/server";
import { getDesktopURL } from "@/lib/e2b/utils";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sandboxId = searchParams.get("sandboxId") || undefined;

    console.log(`API: Getting desktop URL for sandboxId: ${sandboxId}`);

    const result = await getDesktopURL(sandboxId);

    console.log(`API: Desktop URL result:`, {
      hasStreamUrl: !!result.streamUrl,
      sandboxId: result.id,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("API: Failed to get desktop URL:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get desktop URL" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const sandboxId = body.sandboxId || undefined;

    console.log(`API POST: Getting desktop URL for sandboxId: ${sandboxId}`);

    const result = await getDesktopURL(sandboxId);

    console.log(`API POST: Desktop URL result:`, {
      hasStreamUrl: !!result.streamUrl,
      sandboxId: result.id,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("API POST: Failed to get desktop URL:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get desktop URL" },
      { status: 500 }
    );
  }
}
