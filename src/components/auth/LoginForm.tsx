"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { loginSchema, type LoginFormValues } from "@/schemas/auth.schema";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";

export function LoginForm() {
  const { success, error: toastError } = useToast();
  const { login, isAuthenticating, authError } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({ resolver: yupResolver(loginSchema) });

  async function onSubmit(data: LoginFormValues) {
    const result = await login(data.email, data.password);
    if (result.ok) {
      success("Welcome back", data.email);
    } else {
      toastError("Sign in failed", authError?.message ?? "Check your credentials and try again.");
    }
  }

  return (
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

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="login-password" className="text-[13px] font-medium text-neutral-800">
            Password
          </label>
          <Link
            href="/forgot-password"
            className="text-xs font-medium text-neutral-600 hover:text-neutral-950 hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <input
            id="login-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Enter your password"
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
        Sign in <ArrowRight className="h-4 w-4" aria-hidden />
      </Button>
    </form>
  );
}
