import { Amplify } from 'aws-amplify';
import {
  signUp as amplifySignUp,
  signIn as amplifySignIn,
  signOut as amplifySignOut,
  fetchAuthSession,
  type SignUpOutput,
  type SignInOutput,
} from 'aws-amplify/auth';
import type { UserRole } from '@qulene/api-types';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: process.env.EXPO_PUBLIC_COGNITO_USER_POOL_ID!,
      userPoolClientId: process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID!,
    },
  },
});

export interface SignUpParams {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export async function cognitoSignUp(params: SignUpParams): Promise<SignUpOutput> {
  return amplifySignUp({
    username: params.email,
    password: params.password,
    options: {
      userAttributes: {
        email: params.email,
        given_name: params.firstName,
        family_name: params.lastName,
        'custom:role': params.role,
      },
    },
  });
}

export async function cognitoSignIn(email: string, password: string): Promise<SignInOutput> {
  return amplifySignIn({ username: email, password });
}

export async function cognitoSignOut(): Promise<void> {
  await amplifySignOut();
}

export async function getCurrentSession(): Promise<{ accessToken: string; userId: string; role: UserRole | null } | null> {
  try {
    const session = await fetchAuthSession();
    const token = session.tokens?.accessToken;
    if (!token) return null;
    const userId = token.payload?.sub as string | undefined;
    if (!userId) return null;
    const role = (session.tokens?.idToken?.payload?.['custom:role'] as string | undefined) as UserRole | null ?? null;
    return { accessToken: token.toString(), userId, role };
  } catch {
    return null;
  }
}
