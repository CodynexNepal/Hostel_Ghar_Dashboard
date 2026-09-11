"use client";
import { MapPin, Phone, Mail, Wifi, Droplets, Zap, ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Protected } from "@/components/common/Protected";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/hooks/useToast";

const FACILITIES = [
  { icon: Wifi, label: "High-speed WiFi", desc: "Fibre on every floor" },
  { icon: Droplets, label: "Hot water", desc: "Solar + backup" },
  { icon: Zap, label: "Power backup", desc: "Inverter + generator" },
  { icon: ShieldCheck, label: "CCTV & warden", desc: "24/7 security" },
];

export default function HostelOverviewPage() {
  const { success } = useToast();
  return (
    <DashboardShell
      title="Hostel Overview"
      subtitle="Hostel Ghar / Hostel — profile, contact and facilities."
    >
      <Protected permission="VIEW_HOSTEL">
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-5 sm:p-6 lg:col-span-2">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="flex items-center gap-2">
                  <span className="text-xl font-bold text-neutral-900">Sunrise Boys Hostel</span>
                  <Badge tone="green">ACTIVE</Badge>
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-neutral-500">
                  <MapPin className="h-4 w-4" /> Putalisadak, Kathmandu
                </p>
                <p className="mt-2 flex flex-wrap gap-3 text-[13px] text-neutral-600">
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" /> 01-4445555
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" /> info@sunrise.com
                  </span>
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => success("Profile saved", "Hostel details updated.")}
              >
                Edit profile
              </Button>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              {[
                ["24", "Rooms"],
                ["72", "Beds"],
                ["58", "Occupied"],
              ].map(([v, l]) => (
                <div key={l} className="rounded-lg bg-surface-muted p-3">
                  <p className="text-xl font-bold">{v}</p>
                  <p className="text-xs text-neutral-500">{l}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <CardHeader title="Facilities" subtitle="What residents get" />
            <ul className="space-y-3 p-5">
              {FACILITIES.map((f) => (
                <li key={f.label} className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand">
                    <f.icon className="h-4 w-4 text-brand-ink" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{f.label}</span>
                    <span className="block text-xs text-neutral-500">{f.desc}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </Protected>
    </DashboardShell>
  );
}
