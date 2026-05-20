import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

const TOKEN_KEY = 'qulene_access_token';

function decodeRole(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as Record<string, unknown>;
    return (payload['custom:role'] as string) ?? null;
  } catch {
    return null;
  }
}

export const roleGuard: CanActivateFn = (route, _state) => {
  const router = inject(Router);
  const requiredRole = route.data['requiredRole'] as string;
  const userRole = decodeRole();
  if (userRole !== requiredRole) {
    return router.createUrlTree(['/']);
  }
  return true;
};
