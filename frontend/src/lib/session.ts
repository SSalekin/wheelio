import type { WheelSession } from "../types";

const STORAGE_KEY = "wheelio:session:v1";
const SESSION_TTL_MS = 30 * 60 * 1000;

export function loadSession(now: number): WheelSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    const session = parsed as WheelSession;
    if (
      !Array.isArray(session.entries) ||
      !Array.isArray(session.picks) ||
      !Array.isArray(session.transcript) ||
      typeof session.removeOnPick !== "boolean" ||
      typeof session.expiresAt !== "number"
    ) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    if (session.expiresAt <= now) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return session;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function saveSession(session: WheelSession, now: number): WheelSession {
  const updated: WheelSession = {
    ...session,
    expiresAt: now + SESSION_TTL_MS,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}
