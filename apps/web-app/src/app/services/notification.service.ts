import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { Notification } from '@qulene/api-types';
import { environment } from '../../environments/environment';

export type { Notification } from '@qulene/api-types';
export type { NotificationType } from '@qulene/api-types';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  listNotifications(cursor?: string): Observable<{ data: Notification[]; nextCursor: string | null }> {
    let params = new HttpParams();
    if (cursor) params = params.set('cursor', cursor);
    return this.http.get<{ data: Notification[]; nextCursor: string | null }>(
      `${this.apiUrl}/notifications`,
      { params },
    );
  }

  markAsRead(notificationId: string): Observable<{ data: Notification }> {
    return this.http.patch<{ data: Notification }>(
      `${this.apiUrl}/notifications/${notificationId}/read`,
      {},
    );
  }
}
