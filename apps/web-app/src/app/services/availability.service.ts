import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import type { AvailabilityWindow } from './business.service';

export type { AvailabilityWindow } from './business.service';

@Injectable({ providedIn: 'root' })
export class AvailabilityService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  listMyAvailability(businessId: string): Observable<{ data: AvailabilityWindow[] }> {
    return this.http.get<{ data: AvailabilityWindow[] }>(
      `${this.apiUrl}/businesses/${businessId}/availability`,
    );
  }

  addWindow(body: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }): Observable<{ data: AvailabilityWindow }> {
    return this.http.post<{ data: AvailabilityWindow }>(
      `${this.apiUrl}/businesses/me/availability`,
      body,
    );
  }

  removeWindow(windowId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/businesses/me/availability/${windowId}`);
  }
}
