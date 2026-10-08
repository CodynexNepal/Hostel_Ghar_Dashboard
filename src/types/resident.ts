export type PaymentStatus = "PAID" | "PENDING" | "OVERDUE" | "PARTIAL";

export type ResidentStatus = "ACTIVE" | "INACTIVE" | "PENDING" | "VACATED";

export interface Resident {
  id: string;
  name: string;
  email: string;
  phone: string;
  roomNumber: string;
  bedNumber: string;
  floor: number;
  /** Room occupancy type from the backend (SINGLE/DOUBLE/TRIPLE/…); optional. */
  roomType?: string;
  paymentStatus: PaymentStatus;
  status: ResidentStatus;
  joinedDate: string;
  monthlyRent: number;
  avatarUrl?: string;
}
