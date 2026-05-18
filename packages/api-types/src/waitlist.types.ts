export type WaitlistStatus = 'ACTIVE' | 'PROMOTED' | 'REMOVED';

export interface WaitlistEntry {
  entryId: string;
  customerId: string;
  serviceId: string;
  businessId: string;
  status: WaitlistStatus;
  createdAt: string;
  updatedAt: string;
}
