const baseUrl = process.env.NEXT_PUBLIC_API_URL;

if (!baseUrl) {
  throw new Error("API URL ist nicht gesetzt");
}

export async function apiRequest<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(new URL(path, baseUrl), {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API-Anfrage fehlgeschlagen (${response.status})`);
  }

  return response.json() as Promise<T>;
}
