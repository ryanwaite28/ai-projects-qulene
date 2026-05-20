import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MarketingApiService } from '../services/marketing-api.service';

@Component({
  selector: 'app-waitlist-signup',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <section class="bg-indigo-50 py-16 px-4 sm:px-6 lg:px-8">
      <div class="max-w-xl mx-auto text-center">
        <h2 class="text-2xl font-bold text-gray-900 mb-3">Stay in the loop</h2>
        <p class="text-gray-500 mb-8">
          Be the first to hear about new features and Pro plan availability.
        </p>

        @if (submitted()) {
          <p class="text-indigo-700 font-semibold text-lg">
            You're on the list! We'll be in touch.
          </p>
        } @else {
          <form
            [formGroup]="form"
            (ngSubmit)="submit()"
            class="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <div class="flex-1 sm:max-w-sm">
              <input
                formControlName="email"
                type="email"
                placeholder="you@example.com"
                class="w-full px-4 py-3 rounded-xl border border-gray-300
                       focus:outline-none focus:ring-2 focus:ring-indigo-400
                       text-gray-900 text-sm"
              />
              @if (form.get('email')?.touched && form.get('email')?.hasError('required')) {
                <p class="text-red-500 text-xs mt-1 text-left">Email is required</p>
              }
              @if (form.get('email')?.touched && form.get('email')?.hasError('email')) {
                <p class="text-red-500 text-xs mt-1 text-left">Enter a valid email address</p>
              }
              @if (error()) {
                <p class="text-red-500 text-xs mt-1 text-left">{{ error() }}</p>
              }
            </div>
            <button
              type="submit"
              [disabled]="form.invalid || submitting()"
              class="bg-indigo-600 text-white font-semibold px-6 py-3 rounded-xl
                     hover:bg-indigo-700 transition-colors disabled:opacity-50
                     disabled:cursor-not-allowed whitespace-nowrap"
            >
              {{ submitting() ? 'Joining…' : 'Join the Waitlist' }}
            </button>
          </form>
        }
      </div>
    </section>
  `,
})
export class WaitlistSignupComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(MarketingApiService);

  readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  readonly submitting = signal(false);
  readonly submitted = signal(false);
  readonly error = signal<string | null>(null);

  submit(): void {
    if (this.form.invalid) return;
    this.submitting.set(true);
    this.error.set(null);
    const { email } = this.form.getRawValue();
    this.api.joinWaitlist(email ?? '').subscribe({
      next: () => {
        this.submitted.set(true);
        this.submitting.set(false);
      },
      error: () => {
        this.error.set('Something went wrong. Please try again.');
        this.submitting.set(false);
      },
    });
  }
}
