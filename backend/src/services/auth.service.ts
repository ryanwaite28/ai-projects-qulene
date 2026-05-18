import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { User, UserRole } from '../types/index.js';
import { getUserById, putUser } from '../db/tables/users.table.js';

export interface CreateOrSyncInput {
  userId: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
}

export async function createOrSyncUserProfile(
  dynamo: DynamoDBDocumentClient,
  input: CreateOrSyncInput,
): Promise<User> {
  const start = Date.now();

  const existing = await getUserById(dynamo, input.userId);
  if (existing) {
    console.log(
      JSON.stringify({ level: 'info', action: 'createOrSyncUserProfile', durationMs: Date.now() - start }),
    );
    return existing;
  }

  const now = new Date().toISOString();
  const user: User = {
    userId: input.userId,
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    role: input.role,
    unreadNotificationCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  await putUser(dynamo, user);
  console.log(
    JSON.stringify({ level: 'info', action: 'createOrSyncUserProfile', durationMs: Date.now() - start }),
  );
  return user;
}
