import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="py-20 px-4 sm:px-6 lg:px-8">
      <div class="max-w-3xl mx-auto">
        <h1 class="text-4xl font-extrabold text-gray-900 mb-2">Privacy Policy</h1>
        <p class="text-sm text-gray-400 mb-12">Last updated: January 2025</p>

        @for (section of sections; track section.heading) {
          <div class="mb-10">
            <h2 class="text-xl font-bold text-gray-900 mb-3">{{ section.heading }}</h2>
            <p class="text-gray-600 leading-relaxed">{{ section.body }}</p>
          </div>
        }

        <p class="text-sm text-gray-400 mt-12">
          Questions? <a routerLink="/contact" class="text-indigo-600 hover:underline">Contact us</a>.
        </p>
      </div>
    </section>
  `,
})
export class PrivacyComponent {
  readonly sections = [
    {
      heading: '1. What We Collect',
      body: 'We collect information you provide directly — such as your name, email address, and any content you submit through the platform (service listings, appointment requests, waitlist entries). We also collect basic usage data such as pages visited and feature interactions to improve the product.',
    },
    {
      heading: '2. How We Use It',
      body: 'Your information is used to operate the Qulene platform: processing appointment requests, managing waitlists, sending notifications, and communicating with you about your account. We do not sell your data to third parties or use it for advertising.',
    },
    {
      heading: '3. Data Sharing',
      body: 'We share data only as required to deliver the service: with AWS for hosting and email delivery, and between service providers and customers as part of the booking flow (e.g., a business sees a customer\'s name when they make an appointment request). We do not share data with advertisers or data brokers.',
    },
    {
      heading: '4. Data Retention',
      body: 'We retain your account data for as long as your account is active. If you close your account, your personal data is deleted within 90 days, except where retention is required by law or to resolve disputes.',
    },
    {
      heading: '5. Your Rights',
      body: 'You may request access to, correction of, or deletion of your personal data at any time by contacting us. If you are located in the European Economic Area, you have additional rights under the GDPR including the right to data portability and the right to lodge a complaint with a supervisory authority.',
    },
    {
      heading: '6. Cookies',
      body: 'Qulene uses only essential cookies required for the platform to function (session management). We do not use tracking cookies or third-party analytics cookies.',
    },
    {
      heading: '7. Security',
      body: 'We use industry-standard measures to protect your data, including encryption in transit (HTTPS) and at rest, and access controls limiting who can view personal information. No system is completely secure — if you believe your account has been compromised, contact us immediately.',
    },
    {
      heading: '8. Changes to This Policy',
      body: 'We may update this Privacy Policy from time to time. We will notify you of material changes by email or by posting a notice in the app. Continued use of Qulene after changes take effect constitutes acceptance of the revised policy.',
    },
    {
      heading: '9. Contact Us',
      body: 'If you have questions about this Privacy Policy or how your data is handled, please reach out via our Contact page.',
    },
  ];
}
