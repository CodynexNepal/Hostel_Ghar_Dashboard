"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Utensils,
  Clock,
  Plus,
  Edit2,
  Trash2,
  Save,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Eye,
  Calendar,
  Copy,
  Sparkles,
  Check,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Protected } from "@/components/common/Protected";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { useToast } from "@/hooks/useToast";
import { useAuth } from "@/hooks/useAuth";
import { getHostelId, toApiError } from "@/lib/axios";
import { hostelGhar, normalizeOwnerDashboard, unwrap, validHostelId } from "@/lib/hostelGhar";
import type { DailyMealItem, DailyMealSchedule } from "@/lib/api-types";

const DAYS_OF_WEEK = [
  { key: "ALL", labelNp: "सबै दिन", labelEn: "All Days (General)", shortNp: "सबै", shortEn: "All" },
  { key: "SUNDAY", labelNp: "आइतबार", labelEn: "Sunday", shortNp: "आइत", shortEn: "Sun" },
  { key: "MONDAY", labelNp: "सोमबार", labelEn: "Monday", shortNp: "सोम", shortEn: "Mon" },
  { key: "TUESDAY", labelNp: "मंगलबार", labelEn: "Tuesday", shortNp: "मंगल", shortEn: "Tue" },
  { key: "WEDNESDAY", labelNp: "बुधबार", labelEn: "Wednesday", shortNp: "बुध", shortEn: "Wed" },
  { key: "THURSDAY", labelNp: "बिहीबार", labelEn: "Thursday", shortNp: "बिही", shortEn: "Thu" },
  { key: "FRIDAY", labelNp: "शुक्रबार", labelEn: "Friday", shortNp: "शुक्र", shortEn: "Fri" },
  { key: "SATURDAY", labelNp: "शनिबार", labelEn: "Saturday", shortNp: "शनि", shortEn: "Sat" },
] as const;

type DayKey = (typeof DAYS_OF_WEEK)[number]["key"];

const DEFAULT_MEAL_SLOTS: DailyMealItem[] = [
  {
    mealName: "बिहानको नास्ता",
    mealNameEn: "Morning Breakfast",
    time: "7:00 AM–8:00 AM",
    menuDescription: "चिया, पाउरोटी, अण्डा वा बिस्कुट (Milk Tea, Bread, Boiled Eggs / Biscuits)",
    isActive: true,
    orderIndex: 1,
  },
  {
    mealName: "बिहानको खाजा",
    mealNameEn: "Morning Khaja",
    time: "10:00 AM–11:00 AM",
    menuDescription: "चना, चिउरा वा हलुवा पुरी (Fried Grams, Beaten Rice / Puri)",
    isActive: true,
    orderIndex: 2,
  },
  {
    mealName: "दिउँसोको खाना",
    mealNameEn: "Lunch / Khana",
    time: "12:00 PM–1:00 PM",
    menuDescription: "दाल, भात, तरकारी, अचार, सलाद (Rice, Lentils, Seasonal Curry, Pickle)",
    isActive: true,
    orderIndex: 3,
  },
  {
    mealName: "दिउँसोको खाजा",
    mealNameEn: "Afternoon Khaja",
    time: "2:00 PM–3:00 PM",
    menuDescription: "चाउमिन, समोसा वा चिया बिस्कुट (Chowmein, Samosa / Tea)",
    isActive: true,
    orderIndex: 4,
  },
  {
    mealName: "बेलुकाको खाना",
    mealNameEn: "Dinner / Khana",
    time: "7:00 PM–8:00 PM",
    menuDescription: "भात, दाल, तरकारी / चिकन करी वा पनीर (Rice, Lentils, Veg / Chicken / Paneer)",
    isActive: true,
    orderIndex: 5,
  },
];

export default function DailyMealsPage() {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();

  const [activeHostelId, setActiveHostelId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<DayKey>("ALL");
  const [configuredDays, setConfiguredDays] = useState<string[]>([]);
  const [allDaysFallbackMeals, setAllDaysFallbackMeals] =
    useState<DailyMealItem[]>(DEFAULT_MEAL_SLOTS);

  const [meals, setMeals] = useState<DailyMealItem[]>([]);
  const [originalMeals, setOriginalMeals] = useState<DailyMealItem[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modal States
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState<DailyMealItem | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [targetDaysToCopy, setTargetDaysToCopy] = useState<string[]>([]);

  // Form State for Add / Edit
  const [formMealName, setFormMealName] = useState("");
  const [formMealNameEn, setFormMealNameEn] = useState("");
  const [formTime, setFormTime] = useState("");
  const [formMenuDescription, setFormMenuDescription] = useState("");
  const [formDayOfWeek, setFormDayOfWeek] = useState<DayKey>("ALL");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  // 1. Resolve Hostel ID
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

  // 2. Fetch Daily Meal Schedule for activeHostelId & day
  const loadSchedule = useCallback(async (hid: string, day: DayKey = "ALL") => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await hostelGhar.meals.getDaily(hid, day);
      const data = unwrap<DailyMealSchedule>(res.data);
      if (data && Array.isArray(data.schedule) && data.schedule.length > 0) {
        const loaded = data.schedule.map((item, idx) => ({
          id: item.id,
          dayOfWeek: item.dayOfWeek ?? day,
          mealName: item.mealName,
          mealNameEn: item.mealNameEn ?? null,
          time: item.time,
          menuDescription: item.menuDescription ?? "",
          isActive: item.isActive !== false,
          orderIndex: item.orderIndex ?? idx + 1,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        }));
        setMeals(loaded);
        setOriginalMeals(loaded);
        if (day === "ALL") {
          setAllDaysFallbackMeals(loaded);
        }
        setIsConfigured(Boolean(data.isConfigured));
        setLastUpdatedAt(data.lastUpdatedAt ?? null);
        if (data.configuredDays) {
          setConfiguredDays(data.configuredDays);
        }
      } else {
        const fallback = DEFAULT_MEAL_SLOTS.map((slot) => ({ ...slot, dayOfWeek: day }));
        setMeals(fallback);
        setOriginalMeals(fallback);
        setIsConfigured(false);
        setLastUpdatedAt(null);
      }
    } catch (err: unknown) {
      const apiErr = toApiError(err);
      if (apiErr.status === 404 || apiErr.message?.includes("not found")) {
        const fallback = DEFAULT_MEAL_SLOTS.map((slot) => ({ ...slot, dayOfWeek: day }));
        setMeals(fallback);
        setOriginalMeals(fallback);
        setIsConfigured(false);
      } else {
        setLoadError(apiErr.message || "Failed to load meal schedule. Please refresh.");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeHostelId) {
      loadSchedule(activeHostelId, selectedDay);
    }
  }, [activeHostelId, loadSchedule, selectedDay]);

  // Handle switching Day Tab
  const handleSelectDay = (dayKey: DayKey) => {
    setSelectedDay(dayKey);
  };

  // Check if current day has custom meals saved
  const isCurrentDayCustomized = useMemo(() => {
    if (selectedDay === "ALL") return configuredDays.includes("ALL");
    return configuredDays.includes(selectedDay);
  }, [configuredDays, selectedDay]);

  // Check for unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (meals.length !== originalMeals.length) return true;
    return meals.some((meal, idx) => {
      const orig = originalMeals[idx];
      if (!orig) return true;
      return (
        meal.mealName !== orig.mealName ||
        meal.mealNameEn !== orig.mealNameEn ||
        meal.time !== orig.time ||
        meal.menuDescription !== orig.menuDescription ||
        meal.isActive !== orig.isActive ||
        meal.orderIndex !== orig.orderIndex
      );
    });
  }, [meals, originalMeals]);

  // Open Add Meal Modal
  const handleOpenAddModal = () => {
    setEditingMeal(null);
    setEditingIndex(null);
    setFormMealName("");
    setFormMealNameEn("");
    setFormTime("");
    setFormMenuDescription("");
    setFormDayOfWeek(selectedDay);
    setFormIsActive(true);
    setFormError(null);
    setEditModalOpen(true);
  };

  // Open Edit Meal Modal
  const handleOpenEditModal = (meal: DailyMealItem, index: number) => {
    setEditingMeal(meal);
    setEditingIndex(index);
    setFormMealName(meal.mealName);
    setFormMealNameEn(meal.mealNameEn ?? "");
    setFormTime(meal.time);
    setFormMenuDescription(meal.menuDescription ?? "");
    setFormDayOfWeek((meal.dayOfWeek as DayKey) ?? selectedDay);
    setFormIsActive(meal.isActive);
    setFormError(null);
    setEditModalOpen(true);
  };

  // Save Modal Form (Add or Edit)
  const handleSaveModalForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formMealName.trim()) {
      setFormError("खानाको प्रकार (Meal Name in Nepali) is required.");
      return;
    }
    if (!formTime.trim()) {
      setFormError("समय (Serving Time) is required.");
      return;
    }

    if (editingIndex !== null && editingMeal) {
      // Edit existing slot
      const next = [...meals];
      next[editingIndex] = {
        ...next[editingIndex],
        mealName: formMealName.trim(),
        mealNameEn: formMealNameEn.trim() || null,
        time: formTime.trim(),
        menuDescription: formMenuDescription.trim() || null,
        dayOfWeek: formDayOfWeek,
        isActive: formIsActive,
      };
      setMeals(next);
      success(`"${formMealName.trim()}" updated. Click "Save Schedule" to commit.`);
    } else {
      // Add new slot
      const newMeal: DailyMealItem = {
        mealName: formMealName.trim(),
        mealNameEn: formMealNameEn.trim() || null,
        time: formTime.trim(),
        menuDescription: formMenuDescription.trim() || null,
        dayOfWeek: formDayOfWeek,
        isActive: formIsActive,
        orderIndex: meals.length + 1,
      };
      setMeals([...meals, newMeal]);
      success(`"${formMealName.trim()}" added. Click "Save Schedule" to commit.`);
    }

    setEditModalOpen(false);
  };

  // Toggle active status inline
  const handleToggleActive = (index: number) => {
    const next = [...meals];
    next[index] = { ...next[index], isActive: !next[index].isActive };
    setMeals(next);
  };

  // Delete Action
  const handleConfirmDelete = () => {
    if (deletingIndex === null || deletingIndex < 0 || deletingIndex >= meals.length) return;
    const removedMeal = meals[deletingIndex];
    const next = meals
      .filter((_, idx) => idx !== deletingIndex)
      .map((m, idx) => ({
        ...m,
        orderIndex: idx + 1,
      }));
    setMeals(next);
    setDeleteModalOpen(false);
    setDeletingIndex(null);
    success(`"${removedMeal.mealName}" removed. Remember to click Save Schedule.`);
  };

  // Copy template from "All Days" to current selected day
  const handleCopyFromAllDays = () => {
    const base = allDaysFallbackMeals.length > 0 ? allDaysFallbackMeals : DEFAULT_MEAL_SLOTS;
    const copied = base.map((slot, idx) => ({
      ...slot,
      id: undefined,
      dayOfWeek: selectedDay,
      orderIndex: idx + 1,
    }));
    setMeals(copied);
    success(
      `Copied standard meal slots to ${currentDayInfo?.labelNp} (${currentDayInfo?.labelEn}). Customize items and click "Save Schedule".`
    );
  };

  // Open Copy-To-Other-Days Modal
  const handleOpenCopyModal = () => {
    const others = DAYS_OF_WEEK.filter((d) => d.key !== selectedDay).map((d) => d.key);
    setTargetDaysToCopy([]);
    setCopyModalOpen(true);
  };

  // Confirm Copy-To-Other-Days
  const handleConfirmCopyToOtherDays = async () => {
    if (!activeHostelId) return;
    if (targetDaysToCopy.length === 0) {
      toastError("Please select at least one day to copy the schedule to.");
      return;
    }

    setIsSaving(true);
    try {
      for (const day of targetDaysToCopy) {
        const payload: DailyMealItem[] = meals.map((m, idx) => ({
          mealName: m.mealName.trim(),
          mealNameEn: m.mealNameEn?.trim() || null,
          time: m.time.trim(),
          menuDescription: m.menuDescription?.trim() || null,
          isActive: m.isActive,
          orderIndex: idx + 1,
          dayOfWeek: day,
        }));
        await hostelGhar.meals.saveDaily(activeHostelId, payload, day);
      }

      success(`Successfully copied schedule to ${targetDaysToCopy.length} day(s)!`);
      setCopyModalOpen(false);
      // Reload current schedule
      await loadSchedule(activeHostelId, selectedDay);
    } catch (err: unknown) {
      const apiErr = toApiError(err);
      toastError(apiErr.message || "Failed to copy schedule to selected days.");
    } finally {
      setIsSaving(false);
    }
  };

  // Persist Current Daily/Weekly Meals (PUT /hostels/:hostelId/meals/daily)
  const handleSaveAll = async () => {
    if (!activeHostelId) {
      toastError("Hostel ID could not be identified.");
      return;
    }

    if (meals.length === 0) {
      toastError("At least one meal slot must be configured.");
      return;
    }

    setIsSaving(true);
    try {
      const payload: DailyMealItem[] = meals.map((m, idx) => ({
        id: m.id,
        mealName: m.mealName.trim(),
        mealNameEn: m.mealNameEn?.trim() || null,
        time: m.time.trim(),
        menuDescription: m.menuDescription?.trim() || null,
        isActive: m.isActive,
        orderIndex: idx + 1,
        dayOfWeek: selectedDay,
      }));

      const res = await hostelGhar.meals.saveDaily(activeHostelId, payload, selectedDay);
      const data = unwrap<DailyMealSchedule>(res.data);
      success(
        `${currentDayInfo?.labelNp} (${currentDayInfo?.labelEn}) meal schedule saved successfully.`
      );

      if (data && Array.isArray(data.schedule) && data.schedule.length > 0) {
        setMeals(data.schedule);
        setOriginalMeals(data.schedule);
        setIsConfigured(true);
        setLastUpdatedAt(data.lastUpdatedAt ?? new Date().toISOString());
        if (data.configuredDays) {
          setConfiguredDays(data.configuredDays);
        }
      } else {
        setOriginalMeals(meals);
        setIsConfigured(true);
        setLastUpdatedAt(new Date().toISOString());
      }
    } catch (err: unknown) {
      const apiErr = toApiError(err);
      toastError(apiErr.message || "Failed to save meal schedule. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Reset Meals for Current Day or All
  const handleResetSchedule = async () => {
    if (!activeHostelId) return;
    setIsSaving(true);
    try {
      await hostelGhar.meals.clearDaily(activeHostelId, selectedDay);
      const fallback = DEFAULT_MEAL_SLOTS.map((s) => ({ ...s, dayOfWeek: selectedDay }));
      setMeals(fallback);
      setOriginalMeals(fallback);
      setIsConfigured(false);
      setLastUpdatedAt(null);
      setClearModalOpen(false);
      success(`${currentDayInfo?.labelNp} meal schedule reset to default values.`);
      await loadSchedule(activeHostelId, selectedDay);
    } catch (err: unknown) {
      const apiErr = toApiError(err);
      toastError(apiErr.message || "Failed to reset meal schedule.");
    } finally {
      setIsSaving(false);
    }
  };

  const currentDayInfo = DAYS_OF_WEEK.find((d) => d.key === selectedDay);

  return (
    <Protected permission="VIEW_HOSTEL">
      <DashboardShell
        title="दैनिक भोजन तालिका"
        subtitle="होस्टेलको दैनिक खानाको तालिका, समय, हप्ताका दिनहरू (आइतबारदेखि शनिबार) र मेनु व्यवस्थापन गर्नुहोस्।"
      >
        <div className="mx-auto max-w-6xl space-y-6 pb-16">
          {/* Header Bar */}
          <div className="flex flex-col justify-between gap-4 border-b border-neutral-200/80 pb-5 sm:flex-row sm:items-center">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <span className="bg-brand-lime/20 text-brand-black rounded-xl p-2">
                  <Utensils size={20} className="text-brand-black" />
                </span>
                <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
                  दैनिक भोजन तालिका
                </h1>
                <span className="text-sm font-semibold text-neutral-500">
                  (Daily &amp; Weekly Meal Schedule)
                </span>
                {isConfigured ? (
                  <Badge tone="green" className="ml-2">
                    <CheckCircle2 size={12} className="mr-1" /> सक्रिय (Active)
                  </Badge>
                ) : (
                  <Badge tone="gray" className="ml-2">
                    पूर्वनिर्धारित (Defaults)
                  </Badge>
                )}
              </div>
              <p className="max-w-2xl text-sm text-neutral-500">
                Manage daily meal slots, serving timings, weekly menus (Sunday to Saturday), and
                availability for your hostel residents.
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewOpen(true)}
                disabled={isLoading}
                className="text-xs"
              >
                <Eye size={14} className="mr-1" /> पूर्वावलोकन (Preview)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenCopyModal}
                disabled={isLoading || meals.length === 0}
                className="text-brand-black text-xs hover:bg-neutral-100"
                title="Copy current day's menu to other days of the week"
              >
                <Copy size={13} className="mr-1 text-neutral-600" /> अन्य बारमा प्रतिलिपि (Copy to
                Days)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setClearModalOpen(true)}
                disabled={isLoading}
                className="border-rose-200 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700"
              >
                <RotateCcw size={13} className="mr-1" /> रिसेट (Reset)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenAddModal}
                disabled={isLoading}
                className="bg-brand-lime/10 border-brand-lime/40 text-brand-black hover:bg-brand-lime/20 text-xs font-semibold"
              >
                <Plus size={14} className="mr-1" /> थप गर्नुहोस् (Add Meal)
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveAll}
                loading={isSaving}
                disabled={isLoading}
                className="bg-brand-lime text-brand-black hover:bg-brand-lime/90 shadow-xs px-3.5 text-xs font-semibold"
              >
                <Save size={14} className="mr-1.5" /> तालिका सुरक्षित गर्नुहोस् (Save Schedule)
              </Button>
            </div>
          </div>

          {/* WEEKLY DAY SELECTOR BAR */}
          <div className="shadow-xs rounded-2xl border border-neutral-200/90 bg-white p-4">
            <div className="mb-3 flex flex-col justify-between gap-2 border-b border-neutral-100 pb-3 sm:flex-row sm:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <Calendar size={18} className="text-neutral-700" />
                  <span className="text-sm font-bold text-neutral-900">
                    हप्ताको बार छनोट गर्नुहोस् (Select Day of Week)
                  </span>
                </div>
                <p className="text-xs text-neutral-500">
                  हप्ताको प्रत्येक दिन (आइतबार, सोमबार...) को लागि छुट्टाछुट्टै मेनु वा सबै दिनको
                  लागि सामान्य तालिका व्यवस्थापन गर्नुहोस्।
                </p>
              </div>

              {selectedDay !== "ALL" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyFromAllDays}
                  className="bg-neutral-50 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
                >
                  <Sparkles size={13} className="mr-1.5 text-amber-500" />
                  सबै दिनको तालिकाबाट प्रतिलिपि (Copy from All Days)
                </Button>
              )}
            </div>

            {/* Day of Week Selector Pills */}
            <div className="scrollbar-thin flex items-center gap-2 overflow-x-auto pb-1">
              {DAYS_OF_WEEK.map((d) => {
                const isSelected = selectedDay === d.key;
                const isConfiguredDay = configuredDays.includes(d.key);
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => handleSelectDay(d.key)}
                    className={`group relative flex shrink-0 cursor-pointer flex-col items-center rounded-xl px-3.5 py-2 text-xs font-medium transition-all ${
                      isSelected
                        ? "bg-neutral-900 text-white shadow-md ring-2 ring-neutral-900/10"
                        : "bg-neutral-100/80 text-neutral-700 hover:bg-neutral-200/80 hover:text-neutral-900"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold">{d.labelNp}</span>
                      {isConfiguredDay && (
                        <span
                          className={`h-2 w-2 rounded-full ${
                            isSelected ? "bg-brand-lime" : "bg-emerald-500"
                          }`}
                          title="कन्फिगर गरिएको मेनु (Custom Menu Configured)"
                        />
                      )}
                    </div>
                    <span
                      className={`text-[10px] ${
                        isSelected ? "text-neutral-300" : "text-neutral-500"
                      }`}
                    >
                      {d.labelEn}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Current Day Status Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200/80 bg-neutral-50/90 px-4 py-2.5 text-xs text-neutral-700">
            <div className="flex items-center gap-2">
              <span className="font-bold text-neutral-900">
                वर्तमान दृश्य: {currentDayInfo?.labelNp} ({currentDayInfo?.labelEn})
              </span>
              {isCurrentDayCustomized ? (
                <Badge tone="green" className="text-[11px]">
                  विशेष मेनु कन्फिगर गरिएको (Customized)
                </Badge>
              ) : selectedDay !== "ALL" ? (
                <Badge tone="amber" className="text-[11px]">
                  सामान्य तालिका लागु छ (Inherited from All Days)
                </Badge>
              ) : null}
            </div>
            {lastUpdatedAt && (
              <span className="text-neutral-500">
                अन्तिम पटक अद्यावधिक:{" "}
                <strong className="text-neutral-700">
                  {new Date(lastUpdatedAt).toLocaleString("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </strong>
              </span>
            )}
          </div>

          {/* Unsaved changes banner */}
          {hasUnsavedChanges && (
            <div className="shadow-xs animate-in fade-in flex items-center justify-between gap-3 rounded-xl border border-amber-200/80 bg-amber-50 p-3.5 text-sm text-amber-900 duration-200">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0 text-amber-600" />
                <span className="text-xs font-medium sm:text-sm">
                  तपाईंले तालिकामा परिवर्तन गर्नुभएको छ। डाटाबेस र मोबाइलमा लागु गर्न &quot;तालिका
                  सुरक्षित गर्नुहोस्&quot; मा क्लिक गर्नुहोस्।
                </span>
              </div>
              <Button
                size="sm"
                onClick={handleSaveAll}
                loading={isSaving}
                className="shrink-0 bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700"
              >
                अहिले सुरक्षित गर्नुहोस् (Save Now)
              </Button>
            </div>
          )}

          {/* Main Content Area */}
          {isLoading ? (
            <TableSkeleton rows={5} />
          ) : loadError ? (
            <ErrorState
              title="Failed to load meal schedule"
              description={loadError}
              onRetry={() => activeHostelId && loadSchedule(activeHostelId, selectedDay)}
            />
          ) : meals.length === 0 ? (
            <EmptyState
              title="यस बारको लागि कुनै मेनु फेला परेन"
              description="नयाँ खानाको प्रकार र समय तालिका थप्न वा सबै दिनको तालिका प्रतिलिपि गर्न तलको बटन प्रयोग गर्नुहोस्।"
              action={
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleCopyFromAllDays}>
                    सबै दिनको मेनु प्रतिलिपि
                  </Button>
                  <Button onClick={handleOpenAddModal}>थप गर्नुहोस् (Add Meal)</Button>
                </div>
              }
            />
          ) : (
            <Card className="shadow-xs overflow-hidden border border-neutral-200/80 bg-white">
              {/* Desktop / Tablet Redesigned Meal Table */}
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full text-left text-sm text-neutral-700">
                  <thead className="border-b border-neutral-200 bg-neutral-50/80 text-xs font-semibold text-neutral-800">
                    <tr>
                      <th scope="col" className="w-16 px-4 py-3.5 text-center font-bold">
                        क्र.सं. (S.N.)
                      </th>
                      <th scope="col" className="px-5 py-3.5 font-bold">
                        खानाको प्रकार (Meal Slot)
                      </th>
                      <th scope="col" className="w-48 px-4 py-3.5 font-bold">
                        समय (Serving Time)
                      </th>
                      <th scope="col" className="px-5 py-3.5 font-bold">
                        मेनु / परिकार विवरण (Menu Items)
                      </th>
                      <th scope="col" className="w-28 px-4 py-3.5 text-center font-bold">
                        अवस्था (Status)
                      </th>
                      <th scope="col" className="w-32 px-4 py-3.5 text-right font-bold">
                        कार्य (Actions)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200/70">
                    {meals.map((meal, index) => (
                      <tr
                        key={meal.id ?? `meal-${index}`}
                        className={`transition-colors hover:bg-neutral-50/70 ${
                          !meal.isActive ? "bg-neutral-50/40 opacity-75" : ""
                        }`}
                      >
                        {/* 1. S.N. */}
                        <td className="px-4 py-4 text-center font-mono text-xs font-bold text-neutral-500">
                          {index + 1}
                        </td>

                        {/* 2. Meal Slot */}
                        <td className="px-5 py-4">
                          <div className="font-semibold text-neutral-900">{meal.mealName}</div>
                          {meal.mealNameEn && (
                            <div className="text-xs text-neutral-500">{meal.mealNameEn}</div>
                          )}
                        </td>

                        {/* 3. Serving Time */}
                        <td className="px-4 py-4">
                          <div className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200/70 bg-neutral-100/70 px-2.5 py-1 text-xs font-medium text-neutral-800">
                            <Clock size={12} className="shrink-0 text-neutral-500" />
                            <span>{meal.time}</span>
                          </div>
                        </td>

                        {/* 4. Menu Items */}
                        <td className="px-5 py-4">
                          {meal.menuDescription ? (
                            <p className="line-clamp-2 text-xs leading-relaxed text-neutral-700">
                              {meal.menuDescription}
                            </p>
                          ) : (
                            <span className="text-xs italic text-neutral-400">
                              कुनै मेनु विवरण राखिएको छैन (No menu items)
                            </span>
                          )}
                        </td>

                        {/* 5. Status */}
                        <td className="px-4 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleActive(index)}
                            className="cursor-pointer transition-transform hover:scale-105"
                            title="अवस्था परिवर्तन गर्न क्लिक गर्नुहोस्"
                          >
                            {meal.isActive ? (
                              <Badge tone="green" className="text-xs">
                                सक्रिय (Active)
                              </Badge>
                            ) : (
                              <Badge tone="gray" className="text-xs">
                                निष्क्रिय (Inactive)
                              </Badge>
                            )}
                          </button>
                        </td>

                        {/* 6. Actions */}
                        <td className="px-4 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenEditModal(meal, index)}
                              className="h-8 w-8 p-0 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                              title="सम्पादन गर्नुहोस् (Edit Meal)"
                            >
                              <Edit2 size={13} />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setDeletingIndex(index);
                                setDeleteModalOpen(true);
                              }}
                              className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                              title="हटाउनुहोस् (Delete Meal)"
                            >
                              <Trash2 size={13} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile View: Clean Card Layout */}
              <div className="divide-y divide-neutral-200/70 sm:hidden">
                {meals.map((meal, index) => (
                  <div
                    key={meal.id ?? `mobile-meal-${index}`}
                    className={`space-y-3 p-4 transition-colors ${
                      !meal.isActive ? "bg-neutral-50/50 opacity-80" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-100 text-xs font-bold text-neutral-600">
                          {index + 1}
                        </span>
                        <div>
                          <h3 className="text-sm font-bold text-neutral-900">{meal.mealName}</h3>
                          {meal.mealNameEn && (
                            <p className="text-xs text-neutral-500">{meal.mealNameEn}</p>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleActive(index)}
                        className="cursor-pointer"
                      >
                        {meal.isActive ? (
                          <Badge tone="green" className="text-xs">
                            सक्रिय
                          </Badge>
                        ) : (
                          <Badge tone="gray" className="text-xs">
                            निष्क्रिय
                          </Badge>
                        )}
                      </button>
                    </div>

                    <div className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs font-medium text-neutral-700">
                      <Clock size={12} className="text-neutral-500" />
                      <span>{meal.time}</span>
                    </div>

                    {meal.menuDescription && (
                      <p className="rounded-lg bg-neutral-50 p-2.5 text-xs text-neutral-600">
                        {meal.menuDescription}
                      </p>
                    )}

                    <div className="flex items-center justify-end gap-2 border-t border-neutral-100 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEditModal(meal, index)}
                        className="text-xs text-neutral-700"
                      >
                        <Edit2 size={12} className="mr-1" /> सम्पादन
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setDeletingIndex(index);
                          setDeleteModalOpen(true);
                        }}
                        className="text-xs text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 size={12} className="mr-1" /> हटाउनुहोस्
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Modal: Add or Edit Meal */}
        <Modal
          open={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          title={
            editingIndex !== null
              ? "खानाको प्रकार सम्पादन गर्नुहोस् (Edit Meal Slot)"
              : "नयाँ खानाको प्रकार थप्नुहोस् (Add Meal Slot)"
          }
        >
          <form onSubmit={handleSaveModalForm} className="space-y-4">
            {formError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                {formError}
              </div>
            )}

            {/* Day Selector in Modal */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-neutral-700">
                कुन बारको लागि? (Day of Week)
              </label>
              <select
                value={formDayOfWeek}
                onChange={(e) => setFormDayOfWeek(e.target.value as DayKey)}
                className="shadow-xs focus:outline-hidden w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-800 focus:border-neutral-900"
              >
                {DAYS_OF_WEEK.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.labelNp} — {d.labelEn}
                  </option>
                ))}
              </select>
            </div>

            {/* Meal Name (Nepali) */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-neutral-700">
                खानाको नाम / प्रकार (Nepali Name) <span className="text-rose-500">*</span>
              </label>
              <Input
                placeholder="जस्तै: बिहानको खाजा, दिउँसोको खाना..."
                value={formMealName}
                onChange={(e) => setFormMealName(e.target.value)}
                required
              />
            </div>

            {/* Meal Name (English Translation) */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-neutral-700">
                English Subtitle (वैकल्पिक)
              </label>
              <Input
                placeholder="e.g. Morning Khaja, Lunch / Khana..."
                value={formMealNameEn}
                onChange={(e) => setFormMealNameEn(e.target.value)}
              />
            </div>

            {/* Serving Time */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-neutral-700">
                पस्कने समय (Serving Time) <span className="text-rose-500">*</span>
              </label>
              <Input
                placeholder="जस्तै: 10:00 AM–11:00 AM, 12:00 PM–1:00 PM"
                value={formTime}
                onChange={(e) => setFormTime(e.target.value)}
                required
              />
            </div>

            {/* Menu Description */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-neutral-700">
                मेनु तथा परिकारहरू (Menu Items / Food Description)
              </label>
              <textarea
                rows={3}
                placeholder="जस्तै: दाल, भात, तरकारी, चिकन करी, सलाद, अचार..."
                value={formMenuDescription}
                onChange={(e) => setFormMenuDescription(e.target.value)}
                className="shadow-xs focus:outline-hidden w-full rounded-xl border border-neutral-300 p-2.5 text-xs text-neutral-800 focus:border-neutral-900"
              />
            </div>

            {/* Active Toggle */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="modalFormIsActive"
                checked={formIsActive}
                onChange={(e) => setFormIsActive(e.target.checked)}
                className="h-4 w-4 rounded-sm border-neutral-300 text-neutral-900 focus:ring-neutral-900"
              />
              <label htmlFor="modalFormIsActive" className="text-xs font-medium text-neutral-700">
                यो खाना तालिका सक्रिय राख्नुहोस् (Active)
              </label>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 border-t border-neutral-100 pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditModalOpen(false)}
              >
                रद्द गर्नुहोस् (Cancel)
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                className="bg-brand-lime text-brand-black hover:bg-brand-lime/90 font-semibold"
              >
                {editingIndex !== null ? "अपडेट गर्नुहोस्" : "थप गर्नुहोस्"}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal: Copy to Other Days */}
        <Modal
          open={copyModalOpen}
          onClose={() => setCopyModalOpen(false)}
          title="अन्य बारमा तालिका प्रतिलिपि गर्नुहोस् (Copy Schedule to Other Days)"
        >
          <div className="space-y-4">
            <p className="text-xs text-neutral-600">
              हालको{" "}
              <strong>
                {currentDayInfo?.labelNp} ({currentDayInfo?.labelEn})
              </strong>{" "}
              को मेनु र समय तालिका निम्न कुन कुन बारमा लागु गर्न चाहनुहुन्छ? छनोट गर्नुहोस्:
            </p>

            <div className="grid grid-cols-2 gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
              {DAYS_OF_WEEK.filter((d) => d.key !== selectedDay).map((d) => {
                const checked = targetDaysToCopy.includes(d.key);
                return (
                  <label
                    key={d.key}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg p-2 text-xs font-medium transition-colors ${
                      checked
                        ? "bg-brand-lime/20 text-neutral-900"
                        : "text-neutral-700 hover:bg-neutral-100"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setTargetDaysToCopy([...targetDaysToCopy, d.key]);
                        } else {
                          setTargetDaysToCopy(targetDaysToCopy.filter((k) => k !== d.key));
                        }
                      }}
                      className="rounded text-neutral-900"
                    />
                    <span>
                      {d.labelNp}{" "}
                      <span className="text-[10px] text-neutral-500">({d.shortEn})</span>
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setTargetDaysToCopy(
                    DAYS_OF_WEEK.filter((d) => d.key !== selectedDay).map((d) => d.key)
                  )
                }
                className="text-[11px]"
              >
                सबै छनोट गर्नुहोस् (Select All)
              </Button>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setCopyModalOpen(false)}>
                  रद्द गर्नुहोस्
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleConfirmCopyToOtherDays}
                  loading={isSaving}
                  disabled={targetDaysToCopy.length === 0}
                  className="bg-brand-lime text-brand-black hover:bg-brand-lime/90 text-xs font-semibold"
                >
                  <Copy size={13} className="mr-1" /> प्रतिलिपि गर्नुहोस् ({targetDaysToCopy.length}
                  )
                </Button>
              </div>
            </div>
          </div>
        </Modal>

        {/* Modal: Delete Confirmation */}
        <Modal
          open={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          title="खानाको प्रकार हटाउने निश्चित गर्नुहोस्"
        >
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">
              {deletingIndex !== null && meals[deletingIndex] ? (
                <>
                  के तपाईं निश्चित हुनुहुन्छ कि तालिकाबाट{" "}
                  <strong>&quot;{meals[deletingIndex].mealName}&quot;</strong> हटाउन चाहनुहुन्छ?
                </>
              ) : (
                "के तपाईं यो खाना हटाउन चाहनुहुन्छ?"
              )}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setDeleteModalOpen(false)}>
                रद्द गर्नुहोस्
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirmDelete}
                className="bg-rose-600 text-xs font-semibold text-white hover:bg-rose-700"
              >
                हटाउनुहोस् (Delete)
              </Button>
            </div>
          </div>
        </Modal>

        {/* Modal: Reset Confirmation */}
        <Modal
          open={clearModalOpen}
          onClose={() => setClearModalOpen(false)}
          title="पूर्वनिर्धारित तालिकामा रिसेट गर्ने?"
        >
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">
              यसले वर्तमान{" "}
              <strong>
                {currentDayInfo?.labelNp} ({currentDayInfo?.labelEn})
              </strong>{" "}
              को तालिकालाई मानक पूर्वनिर्धारित मानहरूमा रिसेट गर्नेछ।
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setClearModalOpen(false)}>
                रद्द गर्नुहोस्
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleResetSchedule}
                loading={isSaving}
                className="bg-rose-600 text-xs font-semibold text-white hover:bg-rose-700"
              >
                रिसेट गर्नुहोस् (Reset)
              </Button>
            </div>
          </div>
        </Modal>

        {/* Modal: Public Preview */}
        <Modal
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          title={`पूर्वावलोकन: ${currentDayInfo?.labelNp} (${currentDayInfo?.labelEn})`}
        >
          <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
            <div className="space-y-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
                <div>
                  <h3 className="text-base font-extrabold text-neutral-900">
                    दैनिक भोजन तालिका — {currentDayInfo?.labelNp}
                  </h3>
                  <p className="text-xs text-neutral-500">Hostel Mess Timings &amp; Menu</p>
                </div>
                <Badge tone="green" className="text-xs">
                  स्वस्थ तथा पौष्टिक
                </Badge>
              </div>

              <div className="space-y-2 pt-1">
                {meals
                  .filter((m) => m.isActive)
                  .map((m, idx) => (
                    <div
                      key={`prev-${idx}`}
                      className="shadow-xs space-y-1 rounded-xl border border-neutral-200 bg-white p-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-neutral-900">
                          {m.mealName}
                          {m.mealNameEn && (
                            <span className="ml-1.5 text-xs font-normal text-neutral-500">
                              ({m.mealNameEn})
                            </span>
                          )}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-700">
                          <Clock size={11} className="text-neutral-500" />
                          {m.time}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed text-neutral-600">
                        {m.menuDescription || "कुनै मेनु विवरण तोकिएको छैन"}
                      </p>
                    </div>
                  ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setPreviewOpen(false)}>
                बन्द गर्नुहोस् (Close)
              </Button>
            </div>
          </div>
        </Modal>
      </DashboardShell>
    </Protected>
  );
}
