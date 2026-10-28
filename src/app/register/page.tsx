"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { registerSchema, type RegisterFormValues } from "@/schemas/auth.schema";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";

export default function RegisterPage() {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const { register: registerUser, isAuthenticating, authError } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({ resolver: yupResolver(registerSchema) });

  async function onSubmit(data: RegisterFormValues) {
    const ok = await registerUser(data);
    if (ok) {
      success("Account created", "Welcome to Hostel Ghar.");
    } else {
      toastError("Registration failed", authError?.message ?? "Please try again.");
    }
  }

  return (
    <AuthShell title="Create an account" subtitle="Enter your details to get started">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input
          label="Full name"
          placeholder="e.g. Aashish Sharma"
          error={errors.name?.message}
          className="h-11"
          {...register("name")}
        />
        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="you@hostel.com"
          error={errors.email?.message}
          className="h-11"
          {...register("email")}
        />
        <Input
          label="Phone number"
          type="tel"
          placeholder="9841000001"
          error={errors.phone?.message}
          className="h-11"
          {...register("phone")}
        />
        <Input
          label="Hostel name"
          placeholder="e.g. Sunrise Boys Hostel"
          error={errors.hostelName?.message}
          className="h-11"
          {...register("hostelName")}
        />
        <div>
          <label
            htmlFor="register-password"
            className="mb-1.5 block text-[13px] font-medium text-neutral-800"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="register-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Create a password"
              className={`h-11 w-full rounded-md border bg-white px-3 pr-11 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-ink focus:outline-none focus:ring-2 focus:ring-brand ${
                errors.password ? "border-red-500" : "border-surface-border"
              }`}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center text-neutral-400 hover:text-neutral-700 focus-visible:outline-none"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && (
            <p role="alert" className="mt-1 text-xs text-red-600">
              {errors.password.message}
            </p>
          )}
        </div>

        {authError && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-[13px] text-red-700">
            {authError.message}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full font-semibold" loading={isAuthenticating}>
          Create account <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
      </form>

      <div className="mt-6 text-center text-sm text-neutral-600">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-neutral-950 hover:underline">
          Sign in
        </Link>
      </div>
    </AuthShell>
  );
}
