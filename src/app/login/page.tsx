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
    </AuthShell>
  );
}
