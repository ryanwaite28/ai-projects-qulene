import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ServiceManagementService } from '../services/service-management.service';
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
  selector: 'app-business-services',
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

      <div class="mx-auto max-w-4xl px-4 py-10">
        <div class="mb-6 flex items-center justify-between">
          <h1 class="text-3xl font-bold text-gray-900">My Services</h1>
          <button
            type="button"
            (click)="openCreate()"
            class="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-700"
          >
            + Add Service
          </button>
        </div>

        @if (loading() && services().length === 0) {
          <div class="space-y-3">
            @for (i of skeletonItems; track i) {
              <div class="h-28 animate-pulse rounded-xl bg-gray-200"></div>
            }
          </div>
        } @else if (services().length === 0) {
          <p class="py-16 text-center text-gray-500">
            No services yet. Add your first service.
          </p>
        } @else {
          <ul class="space-y-3">
            @for (svc of services(); track svc.serviceId) {
              <li class="rounded-xl bg-white p-5 shadow">
                <div class="flex items-start justify-between gap-4">
                  <div class="min-w-0">
                    <p class="font-semibold text-gray-900">{{ svc.name }}</p>
                    @if (svc.description) {
                      <p class="mt-0.5 line-clamp-2 text-sm text-gray-500">{{ svc.description }}</p>
                    }
                    <p class="mt-1 text-sm text-gray-600">
                      {{ svc.durationMinutes }} min · {{ formatPrice(svc.price) }}
                    </p>
                  </div>
                  <span [class]="statusBadgeClass(svc.status)">
                    {{ svc.status === 'ACTIVE' ? 'Active' : 'Paused' }}
                  </span>
                </div>

                @if (confirmDeleteId() === svc.serviceId) {
                  <div class="mt-3 flex items-center gap-3 rounded-lg bg-red-50 px-3 py-2 text-sm">
                    <span class="text-red-700">Delete this service?</span>
                    <button
                      type="button"
                      (click)="confirmDelete(svc.serviceId)"
                      class="font-semibold text-red-700 hover:underline"
                    >
                      Yes, delete
                    </button>
                    <button
                      type="button"
                      (click)="confirmDeleteId.set(null)"
                      class="font-semibold text-gray-600 hover:underline"
                    >
                      Cancel
                    </button>
                  </div>
                } @else {
                  <div class="mt-3 flex gap-2">
                    <button
                      type="button"
                      (click)="openEdit(svc)"
                      class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      (click)="toggleStatus(svc)"
                      [disabled]="actionInProgress().has(svc.serviceId)"
                      class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      @if (actionInProgress().has(svc.serviceId)) {
                        Working…
                      } @else if (svc.status === 'ACTIVE') {
                        Pause
                      } @else {
                        Resume
                      }
                    </button>
                    <button
                      type="button"
                      (click)="confirmDeleteId.set(svc.serviceId)"
                      class="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
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
          <h2 class="mb-4 text-xl font-semibold text-gray-900">
            @if (modalMode() === 'create') { New Service } @else { Edit Service }
          </h2>

          @if (modalError()) {
            <div class="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {{ modalError() }}
            </div>
          }

          <form [formGroup]="modalForm" (ngSubmit)="submitModal()" class="space-y-4">
            <div>
              <label class="mb-1 block text-sm font-medium text-gray-700">Name</label>
              <input
                formControlName="name"
                type="text"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              @if (modalForm.get('name')?.touched && modalForm.get('name')?.hasError('required')) {
                <p class="mt-1 text-sm text-red-600">Name is required.</p>
              }
            </div>

            <div>
              <label class="mb-1 block text-sm font-medium text-gray-700">
                Description <span class="text-gray-400">(optional)</span>
              </label>
              <textarea
                formControlName="description"
                rows="2"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              ></textarea>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="mb-1 block text-sm font-medium text-gray-700">Duration (min)</label>
                <input
                  formControlName="durationMinutes"
                  type="number"
                  min="15"
                  max="480"
                  class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                @if (modalForm.get('durationMinutes')?.touched && modalForm.get('durationMinutes')?.invalid) {
                  <p class="mt-1 text-sm text-red-600">Enter 15–480 minutes.</p>
                }
              </div>
              <div>
                <label class="mb-1 block text-sm font-medium text-gray-700">Price ($)</label>
                <input
                  formControlName="price"
                  type="number"
                  min="0"
                  step="0.01"
                  class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                @if (modalForm.get('price')?.touched && modalForm.get('price')?.hasError('required')) {
                  <p class="mt-1 text-sm text-red-600">Price is required.</p>
                }
              </div>
            </div>

            <div>
              <label class="mb-1 block text-sm font-medium text-gray-700">Status</label>
              <div class="flex gap-4">
                <label class="flex items-center gap-2 text-sm">
                  <input type="radio" formControlName="status" value="ACTIVE" class="accent-brand-600" />
                  Active
                </label>
                <label class="flex items-center gap-2 text-sm">
                  <input type="radio" formControlName="status" value="PAUSED" class="accent-brand-600" />
                  Paused
                </label>
              </div>
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
                @if (modalSubmitting()) { Saving… } @else { Save }
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
})
export class BusinessServicesComponent implements OnInit {
  private readonly svcService = inject(ServiceManagementService);
  private readonly fb = inject(FormBuilder);

  readonly services = signal<Service[]>([]);
  readonly loading = signal(false);
  readonly modalOpen = signal(false);
  readonly modalMode = signal<'create' | 'edit'>('create');
  readonly editingServiceId = signal<string | null>(null);
  readonly modalSubmitting = signal(false);
  readonly modalError = signal<string | null>(null);
  readonly confirmDeleteId = signal<string | null>(null);
  readonly actionInProgress = signal<Set<string>>(new Set());

  readonly skeletonItems = [1, 2, 3];

  readonly modalForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: [''],
    durationMinutes: [60, [Validators.required, Validators.min(15), Validators.max(480)]],
    price: [0, [Validators.required, Validators.min(0)]],
    status: ['ACTIVE'],
  });

  ngOnInit(): void {
    const userId = decodeUserId();
    if (!userId) return;
    this.loading.set(true);
    this.svcService.listMyServices(userId).subscribe({
      next: (res) => {
        this.services.set(res.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openCreate(): void {
    this.modalMode.set('create');
    this.editingServiceId.set(null);
    this.modalError.set(null);
    this.modalForm.reset({ name: '', description: '', durationMinutes: 60, price: 0, status: 'ACTIVE' });
    this.modalOpen.set(true);
  }

  openEdit(svc: Service): void {
    this.modalMode.set('edit');
    this.editingServiceId.set(svc.serviceId);
    this.modalError.set(null);
    this.modalForm.setValue({
      name: svc.name,
      description: svc.description ?? '',
      durationMinutes: svc.durationMinutes,
      price: svc.price / 100,
      status: svc.status === 'DELETED' ? 'ACTIVE' : svc.status,
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

    const val = this.modalForm.value;
    const priceCents = Math.round((val.price ?? 0) * 100);
    const body = {
      name: val.name ?? '',
      description: val.description || undefined,
      durationMinutes: val.durationMinutes ?? 60,
      price: priceCents,
      status: (val.status ?? 'ACTIVE') as 'ACTIVE' | 'PAUSED',
    };

    if (this.modalMode() === 'create') {
      this.svcService.createService(body).subscribe({
        next: (res) => {
          this.services.update((current) => [res.data, ...current]);
          this.closeModal();
          this.modalSubmitting.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.modalError.set(
            err.status === 422
              ? 'You have reached the 20 active service limit.'
              : 'Something went wrong. Please try again.',
          );
          this.modalSubmitting.set(false);
        },
      });
    } else {
      const id = this.editingServiceId()!;
      this.svcService.updateService(id, body).subscribe({
        next: (res) => {
          this.services.update((current) =>
            current.map((s) => (s.serviceId === id ? res.data : s)),
          );
          this.closeModal();
          this.modalSubmitting.set(false);
        },
        error: () => {
          this.modalError.set('Something went wrong. Please try again.');
          this.modalSubmitting.set(false);
        },
      });
    }
  }

  toggleStatus(svc: Service): void {
    const newStatus = svc.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    this.actionInProgress.update((s) => new Set([...s, svc.serviceId]));
    this.svcService.updateService(svc.serviceId, { status: newStatus }).subscribe({
      next: (res) => {
        this.services.update((current) =>
          current.map((s) => (s.serviceId === svc.serviceId ? res.data : s)),
        );
        this.clearAction(svc.serviceId);
      },
      error: () => this.clearAction(svc.serviceId),
    });
  }

  confirmDelete(serviceId: string): void {
    this.svcService.softDeleteService(serviceId).subscribe({
      next: () => {
        this.services.update((current) => current.filter((s) => s.serviceId !== serviceId));
        this.confirmDeleteId.set(null);
      },
      error: () => this.confirmDeleteId.set(null),
    });
  }

  formatPrice(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }

  statusBadgeClass(status: string): string {
    return status === 'ACTIVE'
      ? 'flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-green-100 text-green-800'
      : 'flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-yellow-100 text-yellow-800';
  }

  private clearAction(serviceId: string): void {
    this.actionInProgress.update((s) => {
      const next = new Set(s);
      next.delete(serviceId);
      return next;
    });
  }
}
