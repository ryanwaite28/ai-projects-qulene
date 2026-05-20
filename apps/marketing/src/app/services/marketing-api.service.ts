import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class MarketingApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  submitContact(body: { name: string; email: string; message: string }): Observable<{ data: { ok: boolean } }> {
    return this.http.post<{ data: { ok: boolean } }>(`${this.apiUrl}/web/contact`, body);
  }

  joinWaitlist(email: string): Observable<{ data: { email: string } }> {
    return this.http.post<{ data: { email: string } }>(`${this.apiUrl}/web/signup`, { email });
  }
}
