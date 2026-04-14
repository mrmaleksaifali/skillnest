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

function getTokenFromStorage(): string | null {
  if (typeof window === 'undefined') return null;
  // Amplify v6 stores tokens in localStorage with this key pattern
  const clientId = '797pd77i4irdf3oavq17glgvr0';
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.includes(clientId) && key.includes('idToken')) {
      return localStorage.getItem(key);
    }
  }
  return null;
}

export async function getAuthToken(): Promise<string> {
  try {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    if (token) return token;
  } catch {}
  // Fallback: read directly from localStorage
  const token = getTokenFromStorage();
  if (token) return token;
  throw new Error('No token');
}

export async function getAuthSub(): Promise<string> {
  try {
    const session = await fetchAuthSession();
    const sub = session.tokens?.idToken?.payload?.sub as string;
    if (sub) return sub;
  } catch {}
  throw new Error('No sub');
}

export async function requireAuth(router: any, redirect = '/login'): Promise<string> {
  try {
    await getCurrentUser();
    return await getAuthToken();
  } catch {
    // Try localStorage fallback
    const token = getTokenFromStorage();
    if (token) return token;
    router.push(redirect);
    throw new Error('Not authenticated');
  }
}
