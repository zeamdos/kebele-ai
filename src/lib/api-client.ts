export async function api<T>(
  path: string,
  init: RequestInit & { userId?: string } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.userId) headers.set("x-user-id", init.userId);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, { ...init, headers });
  const payload = (await response.json()) as {
    ok: boolean;
    data?: T;
    error?: { message?: string; messageAm?: string };
  };

  if (!response.ok || !payload.ok) {
    throw new Error(
      payload.error?.messageAm || payload.error?.message || "Request failed",
    );
  }
  return payload.data as T;
}
