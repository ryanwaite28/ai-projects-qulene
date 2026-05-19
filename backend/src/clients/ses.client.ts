import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

export function createSesClient(): SESClient {
  const endpoint = process.env.SES_ENDPOINT;
  const region = process.env.AWS_REGION ?? 'us-east-1';
  return new SESClient(endpoint ? { endpoint, region } : { region });
}

export async function sendEmail(
  ses: SESClient,
  { to, subject, html }: { to: string; subject: string; html: string },
): Promise<void> {
  await ses.send(
    new SendEmailCommand({
      Source: process.env.SES_FROM_EMAIL,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: { Html: { Data: html, Charset: 'UTF-8' } },
      },
    }),
  );
}
