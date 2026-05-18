import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.ts', 'tests/**/*.test.ts'],
    env: {
      AWS_REGION: 'us-east-1',
      AWS_ACCESS_KEY_ID: 'test',
      AWS_SECRET_ACCESS_KEY: 'test',
      DYNAMODB_ENDPOINT: 'http://localhost:4566',
      SNS_ENDPOINT: 'http://localhost:4566',
      USERS_TABLE: 'qulene-local-users',
      BUSINESS_PROFILES_TABLE: 'qulene-local-business-profiles',
      SERVICES_TABLE: 'qulene-local-services',
      AVAILABILITY_WINDOWS_TABLE: 'qulene-local-availability-windows',
      APPOINTMENT_REQUESTS_TABLE: 'qulene-local-appointment-requests',
      NOTIFICATIONS_TABLE: 'qulene-local-notifications',
      SNS_TOPIC_ARN: 'arn:aws:sns:us-east-1:000000000000:qulene-local-events',
    },
  },
});
