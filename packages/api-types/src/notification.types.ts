export type NotificationType =
  | 'REQUEST_RECEIVED'
  | 'REQUEST_ACCEPTED'
  | 'REQUEST_DECLINED'
  | 'REQUEST_CANCELLED'
  | 'WAITLIST_PROMOTED'
  | 'SERVICE_REMOVED';

export interface Notification {
  notificationId: string;
  userId: string;
  type: NotificationType;
  relatedId: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}
