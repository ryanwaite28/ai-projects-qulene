import { SNSClient } from '@aws-sdk/client-sns';

export function createSnsClient(): SNSClient {
  const endpoint = process.env.SNS_ENDPOINT;
  const region = process.env.AWS_REGION ?? 'us-east-1';
  return new SNSClient(endpoint ? { endpoint, region } : { region });
}
