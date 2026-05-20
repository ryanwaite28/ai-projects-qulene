import { Component, inject, Input, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  AvailabilityWindow,
  BusinessProfile,
  BusinessService,
  Service,
} from '../services/business.service';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

@Component({
  selector: 'app-business-detail',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="min-h-screen bg-gray-50 px-4 py-10">
      <div class="mx-auto max-w-3xl">
        <a [routerLink]="'/businesses'" class="mb-6 inline-block text-sm text-brand-600 hover:underline">
          ← Back to businesses
        </a>

        @if (loading()) {
          <div class="space-y-4">
            <div class="h-32 animate-pulse rounded-xl bg-gray-200"></div>
            <div class="h-48 animate-pulse rounded-xl bg-gray-200"></div>
            <div class="h-48 animate-pulse rounded-xl bg-gray-200"></div>
          </div>
        } @else if (notFound()) {
          <div class="rounded-xl bg-white p-12 text-center shadow">
            <p class="text-lg font-medium text-gray-700">Business not found.</p>
            <a [routerLink]="'/businesses'" class="mt-4 inline-block text-brand-600 hover:underline">
              Browse all businesses
            </a>
          </div>
        } @else if (profile()) {
          <!-- Profile header -->
          <div class="mb-6 rounded-xl bg-white p-6 shadow">
            <div class="flex items-center gap-5">
              @if (profile()!.avatarUrl) {
                <img
                  [src]="profile()!.avatarUrl"
                  [alt]="profile()!.businessName ?? 'Business'"
                  class="h-20 w-20 rounded-full object-cover"
                />
              } @else {
                <div
                  class="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-3xl font-bold text-brand-700"
                >
                  {{ (profile()!.businessName ?? '?')[0].toUpperCase() }}
                </div>
              }
              <div>
                <h1 class="text-2xl font-bold text-gray-900">
                  {{ profile()!.businessName ?? 'Unnamed Business' }}
                </h1>
                @if (profile()!.category) {
                  <p class="text-brand-600">{{ profile()!.category }}</p>
                }
                @if (profile()!.city || profile()!.address) {
                  <p class="text-sm text-gray-500">{{ addressLine(profile()!) }}</p>
                }
                @if (profile()!.phone) {
                  <p class="text-sm text-gray-500">{{ profile()!.phone }}</p>
                }
              </div>
            </div>
            @if (profile()!.description) {
              <p class="mt-4 text-gray-700">{{ profile()!.description }}</p>
            }
          </div>

          <!-- Services -->
          <div class="mb-6 rounded-xl bg-white p-6 shadow">
            <h2 class="mb-4 text-xl font-semibold text-gray-900">Services</h2>
            @if (services().length === 0) {
              <p class="text-gray-500">No active services listed.</p>
            } @else {
              <ul class="divide-y divide-gray-100">
                @for (svc of services(); track svc.serviceId) {
                  <li class="flex items-center justify-between gap-4 py-4">
                    <div>
                      <p class="font-medium text-gray-900">{{ svc.name }}</p>
                      <p class="text-sm text-gray-500">
                        {{ svc.durationMinutes }} min · \${{ svc.price }}
                      </p>
                      @if (svc.description) {
                        <p class="mt-1 text-sm text-gray-600">{{ svc.description }}</p>
                      }
                    </div>
                    <div class="flex flex-shrink-0 gap-2">
                      <a
                        [routerLink]="'/customer/appointments'"
                        [queryParams]="{ openModal: 'true', serviceId: svc.serviceId }"
                        class="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
                      >
                        Request
                      </a>
                      <a
                        [routerLink]="'/customer/waitlist'"
                        [queryParams]="{ serviceId: svc.serviceId }"
                        class="rounded-lg border border-brand-600 px-3 py-1.5 text-sm font-semibold text-brand-600 hover:bg-brand-50"
                      >
                        Waitlist
                      </a>
                    </div>
                  </li>
                }
              </ul>
            }
          </div>

          <!-- Availability -->
          <div class="rounded-xl bg-white p-6 shadow">
            <h2 class="mb-4 text-xl font-semibold text-gray-900">Availability</h2>
            @if (windows().length === 0) {
              <p class="text-gray-500">No availability windows set.</p>
            } @else {
              <table class="w-full text-sm">
                <tbody>
                  @for (day of days; track day) {
                    @if (windowsForDay(day).length > 0) {
                      <tr class="border-b border-gray-100 last:border-0">
                        <td class="w-12 py-2 font-medium text-gray-700">{{ dayNames[day] }}</td>
                        <td class="py-2 text-gray-600">
                          @for (win of windowsForDay(day); track win.windowId) {
                            <span class="mr-3">{{ win.startTime }}–{{ win.endTime }}</span>
                          }
                        </td>
                      </tr>
                    }
                  }
                </tbody>
              </table>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class BusinessDetailComponent implements OnInit {
  @Input() businessId!: string;

  private readonly businessService = inject(BusinessService);

  readonly profile = signal<BusinessProfile | null>(null);
  readonly services = signal<Service[]>([]);
  readonly windows = signal<AvailabilityWindow[]>([]);
  readonly loading = signal(true);
  readonly notFound = signal(false);

  readonly dayNames = DAY_NAMES;
  readonly days = [0, 1, 2, 3, 4, 5, 6];

  ngOnInit(): void {
    forkJoin([
      this.businessService.getBusinessById(this.businessId),
      this.businessService.listServicesForBusiness(this.businessId),
      this.businessService.listAvailabilityForBusiness(this.businessId),
    ]).subscribe({
      next: ([profileRes, servicesRes, windowsRes]) => {
        this.profile.set(profileRes.data);
        this.services.set(servicesRes.data);
        this.windows.set(windowsRes.data);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 404) this.notFound.set(true);
        this.loading.set(false);
      },
    });
  }

  windowsForDay(day: number): AvailabilityWindow[] {
    return this.windows().filter((w) => w.dayOfWeek === day);
  }

  addressLine(p: BusinessProfile): string {
    return [p.address, p.city, p.state].filter((v) => !!v).join(', ');
  }
}
