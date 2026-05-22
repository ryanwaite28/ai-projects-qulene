/**
 * Local seed script — populates MiniStack DynamoDB with demo data.
 * Idempotent: uses ConditionExpression attribute_not_exists on the PK.
 * Run: npm run seed:local
 */

import { readFileSync, existsSync } from 'fs';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

// Load .env from repo root so the script works without manual env exports
const envPath = new URL('../../.env', import.meta.url).pathname;
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const idx = t.indexOf('=');
    if (idx === -1) continue;
    const key = t.slice(0, idx).trim();
    const val = t.slice(idx + 1).trim();
    if (!(key in process.env)) process.env[key] = val;
  }
}

const ENDPOINT = process.env.DYNAMODB_ENDPOINT ?? process.env.MINISTACK_ENDPOINT ?? 'http://localhost:4566';

const TABLES = {
  users:               process.env.USERS_TABLE               ?? 'qulene-local-users',
  businessProfiles:    process.env.BUSINESS_PROFILES_TABLE   ?? 'qulene-local-business-profiles',
  services:            process.env.SERVICES_TABLE             ?? 'qulene-local-services',
  availabilityWindows: process.env.AVAILABILITY_WINDOWS_TABLE ?? 'qulene-local-availability-windows',
  appointmentRequests: process.env.APPOINTMENT_REQUESTS_TABLE ?? 'qulene-local-appointment-requests',
  waitlistEntries:     process.env.WAITLIST_ENTRIES_TABLE     ?? 'qulene-local-waitlist-entries',
};

const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    endpoint: ENDPOINT,
    region: 'us-east-1',
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  }),
);

// ─── Stable UUIDs (hardcoded so re-runs are idempotent) ───────────────────────

const IDS = {
  // Users
  bizUser1:    'b1000000-0000-0000-0000-000000000001',
  bizUser2:    'b2000000-0000-0000-0000-000000000002',
  custUser1:   'c1000000-0000-0000-0000-000000000001',

  // Services
  svc1: 's1000000-0000-0000-0000-000000000001', // Hair Cut
  svc2: 's2000000-0000-0000-0000-000000000002', // Hair Color
  svc3: 's3000000-0000-0000-0000-000000000003', // Personal Training
  svc4: 's4000000-0000-0000-0000-000000000004', // Nutrition Coaching

  // Availability windows
  win1: 'w1000000-0000-0000-0000-000000000001',
  win2: 'w2000000-0000-0000-0000-000000000002',
  win3: 'w3000000-0000-0000-0000-000000000003',
  win4: 'w4000000-0000-0000-0000-000000000004',
  win5: 'w5000000-0000-0000-0000-000000000005',
  win6: 'w6000000-0000-0000-0000-000000000006',

  // Appointment requests
  req1: 'r1000000-0000-0000-0000-000000000001', // PENDING
  req2: 'r2000000-0000-0000-0000-000000000002', // ACCEPTED
  req3: 'r3000000-0000-0000-0000-000000000003', // COMPLETED
  req4: 'r4000000-0000-0000-0000-000000000004', // DECLINED

  // Waitlist entries
  wl1: 'e1000000-0000-0000-0000-000000000001', // ACTIVE
  wl2: 'e2000000-0000-0000-0000-000000000002', // PROMOTED
};

const now = new Date().toISOString();
const past = (daysAgo: number) =>
  new Date(Date.now() - daysAgo * 86_400_000).toISOString();
const future = (daysAhead: number) =>
  new Date(Date.now() + daysAhead * 86_400_000).toISOString();

// ─── Seed helpers ─────────────────────────────────────────────────────────────

let created = 0;
let skipped = 0;

async function put(tableName: string, item: Record<string, unknown>, pkField: string): Promise<void> {
  try {
    await dynamo.send(
      new PutCommand({
        TableName: tableName,
        Item: item,
        ConditionExpression: `attribute_not_exists(${pkField})`,
      }),
    );
    created++;
  } catch (err: unknown) {
    const name = (err as { name?: string }).name;
    if (name === 'ConditionalCheckFailedException') {
      skipped++;
    } else {
      throw err;
    }
  }
}

// ─── Seed data ────────────────────────────────────────────────────────────────

async function seedUsers(): Promise<void> {
  await put(TABLES.users, {
    userId: IDS.bizUser1,
    email: 'salon@demo.qulene.com',
    firstName: 'Taylor',
    lastName: 'Brooks',
    role: 'BUSINESS',
    unreadNotificationCount: 2,
    createdAt: past(30),
    updatedAt: past(5),
  }, 'userId');

  await put(TABLES.users, {
    userId: IDS.bizUser2,
    email: 'fitness@demo.qulene.com',
    firstName: 'Jordan',
    lastName: 'Rivera',
    role: 'BUSINESS',
    unreadNotificationCount: 0,
    createdAt: past(25),
    updatedAt: past(2),
  }, 'userId');

  await put(TABLES.users, {
    userId: IDS.custUser1,
    email: 'customer@demo.qulene.com',
    firstName: 'Alex',
    lastName: 'Morgan',
    role: 'CUSTOMER',
    unreadNotificationCount: 1,
    createdAt: past(20),
    updatedAt: past(1),
  }, 'userId');
}

async function seedBusinessProfiles(): Promise<void> {
  await put(TABLES.businessProfiles, {
    businessId: IDS.bizUser1,
    businessName: 'Taylor\'s Salon',
    category: 'Beauty & Wellness',
    description: 'Premium hair care and styling in the heart of the city.',
    address: '123 Main St',
    city: 'Austin',
    state: 'TX',
    phone: '512-555-0101',
    avatarUrl: null,
    isActive: true,
    createdAt: past(30),
    updatedAt: past(5),
  }, 'businessId');

  await put(TABLES.businessProfiles, {
    businessId: IDS.bizUser2,
    businessName: 'Rivera Fitness',
    category: 'Health & Fitness',
    description: 'One-on-one personal training and nutrition coaching.',
    address: '456 Elm Ave',
    city: 'Austin',
    state: 'TX',
    phone: '512-555-0202',
    avatarUrl: null,
    isActive: true,
    createdAt: past(25),
    updatedAt: past(2),
  }, 'businessId');
}

async function seedServices(): Promise<void> {
  await put(TABLES.services, {
    serviceId: IDS.svc1,
    businessId: IDS.bizUser1,
    name: 'Hair Cut',
    description: 'Classic haircut — wash, cut, and style.',
    durationMinutes: 45,
    price: 55,
    status: 'ACTIVE',
    createdAt: past(28),
    updatedAt: past(28),
  }, 'serviceId');

  await put(TABLES.services, {
    serviceId: IDS.svc2,
    businessId: IDS.bizUser1,
    name: 'Hair Color',
    description: 'Full color treatment with premium dye.',
    durationMinutes: 120,
    price: 120,
    status: 'ACTIVE',
    createdAt: past(28),
    updatedAt: past(28),
  }, 'serviceId');

  await put(TABLES.services, {
    serviceId: IDS.svc3,
    businessId: IDS.bizUser2,
    name: 'Personal Training',
    description: '60-minute one-on-one strength and conditioning session.',
    durationMinutes: 60,
    price: 80,
    status: 'ACTIVE',
    createdAt: past(23),
    updatedAt: past(23),
  }, 'serviceId');

  await put(TABLES.services, {
    serviceId: IDS.svc4,
    businessId: IDS.bizUser2,
    name: 'Nutrition Coaching',
    description: 'Personalised macro and meal planning session.',
    durationMinutes: 45,
    price: 60,
    status: 'ACTIVE',
    createdAt: past(23),
    updatedAt: past(23),
  }, 'serviceId');
}

async function seedAvailabilityWindows(): Promise<void> {
  // Taylor's Salon — Mon, Wed, Fri 9 AM–5 PM
  await put(TABLES.availabilityWindows, {
    windowId: IDS.win1,
    businessId: IDS.bizUser1,
    dayOfWeek: 1, // Monday
    startTime: '09:00',
    endTime: '17:00',
    createdAt: past(27),
  }, 'windowId');

  await put(TABLES.availabilityWindows, {
    windowId: IDS.win2,
    businessId: IDS.bizUser1,
    dayOfWeek: 3, // Wednesday
    startTime: '09:00',
    endTime: '17:00',
    createdAt: past(27),
  }, 'windowId');

  await put(TABLES.availabilityWindows, {
    windowId: IDS.win3,
    businessId: IDS.bizUser1,
    dayOfWeek: 5, // Friday
    startTime: '09:00',
    endTime: '17:00',
    createdAt: past(27),
  }, 'windowId');

  // Rivera Fitness — Tue, Thu 7 AM–7 PM, Sat 8 AM–2 PM
  await put(TABLES.availabilityWindows, {
    windowId: IDS.win4,
    businessId: IDS.bizUser2,
    dayOfWeek: 2, // Tuesday
    startTime: '07:00',
    endTime: '19:00',
    createdAt: past(22),
  }, 'windowId');

  await put(TABLES.availabilityWindows, {
    windowId: IDS.win5,
    businessId: IDS.bizUser2,
    dayOfWeek: 4, // Thursday
    startTime: '07:00',
    endTime: '19:00',
    createdAt: past(22),
  }, 'windowId');

  await put(TABLES.availabilityWindows, {
    windowId: IDS.win6,
    businessId: IDS.bizUser2,
    dayOfWeek: 6, // Saturday
    startTime: '08:00',
    endTime: '14:00',
    createdAt: past(22),
  }, 'windowId');
}

async function seedAppointmentRequests(): Promise<void> {
  // PENDING — customer wants a haircut next week
  await put(TABLES.appointmentRequests, {
    requestId: IDS.req1,
    customerId: IDS.custUser1,
    businessId: IDS.bizUser1,
    serviceId: IDS.svc1,
    proposedAt: future(7),
    notes: 'Please keep it short on the sides.',
    status: 'PENDING',
    idempotencyKey: 'idem-req1-00000000-0000-0000-0000-000000000001',
    createdAt: past(2),
    updatedAt: past(2),
  }, 'requestId');

  // ACCEPTED — training session this Friday
  await put(TABLES.appointmentRequests, {
    requestId: IDS.req2,
    customerId: IDS.custUser1,
    businessId: IDS.bizUser2,
    serviceId: IDS.svc3,
    proposedAt: future(3),
    notes: null,
    status: 'ACCEPTED',
    idempotencyKey: 'idem-req2-00000000-0000-0000-0000-000000000002',
    createdAt: past(5),
    updatedAt: past(4),
  }, 'requestId');

  // COMPLETED — hair color from last month
  await put(TABLES.appointmentRequests, {
    requestId: IDS.req3,
    customerId: IDS.custUser1,
    businessId: IDS.bizUser1,
    serviceId: IDS.svc2,
    proposedAt: past(14),
    notes: null,
    status: 'COMPLETED',
    idempotencyKey: 'idem-req3-00000000-0000-0000-0000-000000000003',
    createdAt: past(21),
    updatedAt: past(14),
  }, 'requestId');

  // DECLINED — couldn't fit in
  await put(TABLES.appointmentRequests, {
    requestId: IDS.req4,
    customerId: IDS.custUser1,
    businessId: IDS.bizUser2,
    serviceId: IDS.svc4,
    proposedAt: past(7),
    notes: 'Flexible on time.',
    status: 'DECLINED',
    idempotencyKey: 'idem-req4-00000000-0000-0000-0000-000000000004',
    createdAt: past(10),
    updatedAt: past(7),
  }, 'requestId');
}

async function seedWaitlistEntries(): Promise<void> {
  // ACTIVE — customer on hair color waitlist
  await put(TABLES.waitlistEntries, {
    entryId: IDS.wl1,
    customerId: IDS.custUser1,
    serviceId: IDS.svc2,
    businessId: IDS.bizUser1,
    status: 'ACTIVE',
    createdAt: past(3),
    updatedAt: past(3),
  }, 'entryId');

  // PROMOTED — customer was promoted off personal training waitlist
  await put(TABLES.waitlistEntries, {
    entryId: IDS.wl2,
    customerId: IDS.custUser1,
    serviceId: IDS.svc3,
    businessId: IDS.bizUser2,
    status: 'PROMOTED',
    createdAt: past(8),
    updatedAt: past(5),
  }, 'entryId');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`\nSeeding MiniStack at ${ENDPOINT} (env=${ENV})\n`);

  await seedUsers();
  await seedBusinessProfiles();
  await seedServices();
  await seedAvailabilityWindows();
  await seedAppointmentRequests();
  await seedWaitlistEntries();

  const total = created + skipped;
  console.log(`Done — ${total} records total: ${created} created, ${skipped} already existed\n`);

  console.log('─────────────────────────────────────────────');
  console.log('Demo credentials (register these in the app):');
  console.log('─────────────────────────────────────────────');
  console.log('Business 1 — Taylor\'s Salon');
  console.log('  Email:    salon@demo.qulene.com');
  console.log('  Password: Demo1234!');
  console.log('');
  console.log('Business 2 — Rivera Fitness');
  console.log('  Email:    fitness@demo.qulene.com');
  console.log('  Password: Demo1234!');
  console.log('');
  console.log('Customer — Alex Morgan');
  console.log('  Email:    customer@demo.qulene.com');
  console.log('  Password: Demo1234!');
  console.log('─────────────────────────────────────────────\n');
  console.log('NOTE: Register each account in the app first.');
  console.log('The seed script writes DynamoDB records only;');
  console.log('Cognito users must be created via registration.\n');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
