import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import type { AppointmentStatus } from '@qulene/api-types';
import { AppointmentService } from '../services/appointment.service';
import type { AppointmentRequest } from '../services/appointment.service';

interface StatusStyle {
  label: string;
  classes: string;
}

const STATUS_STYLES: Record<AppointmentStatus, StatusStyle> = {
  PENDING:   { label: 'Pending',   classes: 'bg-yellow-100 text-yellow-800' },
  ACCEPTED:  { label: 'Accepted',  classes: 'bg-green-100 text-green-800' },
  DECLINED:  { label: 'Declined',  classes: 'bg-gray-100 text-gray-600' },
  CANCELLED: { label: 'Cancelled', classes: 'bg-gray-100 text-gray-600' },
  COMPLETED: { label: 'Completed', classes: 'bg-blue-100 text-blue-800' },
  NO_SHOW:   { label: 'No Show',   classes: 'bg-orange-100 text-orange-800' },
};

type FilterOption = AppointmentStatus | 'ALL';

interface FilterChip {
  label: string;
  value: FilterOption;
}

const FILTER_CHIPS: FilterChip[] = [
  { label: 'All',       value: 'ALL' },
  { label: 'Pending',   value: 'PENDING' },
  { label: 'Accepted',  value: 'ACCEPTED' },
  { label: 'Declined',  value: 'DECLINED' },
  { label: 'Cancelled', value: 'CANCELLED' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'No Show',   value: 'NO_SHOW' },
];

@Component({
  selector: 'app-business-dashboard',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <div class="min-h-screen bg-gray-50">
      <!-- Business top-nav -->
      <nav class="border-b border-gray-200 bg-white px-4">
        <div class="mx-auto flex max-w-4xl gap-6 overflow-x-auto">
          <a [routerLink]="'/business/dashboard'" routerLinkActive="border-b-2 border-brand-600 text-brand-600"
            class="whitespace-nowrap py-4 text-sm font-medium text-gray-500 hover:text-gray-700">
            Dashboard
          </a>
          <a [routerLink]="'/business/profile'" routerLinkActive="border-b-2 border-brand-600 text-brand-600"
            class="whitespace-nowrap py-4 text-sm font-medium text-gray-500 hover:text-gray-700">
            Profile
          </a>
          <a [routerLink]="'/business/services'" routerLinkActive="border-b-2 border-brand-600 text-brand-600"
            class="whitespace-nowrap py-4 text-sm font-medium text-gray-500 hover:text-gray-700">
            Services
          </a>
          <a [routerLink]="'/business/availability'" routerLinkActive="border-b-2 border-brand-600 text-brand-600"
            class="whitespace-nowrap py-4 text-sm font-medium text-gray-500 hover:text-gray-700">
            Availability
          </a>
          <a [routerLink]="'/business/waitlist'" routerLinkActive="border-b-2 border-brand-600 text-brand-600"
            class="whitespace-nowrap py-4 text-sm font-medium text-gray-500 hover:text-gray-700">
            Waitlist
          </a>
          <a [routerLink]="'/business/notifications'" routerLinkActive="border-b-2 border-brand-600 text-brand-600"
            class="whitespace-nowrap py-4 text-sm font-medium text-gray-500 hover:text-gray-700">
            Notifications
          </a>
        </div>
      </nav>

      <div class="mx-auto max-w-4xl px-4 py-10">
        <h1 class="mb-6 text-3xl font-bold text-gray-900">Appointment Requests</h1>

        <!-- Filter chips -->
        <div class="mb-6 flex flex-wrap gap-2">
          @for (chip of filterChips; track chip.value) {
            <button
              type="button"
              (click)="setFilter(chip.value)"
              [class]="chipClass(chip.value)"
            >
              {{ chip.label }}
            </button>
          }
        </div>

        @if (loading() && requests().length === 0) {
          <div class="space-y-3">
            @for (i of skeletonItems; track i) {
              <div class="h-24 animate-pulse rounded-xl bg-gray-200"></div>
            }
          </div>
        } @else if (requests().length === 0) {
          <p class="py-16 text-center text-gray-500">
            @if (activeFilter() === 'ALL') {
              No appointment requests yet.
            } @else {
              No requests with this status.
            }
          </p>
        } @else {
          <ul class="space-y-3">
            @for (req of requests(); track req.requestId) {
              <li class="rounded-xl bg-white p-5 shadow">
                <div class="flex items-start justify-between gap-4">
                  <div class="min-w-0">
                    <p class="font-medium text-gray-900">Service: {{ req.serviceId }}</p>
                    <p class="mt-0.5 text-sm text-gray-500">Customer: {{ req.customerId }}</p>
                    <p class="mt-0.5 text-sm text-gray-500">
                      Proposed: {{ formatDate(req.proposedAt) }}
                    </p>
                    @if (req.notes) {
                      <p class="mt-1 text-sm text-gray-600">{{ req.notes }}</p>
                    }
                  </div>
                  <span [class]="statusBadgeClass(req.status)">
                    {{ statusLabel(req.status) }}
                  </span>
                </div>

                @if (req.status === 'PENDING') {
                  <div class="mt-3 flex gap-2">
                    <button
                      type="button"
                      (click)="doAccept(req.requestId)"
                      [disabled]="actionInProgress().has(req.requestId)"
                      class="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      @if (actionInProgress().has(req.requestId)) { Working… } @else { Accept }
                    </button>
                    <button
                      type="button"
                      (click)="doDecline(req.requestId)"
                      [disabled]="actionInProgress().has(req.requestId)"
                      class="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      @if (actionInProgress().has(req.requestId)) { Working… } @else { Decline }
                    </button>
                  </div>
                } @else if (req.status === 'ACCEPTED' && isPast(req.proposedAt)) {
                  <div class="mt-3 flex gap-2">
                    <button
                      type="button"
                      (click)="doComplete(req.requestId)"
                      [disabled]="actionInProgress().has(req.requestId)"
                      class="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      @if (actionInProgress().has(req.requestId)) { Working… } @else { Complete }
                    </button>
                    <button
                      type="button"
                      (click)="doNoShow(req.requestId)"
                      [disabled]="actionInProgress().has(req.requestId)"
                      class="rounded-lg border border-orange-300 px-3 py-1.5 text-sm font-semibold text-orange-600 hover:bg-orange-50 disabled:opacity-50"
                    >
                      @if (actionInProgress().has(req.requestId)) { Working… } @else { No Show }
                    </button>
                  </div>
                }
              </li>
            }
          </ul>

          @if (nextCursor()) {
            <div class="mt-6 text-center">
              <button
                type="button"
                (click)="loadMore()"
                [disabled]="loading()"
                class="rounded-lg border border-gray-300 px-6 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                @if (loading()) { Loading… } @else { Load more }
              </button>
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class BusinessDashboardComponent implements OnInit {
  private readonly appointmentService = inject(AppointmentService);

  readonly requests = signal<AppointmentRequest[]>([]);
  readonly loading = signal(false);
  readonly nextCursor = signal<string | null>(null);
  readonly activeFilter = signal<FilterOption>('ALL');
  readonly actionInProgress = signal<Set<string>>(new Set());

  readonly filterChips = FILTER_CHIPS;
  readonly skeletonItems = [1, 2, 3];

  ngOnInit(): void {
    this.loadRequests(true);
  }

  setFilter(filter: FilterOption): void {
    this.activeFilter.set(filter);
    this.loadRequests(true);
  }

  doAccept(requestId: string): void {
    this.startAction(requestId);
    this.appointmentService.acceptRequest(requestId).subscribe({
      next: (res) => this.finishAction(requestId, res.data),
      error: () => this.clearAction(requestId),
    });
  }

  doDecline(requestId: string): void {
    this.startAction(requestId);
    this.appointmentService.declineRequest(requestId).subscribe({
      next: (res) => this.finishAction(requestId, res.data),
      error: () => this.clearAction(requestId),
    });
  }

  doComplete(requestId: string): void {
    this.startAction(requestId);
    this.appointmentService.completeRequest(requestId).subscribe({
      next: (res) => this.finishAction(requestId, res.data),
      error: () => this.clearAction(requestId),
    });
  }

  doNoShow(requestId: string): void {
    this.startAction(requestId);
    this.appointmentService.noShowRequest(requestId).subscribe({
      next: (res) => this.finishAction(requestId, res.data),
      error: () => this.clearAction(requestId),
    });
  }

  isPast(proposedAt: string): boolean {
    return new Date(proposedAt) < new Date();
  }

  loadMore(): void {
    this.loadRequests(false);
  }

  chipClass(value: FilterOption): string {
    const active = this.activeFilter() === value;
    return active
      ? 'rounded-full bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white'
      : 'rounded-full border border-gray-300 px-4 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-50';
  }

  statusLabel(status: AppointmentStatus): string {
    return STATUS_STYLES[status].label;
  }

  statusBadgeClass(status: AppointmentStatus): string {
    return `flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[status].classes}`;
  }

  formatDate(iso: string): string {
    return iso.replace('T', ' ').slice(0, 16);
  }

  private loadRequests(reset: boolean): void {
    this.loading.set(true);
    const filter = this.activeFilter();
    const status = filter === 'ALL' ? undefined : filter;
    const cursor = reset ? undefined : (this.nextCursor() ?? undefined);

    this.appointmentService.listBusinessRequests(status, cursor).subscribe({
      next: (res) => {
        if (reset) {
          this.requests.set(res.data);
        } else {
          this.requests.update((current) => [...current, ...res.data]);
        }
        this.nextCursor.set(res.nextCursor);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  private startAction(requestId: string): void {
    this.actionInProgress.update((s) => new Set([...s, requestId]));
  }

  private finishAction(requestId: string, updated: AppointmentRequest): void {
    this.requests.update((current) =>
      current.map((r) => (r.requestId === requestId ? updated : r)),
    );
    this.clearAction(requestId);
  }

  private clearAction(requestId: string): void {
    this.actionInProgress.update((s) => {
      const next = new Set(s);
      next.delete(requestId);
      return next;
    });
  }
}
