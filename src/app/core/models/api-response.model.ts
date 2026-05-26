// Wire-level shape of every endpoint reply.
// Mirrors the ApiResponse schema in api-contract.yaml.

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown> | null;
}

export interface ApiMeta {
  page?: number;
  pageSize?: number;
  total?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: ApiError | null;
  meta?: ApiMeta | null;
}

// Convenience: unwrap data when callers know it must be present.
export function unwrap<T>(response: ApiResponse<T>): T {
  if (!response.success || response.data === null) {
    throw new Error(response.error?.message ?? 'API response missing data');
  }
  return response.data;
}
