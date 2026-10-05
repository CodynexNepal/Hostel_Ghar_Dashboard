import type { AdminSummary } from "./api-types";
import type { Hostel } from "../types/hostel";
import type { SubscriptionRequest } from "./api-types";

/** One row in the dashboard's pending-approval queue (live, from /subscriptions/requests). */
export interface AdminPendingApproval extends SubscriptionRequest {}

/**
 * Aggregated admin-dashboard payload.
 * Every field is optional/tolerant — the backend may omit sections and the
 * UI must still render (missing = "—" / empty list, never a crash).
 */
export interface AdminDashboardData {
  summary: AdminSummary | null;
  summaryError: string | null;
  hostels: Hostel[];
  hostelsError: string | null;
  pendingApprovals: AdminPendingApproval[];
  pendingTotal: number | null;
  approvalsError: string | null;
  /** True when at least the summary endpoint answered (else show degraded banner). */
  isLive: boolean;
}
