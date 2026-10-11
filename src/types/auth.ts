export type UserRole = "SUPER_ADMIN" | "HOSTEL_OWNER" | "RESIDENT";

export type SubscriptionPlan = "FREE" | "BASIC" | "PRO" | "ENTERPRISE";

export type Permission =
  | "VIEW_DASHBOARD"
  | "VIEW_HOSTEL"
  | "MANAGE_HOSTEL"
  | "CREATE_HOSTEL"
  | "VIEW_RESIDENTS"
  | "ADD_RESIDENT"
  | "IMPORT_RESIDENTS"
  | "MANAGE_ROOMS"
  | "MANAGE_PAYMENTS"
  | "VIEW_REPORTS"
  | "VIEW_ANALYTICS"
  | "MANAGE_STAFF"
  | "MANAGE_EXPENSES"
  | "MANAGE_INVOICES"
  | "MANAGE_SUBSCRIPTION"
  | "MANAGE_SETTINGS"
  | "MANAGE_PLATFORM";

export interface SubscriptionInfo {
  plan: SubscriptionPlan;
  status: "ACTIVE" | "TRIAL" | "EXPIRED" | "CANCELLED";
  residentsUsed: number;
  /** null = unlimited (PRO / ENTERPRISE). Never coerce to 500. */
  residentsLimit: number | null;
  renewsAt: string;
  startedAt: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  avatarUrl?: string;
  hostelId?: string;
  hostelName?: string;
  subscription: SubscriptionInfo;
}
