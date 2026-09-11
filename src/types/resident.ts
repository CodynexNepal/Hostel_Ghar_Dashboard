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
  paymentStatus: PaymentStatus;
  status: ResidentStatus;
  joinedDate: string;
  monthlyRent: number;
  avatarUrl?: string;
}
