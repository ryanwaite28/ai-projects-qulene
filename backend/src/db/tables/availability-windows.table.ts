import {
  DynamoDBDocumentClient,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';

const TABLE = () => process.env.AVAILABILITY_WINDOWS_TABLE ?? 'qulene-dev-availability-windows';

export interface AvailabilityWindow {
  windowId: string;
  businessId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  createdAt: string;
}

export async function getWindowById(
  dynamo: DynamoDBDocumentClient,
  windowId: string,
): Promise<AvailabilityWindow | undefined> {
  const result = await dynamo.send(
    new GetCommand({ TableName: TABLE(), Key: { windowId } }),
  );
  return result.Item as AvailabilityWindow | undefined;
}

export async function listByBusiness(
  dynamo: DynamoDBDocumentClient,
  businessId: string,
): Promise<AvailabilityWindow[]> {
  const result = await dynamo.send(
    new QueryCommand({
      TableName: TABLE(),
      IndexName: 'businessId-index',
      KeyConditionExpression: 'businessId = :biz',
      ExpressionAttributeValues: { ':biz': businessId },
    }),
  );
  return (result.Items ?? []) as AvailabilityWindow[];
}

export async function countByBusiness(
  dynamo: DynamoDBDocumentClient,
  businessId: string,
): Promise<number> {
  const result = await dynamo.send(
    new QueryCommand({
      TableName: TABLE(),
      IndexName: 'businessId-index',
      KeyConditionExpression: 'businessId = :biz',
      ExpressionAttributeValues: { ':biz': businessId },
      Select: 'COUNT',
    }),
  );
  return result.Count ?? 0;
}

export async function countByBusinessAndDay(
  dynamo: DynamoDBDocumentClient,
  businessId: string,
  dayOfWeek: number,
): Promise<number> {
  const result = await dynamo.send(
    new QueryCommand({
      TableName: TABLE(),
      IndexName: 'businessId-index',
      KeyConditionExpression: 'businessId = :biz',
      FilterExpression: 'dayOfWeek = :day',
      ExpressionAttributeValues: { ':biz': businessId, ':day': dayOfWeek },
      Select: 'COUNT',
    }),
  );
  return result.Count ?? 0;
}

export async function putWindow(
  dynamo: DynamoDBDocumentClient,
  window: AvailabilityWindow,
): Promise<void> {
  await dynamo.send(new PutCommand({ TableName: TABLE(), Item: window }));
}

export async function deleteWindow(
  dynamo: DynamoDBDocumentClient,
  windowId: string,
): Promise<void> {
  await dynamo.send(new DeleteCommand({ TableName: TABLE(), Key: { windowId } }));
}
