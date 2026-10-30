"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  Loader2,
  CalendarCheck2,
  Users,
  CreditCard,
  Building2,
  Bell,
  DoorOpen,
  ArrowRight,
  Command,
} from "lucide-react";
import { hostelGhar, unwrap } from "@/lib/hostelGhar";
import { cn } from "@/lib/utils";
import type { GlobalSearchResponse, SearchResultItem } from "@/lib/api-types";

function getCategoryIcon(category: string) {
  switch (category.toLowerCase()) {
    case "residents":
      return <Users className="h-4 w-4 text-blue-400" />;
    case "bookings":
      return <CalendarCheck2 className="h-4 w-4 text-emerald-400" />;
    case "payments":
      return <CreditCard className="h-4 w-4 text-[#C3FF7D]" />;
    case "hostels":
      return <Building2 className="h-4 w-4 text-amber-400" />;
    case "rooms":
      return <DoorOpen className="h-4 w-4 text-purple-400" />;
    case "users":
      return <Users className="h-4 w-4 text-indigo-400" />;
    case "notifications":
      return <Bell className="h-4 w-4 text-rose-400" />;
    default:
      return <Search className="h-4 w-4 text-neutral-400" />;
  }
}

function highlightMatch(text: string, query: string) {
  if (!query.trim()) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="rounded bg-[#C3FF7D]/25 px-0.5 font-bold text-[#C3FF7D]">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

export function GlobalSearch({
  className,
  mobile = false,
  onClose,
}: {
  className?: string;
  mobile?: boolean;
  onClose?: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [categories, setCategories] = useState<Record<string, number>>({});
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activeReqIdRef = useRef<number>(0);

  // ──────────────────────────────────────────────────────────────────────────
  // Search API Call with cancellation & debouncing (300ms)
  // ──────────────────────────────────────────────────────────────────────────
  const executeSearch = useCallback(async (q: string, category: string) => {
    if (!q.trim()) {
      setResults([]);
      setCategories({});
      setIsLoading(false);
      setError(null);
      return;
    }

    const currentReqId = ++activeReqIdRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const res = await hostelGhar.search.query(q.trim(), category, 20);
      // Ignore outdated responses
      if (currentReqId !== activeReqIdRef.current) return;

      const data = unwrap<GlobalSearchResponse>(res.data);
      if (data && Array.isArray(data.results)) {
        setResults(data.results);
        setCategories(data.categories || {});
      } else {
        setResults([]);
        setCategories({});
      }
    } catch {
      if (currentReqId === activeReqIdRef.current) {
        setError("Failed to fetch search results. Please try again.");
        setResults([]);
      }
    } finally {
      if (currentReqId === activeReqIdRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value;
    setQuery(nextVal);
    setSelectedIndex(-1);
    setIsOpen(true);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      executeSearch(nextVal, selectedCategory);
    }, 300);
  };

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    setSelectedIndex(-1);
    executeSearch(query, cat);
  };

  // Keyboard navigation (ArrowDown, ArrowUp, Enter, Escape)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && results[selectedIndex]) {
        handleSelectResult(results[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      if (onClose) onClose();
    }
  };

  const handleSelectResult = (item: SearchResultItem) => {
    setIsOpen(false);
    if (onClose) onClose();
    if (item.url) {
      router.push(item.url);
    }
  };

  // Global hotkey Cmd/Ctrl + K to focus search
  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    }
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {/* Search Input Box */}
      <div className="relative flex items-center">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search bookings, residents, rooms..."
          aria-label="Global search across all dashboard records"
          className="h-10 w-full rounded-lg border border-neutral-200 bg-neutral-50/80 pl-10 pr-16 text-sm text-neutral-900 outline-none transition-all placeholder:text-neutral-400 focus:border-brand-ink focus:bg-white focus:ring-2 focus:ring-brand-ink/10"
        />

        <div className="absolute right-2.5 flex items-center gap-1.5">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
          ) : query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setResults([]);
                setIsOpen(false);
                inputRef.current?.focus();
              }}
              aria-label="Clear search query"
              className="rounded p-1 text-neutral-400 hover:text-neutral-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : !mobile ? (
            <span className="hidden items-center gap-0.5 rounded border border-neutral-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-neutral-400 lg:inline-flex">
              <Command className="h-3 w-3" />K
            </span>
          ) : null}
        </div>
      </div>

      {/* Search Results Dropdown */}
      {isOpen && query.trim() !== "" && (
        <div
          className={cn(
            "absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-neutral-800 bg-[#0A0A0A] text-white shadow-2xl ring-1 ring-white/10",
            mobile ? "w-full" : "min-w-[360px] max-w-[560px]"
          )}
        >
          {/* Category Filter Pills */}
          <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto border-b border-neutral-800/80 bg-[#0d0d0d] p-2">
            <button
              type="button"
              onClick={() => handleCategoryChange("all")}
              className={cn(
                "whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
                selectedCategory === "all"
                  ? "bg-white/10 text-[#C3FF7D]"
                  : "text-neutral-400 hover:bg-white/5 hover:text-white"
              )}
            >
              All ({results.length})
            </button>
            {Object.entries(categories).map(([cat, count]) => (
              <button
                key={cat}
                type="button"
                onClick={() => handleCategoryChange(cat)}
                className={cn(
                  "whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold capitalize transition-colors",
                  selectedCategory === cat
                    ? "bg-white/10 text-[#C3FF7D]"
                    : "text-neutral-400 hover:bg-white/5 hover:text-white"
                )}
              >
                {cat} ({count})
              </button>
            ))}
          </div>

          {/* Results List */}
          <div className="max-h-[360px] divide-y divide-neutral-800/40 overflow-y-auto p-1">
            {isLoading && results.length === 0 ? (
              <div className="space-y-3 p-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex animate-pulse gap-3">
                    <div className="h-8 w-8 shrink-0 rounded-lg bg-neutral-800" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-1/3 rounded bg-neutral-800" />
                      <div className="h-2.5 w-1/2 rounded bg-neutral-800" />
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="p-6 text-center text-xs text-rose-400">{error}</div>
            ) : results.length === 0 ? (
              <div className="p-8 text-center">
                <Search className="mx-auto mb-2 h-7 w-7 text-neutral-600" />
                <p className="text-sm font-semibold text-neutral-300">No results found</p>
                <p className="mt-1 text-xs text-neutral-500">
                  No matching records for &quot;{query}&quot;. Try a different search term.
                </p>
              </div>
            ) : (
              results.map((item, index) => {
                const isSelected = index === selectedIndex;
                const icon = getCategoryIcon(item.category);

                return (
                  <div
                    key={`${item.category}-${item.id}`}
                    onClick={() => handleSelectResult(item)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={cn(
                      "group flex cursor-pointer items-center justify-between gap-3 rounded-lg p-2.5 transition-colors",
                      isSelected
                        ? "bg-white/10 text-white"
                        : "text-neutral-200 hover:bg-neutral-900"
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900">
                        {icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-xs font-semibold leading-tight">
                            {highlightMatch(item.title, query)}
                          </p>
                          {item.badge && (
                            <span className="shrink-0 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-neutral-300">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-neutral-400">
                          {highlightMatch(item.subtitle, query)}
                        </p>
                      </div>
                    </div>

                    <ArrowRight
                      className={cn(
                        "h-4 w-4 shrink-0 transition-transform",
                        isSelected
                          ? "translate-x-0.5 text-[#C3FF7D]"
                          : "text-neutral-600 group-hover:text-neutral-300"
                      )}
                    />
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Guide */}
          <div className="flex items-center justify-between border-t border-neutral-800/80 bg-neutral-900/40 px-3 py-2 text-[10px] text-neutral-500">
            <span>Navigation: ↑ ↓ arrows • ↵ Enter to open</span>
            <span>Esc to close</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default GlobalSearch;
