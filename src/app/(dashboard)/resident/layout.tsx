"use client";

import { Protected } from "@/components/common/Protected";

export default function ResidentLayout({ children }: { children: React.ReactNode }) {
  return <Protected roles={["RESIDENT", "SUPER_ADMIN"]}>{children}</Protected>;
}
