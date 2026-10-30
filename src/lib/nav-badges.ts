/**
 * Centralized mapping of Navigation items and URLs to Notification Categories.
 */

export function getCategoryForNavItem(label: string, href?: string): string | null {
  const norm = (label + " " + (href || "")).toLowerCase();
  if (norm.includes("booking")) return "bookings";
  if (
    norm.includes("resident") ||
    norm.includes("attendance") ||
    norm.includes("check-in") ||
    norm.includes("leave")
  ) {
    return "residents";
  }
  if (
    norm.includes("finance") ||
    norm.includes("fee") ||
    norm.includes("payment") ||
    norm.includes("expense") ||
    norm.includes("invoice")
  ) {
    return "payments";
  }
  if (norm.includes("hostel")) return "hostels";
  if (norm.includes("owner") || norm.includes("user")) return "users";
  if (norm.includes("meal")) return "meals";
  if (norm.includes("complaint")) return "complaints";
  if (norm.includes("announcement")) return "announcements";
  if (norm.includes("subscription")) return "subscriptions";
  return null;
}

export function getCategoryForPath(pathname: string): string | null {
  const p = (pathname || "").toLowerCase();
  if (p.includes("/bookings") || p.includes("/booking")) return "bookings";
  if (p.includes("/residents") || p.includes("/attendance") || p.includes("/leaves"))
    return "residents";
  if (
    p.includes("/payments") ||
    p.includes("/fees") ||
    p.includes("/expenses") ||
    p.includes("/invoices")
  ) {
    return "payments";
  }
  if (p.includes("/admin/hostels") || p.includes("/hostel/overview")) return "hostels";
  if (p.includes("/admin/owners") || p.includes("/admin/users")) return "users";
  if (p.includes("/meals")) return "meals";
  if (p.includes("/complaints")) return "complaints";
  if (p.includes("/announcements")) return "announcements";
  return null;
}
