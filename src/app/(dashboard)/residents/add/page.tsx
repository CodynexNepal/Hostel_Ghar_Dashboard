"use client";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Protected } from "@/components/common/Protected";
import { BackLink } from "@/components/ui/BackLink";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

import { residentSchema, type ResidentFormValues } from "@/schemas/resident.schema";
import { useToast } from "@/hooks/useToast";

export default function AddResidentPage() {
  const router = useRouter();
  const { success } = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResidentFormValues>({
    resolver: yupResolver(residentSchema),
    defaultValues: { monthlyRent: 12000 },
  });
  function onSubmit(data: ResidentFormValues) {
    success("Resident added", `${data.name} · Room ${data.roomNumber}`);
    router.push("/residents");
  }
  return (
    <DashboardShell title="Add Resident" subtitle="Hostel Ghar / Residents / Add Resident">
      <Protected permission="ADD_RESIDENT" redirectTo="/residents">
        <BackLink href="/residents" label="All residents" />
        <Card className="mt-3 p-5 sm:p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2" noValidate>
            <Input
              label="Full name"
              placeholder="Ramesh Adhikari"
              error={errors.name?.message}
              {...register("name")}
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
              label="Email"
              type="email"
              placeholder="resident@mail.com"
              error={errors.email?.message}
              {...register("email")}
              required
            />
            <Input
              label="Monthly rent (Rs.)"
              type="number"
              error={errors.monthlyRent?.message}
              {...register("monthlyRent")}
              required
            />
            <Input
              label="Room number"
              placeholder="204"
              error={errors.roomNumber?.message}
              {...register("roomNumber")}
              required
            />
            <Input
              label="Bed number"
              placeholder="B1"
              error={errors.bedNumber?.message}
              {...register("bedNumber")}
              required
            />
            <div className="flex flex-col gap-2 pt-2 sm:col-span-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" loading={isSubmitting}>
                Add Resident
              </Button>
            </div>
          </form>
        </Card>
      </Protected>
    </DashboardShell>
  );
}
