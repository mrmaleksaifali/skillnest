import { Amplify } from 'aws-amplify';
import { fetchAuthSession, getCurrentUser, signOut } from '@aws-amplify/auth';

const COGNITO_CONFIG = {
  Auth: {
    Cognito: {
      userPoolId: 'ap-south-1_TCheqKNUA',
      userPoolClientId: '797pd77i4irdf3oavq17glgvr0',
      loginWith: { email: true },
    }
  }
};

// Configure once
try { Amplify.configure(COGNITO_CONFIG); } catch {}

export async function getAuthToken(): Promise<string> {
  // Try Amplify session first
  try {
    const session = await fetchAuthSession({ forceRefresh: false });
    const token = session.tokens?.idToken?.toString();
    if (token) return token;
  } catch {}

  // Fallback: scan localStorage for Cognito token
  if (typeof window !== 'undefined') {
    const clientId = '797pd77i4irdf3oavq17glgvr0';
    // Key format: CognitoIdentityServiceProvider.{clientId}.{email}.idToken
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) || '';
      if (key.startsWith(`CognitoIdentityServiceProvider.${clientId}`) && key.endsWith('.idToken')) {
        const val = localStorage.getItem(key);
        if (val) return val;
      }
    }
  }
  throw new Error('No token');
}

export async function getAuthSub(): Promise<string> {
  try {
    const session = await fetchAuthSession({ forceRefresh: false });
    const sub = session.tokens?.idToken?.payload?.sub as string;
    if (sub) return sub;
  } catch {}

  // Parse from token
  try {
    const token = await getAuthToken();
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub;
  } catch {}
  throw new Error('No sub');
}

export async function requireAuth(router: any, redirect = '/login'): Promise<string> {
  try {
    const token = await getAuthToken();
    return token;
  } catch {
    try { await getCurrentUser(); } catch {
      router.push(redirect);
      throw new Error('Not authenticated');
    }
    router.push(redirect);
    throw new Error('Not authenticated');
  }
}
