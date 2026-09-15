"use client";
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
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({ resolver: yupResolver(loginSchema) });

  async function onSubmit(data: LoginFormValues) {
    const result = await login(data.email, data.password);
    if (result.ok) {
      success("Welcome back", data.email);
      // AuthProvider already routes by role; this is a safe fallback.
    } else {
      toastError("Sign in failed", authError?.message ?? "Check your credentials and try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
      <div className="[&_input]:border-white/15 [&_input]:bg-white/5 [&_input]:text-white [&_label]:text-neutral-200">
        <Input
          label="Email"
          type="email"
          placeholder="you@hostel.com"
          error={errors.email?.message}
          {...register("email")}
          required
        />
      </div>
      <div className="[&_input]:border-white/15 [&_input]:bg-white/5 [&_input]:text-white [&_label]:text-neutral-200">
        <Input
          label="Password"
          type="password"
          placeholder="••••••••"
          error={errors.password?.message}
          {...register("password")}
          required
        />
      </div>
      {authError && (
        <p role="alert" className="rounded-md bg-red-500/10 px-3 py-2 text-[13px] text-red-200">
          {authError.message}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" loading={isAuthenticating}>
        Sign in
      </Button>
      <p className="text-center text-xs text-neutral-500">Secured with Bearer token auth.</p>
    </form>
  );
}
