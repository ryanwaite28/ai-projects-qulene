import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AvailabilityService } from '../services/availability.service';
import type { AvailabilityWindow } from '../services/availability.service';

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

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

@Component({
  selector: 'app-business-availability',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, RouterLinkActive],
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
        <h1 class="mb-6 text-3xl font-bold text-gray-900">Availability</h1>

        @if (loading()) {
          <div class="space-y-3">
            @for (i of skeletonItems; track i) {
              <div class="h-14 animate-pulse rounded-xl bg-gray-200"></div>
            }
          </div>
        } @else {
          <div class="rounded-xl bg-white shadow">
            @for (day of days; track day) {
              <div class="flex items-start gap-4 border-b border-gray-100 px-5 py-4 last:border-0">
                <span class="w-24 flex-shrink-0 pt-0.5 text-sm font-medium text-gray-700">
                  {{ dayNames[day] }}
                </span>
                <div class="flex flex-wrap items-center gap-2">
                  @for (win of windowsForDay(day); track win.windowId) {
                    <span class="flex items-center gap-1 rounded-full bg-brand-100 px-3 py-1 text-sm font-medium text-brand-800">
                      {{ win.startTime }}–{{ win.endTime }}
                      <button
                        type="button"
                        (click)="removeWindow(win.windowId)"
                        [disabled]="deletingWindowId() === win.windowId"
                        class="ml-0.5 text-brand-600 hover:text-brand-900 disabled:opacity-40"
                        aria-label="Remove window"
                      >
                        ×
                      </button>
                    </span>
                  }
                  <button
                    type="button"
                    (click)="openModal(day)"
                    class="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-gray-300 text-gray-400 hover:border-brand-400 hover:text-brand-600"
                    aria-label="Add window"
                  >
                    +
                  </button>
                </div>
              </div>
            }
          </div>
        }
      </div>
    </div>

    @if (modalOpen()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
        <div class="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
          <h2 class="mb-4 text-xl font-semibold text-gray-900">Add Availability Window</h2>

          @if (modalError()) {
            <div class="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {{ modalError() }}
            </div>
          }

          <form [formGroup]="windowForm" (ngSubmit)="submitModal()" class="space-y-4">
            <div>
              <label class="mb-1 block text-sm font-medium text-gray-700">Day</label>
              <select
                formControlName="dayOfWeek"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                @for (day of days; track day) {
                  <option [value]="day">{{ dayNames[day] }}</option>
                }
              </select>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="mb-1 block text-sm font-medium text-gray-700">Start Time</label>
                <input
                  formControlName="startTime"
                  type="time"
                  class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                @if (windowForm.get('startTime')?.touched && windowForm.get('startTime')?.hasError('required')) {
                  <p class="mt-1 text-xs text-red-600">Required.</p>
                }
              </div>
              <div>
                <label class="mb-1 block text-sm font-medium text-gray-700">End Time</label>
                <input
                  formControlName="endTime"
                  type="time"
                  class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                @if (windowForm.get('endTime')?.touched && windowForm.get('endTime')?.hasError('required')) {
                  <p class="mt-1 text-xs text-red-600">Required.</p>
                }
              </div>
            </div>
            @if (timeOrderError()) {
              <p class="text-sm text-red-600">End time must be after start time.</p>
            }

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
                [disabled]="windowForm.invalid || modalSubmitting() || timeOrderError()"
                class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                @if (modalSubmitting()) { Adding… } @else { Add }
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
})
export class BusinessAvailabilityComponent implements OnInit {
  private readonly availabilityService = inject(AvailabilityService);
  private readonly fb = inject(FormBuilder);

  readonly windows = signal<AvailabilityWindow[]>([]);
  readonly loading = signal(false);
  readonly modalOpen = signal(false);
  readonly modalSubmitting = signal(false);
  readonly modalError = signal<string | null>(null);
  readonly deletingWindowId = signal<string | null>(null);

  readonly days = [0, 1, 2, 3, 4, 5, 6];
  readonly dayNames = DAY_NAMES;
  readonly skeletonItems = [1, 2, 3, 4, 5, 6, 7];

  readonly windowForm = this.fb.group({
    dayOfWeek: [0, Validators.required],
    startTime: ['', Validators.required],
    endTime: ['', Validators.required],
  });

  ngOnInit(): void {
    const userId = decodeUserId();
    if (!userId) return;
    this.loading.set(true);
    this.availabilityService.listMyAvailability(userId).subscribe({
      next: (res) => {
        this.windows.set(res.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  windowsForDay(day: number): AvailabilityWindow[] {
    return this.windows()
      .filter((w) => w.dayOfWeek === day)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  timeOrderError(): boolean {
    const { startTime, endTime } = this.windowForm.value;
    if (!startTime || !endTime) return false;
    return endTime <= startTime;
  }

  openModal(day: number): void {
    this.modalError.set(null);
    this.windowForm.reset({ dayOfWeek: day, startTime: '', endTime: '' });
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
    this.modalError.set(null);
  }

  submitModal(): void {
    if (this.windowForm.invalid || this.modalSubmitting() || this.timeOrderError()) return;
    this.modalSubmitting.set(true);
    this.modalError.set(null);

    const val = this.windowForm.value;
    this.availabilityService
      .addWindow({
        dayOfWeek: val.dayOfWeek ?? 0,
        startTime: val.startTime ?? '',
        endTime: val.endTime ?? '',
      })
      .subscribe({
        next: (res) => {
          this.windows.update((current) => [res.data, ...current]);
          this.closeModal();
          this.modalSubmitting.set(false);
        },
        error: (err: HttpErrorResponse) => {
          const code = (err.error as { error?: { code?: string } })?.error?.code;
          if (err.status === 422 && code === 'DAY_LIMIT_REACHED') {
            this.modalError.set('This day already has 2 windows.');
          } else if (err.status === 422) {
            this.modalError.set('You have reached the 14-window limit.');
          } else {
            this.modalError.set('Something went wrong. Please try again.');
          }
          this.modalSubmitting.set(false);
        },
      });
  }

  removeWindow(windowId: string): void {
    this.deletingWindowId.set(windowId);
    this.availabilityService.removeWindow(windowId).subscribe({
      next: () => {
        this.windows.update((current) => current.filter((w) => w.windowId !== windowId));
        this.deletingWindowId.set(null);
      },
      error: () => this.deletingWindowId.set(null),
    });
  }
}
