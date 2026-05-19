import { randomUUID } from 'crypto';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { SESClient } from '@aws-sdk/client-ses';
import { getRequestById, listByService, updateRequestStatus } from '../db/tables/appointment-requests.table.js';
import { getBusinessById } from '../db/tables/business-profiles.table.js';
import { getServiceById } from '../db/tables/services.table.js';
import { getEntryById } from '../db/tables/waitlist-entries.table.js';
import { getUserById, incrementUnreadCount } from '../db/tables/users.table.js';
import { putNotification } from '../db/tables/notifications.table.js';
import { renderTemplate } from '../emails/email.renderer.js';
import { sendEmail } from '../clients/ses.client.js';

function formatProposedAt(isoString: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(isoString));
}

export async function sendRequestReceived(
  dynamo: DynamoDBDocumentClient,
  ses: SESClient,
  payload: { appointmentRequestId: string },
): Promise<void> {
  const start = Date.now();
  try {
    const request = await getRequestById(dynamo, payload.appointmentRequestId);
    if (!request) return;
    const [customer, businessUser, service] = await Promise.all([
      getUserById(dynamo, request.customerId),
      getUserById(dynamo, request.businessId),
      getServiceById(dynamo, request.serviceId),
    ]);
    if (!customer || !businessUser || !service) return;
    const html = renderTemplate('request-received', {
      customerFirstName: customer.firstName,
      serviceName: service.name,
      formattedProposedAt: formatProposedAt(request.proposedAt),
      ...(request.notes !== undefined ? { notes: request.notes } : {}),
    });
    await sendEmail(ses, { to: businessUser.email, subject: 'New Appointment Request', html });
    console.log(JSON.stringify({ level: 'info', action: 'sendRequestReceived', durationMs: Date.now() - start }));
  } catch (err) {
    console.log(JSON.stringify({ level: 'error', action: 'sendRequestReceived', durationMs: Date.now() - start, error: String(err) }));
  }
}

export async function sendRequestAccepted(
  dynamo: DynamoDBDocumentClient,
  ses: SESClient,
  payload: { appointmentRequestId: string },
): Promise<void> {
  const start = Date.now();
  try {
    const request = await getRequestById(dynamo, payload.appointmentRequestId);
    if (!request) return;
    const [customer, businessProfile, service] = await Promise.all([
      getUserById(dynamo, request.customerId),
      getBusinessById(dynamo, request.businessId),
      getServiceById(dynamo, request.serviceId),
    ]);
    if (!customer || !businessProfile || !service) return;
    const html = renderTemplate('request-accepted', {
      businessName: businessProfile.businessName ?? 'the business',
      serviceName: service.name,
      formattedProposedAt: formatProposedAt(request.proposedAt),
    });
    await sendEmail(ses, { to: customer.email, subject: 'Your Appointment is Confirmed', html });
    console.log(JSON.stringify({ level: 'info', action: 'sendRequestAccepted', durationMs: Date.now() - start }));
  } catch (err) {
    console.log(JSON.stringify({ level: 'error', action: 'sendRequestAccepted', durationMs: Date.now() - start, error: String(err) }));
  }
}

export async function sendRequestDeclined(
  dynamo: DynamoDBDocumentClient,
  ses: SESClient,
  payload: { appointmentRequestId: string },
): Promise<void> {
  const start = Date.now();
  try {
    const request = await getRequestById(dynamo, payload.appointmentRequestId);
    if (!request) return;
    const [customer, businessProfile, service] = await Promise.all([
      getUserById(dynamo, request.customerId),
      getBusinessById(dynamo, request.businessId),
      getServiceById(dynamo, request.serviceId),
    ]);
    if (!customer || !businessProfile || !service) return;
    const html = renderTemplate('request-declined', {
      businessName: businessProfile.businessName ?? 'the business',
      serviceName: service.name,
    });
    await sendEmail(ses, { to: customer.email, subject: 'Appointment Request Declined', html });
    console.log(JSON.stringify({ level: 'info', action: 'sendRequestDeclined', durationMs: Date.now() - start }));
  } catch (err) {
    console.log(JSON.stringify({ level: 'error', action: 'sendRequestDeclined', durationMs: Date.now() - start, error: String(err) }));
  }
}

export async function sendRequestCancelled(
  dynamo: DynamoDBDocumentClient,
  ses: SESClient,
  payload: { appointmentRequestId: string },
): Promise<void> {
  const start = Date.now();
  try {
    const request = await getRequestById(dynamo, payload.appointmentRequestId);
    if (!request) return;
    const [customer, businessUser, service] = await Promise.all([
      getUserById(dynamo, request.customerId),
      getUserById(dynamo, request.businessId),
      getServiceById(dynamo, request.serviceId),
    ]);
    if (!customer || !businessUser || !service) return;
    const html = renderTemplate('request-cancelled', {
      customerFirstName: customer.firstName,
      serviceName: service.name,
      formattedProposedAt: formatProposedAt(request.proposedAt),
    });
    await sendEmail(ses, { to: businessUser.email, subject: 'Appointment Cancelled', html });
    console.log(JSON.stringify({ level: 'info', action: 'sendRequestCancelled', durationMs: Date.now() - start }));
  } catch (err) {
    console.log(JSON.stringify({ level: 'error', action: 'sendRequestCancelled', durationMs: Date.now() - start, error: String(err) }));
  }
}

export async function sendWaitlistPromoted(
  dynamo: DynamoDBDocumentClient,
  ses: SESClient,
  payload: { waitlistEntryId: string },
): Promise<void> {
  const start = Date.now();
  try {
    const entry = await getEntryById(dynamo, payload.waitlistEntryId);
    if (!entry) return;
    const [customer, businessProfile, service] = await Promise.all([
      getUserById(dynamo, entry.customerId),
      getBusinessById(dynamo, entry.businessId),
      getServiceById(dynamo, entry.serviceId),
    ]);
    if (!customer || !businessProfile || !service) return;
    const html = renderTemplate('waitlist-promoted', {
      businessName: businessProfile.businessName ?? 'the business',
      serviceName: service.name,
    });
    await sendEmail(ses, { to: customer.email, subject: 'A Slot Has Opened for You', html });
    console.log(JSON.stringify({ level: 'info', action: 'sendWaitlistPromoted', durationMs: Date.now() - start }));
  } catch (err) {
    console.log(JSON.stringify({ level: 'error', action: 'sendWaitlistPromoted', durationMs: Date.now() - start, error: String(err) }));
  }
}

// Does NOT re-publish SNS per cancelled request — doing so would double-email since this
// function already handles the email to each affected customer.
export async function sendServiceRemovedCascade(
  dynamo: DynamoDBDocumentClient,
  ses: SESClient,
  payload: { serviceId: string },
): Promise<void> {
  const start = Date.now();
  try {
    const service = await getServiceById(dynamo, payload.serviceId);
    if (!service) return;
    const businessProfile = await getBusinessById(dynamo, service.businessId);
    const affected = await listByService(dynamo, payload.serviceId);
    const toCancel = affected.filter((r) => r.status === 'PENDING' || r.status === 'ACCEPTED');

    for (const request of toCancel) {
      try {
        const now = new Date().toISOString();
        const customer = await getUserById(dynamo, request.customerId);
        if (!customer) continue;

        await updateRequestStatus(dynamo, request.requestId, 'CANCELLED', now);
        await putNotification(dynamo, {
          notificationId: randomUUID(),
          userId: request.customerId,
          type: 'SERVICE_REMOVED',
          relatedId: payload.serviceId,
          message: 'A service you had booked is no longer available.',
          isRead: false,
          createdAt: now,
        });
        await incrementUnreadCount(dynamo, request.customerId);

        const html = renderTemplate('service-removed', {
          businessName: businessProfile?.businessName ?? 'the business',
          serviceName: service.name,
        });
        await sendEmail(ses, { to: customer.email, subject: 'Service No Longer Available', html });
      } catch (perErr) {
        console.log(JSON.stringify({ level: 'error', action: 'sendServiceRemovedCascade.perRequest', requestId: request.requestId, error: String(perErr) }));
      }
    }
    console.log(JSON.stringify({ level: 'info', action: 'sendServiceRemovedCascade', durationMs: Date.now() - start, cancelled: toCancel.length }));
  } catch (err) {
    console.log(JSON.stringify({ level: 'error', action: 'sendServiceRemovedCascade', durationMs: Date.now() - start, error: String(err) }));
  }
}
