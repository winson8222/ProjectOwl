/** Simple session helper — reads/writes current user from sessionStorage. */

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

/** Get the current session user, or null if not set. */
export function getSessionUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem("projectowl_user");
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

/** Set the current session user. */
export function setSessionUser(user: SessionUser): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem("projectowl_user", JSON.stringify(user));
}

/** Clear the session. */
export function clearSession(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem("projectowl_user");
}
