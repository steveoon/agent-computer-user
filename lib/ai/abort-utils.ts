import type { ToolSet } from "@/types/tool-common";

export function createAbortError(): DOMException {
  return new DOMException("Operation aborted", "AbortError");
}

export function raceWithAbort<T>(
  promise: PromiseLike<T> | T,
  signal?: AbortSignal
): Promise<T> {
  if (!signal) {
    return Promise.resolve(promise);
  }

  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(createAbortError());
      return;
    }

    const onAbort = () => {
      cleanup();
      reject(createAbortError());
    };

    const cleanup = () => {
      signal.removeEventListener("abort", onAbort);
    };

    signal.addEventListener("abort", onAbort);

    Promise.resolve(promise).then(
      value => {
        cleanup();
        resolve(value);
      },
      error => {
        cleanup();
        reject(error);
      }
    );
  });
}

export function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return Boolean(value) && typeof (value as AsyncIterable<unknown>)[Symbol.asyncIterator] === "function";
}

export function wrapAsyncIterable<T>(
  iterable: AsyncIterable<T>,
  signal?: AbortSignal
): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator]() {
      const iterator = iterable[Symbol.asyncIterator]();
      return {
        next(...args) {
          return raceWithAbort(iterator.next(...args), signal);
        },
        return(value) {
          return iterator.return ? iterator.return(value) : Promise.resolve({ done: true, value });
        },
        throw(error) {
          return iterator.throw ? iterator.throw(error) : Promise.reject(error);
        },
      };
    },
  };
}

export function wrapToolsWithAbortSignal(tools: ToolSet, requestSignal: AbortSignal): ToolSet {
  const wrapped: ToolSet = {};

  type ExecutableTool = ToolSet[string] & {
    execute: NonNullable<ToolSet[string]["execute"]>;
  };

  const hasExecute = (tool: ToolSet[string]): tool is ExecutableTool =>
    typeof tool.execute === "function";

  for (const [toolName, tool] of Object.entries(tools)) {
    if (!hasExecute(tool)) {
      wrapped[toolName] = tool;
      continue;
    }

    const execute = tool.execute;

    wrapped[toolName] = {
      ...tool,
      execute: (input, options) => {
        const abortSignal = options.abortSignal ?? requestSignal;

        if (abortSignal?.aborted) {
          throw createAbortError();
        }

        const result = execute(input, {
          ...options,
          abortSignal,
        });

        if (isAsyncIterable(result)) {
          return wrapAsyncIterable(result, abortSignal);
        }

        return raceWithAbort(result, abortSignal);
      },
    };
  }

  return wrapped;
}
