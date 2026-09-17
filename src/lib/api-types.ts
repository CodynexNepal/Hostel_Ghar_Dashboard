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
  roomNumber: string;
  bedNumber: string;
  monthlyRent: number;
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
  userId?: string;
  userName?: string;
  user?: { name?: string };
  hostelId?: string;
  type?: string;
  leaveTypeId?: string;
  fromDate: string;
  toDate: string;
  remarks?: string;
  reason?: string;
  status: LeaveStatus;
  createdAt?: string;
}

export interface ApplyLeavePayload {
  fromDate: string;
  toDate: string;
  remarks?: string;
  reason?: string;
  leaveTypeId?: string;
  type?: string;
}

export interface LeaveType {
  id: string;
  name: string;
  hostelId?: string;
  maxDays?: number;
}

/* ---------------- Fees / Payments ---------------- */
export type FeeStatus = "PAID" | "PENDING" | "OVERDUE" | "PARTIAL";

export interface Fee {
  id: string;
  residentId?: string;
  residentName?: string;
  amount: number;
  dueDate?: string;
  month?: string;
  status: FeeStatus;
  method?: string;
  paidAt?: string;
  hostelId?: string;
}

export interface RecordPaymentPayload {
  amount: number;
  method: "CASH" | "ESEWA" | "KHALTI" | "BANK";
  remarks?: string;
  month?: string;
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
