import { createChildLogger } from "./logger.js";
import type { TokenBucketRateLimiter } from "./rate-limiter.js";

const log = createChildLogger("http-client");

interface FetchOptions extends RequestInit {
  retries?: number;
  retryDelay?: number;
  rateLimiter?: TokenBucketRateLimiter;
  timeout?: number;
}

export async function fetchWithRetry(
  url: string,
  options: FetchOptions = {},
): Promise<Response> {
  const { retries = 3, retryDelay = 1000, rateLimiter, timeout = 30000, ...fetchOpts } = options;

  if (rateLimiter) {
    await rateLimiter.acquire();
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...fetchOpts,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after");
        const wait = retryAfter ? parseInt(retryAfter, 10) * 1000 : retryDelay * (attempt + 1);
        log.warn({ url, wait }, "Rate limited, waiting before retry");
        await new Promise((resolve) => setTimeout(resolve, wait));
        continue;
      }

      if (response.status >= 500 && attempt < retries) {
        log.warn({ url, status: response.status, attempt }, "Server error, retrying");
        await new Promise((resolve) => setTimeout(resolve, retryDelay * (attempt + 1)));
        continue;
      }

      return response;
    } catch (error) {
      if (attempt === retries) {
        log.error({ url, error, attempt }, "Request failed after all retries");
        throw error;
      }
      log.warn({ url, error, attempt }, "Request failed, retrying");
      await new Promise((resolve) => setTimeout(resolve, retryDelay * (attempt + 1)));
    }
  }

  throw new Error(`Request to ${url} failed after ${retries + 1} attempts`);
}

export async function fetchJson<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const response = await fetchWithRetry(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}: ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export async function fetchText(url: string, options: FetchOptions = {}): Promise<string> {
  const response = await fetchWithRetry(url, options);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}: ${response.statusText}`);
  }

  return response.text();
}
