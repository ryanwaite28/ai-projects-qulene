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
