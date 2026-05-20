import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import type { Service } from './business.service';

export type { Service } from './business.service';

@Injectable({ providedIn: 'root' })
export class ServiceManagementService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  listMyServices(businessId: string): Observable<{ data: Service[] }> {
    return this.http.get<{ data: Service[] }>(
      `${this.apiUrl}/businesses/${businessId}/services`,
    );
  }

  createService(body: {
    name: string;
    description?: string;
    durationMinutes: number;
    price: number;
    status: 'ACTIVE' | 'PAUSED';
  }): Observable<{ data: Service }> {
    return this.http.post<{ data: Service }>(`${this.apiUrl}/businesses/me/services`, body);
  }

  updateService(
    serviceId: string,
    updates: {
      name?: string;
      description?: string;
      durationMinutes?: number;
      price?: number;
      status?: 'ACTIVE' | 'PAUSED';
    },
  ): Observable<{ data: Service }> {
    return this.http.patch<{ data: Service }>(
      `${this.apiUrl}/businesses/me/services/${serviceId}`,
      updates,
    );
  }

  softDeleteService(serviceId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/businesses/me/services/${serviceId}`);
  }
}
