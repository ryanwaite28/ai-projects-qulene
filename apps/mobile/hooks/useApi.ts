import { useCallback, useRef } from 'react';
import { useRouter } from 'expo-router';
import { getCurrentSession, cognitoSignOut } from '../lib/cognito';
import * as SecureStore from 'expo-secure-store';
import type { ApiResponse } from '@qulene/api-types';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
const TOKEN_KEY = 'qulene_access_token';

export class ApiError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export function useApi() {
  const router = useRouter();
  const redirectingRef = useRef(false);

  const handleUnauthorized = useCallback(async () => {
    if (redirectingRef.current) return;
    redirectingRef.current = true;
    await cognitoSignOut().catch(() => undefined);
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined);
    router.replace('/(auth)/login');
    redirectingRef.current = false;
  }, [router]);

  const request = useCallback(async <T>(
    path: string,
    init?: RequestInit,
  ): Promise<T> => {
    const sessionData = await getCurrentSession();
    if (!sessionData) {
      await handleUnauthorized();
      throw new ApiError('UNAUTHORIZED', 'No active session');
    }

    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${sessionData.accessToken}`,
      },
    });

    if (response.status === 401 || response.status === 403) {
      await handleUnauthorized();
      throw new ApiError('UNAUTHORIZED', 'Session expired');
    }

    const json: ApiResponse<T> = await response.json();

    if (json.error) {
      throw new ApiError(json.error.code, json.error.message);
    }

    return json.data as T;
  }, [handleUnauthorized]);

  const requestWithCursor = useCallback(async <T>(
    path: string,
    init?: RequestInit,
  ): Promise<{ data: T; nextCursor: string | null }> => {
    const sessionData = await getCurrentSession();
    if (!sessionData) {
      await handleUnauthorized();
      throw new ApiError('UNAUTHORIZED', 'No active session');
    }

    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${sessionData.accessToken}`,
      },
    });

    if (response.status === 401 || response.status === 403) {
      await handleUnauthorized();
      throw new ApiError('UNAUTHORIZED', 'Session expired');
    }

    const json = await response.json();
    if (json.error) throw new ApiError(json.error.code, json.error.message);
    return { data: json.data as T, nextCursor: json.nextCursor ?? null };
  }, [handleUnauthorized]);

  return { request, requestWithCursor };
}
