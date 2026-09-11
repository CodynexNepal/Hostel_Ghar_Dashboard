import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

const baseURL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

export const api = axios.create({
  baseURL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("hg_token");
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getToken();
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

export interface ApiErrorShape {
  message: string;
  status: number;
  errors?: Record<string, string[]>;
}

export function toApiError(error: unknown): ApiErrorShape {
  if (axios.isAxiosError(error)) {
    const err = error as AxiosError<{ message?: string; errors?: Record<string, string[]> }>;
    const status = err.response?.status ?? 0;
    return {
      message: err.response?.data?.message ?? err.message ?? "Something went wrong.",
      status,
      errors: err.response?.data?.errors,
    };
  }
  return { message: "Something went wrong.", status: 0 };
}

api.interceptors.response.use(
  (res) => res,
  (error: unknown) => {
    const apiError = toApiError(error);
    if (apiError.status === 401 && typeof window !== "undefined") {
      window.localStorage.removeItem("hg_token");
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login?reason=session-expired";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
