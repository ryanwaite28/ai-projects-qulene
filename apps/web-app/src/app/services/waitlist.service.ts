import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { WaitlistEntry } from '@qulene/api-types';
import { environment } from '../../environments/environment';

export type { WaitlistEntry } from '@qulene/api-types';
export type { WaitlistStatus } from '@qulene/api-types';

@Injectable({ providedIn: 'root' })
export class WaitlistService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  listCustomerEntries(): Observable<{ data: WaitlistEntry[] }> {
    return this.http.get<{ data: WaitlistEntry[] }>(`${this.apiUrl}/waitlist/me`);
  }

  joinWaitlist(serviceId: string): Observable<{ data: WaitlistEntry }> {
    return this.http.post<{ data: WaitlistEntry }>(`${this.apiUrl}/waitlist`, { serviceId });
  }

  leaveWaitlist(entryId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/waitlist/${entryId}`);
  }

  listBusinessWaitlistForService(serviceId: string): Observable<{ data: WaitlistEntry[]; count: number }> {
    return this.http.get<{ data: WaitlistEntry[]; count: number }>(
      `${this.apiUrl}/businesses/me/waitlist/${serviceId}`,
    );
  }
}
