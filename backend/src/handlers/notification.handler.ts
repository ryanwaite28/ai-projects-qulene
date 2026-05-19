import type { SQSEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { createSesClient } from '../clients/ses.client.js';
import {
  sendRequestReceived,
  sendRequestAccepted,
  sendRequestDeclined,
  sendRequestCancelled,
  sendWaitlistPromoted,
  sendServiceRemovedCascade,
} from '../services/notification.service.js';

let _dynamo: DynamoDBDocumentClient | undefined;
const getDynamo = () => {
  if (!_dynamo) {
    const cfg: { region: string; endpoint?: string } = {
      region: process.env.AWS_REGION ?? 'us-east-1',
    };
    if (process.env.DYNAMODB_ENDPOINT) cfg.endpoint = process.env.DYNAMODB_ENDPOINT;
    _dynamo = DynamoDBDocumentClient.from(new DynamoDBClient(cfg));
  }
  return _dynamo;
};

let _ses: ReturnType<typeof createSesClient> | undefined;
const getSes = () => (_ses ??= createSesClient());

export const handler = async (event: SQSEvent): Promise<void> => {
  const dynamo = getDynamo();
  const ses = getSes();

  for (const record of event.Records) {
    const envelope = JSON.parse(record.body) as { Message: string };
    const { eventType, payload } = JSON.parse(envelope.Message) as {
      eventType: string;
      payload: Record<string, string>;
    };

    switch (eventType) {
      case 'REQUEST_RECEIVED':
        await sendRequestReceived(dynamo, ses, { appointmentRequestId: payload['appointmentRequestId'] ?? '' });
        break;
      case 'REQUEST_ACCEPTED':
        await sendRequestAccepted(dynamo, ses, { appointmentRequestId: payload['appointmentRequestId'] ?? '' });
        break;
      case 'REQUEST_DECLINED':
        await sendRequestDeclined(dynamo, ses, { appointmentRequestId: payload['appointmentRequestId'] ?? '' });
        break;
      case 'REQUEST_CANCELLED':
        await sendRequestCancelled(dynamo, ses, { appointmentRequestId: payload['appointmentRequestId'] ?? '' });
        break;
      case 'WAITLIST_PROMOTED':
        await sendWaitlistPromoted(dynamo, ses, { waitlistEntryId: payload['waitlistEntryId'] ?? '' });
        break;
      case 'SERVICE_REMOVED':
        await sendServiceRemovedCascade(dynamo, ses, { serviceId: payload['serviceId'] ?? '' });
        break;
      default:
        console.log(JSON.stringify({ level: 'warn', action: 'notification-handler', message: `Unknown eventType: ${eventType}` }));
    }
  }
};
