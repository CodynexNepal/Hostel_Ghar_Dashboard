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
    time: "7:00 AM–8:00 AM",
    menuDescription: "Milk Tea, Boiled Eggs, Bread & Jam",
    isActive: true,
    orderIndex: 1,
  },
  {
    mealName: "Morning Snack",
    mealNameEn: "Morning Khaja",
    time: "10:00 AM–11:00 AM",
    menuDescription: "Beaten Rice (Chiura), Fried Grams (Chana), Black Tea",
    isActive: true,
    orderIndex: 2,
  },
  {
    mealName: "Lunch",
    mealNameEn: "Lunch / Khana",
    time: "12:00 PM–1:00 PM",
    menuDescription: "Rice, Lentils (Dal), Seasonal Curry, Pickle (Achar), Papad",
    isActive: true,
    orderIndex: 3,
  },
  {
    mealName: "Afternoon Snack",
    mealNameEn: "Afternoon Khaja",
    time: "2:00 PM–3:00 PM",
    menuDescription: "Chowmein / Samosa / Biscuits with Tea",
    isActive: true,
    orderIndex: 4,
  },
  {
    mealName: "Dinner",
    mealNameEn: "Dinner / Khana",
    time: "7:00 PM–8:00 PM",
    menuDescription: "Rice, Lentils (Dal), Chicken or Paneer Curry, Spinach (Saag)",
    isActive: true,
    orderIndex: 5,
  },
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
  const [clearModalOpen, setClearModalOpen] = useState(false);
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

  // Track unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(meals) !== JSON.stringify(originalMeals);
  }, [meals, originalMeals]);

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
      success("Meal updated. Remember to click Save.");
    } else {
      setMeals([...meals, updatedItem]);
      success("New meal added. Remember to click Save.");
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
    success(`"${removedMeal.mealName}" removed. Remember to click Save.`);
  };

  // 3. Persist All Daily Meals (PUT /hostels/:hostelId/meals/daily)
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

  // 4. Reset All Meals
  const handleResetSchedule = async () => {
    if (!activeHostelId) return;
    setIsSaving(true);
    try {
      await hostelGhar.meals.clearDaily(activeHostelId);
      setMeals(DEFAULT_MEAL_SLOTS);
      setOriginalMeals(DEFAULT_MEAL_SLOTS);
      setIsConfigured(false);
      setLastUpdatedAt(null);
      setClearModalOpen(false);
      success("Meal schedule reset to default values.");
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
        subtitle="Configure meal names, serving times, menu items, and availability for your hostel."
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
                  Daily Meal Schedule
                </h1>
                {isConfigured ? (
                  <Badge tone="green" className="ml-2">
                    <CheckCircle2 size={12} className="mr-1" /> Active
                  </Badge>
                ) : (
                  <Badge tone="gray" className="ml-2">
                    Defaults
                  </Badge>
                )}
              </div>
              <p className="max-w-2xl text-sm text-neutral-500">
                Manage daily meal slots, serving timings, menu items, and availability for your
                hostel residents.
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
                <Eye size={14} className="mr-1" /> Preview
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setClearModalOpen(true)}
                disabled={isLoading}
                className="border-rose-200 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700"
              >
                <RotateCcw size={13} className="mr-1" /> Reset
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenAddModal}
                disabled={isLoading}
                className="bg-brand-lime/10 border-brand-lime/40 text-brand-black hover:bg-brand-lime/20 text-xs font-semibold"
              >
                <Plus size={14} className="mr-1" /> Add Meal
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveAll}
                loading={isSaving}
                disabled={isLoading}
                className="bg-brand-lime text-brand-black hover:bg-brand-lime/90 px-3.5 text-xs font-semibold"
              >
                <Save size={14} className="mr-1.5" /> Save Schedule
              </Button>
            </div>
          </div>

          {/* Unsaved changes banner */}
          {hasUnsavedChanges && (
            <div className="shadow-xs animate-in fade-in flex items-center justify-between gap-3 rounded-xl border border-amber-200/80 bg-amber-50 p-3.5 text-sm text-amber-900 duration-200">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0 text-amber-600" />
                <span className="text-xs font-medium sm:text-sm">
                  You have unsaved changes. Click &quot;Save Schedule&quot; to persist changes to
                  the database.
                </span>
              </div>
              <Button
                size="sm"
                onClick={handleSaveAll}
                loading={isSaving}
                className="shrink-0 bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700"
              >
                Save Now
              </Button>
            </div>
          )}

          {/* Info bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200/60 bg-neutral-50 px-4 py-2.5 text-xs text-neutral-600">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-neutral-500" />
              <span>
                Daily Meal Slots: <strong>{meals.length} Configured Slots</strong>
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
              title="No meals configured"
              description="Click the button below to add daily meals and serving schedules for your hostel."
              action={<Button onClick={handleOpenAddModal}>Add Meal</Button>}
            />
          ) : (
            <Card className="shadow-xs overflow-hidden border border-neutral-200/80 bg-white">
              {/* Desktop / Tablet Redesigned Meal Table */}
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full text-left text-sm text-neutral-700">
                  <thead className="border-b border-neutral-200 bg-neutral-50/80 text-xs font-semibold text-neutral-800">
                    <tr>
                      <th scope="col" className="w-16 px-4 py-3.5 text-center font-bold">
                        S.N.
                      </th>
                      <th scope="col" className="px-5 py-3.5 font-bold">
                        Meal Slot
                      </th>
                      <th scope="col" className="w-48 px-4 py-3.5 font-bold">
                        Serving Time
                      </th>
                      <th scope="col" className="px-5 py-3.5 font-bold">
                        Menu Items
                      </th>
                      <th scope="col" className="w-28 px-4 py-3.5 text-center font-bold">
                        Status
                      </th>
                      <th scope="col" className="w-32 px-4 py-3.5 text-right font-bold">
                        Actions
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
                              No menu items added
                            </span>
                          )}
                        </td>

                        {/* 5. Status */}
                        <td className="px-4 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleActive(index)}
                            className="cursor-pointer transition-transform hover:scale-105"
                            title="Click to toggle active status"
                          >
                            {meal.isActive ? (
                              <Badge tone="green" className="text-xs">
                                Active
                              </Badge>
                            ) : (
                              <Badge tone="gray" className="text-xs">
                                Inactive
                              </Badge>
                            )}
                          </button>
                        </td>

                        {/* 6. Actions */}
                        <td className="px-4 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEditModal(meal, index)}
                              className="h-8 w-8 p-0 text-neutral-600 hover:bg-neutral-200/60 hover:text-neutral-900"
                              title="Edit meal"
                            >
                              <Edit2 size={14} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setDeletingIndex(index);
                                setDeleteModalOpen(true);
                              }}
                              className="h-8 w-8 p-0 text-rose-500 hover:bg-rose-50 hover:text-rose-700"
                              title="Delete meal"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Friendly Card Layout */}
              <div className="divide-y divide-neutral-200/80 sm:hidden">
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
                        className="shrink-0"
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

                    <div className="flex w-fit items-center gap-1.5 rounded-md bg-neutral-100/60 px-2.5 py-1 text-xs text-neutral-600">
                      <Clock size={12} className="shrink-0 text-neutral-500" />
                      <span>{meal.time}</span>
                    </div>

                    <p className="text-xs leading-relaxed text-neutral-700">
                      {meal.menuDescription || (
                        <span className="italic text-neutral-400">No menu items added</span>
                      )}
                    </p>

                    <div className="flex items-center justify-end gap-2 border-t border-neutral-100 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEditModal(meal, index)}
                        className="text-xs"
                      >
                        <Edit2 size={13} className="mr-1" /> Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setDeletingIndex(index);
                          setDeleteModalOpen(true);
                        }}
                        className="border-rose-200 text-xs text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 size={13} className="mr-1" /> Delete
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
          title={editingIndex !== null ? "Edit Meal Slot" : "Add Meal Slot"}
          description="Enter meal slot name, serving time window, menu details, and availability status."
        >
          <form onSubmit={handleSaveModal} className="space-y-4 pt-1">
            {formError && (
              <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{formError}</div>
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
                placeholder="e.g. Morning Breakfast, Khana"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-neutral-800">
                Serving Time Window <span className="text-rose-600">*</span>
              </label>
              <Input
                value={formTime}
                onChange={(e) => setFormTime(e.target.value)}
                placeholder="e.g. 7:00 AM–8:00 AM or 12:00 PM–1:00 PM"
                required
              />
              <p className="mt-1 text-[11px] text-neutral-500">
                Specify start and end times according to your hostel schedule.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-neutral-800">
                Menu Items &amp; Description
              </label>
              <textarea
                rows={3}
                value={formMenuDescription}
                onChange={(e) => setFormMenuDescription(e.target.value)}
                placeholder="e.g. Rice, Lentils, Seasonal Curry, Chicken / Paneer..."
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
                Mark meal as Active
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
                {editingIndex !== null ? "Update Meal" : "Add Meal"}
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
                  <strong>&quot;{meals[deletingIndex].mealName}&quot;</strong> from the schedule?
                </>
              ) : (
                "Are you sure you want to remove this meal?"
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
                Delete Meal
              </Button>
            </div>
          </div>
        </Modal>

        {/* Modal: Reset Confirmation */}
        <Modal
          open={clearModalOpen}
          onClose={() => setClearModalOpen(false)}
          title="Reset to Default Schedule?"
        >
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">
              This will reset all current meal slots back to the standard defaults (Breakfast,
              Morning Snack, Lunch, Afternoon Snack, Dinner).
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setClearModalOpen(false)}>
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

        {/* Modal: Public Preview */}
        <Modal
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          title="Resident &amp; Public Preview"
        >
          <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
            <div className="space-y-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
                <div>
                  <h3 className="text-base font-extrabold text-neutral-900">Daily Meal Schedule</h3>
                  <p className="text-xs text-neutral-500">Hostel Mess Timings</p>
                </div>
                <Badge tone="green" className="text-xs">
                  Hygienic &amp; Nutritious
                </Badge>
              </div>

              <div className="space-y-2 pt-1">
                {meals
                  .filter((m) => m.isActive)
                  .map((m, idx) => (
                    <div
                      key={`prev-${idx}`}
                      className="space-y-1 rounded-xl border border-neutral-200 bg-white p-3"
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
                        {m.menuDescription || "No menu items specified"}
                      </p>
                    </div>
                  ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setPreviewOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      </DashboardShell>
    </Protected>
  );
}
