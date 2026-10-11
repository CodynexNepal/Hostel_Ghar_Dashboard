import Image from "next/image";
import Link from "next/link";
import { BedDouble, ShieldCheck, Wallet } from "lucide-react";

const PERKS = [
  {
    icon: BedDouble,
    title: "Live bed availability",
    text: "Rooms, beds and residents in one view.",
  },
  {
    icon: Wallet,
    title: "Payments without chasing",
    text: "Dues, receipts and history with confidence.",
  },
  {
    icon: ShieldCheck,
    title: "Access by role",
    text: "Owners, managers and front-desk stay in sync.",
  },
];

export function AuthShell({
  children,
  eyebrow,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <main className="min-h-dvh bg-surface-muted lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <section className="flex min-h-dvh flex-col bg-white">
        <header className="flex items-center justify-between px-5 pt-5 sm:px-8 lg:px-12">
          <Link
            href="/login"
            className="inline-flex items-center gap-2.5"
            aria-label="Hostel Ghar home"
          >
            <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-surface-border bg-white">
              <Image
                src="/images/logo/hostel_ghar_logo.jpg"
                alt="Hostel Ghar logo"
                width={40}
                height={40}
                className="h-full w-full object-contain"
                priority
              />
            </span>
            <span className="leading-tight">
              <span className="block text-[15px] font-bold tracking-tight text-neutral-950">
                Hostel Ghar
              </span>
              <span className="block text-xs font-medium text-neutral-500">
                Made for better stays
              </span>
            </span>
          </Link>
          <span className="hidden rounded-full border border-surface-border px-3 py-1 text-xs font-medium text-neutral-500 sm:inline-flex">
            Nepal · 24/7
          </span>
        </header>
        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-[400px]">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-lime-700">
              {eyebrow}
            </p>
            <h1 className="mt-2 text-balance text-[28px] font-bold leading-[1.15] tracking-tight text-neutral-950 sm:text-[32px]">
              {title}
            </h1>
            <p className="mt-2.5 text-pretty text-[15px] leading-6 text-neutral-600">{subtitle}</p>
            <div className="mt-7">{children}</div>
            <p className="mt-8 border-t border-surface-border pt-5 text-xs leading-5 text-neutral-400">
              Protected by role-based access. Your hostel data stays private to your team.
            </p>
          </div>
        </div>
        <footer className="px-5 pb-5 sm:px-8 lg:px-12">
          <p className="text-xs text-neutral-400">
            Hostel Ghar &copy; {new Date().getFullYear()} · Made for better stays
          </p>
        </footer>
      </section>
      <aside className="relative hidden overflow-hidden bg-neutral-950 lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-14">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            background:
              "radial-gradient(640px circle at 20% 12%, rgba(195,255,125,0.18), transparent 62%), radial-gradient(720px circle at 90% 88%, rgba(195,255,125,0.12), transparent 60%)",
          }}
        />
        <div className="relative flex items-center justify-between text-sm">
          <span className="inline-flex items-center gap-2.5 text-white">
            <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-white">
              <Image
                src="/images/logo/hostel_ghar_logo.jpg"
                alt=""
                width={44}
                height={44}
                className="h-full w-full object-contain"
              />
            </span>
            <span className="font-semibold">Hostel Ghar</span>
          </span>
          <span className="text-white/60">Everyday operations, in one place</span>
        </div>
        <div className="relative max-w-[520px]">
          <h2 className="text-balance text-4xl font-bold leading-[1.08] tracking-tight text-white xl:text-[44px]">
            The calm behind a well-run hostel.
          </h2>
          <p className="mt-4 max-w-md text-pretty text-[15px] leading-7 text-white/70">
            One clear view of rooms, residents and payments — built for owners, managers and
            front-desk teams.
          </p>
          <ul className="mt-8 space-y-3">
            {PERKS.map((perk) => (
              <li
                key={perk.title}
                className="flex items-start gap-3.5 rounded-2xl border border-white/10 bg-white/[0.04] p-4"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-ink">
                  <perk.icon className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-white">{perk.title}</span>
                  <span className="mt-0.5 block text-[13px] leading-5 text-white/60">
                    {perk.text}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative grid grid-cols-3 gap-4 border-t border-white/10 pt-6">
          {[
            ["24/7", "operations view"],
            ["Live", "bed availability"],
            ["One", "shared source of truth"],
          ].map(([big, small]) => (
            <div key={small}>
              <p className="text-xl font-bold text-white">{big}</p>
              <p className="mt-1 text-xs text-white/55">{small}</p>
            </div>
          ))}
        </div>
      </aside>
    </main>
  );
}
