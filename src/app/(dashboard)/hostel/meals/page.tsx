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
  Eye,
  ArrowUp,
  ArrowDown,
  Calendar,
  Coffee,
  Sun,
  Moon,
  Copy,
  ChevronRight,
  Check,
  Sparkles,
  Layers,
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
import type {
  DailyMealItem,
  DailyMealSchedule,
  DayOfWeek,
  MealDayItem,
  WeeklyMealSchedule,
} from "@/lib/api-types";

const DAYS_OF_WEEK: { key: DayOfWeek; name: string; short: string; dayIndex: number }[] = [
  { key: "SUNDAY", name: "Sunday", short: "Sun", dayIndex: 0 },
  { key: "MONDAY", name: "Monday", short: "Mon", dayIndex: 1 },
  { key: "TUESDAY", name: "Tuesday", short: "Tue", dayIndex: 2 },
  { key: "WEDNESDAY", name: "Wednesday", short: "Wed", dayIndex: 3 },
  { key: "THURSDAY", name: "Thursday", short: "Thu", dayIndex: 4 },
  { key: "FRIDAY", name: "Friday", short: "Fri", dayIndex: 5 },
  { key: "SATURDAY", name: "Saturday", short: "Sat", dayIndex: 6 },
];

const DEFAULT_DAILY_MEALS: DailyMealItem[] = [
  {
    mealName: "Morning Snack",
    mealNameEn: "Morning Khaja",
    time: "10:00 AM – 11:00 AM",
    menuDescription: "Fried Grams (Chana), Beaten Rice (Chiura), Black Tea",
    isActive: true,
    orderIndex: 1,
  },
  {
    mealName: "Lunch",
    mealNameEn: "Day Khana",
    time: "12:00 PM – 1:00 PM",
    menuDescription: "Steamed Rice, Yellow Dal, Seasonal Vegetable Curry, Fresh Pickle",
    isActive: true,
    orderIndex: 2,
  },
  {
    mealName: "Afternoon Snack",
    mealNameEn: "Afternoon Khaja",
    time: "2:00 PM – 3:00 PM",
    menuDescription: "Chowmein, Samosa, or Biscuits with Hot Tea",
    isActive: true,
    orderIndex: 3,
  },
  {
    mealName: "Dinner",
    mealNameEn: "Night Khana",
    time: "7:00 PM – 8:00 PM",
    menuDescription: "Steamed Rice, Lentils, Chicken or Paneer Curry, Spinach (Saag)",
    isActive: true,
    orderIndex: 4,
  },
];

const DEFAULT_WEEKLY_MENU: Record<DayOfWeek, MealDayItem> = {
  SUNDAY: {
    dayOfWeek: "SUNDAY",
    breakfastDescription: "Milk Tea, Boiled Eggs, Toast with Butter & Jam",
    breakfastTime: "10:00 AM – 11:00 AM",
    breakfastNotes: "Vegetarian option: Banana & Toast",
    mainMealDescription: "Rice, Dal, Chicken Curry / Paneer Curry, Salad, Papad",
    mainMealTime: "7:00 PM – 8:00 PM",
    mainMealNotes: "Special weekend meal",
  },
  MONDAY: {
    dayOfWeek: "MONDAY",
    breakfastDescription: "Fried Grams (Chana), Beaten Rice (Chiura), Black Tea",
    breakfastTime: "10:00 AM – 11:00 AM",
    breakfastNotes: "",
    mainMealDescription: "Rice, Yellow Dal, Seasonal Mix Vegetable Curry, Pickle",
    mainMealTime: "7:00 PM – 8:00 PM",
    mainMealNotes: "",
  },
  TUESDAY: {
    dayOfWeek: "TUESDAY",
    breakfastDescription: "Hot Semolina Halwa, Puri, Milk Tea",
    breakfastTime: "10:00 AM – 11:00 AM",
    breakfastNotes: "",
    mainMealDescription: "Rice, Green Dal, Potato & Green Pea Curry, Pickle",
    mainMealTime: "7:00 PM – 8:00 PM",
    mainMealNotes: "",
  },
  WEDNESDAY: {
    dayOfWeek: "WEDNESDAY",
    breakfastDescription: "Veg Chowmein, Tomato Sauce, Black Tea",
    breakfastTime: "10:00 AM – 11:00 AM",
    breakfastNotes: "",
    mainMealDescription: "Rice, Black Dal, Chicken Curry or Mushroom Curry, Saag",
    mainMealTime: "7:00 PM – 8:00 PM",
    mainMealNotes: "Non-veg day",
  },
  THURSDAY: {
    dayOfWeek: "THURSDAY",
    breakfastDescription: "Boiled Chickpeas, Beaten Rice, Tea",
    breakfastTime: "10:00 AM – 11:00 AM",
    breakfastNotes: "",
    mainMealDescription: "Rice, Dal, Cauliflower & Potato Curry, Pickle",
    mainMealTime: "7:00 PM – 8:00 PM",
    mainMealNotes: "",
  },
  FRIDAY: {
    dayOfWeek: "FRIDAY",
    breakfastDescription: "Egg Omelette or Veg Roll, Milk Tea",
    breakfastTime: "10:00 AM – 11:00 AM",
    breakfastNotes: "",
    mainMealDescription: "Rice, Lentils, Fresh Fish Curry or Paneer Curry, Green Salad",
    mainMealTime: "7:00 PM – 8:00 PM",
    mainMealNotes: "Special Friday meal",
  },
  SATURDAY: {
    dayOfWeek: "SATURDAY",
    breakfastDescription: "Puri Tarkari, Black Tea or Milk Tea",
    breakfastTime: "10:00 AM – 11:00 AM",
    breakfastNotes: "Late weekend brunch",
    mainMealDescription: "Rice, Dal Makhani, Mixed Veggie Curry, Papad, Pickle",
    mainMealTime: "7:00 PM – 8:00 PM",
    mainMealNotes: "",
  },
};

const QUICK_TIME_PRESETS = [
  { label: "Morning Khaja", time: "10:00 AM – 11:00 AM" },
  { label: "Lunch", time: "12:00 PM – 1:00 PM" },
  { label: "Afternoon Khaja", time: "2:00 PM – 3:00 PM" },
  { label: "Dinner", time: "7:00 PM – 8:00 PM" },
];

export default function DailyMealsPage() {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();

  const [activeHostelId, setActiveHostelId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"weekly" | "slots">("weekly");
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>("SUNDAY");

  // Daily Meal Slots State
  const [dailyMeals, setDailyMeals] = useState<DailyMealItem[]>([]);
  const [originalDailyMeals, setOriginalDailyMeals] = useState<DailyMealItem[]>([]);
  const [dailyConfigured, setDailyConfigured] = useState<boolean>(false);

  // Weekly Menu State (Sunday to Saturday)
  const [weeklyMenu, setWeeklyMenu] = useState<Record<DayOfWeek, MealDayItem>>(DEFAULT_WEEKLY_MENU);
  const [originalWeeklyMenu, setOriginalWeeklyMenu] =
    useState<Record<DayOfWeek, MealDayItem>>(DEFAULT_WEEKLY_MENU);
  const [weeklyConfigured, setWeeklyConfigured] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modal States
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState<DailyMealItem | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copyTargetDays, setCopyTargetDays] = useState<DayOfWeek[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Form State for Add / Edit Slot
  const [formMealName, setFormMealName] = useState("");
  const [formMealNameEn, setFormMealNameEn] = useState("");
  const [formTime, setFormTime] = useState("");
  const [formMenuDescription, setFormMenuDescription] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  // Today's day key
  const todayKey: DayOfWeek = useMemo(() => {
    const idx = new Date().getDay();
    return DAYS_OF_WEEK.find((d) => d.dayIndex === idx)?.key ?? "SUNDAY";
  }, []);

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

  // 2. Fetch Both Daily Slots & Weekly Schedule
  const loadAllMeals = useCallback(async (hid: string) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      // Fetch daily slots
      const dailyRes = await hostelGhar.meals.getDaily(hid);
      const dailyData = unwrap<DailyMealSchedule>(dailyRes.data);
      if (dailyData && Array.isArray(dailyData.schedule) && dailyData.schedule.length > 0) {
        const loaded = dailyData.schedule.map((item, idx) => ({
          id: item.id,
          mealName: item.mealName,
          mealNameEn: item.mealNameEn ?? null,
          time: item.time,
          menuDescription: item.menuDescription ?? "",
          isActive: item.isActive !== false,
          orderIndex: item.orderIndex ?? idx + 1,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        }));
        setDailyMeals(loaded);
        setOriginalDailyMeals(loaded);
        setDailyConfigured(Boolean(dailyData.isConfigured));
      } else {
        setDailyMeals(DEFAULT_DAILY_MEALS);
        setOriginalDailyMeals(DEFAULT_DAILY_MEALS);
        setDailyConfigured(false);
      }

      // Fetch weekly menu (Sunday - Saturday)
      try {
        const weeklyRes = await hostelGhar.meals.get(hid);
        const weeklyData = unwrap<WeeklyMealSchedule>(weeklyRes.data);
        const rawItems = Array.isArray(weeklyData?.schedule)
          ? weeklyData.schedule
          : Array.isArray(weeklyData?.days)
            ? weeklyData.days
            : [];

        if (rawItems.length > 0) {
          const mapped: Record<DayOfWeek, MealDayItem> = {
            ...DEFAULT_WEEKLY_MENU,
          };
          rawItems.forEach((item) => {
            const k = String(item.dayOfWeek).toUpperCase() as DayOfWeek;
            if (mapped[k]) {
              mapped[k] = { ...mapped[k], ...item, dayOfWeek: k };
            }
          });
          setWeeklyMenu(mapped);
          setOriginalWeeklyMenu(mapped);
          setWeeklyConfigured(true);
        } else {
          setWeeklyMenu(DEFAULT_WEEKLY_MENU);
          setOriginalWeeklyMenu(DEFAULT_WEEKLY_MENU);
          setWeeklyConfigured(false);
        }
      } catch {
        // Keep defaults for weekly if not initialized
        setWeeklyMenu(DEFAULT_WEEKLY_MENU);
        setOriginalWeeklyMenu(DEFAULT_WEEKLY_MENU);
        setWeeklyConfigured(false);
      }
    } catch (err: unknown) {
      const apiErr = toApiError(err);
      setDailyMeals(DEFAULT_DAILY_MEALS);
      setOriginalDailyMeals(DEFAULT_DAILY_MEALS);
      setWeeklyMenu(DEFAULT_WEEKLY_MENU);
      setOriginalWeeklyMenu(DEFAULT_WEEKLY_MENU);
      if (apiErr.status !== 404 && !apiErr.message?.includes("not found")) {
        setLoadError(apiErr.message || "Failed to load meal schedule.");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeHostelId) {
      loadAllMeals(activeHostelId);
    } else {
      setIsLoading(false);
    }
  }, [activeHostelId, loadAllMeals]);

  // Track Unsaved Changes
  const hasDailyChanges = useMemo(() => {
    return JSON.stringify(dailyMeals) !== JSON.stringify(originalDailyMeals);
  }, [dailyMeals, originalDailyMeals]);

  const hasWeeklyChanges = useMemo(() => {
    return JSON.stringify(weeklyMenu) !== JSON.stringify(originalWeeklyMenu);
  }, [weeklyMenu, originalWeeklyMenu]);

  const hasUnsavedChanges = hasDailyChanges || hasWeeklyChanges;

  // Active slots count
  const activeCount = useMemo(() => {
    return dailyMeals.filter((m) => m.isActive).length;
  }, [dailyMeals]);

  // Calculate Next Upcoming Meal
  const nextUpcomingMeal = useMemo(() => {
    if (dailyMeals.length === 0) return null;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // Parse simple time string like "10:00 AM" or "12:00 PM"
    const parseTimeToMinutes = (t: string): number => {
      const match = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (!match) return 0;
      let h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      const isPM = match[3].toUpperCase() === "PM";
      if (isPM && h !== 12) h += 12;
      if (!isPM && h === 12) h = 0;
      return h * 60 + m;
    };

    const sorted = [...dailyMeals]
      .filter((m) => m.isActive)
      .map((m) => ({
        ...m,
        startMins: parseTimeToMinutes(m.time.split(/[-–—]/)[0] || m.time),
      }))
      .sort((a, b) => a.startMins - b.startMins);

    const upcoming = sorted.find((m) => m.startMins >= currentMinutes);
    return upcoming ?? sorted[0] ?? null;
  }, [dailyMeals]);

  // Service Hours Window calculation
  const serviceWindow = useMemo(() => {
    if (dailyMeals.length === 0) return "Not set";
    const active = dailyMeals.filter((m) => m.isActive);
    if (active.length === 0) return "All slots paused";
    const first = active[0].time.split(/[-–—]/)[0]?.trim();
    const last =
      active[active.length - 1].time.split(/[-–—]/)[1]?.trim() ||
      active[active.length - 1].time.split(/[-–—]/)[0]?.trim();
    return `${first} – ${last}`;
  }, [dailyMeals]);

  // Handle Weekly Menu Field Change for a Day
  const handleWeeklyFieldChange = (field: keyof MealDayItem, val: string) => {
    setWeeklyMenu((prev) => ({
      ...prev,
      [selectedDay]: {
        ...prev[selectedDay],
        dayOfWeek: selectedDay,
        [field]: val,
      },
    }));
  };

  // Open Modal for Add Daily Slot
  const handleOpenAddModal = () => {
    setEditingMeal(null);
    setEditingIndex(null);
    setFormMealName("");
    setFormMealNameEn("");
    setFormTime("");
    setFormMenuDescription("");
    setFormIsActive(true);
    setFormError(null);
    setEditModalOpen(true);
  };

  // Open Modal for Edit Daily Slot
  const handleOpenEditModal = (meal: DailyMealItem, index: number) => {
    setEditingMeal(meal);
    setEditingIndex(index);
    setFormMealName(meal.mealName);
    setFormMealNameEn(meal.mealNameEn ?? "");
    setFormTime(meal.time);
    setFormMenuDescription(meal.menuDescription ?? "");
    setFormIsActive(meal.isActive);
    setFormError(null);
    setEditModalOpen(true);
  };

  // Save Modal (Add or Edit Daily Slot)
  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = formMealName.trim();
    const trimmedTime = formTime.trim();

    if (!trimmedName) {
      setFormError("Meal name is required.");
      return;
    }
    if (!trimmedTime) {
      setFormError("Serving time window is required.");
      return;
    }

    const updatedItem: DailyMealItem = {
      ...(editingMeal?.id ? { id: editingMeal.id } : {}),
      mealName: trimmedName,
      mealNameEn: formMealNameEn.trim() || null,
      time: trimmedTime,
      menuDescription: formMenuDescription.trim() || null,
      isActive: formIsActive,
      orderIndex:
        editingMeal?.orderIndex ??
        (editingIndex !== null ? editingIndex + 1 : dailyMeals.length + 1),
    };

    if (editingIndex !== null && editingIndex >= 0) {
      const next = [...dailyMeals];
      next[editingIndex] = updatedItem;
      setDailyMeals(next);
      success("Meal slot updated. Click 'Save Schedule' to apply.");
    } else {
      setDailyMeals([...dailyMeals, updatedItem]);
      success("New meal slot added. Click 'Save Schedule' to apply.");
    }

    setEditModalOpen(false);
  };

  // Move Slot Up/Down
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const next = [...dailyMeals];
    const temp = next[index - 1];
    next[index - 1] = next[index];
    next[index] = temp;
    setDailyMeals(next.map((m, idx) => ({ ...m, orderIndex: idx + 1 })));
  };

  const handleMoveDown = (index: number) => {
    if (index === dailyMeals.length - 1) return;
    const next = [...dailyMeals];
    const temp = next[index + 1];
    next[index + 1] = next[index];
    next[index] = temp;
    setDailyMeals(next.map((m, idx) => ({ ...m, orderIndex: idx + 1 })));
  };

  // Toggle Active
  const handleToggleActive = (index: number) => {
    const next = [...dailyMeals];
    next[index] = { ...next[index], isActive: !next[index].isActive };
    setDailyMeals(next);
  };

  // Delete Action
  const handleConfirmDelete = () => {
    if (deletingIndex === null || deletingIndex < 0 || deletingIndex >= dailyMeals.length) return;
    const removedMeal = dailyMeals[deletingIndex];
    const next = dailyMeals
      .filter((_, idx) => idx !== deletingIndex)
      .map((m, idx) => ({
        ...m,
        orderIndex: idx + 1,
      }));
    setDailyMeals(next);
    setDeleteModalOpen(false);
    setDeletingIndex(null);
    success(`"${removedMeal.mealName}" removed.`);
  };

  // Copy Menu Across Days
  const handleExecuteCopy = () => {
    if (copyTargetDays.length === 0) {
      toastError("Select at least one day to copy to.");
      return;
    }
    const source = weeklyMenu[selectedDay];
    setWeeklyMenu((prev) => {
      const next = { ...prev };
      copyTargetDays.forEach((dayKey) => {
        next[dayKey] = {
          ...source,
          dayOfWeek: dayKey,
          id: prev[dayKey]?.id ?? null,
        };
      });
      return next;
    });
    setCopyModalOpen(false);
    setCopyTargetDays([]);
    success(`Copied ${selectedDay} menu to ${copyTargetDays.length} day(s).`);
  };

  // Persist Everything
  const handleSaveAll = async () => {
    if (!activeHostelId) {
      toastError("Hostel ID could not be identified.");
      return;
    }

    setIsSaving(true);
    try {
      // 1. Save Daily Slots
      if (dailyMeals.length > 0) {
        const payload: DailyMealItem[] = dailyMeals.map((m, idx) => ({
          id: m.id,
          mealName: m.mealName.trim(),
          mealNameEn: m.mealNameEn?.trim() || null,
          time: m.time.trim(),
          menuDescription: m.menuDescription?.trim() || null,
          isActive: m.isActive,
          orderIndex: idx + 1,
        }));
        await hostelGhar.meals.saveDaily(activeHostelId, payload);
        setOriginalDailyMeals(dailyMeals);
        setDailyConfigured(true);
      }

      // 2. Save Weekly Schedule
      const weeklyPayload: MealDayItem[] = Object.values(weeklyMenu);
      await hostelGhar.meals.save(activeHostelId, weeklyPayload);
      setOriginalWeeklyMenu(weeklyMenu);
      setWeeklyConfigured(true);

      success("Meal schedule and weekly menus saved successfully.");
    } catch (err: unknown) {
      const apiErr = toApiError(err);
      toastError(apiErr.message || "Failed to save meal schedule.");
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to Defaults
  const handleResetSchedule = async () => {
    if (!activeHostelId) return;
    setIsSaving(true);
    try {
      await hostelGhar.meals.clearDaily(activeHostelId);
      setDailyMeals(DEFAULT_DAILY_MEALS);
      setOriginalDailyMeals(DEFAULT_DAILY_MEALS);
      setWeeklyMenu(DEFAULT_WEEKLY_MENU);
      setOriginalWeeklyMenu(DEFAULT_WEEKLY_MENU);
      setResetModalOpen(false);
      success("Reset to standard meal schedule defaults.");
    } catch (err: unknown) {
      const apiErr = toApiError(err);
      toastError(apiErr.message || "Failed to reset meal schedule.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Protected permission="VIEW_HOSTEL">
      <DashboardShell
        title="Daily Meal Schedule"
        subtitle="Manage food timings, daily meal slots, and weekly menus (Sunday to Saturday) for your hostel."
      >
        <div className="mx-auto max-w-6xl space-y-6 pb-20">
          {/* Header Bar */}
          <div className="flex flex-col justify-between gap-4 border-b border-neutral-200/80 pb-5 sm:flex-row sm:items-center">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <span className="bg-brand-lime/20 text-brand-black shadow-xs rounded-xl p-2.5">
                  <Utensils size={22} className="text-brand-black" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
                      Daily Meal Schedule
                    </h1>
                    {dailyConfigured || weeklyConfigured ? (
                      <Badge tone="green" className="ml-1 text-xs font-semibold">
                        <Check size={12} className="mr-1" /> Published
                      </Badge>
                    ) : (
                      <Badge tone="gray" className="ml-1 text-xs">
                        Default Setup
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-neutral-500 sm:text-sm">
                    Manage food timings, meal items, and availability for your hostel residents.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewOpen(true)}
                disabled={isLoading}
                className="text-xs font-medium"
              >
                <Eye size={14} className="mr-1.5" /> Resident Preview
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setResetModalOpen(true)}
                disabled={isLoading}
                className="border-neutral-300 text-xs text-neutral-700 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
              >
                <RotateCcw size={13} className="mr-1.5" /> Reset Defaults
              </Button>
              {activeTab === "slots" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenAddModal}
                  disabled={isLoading}
                  className="bg-brand-lime/10 border-brand-lime/40 text-brand-black hover:bg-brand-lime/20 text-xs font-semibold"
                >
                  <Plus size={14} className="mr-1.5" /> Add Meal Slot
                </Button>
              )}
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveAll}
                loading={isSaving}
                disabled={isLoading}
                className="bg-brand-lime text-brand-black hover:bg-brand-lime/90 shadow-xs px-4 text-xs font-semibold"
              >
                <Save size={14} className="mr-1.5" /> Save Schedule
              </Button>
            </div>
          </div>

          {/* Equal & Balanced KPI Cards (Meaningful Real-time Insights) */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            {/* 1. Total Daily Slots */}
            <Card className="shadow-xs flex flex-col justify-between border-neutral-200/80 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Total Slots
                </span>
                <span className="rounded-lg bg-neutral-100 p-1.5 text-neutral-700">
                  <Utensils size={15} />
                </span>
              </div>
              <div className="mt-3">
                <p className="text-2xl font-bold tracking-tight text-neutral-900">
                  {dailyMeals.length}
                </p>
                <p className="mt-0.5 text-xs text-neutral-500">Configured meal slots</p>
              </div>
            </Card>

            {/* 2. Active Slots */}
            <Card className="shadow-xs flex flex-col justify-between border-neutral-200/80 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Active Slots
                </span>
                <span className="rounded-lg bg-emerald-50 p-1.5 text-emerald-600">
                  <Check size={15} />
                </span>
              </div>
              <div className="mt-3">
                <p className="text-2xl font-bold tracking-tight text-emerald-700">{activeCount}</p>
                <p className="mt-0.5 text-xs text-neutral-500">Visible to residents</p>
              </div>
            </Card>

            {/* 3. Next Upcoming Meal */}
            <Card className="shadow-xs flex flex-col justify-between border-neutral-200/80 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Next Upcoming
                </span>
                <span className="rounded-lg bg-amber-50 p-1.5 text-amber-600">
                  <Clock size={15} />
                </span>
              </div>
              <div className="mt-3">
                <p className="truncate text-base font-bold text-neutral-900">
                  {nextUpcomingMeal?.mealName || "None"}
                </p>
                <p className="mt-0.5 truncate text-xs text-neutral-500">
                  {nextUpcomingMeal?.time || "No active serving time"}
                </p>
              </div>
            </Card>

            {/* 4. Service Hours Window */}
            <Card className="shadow-xs flex flex-col justify-between border-neutral-200/80 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Daily Service
                </span>
                <span className="rounded-lg bg-blue-50 p-1.5 text-blue-600">
                  <Sun size={15} />
                </span>
              </div>
              <div className="mt-3">
                <p className="truncate text-base font-bold text-neutral-900">{serviceWindow}</p>
                <p className="mt-0.5 text-xs text-neutral-500">First to last meal window</p>
              </div>
            </Card>
          </div>

          {/* Unsaved Changes Banner */}
          {hasUnsavedChanges && (
            <div className="shadow-xs animate-in fade-in flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50/90 p-3.5 text-amber-900 duration-200">
              <div className="flex items-center gap-3">
                <AlertCircle size={18} className="shrink-0 text-amber-600" />
                <div>
                  <p className="text-xs font-semibold sm:text-sm">You have unsaved changes</p>
                  <p className="text-[11px] text-amber-700 sm:text-xs">
                    Remember to click &quot;Save Schedule&quot; to apply your daily slots or weekly
                    menu updates.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={handleSaveAll}
                loading={isSaving}
                className="shrink-0 bg-neutral-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800"
              >
                Save Schedule
              </Button>
            </div>
          )}

          {/* Section Selector: Weekly Menu vs Daily Timetable */}
          <div className="flex flex-col gap-3 border-b border-neutral-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex w-fit items-center gap-1 rounded-xl bg-neutral-100 p-1">
              <button
                type="button"
                onClick={() => setActiveTab("weekly")}
                className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                  activeTab === "weekly"
                    ? "shadow-xs bg-white text-neutral-900"
                    : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                <Calendar size={14} />
                <span>Weekly Menu Planner</span>
                <span className="bg-brand-lime/30 py-0.2 text-brand-black rounded-full px-1.5 text-[10px] font-bold">
                  7 Days
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("slots")}
                className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                  activeTab === "slots"
                    ? "shadow-xs bg-white text-neutral-900"
                    : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                <Layers size={14} />
                <span>Daily Timetable ({dailyMeals.length} Slots)</span>
              </button>
            </div>

            <p className="text-xs text-neutral-500">
              {activeTab === "weekly"
                ? "Configure distinct menus for Sunday through Saturday."
                : "Manage standard daily meal hours, order, and resident visibility."}
            </p>
          </div>

          {/* TAB 1: WEEKLY MENU PLANNER (Sunday to Saturday) */}
          {activeTab === "weekly" && (
            <div className="space-y-4">
              {/* Day Selector Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {DAYS_OF_WEEK.map((d) => {
                  const isSelected = selectedDay === d.key;
                  const isToday = todayKey === d.key;
                  return (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => setSelectedDay(d.key)}
                      className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition-all ${
                        isSelected
                          ? "shadow-xs border-neutral-900 bg-neutral-900 text-white"
                          : "border-neutral-200/80 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50"
                      }`}
                    >
                      <span>{d.name}</span>
                      {isToday && (
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                            isSelected
                              ? "bg-brand-lime text-neutral-950"
                              : "bg-neutral-100 text-neutral-600"
                          }`}
                        >
                          Today
                        </span>
                      )}
                    </button>
                  );
                })}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCopyTargetDays(
                      DAYS_OF_WEEK.filter((d) => d.key !== selectedDay).map((d) => d.key)
                    );
                    setCopyModalOpen(true);
                  }}
                  className="ml-auto shrink-0 border-dashed text-xs text-neutral-700 hover:border-neutral-400"
                >
                  <Copy size={13} className="mr-1.5" /> Copy {selectedDay} to Other Days
                </Button>
              </div>

              {/* Selected Day Menu Editor */}
              <Card className="shadow-xs overflow-hidden border border-neutral-200/80 bg-white">
                <div className="flex items-center justify-between border-b border-neutral-200/80 bg-neutral-50/70 px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-neutral-900">
                      {selectedDay} Food Menu
                    </span>
                    {todayKey === selectedDay && (
                      <Badge tone="green" className="text-[11px]">
                        Active Today
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-neutral-500">
                    Residents see this menu on their portal every {selectedDay}
                  </span>
                </div>

                <div className="grid gap-6 p-5 sm:grid-cols-2">
                  {/* Breakfast / Morning Khaja Section */}
                  <div className="space-y-4 rounded-xl border border-amber-200/80 bg-amber-50/40 p-4">
                    <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded-lg bg-amber-100 p-1.5 text-amber-700">
                          <Coffee size={16} />
                        </span>
                        <div>
                          <h4 className="text-sm font-bold text-neutral-900">
                            Breakfast &amp; Morning Khaja
                          </h4>
                          <p className="text-[11px] text-neutral-500">Morning serving</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-neutral-700">
                        Serving Hours
                      </label>
                      <Input
                        value={weeklyMenu[selectedDay]?.breakfastTime || ""}
                        onChange={(e) => handleWeeklyFieldChange("breakfastTime", e.target.value)}
                        placeholder="e.g. 10:00 AM – 11:00 AM"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-neutral-700">
                        Menu Items &amp; Food Details
                      </label>
                      <textarea
                        rows={3}
                        value={weeklyMenu[selectedDay]?.breakfastDescription || ""}
                        onChange={(e) =>
                          handleWeeklyFieldChange("breakfastDescription", e.target.value)
                        }
                        placeholder="e.g. Fried Grams (Chana), Beaten Rice, Tea, Boiled Eggs..."
                        className="focus:border-brand-black focus:ring-brand-black w-full rounded-xl border border-neutral-300 bg-white p-2.5 text-xs text-neutral-800 focus:outline-none focus:ring-1"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-neutral-700">
                        Dietary Notes / Veg Alternative (Optional)
                      </label>
                      <Input
                        value={weeklyMenu[selectedDay]?.breakfastNotes || ""}
                        onChange={(e) => handleWeeklyFieldChange("breakfastNotes", e.target.value)}
                        placeholder="e.g. Banana / Bread alternative for vegetarians"
                      />
                    </div>
                  </div>

                  {/* Lunch & Dinner / Main Meals Section */}
                  <div className="space-y-4 rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-4">
                    <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded-lg bg-emerald-100 p-1.5 text-emerald-700">
                          <Sun size={16} />
                        </span>
                        <div>
                          <h4 className="text-sm font-bold text-neutral-900">
                            Lunch &amp; Dinner (Main Meals)
                          </h4>
                          <p className="text-[11px] text-neutral-500">Day &amp; night meals</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-neutral-700">
                        Serving Hours
                      </label>
                      <Input
                        value={weeklyMenu[selectedDay]?.mainMealTime || ""}
                        onChange={(e) => handleWeeklyFieldChange("mainMealTime", e.target.value)}
                        placeholder="e.g. 12:00 PM – 1:00 PM / 7:00 PM – 8:00 PM"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-neutral-700">
                        Menu Items &amp; Food Details
                      </label>
                      <textarea
                        rows={3}
                        value={weeklyMenu[selectedDay]?.mainMealDescription || ""}
                        onChange={(e) =>
                          handleWeeklyFieldChange("mainMealDescription", e.target.value)
                        }
                        placeholder="e.g. Rice, Dal, Chicken Curry or Paneer Curry, Seasonal Green Saag, Pickle..."
                        className="focus:border-brand-black focus:ring-brand-black w-full rounded-xl border border-neutral-300 bg-white p-2.5 text-xs text-neutral-800 focus:outline-none focus:ring-1"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-neutral-700">
                        Meal Notes / Special Items (Optional)
                      </label>
                      <Input
                        value={weeklyMenu[selectedDay]?.mainMealNotes || ""}
                        onChange={(e) => handleWeeklyFieldChange("mainMealNotes", e.target.value)}
                        placeholder="e.g. Special non-veg chicken curry provided on Wednesday & Friday"
                      />
                    </div>
                  </div>
                </div>
              </Card>

              {/* 7-Day Quick Overview Grid */}
              <div className="pt-2">
                <h3 className="mb-3 text-sm font-bold text-neutral-900">
                  Full 7-Day Schedule At A Glance
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {DAYS_OF_WEEK.map((d) => {
                    const m = weeklyMenu[d.key];
                    const isSelected = selectedDay === d.key;
                    return (
                      <div
                        key={d.key}
                        onClick={() => setSelectedDay(d.key)}
                        className={`cursor-pointer rounded-xl border p-3.5 transition-all ${
                          isSelected
                            ? "border-neutral-900 bg-neutral-50 ring-1 ring-neutral-900"
                            : "hover:shadow-xs border-neutral-200/80 bg-white hover:border-neutral-300"
                        }`}
                      >
                        <div className="mb-2 flex items-center justify-between border-b border-neutral-100 pb-1.5">
                          <span className="text-xs font-bold text-neutral-900">{d.name}</span>
                          {todayKey === d.key && (
                            <span className="bg-brand-lime py-0.2 rounded px-1.5 text-[9px] font-bold text-neutral-950">
                              Today
                            </span>
                          )}
                        </div>
                        <div className="space-y-1.5 text-xs">
                          <div>
                            <span className="text-[10px] font-bold text-amber-700">Breakfast:</span>
                            <p className="line-clamp-1 text-[11px] text-neutral-600">
                              {m?.breakfastDescription || "Not set"}
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-emerald-700">
                              Main Meal:
                            </span>
                            <p className="line-clamp-1 text-[11px] text-neutral-600">
                              {m?.mainMealDescription || "Not set"}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DAILY TIMETABLE (Standard Slots & Hours) */}
          {activeTab === "slots" && (
            <div>
              {isLoading ? (
                <TableSkeleton rows={4} />
              ) : loadError ? (
                <ErrorState
                  title="Failed to load meal schedule"
                  description={loadError}
                  onRetry={() => activeHostelId && loadAllMeals(activeHostelId)}
                />
              ) : dailyMeals.length === 0 ? (
                <EmptyState
                  title="No daily meal slots configured"
                  description="Add your first meal slot (e.g. Breakfast, Lunch, Dinner) to establish serving timings."
                  action={
                    <Button onClick={handleOpenAddModal} className="bg-brand-lime text-brand-black">
                      Add Meal Slot
                    </Button>
                  }
                />
              ) : (
                <Card className="shadow-xs overflow-hidden border border-neutral-200/80 bg-white">
                  {/* Table Header inside card */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200/80 bg-neutral-50/70 px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-neutral-800">
                        Daily Serving Timetable ({dailyMeals.length} Meals)
                      </span>
                      <span className="text-[11px] text-neutral-500">
                        — Use arrow buttons to reorder slots chronologically
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                      <span className="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
                      <span>{activeCount} Active</span>
                      <span className="text-neutral-300">|</span>
                      <span className="inline-block h-2 w-2 rounded-full bg-neutral-300"></span>
                      <span>{dailyMeals.length - activeCount} Inactive</span>
                    </div>
                  </div>

                  {/* Desktop Data Table */}
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full text-left text-sm text-neutral-700">
                      <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold text-neutral-700">
                        <tr>
                          <th scope="col" className="w-16 px-4 py-3 text-center font-bold">
                            Order
                          </th>
                          <th scope="col" className="px-5 py-3 font-bold">
                            Meal Slot
                          </th>
                          <th scope="col" className="w-52 px-4 py-3 font-bold">
                            Serving Window
                          </th>
                          <th scope="col" className="px-5 py-3 font-bold">
                            Menu Description
                          </th>
                          <th scope="col" className="w-28 px-4 py-3 text-center font-bold">
                            Status
                          </th>
                          <th scope="col" className="w-36 px-4 py-3 text-right font-bold">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200/70">
                        {dailyMeals.map((meal, index) => (
                          <tr
                            key={meal.id ?? `meal-${index}`}
                            className={`transition-colors hover:bg-neutral-50/70 ${
                              !meal.isActive ? "bg-neutral-50/40 opacity-70" : ""
                            }`}
                          >
                            {/* Order & Reorder arrows */}
                            <td className="px-4 py-3.5 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <span className="w-4 text-center font-mono text-xs font-bold text-neutral-500">
                                  {index + 1}
                                </span>
                                <div className="flex flex-col">
                                  <button
                                    type="button"
                                    disabled={index === 0}
                                    onClick={() => handleMoveUp(index)}
                                    title="Move Up"
                                    className="cursor-pointer rounded p-0.5 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-800 disabled:cursor-not-allowed disabled:opacity-20"
                                  >
                                    <ArrowUp size={11} />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={index === dailyMeals.length - 1}
                                    onClick={() => handleMoveDown(index)}
                                    title="Move Down"
                                    className="cursor-pointer rounded p-0.5 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-800 disabled:cursor-not-allowed disabled:opacity-20"
                                  >
                                    <ArrowDown size={11} />
                                  </button>
                                </div>
                              </div>
                            </td>

                            {/* Slot Name */}
                            <td className="px-5 py-3.5">
                              <div className="font-semibold text-neutral-900">{meal.mealName}</div>
                              {meal.mealNameEn && (
                                <div className="text-xs text-neutral-500">{meal.mealNameEn}</div>
                              )}
                            </td>

                            {/* Serving Window */}
                            <td className="px-4 py-3.5">
                              <div className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200/80 bg-neutral-100/80 px-2.5 py-1 text-xs font-semibold text-neutral-800">
                                <Clock size={12} className="shrink-0 text-neutral-500" />
                                <span>{meal.time}</span>
                              </div>
                            </td>

                            {/* Menu Description */}
                            <td className="px-5 py-3.5">
                              {meal.menuDescription ? (
                                <p className="line-clamp-2 text-xs leading-relaxed text-neutral-700">
                                  {meal.menuDescription}
                                </p>
                              ) : (
                                <span className="text-xs italic text-neutral-400">
                                  No menu details added
                                </span>
                              )}
                            </td>

                            {/* Status */}
                            <td className="px-4 py-3.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleToggleActive(index)}
                                className="cursor-pointer transition-transform hover:scale-105"
                                title="Click to toggle status"
                              >
                                {meal.isActive ? (
                                  <Badge tone="green" className="text-xs font-medium">
                                    Active
                                  </Badge>
                                ) : (
                                  <Badge tone="gray" className="text-xs font-medium">
                                    Inactive
                                  </Badge>
                                )}
                              </button>
                            </td>

                            {/* Actions */}
                            <td className="px-4 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenEditModal(meal, index)}
                                  className="h-8 w-8 p-0 text-neutral-600 hover:bg-neutral-200/60 hover:text-neutral-900"
                                  title="Edit slot"
                                >
                                  <Edit2 size={13} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setDeletingIndex(index);
                                    setDeleteModalOpen(true);
                                  }}
                                  className="h-8 w-8 p-0 text-neutral-400 hover:bg-rose-50 hover:text-rose-600"
                                  title="Delete slot"
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

                  {/* Mobile Cards */}
                  <div className="divide-y divide-neutral-200/80 md:hidden">
                    {dailyMeals.map((meal, index) => (
                      <div
                        key={meal.id ?? `mobile-meal-${index}`}
                        className={`space-y-3 p-4 ${!meal.isActive ? "bg-neutral-50/60 opacity-80" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 font-mono text-xs font-bold text-neutral-600">
                              {index + 1}
                            </span>
                            <div>
                              <h3 className="font-bold text-neutral-900">{meal.mealName}</h3>
                              {meal.mealNameEn && (
                                <p className="text-xs text-neutral-500">{meal.mealNameEn}</p>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleToggleActive(index)}
                            className="shrink-0 cursor-pointer"
                          >
                            {meal.isActive ? (
                              <Badge tone="green" className="text-[11px]">
                                Active
                              </Badge>
                            ) : (
                              <Badge tone="gray" className="text-[11px]">
                                Inactive
                              </Badge>
                            )}
                          </button>
                        </div>

                        <div className="flex w-fit items-center gap-1.5 rounded-md bg-neutral-100/70 px-2.5 py-1 text-xs text-neutral-700">
                          <Clock size={12} className="shrink-0 text-neutral-500" />
                          <span className="font-semibold">{meal.time}</span>
                        </div>

                        <div className="rounded-lg border border-neutral-200/50 bg-neutral-50 p-2.5 text-xs leading-relaxed text-neutral-700">
                          {meal.menuDescription || (
                            <span className="italic text-neutral-400">No menu items added</span>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-2 border-t border-neutral-100 pt-1">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={index === 0}
                              onClick={() => handleMoveUp(index)}
                              className="h-7 px-2 text-xs text-neutral-600"
                            >
                              <ArrowUp size={12} className="mr-1" /> Up
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={index === dailyMeals.length - 1}
                              onClick={() => handleMoveDown(index)}
                              className="h-7 px-2 text-xs text-neutral-600"
                            >
                              <ArrowDown size={12} className="mr-1" /> Down
                            </Button>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenEditModal(meal, index)}
                              className="h-7 text-xs"
                            >
                              <Edit2 size={12} className="mr-1" /> Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setDeletingIndex(index);
                                setDeleteModalOpen(true);
                              }}
                              className="h-7 border-rose-200 text-xs text-rose-600 hover:bg-rose-50"
                            >
                              <Trash2 size={12} />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Modal: Add or Edit Daily Slot */}
        <Modal
          open={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          title={editingIndex !== null ? "Edit Meal Slot" : "Add Meal Slot"}
          description="Configure the meal name, serving hours, and description."
        >
          <form onSubmit={handleSaveModal} className="space-y-4 pt-1">
            {formError && (
              <div className="rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-700">
                {formError}
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold text-neutral-800">
                Meal Name <span className="text-rose-600">*</span>
              </label>
              <Input
                value={formMealName}
                onChange={(e) => setFormMealName(e.target.value)}
                placeholder="e.g. Morning Snack, Lunch, Dinner"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-neutral-800">
                Subtitle / Type <span className="font-normal text-neutral-500">(Optional)</span>
              </label>
              <Input
                value={formMealNameEn}
                onChange={(e) => setFormMealNameEn(e.target.value)}
                placeholder="e.g. Day Khana, Light Snack, Evening Meal"
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-semibold text-neutral-800">
                  Serving Time Window <span className="text-rose-600">*</span>
                </label>
                <span className="text-[11px] text-neutral-400">e.g. Start – End Time</span>
              </div>
              <Input
                value={formTime}
                onChange={(e) => setFormTime(e.target.value)}
                placeholder="e.g. 10:00 AM – 11:00 AM or 7:00 PM – 8:00 PM"
                required
              />

              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="mr-1 self-center text-[11px] text-neutral-400">Presets:</span>
                {QUICK_TIME_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      setFormTime(p.time);
                      if (!formMealName) setFormMealName(p.label);
                    }}
                    className="cursor-pointer rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] text-neutral-600 hover:border-neutral-300 hover:bg-neutral-100"
                  >
                    {p.time}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-neutral-800">
                Default Menu Description
              </label>
              <textarea
                rows={3}
                value={formMenuDescription}
                onChange={(e) => setFormMenuDescription(e.target.value)}
                placeholder="e.g. Steamed Rice, Yellow Dal, Chicken or Paneer Curry, Salad, Pickle..."
                className="focus:border-brand-black focus:ring-brand-black w-full rounded-xl border border-neutral-300 p-3 text-sm focus:outline-none focus:ring-1"
              />
            </div>

            <div className="flex items-center gap-3 pt-1">
              <input
                type="checkbox"
                id="form-is-active"
                checked={formIsActive}
                onChange={(e) => setFormIsActive(e.target.checked)}
                className="text-brand-black focus:ring-brand-black h-4 w-4 rounded border-neutral-300"
              />
              <label
                htmlFor="form-is-active"
                className="cursor-pointer text-xs font-medium text-neutral-800"
              >
                Set as Active (Visible to residents)
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-neutral-100 pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                className="bg-brand-lime text-brand-black hover:bg-brand-lime/90 font-semibold"
              >
                {editingIndex !== null ? "Update Slot" : "Add Slot"}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal: Copy Menu to Other Days */}
        <Modal
          open={copyModalOpen}
          onClose={() => setCopyModalOpen(false)}
          title={`Copy ${selectedDay} Menu to Other Days`}
          description={`Duplicate the food menu items from ${selectedDay} into your selected target days.`}
        >
          <div className="space-y-4 pt-2">
            <p className="text-xs font-semibold text-neutral-700">Select Target Days:</p>
            <div className="grid grid-cols-2 gap-2">
              {DAYS_OF_WEEK.filter((d) => d.key !== selectedDay).map((d) => {
                const isChecked = copyTargetDays.includes(d.key);
                return (
                  <label
                    key={d.key}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-xl border p-3 text-xs font-bold transition-all ${
                      isChecked
                        ? "border-neutral-900 bg-neutral-50 text-neutral-900"
                        : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setCopyTargetDays((prev) => [...prev, d.key]);
                        } else {
                          setCopyTargetDays((prev) => prev.filter((k) => k !== d.key));
                        }
                      }}
                      className="text-brand-black focus:ring-brand-black h-4 w-4 rounded border-neutral-300"
                    />
                    <span>{d.name}</span>
                  </label>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 border-t border-neutral-100 pt-3">
              <Button variant="outline" size="sm" onClick={() => setCopyModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleExecuteCopy}
                className="bg-brand-lime text-brand-black hover:bg-brand-lime/90 text-xs font-semibold"
              >
                Copy to {copyTargetDays.length} Days
              </Button>
            </div>
          </div>
        </Modal>

        {/* Modal: Delete Confirmation */}
        <Modal
          open={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          title="Delete Meal Slot"
        >
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">
              {deletingIndex !== null && dailyMeals[deletingIndex] ? (
                <>
                  Are you sure you want to remove{" "}
                  <strong>&quot;{dailyMeals[deletingIndex].mealName}&quot;</strong> from the daily
                  timetable?
                </>
              ) : (
                "Are you sure you want to remove this meal slot?"
              )}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setDeleteModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirmDelete}
                className="bg-rose-600 text-xs font-semibold text-white hover:bg-rose-700"
              >
                Delete Slot
              </Button>
            </div>
          </div>
        </Modal>

        {/* Modal: Reset Confirmation */}
        <Modal
          open={resetModalOpen}
          onClose={() => setResetModalOpen(false)}
          title="Reset to Standard Defaults?"
        >
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">
              This will restore standard meal slots (Morning Khaja, Lunch, Afternoon Khaja, Dinner)
              and reset all 7-day weekly menu descriptions.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setResetModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleResetSchedule}
                loading={isSaving}
                className="bg-rose-600 text-xs font-semibold text-white hover:bg-rose-700"
              >
                Reset to Defaults
              </Button>
            </div>
          </div>
        </Modal>

        {/* Modal: Live Resident Preview */}
        <Modal
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          title="Resident &amp; Public Preview"
        >
          <div className="max-h-[75vh] space-y-4 overflow-y-auto pr-1">
            <div className="space-y-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="flex items-center justify-between border-b border-neutral-200 pb-2.5">
                <div>
                  <h3 className="text-base font-extrabold text-neutral-900">Weekly Meal Menu</h3>
                  <p className="text-xs text-neutral-500">Live resident view</p>
                </div>
                <Badge tone="green" className="text-xs font-semibold">
                  7-Day Schedule
                </Badge>
              </div>

              <div className="space-y-3 pt-1">
                {DAYS_OF_WEEK.map((d) => {
                  const m = weeklyMenu[d.key];
                  return (
                    <div
                      key={d.key}
                      className="shadow-xs space-y-2 rounded-xl border border-neutral-200 bg-white p-3.5"
                    >
                      <div className="flex items-center justify-between border-b border-neutral-100 pb-1.5">
                        <span className="text-sm font-bold text-neutral-900">{d.name}</span>
                        {todayKey === d.key && (
                          <span className="bg-brand-lime rounded px-2 py-0.5 text-[10px] font-bold text-neutral-950">
                            Today
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                        <div className="rounded-lg border border-amber-200/50 bg-amber-50/60 p-2.5">
                          <span className="block text-[11px] font-bold text-amber-800">
                            Breakfast &amp; Khaja ({m?.breakfastTime || "10:00 AM – 11:00 AM"})
                          </span>
                          <p className="mt-1 text-[11px] leading-relaxed text-neutral-700">
                            {m?.breakfastDescription || "Standard breakfast provided"}
                          </p>
                        </div>
                        <div className="rounded-lg border border-emerald-200/50 bg-emerald-50/60 p-2.5">
                          <span className="block text-[11px] font-bold text-emerald-800">
                            Lunch &amp; Dinner (
                            {m?.mainMealTime || "12:00 PM – 1:00 PM / 7:00 PM – 8:00 PM"})
                          </span>
                          <p className="mt-1 text-[11px] leading-relaxed text-neutral-700">
                            {m?.mainMealDescription || "Wholesome meal provided"}
                          </p>
                        </div>
                      </div>
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
