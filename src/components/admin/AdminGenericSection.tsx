import Link from "next/link";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { BackLink } from "@/components/ui/BackLink";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

const LINKS: [string, string, string][] = [
  ["Owners", "/admin/hostels", "148 owners · KYC verified"],
  ["Residents", "/admin/hostels", "4,280 residents platform-wide"],
  ["Subscriptions", "/subscription", "112 paid · 36 free"],
  ["Payments", "/payments", "Rs. 4.8L MRR"],
  ["Analytics", "/analytics", "Growth, churn, collection"],
  ["Settings", "/settings", "Platform configuration"],
];

export function AdminGenericSection() {
  return (
    <>
      <BackLink href="/admin" label="Platform overview" />
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {LINKS.map(([t, href, d]) => (
          <Link key={t} href={href}>
            <Card className="p-5 transition-colors hover:border-brand-ink">
              <p className="flex items-center justify-between text-[15px] font-semibold">
                {t}
                <Badge tone="gray">Admin</Badge>
              </p>
              <p className="mt-1 text-sm text-neutral-500">{d}</p>
            </Card>
          </Link>
        ))}
      </div>
      <Card className="mt-4">
        <CardHeader title="Note" subtitle="Dedicated admin tables" />
        <p className="p-5 pt-0 text-sm text-neutral-500">
          Each card above links to a working surface. Hostels has a full management table; the rest
          reuse owner surfaces with super-admin bypass.
        </p>
      </Card>
    </>
  );
}
