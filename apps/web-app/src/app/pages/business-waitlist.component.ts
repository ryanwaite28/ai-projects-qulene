import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { WaitlistService } from '../services/waitlist.service';
import { ServiceManagementService } from '../services/service-management.service';
import { ErrorStateComponent } from '../components/error-state.component';
import type { WaitlistEntry } from '../services/waitlist.service';
import type { Service } from '../services/service-management.service';

const TOKEN_KEY = 'qulene_access_token';

function decodeUserId(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as Record<string, unknown>;
    return (payload['sub'] as string) ?? null;
  } catch {
    return null;
  }
}

@Component({
  selector: 'app-business-waitlist',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, ErrorStateComponent],
  template: `
    <div class="min-h-screen bg-gray-50">
      <!-- Business top-nav -->
      <nav class="border-b border-gray-200 bg-white px-4">
        <div class="mx-auto flex max-w-4xl gap-6 overflow-x-auto">
          <a [routerLink]="'/business/dashboard'" routerLinkActive="border-b-2 border-brand-600 text-brand-600"
            class="whitespace-nowrap py-4 text-sm font-medium text-gray-500 hover:text-gray-700">Dashboard</a>
          <a [routerLink]="'/business/profile'" routerLinkActive="border-b-2 border-brand-600 text-brand-600"
            class="whitespace-nowrap py-4 text-sm font-medium text-gray-500 hover:text-gray-700">Profile</a>
          <a [routerLink]="'/business/services'" routerLinkActive="border-b-2 border-brand-600 text-brand-600"
            class="whitespace-nowrap py-4 text-sm font-medium text-gray-500 hover:text-gray-700">Services</a>
          <a [routerLink]="'/business/availability'" routerLinkActive="border-b-2 border-brand-600 text-brand-600"
            class="whitespace-nowrap py-4 text-sm font-medium text-gray-500 hover:text-gray-700">Availability</a>
          <a [routerLink]="'/business/waitlist'" routerLinkActive="border-b-2 border-brand-600 text-brand-600"
            class="whitespace-nowrap py-4 text-sm font-medium text-gray-500 hover:text-gray-700">Waitlist</a>
          <a [routerLink]="'/business/notifications'" routerLinkActive="border-b-2 border-brand-600 text-brand-600"
            class="whitespace-nowrap py-4 text-sm font-medium text-gray-500 hover:text-gray-700">Notifications</a>
        </div>
      </nav>

      <div class="mx-auto max-w-3xl px-4 py-10">
        <h1 class="mb-6 text-3xl font-bold text-gray-900">Waitlist</h1>

        @if (fetchError()) {
          <app-error-state [message]="fetchError()!" (retry)="retry()" />
        } @else if (loadingServices()) {
          <div class="h-10 animate-pulse rounded-lg bg-gray-200"></div>
        } @else if (myServices().length === 0) {
          <p class="py-16 text-center text-gray-500">
            No active services. Add a service to view its waitlist.
          </p>
        } @else {
          <!-- Service selector -->
          <div class="mb-6">
            <label class="mb-1 block text-sm font-medium text-gray-700">Select Service</label>
            <select
              (change)="onServiceChange($event)"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">— Choose a service —</option>
              @for (svc of myServices(); track svc.serviceId) {
                <option [value]="svc.serviceId">{{ svc.name }}</option>
              }
            </select>
          </div>

          @if (selectedServiceId()) {
            @if (loadingEntries()) {
              <div class="space-y-3">
                @for (i of skeletonItems; track i) {
                  <div class="h-16 animate-pulse rounded-xl bg-gray-200"></div>
                }
              </div>
            } @else if (entries().length === 0) {
              <p class="py-12 text-center text-gray-500">
                No active waitlist entries for this service.
              </p>
            } @else {
              <div class="mb-3 text-sm text-gray-500">
                {{ entryCount() }} {{ entryCount() === 1 ? 'person' : 'people' }} waiting
              </div>
              <ul class="space-y-2">
                @for (entry of entries(); track entry.entryId; let i = $index) {
                  <li class="flex items-center gap-4 rounded-xl bg-white px-5 py-4 shadow">
                    <span class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                      {{ i + 1 }}
                    </span>
                    <div class="min-w-0">
                      <p class="font-medium text-gray-900">{{ entry.customerId }}</p>
                      <p class="text-sm text-gray-500">Joined {{ formatDate(entry.createdAt) }}</p>
                    </div>
                    <span class="ml-auto flex-shrink-0 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
                      Active
                    </span>
                  </li>
                }
              </ul>
            }
          }
        }
      </div>
    </div>
  `,
})
export class BusinessWaitlistComponent implements OnInit {
  private readonly waitlistService = inject(WaitlistService);
  private readonly svcService = inject(ServiceManagementService);

  readonly myServices = signal<Service[]>([]);
  readonly selectedServiceId = signal<string | null>(null);
  readonly entries = signal<WaitlistEntry[]>([]);
  readonly entryCount = signal(0);
  readonly loadingServices = signal(false);
  readonly loadingEntries = signal(false);
  readonly fetchError = signal<string | null>(null);

  readonly skeletonItems = [1, 2, 3];

  ngOnInit(): void {
    this.loadServices();
  }

  retry(): void {
    this.fetchError.set(null);
    this.loadServices();
  }

  private loadServices(): void {
    const userId = decodeUserId();
    if (!userId) return;
    this.loadingServices.set(true);
    this.fetchError.set(null);
    this.svcService.listMyServices(userId).subscribe({
      next: (res) => {
        this.myServices.set(res.data.filter((s) => s.status !== 'DELETED'));
        this.loadingServices.set(false);
      },
      error: () => {
        this.fetchError.set('Failed to load services');
        this.loadingServices.set(false);
      },
    });
  }

  onServiceChange(event: Event): void {
    const serviceId = (event.target as HTMLSelectElement).value;
    if (!serviceId) {
      this.selectedServiceId.set(null);
      this.entries.set([]);
      this.entryCount.set(0);
      return;
    }
    this.selectedServiceId.set(serviceId);
    this.loadingEntries.set(true);
    this.waitlistService.listBusinessWaitlistForService(serviceId).subscribe({
      next: (res) => {
        this.entries.set(res.data);
        this.entryCount.set(res.count);
        this.loadingEntries.set(false);
      },
      error: () => this.loadingEntries.set(false),
    });
  }

  formatDate(iso: string): string {
    return iso.replace('T', ' ').slice(0, 16);
  }
}
