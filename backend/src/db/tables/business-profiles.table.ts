import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import type { BusinessProfile } from '../../types/index.js';

const TABLE = () => process.env.BUSINESS_PROFILES_TABLE ?? 'qulene-dev-business-profiles';

export async function getBusinessById(
  dynamo: DynamoDBDocumentClient,
  businessId: string,
): Promise<BusinessProfile | undefined> {
  const result = await dynamo.send(
    new GetCommand({ TableName: TABLE(), Key: { businessId } }),
  );
  return result.Item as BusinessProfile | undefined;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
}

export async function listActiveByCategoryPaginated(
  dynamo: DynamoDBDocumentClient,
  category: string,
  limit: number,
  cursor: string | undefined,
): Promise<PaginatedResult<BusinessProfile>> {
  const result = await dynamo.send(
    new QueryCommand({
      TableName: TABLE(),
      IndexName: 'category-index',
      KeyConditionExpression: 'category = :cat',
      FilterExpression: 'isActive = :active',
      ExpressionAttributeValues: { ':cat': category, ':active': true },
      Limit: limit,
      ExclusiveStartKey: cursor ? JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')) : undefined,
    }),
  );
  const nextCursor = result.LastEvaluatedKey
    ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
    : null;
  return { items: (result.Items ?? []) as BusinessProfile[], nextCursor };
}

export async function listAllActivePaginated(
  dynamo: DynamoDBDocumentClient,
  limit: number,
  cursor: string | undefined,
): Promise<PaginatedResult<BusinessProfile>> {
  // Scan acceptable at portfolio scale; isActive filter reduces result set.
  const result = await dynamo.send(
    new ScanCommand({
      TableName: TABLE(),
      FilterExpression: 'isActive = :active',
      ExpressionAttributeValues: { ':active': true },
      Limit: limit,
      ExclusiveStartKey: cursor ? JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')) : undefined,
    }),
  );
  const nextCursor = result.LastEvaluatedKey
    ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
    : null;
  return { items: (result.Items ?? []) as BusinessProfile[], nextCursor };
}

export async function putBusinessProfile(
  dynamo: DynamoDBDocumentClient,
  profile: BusinessProfile,
): Promise<void> {
  await dynamo.send(new PutCommand({ TableName: TABLE(), Item: profile }));
}

export async function setActiveFlag(
  dynamo: DynamoDBDocumentClient,
  businessId: string,
  isActive: boolean,
): Promise<void> {
  await dynamo.send(
    new UpdateCommand({
      TableName: TABLE(),
      Key: { businessId },
      UpdateExpression: 'SET isActive = :active, updatedAt = :now',
      ExpressionAttributeValues: {
        ':active': isActive,
        ':now': new Date().toISOString(),
      },
    }),
  );
}
