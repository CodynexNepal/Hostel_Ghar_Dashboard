"use client";

import { DashboardShell } from "@/components/layout/DashboardShell";
import { AdminGenericSection } from "@/components/admin/AdminGenericSection";

export default function AdminResidentsPage() {
  return (
    <DashboardShell title="Admin" subtitle="Platform section.">
      <AdminGenericSection />
    </DashboardShell>
  );
}
