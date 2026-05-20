import type { SESClient } from '@aws-sdk/client-ses';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { sendEmail } from '../clients/ses.client.js';
import { putSignup } from '../db/tables/web-signups.table.js';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function submitContact(
  ses: SESClient,
  input: { name: string; email: string; message: string },
): Promise<void> {
  const start = Date.now();
  try {
    const adminEmail = process.env.ADMIN_EMAIL ?? '';
    const html = [
      `<p><strong>Name:</strong> ${escapeHtml(input.name)}</p>`,
      `<p><strong>Reply-to:</strong> ${escapeHtml(input.email)}</p>`,
      `<p><strong>Message:</strong></p>`,
      `<p>${escapeHtml(input.message).replace(/\n/g, '<br>')}</p>`,
    ].join('');
    await sendEmail(ses, { to: adminEmail, subject: `Qulene Contact: ${input.name}`, html });
    console.log(JSON.stringify({ level: 'info', action: 'submitContact', durationMs: Date.now() - start }));
  } catch (err) {
    console.log(JSON.stringify({ level: 'error', action: 'submitContact', durationMs: Date.now() - start, error: String(err) }));
    throw err;
  }
}

export async function signupForWaitlist(
  dynamo: DynamoDBDocumentClient,
  email: string,
): Promise<{ email: string }> {
  const start = Date.now();
  try {
    await putSignup(dynamo, email);
    console.log(JSON.stringify({ level: 'info', action: 'signupForWaitlist', durationMs: Date.now() - start }));
    return { email };
  } catch (err) {
    console.log(JSON.stringify({ level: 'error', action: 'signupForWaitlist', durationMs: Date.now() - start, error: String(err) }));
    throw err;
  }
}
