import { Component, inject, Input, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { WaitlistStatus } from '@qulene/api-types';
import { WaitlistService } from '../services/waitlist.service';
import type { WaitlistEntry } from '../services/waitlist.service';

interface StatusStyle {
  label: string;
  classes: string;
}

const STATUS_STYLES: Record<WaitlistStatus, StatusStyle> = {
  ACTIVE:   { label: 'Active',    classes: 'bg-blue-100 text-blue-800' },
  PROMOTED: { label: 'Promoted',  classes: 'bg-green-100 text-green-800' },
  REMOVED:  { label: 'Removed',   classes: 'bg-gray-100 text-gray-600' },
};

@Component({
  selector: 'app-customer-waitlist',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="min-h-screen bg-gray-50 px-4 py-10">
      <div class="mx-auto max-w-3xl">
        <div class="mb-6 flex items-center justify-between">
          <h1 class="text-3xl font-bold text-gray-900">My Waitlist</h1>
          <button
            type="button"
            (click)="openJoinModal()"
            class="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-700"
          >
            + Join Waitlist
          </button>
        </div>

        @if (loading() && entries().length === 0) {
          <div class="space-y-3">
            @for (i of skeletonItems; track i) {
              <div class="h-20 animate-pulse rounded-xl bg-gray-200"></div>
            }
          </div>
        } @else if (entries().length === 0) {
          <p class="py-16 text-center text-gray-500">You are not on any waitlists yet.</p>
        } @else {
          <ul class="space-y-3">
            @for (entry of entries(); track entry.entryId) {
              <li class="rounded-xl bg-white p-5 shadow">
                <div class="flex items-start justify-between gap-4">
                  <div class="min-w-0">
                    <p class="font-medium text-gray-900">Service: {{ entry.serviceId }}</p>
                    <p class="mt-1 text-sm text-gray-500">
                      Joined: {{ formatDate(entry.createdAt) }}
                    </p>
                  </div>
                  <span [class]="statusBadgeClass(entry.status)">
                    {{ statusLabel(entry.status) }}
                  </span>
                </div>

                @if (entry.status === 'PROMOTED') {
                  <div class="mt-3">
                    <a
                      [routerLink]="'/customer/appointments'"
                      [queryParams]="{ openModal: 'true', serviceId: entry.serviceId }"
                      class="inline-block rounded-lg bg-green-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-green-700"
                    >
                      Book Now
                    </a>
                  </div>
                } @else if (entry.status === 'ACTIVE') {
                  @if (confirmLeaveId() === entry.entryId) {
                    <div class="mt-3 flex items-center gap-3 rounded-lg bg-red-50 px-3 py-2 text-sm">
                      <span class="text-red-700">Leave this waitlist?</span>
                      <button
                        type="button"
                        (click)="confirmLeave(entry.entryId)"
                        class="font-semibold text-red-700 hover:underline"
                      >
                        Yes, leave
                      </button>
                      <button
                        type="button"
                        (click)="confirmLeaveId.set(null)"
                        class="font-semibold text-gray-600 hover:underline"
                      >
                        Keep
                      </button>
                    </div>
                  } @else {
                    <button
                      type="button"
                      (click)="confirmLeaveId.set(entry.entryId)"
                      class="mt-3 text-sm font-medium text-red-600 hover:underline"
                    >
                      Leave
                    </button>
                  }
                }
              </li>
            }
          </ul>
        }
      </div>
    </div>

    @if (modalOpen()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
        <div class="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
          <h2 class="mb-4 text-xl font-semibold text-gray-900">Join Waitlist</h2>

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
                @if (modalSubmitting()) { Joining… } @else { Join Waitlist }
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
})
export class CustomerWaitlistComponent implements OnInit {
  @Input() serviceId?: string;

  private readonly waitlistService = inject(WaitlistService);
  private readonly fb = inject(FormBuilder);

  readonly entries = signal<WaitlistEntry[]>([]);
  readonly loading = signal(false);
  readonly modalOpen = signal(false);
  readonly modalSubmitting = signal(false);
  readonly modalError = signal<string | null>(null);
  readonly confirmLeaveId = signal<string | null>(null);

  readonly skeletonItems = [1, 2, 3];

  prefillServiceId = false;

  readonly modalForm = this.fb.group({
    serviceId: ['', Validators.required],
  });

  ngOnInit(): void {
    this.loadEntries();
    if (this.serviceId) {
      this.openJoinModal();
    }
  }

  openJoinModal(): void {
    this.modalError.set(null);
    this.prefillServiceId = !!this.serviceId;
    this.modalForm.reset({ serviceId: this.serviceId ?? '' });
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

    const { serviceId } = this.modalForm.value;

    this.waitlistService.joinWaitlist(serviceId ?? '').subscribe({
      next: (res) => {
        this.entries.update((current) => [res.data, ...current]);
        this.closeModal();
        this.modalSubmitting.set(false);
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 409) {
          this.modalError.set('You are already on the waitlist for this service.');
        } else {
          this.modalError.set('Something went wrong. Please try again.');
        }
        this.modalSubmitting.set(false);
      },
    });
  }

  confirmLeave(entryId: string): void {
    this.waitlistService.leaveWaitlist(entryId).subscribe({
      next: () => {
        this.entries.update((current) => current.filter((e) => e.entryId !== entryId));
        this.confirmLeaveId.set(null);
      },
      error: () => {
        this.confirmLeaveId.set(null);
      },
    });
  }

  statusLabel(status: WaitlistStatus): string {
    return STATUS_STYLES[status].label;
  }

  statusBadgeClass(status: WaitlistStatus): string {
    return `flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[status].classes}`;
  }

  formatDate(iso: string): string {
    return iso.replace('T', ' ').slice(0, 16);
  }

  private loadEntries(): void {
    this.loading.set(true);
    this.waitlistService.listCustomerEntries().subscribe({
      next: (res) => {
        this.entries.set(res.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }
}
