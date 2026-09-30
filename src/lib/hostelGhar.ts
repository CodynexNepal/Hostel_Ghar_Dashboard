import api, { toApiError, type ApiErrorShape } from "./axios";
import type { ApiEnvelope, PaginationMeta, Paginated, ListParams } from "./api-types";
import type {
  LoginPayload,
  LoginResponse,
  RegisterPayload,
  RegisterResponse,
  CreateFacilityPayload,
  HostelFacilitySyncItem,
  UpsertHostelFacilityPayload,
  Facility as HostelFacility,
  CreateHostelPayload,
  CreateOwnerPayload,
  CreateResidentPayload,
  CreateLeaveTypePayload,
  CreateRoomPayload,
  Bed,
  CreateBedPayload,
  GenerateFeesPayload,
  GenerateFeesResult,
  OwnerFlatOption,
  OwnerHostelOption,
  OwnerResidentsParams,
  OwnerRoomOption,
  UpdateFacilityPayload,
  UpdateRoomPayload,
  RoomListParams,
  CreateBookingPayload,
  ApplyLeavePayload,
  RecordPaymentPayload,
  Booking,
  Fee,
  Expense,
  CreateExpensePayload,
  UpdateExpensePayload,
  ExpenseListParams,
  ExpensePagination,
  LeaveRequest,
  LeaveType,
  HostelDetail,
  ResidentDetail,
  ResidentImport,
  ResidentImportPlanLimits,
  OwnerDashboard,
  OwnerDashboardHostel,
  RevenueTrendPoint,
  FloorOverviewItem,
  RoomMixItem,
  AdminSummary,
  OwnerSummary,
  Owner,
  PaymentQr,
  PaymentQrListParams,
  LoadDemoQrPayload,
  CreatePaymentQrPayload,
  UpdatePaymentQrPayload,
  PatchPaymentQrPayload,
} from "./api-types";
import type { Hostel, Room } from "../types/hostel";
import type { Resident } from "../types/resident";

const PREFIX = "/v1/hostel-ghar";

/** Unwrap `{ data }` envelope or return raw payload. */
export function unwrap<T>(payload: unknown): T {
  if (payload !== null && typeof payload === "object" && "data" in payload) {
    return (payload as ApiEnvelope<T>).data as T;
  }
  return payload as T;
}

export function unwrapMeta(payload: unknown): PaginationMeta | null {
  if (payload !== null && typeof payload === "object" && "meta" in payload) {
    return (payload as ApiEnvelope<unknown>).meta ?? null;
  }
  if (payload !== null && typeof payload === "object" && "pagination" in payload) {
    const p = (payload as { pagination?: Record<string, unknown> }).pagination;
    if (!p) return null;
    return {
      page: Number(p.currentPage ?? p.page ?? 1),
      limit: Number(p.itemsPerPage ?? p.limit ?? 0),
      total: Number(p.totalItems ?? p.total ?? 0),
      totalPages: Number(p.totalPages ?? 1),
      hasNextPage: Boolean(p.hasNextPage),
      hasPrevPage: Boolean(p.hasPrevPage),
    };
  }
  return null;
}

export function toPaginated<T>(payload: unknown): Paginated<T> {
  if (payload === undefined || payload === null || payload === "") {
    // Axios on HTTP 304 returns the cached body — which for a conditional
    // request is EMPTY by design. Never treat that as "no data" silently;
    // return [] and let callers bypass the cache (see noCacheParams).
    return { items: [], meta: null };
  }
  if (Array.isArray(payload)) return { items: payload, meta: null };
  const root = payload as ApiEnvelope<T[] | { data?: T[]; residents?: T[] }> & {
    residents?: T[];
    fees?: T[];
    leaveTypes?: T[];
    leave_types?: T[];
    items?: T[];
    results?: T[];
  };
  const meta = unwrapMeta(payload);
  let items: T[] = [];
  if (Array.isArray(root?.data)) items = root.data as T[];
  else if (root?.data && typeof root.data === "object") {
    const nested = root.data as {
      data?: unknown;
      residents?: unknown;
      fees?: unknown;
      leaveTypes?: unknown;
      leave_types?: unknown;
      items?: unknown;
      results?: unknown;
    };
    if (Array.isArray(nested.data)) items = nested.data as T[];
    else if (Array.isArray(nested.residents)) items = nested.residents as T[];
    else if (Array.isArray(nested.fees)) items = nested.fees as T[];
    else if (Array.isArray(nested.leaveTypes)) items = nested.leaveTypes as T[];
    else if (Array.isArray(nested.leave_types)) items = nested.leave_types as T[];
    else if (Array.isArray(nested.items)) items = nested.items as T[];
    else if (Array.isArray(nested.results)) items = nested.results as T[];
  }
  if (items.length === 0 && Array.isArray(root?.residents)) items = root.residents;
  if (items.length === 0 && Array.isArray(root?.fees)) items = root.fees;
  if (items.length === 0 && Array.isArray(root?.leaveTypes)) items = root.leaveTypes;
  if (items.length === 0 && Array.isArray(root?.leave_types)) items = root.leave_types;
  if (items.length === 0 && Array.isArray(root?.items)) items = root.items;
  if (items.length === 0 && Array.isArray(root?.results)) items = root.results;
  return { items, meta };
}

/**
 * Cache-buster for idempotent GETs whose backend sends ETag/304.
 * A 304 response has NO body — axios then resolves with an empty payload and
 * the UI would wrongly render "no data". Merging `_t=Date.now()` forces a
 * fresh 200 with a real body. Only use on safe GET list endpoints.
 */
export function noCacheParams<T extends ListParams | undefined>(params?: T): ListParams {
  return { ...(params ?? {}), _t: Date.now() };
}

async function getWithRetry<T>(url: string, params?: ListParams) {
  try {
    return await api.get<T>(url, { params });
  } catch (err) {
    const shape = toApiError(err);
    if (shape.status === 0 || shape.status >= 500) {
      await new Promise((r) => setTimeout(r, 600));
      return await api.get<T>(url, { params });
    }
    throw err;
  }
}

function idemHeaders(key?: string) {
  return key ? { "Idempotency-Key": key } : undefined;
}

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Backend mount for `paymentQrRouter` (override via NEXT_PUBLIC_PAYMENT_QR_PATH). */
export function paymentQrBasePath(): string {
  if (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_PAYMENT_QR_PATH) {
    return process.env.NEXT_PUBLIC_PAYMENT_QR_PATH as string;
  }
  return `${PREFIX}/payment-qrs`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Return the id only when it is a real backend UUID.
 * The `"default"` sentinel (localStorage-only fallback) and any other
 * non-UUID junk must NEVER be sent — the backend parses `hostelId` as a
 * Postgres uuid (`resolveAndAuthorizeHostel`) and throws
 * `invalid input syntax for type uuid: "default"`.
 * When this returns `undefined`, callers omit `hostelId` and the backend
 * resolves the hostel from auth context / the `X-Hostel-Id` cookie header
 * (axios already sends `hg_hostel_id` as `X-Hostel-Id` on every request).
 */
export function validHostelId(id?: string | null): string | undefined {
  const v = String(id ?? "").trim();
  if (!v || v.toLowerCase() === "default") return undefined;
  if (!UUID_RE.test(v)) return undefined;
  return v;
}

/** Strip an invalid/non-UUID `hostelId` from list query params (keeps other filters). */
function cleanHostelParams<T extends Record<string, unknown> | undefined>(
  params?: T
): Record<string, unknown> | undefined {
  if (!params || typeof params !== "object") return undefined;
  const hid = validHostelId((params as { hostelId?: string }).hostelId);
  if (hid) return { ...(params as object), hostelId: hid };
  const { hostelId: _omit, ...rest } = params as Record<string, unknown>;
  void _omit;
  return Object.keys(rest).length > 0 ? rest : undefined;
}

/**
 * Map frontend BANK → backend BANK_TRANSFER enum.
 * Backend `paymentMethod` only accepts: ESEWA | KHALTI | BANK_TRANSFER.
 */
export function toBackendPaymentMethod(raw: unknown): string {
  const v = String(raw ?? "")
    .toUpperCase()
    .trim();
  if (v.includes("BANK")) return "BANK_TRANSFER";
  if (v.includes("KHALTI")) return "KHALTI";
  if (v.includes("ESEWA")) return "ESEWA";
  return v;
}

/**
 * Split a combined label ("Nabil Bank • A/C: 0120…" / "eSewa ID: 9841…")
 * into backend `accountName` + `accountIdentifier`.
 */
export function splitAccountLabel(
  label: string,
  fallbackName = ""
): { accountName: string; accountIdentifier: string } {
  const text = String(label ?? "").trim();
  if (!text) return { accountName: fallbackName, accountIdentifier: "" };
  // Prefer explicit "A/C[: ]xxxx" / "ID[: ]xxxx" suffix as the identifier.
  const idMatch = text.match(
    /(?:A\/C|ID|ID No|Acc(?:ount)?(?: No| Number)?)\s*[:#-]?\s*([A-Za-z0-9+_./@ -]{3,})\s*$/i
  );
  if (idMatch?.[1]) {
    const identifier = idMatch[1]
      .trim()
      .replace(/[•·|]+.*$/, "")
      .trim();
    const name = text
      .slice(0, idMatch.index)
      .replace(/[•·|:,\-–—\s]+$/, "")
      .trim();
    return { accountName: name || fallbackName, accountIdentifier: identifier };
  }
  const parts = text
    .split(/[•·|]/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    const identifier = parts[parts.length - 1].replace(/^(A\/C|ID)\s*[:#-]?\s*/i, "").trim();
    const name = parts.slice(0, -1).join(" • ").trim();
    if (identifier) return { accountName: name || fallbackName, accountIdentifier: identifier };
  }
  // Bare phone / account digits → identifier; fallback name covers accountName.
  if (/^[+\d][\d\s\-/]{5,}$/.test(text)) {
    return { accountName: fallbackName, accountIdentifier: text };
  }
  return { accountName: text, accountIdentifier: "" };
}

/**
 * Build POST/PUT/PATCH body for payment-QR endpoints.
 * Sends ONLY backend-accepted fields:
 *   paymentMethod, accountName, accountIdentifier, qrCodeUrl (+ hostelId/isActive/status where set).
 * - `method`/`tag`/`provider` (+ BANK) → `paymentMethod` (BANK → BANK_TRANSFER).
 * - `label`/`accountLabel` → split into accountName/accountIdentifier.
 * - With `payload.file` → multipart FormData (file field `qrCode`); else JSON.
 */
export function toPaymentQrForm(
  payload: CreatePaymentQrPayload | UpdatePaymentQrPayload | PatchPaymentQrPayload,
  opts?: { hostelName?: string }
): FormData | Record<string, unknown> {
  const p = payload as CreatePaymentQrPayload & {
    file?: File | null;
    qrCode?: File | null;
    image?: File | null;
    qr?: File | null;
  };
  // Canonical enum first; legacy method/tag/provider mapped (BANK → BANK_TRANSFER).
  const paymentMethod = toBackendPaymentMethod(
    p.paymentMethod ?? p.method ?? p.tag ?? p.provider ?? ""
  );
  // accountName/accountIdentifier win; otherwise split combined label text.
  const combinedLabel = String(p.accountLabel ?? p.label ?? p.accountNumber ?? "").trim();
  const split = splitAccountLabel(combinedLabel, opts?.hostelName ?? "");
  const accountName = String(p.accountName ?? split.accountName ?? "").trim();
  const accountIdentifier = String(
    p.accountIdentifier ?? p.accountNumber ?? split.accountIdentifier ?? ""
  ).trim();
  const qrCodeUrl = String(p.qrCodeUrl ?? p.imageUrl ?? "").trim();
  const body: Record<string, unknown> = {};
  if (paymentMethod) body.paymentMethod = paymentMethod;
  if (accountName) body.accountName = accountName;
  if (accountIdentifier) body.accountIdentifier = accountIdentifier;
  if (qrCodeUrl) body.qrCodeUrl = qrCodeUrl;
  // Pass through only known-good extras (never method/tag/label).
  // hostelId must be a real UUID — "default"/junk is dropped so the backend
  // resolves the hostel from auth / X-Hostel-Id instead of 500ing on uuid parse.
  {
    const hid = validHostelId((p as Record<string, unknown>).hostelId as string | null | undefined);
    if (hid) body.hostelId = hid;
  }
  for (const k of ["isActive", "status"] as const) {
    const v = (p as Record<string, unknown>)[k];
    if (v !== undefined && v !== null && v !== "") body[k] = v;
  }
  if (!(p.file instanceof File)) return body;
  const form = new FormData();
  // `uploadPaymentQr` + `stripFileFields('qrCode','image','file','qr')` accept any
  // of these keys — send all aliases so the backend picks whichever it reads.
  for (const key of ["qrCode", "file", "image", "qr"] as const) {
    form.append(key, p.file, p.file.name);
  }
  for (const [k, v] of Object.entries(body)) {
    form.append(k, typeof v === "string" ? v : String(v));
  }
  return form;
}

/** Normalize one backend payment-QR record (canonical + legacy field variants). */
export function normalizePaymentQr(raw: unknown): PaymentQr {
  const r = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown): string => (typeof v === "string" ? v : String(v ?? ""));
  const pick = (...keys: string[]): unknown => {
    for (const k of keys) {
      const v = r[k];
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return undefined;
  };
  const paymentMethod =
    str(pick("paymentMethod", "payment_method", "method", "tag", "provider") || "") || undefined;
  const accountName = str(pick("accountName", "account_name") || "") || undefined;
  const accountIdentifier =
    str(pick("accountIdentifier", "account_identifier", "accountNumber") || "") || undefined;
  // Rebuild a display label for the UI from canonical parts (fall back to legacy label).
  const legacyLabel = str(pick("label", "accountLabel") || "");
  const label =
    legacyLabel ||
    [accountName, accountIdentifier]
      .filter(Boolean)
      .join(accountName && accountIdentifier ? " • " : "") ||
    undefined;
  return {
    ...(r as PaymentQr),
    id: str(pick("id", "_id", "qrId") || `qr-${Date.now()}`),
    paymentMethod,
    accountName,
    accountIdentifier,
    method: paymentMethod as PaymentQr["method"],
    label,
    qrCodeUrl:
      str(
        pick("qrCodeUrl", "qrCodeURL", "qr_code_url", "imageUrl", "qrUrl", "image", "qr", "url") ||
          ""
      ) || undefined,
  };
}

/** Normalize list payloads: `{ data: [...] }`, `{ qrs: [...] }`, raw arrays. */
export function normalizePaymentQrList(payload: unknown): PaymentQr[] {
  const root = (payload ?? {}) as Record<string, unknown> & {
    data?: unknown;
    qrs?: unknown;
    paymentQrs?: unknown;
    items?: unknown;
    results?: unknown;
  };
  const candidates = [
    payload,
    root.data,
    root.qrs,
    root.paymentQrs,
    root.items,
    root.results,
    (root.data as Record<string, unknown> | undefined)?.data,
    (root.data as Record<string, unknown> | undefined)?.qrs,
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) return c.map(normalizePaymentQr);
  }
  return [];
}

/** Normalize backend room shapes (snake/camel/_id variants) into the UI `Room`. */
export function normalizeRoom(raw: unknown): Room {
  const r = (raw ?? {}) as Record<string, unknown>;
  const pick = (...keys: string[]): unknown => {
    for (const k of keys) {
      const v = r[k];
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return undefined;
  };
  const num = (v: unknown, fallback = 0): number => {
    const n = typeof v === "string" ? Number(v) : (v as number);
    return Number.isFinite(n) ? n : fallback;
  };
  const str = (v: unknown): string => (typeof v === "string" ? v : String(v ?? ""));
  const capacity = num(pick("capacity", "totalBeds", "beds"), 1);
  const occupied = num(pick("occupied", "occupiedBeds", "filledBeds"), 0);
  const statusRaw = String(pick("status", "roomStatus") ?? "AVAILABLE").toUpperCase();
  const status = (["AVAILABLE", "OCCUPIED", "FULL", "MAINTENANCE"] as const).includes(
    statusRaw as Room["status"]
  )
    ? (statusRaw as Room["status"])
    : occupied >= capacity
      ? "FULL"
      : "AVAILABLE";
  const amenitiesRaw = pick("amenities", "facilities");
  const amenities = Array.isArray(amenitiesRaw)
    ? amenitiesRaw.map(String)
    : typeof amenitiesRaw === "string"
      ? amenitiesRaw
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean)
      : [];
  return {
    id: str(pick("id", "_id", "roomId", `rm-${Date.now()}`)),
    roomNumber: str(pick("roomNumber", "room_number", "number", "name")),
    floor: num(pick("floor", "floorNumber"), 0),
    type: (["SINGLE", "DOUBLE", "TRIPLE", "DORM"] as const).includes(
      String(pick("type", "roomType") ?? "DOUBLE").toUpperCase() as Room["type"]
    )
      ? (String(pick("type", "roomType")).toUpperCase() as Room["type"])
      : "DOUBLE",
    capacity,
    occupied,
    monthlyRent: num(pick("monthlyRent", "rent", "monthly_rent", "price"), 0),
    status,
    amenities,
    imageUrl: (pick("imageUrl", "image", "photoUrl", "roomImageUrl") as string | undefined) ?? null,
  };
}

/** Normalize backend resident shapes (snake/camel/_id/nested-room variants) into the UI `Resident`. */
export function normalizeResident(raw: unknown): Resident {
  const r = (raw ?? {}) as Record<string, unknown>;
  const pick = (...keys: string[]): unknown => {
    for (const k of keys) {
      const v = r[k];
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return undefined;
  };
  const roomObj = (pick("room", "roomDetails") ?? {}) as Record<string, unknown>;
  const pickRoom = (...keys: string[]): unknown => {
    for (const k of keys) {
      const v = roomObj[k];
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return pick(...keys);
  };
  const num = (v: unknown, fallback = 0): number => {
    const n = typeof v === "string" ? Number(v) : (v as number);
    return Number.isFinite(n) ? n : fallback;
  };
  const str = (v: unknown): string => (typeof v === "string" ? v : String(v ?? ""));
  // Name: prefer display fields, then first+last composition, then nested user.
  const userObj = (pick("user", "resident") ?? {}) as Record<string, unknown>;
  const firstName = str(pick("firstName", "first_name") ?? userObj.firstName ?? userObj.first_name);
  const lastName = str(pick("lastName", "last_name") ?? userObj.lastName ?? userObj.last_name);
  const composed = `${firstName} ${lastName}`.trim();
  const name =
    str(pick("name", "fullName", "full_name", "residentName")) ||
    composed ||
    str(userObj.name ?? userObj.fullName) ||
    "Resident";
  const paymentRaw = String(
    pick("paymentStatus", "payment_status", "feeStatus") ?? "PENDING"
  ).toUpperCase();
  const statusRaw = String(
    pick("status", "residentStatus", "resident_status") ?? "ACTIVE"
  ).toUpperCase();
  return {
    id: str(pick("id", "_id", "residentId", "resident_id", `r-${Date.now()}`)),
    name,
    email: str(pick("email", "residentEmail")),
    phone: str(pick("phone", "phoneNumber", "phone_number", "contactNumber")),
    roomNumber: str(pickRoom("roomNumber", "room_number", "roomNo", "room")),
    bedNumber: str(pickRoom("bedNumber", "bed_number", "bedNo", "bed")),
    floor: num(pickRoom("floor", "floorNumber", "floor_number"), 0),
    paymentStatus: (["PAID", "PENDING", "OVERDUE", "PARTIAL"] as const).includes(
      paymentRaw as Resident["paymentStatus"]
    )
      ? (paymentRaw as Resident["paymentStatus"])
      : "PENDING",
    status: (["ACTIVE", "INACTIVE", "PENDING", "VACATED"] as const).includes(
      statusRaw as Resident["status"]
    )
      ? (statusRaw as Resident["status"])
      : "ACTIVE",
    joinedDate: str(
      pick("joinedDate", "joined_date", "admissionDate", "createdAt", "created_at") ?? ""
    ),
    monthlyRent: num(pick("monthlyRent", "monthly_rent", "rent", "feeAmount"), 0),
    avatarUrl: (pick("avatarUrl", "avatar", "photoUrl") as string | undefined) ?? undefined,
  };
}

/** Live fee-count slice carried on summaries (plain optional field). */
export interface OwnerSummaryFeeCounts {
  paid: number;
  pending: number;
  partial: number;
  overdue: number;
}

export interface OwnerSummaryWithCounts extends OwnerSummary {
  feeCounts?: OwnerSummaryFeeCounts;
}

export interface AdminSummaryWithCounts extends AdminSummary {
  feeCounts?: OwnerSummaryFeeCounts;
}

/* ---------------- Owner dashboard aggregate ---------------- */

const DASHBOARD_MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function dashboardMonthLabel(month?: number, year?: number): string | undefined {
  if (!month || month < 1 || month > 12) return undefined;
  const short = DASHBOARD_MONTH_LABELS[month - 1];
  return year && year > 0 ? `${short} ${year}` : short;
}

/** Best-effort month/year from labels like "2026-04" / "Apr 2026". */
function parseTrendLabel(label: string): { month?: number; year?: number } {
  const iso = label.match(/(\d{4})-(\d{1,2})(?:-\d{1,2})?/);
  if (iso) return { year: Number(iso[1]), month: Number(iso[2]) };
  const named = label.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})$/i);
  if (named) {
    const month = DASHBOARD_MONTH_LABELS.findIndex(
      (m) => m.toLowerCase() === named[1].slice(0, 3).toLowerCase()
    );
    if (month >= 0) return { month: month + 1, year: Number(named[2]) };
  }
  return {};
}

/**
 * Normalize one dashboard `recentPayments` row into the UI `Fee` shape.
 * Tolerates nested `resident`/`user` objects and snake_case fee variants.
 */
export function normalizeDashboardPayment(raw: unknown): Fee {
  const r = (raw ?? {}) as Record<string, unknown>;
  const nested = [r.resident, r.user, r.fee].filter(
    (v): v is Record<string, unknown> => typeof v === "object" && v !== null
  );
  const pick = (...keys: string[]): unknown => {
    for (const scope of [r, ...nested]) {
      for (const k of keys) {
        const v = scope[k];
        if (v !== undefined && v !== null && v !== "") return v;
      }
    }
    return undefined;
  };
  const num = (v: unknown, fallback = 0): number => {
    const n = typeof v === "string" ? Number(v) : (v as number);
    return Number.isFinite(n) ? n : fallback;
  };
  const str = (v: unknown): string =>
    typeof v === "string" ? v : v === undefined || v === null ? "" : String(v);
  const billingMonth =
    num(pick("billingMonth", "billing_month", "month", "monthNumber"), 0) || undefined;
  const billingYear = num(pick("billingYear", "billing_year", "year"), 0) || undefined;
  const month =
    str(pick("month", "label", "period", "billingPeriod")) ||
    dashboardMonthLabel(billingMonth, billingYear) ||
    undefined;
  const totalPayable = num(
    pick(
      "totalPayable",
      "total_payable",
      "total",
      "totalAmount",
      "payableAmount",
      "amount",
      "dueAmount",
      "due_amount"
    ),
    0
  );
  const paidAmount = num(
    pick("paidAmount", "paid_amount", "paid", "collectedAmount", "amountPaid"),
    0
  );
  const statusRaw = String(
    pick("status", "feeStatus", "paymentStatus", "payment_status") ?? ""
  ).toUpperCase();
  const status: Fee["status"] = (["PAID", "PENDING", "OVERDUE", "PARTIAL"] as const).includes(
    statusRaw as Fee["status"]
  )
    ? (statusRaw as Fee["status"])
    : totalPayable > 0 && paidAmount >= totalPayable
      ? "PAID"
      : paidAmount > 0
        ? "PARTIAL"
        : "PENDING";
  const firstName = str(pick("firstName", "first_name"));
  const lastName = str(pick("lastName", "last_name"));
  const composed = `${firstName} ${lastName}`.trim();
  return {
    id: str(pick("id", "_id", "feeId", "fee_id", "paymentId", "payment_id")) || `fee-${Date.now()}`,
    residentId: str(pick("residentId", "resident_id")) || undefined,
    residentName:
      str(pick("residentName", "resident_name", "fullName", "full_name", "name")) ||
      composed ||
      "Resident",
    hostelId: str(pick("hostelId", "hostel_id")) || undefined,
    amount: totalPayable,
    totalPayable,
    paidAmount,
    dueAmount: num(pick("dueAmount", "due_amount"), Math.max(0, totalPayable - paidAmount)),
    billingMonth,
    billingYear,
    dueDate: str(pick("dueDate", "due_date")) || undefined,
    month,
    roomNumber: str(pick("roomNumber", "room_number", "roomNo", "room")) || undefined,
    status,
    method: str(pick("method", "paymentMethod", "payment_method")) || undefined,
    paidAt:
      str(
        pick(
          "paidAt",
          "paid_at",
          "paymentDate",
          "updatedAt",
          "updated_at",
          "createdAt",
          "created_at"
        )
      ) || undefined,
  };
}

/**
 * Normalize `revenueTrend` — accepts an array of buckets OR a month-keyed map
 * (`{ "2026-04": 62000 }` / `{ "Apr": { collected, billed } }`).
 */
export function normalizeRevenueTrend(payload: unknown): RevenueTrendPoint[] {
  const list: unknown[] = Array.isArray(payload)
    ? payload
    : payload !== null && typeof payload === "object"
      ? Object.entries(payload as Record<string, unknown>).map(([label, value]) =>
          value !== null && typeof value === "object" && !Array.isArray(value)
            ? { ...(value as Record<string, unknown>), label }
            : { label, collected: value }
        )
      : [];
  // The backend may emit newest-first; order oldest → newest by (year, month).
  const asRecord = (item: unknown): Record<string, unknown> =>
    (item ?? {}) as Record<string, unknown>;
  const monthKey = (item: unknown): number => {
    const r = asRecord(item);
    const toNum = (v: unknown): number =>
      typeof v === "number" ? v : typeof v === "string" && v !== "" ? Number(v) : NaN;
    const year = toNum(r.billingYear ?? r.billing_year ?? r.year);
    const month = toNum(r.billingMonth ?? r.billing_month ?? r.month);
    return (Number.isFinite(year) ? year : 0) * 12 + (Number.isFinite(month) ? month : 0);
  };
  const ordered = [...list]
    .map((item, index) => ({ item, index }))
    .sort((a, b) => monthKey(a.item) - monthKey(b.item) || a.index - b.index)
    .map(({ item }) => item);
  return ordered.map((item) => {
    const r = (item ?? {}) as Record<string, unknown>;
    const pick = (...keys: string[]): unknown => {
      for (const k of keys) {
        const v = r[k];
        if (v !== undefined && v !== null && v !== "") return v;
      }
      return undefined;
    };
    const num = (v: unknown, fallback = 0): number => {
      const n = typeof v === "string" ? Number(v) : (v as number);
      return Number.isFinite(n) ? n : fallback;
    };
    const str = (v: unknown): string =>
      typeof v === "string" ? v : v === undefined || v === null ? "" : String(v);
    const rawLabel = str(pick("label", "monthLabel", "period", "name", "key", "date"));
    const parsed = rawLabel ? parseTrendLabel(rawLabel) : {};
    const month = num(pick("billingMonth", "billing_month", "month", "monthNumber"), 0);
    const year = num(pick("billingYear", "billing_year", "year"), 0);
    const billingMonth = month >= 1 && month <= 12 ? month : parsed.month;
    const billingYear = year > 0 ? year : parsed.year;
    const billedRaw = pick(
      "billed",
      "billedAmount",
      "expected",
      "expectedAmount",
      "totalBilled",
      "due",
      "dueAmount"
    );
    const collected = num(
      pick(
        "collected",
        "collectedAmount",
        "total",
        "totalAmount",
        "revenue",
        "amount",
        "value",
        "paid",
        "paidAmount"
      ),
      0
    );
    const outstandingRaw = pick("outstanding", "outstandingAmount", "remaining", "balance");
    const outstanding = outstandingRaw === undefined ? undefined : num(outstandingRaw, 0);
    // Backend sends either billed or outstanding; billed wins, else derive it.
    const billed =
      billedRaw === undefined
        ? outstanding === undefined
          ? undefined
          : collected + outstanding
        : num(billedRaw, 0);
    return {
      label: rawLabel || dashboardMonthLabel(billingMonth, billingYear) || "—",
      billingMonth,
      billingYear,
      collected,
      billed,
      outstanding,
    };
  });
}

/** Normalize `floorOverview` rows (array or keyed map of floor → counts). */
export function normalizeFloorOverview(payload: unknown): FloorOverviewItem[] {
  const list: unknown[] = Array.isArray(payload)
    ? payload
    : payload !== null && typeof payload === "object"
      ? Object.entries(payload as Record<string, unknown>).map(([floor, value]) =>
          value !== null && typeof value === "object" && !Array.isArray(value)
            ? { ...(value as Record<string, unknown>), floor }
            : { floor, rooms: value }
        )
      : [];
  return list.map((item) => {
    const r = (item ?? {}) as Record<string, unknown>;
    const pick = (...keys: string[]): unknown => {
      for (const k of keys) {
        const v = r[k];
        if (v !== undefined && v !== null && v !== "") return v;
      }
      return undefined;
    };
    const num = (v: unknown, fallback = 0): number => {
      const n = typeof v === "string" ? Number(v) : (v as number);
      return Number.isFinite(n) ? n : fallback;
    };
    const str = (v: unknown): string =>
      typeof v === "string" ? v : v === undefined || v === null ? "" : String(v);
    const floorRaw = pick(
      "floor",
      "floorNumber",
      "floor_number",
      "level",
      "flat",
      "name",
      "label",
      "key"
    );
    const floorNum = typeof floorRaw === "number" ? floorRaw : Number(floorRaw);
    const floor: number | string = Number.isFinite(floorNum) ? floorNum : str(floorRaw) || "—";
    const occupiedRaw = pick("occupiedBeds", "occupied_beds", "occupied");
    const totalBedsRaw = pick("totalBeds", "total_beds", "beds");
    return {
      floor,
      label:
        str(pick("label", "flatName", "displayName")) ||
        (typeof floor === "number" ? `Floor ${floor}` : String(floor)),
      rooms: num(
        pick("rooms", "roomCount", "room_count", "count", "total", "totalRooms", "value"),
        0
      ),
      occupiedBeds: occupiedRaw === undefined ? undefined : num(occupiedRaw, 0),
      totalBeds: totalBedsRaw === undefined ? undefined : num(totalBedsRaw, 0),
    };
  });
}

/** Normalize `roomMix` rows (array or type-keyed map). */
export function normalizeRoomMix(payload: unknown): RoomMixItem[] {
  const list: unknown[] = Array.isArray(payload)
    ? payload
    : payload !== null && typeof payload === "object"
      ? Object.entries(payload as Record<string, unknown>).map(([type, value]) =>
          value !== null && typeof value === "object" && !Array.isArray(value)
            ? { ...(value as Record<string, unknown>), type }
            : { type, rooms: value }
        )
      : [];
  return list.map((item) => {
    const r = (item ?? {}) as Record<string, unknown>;
    const pick = (...keys: string[]): unknown => {
      for (const k of keys) {
        const v = r[k];
        if (v !== undefined && v !== null && v !== "") return v;
      }
      return undefined;
    };
    const num = (v: unknown, fallback = 0): number => {
      const n = typeof v === "string" ? Number(v) : (v as number);
      return Number.isFinite(n) ? n : fallback;
    };
    const str = (v: unknown): string =>
      typeof v === "string" ? v : v === undefined || v === null ? "" : String(v);
    const type = (
      str(pick("type", "roomType", "room_type", "key", "name", "label")) || "UNKNOWN"
    ).toUpperCase();
    const occupiedRaw = pick("occupiedBeds", "occupied_beds", "occupied");
    const totalBedsRaw = pick("totalBeds", "total_beds", "beds");
    return {
      type,
      label: str(pick("label", "displayName")) || type.charAt(0) + type.slice(1).toLowerCase(),
      rooms: num(
        pick("rooms", "roomCount", "room_count", "count", "total", "totalRooms", "value"),
        0
      ),
      occupiedBeds: occupiedRaw === undefined ? undefined : num(occupiedRaw, 0),
      totalBeds: totalBedsRaw === undefined ? undefined : num(totalBedsRaw, 0),
    };
  });
}

/**
 * Normalize the aggregate GET /owner/dashboard payload into `OwnerDashboard`.
 * The axios layer's `unwrap()` returns only the `data` array, so this also
 * accepts the raw axios `res.data` envelope and merges the sibling keys
 * (`summary`, `floorOverview`, …) into one flat dashboard object.
 * Tolerates camelCase/snake_case variants and values nested under
 * `stats`/`summary`/`overview`/`metrics`. Missing keys stay `undefined` so the
 * dashboard can fall back to derived values (e.g. the rooms list).
 */
export function normalizeOwnerDashboard(raw: unknown): OwnerDashboard {
  const envelope = (
    raw !== null && typeof raw === "object" && "data" in (raw as Record<string, unknown>)
      ? (raw as Record<string, unknown>)
      : null
  ) as Record<string, unknown> | null;
  const dataPart = envelope ? envelope.data : raw;
  const root = ((Array.isArray(dataPart) ? {} : (dataPart as Record<string, unknown>)) ??
    {}) as Record<string, unknown>;
  // Sibling keys beside `data` (your payload: summary/floorOverview/…) plus the
  // legacy { stats, metrics, overview } nesting variants. Merge them deeply so
  // keys nested one level down (e.g. summary.totalResidents) resolve.
  const siblings = envelope ? (({ data: _ignored, ...rest }) => rest)(envelope) : {};
  const deepMerge = (
    base: Record<string, unknown>,
    extra: Record<string, unknown>
  ): Record<string, unknown> => {
    const out: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(extra)) {
      const current = out[key];
      if (
        current !== null &&
        typeof current === "object" &&
        !Array.isArray(current) &&
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)
      ) {
        out[key] = deepMerge(current as Record<string, unknown>, value as Record<string, unknown>);
      } else if (out[key] === undefined || out[key] === null || out[key] === "") {
        out[key] = value;
      }
    }
    return out;
  };
  let merged: Record<string, unknown> = { ...root };
  for (const extra of [siblings, root.summary, root.stats, root.overview, root.metrics]) {
    if (extra !== null && typeof extra === "object" && !Array.isArray(extra)) {
      merged = deepMerge(merged, extra as Record<string, unknown>);
    }
  }
  // The backend nests metrics one level down (`summary: { totalResidents… }`).
  // deepMerge keeps that nesting (merged.summary.totalResidents), so build the
  // lookup scopes explicitly: top level + known container objects.
  const isPlainObject = (v: unknown): v is Record<string, unknown> =>
    v !== null && typeof v === "object" && !Array.isArray(v);
  const scopes: Record<string, unknown>[] = [merged];
  for (const key of ["summary", "stats", "overview", "metrics"]) {
    const v = merged[key];
    if (isPlainObject(v) && !scopes.includes(v)) scopes.push(v);
  }
  const pick = (...keys: string[]): unknown => {
    for (const scope of scopes) {
      for (const k of keys) {
        const v = scope[k];
        if (v !== undefined && v !== null && v !== "") return v;
      }
    }
    return undefined;
  };
  const num = (v: unknown, fallback = 0): number => {
    const n = typeof v === "string" ? Number(v) : (v as number);
    return Number.isFinite(n) ? n : fallback;
  };
  const optNum = (...keys: string[]): number | undefined => {
    const v = pick(...keys);
    return v === undefined ? undefined : num(v, 0);
  };
  const optRaw = (...keys: string[]): unknown => pick(...keys);
  const pending = optNum(
    "pendingAmount",
    "pending_amount",
    "pendingPayments",
    "pending_payments",
    "totalPendingAmount",
    "dues",
    "outstanding",
    "totalDues"
  );
  const totalBeds = optNum("totalBeds", "total_beds", "beds", "totalBedCount");
  const occupiedBeds = optNum("occupiedBeds", "occupied_beds", "occupied", "totalOccupiedBeds");
  const availableBeds = optNum("availableBeds", "available_beds", "vacantBeds");
  const hostelsRaw = pick("hostels", "hostelList", "data") as OwnerDashboardHostel[] | undefined;
  // Current endpoint shape: `{ data: [hostel], summary: { ... } }`.
  // `data` is intentionally excluded from the metric merge above, so retain
  // it explicitly for the hostel name, type, and resident breakdown.
  const hostels = Array.isArray(dataPart)
    ? (dataPart as OwnerDashboardHostel[])
    : Array.isArray(hostelsRaw)
      ? hostelsRaw
      : undefined;
  // Derive collected/billed totals from the trend when present.
  const trend = normalizeRevenueTrend(
    optRaw("revenueTrend", "revenue_trend", "revenueSeries", "revenueByMonth")
  );
  const trendCollected = trend.reduce((s, p) => s + (p.collected || 0), 0);
  const trendBilled = trend.reduce(
    (s, p) => s + (p.billed ?? p.collected + (p.outstanding ?? 0)),
    0
  );
  const collectionRate =
    optNum("collectionRate", "collection_rate", "collectionPercentage") ??
    (trendBilled > 0 ? Math.round((trendCollected / trendBilled) * 1000) / 10 : undefined);
  return {
    totalResidents: optNum(
      "totalResidents",
      "totalActiveResidents",
      "total_residents",
      "activeResidents",
      "residents",
      "residentCount"
    ),
    occupiedBeds,
    totalBeds,
    availableBeds:
      availableBeds ??
      (totalBeds !== undefined && occupiedBeds !== undefined
        ? Math.max(0, totalBeds - occupiedBeds)
        : undefined),
    monthlyRevenue: optNum(
      "monthlyRevenue",
      "monthly_revenue",
      "revenue",
      "collectedThisMonth",
      "totalRevenue",
      "mrr"
    ),
    pendingPayments: pending,
    pendingAmount: pending,
    totalRooms: optNum("totalRooms", "total_rooms", "rooms", "roomCount"),
    availableRooms: optNum("availableRooms", "available_rooms", "vacantRooms"),
    recentPayments: (
      optRaw("recentPayments", "recent_payments", "recentTransactions", "payments", "fees") as
        unknown[] | undefined
    )?.map(normalizeDashboardPayment),
    revenueTrend: trend,
    floorOverview: normalizeFloorOverview(
      optRaw("floorOverview", "floor_overview", "floors", "floorBreakdown", "roomsByFloor")
    ),
    roomMix: normalizeRoomMix(
      optRaw("roomMix", "room_mix", "roomTypes", "roomTypeBreakdown", "roomsByType")
    ),
    collectionRate,
    occupancyRate: optNum("occupancyRate", "occupancy_rate", "occupancy"),
    occupiedRooms: optNum("occupiedRooms", "occupied_rooms", "occupiedRoomCount"),
    residentsOnLeaveToday: optNum("residentsOnLeaveToday", "residents_on_leave_today"),
    totalHostels: optNum("totalHostels", "total_hostels", "hostelCount"),
    pendingCount: optNum("pendingCount", "pending_count", "pendingBills"),
    hostels,
  };
}

/** Shared scope-picking for the analytics summary normalizers. */
function analyticsScopes(raw: unknown): Record<string, unknown>[] {
  const root = (unwrap<Record<string, unknown>>(raw) ?? {}) as Record<string, unknown>;
  const scopes = [root];
  for (const key of ["data", "summary", "stats", "overview", "result"]) {
    const v = root[key];
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      scopes.push(v as Record<string, unknown>);
    }
  }
  return scopes;
}

function analyticsNum(v: unknown, fallback = 0): number {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : fallback;
}

function analyticsFeeCounts(
  pick: (...keys: string[]) => unknown
): OwnerSummaryFeeCounts | undefined {
  const num = (v: unknown): number | undefined =>
    v === undefined ? undefined : analyticsNum(v, 0);
  const paid = num(pick("paidFees", "paid_fees", "paidCount"));
  const pending = num(pick("pendingFees", "pending_fees", "pendingCount"));
  const partial = num(pick("partialFees", "partial_fees", "partialCount"));
  const overdue = num(pick("overdueFees", "overdue_fees", "overdueCount"));
  if (paid === undefined && pending === undefined && partial === undefined && overdue === undefined) {
    return undefined;
  }
  return { paid: paid ?? 0, pending: pending ?? 0, partial: partial ?? 0, overdue: overdue ?? 0 };
}

/**
 * Normalize GET /analytics/owner/summary into `OwnerSummary`.
 * Accepts the envelope or the raw object; tolerates camel/snake variants and
 * one level of nesting (`data` / `summary` / `stats`).
 */
export function normalizeOwnerSummary(raw: unknown): OwnerSummaryWithCounts {
  const scopes = analyticsScopes(raw);
  const pick = (...keys: string[]): unknown => {
    for (const scope of scopes) {
      for (const k of keys) {
        const v = scope[k];
        if (v !== undefined && v !== null && v !== "") return v;
      }
    }
    return undefined;
  };
  const optNum = (...keys: string[]): number | undefined => {
    const v = pick(...keys);
    return v === undefined ? undefined : analyticsNum(v, 0);
  };
  const pending =
    optNum(
      "pendingAmount",
      "pending_amount",
      "pendingDues",
      "pending_dues",
      "pendingPayments",
      "dues",
      "outstanding",
      "totalDues"
    ) ?? 0;
  return {
    residents: optNum("residents", "totalResidents", "total_residents", "residentCount"),
    totalResidents: optNum("totalResidents", "total_residents", "residents", "residentCount"),
    occupancy: optNum("occupancy", "occupancyRate", "occupancy_rate"),
    occupancyRate: optNum("occupancyRate", "occupancy_rate", "occupancy"),
    revenue: optNum("revenue", "monthlyRevenue", "monthly_revenue", "totalRevenue"),
    monthlyRevenue: optNum("monthlyRevenue", "monthly_revenue", "revenue", "totalRevenue"),
    totalRevenue: optNum("totalRevenue", "total_revenue", "revenue", "monthlyRevenue"),
    pendingDues: pending,
    pendingAmount: pending,
    pendingCount: optNum("pendingCount", "pending_count", "pendingFees", "pendingBills"),
    collectionRate: optNum("collectionRate", "collection_rate", "collectionPercentage"),
    totalBeds: optNum("totalBeds", "total_beds", "beds"),
    occupiedBeds: optNum("occupiedBeds", "occupied_beds", "occupied"),
    totalRooms: optNum("totalRooms", "total_rooms", "rooms", "roomCount"),
    availableRooms: optNum("availableRooms", "available_rooms", "vacantRooms"),
    revenueTrend: normalizeRevenueTrend(
      pick("revenueTrend", "revenue_trend", "revenueSeries", "revenueByMonth")
    ),
    feeCounts: analyticsFeeCounts(pick),
  };
}

/**
 * Normalize GET /analytics/admin/summary into `AdminSummary`.
 * Same tolerant shape handling as the owner variant; counts + fee totals.
 */
export function normalizeAdminSummary(raw: unknown): AdminSummaryWithCounts {
  const scopes = analyticsScopes(raw);
  const pick = (...keys: string[]): unknown => {
    for (const scope of scopes) {
      for (const k of keys) {
        const v = scope[k];
        if (v !== undefined && v !== null && v !== "") return v;
      }
    }
    return undefined;
  };
  const optNum = (...keys: string[]): number | undefined => {
    const v = pick(...keys);
    return v === undefined ? undefined : analyticsNum(v, 0);
  };
  return {
    totalHostels: optNum("totalHostels", "total_hostels", "hostelCount"),
    totalResidents: optNum("totalResidents", "total_residents", "residents", "residentCount"),
    mrr: optNum("mrr", "monthlyRevenue", "monthly_revenue", "revenue"),
    monthlyRevenue: optNum("monthlyRevenue", "monthly_revenue", "mrr", "revenue"),
    totalRevenue: optNum("totalRevenue", "total_revenue", "revenue"),
    pendingAmount: optNum(
      "pendingAmount",
      "pending_amount",
      "pendingDues",
      "dues",
      "outstanding",
      "totalDues"
    ),
    totalFees: optNum("totalFees", "total_fees", "feeCount"),
    paidFees: optNum("paidFees", "paid_fees", "paidCount"),
    pendingFees: optNum("pendingFees", "pending_fees", "pendingCount"),
    overdueFees: optNum("overdueFees", "overdue_fees", "overdueCount"),
    collectionRate: optNum("collectionRate", "collection_rate", "collectionPercentage"),
    occupancyRate: optNum("occupancyRate", "occupancy_rate", "occupancy"),
    totalBeds: optNum("totalBeds", "total_beds", "beds"),
    occupiedBeds: optNum("occupiedBeds", "occupied_beds", "occupied"),
    totalRooms: optNum("totalRooms", "total_rooms", "rooms"),
    revenueTrend: normalizeRevenueTrend(
      pick("revenueTrend", "revenue_trend", "revenueSeries", "revenueByMonth")
    ),
    feeCounts: analyticsFeeCounts(pick),
  };
}

/**
 * Normalize a backend expense row into the UI `Expense` shape.
 * Tolerates snake_case / camelCase / `date` aliases.
 */
export function normalizeExpense(raw: unknown): Expense {
  const r = (raw ?? {}) as Record<string, unknown>;
  const pick = (...keys: string[]): unknown => {
    for (const k of keys) {
      const v = r[k];
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return undefined;
  };
  const str = (v: unknown): string => (typeof v === "string" ? v : String(v ?? ""));
  const statusRaw = String(pick("status") ?? "PENDING").toUpperCase();
  const hostel = pick("hostel") as Record<string, unknown> | undefined;
  return {
    id: str(pick("id", "_id", "expenseId", `exp-${Date.now()}`)),
    hostelId:
      (pick("hostelId", "hostel_id") as string | undefined) ??
      (typeof hostel?.id === "string" ? hostel.id : undefined),
    hostelName:
      (pick("hostelName", "hostel_name") as string | undefined) ??
      (typeof hostel?.name === "string" ? hostel.name : undefined),
    title: str(pick("title", "name")),
    category: String(pick("category") ?? "OTHER").toUpperCase(),
    amount: pick("amount") as number | string,
    expenseDate: str(pick("expenseDate", "expense_date", "date")),
    date: str(pick("date") ?? ""),
    notes: (pick("notes", "description", "remarks") as string | null | undefined) ?? null,
    status: (["PAID", "PENDING"] as const).includes(statusRaw as Expense["status"])
      ? (statusRaw as Expense["status"])
      : "PENDING",
    createdAt: pick("createdAt", "created_at") as string | undefined,
    updatedAt: pick("updatedAt", "updated_at") as string | undefined,
  };
}

/** Normalize GET /expenses list (tolerates `{ data }` / raw array). */
export function normalizeExpenseList(payload: unknown): Expense[] {
  const { items } = toPaginated<unknown>(payload);
  return items.map(normalizeExpense);
}

/**
 * Normalize GET /expenses list pagination.
 * Spec: `{ pagination: { totalItems, currentPage, totalPages, itemsPerPage, hasNextPage, hasPrevPage } }`.
 * Falls back to the `meta` envelope or item count when uncached.
 */
export function normalizeExpensePagination(
  payload: unknown,
  fallbackLimit: number
): ExpensePagination {
  const root = (payload ?? {}) as Record<string, unknown>;
  const scopes: Record<string, unknown>[] = [root];
  const data = root.data;
  if (data !== null && typeof data === "object" && !Array.isArray(data)) {
    scopes.push(data as Record<string, unknown>);
  }
  const pickPag = (...keys: string[]): unknown => {
    for (const scope of scopes) {
      const holders = [scope.pagination, scope.meta, scope];
      for (const holder of holders) {
        if (holder !== null && typeof holder === "object" && !Array.isArray(holder)) {
          for (const k of keys) {
            const v = (holder as Record<string, unknown>)[k];
            if (v !== undefined && v !== null && v !== "") return v;
          }
        }
      }
    }
    return undefined;
  };
  const numOf = (v: unknown, fallback: number): number => {
    const n = typeof v === "string" ? Number(v) : (v as number);
    return Number.isFinite(n) ? n : fallback;
  };
  const meta = unwrapMeta(payload);
  const totalItems = numOf(pickPag("totalItems", "total_items", "total"), meta?.total ?? 0);
  const currentPage = Math.max(
    1,
    numOf(pickPag("currentPage", "current_page", "page"), meta?.page ?? 1)
  );
  const itemsPerPage = Math.max(
    1,
    numOf(pickPag("itemsPerPage", "items_per_page", "limit", "perPage"), meta?.limit ?? fallbackLimit)
  );
  const totalPages = Math.max(
    1,
    numOf(pickPag("totalPages", "total_pages"), meta?.totalPages ?? 1)
  );
  return {
    totalItems,
    currentPage,
    totalPages,
    itemsPerPage,
    hasNextPage: Boolean(
      pickPag("hasNextPage", "has_next_page") ?? meta?.hasNextPage ?? currentPage < totalPages
    ),
    hasPrevPage: Boolean(
      pickPag("hasPrevPage", "has_prev_page") ?? meta?.hasPrevPage ?? currentPage > 1
    ),
  };
}

/**
 * Normalize backend facility shapes into the UI `FacilityItem` shape.
 *
 * New hostel-scoped contract (GET /hostels/:hostelId/facilities):
 *   { id: "<junction-uuid>", title, slug, facilityId, description, tag, clientKey }
 * `id` in the UI is the **frontend-stable key** = `clientKey` (e.g.
 * `security-mu5ofghs`); the junction UUID is preserved as `junctionId`.
 *
 * Also tolerates legacy global shapes (title/name + description/details +
 * tag/category variants) so old cached responses still render.
 */
export function normalizeFacility(raw: unknown): HostelFacility {
  const r = (raw ?? {}) as Record<string, unknown>;
  const pick = (...keys: string[]): unknown => {
    for (const k of keys) {
      const v = r[k];
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return undefined;
  };
  const str = (v: unknown, fallback = ""): string =>
    typeof v === "string" ? v : v === undefined || v === null ? fallback : String(v);
  const clientKey = str(pick("clientKey", "client_key", "clientId", "frontendId"), "");
  const junctionId =
    str(pick("junctionId", "junction_id"), "") || str(pick("id", "_id"), "") || undefined;
  const fallbackId =
    clientKey || str(pick("id", "_id", "facilityId", "facility_id"), `facility-${Date.now()}`);
  // Coerce legacy tags (Limited / Add-on / PRO hostels) to the backend enum so
  // a stale GET row re-sent via PUT sync never trips the 400 validation error.
  const rawTag = str(pick("tag", "category", "type"), "Included");
  const tag =
    rawTag === "Included" || rawTag === "Excluded" || rawTag === "Extra Charge"
      ? rawTag
      : /extra|charge|add-?on|paid/i.test(rawTag)
        ? "Extra Charge"
        : /exclud|not/i.test(rawTag)
          ? "Excluded"
          : "Included";
  return {
    id: fallbackId,
    title: str(pick("title", "name", "facilityName", "facility_name"), "Facility"),
    description: str(
      pick("description", "details", "desc", "facilityDescription", "facility_description"),
      ""
    ),
    tag,
    slug: str(pick("slug"), "") || undefined,
    facilityId: str(pick("facilityId", "facility_id", "catalogId"), "") || undefined,
    junctionId,
    clientKey: clientKey || undefined,
    hostelId: (pick("hostelId", "hostel_id", "hostel") as string | undefined) ?? undefined,
  };
}

/** Serialize a room payload to multipart FormData (image under `image` key). */
function roomToFormData(payload: CreateRoomPayload | UpdateRoomPayload, imageFile?: File | null) {
  const form = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (Array.isArray(value)) {
      // Backend DTO may accept repeated keys or CSV — send CSV (multer-safe).
      form.append(key, value.join(","));
      return;
    }
    form.append(key, String(value));
  });
  // Backend strips stray text parts and only uploads the real file buffer,
  // so append the file ONLY (never an `image` text field alongside it).
  if (imageFile) form.append("image", imageFile, imageFile.name);
  return form;
}

export { toApiError, type ApiErrorShape, newIdempotencyKey };

/** Per-request config for FormData uploads.
 * The shared axios instance defaults to `Content-Type: application/json` —
 * that MUST be removed so the browser/XHR generates
 * `multipart/form-data; boundary=...` itself. A manually-set multipart
 * Content-Type (or a stale JSON one) leaves multer with no usable boundary,
 * so `uploadRoomImage` / `stripFileFields('image')` would see junk. */
function multipartConfig(extraHeaders?: Record<string, string>) {
  return {
    headers: extraHeaders,
    transformRequest: [
      (data: unknown, headers?: { delete?: (name: string) => void }) => {
        headers?.delete?.("Content-Type");
        return data;
      },
    ],
  };
}

export const socketRooms = {
  user: (userId: string) => `user:${userId}`,
  role: (role: string) => `role:${role}`,
  hostel: (hostelId: string) => `hostel:${hostelId}`,
};

/**
 * Socket room + event contract (backend spec).
 * Authenticated clients join `user:<userId>`, `role:<ROLE>`, `hostel:<hostelId>`.
 * Domain events: `hostel:updated`, `booking:confirmed`,
 * `leave:status_changed`, `payment:processed`.
 */
export const socketEvents = {
  hostelUpdated: "hostel:updated",
  bookingConfirmed: "booking:confirmed",
  leaveStatusChanged: "leave:status_changed",
  paymentProcessed: "payment:processed",
} as const;

export type SocketDomainEvent = (typeof socketEvents)[keyof typeof socketEvents];

/**
 * Lazy socket.io client (zero bundle cost when NEXT_PUBLIC_SOCKET_URL is unset).
 * Cookie-authenticated; caller joins user:/role:/hostel: rooms via joinSessionRooms.
 * Returns null when unconfigured.
 */
export async function connectSocket(opts?: { path?: string }) {
  const url = process.env.NEXT_PUBLIC_SOCKET_URL;
  if (!url || typeof window === "undefined") return null;
  const { io } = await import("socket.io-client");
  return io(url, {
    withCredentials: true,
    transports: ["websocket", "polling"],
    ...(opts?.path ? { path: opts.path } : {}),
  });
}

/** Join caller rooms for the current session. */
export function joinSessionRooms(
  socket: { emit: (event: string, ...args: unknown[]) => void },
  opts: { userId?: string | null; role?: string | null; hostelId?: string | null }
) {
  if (opts.userId) socket.emit("join", socketRooms.user(opts.userId));
  if (opts.role) socket.emit("join", socketRooms.role(opts.role));
  if (opts.hostelId) socket.emit("join", socketRooms.hostel(opts.hostelId));
}

// Typed API client for HostelGhar endpoints (production-grade)
export const hostelGhar = {
  auth: {
    register: (payload: RegisterPayload) =>
      api.post<LoginResponse | RegisterResponse>(`${PREFIX}/auth/register`, payload),
    login: (payload: LoginPayload) => api.post<LoginResponse>(`${PREFIX}/auth/login`, payload),
    me: () => api.get<unknown>(`${PREFIX}/auth/me`),
    forgotPassword: (payload: { email: string }) =>
      api.post<{ message: string }>(`${PREFIX}/auth/forgot-password`, payload),
    resetPassword: (payload: { token: string; password: string }) =>
      api.patch<{ message: string }>(`${PREFIX}/auth/reset-password`, payload),
    changePassword: (payload: { currentPassword: string; newPassword: string }) =>
      api.put<{ message: string }>(`${PREFIX}/auth/change-password`, payload),
  },

  admin: {
    listHostels: (params?: ListParams) =>
      getWithRetry<ApiEnvelope<Hostel[]> | Hostel[]>(`${PREFIX}/admin/hostels`, params),
    // Create WITH logo FILE: backend accepts multipart FormData (fields + file
    // part `logo` or `image`, JPEG/PNG/WEBP/AVIF ≤3MB → Cloudinary logoUrl).
    // NOTE: send ONLY the file part — do NOT also append a `logo` text field
    // (filename/URL string); the backend strips stray text parts and only the
    // real file buffer is uploaded. Let axios set the multipart boundary
    // (no manual Content-Type) so multer can parse the file.
    createHostel: (payload: CreateHostelPayload, logoFile?: File) => {
      if (!logoFile) return api.post<Hostel>(`${PREFIX}/admin/hostels`, payload);
      const form = new FormData();
      Object.entries(payload).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") form.append(key, String(value));
      });
      form.append("logo", logoFile, logoFile.name);
      return api.post<Hostel>(`${PREFIX}/admin/hostels`, form, {
        headers: { "Content-Type": undefined as unknown as string },
      });
    },
    uploadHostelLogo: (hostelId: string, logoFile: File) => {
      const form = new FormData();
      form.append("logo", logoFile, logoFile.name);
      return api.post<Hostel>(`${PREFIX}/admin/hostels/${hostelId}/logo`, form, {
        headers: { "Content-Type": undefined as unknown as string },
      });
    },
    assignOwner: (hostelId: string, payload: { ownerId: string }) =>
      api.put<Hostel>(`${PREFIX}/admin/hostels/${hostelId}/owner`, payload),
    createOwner: (payload: CreateOwnerPayload, imageFile?: File) => {
      if (!imageFile) return api.post<Owner>(`${PREFIX}/admin/owners`, payload);
      const form = new FormData();
      Object.entries(payload).forEach(([key, value]) => form.append(key, value));
      form.append("image", imageFile, imageFile.name);
      return api.post<Owner>(`${PREFIX}/admin/owners`, form, {
        headers: { "Content-Type": undefined as unknown as string },
      });
    },
  },

  analytics: {
    adminSummary: () => getWithRetry<AdminSummary>(`${PREFIX}/analytics/admin/summary`),
    ownerSummary: () => getWithRetry<OwnerSummary>(`${PREFIX}/analytics/owner/summary`),
  },

  bookings: {
    create: (payload: CreateBookingPayload, idempotencyKey?: string) =>
      api.post<Booking>(`${PREFIX}/bookings`, payload, {
        headers: idemHeaders(idempotencyKey ?? newIdempotencyKey()),
      }),
    myBookings: () =>
      getWithRetry<Booking[] | ApiEnvelope<Booking[]>>(`${PREFIX}/bookings/my-bookings`),
    hostelBookings: (hostelId: string, params?: ListParams) =>
      getWithRetry<Booking[] | ApiEnvelope<Booking[]>>(
        `${PREFIX}/bookings/hostels/${hostelId}`,
        params
      ),
    updateStatus: (bookingId: string, payload: { status: string }) =>
      api.patch<Booking>(`${PREFIX}/bookings/${bookingId}/status`, payload),
    cancel: (bookingId: string) =>
      api.delete<{ message: string }>(`${PREFIX}/bookings/${bookingId}`),
  },

  hostels: {
    list: (params?: ListParams) =>
      getWithRetry<Hostel[] | ApiEnvelope<Hostel[]>>(`${PREFIX}/hostels`, params),
    get: (id: string) =>
      getWithRetry<HostelDetail | ApiEnvelope<HostelDetail>>(`${PREFIX}/hostels/${id}`),
    /** GET /hostels/:id/residents — active residents for an admin or owner. */
    residents: (id: string, params?: ListParams) =>
      getWithRetry<Resident[] | ApiEnvelope<Resident[]>>(
        `${PREFIX}/hostels/${id}/residents`,
        params
      ),
    leaveTypes: (id: string) =>
      getWithRetry<LeaveType[] | ApiEnvelope<LeaveType[]>>(
        `${PREFIX}/hostels/${id}/leave-types`,
        // Backend sends ETag → browser revalidates → 304 with EMPTY body.
        // Bypass the HTTP cache so we always get a 200 with the real list.
        noCacheParams()
      ),
  },

  beds: {
    list: (params?: {
      hostelId?: string;
      roomId?: string;
      roomNumber?: string;
      page?: number;
      limit?: number;
    }) => getWithRetry<Bed[] | ApiEnvelope<Bed[]>>(`${PREFIX}/beds`, params),
    create: (payload: CreateBedPayload) =>
      api.post<Bed | ApiEnvelope<Bed>>(`${PREFIX}/beds`, payload, {
        headers: idemHeaders(newIdempotencyKey()),
      }),
    update: (id: string, payload: Partial<Pick<Bed, "status" | "residentName" | "monthlyRent">>) =>
      api.patch<Bed>(`${PREFIX}/beds/${id}`, payload),
  },

  rooms: {
    /** GET /rooms — paginated rooms of logged-in owner (?page=&limit=&status=&type=&hostelId=). */
    list: (params?: RoomListParams) =>
      getWithRetry<Room[] | ApiEnvelope<Room[]>>(`${PREFIX}/rooms`, params),
    /** GET /rooms/:id — single owner room detail. */
    get: (id: string) => getWithRetry<Room | ApiEnvelope<Room>>(`${PREFIX}/rooms/${id}`),
    /** POST /rooms — owner creates a room (ownerId from JWT). JSON or multipart image. */
    create: (payload: CreateRoomPayload, imageFile?: File | null) => {
      if (!imageFile)
        return api.post<Room>(`${PREFIX}/rooms`, payload, {
          headers: idemHeaders(newIdempotencyKey()),
        });
      // IMPORTANT: do NOT set Content-Type manually for FormData — axios/the
      // browser must generate the multipart boundary, otherwise multer on the
      // backend cannot parse the file and `stripFileFields('image')` sees junk.
      return api.post<Room>(
        `${PREFIX}/rooms`,
        roomToFormData(payload, imageFile),
        multipartConfig(idemHeaders(newIdempotencyKey()))
      );
    },
    /** PATCH /rooms/:id — owner partially updates their room (JSON or multipart image). */
    update: (id: string, payload: UpdateRoomPayload, imageFile?: File | null) => {
      if (!imageFile) return api.patch<Room>(`${PREFIX}/rooms/${id}`, payload);
      return api.patch<Room>(
        `${PREFIX}/rooms/${id}`,
        roomToFormData(payload, imageFile),
        multipartConfig()
      );
    },
  },

  facilities: {
    // ------------------------------------------------------------------
    // Hostel-scoped facilities (normalized contract).
    // Backend envelopes: { success, data } OR { data } OR raw array.
    // ------------------------------------------------------------------
    /** GET /hostels/:hostelId/facilities — normalized facilities for a hostel. */
    listByHostel: (hostelId: string) =>
      getWithRetry<unknown>(`${PREFIX}/hostels/${hostelId}/facilities`),
    /**
     * PUT /hostels/:hostelId/facilities — full sync (replace).
     * Send the whole frontend editor list; DB ends matching it.
     * Frontend `id` maps to `clientKey`. Requires role owner/admin.
     */
    syncHostel: (hostelId: string, facilities: HostelFacilitySyncItem[]) =>
      api.put<unknown>(`${PREFIX}/hostels/${hostelId}/facilities`, { facilities }),
    /**
     * POST /hostels/:hostelId/facilities — add (or update) one facility.
     * Body: { id?, title, description?, tag? }.
     */
    createForHostel: (hostelId: string, payload: UpsertHostelFacilityPayload) =>
      api.post<unknown>(`${PREFIX}/hostels/${hostelId}/facilities`, payload, {
        headers: idemHeaders(newIdempotencyKey()),
      }),
    /**
     * DELETE /hostels/:hostelId/facilities/:facilityKey — removes a facility.
     * `:facilityKey` accepts the junction UUID **or** the frontend `clientKey`.
     * Pass the clientKey by default (stable across syncs); falls back to the
     * junction id when only that is known.
     */
    removeFromHostel: (hostelId: string, facilityKey: string) =>
      api.delete<{ message?: string }>(
        `${PREFIX}/hostels/${encodeURIComponent(hostelId)}/facilities/${encodeURIComponent(facilityKey)}`
      ),
    // ------------------------------------------------------------------
    // Legacy global facilities (deprecated — backend moved to hostel scope).
    // Kept so older callsites don't break at import time.
    // ------------------------------------------------------------------
    /** GET /facilities — owner facilities (?hostelId=). @deprecated use listByHostel */
    list: (params?: ListParams) =>
      getWithRetry<unknown[] | ApiEnvelope<unknown[]>>(`${PREFIX}/facilities`, params),
    /** GET /facilities/:id — single facility detail. */
    get: (id: string) => getWithRetry<unknown | ApiEnvelope<unknown>>(`${PREFIX}/facilities/${id}`),
    /**
     * POST /facilities — owner adds a facility (ownerId from JWT).
     * Sends canonical fields PLUS `name`/`category` aliases so backends that
     * validate either variant both pass (extra keys are ignored server-side).
     */
    create: (payload: CreateFacilityPayload) => {
      const body = {
        title: payload.title,
        name: payload.name ?? payload.title,
        description: payload.description,
        details: payload.description,
        tag: payload.tag,
        category: payload.category ?? payload.tag,
        ...(payload.hostelId ? { hostelId: payload.hostelId } : {}),
      };
      return api.post<unknown>(`${PREFIX}/facilities`, body, {
        headers: idemHeaders(newIdempotencyKey()),
      });
    },
    /** PATCH /facilities/:id — owner updates their facility. */
    update: (id: string, payload: UpdateFacilityPayload) =>
      api.patch<unknown>(`${PREFIX}/facilities/${id}`, payload),
    /** DELETE /facilities/:id — owner removes a facility. */
    remove: (id: string) => api.delete<{ message?: string }>(`${PREFIX}/facilities/${id}`),
  },

  owner: {
    dashboard: () =>
      getWithRetry<OwnerDashboard | ApiEnvelope<OwnerDashboard>>(`${PREFIX}/owner/dashboard`),
    createResident: (payload: CreateResidentPayload) =>
      api.post<ResidentDetail>(`${PREFIX}/owner/residents`, payload, {
        headers: idemHeaders(newIdempotencyKey()),
      }),
    createLeaveType: (payload: CreateLeaveTypePayload) =>
      api.post<LeaveType | ApiEnvelope<LeaveType>>(`${PREFIX}/owner/leave-types`, payload, {
        headers: idemHeaders(newIdempotencyKey()),
      }),
    /** GET /owner/residents — ALL active residents across owned hostels. */
    residents: (params?: OwnerResidentsParams) =>
      getWithRetry<ResidentDetail[] | ApiEnvelope<ResidentDetail[]>>(
        `${PREFIX}/owner/residents`,
        params
      ),
    /** GET /owner/residents/form-options/hostels — Add-Resident hostel dropdown. */
    residentFormHostels: () =>
      getWithRetry<OwnerHostelOption[] | ApiEnvelope<OwnerHostelOption[]>>(
        `${PREFIX}/owner/residents/form-options/hostels`
      ),
    /** GET /owner/residents/form-options/flats — flat dropdown (flat = Room.floor). */
    residentFormFlats: (hostelId: string) =>
      getWithRetry<OwnerFlatOption[] | ApiEnvelope<OwnerFlatOption[]>>(
        `${PREFIX}/owner/residents/form-options/flats`,
        { hostelId }
      ),
    /** GET /owner/residents/form-options/rooms — dynamic room dropdown. */
    residentFormRooms: (hostelId: string, flat?: number) =>
      getWithRetry<OwnerRoomOption[] | ApiEnvelope<OwnerRoomOption[]>>(
        `${PREFIX}/owner/residents/form-options/rooms`,
        flat === undefined ? { hostelId } : { hostelId, flat }
      ),
    /** GET /owner/residents/form-options/rooms/detail — single-room refresh. */
    residentFormRoomDetail: (hostelId: string, roomNumber: string) =>
      getWithRetry<OwnerRoomOption | ApiEnvelope<OwnerRoomOption>>(
        `${PREFIX}/owner/residents/form-options/rooms/detail`,
        { hostelId, roomNumber }
      ),
    generateFeesNow: (payload?: GenerateFeesPayload) =>
      api.post<{ message: string; generated?: number }>(
        `${PREFIX}/owner/fees/generate-now`,
        payload ?? {},
        { headers: idemHeaders(newIdempotencyKey()) }
      ),
    /** GET /owner/resident-imports/template — CSV template download (blob). */
    residentImportTemplate: () =>
      api.get<Blob>(`${PREFIX}/owner/resident-imports/template`, {
        responseType: "blob",
      }),
    /** GET /owner/resident-imports/plan-limits — powers "View plan limits". */
    residentImportPlanLimits: () =>
      getWithRetry<ResidentImportPlanLimits | ApiEnvelope<ResidentImportPlanLimits>>(
        `${PREFIX}/owner/resident-imports/plan-limits`
      ),
    /**
     * POST /owner/resident-imports?hostelId=<uuid> (multipart `file`).
     * Queues background import; returns the QUEUED history row.
     */
    startResidentImport: (hostelId: string, file: File, idempotencyKey?: string) => {
      const form = new FormData();
      form.append("file", file, file.name);
      // The API expects multipart/form-data; leaving the default JSON content-type
      // on the axios instance prevents the browser from generating the multipart boundary.
      return api.post<ResidentImport | ApiEnvelope<ResidentImport>>(
        `${PREFIX}/owner/resident-imports`,
        form,
        {
          params: { hostelId },
          headers: {
            "Content-Type": "multipart/form-data",
            ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
          },
        }
      );
    },
    /** GET /owner/resident-imports — paginated import history. */
    residentImports: (params?: ListParams & { hostelId?: string }) =>
      getWithRetry<
        ResidentImport[] | ApiEnvelope<ResidentImport[]> | ApiEnvelope<{ data: ResidentImport[] }>
      >(`${PREFIX}/owner/resident-imports`, params),
    /** GET /owner/resident-imports/:id — single import incl. row errors. */
    residentImportDetail: (id: string) =>
      getWithRetry<ResidentImport | ApiEnvelope<ResidentImport>>(
        `${PREFIX}/owner/resident-imports/${id}`
      ),
  },

  resident: {
    applyLeave: (payload: ApplyLeavePayload) =>
      api.post<LeaveRequest>(`${PREFIX}/resident/leaves/apply`, payload, {
        headers: idemHeaders(newIdempotencyKey()),
      }),
    leaves: (params?: ListParams) =>
      getWithRetry<LeaveRequest[] | ApiEnvelope<LeaveRequest[]>>(
        `${PREFIX}/resident/leaves`,
        params
      ),
    fees: () => getWithRetry<Fee[] | ApiEnvelope<Fee[]>>(`${PREFIX}/resident/fees`),
    /** GET /fees/:feeId/payment-proofs (resident) — 404 until backend ships; callers fall back to local. */
    paymentProofs: (params?: ListParams) =>
      getWithRetry<unknown>(`${PREFIX}/resident/payment-proofs`, params),
  },

  leaves: {
    hostelRequests: (hostelId: string, params?: ListParams) =>
      getWithRetry<LeaveRequest[] | ApiEnvelope<LeaveRequest[]>>(
        `${PREFIX}/leaves/hostels/${hostelId}/requests`,
        params
      ),
    updateRequestStatus: (requestId: string, payload: { status: string }) =>
      api.patch<LeaveRequest>(`${PREFIX}/leaves/requests/${requestId}/status`, payload),
  },

  fees: {
    /**
     * POST /fees/generate-monthly — owner/admin generates this month's bills
     * for one hostel. `month`/`year` optional (backend defaults to current).
     */
    generateMonthly: (payload?: GenerateFeesPayload) =>
      api.post<GenerateFeesResult | ApiEnvelope<GenerateFeesResult>>(
        `${PREFIX}/fees/generate-monthly`,
        payload ?? {},
        { headers: idemHeaders(newIdempotencyKey()) }
      ),
    /**
     * GET /fees/hostels/:hostelId — owner/admin lists hostel fee ledger.
     * Supports `?status=` / pagination via ListParams.
     */
    hostelFees: (hostelId: string, params?: ListParams) =>
      getWithRetry<Fee[] | ApiEnvelope<Fee[]>>(`${PREFIX}/fees/hostels/${hostelId}`, params),
    /**
     * PATCH /fees/:id/payment — owner/admin records payment against a fee.
     * Body: { amount, method, remarks? }.
     */
    recordPayment: (feeId: string, payload: RecordPaymentPayload) =>
      api.patch<Fee | ApiEnvelope<Fee>>(`${PREFIX}/fees/${feeId}/payment`, payload, {
        headers: idemHeaders(newIdempotencyKey()),
      }),
    /** GET /fees/hostels/:hostelId/payment-proofs — 404 until backend ships; callers fall back to local. */
    hostelPaymentProofs: (hostelId: string, params?: ListParams) =>
      getWithRetry<unknown>(`${PREFIX}/fees/hostels/${hostelId}/payment-proofs`, params),
  },

  expenses: {
    /**
     * POST /expenses — owner/admin records a hostel cost.
     * Body: { hostelId, title, category, amount, expenseDate, notes?, status }.
     */
    create: (payload: CreateExpensePayload) =>
      api.post<Expense | ApiEnvelope<Expense>>(`${PREFIX}/expenses`, payload, {
        headers: idemHeaders(newIdempotencyKey()),
      }),
    /**
     * GET /expenses?page=&limit=&hostelId=&category=&status= — paginated list.
     * Owners without `hostelId` get only their own hostels; admins get everything.
     * `page`/`limit` are normalized server-side (max 100).
     */
    list: (params?: ExpenseListParams) =>
      getWithRetry<Expense[] | ApiEnvelope<Expense[]>>(
        `${PREFIX}/expenses`,
        cleanHostelParams(params) as unknown as ListParams
      ),
    /** GET /expenses/:id — single expense (404 when missing/forbidden hostel). */
    get: (id: string) => getWithRetry<Expense | ApiEnvelope<Expense>>(`${PREFIX}/expenses/${id}`),
    /**
     * PUT /expenses/:id — full update of title/category/amount/expenseDate/notes/status.
     * `hostelId` is immutable — create a new row to move hostels.
     */
    update: (id: string, payload: UpdateExpensePayload) =>
      api.put<Expense | ApiEnvelope<Expense>>(`${PREFIX}/expenses/${id}`, payload),
    /**
     * PATCH /expenses/:id — partial update of title/category/amount/expenseDate/notes/status.
     * `hostelId` is immutable — create a new row to move hostels.
     */
    patch: (id: string, payload: UpdateExpensePayload) =>
      api.patch<Expense | ApiEnvelope<Expense>>(`${PREFIX}/expenses/${id}`, payload),
    /** DELETE /expenses/:id — removes an expense. */
    remove: (id: string) => api.delete<{ message?: string }>(`${PREFIX}/expenses/${id}`),
  },

  paymentQrs: {
    /**
     * Backend `paymentQrRouter` mount.
     * Override with `NEXT_PUBLIC_PAYMENT_QR_PATH` if backend mounts elsewhere
     * (e.g. `/payment-qr`, `/paymentQr`). Default follows REST plural convention.
     */
    basePath: paymentQrBasePath(),

    /** GET / — list all QRs (RESIDENT, OWNER, ADMIN). */
    list: (params?: PaymentQrListParams) =>
      getWithRetry<PaymentQr[] | ApiEnvelope<PaymentQr[]>>(
        paymentQrBasePath(),
        cleanHostelParams(params) as ListParams
      ),
    /** GET /resident — dedicated resident view under My Payments. */
    residentView: (params?: PaymentQrListParams) =>
      getWithRetry<PaymentQr[] | ApiEnvelope<PaymentQr[]>>(
        `${paymentQrBasePath()}/resident`,
        cleanHostelParams(params) as ListParams
      ),
    /** GET /preview — "Preview Resident View" for owners. */
    preview: (params?: PaymentQrListParams) =>
      getWithRetry<PaymentQr[] | ApiEnvelope<PaymentQr[]>>(
        `${paymentQrBasePath()}/preview`,
        cleanHostelParams(params) as ListParams
      ),
    /** GET /:id — single QR by id (RESIDENT, OWNER, ADMIN). */
    detail: (id: string) =>
      getWithRetry<PaymentQr | ApiEnvelope<PaymentQr>>(`${paymentQrBasePath()}/${id}`),
    /** POST /demo — "Load Demo QRs": seeds eSewa, Khalti, Bank (OWNER, ADMIN). */
    loadDemo: (payload?: LoadDemoQrPayload) => {
      const body = { ...(payload ?? {}) };
      const hid = validHostelId(body.hostelId);
      if (hid) body.hostelId = hid;
      else delete body.hostelId;
      return api.post<PaymentQr[] | ApiEnvelope<PaymentQr[]>>(`${paymentQrBasePath()}/demo`, body, {
        headers: idemHeaders(newIdempotencyKey()),
      });
    },
    /**
     * POST / — create QR (OWNER, ADMIN).
     * Sends multipart `qrCode` when `payload.file` is present,
     * otherwise JSON with `qrCodeUrl`. Body is canonicalized to
     * { paymentMethod, accountName, accountIdentifier, qrCodeUrl }.
     */
    create: (payload: CreatePaymentQrPayload, opts?: { hostelName?: string }) =>
      api.post<PaymentQr | ApiEnvelope<PaymentQr>>(
        paymentQrBasePath(),
        toPaymentQrForm(payload, opts),
        {
          headers: {
            ...idemHeaders(newIdempotencyKey()),
            ...(payload.file instanceof File ? { "Content-Type": "multipart/form-data" } : {}),
          },
        }
      ),
    /**
     * PUT /:id — "Replace QR" / full update (OWNER, ADMIN).
     * Multipart when `payload.file` present, else JSON.
     */
    replace: (id: string, payload: UpdatePaymentQrPayload, opts?: { hostelName?: string }) =>
      api.put<PaymentQr | ApiEnvelope<PaymentQr>>(
        `${paymentQrBasePath()}/${id}`,
        toPaymentQrForm(payload, opts),
        {
          headers:
            payload.file instanceof File ? { "Content-Type": "multipart/form-data" } : undefined,
        }
      ),
    /** PATCH /:id — partial update (OWNER, ADMIN). */
    patch: (id: string, payload: PatchPaymentQrPayload, opts?: { hostelName?: string }) =>
      api.patch<PaymentQr | ApiEnvelope<PaymentQr>>(
        `${paymentQrBasePath()}/${id}`,
        toPaymentQrForm(payload, opts),
        {
          headers:
            payload.file instanceof File ? { "Content-Type": "multipart/form-data" } : undefined,
        }
      ),
    /** PATCH /:id/toggle — toggle active/inactive (OWNER, ADMIN). */
    toggleStatus: (id: string) =>
      api.patch<PaymentQr | ApiEnvelope<PaymentQr>>(`${paymentQrBasePath()}/${id}/toggle`, {}),
    /** DELETE /:id — "Remove" QR (OWNER, ADMIN). */
    remove: (id: string) => api.delete<unknown>(`${paymentQrBasePath()}/${id}`),
  },
};

export default hostelGhar;
