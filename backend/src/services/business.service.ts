import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { S3Client } from '@aws-sdk/client-s3';
import type { BusinessProfile } from '../types/index.js';
import {
  getBusinessById as dbGetById,
  listActiveByCategoryPaginated,
  listAllActivePaginated,
  putBusinessProfile,
  type PaginatedResult,
} from '../db/tables/business-profiles.table.js';
import { generatePresignedPutUrl } from '../clients/s3.client.js';

const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const ALLOWED_UPDATE_FIELDS = new Set([
  'businessName', 'category', 'description', 'address', 'city', 'state', 'phone', 'avatarUrl',
]);

const PAGE_SIZE = 20;

export async function getBusinessById(
  dynamo: DynamoDBDocumentClient,
  businessId: string,
): Promise<BusinessProfile | undefined> {
  const start = Date.now();
  const profile = await dbGetById(dynamo, businessId);
  console.log(JSON.stringify({ level: 'info', action: 'getBusinessById', durationMs: Date.now() - start }));
  return profile;
}

export async function listActiveBusinesses(
  dynamo: DynamoDBDocumentClient,
  params: { category?: string; cursor?: string },
): Promise<PaginatedResult<BusinessProfile>> {
  const start = Date.now();
  const result = params.category
    ? await listActiveByCategoryPaginated(dynamo, params.category, PAGE_SIZE, params.cursor)
    : await listAllActivePaginated(dynamo, PAGE_SIZE, params.cursor);
  console.log(JSON.stringify({ level: 'info', action: 'listActiveBusinesses', durationMs: Date.now() - start }));
  return result;
}

export interface UpdateProfileInput {
  userId: string;
  updates: Record<string, unknown>;
}

export async function updateOwnProfile(
  dynamo: DynamoDBDocumentClient,
  input: UpdateProfileInput,
): Promise<BusinessProfile> {
  const start = Date.now();

  const existing = await dbGetById(dynamo, input.userId);
  const now = new Date().toISOString();

  const base: BusinessProfile = existing ?? {
    businessId: input.userId,
    businessName: null,
    category: null,
    description: null,
    address: null,
    city: null,
    state: null,
    phone: null,
    avatarUrl: null,
    isActive: false,
    createdAt: now,
    updatedAt: now,
  };

  const merged: BusinessProfile = { ...base, updatedAt: now };
  for (const [key, value] of Object.entries(input.updates)) {
    if (!ALLOWED_UPDATE_FIELDS.has(key)) continue;
    // Only accept string or null for all updatable fields
    if (value !== null && typeof value !== 'string') continue;
    (merged as unknown as Record<string, unknown>)[key] = value;
  }

  // isActive: true once businessName is set (Phase 2b will add hasActiveService check)
  merged.isActive = typeof merged.businessName === 'string' && merged.businessName.trim().length > 0;

  await putBusinessProfile(dynamo, merged);

  console.log(JSON.stringify({ level: 'info', action: 'updateOwnProfile', durationMs: Date.now() - start }));
  return merged;
}

export interface AvatarUploadInput {
  userId: string;
  contentType: string;
}

export interface AvatarUploadResult {
  uploadUrl: string;
  avatarUrl: string;
}

export async function generateAvatarUploadUrl(
  s3: S3Client,
  input: AvatarUploadInput,
): Promise<AvatarUploadResult> {
  const start = Date.now();

  const ext = ALLOWED_CONTENT_TYPES[input.contentType];
  if (!ext) {
    console.log(JSON.stringify({
      level: 'warn', action: 'generateAvatarUploadUrl', durationMs: Date.now() - start,
      code: 'VALIDATION_ERROR', error: `Unsupported content type: ${input.contentType}`,
    }));
    throw Object.assign(new Error(`contentType must be one of: ${Object.keys(ALLOWED_CONTENT_TYPES).join(', ')}`), {
      code: 'VALIDATION_ERROR',
    });
  }

  const bucket = process.env.MEDIA_BUCKET ?? 'qulene-dev-media';
  const key = `business-profiles/${input.userId}/avatar.${ext}`;
  const uploadUrl = await generatePresignedPutUrl(s3, bucket, key, input.contentType);

  const region = process.env.AWS_REGION ?? 'us-east-1';
  const avatarUrl = process.env.S3_ENDPOINT
    ? `${process.env.S3_ENDPOINT}/${bucket}/${key}`
    : `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

  console.log(JSON.stringify({ level: 'info', action: 'generateAvatarUploadUrl', durationMs: Date.now() - start }));
  return { uploadUrl, avatarUrl };
}
