"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MapPin,
  Navigation,
  Globe,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Crosshair,
  ExternalLink,
  Save,
  RotateCcw,
  Info,
  ShieldCheck,
  LocateFixed,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Protected } from "@/components/common/Protected";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/hooks/useToast";
import { useAuth } from "@/hooks/useAuth";
import { getHostelId } from "@/lib/axios";
import { hostelGhar, normalizeOwnerDashboard, unwrap, validHostelId } from "@/lib/hostelGhar";
import type { HostelLocation } from "@/lib/api-types";

const NEPAL_PRESETS = [
  { name: "Kathmandu (Bagbazar / Putalisadak)", lat: 27.7056, lng: 85.3206 },
  { name: "Kathmandu (Banasthali / Balaju)", lat: 27.7289, lng: 85.2974 },
  { name: "Kathmandu (Kirtipur / TU)", lat: 27.6798, lng: 85.2818 },
  { name: "Lalitpur (Lagankhel / Patan)", lat: 27.6667, lng: 85.3167 },
  { name: "Bhaktapur (Suryabinayak)", lat: 27.6716, lng: 85.4298 },
  { name: "Pokhara (Zero KM / Bagar)", lat: 28.238, lng: 83.9956 },
];

export default function HostelLocationPage() {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();

  const [activeHostelId, setActiveHostelId] = useState<string | null>(null);
  const [hostelAddress, setHostelAddress] = useState<string>("");
  const [hostelCity, setHostelCity] = useState<string>("");

  // Persisted state from backend
  const [savedLat, setSavedLat] = useState<number | null>(null);
  const [savedLng, setSavedLng] = useState<number | null>(null);
  const [isShared, setIsShared] = useState<boolean>(false);
  const [locationUpdatedAt, setLocationUpdatedAt] = useState<string | null>(null);

  // Staging / Editing state
  const [stagedLat, setStagedLat] = useState<string>("");
  const [stagedLng, setStagedLng] = useState<string>("");
  const [stagedSharing, setStagedSharing] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [showConfirmBanner, setShowConfirmBanner] = useState<boolean>(false);

  // 1. Resolve active hostel id
  useEffect(() => {
    let cancelled = false;
    async function resolveId() {
      let hid = validHostelId(user?.hostelId) ?? validHostelId(getHostelId());
      if (!hid) {
        try {
          const dashRes = await hostelGhar.owner.dashboard();
          const dash = normalizeOwnerDashboard(dashRes.data);
          hid = validHostelId(dash?.hostels?.[0]?.hostelId);
        } catch {
          // ignore
        }
      }
      if (!cancelled) {
        setActiveHostelId(hid ?? null);
      }
    }
    resolveId();
    return () => {
      cancelled = true;
    };
  }, [user?.hostelId]);

  // 2. Fetch location for active hostel
  const loadLocation = useCallback(async (hid: string) => {
    setIsLoading(true);
    try {
      const res = await hostelGhar.location.get(hid);
      const data = unwrap<HostelLocation>(res.data);
      if (data) {
        setSavedLat(data.latitude ?? null);
        setSavedLng(data.longitude ?? null);
        setIsShared(Boolean(data.isLocationShared));
        setLocationUpdatedAt(data.locationUpdatedAt ?? null);
        setHostelAddress(data.address || "");
        setHostelCity(data.city || "");

        // Initialize staging state
        setStagedLat(data.latitude !== null ? String(data.latitude) : "");
        setStagedLng(data.longitude !== null ? String(data.longitude) : "");
        setStagedSharing(Boolean(data.isLocationShared));
      }
    } catch {
      toastError("Failed to load hostel location settings.");
    } finally {
      setIsLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    if (activeHostelId) {
      loadLocation(activeHostelId);
    } else {
      setIsLoading(false);
    }
  }, [activeHostelId, loadLocation]);

  const hasConfiguredLocation = savedLat !== null && savedLng !== null;

  const parsedStagedLat = stagedLat.trim() ? parseFloat(stagedLat.trim()) : null;
  const parsedStagedLng = stagedLng.trim() ? parseFloat(stagedLng.trim()) : null;
  const hasValidStagedCoords =
    parsedStagedLat !== null &&
    parsedStagedLng !== null &&
    !isNaN(parsedStagedLat) &&
    !isNaN(parsedStagedLng) &&
    parsedStagedLat >= -90 &&
    parsedStagedLat <= 90 &&
    parsedStagedLng >= -180 &&
    parsedStagedLng <= 180;

  // Has changes compared to persisted backend state
  const isDirty = useMemo(() => {
    const latDiff = parsedStagedLat !== savedLat;
    const lngDiff = parsedStagedLng !== savedLng;
    const shareDiff = stagedSharing !== isShared;
    return latDiff || lngDiff || shareDiff;
  }, [parsedStagedLat, parsedStagedLng, stagedSharing, savedLat, savedLng, isShared]);

  // Browser Geolocation Acquisition
  const handleDetectLocation = () => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setGeoError("Geolocation is not supported by your current browser.");
      return;
    }

    setIsDetecting(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(7));
        const lng = parseFloat(pos.coords.longitude.toFixed(7));
        setStagedLat(String(lat));
        setStagedLng(String(lng));
        setShowConfirmBanner(true);
        setIsDetecting(false);
        success("Location detected from device! Please verify the map preview before submitting.");
      },
      (err) => {
        setIsDetecting(false);
        let msg = "Could not obtain device location.";
        if (err.code === err.PERMISSION_DENIED) {
          msg = "Location permission denied. Please allow location access in your browser or enter coordinates manually below.";
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = "Position unavailable. Please pick a nearby preset or enter coordinates manually.";
        } else if (err.code === err.TIMEOUT) {
          msg = "Location request timed out. Please try again or enter coordinates manually.";
        }
        setGeoError(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  };

  // Submit confirmed coordinates to backend
  const handleSubmitLocation = async () => {
    if (!activeHostelId) {
      toastError("Hostel ID not available.");
      return;
    }

    if (!hasValidStagedCoords && stagedSharing) {
      toastError("Cannot enable public location sharing without valid coordinates.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await hostelGhar.location.update(activeHostelId, {
        latitude: hasValidStagedCoords ? parsedStagedLat : null,
        longitude: hasValidStagedCoords ? parsedStagedLng : null,
        isLocationShared: stagedSharing,
      });

      const data = unwrap<HostelLocation>(res.data);
      success(
        stagedSharing
          ? "Hostel location saved and shared publicly!"
          : "Hostel location saved (hidden from public)."
      );

      if (data) {
        setSavedLat(data.latitude ?? null);
        setSavedLng(data.longitude ?? null);
        setIsShared(Boolean(data.isLocationShared));
        setLocationUpdatedAt(data.locationUpdatedAt ?? new Date().toISOString());
        setShowConfirmBanner(false);
      }
    } catch {
      toastError("Failed to save location. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Cancel staged changes and revert to saved state
  const handleCancelStaging = () => {
    setStagedLat(savedLat !== null ? String(savedLat) : "");
    setStagedLng(savedLng !== null ? String(savedLng) : "");
    setStagedSharing(isShared);
    setShowConfirmBanner(false);
    setGeoError(null);
  };

  const previewLat = hasValidStagedCoords ? parsedStagedLat : savedLat;
  const previewLng = hasValidStagedCoords ? parsedStagedLng : savedLng;

  return (
    <Protected permission="VIEW_HOSTEL">
      <DashboardShell
        title="Location & Map"
        subtitle="Manage and share the exact geographic coordinates of your hostel."
      >
        <div className="space-y-6 max-w-5xl mx-auto pb-16">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200/80 pb-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="p-2 rounded-xl bg-brand-lime/20 text-brand-black">
                  <MapPin size={20} className="text-brand-black" />
                </span>
                <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
                  Location & Map
                </h1>
                {isShared && hasConfiguredLocation ? (
                  <Badge tone="green" className="ml-2">
                    <Eye size={12} className="mr-1" /> Publicly Shared
                  </Badge>
                ) : hasConfiguredLocation ? (
                  <Badge tone="gray" className="ml-2">
                    <EyeOff size={12} className="mr-1" /> Hidden from Public
                  </Badge>
                ) : (
                  <Badge tone="amber" className="ml-2">
                    Not Configured
                  </Badge>
                )}
              </div>
              <p className="text-sm text-neutral-500 max-w-2xl">
                Configure the exact geographic coordinates of your hostel. When public sharing is enabled,
                prospective residents can view your interactive map and tap &quot;Get Directions&quot;.
              </p>
            </div>

            {locationUpdatedAt && (
              <div className="text-right text-xs text-neutral-500 shrink-0">
                <p>Last updated:</p>
                <p className="font-semibold text-neutral-700">
                  {new Date(locationUpdatedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full rounded-2xl" />
              <Skeleton className="h-72 w-full rounded-2xl" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Status & Sharing Toggle Card */}
              <Card className="p-5 border-neutral-200 shadow-xs rounded-2xl bg-white">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-neutral-900 text-base">
                        Public Location Sharing
                      </span>
                      {stagedSharing ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-700 text-xs font-medium">
                          Disabled
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 max-w-xl">
                      {stagedSharing
                        ? "Your hostel coordinates are published. Students and visitors can view the map and get GPS directions."
                        : "Your hostel location is hidden from public visitors. Coordinates remain safely saved in your dashboard."}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={stagedSharing}
                        onChange={(e) => setStagedSharing(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-12 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-black"></div>
                      <span className="ml-2.5 text-xs font-semibold text-neutral-800">
                        {stagedSharing ? "Sharing Enabled" : "Sharing Disabled"}
                      </span>
                    </label>
                  </div>
                </div>
              </Card>

              {/* Action Banner / Staged Confirmation */}
              {showConfirmBanner && (
                <div className="p-4 rounded-2xl bg-brand-lime/20 border border-brand-lime text-brand-black flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <LocateFixed size={18} className="text-brand-black shrink-0" />
                    <div>
                      <p className="font-bold text-sm">New coordinates detected!</p>
                      <p className="text-xs text-neutral-700">
                        Device coordinates: <strong>{stagedLat}, {stagedLng}</strong>. Verify the map marker below before submitting.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={handleCancelStaging} className="bg-white text-xs">
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleSubmitLocation}
                      loading={isSaving}
                      className="bg-brand-black text-white hover:bg-neutral-800 text-xs font-bold"
                    >
                      Submit Location
                    </Button>
                  </div>
                </div>
              )}

              {/* Geolocation Acquisition & Presets */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Acquisition Controls (5 cols) */}
                <div className="md:col-span-5 space-y-4">
                  <Card className="p-5 border-neutral-200 shadow-xs rounded-2xl bg-white space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-neutral-100">
                      <Crosshair size={16} className="text-neutral-700" />
                      <h2 className="font-bold text-sm text-neutral-900">Coordinate Detection</h2>
                    </div>

                    <div className="space-y-3">
                      <p className="text-xs text-neutral-500 leading-relaxed">
                        Click the button below while physically at your hostel building to detect coordinates via browser geolocation.
                      </p>

                      <Button
                        variant="primary"
                        onClick={handleDetectLocation}
                        loading={isDetecting}
                        className="w-full bg-brand-lime text-brand-black hover:bg-brand-lime/90 font-bold py-2.5 rounded-xl shadow-xs"
                      >
                        <LocateFixed size={16} className="mr-2" />
                        {hasConfiguredLocation ? "Update Location" : "Share Location"}
                      </Button>

                      {geoError && (
                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                          <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-600" />
                          <span>{geoError}</span>
                        </div>
                      )}

                      <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/70 text-amber-900 text-[11px] leading-relaxed flex items-start gap-2">
                        <Info size={14} className="shrink-0 mt-0.5 text-amber-600" />
                        <span>
                          Device geolocation identifies where your phone/laptop is currently situated. If you are configuring from home, please adjust the pin or pick a preset below.
                        </span>
                      </div>
                    </div>

                    {/* Manual Input Fields */}
                    <div className="pt-3 border-t border-neutral-100 space-y-3">
                      <h3 className="font-bold text-xs text-neutral-800">Manual Coordinates</h3>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                            Latitude (-90 to 90)
                          </label>
                          <input
                            type="text"
                            value={stagedLat}
                            onChange={(e) => setStagedLat(e.target.value)}
                            placeholder="e.g. 27.7172"
                            className="w-full px-3 py-1.5 rounded-xl border border-neutral-200 text-xs focus:ring-2 focus:ring-brand-lime"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                            Longitude (-180 to 180)
                          </label>
                          <input
                            type="text"
                            value={stagedLng}
                            onChange={(e) => setStagedLng(e.target.value)}
                            placeholder="e.g. 85.3240"
                            className="w-full px-3 py-1.5 rounded-xl border border-neutral-200 text-xs focus:ring-2 focus:ring-brand-lime"
                          />
                        </div>
                      </div>

                      {/* Nepal City Quick Presets */}
                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-500 mb-1.5">
                          Nepal Quick Presets:
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {NEPAL_PRESETS.map((p) => (
                            <button
                              key={p.name}
                              type="button"
                              onClick={() => {
                                setStagedLat(String(p.lat));
                                setStagedLng(String(p.lng));
                              }}
                              className="text-[10px] px-2 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition-colors"
                            >
                              {p.name.split(" ")[0]} ({p.name.split(" ")[1]?.replace("(", "")})
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="pt-3 border-t border-neutral-100 flex items-center justify-between gap-2">
                      {isDirty && (
                        <Button variant="ghost" size="sm" onClick={handleCancelStaging} className="text-xs">
                          Reset
                        </Button>
                      )}
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleSubmitLocation}
                        loading={isSaving}
                        disabled={!hasValidStagedCoords && stagedSharing}
                        className="bg-brand-black text-white hover:bg-neutral-800 text-xs font-semibold ml-auto"
                      >
                        <Save size={14} className="mr-1.5" /> Save Changes
                      </Button>
                    </div>
                  </Card>
                </div>

                {/* Map Preview & Details (7 cols) */}
                <div className="md:col-span-7 space-y-4">
                  <Card className="p-5 border-neutral-200 shadow-xs rounded-2xl bg-white space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                      <div className="flex items-center gap-2">
                        <Globe size={16} className="text-neutral-700" />
                        <h2 className="font-bold text-sm text-neutral-900">Map & Listing Preview</h2>
                      </div>
                      {previewLat && previewLng && (
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${previewLat},${previewLng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-brand-black hover:underline flex items-center gap-1 font-semibold"
                        >
                          Open Google Maps <ExternalLink size={12} />
                        </a>
                      )}
                    </div>

                    {/* Embedded OpenStreetMap Preview */}
                    {previewLat && previewLng ? (
                      <div className="space-y-3">
                        <div className="relative aspect-video rounded-xl overflow-hidden border border-neutral-200 bg-neutral-100 shadow-inner">
                          <iframe
                            title="Hostel Map Preview"
                            width="100%"
                            height="100%"
                            frameBorder="0"
                            scrolling="no"
                            marginHeight={0}
                            marginWidth={0}
                            src={`https://www.openstreetmap.org/export/embed.html?bbox=${previewLng - 0.005}%2C${previewLat - 0.003}%2C${previewLng + 0.005}%2C${previewLat + 0.003}&layer=mapnik&marker=${previewLat}%2C${previewLng}`}
                            className="w-full h-full"
                          />
                        </div>

                        {/* Location Meta Footer */}
                        <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-neutral-50 border border-neutral-100 text-xs">
                          <div>
                            <span className="text-neutral-400 block text-[10px] uppercase">Coordinates</span>
                            <span className="font-mono font-semibold text-neutral-800">
                              {previewLat.toFixed(5)}, {previewLng.toFixed(5)}
                            </span>
                          </div>
                          <div>
                            <span className="text-neutral-400 block text-[10px] uppercase">Registered Address</span>
                            <span className="font-medium text-neutral-800 truncate block">
                              {[hostelAddress, hostelCity].filter(Boolean).join(", ") || "Address on file"}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="aspect-video rounded-xl border border-dashed border-neutral-300 bg-neutral-50 flex flex-col items-center justify-center p-6 text-center text-neutral-400 space-y-2">
                        <MapPin size={32} className="text-neutral-300 stroke-1" />
                        <p className="text-sm font-semibold text-neutral-600">No Location Configured Yet</p>
                        <p className="text-xs text-neutral-400 max-w-sm">
                          Click &quot;Share Location&quot; to auto-detect your building&apos;s GPS position, or enter coordinates manually.
                        </p>
                      </div>
                    )}
                  </Card>
                </div>
              </div>
            </div>
          )}
        </div>
      </DashboardShell>
    </Protected>
  );
}
