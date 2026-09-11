"use client";
import Link from "next/link";
import { ArrowRight, BedDouble, Building2, Users, Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LoginForm } from "@/components/auth/LoginForm";

const FEATURES = [
  { icon: Users, title: "Resident management", text: "Profiles, room assignment, dues tracking." },
  { icon: BedDouble, title: "Rooms & occupancy", text: "Live bed availability and floor plans." },
  {
    icon: Wallet,
    title: "Payments & invoices",
    text: "eSewa, Khalti, cash, bank — all reconciled.",
  },
  {
    icon: Building2,
    title: "Multi-hostel scale",
    text: "Enterprise operators manage every branch.",
  },
];

export default function LoginPage() {
  return (
    <div className="flex min-h-screen bg-brand-ink text-white">
      <div className="flex w-full flex-col justify-center px-6 py-10 sm:px-12 lg:w-[46%] lg:px-16">
        <Link href="/dashboard" className="flex items-center gap-2.5" aria-label="Hostel Ghar">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand text-sm font-extrabold text-brand-ink">
            HG
          </span>
          <span className="text-lg font-bold">Hostel Ghar</span>
        </Link>
        <h1 className="mt-10 text-3xl font-bold leading-tight sm:text-4xl">
          Hostel management,
          <br />
          minus the paperwork.
        </h1>
        <p className="mt-3 max-w-md text-[15px] leading-relaxed text-neutral-400">
          One dashboard for owners, staff and residents — rooms, payments, staff and reports with
          plan-based access control.
        </p>
        <div className="mt-2 max-w-md rounded-card border border-white/10 bg-white/5 p-5">
          <p className="text-sm font-semibold text-white">Sign in to your hostel</p>
          <LoginForm />
        </div>
        <div className="mt-5 flex max-w-md flex-col gap-3 sm:flex-row">
          <Link href="/dashboard">
            <Button
              size="lg"
              variant="outline"
              className="border-white/20 bg-transparent text-white hover:bg-white/10"
            >
              Skip — open live dashboard <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/register">
            <span className="inline-flex h-11 items-center px-2 text-sm font-medium text-neutral-300 hover:text-white">
              Create account
            </span>
          </Link>
        </div>
        <div className="mt-6 flex max-w-md flex-wrap gap-2 text-xs text-neutral-400">
          <span className="rounded-full border border-white/15 px-3 py-1">
            FREE plan: 10 residents
          </span>
          <span className="rounded-full border border-white/15 px-3 py-1">
            PRO unlocks staff + reports
          </span>
          <span className="rounded-full border border-white/15 px-3 py-1">
            Validated with RHF + Yup
          </span>
        </div>
      </div>
      <div className="hidden flex-1 flex-col justify-center gap-4 bg-neutral-950 px-12 lg:flex">
        <div className="grid max-w-xl grid-cols-2 gap-4">
          {FEATURES.map((f) => (
            <Card key={f.title} className="border-white/10 bg-white/5 p-5 shadow-none">
              <f.icon className="h-5 w-5 text-brand" aria-hidden />
              <p className="mt-3 text-[15px] font-semibold text-white">{f.title}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-neutral-400">{f.text}</p>
            </Card>
          ))}
        </div>
        <Card className="max-w-xl border-brand/40 bg-brand p-5 shadow-none">
          <p className="text-sm font-bold text-brand-ink">Sunrise Boys Hostel · Kathmandu</p>
          <p className="mt-1 text-[13px] text-neutral-800">
            “Collection rate went from 71% to 96% in two months after switching to Hostel Ghar.”
          </p>
        </Card>
      </div>
    </div>
  );
}
