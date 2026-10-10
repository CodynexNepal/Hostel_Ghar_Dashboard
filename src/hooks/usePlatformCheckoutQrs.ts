"use client";
import { useEffect } from "react";
import { hostelGhar, unwrap } from "@/lib/hostelGhar";
import { setBackendPlatformQrs } from "@/lib/platform-qr";

/**
 * Fetches the platform's ACTIVE checkout QRs from the backend (`GET
 * /platform-qrs`, backed by the `platform_qrs` table) and feeds them into the
 * `platform-qr` cache so `PlatformQrPanel` → `getPlatformQr` serves the real
 * Cloudinary URLs owners scan on `/subscription`. Runs on every device — the
 * DB is the source of truth, so an admin upload is instantly visible to all
 * owners (no per-browser localStorage).
 *
 * Failures are swallowed: the checkout falls back to static `public/images/
 * platform/` files or env URLs when the route is unavailable.
 */
export function usePlatformCheckoutQrs() {
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await hostelGhar.platformSettings.listActiveQrs();
        if (!alive) return;
        const rows = unwrap<unknown>(res.data);
        if (Array.isArray(rows)) {
          setBackendPlatformQrs(
            rows as { method?: string; qrImageUrl?: string; qrCodeUrl?: string; imageUrl?: string; label?: string }[]
          );
        }
      } catch {
        /* backend route unavailable — keep file/env fallback */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
}
