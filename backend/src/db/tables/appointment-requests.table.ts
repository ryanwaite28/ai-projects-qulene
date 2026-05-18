import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import type { AppointmentRequest, AppointmentStatus } from '@qulene/api-types';

const TABLE = () => process.env.APPOINTMENT_REQUESTS_TABLE ?? 'qulene-dev-appointment-requests';

export interface AppointmentRequestPaginatedResult {
  items: AppointmentRequest[];
  nextCursor: string | null;
}

export async function getRequestById(
  dynamo: DynamoDBDocumentClient,
  requestId: string,
): Promise<AppointmentRequest | undefined> {
  const result = await dynamo.send(
    new GetCommand({ TableName: TABLE(), Key: { requestId } }),
  );
  return result.Item as AppointmentRequest | undefined;
}

export async function getRequestByIdempotencyKey(
  dynamo: DynamoDBDocumentClient,
  idempotencyKey: string,
): Promise<AppointmentRequest | undefined> {
  const result = await dynamo.send(
    new QueryCommand({
      TableName: TABLE(),
      IndexName: 'idempotencyKey-index',
      KeyConditionExpression: 'idempotencyKey = :key',
      ExpressionAttributeValues: { ':key': idempotencyKey },
      Limit: 1,
    }),
  );
  return (result.Items?.[0] ?? undefined) as AppointmentRequest | undefined;
}

export async function listByCustomer(
  dynamo: DynamoDBDocumentClient,
  customerId: string,
  limit: number,
  cursor: string | undefined,
): Promise<AppointmentRequestPaginatedResult> {
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
  return { items: (result.Items ?? []) as AppointmentRequest[], nextCursor };
}

export async function listByBusinessAndStatus(
  dynamo: DynamoDBDocumentClient,
  businessId: string,
  status: AppointmentStatus | undefined,
  limit: number,
  cursor: string | undefined,
): Promise<AppointmentRequestPaginatedResult> {
  const result = await dynamo.send(
    new QueryCommand({
      TableName: TABLE(),
      IndexName: 'businessId-status-index',
      KeyConditionExpression: status
        ? 'businessId = :biz AND #st = :status'
        : 'businessId = :biz',
      ...(status
        ? {
            ExpressionAttributeNames: { '#st': 'status' },
            ExpressionAttributeValues: { ':biz': businessId, ':status': status },
          }
        : { ExpressionAttributeValues: { ':biz': businessId } }),
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
  return { items: (result.Items ?? []) as AppointmentRequest[], nextCursor };
}

export async function listByService(
  dynamo: DynamoDBDocumentClient,
  serviceId: string,
  statusFilter?: AppointmentStatus,
): Promise<AppointmentRequest[]> {
  const result = await dynamo.send(
    new QueryCommand({
      TableName: TABLE(),
      IndexName: 'serviceId-index',
      KeyConditionExpression: 'serviceId = :sid',
      ...(statusFilter
        ? {
            FilterExpression: '#st = :status',
            ExpressionAttributeNames: { '#st': 'status' },
            ExpressionAttributeValues: { ':sid': serviceId, ':status': statusFilter },
          }
        : { ExpressionAttributeValues: { ':sid': serviceId } }),
    }),
  );
  return (result.Items ?? []) as AppointmentRequest[];
}

export async function putRequest(
  dynamo: DynamoDBDocumentClient,
  request: AppointmentRequest,
): Promise<void> {
  await dynamo.send(new PutCommand({ TableName: TABLE(), Item: request }));
}

export async function updateRequestStatus(
  dynamo: DynamoDBDocumentClient,
  requestId: string,
  status: AppointmentStatus,
  updatedAt: string,
): Promise<void> {
  await dynamo.send(
    new UpdateCommand({
      TableName: TABLE(),
      Key: { requestId },
      UpdateExpression: 'SET #st = :status, updatedAt = :now',
      ExpressionAttributeNames: { '#st': 'status' },
      ExpressionAttributeValues: { ':status': status, ':now': updatedAt },
    }),
  );
}
