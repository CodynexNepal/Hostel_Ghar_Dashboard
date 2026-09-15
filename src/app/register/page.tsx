"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { registerSchema, type RegisterFormValues } from "@/schemas/auth.schema";
import { useToast } from "@/hooks/useToast";
import { useAuth } from "@/hooks/useAuth";

export default function RegisterPage() {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const { register: registerUser, isAuthenticating, authError } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({ resolver: yupResolver(registerSchema) });
  async function onSubmit(data: RegisterFormValues) {
    const ok = await registerUser(data);
    if (ok) {
      success("Account created", "Welcome to Hostel Ghar.");
      // AuthProvider routes: token → role home; no token → /login?registered=1
    } else {
      toastError("Registration failed", authError?.message ?? "Try a different email.");
    }
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted px-4 py-10">
      <div className="w-full max-w-md rounded-card border border-surface-border bg-white p-6 sm:p-8">
        <Link
          href="/login"
          className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="mt-3 flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand text-sm font-extrabold text-brand-ink">
            HG
          </span>
          <span className="text-lg font-bold">Hostel Ghar</span>
        </div>
        <h1 className="mt-5 text-xl font-bold">Create your hostel account</h1>
        <p className="mt-1 text-sm text-neutral-500">Start free — upgrade when you grow.</p>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4" noValidate>
          <Input
            label="Full name"
            placeholder="Aashish Sharma"
            error={errors.name?.message}
            {...register("name")}
            required
          />
          <Input
            label="Email"
            type="email"
            placeholder="you@hostel.com"
            error={errors.email?.message}
            {...register("email")}
            required
          />
          <Input
            label="Phone"
            placeholder="9841000001"
            error={errors.phone?.message}
            {...register("phone")}
            required
          />
          <Input
            label="Hostel name"
            placeholder="Sunrise Boys Hostel"
            error={errors.hostelName?.message}
            {...register("hostelName")}
            required
          />
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            error={errors.password?.message}
            {...register("password")}
            required
          />
          {authError && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-[13px] text-red-700">
              {authError.message}
            </p>
          )}
          <Button type="submit" size="lg" className="w-full" loading={isAuthenticating}>
            Create account
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-neutral-500">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-neutral-900 underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
