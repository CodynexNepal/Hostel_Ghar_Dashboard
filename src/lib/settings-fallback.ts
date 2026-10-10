import { toApiError } from "./axios";

/** Backend 404s until settings routes ship — then use local fallback. */
export function isMissingSettingsRoute(err: unknown): boolean {
  return toApiError(err).status === 404;
}

export function readSettingsFallback<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeSettingsFallback(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* blocked — backend stays source of truth */
  }
}
