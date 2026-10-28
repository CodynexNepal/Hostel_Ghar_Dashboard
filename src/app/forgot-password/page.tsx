"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { forgotPasswordSchema, type ForgotPasswordFormValues } from "@/schemas/auth.schema";
import { hostelGhar } from "@/lib/hostelGhar";
import { toApiError } from "@/lib/axios";
import { useToast } from "@/hooks/useToast";

export default function ForgotPasswordPage() {
  const { success, error: toastError } = useToast();
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({ resolver: yupResolver(forgotPasswordSchema) });

  async function onSubmit(data: ForgotPasswordFormValues) {
    setSending(true);
    try {
      const res = await hostelGhar.auth.forgotPassword({ email: data.email });
      setSentTo(data.email);
      success("Reset link sent", res.data?.message ?? `Check ${data.email} for the reset link.`);
    } catch (err) {
      toastError("Could not send reset link", toApiError(err).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your email address and we'll send you a recovery link"
    >
      {sentTo ? (
        <div className="py-2 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-muted">
            <CheckCircle2 className="h-6 w-6 text-lime-700" aria-hidden />
          </span>
          <p className="mt-4 text-base font-bold text-neutral-950">Check your inbox</p>
          <p className="mx-auto mt-2 max-w-[300px] text-sm leading-6 text-neutral-600">
            We sent a reset link to <span className="font-semibold text-neutral-900">{sentTo}</span>
            .
          </p>
          <Button variant="outline" className="mt-5 w-full" onClick={() => setSentTo(null)}>
            Try a different email
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Input
            label="Email address"
            type="email"
            autoComplete="email"
            placeholder="you@hostel.com"
            error={errors.email?.message}
            className="h-11"
            {...register("email")}
          />
          <Button type="submit" size="lg" className="w-full font-semibold" loading={sending}>
            Send reset link <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        </form>
      )}

      <div className="mt-6 text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-950 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to sign in
        </Link>
      </div>
    </AuthShell>
  );
}
