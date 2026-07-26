import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/Language/LocalizedPrimitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  getHash,
  removeListener,
  startOtpListener,
} from 'react-native-otp-verify';

// The official MSG91 package currently publishes strict-mode TypeScript source.
// Runtime loading keeps application type-checks isolated from vendor source.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { OTPWidget } = require('@msg91comm/sendotp-react-native') as {
  OTPWidget: {
    initializeWidget: (widgetId: string, tokenAuth: string) => Promise<void>;
    sendOTP: (body: { identifier: string }) => Promise<Msg91Response>;
    verifyOTP: (body: { reqId: string; otp: string }) => Promise<Msg91Response>;
    retryOTP: (body: { reqId: string; retryChannel: number }) => Promise<Msg91Response>;
  };
};

type Msg91Response = {
  type?: string;
  message?: string;
  reqId?: string;
  invisibleVerified?: boolean;
  'access-token'?: string;
};

type Stage = 'phone' | 'sending' | 'waiting' | 'verifying';
type RetryChannel = 11 | 12 | 4;

const ONE_TAP_URL = 'https://control.msg91.com/api/v5/widget/isOneTapAuthenticated';

export default function ArchivedAutomaticPhoneLoginScreen() {
  const router = useRouter();
  const baseUrl = Constants.expoConfig?.extra?.BASE_URL as string | undefined;
  const widgetId = Constants.expoConfig?.extra?.MSG91_WIDGET_ID as string | undefined;
  const tokenAuth = Constants.expoConfig?.extra?.MSG91_TOKEN_AUTH as string | undefined;
  const [mobile, setMobile] = useState('');
  const [stage, setStage] = useState<Stage>('phone');
  const [statusText, setStatusText] = useState('We will verify your number automatically.');
  const [retryBusy, setRetryBusy] = useState<RetryChannel | null>(null);
  const requestIdRef = useRef<string | null>(null);
  const identifierRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const verifyingRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const stopAutoCapture = useCallback(() => {
    stopPolling();
    if (Platform.OS === 'android') removeListener();
  }, [stopPolling]);

  useEffect(() => {
    mountedRef.current = true;
    if (widgetId && tokenAuth) OTPWidget.initializeWidget(widgetId, tokenAuth);
    if (Platform.OS === 'android') {
      getHash()
        .then((hashes) => console.info('[AARX OTP] Android SMS Retriever app hash:', hashes[0]))
        .catch(() => undefined);
    }
    return () => {
      mountedRef.current = false;
      stopAutoCapture();
    };
  }, [stopAutoCapture, tokenAuth, widgetId]);

  const finishAarxLogin = useCallback(async (identifier: string, accessToken: string) => {
    if (!baseUrl) throw new Error('App API address is not configured.');
    setStage('verifying');
    setStatusText('Phone verified. Signing you in…');
    stopAutoCapture();

    const response = await fetch(`${baseUrl}/api/user/otp-login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile: identifier, access_token: accessToken }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || 'Could not complete login.');

    await Promise.all([
      SecureStore.setItemAsync('authToken', data.token),
      SecureStore.setItemAsync('userType', 'user'),
      SecureStore.setItemAsync('userId', String(data.user_id)),
    ]);
    router.replace((data.needs_name ? '/onboarding/complete-profile' : '/(tabs)') as any);
  }, [baseUrl, router, stopAutoCapture]);

  const completeWithToken = useCallback(async (accessToken?: string) => {
    const identifier = identifierRef.current;
    if (!identifier || !accessToken || verifyingRef.current) return;
    verifyingRef.current = true;
    try {
      await finishAarxLogin(identifier, accessToken);
    } catch (error: any) {
      verifyingRef.current = false;
      if (!mountedRef.current) return;
      setStage('waiting');
      setStatusText(error?.message || 'Automatic verification failed. Please retry.');
      Alert.alert('Login failed', error?.message || 'Please try again.');
    }
  }, [finishAarxLogin]);

  const verifyCapturedOtp = useCallback(async (otp: string) => {
    const reqId = requestIdRef.current;
    if (!reqId || verifyingRef.current) return;
    verifyingRef.current = true;
    setStage('verifying');
    setStatusText('OTP received. Verifying automatically…');
    try {
      const response = await OTPWidget.verifyOTP({ reqId, otp });
      if (response?.type !== 'success') {
        throw new Error(response?.message || 'OTP verification failed.');
      }
      verifyingRef.current = false;
      await completeWithToken(response['access-token'] || response.message);
    } catch (error: any) {
      verifyingRef.current = false;
      if (!mountedRef.current) return;
      setStage('waiting');
      setStatusText(error?.message || 'Could not verify automatically. Request a new OTP.');
    }
  }, [completeWithToken]);

  const startSmsCapture = useCallback(() => {
    if (Platform.OS !== 'android') return;
    removeListener();
    startOtpListener((message: string) => {
      const otp = message.match(/\b\d{4,8}\b/)?.[0];
      if (otp) verifyCapturedOtp(otp);
    }).catch(() => {
      if (mountedRef.current) {
        setStatusText('Automatic SMS capture unavailable. Try Invisible OTP or another channel.');
      }
    });
  }, [verifyCapturedOtp]);

  const startOneTapPolling = useCallback((reqId: string) => {
    stopPolling();
    const poll = async () => {
      try {
        const response = await fetch(ONE_TAP_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestId: reqId, tokenAuth }),
        });
        const data = await response.json();
        if (data?.type === 'success' && data?.verified === true) {
          stopPolling();
          await completeWithToken(data.message || data['access-token']);
        }
      } catch {
        // A transient polling failure must not cancel SMS auto-capture.
      }
    };
    pollRef.current = setInterval(poll, 2000);
    poll();
  }, [completeWithToken, stopPolling, tokenAuth]);

  const sendOtp = async () => {
    const digits = mobile.replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(digits)) {
      Alert.alert('Mobile number', 'Enter a valid 10-digit Indian mobile number.');
      return;
    }
    if (!widgetId || !tokenAuth) {
      Alert.alert('OTP unavailable', 'MSG91 widget configuration is missing.');
      return;
    }

    const identifier = `91${digits}`;
    identifierRef.current = identifier;
    verifyingRef.current = false;
    setStage('sending');
    setStatusText('Starting secure automatic verification…');
    startSmsCapture();

    try {
      await OTPWidget.initializeWidget(widgetId, tokenAuth);
      const response = await OTPWidget.sendOTP({ identifier });
      if (response?.type !== 'success') throw new Error(response?.message || 'Could not send OTP.');

      if (response.invisibleVerified || response['access-token']) {
        await completeWithToken(response['access-token'] || response.message);
        return;
      }

      const reqId = response.reqId || response.message;
      if (!reqId) throw new Error('MSG91 did not return a verification request ID.');
      requestIdRef.current = reqId;
      setStage('waiting');
      setStatusText('OTP sent. Waiting to detect and verify it automatically…');
      startOneTapPolling(reqId);
    } catch (error: any) {
      stopAutoCapture();
      setStage('phone');
      setStatusText('We will verify your number automatically.');
      Alert.alert('Could not start verification', error?.message || 'Please try again.');
    }
  };

  const retry = async (channel: RetryChannel) => {
    const reqId = requestIdRef.current;
    if (!reqId) return;
    setRetryBusy(channel);
    setStatusText(
      channel === 12
        ? 'Requesting OTP on WhatsApp…'
        : channel === 4
          ? 'Requesting OTP by voice call…'
          : 'Resending SMS OTP…',
    );
    startSmsCapture();
    try {
      const response = await OTPWidget.retryOTP({ reqId, retryChannel: channel });
      if (response?.type !== 'success') throw new Error(response?.message || 'Retry failed.');
      if (response.reqId) requestIdRef.current = response.reqId;
      setStatusText('Waiting for automatic verification…');
    } catch (error: any) {
      setStatusText(error?.message || 'Could not retry this channel.');
    } finally {
      setRetryBusy(null);
    }
  };

  const goBack = () => {
    stopAutoCapture();
    if (stage === 'phone') {
      router.replace('/onboarding' as any);
      return;
    }
    requestIdRef.current = null;
    identifierRef.current = null;
    verifyingRef.current = false;
    setMobile('');
    setStage('phone');
    setStatusText('We will verify your number automatically.');
  };

  const waiting = stage !== 'phone';

  return (
    <SafeAreaView className="flex-1 bg-white">
      <LinearGradient colors={['#ecfdf5', '#ffffff', '#eff6ff']} className="flex-1 px-6">
        <TouchableOpacity
          onPress={goBack}
          disabled={stage === 'verifying'}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          className={`mt-3 h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white ${
            stage === 'verifying' ? 'opacity-40' : ''
          }`}
        >
          <MaterialCommunityIcons name="arrow-left" size={23} color="#334155" />
        </TouchableOpacity>

        <View className="flex-1 justify-center">
          <View className="mb-8 h-20 w-20 items-center justify-center rounded-[28px] bg-emerald-600">
            {waiting ? <ActivityIndicator size="large" color="white" /> : (
              <MaterialCommunityIcons name="cellphone-check" size={42} color="white" />
            )}
          </View>
          <Text className="text-4xl font-black leading-[46px] text-slate-950">
            {waiting ? 'Verifying automatically' : 'Continue with phone'}
          </Text>
          <Text className="mt-4 text-base font-medium leading-6 text-slate-500">
            {statusText}
          </Text>

          {!waiting ? (
            <>
              <View className="mt-9 flex-row items-center rounded-2xl border border-slate-200 bg-white px-5">
                <Text className="border-r border-slate-200 pr-4 text-base font-black text-slate-700">+91</Text>
                <TextInput
                  value={mobile}
                  onChangeText={(value) => setMobile(value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit mobile number"
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  maxLength={10}
                  className="flex-1 px-4 py-5 text-base font-bold text-slate-900"
                />
              </View>
              <TouchableOpacity
                onPress={sendOtp}
                className={`mt-5 flex-row items-center justify-center rounded-2xl py-5 ${
                  mobile.length === 10 ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
              >
                <Text className="text-base font-black text-white">Verify automatically</Text>
                <MaterialCommunityIcons name="arrow-right" size={21} color="white" style={{ marginLeft: 8 }} />
              </TouchableOpacity>
            </>
          ) : (
            <View className="mt-9 rounded-[28px] border border-emerald-100 bg-white p-5">
              <View className="flex-row items-center">
                <ActivityIndicator color="#059669" />
                <Text className="ml-3 flex-1 font-black text-slate-800">
                  Keep this screen open. No code entry is needed.
                </Text>
              </View>

              {stage === 'waiting' ? (
                <>
                  <Text className="mt-6 text-xs font-black uppercase tracking-wider text-slate-400">
                    Didn&apos;t receive it?
                  </Text>
                  <View className="mt-3 flex-row gap-2">
                    {([
                      [11, 'message-text-outline', 'SMS'],
                      [12, 'whatsapp', 'WhatsApp'],
                      [4, 'phone-outline', 'Call'],
                    ] as const).map(([channel, icon, label]) => (
                      <TouchableOpacity
                        key={channel}
                        onPress={() => retry(channel)}
                        disabled={retryBusy !== null}
                        className="flex-1 items-center rounded-2xl bg-slate-100 px-2 py-4"
                      >
                        {retryBusy === channel ? <ActivityIndicator size="small" color="#059669" /> : (
                          <MaterialCommunityIcons name={icon} size={21} color="#059669" />
                        )}
                        <Text className="mt-2 text-[10px] font-black text-slate-700">{label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              ) : null}
            </View>
          )}

          <Text className="mt-5 text-center text-[11px] font-semibold leading-5 text-slate-400">
            Secure verification by MSG91. We never request SMS inbox permission.
          </Text>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}
