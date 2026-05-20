import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

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
}

export interface Service {
  serviceId: string;
  businessId: string;
  name: string;
  description: string;
  durationMinutes: number;
  price: number;
  status: 'ACTIVE' | 'PAUSED' | 'DELETED';
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

@Injectable({ providedIn: 'root' })
export class BusinessService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  listBusinesses(params?: {
    category?: string;
    cursor?: string;
  }): Observable<{ data: BusinessProfile[]; nextCursor: string | null }> {
    let p = new HttpParams();
    if (params?.category) p = p.set('category', params.category);
    if (params?.cursor) p = p.set('cursor', params.cursor);
    return this.http.get<{ data: BusinessProfile[]; nextCursor: string | null }>(
      `${this.apiUrl}/businesses`,
      { params: p },
    );
  }

  getBusinessById(id: string): Observable<{ data: BusinessProfile }> {
    return this.http.get<{ data: BusinessProfile }>(`${this.apiUrl}/businesses/${id}`);
  }

  listServicesForBusiness(businessId: string): Observable<{ data: Service[] }> {
    return this.http.get<{ data: Service[] }>(
      `${this.apiUrl}/businesses/${businessId}/services`,
    );
  }

  listAvailabilityForBusiness(businessId: string): Observable<{ data: AvailabilityWindow[] }> {
    return this.http.get<{ data: AvailabilityWindow[] }>(
      `${this.apiUrl}/businesses/${businessId}/availability`,
    );
  }

  updateMyProfile(updates: Partial<BusinessProfile>): Observable<{ data: BusinessProfile }> {
    return this.http.patch<{ data: BusinessProfile }>(`${this.apiUrl}/businesses/me`, updates);
  }

  requestAvatarUploadUrl(contentType: string): Observable<{ data: { uploadUrl: string } }> {
    return this.http.post<{ data: { uploadUrl: string } }>(
      `${this.apiUrl}/businesses/me/avatar`,
      { contentType },
    );
  }
}
