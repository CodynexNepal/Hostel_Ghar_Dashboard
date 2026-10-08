"use strict";
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = void 0;
exports.getToken = getToken;
exports.setToken = setToken;
exports.clearToken = clearToken;
exports.getHostelId = getHostelId;
exports.setHostelId = setHostelId;
exports.clearHostelId = clearHostelId;
exports.getAccessTokenFromCookies = getAccessTokenFromCookies;
exports.toApiError = toApiError;
exports.fieldError = fieldError;
const axios_1 = __importDefault(require("axios"));
const env_1 = require("./env");
exports.api = axios_1.default.create({
  baseURL: env_1.env.apiUrl,
  timeout: 15000,
  withCredentials: true,
  headers: { "Content-Type": "application/json", Accept: "application/json" },
});
// Fail fast if the API URL was misconfigured — otherwise requests hang as
// (pending) in DevTools with no clue. Surface it in the console immediately.
if (typeof window !== "undefined" && !env_1.env.apiUrl) {
  console.error(
    "[api] NEXT_PUBLIC_API_URL is missing. Create D:\\Hostel_Ghar_Dashboard\\.env.local with NEXT_PUBLIC_API_URL=http://localhost:3000/api and restart `next dev`."
  );
}
// ------------------------------------------------------------------
// Token storage (single source of truth)
// ------------------------------------------------------------------
function getToken() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(env_1.TOKEN_KEY);
  } catch {
    return null;
  }
}
function setToken(token) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(env_1.TOKEN_KEY, token);
}
function clearToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(env_1.TOKEN_KEY);
}
// ------------------------------------------------------------------
// Cookie helpers — never throw, never call .split on undefined.
// document.cookie is "" (not undefined) in browsers, but during SSR,
// in workers, or in tests it can be missing entirely.
// ------------------------------------------------------------------
function readCookieString() {
  if (typeof document === "undefined") return "";
  try {
    const raw = document.cookie;
    return typeof raw === "string" ? raw : "";
  } catch {
    return "";
  }
}
function getCookieValue(name) {
  const cookieString = readCookieString();
  if (!cookieString) return null;
  const found = cookieString
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie === name || cookie.startsWith(`${name}=`));
  if (!found) return null;
  const eq = found.indexOf("=");
  const value = eq >= 0 ? found.slice(eq + 1) : "";
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
function getHostelId() {
  return getCookieValue(env_1.HOSTEL_ID_KEY);
}
function setHostelId(hostelId) {
  if (typeof document === "undefined") return;
  document.cookie = `${env_1.HOSTEL_ID_KEY}=${encodeURIComponent(hostelId)}; Path=/; SameSite=Lax`;
}
function clearHostelId() {
  if (typeof document === "undefined") return;
  document.cookie = `${env_1.HOSTEL_ID_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
}
function getAccessTokenFromCookies() {
  // Backend sets `access_token` as HttpOnly on login (invisible to JS —
  // the browser still sends it via `withCredentials: true` on every
  // request). When the cookie is readable (non-HttpOnly), mirror it as
  // `Authorization: Bearer …` for backends that accept both transports.
  // IMPORTANT: HttpOnly cookies CANNOT be read from JS by design — no
  // frontend code can "send access_token from cookies" manually. The
  // browser attaches `Cookie: access_token=…` automatically; all we do
  // here is (a) always keep `withCredentials: true`, and (b) add the
  // Bearer header when the token happens to be readable.
  const names = ["access_token", "accessToken", "token", env_1.TOKEN_KEY, "jwt"];
  for (const name of names) {
    const value = getCookieValue(name);
    if (value) return value;
  }
  return null;
}
/** @deprecated Use getAccessTokenFromCookies() instead. */
function getCookieToken() {
  return getAccessTokenFromCookies();
}
// ------------------------------------------------------------------
// Request interceptor: ALWAYS send cookies (HttpOnly access_token) and,
// when the token is readable, also mirror it as Bearer.
// ------------------------------------------------------------------
exports.api.interceptors.request.use((config) => {
  // `withCredentials: true` is set on the instance, but re-assert per
  // request so no caller can accidentally drop the cookie transport
  // (this is what sends `Cookie: access_token=…` on /auth/me and
  // /hostel-ghar/hostels?limit=1 and every other request).
  config.withCredentials = true;
  const token = getToken() ?? getCookieToken();
  const hostelId = getHostelId();
  try {
    if (token && !config.headers.get("Authorization")) {
      config.headers.set("Authorization", `Bearer ${token}`);
    }
  } catch {
    /* headers not yet initialised — cookie transport still applies */
  }
  try {
    if (hostelId && !config.headers.get("X-Hostel-Id")) {
      config.headers.set("X-Hostel-Id", hostelId);
    }
  } catch {
    /* noop */
  }
  return config;
});
// ------------------------------------------------------------------
// Response interceptor: global 401 handling (redirect once, no loop)
// ------------------------------------------------------------------
let redirecting = false;
exports.api.interceptors.response.use(
  (res) => res,
  (error) => {
    const apiError = toApiError(error);
    if (apiError.status === 401 && typeof window !== "undefined") {
      clearToken();
      if (!window.location.pathname.startsWith("/login") && !redirecting) {
        redirecting = true;
        window.location.href = "/login?reason=session-expired";
        window.setTimeout(() => {
          redirecting = false;
        }, 2000);
      }
    }
    return Promise.reject(error);
  }
);
function toApiError(error) {
  if (axios_1.default.isAxiosError(error)) {
    const err = error;
    const status = err.response?.status ?? 0;
    const data = err.response?.data;
    if (status === 0) {
      return {
        message: "Network error. Check your connection and try again.",
        status: 0,
      };
    }
    // Backend may return errors as `{ field: msg[] }` OR `[{ field, messages[] }]`.
    let errors;
    if (Array.isArray(data?.errors)) {
      errors = {};
      for (const e of data.errors) {
        if (e?.field) errors[e.field] = e.messages ?? [];
      }
    } else if (data?.errors && typeof data.errors === "object") {
      errors = data.errors;
    }
    // Surface field messages in the banner when top-level message is generic
    // (e.g. "Validation error" with `tag: Tag must be one of: …`).
    const detail = errors
      ? Object.entries(errors)
          .map(([field, msgs]) => `${field}: ${(msgs ?? []).join(", ")}`)
          .join("; ")
      : "";
    const generic = !data?.message || /^(validation error|invalid input)$/i.test(data.message);
    return {
      message:
        (!generic && data?.message) ||
        (detail
          ? `Validation failed — ${detail}.`
          : status === 404
            ? "Resource not found."
            : status === 403
              ? "You don't have permission to do that."
              : status === 422
                ? "Validation failed. Check the highlighted fields."
                : status >= 500
                  ? "Server error. Please try again in a moment."
                  : err.message || "Something went wrong."),
      status,
      errors,
      code: data?.code,
    };
  }
  if (error instanceof Error) return { message: error.message, status: 0 };
  return { message: "Something went wrong.", status: 0 };
}
/** Extract field-level message for RHF/Yup mapping. */
function fieldError(apiError, field) {
  return apiError?.errors?.[field]?.[0];
}
exports.default = exports.api;
