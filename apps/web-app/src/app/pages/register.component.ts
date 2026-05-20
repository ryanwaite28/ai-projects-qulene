import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';

function passwordsMatchValidator(group: AbstractControl): ValidationErrors | null {
  const pw = group.get('password')?.value as string;
  const cpw = group.get('confirmPassword')?.value as string;
  return pw === cpw ? null : { passwordsMismatch: true };
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div class="w-full max-w-md">
        <h1 class="mb-8 text-center text-3xl font-bold text-gray-900">Create Account</h1>

        @if (success()) {
          <div class="rounded-xl bg-green-50 p-8 text-center shadow">
            <p class="text-lg font-medium text-green-800">Account created!</p>
            <p class="mt-2 text-sm text-green-700">
              Check your email to confirm your account, then log in.
            </p>
            <a
              [routerLink]="'/login'"
              class="mt-6 inline-block rounded-lg bg-brand-600 px-6 py-2.5 font-semibold text-white hover:bg-brand-700"
            >
              Log In
            </a>
          </div>
        } @else {
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
                autocomplete="new-password"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              @if (form.get('password')?.touched && form.get('password')?.hasError('required')) {
                <p class="mt-1 text-sm text-red-600">Password is required.</p>
              }
              @if (form.get('password')?.touched && form.get('password')?.hasError('minlength')) {
                <p class="mt-1 text-sm text-red-600">Password must be at least 8 characters.</p>
              }
            </div>

            <div>
              <label class="mb-1 block text-sm font-medium text-gray-700">Confirm Password</label>
              <input
                formControlName="confirmPassword"
                type="password"
                autocomplete="new-password"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              @if (form.get('confirmPassword')?.touched && form.hasError('passwordsMismatch')) {
                <p class="mt-1 text-sm text-red-600">Passwords do not match.</p>
              }
            </div>

            <fieldset>
              <legend class="mb-2 text-sm font-medium text-gray-700">I am a…</legend>
              <div class="flex gap-6">
                <label class="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    formControlName="role"
                    value="CUSTOMER"
                    class="text-brand-600"
                  />
                  <span class="text-sm text-gray-700">Customer</span>
                </label>
                <label class="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    formControlName="role"
                    value="BUSINESS"
                    class="text-brand-600"
                  />
                  <span class="text-sm text-gray-700">Business Owner</span>
                </label>
              </div>
              @if (form.get('role')?.touched && form.get('role')?.hasError('required')) {
                <p class="mt-1 text-sm text-red-600">Please select a role.</p>
              }
            </fieldset>

            <button
              type="submit"
              [disabled]="form.invalid || submitting()"
              class="w-full rounded-lg bg-brand-600 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              @if (submitting()) { Creating account… } @else { Create Account }
            </button>

            <p class="text-center text-sm text-gray-600">
              Already have an account?
              <a [routerLink]="'/login'" class="font-medium text-brand-600 hover:underline">
                Sign in
              </a>
            </p>
          </form>
        }
      </div>
    </div>
  `,
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  readonly form = this.fb.group(
    {
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
      role: ['', Validators.required],
    },
    { validators: passwordsMatchValidator },
  );
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal(false);

  async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);
    try {
      const { email, password, role } = this.form.value;
      await this.authService.register(
        email ?? '',
        password ?? '',
        (role ?? 'CUSTOMER') as 'CUSTOMER' | 'BUSINESS',
      );
      this.success.set(true);
    } catch {
      this.error.set('Registration failed. Please try again.');
    } finally {
      this.submitting.set(false);
    }
  }
}
