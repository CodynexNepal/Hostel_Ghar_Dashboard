/**
 * Centralized runtime environment config.
 * Fail-fast validation in production, safe fallbacks in development.
 */

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`Missing required env var: ${name}`);
    }
    return "";
  }
  return value;
}

export const env = {
  apiUrl: required("NEXT_PUBLIC_API_URL", "http://localhost:8000/api"),
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Hostel Ghar",
  isProd: process.env.NODE_ENV === "production",
  isDev: process.env.NODE_ENV !== "production",
} as const;

export const TOKEN_KEY = "hg_token";
export const USER_KEY = "hg_user";
export const HOSTEL_ID_KEY = "hg_hostel_id";
