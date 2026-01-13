"use client";

import { experimental_useObject as useObject } from "@ai-sdk/react";
import { z } from "zod";

const recipeSchema = z.object({
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
});

export function StructuredRecipeStream() {
  const { object, submit, isLoading, error, stop } = useObject({
    api: "/api/recipe",
    schema: recipeSchema,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white"
          disabled={isLoading}
          onClick={() => submit("Generate a lasagna recipe.")}
        >
          {isLoading ? "Generating..." : "Generate recipe"}
        </button>
        {isLoading && (
          <button
            type="button"
            className="text-sm text-zinc-600"
            onClick={() => stop()}
          >
            Stop
          </button>
        )}
      </div>

      {error && <div className="text-sm text-red-600">Something went wrong.</div>}

      {object && (
        <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm">
          <div className="font-semibold text-zinc-800">{object.recipe?.name}</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-700">
            {object.recipe?.ingredients?.map((item, index) =>
              item ? (
                <li key={index}>
                  {item.name}: {item.amount}
                </li>
              ) : null
            )}
          </ul>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-zinc-700">
            {object.recipe?.steps?.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
