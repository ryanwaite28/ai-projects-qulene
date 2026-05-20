import { Component } from '@angular/core';

@Component({
  selector: 'app-placeholder',
  standalone: true,
  template: `
    <div class="flex min-h-screen items-center justify-center">
      <p class="text-lg text-gray-500">Coming Soon</p>
    </div>
  `,
})
export class PlaceholderComponent {}
