"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Permission } from "@/types/auth";
import { PERMISSION_UPSELL } from "@/constants/permissions";

interface UpgradeModalState {
  open: boolean;
  permission: Permission | null;
}

interface UpgradeContextValue extends UpgradeModalState {
  openUpgrade: (permission: Permission) => void;
  closeUpgrade: () => void;
}

const UpgradeContext = createContext<UpgradeContextValue | null>(null);

export function UpgradeProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<UpgradeModalState>({ open: false, permission: null });

  const openUpgrade = useCallback((permission: Permission) => {
    setState({ open: true, permission });
  }, []);
  const closeUpgrade = useCallback(() => setState({ open: false, permission: null }), []);

  const value = useMemo(
    () => ({ ...state, openUpgrade, closeUpgrade }),
    [state, openUpgrade, closeUpgrade]
  );
  return <UpgradeContext.Provider value={value}>{children}</UpgradeContext.Provider>;
}

export function useUpgrade(): UpgradeContextValue {
  const ctx = useContext(UpgradeContext);
  if (!ctx) throw new Error("useUpgrade must be used within UpgradeProvider");
  return ctx;
}

export function upsellFor(permission: Permission | null) {
  if (!permission) return { title: "Upgrade your plan", bullets: [] as string[] };
  return PERMISSION_UPSELL[permission] ?? { title: "Upgrade your plan", bullets: [] as string[] };
}
