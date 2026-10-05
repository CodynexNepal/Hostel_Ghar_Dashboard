import type { Plan } from "@/types/subscription";

/**
 * Mirrors `src/constant/subscription.constant.ts` on the backend (NPR).
 * null residentLimit = unlimited. Feature order + inclusion match the
 * backend plan definitions so the UI never contradicts GET /plans.
 */
export const PLANS: Plan[] = [
  {
    id: "FREE",
    name: "Free",
    priceMonthly: 0,
    priceYearly: 0,
    description: "Get started with hostel basics.",
    residentLimit: 10,
    cta: "Current Plan",
    features: [
      { label: "Basic dashboard", included: true },
      { label: "Basic hostel profile", included: true },
      { label: "Up to 10 residents", included: true },
      { label: "Room management", included: true },
      { label: "Staff management", included: true },
      { label: "Reports and analytics", included: true },
    ],
  },
  {
    id: "BASIC",
    name: "Basic",
    priceMonthly: 999,
    priceYearly: 9990,
    description: "For small hostels getting organized.",
    residentLimit: 60,
    cta: "Upgrade to Basic",
    features: [
      { label: "Up to 60 residents", included: true },
      { label: "Room management", included: true },
      { label: "Basic payments", included: true },
      { label: "Expenses tracking", included: true },
      { label: "Reports and analytics", included: true },
    ],
  },
  {
    id: "PRO",
    name: "Pro",
    priceMonthly: 1999,
    priceYearly: 19990,
    description: "For growing hostels that need automation.",
    residentLimit: null,
    cta: "Upgrade to Pro",
    highlighted: true,
    features: [
      { label: "Unlimited residents", included: true },
      { label: "Staff management", included: true },
      { label: "Advanced analytics", included: true },
      { label: "Reports and exports", included: true },
      { label: "Invoices and reminders", included: true },
    ],
  },
  {
    id: "ENTERPRISE",
    name: "Enterprise",
    priceMonthly: 4999,
    priceYearly: 49990,
    description: "For groups and multi-hostel operators.",
    residentLimit: null,
    cta: "Contact Sales",
    features: [
      { label: "Multiple hostels", included: true },
      { label: "Advanced administration", included: true },
      { label: "Advanced reporting", included: true },
      { label: "Priority support", included: true },
      { label: "Custom integrations", included: true },
    ],
  },
];
