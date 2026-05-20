import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { UserService } from '../services/user.service';

@Component({
  selector: 'app-customer-profile',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, RouterLinkActive],
  template: `
    <div class="min-h-screen bg-gray-50">
      <!-- Customer top-nav -->
      <nav class="border-b border-gray-200 bg-white px-4">
        <div class="mx-auto flex max-w-3xl gap-6 overflow-x-auto">
          <a [routerLink]="'/customer/appointments'" routerLinkActive="border-b-2 border-brand-600 text-brand-600"
            class="whitespace-nowrap py-4 text-sm font-medium text-gray-500 hover:text-gray-700">
            Appointments
          </a>
          <a [routerLink]="'/customer/waitlist'" routerLinkActive="border-b-2 border-brand-600 text-brand-600"
            class="whitespace-nowrap py-4 text-sm font-medium text-gray-500 hover:text-gray-700">
            Waitlist
          </a>
          <a [routerLink]="'/customer/notifications'" routerLinkActive="border-b-2 border-brand-600 text-brand-600"
            class="whitespace-nowrap py-4 text-sm font-medium text-gray-500 hover:text-gray-700">
            Notifications
          </a>
          <a [routerLink]="'/customer/profile'" routerLinkActive="border-b-2 border-brand-600 text-brand-600"
            class="whitespace-nowrap py-4 text-sm font-medium text-gray-500 hover:text-gray-700">
            Profile
          </a>
        </div>
      </nav>

      <div class="mx-auto max-w-3xl px-4 py-10">
        <h1 class="mb-6 text-3xl font-bold text-gray-900">My Profile</h1>

        @if (loading()) {
          <div class="space-y-4">
            <div class="h-12 animate-pulse rounded-xl bg-gray-200"></div>
            <div class="h-12 animate-pulse rounded-xl bg-gray-200"></div>
            <div class="h-12 animate-pulse rounded-xl bg-gray-200"></div>
          </div>
        } @else {
          <div class="rounded-xl bg-white p-6 shadow">
            @if (success()) {
              <div class="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
                Profile updated.
              </div>
            }
            @if (error()) {
              <div class="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {{ error() }}
              </div>
            }

            <!-- Read-only info -->
            <div class="mb-6 space-y-3">
              <div>
                <span class="block text-xs font-medium uppercase tracking-wide text-gray-400">Email</span>
                <span class="mt-0.5 block text-gray-700">{{ email() }}</span>
              </div>
              <div>
                <span class="block text-xs font-medium uppercase tracking-wide text-gray-400">Role</span>
                <span class="mt-0.5 block text-gray-700">{{ role() }}</span>
              </div>
            </div>

            <form [formGroup]="profileForm" (ngSubmit)="submit()" class="space-y-4">
              <div>
                <label class="mb-1 block text-sm font-medium text-gray-700">First Name</label>
                <input
                  formControlName="firstName"
                  type="text"
                  class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                @if (profileForm.get('firstName')?.touched && profileForm.get('firstName')?.hasError('required')) {
                  <p class="mt-1 text-sm text-red-600">First name is required.</p>
                }
                @if (profileForm.get('firstName')?.touched && profileForm.get('firstName')?.hasError('maxlength')) {
                  <p class="mt-1 text-sm text-red-600">First name must be 50 characters or fewer.</p>
                }
              </div>

              <div>
                <label class="mb-1 block text-sm font-medium text-gray-700">Last Name</label>
                <input
                  formControlName="lastName"
                  type="text"
                  class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                @if (profileForm.get('lastName')?.touched && profileForm.get('lastName')?.hasError('required')) {
                  <p class="mt-1 text-sm text-red-600">Last name is required.</p>
                }
                @if (profileForm.get('lastName')?.touched && profileForm.get('lastName')?.hasError('maxlength')) {
                  <p class="mt-1 text-sm text-red-600">Last name must be 50 characters or fewer.</p>
                }
              </div>

              <div class="flex justify-end pt-2">
                <button
                  type="submit"
                  [disabled]="profileForm.invalid || submitting()"
                  class="rounded-lg bg-brand-600 px-6 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  @if (submitting()) { Saving… } @else { Save Changes }
                </button>
              </div>
            </form>
          </div>
        }
      </div>
    </div>
  `,
})
export class CustomerProfileComponent implements OnInit {
  private readonly userService = inject(UserService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly success = signal(false);
  readonly error = signal<string | null>(null);
  readonly email = signal('');
  readonly role = signal('');

  readonly profileForm = this.fb.group({
    firstName: ['', [Validators.required, Validators.maxLength(50)]],
    lastName: ['', [Validators.required, Validators.maxLength(50)]],
  });

  ngOnInit(): void {
    this.userService.getMyProfile().subscribe({
      next: (res) => {
        const u = res.data;
        this.email.set(u.email);
        this.role.set(u.role);
        this.profileForm.setValue({ firstName: u.firstName, lastName: u.lastName });
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  submit(): void {
    if (this.profileForm.invalid || this.submitting()) return;
    this.submitting.set(true);
    this.success.set(false);
    this.error.set(null);

    const { firstName, lastName } = this.profileForm.value;

    this.userService.updateMyName({ firstName: firstName ?? '', lastName: lastName ?? '' }).subscribe({
      next: () => {
        this.success.set(true);
        this.submitting.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(err.status === 422 ? 'Invalid name value.' : 'Something went wrong. Please try again.');
        this.submitting.set(false);
      },
    });
  }
}
