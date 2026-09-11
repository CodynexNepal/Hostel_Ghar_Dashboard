import type { SubscriptionPlan } from "./auth";

export interface PlanFeature {
  label: string;
  included: boolean;
}

export interface Plan {
  id: SubscriptionPlan;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  description: string;
  residentLimit: number | null;
  cta: string;
  highlighted?: boolean;
  features: PlanFeature[];
}

export interface Payment {
  id: string;
  residentName: string;
  residentId: string;
  amount: number;
  method: "CASH" | "ESEWA" | "KHALTI" | "BANK";
  status: "COMPLETED" | "PENDING" | "FAILED" | "OVERDUE";
  date: string;
  month: string;
}
