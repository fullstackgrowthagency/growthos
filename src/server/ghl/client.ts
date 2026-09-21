/**
 * Thin fetch wrapper for the HighLevel (GoHighLevel) API. Pins the required
 * `Version` header and centralizes bearer-token injection and error
 * shaping so callers deal with plain rejected promises, not raw Response
 * objects.
 */

export class GhlApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryAfterSeconds: number | null,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = "GhlApiError";
  }
}

function baseUrl(): string {
  return process.env.GHL_API_BASE_URL ?? "https://services.leadconnectorhq.com";
}

function apiVersion(): string {
  return process.env.GHL_API_VERSION ?? "2021-07-28";
}

export interface GhlRequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  /** Bearer token — an agency-level token or a location token. */
  accessToken: string;
}

export async function ghlRequest<T = unknown>(path: string, opts: GhlRequestOptions): Promise<T> {
  const url = new URL(path, baseUrl());
  if (opts.query) {
    for (const [key, value] of Object.entries(opts.query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }

  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      Version: apiVersion(),
      Accept: "application/json",
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // response wasn't JSON — leave body null
    }
    const retryAfterHeader = res.headers.get("Retry-After");
    throw new GhlApiError(
      `GHL API ${opts.method ?? "GET"} ${path} failed with ${res.status}`,
      res.status,
      retryAfterHeader ? Number(retryAfterHeader) : null,
      body,
    );
  }

  return (await res.json()) as T;
}
