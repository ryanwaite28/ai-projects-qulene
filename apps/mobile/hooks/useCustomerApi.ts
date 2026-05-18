import { useCallback } from 'react';
import type { BusinessProfile, Service, AvailabilityWindow } from '@qulene/api-types';
import { ApiError } from './useApi';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

async function publicFetch<T>(path: string): Promise<{ data: T; nextCursor?: string | null }> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  const json = await response.json();
  if (json.error) {
    throw new ApiError(json.error.code, json.error.message);
  }
  return { data: json.data, nextCursor: json.nextCursor ?? null };
}

export function useCustomerApi() {
  const fetchBusinesses = useCallback(
    async (
      options: { category?: string; cursor?: string | null } = {},
    ): Promise<{ businesses: BusinessProfile[]; nextCursor: string | null }> => {
      const params = new URLSearchParams();
      if (options.category) params.set('category', options.category);
      if (options.cursor) params.set('cursor', options.cursor);
      const qs = params.toString();
      const { data, nextCursor } = await publicFetch<BusinessProfile[]>(
        `/businesses${qs ? `?${qs}` : ''}`,
      );
      return { businesses: data, nextCursor: nextCursor ?? null };
    },
    [],
  );

  const fetchBusiness = useCallback(async (businessId: string): Promise<BusinessProfile> => {
    const { data } = await publicFetch<BusinessProfile>(`/businesses/${businessId}`);
    return data;
  }, []);

  const fetchBusinessServices = useCallback(async (businessId: string): Promise<Service[]> => {
    const { data } = await publicFetch<Service[]>(`/businesses/${businessId}/services`);
    return data;
  }, []);

  const fetchBusinessAvailability = useCallback(
    async (businessId: string): Promise<AvailabilityWindow[]> => {
      const { data } = await publicFetch<AvailabilityWindow[]>(
        `/businesses/${businessId}/availability`,
      );
      return data;
    },
    [],
  );

  return { fetchBusinesses, fetchBusiness, fetchBusinessServices, fetchBusinessAvailability };
}
