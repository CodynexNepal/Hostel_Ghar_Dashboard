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
  LeaveRequest,
  LeaveType,
  HostelDetail,
  ResidentDetail,
  ResidentImport,
  ResidentImportPlanLimits,
  OwnerDashboard,
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

/** Strip an invalid/non-UUID `hostelId` from list query params. */
function cleanHostelParams<T extends { hostelId?: string } | undefined>(
  params?: T
): { hostelId?: string } | undefined {
  if (!params || typeof params !== "object") return undefined;
  const hid = validHostelId((params as { hostelId?: string }).hostelId);
  if (hid) return { ...(params as object), hostelId: hid };
  const { hostelId: _omit, ...rest } = params as Record<string, unknown>;
  void _omit;
  return rest as { hostelId?: string } | undefined;
}

/**
 * Map frontend BANK → backend BANK_TRANSFER enum.
 * Backend `paymentMethod` only accepts: ESEWA | KHALTI | BANK_TRANSFER.
 */
export function toBackendPaymentMethod(raw: unknown): string {
  const v = String(raw ?? "").toUpperCase().trim();
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
  const idMatch = text.match(/(?:A\/C|ID|ID No|Acc(?:ount)?(?: No| Number)?)\s*[:#-]?\s*([A-Za-z0-9+_./@ -]{3,})\s*$/i);
  if (idMatch?.[1]) {
    const identifier = idMatch[1].trim().replace(/[•·|]+.*$/, "").trim();
    const name = text.slice(0, idMatch.index).replace(/[•·|:,\-–—\s]+$/, "").trim();
    return { accountName: name || fallbackName, accountIdentifier: identifier };
  }
  const parts = text.split(/[•·|]/).map((p) => p.trim()).filter(Boolean);
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
    const hid = validHostelId(
      (p as Record<string, unknown>).hostelId as string | null | undefined
    );
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
  const paymentMethod = str(pick("paymentMethod", "payment_method", "method", "tag", "provider") || "") || undefined;
  const accountName = str(pick("accountName", "account_name") || "") || undefined;
  const accountIdentifier = str(pick("accountIdentifier", "account_identifier", "accountNumber") || "") || undefined;
  // Rebuild a display label for the UI from canonical parts (fall back to legacy label).
  const legacyLabel = str(pick("label", "accountLabel") || "");
  const label =
    legacyLabel ||
    [accountName, accountIdentifier].filter(Boolean).join(accountName && accountIdentifier ? " • " : "") ||
    undefined;
  return {
    ...(r as PaymentQr),
    id: str(pick("id", "_id", "qrId") || `qr-${Date.now()}`),
    paymentMethod,
    accountName,
    accountIdentifier,
    method: paymentMethod as PaymentQr["method"],
    label,
    qrCodeUrl: str(
      pick("qrCodeUrl", "qrCodeURL", "qr_code_url", "imageUrl", "qrUrl", "image", "qr", "url") || ""
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
    }) =>
      getWithRetry<Bed[] | ApiEnvelope<Bed[]>>(`${PREFIX}/beds`, params),
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
      getWithRetry<PaymentQr | ApiEnvelope<PaymentQr>>(
        `${paymentQrBasePath()}/${id}`
      ),
    /** POST /demo — "Load Demo QRs": seeds eSewa, Khalti, Bank (OWNER, ADMIN). */
    loadDemo: (payload?: LoadDemoQrPayload) => {
      const body = { ...(payload ?? {}) };
      const hid = validHostelId(body.hostelId);
      if (hid) body.hostelId = hid;
      else delete body.hostelId;
      return api.post<PaymentQr[] | ApiEnvelope<PaymentQr[]>>(
        `${paymentQrBasePath()}/demo`,
        body,
        { headers: idemHeaders(newIdempotencyKey()) }
      );
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
            ...(payload.file instanceof File
              ? { "Content-Type": "multipart/form-data" }
              : {}),
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
            payload.file instanceof File
              ? { "Content-Type": "multipart/form-data" }
              : undefined,
        }
      ),
    /** PATCH /:id — partial update (OWNER, ADMIN). */
    patch: (id: string, payload: PatchPaymentQrPayload, opts?: { hostelName?: string }) =>
      api.patch<PaymentQr | ApiEnvelope<PaymentQr>>(
        `${paymentQrBasePath()}/${id}`,
        toPaymentQrForm(payload, opts),
        {
          headers:
            payload.file instanceof File
              ? { "Content-Type": "multipart/form-data" }
              : undefined,
        }
      ),
    /** PATCH /:id/toggle — toggle active/inactive (OWNER, ADMIN). */
    toggleStatus: (id: string) =>
      api.patch<PaymentQr | ApiEnvelope<PaymentQr>>(
        `${paymentQrBasePath()}/${id}/toggle`,
        {}
      ),
    /** DELETE /:id — "Remove" QR (OWNER, ADMIN). */
    remove: (id: string) =>
      api.delete<unknown>(
        `${paymentQrBasePath()}/${id}`
      ),
  },
};

export default hostelGhar;
