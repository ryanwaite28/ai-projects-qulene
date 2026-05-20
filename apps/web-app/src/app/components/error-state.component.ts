import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-error-state',
  standalone: true,
  template: `
    <div class="flex flex-col items-center justify-center py-16 px-6 text-center">
      <span class="text-4xl mb-4">⚠️</span>
      <p class="text-base font-semibold text-gray-800 mb-2">{{ message }}</p>
      <button
        type="button"
        (click)="retry.emit()"
        class="mt-2 rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700"
      >
        Try again
      </button>
    </div>
  `,
})
export class ErrorStateComponent {
  @Input() message = 'Something went wrong';
  @Output() retry = new EventEmitter<void>();
}
