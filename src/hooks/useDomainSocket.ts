"use client";

import { useEffect, useRef } from "react";
import {
  connectSocket,
  joinSessionRooms,
  socketEvents,
  type SocketDomainEvent,
} from "@/lib/hostelGhar";

interface UseDomainSocketOpts {
  userId?: string | null;
  role?: string | null;
  hostelId?: string | null;
  events?: SocketDomainEvent[];
  onEvent?: (event: SocketDomainEvent, payload: unknown) => void;
  enabled?: boolean;
}

/**
 * Joins backend socket rooms `user:<id>`, `role:<ROLE>`, `hostel:<id>` and
 * subscribes to domain events (`hostel:updated`, `booking:confirmed`,
 * `leave:status_changed`, `payment:processed`).
 * No-op when NEXT_PUBLIC_SOCKET_URL is unset (REST polling remains).
 */
export function useDomainSocket({
  userId,
  role,
  hostelId,
  events = [
    socketEvents.hostelUpdated,
    socketEvents.bookingConfirmed,
    socketEvents.leaveStatusChanged,
    socketEvents.paymentProcessed,
  ],
  onEvent,
  enabled = true,
}: UseDomainSocketOpts) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    if (!process.env.NEXT_PUBLIC_SOCKET_URL) return;
    let cancelled = false;
    let socket: {
      emit: (event: string, ...args: unknown[]) => void;
      on: (event: string, cb: (payload: unknown) => void) => void;
      off: (event: string, cb: (payload: unknown) => void) => void;
      disconnect: () => void;
    } | null = null;

    async function start() {
      const s = (await connectSocket()) as typeof socket | null;
      if (!s || cancelled) {
        s?.disconnect();
        return;
      }
      socket = s;
      joinSessionRooms(s, { userId, role, hostelId });
      for (const event of events) {
        s.on(event, (payload: unknown) => onEventRef.current?.(event, payload));
      }
    }
    void start();

    return () => {
      cancelled = true;
      if (socket) {
        for (const event of events) {
          socket.off(event, () => undefined);
        }
        socket.disconnect();
        socket = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, userId, role, hostelId]);
}
