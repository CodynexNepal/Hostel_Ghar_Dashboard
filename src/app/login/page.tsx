"use client";

import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <AuthShell title="Sign in">
      <LoginForm />
      <div className="mt-6 text-center text-sm text-neutral-500">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-medium text-neutral-900 hover:underline">
          Sign up
        </Link>
      </div>

      <div className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50/80 p-3.5 text-center">
        <p className="text-xs text-neutral-600">Looking to book a student hostel in Nepal?</p>
        <Link
          href="/book"
          className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-brand-ink hover:underline"
        >
          Browse & Book Hostels Online &rarr;
        </Link>
      </div>
    </AuthShell>
  );
}
