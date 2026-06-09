import { Amplify } from 'aws-amplify';
import {
  signUp as amplifySignUp,
  confirmSignUp as amplifyConfirmSignUp,
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
        'custom:role': params.role,
      },
    },
  });
}

export async function cognitoConfirmSignUp(email: string, code: string): Promise<void> {
  await amplifyConfirmSignUp({ username: email, confirmationCode: code });
}

export async function cognitoSignIn(email: string, password: string): Promise<SignInOutput> {
  try {
    return await amplifySignIn({
      username: email,
      password,
      options: { authFlowType: 'USER_PASSWORD_AUTH' },
    });
  } catch (err) {
    // Amplify keeps an internal signed-in state even when our session is null.
    // Sign out to clear it, then retry so we get a fresh session.
    if (err instanceof Error && err.name === 'UserAlreadyAuthenticatedException') {
      await amplifySignOut();
      return amplifySignIn({
        username: email,
        password,
        options: { authFlowType: 'USER_PASSWORD_AUTH' },
      });
    }
    throw err;
  }
}

export async function cognitoSignOut(): Promise<void> {
  await amplifySignOut();
}

function extractSession(session: Awaited<ReturnType<typeof fetchAuthSession>>) {
  const token = session.tokens?.accessToken;
  if (!token) return null;
  const userId = token.payload?.sub as string | undefined;
  if (!userId) return null;
  const role = (session.tokens?.idToken?.payload?.['custom:role'] as string | undefined) as UserRole | null ?? null;
  return { accessToken: token.toString(), userId, role };
}

export async function getCurrentSession(): Promise<{ accessToken: string; userId: string; role: UserRole | null } | null> {
  try {
    const first = extractSession(await fetchAuthSession());
    if (first) return first;
    // The React Native SecureStore adapter writes tokens asynchronously after
    // signIn. The in-memory cache gets cleared by signOut, so a fetchAuthSession
    // called immediately after signIn may find nothing. Wait briefly for the
    // async write to settle, then retry before giving up.
    await new Promise<void>((r) => setTimeout(r, 500));
    return extractSession(await fetchAuthSession());
  } catch {
    return null;
  }
}
