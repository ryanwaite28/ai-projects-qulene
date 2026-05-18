import { useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import {
  cognitoSignIn,
  cognitoSignOut,
  cognitoSignUp,
  getCurrentSession,
  type SignUpParams,
} from '../lib/cognito';

const TOKEN_KEY = 'qulene_access_token';
const PROFILE_SYNCED_KEY = 'qulene_profile_synced';

export interface AuthSession {
  accessToken: string;
  userId: string;
}

export interface UseAuthResult {
  session: AuthSession | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (params: SignUpParams) => Promise<void>;
  logout: () => Promise<void>;
  markProfileSynced: () => Promise<void>;
  isProfileSynced: () => Promise<boolean>;
}

export function useAuth(): UseAuthResult {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getCurrentSession().then((s) => {
      if (!cancelled) {
        setSession(s);
        setIsLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await cognitoSignIn(email, password);
    const s = await getCurrentSession();
    if (s) {
      await SecureStore.setItemAsync(TOKEN_KEY, s.accessToken);
    }
    setSession(s);
  }, []);

  const register = useCallback(async (params: SignUpParams) => {
    await cognitoSignUp(params);
    await cognitoSignIn(params.email, params.password);
    const s = await getCurrentSession();
    if (s) {
      await SecureStore.setItemAsync(TOKEN_KEY, s.accessToken);
      await SecureStore.setItemAsync(PROFILE_SYNCED_KEY, 'false');
    }
    setSession(s);
  }, []);

  const logout = useCallback(async () => {
    await cognitoSignOut();
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(PROFILE_SYNCED_KEY);
    setSession(null);
  }, []);

  const markProfileSynced = useCallback(async () => {
    await SecureStore.setItemAsync(PROFILE_SYNCED_KEY, 'true');
  }, []);

  const isProfileSynced = useCallback(async () => {
    const val = await SecureStore.getItemAsync(PROFILE_SYNCED_KEY);
    return val === 'true';
  }, []);

  return { session, isLoading, login, register, logout, markProfileSynced, isProfileSynced };
}
