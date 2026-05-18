import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import type { UserRole, ParsedClaims } from '../types/index.js';

export type { ParsedClaims };

export function extractClaims(event: APIGatewayProxyEventV2): {
  userId: string | undefined;
  role: string | undefined;
  email: string | undefined;
} {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JWT authorizer not typed on APIGatewayEventRequestContextV2
  const raw = ((event.requestContext as any)?.authorizer?.jwt?.claims ?? {}) as Record<string, string>;
  return {
    userId: raw['sub'] || undefined,
    role: raw['custom:role'] || undefined,
    email: raw['email'] || undefined,
  };
}

export function requireRole(
  claims: ParsedClaims,
  expectedRole: UserRole,
): { statusCode: 403; body: string } | null {
  if (claims.role !== expectedRole) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: { code: 'FORBIDDEN', message: `Requires ${expectedRole} role` } }),
    };
  }
  return null;
}
