import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { homeRouteForRole, normalizeRole, roleFromToken } from "@/lib/jwt";
import type { UserRole } from "@/types/auth";

// Owner and staff management paths
const OWNER_PREFIXES = [
  "/dashboard",
  "/hostel",
  "/rooms",
  "/beds",
  "/residents",
  "/leaves",
  "/fees",
  "/expenses",
  "/invoices",
  "/staff",
  "/reports",
  "/analytics",
  "/subscription",
  "/settings",
];

const CANDIDATE_TOKEN_COOKIES = [
  "hg_token",
  "access_token",
  "accessToken",
  "token",
  "jwt",
  "hg_access_token",
];

function extractRole(request: NextRequest): UserRole | null {
  // 1. Direct explicit role cookie
  const roleCookie = request.cookies.get("hg_role")?.value;
  if (roleCookie) {
    const role = normalizeRole(roleCookie);
    if (role) return role;
  }

  // 2. Decode from JWT token cookies
  for (const name of CANDIDATE_TOKEN_COOKIES) {
    const tokenVal = request.cookies.get(name)?.value;
    if (tokenVal) {
      const role = roleFromToken(tokenVal);
      if (role) return role;
    }
  }

  return null;
}

function hasAnyAuthCookie(request: NextRequest): boolean {
  // Check for session cookie, role cookie, or any candidate JWT token cookie.
  // When backend is on port 8000 and Next.js is on port 3001, HttpOnly cookies
  // set on 8000 without host sharing rely on the frontend `hg_session`/`hg_role`
  // cookie, which is wiped cleanly on 401 or logout.
  if (Boolean(request.cookies.get("hg_session")?.value)) return true;
  if (Boolean(request.cookies.get("hg_role")?.value)) return true;
  return CANDIDATE_TOKEN_COOKIES.some((name) => Boolean(request.cookies.get(name)?.value));
}

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const role = extractRole(request);
  const hasAuth = hasAnyAuthCookie(request);

  // 1. Public auth pages (/login, /forgot-password)
  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/forgot-password");
  if (isAuthPage) {
    if (hasAuth && role) {
      return NextResponse.redirect(new URL(homeRouteForRole(role), request.url));
    }
    return NextResponse.next();
  }

  // 2. Root path (/)
  if (pathname === "/") {
    if (hasAuth && role) {
      return NextResponse.redirect(new URL(homeRouteForRole(role), request.url));
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 3. Super Admin routes (/admin, /admin/*)
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
  if (isAdminRoute) {
    if (!hasAuth) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirectTo", pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (role !== "SUPER_ADMIN") {
      const target = role ? homeRouteForRole(role) : "/login";
      return NextResponse.redirect(new URL(target, request.url));
    }
    return NextResponse.next();
  }

  // 4. Resident routes (/resident, /resident/*)
  const isResidentRoute = pathname === "/resident" || pathname.startsWith("/resident/");
  if (isResidentRoute) {
    if (!hasAuth) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirectTo", pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (role === "HOSTEL_OWNER") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  // 5. Owner / Management routes
  const isOwnerRoute = matchesPrefix(pathname, OWNER_PREFIXES);
  if (isOwnerRoute) {
    if (!hasAuth) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirectTo", pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (role === "RESIDENT") {
      return NextResponse.redirect(new URL("/resident", request.url));
    }
    if (role && role !== "HOSTEL_OWNER" && role !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL(homeRouteForRole(role), request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images, fonts, icons, public assets
     * - api routes (/api/*)
     */
    "/((?!_next/static|_next/image|favicon.ico|images/|fonts/|icons/|api/).*)",
  ],
};
