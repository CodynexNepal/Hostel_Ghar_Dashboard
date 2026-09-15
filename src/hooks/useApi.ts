"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toApiError, type ApiErrorShape } from "@/lib/axios";

interface UseApiState<T> {
  data: T | null;
  error: ApiErrorShape | null;
  isLoading: boolean;
  isRefetching: boolean;
}

interface UseApiOptions {
  /** Don't fire on mount — call refetch() manually. */
  lazy?: boolean;
  /** Initial data (renders instantly, replaced on fetch). */
  initialData?: null;
}

/**
 * Production-grade fetch hook.
 * - StrictMode-safe (ignores stale responses via request id)
 * - Separates initial load vs background refetch skeletons
 * - Normalized ApiErrorShape for consistent UI
 */
export function useApi<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
  options: UseApiOptions = {}
) {
  const { lazy = false } = options;
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    error: null,
    isLoading: !lazy,
    isRefetching: false,
  });
  const reqId = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const execute = useCallback(async (isRetry = false) => {
    const id = ++reqId.current;
    setState((s) => ({
      ...s,
      error: null,
      isLoading: s.data === null && !isRetry ? true : s.isLoading,
      isRefetching: s.data !== null,
    }));
    try {
      const data = await fetcherRef.current();
      if (reqId.current !== id) return data; // stale — ignore
      setState({ data, error: null, isLoading: false, isRefetching: false });
      return data;
    } catch (err) {
      if (reqId.current !== id) throw err;
      const error = toApiError(err);
      setState((s) => ({ ...s, error, isLoading: false, isRefetching: false }));
      throw error;
    }
  }, []);

  useEffect(() => {
    if (lazy) return;
    execute().catch(() => {
      /* error stored in state — UI renders ErrorState */
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps]);

  const refetch = useCallback(() => execute(true), [execute]);
  const retry = useCallback(() => execute(false), [execute]);

  return { ...state, refetch, retry, execute };
}

/** Mutation hook: idle → pending → success/error with toast-ready error. */
export function useMutation<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>
) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<ApiErrorShape | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const mutate = useCallback(async (...args: TArgs): Promise<TResult | null> => {
    setIsPending(true);
    setError(null);
    try {
      const res = await fnRef.current(...args);
      // Unwrap axios response → payload automatically
      const payload =
        res !== null && typeof res === "object" && "data" in res
          ? (res as { data: TResult }).data
          : (res as unknown as TResult);
      return payload;
    } catch (err) {
      const shape = toApiError(err);
      setError(shape);
      return null;
    } finally {
      setIsPending(false);
    }
  }, []);

  const reset = useCallback(() => setError(null), []);

  return { mutate, isPending, error, reset };
}
