import type { DashboardFilters } from "./types";

export const API_BASE = "/api/py";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function parseError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.detail === "string") return body.detail;
    if (Array.isArray(body?.detail)) {
      return body.detail
        .map((d: { msg?: string }) => d?.msg ?? "Invalid input")
        .join(" | ");
    }
  } catch {
    /* falls through to the status-based message below */
  }
  if (response.status === 401) return "Your session has expired. Please sign in again.";
  if (response.status === 403) return "You do not have access to this.";
  if (response.status >= 500) return "The server ran into a problem. Please try again.";
  return `Request failed (${response.status}).`;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    // Cookies carry the session, so they must ride along on every call.
    credentials: "include",
    ...init,
    headers: {
      ...(init.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new ApiError(await parseError(response), response.status);
  }

  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return (await response.text()) as unknown as T;
  }
  return (await response.json()) as T;
}

export function filtersToQuery(filters: Partial<DashboardFilters>): string {
  const params = new URLSearchParams();
  for (const key of [
    "department",
    "job_role",
    "age_group",
    "tenure_band",
  ] as const) {
    for (const value of filters[key] ?? []) {
      if (value) params.append(key, value);
    }
  }
  if (filters.date_from) params.set("date_from", filters.date_from);
  if (filters.date_to) params.set("date_to", filters.date_to);
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** Trigger a browser download for an authenticated endpoint. */
export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const response = await fetch(`${API_BASE}${path}`, { credentials: "include" });
  if (!response.ok) {
    throw new ApiError(await parseError(response), response.status);
  }

  const disposition = response.headers.get("content-disposition") ?? "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] ?? fallbackName;

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
