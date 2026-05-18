import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

const TABLE = () => process.env.SERVICES_TABLE ?? 'qulene-dev-services';

export type ServiceStatus = 'ACTIVE' | 'PAUSED' | 'DELETED';

export interface Service {
  serviceId: string;
  businessId: string;
  name: string;
  description: string;
  durationMinutes: number;
  price: number;
  status: ServiceStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ServicePaginatedResult {
  items: Service[];
  nextCursor: string | null;
}

export async function getServiceById(
  dynamo: DynamoDBDocumentClient,
  serviceId: string,
): Promise<Service | undefined> {
  const result = await dynamo.send(
    new GetCommand({ TableName: TABLE(), Key: { serviceId } }),
  );
  return result.Item as Service | undefined;
}

export async function listByBusinessActive(
  dynamo: DynamoDBDocumentClient,
  businessId: string,
  limit: number,
  cursor: string | undefined,
): Promise<ServicePaginatedResult> {
  const result = await dynamo.send(
    new QueryCommand({
      TableName: TABLE(),
      IndexName: 'businessId-index',
      KeyConditionExpression: 'businessId = :biz',
      FilterExpression: '#st <> :deleted',
      ExpressionAttributeNames: { '#st': 'status' },
      ExpressionAttributeValues: { ':biz': businessId, ':deleted': 'DELETED' },
      Limit: limit,
      ScanIndexForward: true,
      ExclusiveStartKey: cursor
        ? JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'))
        : undefined,
    }),
  );
  const nextCursor = result.LastEvaluatedKey
    ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
    : null;
  return { items: (result.Items ?? []) as Service[], nextCursor };
}

export async function countActiveByBusiness(
  dynamo: DynamoDBDocumentClient,
  businessId: string,
): Promise<number> {
  const result = await dynamo.send(
    new QueryCommand({
      TableName: TABLE(),
      IndexName: 'businessId-index',
      KeyConditionExpression: 'businessId = :biz',
      FilterExpression: '#st = :active',
      ExpressionAttributeNames: { '#st': 'status' },
      ExpressionAttributeValues: { ':biz': businessId, ':active': 'ACTIVE' },
      Select: 'COUNT',
    }),
  );
  return result.Count ?? 0;
}

export async function putService(
  dynamo: DynamoDBDocumentClient,
  service: Service,
): Promise<void> {
  await dynamo.send(new PutCommand({ TableName: TABLE(), Item: service }));
}

export async function updateService(
  dynamo: DynamoDBDocumentClient,
  serviceId: string,
  updates: Partial<Pick<Service, 'name' | 'description' | 'durationMinutes' | 'price' | 'status'>>,
  updatedAt: string,
): Promise<void> {
  const setClauses: string[] = ['updatedAt = :now'];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = { ':now': updatedAt };

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    if (key === 'status') {
      names['#st'] = 'status';
      setClauses.push('#st = :status');
      values[':status'] = value;
    } else {
      setClauses.push(`${key} = :${key}`);
      values[`:${key}`] = value;
    }
  }

  await dynamo.send(
    new UpdateCommand({
      TableName: TABLE(),
      Key: { serviceId },
      UpdateExpression: `SET ${setClauses.join(', ')}`,
      ExpressionAttributeNames: Object.keys(names).length > 0 ? names : undefined,
      ExpressionAttributeValues: values,
    }),
  );
}

export async function setServiceStatus(
  dynamo: DynamoDBDocumentClient,
  serviceId: string,
  status: ServiceStatus,
): Promise<void> {
  await dynamo.send(
    new UpdateCommand({
      TableName: TABLE(),
      Key: { serviceId },
      UpdateExpression: 'SET #st = :status, updatedAt = :now',
      ExpressionAttributeNames: { '#st': 'status' },
      ExpressionAttributeValues: {
        ':status': status,
        ':now': new Date().toISOString(),
      },
    }),
  );
}
