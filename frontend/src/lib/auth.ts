const KEY = "astra_token";
const EVENT = "astra-auth-change";

export type AuthStatus = "yes" | "no" | "unknown";
export type Role = "admin" | "viewer";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function notify() {
  window.dispatchEvent(new Event(EVENT));
}

// Returns false if the browser refused to store the token.
export function setToken(token: string): boolean {
  try {
    window.localStorage.setItem(KEY, token);
  } catch {
    return false;
  }
  notify();
  return getToken() === token;
}

export function clearToken() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Storage unavailable: nothing to clear.
  }
  notify();
}

export function subscribeAuth(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function authStatus(): AuthStatus {
  return getToken() ? "yes" : "no";
}

// On the server we cannot know yet, so the page waits for the browser to answer.
export function serverAuthStatus(): AuthStatus {
  return "unknown";
}

// Reads the role out of the token so the page can show or hide things.
// This is only a display hint: the backend checks the signed token on every request.
function decodeRole(token: string | null): Role | null {
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const role = (JSON.parse(json) as { role?: unknown }).role;
    return role === "admin" || role === "viewer" ? role : null;
  } catch {
    return null;
  }
}

export function getRole(): Role | null {
  return decodeRole(getToken());
}

export function serverRole(): Role | null {
  return null;
}