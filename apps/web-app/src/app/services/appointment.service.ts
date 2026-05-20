import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { AppointmentRequest, AppointmentStatus } from '@qulene/api-types';
import { environment } from '../../environments/environment';

export type { AppointmentRequest } from '@qulene/api-types';
export type { AppointmentStatus } from '@qulene/api-types';

@Injectable({ providedIn: 'root' })
export class AppointmentService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  listCustomerRequests(
    cursor?: string,
  ): Observable<{ data: AppointmentRequest[]; nextCursor: string | null }> {
    let params = new HttpParams();
    if (cursor) params = params.set('cursor', cursor);
    return this.http.get<{ data: AppointmentRequest[]; nextCursor: string | null }>(
      `${this.apiUrl}/appointments/me`,
      { params },
    );
  }

  createRequest(body: {
    serviceId: string;
    proposedAt: string;
    notes?: string;
    idempotencyKey: string;
  }): Observable<{ data: AppointmentRequest }> {
    return this.http.post<{ data: AppointmentRequest }>(`${this.apiUrl}/appointments`, body);
  }

  cancelRequest(requestId: string): Observable<{ data: AppointmentRequest }> {
    return this.http.delete<{ data: AppointmentRequest }>(
      `${this.apiUrl}/appointments/${requestId}`,
    );
  }

  listBusinessRequests(
    status?: AppointmentStatus,
    cursor?: string,
  ): Observable<{ data: AppointmentRequest[]; nextCursor: string | null }> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (cursor) params = params.set('cursor', cursor);
    return this.http.get<{ data: AppointmentRequest[]; nextCursor: string | null }>(
      `${this.apiUrl}/businesses/me/appointments`,
      { params },
    );
  }

  acceptRequest(requestId: string): Observable<{ data: AppointmentRequest }> {
    return this.http.patch<{ data: AppointmentRequest }>(
      `${this.apiUrl}/businesses/me/appointments/${requestId}/accept`,
      {},
    );
  }

  declineRequest(requestId: string): Observable<{ data: AppointmentRequest }> {
    return this.http.patch<{ data: AppointmentRequest }>(
      `${this.apiUrl}/businesses/me/appointments/${requestId}/decline`,
      {},
    );
  }

  completeRequest(requestId: string): Observable<{ data: AppointmentRequest }> {
    return this.http.patch<{ data: AppointmentRequest }>(
      `${this.apiUrl}/businesses/me/appointments/${requestId}/complete`,
      {},
    );
  }

  noShowRequest(requestId: string): Observable<{ data: AppointmentRequest }> {
    return this.http.patch<{ data: AppointmentRequest }>(
      `${this.apiUrl}/businesses/me/appointments/${requestId}/noshow`,
      {},
    );
  }
}
