import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { BusinessService } from '../services/business.service';
import { AuthService } from '../services/auth.service';

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
  selector: 'app-business-profile',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, RouterLinkActive],
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

      <div class="mx-auto max-w-3xl px-4 py-10">
        <h1 class="mb-6 text-3xl font-bold text-gray-900">Business Profile</h1>

        @if (loading()) {
          <div class="space-y-4">
            @for (i of skeletonItems; track i) {
              <div class="h-12 animate-pulse rounded-xl bg-gray-200"></div>
            }
          </div>
        } @else {
          <!-- Avatar section -->
          <div class="mb-6 rounded-xl bg-white p-6 shadow">
            <h2 class="mb-4 text-lg font-semibold text-gray-900">Profile Photo</h2>
            <div class="flex items-center gap-5">
              @if (avatarPreview()) {
                <img
                  [src]="avatarPreview()"
                  alt="Business avatar"
                  class="h-20 w-20 rounded-full object-cover"
                />
              } @else {
                <div class="flex h-20 w-20 items-center justify-center rounded-full bg-brand-100 text-2xl font-bold text-brand-700">
                  ?
                </div>
              }
              <div>
                <label class="cursor-pointer rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                  @if (uploadInProgress()) { Uploading… } @else { Choose Photo }
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    class="hidden"
                    (change)="onFileSelected($event)"
                    [disabled]="uploadInProgress()"
                  />
                </label>
                @if (avatarError()) {
                  <p class="mt-1 text-sm text-red-600">{{ avatarError() }}</p>
                }
              </div>
            </div>
          </div>

          <!-- Profile form -->
          <div class="rounded-xl bg-white p-6 shadow">
            <h2 class="mb-4 text-lg font-semibold text-gray-900">Business Details</h2>

            @if (saveSuccess()) {
              <div class="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
                Profile saved.
              </div>
            }
            @if (saveError()) {
              <div class="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {{ saveError() }}
              </div>
            }

            <form [formGroup]="profileForm" (ngSubmit)="save()" class="space-y-4">
              <div>
                <label class="mb-1 block text-sm font-medium text-gray-700">Business Name</label>
                <input
                  formControlName="businessName"
                  type="text"
                  class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label class="mb-1 block text-sm font-medium text-gray-700">Category</label>
                <input
                  formControlName="category"
                  type="text"
                  placeholder="e.g. Hair Salon, Barbershop"
                  class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label class="mb-1 block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  formControlName="description"
                  rows="3"
                  class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                ></textarea>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="mb-1 block text-sm font-medium text-gray-700">Address</label>
                  <input
                    formControlName="address"
                    type="text"
                    class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label class="mb-1 block text-sm font-medium text-gray-700">City</label>
                  <input
                    formControlName="city"
                    type="text"
                    class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="mb-1 block text-sm font-medium text-gray-700">State</label>
                  <input
                    formControlName="state"
                    type="text"
                    class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label class="mb-1 block text-sm font-medium text-gray-700">Phone</label>
                  <input
                    formControlName="phone"
                    type="tel"
                    class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div class="flex justify-end pt-2">
                <button
                  type="submit"
                  [disabled]="submitting()"
                  class="rounded-lg bg-brand-600 px-6 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  @if (submitting()) { Saving… } @else { Save Profile }
                </button>
              </div>
            </form>
          </div>
        }
      </div>
    </div>
  `,
})
export class BusinessProfileComponent implements OnInit {
  private readonly businessService = inject(BusinessService);
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly saveSuccess = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly uploadInProgress = signal(false);
  readonly avatarPreview = signal<string | null>(null);
  readonly avatarError = signal<string | null>(null);

  readonly skeletonItems = [1, 2, 3, 4];

  readonly profileForm = this.fb.group({
    businessName: [''],
    category: [''],
    description: [''],
    address: [''],
    city: [''],
    state: [''],
    phone: [''],
  });

  ngOnInit(): void {
    const userId = decodeUserId();
    if (!userId) {
      this.loading.set(false);
      return;
    }
    this.businessService.getBusinessById(userId).subscribe({
      next: (res) => {
        const p = res.data;
        this.profileForm.setValue({
          businessName: p.businessName ?? '',
          category: p.category ?? '',
          description: p.description ?? '',
          address: p.address ?? '',
          city: p.city ?? '',
          state: p.state ?? '',
          phone: p.phone ?? '',
        });
        if (p.avatarUrl) this.avatarPreview.set(p.avatarUrl);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  save(): void {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.saveSuccess.set(false);
    this.saveError.set(null);

    const val = this.profileForm.value;
    const updates = {
      businessName: val.businessName || null,
      category: val.category || null,
      description: val.description || null,
      address: val.address || null,
      city: val.city || null,
      state: val.state || null,
      phone: val.phone || null,
    };

    this.businessService.updateMyProfile(updates).subscribe({
      next: () => {
        this.saveSuccess.set(true);
        this.submitting.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.saveError.set(
          err.status === 422 ? 'Invalid profile data.' : 'Something went wrong. Please try again.',
        );
        this.submitting.set(false);
      },
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      this.avatarError.set('Please choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.avatarError.set('Image must be 5 MB or smaller.');
      return;
    }

    this.avatarError.set(null);
    this.uploadInProgress.set(true);

    this.businessService.requestAvatarUploadUrl(file.type).subscribe({
      next: async (res) => {
        try {
          const { uploadUrl } = res.data;
          await fetch(uploadUrl, {
            method: 'PUT',
            body: file,
            headers: { 'Content-Type': file.type },
          });
          const parsed = new URL(uploadUrl);
          const avatarUrl = parsed.origin + parsed.pathname;
          await new Promise<void>((resolve, reject) => {
            this.businessService.updateMyProfile({ avatarUrl }).subscribe({
              next: () => resolve(),
              error: reject,
            });
          });
          this.avatarPreview.set(URL.createObjectURL(file));
          this.uploadInProgress.set(false);
        } catch {
          this.avatarError.set('Upload failed. Please try again.');
          this.uploadInProgress.set(false);
        }
      },
      error: () => {
        this.avatarError.set('Could not get upload URL. Please try again.');
        this.uploadInProgress.set(false);
      },
    });
  }
}
