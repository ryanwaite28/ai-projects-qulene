import { Injectable } from '@angular/core';
import { signIn, signUp, signOut, fetchAuthSession } from 'aws-amplify/auth';

const TOKEN_KEY = 'qulene_access_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  async login(email: string, password: string): Promise<void> {
    await signIn({ username: email, password });
    const session = await fetchAuthSession();
    const token = session.tokens?.accessToken?.toString() ?? null;
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    }
  }

  async register(
    email: string,
    password: string,
    role: 'CUSTOMER' | 'BUSINESS',
  ): Promise<void> {
    await signUp({
      username: email,
      password,
      options: {
        userAttributes: {
          email,
          'custom:role': role,
        },
      },
    });
  }

  async logout(): Promise<void> {
    await signOut();
    localStorage.removeItem(TOKEN_KEY);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  isAuthenticated(): boolean {
    return this.getToken() !== null;
  }

  getUserRole(): string | null {
    const token = this.getToken();
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1])) as Record<string, unknown>;
      return (payload['custom:role'] as string) ?? null;
    } catch {
      return null;
    }
  }
}
