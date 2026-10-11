"use client";

import { LogoutModal } from "@/components/auth/LogoutModal";
import { useAuth } from "@/hooks/useAuth";

/** Global logout confirmation — every logout button opens this via requestLogout(). */
export function LogoutDialog() {
  const { user, logoutModalOpen, closeLogoutModal, confirmLogout, isLoggingOut, logoutError } =
    useAuth();
  return (
    <LogoutModal
      open={logoutModalOpen}
      userName={user?.name}
      isLoggingOut={isLoggingOut}
      error={logoutError}
      onCancel={closeLogoutModal}
      onConfirm={() => confirmLogout(false)}
      onConfirmAll={() => confirmLogout(true)}
    />
  );
}
