"use strict";
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
      }
    : function (o, v) {
        o["default"] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== "default") __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
Object.defineProperty(exports, "__esModule", { value: true });
exports.hostelGhar = exports.socketEvents = exports.socketRooms = exports.toApiError = void 0;
exports.unwrap = unwrap;
exports.unwrapMeta = unwrapMeta;
exports.toPaginated = toPaginated;
exports.noCacheParams = noCacheParams;
exports.paymentQrBasePath = paymentQrBasePath;
exports.validHostelId = validHostelId;
exports.resolveOwnerHostelId = resolveOwnerHostelId;
exports.toBackendPaymentMethod = toBackendPaymentMethod;
exports.toBackendFeeStatus = toBackendFeeStatus;
exports.toDisplayFeeStatus = toDisplayFeeStatus;
exports.splitAccountLabel = splitAccountLabel;
exports.toPaymentQrForm = toPaymentQrForm;
exports.normalizePaymentQr = normalizePaymentQr;
exports.normalizePaymentQrList = normalizePaymentQrList;
exports.normalizeRoom = normalizeRoom;
exports.normalizeResident = normalizeResident;
exports.normalizeDashboardPayment = normalizeDashboardPayment;
exports.normalizeRevenueTrend = normalizeRevenueTrend;
exports.normalizeFloorOverview = normalizeFloorOverview;
exports.normalizeRoomMix = normalizeRoomMix;
exports.normalizeOwnerDashboard = normalizeOwnerDashboard;
exports.normalizeOwnerSummary = normalizeOwnerSummary;
exports.normalizeAdminSummary = normalizeAdminSummary;
exports.normalizeHostel = normalizeHostel;
exports.normalizeHostelList = normalizeHostelList;
exports.normalizePlans = normalizePlans;
exports.normalizeExpense = normalizeExpense;
exports.normalizeSubscriptionCurrent = normalizeSubscriptionCurrent;
exports.normalizeCheckLimit = normalizeCheckLimit;
exports.normalizeSubscriptionHistory = normalizeSubscriptionHistory;
exports.normalizeSubscriptionRequests = normalizeSubscriptionRequests;
exports.normalizeExpenseList = normalizeExpenseList;
exports.normalizeExpensePagination = normalizeExpensePagination;
exports.normalizeFacility = normalizeFacility;
exports.newIdempotencyKey = newIdempotencyKey;
exports.connectSocket = connectSocket;
exports.joinSessionRooms = joinSessionRooms;
const axios_1 = __importStar(require("./axios"));
Object.defineProperty(exports, "toApiError", {
  enumerable: true,
  get: function () {
    return axios_1.toApiError;
  },
});
const PREFIX = "/v1/hostel-ghar";
/** Unwrap `{ data }` envelope or return raw payload. */
function unwrap(payload) {
  if (payload !== null && typeof payload === "object" && "data" in payload) {
    return payload.data;
  }
  return payload;
}
function unwrapMeta(payload) {
  if (payload !== null && typeof payload === "object" && "meta" in payload) {
    return payload.meta ?? null;
  }
  if (payload !== null && typeof payload === "object" && "pagination" in payload) {
    const p = payload.pagination;
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
function toPaginated(payload) {
  if (payload === undefined || payload === null || payload === "") {
    // Axios on HTTP 304 returns the cached body — which for a conditional
    // request is EMPTY by design. Never treat that as "no data" silently;
    // return [] and let callers bypass the cache (see noCacheParams).
    return { items: [], meta: null };
  }
  if (Array.isArray(payload)) return { items: payload, meta: null };
  const root = payload;
  const meta = unwrapMeta(payload);
  let items = [];
  if (Array.isArray(root?.data)) items = root.data;
  else if (root?.data && typeof root.data === "object") {
    const nested = root.data;
    if (Array.isArray(nested.data)) items = nested.data;
    else if (Array.isArray(nested.residents)) items = nested.residents;
    else if (Array.isArray(nested.fees)) items = nested.fees;
    else if (Array.isArray(nested.leaveTypes)) items = nested.leaveTypes;
    else if (Array.isArray(nested.leave_types)) items = nested.leave_types;
    else if (Array.isArray(nested.items)) items = nested.items;
    else if (Array.isArray(nested.results)) items = nested.results;
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
function noCacheParams(params) {
  return { ...(params ?? {}), _t: Date.now() };
}
async function getWithRetry(url, params) {
  try {
    return await axios_1.default.get(url, { params });
  } catch (err) {
    const shape = (0, axios_1.toApiError)(err);
    if (shape.status === 0 || shape.status >= 500) {
      await new Promise((r) => setTimeout(r, 600));
      return await axios_1.default.get(url, { params });
    }
    throw err;
  }
}
function idemHeaders(key) {
  return key ? { "Idempotency-Key": key } : undefined;
}
function newIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
/** Backend mount for `paymentQrRouter` (override via NEXT_PUBLIC_PAYMENT_QR_PATH). */
function paymentQrBasePath() {
  if (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_PAYMENT_QR_PATH) {
    return process.env.NEXT_PUBLIC_PAYMENT_QR_PATH;
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
function validHostelId(id) {
  const v = String(id ?? "").trim();
  if (!v || v.toLowerCase() === "default") return undefined;
  if (!UUID_RE.test(v)) return undefined;
  return v;
}
/** Strip an invalid/non-UUID `hostelId` from list query params (keeps other filters). */
function cleanHostelParams(params) {
  if (!params || typeof params !== "object") return undefined;
  const hid = validHostelId(params.hostelId);
  if (hid) return { ...params, hostelId: hid };
  const { hostelId: _omit, ...rest } = params;
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
async function resolveOwnerHostelId(preferred) {
  const direct = validHostelId(preferred);
  if (direct) return direct;
  const fromCookie = validHostelId((0, axios_1.getHostelId)());
  if (fromCookie) return fromCookie;
  try {
    const list = await axios_1.default.get(`${PREFIX}/hostels`, {
      params: { limit: 1 },
    });
    return toPaginated(list.data).items[0]?.id ?? null;
  } catch {
    return null;
  }
}
/**
 * Map frontend BANK → backend BANK_TRANSFER enum.
 * Backend `paymentMethod` only accepts: ESEWA | KHALTI | BANK_TRANSFER.
 */
function toBackendPaymentMethod(raw) {
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
function toBackendFeeStatus(raw) {
  const v = String(raw ?? "")
    .toUpperCase()
    .trim();
  if (v === "PARTIAL" || v === "PARTIALLY_PAID" || v === "PARTIALLY-PAID") return "PARTIALLY_PAID";
  if (v === "PAID") return "PAID";
  if (v === "OVERDUE") return "OVERDUE";
  return "PENDING";
}
/** UI display alias — PARTIALLY_PAID → PARTIAL. */
function toDisplayFeeStatus(raw) {
  const v = String(raw ?? "")
    .toUpperCase()
    .trim();
  if (v === "PARTIALLY_PAID" || v === "PARTIALLY-PAID" || v === "PARTIAL") return "PARTIAL";
  if (v === "PAID" || v === "PENDING" || v === "OVERDUE") return v;
  return "PENDING";
}
/**
 * Split a combined label ("Nabil Bank • A/C: 0120…" / "eSewa ID: 9841…")
 * into backend `accountName` + `accountIdentifier`.
 */
function splitAccountLabel(label, fallbackName = "") {
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
function toPaymentQrForm(payload, opts) {
  const p = payload;
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
  const body = {};
  if (paymentMethod) body.paymentMethod = paymentMethod;
  if (accountName) body.accountName = accountName;
  if (accountIdentifier) body.accountIdentifier = accountIdentifier;
  if (qrCodeUrl) body.qrCodeUrl = qrCodeUrl;
  // Pass through only known-good extras (never method/tag/label).
  // hostelId must be a real UUID — "default"/junk is dropped so the backend
  // resolves the hostel from auth / X-Hostel-Id instead of 500ing on uuid parse.
  {
    const hid = validHostelId(p.hostelId);
    if (hid) body.hostelId = hid;
  }
  for (const k of ["isActive", "status"]) {
    const v = p[k];
    if (v !== undefined && v !== null && v !== "") body[k] = v;
  }
  if (!(p.file instanceof File)) return body;
  const form = new FormData();
  // `uploadPaymentQr` + `stripFileFields('qrCode','image','file','qr')` accept any
  // of these keys — send all aliases so the backend picks whichever it reads.
  for (const key of ["qrCode", "file", "image", "qr"]) {
    form.append(key, p.file, p.file.name);
  }
  for (const [k, v] of Object.entries(body)) {
    form.append(k, typeof v === "string" ? v : String(v));
  }
  return form;
}
/** Normalize one backend payment-QR record (canonical + legacy field variants). */
function normalizePaymentQr(raw) {
  const r = raw ?? {};
  const str = (v) => (typeof v === "string" ? v : String(v ?? ""));
  const pick = (...keys) => {
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
    ...r,
    id: str(pick("id", "_id", "qrId") || `qr-${Date.now()}`),
    paymentMethod,
    accountName,
    accountIdentifier,
    method: paymentMethod,
    label,
    qrCodeUrl:
      str(
        pick("qrCodeUrl", "qrCodeURL", "qr_code_url", "imageUrl", "qrUrl", "image", "qr", "url") ||
          ""
      ) || undefined,
  };
}
/** Normalize list payloads: `{ data: [...] }`, `{ qrs: [...] }`, raw arrays. */
function normalizePaymentQrList(payload) {
  const root = payload ?? {};
  const candidates = [
    payload,
    root.data,
    root.qrs,
    root.paymentQrs,
    root.items,
    root.results,
    root.data?.data,
    root.data?.qrs,
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) return c.map(normalizePaymentQr);
  }
  return [];
}
/** Normalize backend room shapes (snake/camel/_id variants) into the UI `Room`. */
function normalizeRoom(raw) {
  const r = raw ?? {};
  const pick = (...keys) => {
    for (const k of keys) {
      const v = r[k];
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return undefined;
  };
  const num = (v, fallback = 0) => {
    const n = typeof v === "string" ? Number(v) : v;
    return Number.isFinite(n) ? n : fallback;
  };
  const str = (v) => (typeof v === "string" ? v : String(v ?? ""));
  const capacity = num(pick("capacity", "totalBeds", "beds"), 1);
  const occupied = num(pick("occupied", "occupiedBeds", "filledBeds"), 0);
  const statusRaw = String(pick("status", "roomStatus") ?? "AVAILABLE").toUpperCase();
  const status = ["AVAILABLE", "OCCUPIED", "FULL", "MAINTENANCE"].includes(statusRaw)
    ? statusRaw
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
    type: ["SINGLE", "DOUBLE", "TRIPLE", "DORM"].includes(
      String(pick("type", "roomType") ?? "DOUBLE").toUpperCase()
    )
      ? String(pick("type", "roomType")).toUpperCase()
      : "DOUBLE",
    capacity,
    occupied,
    monthlyRent: num(pick("monthlyRent", "rent", "monthly_rent", "price"), 0),
    status,
    amenities,
    imageUrl: pick("imageUrl", "image", "photoUrl", "roomImageUrl") ?? null,
  };
}
/** Normalize backend resident shapes (snake/camel/_id/nested-room variants) into the UI `Resident`. */
function normalizeResident(raw) {
  const r = raw ?? {};
  const pick = (...keys) => {
    for (const k of keys) {
      const v = r[k];
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return undefined;
  };
  const roomObj = pick("room", "roomDetails") ?? {};
  const pickRoom = (...keys) => {
    for (const k of keys) {
      const v = roomObj[k];
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return pick(...keys);
  };
  const num = (v, fallback = 0) => {
    const n = typeof v === "string" ? Number(v) : v;
    return Number.isFinite(n) ? n : fallback;
  };
  const str = (v) => (typeof v === "string" ? v : String(v ?? ""));
  // Name: prefer display fields, then first+last composition, then nested user.
  const userObj = pick("user", "resident") ?? {};
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
    paymentStatus: ["PAID", "PENDING", "OVERDUE", "PARTIAL"].includes(paymentRaw)
      ? paymentRaw
      : "PENDING",
    status: ["ACTIVE", "INACTIVE", "PENDING", "VACATED"].includes(statusRaw) ? statusRaw : "ACTIVE",
    joinedDate: str(
      pick("joinedDate", "joined_date", "admissionDate", "createdAt", "created_at") ?? ""
    ),
    monthlyRent: num(pick("monthlyRent", "monthly_rent", "rent", "feeAmount"), 0),
    avatarUrl: pick("avatarUrl", "avatar", "photoUrl") ?? undefined,
  };
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
];
function dashboardMonthLabel(month, year) {
  if (!month || month < 1 || month > 12) return undefined;
  const short = DASHBOARD_MONTH_LABELS[month - 1];
  return year && year > 0 ? `${short} ${year}` : short;
}
/** Best-effort month/year from labels like "2026-04" / "Apr 2026". */
function parseTrendLabel(label) {
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
function normalizeDashboardPayment(raw) {
  const r = raw ?? {};
  const nested = [r.resident, r.user, r.fee].filter((v) => typeof v === "object" && v !== null);
  const pick = (...keys) => {
    for (const scope of [r, ...nested]) {
      for (const k of keys) {
        const v = scope[k];
        if (v !== undefined && v !== null && v !== "") return v;
      }
    }
    return undefined;
  };
  const num = (v, fallback = 0) => {
    const n = typeof v === "string" ? Number(v) : v;
    return Number.isFinite(n) ? n : fallback;
  };
  const str = (v) => (typeof v === "string" ? v : v === undefined || v === null ? "" : String(v));
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
  const status =
    statusRaw === "PARTIALLY_PAID" || statusRaw === "PARTIALLY-PAID" || statusRaw === "PARTIAL"
      ? "PARTIAL"
      : ["PAID", "PENDING", "OVERDUE"].includes(statusRaw)
        ? statusRaw
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
function normalizeRevenueTrend(payload) {
  const list = Array.isArray(payload)
    ? payload
    : payload !== null && typeof payload === "object"
      ? Object.entries(payload).map(([label, value]) =>
          value !== null && typeof value === "object" && !Array.isArray(value)
            ? { ...value, label }
            : { label, collected: value }
        )
      : [];
  // The backend may emit newest-first; order oldest → newest by (year, month).
  const asRecord = (item) => item ?? {};
  const monthKey = (item) => {
    const r = asRecord(item);
    const toNum = (v) =>
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
    const r = item ?? {};
    const pick = (...keys) => {
      for (const k of keys) {
        const v = r[k];
        if (v !== undefined && v !== null && v !== "") return v;
      }
      return undefined;
    };
    const num = (v, fallback = 0) => {
      const n = typeof v === "string" ? Number(v) : v;
      return Number.isFinite(n) ? n : fallback;
    };
    const str = (v) => (typeof v === "string" ? v : v === undefined || v === null ? "" : String(v));
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
function normalizeFloorOverview(payload) {
  const list = Array.isArray(payload)
    ? payload
    : payload !== null && typeof payload === "object"
      ? Object.entries(payload).map(([floor, value]) =>
          value !== null && typeof value === "object" && !Array.isArray(value)
            ? { ...value, floor }
            : { floor, rooms: value }
        )
      : [];
  return list.map((item) => {
    const r = item ?? {};
    const pick = (...keys) => {
      for (const k of keys) {
        const v = r[k];
        if (v !== undefined && v !== null && v !== "") return v;
      }
      return undefined;
    };
    const num = (v, fallback = 0) => {
      const n = typeof v === "string" ? Number(v) : v;
      return Number.isFinite(n) ? n : fallback;
    };
    const str = (v) => (typeof v === "string" ? v : v === undefined || v === null ? "" : String(v));
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
    const floor = Number.isFinite(floorNum) ? floorNum : str(floorRaw) || "—";
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
function normalizeRoomMix(payload) {
  const list = Array.isArray(payload)
    ? payload
    : payload !== null && typeof payload === "object"
      ? Object.entries(payload).map(([type, value]) =>
          value !== null && typeof value === "object" && !Array.isArray(value)
            ? { ...value, type }
            : { type, rooms: value }
        )
      : [];
  return list.map((item) => {
    const r = item ?? {};
    const pick = (...keys) => {
      for (const k of keys) {
        const v = r[k];
        if (v !== undefined && v !== null && v !== "") return v;
      }
      return undefined;
    };
    const num = (v, fallback = 0) => {
      const n = typeof v === "string" ? Number(v) : v;
      return Number.isFinite(n) ? n : fallback;
    };
    const str = (v) => (typeof v === "string" ? v : v === undefined || v === null ? "" : String(v));
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
function normalizeOwnerDashboard(raw) {
  const envelope = raw !== null && typeof raw === "object" && "data" in raw ? raw : null;
  const dataPart = envelope ? envelope.data : raw;
  const root = (Array.isArray(dataPart) ? {} : dataPart) ?? {};
  // Sibling keys beside `data` (your payload: summary/floorOverview/…) plus the
  // legacy { stats, metrics, overview } nesting variants. Merge them deeply so
  // keys nested one level down (e.g. summary.totalResidents) resolve.
  const siblings = envelope ? (({ data: _ignored, ...rest }) => rest)(envelope) : {};
  const deepMerge = (base, extra) => {
    const out = { ...base };
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
        out[key] = deepMerge(current, value);
      } else if (out[key] === undefined || out[key] === null || out[key] === "") {
        out[key] = value;
      }
    }
    return out;
  };
  let merged = { ...root };
  for (const extra of [siblings, root.summary, root.stats, root.overview, root.metrics]) {
    if (extra !== null && typeof extra === "object" && !Array.isArray(extra)) {
      merged = deepMerge(merged, extra);
    }
  }
  // The backend nests metrics one level down (`summary: { totalResidents… }`).
  // deepMerge keeps that nesting (merged.summary.totalResidents), so build the
  // lookup scopes explicitly: top level + known container objects.
  const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  const scopes = [merged];
  for (const key of ["summary", "stats", "overview", "metrics"]) {
    const v = merged[key];
    if (isPlainObject(v) && !scopes.includes(v)) scopes.push(v);
  }
  const pick = (...keys) => {
    for (const scope of scopes) {
      for (const k of keys) {
        const v = scope[k];
        if (v !== undefined && v !== null && v !== "") return v;
      }
    }
    return undefined;
  };
  const num = (v, fallback = 0) => {
    const n = typeof v === "string" ? Number(v) : v;
    return Number.isFinite(n) ? n : fallback;
  };
  const optNum = (...keys) => {
    const v = pick(...keys);
    return v === undefined ? undefined : num(v, 0);
  };
  const optRaw = (...keys) => pick(...keys);
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
  const hostelsRaw = pick("hostels", "hostelList", "data");
  // Current endpoint shape: `{ data: [hostel], summary: { ... } }`.
  // `data` is intentionally excluded from the metric merge above, so retain
  // it explicitly for the hostel name, type, and resident breakdown.
  const hostels = Array.isArray(dataPart)
    ? dataPart
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
    recentPayments: optRaw(
      "recentPayments",
      "recent_payments",
      "recentTransactions",
      "payments",
      "fees"
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
function analyticsScopes(raw) {
  const root = unwrap(raw) ?? {};
  const scopes = [root];
  // One level of nesting: `data` / `summary` / `stats` / `overview` / `result`,
  // plus the admin payload's `health` and `stats.occupancy` blocks.
  for (const key of ["data", "summary", "stats", "overview", "result", "health", "occupancy"]) {
    const v = root[key];
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      scopes.push(v);
    }
  }
  // `data.stats.occupancy` sits two levels deep.
  const stats = root["stats"];
  if (stats !== null && typeof stats === "object" && !Array.isArray(stats)) {
    const occ = stats["occupancy"];
    if (occ !== null && typeof occ === "object" && !Array.isArray(occ)) {
      scopes.push(occ);
    }
  }
  return scopes;
}
function analyticsNum(v, fallback = 0) {
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : fallback;
}
/** `finiteNum`: number (or numeric string) → number, anything else → undefined. */
function finiteNum(v) {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
}
/** `strOrUndefined`: non-empty trimmed string → string, else undefined. */
function strOrUndefined(v) {
  return typeof v === "string" && v.trim() !== "" ? v : undefined;
}
function analyticsFeeCounts(pick) {
  const num = (v) => (v === undefined ? undefined : analyticsNum(v, 0));
  const paid = num(pick("paidFees", "paid_fees", "paidCount"));
  const pending = num(pick("pendingFees", "pending_fees", "pendingCount"));
  const partial = num(pick("partialFees", "partial_fees", "partialCount"));
  const overdue = num(pick("overdueFees", "overdue_fees", "overdueCount"));
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
function normalizeOwnerSummary(raw) {
  const scopes = analyticsScopes(raw);
  const pick = (...keys) => {
    for (const scope of scopes) {
      for (const k of keys) {
        const v = scope[k];
        if (v !== undefined && v !== null && v !== "") return v;
      }
    }
    return undefined;
  };
  const optNum = (...keys) => {
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
function normalizeAdminSummary(raw) {
  const scopes = analyticsScopes(raw);
  const pick = (...keys) => {
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
  const optNum = (...keys) => {
    const v = pick(...keys);
    if (v === undefined || typeof v === "object") return undefined;
    return analyticsNum(v, 0);
  };
  const root = unwrap(raw) ?? {};
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
    currency: pick("currency", "mrrCurrency") ?? undefined,
    mrr,
    mrrBasis: pick("mrrBasis", "mrr_basis") ?? undefined,
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
    generatedAt: pick("generatedAt", "generated_at") ?? undefined,
    isCached: typeof root.isCached === "boolean" ? root.isCached : undefined,
    cacheLevel: root.cacheLevel ?? undefined,
    pendingApprovals: normalizeAdminPendingApprovals(pick("pendingApprovals")),
    recentHostels: normalizeAdminRecentHostels(
      pick("recentHostels", "recent_hostels") ?? root.recentHostels
    ),
    stats: normalizeAdminStats(pick("stats")),
    health: normalizeAdminHealth(pick("health")),
    revenueTrend: normalizeRevenueTrend(
      pick("revenueTrend", "revenue_trend", "revenueSeries", "revenueByMonth")
    ),
    feeCounts: analyticsFeeCounts(pick),
  };
}
function normalizeAdminPendingApprovals(raw) {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const r = raw;
  const count = r.count ?? r.total;
  const reviewUrl = r.reviewUrl ?? r.review_url;
  const n = typeof count === "string" ? Number(count) : count;
  return {
    count: typeof n === "number" && Number.isFinite(n) ? n : undefined,
    reviewUrl: typeof reviewUrl === "string" ? reviewUrl : undefined,
  };
}
function normalizeAdminStats(raw) {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const r = raw;
  const occRaw = r.occupancy;
  const occ = occRaw !== null && typeof occRaw === "object" && !Array.isArray(occRaw) ? occRaw : {};
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
function normalizeAdminHealth(raw) {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const r = raw;
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
 */
function normalizeHostel(raw) {
  const r = raw ?? {};
  const pick = (...keys) => {
    for (const key of keys) {
      const v = r[key];
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return undefined;
  };
  const count = (...keys) => {
    const n = finiteNum(pick(...keys));
    return n !== undefined && n >= 0 ? n : 0;
  };
  const ownerRaw = r.owner;
  const o =
    ownerRaw !== null && typeof ownerRaw === "object" && !Array.isArray(ownerRaw) ? ownerRaw : null;
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
  const statusRaw = strOrUndefined(pick("status"))?.toUpperCase();
  const status =
    statusRaw === "ACTIVE" || statusRaw === "SUSPENDED" ? statusRaw : owner ? "ACTIVE" : "PENDING";
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
function normalizeHostelList(payload) {
  return toPaginated(payload).items.map(normalizeHostel);
}
function normalizeAdminRecentHostels(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (item === null || typeof item !== "object") return null;
      const r = item;
      const ownerRaw = r.owner;
      const o =
        ownerRaw !== null && typeof ownerRaw === "object" && !Array.isArray(ownerRaw)
          ? ownerRaw
          : null;
      const id = strOrUndefined(r.id) ?? strOrUndefined(r.hostelId) ?? "";
      const name = strOrUndefined(r.name) ?? strOrUndefined(r.hostelName) ?? "";
      if (!id && !name) return null;
      const row = {
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
    .filter((h) => h !== null);
}
/* ---------------- Subscriptions (live contract) ---------------- */
function normalizePlanFeatures(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((f) => {
      if (typeof f === "string") return f;
      if (f !== null && typeof f === "object" && "label" in f) {
        return String(f.label ?? "");
      }
      return "";
    })
    .map((s) => s.trim())
    .filter(Boolean);
}
function normalizeBackendPlan(raw) {
  const r = raw ?? {};
  const pick = (...keys) => {
    for (const k of keys) {
      const v = r[k];
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return undefined;
  };
  const limits = pick("limits") ?? {};
  const numOrNull = (v) => {
    if (v === undefined) return undefined;
    if (v === null) return null;
    const n = typeof v === "string" ? Number(v) : v;
    return Number.isFinite(n) ? n : undefined;
  };
  const flags = pick("featureFlags", "feature_flags", "flags") ?? {};
  return {
    id: String(pick("id", "plan", "code") ?? "FREE").toUpperCase(),
    name: String(pick("name", "title") ?? ""),
    tagline: pick("tagline", "description") ?? undefined,
    price: numOrNull(pick("price", "priceMonthly", "amount")) ?? undefined,
    currency: pick("currency") ?? "NPR",
    billingPeriod: pick("billingPeriod", "billing_period") ?? undefined,
    formattedPrice: pick("formattedPrice", "formatted_price") ?? undefined,
    badge: pick("badge") ?? null,
    features: normalizePlanFeatures(pick("features", "featureList")),
    buttonText: pick("buttonText", "button_text", "cta") ?? undefined,
    cta: pick("cta", "buttonText", "button_text") ?? undefined,
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
function normalizePlans(raw) {
  const data = unwrap(raw);
  const arr = Array.isArray(data) ? data : Array.isArray(data?.plans) ? data.plans : [];
  return arr.map((item) => {
    const scoped =
      item !== null && typeof item === "object" && "data" in item ? (item.data ?? item) : item;
    return normalizeBackendPlan(scoped);
  });
}
/**
 * Normalize a backend expense row into the UI `Expense` shape.
 * Tolerates snake_case / camelCase / `date` aliases.
 */
function normalizeExpense(raw) {
  const r = raw ?? {};
  const pick = (...keys) => {
    for (const k of keys) {
      const v = r[k];
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return undefined;
  };
  const str = (v) => (typeof v === "string" ? v : String(v ?? ""));
  const statusRaw = String(pick("status") ?? "PENDING").toUpperCase();
  const hostel = pick("hostel");
  return {
    id: str(pick("id", "_id", "expenseId", `exp-${Date.now()}`)),
    hostelId:
      pick("hostelId", "hostel_id") ?? (typeof hostel?.id === "string" ? hostel.id : undefined),
    hostelName:
      pick("hostelName", "hostel_name") ??
      (typeof hostel?.name === "string" ? hostel.name : undefined),
    title: str(pick("title", "name")),
    category: String(pick("category") ?? "OTHER").toUpperCase(),
    amount: pick("amount"),
    expenseDate: str(pick("expenseDate", "expense_date", "date")),
    date: str(pick("date") ?? ""),
    notes: pick("notes", "description", "remarks") ?? null,
    status: ["PAID", "PENDING"].includes(statusRaw) ? statusRaw : "PENDING",
    createdAt: pick("createdAt", "created_at"),
    updatedAt: pick("updatedAt", "updated_at"),
  };
}
/** Normalize `GET /subscriptions/current` (nullable sub + plan + usage). */
function normalizeSubscriptionCurrent(raw) {
  const data = unwrap(raw) ?? {};
  const rawSub = data.subscription ?? data.current ?? null;
  const hasSub =
    rawSub !== null &&
    typeof rawSub === "object" &&
    ("id" in rawSub || "plan" in rawSub || "status" in rawSub);
  const nested = data.plan;
  const limits = data.limits ?? data.usage ?? null;
  const num = (v) => {
    if (v === undefined || v === null || v === "") return undefined;
    const n = typeof v === "string" ? Number(v) : v;
    return Number.isFinite(n) ? n : undefined;
  };
  const numOrNull = (v) => {
    if (v === undefined || v === "") return undefined;
    if (v === null) return null;
    const n = typeof v === "string" ? Number(v) : v;
    return Number.isFinite(n) ? n : undefined;
  };
  return {
    subscription: hasSub
      ? {
          id: rawSub?.id != null ? String(rawSub.id) : undefined,
          plan: toPlanId(rawSub?.plan ?? rawSub?.planName),
          status: toSubStatus(rawSub?.status),
          billingCycle: toBilling(rawSub?.billingCycle),
          price:
            typeof rawSub?.price === "number" || typeof rawSub?.price === "string"
              ? rawSub.price
              : undefined,
          currency: typeof rawSub?.currency === "string" ? rawSub.currency : undefined,
          startDate: typeof rawSub?.startDate === "string" ? rawSub.startDate : undefined,
          endDate:
            rawSub?.endDate === null
              ? null
              : typeof rawSub?.endDate === "string"
                ? rawSub.endDate
                : undefined,
          autoRenew: typeof rawSub?.autoRenew === "boolean" ? rawSub.autoRenew : undefined,
          hostelId: typeof rawSub?.hostelId === "string" ? rawSub.hostelId : undefined,
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
          residentLimit: numOrNull(limits.residentLimit ?? limits.residentsLimit ?? limits.limit),
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
function toPlanId(v) {
  if (v === undefined || v === null || v === "") return undefined;
  const s = String(v).toUpperCase();
  if (s === "FREE" || s === "BASIC" || s === "PRO" || s === "ENTERPRISE") return s;
  return undefined;
}
function toSubStatus(v) {
  if (v === undefined || v === null || v === "") return undefined;
  return String(v).toUpperCase();
}
function toBilling(v) {
  if (v === undefined || v === null || v === "") return undefined;
  return String(v).toUpperCase();
}
/** Normalize `GET /subscriptions/check-limit` (200 allowed or blocked). */
function normalizeCheckLimit(raw) {
  const data = unwrap(raw) ?? {};
  const num = (v) => {
    if (v === undefined || v === null || v === "") return undefined;
    const n = typeof v === "string" ? Number(v) : v;
    return Number.isFinite(n) ? n : undefined;
  };
  const numOrNull = (v) => {
    if (v === undefined || v === "") return undefined;
    if (v === null) return null;
    const n = typeof v === "string" ? Number(v) : v;
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
function normalizeSubscriptionHistory(raw) {
  const data = unwrap(raw);
  const arr = Array.isArray(data) ? data : [];
  return arr.map((row) => {
    const r = row ?? {};
    const hostel = r.hostel ?? null;
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
        typeof r.paymentMethod === "string" ? r.paymentMethod.toUpperCase() : undefined,
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
function normalizeSubscriptionRequests(raw) {
  const data = unwrap(raw);
  const arr = Array.isArray(data) ? data : Array.isArray(data?.items) ? (data.items ?? []) : [];
  return arr.map((row) => {
    const r = row ?? {};
    return {
      id: String(r.id ?? ""),
      ownerId: String(r.ownerId ?? ""),
      ownerName: typeof r.ownerName === "string" ? r.ownerName : "Hostel Owner",
      ownerEmail: typeof r.ownerEmail === "string" ? r.ownerEmail : null,
      hostelId: typeof r.hostelId === "string" ? r.hostelId : null,
      hostelName: typeof r.hostelName === "string" ? r.hostelName : null,
      plan: toPlanId(r.plan) ?? "FREE",
      status: toSubStatusLoose(r.status) ?? "PENDING",
      billingCycle: toBilling(r.billingCycle) ?? "MONTHLY",
      price: typeof r.price === "number" || typeof r.price === "string" ? r.price : 0,
      currency: typeof r.currency === "string" ? r.currency : "NPR",
      paymentMethod: typeof r.paymentMethod === "string" ? r.paymentMethod.toUpperCase() : null,
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
function toSubStatusLoose(v) {
  if (v === undefined || v === null || v === "") return undefined;
  return String(v).toUpperCase();
}
/** Normalize GET /expenses list (tolerates `{ data }` / raw array). */
function normalizeExpenseList(payload) {
  const { items } = toPaginated(payload);
  return items.map(normalizeExpense);
}
/**
 * Normalize GET /expenses list pagination.
 * Spec: `{ pagination: { totalItems, currentPage, totalPages, itemsPerPage, hasNextPage, hasPrevPage } }`.
 * Falls back to the `meta` envelope or item count when uncached.
 */
function normalizeExpensePagination(payload, fallbackLimit) {
  const root = payload ?? {};
  const scopes = [root];
  const data = root.data;
  if (data !== null && typeof data === "object" && !Array.isArray(data)) {
    scopes.push(data);
  }
  const pickPag = (...keys) => {
    for (const scope of scopes) {
      const holders = [scope.pagination, scope.meta, scope];
      for (const holder of holders) {
        if (holder !== null && typeof holder === "object" && !Array.isArray(holder)) {
          for (const k of keys) {
            const v = holder[k];
            if (v !== undefined && v !== null && v !== "") return v;
          }
        }
      }
    }
    return undefined;
  };
  const numOf = (v, fallback) => {
    const n = typeof v === "string" ? Number(v) : v;
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
function normalizeFacility(raw) {
  const r = raw ?? {};
  const pick = (...keys) => {
    for (const k of keys) {
      const v = r[k];
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return undefined;
  };
  const str = (v, fallback = "") =>
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
    hostelId: pick("hostelId", "hostel_id", "hostel") ?? undefined,
  };
}
/** Serialize a room payload to multipart FormData (image under `image` key). */
function roomToFormData(payload, imageFile) {
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
/** Per-request config for FormData uploads.
 * The shared axios instance defaults to `Content-Type: application/json` —
 * that MUST be removed so the browser/XHR generates
 * `multipart/form-data; boundary=...` itself. A manually-set multipart
 * Content-Type (or a stale JSON one) leaves multer with no usable boundary,
 * so `uploadRoomImage` / `stripFileFields('image')` would see junk. */
function multipartConfig(extraHeaders) {
  return {
    headers: extraHeaders,
    transformRequest: [
      (data, headers) => {
        headers?.delete?.("Content-Type");
        return data;
      },
    ],
  };
}
exports.socketRooms = {
  user: (userId) => `user:${userId}`,
  role: (role) => `role:${role}`,
  hostel: (hostelId) => `hostel:${hostelId}`,
};
/**
 * Socket room + event contract (backend spec).
 * Authenticated clients join `user:<userId>`, `role:<ROLE>`, `hostel:<hostelId>`.
 * Domain events: `hostel:updated`, `booking:confirmed`,
 * `leave:status_changed`, `payment:processed`.
 */
exports.socketEvents = {
  hostelUpdated: "hostel:updated",
  bookingConfirmed: "booking:confirmed",
  leaveStatusChanged: "leave:status_changed",
  paymentProcessed: "payment:processed",
};
/**
 * Lazy socket.io client (zero bundle cost when NEXT_PUBLIC_SOCKET_URL is unset).
 * Cookie-authenticated; caller joins user:/role:/hostel: rooms via joinSessionRooms.
 * Returns null when unconfigured.
 */
async function connectSocket(opts) {
  const url = process.env.NEXT_PUBLIC_SOCKET_URL;
  if (!url || typeof window === "undefined") return null;
  const { io } = await Promise.resolve().then(() => __importStar(require("socket.io-client")));
  return io(url, {
    withCredentials: true,
    transports: ["websocket", "polling"],
    ...(opts?.path ? { path: opts.path } : {}),
  });
}
/** Join caller rooms for the current session. */
function joinSessionRooms(socket, opts) {
  if (opts.userId) socket.emit("join", exports.socketRooms.user(opts.userId));
  if (opts.role) socket.emit("join", exports.socketRooms.role(opts.role));
  if (opts.hostelId) socket.emit("join", exports.socketRooms.hostel(opts.hostelId));
}
// Typed API client for HostelGhar endpoints (production-grade)
exports.hostelGhar = {
  auth: {
    register: (payload) => axios_1.default.post(`${PREFIX}/auth/register`, payload),
    login: (payload) => axios_1.default.post(`${PREFIX}/auth/login`, payload),
    me: () => axios_1.default.get(`${PREFIX}/auth/me`),
    forgotPassword: (payload) => axios_1.default.post(`${PREFIX}/auth/forgot-password`, payload),
    resetPassword: (payload) => axios_1.default.patch(`${PREFIX}/auth/reset-password`, payload),
    changePassword: (payload) => axios_1.default.put(`${PREFIX}/auth/change-password`, payload),
  },
  admin: {
    listHostels: (params) => getWithRetry(`${PREFIX}/admin/hostels`, params),
    // Create WITH logo FILE: backend accepts multipart FormData (fields + file
    // part `logo` or `image`, JPEG/PNG/WEBP/AVIF ≤3MB → Cloudinary logoUrl).
    // NOTE: send ONLY the file part — do NOT also append a `logo` text field
    // (filename/URL string); the backend strips stray text parts and only the
    // real file buffer is uploaded. Let axios set the multipart boundary
    // (no manual Content-Type) so multer can parse the file.
    createHostel: (payload, logoFile) => {
      if (!logoFile) return axios_1.default.post(`${PREFIX}/admin/hostels`, payload);
      const form = new FormData();
      Object.entries(payload).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") form.append(key, String(value));
      });
      form.append("logo", logoFile, logoFile.name);
      return axios_1.default.post(`${PREFIX}/admin/hostels`, form, {
        headers: { "Content-Type": undefined },
      });
    },
    uploadHostelLogo: (hostelId, logoFile) => {
      const form = new FormData();
      form.append("logo", logoFile, logoFile.name);
      return axios_1.default.post(`${PREFIX}/admin/hostels/${hostelId}/logo`, form, {
        headers: { "Content-Type": undefined },
      });
    },
    assignOwner: (hostelId, payload) =>
      axios_1.default.put(`${PREFIX}/admin/hostels/${hostelId}/owner`, payload),
    createOwner: (payload, imageFile) => {
      if (!imageFile) return axios_1.default.post(`${PREFIX}/admin/owners`, payload);
      const form = new FormData();
      Object.entries(payload).forEach(([key, value]) => form.append(key, value));
      form.append("image", imageFile, imageFile.name);
      return axios_1.default.post(`${PREFIX}/admin/owners`, form, {
        headers: { "Content-Type": undefined },
      });
    },
  },
  analytics: {
    adminSummary: () => getWithRetry(`${PREFIX}/analytics/admin/summary`),
    ownerSummary: () => getWithRetry(`${PREFIX}/analytics/owner/summary`),
  },
  subscriptions: {
    /**
     * GET /subscriptions/plans — public list (optional auth personalizes
     * `isCurrent`; axios sends the token when present, anonymous = FREE).
     * 200 `Subscription plans fetched successfully.`
     */
    plans: () => getWithRetry(`${PREFIX}/subscriptions/plans`),
    /**
     * GET /subscriptions/current?hostelId=uuid — owner/admin, hostel required
     * (explicit param or `X-Hostel-Id`). Null subscription = FREE fallback.
     * 200 `Current subscription fetched successfully.`
     */
    current: (hostelId) => getWithRetry(`${PREFIX}/subscriptions/current`, { hostelId }),
    /**
     * POST /subscriptions/subscribe — owner/admin, hostel required.
     * FREE = instant downgrade. Paid plans = payment-proof screenshot uploaded
     * (multipart field `proof`); the row is stored as PENDING and activates
     * only after an admin approves it. 201 with `requiresApproval: true`.
     */
    subscribe: (payload) => {
      const { proof, ...rest } = payload;
      if (!proof) {
        return axios_1.default.post(`${PREFIX}/subscriptions/subscribe`, {
          ...rest,
          billingCycle: rest.billingCycle ?? "MONTHLY",
        });
      }
      const form = new FormData();
      Object.entries(rest).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") form.append(key, String(value));
      });
      form.append("proof", proof, proof.name);
      return axios_1.default.post(`${PREFIX}/subscriptions/subscribe`, form, {
        headers: { "Content-Type": undefined },
      });
    },
    /**
     * GET /subscriptions/requests — ADMIN ONLY review queue of owner payment
     * proofs (defaults to PENDING). Returns `{ data, meta }` pagination.
     */
    requests: (params) => getWithRetry(`${PREFIX}/subscriptions/requests`, params),
    /**
     * POST /subscriptions/requests/:id/review — ADMIN ONLY. APPROVE activates
     * the plan immediately; REJECT keeps the owner on their current plan.
     */
    reviewRequest: (id, action, note) =>
      axios_1.default.post(`${PREFIX}/subscriptions/requests/${id}/review`, {
        action,
        ...(note ? { note } : {}),
      }),
    /**
     * POST /subscriptions/cancel — owner/admin, hostel required.
     * Deactivates ACTIVE → EXPIRED; next current is FREE.
     * 200 `Subscription cancelled successfully.` (no data).
     */
    cancel: (hostelId) => axios_1.default.post(`${PREFIX}/subscriptions/cancel`, { hostelId }),
    /** GET /subscriptions/history — owner/admin, no hostel, newest first. */
    history: () => getWithRetry(`${PREFIX}/subscriptions/history`),
    /**
     * GET /subscriptions/check-limit?hostelId=uuid&count=1 — owner/admin.
     * Always 200: `allowed` true/false (+ upgrade hint when blocked).
     * PRO/ENTERPRISE limit null → allowed true.
     */
    checkLimit: (hostelId, count = 1) =>
      getWithRetry(`${PREFIX}/subscriptions/check-limit`, { hostelId, count }),
  },
  bookings: {
    create: (payload, idempotencyKey) =>
      axios_1.default.post(`${PREFIX}/bookings`, payload, {
        headers: idemHeaders(idempotencyKey ?? newIdempotencyKey()),
      }),
    myBookings: () => getWithRetry(`${PREFIX}/bookings/my-bookings`),
    hostelBookings: (hostelId, params) =>
      getWithRetry(`${PREFIX}/bookings/hostels/${hostelId}`, params),
    updateStatus: (bookingId, payload) =>
      axios_1.default.patch(`${PREFIX}/bookings/${bookingId}/status`, payload),
    cancel: (bookingId) => axios_1.default.delete(`${PREFIX}/bookings/${bookingId}`),
  },
  hostels: {
    list: (params) => getWithRetry(`${PREFIX}/hostels`, params),
    get: (id) => getWithRetry(`${PREFIX}/hostels/${id}`),
    /** GET /hostels/:id/residents — active residents for an admin or owner. */
    residents: (id, params) => getWithRetry(`${PREFIX}/hostels/${id}/residents`, params),
    leaveTypes: (id) =>
      getWithRetry(
        `${PREFIX}/hostels/${id}/leave-types`,
        // Backend sends ETag → browser revalidates → 304 with EMPTY body.
        // Bypass the HTTP cache so we always get a 200 with the real list.
        noCacheParams()
      ),
  },
  beds: {
    list: (params) => getWithRetry(`${PREFIX}/beds`, params),
    create: (payload) =>
      axios_1.default.post(`${PREFIX}/beds`, payload, {
        headers: idemHeaders(newIdempotencyKey()),
      }),
    update: (id, payload) => axios_1.default.patch(`${PREFIX}/beds/${id}`, payload),
  },
  rooms: {
    /** GET /rooms — paginated rooms of logged-in owner (?page=&limit=&status=&type=&hostelId=). */
    list: (params) => getWithRetry(`${PREFIX}/rooms`, params),
    /** GET /rooms/:id — single owner room detail. */
    get: (id) => getWithRetry(`${PREFIX}/rooms/${id}`),
    /** POST /rooms — owner creates a room (ownerId from JWT). JSON or multipart image. */
    create: (payload, imageFile) => {
      if (!imageFile)
        return axios_1.default.post(`${PREFIX}/rooms`, payload, {
          headers: idemHeaders(newIdempotencyKey()),
        });
      // IMPORTANT: do NOT set Content-Type manually for FormData — axios/the
      // browser must generate the multipart boundary, otherwise multer on the
      // backend cannot parse the file and `stripFileFields('image')` sees junk.
      return axios_1.default.post(
        `${PREFIX}/rooms`,
        roomToFormData(payload, imageFile),
        multipartConfig(idemHeaders(newIdempotencyKey()))
      );
    },
    /** PATCH /rooms/:id — owner partially updates their room (JSON or multipart image). */
    update: (id, payload, imageFile) => {
      if (!imageFile) return axios_1.default.patch(`${PREFIX}/rooms/${id}`, payload);
      return axios_1.default.patch(
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
    listByHostel: (hostelId) => getWithRetry(`${PREFIX}/hostels/${hostelId}/facilities`),
    /**
     * PUT /hostels/:hostelId/facilities — full sync (replace).
     * Send the whole frontend editor list; DB ends matching it.
     * Frontend `id` maps to `clientKey`. Requires role owner/admin.
     */
    syncHostel: (hostelId, facilities) =>
      axios_1.default.put(`${PREFIX}/hostels/${hostelId}/facilities`, { facilities }),
    /**
     * POST /hostels/:hostelId/facilities — add (or update) one facility.
     * Body: { id?, title, description?, tag? }.
     */
    createForHostel: (hostelId, payload) =>
      axios_1.default.post(`${PREFIX}/hostels/${hostelId}/facilities`, payload, {
        headers: idemHeaders(newIdempotencyKey()),
      }),
    /**
     * DELETE /hostels/:hostelId/facilities/:facilityKey — removes a facility.
     * `:facilityKey` accepts the junction UUID **or** the frontend `clientKey`.
     * Pass the clientKey by default (stable across syncs); falls back to the
     * junction id when only that is known.
     */
    removeFromHostel: (hostelId, facilityKey) =>
      axios_1.default.delete(
        `${PREFIX}/hostels/${encodeURIComponent(hostelId)}/facilities/${encodeURIComponent(facilityKey)}`
      ),
    // ------------------------------------------------------------------
    // Legacy global facilities (deprecated — backend moved to hostel scope).
    // Kept so older callsites don't break at import time.
    // ------------------------------------------------------------------
    /** GET /facilities — owner facilities (?hostelId=). @deprecated use listByHostel */
    list: (params) => getWithRetry(`${PREFIX}/facilities`, params),
    /** GET /facilities/:id — single facility detail. */
    get: (id) => getWithRetry(`${PREFIX}/facilities/${id}`),
    /**
     * POST /facilities — owner adds a facility (ownerId from JWT).
     * Sends canonical fields PLUS `name`/`category` aliases so backends that
     * validate either variant both pass (extra keys are ignored server-side).
     */
    create: (payload) => {
      const body = {
        title: payload.title,
        name: payload.name ?? payload.title,
        description: payload.description,
        details: payload.description,
        tag: payload.tag,
        category: payload.category ?? payload.tag,
        ...(payload.hostelId ? { hostelId: payload.hostelId } : {}),
      };
      return axios_1.default.post(`${PREFIX}/facilities`, body, {
        headers: idemHeaders(newIdempotencyKey()),
      });
    },
    /** PATCH /facilities/:id — owner updates their facility. */
    update: (id, payload) => axios_1.default.patch(`${PREFIX}/facilities/${id}`, payload),
    /** DELETE /facilities/:id — owner removes a facility. */
    remove: (id) => axios_1.default.delete(`${PREFIX}/facilities/${id}`),
  },
  owner: {
    dashboard: () => getWithRetry(`${PREFIX}/owner/dashboard`),
    createResident: (payload) =>
      axios_1.default.post(`${PREFIX}/owner/residents`, payload, {
        headers: idemHeaders(newIdempotencyKey()),
      }),
    createLeaveType: (payload) =>
      axios_1.default.post(`${PREFIX}/owner/leave-types`, payload, {
        headers: idemHeaders(newIdempotencyKey()),
      }),
    /** GET /owner/residents — ALL active residents across owned hostels. */
    residents: (params) => getWithRetry(`${PREFIX}/owner/residents`, params),
    /** GET /owner/residents/form-options/hostels — Add-Resident hostel dropdown. */
    residentFormHostels: () => getWithRetry(`${PREFIX}/owner/residents/form-options/hostels`),
    /** GET /owner/residents/form-options/flats — flat dropdown (flat = Room.floor). */
    residentFormFlats: (hostelId) =>
      getWithRetry(`${PREFIX}/owner/residents/form-options/flats`, { hostelId }),
    /** GET /owner/residents/form-options/rooms — dynamic room dropdown. */
    residentFormRooms: (hostelId, flat) =>
      getWithRetry(
        `${PREFIX}/owner/residents/form-options/rooms`,
        flat === undefined ? { hostelId } : { hostelId, flat }
      ),
    /** GET /owner/residents/form-options/rooms/detail — single-room refresh. */
    residentFormRoomDetail: (hostelId, roomNumber) =>
      getWithRetry(`${PREFIX}/owner/residents/form-options/rooms/detail`, { hostelId, roomNumber }),
    generateFeesNow: (payload) =>
      axios_1.default.post(`${PREFIX}/owner/fees/generate-now`, payload ?? {}, {
        headers: idemHeaders(newIdempotencyKey()),
      }),
    /** GET /owner/resident-imports/template — CSV template download (blob). */
    residentImportTemplate: () =>
      axios_1.default.get(`${PREFIX}/owner/resident-imports/template`, {
        responseType: "blob",
      }),
    /** GET /owner/resident-imports/plan-limits — powers "View plan limits". */
    residentImportPlanLimits: () => getWithRetry(`${PREFIX}/owner/resident-imports/plan-limits`),
    /**
     * POST /owner/resident-imports?hostelId=<uuid> (multipart `file`).
     * Queues background import; returns the QUEUED history row.
     */
    startResidentImport: (hostelId, file, idempotencyKey) => {
      const form = new FormData();
      form.append("file", file, file.name);
      // The API expects multipart/form-data; leaving the default JSON content-type
      // on the axios instance prevents the browser from generating the multipart boundary.
      return axios_1.default.post(`${PREFIX}/owner/resident-imports`, form, {
        params: { hostelId },
        headers: {
          "Content-Type": "multipart/form-data",
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        },
      });
    },
    /** GET /owner/resident-imports — paginated import history. */
    residentImports: (params) => getWithRetry(`${PREFIX}/owner/resident-imports`, params),
    /** GET /owner/resident-imports/:id — single import incl. row errors. */
    residentImportDetail: (id) => getWithRetry(`${PREFIX}/owner/resident-imports/${id}`),
  },
  resident: {
    applyLeave: (payload) =>
      axios_1.default.post(`${PREFIX}/resident/leaves/apply`, payload, {
        headers: idemHeaders(newIdempotencyKey()),
      }),
    leaves: (params) => getWithRetry(`${PREFIX}/resident/leaves`, params),
    fees: () => getWithRetry(`${PREFIX}/resident/fees`),
    /** GET /fees/:feeId/payment-proofs (resident) — 404 until backend ships; callers fall back to local. */
    paymentProofs: (params) => getWithRetry(`${PREFIX}/resident/payment-proofs`, params),
  },
  leaves: {
    hostelRequests: (hostelId, params) =>
      getWithRetry(`${PREFIX}/leaves/hostels/${hostelId}/requests`, params),
    updateRequestStatus: (requestId, payload) =>
      axios_1.default.patch(`${PREFIX}/leaves/requests/${requestId}/status`, payload),
  },
  fees: {
    /**
     * POST /fees/generate-monthly — owner/admin generates this month's bills
     * for one hostel. `month`/`year` optional (backend defaults to current).
     */
    generateMonthly: (payload) =>
      axios_1.default.post(`${PREFIX}/fees/generate-monthly`, payload ?? {}, {
        headers: idemHeaders(newIdempotencyKey()),
      }),
    /**
     * GET /fees/hostels/:hostelId — owner/admin lists hostel fee ledger.
     * Supports `?status=` / pagination via ListParams.
     */
    hostelFees: (hostelId, params) => getWithRetry(`${PREFIX}/fees/hostels/${hostelId}`, params),
    /**
     * PATCH /fees/:id/payment — owner/admin records payment against a fee.
     * Sends canonical + legacy aliases so backend validation (amount vs
     * paidAmount vs total, method vs paymentMethod/payment_method) passes:
     * { amount, paidAmount, total, method, paymentMethod, payment_method, status }.
     * The `Idempotency-Key` header is dropped — the backend rejects unknown
     * headers on this route with 400.
     */
    recordPayment: (feeId, payload) => {
      const amount = Number(payload.amount) || 0;
      const backendMethod = toBackendPaymentMethod(payload.method);
      const status = payload.status ? toBackendFeeStatus(payload.status) : undefined;
      const body = {
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
      return axios_1.default.patch(`${PREFIX}/fees/${feeId}/payment`, body);
    },
    /**
     * Manual status override — tries PATCH /fees/:id/status, then falls back
     * to PATCH /fees/:id. Sends canonical + legacy keys for max tolerance.
     * NULL is never sent (backend enum is PENDING|PARTIALLY_PAID|PAID|OVERDUE).
     */
    updateStatus: async (feeId, payload) => {
      const status = toBackendFeeStatus(payload.status);
      const body = {
        status,
        feeStatus: status,
        paymentStatus: status,
        payment_status: status,
      };
      try {
        return await axios_1.default.patch(`${PREFIX}/fees/${feeId}/status`, body);
      } catch (err) {
        const code = (0, axios_1.toApiError)(err).status;
        if (code !== 404 && code !== 405) throw err;
        return await axios_1.default.patch(`${PREFIX}/fees/${feeId}`, body);
      }
    },
    /** GET /fees/hostels/:hostelId/payment-proofs — 404 until backend ships; callers fall back to local. */
    hostelPaymentProofs: (hostelId, params) =>
      getWithRetry(`${PREFIX}/fees/hostels/${hostelId}/payment-proofs`, params),
  },
  expenses: {
    /**
     * POST /expenses — owner/admin records a hostel cost.
     * Body: { hostelId, title, category, amount, expenseDate, notes?, status }.
     */
    create: (payload) =>
      axios_1.default.post(`${PREFIX}/expenses`, payload, {
        headers: idemHeaders(newIdempotencyKey()),
      }),
    /**
     * GET /expenses?page=&limit=&hostelId=&category=&status= — paginated list.
     * Owners without `hostelId` get only their own hostels; admins get everything.
     * `page`/`limit` are normalized server-side (max 100).
     */
    list: (params) => getWithRetry(`${PREFIX}/expenses`, cleanHostelParams(params)),
    /** GET /expenses/:id — single expense (404 when missing/forbidden hostel). */
    get: (id) => getWithRetry(`${PREFIX}/expenses/${id}`),
    /**
     * PUT /expenses/:id — full update of title/category/amount/expenseDate/notes/status.
     * `hostelId` is immutable — create a new row to move hostels.
     */
    update: (id, payload) => axios_1.default.put(`${PREFIX}/expenses/${id}`, payload),
    /**
     * PATCH /expenses/:id — partial update of title/category/amount/expenseDate/notes/status.
     * `hostelId` is immutable — create a new row to move hostels.
     */
    patch: (id, payload) => axios_1.default.patch(`${PREFIX}/expenses/${id}`, payload),
    /** DELETE /expenses/:id — removes an expense. */
    remove: (id) => axios_1.default.delete(`${PREFIX}/expenses/${id}`),
  },
  paymentQrs: {
    /**
     * Backend `paymentQrRouter` mount.
     * Override with `NEXT_PUBLIC_PAYMENT_QR_PATH` if backend mounts elsewhere
     * (e.g. `/payment-qr`, `/paymentQr`). Default follows REST plural convention.
     */
    basePath: paymentQrBasePath(),
    /** GET / — list all QRs (RESIDENT, OWNER, ADMIN). */
    list: (params) => getWithRetry(paymentQrBasePath(), cleanHostelParams(params)),
    /** GET /resident — dedicated resident view under My Payments. */
    residentView: (params) =>
      getWithRetry(`${paymentQrBasePath()}/resident`, cleanHostelParams(params)),
    /** GET /preview — "Preview Resident View" for owners. */
    preview: (params) => getWithRetry(`${paymentQrBasePath()}/preview`, cleanHostelParams(params)),
    /** GET /:id — single QR by id (RESIDENT, OWNER, ADMIN). */
    detail: (id) => getWithRetry(`${paymentQrBasePath()}/${id}`),
    /** POST /demo — "Load Demo QRs": seeds eSewa, Khalti, Bank (OWNER, ADMIN). */
    loadDemo: (payload) => {
      const body = { ...(payload ?? {}) };
      const hid = validHostelId(body.hostelId);
      if (hid) body.hostelId = hid;
      else delete body.hostelId;
      return axios_1.default.post(`${paymentQrBasePath()}/demo`, body, {
        headers: idemHeaders(newIdempotencyKey()),
      });
    },
    /**
     * POST / — create QR (OWNER, ADMIN).
     * Sends multipart `qrCode` when `payload.file` is present,
     * otherwise JSON with `qrCodeUrl`. Body is canonicalized to
     * { paymentMethod, accountName, accountIdentifier, qrCodeUrl }.
     */
    create: (payload, opts) =>
      axios_1.default.post(paymentQrBasePath(), toPaymentQrForm(payload, opts), {
        headers: {
          ...idemHeaders(newIdempotencyKey()),
          ...(payload.file instanceof File ? { "Content-Type": "multipart/form-data" } : {}),
        },
      }),
    /**
     * PUT /:id — "Replace QR" / full update (OWNER, ADMIN).
     * Multipart when `payload.file` present, else JSON.
     */
    replace: (id, payload, opts) =>
      axios_1.default.put(`${paymentQrBasePath()}/${id}`, toPaymentQrForm(payload, opts), {
        headers:
          payload.file instanceof File ? { "Content-Type": "multipart/form-data" } : undefined,
      }),
    /** PATCH /:id — partial update (OWNER, ADMIN). */
    patch: (id, payload, opts) =>
      axios_1.default.patch(`${paymentQrBasePath()}/${id}`, toPaymentQrForm(payload, opts), {
        headers:
          payload.file instanceof File ? { "Content-Type": "multipart/form-data" } : undefined,
      }),
    /** PATCH /:id/toggle — toggle active/inactive (OWNER, ADMIN). */
    toggleStatus: (id) => axios_1.default.patch(`${paymentQrBasePath()}/${id}/toggle`, {}),
    /** DELETE /:id — "Remove" QR (OWNER, ADMIN). */
    remove: (id) => axios_1.default.delete(`${paymentQrBasePath()}/${id}`),
  },
};
exports.default = exports.hostelGhar;
