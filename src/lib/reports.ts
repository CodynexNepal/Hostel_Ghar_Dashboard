import type { Expense, Fee } from "./api-types";
import type { Room } from "@/types/hostel";
import type { Resident } from "@/types/resident";

/**
 * Owner Reports — live-only, client-side CSV.
 * No live `/reports` router exists (only an unwired ReportRepository +
 * report-export util), and the future `GET /reports/*` contract 404s.
 * Reuse LIVE owner endpoints (summary + dashboard + rooms + residents +
 * fee ledger + expenses). Column shapes mirror the proposed contract.
 */

export type ReportKind = "occupancy" | "revenue" | "defaulters" | "directory" | "expenses";

export const REPORT_META: Record<ReportKind, { title: string; desc: string; file: string }> = {
  occupancy: { title: "Occupancy report", desc: "Room-wise bed usage", file: "occupancy-report" },
  revenue: {
    title: "Revenue report",
    desc: "Collections by billing month",
    file: "revenue-report",
  },
  defaulters: { title: "Defaulter list", desc: "Pending + overdue dues", file: "defaulter-list" },
  directory: {
    title: "Resident directory",
    desc: "Profiles with room mapping",
    file: "resident-directory",
  },
  expenses: { title: "Expense report", desc: "Hostel costs by category", file: "expense-report" },
};

export function escapeCsvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toReportCsv(headers: string[], rows: unknown[][]): string {
  const line = (cells: unknown[]) => cells.map(escapeCsvCell).join(",");
  return `﻿${[line(headers), ...rows.map(line)].join("\r\n")}`;
}

export function safeFileSegment(v?: string | null): string {
  const s = String(v ?? "report")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  const t = s.replace(/^-+|-+$/g, "");
  return t || "report";
}

export function downloadReportCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 800);
}

function num(v: unknown): number {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? (n as number) : 0;
}

function billed(f: Fee): number {
  for (const c of [f.totalPayable, f.dueAmount, f.amount, f.paidAmount]) {
    const n = num(c);
    if (n > 0) return n;
  }
  return 0;
}

function collected(f: Fee): number {
  const p = num(f.paidAmount);
  if (p > 0) {
    const b = billed(f);
    return b > 0 ? Math.min(p, b) : p;
  }
  if (String(f.status ?? "").toUpperCase() === "PAID") return billed(f);
  return 0;
}

function period(f: Fee): string {
  const m = num(f.billingMonth);
  const y = num(f.billingYear);
  if (m >= 1 && m <= 12 && y > 0) return `${y}-${String(m).padStart(2, "0")}`;
  const d = f.dueDate ?? f.createdAt ?? f.paidAt ?? "";
  if (typeof d === "string" && /^\d{4}-\d{2}/.test(d)) return d.slice(0, 7);
  return "";
}
/** rooms: hostel roomNumber floor flat type capacity occupied status */
export function buildOccupancyCsv(
  rooms: Room[],
  residents: Resident[],
  hostel?: string | null
): string {
  const rows = rooms.map((room) => [
    hostel ?? "",
    room.roomNumber ?? "",
    room.floor ?? "",
    room.floor ?? "",
    room.type ?? "",
    room.capacity ?? 0,
    occupiedOf(room, residents),
    room.status ?? "",
  ]);
  return toReportCsv(
    ["hostel", "roomNumber", "floor", "flat", "type", "capacity", "occupied", "status"],
    rows.length > 0 ? rows : [emptyRow(8)]
  );
}

/** fees: resident hostel period totalPayable paidAmount outstanding status dueDate */
export function buildRevenueCsv(fees: Fee[], hostel?: string | null): string {
  const rows = fees.map((f) => {
    const b = billed(f);
    const c = collected(f);
    return [
      f.residentName ?? "",
      String(f.hostelId ?? hostel ?? ""),
      period(f),
      b,
      c,
      Math.max(0, b - c),
      String(f.status ?? ""),
      f.dueDate ?? "",
    ];
  });
  return toReportCsv(
    [
      "resident",
      "hostel",
      "period",
      "totalPayable",
      "paidAmount",
      "outstanding",
      "status",
      "dueDate",
    ],
    rows.length > 0 ? rows : [emptyRow(8)]
  );
}

/** Defaulters: outstanding PENDING / OVERDUE / PARTIAL rows, dueDate ASC. */
export function buildDefaultersCsv(fees: Fee[], hostel?: string | null): string {
  const rows = fees
    .filter(
      (f) =>
        ["PENDING", "OVERDUE", "PARTIAL", "PARTIALLY_PAID"].includes(
          String(f.status ?? "").toUpperCase()
        ) && billed(f) - collected(f) > 0
    )
    .sort((a, b) => String(a.dueDate ?? "").localeCompare(String(b.dueDate ?? "")))
    .map((f) => {
      const b = billed(f);
      const c = collected(f);
      return [
        f.residentName ?? "",
        String(f.hostelId ?? hostel ?? ""),
        period(f),
        b,
        c,
        Math.max(0, b - c),
        String(f.status ?? ""),
        f.dueDate ?? "",
      ];
    });
  return toReportCsv(
    [
      "resident",
      "hostel",
      "period",
      "totalPayable",
      "paidAmount",
      "outstanding",
      "status",
      "dueDate",
    ],
    rows.length > 0 ? rows : [emptyRow(8)]
  );
}

/** residents: name email phone hostel room bed rent joinedAt */
export function buildDirectoryCsv(residents: Resident[], hostel?: string | null): string {
  const rows = residents.map((r) => [
    r.name ?? "",
    r.email ?? "",
    r.phone ?? "",
    hostel ?? "",
    r.roomNumber ?? "",
    r.bedNumber ?? "",
    num((r as { monthlyRent?: unknown }).monthlyRent),
    String((r as { joinedDate?: unknown }).joinedDate ?? ""),
  ]);
  return toReportCsv(
    ["name", "email", "phone", "hostel", "room", "bed", "rent", "joinedAt"],
    rows.length > 0 ? rows : [emptyRow(8)]
  );
}

/** expenses: title hostel category amount status date */
export function buildExpensesCsv(expenses: Expense[], hostel?: string | null): string {
  const rows = expenses.map((e) => [
    e.title ?? "",
    hostel ?? "",
    e.category ?? "",
    num(e.amount),
    String(e.status ?? ""),
    e.expenseDate ?? e.date ?? e.createdAt ?? "",
  ]);
  return toReportCsv(
    ["title", "hostel", "category", "amount", "status", "date"],
    rows.length > 0 ? rows : [emptyRow(6)]
  );
}

function occupiedOf(room: Room, residents: Resident[]): number {
  if (typeof room.occupied === "number" && room.occupied > 0) return room.occupied;
  const key = String(room.roomNumber ?? "")
    .trim()
    .toLowerCase();
  return residents.filter(
    (r) =>
      String(r.roomNumber ?? "")
        .trim()
        .toLowerCase() === key
  ).length;
}

function emptyRow(n: number): string[] {
  return Array.from({ length: n }, () => "");
}
