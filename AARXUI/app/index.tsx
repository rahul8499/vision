import { useRouter } from 'expo-router';
import { useEffect } from 'react';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    const timeout = setTimeout(() => {
      router.replace('/onboarding');
    }, 50); // Give time for RootLayout to mount

    return () => clearTimeout(timeout);
  }, []);

  return null;
}
