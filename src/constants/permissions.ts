import type { Permission, SubscriptionPlan } from "@/types/auth";

/**
 * Centralized plan -> permission map.
 * NEVER scatter plan checks in UI. Always use hasPermission / usePermissions.
 * Backend must enforce authorization independently — frontend is UX only.
 */
export const PLAN_PERMISSIONS: Record<SubscriptionPlan, Permission[]> = {
  FREE: [
    "VIEW_DASHBOARD",
    "VIEW_HOSTEL",
    "VIEW_RESIDENTS",
    "MANAGE_SUBSCRIPTION",
    "MANAGE_SETTINGS",
  ],
  BASIC: [
    "VIEW_DASHBOARD",
    "VIEW_HOSTEL",
    "MANAGE_HOSTEL",
    "VIEW_RESIDENTS",
    "ADD_RESIDENT",
    "MANAGE_ROOMS",
    "MANAGE_PAYMENTS",
    "MANAGE_EXPENSES",
    "MANAGE_SUBSCRIPTION",
    "MANAGE_SETTINGS",
  ],
  PRO: [
    "VIEW_DASHBOARD",
    "VIEW_HOSTEL",
    "MANAGE_HOSTEL",
    "VIEW_RESIDENTS",
    "ADD_RESIDENT",
    "IMPORT_RESIDENTS",
    "MANAGE_ROOMS",
    "MANAGE_PAYMENTS",
    "MANAGE_EXPENSES",
    "MANAGE_INVOICES",
    "MANAGE_STAFF",
    "VIEW_REPORTS",
    "VIEW_ANALYTICS",
    "MANAGE_SUBSCRIPTION",
    "MANAGE_SETTINGS",
  ],
  ENTERPRISE: [
    "VIEW_DASHBOARD",
    "VIEW_HOSTEL",
    "MANAGE_HOSTEL",
    "CREATE_HOSTEL",
    "VIEW_RESIDENTS",
    "ADD_RESIDENT",
    "IMPORT_RESIDENTS",
    "MANAGE_ROOMS",
    "MANAGE_PAYMENTS",
    "MANAGE_EXPENSES",
    "MANAGE_INVOICES",
    "MANAGE_STAFF",
    "VIEW_REPORTS",
    "VIEW_ANALYTICS",
    "MANAGE_SUBSCRIPTION",
    "MANAGE_SETTINGS",
    "MANAGE_PLATFORM",
  ],
};

export const PERMISSION_UPSELL: Record<Permission, { title: string; bullets: string[] }> = {
  VIEW_DASHBOARD: { title: "Dashboard", bullets: ["Overview of your hostel"] },
  VIEW_HOSTEL: { title: "Hostel Profile", bullets: ["View hostel profile"] },
  MANAGE_HOSTEL: {
    title: "Hostel Management",
    bullets: ["Edit hostel profile", "Manage facilities"],
  },
  CREATE_HOSTEL: {
    title: "Create Hostels",
    bullets: ["Create multiple hostels", "Available on Enterprise"],
  },
  VIEW_RESIDENTS: { title: "Residents", bullets: ["View resident list"] },
  ADD_RESIDENT: {
    title: "Add More Residents",
    bullets: [
      "Add unlimited residents",
      "Manage resident profiles",
      "Assign rooms",
      "Track resident payments",
      "Generate resident reports",
    ],
  },
  IMPORT_RESIDENTS: {
    title: "Bulk Resident Import",
    bullets: ["Import residents via CSV", "Validate rows automatically", "Assign rooms in bulk"],
  },
  MANAGE_ROOMS: {
    title: "Advanced Room Management",
    bullets: ["Create and edit rooms", "Track occupancy", "Manage room types and rent"],
  },
  MANAGE_PAYMENTS: {
    title: "Payment Management",
    bullets: ["Record payments", "Track pending dues", "Reminders and history"],
  },
  VIEW_REPORTS: {
    title: "Reports",
    bullets: ["Occupancy reports", "Revenue reports", "Export to CSV / PDF"],
  },
  VIEW_ANALYTICS: {
    title: "Advanced Analytics",
    bullets: ["Revenue trends", "Occupancy insights", "Payment collection analytics"],
  },
  MANAGE_STAFF: {
    title: "Staff Management",
    bullets: ["Add staff members", "Assign roles", "Track attendance"],
  },
  MANAGE_EXPENSES: { title: "Expenses", bullets: ["Track hostel expenses", "Categorize spending"] },
  MANAGE_INVOICES: {
    title: "Invoices",
    bullets: ["Generate invoices", "Send to residents", "Track invoice status"],
  },
  MANAGE_SUBSCRIPTION: { title: "Subscription", bullets: ["View and manage your plan"] },
  MANAGE_SETTINGS: { title: "Settings", bullets: ["Manage hostel settings"] },
  MANAGE_PLATFORM: { title: "Platform Settings", bullets: ["Super admin platform controls"] },
};
