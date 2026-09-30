"use client";

import { useState } from "react";
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
    <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-5" noValidate>
      <Input
        label="Email address"
        type="email"
        autoComplete="email"
        placeholder="you@hostel.com"
        error={errors.email?.message}
        className="h-11"
        {...register("email")}
        required
      />
      <div className="relative">
        <Input
          label="Password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          placeholder="Enter your password"
          error={errors.password?.message}
          className="h-11 pr-11"
          {...register("password")}
          required
        />
        <button
          type="button"
          onClick={() => setShowPassword((visible) => !visible)}
          className="absolute right-3 top-[34px] flex h-6 w-6 items-center justify-center text-neutral-500 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {authError && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {authError.message}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" loading={isAuthenticating}>
        Sign in <ArrowRight className="h-4 w-4" aria-hidden />
      </Button>
    </form>
  );
}
