import { Component, inject } from '@angular/core';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  template: `
    <div class="fixed top-4 right-4 z-50 flex flex-col gap-2 w-80">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="flex items-start gap-3 rounded-lg bg-gray-900 px-4 py-3 text-white shadow-lg">
          <span class="flex-1 text-sm leading-snug">{{ toast.message }}</span>
          <button
            type="button"
            (click)="toastService.dismiss(toast.id)"
            class="mt-0.5 shrink-0 text-gray-400 hover:text-white"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastComponent {
  readonly toastService = inject(ToastService);
}
