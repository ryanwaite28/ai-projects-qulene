import { Routes } from '@angular/router';
import { MarketingLayoutComponent } from './layouts/marketing-layout.component';

export const routes: Routes = [
  {
    path: '',
    component: MarketingLayoutComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./pages/home.component').then((m) => m.HomeComponent),
      },
      {
        path: 'about',
        loadComponent: () =>
          import('./pages/about.component').then((m) => m.AboutComponent),
      },
      {
        path: 'how-it-works',
        loadComponent: () =>
          import('./pages/how-it-works.component').then((m) => m.HowItWorksComponent),
      },
      {
        path: 'pricing',
        loadComponent: () =>
          import('./pages/pricing.component').then((m) => m.PricingComponent),
      },
      {
        path: 'contact',
        loadComponent: () =>
          import('./pages/contact.component').then((m) => m.ContactComponent),
      },
      {
        path: 'privacy',
        loadComponent: () =>
          import('./pages/privacy.component').then((m) => m.PrivacyComponent),
      },
      {
        path: 'terms',
        loadComponent: () =>
          import('./pages/terms.component').then((m) => m.TermsComponent),
      },
    ],
  },
];
