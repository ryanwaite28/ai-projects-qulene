import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="py-20 px-4 sm:px-6 lg:px-8">
      <div class="max-w-3xl mx-auto">
        <h1 class="text-4xl font-extrabold text-gray-900 mb-6">About Qulene</h1>
        <p class="text-lg text-gray-600 leading-relaxed mb-6">
          Qulene was built for independent service professionals — stylists, trainers, consultants,
          and anyone else who trades their time and skill for a living. Managing bookings through
          texts, DMs, and spreadsheets is exhausting. Qulene replaces that chaos with a clean,
          structured platform that works for both sides of every appointment.
        </p>
        <p class="text-lg text-gray-600 leading-relaxed mb-6">
          For businesses, Qulene means fewer no-shows, a live waitlist that fills cancellations
          automatically, and a dashboard that shows exactly what's coming up. For customers, it
          means a respectful booking experience — propose a time, get a clear answer, and never
          lose your spot.
        </p>
        <p class="text-lg text-gray-600 leading-relaxed mb-10">
          We believe great service shouldn't be buried under scheduling friction. Qulene gets out
          of the way so the work can shine.
        </p>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
          @for (stat of stats; track stat.label) {
            <div class="bg-indigo-50 rounded-2xl p-6 text-center">
              <div class="text-3xl font-extrabold text-indigo-600 mb-1">{{ stat.value }}</div>
              <div class="text-sm text-gray-600">{{ stat.label }}</div>
            </div>
          }
        </div>

        <a
          routerLink="/how-it-works"
          class="inline-block bg-indigo-600 text-white font-semibold px-6 py-3 rounded-xl
                 hover:bg-indigo-700 transition-colors"
        >
          See how it works →
        </a>
      </div>
    </section>
  `,
})
export class AboutComponent {
  readonly stats = [
    { value: '2-sided', label: 'Marketplace' },
    { value: 'Real-time', label: 'Notifications' },
    { value: 'Zero', label: 'Scheduling friction' },
  ];
}
