"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Check, ShieldCheck } from "lucide-react";
import { LoginForm } from "@/components/auth/LoginForm";

const HIGHLIGHTS = [
  "One clear view of rooms, residents, and payments",
  "Built for owners, managers, and front-desk teams",
  "Access that follows your role and hostel",
];

export default function LoginPage() {
  return (
    <main className="grid min-h-screen bg-surface-muted lg:grid-cols-[minmax(0,0.9fr)_minmax(480px,1.1fr)]">
      <section className="flex min-h-screen flex-col bg-white px-6 py-6 sm:px-10 sm:py-8 lg:px-14 xl:px-20">
        <Link href="/" className="inline-flex w-fit items-center gap-3" aria-label="Hostel Ghar home">
          <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-lg border border-surface-border bg-white">
            <Image
              src="/images/logo/hostel_ghar_logo.jpg"
              alt="Hostel Ghar"
              width={44}
              height={44}
              className="h-full w-full object-contain"
              priority
            />
          </span>
          <span className="text-base font-bold text-neutral-950">Hostel Ghar</span>
        </Link>

        <div className="flex flex-1 items-center py-10 sm:py-14">
          <div className="w-full max-w-md">
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <ShieldCheck className="h-4 w-4 text-lime-700" aria-hidden />
              Owner and team access
            </span>
            <h1 className="mt-5 text-3xl font-bold leading-tight text-neutral-950 sm:text-4xl">
              Run your hostel with a little more room to breathe.
            </h1>
            <p className="mt-3 max-w-sm text-[15px] leading-6 text-neutral-600">
              Sign in to manage your property, stay ahead of payments, and keep every resident
              detail in reach.
            </p>

            <div className="mt-8 rounded-lg border border-surface-border p-5 shadow-card sm:p-6">
              <div>
                <p className="text-lg font-bold text-neutral-950">Welcome back</p>
                <p className="mt-1 text-sm text-neutral-500">Use your registered email to continue.</p>
              </div>
              <LoginForm />
            </div>

            <p className="mt-5 text-sm text-neutral-600">
              New to Hostel Ghar?{" "}
              <Link href="/register" className="font-semibold text-neutral-950 underline underline-offset-4">
                Create an account
              </Link>
            </p>
          </div>
        </div>

        <p className="text-xs text-neutral-500">Hostel Ghar &copy; {new Date().getFullYear()}</p>
      </section>

      <aside className="relative hidden min-h-screen overflow-hidden lg:block">
        <Image
          src="/images/login-hostel-room.jpg"
          alt="A bright, well-kept hostel room"
          fill
          priority
          sizes="(min-width: 1024px) 60vw, 100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/55" aria-hidden />
        <div className="relative flex min-h-screen flex-col justify-between p-10 xl:p-14">
          <div className="flex items-center justify-between text-sm text-white">
            <span className="font-semibold">Made for better stays</span>
            <span className="inline-flex items-center gap-2 text-white/80">
              Nepal <ArrowUpRight className="h-4 w-4" aria-hidden />
            </span>
          </div>

          <div className="max-w-xl">
            <p className="text-sm font-semibold text-brand">Everyday operations, in one place</p>
            <h2 className="mt-4 text-4xl font-bold leading-tight text-white xl:text-5xl">
              The calm behind a well-run hostel.
            </h2>
            <ul className="mt-8 space-y-4 text-sm leading-6 text-white/85">
              {HIGHLIGHTS.map((highlight) => (
                <li key={highlight} className="flex items-start gap-3">
                  <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-brand-ink">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
                  </span>
                  {highlight}
                </li>
              ))}
            </ul>
            <div className="mt-10 grid grid-cols-3 gap-5 border-t border-white/25 pt-6 text-white">
              <div>
                <p className="text-2xl font-bold">24/7</p>
                <p className="mt-1 text-xs text-white/70">operations view</p>
              </div>
              <div>
                <p className="text-2xl font-bold">Live</p>
                <p className="mt-1 text-xs text-white/70">bed availability</p>
              </div>
              <div>
                <p className="text-2xl font-bold">One</p>
                <p className="mt-1 text-xs text-white/70">shared source of truth</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </main>
  );
}
