import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

const TOKEN_KEY = 'qulene_access_token';

export const authGuard: CanActivateFn = (_route, _state) => {
  const router = inject(Router);
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    return router.createUrlTree(['/login']);
  }
  return true;
};
