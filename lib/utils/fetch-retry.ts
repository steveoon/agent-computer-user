/**
 * Utility for making API requests with retry capability
 *
 * @param url - The URL to fetch
 * @param options - Fetch options plus retry configuration
 * @param options.retries - Number of retries (default: 3)
 * @param options.retryDelay - Delay between retries in ms (default: 1000)
 * @param options.timeout - Request timeout in ms (default: 30000)
 * @param options.retryOn - Function to determine if a response/error should trigger retry
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit & {
    retries?: number;
    retryDelay?: number;
    timeout?: number;
    retryOn?: (error: unknown) => boolean;
  } = {}
): Promise<Response> {
  const { retries = 3, retryDelay = 1000, timeout = 30000, retryOn, ...fetchOptions } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return response;
      }

      // If provided, use custom retry logic for response status
      if (retryOn && retryOn(response)) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Default: retry on 5xx server errors
      if (response.status >= 500 && attempt < retries) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Return response for 4xx or successful requests that shouldn't be retried
      return response;
    } catch (error) {
      lastError = error;

      // Don't retry if this is the last attempt
      if (attempt === retries) break;

      // If aborted by timeout, might want to retry
      // If user aborted (not timeout), usually don't retry - but difficult to distinguish without custom signal

      // Check if we should retry based on error
      if (retryOn && !retryOn(error)) break;

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt))); // Exponential backoff
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
