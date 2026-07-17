import { useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { registerForPushNotificationsAsync } from '../components/NotificationSetup';

/**
 * Hook to initialize and register push notifications.
 * It fetches the Expo Push Token and sends it to the backend if the user is logged in.
 */
export const usePushNotifications = () => {
  const BASE_URL = Constants.expoConfig?.extra?.BASE_URL;

  const registerTokenWithBackend = async () => {
    try {
      const token = await registerForPushNotificationsAsync();
      if (!token) {
        console.log("No push token received.");
        return;
      }

      const authToken = await SecureStore.getItemAsync('authToken');
      const userType = await SecureStore.getItemAsync('userType');

      if (authToken && userType) {
        console.log(`Registering token for ${userType}...`);

        // Match userType with backend expected endpoints
        // Note: backend uses 'store' and 'user' in SecureStore (from login.tsx)
        const endpoint = userType === 'store'
          ? `${BASE_URL}/api/save-expo-token/`
          : `${BASE_URL}/api/user-save-expo-token/`;

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({ expo_push_token: token }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.warn('Failed to save push token to backend:', errorText);
        } else {
          console.log('Push token saved to backend successfully');
        }
      } else {
        console.log("User not logged in, skipping token registration.");
      }
    } catch (error) {
      console.error('Error in registerTokenWithBackend:', error);
    }
  };

  useEffect(() => {
    registerTokenWithBackend();
  }, []);

  return { registerTokenWithBackend };
};
