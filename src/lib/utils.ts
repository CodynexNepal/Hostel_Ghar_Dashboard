import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatCurrency(npr: number): string {
  return `Rs. ${npr.toLocaleString("en-NP")}`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function titleFromSegment(segment: string): string {
  const map: Record<string, string> = {
    dashboard: "Dashboard",
    hostel: "Hostel",
    hostels: "Hostels",
    residents: "Residents",
    resident: "Resident",
    add: "Add Resident",
    import: "Import Residents",
    rooms: "Rooms",
    room: "My Room",
    payments: "Payments",
    expenses: "Expenses",
    invoices: "Invoices",
    staff: "Staff",
    reports: "Reports",
    analytics: "Analytics",
    subscription: "Subscription",
    subscriptions: "Subscriptions",
    settings: "Settings",
    facilities: "Facilities",
    history: "Payment History",
    announcements: "Announcements",
    profile: "Profile",
    admin: "Admin",
    owners: "Owners",
    login: "Sign In",
    register: "Create Account",
  };
  if (map[segment]) return map[segment];
  // Dynamic ids (uuids, numeric ids, prefixed ids like r-1 / rm-101) read as "Details".
  if (/^\d+$/.test(segment) || /^[0-9a-f-]{8,}$/i.test(segment) || /^[a-z]+-\d+$/i.test(segment)) {
    return "Details";
  }
  return segment
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}
