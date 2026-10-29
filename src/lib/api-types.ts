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

export interface LogoutResponse {
  success?: boolean;
  message?: string;
  data?: {
    devicesRevoked?: string;
    cacheKeysPurged?: number;
  };
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
export type FeeStatus = "PAID" | "PENDING" | "OVERDUE" | "PARTIAL" | "PARTIALLY_PAID";

/** Backend canonical fee status — `PARTIAL` is stored/displayed as `PARTIALLY_PAID`. */
export type BackendFeeStatus = "PAID" | "PENDING" | "OVERDUE" | "PARTIALLY_PAID";

export type FeeType =
  "MONTHLY_HOSTEL_FEE" | "ADMISSION_FEE" | "SECURITY_DEPOSIT" | "LATE_FEE" | "MISC" | string;

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
  /** Room of the resident — present on dashboard `recentPayments` rows. */
  roomNumber?: string;
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

/* ---------------- Invoices (owner dashboard) ---------------- */
/**
 * Backend `feeRouter.post('/invoices', ...ownerOrAdmin, normalizeInvoiceFields,
 * `validateDto(CreateInvoiceDto)`, invoiceController.createInvoice)`.
 * `normalizeInvoiceFields` accepts both flat (`residentId`) and nested
 * (`resident.id`) shapes — send canonical flat keys.
 */
export type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "PENDING" | "OVERDUE" | "CANCELLED";

export interface CreateInvoicePayload {
  hostelId: string;
  residentId: string;
  /** Required by `CreateInvoiceDto` — 2–200 char string. */
  residentName: string;
  residentEmail?: string;
  amount: number;
  /** 1-12 — `normalizeInvoiceFields` also parses `billingMonth: "2026-09"`. */
  billingMonth: number;
  billingYear: number;
  dueDate?: string;
  status?: InvoiceStatus | string;
  feeType?: string;
  notes?: string;
}

export interface Invoice {
  id: string;
  hostelId?: string;
  residentId?: string;
  residentName?: string;
  residentEmail?: string;
  resident?: { id?: string; name?: string; email?: string; [key: string]: unknown };
  amount?: number | string;
  totalPayable?: number | string;
  billingMonth?: number | string;
  billingYear?: number | string;
  month?: string;
  dueDate?: string;
  status?: InvoiceStatus | string;
  feeType?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface InvoiceListParams extends ListParams {
  hostelId?: string;
  residentId?: string;
  status?: string;
}

/** Domain socket events broadcast by the backend (owner/admin rooms). */
export type DomainSocketEvent =
  "hostel:updated" | "booking:confirmed" | "leave:status_changed" | "payment:processed";

export interface RecordPaymentPayload {
  amount: number;
  method: "CASH" | "ESEWA" | "KHALTI" | "BANK";
  remarks?: string;
  month?: string;
  /** Optional manual override — sent only when owner picks a status explicitly. */
  status?: BackendFeeStatus | FeeStatus;
}

/** Manual status change — `PATCH /fees/:id/status` preferred, `PATCH /fees/:id` fallback. */
export interface UpdateFeeStatusPayload {
  status: BackendFeeStatus | FeeStatus;
}

/** Result of PATCH /fees/:id/payment. */
export interface RecordPaymentResult extends Partial<Fee> {
  message?: string;
}

/* ---------------- Expenses ---------------- */

export type ExpenseCategory =
  "FOOD" | "UTILITIES" | "MAINTENANCE" | "SALARIES" | "SUPPLIES" | "OTHER" | string;

export type ExpenseStatus = "PAID" | "PENDING";

export interface Expense {
  id: string;
  hostelId?: string;
  hostelName?: string;
  title: string;
  category: ExpenseCategory;
  amount: number | string;
  expenseDate: string;
  /** Aliases accepted from backend variants. */
  date?: string;
  notes?: string | null;
  status: ExpenseStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateExpensePayload {
  hostelId: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  expenseDate: string;
  notes?: string;
  status: ExpenseStatus;
}

export type UpdateExpensePayload = Partial<
  Pick<CreateExpensePayload, "title" | "category" | "amount" | "expenseDate" | "notes" | "status">
>;

export interface ExpenseListParams extends ListParams {
  hostelId?: string;
  category?: string;
  status?: string;
}

export interface ExpensePagination {
  totalItems: number;
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
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

/**
 * One bucket of `OwnerDashboard.revenueTrend` (GET /owner/dashboard).
 * Backend sends either a bare collected figure or collected + billed pair;
 * `normalizeRevenueTrend` resolves both shapes (and month → label).
 */
export interface RevenueTrendPoint {
  /** Display label, e.g. "Apr" / "Apr 2026" — always present. */
  label: string;
  billingMonth?: number;
  billingYear?: number;
  /** Money collected in the bucket. */
  collected: number;
  /** Money billed/expected in the bucket — drives the collection percentage. */
  billed?: number;
  /**
   * Money still outstanding in the bucket (backend sends this instead of
   * `billed`). Total billed = collected + outstanding.
   */
  outstanding?: number;
  /** Direct pending amount sent in backend trends.revenue (equivalent to outstanding). */
  pending?: number;
  /** Raw period string from backend, e.g. "2026-09". */
  period?: string;
}

/** One row of `OwnerDashboard.floorOverview` — rooms/beds per floor. */
export interface FloorOverviewItem {
  /** Floor index as sent by backend (number when possible). */
  floor: number | string;
  /** Display label ("Floor 2", or the backend's flat name when provided). */
  label: string;
  rooms: number;
  occupiedBeds?: number;
  totalBeds?: number;
}

/** One row of `OwnerDashboard.roomMix` — room count per room type. */
export interface RoomMixItem {
  type: string;
  /** Display label ("Double", "Dorm") derived from `type`. */
  label: string;
  rooms: number;
  occupiedBeds?: number;
  totalBeds?: number;
}

/**
 * Aggregate `hostelGhar.owner.dashboard()` response — the single payload that
 * feeds the whole owner dashboard (stats + charts + recent payment rows), so
 * the dashboard no longer needs a separate payments/ledger call.
 * Every field is optional: normalizeOwnerDashboard fills what it can and the
 * UI falls back to derived values (rooms list) for the rest.
 */
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
  /** Latest rent collections — replaces the removed /payments page feed. */
  recentPayments?: Fee[];
  /** Monthly collected/billed series for the revenue chart. */
  revenueTrend?: RevenueTrendPoint[];
  /** Rooms + beds grouped by floor. */
  floorOverview?: FloorOverviewItem[];
  /** Rooms grouped by room type. */
  roomMix?: RoomMixItem[];
  /** Collected ÷ billed for the period, 0–100 when backend sends it. */
  collectionRate?: number;
  occupancyRate?: number;
  occupiedRooms?: number;
  residentsOnLeaveToday?: number;
  totalHostels?: number;
  pendingCount?: number;
  /** Per-hostel rows sent when the owner owns more than one hostel. */
  hostels?: OwnerDashboardHostel[];
}

export interface OwnerDashboardHostel {
  hostelId: string;
  hostelName?: string;
  hostelType?: string;
  totalActiveResidents?: string | number;
  residentsOnLeaveToday?: string | number;
}

export interface AdminSummaryOccupancy {
  totalBeds?: number;
  occupiedBeds?: number;
  availableBeds?: number;
  /** Backend sends a 0–1 fraction; the UI renders a 0–100 percentage. */
  rate?: number;
}

/** `data.stats` block of GET /analytics/admin/summary. */
export interface AdminSummaryStats {
  totalHostels?: number;
  totalResidents?: number;
  mrr?: number;
  /** What MRR is derived from, e.g. "activeSubscriptions". */
  mrrBasis?: string;
  mrrCurrency?: string;
  mrrPaidPlans?: number;
  mrrFreePlans?: number;
  mrrLapsedPlans?: number;
  occupancy?: AdminSummaryOccupancy;
}

/** `data.pendingApprovals` block — a count plus a deep-link to the queue. */
export interface AdminSummaryPendingApprovals {
  count?: number;
  reviewUrl?: string;
}

export interface AdminRecentHostelOwner {
  id?: string;
  name?: string;
  email?: string;
  avatarUrl?: string | null;
}

/** One row of `data.recentHostels` (lightweight — no beds/rooms detail). */
export interface AdminRecentHostel {
  id: string;
  name: string;
  type?: string;
  city?: string;
  logoUrl?: string | null;
  createdAt?: string | null;
  owner?: AdminRecentHostelOwner | null;
}

/** `data.health` block — revenue/occupancy/collection snapshot. */
export interface AdminSummaryHealth {
  monthlyRevenue?: number;
  totalRevenue?: number;
  pendingDues?: number;
  rooms?: number;
  bedsOccupied?: number;
  activePlans?: number;
  currency?: string;
  collectionRate?: number;
}

/** `data.feeLifecycle` block — platform invoice status distribution. */
export interface AdminFeeLifecycle {
  total: number;
  paid: number;
  pending: number;
  overdue: number;
  partiallyPaid?: number;
}

/** `data.finance` block — all-time vs current month financials. */
export interface AdminFinanceSummary {
  allTime?: {
    collected?: number;
    outstanding?: number;
  };
  thisMonth?: {
    billed?: number;
    collected?: number;
    pending?: number;
    collectionRate?: number;
  };
}

/** `data.planMix` block — subscription distribution across hostels. */
export interface AdminPlanMixSummary {
  hostelsOnPlans?: number;
  paid?: number;
  free?: number;
  lapsed?: number;
  paidPercent?: number;
  freePercent?: number;
  lapsedPercent?: number;
}

export interface AdminSummary {
  totalHostels?: number;
  totalResidents?: number;
  /** Registered platform users (owners + residents + admins). */
  users?: number;
  activeResidents?: number;
  pendingBookings?: number;
  pendingLeaves?: number;
  unpaidFees?: number;
  /** Fee amount collected (all time / period, per backend). */
  paidAmount?: number;
  outstandingAmount?: number;
  currency?: string;
  mrr?: number;
  mrrBasis?: string;
  monthlyRevenue?: number;
  totalRevenue?: number;
  pendingAmount?: number;
  totalFees?: number;
  paidFees?: number;
  pendingFees?: number;
  overdueFees?: number;
  collectionRate?: number;
  occupancyRate?: number;
  totalBeds?: number;
  occupiedBeds?: number;
  availableBeds?: number;
  totalRooms?: number;
  activePlans?: number | string;
  /** When the backend computed this snapshot (ISO string). */
  generatedAt?: string;
  /** True when the backend served this from its L1/L2 cache. */
  isCached?: boolean;
  /** Cache tier the response came from, e.g. "L2". */
  cacheLevel?: string;
  pendingApprovals?: AdminSummaryPendingApprovals;
  recentHostels?: AdminRecentHostel[];
  /** Original nested blocks, kept for components that want the raw shape. */
  stats?: AdminSummaryStats;
  health?: AdminSummaryHealth;
  hostels?: Hostel[];
  revenueTrend?: RevenueTrendPoint[];
  feeLifecycle?: AdminFeeLifecycle;
  finance?: AdminFinanceSummary;
  planMix?: AdminPlanMixSummary;
  trends?: {
    revenue?: RevenueTrendPoint[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * GET /analytics/owner/summary — owner-scoped totals + fee aggregates.
 * All variant key shapes are tolerated by `normalizeOwnerSummary`.
 */
export interface OwnerSummary {
  hostel?: HostelDetail;
  residents?: number;
  totalResidents?: number;
  occupancy?: number;
  occupancyRate?: number;
  revenue?: number;
  monthlyRevenue?: number;
  totalRevenue?: number;
  pendingDues?: number;
  pendingAmount?: number;
  pendingCount?: number;
  collectionRate?: number;
  totalBeds?: number;
  occupiedBeds?: number;
  totalRooms?: number;
  availableRooms?: number;
  revenueTrend?: RevenueTrendPoint[];
  [key: string]: unknown;
}

/* ---------------- Subscriptions ---------------- */

/**
 * Backend subscription contract — `GET /subscriptions/*`.
 * Base mount: `routes.use('/subscriptions', router)` under `/v1/hostel-ghar`.
 * Owner routes also accept `admin`. Auth: `Authorization: Bearer <token>`
 * or `access_token` cookie (axios sends both transports).
 */
export type SubscriptionPlanId = "FREE" | "BASIC" | "PRO" | "ENTERPRISE";

export type SubscriptionStatus = "ACTIVE" | "EXPIRED" | "CANCELLED" | "PENDING" | "REJECTED";

/** How the owner paid for a plan upgrade (screenshot proof is uploaded too). */
export type SubscriptionPaymentMethod = "ESEWA" | "KHALTI" | "BANK" | "CASH";

/** Admin action on `POST /subscriptions/requests/:id/review`. */
export type SubscriptionReviewAction = "APPROVE" | "REJECT";

export type BillingCycle = "MONTHLY" | "YEARLY";

/** One tier from `GET /subscriptions/plans` (currency NPR, null = unlimited). */
export interface BackendPlan {
  id: SubscriptionPlanId;
  name: string;
  tagline?: string;
  price?: number;
  currency?: string;
  billingPeriod?: string;
  formattedPrice?: string;
  badge?: string | null;
  features?: string[] | { label: string; included: boolean }[];
  buttonText?: string;
  cta?: string;
  limits?: {
    residents?: number | null;
    hostels?: number | null;
    maxResidents?: number | null;
    maxHostels?: number | null;
  } | null;
  featureFlags?: Record<string, boolean>;
  isCurrent?: boolean;
}

/** `GET /subscriptions/current` — nullable subscription + plan + usage. */
export interface SubscriptionCurrent {
  subscription?: {
    id?: string;
    plan?: SubscriptionPlanId;
    status?: SubscriptionStatus;
    billingCycle?: BillingCycle;
    price?: number | string;
    currency?: string;
    startDate?: string;
    endDate?: string | null;
    autoRenew?: boolean;
    hostelId?: string;
  } | null;
  plan?: BackendPlan | null;
  limits?: {
    residentCount?: number;
    residentLimit?: number | null;
    residentLimitReached?: boolean;
    hostelCount?: number;
    hostelLimit?: number | null;
    hostelLimitReached?: boolean;
  } | null;
  daysRemaining?: number | null;
}

/** `POST /subscriptions/subscribe` body. `hostelId` falls back to `X-Hostel-Id`. */
export interface SubscribePayload {
  plan: SubscriptionPlanId;
  hostelId?: string;
  billingCycle?: BillingCycle;
  paymentMethod?: SubscriptionPaymentMethod;
  paymentReference?: string;
  notes?: string;
  /**
   * Payment-success screenshot. Paid plans are NOT activated immediately —
   * the backend stores the proof and an admin approves the request.
   */
  proof?: File;
}

/** `GET /subscriptions/check-limit` — 200 either way, `allowed` decides. */
export interface SubscriptionCheckLimit {
  allowed?: boolean;
  currentPlan?: SubscriptionPlanId;
  planName?: string;
  limit?: number | null;
  currentCount?: number;
  message?: string;
  hint?: string;
}

/** One row of `GET /subscriptions/history` (newest first, with hostel). */
export interface SubscriptionHistoryItem {
  id?: string;
  plan?: SubscriptionPlanId;
  status?: SubscriptionStatus;
  billingCycle?: BillingCycle;
  price?: number | string;
  currency?: string;
  startDate?: string;
  endDate?: string | null;
  cancelledAt?: string | null;
  hostelId?: string;
  hostel?: { id?: string; name?: string } | null;
  hostelName?: string;
  createdAt?: string;
  /** Present on rows awaiting (or that passed) admin payment review. */
  paymentMethod?: SubscriptionPaymentMethod | null;
  paymentReference?: string | null;
  proofUrl?: string | null;
  reviewNote?: string | null;
  reviewedAt?: string | null;
}

/** One row of `GET /subscriptions/requests` — the admin review queue of owner
 * payment-proof requests (`PENDING` by default).
 */
export interface SubscriptionRequest {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerEmail?: string | null;
  hostelId: string | null;
  hostelName?: string | null;
  plan: SubscriptionPlanId;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  price: number | string;
  currency?: string;
  paymentMethod?: SubscriptionPaymentMethod | null;
  paymentReference?: string | null;
  notes?: string | null;
  proofUrl?: string | null;
  reviewNote?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  startDate?: string;
  endDate?: string | null;
  createdAt?: string;
}

/* ---------------- Settings (frontend-first contract) ---------------- */
/**
 * SETTINGS API CONTRACT — frontend-first.
 * The dashboard already calls these routes; the backend can implement them
 * later with the exact paths/methods below. Until then every caller falls
 * back to localStorage so the UI keeps working.
 *
 * Owner (requires OWNER / ADMIN, hostel-scoped via auth / X-Hostel-Id):
 *   GET /v1/hostel-ghar/settings/hostel         → HostelProfileSettings
 *   PUT /v1/hostel-ghar/settings/hostel         → HostelProfileSettings (body: UpdateHostelProfileSettingsPayload)
 *   GET /v1/hostel-ghar/settings/notifications  → NotificationPreferences
 *   PUT /v1/hostel-ghar/settings/notifications  → NotificationPreferences (body: UpdateNotificationPreferencesPayload)
 *   PUT /v1/hostel-ghar/auth/change-password    → { message } (already defined, wired to Security card)
 *
 * Platform admin (requires SUPER_ADMIN) — one URL per tab:
 *   GET /v1/hostel-ghar/admin/settings/general        → GeneralSettings
 *   PUT /v1/hostel-ghar/admin/settings/general        → GeneralSettings (body: UpdateGeneralSettingsPayload)
 *   GET /v1/hostel-ghar/admin/settings/billing        → BillingSettings
 *   PUT /v1/hostel-ghar/admin/settings/billing        → BillingSettings (body: UpdateBillingSettingsPayload)
 *   GET /v1/hostel-ghar/admin/settings/access         → AccessSettings
 *   PUT /v1/hostel-ghar/admin/settings/access         → AccessSettings (body: UpdateAccessSettingsPayload)
 *   GET /v1/hostel-ghar/admin/settings/alerts         → AlertSettings
 *   PUT /v1/hostel-ghar/admin/settings/alerts         → AlertSettings (body: UpdateAlertSettingsPayload)
 *   GET /v1/hostel-ghar/admin/settings/system         → SystemSettings
 *   PUT /v1/hostel-ghar/admin/settings/system         → SystemSettings (body: UpdateSystemSettingsPayload)
 *   POST /v1/hostel-ghar/admin/settings/system/purge-cache → { message, purgedAt? }
 *   GET /v1/hostel-ghar/admin/settings (legacy)       → PlatformSettings (full doc; kept as fallback)
 *   PUT /v1/hostel-ghar/admin/settings (legacy)       → PlatformSettings (partial allowed; kept as fallback)
 *   GET /v1/hostel-ghar/admin/platform-qrs      → PlatformQr[] (checkout QRs owners scan)
 *   POST /v1/hostel-ghar/admin/platform-qrs     → PlatformQr (multipart `qrImage` or JSON `qrImageUrl`)
 *   PUT /v1/hostel-ghar/admin/platform-qrs/:id  → PlatformQr (replace image/label)
 *   DELETE /v1/hostel-ghar/admin/platform-qrs/:id → { message }
 *
 * NOTE: hostel payment QRs (`paymentQrs` namespace) are already integrated
 * and untouched. Platform QRs (this contract) are the checkout QRs owners
 * scan on `/subscription` — previously localStorage-only, now backend-first
 * with localStorage fallback.
 */

/** Owner hostel profile shown on `/settings` (also printed on invoices). */
export interface HostelProfileSettings {
  id?: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  city?: string;
}

/** `PUT /settings/hostel` body — all fields optional, only sent keys update. */
export interface UpdateHostelProfileSettingsPayload {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
}

/** Owner rent-reminder / alert preferences shown on `/settings`. */
export interface NotificationPreferences {
  rentReminders: boolean;
  /** Days before due date to nudge (default 3). */
  reminderDaysBefore?: number;
  smsEnabled?: boolean;
  emailEnabled?: boolean;
}

/** `PUT /settings/notifications` body — partial update allowed. */
export type UpdateNotificationPreferencesPayload = Partial<NotificationPreferences>;

/** Platform-wide settings edited on `/admin/settings` (all tabs except QRs). */
export interface PlatformSettings {
  platformName: string;
  tagline: string;
  supportEmail: string;
  supportPhone: string;
  officeAddress: string;
  currency: string;
  timezone: string;
  gracePeriodDays: number;
  freeTierResidentCap: number;
  standardPlanPrice: number;
  enterprisePlanPrice: number;
  autoRemindRenewals: boolean;
  allowQrCheckout: boolean;
  allowPublicHostelSignup: boolean;
  requireHostelApproval: boolean;
  allowResidentSelfInvite: boolean;
  sessionLifetimeDays: number;
  requireAdmin2FA: boolean;
  notifyOnSubscriptionProof: boolean;
  overdueAlertThreshold: number;
  dailyDigestEmail: boolean;
  smsGatewayProvider: "SPARROW_SMS" | "AAKASH_SMS" | "MOCK";
  maintenanceMode: boolean;
  maintenanceMessage: string;
}

/** `PUT /admin/settings` body — partial update allowed. */
export type UpdatePlatformSettingsPayload = Partial<PlatformSettings>;

/* ---------------- Per-tab settings slices (one URL per tab) ---------------- */
/** General & Identity tab — `GET+PUT /admin/settings/general`. */
export interface GeneralSettings {
  platformName: string;
  tagline: string;
  supportEmail: string;
  supportPhone: string;
  officeAddress: string;
  currency: string;
  timezone: string;
}
export type UpdateGeneralSettingsPayload = Partial<GeneralSettings>;

/** Billing & Plans tab — `GET+PUT /admin/settings/billing`. */
export interface BillingSettings {
  gracePeriodDays: number;
  freeTierResidentCap: number;
  standardPlanPrice: number;
  enterprisePlanPrice: number;
  autoRemindRenewals: boolean;
  allowQrCheckout: boolean;
}
export type UpdateBillingSettingsPayload = Partial<BillingSettings>;

/** Access & Security tab — `GET+PUT /admin/settings/access`. */
export interface AccessSettings {
  allowPublicHostelSignup: boolean;
  requireHostelApproval: boolean;
  allowResidentSelfInvite: boolean;
  sessionLifetimeDays: number;
  requireAdmin2FA: boolean;
}
export type UpdateAccessSettingsPayload = Partial<AccessSettings>;

/** Alerts & Notifications tab — `GET+PUT /admin/settings/alerts`. */
export interface AlertSettings {
  notifyOnSubscriptionProof: boolean;
  overdueAlertThreshold: number;
  dailyDigestEmail: boolean;
  smsGatewayProvider: "SPARROW_SMS" | "AAKASH_SMS" | "MOCK";
}
export type UpdateAlertSettingsPayload = Partial<AlertSettings>;

/** System & Cache tab — `GET+PUT /admin/settings/system`. */
export interface SystemSettings {
  maintenanceMode: boolean;
  maintenanceMessage: string;
}
export type UpdateSystemSettingsPayload = Partial<SystemSettings>;

/* ---------------- Platform QRs (admin checkout QRs) ---------------- */
/**
 * Platform checkout QR — the official Hostel Ghar account owners pay TO on
 * `/subscription` (ESEWA / KHALTI / BANK). Separate from hostel `PaymentQr`
 * rows (what residents pay). Backend stores the image (multipart `qrImage`
 * or JSON `qrImageUrl`) and serves a public URL owners can scan.
 */
export type PlatformQrMethod = "ESEWA" | "KHALTI" | "BANK";

export interface PlatformQr {
  id: string;
  method: PlatformQrMethod | string;
  /** Public QR image URL (Cloudinary/S3) — owners scan this. */
  qrImageUrl: string;
  /** Human line under the QR (e.g. "eSewa ID: 98XXXXXXXX • Hostel Ghar"). */
  label: string;
  isActive?: boolean;
  updatedAt?: string;
  createdAt?: string;
  [key: string]: unknown;
}

/** `POST /admin/platform-qrs` body — multipart file or JSON url. */
export interface UpsertPlatformQrPayload {
  method: PlatformQrMethod | string;
  label: string;
  /** File upload path — sent as multipart `qrImage`. */
  file?: File | null;
  /** JSON path (when no file): direct image URL. */
  qrImageUrl?: string;
  isActive?: boolean;
}

/* ---------------- Staff (owner dashboard) ---------------- */
/**
 * Backend `staffRouter` record (OWNER, ADMIN).
 * Canonical DTO fields follow `CreateStaffDto` / `UpdateStaffDto`;
 * extra frontend-only fields (shift/status/notes) are tolerated on read
 * and stripped by `validateDto` on write.
 */
export type StaffStatus = "ACTIVE" | "ON LEAVE" | "INACTIVE";

export interface Staff {
  id: string;
  name: string;
  role?: string;
  position?: string;
  phone?: string;
  email?: string;
  shift?: string;
  status?: StaffStatus | string;
  salary?: number | string;
  monthlySalary?: number | string;
  emergencyContact?: string;
  emergencyPhone?: string;
  joinDate?: string;
  joinedAt?: string;
  joiningDate?: string;
  notes?: string;
  address?: string;
  hostelId?: string;
  hostelName?: string;
  /** Photo URL — backend may call this `photoUrl`, `photo`, `avatarUrl`, `imageUrl`. */
  photoUrl?: string;
  photo?: string;
  avatarUrl?: string;
  imageUrl?: string;
  image?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

/** `POST /staff` body — JSON, or multipart when a `photo` file is present. */
export interface CreateStaffPayload {
  name: string;
  phone: string;
  role: string;
  hostelId?: string;
  email?: string;
  shift?: string;
  status?: StaffStatus | string;
  salary?: number | string;
  emergencyContact?: string;
  joinDate?: string;
  notes?: string;
  address?: string;
  /** Direct photo URL (JSON path when no file is uploaded). */
  photoUrl?: string;
  avatarUrl?: string;
  /** File upload path — sent as multipart `photo` (see `uploadStaffPhoto`). */
  photo?: File | null;
  [key: string]: unknown;
}

/** `PUT/PATCH /staff/:id` body — full (PUT) or partial (PATCH). */
export type UpdateStaffPayload = Partial<CreateStaffPayload>;

export interface StaffListParams extends ListParams {
  hostelId?: string;
  role?: string;
  status?: string;
}

/* ---------------- Weekly Meals & Menu ---------------- */
export type DayOfWeek =
  "SUNDAY" | "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY";

export interface MealDayItem {
  id?: string | null;
  dayOfWeek: DayOfWeek;
  breakfastDescription?: string | null;
  breakfastTime?: string | null;
  breakfastNotes?: string | null;
  mainMealDescription?: string | null;
  mainMealTime?: string | null;
  mainMealNotes?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface DailyMealItem {
  id?: string;
  dayOfWeek?: string | null;
  mealName: string;
  mealNameEn?: string | null;
  time: string;
  menuDescription?: string | null;
  isActive: boolean;
  orderIndex: number;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface DailyMealSchedule {
  hostelId: string;
  dayOfWeek?: string | null;
  hasSchedule: boolean;
  isConfigured: boolean;
  lastUpdatedAt: string | null;
  schedule: DailyMealItem[];
  configuredDays?: string[];
}

export interface WeeklyMealSchedule {
  hostelId: string;
  hasSchedule?: boolean;
  lastUpdatedAt?: string | null;
  updatedAt?: string | null;
  schedule?: MealDayItem[];
  days?: MealDayItem[];
}

export interface SaveWeeklyMealsPayload {
  meals: MealDayItem[];
}

/* ---------------- Hostel Exact Location ---------------- */
export interface HostelLocation {
  hostelId: string;
  latitude: number | null;
  longitude: number | null;
  isLocationShared: boolean;
  locationUpdatedAt: string | null;
  address: string | null;
  city: string | null;
}

export interface UpdateHostelLocationPayload {
  latitude?: number | null;
  longitude?: number | null;
  isLocationShared: boolean;
}
