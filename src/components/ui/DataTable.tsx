"use client";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./Button";
export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  render: (row: T) => React.ReactNode;
}
interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  searchableKeys?: (keyof T & string)[];
  searchPlaceholder?: string;
  pageSize?: number;
  mobileCard?: (row: T) => React.ReactNode;
}
function cellString<T>(row: T, key: string): string {
  const v = (row as Record<string, unknown>)[key];
  return String(v ?? "");
}
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  searchableKeys = [],
  searchPlaceholder = "Search…",
  pageSize = 8,
  mobileCard,
}: Props<T>) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = rows;
    if (q && searchableKeys.length)
      out = rows.filter((r) =>
        searchableKeys.some((k) => cellString(r, k).toLowerCase().includes(q))
      );
    if (sortKey)
      out = [...out].sort(
        (a, b) =>
          cellString(a, sortKey).localeCompare(cellString(b, sortKey), undefined, {
            numeric: true,
          }) * sortDir
      );
    return out;
  }, [rows, query, searchableKeys, sortKey, sortDir]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  function toggleSort(key: string) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir(1);
    } else setSortDir((d) => (d === 1 ? -1 : 1));
  }
  return (
    <div className="overflow-hidden rounded-card border border-surface-border bg-white">
      <div className="flex flex-col gap-3 border-b border-surface-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <input
          id="table-search"
          aria-label={searchPlaceholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder={searchPlaceholder}
          className="h-9 w-full rounded-md border border-surface-border bg-surface-muted px-3 text-sm outline-none placeholder:text-neutral-400 focus:border-brand-ink focus:bg-white sm:max-w-xs"
        />
        <p className="text-xs text-neutral-500" role="status">
          {filtered.length} results
        </p>
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-surface-muted/60 text-xs uppercase tracking-wide text-neutral-500">
              {columns.map((c) => (
                <th key={c.key} scope="col" className="px-5 py-3 font-medium">
                  {c.sortable ? (
                    <button
                      onClick={() => toggleSort(c.key)}
                      className="inline-flex items-center gap-1 hover:text-neutral-900"
                      aria-label={`Sort by ${c.header}`}
                    >
                      {c.header}
                      <span aria-hidden className="text-neutral-400">
                        {sortKey === c.key ? (sortDir === 1 ? "↑" : "↓") : "↕"}
                      </span>
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {pageRows.map((row) => (
              <tr key={rowKey(row)} className="transition-colors hover:bg-surface-muted/50">
                {columns.map((c) => (
                  <td key={c.key} className="px-5 py-3.5 text-neutral-800">
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-5 py-10 text-center text-sm text-neutral-500"
                >
                  No results found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="divide-y divide-neutral-100 md:hidden">
        {pageRows.map((row) =>
          mobileCard ? (
            <div key={rowKey(row)} className="px-4 py-3.5">
              {mobileCard(row)}
            </div>
          ) : null
        )}
        {pageRows.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-neutral-500">No results found.</p>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-surface-border px-4 py-3 sm:px-5">
        <p className="text-xs text-neutral-500">
          Page {safePage} of {totalPages}
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
