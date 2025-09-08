import { killDesktop } from "@/lib/e2b/utils";

// Common handler for both GET and POST requests
async function handleKillDesktop(request: Request) {
  // Enable CORS to ensure this works across all browsers

  const { searchParams } = new URL(request.url);
  const sandboxId = searchParams.get("sandboxId");

  console.log(`Kill desktop request received via ${request.method} for ID: ${sandboxId}`);

  if (!sandboxId) {
    return new Response("No sandboxId provided", { status: 400 });
  }

  try {
    await killDesktop(sandboxId);
    return new Response("Desktop killed successfully", { status: 200 });
  } catch (error) {
    console.error(`Failed to kill desktop with ID: ${sandboxId}`, error);
    return new Response("Failed to kill desktop", { status: 500 });
  }
}

// Handle POST requests
export async function POST(request: Request) {
  return handleKillDesktop(request);
}
