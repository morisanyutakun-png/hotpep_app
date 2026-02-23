import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { useCallback } from "react";

export function useApiFetch() {
  const { token, tenantId } = useAuth();

  const fetchFn = useCallback(
    <T,>(path: string, options: RequestInit = {}) =>
      apiFetch<T>(path, { ...options, token: token || undefined, tenantId: tenantId || undefined }),
    [token, tenantId]
  );

  return fetchFn;
}
