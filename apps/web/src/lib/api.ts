const API_URL = process.env['API_URL'] ?? 'http://localhost:3000'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

async function request<T>(
  path: string,
  method: string,
  body?: unknown,
  token?: string,
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({ message: res.statusText }))
    throw new ApiError(res.status, (data as { message?: string }).message ?? res.statusText)
  }

  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string, token?: string) => request<T>(path, 'GET', undefined, token),
  post: <T>(path: string, body: unknown, token?: string) => request<T>(path, 'POST', body, token),
  put: <T>(path: string, body: unknown, token?: string) => request<T>(path, 'PUT', body, token),
  patch: <T>(path: string, body: unknown, token?: string) => request<T>(path, 'PATCH', body, token),
  del: <T>(path: string, token?: string) => request<T>(path, 'DELETE', undefined, token),
}
