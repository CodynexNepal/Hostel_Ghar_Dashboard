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
}

export interface Hostel {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  totalRooms: number;
  totalBeds: number;
  occupiedBeds: number;
  status: "ACTIVE" | "SUSPENDED" | "PENDING";
  ownerName: string;
  imageUrl?: string;
}
