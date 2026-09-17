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
  CreateRoomPayload,
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
  OwnerDashboard,
  AdminSummary,
  OwnerSummary,
  Owner,
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
  return null;
}

export function toPaginated<T>(payload: unknown): Paginated<T> {
  if (Array.isArray(payload)) return { items: payload, meta: null };
  const root = payload as ApiEnvelope<T[] | { data?: T[]; residents?: T[] }> & {
    residents?: T[];
  };
  const meta = unwrapMeta(payload);
  let items: T[] = [];
  if (Array.isArray(root?.data)) items = root.data as T[];
  else if (root?.data && typeof root.data === "object") {
    const nested = root.data as { data?: unknown; residents?: unknown };
    if (Array.isArray(nested.data)) items = nested.data as T[];
    else if (Array.isArray(nested.residents)) items = nested.residents as T[];
  }
  if (items.length === 0 && Array.isArray(root?.residents)) items = root.residents;
  return { items, meta };
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
    (str(pick("junctionId", "junction_id"), "") ||
      str(pick("id", "_id"), "")) ||
    undefined;
  const fallbackId =
    clientKey ||
    str(pick("id", "_id", "facilityId", "facility_id"), `facility-${Date.now()}`);
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
      getWithRetry<LeaveType[] | ApiEnvelope<LeaveType[]>>(`${PREFIX}/hostels/${id}/leave-types`),
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
    get: (id: string) =>
      getWithRetry<unknown | ApiEnvelope<unknown>>(`${PREFIX}/facilities/${id}`),
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
    createLeaveType: (payload: { hostelId: string; name: string; maxDays?: number }) =>
      api.post<LeaveType>(`${PREFIX}/owner/leave-types`, payload),
    generateFeesNow: (payload?: Record<string, string | number | boolean>) =>
      api.post<{ message: string; generated?: number }>(
        `${PREFIX}/owner/fees/generate-now`,
        payload ?? {}
      ),
  },

  resident: {
    applyLeave: (payload: ApplyLeavePayload) =>
      api.post<LeaveRequest>(`${PREFIX}/resident/leaves/apply`, payload, {
        headers: idemHeaders(newIdempotencyKey()),
      }),
    leaves: () =>
      getWithRetry<LeaveRequest[] | ApiEnvelope<LeaveRequest[]>>(`${PREFIX}/resident/leaves`),
    fees: () => getWithRetry<Fee[] | ApiEnvelope<Fee[]>>(`${PREFIX}/resident/fees`),
  },

  leaves: {
    hostelRequests: (hostelId: string, status?: string) =>
      getWithRetry<LeaveRequest[] | ApiEnvelope<LeaveRequest[]>>(
        `${PREFIX}/leaves/hostels/${hostelId}/requests`,
        status ? { status } : undefined
      ),
    updateRequestStatus: (requestId: string, payload: { status: string }) =>
      api.patch<LeaveRequest>(`${PREFIX}/leaves/requests/${requestId}/status`, payload),
  },

  fees: {
    generateMonthly: (payload?: Record<string, string | number | boolean>) =>
      api.post<{ message: string; generated?: number }>(
        `${PREFIX}/fees/generate-monthly`,
        payload ?? {}
      ),
    hostelFees: (hostelId: string, params?: ListParams) =>
      getWithRetry<Fee[] | ApiEnvelope<Fee[]>>(`${PREFIX}/fees/hostels/${hostelId}`, params),
    recordPayment: (feeId: string, payload: RecordPaymentPayload) =>
      api.patch<Fee>(`${PREFIX}/fees/${feeId}/payment`, payload, {
        headers: idemHeaders(newIdempotencyKey()),
      }),
  },
};

export default hostelGhar;
