// Every call to the API. Writes carry X-Bair-Admin, which the API requires so other sites cannot post here.
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

/** Signed-out listeners: the app shows the login page when any call comes back 401. */
const signedOut = new Set<() => void>();
export const onSignedOut = (fn: () => void) => {
  signedOut.add(fn);
  return () => {
    signedOut.delete(fn);
  };
};

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const method = init.method ?? 'GET';
  const headers: Record<string, string> = {};
  if (method !== 'GET') headers['X-Bair-Admin'] = '1';
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, credentials: 'same-origin', body: init.body === undefined ? undefined : JSON.stringify(init.body) });
  } catch {
    throw new ApiError(0, 'offline');
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/api/auth/')) signedOut.forEach((fn) => fn());
    throw new ApiError(res.status, data?.error ?? 'error', data?.message);
  }
  return data as T;
}

export const get = <T,>(path: string) => api<T>(path);
export const post = <T,>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body: body ?? {} });
export const patch = <T,>(path: string, body: unknown) => api<T>(path, { method: 'PATCH', body });
export const del = <T,>(path: string) => api<T>(path, { method: 'DELETE' });
