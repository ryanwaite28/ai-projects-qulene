import { Routes } from '@angular/router';
import { PlaceholderComponent } from './pages/placeholder.component';
import { HomeComponent } from './pages/home.component';
import { LoginComponent } from './pages/login.component';
import { RegisterComponent } from './pages/register.component';
import { BusinessesComponent } from './pages/businesses.component';
import { BusinessDetailComponent } from './pages/business-detail.component';
import { CustomerAppointmentsComponent } from './pages/customer-appointments.component';
import { CustomerWaitlistComponent } from './pages/customer-waitlist.component';
import { CustomerNotificationsComponent } from './pages/customer-notifications.component';
import { CustomerProfileComponent } from './pages/customer-profile.component';
import { BusinessDashboardComponent } from './pages/business-dashboard.component';
import { BusinessProfileComponent } from './pages/business-profile.component';
import { BusinessServicesComponent } from './pages/business-services.component';
import { BusinessAvailabilityComponent } from './pages/business-availability.component';
import { BusinessWaitlistComponent } from './pages/business-waitlist.component';
import { BusinessNotificationsComponent } from './pages/business-notifications.component';
import { authGuard } from './guards/auth.guard';
import { roleGuard } from './guards/role.guard';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'businesses', component: BusinessesComponent },
  { path: 'businesses/:businessId', component: BusinessDetailComponent },
  {
    path: 'customer',
    canActivate: [authGuard, roleGuard],
    data: { requiredRole: 'CUSTOMER' },
    children: [
      { path: 'appointments', component: CustomerAppointmentsComponent },
      { path: 'waitlist', component: CustomerWaitlistComponent },
      { path: 'notifications', component: CustomerNotificationsComponent },
      { path: 'profile', component: CustomerProfileComponent },
    ],
  },
  {
    path: 'business',
    canActivate: [authGuard, roleGuard],
    data: { requiredRole: 'BUSINESS' },
    children: [
      { path: 'dashboard', component: BusinessDashboardComponent },
      { path: 'profile', component: BusinessProfileComponent },
      { path: 'services', component: BusinessServicesComponent },
      { path: 'availability', component: BusinessAvailabilityComponent },
      { path: 'waitlist', component: BusinessWaitlistComponent },
      { path: 'notifications', component: BusinessNotificationsComponent },
    ],
  },
];
