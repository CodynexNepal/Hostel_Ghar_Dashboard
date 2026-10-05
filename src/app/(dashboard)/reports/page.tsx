"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Protected } from "@/components/common/Protected";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { Download, FileText, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/useToast";
import { useAuth } from "@/hooks/useAuth";
import {
  hostelGhar,
  normalizeExpenseList,
  normalizeResident,
  normalizeRoom,
  resolveOwnerHostelId,
  toApiError,
  toPaginated,
  unwrap,
  validHostelId,
} from "@/lib/hostelGhar";
import {
  REPORT_META,
  buildDefaultersCsv,
  buildDirectoryCsv,
  buildExpensesCsv,
  buildOccupancyCsv,
  buildRevenueCsv,
  downloadReportCsv,
  safeFileSegment,
  type ReportKind,
} from "@/lib/reports";
import type { Expense, Fee, HostelDetail } from "@/lib/api-types";
import type { Room } from "@/types/hostel";
import type { Resident } from "@/types/resident";

interface ReportCard {
  kind: ReportKind;
  count: number;
  build: () => string;
}

export default function ReportsPage() {
  const { success, error: toastError } = useToast();
  const { user } = useAuth();
  const [hostelId, setHostelId] = useState<string | null>(null);
  const [hostelName, setHostelName] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const hid = await resolveOwnerHostelId(user?.hostelId);
      setHostelId(hid);
      const uuid = validHostelId(hid);
      let name = user?.hostelName ?? null;
      let nextRooms: Room[] = [];
      let nextResidents: Resident[] = [];
      let nextFees: Fee[] = [];
      let nextExpenses: Expense[] = [];
      if (uuid) {
        try {
          const detail = unwrap<HostelDetail>((await hostelGhar.hostels.get(uuid)).data);
          if (detail?.name) name = detail.name;
        } catch {
          /* keep session hostel name */
        }
        try {
          const res = await hostelGhar.rooms.list({ limit: 200, hostelId: uuid });
          nextRooms = toPaginated<unknown>(res.data).items.map(normalizeRoom);
        } catch {
          nextRooms = [];
        }
        try {
          const res = await hostelGhar.owner.residents({ hostelId: uuid, limit: 500 });
          nextResidents = toPaginated<unknown>(unwrap<unknown>(res.data)).items.map(
            normalizeResident
          );
        } catch {
          nextResidents = [];
        }
        if (nextResidents.length === 0) {
          try {
            const res = await hostelGhar.hostels.residents(uuid);
            nextResidents = toPaginated<unknown>(unwrap<unknown>(res.data)).items.map(
              normalizeResident
            );
          } catch {
            /* keep empty */
          }
        }
        try {
          const res = await hostelGhar.fees.hostelFees(uuid, { limit: 500 });
          nextFees = toPaginated<Fee>(res.data).items;
        } catch {
          nextFees = [];
        }
        try {
          const res = await hostelGhar.expenses.list({ hostelId: uuid, limit: 500 });
          nextExpenses = normalizeExpenseList(res.data);
        } catch {
          nextExpenses = [];
        }
      }
      setRooms(nextRooms);
      setResidents(nextResidents);
      setFees(nextFees);
      setExpenses(nextExpenses);
      setHostelName(name);
    } catch (e) {
      setLoadError(toApiError(e).message);
    } finally {
      setIsLoading(false);
    }
  }, [user?.hostelId, user?.hostelName]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);
  const defaulterCount = useMemo(
    () =>
      fees.filter((f) =>
        ["PENDING", "OVERDUE", "PARTIAL", "PARTIALLY_PAID"].includes(
          String(f.status ?? "").toUpperCase()
        )
      ).length,
    [fees]
  );

  const cards: ReportCard[] = useMemo(
    () => [
      {
        kind: "occupancy",
        count: rooms.length,
        build: () => buildOccupancyCsv(rooms, residents, hostelName),
      },
      { kind: "revenue", count: fees.length, build: () => buildRevenueCsv(fees, hostelName) },
      {
        kind: "defaulters",
        count: defaulterCount,
        build: () => buildDefaultersCsv(fees, hostelName),
      },
      {
        kind: "directory",
        count: residents.length,
        build: () => buildDirectoryCsv(residents, hostelName),
      },
      {
        kind: "expenses",
        count: expenses.length,
        build: () => buildExpensesCsv(expenses, hostelName),
      },
    ],
    [rooms, residents, fees, expenses, hostelName, defaulterCount]
  );

  function generate(card: ReportCard) {
    try {
      const meta = REPORT_META[card.kind];
      const stamp = new Date().toISOString().slice(0, 10);
      downloadReportCsv(`${meta.file}-${safeFileSegment(hostelName)}-${stamp}`, card.build());
      success("Report downloaded", `${meta.title} · CSV`);
    } catch (e) {
      toastError("Couldn't generate report", toApiError(e).message);
    }
  }

  return (
    <DashboardShell title="Reports" subtitle="Hostel Ghar / Reports — occupancy, revenue and dues.">
      <Protected permission="VIEW_REPORTS" redirectTo="/dashboard">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-neutral-500">
            {isLoading
              ? "Loading live data…"
              : `${rooms.length} rooms · ${residents.length} residents · ${fees.length} fee rows · ${expenses.length} expenses`}
          </p>
          <div className="flex items-center gap-2">
            <Badge tone="gray">CSV · browser export</Badge>
            <Button variant="outline" size="sm" onClick={() => load()} loading={isLoading}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </div>
        </div>
        {loadError && (
          <div className="mt-4">
            <ErrorState
              title="Couldn't load report data"
              description={loadError}
              onRetry={() => load()}
            />
          </div>
        )}
        {!isLoading && !loadError && !hostelId && (
          <div className="mt-4">
            <EmptyState
              icon="alert"
              title="No hostel linked"
              description="Link your account to a hostel to build reports from live data."
              action={<Button onClick={() => load()}>Try again</Button>}
            />
          </div>
        )}
        {isLoading && (
          <div className="mt-4">
            <TableSkeleton rows={5} />
          </div>
        )}
        {!isLoading && !loadError && hostelId && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {cards.map((card) => {
              const meta = REPORT_META[card.kind];
              return (
                <Card key={card.kind}>
                  <div className="flex items-start gap-3 p-5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand">
                      <FileText className="h-5 w-5 text-brand-ink" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-[15px] font-semibold">
                        {meta.title}
                        <Badge tone="gray">CSV</Badge>
                      </span>
                      <span className="mt-0.5 block text-[13px] text-neutral-500">{meta.desc}</span>
                    </span>
                    <Badge tone={card.count > 0 ? "green" : "gray"}>{card.count} rows</Badge>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-surface-border px-5 py-3">
                    <span className="text-xs text-neutral-400">Live endpoints · client-side</span>
                    <Button size="sm" disabled={card.count === 0} onClick={() => generate(card)}>
                      <Download className="h-3.5 w-3.5" /> Download CSV
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Protected>
    </DashboardShell>
  );
}
