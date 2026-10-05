import type { StaffMember } from "@/lib/staff-store";
import { INITIAL_STAFF } from "@/lib/staff-store";

export interface HttpLog {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  statusCode: number;
  statusText: string;
  durationMs: number;
  timestamp: string;
  requestPayload?: unknown;
  responseBody?: unknown;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  log: HttpLog;
}

const STORAGE_KEY = "hg_staff_directory_v1";

function getLocalStoredStaff(): StaffMember[] {
  if (typeof window === "undefined") return INITIAL_STAFF;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_STAFF));
      return INITIAL_STAFF;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_STAFF;
  } catch {
    return INITIAL_STAFF;
  }
}

function saveLocalStaff(staff: StaffMember[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(staff));
    window.dispatchEvent(new CustomEvent("hg:staff-updated"));
  } catch {
    // ignore
  }
}

export const staffApi = {
  /** GET /api/staff or GET /api/staff/:id */
  async get(id?: string): Promise<ApiResponse<StaffMember[] | StaffMember>> {
    const start = performance.now();
    const url = id ? `/api/staff/${id}` : "/api/staff";

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const data = await res.json();
      const durationMs = Math.round(performance.now() - start);

      const log: HttpLog = {
        method: "GET",
        url,
        statusCode: res.status,
        statusText: res.statusText || "OK",
        durationMs,
        timestamp: new Date().toLocaleTimeString(),
        responseBody: data,
      };

      if (res.ok) {
        return { success: true, data: data.data, log };
      }
      throw new Error(data.error || "GET request failed");
    } catch {
      // Local fallback for offline / mock mode
      const durationMs = Math.round(performance.now() - start) || 28;
      const local = getLocalStoredStaff();

      if (id) {
        const found = local.find((s) => s.id === id);
        const log: HttpLog = {
          method: "GET",
          url,
          statusCode: found ? 200 : 404,
          statusText: found ? "OK" : "Not Found",
          durationMs,
          timestamp: new Date().toLocaleTimeString(),
          responseBody: found
            ? { success: true, message: "Staff retrieved (GET)", data: found }
            : { success: false, error: `Staff ${id} not found` },
        };
        if (!found) throw new Error(`Staff member '${id}' not found`);
        return { success: true, data: found, log };
      }

      const log: HttpLog = {
        method: "GET",
        url,
        statusCode: 200,
        statusText: "OK",
        durationMs,
        timestamp: new Date().toLocaleTimeString(),
        responseBody: { success: true, count: local.length, data: local },
      };
      return { success: true, data: local, log };
    }
  },

  /** POST /api/staff — Add a new staff member */
  async post(
    payload: Omit<StaffMember, "id" | "createdAt" | "updatedAt">
  ): Promise<ApiResponse<StaffMember>> {
    const start = performance.now();
    const url = "/api/staff";

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      const durationMs = Math.round(performance.now() - start);

      const log: HttpLog = {
        method: "POST",
        url,
        statusCode: res.status,
        statusText: res.statusText || "Created",
        durationMs,
        timestamp: new Date().toLocaleTimeString(),
        requestPayload: payload,
        responseBody: data,
      };

      if (res.ok && data.data) {
        // Sync local storage
        const current = getLocalStoredStaff();
        saveLocalStaff([data.data, ...current]);
        return { success: true, message: data.message, data: data.data, log };
      }
      throw new Error(data.error || "POST request failed");
    } catch {
      // Local fallback
      const durationMs = Math.round(performance.now() - start) || 45;
      const now = new Date().toISOString();
      const newStaff: StaffMember = {
        ...payload,
        id: `s-${Date.now().toString().slice(-4)}`,
        status: payload.status || "ACTIVE",
        createdAt: now,
        updatedAt: now,
      };

      const current = getLocalStoredStaff();
      const updated = [newStaff, ...current];
      saveLocalStaff(updated);

      const log: HttpLog = {
        method: "POST",
        url,
        statusCode: 201,
        statusText: "Created",
        durationMs,
        timestamp: new Date().toLocaleTimeString(),
        requestPayload: payload,
        responseBody: {
          success: true,
          message: "Staff member created successfully (POST 201 Created)",
          data: newStaff,
        },
      };

      return {
        success: true,
        message: "Staff created successfully (POST 201)",
        data: newStaff,
        log,
      };
    }
  },

  /** PUT /api/staff/:id — Full replacement / update of staff */
  async put(
    id: string,
    payload: Omit<StaffMember, "id" | "createdAt" | "updatedAt">
  ): Promise<ApiResponse<StaffMember>> {
    const start = performance.now();
    const url = `/api/staff/${id}`;

    try {
      const res = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      const durationMs = Math.round(performance.now() - start);

      const log: HttpLog = {
        method: "PUT",
        url,
        statusCode: res.status,
        statusText: res.statusText || "OK",
        durationMs,
        timestamp: new Date().toLocaleTimeString(),
        requestPayload: payload,
        responseBody: data,
      };

      if (res.ok && data.data) {
        const current = getLocalStoredStaff();
        const next = current.map((s) => (s.id === id ? data.data : s));
        saveLocalStaff(next);
        return { success: true, message: data.message, data: data.data, log };
      }
      throw new Error(data.error || "PUT request failed");
    } catch {
      // Local fallback
      const durationMs = Math.round(performance.now() - start) || 52;
      const current = getLocalStoredStaff();
      const existing = current.find((s) => s.id === id);

      if (!existing) {
        throw new Error(`Staff member '${id}' not found for PUT`);
      }

      const updatedRecord: StaffMember = {
        ...existing,
        ...payload,
        id,
        updatedAt: new Date().toISOString(),
      };

      saveLocalStaff(current.map((s) => (s.id === id ? updatedRecord : s)));

      const log: HttpLog = {
        method: "PUT",
        url,
        statusCode: 200,
        statusText: "OK",
        durationMs,
        timestamp: new Date().toLocaleTimeString(),
        requestPayload: payload,
        responseBody: {
          success: true,
          message: `Staff record '${id}' fully replaced (PUT 200 OK)`,
          data: updatedRecord,
        },
      };

      return {
        success: true,
        message: "Staff record replaced (PUT 200)",
        data: updatedRecord,
        log,
      };
    }
  },

  /** PATCH /api/staff/:id — Partial update of specific fields */
  async patch(id: string, patchPayload: Partial<StaffMember>): Promise<ApiResponse<StaffMember>> {
    const start = performance.now();
    const url = `/api/staff/${id}`;

    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(patchPayload),
      });

      const data = await res.json();
      const durationMs = Math.round(performance.now() - start);

      const log: HttpLog = {
        method: "PATCH",
        url,
        statusCode: res.status,
        statusText: res.statusText || "OK",
        durationMs,
        timestamp: new Date().toLocaleTimeString(),
        requestPayload: patchPayload,
        responseBody: data,
      };

      if (res.ok && data.data) {
        const current = getLocalStoredStaff();
        const next = current.map((s) => (s.id === id ? data.data : s));
        saveLocalStaff(next);
        return { success: true, message: data.message, data: data.data, log };
      }
      throw new Error(data.error || "PATCH request failed");
    } catch {
      // Local fallback
      const durationMs = Math.round(performance.now() - start) || 38;
      const current = getLocalStoredStaff();
      const existing = current.find((s) => s.id === id);

      if (!existing) {
        throw new Error(`Staff member '${id}' not found for PATCH`);
      }

      const patchedRecord: StaffMember = {
        ...existing,
        ...patchPayload,
        id,
        updatedAt: new Date().toISOString(),
      };

      saveLocalStaff(current.map((s) => (s.id === id ? patchedRecord : s)));

      const log: HttpLog = {
        method: "PATCH",
        url,
        statusCode: 200,
        statusText: "OK",
        durationMs,
        timestamp: new Date().toLocaleTimeString(),
        requestPayload: patchPayload,
        responseBody: {
          success: true,
          message: `Staff record '${id}' partially updated (PATCH 200 OK)`,
          modifiedFields: Object.keys(patchPayload),
          data: patchedRecord,
        },
      };

      return {
        success: true,
        message: "Staff record patched (PATCH 200)",
        data: patchedRecord,
        log,
      };
    }
  },

  /** DELETE /api/staff/:id — Delete staff record */
  async delete(id: string): Promise<ApiResponse<null>> {
    const start = performance.now();
    const url = `/api/staff/${id}`;

    try {
      const res = await fetch(url, {
        method: "DELETE",
        headers: { Accept: "application/json" },
      });
      const data = await res.json();
      const durationMs = Math.round(performance.now() - start);

      const log: HttpLog = {
        method: "DELETE",
        url,
        statusCode: res.status,
        statusText: res.statusText || "OK",
        durationMs,
        timestamp: new Date().toLocaleTimeString(),
        responseBody: data,
      };

      const current = getLocalStoredStaff();
      saveLocalStaff(current.filter((s) => s.id !== id));
      return { success: true, data: null, log };
    } catch {
      const durationMs = Math.round(performance.now() - start) || 30;
      const current = getLocalStoredStaff();
      saveLocalStaff(current.filter((s) => s.id !== id));

      const log: HttpLog = {
        method: "DELETE",
        url,
        statusCode: 200,
        statusText: "OK",
        durationMs,
        timestamp: new Date().toLocaleTimeString(),
        responseBody: {
          success: true,
          message: `Staff '${id}' deleted (DELETE 200 OK)`,
        },
      };
      return { success: true, data: null, log };
    }
  },

  getLocalStaff(): StaffMember[] {
    return getLocalStoredStaff();
  },
};
