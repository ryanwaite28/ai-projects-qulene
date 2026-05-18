export type UserRole = 'BUSINESS' | 'CUSTOMER';

export interface User {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  unreadNotificationCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ParsedClaims {
  userId: string;
  role: UserRole;
  email: string;
}

export interface BusinessProfile {
  businessId: string;
  businessName: string | null;
  category: string | null;
  description: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ServiceStatus = 'ACTIVE' | 'PAUSED' | 'DELETED';

export interface Service {
  serviceId: string;
  businessId: string;
  name: string;
  description: string;
  durationMinutes: number;
  price: number;
  status: ServiceStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AvailabilityWindow {
  windowId: string;
  businessId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  createdAt: string;
}

export interface ApiError {
  code: string;
  message: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
}
