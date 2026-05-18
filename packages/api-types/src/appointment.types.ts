export type AppointmentStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'NO_SHOW';

export interface AppointmentRequest {
  requestId: string;
  customerId: string;
  businessId: string;
  serviceId: string;
  proposedAt: string;
  notes?: string;
  status: AppointmentStatus;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
}
