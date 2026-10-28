/**
 * Thin fetch wrapper for Scribe Core.
 *
 * Every backend response is `{ success: true, data }` or
 * `{ success: false, error: { code, message, details? } }`.
 * `request()` unwraps `data` on success and throws `ApiError` otherwise.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Field-level messages from a Zod `flatten()` payload, if any. */
  get fieldErrors(): Record<string, string> {
    const d = this.details as { fieldErrors?: Record<string, string[] | undefined> } | undefined;
    const out: Record<string, string> = {};
    if (d?.fieldErrors) {
      for (const [field, msgs] of Object.entries(d.fieldErrors)) {
        if (msgs?.length) out[field] = msgs[0];
      }
    }
    return out;
  }
}

type Query = Record<string, string | number | undefined | null>;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Query;
}

let authToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

/** Called when an authenticated request comes back 401 (expired / revoked token). */
export function setUnauthorizedHandler(fn: (() => void) | null) {
  unauthorizedHandler = fn;
}

function buildUrl(path: string, query?: Query): string {
  const params = new URLSearchParams();
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
    }
  }
  const qs = params.toString();
  return `/api${path}${qs ? `?${qs}` : ''}`;
}

function describeValidation(details: unknown): string | null {
  const d = details as { formErrors?: string[]; fieldErrors?: Record<string, string[] | undefined> } | undefined;
  if (!d) return null;
  const msgs = [
    ...(d.formErrors ?? []),
    ...Object.values(d.fieldErrors ?? {}).flatMap((m) => m ?? []),
  ];
  return msgs.length ? msgs.join(' · ') : null;
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query } = opts;
  const sentToken = authToken;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (sentToken) headers.Authorization = `Bearer ${sentToken}`;

  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Cannot reach the Scribe server. Check your connection.', 0, 'NETWORK_ERROR');
  }

  let json: { success?: boolean; data?: T; error?: { code?: string; message?: string; details?: unknown } } | null = null;
  try {
    json = await res.json();
  } catch {
    // Vite's proxy answers 500/502/504 with an empty or HTML body when the backend is down.
    throw new ApiError(
      res.status >= 500
        ? 'The Scribe API is unavailable. Is the backend running on port 3000?'
        : `Unexpected response from server (${res.status})`,
      res.status,
      'BAD_RESPONSE',
    );
  }

  if (!res.ok || !json?.success) {
    const err = json?.error;
    const message =
      (err?.code === 'VALIDATION_ERROR' && describeValidation(err.details)) ||
      err?.message ||
      `Request failed (${res.status})`;

    // Only treat 401 as "session expired" if we actually sent a token
    // (a 401 from /auth/login is just bad credentials).
    if (res.status === 401 && sentToken) unauthorizedHandler?.();

    throw new ApiError(message, res.status, err?.code, err?.details);
  }

  return json.data as T;
}
