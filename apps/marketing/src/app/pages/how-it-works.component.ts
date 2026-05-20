import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WaitlistSignupComponent } from '../components/waitlist-signup.component';

@Component({
  selector: 'app-how-it-works',
  standalone: true,
  imports: [RouterLink, WaitlistSignupComponent],
  template: `
    <section class="py-20 px-4 sm:px-6 lg:px-8">
      <div class="max-w-5xl mx-auto">
        <h1 class="text-4xl font-extrabold text-gray-900 text-center mb-4">How Qulene Works</h1>
        <p class="text-lg text-gray-500 text-center mb-16 max-w-2xl mx-auto">
          A simple two-sided flow: service providers list their offerings, customers book or join
          the waitlist. No phone tag. No DMs. Just clean, structured scheduling.
        </p>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-12 mb-20">
          <!-- Business side -->
          <div>
            <h2 class="text-2xl font-bold text-indigo-600 mb-8">For Service Providers</h2>
            <ol class="space-y-8">
              @for (step of businessSteps; track step.title) {
                <li class="flex gap-4">
                  <div
                    class="flex-shrink-0 w-9 h-9 rounded-full bg-indigo-600 text-white
                           flex items-center justify-center font-bold text-sm"
                  >
                    {{ $index + 1 }}
                  </div>
                  <div>
                    <h3 class="font-semibold text-gray-900 mb-1">{{ step.title }}</h3>
                    <p class="text-sm text-gray-500 leading-relaxed">{{ step.description }}</p>
                  </div>
                </li>
              }
            </ol>
          </div>

          <!-- Customer side -->
          <div>
            <h2 class="text-2xl font-bold text-indigo-600 mb-8">For Customers</h2>
            <ol class="space-y-8">
              @for (step of customerSteps; track step.title) {
                <li class="flex gap-4">
                  <div
                    class="flex-shrink-0 w-9 h-9 rounded-full bg-indigo-600 text-white
                           flex items-center justify-center font-bold text-sm"
                  >
                    {{ $index + 1 }}
                  </div>
                  <div>
                    <h3 class="font-semibold text-gray-900 mb-1">{{ step.title }}</h3>
                    <p class="text-sm text-gray-500 leading-relaxed">{{ step.description }}</p>
                  </div>
                </li>
              }
            </ol>
          </div>
        </div>

        <!-- CTA -->
        <div class="text-center">
          <a
            href="https://app.qulene.com"
            class="inline-block bg-indigo-600 text-white font-semibold px-8 py-3 rounded-xl
                   hover:bg-indigo-700 transition-colors shadow-md mr-4"
          >
            Get Started Free
          </a>
          <a
            routerLink="/pricing"
            class="inline-block border border-indigo-300 text-indigo-700 font-semibold px-8 py-3
                   rounded-xl hover:bg-indigo-50 transition-colors"
          >
            View Pricing
          </a>
        </div>
      </div>
    </section>

    <app-waitlist-signup />
  `,
})
export class HowItWorksComponent {
  readonly businessSteps = [
    {
      title: 'Create your profile',
      description:
        'Sign up and describe your services — name, description, duration, and any other details customers need to know.',
    },
    {
      title: 'Receive appointment requests',
      description:
        'Customers propose a time slot. You review each request and accept or decline with one tap.',
    },
    {
      title: 'Manage your waitlist',
      description:
        'When you are fully booked, customers join your waitlist. Qulene automatically promotes the next person when a slot opens.',
    },
    {
      title: 'Stay in control',
      description:
        'Your dashboard shows upcoming appointments, pending requests, and your live waitlist — all in one view.',
    },
  ];

  readonly customerSteps = [
    {
      title: 'Find a service provider',
      description:
        'Browse available businesses on Qulene and view their services, availability, and profile.',
    },
    {
      title: 'Request an appointment',
      description:
        'Propose a time that works for you. The provider reviews your request and responds — no back-and-forth.',
    },
    {
      title: 'Join the waitlist',
      description:
        'Already fully booked? Join the waitlist and get notified automatically when a spot becomes available.',
    },
    {
      title: 'Show up and enjoy',
      description:
        'Receive confirmation and reminders through the app. Your appointment is locked in — no phone calls needed.',
    },
  ];
}
