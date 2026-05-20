import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MarketingApiService } from '../services/marketing-api.service';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <section class="py-20 px-4 sm:px-6 lg:px-8">
      <div class="max-w-2xl mx-auto">
        <h1 class="text-4xl font-extrabold text-gray-900 mb-4">Contact Us</h1>
        <p class="text-lg text-gray-500 mb-12">
          Have a question or feedback? We'd love to hear from you.
        </p>

        @if (success()) {
          <div class="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
            <div class="text-3xl mb-4">✓</div>
            <h2 class="text-xl font-bold text-green-800 mb-2">Message sent!</h2>
            <p class="text-green-700">Thanks — we'll be in touch.</p>
          </div>
        } @else {
          <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-6">
            <!-- Name -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1" for="name">
                Name
              </label>
              <input
                id="name"
                formControlName="name"
                type="text"
                placeholder="Your name"
                class="w-full px-4 py-3 rounded-xl border border-gray-300
                       focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-900 text-sm"
              />
              @if (form.get('name')?.touched && form.get('name')?.hasError('required')) {
                <p class="text-red-500 text-xs mt-1">Name is required</p>
              }
              @if (form.get('name')?.touched && form.get('name')?.hasError('maxlength')) {
                <p class="text-red-500 text-xs mt-1">Name must be 100 characters or fewer</p>
              }
            </div>

            <!-- Email -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1" for="email">
                Email
              </label>
              <input
                id="email"
                formControlName="email"
                type="email"
                placeholder="you@example.com"
                class="w-full px-4 py-3 rounded-xl border border-gray-300
                       focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-900 text-sm"
              />
              @if (form.get('email')?.touched && form.get('email')?.hasError('required')) {
                <p class="text-red-500 text-xs mt-1">Email is required</p>
              }
              @if (form.get('email')?.touched && form.get('email')?.hasError('email')) {
                <p class="text-red-500 text-xs mt-1">Enter a valid email address</p>
              }
            </div>

            <!-- Message -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1" for="message">
                Message
              </label>
              <textarea
                id="message"
                formControlName="message"
                rows="6"
                placeholder="How can we help?"
                class="w-full px-4 py-3 rounded-xl border border-gray-300
                       focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-900 text-sm
                       resize-none"
              ></textarea>
              @if (form.get('message')?.touched && form.get('message')?.hasError('required')) {
                <p class="text-red-500 text-xs mt-1">Message is required</p>
              }
              @if (form.get('message')?.touched && form.get('message')?.hasError('maxlength')) {
                <p class="text-red-500 text-xs mt-1">Message must be 2000 characters or fewer</p>
              }
            </div>

            @if (error()) {
              <p class="text-red-500 text-sm">{{ error() }}</p>
            }

            <button
              type="submit"
              [disabled]="form.invalid || submitting()"
              class="w-full bg-indigo-600 text-white font-semibold px-6 py-3 rounded-xl
                     hover:bg-indigo-700 transition-colors disabled:opacity-50
                     disabled:cursor-not-allowed"
            >
              {{ submitting() ? 'Sending…' : 'Send Message' }}
            </button>
          </form>
        }
      </div>
    </section>
  `,
})
export class ContactComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(MarketingApiService);

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email]],
    message: ['', [Validators.required, Validators.maxLength(2000)]],
  });

  readonly submitting = signal(false);
  readonly success = signal(false);
  readonly error = signal<string | null>(null);

  submit(): void {
    if (this.form.invalid) return;
    this.submitting.set(true);
    this.error.set(null);
    const { name, email, message } = this.form.getRawValue();
    this.api.submitContact({ name: name ?? '', email: email ?? '', message: message ?? '' }).subscribe({
      next: () => {
        this.success.set(true);
        this.submitting.set(false);
        this.form.reset();
      },
      error: () => {
        this.error.set('Something went wrong, please try again.');
        this.submitting.set(false);
      },
    });
  }
}
