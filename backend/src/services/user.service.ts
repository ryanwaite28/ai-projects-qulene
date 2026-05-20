import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { User } from '../types/index.js';
import { getUserById, updateUserName } from '../db/tables/users.table.js';

export class UserNotFoundError extends Error {
  readonly code = 'NOT_FOUND';
  constructor(userId: string) {
    super(`User not found: ${userId}`);
  }
}

export class UserValidationError extends Error {
  readonly code = 'VALIDATION_ERROR';
  constructor(message: string) {
    super(message);
  }
}

export async function getMyProfile(
  dynamo: DynamoDBDocumentClient,
  userId: string,
): Promise<User> {
  const start = Date.now();
  const user = await getUserById(dynamo, userId);
  if (!user) throw new UserNotFoundError(userId);
  console.log(JSON.stringify({ level: 'info', action: 'getMyProfile', durationMs: Date.now() - start }));
  return user;
}

export async function updateMyName(
  dynamo: DynamoDBDocumentClient,
  input: { userId: string; firstName: string; lastName: string },
): Promise<User> {
  const start = Date.now();
  if (!input.firstName.trim()) throw new UserValidationError('firstName is required');
  if (!input.lastName.trim()) throw new UserValidationError('lastName is required');
  if (input.firstName.length > 50) throw new UserValidationError('firstName must be 50 characters or fewer');
  if (input.lastName.length > 50) throw new UserValidationError('lastName must be 50 characters or fewer');
  await updateUserName(dynamo, input.userId, input.firstName, input.lastName);
  const updated = await getUserById(dynamo, input.userId);
  if (!updated) throw new UserNotFoundError(input.userId);
  console.log(JSON.stringify({ level: 'info', action: 'updateMyName', durationMs: Date.now() - start }));
  return updated;
}
