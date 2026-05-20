import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NotificationService } from '../services/notification.service';
import { UserService } from '../services/user.service';
import type { Notification } from '../services/notification.service';

@Component({
  selector: 'app-customer-notifications',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <div class="min-h-screen bg-gray-50">
      <!-- Customer top-nav -->
      <nav class="border-b border-gray-200 bg-white px-4">
        <div class="mx-auto flex max-w-3xl gap-6 overflow-x-auto">
          <a [routerLink]="'/customer/appointments'" routerLinkActive="border-b-2 border-brand-600 text-brand-600"
            class="whitespace-nowrap py-4 text-sm font-medium text-gray-500 hover:text-gray-700">
            Appointments
          </a>
          <a [routerLink]="'/customer/waitlist'" routerLinkActive="border-b-2 border-brand-600 text-brand-600"
            class="whitespace-nowrap py-4 text-sm font-medium text-gray-500 hover:text-gray-700">
            Waitlist
          </a>
          <a [routerLink]="'/customer/notifications'" routerLinkActive="border-b-2 border-brand-600 text-brand-600"
            class="whitespace-nowrap py-4 text-sm font-medium text-gray-500 hover:text-gray-700">
            Notifications
            @if (unreadCount() > 0) {
              <span class="ml-1.5 rounded-full bg-yellow-400 px-1.5 py-0.5 text-xs font-bold text-white">
                {{ unreadCount() }}
              </span>
            }
          </a>
          <a [routerLink]="'/customer/profile'" routerLinkActive="border-b-2 border-brand-600 text-brand-600"
            class="whitespace-nowrap py-4 text-sm font-medium text-gray-500 hover:text-gray-700">
            Profile
          </a>
        </div>
      </nav>

      <div class="mx-auto max-w-3xl px-4 py-10">
        <h1 class="mb-6 text-3xl font-bold text-gray-900">Notifications</h1>

        @if (loading() && notifications().length === 0) {
          <div class="space-y-3">
            @for (i of skeletonItems; track i) {
              <div class="h-16 animate-pulse rounded-xl bg-gray-200"></div>
            }
          </div>
        } @else if (notifications().length === 0) {
          <p class="py-16 text-center text-gray-500">No notifications yet.</p>
        } @else {
          <ul class="space-y-2">
            @for (n of notifications(); track n.notificationId) {
              <li
                (click)="handleRowClick(n)"
                [class]="rowClass(n)"
              >
                <p [class]="n.isRead ? 'text-gray-600' : 'font-semibold text-gray-900'">
                  {{ n.message }}
                </p>
                <p class="mt-0.5 text-xs text-gray-400">{{ formatDate(n.createdAt) }}</p>
              </li>
            }
          </ul>

          @if (nextCursor()) {
            <div class="mt-6 text-center">
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
export class CustomerNotificationsComponent implements OnInit {
  private readonly notificationService = inject(NotificationService);
  private readonly userService = inject(UserService);

  readonly notifications = signal<Notification[]>([]);
  readonly loading = signal(false);
  readonly nextCursor = signal<string | null>(null);
  readonly unreadCount = signal(0);

  readonly skeletonItems = [1, 2, 3];

  ngOnInit(): void {
    this.userService.getMyProfile().subscribe({
      next: (res) => this.unreadCount.set(res.data.unreadNotificationCount),
      error: () => {},
    });
    this.loadNotifications(true);
  }

  handleRowClick(n: Notification): void {
    if (n.isRead) return;
    this.notificationService.markAsRead(n.notificationId).subscribe({
      next: (res) => {
        this.notifications.update((current) =>
          current.map((item) => (item.notificationId === n.notificationId ? res.data : item)),
        );
        this.unreadCount.update((c) => Math.max(0, c - 1));
      },
      error: () => {},
    });
  }

  loadMore(): void {
    this.loadNotifications(false);
  }

  rowClass(n: Notification): string {
    const base = 'cursor-pointer rounded-xl px-4 py-3 transition-colors hover:bg-opacity-80';
    return n.isRead
      ? `${base} bg-white shadow-sm`
      : `${base} border-l-4 border-yellow-400 bg-yellow-50 shadow-sm`;
  }

  formatDate(iso: string): string {
    return iso.replace('T', ' ').slice(0, 16);
  }

  private loadNotifications(reset: boolean): void {
    this.loading.set(true);
    const cursor = reset ? undefined : (this.nextCursor() ?? undefined);

    this.notificationService.listNotifications(cursor).subscribe({
      next: (res) => {
        if (reset) {
          this.notifications.set(res.data);
        } else {
          this.notifications.update((current) => [...current, ...res.data]);
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
