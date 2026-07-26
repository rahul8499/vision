import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    (async () => {
      const [token, userType, deliveryToken] = await Promise.all([
        SecureStore.getItemAsync('authToken'),
        SecureStore.getItemAsync('userType'),
        SecureStore.getItemAsync('deliveryAuthToken'),
      ]);
      if (!active) return;
      if (token && userType === 'user') {
        router.replace('/(tabs)' as any);
      } else if (token && userType === 'store') {
        router.replace('/(sellerTabs)/home' as any);
      } else if (deliveryToken) {
        router.replace('/delivery' as any);
      } else {
        router.replace('/onboarding' as any);
      }
    })();
    return () => { active = false; };
  }, [router]);

  return null;
}
