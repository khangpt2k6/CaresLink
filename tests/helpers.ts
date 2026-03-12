import { NextRequest } from "next/server";

/** Build a NextRequest for testing API routes */
export function createRequest(
  url: string,
  options?: { method?: string; body?: unknown; headers?: Record<string, string> }
): NextRequest {
  const { method = "GET", body, headers = {} } = options ?? {};
  const fullUrl = url.startsWith("http") ? url : `http://localhost:3000${url}`;

  const init: RequestInit = { method, headers };
  if (body) {
    init.body = JSON.stringify(body);
    (init.headers as Record<string, string>)["Content-Type"] = "application/json";
  }

  return new NextRequest(fullUrl, init);
}

/** Parse JSON from a NextResponse */
export async function parseResponse<T = unknown>(response: Response): Promise<{ status: number; data: T }> {
  const data = (await response.json()) as T;
  return { status: response.status, data };
}
