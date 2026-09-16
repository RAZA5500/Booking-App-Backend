/** Shapes stored in the JSON database. Mirrors what the React client consumes. */

export type Role = 'customer' | 'employee' | 'admin';

export type BookingStatusValue =
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled';

export interface Room {
  id: string;
  key: string;
  name: string;
  description: string;
  price: number;
  capacity: number;
  beds: string;
  sizeSqm: number;
  count: number;
}

export interface RoomWithAvailability extends Room {
  unitsLeft: number;
  available: boolean;
  fitsGuests: boolean;
}

export interface HotelPolicies {
  checkIn: string;
  checkOut: string;
  cancellation: string;
  children: string;
}

export interface Hotel {
  id: string;
  slug: string;
  name: string;
  city: string;
  country: string;
  continent: string;
  category: string;
  starRating: number;
  rating: number;
  reviewsCount: number;
  basePrice: number;
  currency: string;
  description: string;
  highlights: string[];
  tags: string[];
  featured: boolean;
  amenities: string[];
  images: string[];
  policies: HotelPolicies;
  rooms: Room[];
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  phone: string | null;
  hotelId: string | null;
  avatarSeed: string;
  active: boolean;
  tokenVersion?: number;
  createdAt: string;
  lastLoginAt: string | null;
  updatedAt?: string;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone: string | null;
  hotelId: string | null;
  avatarSeed: string;
  active: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface Quote {
  nights: number;
  nightlyRate: number;
  roomTotal: number;
  discount: number;
  cleaning: number;
  service: number;
  tax: number;
  total: number;
  currency: string;
}

export interface StatusHistoryEntry {
  status: BookingStatusValue;
  at: string;
  by: string;
  note: string;
}

export interface GuestDetails {
  name: string;
  email: string;
  phone: string | null;
}

export interface Booking {
  id: string;
  code: string;
  userId: string;
  hotelId: string;
  hotelName: string;
  roomId: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  pricing: Quote;
  status: BookingStatusValue;
  guest: GuestDetails;
  note: string;
  paymentLast4: string | null;
  statusHistory: StatusHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  id: string;
  hotelId: string;
  userId: string;
  bookingId: string;
  userName: string;
  rating: number;
  title: string;
  comment: string;
  createdAt: string;
}

export interface Favorite {
  id: string;
  userId: string;
  hotelId: string;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  target: string;
  at: string;
}

export interface Database {
  users: User[];
  hotels: Hotel[];
  bookings: Booking[];
  reviews: Review[];
  favorites: Favorite[];
  audit: AuditEntry[];
}

export type TableName = keyof Database;
export type Row<T extends TableName> = Database[T][number];
