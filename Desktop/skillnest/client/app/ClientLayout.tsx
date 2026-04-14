'use client';

import { Amplify } from 'aws-amplify';
import Navbar from './components/Navbar';
import { usePathname } from 'next/navigation';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: 'ap-south-1_TCheqKNUA',
      userPoolClientId: '797pd77i4irdf3oavq17glgvr0',
      loginWith: { email: true },
    }
  }
});

const authPages = ['/login', '/signup'];

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showNavbar = !authPages.includes(pathname);

  return (
    <>
      {showNavbar && <Navbar />}
      {children}
    </>
  );
}
