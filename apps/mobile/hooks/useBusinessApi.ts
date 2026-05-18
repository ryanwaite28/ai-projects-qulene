import { useCallback } from 'react';
import { useApi } from './useApi';
import { useAuth } from './useAuth';
import type { BusinessProfile, Service, AvailabilityWindow } from '@qulene/api-types';

export interface AvatarUploadResult {
  uploadUrl: string;
  avatarUrl: string;
}

type ProfileUpdates = {
  businessName?: string | null;
  category?: string | null;
  description?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
};

type ServiceInput = {
  name: string;
  description: string;
  durationMinutes: number;
  price: number;
  status: 'ACTIVE' | 'PAUSED';
};

type ServiceUpdates = Partial<ServiceInput>;

type WindowInput = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

export function useBusinessApi() {
  const { request } = useApi();
  const { session } = useAuth();
  const userId = session?.userId ?? '';

  const fetchBusinessProfile = useCallback(
    () => request<BusinessProfile>(`/businesses/${userId}`),
    [request, userId],
  );

  const updateProfile = useCallback(
    (updates: ProfileUpdates) =>
      request<BusinessProfile>('/businesses/me', {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }),
    [request],
  );

  const requestAvatarUploadUrl = useCallback(
    (contentType: string) =>
      request<AvatarUploadResult>('/businesses/me/avatar', {
        method: 'POST',
        body: JSON.stringify({ contentType }),
      }),
    [request],
  );

  const fetchServices = useCallback(
    () => request<Service[]>(`/businesses/${userId}/services`),
    [request, userId],
  );

  const createService = useCallback(
    (data: ServiceInput) =>
      request<Service>('/businesses/me/services', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    [request],
  );

  const updateService = useCallback(
    (serviceId: string, updates: ServiceUpdates) =>
      request<Service>(`/businesses/me/services/${serviceId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }),
    [request],
  );

  const deleteService = useCallback(
    (serviceId: string) =>
      request<{ deleted: boolean }>(`/businesses/me/services/${serviceId}`, { method: 'DELETE' }),
    [request],
  );

  const fetchAvailability = useCallback(
    () => request<AvailabilityWindow[]>(`/businesses/${userId}/availability`),
    [request, userId],
  );

  const addAvailabilityWindow = useCallback(
    (data: WindowInput) =>
      request<AvailabilityWindow>('/businesses/me/availability', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    [request],
  );

  const removeAvailabilityWindow = useCallback(
    (windowId: string) =>
      request<{ deleted: boolean }>(`/businesses/me/availability/${windowId}`, { method: 'DELETE' }),
    [request],
  );

  return {
    fetchBusinessProfile,
    updateProfile,
    requestAvatarUploadUrl,
    fetchServices,
    createService,
    updateService,
    deleteService,
    fetchAvailability,
    addAvailabilityWindow,
    removeAvailabilityWindow,
  };
}
