"use client";

import { Protected } from "@/components/common/Protected";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <Protected roles={["SUPER_ADMIN"]}>{children}</Protected>;
}
