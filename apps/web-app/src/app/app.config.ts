import { ApplicationConfig } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { Amplify } from 'aws-amplify';
import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';
import { environment } from '../environments/environment';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: environment.cognitoUserPoolId,
      userPoolClientId: environment.cognitoAppClientId,
    },
  },
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
  ],
};
