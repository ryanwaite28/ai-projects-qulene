import { Component, inject, OnInit, signal } from '@angular/core';
import { BusinessCardComponent } from '../components/business-card.component';
import { BusinessProfile, BusinessService } from '../services/business.service';

const CATEGORIES = [
  'All', 'Salon', 'Fitness', 'Tutoring', 'Repair', 'Consulting', 'Photography', 'Healthcare',
];

@Component({
  selector: 'app-businesses',
  standalone: true,
  imports: [BusinessCardComponent],
  template: `
    <div class="min-h-screen bg-gray-50 px-4 py-10">
      <div class="mx-auto max-w-5xl">
        <h1 class="mb-6 text-3xl font-bold text-gray-900">Browse Businesses</h1>

        <div class="mb-6 flex flex-wrap gap-2">
          @for (cat of categories; track cat) {
            <button
              type="button"
              (click)="selectCategory(cat)"
              [class]="
                activeCategory() === cat
                  ? 'rounded-full bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white'
                  : 'rounded-full border border-gray-300 bg-white px-4 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50'
              "
            >
              {{ cat }}
            </button>
          }
        </div>

        @if (loading() && businesses().length === 0) {
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            @for (i of skeletonItems; track i) {
              <div class="h-24 animate-pulse rounded-xl bg-gray-200"></div>
            }
          </div>
        } @else if (businesses().length === 0) {
          <p class="py-16 text-center text-gray-500">
            No businesses found in this category.
          </p>
        } @else {
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            @for (biz of businesses(); track biz.businessId) {
              <app-business-card [business]="biz" />
            }
          </div>

          @if (nextCursor()) {
            <div class="mt-8 text-center">
              <button
                type="button"
                (click)="loadMore()"
                [disabled]="loading()"
                class="rounded-lg border border-gray-300 px-6 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                @if (loading()) { Loading… } @else { Load more }
              </button>
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class BusinessesComponent implements OnInit {
  private readonly businessService = inject(BusinessService);

  readonly categories = CATEGORIES;
  readonly skeletonItems = [1, 2, 3, 4, 5, 6];
  readonly businesses = signal<BusinessProfile[]>([]);
  readonly loading = signal(false);
  readonly nextCursor = signal<string | null>(null);
  readonly activeCategory = signal('All');

  ngOnInit(): void {
    this.loadBusinesses(true);
  }

  selectCategory(category: string): void {
    if (this.activeCategory() === category) return;
    this.activeCategory.set(category);
    this.businesses.set([]);
    this.nextCursor.set(null);
    this.loadBusinesses(true);
  }

  loadMore(): void {
    this.loadBusinesses(false);
  }

  private loadBusinesses(reset: boolean): void {
    this.loading.set(true);
    const category = this.activeCategory() === 'All' ? undefined : this.activeCategory();
    const cursor = reset ? undefined : (this.nextCursor() ?? undefined);

    this.businessService.listBusinesses({ category, cursor }).subscribe({
      next: (res) => {
        if (reset) {
          this.businesses.set(res.data);
        } else {
          this.businesses.update((current) => [...current, ...res.data]);
        }
        this.nextCursor.set(res.nextCursor);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }
}
