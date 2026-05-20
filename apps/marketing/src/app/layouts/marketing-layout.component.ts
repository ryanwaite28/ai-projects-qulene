import { Component, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-marketing-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <!-- Navbar -->
    <nav class="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          <!-- Logo -->
          <a routerLink="/" class="text-xl font-bold text-indigo-600 tracking-tight">
            Qulene
          </a>

          <!-- Desktop nav -->
          <div class="hidden md:flex items-center gap-6">
            <a
              routerLink="/about"
              routerLinkActive="text-indigo-600 font-medium"
              class="text-sm text-gray-600 hover:text-indigo-600 transition-colors"
            >About</a>
            <a
              routerLink="/how-it-works"
              routerLinkActive="text-indigo-600 font-medium"
              class="text-sm text-gray-600 hover:text-indigo-600 transition-colors"
            >How It Works</a>
            <a
              routerLink="/pricing"
              routerLinkActive="text-indigo-600 font-medium"
              class="text-sm text-gray-600 hover:text-indigo-600 transition-colors"
            >Pricing</a>
            <a
              routerLink="/contact"
              routerLinkActive="text-indigo-600 font-medium"
              class="text-sm text-gray-600 hover:text-indigo-600 transition-colors"
            >Contact</a>
            <a
              href="https://app.qulene.com"
              class="ml-2 bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
            >Get Started</a>
          </div>

          <!-- Mobile hamburger -->
          <button
            class="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100"
            (click)="mobileOpen.set(!mobileOpen())"
            aria-label="Toggle menu"
          >
            @if (mobileOpen()) {
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M6 18L18 6M6 6l12 12" />
              </svg>
            } @else {
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            }
          </button>
        </div>

        <!-- Mobile menu -->
        @if (mobileOpen()) {
          <div class="md:hidden py-3 border-t border-gray-100 flex flex-col gap-3 pb-4">
            <a routerLink="/about" (click)="mobileOpen.set(false)"
              class="text-sm text-gray-700 hover:text-indigo-600">About</a>
            <a routerLink="/how-it-works" (click)="mobileOpen.set(false)"
              class="text-sm text-gray-700 hover:text-indigo-600">How It Works</a>
            <a routerLink="/pricing" (click)="mobileOpen.set(false)"
              class="text-sm text-gray-700 hover:text-indigo-600">Pricing</a>
            <a routerLink="/contact" (click)="mobileOpen.set(false)"
              class="text-sm text-gray-700 hover:text-indigo-600">Contact</a>
            <a href="https://app.qulene.com"
              class="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg text-center">
              Get Started
            </a>
          </div>
        }
      </div>
    </nav>

    <!-- Page content -->
    <main>
      <router-outlet />
    </main>

    <!-- Footer -->
    <footer class="bg-gray-900 text-gray-400 mt-24">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div class="text-white text-lg font-bold mb-2">Qulene</div>
            <p class="text-sm leading-relaxed">
              Simplify appointment management and waitlists for service businesses.
            </p>
          </div>
          <div>
            <div class="text-white text-sm font-semibold mb-3 uppercase tracking-wider">Product</div>
            <ul class="space-y-2 text-sm">
              <li><a routerLink="/how-it-works" class="hover:text-white transition-colors">How It Works</a></li>
              <li><a routerLink="/pricing" class="hover:text-white transition-colors">Pricing</a></li>
              <li><a href="https://app.qulene.com" class="hover:text-white transition-colors">Web App</a></li>
            </ul>
          </div>
          <div>
            <div class="text-white text-sm font-semibold mb-3 uppercase tracking-wider">Company</div>
            <ul class="space-y-2 text-sm">
              <li><a routerLink="/about" class="hover:text-white transition-colors">About</a></li>
              <li><a routerLink="/contact" class="hover:text-white transition-colors">Contact</a></li>
              <li><a routerLink="/privacy" class="hover:text-white transition-colors">Privacy Policy</a></li>
              <li><a routerLink="/terms" class="hover:text-white transition-colors">Terms of Service</a></li>
            </ul>
          </div>
        </div>
        <div class="border-t border-gray-800 mt-10 pt-6 text-xs text-center">
          © {{ year }} Qulene. All rights reserved.
        </div>
      </div>
    </footer>
  `,
})
export class MarketingLayoutComponent {
  readonly mobileOpen = signal(false);
  readonly year = new Date().getFullYear();
}
