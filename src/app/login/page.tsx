"use client";

import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <AuthShell
      eyebrow="Owner & team sign in"
      title="Run your hostel with room to breathe."
      subtitle="Sign in to manage rooms, residents and payments — all in one calm view."
    >
      <div className="rounded-2xl border border-surface-border bg-white p-5 shadow-card sm:p-6">
        <LoginForm />
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-neutral-500">Trouble signing in?</span>
          <Link
            href="/forgot-password"
            className="font-semibold text-neutral-950 underline underline-offset-4 hover:text-neutral-700"
          >
            Forgot password?
          </Link>
        </div>
      </div>
      <p className="mt-5 text-center text-sm text-neutral-500">
        Need help? Contact your hostel admin for access.
      </p>
    </AuthShell>
  );
}
