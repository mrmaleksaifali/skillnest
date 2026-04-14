import { Amplify } from 'aws-amplify';
import { fetchAuthSession, getCurrentUser } from '@aws-amplify/auth';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: 'ap-south-1_TCheqKNUA',
      userPoolClientId: '797pd77i4irdf3oavq17glgvr0',
      loginWith: { email: true },
    }
  }
});

export async function getAuthToken(): Promise<string> {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();
  if (!token) throw new Error('No token');
  return token;
}

export async function getAuthSub(): Promise<string> {
  const session = await fetchAuthSession();
  const sub = session.tokens?.idToken?.payload?.sub as string;
  if (!sub) throw new Error('No sub');
  return sub;
}

export async function requireAuth(router: any, redirect = '/login'): Promise<string> {
  try {
    await getCurrentUser();
    return await getAuthToken();
  } catch {
    router.push(redirect);
    throw new Error('Not authenticated');
  }
}
