import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatCurrency(npr?: number | null): string {
  const value = typeof npr === "number" && Number.isFinite(npr) ? npr : 0;
  return `Rs. ${value.toLocaleString("en-NP")}`;
}

export function formatDate(iso?: string | null): string {
  if (!iso || typeof iso !== "string") return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function initials(name?: string | null): string {
  if (!name || typeof name !== "string") return "HG";
  const trimmed = name.trim();
  if (!trimmed) return "HG";
  return (
    trimmed
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "HG"
  );
}

export function titleFromSegment(segment?: string | null): string {
  if (!segment || typeof segment !== "string") return "Details";
  const value = segment.trim();
  if (!value) return "Details";
  const map: Record<string, string> = {
    dashboard: "Dashboard",
    hostel: "Hostel",
    hostels: "Hostels",
    residents: "Residents",
    resident: "Resident",
    add: "Add Resident",
    import: "Import Residents",
    rooms: "Rooms",
    beds: "Beds",
    room: "My Room",
    payments: "Payments",
    fees: "Fees",
    expenses: "Expenses",
    invoices: "Invoices",
    staff: "Staff",
    reports: "Reports",
    analytics: "Analytics",
    subscription: "Subscription",
    subscriptions: "Subscriptions",
    settings: "Settings",
    facilities: "Facilities",
    leaves: "Leaves",
    types: "Leave Types",
    history: "Payment History",
    announcements: "Announcements",
    profile: "Profile",
    admin: "Admin",
    owners: "Owners",
    login: "Sign In",
    register: "Create Account",
  };
  if (map[value]) return map[value];
  // Dynamic ids (uuids, numeric ids, prefixed ids like r-1 / rm-101) read as "Details".
  if (/^\d+$/.test(value) || /^[0-9a-f-]{8,}$/i.test(value) || /^[a-z]+-\d+$/i.test(value)) {
    return "Details";
  }
  return value
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}
