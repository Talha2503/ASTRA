import { clearToken, getToken, setToken } from "@/lib/auth";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });

  if (res.status === 401 && token) {
    // The token expired or was rejected: sign out and go back to the login page.
    clearToken();
    if (typeof window !== "undefined") {
      window.location.replace("/login?expired=1");
    }
  }

  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export type LoginFailure =
  | "wrong_credentials"
  | "not_configured"
  | "unreachable"
  | "storage"
  | "unknown";

export class LoginError extends Error {
  reason: LoginFailure;

  constructor(reason: LoginFailure) {
    super(reason);
    this.reason = reason;
  }
}

export async function login(email: string, password: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username: email, password }),
    });
  } catch {
    throw new LoginError("unreachable");
  }

  if (res.status === 401) throw new LoginError("wrong_credentials");
  if (res.status === 503) throw new LoginError("not_configured");
  if (!res.ok) throw new LoginError("unknown");

  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token || !setToken(data.access_token)) {
    throw new LoginError("storage");
  }
}