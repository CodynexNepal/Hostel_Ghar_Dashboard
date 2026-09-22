"use client";
import { useMemo } from "react";
import {
  useMyResidence,
  useResidentHostel,
  useResolvedHostelId,
} from "@/hooks/useResidentDashboard";
import { useAuth } from "@/hooks/useAuth";

export function useMyRoomSummary() {
  const { user } = useAuth();
  const { hostelId, isResolving } = useResolvedHostelId();
  const hostel = useResidentHostel(hostelId);
  const residence = useMyResidence(hostelId);
  const myRoom = residence.data ?? null;
  const hostelName = myRoom?.hostelName || hostel.data?.name || user?.hostelName || "My Hostel";
  const roomLabel = myRoom
    ? `Room ${myRoom.roomNumber || "—"} · Bed ${myRoom.bedNumber || "—"}`
    : isResolving || hostel.isLoading || residence.isLoading
      ? "Loading your room…"
      : "Room not assigned yet";
  const isLoading = isResolving || hostel.isLoading || residence.isLoading;
  const error = hostel.error ?? residence.error;
  const retry = () => {
    hostel.retry();
    residence.retry();
  };
  const summary = useMemo(
    () => ({
      hostelId,
      hostelName,
      roomLabel,
      myRoom,
      hostelDetail: hostel.data,
      forbidden: residence.forbidden,
      isLoading,
      error,
      retry,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hostelId, hostelName, roomLabel, myRoom, hostel.data, residence.forbidden, isLoading, error]
  );
  return summary;
}
