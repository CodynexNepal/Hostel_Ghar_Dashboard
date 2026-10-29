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
  ArrowUp,
  ArrowDown,
  Sparkles,
  Coffee,
  Sun,
  Moon,
  Info,
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

const DEFAULT_MEAL_SLOTS: DailyMealItem[] = [
  {
    mealName: "Morning Breakfast",
    mealNameEn: "Breakfast",
    time: "7:00 AM – 8:00 AM",
    menuDescription: "Milk Tea, Boiled Eggs, Toast with Jam, or Bread & Butter",
    isActive: true,
    orderIndex: 1,
  },
  {
    mealName: "Morning Snack",
    mealNameEn: "Light Khaja",
    time: "10:00 AM – 11:00 AM",
    menuDescription: "Fried Grams (Chana), Beaten Rice (Chiura), Black Tea",
    isActive: true,
    orderIndex: 2,
  },
  {
    mealName: "Lunch",
    mealNameEn: "Main Meal",
    time: "12:00 PM – 1:30 PM",
    menuDescription: "Steamed Rice, Lentils (Dal), Seasonal Curry, Papad, and Fresh Pickle",
    isActive: true,
    orderIndex: 3,
  },
  {
    mealName: "Afternoon Snack",
    mealNameEn: "Evening Khaja",
    time: "4:00 PM – 5:00 PM",
    menuDescription: "Chowmein, Samosa, or Biscuits served with Hot Tea",
    isActive: true,
    orderIndex: 4,
  },
  {
    mealName: "Dinner",
    mealNameEn: "Evening Meal",
    time: "7:30 PM – 9:00 PM",
    menuDescription: "Steamed Rice, Yellow Dal, Chicken / Paneer Curry, and Seasonal Green Saag",
    isActive: true,
    orderIndex: 5,
  },
];

const QUICK_TIME_PRESETS = [
  { label: "Morning Breakfast", time: "7:00 AM – 8:30 AM" },
  { label: "Morning Snack", time: "10:00 AM – 11:00 AM" },
  { label: "Afternoon Lunch", time: "12:00 PM – 1:30 PM" },
  { label: "Evening Snack", time: "4:00 PM – 5:00 PM" },
  { label: "Night Dinner", time: "7:30 PM – 9:00 PM" },
];

export default function DailyMealsPage() {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();

  const [activeHostelId, setActiveHostelId] = useState<string | null>(null);
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
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Form State for Add / Edit
  const [formMealName, setFormMealName] = useState("");
  const [formMealNameEn, setFormMealNameEn] = useState("");
  const [formTime, setFormTime] = useState("");
  const [formMenuDescription, setFormMenuDescription] = useState("");
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
          // Ignore
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

  // 2. Fetch Daily Meal Schedule
  const loadSchedule = useCallback(async (hid: string) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await hostelGhar.meals.getDaily(hid);
      const data = unwrap<DailyMealSchedule>(res.data);
      if (data && Array.isArray(data.schedule) && data.schedule.length > 0) {
        const loaded = data.schedule.map((item, idx) => ({
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
        setMeals(loaded);
        setOriginalMeals(loaded);
        setIsConfigured(Boolean(data.isConfigured));
        setLastUpdatedAt(data.lastUpdatedAt ?? null);
      } else {
        setMeals(DEFAULT_MEAL_SLOTS);
        setOriginalMeals(DEFAULT_MEAL_SLOTS);
        setIsConfigured(false);
        setLastUpdatedAt(null);
      }
    } catch (err: unknown) {
      const apiErr = toApiError(err);
      if (apiErr.status === 404 || apiErr.message?.includes("not found")) {
        setMeals(DEFAULT_MEAL_SLOTS);
        setOriginalMeals(DEFAULT_MEAL_SLOTS);
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
      loadSchedule(activeHostelId);
    } else {
      setIsLoading(false);
    }
  }, [activeHostelId, loadSchedule]);

  // Check if form has unsaved modifications
  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(meals) !== JSON.stringify(originalMeals);
  }, [meals, originalMeals]);

  // Active meals count
  const activeCount = useMemo(() => {
    return meals.filter((m) => m.isActive).length;
  }, [meals]);

  // Open Modal for Add
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

  // Open Modal for Edit
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

  // Save Modal (Add or Edit)
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
        editingMeal?.orderIndex ?? (editingIndex !== null ? editingIndex + 1 : meals.length + 1),
    };

    if (editingIndex !== null && editingIndex >= 0) {
      const next = [...meals];
      next[editingIndex] = updatedItem;
      setMeals(next);
      success("Meal updated locally. Click 'Save Schedule' to apply changes.");
    } else {
      setMeals([...meals, updatedItem]);
      success("New meal slot added. Click 'Save Schedule' to apply changes.");
    }

    setEditModalOpen(false);
  };

  // Toggle active status inline
  const handleToggleActive = (index: number) => {
    const next = [...meals];
    next[index] = { ...next[index], isActive: !next[index].isActive };
    setMeals(next);
  };

  // Move Meal Up in Order
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const next = [...meals];
    const temp = next[index - 1];
    next[index - 1] = next[index];
    next[index] = temp;
    setMeals(next.map((m, idx) => ({ ...m, orderIndex: idx + 1 })));
  };

  // Move Meal Down in Order
  const handleMoveDown = (index: number) => {
    if (index === meals.length - 1) return;
    const next = [...meals];
    const temp = next[index + 1];
    next[index + 1] = next[index];
    next[index] = temp;
    setMeals(next.map((m, idx) => ({ ...m, orderIndex: idx + 1 })));
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
    success(`"${removedMeal.mealName}" removed. Remember to save changes.`);
  };

  // Persist All Daily Meals (PUT /hostels/:hostelId/meals/daily)
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
      }));

      const res = await hostelGhar.meals.saveDaily(activeHostelId, payload);
      const data = unwrap<DailyMealSchedule>(res.data);
      success("Daily meal schedule saved successfully.");

      if (data && Array.isArray(data.schedule) && data.schedule.length > 0) {
        setMeals(data.schedule);
        setOriginalMeals(data.schedule);
        setIsConfigured(true);
        setLastUpdatedAt(data.lastUpdatedAt ?? new Date().toISOString());
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

  // Reset to Defaults
  const handleResetSchedule = async () => {
    if (!activeHostelId) return;
    setIsSaving(true);
    try {
      await hostelGhar.meals.clearDaily(activeHostelId);
      setMeals(DEFAULT_MEAL_SLOTS);
      setOriginalMeals(DEFAULT_MEAL_SLOTS);
      setIsConfigured(false);
      setLastUpdatedAt(null);
      setResetModalOpen(false);
      success("Meal schedule reset to standard defaults.");
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
        subtitle="Configure daily meal slots, serving hours, menus, and resident visibility for your hostel."
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
                    {isConfigured ? (
                      <Badge tone="green" className="ml-1 text-xs font-semibold">
                        <CheckCircle2 size={12} className="mr-1" /> Published
                      </Badge>
                    ) : (
                      <Badge tone="gray" className="ml-1 text-xs">
                        Standard Defaults
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
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenAddModal}
                disabled={isLoading}
                className="bg-brand-lime/10 border-brand-lime/40 text-brand-black hover:bg-brand-lime/20 text-xs font-semibold"
              >
                <Plus size={14} className="mr-1.5" /> Add Meal Slot
              </Button>
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

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            <Card className="shadow-xs border-neutral-200/80 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-500">Total Slots</span>
                <span className="rounded-lg bg-neutral-100 p-1.5 text-neutral-600">
                  <Utensils size={14} />
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold text-neutral-900">{meals.length}</p>
              <p className="mt-0.5 text-[11px] text-neutral-500">Configured meal slots</p>
            </Card>

            <Card className="shadow-xs border-neutral-200/80 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-500">Active Slots</span>
                <span className="rounded-lg bg-emerald-50 p-1.5 text-emerald-600">
                  <Check size={14} />
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold text-emerald-700">{activeCount}</p>
              <p className="mt-0.5 text-[11px] text-neutral-500">Visible to residents</p>
            </Card>

            <Card className="shadow-xs border-neutral-200/80 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-500">Schedule Status</span>
                <span className="rounded-lg bg-blue-50 p-1.5 text-blue-600">
                  <Sparkles size={14} />
                </span>
              </div>
              <p className="mt-2 text-base font-bold text-neutral-900">
                {isConfigured ? "Published Live" : "Draft / Defaults"}
              </p>
              <p className="mt-0.5 text-[11px] text-neutral-500">
                {isConfigured ? "Syncs with resident app" : "Click Save to publish"}
              </p>
            </Card>

            <Card className="shadow-xs border-neutral-200/80 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-500">Last Synced</span>
                <span className="rounded-lg bg-amber-50 p-1.5 text-amber-600">
                  <Clock size={14} />
                </span>
              </div>
              <p className="mt-2 text-sm font-bold text-neutral-900">
                {lastUpdatedAt
                  ? new Date(lastUpdatedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  : "Never"}
              </p>
              <p className="mt-0.5 text-[11px] text-neutral-500">
                {lastUpdatedAt
                  ? new Date(lastUpdatedAt).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : "Using initial setup"}
              </p>
            </Card>
          </div>

          {/* Unsaved changes notification banner */}
          {hasUnsavedChanges && (
            <div className="shadow-xs animate-in fade-in flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50/90 p-4 text-amber-900 duration-200">
              <div className="flex items-center gap-3">
                <AlertCircle size={18} className="shrink-0 text-amber-600" />
                <div>
                  <p className="text-xs font-semibold sm:text-sm">You have unsaved changes</p>
                  <p className="text-[11px] text-amber-700 sm:text-xs">
                    Remember to click &quot;Save Schedule&quot; so residents can see the updated
                    meal timings.
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

          {/* Main Content Area */}
          {isLoading ? (
            <TableSkeleton rows={5} />
          ) : loadError ? (
            <ErrorState
              title="Failed to load meal schedule"
              description={loadError}
              onRetry={() => activeHostelId && loadSchedule(activeHostelId)}
            />
          ) : meals.length === 0 ? (
            <EmptyState
              title="No meal slots configured"
              description="Add your first daily meal slot to set up the breakfast, lunch, or dinner timetable."
              action={
                <Button onClick={handleOpenAddModal} className="bg-brand-lime text-brand-black">
                  Add Meal Slot
                </Button>
              }
            />
          ) : (
            <Card className="shadow-xs overflow-hidden border border-neutral-200/80 bg-white">
              {/* Header inside table card */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200/80 bg-neutral-50/60 px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-neutral-800">
                    Daily Timetable ({meals.length} Meals)
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
                  <span>{meals.length - activeCount} Inactive</span>
                </div>
              </div>

              {/* Desktop / Tablet Meal Table */}
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
                      <th scope="col" className="w-48 px-4 py-3 font-bold">
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
                    {meals.map((meal, index) => (
                      <tr
                        key={meal.id ?? `meal-${index}`}
                        className={`transition-colors hover:bg-neutral-50/70 ${
                          !meal.isActive ? "bg-neutral-50/40 opacity-70" : ""
                        }`}
                      >
                        {/* 1. Order & Reorder arrows */}
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
                                disabled={index === meals.length - 1}
                                onClick={() => handleMoveDown(index)}
                                title="Move Down"
                                className="cursor-pointer rounded p-0.5 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-800 disabled:cursor-not-allowed disabled:opacity-20"
                              >
                                <ArrowDown size={11} />
                              </button>
                            </div>
                          </div>
                        </td>

                        {/* 2. Meal Slot Name & Subtitle */}
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-neutral-900">{meal.mealName}</div>
                          {meal.mealNameEn && (
                            <div className="text-xs text-neutral-500">{meal.mealNameEn}</div>
                          )}
                        </td>

                        {/* 3. Serving Time */}
                        <td className="px-4 py-3.5">
                          <div className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200/80 bg-neutral-100/80 px-2.5 py-1 text-xs font-semibold text-neutral-800">
                            <Clock size={12} className="shrink-0 text-neutral-500" />
                            <span>{meal.time}</span>
                          </div>
                        </td>

                        {/* 4. Menu Description */}
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

                        {/* 5. Status Toggle */}
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

                        {/* 6. Actions */}
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEditModal(meal, index)}
                              className="h-8 w-8 p-0 text-neutral-600 hover:bg-neutral-200/60 hover:text-neutral-900"
                              title="Edit meal slot"
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
                              title="Delete meal slot"
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

              {/* Mobile Friendly Card Layout */}
              <div className="divide-y divide-neutral-200/80 md:hidden">
                {meals.map((meal, index) => (
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
                          disabled={index === meals.length - 1}
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

        {/* Modal: Add or Edit Meal */}
        <Modal
          open={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          title={editingIndex !== null ? "Edit Meal Slot" : "Add Meal Slot"}
          description="Define the meal name, serving time window, menu items, and visibility status."
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
                placeholder="e.g. Morning Breakfast, Lunch, Dinner"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-neutral-800">
                Subtitle / Alternate Name{" "}
                <span className="font-normal text-neutral-500">(Optional)</span>
              </label>
              <Input
                value={formMealNameEn}
                onChange={(e) => setFormMealNameEn(e.target.value)}
                placeholder="e.g. Light Snack, Evening Khaja, Khana"
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
                placeholder="e.g. 7:00 AM – 8:30 AM or 12:00 PM – 1:30 PM"
                required
              />

              {/* Quick Preset Chips */}
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
                Menu Items &amp; Description
              </label>
              <textarea
                rows={3}
                value={formMenuDescription}
                onChange={(e) => setFormMenuDescription(e.target.value)}
                placeholder="e.g. Steamed Rice, Yellow Dal, Chicken or Paneer Curry, Seasonal Salad, Pickle..."
                className="focus:border-brand-black focus:ring-brand-black w-full rounded-xl border border-neutral-300 p-3 text-sm focus:outline-none focus:ring-1"
              />
              <p className="mt-1 text-[11px] text-neutral-500">
                Residents will see this description when viewing the mess schedule.
              </p>
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
                Set as Active (Visible to residents on dashboard and facilities)
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

        {/* Modal: Delete Confirmation */}
        <Modal
          open={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          title="Delete Meal Slot"
        >
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">
              {deletingIndex !== null && meals[deletingIndex] ? (
                <>
                  Are you sure you want to remove{" "}
                  <strong>&quot;{meals[deletingIndex].mealName}&quot;</strong> from the daily
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
                Delete Meal Slot
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
              This will reset all meal slots back to the 5 standard daily meals (Breakfast, Morning
              Snack, Lunch, Afternoon Snack, Dinner).
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
                  <h3 className="text-base font-extrabold text-neutral-900">Hostel Meal Timings</h3>
                  <p className="text-xs text-neutral-500">Live resident app view</p>
                </div>
                <Badge tone="green" className="text-xs font-semibold">
                  Nutritious &amp; Hygienic
                </Badge>
              </div>

              <div className="space-y-2.5 pt-1">
                {meals
                  .filter((m) => m.isActive)
                  .map((m, idx) => (
                    <div
                      key={`prev-${idx}`}
                      className="shadow-xs space-y-1.5 rounded-xl border border-neutral-200 bg-white p-3.5"
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
                        <span className="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700">
                          <Clock size={11} className="text-neutral-500" />
                          {m.time}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed text-neutral-600">
                        {m.menuDescription || "Standard wholesome mess meal provided."}
                      </p>
                    </div>
                  ))}
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
