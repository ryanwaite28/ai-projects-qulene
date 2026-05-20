import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="py-20 px-4 sm:px-6 lg:px-8">
      <div class="max-w-3xl mx-auto">
        <h1 class="text-4xl font-extrabold text-gray-900 mb-2">Terms of Service</h1>
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
export class TermsComponent {
  readonly sections = [
    {
      heading: '1. Acceptance of Terms',
      body: 'By accessing or using Qulene, you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the platform. These terms apply to all users including service providers (Businesses) and customers.',
    },
    {
      heading: '2. Description of Service',
      body: 'Qulene is a platform that enables independent service providers to manage appointment requests and customer waitlists. Qulene facilitates connections between service providers and customers but is not a party to any appointment or service agreement between them.',
    },
    {
      heading: '3. User Accounts',
      body: 'You must create an account to use Qulene. You are responsible for maintaining the security of your credentials and for all activity that occurs under your account. You must provide accurate information during registration and keep it current.',
    },
    {
      heading: '4. User Conduct',
      body: 'You agree not to use Qulene for any unlawful purpose, to harass or harm other users, to submit false or misleading information, to interfere with the platform\'s operation, or to attempt to gain unauthorized access to any part of the service.',
    },
    {
      heading: '5. Service Provider Obligations',
      body: 'Service providers are solely responsible for the accuracy of their service listings, their availability, and the quality of services they deliver. Qulene does not verify credentials or guarantee the quality of any service offered through the platform.',
    },
    {
      heading: '6. Disclaimers',
      body: 'Qulene is provided "as is" without warranties of any kind, express or implied. We do not warrant that the service will be uninterrupted, error-free, or free of harmful components. Your use of the platform is at your own risk.',
    },
    {
      heading: '7. Limitation of Liability',
      body: 'To the maximum extent permitted by law, Qulene and its operators shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of or inability to use the platform, even if advised of the possibility of such damages.',
    },
    {
      heading: '8. Termination',
      body: 'We reserve the right to suspend or terminate your account at our discretion if you violate these Terms of Service or engage in conduct we determine to be harmful to other users or the platform. You may close your account at any time.',
    },
    {
      heading: '9. Changes to Terms',
      body: 'We may update these Terms of Service at any time. We will notify you of material changes by email or in-app notice. Continued use of Qulene after changes take effect constitutes acceptance of the revised terms.',
    },
    {
      heading: '10. Governing Law',
      body: 'These Terms of Service are governed by the laws of the State of Georgia, United States, without regard to its conflict of law provisions. Any disputes arising under these terms shall be resolved in the courts of Georgia.',
    },
  ];
}
