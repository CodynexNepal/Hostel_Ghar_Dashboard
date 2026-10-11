"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { hostelGhar, unwrap } from "@/lib/hostelGhar";
import { getHostelId, toApiError } from "@/lib/axios";
import type { HostelProfileSettings, NotificationPreferences } from "@/lib/api-types";
import {
  isMissingSettingsRoute,
  readSettingsFallback as readFb,
  writeSettingsFallback as writeFb,
} from "@/lib/settings-fallback";

export const PROFILE_KEY = "hg_owner_hostel_profile";
export const NOTIF_KEY = "hg_owner_notification_prefs";
export const PROFILE_DEFAULTS: HostelProfileSettings = {
  name: "Sunrise Boys Hostel",
  phone: "01-4445555",
  email: "info@sunrise.com",
  address: "Putalisadak, Kathmandu",
};
export const NOTIF_DEFAULTS: NotificationPreferences = {
  rentReminders: true,
  reminderDaysBefore: 3,
  smsEnabled: true,
  emailEnabled: true,
};

export function useOwnerSettings(hostelSuffix?: string | null) {
  const suffix = hostelSuffix ?? getHostelId() ?? "default";
  const [profile, setProfile] = useState(PROFILE_DEFAULTS);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [prefs, setPrefs] = useState(NOTIF_DEFAULTS);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const r = await hostelGhar.settings.getHostelProfile();
        const d = unwrap<HostelProfileSettings>(r.data);
        if (d && typeof d === "object") {
          if (!off) {
            setProfile({ ...PROFILE_DEFAULTS, ...d });
            setProfileLoaded(true);
          }
          return;
        }
        throw new Error("empty");
      } catch {
        if (off || !mounted.current) return;
        const c =
          readFb<HostelProfileSettings>(`${PROFILE_KEY}:${suffix}`) ??
          readFb<HostelProfileSettings>(PROFILE_KEY);
        setProfile({ ...PROFILE_DEFAULTS, ...(c ?? {}) });
        setProfileLoaded(true);
      }
    })();
    return () => {
      off = true;
    };
  }, [suffix]);

  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const r = await hostelGhar.settings.getNotifications();
        const d = unwrap<NotificationPreferences>(r.data);
        if (d && typeof d === "object") {
          if (!off) {
            setPrefs({ ...NOTIF_DEFAULTS, ...d });
            setPrefsLoaded(true);
          }
          return;
        }
        throw new Error("empty");
      } catch {
        if (off || !mounted.current) return;
        const c =
          readFb<NotificationPreferences>(`${NOTIF_KEY}:${suffix}`) ??
          readFb<NotificationPreferences>(NOTIF_KEY);
        setPrefs({ ...NOTIF_DEFAULTS, ...(c ?? {}) });
        setPrefsLoaded(true);
      }
    })();
    return () => {
      off = true;
    };
  }, [suffix]);

  const saveProfile = useCallback(async () => {
    setProfileSaving(true);
    let cur = PROFILE_DEFAULTS;
    setProfile((p: HostelProfileSettings) => {
      cur = p;
      return p;
    });
    const payload = {
      name: cur.name.trim(),
      phone: cur.phone.trim(),
      email: cur.email.trim(),
      address: cur.address.trim(),
    };
    try {
      const r = await hostelGhar.settings.updateHostelProfile(payload);
      const d = unwrap<HostelProfileSettings>(r.data);
      if (mounted.current && d && typeof d === "object") setProfile({ ...PROFILE_DEFAULTS, ...d });
      writeFb(`${PROFILE_KEY}:${suffix}`, payload);
      return { ok: true, localOnly: false, message: "Hostel profile updated." };
    } catch (e) {
      if (isMissingSettingsRoute(e)) {
        writeFb(`${PROFILE_KEY}:${suffix}`, payload);
        return {
          ok: true,
          localOnly: true,
          message: "Hostel profile updated (local preview until backend ships).",
        };
      }
      return { ok: false, localOnly: false, message: toApiError(e).message };
    } finally {
      if (mounted.current) setProfileSaving(false);
    }
  }, [suffix]);

  const savePrefs = useCallback(async () => {
    setPrefsSaving(true);
    let cur = NOTIF_DEFAULTS;
    setPrefs((p: NotificationPreferences) => {
      cur = p;
      return p;
    });
    try {
      const r = await hostelGhar.settings.updateNotifications(cur);
      const d = unwrap<NotificationPreferences>(r.data);
      if (mounted.current && d && typeof d === "object") setPrefs({ ...NOTIF_DEFAULTS, ...d });
      writeFb(`${NOTIF_KEY}:${suffix}`, cur);
      return { ok: true, localOnly: false, message: "Notification settings updated." };
    } catch (e) {
      if (isMissingSettingsRoute(e)) {
        writeFb(`${NOTIF_KEY}:${suffix}`, cur);
        return {
          ok: true,
          localOnly: true,
          message: "Preferences saved (local preview until backend ships).",
        };
      }
      return { ok: false, localOnly: false, message: toApiError(e).message };
    } finally {
      if (mounted.current) setPrefsSaving(false);
    }
  }, [suffix]);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    setChangingPw(true);
    try {
      await hostelGhar.settings.changePassword({ currentPassword, newPassword });
      return { ok: true, message: "Use your new password on next login." };
    } catch (e) {
      return { ok: false, message: toApiError(e).message };
    } finally {
      if (mounted.current) setChangingPw(false);
    }
  }, []);

  return {
    profile,
    setProfile,
    profileLoaded,
    profileSaving,
    saveProfile,
    prefs,
    setPrefs,
    prefsLoaded,
    prefsSaving,
    savePrefs,
    changePassword,
    changingPw,
  };
}
