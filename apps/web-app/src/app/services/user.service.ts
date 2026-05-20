import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { User } from '@qulene/api-types';
import { environment } from '../../environments/environment';

export type { User } from '@qulene/api-types';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getMyProfile(): Observable<{ data: User }> {
    return this.http.get<{ data: User }>(`${this.apiUrl}/users/me`);
  }

  updateMyName(body: { firstName: string; lastName: string }): Observable<{ data: User }> {
    return this.http.patch<{ data: User }>(`${this.apiUrl}/users/me`, body);
  }
}
