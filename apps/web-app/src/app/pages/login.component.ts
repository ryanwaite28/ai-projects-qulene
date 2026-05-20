import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { UserApiService } from '../services/user-api.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div class="w-full max-w-md">
        <h1 class="mb-8 text-center text-3xl font-bold text-gray-900">Sign In</h1>

        @if (error()) {
          <div class="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {{ error() }}
          </div>
        }

        <form
          [formGroup]="form"
          (ngSubmit)="submit()"
          class="space-y-4 rounded-xl bg-white p-8 shadow"
        >
          <div>
            <label class="mb-1 block text-sm font-medium text-gray-700">Email</label>
            <input
              formControlName="email"
              type="email"
              autocomplete="email"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            @if (form.get('email')?.touched && form.get('email')?.hasError('required')) {
              <p class="mt-1 text-sm text-red-600">Email is required.</p>
            }
            @if (form.get('email')?.touched && form.get('email')?.hasError('email')) {
              <p class="mt-1 text-sm text-red-600">Enter a valid email address.</p>
            }
          </div>

          <div>
            <label class="mb-1 block text-sm font-medium text-gray-700">Password</label>
            <input
              formControlName="password"
              type="password"
              autocomplete="current-password"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            @if (form.get('password')?.touched && form.get('password')?.hasError('required')) {
              <p class="mt-1 text-sm text-red-600">Password is required.</p>
            }
          </div>

          <button
            type="submit"
            [disabled]="form.invalid || submitting()"
            class="w-full rounded-lg bg-brand-600 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            @if (submitting()) { Signing in… } @else { Sign In }
          </button>

          <p class="text-center text-sm text-gray-600">
            Don't have an account?
            <a [routerLink]="'/register'" class="font-medium text-brand-600 hover:underline">
              Sign up
            </a>
          </p>
        </form>
      </div>
    </div>
  `,
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly userApi = inject(UserApiService);
  private readonly router = inject(Router);

  readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);

    let navigateTo: string | null = null;
    try {
      const { email, password } = this.form.value;
      await this.authService.login(email ?? '', password ?? '');
      try {
        await firstValueFrom(this.userApi.createProfile());
      } catch {
        // best-effort — 409 (already exists) and transient errors do not block login
      }
      const role = this.authService.getUserRole();
      navigateTo = role === 'BUSINESS' ? '/business/dashboard' : '/customer/appointments';
    } catch {
      this.error.set('Invalid email or password. Please try again.');
      this.submitting.set(false);
    }

    if (navigateTo) {
      this.router.navigate([navigateTo]);
    }
  }
}
