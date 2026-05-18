import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import type { User } from '../../types/index.js';

const TABLE = () => process.env.USERS_TABLE ?? 'qulene-dev-users';

export async function getUserById(
  dynamo: DynamoDBDocumentClient,
  userId: string,
): Promise<User | undefined> {
  const result = await dynamo.send(
    new GetCommand({ TableName: TABLE(), Key: { userId } }),
  );
  return result.Item as User | undefined;
}

export async function getUserByEmail(
  dynamo: DynamoDBDocumentClient,
  email: string,
): Promise<User | undefined> {
  const result = await dynamo.send(
    new QueryCommand({
      TableName: TABLE(),
      IndexName: 'email-index',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: { ':email': email },
      Limit: 1,
    }),
  );
  return result.Items?.[0] as User | undefined;
}

export async function putUser(
  dynamo: DynamoDBDocumentClient,
  user: User,
): Promise<void> {
  await dynamo.send(new PutCommand({ TableName: TABLE(), Item: user }));
}

export async function updateUserName(
  dynamo: DynamoDBDocumentClient,
  userId: string,
  firstName: string,
  lastName: string,
): Promise<void> {
  await dynamo.send(
    new UpdateCommand({
      TableName: TABLE(),
      Key: { userId },
      UpdateExpression: 'SET firstName = :fn, lastName = :ln, updatedAt = :now',
      ExpressionAttributeValues: {
        ':fn': firstName,
        ':ln': lastName,
        ':now': new Date().toISOString(),
      },
    }),
  );
}
