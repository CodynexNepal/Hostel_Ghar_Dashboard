export interface StaffMember {
  id: string;
  name: string;
  role: string;
  phone: string;
  shift: string;
  status: "ACTIVE" | "ON LEAVE" | "INACTIVE";
  email?: string;
  salary?: number;
  emergencyContact?: string;
  joinDate?: string;
  notes?: string;
  avatarUrl?: string;
  hostelId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const INITIAL_STAFF: StaffMember[] = [
  {
    id: "s-1",
    name: "Hari Bahadur",
    role: "Warden",
    phone: "9841000011",
    shift: "Night",
    status: "ACTIVE",
    email: "hari.bahadur@hostelghar.np",
    salary: 28000,
    emergencyContact: "9801122334",
    joinDate: "2024-01-15",
    notes: "Supervises hostel gates and evening attendance.",
    createdAt: new Date("2024-01-15T00:00:00Z").toISOString(),
    updatedAt: new Date("2024-06-01T00:00:00Z").toISOString(),
  },
  {
    id: "s-2",
    name: "Gita Sharma",
    role: "Cook",
    phone: "9841000022",
    shift: "Morning",
    status: "ACTIVE",
    email: "gita.sharma@hostelghar.np",
    salary: 24000,
    emergencyContact: "9801122335",
    joinDate: "2024-02-01",
    notes: "In charge of morning breakfast and daily mess menu.",
    createdAt: new Date("2024-02-01T00:00:00Z").toISOString(),
    updatedAt: new Date("2024-05-15T00:00:00Z").toISOString(),
  },
  {
    id: "s-3",
    name: "Ram KC",
    role: "Cleaner",
    phone: "9841000033",
    shift: "Day",
    status: "ACTIVE",
    email: "ram.kc@hostelghar.np",
    salary: 18000,
    emergencyContact: "9801122336",
    joinDate: "2024-03-10",
    notes: "Maintains common corridors and dining hall hygiene.",
    createdAt: new Date("2024-03-10T00:00:00Z").toISOString(),
    updatedAt: new Date("2024-07-20T00:00:00Z").toISOString(),
  },
  {
    id: "s-4",
    name: "Suresh Yadav",
    role: "Accountant",
    phone: "9841000044",
    shift: "Day",
    status: "ON LEAVE",
    email: "suresh.yadav@hostelghar.np",
    salary: 32000,
    emergencyContact: "9801122337",
    joinDate: "2023-11-01",
    notes: "Handles resident invoice clearance and utility bills.",
    createdAt: new Date("2023-11-01T00:00:00Z").toISOString(),
    updatedAt: new Date("2024-08-10T00:00:00Z").toISOString(),
  },
];

// Global in-memory storage for server handlers
const globalForStaff = globalThis as unknown as {
  __staffList?: StaffMember[];
};

export function getStaffList(): StaffMember[] {
  if (!globalForStaff.__staffList) {
    globalForStaff.__staffList = [...INITIAL_STAFF];
  }
  return globalForStaff.__staffList;
}

export function getStaffById(id: string): StaffMember | undefined {
  const list = getStaffList();
  return list.find((s) => s.id === id);
}

export function addStaff(
  data: Omit<StaffMember, "id" | "createdAt" | "updatedAt"> & { id?: string }
): StaffMember {
  const list = getStaffList();
  const now = new Date().toISOString();
  const newStaff: StaffMember = {
    ...data,
    id: data.id || `s-${Date.now().toString().slice(-4)}`,
    status: data.status || "ACTIVE",
    createdAt: now,
    updatedAt: now,
  };
  globalForStaff.__staffList = [newStaff, ...list];
  return newStaff;
}

export function replaceStaff(id: string, data: Partial<StaffMember>): StaffMember | null {
  const list = getStaffList();
  const index = list.findIndex((s) => s.id === id);
  if (index === -1) return null;

  const now = new Date().toISOString();
  const updated: StaffMember = {
    ...list[index],
    ...data,
    id, // preserve id
    updatedAt: now,
  };
  list[index] = updated;
  globalForStaff.__staffList = [...list];
  return updated;
}

export function patchStaff(id: string, patchData: Partial<StaffMember>): StaffMember | null {
  const list = getStaffList();
  const index = list.findIndex((s) => s.id === id);
  if (index === -1) return null;

  const now = new Date().toISOString();
  const patched: StaffMember = {
    ...list[index],
    ...patchData,
    id, // preserve original id
    updatedAt: now,
  };
  list[index] = patched;
  globalForStaff.__staffList = [...list];
  return patched;
}

export function deleteStaff(id: string): boolean {
  const list = getStaffList();
  const beforeLength = list.length;
  globalForStaff.__staffList = list.filter((s) => s.id !== id);
  return globalForStaff.__staffList.length < beforeLength;
}
