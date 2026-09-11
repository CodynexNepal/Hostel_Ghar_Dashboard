"use client";
import { BedDouble, CalendarClock, Megaphone, Receipt, Wallet } from "lucide-react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { RoleSwitcher } from "@/components/common/RoleSwitcher";
import { MOCK_ANNOUNCEMENTS, MOCK_PAYMENTS } from "@/lib/mock-data";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function ResidentDashboardPage() {
  return (
    <DashboardShell title="My Dashboard" subtitle="Sunrise Boys Hostel · Room 201 · Bed B1">
      <div className="space-y-5">
        <RoleSwitcher />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["My Room", "Room 201 · Bed B1", "Floor 2 · Double"],
            ["Monthly Rent", formatCurrency(12000), "Due by 10th"],
            ["Next Payment", "10 Oct 2026", "Rs. 12,000"],
            ["Payment Status", "PAID", "September clear"],
          ].map(([t, v, h], i) => (
            <Card key={t} className="p-5">
              <p className="text-[13px] font-medium text-neutral-500">{t}</p>
              <p className="mt-1.5 text-xl font-bold text-neutral-900">{v}</p>
              <p className="mt-0.5 text-xs text-neutral-400">{h}</p>
              {i === 3 && (
                <Badge tone="green" className="mt-2">
                  PAID
                </Badge>
              )}
            </Card>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader
              title="Announcements"
              subtitle="From your hostel warden"
              action={<Megaphone className="h-4 w-4 text-neutral-400" />}
            />
            <ul className="divide-y divide-neutral-100">
              {MOCK_ANNOUNCEMENTS.map((a) => (
                <li key={a.id} className="px-5 py-3.5">
                  <p className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                    {a.title}
                    <Badge tone="gray">{a.tag}</Badge>
                  </p>
                  <p className="mt-0.5 text-[13px] text-neutral-500">{a.body}</p>
                  <p className="mt-1 text-xs text-neutral-400">{formatDate(a.date)}</p>
                </li>
              ))}
            </ul>
          </Card>
          <div className="space-y-4 lg:col-span-2">
            <Card className="p-5">
              <p className="flex items-center gap-2 text-[15px] font-semibold">
                <BedDouble className="h-4 w-4" /> My Room
              </p>
              <p className="mt-2 text-sm text-neutral-600">Room 201 · Bed B1 · Floor 2</p>
              <p className="mt-1 text-[13px] text-neutral-500">
                Double sharing · Attached bath · WiFi 5G
              </p>
              <div className="mt-3 flex gap-2">
                <Link href="/resident/room">
                  <Button size="sm" variant="outline">
                    Room details
                  </Button>
                </Link>
                <Link href="/resident/payments">
                  <Button size="sm">
                    <Wallet className="h-3.5 w-3.5" /> Pay rent
                  </Button>
                </Link>
              </div>
            </Card>
            <Card>
              <CardHeader
                title="Recent payments"
                subtitle="Your rent history"
                action={
                  <Link
                    href="/resident/history"
                    className="text-[13px] font-semibold hover:underline"
                  >
                    History
                  </Link>
                }
              />
              <ul className="divide-y divide-neutral-100">
                {MOCK_PAYMENTS.slice(0, 3).map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                    <Receipt className="h-4 w-4 shrink-0 text-neutral-400" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.month}</span>
                      <span className="block text-xs text-neutral-500">{formatDate(p.date)}</span>
                    </span>
                    <span className="text-right">
                      <span className="block text-sm font-bold">{formatCurrency(p.amount)}</span>
                      <Badge tone={statusTone(p.status)} className="mt-0.5">
                        {p.status}
                      </Badge>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="flex items-center gap-3 border-dashed p-5 text-sm text-neutral-600">
              <CalendarClock className="h-5 w-5 shrink-0" /> Next rent due{" "}
              <strong>10 Oct 2026</strong> — pay early to avoid late fees.
            </Card>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
