import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import type { WaitlistEntry, WaitlistStatus } from '@qulene/api-types';

const TABLE = () => process.env.WAITLIST_ENTRIES_TABLE ?? 'qulene-dev-waitlist-entries';

export interface WaitlistPaginatedResult {
  items: WaitlistEntry[];
  nextCursor: string | null;
}

export async function getEntryById(
  dynamo: DynamoDBDocumentClient,
  entryId: string,
): Promise<WaitlistEntry | undefined> {
  const result = await dynamo.send(
    new GetCommand({ TableName: TABLE(), Key: { entryId } }),
  );
  return result.Item as WaitlistEntry | undefined;
}

export async function getActiveByCustomerAndService(
  dynamo: DynamoDBDocumentClient,
  customerId: string,
  serviceId: string,
): Promise<WaitlistEntry | undefined> {
  const result = await dynamo.send(
    new QueryCommand({
      TableName: TABLE(),
      IndexName: 'customerId-index',
      KeyConditionExpression: 'customerId = :cid',
      FilterExpression: 'serviceId = :sid AND #st = :active',
      ExpressionAttributeNames: { '#st': 'status' },
      ExpressionAttributeValues: { ':cid': customerId, ':sid': serviceId, ':active': 'ACTIVE' },
    }),
  );
  return (result.Items?.[0] ?? undefined) as WaitlistEntry | undefined;
}

export async function listActiveByService(
  dynamo: DynamoDBDocumentClient,
  serviceId: string,
  limit = 50,
): Promise<WaitlistEntry[]> {
  const result = await dynamo.send(
    new QueryCommand({
      TableName: TABLE(),
      IndexName: 'serviceId-status-index',
      KeyConditionExpression: 'serviceId = :sid',
      FilterExpression: '#st = :active',
      ExpressionAttributeNames: { '#st': 'status' },
      ExpressionAttributeValues: { ':sid': serviceId, ':active': 'ACTIVE' },
      Limit: limit,
      ScanIndexForward: true, // oldest createdAt first
    }),
  );
  return (result.Items ?? []) as WaitlistEntry[];
}

export async function listByCustomer(
  dynamo: DynamoDBDocumentClient,
  customerId: string,
  limit: number,
  cursor: string | undefined,
): Promise<WaitlistPaginatedResult> {
  const result = await dynamo.send(
    new QueryCommand({
      TableName: TABLE(),
      IndexName: 'customerId-index',
      KeyConditionExpression: 'customerId = :cid',
      ExpressionAttributeValues: { ':cid': customerId },
      Limit: limit,
      ScanIndexForward: false,
      ExclusiveStartKey: cursor
        ? JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'))
        : undefined,
    }),
  );
  const nextCursor = result.LastEvaluatedKey
    ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
    : null;
  return { items: (result.Items ?? []) as WaitlistEntry[], nextCursor };
}

export async function putEntry(
  dynamo: DynamoDBDocumentClient,
  entry: WaitlistEntry,
): Promise<void> {
  await dynamo.send(new PutCommand({ TableName: TABLE(), Item: entry }));
}

export async function updateEntryStatus(
  dynamo: DynamoDBDocumentClient,
  entryId: string,
  status: WaitlistStatus,
  updatedAt: string,
): Promise<void> {
  await dynamo.send(
    new UpdateCommand({
      TableName: TABLE(),
      Key: { entryId },
      UpdateExpression: 'SET #st = :status, updatedAt = :now',
      ExpressionAttributeNames: { '#st': 'status' },
      ExpressionAttributeValues: { ':status': status, ':now': updatedAt },
    }),
  );
}

export async function conditionalPromoteEntry(
  dynamo: DynamoDBDocumentClient,
  entryId: string,
  updatedAt: string,
): Promise<boolean> {
  try {
    await dynamo.send(
      new UpdateCommand({
        TableName: TABLE(),
        Key: { entryId },
        UpdateExpression: 'SET #st = :promoted, updatedAt = :now',
        ConditionExpression: '#st = :active',
        ExpressionAttributeNames: { '#st': 'status' },
        ExpressionAttributeValues: {
          ':promoted': 'PROMOTED',
          ':active': 'ACTIVE',
          ':now': updatedAt,
        },
      }),
    );
    return true;
  } catch (err: unknown) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'name' in err &&
      (err as { name: string }).name === 'ConditionalCheckFailedException'
    ) {
      return false;
    }
    throw err;
  }
}
