import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WaitlistSignupComponent } from '../components/waitlist-signup.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, WaitlistSignupComponent],
  template: `
    <!-- Hero -->
    <section class="bg-gradient-to-br from-indigo-50 to-white py-20 px-4 sm:px-6 lg:px-8">
      <div class="max-w-4xl mx-auto text-center">
        <h1 class="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight mb-6">
          Simplify Your<br class="hidden sm:block" />
          <span class="text-indigo-600">Service Business</span>
        </h1>
        <p class="text-lg sm:text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
          Qulene helps independent service providers manage appointment requests and customer
          waitlists — so you can focus on your craft, not your calendar.
        </p>
        <div class="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="https://app.qulene.com"
            class="bg-indigo-600 text-white font-semibold px-8 py-3 rounded-xl
                   hover:bg-indigo-700 transition-colors text-center shadow-md"
          >
            Open Web App
          </a>
          <a
            routerLink="/how-it-works"
            class="border border-indigo-300 text-indigo-700 font-semibold px-8 py-3 rounded-xl
                   hover:bg-indigo-50 transition-colors text-center"
          >
            See How It Works
          </a>
        </div>
        <p class="mt-4 text-sm text-gray-400">Free to get started · No credit card required</p>
      </div>
    </section>

    <!-- Feature cards -->
    <section class="py-20 px-4 sm:px-6 lg:px-8">
      <div class="max-w-6xl mx-auto">
        <h2 class="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-12">
          Everything your business needs
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          @for (feature of features; track feature.title) {
            <div class="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <div class="text-3xl mb-4">{{ feature.icon }}</div>
              <h3 class="text-lg font-semibold text-gray-900 mb-2">{{ feature.title }}</h3>
              <p class="text-sm text-gray-500 leading-relaxed">{{ feature.description }}</p>
            </div>
          }
        </div>
      </div>
    </section>

    <!-- Waitlist signup -->
    <app-waitlist-signup />

    <!-- CTA Banner -->
    <section class="bg-indigo-600 py-16 px-4 sm:px-6 lg:px-8">
      <div class="max-w-3xl mx-auto text-center">
        <h2 class="text-2xl sm:text-3xl font-bold text-white mb-4">
          Ready to get started?
        </h2>
        <p class="text-indigo-200 mb-8">
          Join service businesses that use Qulene to delight their customers.
        </p>
        <a
          href="https://app.qulene.com"
          class="bg-white text-indigo-700 font-semibold px-8 py-3 rounded-xl
                 hover:bg-indigo-50 transition-colors inline-block"
        >
          Create your account
        </a>
      </div>
    </section>
  `,
})
export class HomeComponent {
  readonly features = [
    {
      icon: '📋',
      title: 'Smart Waitlists',
      description:
        'Customers join your waitlist in seconds. When a slot opens, Qulene notifies them automatically.',
    },
    {
      icon: '📅',
      title: 'Appointment Requests',
      description:
        'Customers propose a time; you accept or decline. No back-and-forth — just clean, structured requests.',
    },
    {
      icon: '🔔',
      title: 'Instant Notifications',
      description:
        'In-app and email alerts keep both sides informed at every step of the booking process.',
    },
  ];
}
