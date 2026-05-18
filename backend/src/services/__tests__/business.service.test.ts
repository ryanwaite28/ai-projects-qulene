import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getBusinessById,
  listActiveBusinesses,
  updateOwnProfile,
  generateAvatarUploadUrl,
} from '../business.service.js';
import * as profilesTable from '../../db/tables/business-profiles.table.js';
import * as s3Client from '../../clients/s3.client.js';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { S3Client } from '@aws-sdk/client-s3';
import type { BusinessProfile } from '../../types/index.js';

vi.mock('../../db/tables/business-profiles.table.js');
vi.mock('../../clients/s3.client.js');

const mockGetById = vi.mocked(profilesTable.getBusinessById);
const mockListByCategory = vi.mocked(profilesTable.listActiveByCategoryPaginated);
const mockListAll = vi.mocked(profilesTable.listAllActivePaginated);
const mockPut = vi.mocked(profilesTable.putBusinessProfile);
const mockPresignedUrl = vi.mocked(s3Client.generatePresignedPutUrl);

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock; not actually called
const mockDynamo = {} as DynamoDBDocumentClient;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock; not actually called
const mockS3 = {} as S3Client;

let counter = 0;
function makeProfile(overrides: Partial<BusinessProfile> = {}): BusinessProfile {
  counter++;
  return {
    businessId: `biz-${counter}`,
    businessName: `Business ${counter}`,
    category: 'SALON',
    description: null,
    address: null,
    city: null,
    state: null,
    phone: null,
    avatarUrl: null,
    isActive: true,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── getBusinessById ──────────────────────────────────────────────────────────

describe('getBusinessById', () => {
  it('returns the profile when found', async () => {
    const profile = makeProfile();
    mockGetById.mockResolvedValue(profile);
    const result = await getBusinessById(mockDynamo, profile.businessId);
    expect(result).toStrictEqual(profile);
    expect(mockGetById).toHaveBeenCalledWith(mockDynamo, profile.businessId);
  });

  it('returns undefined when not found', async () => {
    mockGetById.mockResolvedValue(undefined);
    const result = await getBusinessById(mockDynamo, 'nonexistent');
    expect(result).toBeUndefined();
  });
});

// ─── listActiveBusinesses ─────────────────────────────────────────────────────

describe('listActiveBusinesses', () => {
  it('queries by category when category is provided', async () => {
    const items = [makeProfile(), makeProfile()];
    mockListByCategory.mockResolvedValue({ items, nextCursor: null });

    const result = await listActiveBusinesses(mockDynamo, { category: 'SALON' });

    expect(mockListByCategory).toHaveBeenCalledWith(mockDynamo, 'SALON', 20, undefined);
    expect(mockListAll).not.toHaveBeenCalled();
    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBeNull();
  });

  it('scans all when no category provided', async () => {
    mockListAll.mockResolvedValue({ items: [], nextCursor: null });

    await listActiveBusinesses(mockDynamo, {});

    expect(mockListAll).toHaveBeenCalledWith(mockDynamo, 20, undefined);
    expect(mockListByCategory).not.toHaveBeenCalled();
  });

  it('forwards cursor to underlying table function', async () => {
    const cursor = Buffer.from('{"businessId":"x"}').toString('base64');
    mockListAll.mockResolvedValue({ items: [], nextCursor: null });

    await listActiveBusinesses(mockDynamo, { cursor });

    expect(mockListAll).toHaveBeenCalledWith(mockDynamo, 20, cursor);
  });

  it('returns nextCursor from table result', async () => {
    const nextCursor = 'some-base64-cursor';
    mockListAll.mockResolvedValue({ items: [], nextCursor });

    const result = await listActiveBusinesses(mockDynamo, {});
    expect(result.nextCursor).toBe(nextCursor);
  });
});

// ─── updateOwnProfile ─────────────────────────────────────────────────────────

describe('updateOwnProfile', () => {
  it('creates a new profile when none exists', async () => {
    mockGetById.mockResolvedValue(undefined);
    mockPut.mockResolvedValue(undefined);

    const result = await updateOwnProfile(mockDynamo, {
      userId: 'new-biz-1',
      updates: { businessName: 'My Salon', category: 'SALON' },
    });

    expect(result.businessId).toBe('new-biz-1');
    expect(result.businessName).toBe('My Salon');
    expect(result.category).toBe('SALON');
    expect(result.isActive).toBe(true);
    expect(result.createdAt).toBeTruthy();
    expect(mockPut).toHaveBeenCalledOnce();
  });

  it('merges updates into an existing profile', async () => {
    const existing = makeProfile({ businessId: 'biz-existing', city: 'Austin' });
    mockGetById.mockResolvedValue(existing);
    mockPut.mockResolvedValue(undefined);

    const result = await updateOwnProfile(mockDynamo, {
      userId: 'biz-existing',
      updates: { description: 'New description' },
    });

    expect(result.city).toBe('Austin');
    expect(result.description).toBe('New description');
  });

  it('ignores disallowed fields in the update payload', async () => {
    mockGetById.mockResolvedValue(undefined);
    mockPut.mockResolvedValue(undefined);

    const result = await updateOwnProfile(mockDynamo, {
      userId: 'biz-2',
      updates: { businessName: 'Clean Cuts', isActive: false, createdAt: '1970-01-01' } as Record<string, unknown>,
    });

    // isActive must be computed — not taken from payload
    expect(result.isActive).toBe(true);
    // createdAt must not be overwritten by payload
    expect(result.createdAt).not.toBe('1970-01-01');
  });

  it('sets isActive false when businessName is null', async () => {
    mockGetById.mockResolvedValue(undefined);
    mockPut.mockResolvedValue(undefined);

    const result = await updateOwnProfile(mockDynamo, {
      userId: 'biz-3',
      updates: {},
    });

    expect(result.isActive).toBe(false);
  });
});

// ─── generateAvatarUploadUrl ──────────────────────────────────────────────────

describe('generateAvatarUploadUrl', () => {
  it('returns presigned URL and avatarUrl for valid content type', async () => {
    mockPresignedUrl.mockResolvedValue('https://s3.example.com/presigned');

    const result = await generateAvatarUploadUrl(mockS3, {
      userId: 'biz-avatar-1',
      contentType: 'image/jpeg',
    });

    expect(result.uploadUrl).toBe('https://s3.example.com/presigned');
    expect(result.avatarUrl).toContain('business-profiles/biz-avatar-1/avatar.jpg');
    expect(mockPresignedUrl).toHaveBeenCalledWith(
      mockS3,
      expect.any(String),
      'business-profiles/biz-avatar-1/avatar.jpg',
      'image/jpeg',
    );
  });

  it('supports image/png and image/webp', async () => {
    mockPresignedUrl.mockResolvedValue('https://s3.example.com/presigned');

    for (const ct of ['image/png', 'image/webp'] as const) {
      await generateAvatarUploadUrl(mockS3, { userId: 'biz-x', contentType: ct });
    }
    expect(mockPresignedUrl).toHaveBeenCalledTimes(2);
  });

  it('throws VALIDATION_ERROR for unsupported content type', async () => {
    await expect(
      generateAvatarUploadUrl(mockS3, { userId: 'biz-y', contentType: 'image/gif' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(mockPresignedUrl).not.toHaveBeenCalled();
  });
});
