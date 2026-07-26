import { LocalizedText as Text } from '@/components/Language/LocalizedPrimitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import type React from 'react';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  TouchableOpacity,
  View,
} from 'react-native';

// The official SDK currently publishes TypeScript source with strict-mode
// errors. Runtime loading keeps application type-checks isolated from it.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DefaultWidget } = require('@msg91comm/sendotp-react-native') as {
  DefaultWidget: React.ComponentType<any>;
};

type VerificationResult = {
  success: boolean;
  identifier?: string;
  message?: string;
};

export default function PhoneLoginScreen() {
  const router = useRouter();
  const baseUrl = Constants.expoConfig?.extra?.BASE_URL as string | undefined;
  const widgetId = Constants.expoConfig?.extra?.MSG91_WIDGET_ID as string | undefined;
  const tokenAuth = Constants.expoConfig?.extra?.MSG91_TOKEN_AUTH as string | undefined;
  const [showWidget, setShowWidget] = useState(false);
  const [busy, setBusy] = useState(false);

  const finishLogin = async (result: VerificationResult) => {
    if (!result.success || !result.identifier || !result.message) {
      if (result.message) Alert.alert('Verification failed', result.message);
      return;
    }
    if (!baseUrl) {
      Alert.alert('Configuration missing', 'App API address is not configured.');
      return;
    }

    setShowWidget(false);
    try {
      setBusy(true);
      const response = await fetch(`${baseUrl}/api/user/otp-login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile: result.identifier,
          access_token: result.message,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Could not complete login.');

      await Promise.all([
        SecureStore.setItemAsync('authToken', data.token),
        SecureStore.setItemAsync('userType', 'user'),
        SecureStore.setItemAsync('userId', String(data.user_id)),
      ]);
      router.replace((data.needs_name ? '/onboarding/complete-profile' : '/(tabs)') as any);
    } catch (error: any) {
      Alert.alert('Login failed', error?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const openVerification = () => {
    if (!widgetId || !tokenAuth) {
      Alert.alert('OTP unavailable', 'MSG91 widget configuration is missing.');
      return;
    }
    setShowWidget(true);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <LinearGradient colors={['#ecfdf5', '#ffffff', '#eff6ff']} className="flex-1 px-6">
        <TouchableOpacity
          onPress={() => router.replace('/onboarding' as any)}
          disabled={busy || showWidget}
          accessibilityRole="button"
          accessibilityLabel="Back to account type selection"
          className={`mt-3 h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white ${
            busy || showWidget ? 'opacity-40' : ''
          }`}
        >
          <MaterialCommunityIcons name="arrow-left" size={23} color="#334155" />
        </TouchableOpacity>

        <View className="flex-1 justify-center">
          <View className="mb-8 h-20 w-20 items-center justify-center rounded-[28px] bg-emerald-600">
            <MaterialCommunityIcons name="cellphone-check" size={42} color="white" />
          </View>
          <Text className="text-4xl font-black leading-[46px] text-slate-950">
            Continue with phone
          </Text>
          <Text className="mt-4 text-base font-medium leading-6 text-slate-500">
            We will try automatic verification first. If it is unavailable, enter the OTP sent to your phone.
          </Text>

          <View className="mt-10 rounded-[28px] border border-emerald-100 bg-white p-5">
            <View className="flex-row items-center">
              <View className="h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50">
                <MaterialCommunityIcons name="shield-check-outline" size={26} color="#059669" />
              </View>
              <View className="ml-4 flex-1">
                <Text className="font-black text-slate-900">Fast and secure login</Text>
                <Text className="mt-1 text-xs font-semibold text-slate-500">
                  Automatic when supported, with reliable OTP fallback.
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            disabled={busy}
            onPress={openVerification}
            className="mt-6 flex-row items-center justify-center rounded-2xl bg-emerald-600 py-5"
          >
            {busy ? <ActivityIndicator color="white" /> : (
              <>
                <Text className="text-base font-black text-white">Continue</Text>
                <MaterialCommunityIcons name="arrow-right" size={21} color="white" style={{ marginLeft: 8 }} />
              </>
            )}
          </TouchableOpacity>
        </View>

        {widgetId && tokenAuth ? (
          <DefaultWidget
            visible={showWidget}
            onClose={() => setShowWidget(false)}
            onCompletion={finishLogin}
            widgetId={widgetId}
            tokenAuth={tokenAuth}
            defaultVerificationType="mobile"
            theme="light"
            primaryColor="#059669"
            autoFocus
          />
        ) : null}
      </LinearGradient>
    </SafeAreaView>
  );
}
