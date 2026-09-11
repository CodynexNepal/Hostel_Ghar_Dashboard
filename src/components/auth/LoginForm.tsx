"use client";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { loginSchema, type LoginFormValues } from "@/schemas/auth.schema";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import type { UserRole } from "@/types/auth";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function LoginForm() {
  const router = useRouter();
  const { success } = useToast();
  const { switchRole } = useAuth();
  const [role, setRole] = useState<UserRole>("HOSTEL_OWNER");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: yupResolver(loginSchema) });

  function onSubmit(data: LoginFormValues) {
    window.localStorage.setItem("hg_token", "demo-token");
    switchRole(role);
    success("Welcome back", data.email);
    router.push(
      role === "RESIDENT" ? "/resident" : role === "SUPER_ADMIN" ? "/admin" : "/dashboard"
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
      <div role="radiogroup" aria-label="Sign in as" className="grid grid-cols-3 gap-2">
        {(
          [
            ["HOSTEL_OWNER", "Owner"],
            ["RESIDENT", "Resident"],
            ["SUPER_ADMIN", "Admin"],
          ] as [UserRole, string][]
        ).map(([r, label]) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={role === r}
            onClick={() => setRole(r)}
            className={cn(
              "rounded-md border px-2 py-2 text-[13px] font-semibold transition-colors",
              role === r
                ? "border-brand-ink bg-brand text-brand-ink"
                : "border-white/15 bg-transparent text-neutral-300 hover:bg-white/10"
            )}
          >
            {label}
          </button>
        ))}
      </div>
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
      <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
        Sign in
      </Button>
      <p className="text-center text-xs text-neutral-500">
        Demo only — any email + 6-char password works.
      </p>
    </form>
  );
}
