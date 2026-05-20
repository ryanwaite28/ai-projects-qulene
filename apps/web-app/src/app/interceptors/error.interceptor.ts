import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../services/toast.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toastService = inject(ToastService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 0) {
        toastService.show('Connection lost — please try again');
      } else if (error.status >= 500) {
        toastService.show('Something went wrong on our end — please try again');
      }
      return throwError(() => error);
    }),
  );
};
