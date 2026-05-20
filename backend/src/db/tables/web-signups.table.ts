import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const TABLE = () => process.env.WEB_SIGNUPS_TABLE ?? 'qulene-dev-web-signups';

export async function putSignup(dynamo: DynamoDBDocumentClient, email: string): Promise<void> {
  await dynamo.send(
    new PutCommand({
      TableName: TABLE(),
      Item: { email, createdAt: new Date().toISOString() },
    }),
  );
}
