import { generateText, NoObjectGeneratedError, Output, streamText, tool, stepCountIs } from "ai";
import { z } from "zod";

const ticketTriageSchema = z.object({
  summary: z.string().describe("Short summary of the issue"),
  category: z.enum(["bug", "feature", "question", "unknown"]),
  severity: z.enum(["low", "medium", "high"]),
  actions: z
    .array(
      z.object({
        owner: z.enum(["frontend", "backend", "infra", "pm"]),
        task: z.string(),
      })
    )
    .describe("Action items to resolve the ticket"),
});

export type TicketTriage = z.infer<typeof ticketTriageSchema>;

export async function triageTicket(prompt: string) {
  try {
    const { output } = await generateText({
      model: "__MODEL__",
      output: Output.object({
        name: "TicketTriage",
        description: "Classify a support ticket and recommend actions.",
        schema: ticketTriageSchema,
      }),
      prompt,
    });

    return output satisfies TicketTriage;
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      return {
        summary: "Unable to classify ticket",
        category: "unknown",
        severity: "low",
        actions: [],
      } satisfies TicketTriage;
    }
    throw error;
  }
}

export function streamTicketTriage(prompt: string) {
  return streamText({
    model: "__MODEL__",
    output: Output.object({
      schema: ticketTriageSchema,
    }),
    prompt,
  });
}

export async function generateWeatherArray(prompt: string) {
  const { output } = await generateText({
    model: "__MODEL__",
    output: Output.array({
      name: "WeatherList",
      description: "List of weather summaries by location.",
      element: z.object({
        location: z.string(),
        temperature: z.number(),
        condition: z.string(),
      }),
    }),
    prompt,
  });

  return output;
}

export async function classifyIntent(prompt: string) {
  const { output } = await generateText({
    model: "__MODEL__",
    output: Output.choice({
      name: "Intent",
      description: "Classify the user's intent.",
      options: ["bug", "feature", "question", "other"],
    }),
    prompt,
  });

  return output;
}

export async function generateFreeformJson(prompt: string) {
  const { output } = await generateText({
    model: "__MODEL__",
    output: Output.json({
      name: "FreeformPayload",
      description: "Any valid JSON payload for downstream processing.",
    }),
    prompt,
  });

  return output;
}

export async function streamRecipeParts(prompt: string) {
  const { partialOutputStream } = streamText({
    model: "__MODEL__",
    output: Output.object({
      schema: z.object({
        recipe: z.object({
          name: z.string(),
          ingredients: z.array(
            z.object({
              name: z.string(),
              amount: z.string(),
            })
          ),
          steps: z.array(z.string()),
        }),
      }),
    }),
    prompt,
  });

  for await (const partial of partialOutputStream) {
    console.log(partial);
  }
}

export async function structuredWithTools(prompt: string) {
  const { output } = await generateText({
    model: "__MODEL__",
    tools: {
      weather: tool({
        description: "Get the weather for a location.",
        inputSchema: z.object({ location: z.string() }),
        execute: async ({ location }) => ({
          location,
          temperature: 72,
          condition: "sunny",
        }),
      }),
    },
    output: Output.object({
      schema: z.object({
        summary: z.string(),
        recommendation: z.string(),
      }),
    }),
    stopWhen: stepCountIs(5),
    prompt,
  });

  return output;
}
