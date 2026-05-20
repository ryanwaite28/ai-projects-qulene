import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-pricing',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="py-20 px-4 sm:px-6 lg:px-8">
      <div class="max-w-5xl mx-auto">
        <h1 class="text-4xl font-extrabold text-gray-900 text-center mb-4">Pricing</h1>
        <p class="text-lg text-gray-500 text-center mb-16 max-w-2xl mx-auto">
          Simple, transparent pricing. Start free — upgrade when you're ready to grow.
        </p>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          <!-- Free tier -->
          <div class="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
            <div class="mb-6">
              <h2 class="text-xl font-bold text-gray-900 mb-1">Free</h2>
              <p class="text-gray-500 text-sm">Get started at no cost</p>
              <div class="mt-4 text-4xl font-extrabold text-gray-900">$0
                <span class="text-base font-normal text-gray-400">/mo</span>
              </div>
            </div>
            <ul class="space-y-3 mb-8">
              @for (item of freeTier; track item) {
                <li class="flex items-start gap-2 text-sm text-gray-600">
                  <span class="text-indigo-500 font-bold mt-0.5">✓</span>
                  {{ item }}
                </li>
              }
            </ul>
            <a
              href="https://app.qulene.com"
              class="block text-center bg-indigo-600 text-white font-semibold px-6 py-3
                     rounded-xl hover:bg-indigo-700 transition-colors"
            >
              Get Started Free
            </a>
          </div>

          <!-- Pro tier -->
          <div class="bg-indigo-600 rounded-2xl p-8 shadow-md text-white relative overflow-hidden">
            <div class="absolute top-4 right-4 bg-white text-indigo-600 text-xs font-bold
                        px-3 py-1 rounded-full">
              Coming Soon
            </div>
            <div class="mb-6">
              <h2 class="text-xl font-bold mb-1">Pro</h2>
              <p class="text-indigo-200 text-sm">For growing service businesses</p>
              <div class="mt-4 text-4xl font-extrabold">?
                <span class="text-base font-normal text-indigo-300">/mo</span>
              </div>
            </div>
            <ul class="space-y-3 mb-8">
              @for (item of proTier; track item) {
                <li class="flex items-start gap-2 text-sm text-indigo-100">
                  <span class="font-bold mt-0.5">✓</span>
                  {{ item }}
                </li>
              }
            </ul>
            <a
              routerLink="/"
              fragment="waitlist"
              class="block text-center bg-white text-indigo-700 font-semibold px-6 py-3
                     rounded-xl hover:bg-indigo-50 transition-colors"
            >
              Join the Waitlist
            </a>
          </div>
        </div>

        <p class="text-center text-sm text-gray-400 mt-12">
          Questions? <a routerLink="/contact" class="text-indigo-600 hover:underline">Contact us</a>
        </p>
      </div>
    </section>
  `,
})
export class PricingComponent {
  readonly freeTier = [
    'Up to 2 active services',
    'Up to 10 waitlist entries per service',
    'Appointment request management',
    'In-app notifications',
    'Basic customer profile',
  ];

  readonly proTier = [
    'Unlimited services',
    'Unlimited waitlist entries',
    'Priority email notifications',
    'Analytics dashboard',
    'Custom branding',
    'Priority support',
  ];
}
