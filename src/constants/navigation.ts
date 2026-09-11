import {
  BarChart3,
  BedDouble,
  Building2,
  CreditCard,
  FileText,
  LayoutDashboard,
  Receipt,
  Settings,
  Users,
  Wallet,
  Crown,
  type LucideIcon,
} from "lucide-react";
import type { Permission, UserRole } from "@/types/auth";

export interface NavChild {
  label: string;
  href: string;
  permission?: Permission;
  badge?: string;
}

export interface NavItem {
  label: string;
  href?: string;
  icon: LucideIcon;
  permission?: Permission;
  roles?: UserRole[];
  children?: NavChild[];
}

export const OWNER_NAVIGATION: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: "VIEW_DASHBOARD" },
  {
    label: "Hostel",
    icon: Building2,
    permission: "VIEW_HOSTEL",
    children: [
      { label: "Overview", href: "/hostel", permission: "VIEW_HOSTEL" },
      { label: "Rooms", href: "/rooms", permission: "MANAGE_ROOMS" },
      { label: "Facilities", href: "/hostel/facilities", permission: "VIEW_HOSTEL" },
    ],
  },
  {
    label: "Residents",
    icon: Users,
    permission: "VIEW_RESIDENTS",
    children: [
      { label: "All Residents", href: "/residents", permission: "VIEW_RESIDENTS" },
      { label: "Add Resident", href: "/residents/add", permission: "ADD_RESIDENT" },
      { label: "Import Residents", href: "/residents/import", permission: "IMPORT_RESIDENTS" },
    ],
  },
  {
    label: "Finance",
    icon: Wallet,
    permission: "MANAGE_PAYMENTS",
    children: [
      { label: "Payments", href: "/payments", permission: "MANAGE_PAYMENTS" },
      { label: "Expenses", href: "/expenses", permission: "MANAGE_EXPENSES" },
      { label: "Invoices", href: "/invoices", permission: "MANAGE_INVOICES" },
    ],
  },
  { label: "Staff", href: "/staff", icon: Users, permission: "MANAGE_STAFF" },
  { label: "Reports", href: "/reports", icon: FileText, permission: "VIEW_REPORTS" },
  { label: "Analytics", href: "/analytics", icon: BarChart3, permission: "VIEW_ANALYTICS" },
  { label: "Subscription", href: "/subscription", icon: Crown, permission: "MANAGE_SUBSCRIPTION" },
  { label: "Settings", href: "/settings", icon: Settings, permission: "MANAGE_SETTINGS" },
];

export const RESIDENT_NAVIGATION: NavItem[] = [
  { label: "Dashboard", href: "/resident", icon: LayoutDashboard },
  { label: "My Room", href: "/resident/room", icon: BedDouble },
  { label: "My Payments", href: "/resident/payments", icon: CreditCard },
  { label: "Payment History", href: "/resident/history", icon: Receipt },
  { label: "Facilities", href: "/resident/facilities", icon: Building2 },
  { label: "Announcements", href: "/resident/announcements", icon: FileText },
  { label: "Profile", href: "/resident/profile", icon: Settings },
];

export const SUPER_ADMIN_NAVIGATION: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Hostels", href: "/admin/hostels", icon: Building2 },
  { label: "Owners", href: "/admin/owners", icon: Users },
  { label: "Residents", href: "/admin/residents", icon: BedDouble },
  { label: "Subscriptions", href: "/admin/subscriptions", icon: Crown },
  { label: "Payments", href: "/admin/payments", icon: CreditCard },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

export function navigationForRole(role: UserRole): NavItem[] {
  if (role === "RESIDENT") return RESIDENT_NAVIGATION;
  if (role === "SUPER_ADMIN") return SUPER_ADMIN_NAVIGATION;
  return OWNER_NAVIGATION;
}

/** Landing page per role — logo, breadcrumbs and role-switching must use this. */
export function homeRouteForRole(role: UserRole): string {
  if (role === "RESIDENT") return "/resident";
  if (role === "SUPER_ADMIN") return "/admin";
  return "/dashboard";
}

/** True for exact matches and nested routes ("/rooms" matches "/rooms/204"). */
export function isActivePath(pathname: string, href: string): boolean {
  if (!href || href === "/") return pathname === "/";
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}

/** Labels of collapsible groups that contain the active route (for auto-expanding). */
export function groupsForPath(nav: NavItem[], pathname: string): string[] {
  return nav
    .filter((item) => item.children?.some((c) => isActivePath(pathname, c.href)))
    .map((item) => item.label);
}
