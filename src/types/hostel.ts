export type RoomStatus = "AVAILABLE" | "OCCUPIED" | "FULL" | "MAINTENANCE";

export type RoomType = "SINGLE" | "DOUBLE" | "TRIPLE" | "DORM";

export interface Room {
  id: string;
  roomNumber: string;
  floor: number;
  type: RoomType;
  capacity: number;
  occupied: number;
  monthlyRent: number;
  status: RoomStatus;
  amenities: string[];
  /** Local preview / uploaded image (object URL or remote URL). Optional. */
  imageUrl?: string | null;
}

export interface Hostel {
  id: string;
  name: string;
  type?: "BOYS" | "GIRLS" | string;
  address: string;
  city: string;
  phone: string;
  email: string;
  totalRooms: number;
  /** No capacity column in backend — always null; occupancy renders occupiedBeds only. */
  totalBeds: number | null;
  occupiedBeds: number;
  /** Derived by backend: owner assigned → ACTIVE, else PENDING. */
  status: "ACTIVE" | "SUSPENDED" | "PENDING";
  ownerName: string | null;
  owner?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl?: string | null;
  } | null;
  /** Backend field is `logoUrl` (Cloudinary); `imageUrl` kept as legacy alias. */
  logoUrl?: string | null;
  imageUrl?: string;
}
