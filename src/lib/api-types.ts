import type { AuthUser, UserRole } from "@/types/auth";
import type { Hostel, Room } from "@/types/hostel";
import type { PaymentStatus, Resident } from "@/types/resident";

/** Backend envelope: { data, message?, meta? } OR raw array/object. */
export interface ApiEnvelope<T> {
  data?: T;
  message?: string;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
}

export interface Paginated<T> {
  items: T[];
  meta: PaginationMeta | null;
}

export interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  city?: string;
  [key: string]: string | number | boolean | undefined;
}

/* ---------------- Auth ---------------- */
export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  phone: string;
  password: string;
  hostelName?: string;
  role?: UserRole;
}

export interface LoginResponse {
  message: string;
  token?: string;
  accessToken?: string;
  user?: AuthUser;
}

export interface RegisterResponse {
  token?: string;
  user?: AuthUser;
  message?: string;
}

export interface CreateOwnerPayload {
  ownerName: string;
  email: string;
  phone: string;
  address: string;
}

export interface Owner {
  id: string;
  ownerName: string;
  email: string;
  phone: string;
  address: string;
  avatarUrl?: string | null;
}

/* ---------------- Hostels ---------------- */
export interface CreateHostelPayload {
  name: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  /** Required by backend: BOYS or GIRLS. */
  type: "BOYS" | "GIRLS";
  ownerId?: string;
}

export interface HostelDetail extends Hostel {
  description?: string;
  facilities?: string[];
  rooms?: Room[];
  occupancyRate?: number;
}

/* ---------------- Residents ---------------- */
export interface CreateResidentPayload {
  name: string;
  email: string;
  phone: string;
  hostelId: string;
  /** Optional flat (alias of floor) — dynamic Add-Resident form field. */
  flat?: number;
  roomNumber: string;
  bedNumber: string;
  /** Optional — inherited from room inventory when omitted. */
  monthlyRent?: number;
  joinedDate?: string;
}

export interface ResidentDetail extends Resident {
  hostelId?: string;
  hostelName?: string;
  roomId?: string;
  userId?: string;
}

/* ---------------- Rooms ---------------- */

export interface CreateRoomPayload {
  roomNumber: string;
  floor: number;
  type: "SINGLE" | "DOUBLE" | "TRIPLE" | "DORM";
  capacity: number;
  monthlyRent: number;
  status?: "AVAILABLE" | "OCCUPIED" | "FULL" | "MAINTENANCE";
  /** Backend may accept array or comma-separated string (multipart fields are strings). */
  amenities?: string[] | string;
  /** Optional — ownerId comes from JWT; hostelId filter/scope when known. */
  hostelId?: string;
  description?: string;
}

export type UpdateRoomPayload = Partial<CreateRoomPayload> & {
  occupied?: number;
};

export interface RoomListParams extends ListParams {
  status?: string;
  type?: string;
  hostelId?: string;
}

export type BedStatus = "AVAILABLE" | "OCCUPIED" | "RESERVED" | "MAINTENANCE";

export interface Bed {
  id: string;
  hostelId?: string;
  roomId?: string;
  roomNumber?: string;
  bedNumber?: string;
  residentName?: string | null;
  monthlyRent?: number | string;
  monthlyFee?: number | string;
  rentAmount?: number | string;
  type?: string;
  roomType?: string;
  status: BedStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateBedPayload {
  hostelId: string;
  roomNumber: string;
  bedNumber: string;
  status?: BedStatus;
  rentAmount?: number;
}

/* ---------------- Bookings ---------------- */
export type BookingStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "CONFIRMED";

export interface Booking {
  id: string;
  hostelId: string;
  hostelName?: string;
  userId?: string;
  userName?: string;
  checkInDate: string;
  status: BookingStatus;
  remarks?: string;
  createdAt?: string;
}

export interface CreateBookingPayload {
  hostelId: string;
  checkInDate: string;
  remarks?: string;
}

/* ---------------- Leaves ---------------- */
export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface LeaveRequest {
  id: string;
  residentId?: string;
  resident?: {
    id?: string;
    roomNumber?: string;
    bedNumber?: string;
    monthlyRent?: string | number;
    user?: {
      id?: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      avatarUrl?: string | null;
    };
  };
  userId?: string;
  userName?: string;
  user?: { name?: string };
  hostelId?: string;
  type?: string;
  leaveTypeId?: string;
  leaveType?: LeaveType;
  fromDate: string;
  toDate: string;
  startDate?: string;
  endDate?: string;
  remarks?: string;
  reason?: string;
  status: LeaveStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApplyLeavePayload {
  fromDate: string;
  toDate: string;
  remarks?: string;
  reason?: string;
  leaveTypeId?: string;
}

export interface LeaveType {
  id: string;
  name: string;
  hostelId?: string;
  maxDays?: number;
  /** Backend soft-delete / active flag — inactive rows still exist in DB. */
  isActive?: boolean;
  requiresParentApproval?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface NormalizedLeaveType extends LeaveType {
  description?: string;
}

/* ---------------- Fees / Payments ---------------- */
export type FeeStatus = "PAID" | "PENDING" | "OVERDUE" | "PARTIAL";

export type FeeType =
  | "MONTHLY_HOSTEL_FEE"
  | "ADMISSION_FEE"
  | "SECURITY_DEPOSIT"
  | "LATE_FEE"
  | "MISC"
  | string;

export interface Fee {
  id: string;
  residentId?: string;
  residentName?: string;
  resident?: {
    id?: string;
    name?: string;
    fullName?: string;
    firstName?: string;
    lastName?: string;
    roomNumber?: string;
    room_number?: string;
    room?: { roomNumber?: string; room_number?: string } | null;
  } | null;
  hostelId?: string;
  feeType?: FeeType;
  amount: number;
  dueAmount?: number;
  totalPayable?: number;
  paidAmount?: number;
  billingMonth?: number;
  billingYear?: number;
  dueDate?: string;
  month?: string;
  status: FeeStatus;
  method?: string;
  paidAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateFeePayload {
  residentId: string;
  hostelId: string;
  amount: number;
  dueDate: string;
  billingMonth: number;
  billingYear: number;
  feeType?: FeeType;
  dueAmount?: number;
  paidAmount?: number;
  status?: FeeStatus;
}

/** Domain socket events broadcast by the backend (owner/admin rooms). */
export type DomainSocketEvent =
  | "hostel:updated"
  | "booking:confirmed"
  | "leave:status_changed"
  | "payment:processed";

export interface RecordPaymentPayload {
  amount: number;
  method: "CASH" | "ESEWA" | "KHALTI" | "BANK";
  remarks?: string;
  month?: string;
}

/** Result of PATCH /fees/:id/payment. */
export interface RecordPaymentResult extends Partial<Fee> {
  message?: string;
}

/* ---------------- Facilities (hostel-scoped, normalized) ---------------- */

/**
 * Normalized hostel facility (GET /hostels/:hostelId/facilities).
 * - `id` is the **frontend-stable key** (= backend `clientKey`, e.g. `security-mu5ofghs`).
 *   The editor list, PUT sync payload, and POST upsert `id` all use this value.
 * - `junctionId` is the DB junction UUID (`id` in the GET payload) — accepted
 *   by DELETE alongside the clientKey, kept for debugging/fallback.
 */
export interface Facility {
  id: string;
  title: string;
  description: string;
  tag: string;
  slug?: string;
  facilityId?: string;
  junctionId?: string;
  clientKey?: string;
  hostelId?: string;
}

/** One row of the PUT full-sync payload — frontend `id` maps to `clientKey`. */
export interface HostelFacilitySyncItem {
  id: string;
  title: string;
  description?: string;
  tag?: string;
}

/** POST upsert body — add (or update) one facility. */
export interface UpsertHostelFacilityPayload {
  id?: string;
  title: string;
  description?: string;
  tag?: string;
}

export interface CreateFacilityPayload {
  title: string;
  description: string;
  tag: string;
  /** Frontend-stable key → backend `clientKey` (generated when omitted). */
  id?: string;
  /** Scoping — owner hostel when known (also sent as name/category aliases). */
  hostelId?: string;
  /** Aliases for backend variants that expect `name` / `category`. */
  name?: string;
  category?: string;
}

export type UpdateFacilityPayload = Partial<CreateFacilityPayload>;

/* ---------------- Resident bulk CSV import ---------------- */

export type ResidentImportStatus =
  "QUEUED" | "PROCESSING" | "COMPLETED" | "COMPLETED_WITH_ERRORS" | "FAILED";

export interface ResidentImportRowError {
  row: number;
  email?: string;
  message: string;
}

export interface ResidentImport {
  id: string;
  hostelId: string;
  fileName: string;
  status: ResidentImportStatus;
  totalRows: number;
  validRows: number;
  successCount: number;
  failedCount: number;
  rowErrors?: ResidentImportRowError[] | null;
  failureReason?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

export interface ResidentImportPlanLimits {
  maxRowsPerFile: number;
  maxFileBytes: number;
  maxConcurrentImports: number;
  monthlyRowBudget: number;
  columns: string[];
}

/* ---------------- Owner: residents & form-options ---------------- */

/** GET /owner/residents — active residents across all hostels owned by caller. */
export interface OwnerResidentsParams extends ListParams {
  hostelId?: string;
}

/** GET /owner/residents/form-options/hostels — hostel dropdown. */
export interface OwnerHostelOption {
  id: string;
  name: string;
  type?: string;
  city?: string;
  address?: string;
}

/** GET /owner/residents/form-options/flats — flat dropdown (flat = Room.floor). */
export interface OwnerFlatOption {
  flat: number;
  floor: number;
  roomCount: number;
}

export interface OwnerRoomBedOption {
  value: string;
  label: string;
  taken?: boolean;
  disabled?: boolean;
}

/**
 * GET /owner/residents/form-options/rooms[ /detail] — dynamic room dropdown row.
 * Frontend renders `label` directly; `beds` drives the Bed dropdown.
 */
export interface OwnerRoomOption {
  id: string;
  roomNumber: string;
  flat: number;
  floor: number;
  type?: string;
  capacity?: number;
  occupiedBeds?: number;
  freeBeds?: number;
  freeBedsText?: string;
  monthlyRent?: number;
  status?: string;
  available?: boolean;
  disabled?: boolean;
  group?: string;
  reason?: string | null;
  label: string;
  takenBeds?: string[];
  suggestedBeds?: string[];
  suggestedBed?: string | null;
  beds?: OwnerRoomBedOption[];
  hostelLinked?: boolean;
  hostelId?: string | null;
}

/** POST /owner/leave-types — create a leave (holiday) policy. */
export interface CreateLeaveTypePayload {
  hostelId: string;
  name: string;
  maxDays?: number;
}

/** POST /fees/generate-monthly & POST /owner/fees/generate-now. */
export interface GenerateFeesPayload {
  hostelId?: string;
  month?: string;
  year?: number | string;
  [key: string]: string | number | boolean | undefined;
}

/** Result of POST /fees/generate-monthly. */
export interface GenerateFeesResult {
  message?: string;
  generated?: number;
  skipped?: number;
  billingMonth?: number;
  billingYear?: number;
}

/* ---------------- Payment QRs ---------------- */

/**
 * Backend `paymentQrRouter` record.
 * Canonical backend DTO: `paymentMethod` (ESEWA | KHALTI | BANK_TRANSFER),
 * `accountName` (e.g. "Sunrise Hostel"), `accountIdentifier`
 * (e.g. eSewa/Khalti phone or bank A/C), `qrCodeUrl`.
 * Legacy aliases (`method`/`tag`, `label`, `imageUrl`) still tolerated on read.
 */
export type PaymentQrMethod = "ESEWA" | "KHALTI" | "BANK";

export type BackendPaymentMethod = "ESEWA" | "KHALTI" | "BANK_TRANSFER";

export interface PaymentQr {
  id: string;
  /** Canonical backend enum. */
  paymentMethod?: BackendPaymentMethod | string;
  /** e.g. "Sunrise Hostel". */
  accountName?: string;
  /** e.g. eSewa/Khalti phone number or bank account number. */
  accountIdentifier?: string;
  // ── legacy aliases (read-tolerant, never sent) ──
  /** eSewa / Khalti / Bank — backend may call this `tag` or `provider`. */
  method?: PaymentQrMethod | string;
  tag?: PaymentQrMethod | string;
  provider?: PaymentQrMethod | string;
  /** Human label shown under the QR (account id / bank + A/C). */
  label?: string;
  accountLabel?: string;
  accountNumber?: string;
  /** QR image URL (or data-URL). Backend may use `image`, `qr`, `file`. */
  qrCodeUrl?: string;
  imageUrl?: string;
  qrUrl?: string;
  image?: string;
  url?: string;
  hostelId?: string;
  hostelName?: string;
  isActive?: boolean;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface PaymentQrListParams extends ListParams {
  hostelId?: string;
  paymentMethod?: string;
  method?: string;
  tag?: string;
  status?: string;
  active?: boolean;
}

export interface LoadDemoQrPayload {
  hostelId?: string;
  hostelName?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface CreatePaymentQrPayload {
  hostelId?: string;
  /**
   * Canonical backend enum: ESEWA | KHALTI | BANK_TRANSFER.
   * Frontend `BANK` is auto-mapped to `BANK_TRANSFER` on send.
   */
  paymentMethod?: BackendPaymentMethod | string;
  /** e.g. "Sunrise Hostel" (required by backend). */
  accountName?: string;
  /** e.g. eSewa/Khalti phone or bank A/C number (required by backend). */
  accountIdentifier?: string;
  // ── frontend conveniences (mapped to canonical fields on send, never sent raw) ──
  /** ESEWA | KHALTI | BANK — mapped to `paymentMethod`. */
  method?: PaymentQrMethod | string;
  tag?: PaymentQrMethod | string;
  provider?: PaymentQrMethod | string;
  /** Combined "Bank • A/C …" text — split into accountName/accountIdentifier on send. */
  label?: string;
  accountLabel?: string;
  accountNumber?: string;
  /** JSON path (when no file upload): direct QR image URL. */
  qrCodeUrl?: string;
  imageUrl?: string;
  isActive?: boolean;
  status?: string;
  /** File upload path — sent as multipart `qrCode`. */
  file?: File | null;
  [key: string]: unknown;
}

export type UpdatePaymentQrPayload = Partial<CreatePaymentQrPayload>;
export type PatchPaymentQrPayload = Partial<CreatePaymentQrPayload>;

/* ---------------- Owner dashboard / analytics ---------------- */
export interface OwnerDashboard {
  totalResidents?: number;
  occupiedBeds?: number;
  totalBeds?: number;
  availableBeds?: number;
  monthlyRevenue?: number;
  pendingPayments?: number;
  pendingAmount?: number;
  totalRooms?: number;
  availableRooms?: number;
  recentPayments?: Fee[];
  occupancyRate?: number;
}

export interface OwnerDashboardHostel {
  hostelId: string;
  hostelName?: string;
  hostelType?: string;
  totalActiveResidents?: string | number;
  residentsOnLeaveToday?: string | number;
}

export interface AdminSummary {
  totalHostels?: number;
  totalResidents?: number;
  mrr?: number;
  monthlyRevenue?: number;
  activePlans?: number | string;
  hostels?: Hostel[];
}

export interface OwnerSummary {
  hostel?: HostelDetail;
  residents?: number;
  occupancy?: number;
  revenue?: number;
  pendingDues?: number;
  [key: string]: unknown;
}
