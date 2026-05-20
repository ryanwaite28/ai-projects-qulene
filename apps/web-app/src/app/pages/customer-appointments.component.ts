import { Component, inject, Input, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { AppointmentRequest, AppointmentStatus } from '@qulene/api-types';
import { AppointmentService } from '../services/appointment.service';
import { ErrorStateComponent } from '../components/error-state.component';

interface StatusStyle {
  label: string;
  classes: string;
}

const STATUS_STYLES: Record<AppointmentStatus, StatusStyle> = {
  PENDING:   { label: 'Pending',   classes: 'bg-yellow-100 text-yellow-800' },
  ACCEPTED:  { label: 'Accepted',  classes: 'bg-green-100 text-green-800' },
  DECLINED:  { label: 'Declined',  classes: 'bg-red-100 text-red-800' },
  CANCELLED: { label: 'Cancelled', classes: 'bg-gray-100 text-gray-600' },
  COMPLETED: { label: 'Completed', classes: 'bg-blue-100 text-blue-800' },
  NO_SHOW:   { label: 'No Show',   classes: 'bg-orange-100 text-orange-800' },
};

@Component({
  selector: 'app-customer-appointments',
  standalone: true,
  imports: [ReactiveFormsModule, ErrorStateComponent],
  template: `
    <div class="min-h-screen bg-gray-50 px-4 py-10">
      <div class="mx-auto max-w-3xl">
        <div class="mb-6 flex items-center justify-between">
          <h1 class="text-3xl font-bold text-gray-900">My Appointments</h1>
          <button
            type="button"
            (click)="openNewModal()"
            class="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-700"
          >
            + New Request
          </button>
        </div>

        @if (fetchError()) {
          <app-error-state [message]="fetchError()!" (retry)="retry()" />
        } @else if (loading() && requests().length === 0) {
          <div class="space-y-3">
            @for (i of skeletonItems; track i) {
              <div class="h-20 animate-pulse rounded-xl bg-gray-200"></div>
            }
          </div>
        } @else if (requests().length === 0) {
          <p class="py-16 text-center text-gray-500">No appointment requests yet.</p>
        } @else {
          <ul class="space-y-3">
            @for (req of requests(); track req.requestId) {
              <li class="rounded-xl bg-white p-5 shadow">
                <div class="flex items-start justify-between gap-4">
                  <div class="min-w-0">
                    <p class="font-medium text-gray-900">Service: {{ req.serviceId }}</p>
                    <p class="mt-1 text-sm text-gray-500">
                      Proposed: {{ formatDate(req.proposedAt) }}
                    </p>
                    @if (req.notes) {
                      <p class="mt-1 text-sm text-gray-600">{{ req.notes }}</p>
                    }
                  </div>
                  <span [class]="statusBadgeClass(req.status)">
                    {{ statusStyle(req.status).label }}
                  </span>
                </div>

                @if (confirmCancelId() === req.requestId) {
                  <div class="mt-3 flex items-center gap-3 rounded-lg bg-red-50 px-3 py-2 text-sm">
                    <span class="text-red-700">Cancel this request?</span>
                    <button
                      type="button"
                      (click)="confirmCancel(req.requestId)"
                      class="font-semibold text-red-700 hover:underline"
                    >
                      Yes, cancel
                    </button>
                    <button
                      type="button"
                      (click)="confirmCancelId.set(null)"
                      class="font-semibold text-gray-600 hover:underline"
                    >
                      Keep
                    </button>
                  </div>
                } @else if (req.status === 'PENDING' || req.status === 'ACCEPTED') {
                  <button
                    type="button"
                    (click)="confirmCancelId.set(req.requestId)"
                    class="mt-3 text-sm font-medium text-red-600 hover:underline"
                  >
                    Cancel
                  </button>
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

    @if (modalOpen()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
        <div class="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
          <h2 class="mb-4 text-xl font-semibold text-gray-900">New Appointment Request</h2>

          @if (modalError()) {
            <div class="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {{ modalError() }}
            </div>
          }

          <form [formGroup]="modalForm" (ngSubmit)="submitModal()" class="space-y-4">
            <div>
              <label class="mb-1 block text-sm font-medium text-gray-700">Service ID</label>
              <input
                formControlName="serviceId"
                type="text"
                [attr.readonly]="prefillServiceId ? true : null"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 read-only:bg-gray-50"
              />
              @if (modalForm.get('serviceId')?.touched && modalForm.get('serviceId')?.hasError('required')) {
                <p class="mt-1 text-sm text-red-600">Service ID is required.</p>
              }
            </div>

            <div>
              <label class="mb-1 block text-sm font-medium text-gray-700">Proposed Date & Time</label>
              <input
                formControlName="proposedAt"
                type="datetime-local"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              @if (modalForm.get('proposedAt')?.touched && modalForm.get('proposedAt')?.hasError('required')) {
                <p class="mt-1 text-sm text-red-600">Please choose a date and time.</p>
              }
            </div>

            <div>
              <label class="mb-1 block text-sm font-medium text-gray-700">
                Notes <span class="text-gray-400">(optional)</span>
              </label>
              <textarea
                formControlName="notes"
                rows="3"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              ></textarea>
            </div>

            <div class="flex justify-end gap-3 pt-2">
              <button
                type="button"
                (click)="closeModal()"
                class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                [disabled]="modalForm.invalid || modalSubmitting()"
                class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                @if (modalSubmitting()) { Submitting… } @else { Submit Request }
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
})
export class CustomerAppointmentsComponent implements OnInit {
  @Input() openModal?: string;
  @Input() serviceId?: string;

  private readonly appointmentService = inject(AppointmentService);
  private readonly fb = inject(FormBuilder);

  readonly requests = signal<AppointmentRequest[]>([]);
  readonly loading = signal(false);
  readonly nextCursor = signal<string | null>(null);
  readonly modalOpen = signal(false);
  readonly modalSubmitting = signal(false);
  readonly modalError = signal<string | null>(null);
  readonly confirmCancelId = signal<string | null>(null);
  readonly fetchError = signal<string | null>(null);

  readonly skeletonItems = [1, 2, 3];

  prefillServiceId = false;

  private idempotencyKey = '';

  readonly modalForm = this.fb.group({
    serviceId: ['', Validators.required],
    proposedAt: ['', Validators.required],
    notes: [''],
  });

  ngOnInit(): void {
    this.loadRequests(true);
    if (this.openModal === 'true') {
      this.openNewModal();
    }
  }

  openNewModal(): void {
    this.idempotencyKey = crypto.randomUUID();
    this.modalError.set(null);
    this.prefillServiceId = !!this.serviceId;
    this.modalForm.reset({
      serviceId: this.serviceId ?? '',
      proposedAt: '',
      notes: '',
    });
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
    this.modalError.set(null);
  }

  submitModal(): void {
    if (this.modalForm.invalid || this.modalSubmitting()) return;
    this.modalSubmitting.set(true);
    this.modalError.set(null);

    const { serviceId, proposedAt, notes } = this.modalForm.value;
    const proposedAtIso = proposedAt ? new Date(proposedAt).toISOString() : '';

    this.appointmentService
      .createRequest({
        serviceId: serviceId ?? '',
        proposedAt: proposedAtIso,
        notes: notes ?? undefined,
        idempotencyKey: this.idempotencyKey,
      })
      .subscribe({
        next: (res) => {
          this.requests.update((current) => [res.data, ...current]);
          this.closeModal();
          this.modalSubmitting.set(false);
        },
        error: (err: HttpErrorResponse) => {
          if (err.status === 409) {
            this.modalError.set('You already have an active request for this service.');
          } else if (err.status === 422) {
            this.modalError.set('Please choose a future date and time.');
          } else {
            this.modalError.set('Something went wrong. Please try again.');
          }
          this.modalSubmitting.set(false);
        },
      });
  }

  confirmCancel(requestId: string): void {
    this.appointmentService.cancelRequest(requestId).subscribe({
      next: (res) => {
        this.requests.update((current) =>
          current.map((r) => (r.requestId === requestId ? res.data : r)),
        );
        this.confirmCancelId.set(null);
      },
      error: () => {
        this.confirmCancelId.set(null);
      },
    });
  }

  loadMore(): void {
    this.loadRequests(false);
  }

  statusStyle(status: AppointmentStatus): StatusStyle {
    return STATUS_STYLES[status];
  }

  statusBadgeClass(status: AppointmentStatus): string {
    return `flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[status].classes}`;
  }

  formatDate(iso: string): string {
    return iso.replace('T', ' ').slice(0, 16);
  }

  retry(): void {
    this.fetchError.set(null);
    this.loadRequests(true);
  }

  private loadRequests(reset: boolean): void {
    this.loading.set(true);
    if (reset) this.fetchError.set(null);
    const cursor = reset ? undefined : (this.nextCursor() ?? undefined);

    this.appointmentService.listCustomerRequests(cursor).subscribe({
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
        this.fetchError.set('Failed to load appointments');
        this.loading.set(false);
      },
    });
  }
}
