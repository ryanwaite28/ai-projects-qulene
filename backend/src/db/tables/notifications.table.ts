import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import type { Notification } from '@qulene/api-types';

const TABLE = () => process.env.NOTIFICATIONS_TABLE ?? 'qulene-dev-notifications';

export interface NotificationPaginatedResult {
  items: Notification[];
  nextCursor: string | null;
}

export async function getNotificationById(
  dynamo: DynamoDBDocumentClient,
  notificationId: string,
): Promise<Notification | undefined> {
  const result = await dynamo.send(
    new GetCommand({ TableName: TABLE(), Key: { notificationId } }),
  );
  return result.Item as Notification | undefined;
}

export async function listByUser(
  dynamo: DynamoDBDocumentClient,
  userId: string,
  limit: number,
  cursor: string | undefined,
): Promise<NotificationPaginatedResult> {
  const result = await dynamo.send(
    new QueryCommand({
      TableName: TABLE(),
      IndexName: 'userId-createdAt-index',
      KeyConditionExpression: 'userId = :uid',
      ExpressionAttributeValues: { ':uid': userId },
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
  return { items: (result.Items ?? []) as Notification[], nextCursor };
}

export async function putNotification(
  dynamo: DynamoDBDocumentClient,
  notification: Notification,
): Promise<void> {
  await dynamo.send(new PutCommand({ TableName: TABLE(), Item: notification }));
}

export async function markRead(
  dynamo: DynamoDBDocumentClient,
  notificationId: string,
): Promise<void> {
  await dynamo.send(
    new UpdateCommand({
      TableName: TABLE(),
      Key: { notificationId },
      UpdateExpression: 'SET isRead = :t',
      ExpressionAttributeValues: { ':t': true },
    }),
  );
}
