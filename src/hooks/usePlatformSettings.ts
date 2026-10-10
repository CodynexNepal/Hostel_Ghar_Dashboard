"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { hostelGhar, unwrap } from "@/lib/hostelGhar";
import { toApiError } from "@/lib/axios";
import type { AccessSettings, AlertSettings, BillingSettings, GeneralSettings, PlatformSettings, SystemSettings } from "@/lib/api-types";
import type { PlatformQr, PlatformQrMethod } from "@/lib/api-types";
import { isMissingSettingsRoute, readSettingsFallback as readFb, writeSettingsFallback as writeFb } from "@/lib/settings-fallback";
import { setBackendPlatformQrs } from "@/lib/platform-qr";

export const PLATFORM_KEY = "hg_admin_platform_settings";
export const PLATFORM_DEFAULTS: PlatformSettings = {
  platformName: "Hostel Ghar", tagline: "Nepal's Leading Smart Hostel Management System",
  supportEmail: "support@hostelghar.com", supportPhone: "+977-1-4445555",
  officeAddress: "Putalisadak, Kathmandu, Bagmati, Nepal",
  currency: "NPR", timezone: "Asia/Kathmandu (UTC+5:45)",
  gracePeriodDays: 3, freeTierResidentCap: 5, standardPlanPrice: 1500,
  enterprisePlanPrice: 3500, autoRemindRenewals: true, allowQrCheckout: true,
  allowPublicHostelSignup: true, requireHostelApproval: true,
  allowResidentSelfInvite: true, sessionLifetimeDays: 14, requireAdmin2FA: false,
  notifyOnSubscriptionProof: true, overdueAlertThreshold: 25000,
  dailyDigestEmail: true, smsGatewayProvider: "SPARROW_SMS",
  maintenanceMode: false,
  maintenanceMessage: "Hostel Ghar is undergoing scheduled maintenance. Please check back in a few minutes.",
};

export function usePlatformSettings() {
  const [settings, setSettings] = useState(PLATFORM_DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [purging, setPurging] = useState(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let off = false;
    (async () => {
      // Per-tab URLs first (one URL per tab); legacy full doc as fallback.
      const gets = [
        hostelGhar.platformSettings.general.get().catch(() => null),
        hostelGhar.platformSettings.billing.get().catch(() => null),
        hostelGhar.platformSettings.access.get().catch(() => null),
        hostelGhar.platformSettings.alerts.get().catch(() => null),
        hostelGhar.platformSettings.system.get().catch(() => null),
      ];
      const keys: (keyof PlatformSettings)[][] = [
        ["platformName", "tagline", "supportEmail", "supportPhone", "officeAddress", "currency", "timezone"],
        ["gracePeriodDays", "freeTierResidentCap", "standardPlanPrice", "enterprisePlanPrice", "autoRemindRenewals", "allowQrCheckout"],
        ["allowPublicHostelSignup", "requireHostelApproval", "allowResidentSelfInvite", "sessionLifetimeDays", "requireAdmin2FA"],
        ["notifyOnSubscriptionProof", "overdueAlertThreshold", "dailyDigestEmail", "smsGatewayProvider"],
        ["maintenanceMode", "maintenanceMessage"],
      ];
      try {
        const raws = await Promise.all(gets);
        const merged: Record<string, unknown> = {};
        raws.forEach((raw, i) => {
          const d = raw ? unwrap<Record<string, unknown>>((raw as { data?: unknown }).data ?? raw) : null;
          if (d && typeof d === "object") for (const k of keys[i]) { const v = d[k as string]; if (v !== undefined) merged[k as string] = v; }
        });
        if (Object.keys(merged).length > 0) {
          if (!off && mounted.current) { setSettings({ ...PLATFORM_DEFAULTS, ...merged }); setLoaded(true); }
          return;
        }
        throw new Error("no per-tab data");
      } catch { /* legacy fallback below */ }
      try {
        const r = await hostelGhar.platformSettings.get();
        const d = unwrap<PlatformSettings>(r.data);
        if (d && typeof d === "object") { if (!off) { setSettings({ ...PLATFORM_DEFAULTS, ...d }); setLoaded(true); } return; }
        throw new Error("empty");
      } catch { if (off || !mounted.current) return;
        const c = readFb<PlatformSettings>(PLATFORM_KEY);
        setSettings({ ...PLATFORM_DEFAULTS, ...(c ?? {}) }); setLoaded(true); }
    })();
    return () => { off = true; };
  }, []);
  const save = useCallback(async (next?: Partial<PlatformSettings>, tabLabel?: string) => {
    setSaving(true);
    let cur = PLATFORM_DEFAULTS;
    setSettings((p) => { cur = next ? { ...p, ...next } : p; return cur; });
    writeFb(PLATFORM_KEY, cur);
    // 1) Tab's own URL first (only its slice) — falls back when 404.
    const pick = (ks: (keyof PlatformSettings)[]) => { const o: Record<string, unknown> = {}; for (const k of ks) o[k as string] = cur[k]; return o as unknown; };
    const tabPut = async (): Promise<boolean> => {
      if (tabLabel === "General & Identity") { try { await hostelGhar.platformSettings.general.update(pick(["platformName", "tagline", "supportEmail", "supportPhone", "officeAddress", "currency", "timezone"]) as unknown as GeneralSettings); return true; } catch (e) { if (!isMissingSettingsRoute(e)) throw e; return false; } }
      if (tabLabel === "Billing & Plans") { try { await hostelGhar.platformSettings.billing.update(pick(["gracePeriodDays", "freeTierResidentCap", "standardPlanPrice", "enterprisePlanPrice", "autoRemindRenewals", "allowQrCheckout"]) as unknown as BillingSettings); return true; } catch (e) { if (!isMissingSettingsRoute(e)) throw e; return false; } }
      if (tabLabel === "Access & Security") { try { await hostelGhar.platformSettings.access.update(pick(["allowPublicHostelSignup", "requireHostelApproval", "allowResidentSelfInvite", "sessionLifetimeDays", "requireAdmin2FA"]) as unknown as AccessSettings); return true; } catch (e) { if (!isMissingSettingsRoute(e)) throw e; return false; } }
      if (tabLabel === "Alerts & Notifications") { try { await hostelGhar.platformSettings.alerts.update(pick(["notifyOnSubscriptionProof", "overdueAlertThreshold", "dailyDigestEmail", "smsGatewayProvider"]) as unknown as AlertSettings); return true; } catch (e) { if (!isMissingSettingsRoute(e)) throw e; return false; } }
      if (tabLabel === "System & Cache") { try { await hostelGhar.platformSettings.system.update(pick(["maintenanceMode", "maintenanceMessage"]) as unknown as SystemSettings); return true; } catch (e) { if (!isMissingSettingsRoute(e)) throw e; return false; } }
      return false;
    };
    try {
      if (tabLabel && (await tabPut())) return { ok: true, localOnly: false, message: "Platform settings saved." };
      if (tabLabel) { /* tab route 404 → legacy full PUT below */ }
    } catch (e) {
      if (mounted.current) setSaving(false);
      return { ok: false, localOnly: false, message: toApiError(e).message };
    }
    // 2) Legacy full-document PUT (fallback while backend ships per-tab routes).
    try {
      const r = await hostelGhar.platformSettings.update(cur);
      const d = unwrap<PlatformSettings>(r.data);
      if (mounted.current && d && typeof d === "object") setSettings({ ...PLATFORM_DEFAULTS, ...d });
      return { ok: true, localOnly: false, message: "Platform settings saved." };
    } catch (e) {
      if (isMissingSettingsRoute(e)) return { ok: true, localOnly: true, message: "Platform settings saved (local preview until backend ships)." };
      return { ok: false, localOnly: false, message: toApiError(e).message };
    } finally { if (mounted.current) setSaving(false); }
  }, []);
  const purgeCache = useCallback(async () => {
    setPurging(true);
    // New per-tab URL first, legacy path as fallback.
    try {
      await hostelGhar.platformSettings.system.purgeCache();
      return { ok: true, localOnly: false, message: "All platform caches purged." };
    } catch (e) {
      if (!isMissingSettingsRoute(e)) return { ok: false, localOnly: false, message: toApiError(e).message };
    }
    try {
      await hostelGhar.platformSettings.purgeCache();
      return { ok: true, localOnly: false, message: "All platform caches purged." };
    } catch (e) {
      if (isMissingSettingsRoute(e)) return { ok: true, localOnly: true, message: "Cache purge queued (backend route not shipped yet)." };
      return { ok: false, localOnly: false, message: toApiError(e).message };
    } finally { if (mounted.current) setPurging(false); }
  }, []);
  const [qrs, setQrs] = useState<PlatformQr[]>([]);
  const [qrsLoaded, setQrsLoaded] = useState(false);
  const [qrSaving, setQrSaving] = useState<PlatformQrMethod | null>(null);
  const [backendQrs, setBackendQrs] = useState(false);
  // GET /admin/platform-qrs — backend-first, empty until backend ships
  // (PlatformQrUploadForm keeps showing localStorage/file fallback meanwhile).
  const refreshQrs = useCallback(async () => {
    try {
      const r = await hostelGhar.platformSettings.listQrs();
      const raw = unwrap<unknown>(r.data);
      const list = Array.isArray(raw) ? (raw as PlatformQr[]) : [];
      if (mounted.current) {
        setQrs(list.filter((q) => q && typeof q === "object"));
        setBackendQrs(true);
        setQrsLoaded(true);
        // Feed owner checkout: backend URLs win over static files.
        try { setBackendPlatformQrs(list as unknown as { method?: string; qrImageUrl?: string; label?: string }[]); } catch { /* noop */ }
      }
    } catch (e) {
      if (mounted.current) {
        setQrs([]);
        setBackendQrs(!isMissingSettingsRoute(e) ? false : false);
        setQrsLoaded(true);
      }
    }
  }, []);
  useEffect(() => { void refreshQrs(); }, [refreshQrs]);
  // POST or PUT /admin/platform-qrs — file upload wins, else data-URL passthrough.
  // The DB is the only source of truth: any failure (including a 404) is a hard
  // error — there is NO localStorage fallback, so the admin sees a real error
  // instead of a silent per-browser "save" owners on other devices never get.
  const upsertQr = useCallback(async (method: PlatformQrMethod, file?: File | null, label?: string, dataUrl?: string) => {
    setQrSaving(method);
    try {
      const existing = qrs.find((q) => String(q.method ?? "").toUpperCase() === method);
      const payload = { method, label: (label ?? "").trim(), ...(file ? { file } : dataUrl ? { qrImageUrl: dataUrl } : {}) };
      const r = existing
        ? await hostelGhar.platformSettings.updateQr(existing.id, payload)
        : await hostelGhar.platformSettings.createQr(payload);
      const saved = unwrap<PlatformQr>(r.data);
      await refreshQrs();
      void saved;
      return { ok: true, message: `${method} QR published.` };
    } catch (e) {
      return { ok: false, message: toApiError(e).message };
    } finally { if (mounted.current) setQrSaving(null); }
  }, [qrs, refreshQrs]);
  const removeQr = useCallback(async (method: PlatformQrMethod) => {
    const existing = qrs.find((q) => String(q.method ?? "").toUpperCase() === method);
    if (!existing) return { ok: false, message: `No ${method} QR is published yet — nothing to remove.` };
    try {
      await hostelGhar.platformSettings.removeQr(existing.id);
      await refreshQrs();
      return { ok: true, message: `${method} QR removed.` };
    } catch (e) {
      return { ok: false, message: toApiError(e).message };
    }
  }, [qrs, refreshQrs]);
  return { settings, setSettings, loaded, saving, save, purging, purgeCache, qrs, qrsLoaded, qrSaving, backendQrs, refreshQrs, upsertQr, removeQr };
}
