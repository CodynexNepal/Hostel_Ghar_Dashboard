"use strict";
/**
 * Centralized runtime environment config.
 * Fail-fast validation in production, safe fallbacks in development.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HOSTEL_ID_KEY = exports.USER_KEY = exports.TOKEN_KEY = exports.env = void 0;
function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (!value) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`Missing required env var: ${name}`);
    }
    return "";
  }
  return value;
}
exports.env = {
  apiUrl: required("NEXT_PUBLIC_API_URL", "http://localhost:8000/api"),
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Hostel Ghar",
  isProd: process.env.NODE_ENV === "production",
  isDev: process.env.NODE_ENV !== "production",
};
exports.TOKEN_KEY = "hg_token";
exports.USER_KEY = "hg_user";
exports.HOSTEL_ID_KEY = "hg_hostel_id";
