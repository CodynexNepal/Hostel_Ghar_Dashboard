"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { useAuth } from "@/hooks/useAuth";
import { hostelGhar, unwrap } from "@/lib/hostelGhar";
import { getToken } from "@/lib/axios";
import type { AppNotification, NotificationCounts } from "@/lib/api-types";

export interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCounts: NotificationCounts;
  totalUnread: number;
  isLoading: boolean;
  isConnected: boolean;
  hasNewAlert: boolean;
  markAsRead: (id: string) => Promise<void>;
  markCategoryAsRead: (category: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  fetchNotifications: (page?: number, limit?: number) => Promise<void>;
  refreshCounts: () => Promise<void>;
}

const DEFAULT_COUNTS: NotificationCounts = {
  total: 0,
  byCategory: {
    booking: 0,
    bookings: 0,
    resident: 0,
    residents: 0,
    payment: 0,
    payments: 0,
    complaint: 0,
    complaints: 0,
    hostel: 0,
    hostels: 0,
    user: 0,
    users: 0,
    subscription: 0,
    subscriptions: 0,
    meal: 0,
    meals: 0,
    announcement: 0,
    announcements: 0,
    system: 0,
  },
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<NotificationCounts>(DEFAULT_COUNTS);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [hasNewAlert, setHasNewAlert] = useState<boolean>(false);

  const socketRef = useRef<Socket | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isTabVisibleRef = useRef<boolean>(true);

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Fetch Counts & Recent Notifications from Source-of-Truth DB
  // ──────────────────────────────────────────────────────────────────────────
  const refreshCounts = useCallback(async () => {
    if (!user) return;
    try {
      const res = await hostelGhar.notifications.unreadCounts();
      const counts = unwrap<NotificationCounts>(res.data);
      if (counts && typeof counts.total === "number") {
        setUnreadCounts(counts);
      }
    } catch {
      // Handled silently to avoid UI error flashes
    }
  }, [user]);

  const fetchNotifications = useCallback(
    async (page: number = 1, limit: number = 20) => {
      if (!user) return;
      setIsLoading(true);
      try {
        const res = await hostelGhar.notifications.list({ page, limit });
        const data = unwrap<AppNotification[]>(res.data);
        if (Array.isArray(data)) {
          setNotifications(data);
        }
      } catch {
        // Handled silently
      } finally {
        setIsLoading(false);
      }
    },
    [user]
  );

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Mark Single / Category / All as Read with Instant Optimistic Updates
  // ──────────────────────────────────────────────────────────────────────────
  const markAsRead = useCallback(
    async (id: string) => {
      // Optimistic state update
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
        )
      );

      // Decrement counter optimistically
      setUnreadCounts((prev) => {
        const target = notifications.find((n) => n.id === id);
        const cat = target?.entityType?.toLowerCase() || "";
        const nextTotal = Math.max(0, prev.total - 1);
        const nextCat = Math.max(0, (prev.byCategory[cat] ?? 1) - 1);
        return {
          total: nextTotal,
          byCategory: {
            ...prev.byCategory,
            [cat]: nextCat,
            [`${cat}s`]: nextCat,
          },
        };
      });

      try {
        await hostelGhar.notifications.markAsRead(id);
      } catch {
        // Re-sync on failure
        refreshCounts();
      }
    },
    [notifications, refreshCounts]
  );

  const markCategoryAsRead = useCallback(
    async (category: string) => {
      const cat = category.toLowerCase().replace(/s$/, "");
      const countForCat = unreadCounts.byCategory[cat] ?? 0;
      if (countForCat <= 0) return;

      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) =>
          n.entityType?.toLowerCase().startsWith(cat)
            ? { ...n, isRead: true, readAt: new Date().toISOString() }
            : n
        )
      );

      setUnreadCounts((prev) => {
        const currentCatCount = prev.byCategory[cat] ?? 0;
        const newTotal = Math.max(0, prev.total - currentCatCount);
        return {
          total: newTotal,
          byCategory: {
            ...prev.byCategory,
            [cat]: 0,
            [`${cat}s`]: 0,
          },
        };
      });

      try {
        await hostelGhar.notifications.markAllAsRead({ entityType: cat });
      } catch {
        refreshCounts();
      }
    },
    [unreadCounts, refreshCounts]
  );

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
    );
    setUnreadCounts({
      total: 0,
      byCategory: Object.keys(unreadCounts.byCategory).reduce(
        (acc, key) => ({ ...acc, [key]: 0 }),
        {} as Record<string, number>
      ),
    });

    try {
      await hostelGhar.notifications.markAllAsRead();
    } catch {
      refreshCounts();
    }
  }, [unreadCounts, refreshCounts]);

  const deleteNotification = useCallback(
    async (id: string) => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      try {
        await hostelGhar.notifications.delete(id);
        refreshCounts();
      } catch {
        refreshCounts();
      }
    },
    [refreshCounts]
  );

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Real-Time Socket.IO Synchronization (Bidirectional & Safe)
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCounts(DEFAULT_COUNTS);
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    let isMounted = true;
    refreshCounts();
    fetchNotifications();

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "https://api.hostelghar.com";

    async function initSocket() {
      try {
        const { io } = await import("socket.io-client");
        const token = getToken();

        const socket = io(socketUrl, {
          auth: { token },
          query: { token },
          withCredentials: true,
          transports: ["websocket", "polling"],
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 2500,
          autoConnect: true,
        });

        socketRef.current = socket;

        socket.on("connect", () => {
          if (!isMounted) return;
          setIsConnected(true);
          // Refetch to ensure no events were missed during disconnection
          refreshCounts();
          fetchNotifications();
        });

        socket.on("disconnect", () => {
          if (!isMounted) return;
          setIsConnected(false);
        });

        // Live notification event
        const handleNewNotification = (notification: AppNotification) => {
          if (!isMounted || !notification) return;
          setNotifications((prev) => [
            notification,
            ...prev.filter((n) => n.id !== notification.id),
          ]);

          // Trigger Facebook-style badge alert
          setHasNewAlert(true);
          setTimeout(() => setHasNewAlert(false), 3000);

          // Update counts
          refreshCounts();
        };

        // Live counts event
        const handleNewCounts = (counts: NotificationCounts) => {
          if (!isMounted || !counts) return;
          setUnreadCounts(counts);
        };

        socket.on("notification:received", handleNewNotification);
        socket.on("notification:new", handleNewNotification);
        socket.on("notification:counts", handleNewCounts);
      } catch {
        // Socket setup failed; adaptive polling fallback takes over smoothly
      }
    }

    initSocket();

    return () => {
      isMounted = false;
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [user, refreshCounts, fetchNotifications]);

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Adaptive Background Heartbeat / Polling (cPanel Hosting Resilient)
  //    - Polling interval: 35s when tab is active
  //    - Zero requests when tab is hidden/backgrounded
  //    - Immediate refresh on tab focus
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    function handleVisibilityChange() {
      const visible = !document.hidden;
      isTabVisibleRef.current = visible;
      if (visible) {
        // User switched back to this tab: immediately sync counts!
        refreshCounts();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Adaptive interval
    pollTimerRef.current = setInterval(() => {
      if (isTabVisibleRef.current && typeof document !== "undefined" && !document.hidden) {
        refreshCounts();
      }
    }, 35000);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, [user, refreshCounts]);

  const value: NotificationContextValue = {
    notifications,
    unreadCounts,
    totalUnread: unreadCounts.total,
    isLoading,
    isConnected,
    hasNewAlert,
    markAsRead,
    markCategoryAsRead,
    markAllAsRead,
    deleteNotification,
    fetchNotifications,
    refreshCounts,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}

export function useUnreadCounts() {
  const { unreadCounts, totalUnread, markCategoryAsRead } = useNotifications();
  return {
    total: totalUnread,
    byCategory: unreadCounts.byCategory,
    markCategoryAsRead,
  };
}
