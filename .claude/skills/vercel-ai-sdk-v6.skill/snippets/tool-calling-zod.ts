import { generateText, tool } from "ai";
import { z } from "zod";

const searchDocsInput = z.object({
  query: z.string().min(1).describe("Search query"),
  topK: z.number().int().min(1).max(20).default(5).describe("Max results"),
});

type SearchDocsInput = z.infer<typeof searchDocsInput>;

type SearchDocsResult =
  | { ok: true; items: Array<{ title: string; url: string; snippet: string }> }
  | { ok: false; error: string };

export const searchDocsTool = tool({
  description: "Search internal docs for relevant snippets",
  inputSchema: searchDocsInput,
  strict: true,
  inputExamples: [{ input: { query: "useChat tool approval", topK: 3 } }],
  execute: async ({ query, topK }: SearchDocsInput): Promise<SearchDocsResult> => {
    try {
      const items = await fakeSearch(query, topK);
      return { ok: true, items };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "unknown error" };
    }
  },
});

export async function runExample() {
  return generateText({
    model: "__MODEL__",
    tools: {
      search_docs: searchDocsTool,
    },
    prompt: "Find docs about tool execution approval in useChat.",
  });
}

async function fakeSearch(query: string, topK: number) {
  return Array.from({ length: topK }, (_, index) => ({
    title: `Result ${index + 1} for "${query}"`,
    url: `https://docs.example.com/${index + 1}`,
    snippet: "Example snippet content.",
  }));
}
