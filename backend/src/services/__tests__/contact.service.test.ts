import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SESClient } from '@aws-sdk/client-ses';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { submitContact, signupForWaitlist } from '../contact.service.js';
import * as sesClient from '../../clients/ses.client.js';
import * as webSignupsTable from '../../db/tables/web-signups.table.js';

vi.mock('../../clients/ses.client.js');
vi.mock('../../db/tables/web-signups.table.js');

const mockSendEmail = vi.mocked(sesClient.sendEmail);
const mockPutSignup = vi.mocked(webSignupsTable.putSignup);

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock
const mockSes = {} as SESClient;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock
const mockDynamo = {} as DynamoDBDocumentClient;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('submitContact', () => {
  it('sends email to ADMIN_EMAIL with name, reply-to, and message', async () => {
    mockSendEmail.mockResolvedValue(undefined);

    await submitContact(mockSes, { name: 'Alice', email: 'alice@example.com', message: 'Hello!' });

    expect(mockSendEmail).toHaveBeenCalledWith(
      mockSes,
      expect.objectContaining({
        to: process.env['ADMIN_EMAIL'],
        subject: 'Qulene Contact: Alice',
      }),
    );
    const call = mockSendEmail.mock.calls[0]?.[1];
    expect(call?.html).toContain('Alice');
    expect(call?.html).toContain('alice@example.com');
    expect(call?.html).toContain('Hello!');
  });

  it('escapes HTML in user-supplied fields', async () => {
    mockSendEmail.mockResolvedValue(undefined);

    await submitContact(mockSes, { name: '<script>', email: 'x@y.com', message: 'a&b' });

    const call = mockSendEmail.mock.calls[0]?.[1];
    expect(call?.html).toContain('&lt;script&gt;');
    expect(call?.html).toContain('a&amp;b');
  });

  it('re-throws when sendEmail throws', async () => {
    mockSendEmail.mockRejectedValue(new Error('SES down'));

    await expect(
      submitContact(mockSes, { name: 'Bob', email: 'bob@example.com', message: 'Hi' }),
    ).rejects.toThrow('SES down');
  });
});

describe('signupForWaitlist', () => {
  it('calls putSignup and returns the email', async () => {
    mockPutSignup.mockResolvedValue(undefined);

    const result = await signupForWaitlist(mockDynamo, 'user@example.com');

    expect(mockPutSignup).toHaveBeenCalledWith(mockDynamo, 'user@example.com');
    expect(result).toEqual({ email: 'user@example.com' });
  });

  it('re-throws when putSignup throws', async () => {
    mockPutSignup.mockRejectedValue(new Error('DynamoDB down'));

    await expect(signupForWaitlist(mockDynamo, 'user@example.com')).rejects.toThrow('DynamoDB down');
  });
});
