import React, { useEffect } from 'react';
import { View, StyleSheet, Platform, Text } from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';
import Toast from 'react-native-toast-message';

export function SecurityGuard({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let subscription: ScreenCapture.Subscription | null = null;

    async function enableScreenProtection() {
      try {
        // Read flag from .env: set EXPO_PUBLIC_BLOCK_SCREENSHOTS=false to ALLOW screenshots in dev mode
        const envVal = process.env.EXPO_PUBLIC_BLOCK_SCREENSHOTS;
        const shouldBlock = envVal === undefined || envVal === '' || envVal.toLowerCase() === 'true';

        if (shouldBlock) {
          if (typeof ScreenCapture.preventScreenCaptureAsync === 'function') {
            await ScreenCapture.preventScreenCaptureAsync('AARX_SECURITY_SHIELD').catch(() => {});
          }

          if (typeof ScreenCapture.addScreenshotListener === 'function') {
            subscription = ScreenCapture.addScreenshotListener(() => {
              Toast.show({
                type: 'error',
                text1: 'Security Alert 🛡️',
                text2: 'Screenshots & Screen Recording are strictly blocked to protect patient privacy.',
                visibilityTime: 4000,
              });
            });
          }
        } else {
          // Explicitly allow screenshots when EXPO_PUBLIC_BLOCK_SCREENSHOTS=false in .env
          if (typeof ScreenCapture.allowScreenCaptureAsync === 'function') {
            await ScreenCapture.allowScreenCaptureAsync().catch(() => {});
          }
        }
      } catch (err) {
        console.warn('Screen capture protection skipped:', err);
      }
    }

    enableScreenProtection();

    return () => {
      if (subscription && typeof subscription.remove === 'function') {
        subscription.remove();
      }
    };
  }, []);

  return (
    <View style={styles.secureContainer}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  secureContainer: {
    flex: 1,
    // Anti-text selection / anti-copying for web & desktop fallbacks
    ...Platform.select({
      web: {
        userSelect: 'none',
        WebkitUserSelect: 'none',
        msUserSelect: 'none',
      } as any,
    }),
  },
});
