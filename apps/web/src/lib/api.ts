const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface FetchOptions extends RequestInit {
  token?: string;
  tenantId?: string;
}

export interface APIResponse<T> {
  success: boolean;
  data: T | null;
  error: { message: string; code?: string } | null;
}

export async function apiFetch<T>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const { token, tenantId, headers: customHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(customHeaders as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const tid = tenantId || (typeof window !== "undefined" ? localStorage.getItem("tenantId") : null);
  if (tid) {
    headers["X-Tenant-Id"] = tid;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    headers,
    ...rest,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = body?.detail || body?.error?.message || `API Error: ${res.status}`;
    throw new Error(message);
  }

  const json: APIResponse<T> = await res.json();
  if (!json.success && json.error) {
    throw new Error(json.error.message);
  }

  return json.data as T;
}
