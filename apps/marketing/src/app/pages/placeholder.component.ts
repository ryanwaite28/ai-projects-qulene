import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-placeholder',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="py-32 px-4 sm:px-6 lg:px-8 text-center">
      <div class="max-w-lg mx-auto">
        <div class="text-5xl mb-6">🚧</div>
        <h1 class="text-3xl font-extrabold text-gray-900 mb-4">Coming Soon</h1>
        <p class="text-gray-500 mb-8 leading-relaxed">
          This page is under construction. Check back soon for the full content.
        </p>
        <a
          routerLink="/"
          class="inline-block bg-indigo-600 text-white font-semibold px-6 py-3
                 rounded-xl hover:bg-indigo-700 transition-colors"
        >
          Back to Home
        </a>
      </div>
    </section>
  `,
})
export class PlaceholderComponent {}
