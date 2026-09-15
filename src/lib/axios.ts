import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { env, HOSTEL_ID_KEY, TOKEN_KEY } from "./env";

export const api = axios.create({
  baseURL: env.apiUrl,
  timeout: 15000,
  withCredentials: true,
  headers: { "Content-Type": "application/json", Accept: "application/json" },
});

// Fail fast if the API URL was misconfigured — otherwise requests hang as
// (pending) in DevTools with no clue. Surface it in the console immediately.
if (typeof window !== "undefined" && !env.apiUrl) {
  console.error(
    "[api] NEXT_PUBLIC_API_URL is missing. Create D:\\Hostel_Ghar_Dashboard\\.env.local with NEXT_PUBLIC_API_URL=http://localhost:3000/api and restart `next dev`."
  );
}

// ------------------------------------------------------------------
// Token storage (single source of truth)
// ------------------------------------------------------------------
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
}

// ------------------------------------------------------------------
// Cookie helpers — never throw, never call .split on undefined.
// document.cookie is "" (not undefined) in browsers, but during SSR,
// in workers, or in tests it can be missing entirely.
// ------------------------------------------------------------------
function readCookieString(): string {
  if (typeof document === "undefined") return "";
  try {
    const raw = (document as unknown as { cookie?: unknown }).cookie;
    return typeof raw === "string" ? raw : "";
  } catch {
    return "";
  }
}

function getCookieValue(name: string): string | null {
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

export function getHostelId(): string | null {
  return getCookieValue(HOSTEL_ID_KEY);
}

export function setHostelId(hostelId: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${HOSTEL_ID_KEY}=${encodeURIComponent(hostelId)}; Path=/; SameSite=Lax`;
}

export function clearHostelId(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${HOSTEL_ID_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function getAccessTokenFromCookies(): string | null {
  // Backend sets `access_token` as HttpOnly on login (invisible to JS —
  // the browser still sends it via `withCredentials: true` on every
  // request). When the cookie is readable (non-HttpOnly), mirror it as
  // `Authorization: Bearer …` for backends that accept both transports.
  // IMPORTANT: HttpOnly cookies CANNOT be read from JS by design — no
  // frontend code can "send access_token from cookies" manually. The
  // browser attaches `Cookie: access_token=…` automatically; all we do
  // here is (a) always keep `withCredentials: true`, and (b) add the
  // Bearer header when the token happens to be readable.
  const names = ["access_token", "accessToken", "token", TOKEN_KEY, "jwt"];
  for (const name of names) {
    const value = getCookieValue(name);
    if (value) return value;
  }
  return null;
}

/** @deprecated Use getAccessTokenFromCookies() instead. */
function getCookieToken(): string | null {
  return getAccessTokenFromCookies();
}

// ------------------------------------------------------------------
// Request interceptor: ALWAYS send cookies (HttpOnly access_token) and,
// when the token is readable, also mirror it as Bearer.
// ------------------------------------------------------------------
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
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

api.interceptors.response.use(
  (res) => res,
  (error: unknown) => {
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

// ------------------------------------------------------------------
// Normalized error shape — every UI consumes this, never raw axios.
// ------------------------------------------------------------------
export interface ApiErrorShape {
  message: string;
  status: number;
  errors?: Record<string, string[]>;
  code?: string;
}

export function toApiError(error: unknown): ApiErrorShape {
  if (axios.isAxiosError(error)) {
    const err = error as AxiosError<{
      message?: string;
      errors?: Record<string, string[]>;
      code?: string;
    }>;
    const status = err.response?.status ?? 0;
    const data = err.response?.data;

    if (status === 0) {
      return {
        message: "Network error. Check your connection and try again.",
        status: 0,
      };
    }

    return {
      message:
        data?.message ??
        (status === 404
          ? "Resource not found."
          : status === 403
            ? "You don't have permission to do that."
            : status === 422
              ? "Validation failed. Check the highlighted fields."
              : status >= 500
                ? "Server error. Please try again in a moment."
                : err.message || "Something went wrong."),
      status,
      errors: data?.errors,
      code: data?.code,
    };
  }
  if (error instanceof Error) return { message: error.message, status: 0 };
  return { message: "Something went wrong.", status: 0 };
}

/** Extract field-level message for RHF/Yup mapping. */
export function fieldError(apiError: ApiErrorShape | null, field: string): string | undefined {
  return apiError?.errors?.[field]?.[0];
}

export default api;
