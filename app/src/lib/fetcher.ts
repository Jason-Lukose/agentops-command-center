import type { ApiError } from "@/components/types";

export class ApiRequestError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/** SWR-compatible fetcher that unwraps the { error: {code,message} } envelope. */
export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    let body: ApiError | null = null;
    try {
      body = await res.json();
    } catch {
      // ignore parse failure, fall through to generic error
    }
    throw new ApiRequestError(
      body?.error?.message ?? `Request failed (${res.status})`,
      body?.error?.code ?? "internal_error",
      res.status
    );
  }
  return res.json();
}

export async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) {
    let payload: ApiError | null = null;
    try {
      payload = await res.json();
    } catch {
      // ignore
    }
    throw new ApiRequestError(
      payload?.error?.message ?? `Request failed (${res.status})`,
      payload?.error?.code ?? "internal_error",
      res.status
    );
  }
  return res.json();
}

export async function putJson<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) {
    let payload: ApiError | null = null;
    try {
      payload = await res.json();
    } catch {
      // ignore
    }
    throw new ApiRequestError(
      payload?.error?.message ?? `Request failed (${res.status})`,
      payload?.error?.code ?? "internal_error",
      res.status
    );
  }
  return res.json();
}
