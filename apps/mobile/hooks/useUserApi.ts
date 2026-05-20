import { useCallback } from 'react';
import { useApi } from './useApi';
import type { User } from '@qulene/api-types';

export function useUserApi() {
  const { request } = useApi();

  const getMyProfile = useCallback(
    () => request<User>('/users/me'),
    [request],
  );

  return { getMyProfile };
}
