import type { UserRole } from "@/types/auth";

/**
 * Minimal JWT payload decoder (client-side, no signature verification —
 * the backend is the authority; we only read the role claim for routing).
 *
 * Handles base64url payloads and never throws: returns null on any
 * malformed / non-JWT token (e.g. opaque demo tokens).
 */

export interface TokenPayload {
  role?: unknown;
  roles?: unknown;
  userRole?: unknown;
  user_role?: unknown;
  userType?: unknown;
  user_type?: unknown;
  accountType?: unknown;
  authorities?: unknown;
  authority?: unknown;
  scope?: unknown;
  type?: unknown;
  user?: { role?: unknown; userRole?: unknown; type?: unknown };
  [key: string]: unknown;
}

export function decodeTokenPayload(token: string | null | undefined): TokenPayload | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    // atob breaks on non-Latin1 chars; decode UTF-8 safely.
    const binary =
      typeof atob !== "undefined" ? atob(padded) : Buffer.from(padded, "base64").toString("binary");
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const parsed: unknown = JSON.parse(json);
    if (parsed && typeof parsed === "object") return parsed as TokenPayload;
    return null;
  } catch {
    return null;
  }
}

const ROLE_ALIASES: Record<string, UserRole> = {
  SUPER_ADMIN: "SUPER_ADMIN",
  SUPERADMIN: "SUPER_ADMIN",
  ADMIN: "SUPER_ADMIN",
  PLATFORM_ADMIN: "SUPER_ADMIN",
  HOSTEL_OWNER: "HOSTEL_OWNER",
  OWNER: "HOSTEL_OWNER",
  HOSTELOWNER: "HOSTEL_OWNER",
  WARDEN: "HOSTEL_OWNER",
  STAFF: "HOSTEL_OWNER",
  RESIDENT: "RESIDENT",
  STUDENT: "RESIDENT",
  TENANT: "RESIDENT",
  USER: "RESIDENT",
};

/** Normalize any backend role string variant to our UserRole union. */
export function normalizeRole(raw: unknown): UserRole | null {
  // Backends often send roles as an array: ["HOSTEL_OWNER"] or "ROLE_OWNER,ADMIN".
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const role = normalizeRole(item);
      if (role) return role;
    }
    return null;
  }
  if (typeof raw !== "string") return null;
  // Handle comma/space separated lists: "ROLE_OWNER, RESIDENT"
  const parts = raw.split(/[,|\s]+/);
  for (const part of parts) {
    let key = part
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, "_");
    if (!key) continue;
    // Strip Spring-style ROLE_ prefix: ROLE_HOSTEL_OWNER -> HOSTEL_OWNER
    if (key.startsWith("ROLE_")) key = key.slice(5);
    const role = ROLE_ALIASES[key];
    if (role) return role;
  }
  return null;
}

/**
 * Extract the role from an access token, checking common claim shapes:
 * `role`, `userRole`, `user_role`, `userType`, `type`, or nested `user.*`.
 */
export function roleFromToken(token: string | null | undefined): UserRole | null {
  const payload = decodeTokenPayload(token);
  if (!payload) return null;
  const candidates: unknown[] = [
    payload.role,
    payload.userRole,
    payload.user_role,
    payload.userType,
    payload.user_type,
    payload.accountType,
    payload.user?.role,
    payload.user?.userRole,
    payload.user?.type,
    // Common backend variants: roles array, authorities, scope
    payload.roles,
    payload.authorities,
    payload.authority,
    payload.scope,
  ];
  // `type` is checked last — it can collide with token-type claims,
  // and only counts if it normalizes to a known role.
  candidates.push(payload.type);
  for (const c of candidates) {
    const role = normalizeRole(c);
    if (role) return role;
  }
  return null;
}

/** Landing page for a role — the single source of truth for post-login redirect. */
export function routeForRole(role: UserRole): string {
  if (role === "RESIDENT") return "/resident";
  if (role === "SUPER_ADMIN") return "/admin";
  return "/dashboard";
}
