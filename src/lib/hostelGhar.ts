import api, { getHostelId, toApiError, type ApiErrorShape } from "./axios";
import type { ApiEnvelope, PaginationMeta, Paginated, ListParams } from "./api-types";
import type {
  BackendFeeStatus,
  FeeStatus,
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
  AdminFeeLifecycle,
  AdminSummaryStats,
  AdminSummaryHealth,
  AdminSummaryPendingApprovals,
  AdminRecentHostel,
  OwnerSummary,
  Owner,
  PaymentQr,
  PaymentQrListParams,
  LoadDemoQrPayload,
  CreatePaymentQrPayload,
  UpdatePaymentQrPayload,
  UpdateFeeStatusPayload,
  PatchPaymentQrPayload,
  BackendPlan,
  SubscriptionCurrent,
  SubscribePayload,
  SubscriptionCheckLimit,
  SubscriptionHistoryItem,
  SubscriptionPlanId,
  SubscriptionRequest,
  SubscriptionReviewAction,
  HostelProfileSettings,
  UpdateHostelProfileSettingsPayload,
  NotificationPreferences,
  UpdateNotificationPreferencesPayload,
  PlatformSettings,
  UpdatePlatformSettingsPayload,
  GeneralSettings,
  UpdateGeneralSettingsPayload,
  BillingSettings,
  UpdateBillingSettingsPayload,
  AccessSettings,
  UpdateAccessSettingsPayload,
  AlertSettings,
  UpdateAlertSettingsPayload,
  SystemSettings,
  UpdateSystemSettingsPayload,
  PlatformQr,
  UpsertPlatformQrPayload,
  Staff,
  CreateStaffPayload,
  UpdateStaffPayload,
  StaffListParams,
  CreateInvoicePayload,
  Invoice,
  InvoiceListParams,
  WeeklyMealSchedule,
  MealDayItem,
  DailyMealItem,
  DailyMealSchedule,
  HostelLocation,
  UpdateHostelLocationPayload,
  AppNotification,
  NotificationCounts,
  NotificationListParams,
  GlobalSearchResponse,
  SearchResultItem,
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
 * Resolve the hostel scope for owner endpoints that require it
 * (subscriptions current/subscribe/cancel/check-limit, fees ledger, …).
 * Priority mirrors the backend `resolveHostelId` middleware:
 * explicit id → cookie `hg_hostel_id` (axios sends it as `X-Hostel-Id`) →
 * first hostel from GET /hostels. Returns null when nothing resolves —
 * callers must render the link-hostel empty state, never call with 400.
 */
export async function resolveOwnerHostelId(preferred?: string | null): Promise<string | null> {
  const direct = validHostelId(preferred);
  if (direct) return direct;
  const fromCookie = validHostelId(getHostelId());
  if (fromCookie) return fromCookie;
  try {
    const list = await api.get<Hostel[] | ApiEnvelope<Hostel[]>>(`${PREFIX}/hostels`, {
      params: { limit: 1 },
    });
    const id = toPaginated<HostelDetail>(list.data).items[0]?.id;
    const valid = validHostelId(id);
    if (valid) return valid;
  } catch {
    /* try owner dashboard */
  }
  try {
    const dashRes = await api.get(`${PREFIX}/owner/dashboard`);
    const d = unwrap<Record<string, unknown>>(dashRes.data);
    const dataPart = (d?.data ?? dashRes.data) as Array<Record<string, unknown>> | undefined;
    const summary = Array.isArray(dataPart)
      ? dataPart[0]
      : (d as Record<string, unknown> | undefined);
    const hid =
      summary?.hostelId ??
      summary?.id ??
      (summary?.hostel as Record<string, unknown> | undefined)?.id;
    const valid = validHostelId(String(hid ?? ""));
    if (valid) return valid;
  } catch {
    /* continue */
  }
  return null;
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
 * Map UI fee status → backend canonical enum.
 * UI uses PARTIAL as display alias; backend uses PARTIALLY_PAID.
 * NULL/empty is treated as PENDING for safety (backend rejects null).
 */
export function toBackendFeeStatus(raw: unknown): BackendFeeStatus {
  const v = String(raw ?? "")
    .toUpperCase()
    .trim();
  if (v === "PARTIAL" || v === "PARTIALLY_PAID" || v === "PARTIALLY-PAID") return "PARTIALLY_PAID";
  if (v === "PAID") return "PAID";
  if (v === "OVERDUE") return "OVERDUE";
  return "PENDING";
}

/** UI display alias — PARTIALLY_PAID → PARTIAL. */
export function toDisplayFeeStatus(raw: unknown): FeeStatus {
  const v = String(raw ?? "")
    .toUpperCase()
    .trim();
  if (v === "PARTIALLY_PAID" || v === "PARTIALLY-PAID" || v === "PARTIAL") return "PARTIAL";
  if (v === "PAID" || v === "PENDING" || v === "OVERDUE") return v as FeeStatus;
  return "PENDING";
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

/** Canonical UI payment states (backend spells PARTIAL as PARTIALLY_PAID). */
const PAYMENT_STATUSES = ["PAID", "PENDING", "OVERDUE", "PARTIAL"] as const;

/** Payment-state snapshot for one resident's current billing cycle. */
export interface ResidentFeeSnapshot {
  billingMonth: number | null;
  billingYear: number | null;
  amount: number;
  paidAmount: number;
  dueAmount: number;
  totalPayable: number;
  dueDate: string | null;
  status: Resident["paymentStatus"];
}

/**
 * Normalize the fee embedded in a resident row.
 *
 * `GET /owner/residents` and `GET /hostels/:id/residents` return
 * `{ ..., fee: { billingMonth, billingYear, amount, dueAmount, totalPayable,
 * paidAmount, dueDate, status } }` — the payment state is NESTED under `fee`,
 * not top-level, so a reader that only looks for `paymentStatus` sees nothing.
 * `fee` may also arrive as an array of past cycles, in which case the newest
 * (latest year, then month) wins.
 *
 * Returns `null` when the row carries no fee at all.
 */
export function normalizeResidentFee(raw: unknown): ResidentFeeSnapshot | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  const num = (v: unknown, fb: number): number => {
    const n = typeof v === "string" ? Number(v) : (v as number);
    return Number.isFinite(n) ? n : fb;
  };
  const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
  const pickIn = (src: Record<string, unknown>, ...keys: string[]): unknown => {
    for (const k of keys) {
      const v = src[k];
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return undefined;
  };

  const rawFee = r.fee ?? r.fees ?? r.currentFee ?? r.feeSummary;
  const latest = Array.isArray(rawFee)
    ? [...(rawFee as unknown[])]
        .map((f) => (f ?? {}) as Record<string, unknown>)
        .sort(
          (a, b) =>
            num(pickIn(b, "billingYear", "year"), 0) * 12 +
            num(pickIn(b, "billingMonth", "month"), 0) -
            (num(pickIn(a, "billingYear", "year"), 0) * 12 +
              num(pickIn(a, "billingMonth", "month"), 0))
        )[0]
    : rawFee;
  if (latest === null || latest === undefined || typeof latest !== "object") return null;
  if (Array.isArray(latest)) return null;
  const f = latest as Record<string, unknown>;

  const amount = num(pickIn(f, "amount", "feeAmount", "monthlyRent"), 0);
  const paidAmount = num(pickIn(f, "paidAmount", "paid_amount", "paid"), 0);
  const totalPayable = num(
    pickIn(f, "totalPayable", "total_payable", "amount", "totalAmount", "total"),
    amount
  );
  const computedDue = Math.max(0, totalPayable - paidAmount);
  const dueRaw = pickIn(f, "dueAmount", "due_amount", "outstanding", "remaining");

  // Explicit status wins; otherwise derive it from paid vs. payable.
  const statusRaw = str(pickIn(f, "status", "paymentStatus", "payment_status")).toUpperCase();
  let status: Resident["paymentStatus"];
  if (statusRaw === "PARTIALLY_PAID" || statusRaw === "PARTIALLY-PAID") {
    status = "PARTIAL";
  } else if ((PAYMENT_STATUSES as readonly string[]).includes(statusRaw)) {
    status = statusRaw as Resident["paymentStatus"];
  } else if (totalPayable > 0) {
    status = paidAmount <= 0 ? "PENDING" : paidAmount >= totalPayable ? "PAID" : "PARTIAL";
  } else {
    status = "PENDING";
  }

  const monthRaw = pickIn(f, "billingMonth", "month");
  const yearRaw = pickIn(f, "billingYear", "year");
  // `dueAmount` is authoritative when it is non-zero, but some payloads report
  // 0 for a genuinely unpaid fee (e.g. status OVERDUE with paidAmount 0). In
  // that case `totalPayable - paidAmount` is the honest figure — without this
  // an OVERDUE row would render as "Settled".
  const explicitDue = num(dueRaw, 0);
  const dueAmount = explicitDue > 0 ? explicitDue : computedDue;
  return {
    billingMonth: monthRaw === undefined ? null : num(monthRaw, 0),
    billingYear: yearRaw === undefined ? null : num(yearRaw, 0),
    amount,
    paidAmount,
    dueAmount,
    totalPayable,
    dueDate: str(pickIn(f, "dueDate", "due_date")) || null,
    status,
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
  /** Strip accidental markdown/protocol/www wrappers pasted into email cells. */
  const cleanEmail = (v: unknown): string => {
    const value = str(v).trim();
    const inner = value.match(/\[([^\]]+)\]/)?.[1] ?? value;
    return inner
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .trim();
  };
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
  // Payment state: a top-level status wins; otherwise use the nested fee
  // snapshot (shared with `normalizeResidentFee`, used by the payments page).
  const fee = normalizeResidentFee(raw);
  const explicitPayment = String(pick("paymentStatus", "payment_status", "feeStatus") ?? "")
    .trim()
    .toUpperCase();
  const paymentStatus = (PAYMENT_STATUSES as readonly string[]).includes(explicitPayment)
    ? (explicitPayment as Resident["paymentStatus"])
    : (fee?.status ?? "PENDING");
  const statusRaw = String(
    pick("status", "residentStatus", "resident_status") ?? "ACTIVE"
  ).toUpperCase();
  return {
    id: str(pick("id", "_id", "residentId", "resident_id", `r-${Date.now()}`)),
    name,
    email: cleanEmail(pick("email", "residentEmail")),
    phone: str(pick("phone", "phoneNumber", "phone_number", "contactNumber")),
    roomNumber: str(pickRoom("roomNumber", "room_number", "roomNo", "room")),
    bedNumber: str(pickRoom("bedNumber", "bed_number", "bedNo", "bed")),
    floor: num(pickRoom("floor", "floorNumber", "floor_number"), 0),
    roomType: str(pickRoom("roomType", "room_type")) || undefined,
    paymentStatus: paymentStatus as Resident["paymentStatus"],
    status: (["ACTIVE", "INACTIVE", "PENDING", "VACATED"] as const).includes(
      statusRaw as Resident["status"]
    )
      ? (statusRaw as Resident["status"])
      : "ACTIVE",
    joinedDate: str(
      pick("joinedDate", "joined_date", "admissionDate", "createdAt", "created_at") ?? ""
    ),
    monthlyRent: num(
      pick("monthlyRent", "monthly_rent", "rent", "feeAmount") ??
        (fee ? fee.totalPayable || fee.amount : undefined),
      0
    ),
    avatarUrl:
      (pick("imageUrl", "image_url", "avatarUrl", "avatar", "photoUrl", "profileImage") as
        string | undefined) ?? undefined,
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
  const statusRaw = String(pick("status", "feeStatus", "paymentStatus", "payment_status") ?? "")
    .toUpperCase()
    .trim();
  // Backend canonical enum uses PARTIALLY_PAID — UI uses PARTIAL as display alias.
  const status: Fee["status"] =
    statusRaw === "PARTIALLY_PAID" || statusRaw === "PARTIALLY-PAID" || statusRaw === "PARTIAL"
      ? "PARTIAL"
      : (["PAID", "PENDING", "OVERDUE"] as const).includes(
            statusRaw as "PAID" | "PENDING" | "OVERDUE"
          )
        ? (statusRaw as "PAID" | "PENDING" | "OVERDUE")
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
    let year = toNum(r.billingYear ?? r.billing_year ?? r.year);
    let month = toNum(r.billingMonth ?? r.billing_month ?? r.month);
    if (!Number.isFinite(year) || !Number.isFinite(month)) {
      const p = String(r.period ?? r.label ?? r.monthLabel ?? "");
      const parsed = parseTrendLabel(p);
      if (parsed.year) year = parsed.year;
      if (parsed.month) month = parsed.month;
    }
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
    const outstandingRaw = pick(
      "outstanding",
      "outstandingAmount",
      "remaining",
      "balance",
      "pending",
      "pendingAmount"
    );
    const outstanding = outstandingRaw === undefined ? undefined : num(outstandingRaw, 0);
    const pending = num(pick("pending", "pendingAmount"), outstanding ?? 0);
    // Backend sends either billed or outstanding; billed wins, else derive it.
    const billed =
      billedRaw === undefined
        ? outstanding === undefined
          ? undefined
          : collected + outstanding
        : num(billedRaw, 0);
    const formattedLabel = dashboardMonthLabel(billingMonth, billingYear);
    return {
      label: formattedLabel || rawLabel || "—",
      billingMonth,
      billingYear,
      collected,
      billed,
      outstanding,
      pending,
      period: rawLabel || undefined,
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

/* ------------------------------------------------------------------ */
/* Staff normalizers (owner dashboard)                                 */
/* ------------------------------------------------------------------ */

/** Photo may arrive as `photoUrl` / `photo` / `avatarUrl` / `imageUrl` / `image`. */
export function staffPhotoOf(raw: unknown): string | undefined {
  const r = (raw ?? {}) as Record<string, unknown>;
  for (const k of ["photoUrl", "photo", "avatarUrl", "imageUrl", "image"]) {
    const v = r[k];
    if (typeof v === "string" && v.trim()) return v;
    // Backend may nest the file record: { photo: { url } }.
    if (v !== null && typeof v === "object") {
      const nested = (v as Record<string, unknown>).url ?? (v as Record<string, unknown>).secureUrl;
      if (typeof nested === "string" && nested.trim()) return nested;
    }
  }
  return undefined;
}

/** Backend id may be `id` / `_id` / `staffId`. */
export function staffIdOf(raw: unknown, fallback = ""): string {
  const r = (raw ?? {}) as Record<string, unknown>;
  for (const k of ["id", "_id", "staffId"]) {
    const v = r[k];
    if (typeof v === "string" && v.trim()) return v;
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return fallback;
}

/** Normalize one backend staff record (canonical + legacy field variants). */
export function normalizeStaff(raw: unknown): Staff {
  const r = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown): string => (typeof v === "string" ? v : String(v ?? ""));
  const pick = (...keys: string[]): unknown => {
    for (const k of keys) {
      const v = r[k];
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return undefined;
  };
  const numOrUndef = (v: unknown): number | undefined => {
    if (v === undefined || v === null || v === "") return undefined;
    const n = typeof v === "string" ? Number(v) : (v as number);
    return Number.isFinite(n) ? n : undefined;
  };
  const rawStatus = str(pick("status", "employmentStatus") || "ACTIVE").toUpperCase();
  const status: Staff["status"] =
    rawStatus === "ACTIVE" ||
    rawStatus === "ON LEAVE" ||
    rawStatus === "ON_LEAVE" ||
    rawStatus === "INACTIVE"
      ? rawStatus === "ON_LEAVE"
        ? "ON LEAVE"
        : (rawStatus as Staff["status"])
      : "ACTIVE";
  return {
    ...r,
    id: staffIdOf(r),
    name: str(pick("name", "fullName", "staffName") || "Staff"),
    role: str(pick("role", "position", "designation") || ""),
    phone: str(pick("phone", "phoneNumber", "mobile", "contact") || ""),
    email: str(pick("email") || "") || undefined,
    shift: str(pick("shift", "dutyShift") || "") || undefined,
    status,
    salary: numOrUndef(pick("salary", "monthlySalary", "monthly_salary")),
    emergencyContact:
      str(pick("emergencyContact", "emergencyPhone", "emergency_contact") || "") || undefined,
    joinDate:
      str(pick("joinDate", "joinedAt", "joiningDate", "joinedDate", "createdAt") || "") ||
      undefined,
    notes: str(pick("notes", "remarks") || "") || undefined,
    address: str(pick("address") || "") || undefined,
    hostelId: str(pick("hostelId", "hostel_id") || "") || undefined,
    hostelName: str(pick("hostelName", "hostel") || "") || undefined,
    photoUrl: staffPhotoOf(r),
  };
}

/** Normalize list payloads: raw array, `{ data: [...] }`, `{ staff: [...] }`. */
export function normalizeStaffList(payload: unknown): Staff[] {
  const items = toPaginated<unknown>(payload).items;
  if (items.length > 0) return items.map(normalizeStaff);
  const root = (payload ?? {}) as Record<string, unknown>;
  for (const k of ["staff", "staffs", "members", "results", "rows"]) {
    if (Array.isArray(root[k])) return (root[k] as unknown[]).map(normalizeStaff);
  }
  return [];
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
  // One level of nesting: `data` / `summary` / `stats` / `overview` / `result`,
  // plus the admin payload's `health`, `stats.occupancy`, `trends`, `feeLifecycle`, `finance`, `planMix` blocks.
  for (const key of [
    "data",
    "summary",
    "stats",
    "overview",
    "result",
    "health",
    "occupancy",
    "trends",
    "feeLifecycle",
    "finance",
    "planMix",
  ]) {
    const v = root[key];
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      scopes.push(v as Record<string, unknown>);
    }
  }
  // `data.stats.occupancy` sits two levels deep.
  const stats = root["stats"];
  if (stats !== null && typeof stats === "object" && !Array.isArray(stats)) {
    const occ = (stats as Record<string, unknown>)["occupancy"];
    if (occ !== null && typeof occ === "object" && !Array.isArray(occ)) {
      scopes.push(occ as Record<string, unknown>);
    }
  }
  return scopes;
}

function analyticsNum(v: unknown, fallback = 0): number {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : fallback;
}

/** `finiteNum`: number (or numeric string) → number, anything else → undefined. */
function finiteNum(v: unknown): number | undefined {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
}

/** `strOrUndefined`: non-empty trimmed string → string, else undefined. */
function strOrUndefined(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() !== "" ? v : undefined;
}

function analyticsFeeCounts(
  pick: (...keys: string[]) => unknown,
  root?: Record<string, unknown>
): OwnerSummaryFeeCounts | undefined {
  const feeLc = (pick("feeLifecycle", "fee_lifecycle") ?? root?.feeLifecycle) as
    Record<string, unknown> | undefined;
  if (feeLc && typeof feeLc === "object") {
    return {
      paid: analyticsNum(feeLc.paid, 0),
      pending: analyticsNum(feeLc.pending, 0),
      partial: analyticsNum(feeLc.partiallyPaid ?? feeLc.partial ?? feeLc.partially_paid, 0),
      overdue: analyticsNum(feeLc.overdue, 0),
    };
  }
  const num = (v: unknown): number | undefined =>
    v === undefined ? undefined : analyticsNum(v, 0);
  const paid = num(pick("paidFees", "paid_fees", "paidCount", "paid"));
  const pending = num(pick("pendingFees", "pending_fees", "pendingCount", "pending"));
  const partial = num(
    pick("partialFees", "partial_fees", "partialCount", "partiallyPaid", "partial")
  );
  const overdue = num(pick("overdueFees", "overdue_fees", "overdueCount", "overdue"));
  if (
    paid === undefined &&
    pending === undefined &&
    partial === undefined &&
    overdue === undefined
  ) {
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
  /**
   * Numeric pick that REJECTS objects/arrays. Needed because the admin payload
   * nests `occupancy` as an object inside `stats` — without this guard the
   * flat `"occupancy"` alias would resolve to that object and coerce to 0.
   */
  const optNum = (...keys: string[]): number | undefined => {
    const v = pick(...keys);
    if (v === undefined || typeof v === "object") return undefined;
    return analyticsNum(v, 0);
  };
  const root = (unwrap<Record<string, unknown>>(raw) ?? {}) as Record<string, unknown>;

  const totalBeds = optNum("totalBeds", "total_beds", "beds");
  const occupiedBeds = optNum("occupiedBeds", "occupied_beds", "occupied", "bedsOccupied");
  const totalResidents = optNum(
    "totalResidents",
    "total_residents",
    "residents",
    "residentCount",
    "activeResidents"
  );
  const paidAmount = optNum("paidAmount", "paid_amount", "collectedAmount", "collected");
  const outstanding = optNum(
    "outstandingAmount",
    "outstanding_amount",
    "outstanding",
    "pendingDues"
  );
  const paidPlans = optNum("mrrPaidPlans", "mrr_paid_plans");
  const mrr = optNum("mrr", "monthlyRevenue", "monthly_revenue", "revenue");

  // `stats.occupancy.rate` is a 0–1 fraction; the UI shows a percentage.
  // Prefer deriving from bed counts so a rounded/quantized rate can't mislead.
  const rawRate = optNum("rate", "occupancyRate", "occupancy_rate");
  const occupancyRate =
    rawRate === undefined
      ? undefined
      : totalBeds && totalBeds > 0 && occupiedBeds !== undefined
        ? Math.round((occupiedBeds / totalBeds) * 100)
        : Math.round(rawRate * 100);

  const activePlans = optNum("activePlans", "active_plans", "activeSubscriptions");

  return {
    totalHostels: optNum("totalHostels", "total_hostels", "hostelCount", "hostels"),
    totalResidents,
    users: optNum("users", "totalUsers", "total_users", "userCount"),
    activeResidents: optNum("activeResidents", "active_residents"),
    pendingBookings: optNum("pendingBookings", "pending_bookings"),
    pendingLeaves: optNum("pendingLeaves", "pending_leaves"),
    unpaidFees: optNum("unpaidFees", "unpaid_fees"),
    paidAmount,
    outstandingAmount: outstanding,
    currency: (pick("currency", "mrrCurrency") as string | undefined) ?? undefined,
    mrr,
    mrrBasis: (pick("mrrBasis", "mrr_basis") as string | undefined) ?? undefined,
    monthlyRevenue: optNum("monthlyRevenue", "monthly_revenue", "mrr", "revenue"),
    totalRevenue: optNum("totalRevenue", "total_revenue", "paidAmount", "revenue"),
    pendingAmount: optNum(
      "pendingAmount",
      "pending_amount",
      "outstandingAmount",
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
    occupancyRate,
    totalBeds,
    occupiedBeds,
    availableBeds: optNum("availableBeds", "available_beds"),
    totalRooms: optNum("totalRooms", "total_rooms", "rooms", "roomCount"),
    activePlans: activePlans ?? (paidPlans !== undefined ? String(paidPlans) : undefined),
    generatedAt: (pick("generatedAt", "generated_at") as string | undefined) ?? undefined,
    isCached: typeof root.isCached === "boolean" ? root.isCached : undefined,
    cacheLevel: (root.cacheLevel as string | undefined) ?? undefined,
    pendingApprovals: normalizeAdminPendingApprovals(pick("pendingApprovals")),
    recentHostels: normalizeAdminRecentHostels(
      pick("recentHostels", "recent_hostels") ?? root.recentHostels
    ),
    stats: normalizeAdminStats(pick("stats")),
    health: normalizeAdminHealth(pick("health")),
    revenueTrend: normalizeRevenueTrend(
      pick("revenueTrend", "revenue_trend", "revenueSeries", "revenueByMonth") ??
        (root.trends as Record<string, unknown> | undefined)?.revenue ??
        (pick("trends") as Record<string, unknown> | undefined)?.revenue ??
        root.revenueTrend
    ),
    feeLifecycle: normalizeAdminFeeLifecycle(
      pick("feeLifecycle", "fee_lifecycle") ?? root.feeLifecycle
    ),
    feeCounts: analyticsFeeCounts(pick, root),
    finance: (pick("finance") ?? root.finance) as AdminSummary["finance"],
    planMix: (pick("planMix", "plan_mix") ?? root.planMix) as AdminSummary["planMix"],
    trends:
      (pick("trends") ?? root.trends)
        ? {
            ...((pick("trends") ?? root.trends) as Record<string, unknown>),
            revenue: normalizeRevenueTrend(
              pick("revenueTrend", "revenue_trend", "revenueSeries", "revenueByMonth") ??
                (root.trends as Record<string, unknown> | undefined)?.revenue ??
                (pick("trends") as Record<string, unknown> | undefined)?.revenue ??
                root.revenueTrend
            ),
          }
        : undefined,
  };
}

function normalizeAdminFeeLifecycle(raw: unknown): AdminFeeLifecycle | undefined {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown): number => {
    const n = typeof v === "string" ? Number(v) : (v as number);
    return Number.isFinite(n) ? n : 0;
  };
  const total = num(r.total ?? r.totalFees ?? r.total_fees ?? r.count);
  const paid = num(r.paid ?? r.paidFees ?? r.paid_fees);
  const pending = num(r.pending ?? r.pendingFees ?? r.pending_fees);
  const overdue = num(r.overdue ?? r.overdueFees ?? r.overdue_fees);
  const partiallyPaid = num(r.partiallyPaid ?? r.partial ?? r.partially_paid);
  return {
    total: total || paid + pending + overdue + partiallyPaid,
    paid,
    pending,
    overdue,
    partiallyPaid,
  };
}

function normalizeAdminPendingApprovals(raw: unknown): AdminSummaryPendingApprovals | undefined {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  const count = r.count ?? r.total;
  const reviewUrl = r.reviewUrl ?? r.review_url;
  const n = typeof count === "string" ? Number(count) : count;
  return {
    count: typeof n === "number" && Number.isFinite(n) ? n : undefined,
    reviewUrl: typeof reviewUrl === "string" ? reviewUrl : undefined,
  };
}

function normalizeAdminStats(raw: unknown): AdminSummaryStats | undefined {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  const occRaw = r.occupancy;
  const occ = (
    occRaw !== null && typeof occRaw === "object" && !Array.isArray(occRaw)
      ? (occRaw as Record<string, unknown>)
      : {}
  ) as Record<string, unknown>;
  return {
    totalHostels: finiteNum(r.totalHostels ?? r.total_hostels),
    totalResidents: finiteNum(r.totalResidents ?? r.total_residents),
    mrr: finiteNum(r.mrr),
    mrrBasis: strOrUndefined(r.mrrBasis ?? r.mrr_basis),
    mrrCurrency: strOrUndefined(r.mrrCurrency ?? r.mrr_currency),
    mrrPaidPlans: finiteNum(r.mrrPaidPlans),
    mrrFreePlans: finiteNum(r.mrrFreePlans),
    mrrLapsedPlans: finiteNum(r.mrrLapsedPlans),
    occupancy: {
      totalBeds: finiteNum(occ.totalBeds),
      occupiedBeds: finiteNum(occ.occupiedBeds),
      availableBeds: finiteNum(occ.availableBeds),
      rate: finiteNum(occ.rate),
    },
  };
}

function normalizeAdminHealth(raw: unknown): AdminSummaryHealth | undefined {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  return {
    monthlyRevenue: finiteNum(r.monthlyRevenue ?? r.monthly_revenue),
    totalRevenue: finiteNum(r.totalRevenue ?? r.total_revenue),
    pendingDues: finiteNum(r.pendingDues ?? r.pending_dues),
    rooms: finiteNum(r.rooms ?? r.totalRooms),
    bedsOccupied: finiteNum(r.bedsOccupied ?? r.occupiedBeds),
    activePlans: finiteNum(r.activePlans ?? r.active_plans),
    currency: strOrUndefined(r.currency),
    collectionRate: finiteNum(r.collectionRate ?? r.collection_rate),
  };
}

/**
 * Normalize one GET /admin/hostels (or /hostels) row onto the `Hostel` shape.
 *
 * Live payload (verified against the backend):
 *   `{ id, name, type, city, address, phone, email, logoUrl,
 *      owner: { id, firstName, lastName, email, phone, avatarUrl },
 *      rooms, beds, occupied }`
 *
 * The counts arrive as `rooms` / `beds` / `occupied`, NOT as `totalRooms` /
 * `totalBeds` / `occupiedBeds`, and the owner arrives as a nested object with
 * `firstName` + `lastName` rather than a flat `ownerName`. Rendering the raw
 * row produced "undefined/undefined" in the Occupancy column and a blank Owner
 * column, so every list consumer must normalize before rendering.
 *
 * `status` is absent from the list payload; it is derived the same way the
 * backend does — an assigned owner means ACTIVE, otherwise PENDING.
 * A real backend status (ACTIVE / SUSPENDED / INACTIVE / BANNED / DISABLED /
 * PENDING / …) always wins; only a missing/unknown value is derived.
 */
export function normalizeHostel(raw: unknown): Hostel {
  const r = (raw ?? {}) as Record<string, unknown>;
  const pick = (...keys: string[]): unknown => {
    for (const key of keys) {
      const v = r[key];
      if (v !== undefined && v !== null && v !== "") return v;
    }
    // Also look one level down — suspend responses nest the hostel under
    // `hostel` / `data.hostel` while the list returns it flat.
    for (const nest of ["hostel", "data"] as const) {
      const n = r[nest];
      if (n !== null && typeof n === "object" && !Array.isArray(n)) {
        for (const key of keys) {
          const v = (n as Record<string, unknown>)[key];
          if (v !== undefined && v !== null && v !== "") return v;
        }
      }
    }
    return undefined;
  };
  const count = (...keys: string[]): number => {
    const n = finiteNum(pick(...keys));
    return n !== undefined && n >= 0 ? n : 0;
  };

  const ownerRaw = r.owner;
  const o =
    ownerRaw !== null && typeof ownerRaw === "object" && !Array.isArray(ownerRaw)
      ? (ownerRaw as Record<string, unknown>)
      : null;
  const owner = o
    ? {
        id: strOrUndefined(o.id) ?? strOrUndefined(o.ownerId) ?? "",
        firstName: strOrUndefined(o.firstName) ?? strOrUndefined(o.first_name) ?? "",
        lastName: strOrUndefined(o.lastName) ?? strOrUndefined(o.last_name) ?? "",
        email: strOrUndefined(o.email) ?? "",
        phone: strOrUndefined(o.phone) ?? strOrUndefined(o.phoneNumber) ?? null,
        avatarUrl: strOrUndefined(o.avatarUrl) ?? strOrUndefined(o.avatar_url) ?? null,
      }
    : null;

  const firstName = owner?.firstName ?? "";
  const lastName = owner?.lastName ?? "";
  const ownerName =
    strOrUndefined(pick("ownerName", "owner_name")) ??
    strOrUndefined(o ? `${firstName} ${lastName}`.trim() : undefined) ??
    (owner ? null : "No owner");

  const logoUrl = strOrUndefined(pick("logoUrl", "logo_url", "imageUrl", "image_url")) ?? null;

  const statusRaw = strOrUndefined(
    pick("status", "hostelStatus", "hostel_status", "state", "isActive", "is_active", "active")
  )?.toUpperCase();
  // Backend may send booleans (isActive / active) instead of a status string.
  const boolActive =
    pick("isActive", "is_active", "active") === true
      ? "ACTIVE"
      : pick("isActive", "is_active", "active") === false
        ? "SUSPENDED"
        : null;
  const effectiveRaw =
    statusRaw === "TRUE" || statusRaw === "FALSE" ? null : (statusRaw ?? boolActive);
  const backendStatus =
    effectiveRaw === "ACTIVE" || effectiveRaw === "SUSPENDED"
      ? effectiveRaw
      : effectiveRaw === "INACTIVE" ||
          effectiveRaw === "BANNED" ||
          effectiveRaw === "DISABLED" ||
          effectiveRaw === "BLOCKED" ||
          effectiveRaw === "SUSPEND"
        ? ("SUSPENDED" as const)
        : effectiveRaw === "PENDING"
          ? ("PENDING" as const)
          : null;
  const status: Hostel["status"] = backendStatus ?? (owner ? "ACTIVE" : "PENDING");

  return {
    id: strOrUndefined(pick("id", "hostelId", "hostel_id")) ?? "",
    name: strOrUndefined(pick("name", "hostelName", "hostel_name")) ?? "Unnamed hostel",
    type: strOrUndefined(pick("type", "hostelType", "hostel_type")),
    address: strOrUndefined(pick("address")) ?? "",
    city: strOrUndefined(pick("city")) ?? "",
    phone: strOrUndefined(pick("phone", "phoneNumber", "phone_number")) ?? "",
    email: strOrUndefined(pick("email")) ?? owner?.email ?? "",
    totalRooms: count("totalRooms", "total_rooms", "rooms", "roomCount", "room_count"),
    totalBeds: finiteNum(pick("totalBeds", "total_beds", "beds", "bedCount")) ?? null,
    occupiedBeds: count("occupiedBeds", "occupied_beds", "occupied", "bedsOccupied"),
    status,
    ownerName,
    owner,
    logoUrl,
  };
}

/** Normalize a paginated/raw hostel list payload into `Hostel[]`. */
export function normalizeHostelList(payload: unknown): Hostel[] {
  return toPaginated<unknown>(payload).items.map(normalizeHostel);
}

function normalizeAdminRecentHostels(raw: unknown): AdminRecentHostel[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (item === null || typeof item !== "object") return null;
      const r = item as Record<string, unknown>;
      const ownerRaw = r.owner;
      const o = (
        ownerRaw !== null && typeof ownerRaw === "object" && !Array.isArray(ownerRaw)
          ? (ownerRaw as Record<string, unknown>)
          : null
      ) as Record<string, unknown> | null;
      const id = strOrUndefined(r.id) ?? strOrUndefined(r.hostelId) ?? "";
      const name = strOrUndefined(r.name) ?? strOrUndefined(r.hostelName) ?? "";
      if (!id && !name) return null;
      const row: AdminRecentHostel = {
        id: id || name,
        name: name || "Unnamed hostel",
        type: strOrUndefined(r.type) ?? strOrUndefined(r.hostelType),
        city: strOrUndefined(r.city),
        logoUrl: strOrUndefined(r.logoUrl) ?? strOrUndefined(r.imageUrl) ?? null,
        createdAt: strOrUndefined(r.createdAt) ?? strOrUndefined(r.created_at) ?? null,
        owner: null,
      };
      if (o) {
        row.owner = {
          id: strOrUndefined(o.id),
          name: strOrUndefined(o.name) ?? strOrUndefined(o.ownerName),
          email: strOrUndefined(o.email),
          avatarUrl: strOrUndefined(o.avatarUrl) ?? strOrUndefined(o.avatar_url) ?? null,
        };
      }
      return row;
    })
    .filter((h): h is AdminRecentHostel => h !== null);
}

/* ---------------- Subscriptions (live contract) ---------------- */

function normalizePlanFeatures(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((f) => {
      if (typeof f === "string") return f;
      if (f !== null && typeof f === "object" && "label" in f) {
        return String((f as { label?: unknown }).label ?? "");
      }
      return "";
    })
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeBackendPlan(raw: unknown): BackendPlan {
  const r = (raw ?? {}) as Record<string, unknown>;
  const pick = (...keys: string[]): unknown => {
    for (const k of keys) {
      const v = r[k];
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return undefined;
  };
  const limits = (pick("limits") ?? {}) as Record<string, unknown>;
  const numOrNull = (v: unknown): number | null | undefined => {
    if (v === undefined) return undefined;
    if (v === null) return null;
    const n = typeof v === "string" ? Number(v) : (v as number);
    return Number.isFinite(n) ? n : undefined;
  };
  const flags = (pick("featureFlags", "feature_flags", "flags") ?? {}) as Record<string, unknown>;
  return {
    id: String(pick("id", "plan", "code") ?? "FREE").toUpperCase() as BackendPlan["id"],
    name: String(pick("name", "title") ?? ""),
    tagline: (pick("tagline", "description") as string | undefined) ?? undefined,
    price: numOrNull(pick("price", "priceMonthly", "amount")) ?? undefined,
    currency: (pick("currency") as string | undefined) ?? "NPR",
    billingPeriod: (pick("billingPeriod", "billing_period") as string | undefined) ?? undefined,
    formattedPrice: (pick("formattedPrice", "formatted_price") as string | undefined) ?? undefined,
    badge: (pick("badge") as string | null | undefined) ?? null,
    features: normalizePlanFeatures(pick("features", "featureList")),
    buttonText: (pick("buttonText", "button_text", "cta") as string | undefined) ?? undefined,
    cta: (pick("cta", "buttonText", "button_text") as string | undefined) ?? undefined,
    limits:
      Object.keys(limits).length > 0
        ? {
            residents: numOrNull(limits.residents ?? limits.maxResidents),
            hostels: numOrNull(limits.hostels ?? limits.maxHostels),
            maxResidents: numOrNull(limits.maxResidents ?? limits.residents),
            maxHostels: numOrNull(limits.maxHostels ?? limits.hostels),
          }
        : null,
    featureFlags: Object.fromEntries(Object.entries(flags).map(([k, v]) => [k, Boolean(v)])),
    isCurrent: Boolean(pick("isCurrent", "is_current", "current")),
  };
}

/** Normalize `GET /subscriptions/plans` tier list (isCurrent when personalized). */
export function normalizePlans(raw: unknown): BackendPlan[] {
  const data = unwrap<unknown>(raw);
  const arr = Array.isArray(data)
    ? data
    : Array.isArray((data as { plans?: unknown })?.plans)
      ? (data as { plans: unknown[] }).plans
      : [];
  return arr.map((item) => {
    const scoped =
      item !== null && typeof item === "object" && "data" in (item as Record<string, unknown>)
        ? ((item as { data?: unknown }).data ?? item)
        : item;
    return normalizeBackendPlan(scoped);
  });
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
/* ------------------------------------------------------------------ */
/* Invoice normalizers (owner dashboard)                             */
/* ------------------------------------------------------------------ */

const INVOICE_MONTH_LABELS = [
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

/** "2026-09" → { month: 9, year: 2026 }; "Sep 2026" → same. */
export function splitBillingMonthInput(input: string): { month: number; year: number } | null {
  const t = (input ?? "").trim();
  let m = t.match(/^(\d{4})-(\d{1,2})$/);
  if (m) return { year: Number(m[1]), month: Number(m[2]) };
  m = t.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})$/i);
  if (m) {
    const idx = INVOICE_MONTH_LABELS.findIndex(
      (x) => x.toLowerCase() === m[1].slice(0, 3).toLowerCase()
    );
    if (idx >= 0) return { month: idx + 1, year: Number(m[2]) };
  }
  return null;
}

export function invoiceMonthLabel(month?: number | string, year?: number | string): string {
  const mo = typeof month === "string" ? Number(month) : month;
  if (!mo || mo < 1 || mo > 12) return typeof month === "string" && month ? month : "—";
  const short = INVOICE_MONTH_LABELS[mo - 1];
  const y = typeof year === "string" ? Number(year) : year;
  return y && y > 0 ? `${short} ${y}` : short;
}

/** Normalize one backend invoice row (fee-ledger + dedicated-invoice variants). */
export function normalizeInvoice(raw: unknown): Invoice {
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
  const str = (v: unknown): string => (typeof v === "string" ? v : String(v ?? ""));
  const email = str(pick("residentEmail", "email", "resident_email", "gmail", "mail") || "");
  const name =
    str(pick("residentName", "name", "fullName", "resident_name") || "") ||
    [pick("firstName", "first_name"), pick("lastName", "last_name")]
      .filter((v) => typeof v === "string" && (v as string).trim())
      .join(" ") ||
    "Resident";
  return {
    ...r,
    id: str(pick("id", "_id", "invoiceId", "feeId") || `inv-${Date.now()}`),
    hostelId: (pick("hostelId", "hostel_id") as string | undefined) ?? undefined,
    residentId: (pick("residentId", "resident_id") as string | undefined) ?? undefined,
    residentName: name,
    residentEmail: email || undefined,
    amount:
      (pick("amount", "totalPayable", "total_payable", "total") as number | string | undefined) ??
      0,
    billingMonth: pick("billingMonth", "billing_month", "month") as number | string | undefined,
    billingYear: pick("billingYear", "billing_year", "year") as number | string | undefined,
    dueDate: str(pick("dueDate", "due_date", "dueDateAt") || ""),
    status: String(pick("status") ?? "DRAFT").toUpperCase(),
  };
}

/** Normalize list payloads: raw array, `{ data: [...] }`, `{ invoices: [...] }`. */
export function normalizeInvoiceList(payload: unknown): Invoice[] {
  const items = toPaginated<unknown>(payload).items;
  if (items.length > 0) return items.map(normalizeInvoice);
  const root = (payload ?? {}) as Record<string, unknown>;
  for (const k of ["invoices", "fees", "bills", "results", "rows"]) {
    if (Array.isArray(root[k])) return (root[k] as unknown[]).map(normalizeInvoice);
  }
  return [];
}

/** Normalize `GET /subscriptions/current` (nullable sub + plan + usage). */
export function normalizeSubscriptionCurrent(raw: unknown): SubscriptionCurrent {
  const data = unwrap<Record<string, unknown>>(raw) ?? {};
  // Tolerate root subscription object, nested subscription/current/activeSubscription, or flat data
  const rawSub = (data.subscription ??
    data.current ??
    data.activeSubscription ??
    data.currentSubscription ??
    (typeof data === "object" &&
    ("plan" in data ||
      "currentPlan" in data ||
      "planName" in data ||
      "status" in data ||
      "id" in data)
      ? data
      : null)) as Record<string, unknown> | null;
  const nested = (data.plan ?? rawSub?.plan) as Record<string, unknown> | string | null | undefined;
  const extractedPlan = toPlanId(
    rawSub?.plan ??
      rawSub?.planName ??
      rawSub?.currentPlan ??
      rawSub?.tier ??
      rawSub?.name ??
      data.plan ??
      data.currentPlan ??
      data.planName ??
      (nested !== null && typeof nested === "object"
        ? ((nested as Record<string, unknown>).id ?? (nested as Record<string, unknown>).name)
        : nested)
  );
  const hasSub =
    rawSub !== null &&
    typeof rawSub === "object" &&
    ("id" in rawSub || "plan" in rawSub || "status" in rawSub || extractedPlan !== undefined);
  const limits = (data.limits ?? data.usage ?? rawSub?.limits ?? rawSub?.usage ?? null) as Record<
    string,
    unknown
  > | null;
  const num = (v: unknown): number | undefined => {
    if (v === undefined || v === null || v === "") return undefined;
    const n = typeof v === "string" ? Number(v) : (v as number);
    return Number.isFinite(n) ? n : undefined;
  };
  const numOrNull = (v: unknown): number | null | undefined => {
    if (v === undefined || v === "") return undefined;
    if (v === null) return null;
    const n = typeof v === "string" ? Number(v) : (v as number);
    return Number.isFinite(n) ? n : undefined;
  };
  return {
    subscription: hasSub
      ? {
          id:
            rawSub?.id != null ? String(rawSub.id) : data.id != null ? String(data.id) : undefined,
          plan: extractedPlan,
          status: toSubStatus(rawSub?.status ?? data.status ?? "ACTIVE"),
          billingCycle: toBilling(rawSub?.billingCycle ?? data.billingCycle),
          price:
            typeof (rawSub?.price ?? data.price) === "number" ||
            typeof (rawSub?.price ?? data.price) === "string"
              ? ((rawSub?.price ?? data.price) as string | number)
              : undefined,
          currency:
            typeof (rawSub?.currency ?? data.currency) === "string"
              ? ((rawSub?.currency ?? data.currency) as string)
              : undefined,
          startDate:
            typeof (rawSub?.startDate ?? data.startDate) === "string"
              ? ((rawSub?.startDate ?? data.startDate) as string)
              : undefined,
          endDate:
            rawSub?.endDate === null || data.endDate === null
              ? null
              : typeof (rawSub?.endDate ?? data.endDate) === "string"
                ? ((rawSub?.endDate ?? data.endDate) as string)
                : undefined,
          autoRenew:
            typeof (rawSub?.autoRenew ?? data.autoRenew) === "boolean"
              ? ((rawSub?.autoRenew ?? data.autoRenew) as boolean)
              : undefined,
          hostelId:
            typeof (rawSub?.hostelId ?? data.hostelId) === "string"
              ? ((rawSub?.hostelId ?? data.hostelId) as string)
              : undefined,
        }
      : null,
    plan:
      nested === null || nested === undefined
        ? null
        : typeof nested === "string"
          ? normalizeBackendPlan({ id: nested })
          : normalizeBackendPlan({ ...nested, isCurrent: true }),
    limits: limits
      ? {
          residentCount: num(limits.residentCount ?? limits.residentsUsed ?? limits.used),
          residentLimit:
            numOrNull(limits.residentLimit ?? limits.residentsLimit ?? limits.limit) ??
            (extractedPlan === "PRO" || extractedPlan === "ENTERPRISE" ? null : 10),
          residentLimitReached:
            typeof limits.residentLimitReached === "boolean"
              ? limits.residentLimitReached
              : undefined,
          hostelCount: num(limits.hostelCount ?? limits.hostelsUsed),
          hostelLimit: numOrNull(limits.hostelLimit ?? limits.hostelsLimit),
          hostelLimitReached:
            typeof limits.hostelLimitReached === "boolean" ? limits.hostelLimitReached : undefined,
        }
      : null,
    daysRemaining: num(data.daysRemaining ?? data.days_left ?? data.daysLeft) ?? null,
  };
}

export function toPlanId(v: unknown): SubscriptionPlanId | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    return toPlanId(
      obj.id ??
        obj.planId ??
        obj.plan_id ??
        obj.name ??
        obj.code ??
        obj.plan ??
        obj.tier ??
        obj.planName
    );
  }
  const s = String(v).toUpperCase().trim();
  if (s === "FREE" || s === "BASIC" || s === "PRO" || s === "ENTERPRISE")
    return s as SubscriptionPlanId;
  if (s.includes("ENTERPRISE")) return "ENTERPRISE";
  if (s.includes("PRO")) return "PRO";
  if (s.includes("BASIC")) return "BASIC";
  if (s.includes("FREE")) return "FREE";
  return undefined;
}

function toSubStatus(
  v: unknown
): SubscriptionCurrent["subscription"] extends infer _U
  ? import("./api-types").SubscriptionStatus | undefined
  : never {
  if (v === undefined || v === null || v === "") return undefined as never;
  const s = String(v).toUpperCase().trim();
  if (s.includes("ACTIVE") || s === "PAID" || s === "APPROVED") return "ACTIVE" as never;
  if (s.includes("PENDING")) return "PENDING" as never;
  if (s.includes("CANCEL")) return "CANCELLED" as never;
  if (s.includes("EXPIRE")) return "EXPIRED" as never;
  if (s.includes("REJECT")) return "REJECTED" as never;
  return s as never;
}

function toBilling(v: unknown): import("./api-types").BillingCycle | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  return String(v).toUpperCase() as import("./api-types").BillingCycle;
}

/** Normalize `GET /subscriptions/check-limit` (200 allowed or blocked). */
export function normalizeCheckLimit(raw: unknown): SubscriptionCheckLimit {
  const data = unwrap<Record<string, unknown>>(raw) ?? {};
  const num = (v: unknown): number | undefined => {
    if (v === undefined || v === null || v === "") return undefined;
    const n = typeof v === "string" ? Number(v) : (v as number);
    return Number.isFinite(n) ? n : undefined;
  };
  const numOrNull = (v: unknown): number | null | undefined => {
    if (v === undefined || v === "") return undefined;
    if (v === null) return null;
    const n = typeof v === "string" ? Number(v) : (v as number);
    return Number.isFinite(n) ? n : undefined;
  };
  const planRaw = data.currentPlan ?? data.plan ?? data.planName;
  return {
    allowed: typeof data.allowed === "boolean" ? data.allowed : undefined,
    currentPlan: toPlanId(planRaw),
    planName: typeof data.planName === "string" ? data.planName : undefined,
    limit: numOrNull(data.limit ?? data.residentLimit),
    currentCount: num(data.currentCount ?? data.residentCount ?? data.used),
    message: typeof data.message === "string" ? data.message : undefined,
    hint: typeof data.hint === "string" ? data.hint : undefined,
  };
}

/** Normalize `GET /subscriptions/history` (newest first, with hostel). */
export function normalizeSubscriptionHistory(raw: unknown): SubscriptionHistoryItem[] {
  const data = unwrap<unknown>(raw);
  const arr = Array.isArray(data) ? data : [];
  return arr.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    const hostel = (r.hostel ?? null) as Record<string, unknown> | null;
    return {
      id: r.id != null ? String(r.id) : undefined,
      plan: toPlanId(r.plan),
      status: toSubStatusLoose(r.status),
      billingCycle: toBilling(r.billingCycle),
      price: typeof r.price === "number" || typeof r.price === "string" ? r.price : undefined,
      currency: typeof r.currency === "string" ? r.currency : undefined,
      startDate: typeof r.startDate === "string" ? r.startDate : undefined,
      endDate: r.endDate === null ? null : typeof r.endDate === "string" ? r.endDate : undefined,
      cancelledAt:
        r.cancelledAt === null
          ? null
          : typeof r.cancelledAt === "string"
            ? r.cancelledAt
            : undefined,
      hostelId: typeof r.hostelId === "string" ? r.hostelId : undefined,
      hostel:
        hostel !== null && typeof hostel === "object"
          ? {
              id: hostel.id != null ? String(hostel.id) : undefined,
              name: typeof hostel.name === "string" ? hostel.name : undefined,
            }
          : null,
      hostelName: typeof r.hostelName === "string" ? r.hostelName : undefined,
      createdAt: typeof r.createdAt === "string" ? r.createdAt : undefined,
      paymentMethod:
        typeof r.paymentMethod === "string"
          ? (r.paymentMethod.toUpperCase() as SubscriptionHistoryItem["paymentMethod"])
          : undefined,
      paymentReference:
        r.paymentReference === null
          ? null
          : typeof r.paymentReference === "string"
            ? r.paymentReference
            : undefined,
      proofUrl:
        r.proofUrl === null ? null : typeof r.proofUrl === "string" ? r.proofUrl : undefined,
      reviewNote:
        r.reviewNote === null ? null : typeof r.reviewNote === "string" ? r.reviewNote : undefined,
      reviewedAt:
        r.reviewedAt === null ? null : typeof r.reviewedAt === "string" ? r.reviewedAt : undefined,
    };
  });
}

/**
 * Normalize `GET /subscriptions/requests` (admin review queue). Tolerates
 * `{ data }` envelopes, raw arrays and paginated `{ data, meta }` payloads.
 */
export function normalizeSubscriptionRequests(raw: unknown): SubscriptionRequest[] {
  const data = unwrap<unknown>(raw);
  const arr = Array.isArray(data)
    ? data
    : Array.isArray((data as { items?: unknown })?.items)
      ? ((data as { items: unknown[] }).items ?? [])
      : [];
  return arr.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      id: String(r.id ?? ""),
      ownerId: String(r.ownerId ?? ""),
      ownerName: typeof r.ownerName === "string" ? r.ownerName : "Hostel Owner",
      ownerEmail: typeof r.ownerEmail === "string" ? r.ownerEmail : null,
      hostelId: typeof r.hostelId === "string" ? r.hostelId : null,
      hostelName: typeof r.hostelName === "string" ? r.hostelName : null,
      plan: toPlanId(r.plan) ?? "FREE",
      status: (toSubStatusLoose(r.status) ?? "PENDING") as SubscriptionRequest["status"],
      billingCycle: toBilling(r.billingCycle) ?? "MONTHLY",
      price: typeof r.price === "number" || typeof r.price === "string" ? r.price : 0,
      currency: typeof r.currency === "string" ? r.currency : "NPR",
      paymentMethod:
        typeof r.paymentMethod === "string"
          ? (r.paymentMethod.toUpperCase() as SubscriptionRequest["paymentMethod"])
          : null,
      paymentReference: typeof r.paymentReference === "string" ? r.paymentReference : null,
      notes: typeof r.notes === "string" ? r.notes : null,
      proofUrl: typeof r.proofUrl === "string" ? r.proofUrl : null,
      reviewNote: typeof r.reviewNote === "string" ? r.reviewNote : null,
      reviewedBy: typeof r.reviewedBy === "string" ? r.reviewedBy : null,
      reviewedAt: typeof r.reviewedAt === "string" ? r.reviewedAt : null,
      startDate: typeof r.startDate === "string" ? r.startDate : undefined,
      endDate: typeof r.endDate === "string" ? r.endDate : null,
      createdAt: typeof r.createdAt === "string" ? r.createdAt : undefined,
    };
  });
}

function toSubStatusLoose(v: unknown): SubscriptionHistoryItem["status"] {
  if (v === undefined || v === null || v === "") return undefined;
  return String(v).toUpperCase() as SubscriptionHistoryItem["status"];
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
    numOf(
      pickPag("itemsPerPage", "items_per_page", "limit", "perPage"),
      meta?.limit ?? fallbackLimit
    )
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

/** Serialize a staff payload to multipart FormData (photo under `photo` key). */
function staffToFormData(payload: Record<string, unknown>, photoFile?: File | null) {
  const form = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (value instanceof File) return; // file parts are appended explicitly below
    if (Array.isArray(value)) {
      form.append(key, value.join(","));
      return;
    }
    form.append(key, String(value));
  });
  // Backend strips stray `photo` text parts (`stripFileFields('photo')`) and only
  // uploads the real file buffer, so append the file ONLY (never a text field).
  if (photoFile) form.append("photo", photoFile, photoFile.name);
  return form;
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
    /**
     * POST /auth/logout — idempotent production logout (never 401s).
     * Denylists tokens, purges user cache, disconnects sockets, clears cookies.
     * `logoutAll` kills every device/session.
     */
    logout: (logoutAll = false) =>
      api.post<import("./api-types").LogoutResponse>(
        `${PREFIX}/auth/logout${logoutAll ? "?logoutAll=true" : ""}`,
        logoutAll ? { logoutAll: true } : {}
      ),
    /** POST /auth/logout/all — explicit all-devices kill switch. */
    logoutAll: () =>
      api.post<import("./api-types").LogoutResponse>(`${PREFIX}/auth/logout/all`, {}),
    forgotPassword: (payload: { email: string }) =>
      api.post<{ message: string }>(`${PREFIX}/auth/forgot-password`, payload),
    resetPassword: (payload: { token: string; password: string }) =>
      api.patch<{ message: string }>(`${PREFIX}/auth/reset-password`, payload),
    changePassword: (payload: { currentPassword: string; newPassword: string }) =>
      api.put<{ message: string }>(`${PREFIX}/auth/change-password`, payload),
  },

  admin: {
    listHostels: (params?: ListParams) =>
      getWithRetry<ApiEnvelope<Hostel[]> | Hostel[]>(
        `${PREFIX}/admin/hostels`,
        // Backend sends ETag → browser revalidates → 304 with EMPTY body and
        // the table keeps the stale ACTIVE row. Bypass the HTTP cache so a
        // refetch after suspend always returns a 200 with the real list.
        noCacheParams(params)
      ),
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
    /**
     * Suspend a hostel (SUPER_ADMIN). Backend: POST /admin/hostels/:id/suspend.
     * Blocking owner logins + resident payments is enforced server-side.
     */
    suspendHostel: (hostelId: string) =>
      api.post(`${PREFIX}/admin/hostels/${hostelId}/suspend`, {}),
    /**
     * Re-activate a suspended hostel (SUPER_ADMIN).
     * Tries POST /admin/hostels/:id/activate, falls back to
     * PATCH /admin/hostels/:id { status: "ACTIVE" } for older backends.
     */
    activateHostel: async (hostelId: string) => {
      try {
        return await api.post(`${PREFIX}/admin/hostels/${hostelId}/activate`, {});
      } catch (e) {
        const s = (e as { response?: { status?: number } })?.response?.status ?? 0;
        if (s === 404 || s === 405) {
          return api.patch(`${PREFIX}/admin/hostels/${hostelId}`, { status: "ACTIVE" });
        }
        throw e;
      }
    },
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

  subscriptions: {
    /**
     * GET /subscriptions/plans — public list (optional auth personalizes
     * `isCurrent`; axios sends the token when present, anonymous = FREE).
     * 200 `Subscription plans fetched successfully.`
     */
    plans: () =>
      getWithRetry<BackendPlan[] | ApiEnvelope<BackendPlan[]>>(`${PREFIX}/subscriptions/plans`),
    /**
     * GET /subscriptions/current?hostelId=uuid — owner/admin, hostel required
     * (explicit param or `X-Hostel-Id`). Null subscription = FREE fallback.
     * 200 `Current subscription fetched successfully.`
     */
    current: (hostelId?: string) =>
      getWithRetry<SubscriptionCurrent | ApiEnvelope<SubscriptionCurrent>>(
        `${PREFIX}/subscriptions/current`,
        hostelId ? ({ hostelId } as unknown as ListParams) : undefined
      ),
    /**
     * POST /subscriptions/subscribe — owner/admin, hostel required.
     * FREE = instant downgrade. Paid plans = payment-proof screenshot uploaded
     * (multipart field `proof`); the row is stored as PENDING and activates
     * only after an admin approves it. 201 with `requiresApproval: true`.
     */
    subscribe: (payload: SubscribePayload) => {
      const { proof, ...rest } = payload;
      if (!proof) {
        return api.post(`${PREFIX}/subscriptions/subscribe`, {
          ...rest,
          billingCycle: rest.billingCycle ?? "MONTHLY",
        });
      }
      const form = new FormData();
      Object.entries(rest).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") form.append(key, String(value));
      });
      form.append("proof", proof, proof.name);
      return api.post(`${PREFIX}/subscriptions/subscribe`, form, {
        headers: { "Content-Type": undefined as unknown as string },
      });
    },
    /**
     * GET /subscriptions/requests — ADMIN ONLY review queue of owner payment
     * proofs (defaults to PENDING). Returns `{ data, meta }` pagination.
     */
    requests: (params?: { status?: string; page?: number; limit?: number }) =>
      getWithRetry<SubscriptionRequest[] | ApiEnvelope<SubscriptionRequest[]>>(
        `${PREFIX}/subscriptions/requests`,
        params as unknown as ListParams
      ),
    /**
     * POST /subscriptions/requests/:id/review — ADMIN ONLY. APPROVE activates
     * the plan immediately; REJECT keeps the owner on their current plan.
     */
    reviewRequest: (id: string, action: SubscriptionReviewAction, note?: string) =>
      api.post(`${PREFIX}/subscriptions/requests/${id}/review`, {
        action,
        ...(note ? { note } : {}),
      }),
    /**
     * POST /subscriptions/cancel — owner/admin, hostel required.
     * Deactivates ACTIVE → EXPIRED; next current is FREE.
     * 200 `Subscription cancelled successfully.` (no data).
     */
    cancel: (hostelId: string) => api.post(`${PREFIX}/subscriptions/cancel`, { hostelId }),
    /** GET /subscriptions/history — owner/admin, no hostel, newest first. */
    history: () =>
      getWithRetry<SubscriptionHistoryItem[] | ApiEnvelope<SubscriptionHistoryItem[]>>(
        `${PREFIX}/subscriptions/history`
      ),
    /**
     * GET /subscriptions/check-limit?hostelId=uuid&count=1 — owner/admin.
     * Always 200: `allowed` true/false (+ upgrade hint when blocked).
     * PRO/ENTERPRISE limit null → allowed true.
     */
    checkLimit: (hostelId: string, count = 1) =>
      getWithRetry<SubscriptionCheckLimit | ApiEnvelope<SubscriptionCheckLimit>>(
        `${PREFIX}/subscriptions/check-limit`,
        { hostelId, count } as unknown as ListParams
      ),
  },

  bookings: {
    create: async (payload: CreateBookingPayload, idempotencyKey?: string) => {
      const key = idempotencyKey ?? newIdempotencyKey();
      const headers = idemHeaders(key);
      try {
        return await api.post<Booking>(`${PREFIX}/bookings`, payload, { headers });
      } catch (err) {
        return await api.post<Booking>(`/bookings`, payload, { headers });
      }
    },
    myBookings: async () => {
      try {
        return await getWithRetry<Booking[] | ApiEnvelope<Booking[]>>(
          `${PREFIX}/bookings/my-bookings`
        );
      } catch (err) {
        return await getWithRetry<Booking[] | ApiEnvelope<Booking[]>>(`/bookings/my-bookings`);
      }
    },
    hostelBookings: async (hostelId: string, params?: ListParams) => {
      try {
        return await getWithRetry<Booking[] | ApiEnvelope<Booking[]>>(
          `${PREFIX}/bookings/hostels/${hostelId}`,
          params
        );
      } catch (err) {
        return await getWithRetry<Booking[] | ApiEnvelope<Booking[]>>(
          `/bookings/hostels/${hostelId}`,
          params
        );
      }
    },
    updateStatus: async (bookingId: string, payload: { status: string }) => {
      try {
        return await api.patch<Booking>(`${PREFIX}/bookings/${bookingId}/status`, payload);
      } catch (err) {
        return await api.patch<Booking>(`/bookings/${bookingId}/status`, payload);
      }
    },
    cancel: async (bookingId: string) => {
      try {
        return await api.delete<{ message: string }>(`${PREFIX}/bookings/${bookingId}`);
      } catch (err) {
        return await api.delete<{ message: string }>(`/bookings/${bookingId}`);
      }
    },
    delete: async (bookingId: string) => {
      try {
        return await api.delete<{ message: string }>(`${PREFIX}/bookings/${bookingId}`);
      } catch (err) {
        return await api.delete<{ message: string }>(`/bookings/${bookingId}`);
      }
    },
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
    me: () => getWithRetry<unknown>(`${PREFIX}/resident/me`),
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
     * Sends canonical + legacy aliases so backend validation (amount vs
     * paidAmount vs total, method vs paymentMethod/payment_method) passes:
     * { amount, paidAmount, total, method, paymentMethod, payment_method, status }.
     * The `Idempotency-Key` header is dropped — the backend rejects unknown
     * headers on this route with 400.
     */
    recordPayment: (feeId: string, payload: RecordPaymentPayload) => {
      const amount = Number(payload.amount) || 0;
      const backendMethod = toBackendPaymentMethod(payload.method);
      const status = payload.status ? toBackendFeeStatus(payload.status) : undefined;
      const body: Record<string, unknown> = {
        amount,
        paidAmount: amount,
        paid_amount: amount,
        total: amount,
        totalAmount: amount,
        method: backendMethod,
        paymentMethod: backendMethod,
        payment_method: backendMethod,
      };
      if (status) {
        body.status = status;
        body.feeStatus = status;
        body.paymentStatus = status;
        body.payment_status = status;
      }
      if (payload.remarks) body.remarks = payload.remarks;
      if (payload.month) body.month = payload.month;
      return api.patch<Fee | ApiEnvelope<Fee>>(`${PREFIX}/fees/${feeId}/payment`, body);
    },
    /**
     * Manual status override — tries PATCH /fees/:id/status, then falls back
     * to PATCH /fees/:id. Sends canonical + legacy keys for max tolerance.
     * NULL is never sent (backend enum is PENDING|PARTIALLY_PAID|PAID|OVERDUE).
     */
    updateStatus: async (feeId: string, payload: UpdateFeeStatusPayload) => {
      const status = toBackendFeeStatus(payload.status);
      const body: Record<string, unknown> = {
        status,
        feeStatus: status,
        paymentStatus: status,
        payment_status: status,
      };
      try {
        return await api.patch<Fee | ApiEnvelope<Fee>>(`${PREFIX}/fees/${feeId}/status`, body);
      } catch (err) {
        const code = toApiError(err).status;
        if (code !== 404 && code !== 405) throw err;
        return await api.patch<Fee | ApiEnvelope<Fee>>(`${PREFIX}/fees/${feeId}`, body);
      }
    },
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

  invoices: {
    /**
     * Backend `feeRouter.post('/invoices', ...ownerOrAdmin, sensitiveActionLimiter,
     * `normalizeInvoiceFields`, `validateDto(CreateInvoiceDto)`, invoiceController.createInvoice)`.
     * `CreateInvoiceDto` REQUIRES `residentName` (2–200 char string) alongside
     * `residentId` — send both, plus nested `resident: { id, name }` for
     * `normalizeInvoiceFields`. Numeric month/year canonical.
     */
    create: (payload: CreateInvoicePayload) => {
      const residentName = String(payload.residentName ?? "")
        .trim()
        .slice(0, 200);
      const body: Record<string, unknown> = {
        hostelId: payload.hostelId,
        residentId: payload.residentId,
        residentName,
        resident: { id: payload.residentId, name: residentName },
        amount: Number(payload.amount),
        billingMonth: Number(payload.billingMonth),
        billingYear: Number(payload.billingYear),
      };
      if (payload.dueDate) body.dueDate = payload.dueDate;
      if (payload.status) body.status = payload.status;
      if (payload.feeType) body.feeType = payload.feeType;
      if (payload.notes) body.notes = payload.notes;
      return api.post<Invoice | ApiEnvelope<Invoice>>(`${PREFIX}/fees/invoices`, body, {
        headers: idemHeaders(newIdempotencyKey()),
      });
    },
    /**
     * List invoices for a hostel. No dedicated GET /invoices router is wired in
     * the dashboard yet — this tries the dedicated route first and falls back to
     * the owner fee ledger (`GET /fees/hostels/:hostelId`), which carries the
     * same invoice rows (resident, amount, month, status).
     */
    list: async (params: InvoiceListParams & { hostelId: string }) => {
      try {
        return await getWithRetry<Invoice[] | ApiEnvelope<Invoice[]>>(
          `${PREFIX}/fees/invoices`,
          cleanHostelParams(params) as unknown as ListParams
        );
      } catch {
        return getWithRetry<Fee[] | ApiEnvelope<Fee[]>>(
          `${PREFIX}/fees/hostels/${params.hostelId}`,
          cleanHostelParams({ status: params.status }) as unknown as ListParams
        );
      }
    },
  },

  staff: {
    /**
     * Backend `staffRouter` — OWNER + ADMIN (authenticate + requireRoles).
     * - `GET /staff` — list (?hostelId=&role=&status=&search=&page=&limit=)
     * - `POST /staff` — create (`uploadStaffPhoto` multipart `photo` + `validateDto(CreateStaffDto)`)
     * - `GET /staff/:id` — single staff (`requireParam('id')`)
     * - `PUT /staff/:id` — full replace (`uploadStaffPhoto` + `validateDto(UpdateStaffDto)`)
     * - `PATCH /staff/:id` — partial update (same middleware as PUT)
     * - `DELETE /staff/:id` — remove
     */
    list: (params?: StaffListParams) =>
      getWithRetry<Staff[] | ApiEnvelope<Staff[]>>(
        `${PREFIX}/staff`,
        cleanHostelParams(params) as unknown as ListParams
      ),
    /** GET /staff/:id — single staff record. */
    get: (id: string) => getWithRetry<Staff | ApiEnvelope<Staff>>(`${PREFIX}/staff/${id}`),
    /**
     * POST /staff — add staff.
     * Sends multipart `photo` when `payload.photo` is a File
     * (matches `uploadStaffPhoto` + `stripFileFields('photo')`);
     * otherwise JSON. `hostelId` defaults to the active hostel cookie.
     */
    create: (payload: CreateStaffPayload, hostelId?: string | null) => {
      const hid = validHostelId(
        hostelId ?? (payload.hostelId as string | undefined) ?? getHostelId()
      );
      const body: Record<string, unknown> = { ...payload };
      delete body.photo;
      if (hid) body.hostelId = hid;
      else delete body.hostelId;
      if (payload.photo instanceof File) {
        return api.post<Staff | ApiEnvelope<Staff>>(
          `${PREFIX}/staff`,
          staffToFormData(body, payload.photo),
          multipartConfig(idemHeaders(newIdempotencyKey()))
        );
      }
      return api.post<Staff | ApiEnvelope<Staff>>(`${PREFIX}/staff`, body, {
        headers: idemHeaders(newIdempotencyKey()),
      });
    },
    /**
     * PUT /staff/:id — full replace (`UpdateStaffDto`, multipart `photo` supported).
     */
    update: (id: string, payload: UpdateStaffPayload, photoFile?: File | null) => {
      if (photoFile instanceof File) {
        const body: Record<string, unknown> = { ...payload };
        delete body.photo;
        return api.put<Staff | ApiEnvelope<Staff>>(
          `${PREFIX}/staff/${id}`,
          staffToFormData(body, photoFile),
          multipartConfig()
        );
      }
      const body: Record<string, unknown> = { ...payload };
      delete body.photo;
      return api.put<Staff | ApiEnvelope<Staff>>(`${PREFIX}/staff/${id}`, body);
    },
    /**
     * PATCH /staff/:id — partial update (multipart `photo` supported).
     */
    patch: (id: string, payload: UpdateStaffPayload, photoFile?: File | null) => {
      if (photoFile instanceof File) {
        const body: Record<string, unknown> = { ...payload };
        delete body.photo;
        return api.patch<Staff | ApiEnvelope<Staff>>(
          `${PREFIX}/staff/${id}`,
          staffToFormData(body, photoFile),
          multipartConfig()
        );
      }
      const body: Record<string, unknown> = { ...payload };
      delete body.photo;
      return api.patch<Staff | ApiEnvelope<Staff>>(`${PREFIX}/staff/${id}`, body);
    },
    /** DELETE /staff/:id — removes a staff member. */
    remove: (id: string) => api.delete<{ message?: string }>(`${PREFIX}/staff/${id}`),
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

  settings: {
    /**
     * SETTINGS ENDPOINTS (frontend-first — implement in backend later).
     * Owner hostel profile + notification preferences. Hostel is resolved
     * server-side from auth / X-Hostel-Id. Payment QRs excluded (own
     * `paymentQrs` namespace, already integrated).
     */
    /** GET /settings/hostel — owner hostel profile for `/settings`. */
    getHostelProfile: () =>
      getWithRetry<HostelProfileSettings | ApiEnvelope<HostelProfileSettings>>(
        `${PREFIX}/settings/hostel`
      ),
    /** PUT /settings/hostel — update owner hostel profile. */
    updateHostelProfile: (payload: UpdateHostelProfileSettingsPayload) =>
      api.put<HostelProfileSettings | ApiEnvelope<HostelProfileSettings>>(
        `${PREFIX}/settings/hostel`,
        payload
      ),
    /** GET /settings/notifications — rent reminders + alert prefs. */
    getNotifications: () =>
      getWithRetry<NotificationPreferences | ApiEnvelope<NotificationPreferences>>(
        `${PREFIX}/settings/notifications`
      ),
    /** PUT /settings/notifications — save rent reminders + alert prefs. */
    updateNotifications: (payload: UpdateNotificationPreferencesPayload) =>
      api.put<NotificationPreferences | ApiEnvelope<NotificationPreferences>>(
        `${PREFIX}/settings/notifications`,
        payload
      ),
    /** PUT /auth/change-password — Security card (already on backend). */
    changePassword: (payload: { currentPassword: string; newPassword: string }) =>
      api.put<{ message?: string }>(`${PREFIX}/auth/change-password`, payload),
  },

  platformSettings: {
    /**
     * PLATFORM SETTINGS ENDPOINTS (frontend-first — SUPER_ADMIN).
     * One URL per `/admin/settings` tab. The legacy full-document routes
     * (`GET+PUT /admin/settings`) are kept as fallback until backend ships
     * the per-tab routes below.
     */
    /** GET /admin/settings — legacy full document (fallback). */
    get: () =>
      getWithRetry<PlatformSettings | ApiEnvelope<PlatformSettings>>(`${PREFIX}/admin/settings`),
    /** PUT /admin/settings — legacy partial update (fallback). */
    update: (payload: UpdatePlatformSettingsPayload) =>
      api.put<PlatformSettings | ApiEnvelope<PlatformSettings>>(
        `${PREFIX}/admin/settings`,
        payload
      ),
    general: {
      /** GET /admin/settings/general — General & Identity tab. */
      get: () =>
        getWithRetry<GeneralSettings | ApiEnvelope<GeneralSettings>>(
          `${PREFIX}/admin/settings/general`
        ),
      /** PUT /admin/settings/general — save General & Identity tab. */
      update: (payload: UpdateGeneralSettingsPayload) =>
        api.put<GeneralSettings | ApiEnvelope<GeneralSettings>>(
          `${PREFIX}/admin/settings/general`,
          payload
        ),
    },
    billing: {
      /** GET /admin/settings/billing — Billing & Plans tab. */
      get: () =>
        getWithRetry<BillingSettings | ApiEnvelope<BillingSettings>>(
          `${PREFIX}/admin/settings/billing`
        ),
      /** PUT /admin/settings/billing — save Billing & Plans tab. */
      update: (payload: UpdateBillingSettingsPayload) =>
        api.put<BillingSettings | ApiEnvelope<BillingSettings>>(
          `${PREFIX}/admin/settings/billing`,
          payload
        ),
    },
    access: {
      /** GET /admin/settings/access — Access & Security tab. */
      get: () =>
        getWithRetry<AccessSettings | ApiEnvelope<AccessSettings>>(
          `${PREFIX}/admin/settings/access`
        ),
      /** PUT /admin/settings/access — save Access & Security tab. */
      update: (payload: UpdateAccessSettingsPayload) =>
        api.put<AccessSettings | ApiEnvelope<AccessSettings>>(
          `${PREFIX}/admin/settings/access`,
          payload
        ),
    },
    alerts: {
      /** GET /admin/settings/alerts — Alerts & Notifications tab. */
      get: () =>
        getWithRetry<AlertSettings | ApiEnvelope<AlertSettings>>(`${PREFIX}/admin/settings/alerts`),
      /** PUT /admin/settings/alerts — save Alerts & Notifications tab. */
      update: (payload: UpdateAlertSettingsPayload) =>
        api.put<AlertSettings | ApiEnvelope<AlertSettings>>(
          `${PREFIX}/admin/settings/alerts`,
          payload
        ),
    },
    system: {
      /** GET /admin/settings/system — System & Cache tab. */
      get: () =>
        getWithRetry<SystemSettings | ApiEnvelope<SystemSettings>>(
          `${PREFIX}/admin/settings/system`
        ),
      /** PUT /admin/settings/system — save System & Cache tab. */
      update: (payload: UpdateSystemSettingsPayload) =>
        api.put<SystemSettings | ApiEnvelope<SystemSettings>>(
          `${PREFIX}/admin/settings/system`,
          payload
        ),
      /** POST /admin/settings/system/purge-cache — purge all caches. */
      purgeCache: () =>
        api.post<{ message?: string; purgedAt?: string }>(
          `${PREFIX}/admin/settings/system/purge-cache`,
          {}
        ),
    },
    /** POST /admin/settings/cache/purge — legacy cache purge (fallback). */
    purgeCache: () =>
      api.post<{ message?: string; purgedAt?: string }>(`${PREFIX}/admin/settings/cache/purge`, {}),
    /**
     * PLATFORM QR CHECKOUT ENDPOINTS (frontend-first — SUPER_ADMIN).
     * Powers `/admin/settings` → Platform QRs tab (what owners scan on
     * `/subscription`). Hostel `paymentQrs` namespace untouched.
     */
    /** GET /admin/platform-qrs — list checkout QRs (ESEWA/KHALTI/BANK). */
    listQrs: () =>
      getWithRetry<PlatformQr[] | ApiEnvelope<PlatformQr[]>>(`${PREFIX}/admin/platform-qrs`),
    /** POST /admin/platform-qrs — upload QR (multipart `qrImage` or JSON url). */
    createQr: (payload: UpsertPlatformQrPayload) => {
      if (payload.file instanceof File) {
        const form = new FormData();
        form.append("method", String(payload.method));
        form.append("label", payload.label);
        form.append("qrImage", payload.file, payload.file.name);
        if (payload.isActive !== undefined) form.append("isActive", String(payload.isActive));
        return api.post<PlatformQr | ApiEnvelope<PlatformQr>>(
          `${PREFIX}/admin/platform-qrs`,
          form,
          { headers: { "Content-Type": "multipart/form-data" } }
        );
      }
      return api.post<PlatformQr | ApiEnvelope<PlatformQr>>(`${PREFIX}/admin/platform-qrs`, {
        method: payload.method,
        label: payload.label,
        qrImageUrl: payload.qrImageUrl,
        ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
      });
    },
    /** PUT /admin/platform-qrs/:id — replace image/label. */
    updateQr: (id: string, payload: UpsertPlatformQrPayload) => {
      if (payload.file instanceof File) {
        const form = new FormData();
        form.append("method", String(payload.method));
        form.append("label", payload.label);
        form.append("qrImage", payload.file, payload.file.name);
        if (payload.isActive !== undefined) form.append("isActive", String(payload.isActive));
        return api.put<PlatformQr | ApiEnvelope<PlatformQr>>(
          `${PREFIX}/admin/platform-qrs/${id}`,
          form,
          { headers: { "Content-Type": "multipart/form-data" } }
        );
      }
      return api.put<PlatformQr | ApiEnvelope<PlatformQr>>(`${PREFIX}/admin/platform-qrs/${id}`, {
        method: payload.method,
        label: payload.label,
        ...(payload.qrImageUrl ? { qrImageUrl: payload.qrImageUrl } : {}),
        ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
      });
    },
    /** DELETE /admin/platform-qrs/:id — remove a checkout QR. */
    removeQr: (id: string) =>
      api.delete<{ message?: string }>(`${PREFIX}/admin/platform-qrs/${id}`),
    /**
     * GET /platform-qrs — active checkout QRs owners scan on `/subscription`.
     * Owner/admin read backed by the `platform_qrs` table (Cloudinary URLs),
     * so every device sees the admin's uploaded QRs — not just the browser
     * that uploaded them. Falls back to file/env config when the route 404s.
     */
    listActiveQrs: () =>
      getWithRetry<PlatformQr[] | ApiEnvelope<PlatformQr[]>>(`${PREFIX}/platform-qrs`),
  },

  meals: {
    /** GET /hostels/:hostelId/meals — weekly meal schedule for a hostel. */
    get: (hostelId: string) =>
      getWithRetry<ApiEnvelope<WeeklyMealSchedule>>(
        `${PREFIX}/hostels/${encodeURIComponent(hostelId)}/meals`
      ),
    /** PUT /hostels/:hostelId/meals — save weekly meal schedule. */
    save: (hostelId: string, meals: MealDayItem[]) =>
      api.put<ApiEnvelope<WeeklyMealSchedule>>(
        `${PREFIX}/hostels/${encodeURIComponent(hostelId)}/meals`,
        { meals }
      ),
    /** DELETE /hostels/:hostelId/meals — clear weekly meal schedule. */
    clear: (hostelId: string) =>
      api.delete<ApiEnvelope<WeeklyMealSchedule>>(
        `${PREFIX}/hostels/${encodeURIComponent(hostelId)}/meals`
      ),

    /** GET /hostels/:hostelId/meals/daily — daily meal schedule. */
    getDaily: (hostelId: string) => {
      return getWithRetry<ApiEnvelope<DailyMealSchedule>>(
        `${PREFIX}/hostels/${encodeURIComponent(hostelId)}/meals/daily`
      );
    },
    /** PUT /hostels/:hostelId/meals/daily — save all daily meal slots. */
    saveDaily: (hostelId: string, meals: DailyMealItem[]) =>
      api.put<ApiEnvelope<DailyMealSchedule>>(
        `${PREFIX}/hostels/${encodeURIComponent(hostelId)}/meals/daily`,
        { meals }
      ),
    /** POST /hostels/:hostelId/meals/daily — add a new daily meal slot. */
    createDaily: (hostelId: string, meal: Partial<DailyMealItem>) =>
      api.post<ApiEnvelope<DailyMealItem>>(
        `${PREFIX}/hostels/${encodeURIComponent(hostelId)}/meals/daily`,
        meal
      ),
    /** PUT /hostels/:hostelId/meals/daily/:id — update a specific daily meal slot. */
    updateDaily: (hostelId: string, id: string, meal: Partial<DailyMealItem>) =>
      api.put<ApiEnvelope<DailyMealItem>>(
        `${PREFIX}/hostels/${encodeURIComponent(hostelId)}/meals/daily/${encodeURIComponent(id)}`,
        meal
      ),
    /** DELETE /hostels/:hostelId/meals/daily/:id — delete a daily meal slot. */
    deleteDaily: (hostelId: string, id: string) =>
      api.delete<ApiEnvelope<{ success: boolean }>>(
        `${PREFIX}/hostels/${encodeURIComponent(hostelId)}/meals/daily/${encodeURIComponent(id)}`
      ),
    /** DELETE /hostels/:hostelId/meals/daily — clear/reset daily meal schedule. */
    clearDaily: (hostelId: string) => {
      return api.delete<ApiEnvelope<DailyMealSchedule>>(
        `${PREFIX}/hostels/${encodeURIComponent(hostelId)}/meals/daily`
      );
    },
  },

  location: {
    /** GET /hostels/:hostelId/location — get location settings and coordinates. */
    get: (hostelId: string) =>
      getWithRetry<ApiEnvelope<HostelLocation>>(
        `${PREFIX}/hostels/${encodeURIComponent(hostelId)}/location`
      ),
    /** PUT /hostels/:hostelId/location — save coordinates and sharing toggle state. */
    update: (hostelId: string, payload: UpdateHostelLocationPayload) =>
      api.put<ApiEnvelope<HostelLocation>>(
        `${PREFIX}/hostels/${encodeURIComponent(hostelId)}/location`,
        payload
      ),
  },

  notifications: {
    /** GET /notifications — list paginated notifications with optional filters. */
    list: (params?: NotificationListParams) =>
      getWithRetry<ApiEnvelope<AppNotification[]> & { meta?: PaginationMeta }>(
        `${PREFIX}/notifications`,
        params
      ),
    /** GET /notifications/unread-count — get overall unread count. */
    unreadCount: (hostelId?: string) =>
      getWithRetry<ApiEnvelope<{ count: number }>>(`${PREFIX}/notifications/unread-count`, {
        hostelId: validHostelId(hostelId),
      }),
    /** GET /notifications/unread-counts — get total and byCategory unread breakdown. */
    unreadCounts: (hostelId?: string) =>
      getWithRetry<ApiEnvelope<NotificationCounts>>(`${PREFIX}/notifications/unread-counts`, {
        hostelId: validHostelId(hostelId),
      }),
    /** PATCH /notifications/:id/read — mark single notification as read. */
    markAsRead: (id: string) =>
      api.patch<ApiEnvelope<AppNotification>>(
        `${PREFIX}/notifications/${encodeURIComponent(id)}/read`
      ),
    /** PATCH /notifications/read-all — mark all (or by entityType/category) as read. */
    markAllAsRead: (params?: { entityType?: string; hostelId?: string }) =>
      api.patch<ApiEnvelope<{ updatedCount: number; counts: NotificationCounts }>>(
        `${PREFIX}/notifications/read-all`,
        {
          entityType: params?.entityType,
          hostelId: validHostelId(params?.hostelId),
        }
      ),
    /** DELETE /notifications/:id — delete a notification. */
    delete: (id: string) =>
      api.delete<ApiEnvelope<{ success: boolean }>>(
        `${PREFIX}/notifications/${encodeURIComponent(id)}`
      ),
  },

  search: {
    /** GET /search?q=... — unified role-aware global search. */
    query: (q: string, category?: string, limit?: number, hostelId?: string) =>
      getWithRetry<ApiEnvelope<GlobalSearchResponse>>(`${PREFIX}/search`, {
        q,
        category: category && category !== "all" ? category : undefined,
        limit,
        hostelId: validHostelId(hostelId),
      }),
  },
};

export default hostelGhar;
