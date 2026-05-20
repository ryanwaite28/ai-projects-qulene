import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BusinessProfile } from '../services/business.service';

@Component({
  selector: 'app-business-card',
  standalone: true,
  imports: [RouterLink],
  template: `
    <a
      [routerLink]="['/businesses', business.businessId]"
      class="block rounded-xl bg-white p-5 shadow transition-shadow hover:shadow-md"
    >
      <div class="flex items-center gap-4">
        @if (business.avatarUrl) {
          <img
            [src]="business.avatarUrl"
            [alt]="business.businessName ?? 'Business'"
            class="h-14 w-14 rounded-full object-cover"
          />
        } @else {
          <div
            class="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-xl font-bold text-brand-700"
          >
            {{ (business.businessName ?? '?')[0].toUpperCase() }}
          </div>
        }
        <div class="min-w-0">
          <p class="truncate font-semibold text-gray-900">
            {{ business.businessName ?? 'Unnamed Business' }}
          </p>
          @if (business.category) {
            <p class="text-sm text-brand-600">{{ business.category }}</p>
          }
          @if (business.city || business.address) {
            <p class="truncate text-sm text-gray-500">{{ business.city ?? business.address }}</p>
          }
        </div>
      </div>
    </a>
  `,
})
export class BusinessCardComponent {
  @Input() business!: BusinessProfile;
}
