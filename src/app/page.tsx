import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { homeRouteForRole, normalizeRole, roleFromToken } from "@/lib/jwt";

export default async function Home() {
  const cookieStore = await cookies();
  const roleCookie = cookieStore.get("hg_role")?.value;
  const tokenCookie =
    cookieStore.get("access_token")?.value ??
    cookieStore.get("accessToken")?.value ??
    cookieStore.get("hg_token")?.value ??
    cookieStore.get("token")?.value;

  const role = normalizeRole(roleCookie) ?? roleFromToken(tokenCookie);
  if (!role) {
    redirect("/login");
  }
  redirect(homeRouteForRole(role));
}
