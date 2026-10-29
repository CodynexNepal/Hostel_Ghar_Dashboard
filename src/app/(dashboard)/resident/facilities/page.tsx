"use client";
import { useCallback, useEffect, useState } from "react";
import { Utensils, Clock, CheckCircle2, Calendar } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState, EmptyState } from "@/components/ui/EmptyState";
import { useHostelFacilities } from "@/hooks/useResidentDashboard";
import { useMyRoomSummary } from "@/hooks/useMyRoomSummary";
import { hostelGhar, unwrap } from "@/lib/hostelGhar";
import type { DailyMealItem, DailyMealSchedule } from "@/lib/api-types";

const DAYS_OF_WEEK = [
  { key: "ALL", labelNp: "सबै दिन", labelEn: "All Days", shortNp: "सबै" },
  { key: "SUNDAY", labelNp: "आइतबार", labelEn: "Sunday", shortNp: "आइत" },
  { key: "MONDAY", labelNp: "सोमबार", labelEn: "Monday", shortNp: "सोम" },
  { key: "TUESDAY", labelNp: "मंगलबार", labelEn: "Tuesday", shortNp: "मंगल" },
  { key: "WEDNESDAY", labelNp: "बुधबार", labelEn: "Wednesday", shortNp: "बुध" },
  { key: "THURSDAY", labelNp: "बिहीबार", labelEn: "Thursday", shortNp: "बिही" },
  { key: "FRIDAY", labelNp: "शुक्रबार", labelEn: "Friday", shortNp: "शुक्र" },
  { key: "SATURDAY", labelNp: "शनिबार", labelEn: "Saturday", shortNp: "शनि" },
] as const;

export default function ResidentFacilitiesPage() {
  const room = useMyRoomSummary();
  const fac = useHostelFacilities(room.hostelId);

  // Auto-detect today's day of week
  const todayKey = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"][
    new Date().getDay()
  ];

  const [selectedDay, setSelectedDay] = useState<string>(todayKey);
  const [meals, setMeals] = useState<DailyMealItem[]>([]);
  const [mealsLoading, setMealsLoading] = useState(true);

  const loadMeals = useCallback(
    async (hid: string, day: string = selectedDay) => {
      setMealsLoading(true);
      try {
        const res = await hostelGhar.meals.getDaily(hid, day);
        const data = unwrap<DailyMealSchedule>(res.data);
        if (data && Array.isArray(data.schedule) && data.schedule.length > 0) {
          setMeals(data.schedule);
        } else {
          setMeals([]);
        }
      } catch {
        setMeals([]);
      } finally {
        setMealsLoading(false);
      }
    },
    [selectedDay]
  );

  useEffect(() => {
    if (room.hostelId) {
      loadMeals(room.hostelId, selectedDay);
    } else {
      setMealsLoading(false);
    }
  }, [room.hostelId, selectedDay, loadMeals]);

  const currentDayInfo = DAYS_OF_WEEK.find((d) => d.key === selectedDay);

  return (
    <DashboardShell title="Facilities &amp; Meals" subtitle={room.hostelName}>
      <div className="space-y-6">
        {/* Daily Meal Schedule Card */}
        <Card>
          <div className="flex flex-col gap-3 border-b border-surface-border p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-brand-lime/20 text-brand-black rounded-lg p-1.5">
                  <Utensils size={18} />
                </span>
                <h2 className="text-base font-bold text-neutral-900">
                  दैनिक भोजन तालिका (Daily Meal Schedule)
                </h2>
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                Daily meal and snack schedule specified by your hostel management for each day of
                the week.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone="green" className="text-xs">
                <CheckCircle2 size={12} className="mr-1" />
                {currentDayInfo?.labelNp} ({currentDayInfo?.labelEn})
              </Badge>
            </div>
          </div>

          {/* Day of Week Selector for Residents */}
          <div className="border-b border-neutral-100 bg-neutral-50/60 px-5 py-3">
            <div className="scrollbar-thin flex items-center gap-1.5 overflow-x-auto pb-1">
              {DAYS_OF_WEEK.map((d) => {
                const isSelected = selectedDay === d.key;
                const isToday = d.key === todayKey;
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => setSelectedDay(d.key)}
                    className={`flex shrink-0 cursor-pointer flex-col items-center rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                      isSelected
                        ? "bg-neutral-900 text-white shadow-sm ring-1 ring-neutral-900"
                        : "border border-neutral-200/80 bg-white text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <span>{d.labelNp}</span>
                      {isToday && (
                        <span className="bg-brand-lime rounded px-1 text-[9px] font-bold text-neutral-950">
                          आज
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-[10px] ${
                        isSelected ? "text-neutral-300" : "text-neutral-400"
                      }`}
                    >
                      {d.labelEn}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {mealsLoading ? (
            <div className="space-y-2 p-5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
            </div>
          ) : meals.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="यस दिनको लागि कुनै भोजन तालिका प्रकाशित छैन"
                description="Your hostel has not published a meal schedule for this day yet."
              />
            </div>
          ) : (
            <div className="divide-y divide-neutral-100 overflow-hidden sm:divide-y-0 sm:p-5">
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full text-left text-sm text-neutral-700">
                  <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold text-neutral-800">
                    <tr>
                      <th scope="col" className="w-16 px-4 py-3 text-center">
                        क्र.सं. (S.N.)
                      </th>
                      <th scope="col" className="px-4 py-3">
                        खानाको प्रकार (Meal Slot)
                      </th>
                      <th scope="col" className="px-4 py-3">
                        समय (Serving Time)
                      </th>
                      <th scope="col" className="px-4 py-3">
                        मेनु / परिकार विवरण (Menu Items)
                      </th>
                      <th scope="col" className="w-24 px-4 py-3 text-center">
                        अवस्था (Status)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {meals.map((meal, index) => (
                      <tr
                        key={meal.id ?? `meal-${index}`}
                        className={!meal.isActive ? "opacity-60" : ""}
                      >
                        <td className="px-4 py-3 text-center font-mono text-xs font-bold text-neutral-500">
                          {index + 1}
                        </td>
                        <td className="px-4 py-3 font-semibold text-neutral-900">
                          {meal.mealName}
                          {meal.mealNameEn && (
                            <span className="block text-xs font-normal text-neutral-500">
                              {meal.mealNameEn}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-800">
                            <Clock size={11} className="text-neutral-500" />
                            {meal.time}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-neutral-600">
                          {meal.menuDescription || "—"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {meal.isActive ? (
                            <Badge tone="green" className="text-xs">
                              सक्रिय
                            </Badge>
                          ) : (
                            <Badge tone="gray" className="text-xs">
                              निष्क्रिय
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile View */}
              <div className="divide-y divide-neutral-100 sm:hidden">
                {meals.map((meal, index) => (
                  <div key={`m-res-${index}`} className="space-y-2 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-neutral-900">
                        {meal.mealName}
                        {meal.mealNameEn && (
                          <span className="ml-1 text-xs font-normal text-neutral-500">
                            ({meal.mealNameEn})
                          </span>
                        )}
                      </span>
                      {meal.isActive ? (
                        <Badge tone="green" className="text-xs">
                          सक्रिय
                        </Badge>
                      ) : (
                        <Badge tone="gray" className="text-xs">
                          निष्क्रिय
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-neutral-500">
                      <Clock size={11} />
                      <span>{meal.time}</span>
                    </div>
                    {meal.menuDescription && (
                      <p className="rounded bg-neutral-50 p-2 text-xs text-neutral-700">
                        {meal.menuDescription}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Existing Hostel Facilities Section */}
        <Card>
          <CardHeader title="Hostel Facilities" subtitle="Amenities available at this hostel" />
          {fac.isLoading ? (
            <div className="space-y-2 p-5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
            </div>
          ) : fac.error ? (
            <div className="p-5">
              <ErrorState
                title="Failed to load facilities"
                description={fac.error.message}
                onRetry={fac.retry}
              />
            </div>
          ) : (fac.data ?? []).length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No facilities listed"
                description="Your hostel has not published a facility list yet."
              />
            </div>
          ) : (
            <div className="grid gap-3 p-5 sm:grid-cols-2">
              {(fac.data ?? []).map((f) => (
                <div key={f.id} className="rounded-lg border border-surface-border p-4">
                  <p className="flex items-center justify-between gap-2 text-sm font-semibold">
                    <span className="min-w-0 truncate">{f.title}</span>
                    <Badge tone="gray" className="shrink-0">
                      {f.tag}
                    </Badge>
                  </p>
                  <p className="mt-1 text-[13px] text-neutral-500">{f.description || "—"}</p>
                  {f.slug ? (
                    <p className="mt-2 text-xs text-neutral-400">
                      {f.slug}
                      {f.clientKey ? ` · ${f.clientKey}` : ""}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </DashboardShell>
  );
}
