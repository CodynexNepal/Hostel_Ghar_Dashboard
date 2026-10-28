"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Utensils,
  Clock,
  FileText,
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
} from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Protected } from "@/components/common/Protected";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/hooks/useToast";
import { useAuth } from "@/hooks/useAuth";
import { getHostelId } from "@/lib/axios";
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
  SUNDAY: { dayOfWeek: "SUNDAY", breakfastDescription: "", breakfastTime: "07:30 AM", breakfastNotes: "", mainMealDescription: "", mainMealTime: "07:30 PM", mainMealNotes: "" },
  MONDAY: { dayOfWeek: "MONDAY", breakfastDescription: "", breakfastTime: "07:30 AM", breakfastNotes: "", mainMealDescription: "", mainMealTime: "07:30 PM", mainMealNotes: "" },
  TUESDAY: { dayOfWeek: "TUESDAY", breakfastDescription: "", breakfastTime: "07:30 AM", breakfastNotes: "", mainMealDescription: "", mainMealTime: "07:30 PM", mainMealNotes: "" },
  WEDNESDAY: { dayOfWeek: "WEDNESDAY", breakfastDescription: "", breakfastTime: "07:30 AM", breakfastNotes: "", mainMealDescription: "", mainMealTime: "07:30 PM", mainMealNotes: "" },
  THURSDAY: { dayOfWeek: "THURSDAY", breakfastDescription: "", breakfastTime: "07:30 AM", breakfastNotes: "", mainMealDescription: "", mainMealTime: "07:30 PM", mainMealNotes: "" },
  FRIDAY: { dayOfWeek: "FRIDAY", breakfastDescription: "", breakfastTime: "07:30 AM", breakfastNotes: "", mainMealDescription: "", mainMealTime: "07:30 PM", mainMealNotes: "" },
  SATURDAY: { dayOfWeek: "SATURDAY", breakfastDescription: "", breakfastTime: "08:00 AM", breakfastNotes: "", mainMealDescription: "", mainMealTime: "07:30 PM", mainMealNotes: "" },
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

  // 2. Fetch meal schedule for active hostel
  const loadSchedule = useCallback(async (hid: string) => {
    setIsLoading(true);
    try {
      const res = await hostelGhar.meals.get(hid);
      const data = unwrap<WeeklyMealSchedule>(res.data);
      if (data && Array.isArray(data.schedule)) {
        const mapped = { ...DEFAULT_MEALS };
        data.schedule.forEach((item) => {
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
        setLastUpdatedAt(data.lastUpdatedAt ?? null);
        setHasSchedule(Boolean(data.hasSchedule));
      }
    } catch {
      toastError("Failed to load weekly meal schedule. Please refresh.");
    } finally {
      setIsLoading(false);
    }
  }, [toastError]);

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

  const handleFieldChange = (
    day: DayOfWeek,
    field: keyof MealDayItem,
    value: string
  ) => {
    setScheduleState((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value,
      },
    }));
  };

  const handleSave = async () => {
    if (!activeHostelId) {
      toastError("Hostel ID could not be identified.");
      return;
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
      if (data && Array.isArray(data.schedule)) {
        const mapped = { ...DEFAULT_MEALS };
        data.schedule.forEach((item) => {
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
        setLastUpdatedAt(data.lastUpdatedAt ?? new Date().toISOString());
        setHasSchedule(Boolean(data.hasSchedule));
      }
    } catch (err: unknown) {
      toastError("Failed to save meal schedule. Please check your network and try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    if (!activeHostelId) return;
    setIsClearing(true);
    try {
      await hostelGhar.meals.clear(activeHostelId);
      success("Weekly schedule cleared.");
      setScheduleState(DEFAULT_MEALS);
      setOriginalState(DEFAULT_MEALS);
      setHasSchedule(false);
      setLastUpdatedAt(null);
      setClearModalOpen(false);
    } catch {
      toastError("Failed to clear schedule. Try again.");
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <Protected permission="VIEW_HOSTEL">
      <DashboardShell
        title="Meals & Weekly Menu"
        subtitle="Configure daily breakfast and main meal schedules for your hostel."
      >
        <div className="space-y-6 max-w-6xl mx-auto pb-16">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200/80 pb-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="p-2 rounded-xl bg-brand-lime/20 text-brand-black">
                  <Utensils size={20} className="text-brand-black" />
                </span>
                <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
                  Meals & Weekly Menu
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
              <p className="text-sm text-neutral-500 max-w-2xl">
                Configure breakfast and main meal items for every day of the week (Sunday through Saturday).
                Prospective residents and students can view this menu on your public hostel profile.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewOpen(true)}
                disabled={isLoading}
              >
                <Eye size={15} className="mr-1.5" /> Public Preview
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setClearModalOpen(true)}
                disabled={isLoading || !hasSchedule}
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
              >
                <RotateCcw size={14} className="mr-1.5" /> Clear All
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSave}
                loading={isSaving}
                disabled={isLoading}
                className="bg-brand-lime text-brand-black hover:bg-brand-lime/90 font-semibold"
              >
                <Save size={15} className="mr-1.5" /> Save Weekly Schedule
              </Button>
            </div>
          </div>

          {/* Unsaved changes alert */}
          {hasUnsavedChanges && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-sm flex items-center justify-between gap-3 shadow-sm animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-amber-600 shrink-0" />
                <span className="font-medium">
                  You have unsaved changes in your weekly menu. Remember to click &quot;Save Weekly Schedule&quot; before leaving.
                </span>
              </div>
              <Button
                size="sm"
                onClick={handleSave}
                loading={isSaving}
                className="bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs px-3 py-1"
              >
                Save Now
              </Button>
            </div>
          )}

          {/* Last updated and info bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200/60 text-xs text-neutral-600">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-neutral-500" />
              <span>
                Standard Nepal Week: <strong>Sunday through Saturday</strong>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Skeleton className="h-64 rounded-2xl" />
                <Skeleton className="h-64 rounded-2xl" />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Day Selector Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none border-b border-neutral-200/70">
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
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0 ${
                        isActive
                          ? "bg-brand-black text-white shadow-sm"
                          : "bg-white text-neutral-600 hover:bg-neutral-100/80 border border-neutral-200/70"
                      }`}
                    >
                      <span>{day.name}</span>
                      <span className="text-xs opacity-75 font-normal">({day.nepali})</span>
                      {hasData && (
                        <span
                          className={`w-2 h-2 rounded-full ${
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
                  <div key={day.key} className="space-y-6 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between bg-neutral-100/60 p-4 rounded-2xl border border-neutral-200/70">
                      <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-xl bg-brand-black text-brand-lime font-bold flex items-center justify-center text-sm shadow-sm">
                          {day.badge}
                        </span>
                        <div>
                          <h2 className="text-lg font-bold text-neutral-900">
                            {day.name} / {day.nepali}
                          </h2>
                          <p className="text-xs text-neutral-500">
                            Enter meal items separated by commas or line breaks.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const currentIndex = DAYS_OF_WEEK.findIndex((d) => d.key === day.key);
                            const nextIndex = (currentIndex + 1) % DAYS_OF_WEEK.length;
                            setActiveTab(DAYS_OF_WEEK[nextIndex].key);
                          }}
                          className="text-xs text-neutral-600"
                        >
                          Next Day <ChevronRight size={14} className="ml-1" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Breakfast Card */}
                      <Card className="p-5 border-neutral-200 shadow-sm rounded-2xl bg-white hover:border-neutral-300 transition-colors">
                        <div className="flex items-center justify-between mb-4 border-b border-neutral-100 pb-3">
                          <div className="flex items-center gap-2.5">
                            <span className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
                              <Coffee size={18} />
                            </span>
                            <div>
                              <h3 className="font-bold text-neutral-900 text-sm">Breakfast Menu</h3>
                              <p className="text-xs text-neutral-400">Morning serving</p>
                            </div>
                          </div>
                          <Badge tone="amber" className="text-[11px]">Breakfast</Badge>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                              Menu Items & Foods <span className="text-neutral-400 font-normal">(e.g. Milk tea, boiled eggs, bread, butter)</span>
                            </label>
                            <textarea
                              rows={4}
                              value={current.breakfastDescription ?? ""}
                              onChange={(e) => handleFieldChange(day.key, "breakfastDescription", e.target.value)}
                              placeholder="e.g. Milk tea, 2 boiled eggs, bread with jam, chiura..."
                              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-lime/80 focus:border-brand-black resize-y"
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-neutral-700 mb-1.5 flex items-center gap-1">
                                <Clock size={12} className="text-neutral-500" /> Serving Time
                              </label>
                              <input
                                type="text"
                                value={current.breakfastTime ?? ""}
                                onChange={(e) => handleFieldChange(day.key, "breakfastTime", e.target.value)}
                                placeholder="e.g. 7:30 AM - 9:00 AM"
                                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-lime/80"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-neutral-700 mb-1.5 flex items-center gap-1">
                                <Info size={12} className="text-neutral-500" /> Dietary Note
                              </label>
                              <input
                                type="text"
                                value={current.breakfastNotes ?? ""}
                                onChange={(e) => handleFieldChange(day.key, "breakfastNotes", e.target.value)}
                                placeholder="e.g. Vegetarian: banana / milk"
                                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-lime/80"
                              />
                            </div>
                          </div>
                        </div>
                      </Card>

                      {/* Main Meal Card */}
                      <Card className="p-5 border-neutral-200 shadow-sm rounded-2xl bg-white hover:border-neutral-300 transition-colors">
                        <div className="flex items-center justify-between mb-4 border-b border-neutral-100 pb-3">
                          <div className="flex items-center gap-2.5">
                            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                              <Utensils size={18} />
                            </span>
                            <div>
                              <h3 className="font-bold text-neutral-900 text-sm">Main Meal (Lunch / Dinner)</h3>
                              <p className="text-xs text-neutral-400">Nutritious wholesome meal</p>
                            </div>
                          </div>
                          <Badge tone="green" className="text-[11px]">Main Meal</Badge>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                              Menu Items & Foods <span className="text-neutral-400 font-normal">(e.g. Dal bhat, tarkari, chicken curry, salad)</span>
                            </label>
                            <textarea
                              rows={4}
                              value={current.mainMealDescription ?? ""}
                              onChange={(e) => handleFieldChange(day.key, "mainMealDescription", e.target.value)}
                              placeholder="e.g. Rice, yellow dal, seasonal green vegetables, chicken curry / paneer..."
                              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-lime/80 focus:border-brand-black resize-y"
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-neutral-700 mb-1.5 flex items-center gap-1">
                                <Clock size={12} className="text-neutral-500" /> Serving Time
                              </label>
                              <input
                                type="text"
                                value={current.mainMealTime ?? ""}
                                onChange={(e) => handleFieldChange(day.key, "mainMealTime", e.target.value)}
                                placeholder="e.g. 7:00 PM - 9:00 PM"
                                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-lime/80"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-neutral-700 mb-1.5 flex items-center gap-1">
                                <Info size={12} className="text-neutral-500" /> Meal Note
                              </label>
                              <input
                                type="text"
                                value={current.mainMealNotes ?? ""}
                                onChange={(e) => handleFieldChange(day.key, "mainMealNotes", e.target.value)}
                                placeholder="e.g. Non-veg twice a week; salad every meal"
                                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-lime/80"
                              />
                            </div>
                          </div>
                        </div>
                      </Card>
                    </div>

                    {/* Bottom Save Bar */}
                    <div className="flex items-center justify-between pt-4 border-t border-neutral-200">
                      <p className="text-xs text-neutral-400">
                        Changes to any day are preserved when switching tabs. Click save when ready.
                      </p>
                      <Button
                        variant="primary"
                        onClick={handleSave}
                        loading={isSaving}
                        className="bg-brand-lime text-brand-black hover:bg-brand-lime/90 font-semibold"
                      >
                        <Save size={15} className="mr-1.5" /> Save All Days
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Clear Confirmation Modal */}
        <Modal
          open={clearModalOpen}
          onClose={() => setClearModalOpen(false)}
          title="Clear Weekly Meal Schedule?"
        >
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">
              This will remove all breakfast and main meal entries for all seven days from your public listing.
              You will need to re-enter them if you want to publish meals again.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setClearModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleClear}
                loading={isClearing}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                Yes, Clear Everything
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
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            <p className="text-xs text-neutral-500">
              This is an exact preview of how prospective residents and parents view your meals section on{" "}
              <code className="text-neutral-800 bg-neutral-100 px-1.5 py-0.5 rounded font-mono">
                hostelghar.com/hostel/:id
              </code>
            </p>

            <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-neutral-900 text-base">Weekly Meals & Menu</h3>
                  <p className="text-xs text-neutral-500">Freshly prepared, hygienic daily diet</p>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-brand-lime/30 text-brand-black">
                  7-Day Schedule
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {DAYS_OF_WEEK.map((day) => {
                  const m = scheduleState[day.key];
                  const hasBreakfast = Boolean(m.breakfastDescription?.trim());
                  const hasMain = Boolean(m.mainMealDescription?.trim());

                  if (!hasBreakfast && !hasMain) {
                    return (
                      <div
                        key={day.key}
                        className="p-3 rounded-xl bg-white border border-dashed border-neutral-200 text-center"
                      >
                        <p className="text-xs font-bold text-neutral-500">{day.name}</p>
                        <p className="text-[11px] text-neutral-400 italic mt-1">Not configured</p>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={day.key}
                      className="p-3.5 rounded-xl bg-white border border-neutral-200/80 space-y-2.5 shadow-xs"
                    >
                      <div className="flex items-center justify-between border-b border-neutral-100 pb-1.5">
                        <span className="font-bold text-xs text-neutral-900">{day.name}</span>
                        <span className="text-[10px] text-neutral-400">{day.nepali}</span>
                      </div>

                      {hasBreakfast && (
                        <div className="text-xs">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-amber-700">
                            <span>Breakfast</span>
                            {m.breakfastTime && <span className="font-normal text-neutral-400">{m.breakfastTime}</span>}
                          </div>
                          <p className="text-neutral-700 text-[11px] mt-0.5 leading-relaxed">{m.breakfastDescription}</p>
                          {m.breakfastNotes && <p className="text-[10px] text-neutral-400 italic mt-0.5">Note: {m.breakfastNotes}</p>}
                        </div>
                      )}

                      {hasMain && (
                        <div className="text-xs border-t border-neutral-100 pt-1.5">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-700">
                            <span>Main Meal</span>
                            {m.mainMealTime && <span className="font-normal text-neutral-400">{m.mainMealTime}</span>}
                          </div>
                          <p className="text-neutral-700 text-[11px] mt-0.5 leading-relaxed">{m.mainMealDescription}</p>
                          {m.mainMealNotes && <p className="text-[10px] text-neutral-400 italic mt-0.5">Note: {m.mainMealNotes}</p>}
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
