import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 text-center">
      <h1 class="text-5xl font-bold text-gray-900">Qulene</h1>
      <p class="mt-4 text-xl text-gray-600">
        Manage your waitlist and appointment requests with ease.
      </p>
      <div class="mt-8 flex flex-wrap justify-center gap-4">
        <a
          [routerLink]="'/register'"
          class="rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700"
        >
          Get Started
        </a>
        <a
          [routerLink]="'/login'"
          class="rounded-lg border border-gray-300 px-6 py-3 font-semibold text-gray-700 hover:bg-gray-100"
        >
          Log In
        </a>
        <a
          [routerLink]="'/businesses'"
          class="rounded-lg border border-brand-600 px-6 py-3 font-semibold text-brand-600 hover:bg-brand-50"
        >
          Browse Businesses
        </a>
      </div>
    </main>
  `,
})
export class HomeComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      const role = this.authService.getUserRole();
      this.router.navigate([role === 'BUSINESS' ? '/business/dashboard' : '/customer/appointments']);
    }
  }
}
