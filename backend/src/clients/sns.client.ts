import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import type { NotificationType } from '@qulene/api-types';

export type SnsEventType = NotificationType;

export function createSnsClient(): SNSClient {
  const endpoint = process.env.SNS_ENDPOINT;
  const region = process.env.AWS_REGION ?? 'us-east-1';
  return new SNSClient(endpoint ? { endpoint, region } : { region });
}

export async function publishEvent(
  sns: SNSClient,
  eventType: SnsEventType,
  payload: Record<string, unknown>,
): Promise<void> {
  await sns.send(
    new PublishCommand({
      TopicArn: process.env.SNS_TOPIC_ARN,
      Message: JSON.stringify({ eventType, payload }),
    }),
  );
}
