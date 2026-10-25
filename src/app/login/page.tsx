"use client";

import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <AuthShell
      title="Sign in to your account"
      subtitle="Enter your credentials to continue"
    >
      <LoginForm />
      <div className="mt-6 text-center text-sm text-neutral-600">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="font-semibold text-neutral-950 hover:underline"
        >
          Sign up
        </Link>
      </div>
    </AuthShell>
  );
}
