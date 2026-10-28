"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Utensils,
  Clock,
  Save,
  RotateCcw,
  Eye,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Sparkles,
  Info,
  ChevronRight,
  Coffee,
  Copy,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Protected } from "@/components/common/Protected";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/hooks/useToast";
import { useAuth } from "@/hooks/useAuth";
import { getHostelId, toApiError } from "@/lib/axios";
import { hostelGhar, normalizeOwnerDashboard, unwrap, validHostelId } from "@/lib/hostelGhar";
import type { DayOfWeek, MealDayItem, WeeklyMealSchedule } from "@/lib/api-types";

interface DayConfig {
  key: DayOfWeek;
  name: string;
  nepali: string;
  badge: string;
}

const DAYS_OF_WEEK: DayConfig[] = [
  { key: "SUNDAY", name: "Sunday", nepali: "आइतबार", badge: "Day 1" },
  { key: "MONDAY", name: "Monday", nepali: "सोमबार", badge: "Day 2" },
  { key: "TUESDAY", name: "Tuesday", nepali: "मंगलबार", badge: "Day 3" },
  { key: "WEDNESDAY", name: "Wednesday", nepali: "बुधबार", badge: "Day 4" },
  { key: "THURSDAY", name: "Thursday", nepali: "बिहीबार", badge: "Day 5" },
  { key: "FRIDAY", name: "Friday", nepali: "शुक्रबार", badge: "Day 6" },
  { key: "SATURDAY", name: "Saturday", nepali: "शनिबार", badge: "Day 7" },
];

const DEFAULT_MEALS: Record<DayOfWeek, MealDayItem> = {
  SUNDAY: {
    dayOfWeek: "SUNDAY",
    breakfastDescription: "",
    breakfastTime: "07:30 AM - 09:00 AM",
    breakfastNotes: "",
    mainMealDescription: "",
    mainMealTime: "07:30 PM - 09:30 PM",
    mainMealNotes: "",
  },
  MONDAY: {
    dayOfWeek: "MONDAY",
    breakfastDescription: "",
    breakfastTime: "07:30 AM - 09:00 AM",
    breakfastNotes: "",
    mainMealDescription: "",
    mainMealTime: "07:30 PM - 09:30 PM",
    mainMealNotes: "",
  },
  TUESDAY: {
    dayOfWeek: "TUESDAY",
    breakfastDescription: "",
    breakfastTime: "07:30 AM - 09:00 AM",
    breakfastNotes: "",
    mainMealDescription: "",
    mainMealTime: "07:30 PM - 09:30 PM",
    mainMealNotes: "",
  },
  WEDNESDAY: {
    dayOfWeek: "WEDNESDAY",
    breakfastDescription: "",
    breakfastTime: "07:30 AM - 09:00 AM",
    breakfastNotes: "",
    mainMealDescription: "",
    mainMealTime: "07:30 PM - 09:30 PM",
    mainMealNotes: "",
  },
  THURSDAY: {
    dayOfWeek: "THURSDAY",
    breakfastDescription: "",
    breakfastTime: "07:30 AM - 09:00 AM",
    breakfastNotes: "",
    mainMealDescription: "",
    mainMealTime: "07:30 PM - 09:30 PM",
    mainMealNotes: "",
  },
  FRIDAY: {
    dayOfWeek: "FRIDAY",
    breakfastDescription: "",
    breakfastTime: "07:30 AM - 09:00 AM",
    breakfastNotes: "",
    mainMealDescription: "",
    mainMealTime: "07:30 PM - 09:30 PM",
    mainMealNotes: "",
  },
  SATURDAY: {
    dayOfWeek: "SATURDAY",
    breakfastDescription: "",
    breakfastTime: "08:00 AM - 09:30 AM",
    breakfastNotes: "",
    mainMealDescription: "",
    mainMealTime: "07:30 PM - 09:30 PM",
    mainMealNotes: "",
  },
};

/** Standard Nepali hostel weekly menu template */
const NEPALI_STANDARD_TEMPLATE: Record<
  DayOfWeek,
  Omit<MealDayItem, "id" | "createdAt" | "updatedAt">
> = {
  SUNDAY: {
    dayOfWeek: "SUNDAY",
    breakfastDescription: "Milk Tea, Boiled Eggs, Bread & Jam",
    breakfastTime: "07:30 AM - 09:00 AM",
    breakfastNotes: "Extra egg available on request",
    mainMealDescription: "Dal Bhat, Chicken Curry, Seasonal Saag, Tomato Achar",
    mainMealTime: "07:30 PM - 09:30 PM",
    mainMealNotes: "Veg option: Paneer Curry",
  },
  MONDAY: {
    dayOfWeek: "MONDAY",
    breakfastDescription: "Black Tea, Chiura, Fried Chana",
    breakfastTime: "07:30 AM - 09:00 AM",
    breakfastNotes: "",
    mainMealDescription: "Rice, Mix Dal, Aloo Gobi Tarkari, Papad",
    mainMealTime: "07:30 PM - 09:30 PM",
    mainMealNotes: "",
  },
  TUESDAY: {
    dayOfWeek: "TUESDAY",
    breakfastDescription: "Tea, Boiled Chana, Toast",
    breakfastTime: "07:30 AM - 09:00 AM",
    breakfastNotes: "",
    mainMealDescription: "Rice, Dal, Green Vegetables, Egg Curry",
    mainMealTime: "07:30 PM - 09:30 PM",
    mainMealNotes: "",
  },
  WEDNESDAY: {
    dayOfWeek: "WEDNESDAY",
    breakfastDescription: "Tea, Halwa, Bread",
    breakfastTime: "07:30 AM - 09:00 AM",
    breakfastNotes: "",
    mainMealDescription: "Dal Bhat, Seasonal Tarkari, Chicken Curry",
    mainMealTime: "07:30 PM - 09:30 PM",
    mainMealNotes: "",
  },
  THURSDAY: {
    dayOfWeek: "THURSDAY",
    breakfastDescription: "Milk Tea, Paratha, Aloo Tarkari",
    breakfastTime: "07:30 AM - 09:00 AM",
    breakfastNotes: "",
    mainMealDescription: "Rice, Dal, Mushroom Curry, Salad",
    mainMealTime: "07:30 PM - 09:30 PM",
    mainMealNotes: "",
  },
  FRIDAY: {
    dayOfWeek: "FRIDAY",
    breakfastDescription: "Tea, Chowmein, Boiled Egg",
    breakfastTime: "07:30 AM - 09:00 AM",
    breakfastNotes: "",
    mainMealDescription: "Dal Bhat, Fish Curry / Soyabean, Saag",
    mainMealTime: "07:30 PM - 09:30 PM",
    mainMealNotes: "",
  },
  SATURDAY: {
    dayOfWeek: "SATURDAY",
    breakfastDescription: "Special Morning Tea, Puri Tarkari",
    breakfastTime: "08:00 AM - 09:30 AM",
    breakfastNotes: "Saturday special breakfast timing",
    mainMealDescription: "Fried Rice / Khichdi, Tomato Chutney, Papad",
    mainMealTime: "07:30 PM - 09:30 PM",
    mainMealNotes: "",
  },
};

export default function WeeklyMealsPage() {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();

  const [activeHostelId, setActiveHostelId] = useState<string | null>(null);
  const [scheduleState, setScheduleState] = useState<Record<DayOfWeek, MealDayItem>>(DEFAULT_MEALS);
  const [originalState, setOriginalState] = useState<Record<DayOfWeek, MealDayItem>>(DEFAULT_MEALS);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [hasSchedule, setHasSchedule] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isClearing, setIsClearing] = useState<boolean>(false);
  const [clearModalOpen, setClearModalOpen] = useState<boolean>(false);
  const [templateModalOpen, setTemplateModalOpen] = useState<boolean>(false);
  const [previewOpen, setPreviewOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<DayOfWeek>("SUNDAY");

  // 1. Resolve hostel id
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

  // 2. Fetch meal schedule for active hostel (GET /api/v1/hostel-ghar/hostels/:hostelId/meals)
  const loadSchedule = useCallback(
    async (hid: string) => {
      setIsLoading(true);
      try {
        const res = await hostelGhar.meals.get(hid);
        const data = unwrap<WeeklyMealSchedule>(res.data);
        const rawList = Array.isArray(data?.days)
          ? data.days
          : Array.isArray(data?.schedule)
            ? data.schedule
            : [];

        if (data && rawList.length > 0) {
          const mapped = { ...DEFAULT_MEALS };
          rawList.forEach((item) => {
            if (item && item.dayOfWeek) {
              mapped[item.dayOfWeek] = {
                id: item.id ?? null,
                dayOfWeek: item.dayOfWeek,
                breakfastDescription: item.breakfastDescription ?? "",
                breakfastTime: item.breakfastTime ?? "",
                breakfastNotes: item.breakfastNotes ?? "",
                mainMealDescription: item.mainMealDescription ?? "",
                mainMealTime: item.mainMealTime ?? "",
                mainMealNotes: item.mainMealNotes ?? "",
                createdAt: item.createdAt ?? null,
                updatedAt: item.updatedAt ?? null,
              };
            }
          });
          setScheduleState(mapped);
          setOriginalState(mapped);
          setLastUpdatedAt(data.updatedAt ?? data.lastUpdatedAt ?? null);

          const hasAnyConfigured = rawList.some(
            (m) =>
              Boolean(m.breakfastDescription && m.breakfastDescription.trim().length > 0) ||
              Boolean(m.mainMealDescription && m.mainMealDescription.trim().length > 0)
          );
          setHasSchedule(Boolean(data.hasSchedule ?? hasAnyConfigured));
        } else {
          setScheduleState(DEFAULT_MEALS);
          setOriginalState(DEFAULT_MEALS);
          setHasSchedule(false);
          setLastUpdatedAt(null);
        }
      } catch (err: unknown) {
        const apiErr = toApiError(err);
        toastError(apiErr.message || "Failed to load weekly meal schedule. Please refresh.");
      } finally {
        setIsLoading(false);
      }
    },
    [toastError]
  );

  useEffect(() => {
    if (activeHostelId) {
      loadSchedule(activeHostelId);
    } else {
      setIsLoading(false);
    }
  }, [activeHostelId, loadSchedule]);

  // Check unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(scheduleState) !== JSON.stringify(originalState);
  }, [scheduleState, originalState]);

  const handleFieldChange = (day: DayOfWeek, field: keyof MealDayItem, value: string) => {
    setScheduleState((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value,
      },
    }));
  };

  // Copy current active day's meal schedule to all other 6 days
  const handleCopyDayToAll = (sourceDay: DayOfWeek) => {
    const src = scheduleState[sourceDay];
    setScheduleState((prev) => {
      const next = { ...prev };
      DAYS_OF_WEEK.forEach((d) => {
        if (d.key !== sourceDay) {
          next[d.key] = {
            ...next[d.key],
            breakfastDescription: src.breakfastDescription,
            breakfastTime: src.breakfastTime,
            breakfastNotes: src.breakfastNotes,
            mainMealDescription: src.mainMealDescription,
            mainMealTime: src.mainMealTime,
            mainMealNotes: src.mainMealNotes,
          };
        }
      });
      return next;
    });
    success(`Copied ${sourceDay} menu items to all other days! Click Save to apply.`);
  };

  // Apply Nepali standard template
  const handleApplyTemplate = () => {
    const updated = { ...scheduleState };
    DAYS_OF_WEEK.forEach((d) => {
      const tpl = NEPALI_STANDARD_TEMPLATE[d.key];
      updated[d.key] = {
        ...updated[d.key],
        breakfastDescription: tpl.breakfastDescription ?? "",
        breakfastTime: tpl.breakfastTime ?? "",
        breakfastNotes: tpl.breakfastNotes ?? "",
        mainMealDescription: tpl.mainMealDescription ?? "",
        mainMealTime: tpl.mainMealTime ?? "",
        mainMealNotes: tpl.mainMealNotes ?? "",
      };
    });
    setScheduleState(updated);
    setTemplateModalOpen(false);
    success("Nepali Standard Weekly Menu loaded! Review the entries and click Save.");
  };

  // 3. Save weekly schedule (PUT /api/v1/hostel-ghar/hostels/:hostelId/meals)
  const handleSave = async () => {
    if (!activeHostelId) {
      toastError("Hostel ID could not be identified.");
      return;
    }

    // Client-side validation for field constraints from API spec
    for (const d of DAYS_OF_WEEK) {
      const m = scheduleState[d.key];
      if (m.breakfastDescription && m.breakfastDescription.length > 1000) {
        toastError(`${d.name} breakfast description exceeds 1,000 characters limit.`);
        return;
      }
      if (m.breakfastTime && m.breakfastTime.length > 50) {
        toastError(`${d.name} breakfast serving time exceeds 50 characters limit.`);
        return;
      }
      if (m.breakfastNotes && m.breakfastNotes.length > 500) {
        toastError(`${d.name} breakfast dietary note exceeds 500 characters limit.`);
        return;
      }
      if (m.mainMealDescription && m.mainMealDescription.length > 1000) {
        toastError(`${d.name} main meal description exceeds 1,000 characters limit.`);
        return;
      }
      if (m.mainMealTime && m.mainMealTime.length > 50) {
        toastError(`${d.name} main meal serving time exceeds 50 characters limit.`);
        return;
      }
      if (m.mainMealNotes && m.mainMealNotes.length > 500) {
        toastError(`${d.name} main meal note exceeds 500 characters limit.`);
        return;
      }
    }

    setIsSaving(true);
    try {
      const payload: MealDayItem[] = DAYS_OF_WEEK.map((d) => ({
        dayOfWeek: d.key,
        breakfastDescription: scheduleState[d.key].breakfastDescription?.trim() || null,
        breakfastTime: scheduleState[d.key].breakfastTime?.trim() || null,
        breakfastNotes: scheduleState[d.key].breakfastNotes?.trim() || null,
        mainMealDescription: scheduleState[d.key].mainMealDescription?.trim() || null,
        mainMealTime: scheduleState[d.key].mainMealTime?.trim() || null,
        mainMealNotes: scheduleState[d.key].mainMealNotes?.trim() || null,
      }));

      const res = await hostelGhar.meals.save(activeHostelId, payload);
      const data = unwrap<WeeklyMealSchedule>(res.data);
      success("Weekly meal schedule saved successfully!");

      const rawList = Array.isArray(data?.days)
        ? data.days
        : Array.isArray(data?.schedule)
          ? data.schedule
          : [];

      if (data && rawList.length > 0) {
        const mapped = { ...DEFAULT_MEALS };
        rawList.forEach((item) => {
          if (item && item.dayOfWeek) {
            mapped[item.dayOfWeek] = {
              id: item.id ?? null,
              dayOfWeek: item.dayOfWeek,
              breakfastDescription: item.breakfastDescription ?? "",
              breakfastTime: item.breakfastTime ?? "",
              breakfastNotes: item.breakfastNotes ?? "",
              mainMealDescription: item.mainMealDescription ?? "",
              mainMealTime: item.mainMealTime ?? "",
              mainMealNotes: item.mainMealNotes ?? "",
              createdAt: item.createdAt ?? null,
              updatedAt: item.updatedAt ?? null,
            };
          }
        });
        setScheduleState(mapped);
        setOriginalState(mapped);
        setLastUpdatedAt(data.updatedAt ?? data.lastUpdatedAt ?? new Date().toISOString());

        const hasAnyConfigured = rawList.some(
          (m) =>
            Boolean(m.breakfastDescription && m.breakfastDescription.trim().length > 0) ||
            Boolean(m.mainMealDescription && m.mainMealDescription.trim().length > 0)
        );
        setHasSchedule(Boolean(data.hasSchedule ?? hasAnyConfigured));
      } else {
        // Fallback to local state if server returned empty data envelope
        setOriginalState(scheduleState);
        setLastUpdatedAt(new Date().toISOString());
        const hasAnyConfigured = payload.some(
          (m) => Boolean(m.breakfastDescription) || Boolean(m.mainMealDescription)
        );
        setHasSchedule(hasAnyConfigured);
      }
    } catch (err: unknown) {
      const apiErr = toApiError(err);
      toastError(
        apiErr.message || "Failed to save meal schedule. Please check your network and try again."
      );
    } finally {
      setIsSaving(false);
    }
  };

  // 4. Clear/reset weekly schedule (DELETE /api/v1/hostel-ghar/hostels/:hostelId/meals)
  const handleClear = async () => {
    if (!activeHostelId) return;
    setIsClearing(true);
    try {
      await hostelGhar.meals.clear(activeHostelId);
      success("Weekly meal schedule reset successfully.");
      setScheduleState(DEFAULT_MEALS);
      setOriginalState(DEFAULT_MEALS);
      setHasSchedule(false);
      setLastUpdatedAt(null);
      setClearModalOpen(false);
    } catch (err: unknown) {
      const apiErr = toApiError(err);
      toastError(apiErr.message || "Failed to clear weekly schedule. Try again.");
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <Protected permission="VIEW_HOSTEL">
      <DashboardShell
        title="Weekly Meals & Menu"
        subtitle="Manage the 7-day Sunday-Saturday breakfast and main meal menu for your hostel."
      >
        <div className="mx-auto max-w-6xl space-y-6 pb-16">
          {/* Header */}
          <div className="flex flex-col justify-between gap-4 border-b border-neutral-200/80 pb-5 sm:flex-row sm:items-center">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <span className="bg-brand-lime/20 text-brand-black rounded-xl p-2">
                  <Utensils size={20} className="text-brand-black" />
                </span>
                <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
                  Weekly Meals & Menu
                </h1>
                {hasSchedule ? (
                  <Badge tone="green" className="ml-2">
                    <CheckCircle2 size={12} className="mr-1" /> Published
                  </Badge>
                ) : (
                  <Badge tone="gray" className="ml-2">
                    Not Configured
                  </Badge>
                )}
              </div>
              <p className="max-w-2xl text-sm text-neutral-500">
                Configure breakfast and main meal items for every day of the week (Sunday through
                Saturday). Prospective residents and students can view this schedule on your public
                hostel profile.
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTemplateModalOpen(true)}
                disabled={isLoading}
                className="bg-brand-lime/10 border-brand-lime/40 text-brand-black hover:bg-brand-lime/20 text-xs"
              >
                <Sparkles size={14} className="text-brand-black mr-1" /> Apply Template
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewOpen(true)}
                disabled={isLoading}
                className="text-xs"
              >
                <Eye size={14} className="mr-1" /> Public Preview
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setClearModalOpen(true)}
                disabled={isLoading || !hasSchedule}
                className="border-rose-200 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700"
              >
                <RotateCcw size={13} className="mr-1" /> Reset All
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSave}
                loading={isSaving}
                disabled={isLoading}
                className="bg-brand-lime text-brand-black hover:bg-brand-lime/90 px-3.5 text-xs font-semibold"
              >
                <Save size={14} className="mr-1.5" /> Save Weekly Schedule
              </Button>
            </div>
          </div>

          {/* Unsaved changes alert */}
          {hasUnsavedChanges && (
            <div className="shadow-xs animate-in fade-in flex items-center justify-between gap-3 rounded-xl border border-amber-200/80 bg-amber-50 p-3.5 text-sm text-amber-900 duration-200">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0 text-amber-600" />
                <span className="text-xs font-medium sm:text-sm">
                  You have unsaved changes in your weekly menu. Remember to click &quot;Save Weekly
                  Schedule&quot; to update the database.
                </span>
              </div>
              <Button
                size="sm"
                onClick={handleSave}
                loading={isSaving}
                className="shrink-0 bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700"
              >
                Save Now
              </Button>
            </div>
          )}

          {/* Info bar: Nepali calendar standard & last updated */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200/60 bg-neutral-50 px-4 py-2.5 text-xs text-neutral-600">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-neutral-500" />
              <span>
                Nepali Standard Schedule: <strong>SUNDAY through SATURDAY (7 Days)</strong>
              </span>
            </div>
            {lastUpdatedAt && (
              <span className="text-neutral-500">
                Last updated:{" "}
                <strong className="text-neutral-700">
                  {new Date(lastUpdatedAt).toLocaleString("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </strong>
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-12 w-full rounded-2xl" />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Skeleton className="h-64 rounded-2xl" />
                <Skeleton className="h-64 rounded-2xl" />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Day Selector Tabs */}
              <div className="scrollbar-none flex items-center gap-1.5 overflow-x-auto border-b border-neutral-200/70 pb-2">
                {DAYS_OF_WEEK.map((day) => {
                  const dayMeals = scheduleState[day.key];
                  const hasData =
                    Boolean(dayMeals.breakfastDescription?.trim()) ||
                    Boolean(dayMeals.mainMealDescription?.trim());
                  const isActive = activeTab === day.key;

                  return (
                    <button
                      key={day.key}
                      type="button"
                      onClick={() => setActiveTab(day.key)}
                      className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                        isActive
                          ? "bg-brand-black shadow-xs text-white"
                          : "border border-neutral-200/70 bg-white text-neutral-600 hover:bg-neutral-100/80"
                      }`}
                    >
                      <span>{day.name}</span>
                      <span className="text-xs font-normal opacity-75">({day.nepali})</span>
                      {hasData && (
                        <span
                          className={`h-2 w-2 rounded-full ${
                            isActive ? "bg-brand-lime" : "bg-emerald-500"
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Active Day Editor Card */}
              {DAYS_OF_WEEK.map((day) => {
                if (day.key !== activeTab) return null;
                const current = scheduleState[day.key];

                return (
                  <div key={day.key} className="animate-in fade-in space-y-6 duration-150">
                    <div className="flex flex-col justify-between gap-3 rounded-2xl border border-neutral-200/70 bg-neutral-100/60 p-4 sm:flex-row sm:items-center">
                      <div className="flex items-center gap-3">
                        <span className="bg-brand-black text-brand-lime shadow-xs flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold">
                          {day.badge}
                        </span>
                        <div>
                          <h2 className="text-lg font-bold text-neutral-900">
                            {day.name} / {day.nepali}
                          </h2>
                          <p className="text-xs text-neutral-500">
                            Specify morning breakfast and main meal (lunch / dinner) details.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyDayToAll(day.key)}
                          className="text-xs text-neutral-700 hover:bg-neutral-200/70"
                          title="Copy this day's menu to all other days"
                        >
                          <Copy size={13} className="mr-1" /> Copy to All Days
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const currentIndex = DAYS_OF_WEEK.findIndex((d) => d.key === day.key);
                            const nextIndex = (currentIndex + 1) % DAYS_OF_WEEK.length;
                            setActiveTab(DAYS_OF_WEEK[nextIndex].key);
                          }}
                          className="text-xs text-neutral-700 hover:bg-neutral-200/70"
                        >
                          Next Day <ChevronRight size={14} className="ml-0.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                      {/* Breakfast Card */}
                      <Card className="shadow-xs rounded-2xl border-neutral-200 bg-white p-5 transition-colors hover:border-neutral-300">
                        <div className="mb-4 flex items-center justify-between border-b border-neutral-100 pb-3">
                          <div className="flex items-center gap-2.5">
                            <span className="rounded-xl border border-amber-100 bg-amber-50 p-2 text-amber-600">
                              <Coffee size={18} />
                            </span>
                            <div>
                              <h3 className="text-sm font-bold text-neutral-900">Breakfast Menu</h3>
                              <p className="text-xs text-neutral-400">Morning serving</p>
                            </div>
                          </div>
                          <Badge tone="amber" className="text-[11px]">
                            Breakfast
                          </Badge>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <div className="mb-1.5 flex items-center justify-between">
                              <label className="text-xs font-semibold text-neutral-700">
                                Menu Items &amp; Foods{" "}
                                <span className="font-normal text-neutral-400">
                                  (max 1,000 chars)
                                </span>
                              </label>
                              <span className="font-mono text-[10px] text-neutral-400">
                                {(current.breakfastDescription ?? "").length}/1000
                              </span>
                            </div>
                            <textarea
                              rows={4}
                              maxLength={1000}
                              value={current.breakfastDescription ?? ""}
                              onChange={(e) =>
                                handleFieldChange(day.key, "breakfastDescription", e.target.value)
                              }
                              placeholder="e.g. Milk Tea, Boiled Eggs, Bread & Jam"
                              className="focus:ring-brand-lime/80 focus:border-brand-black w-full resize-y rounded-xl border border-neutral-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2"
                            />
                          </div>

                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                              <div className="mb-1.5 flex items-center justify-between">
                                <label className="flex items-center gap-1 text-xs font-semibold text-neutral-700">
                                  <Clock size={12} className="text-neutral-500" /> Serving Time
                                </label>
                                <span className="font-mono text-[10px] text-neutral-400">
                                  {(current.breakfastTime ?? "").length}/50
                                </span>
                              </div>
                              <input
                                type="text"
                                maxLength={50}
                                value={current.breakfastTime ?? ""}
                                onChange={(e) =>
                                  handleFieldChange(day.key, "breakfastTime", e.target.value)
                                }
                                placeholder="e.g. 07:30 AM - 09:00 AM"
                                className="focus:ring-brand-lime/80 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                              />
                            </div>
                            <div>
                              <div className="mb-1.5 flex items-center justify-between">
                                <label className="flex items-center gap-1 text-xs font-semibold text-neutral-700">
                                  <Info size={12} className="text-neutral-500" /> Dietary Note
                                </label>
                                <span className="font-mono text-[10px] text-neutral-400">
                                  {(current.breakfastNotes ?? "").length}/500
                                </span>
                              </div>
                              <input
                                type="text"
                                maxLength={500}
                                value={current.breakfastNotes ?? ""}
                                onChange={(e) =>
                                  handleFieldChange(day.key, "breakfastNotes", e.target.value)
                                }
                                placeholder="e.g. Extra egg available on request"
                                className="focus:ring-brand-lime/80 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                              />
                            </div>
                          </div>
                        </div>
                      </Card>

                      {/* Main Meal Card */}
                      <Card className="shadow-xs rounded-2xl border-neutral-200 bg-white p-5 transition-colors hover:border-neutral-300">
                        <div className="mb-4 flex items-center justify-between border-b border-neutral-100 pb-3">
                          <div className="flex items-center gap-2.5">
                            <span className="rounded-xl border border-emerald-100 bg-emerald-50 p-2 text-emerald-600">
                              <Utensils size={18} />
                            </span>
                            <div>
                              <h3 className="text-sm font-bold text-neutral-900">
                                Main Meal (Lunch / Dinner)
                              </h3>
                              <p className="text-xs text-neutral-400">Nutritious wholesome meal</p>
                            </div>
                          </div>
                          <Badge tone="green" className="text-[11px]">
                            Main Meal
                          </Badge>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <div className="mb-1.5 flex items-center justify-between">
                              <label className="text-xs font-semibold text-neutral-700">
                                Menu Items &amp; Foods{" "}
                                <span className="font-normal text-neutral-400">
                                  (max 1,000 chars)
                                </span>
                              </label>
                              <span className="font-mono text-[10px] text-neutral-400">
                                {(current.mainMealDescription ?? "").length}/1000
                              </span>
                            </div>
                            <textarea
                              rows={4}
                              maxLength={1000}
                              value={current.mainMealDescription ?? ""}
                              onChange={(e) =>
                                handleFieldChange(day.key, "mainMealDescription", e.target.value)
                              }
                              placeholder="e.g. Dal Bhat, Chicken Curry, Seasonal Saag, Tomato Achar"
                              className="focus:ring-brand-lime/80 focus:border-brand-black w-full resize-y rounded-xl border border-neutral-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2"
                            />
                          </div>

                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                              <div className="mb-1.5 flex items-center justify-between">
                                <label className="flex items-center gap-1 text-xs font-semibold text-neutral-700">
                                  <Clock size={12} className="text-neutral-500" /> Serving Time
                                </label>
                                <span className="font-mono text-[10px] text-neutral-400">
                                  {(current.mainMealTime ?? "").length}/50
                                </span>
                              </div>
                              <input
                                type="text"
                                maxLength={50}
                                value={current.mainMealTime ?? ""}
                                onChange={(e) =>
                                  handleFieldChange(day.key, "mainMealTime", e.target.value)
                                }
                                placeholder="e.g. 07:30 PM - 09:30 PM"
                                className="focus:ring-brand-lime/80 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                              />
                            </div>
                            <div>
                              <div className="mb-1.5 flex items-center justify-between">
                                <label className="flex items-center gap-1 text-xs font-semibold text-neutral-700">
                                  <Info size={12} className="text-neutral-500" /> Dietary / Meal
                                  Note
                                </label>
                                <span className="font-mono text-[10px] text-neutral-400">
                                  {(current.mainMealNotes ?? "").length}/500
                                </span>
                              </div>
                              <input
                                type="text"
                                maxLength={500}
                                value={current.mainMealNotes ?? ""}
                                onChange={(e) =>
                                  handleFieldChange(day.key, "mainMealNotes", e.target.value)
                                }
                                placeholder="e.g. Veg option: Paneer Curry"
                                className="focus:ring-brand-lime/80 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                              />
                            </div>
                          </div>
                        </div>
                      </Card>
                    </div>

                    {/* Bottom Save Bar */}
                    <div className="flex items-center justify-between border-t border-neutral-200 pt-4">
                      <p className="text-xs text-neutral-400">
                        Changes to any day are preserved when switching tabs. Click save when ready
                        to persist.
                      </p>
                      <Button
                        variant="primary"
                        onClick={handleSave}
                        loading={isSaving}
                        className="bg-brand-lime text-brand-black hover:bg-brand-lime/90 px-4 text-xs font-semibold"
                      >
                        <Save size={14} className="mr-1.5" /> Save Weekly Schedule
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Apply Template Modal */}
        <Modal
          open={templateModalOpen}
          onClose={() => setTemplateModalOpen(false)}
          title="Apply Nepali Standard Weekly Menu Template?"
        >
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">
              This will populate your 7-day schedule with the standard Nepali student hostel menu
              (Tea, Boiled Eggs, Bread, Dal Bhat, Chicken Curry, Paneer, Chana, Paratha, etc.).
            </p>
            <div className="space-y-1 rounded-xl border border-neutral-200 bg-neutral-100/70 p-3 text-xs text-neutral-600">
              <p className="font-semibold text-neutral-800">Preview of items:</p>
              <p>
                • <strong>Sunday:</strong> Milk Tea, Eggs, Bread &amp; Jam | Dal Bhat, Chicken
                Curry, Saag
              </p>
              <p>
                • <strong>Monday:</strong> Black Tea, Chiura, Chana | Rice, Mix Dal, Aloo Gobi
              </p>
              <p>
                • <strong>Saturday:</strong> Morning Tea, Puri Tarkari | Fried Rice / Khichdi, Papad
              </p>
            </div>
            <p className="text-xs text-neutral-500">
              Any unsaved changes on current tabs will be replaced. You can still edit any day
              before clicking Save.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setTemplateModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleApplyTemplate}
                className="bg-brand-black text-xs font-semibold text-white hover:bg-neutral-800"
              >
                Apply Standard Template
              </Button>
            </div>
          </div>
        </Modal>

        {/* Clear Confirmation Modal */}
        <Modal
          open={clearModalOpen}
          onClose={() => setClearModalOpen(false)}
          title="Reset Weekly Meal Schedule?"
        >
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">
              This will clear all breakfast and main meal entries for all seven days (Sunday through
              Saturday) via{" "}
              <code className="rounded bg-rose-50 px-1.5 py-0.5 font-mono text-xs text-rose-600">
                DELETE /hostels/:hostelId/meals
              </code>
              .
            </p>
            <p className="text-xs text-neutral-500">
              Your public profile will show meals as &quot;Not configured&quot; until you enter and
              save a new schedule.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setClearModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleClear}
                loading={isClearing}
                className="bg-rose-600 text-xs font-semibold text-white hover:bg-rose-700"
              >
                Yes, Reset All Meals
              </Button>
            </div>
          </div>
        </Modal>

        {/* Public Preview Modal */}
        <Modal
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          title="Public Listing Preview — Weekly Meals & Menu"
        >
          <div className="max-h-[75vh] space-y-4 overflow-y-auto pr-1">
            <p className="text-xs text-neutral-500">
              This is an exact preview of how prospective residents and parents view your meals
              section on{" "}
              <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-neutral-800">
                hostelghar.com/hostels/{activeHostelId || ":id"}
              </code>
            </p>

            <div className="space-y-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-neutral-900">
                    Weekly Meals &amp; Menu
                  </h3>
                  <p className="text-xs text-neutral-500">Freshly prepared, hygienic daily diet</p>
                </div>
                <span className="bg-brand-lime/30 text-brand-black rounded-full px-2.5 py-1 text-[11px] font-bold">
                  Nepali Week (Sun - Sat)
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {DAYS_OF_WEEK.map((day) => {
                  const m = scheduleState[day.key];
                  const hasBreakfast = Boolean(m.breakfastDescription?.trim());
                  const hasMain = Boolean(m.mainMealDescription?.trim());

                  if (!hasBreakfast && !hasMain) {
                    return (
                      <div
                        key={day.key}
                        className="rounded-xl border border-dashed border-neutral-200 bg-white p-3 text-center"
                      >
                        <p className="text-xs font-bold text-neutral-500">
                          {day.name} ({day.nepali})
                        </p>
                        <p className="mt-1 text-[11px] italic text-neutral-400">Not configured</p>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={day.key}
                      className="shadow-xs space-y-2.5 rounded-xl border border-neutral-200/80 bg-white p-3.5"
                    >
                      <div className="flex items-center justify-between border-b border-neutral-100 pb-1.5">
                        <span className="text-xs font-bold text-neutral-900">{day.name}</span>
                        <span className="text-[10px] text-neutral-400">{day.nepali}</span>
                      </div>

                      {hasBreakfast && (
                        <div className="text-xs">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-amber-700">
                            <span>Breakfast</span>
                            {m.breakfastTime && (
                              <span className="font-normal text-neutral-400">
                                {m.breakfastTime}
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-[11px] leading-relaxed text-neutral-700">
                            {m.breakfastDescription}
                          </p>
                          {m.breakfastNotes && (
                            <p className="mt-0.5 text-[10px] italic text-neutral-400">
                              Note: {m.breakfastNotes}
                            </p>
                          )}
                        </div>
                      )}

                      {hasMain && (
                        <div className="border-t border-neutral-100 pt-1.5 text-xs">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-700">
                            <span>Main Meal</span>
                            {m.mainMealTime && (
                              <span className="font-normal text-neutral-400">{m.mainMealTime}</span>
                            )}
                          </div>
                          <p className="mt-0.5 text-[11px] leading-relaxed text-neutral-700">
                            {m.mainMealDescription}
                          </p>
                          {m.mainMealNotes && (
                            <p className="mt-0.5 text-[10px] italic text-neutral-400">
                              Note: {m.mainMealNotes}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setPreviewOpen(false)}>
                Close Preview
              </Button>
            </div>
          </div>
        </Modal>
      </DashboardShell>
    </Protected>
  );
}
