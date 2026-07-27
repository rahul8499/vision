import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/Language/LocalizedPrimitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

// Runtime loading keeps app type-checks isolated from vendor TypeScript.
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
  'access-token'?: string;
};

type Step = 'phone' | 'otp';

export default function PhoneLoginScreen() {
  const router = useRouter();
  const baseUrl = Constants.expoConfig?.extra?.BASE_URL as string | undefined;
  const widgetId = Constants.expoConfig?.extra?.MSG91_WIDGET_ID as string | undefined;
  const tokenAuth = Constants.expoConfig?.extra?.MSG91_TOKEN_AUTH as string | undefined;
  const [step, setStep] = useState<Step>('phone');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [requestId, setRequestId] = useState('');
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const otpRef = useRef<any>(null);

  const validMobile = /^[6-9]\d{9}$/.test(mobile);
  const validOtp = /^\d{4,8}$/.test(otp);

  useEffect(() => {
    if (!resendIn) return;
    const timer = setInterval(() => setResendIn((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendIn]);

  const completeLogin = async (accessToken: string) => {
    if (!baseUrl) throw new Error('App API address is not configured.');
    const response = await fetch(`${baseUrl}/api/user/otp-login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile: `91${mobile}`, access_token: accessToken }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || 'Could not complete login.');

    await Promise.all([
      SecureStore.setItemAsync('authToken', data.token),
      SecureStore.setItemAsync('userType', 'user'),
      SecureStore.setItemAsync('userId', String(data.user_id)),
    ]);
    router.replace((data.needs_name ? '/onboarding/complete-profile' : '/(tabs)') as any);
  };

  const sendOtp = async () => {
    if (!validMobile || busy) return;
    if (!widgetId || !tokenAuth) {
      Alert.alert('OTP unavailable', 'MSG91 widget configuration is missing.');
      return;
    }
    Keyboard.dismiss();
    setBusy(true);
    try {
      await OTPWidget.initializeWidget(widgetId, tokenAuth);
      const response = await OTPWidget.sendOTP({ identifier: `91${mobile}` });
      if (response.type !== 'success') throw new Error(response.message || 'Could not send OTP.');
      const id = response.reqId || response.message;
      if (!id) throw new Error('Verification request could not be created.');
      setRequestId(id);
      setOtp('');
      setStep('otp');
      setResendIn(30);
      setTimeout(() => otpRef.current?.focus(), 350);
    } catch (error: any) {
      Alert.alert('Could not send OTP', error?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    if (!validOtp || !requestId || busy) return;
    Keyboard.dismiss();
    setBusy(true);
    try {
      const response = await OTPWidget.verifyOTP({ reqId: requestId, otp });
      if (response.type !== 'success') throw new Error(response.message || 'The OTP is incorrect.');
      const accessToken = response['access-token'] || response.message;
      if (!accessToken) throw new Error('Verification token was not received.');
      await completeLogin(accessToken);
    } catch (error: any) {
      Alert.alert('Verification failed', error?.message || 'Check the OTP and try again.');
    } finally {
      setBusy(false);
    }
  };

  const resendOtp = async () => {
    if (!requestId || resendIn || busy) return;
    setBusy(true);
    try {
      const response = await OTPWidget.retryOTP({ reqId: requestId, retryChannel: 11 });
      if (response.type !== 'success') throw new Error(response.message || 'Could not resend OTP.');
      if (response.reqId) setRequestId(response.reqId);
      setOtp('');
      setResendIn(30);
    } catch (error: any) {
      Alert.alert('Could not resend OTP', error?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const goBack = () => {
    if (busy) return;
    if (step === 'otp') {
      setStep('phone');
      setOtp('');
      setRequestId('');
      return;
    }
    router.replace('/onboarding' as any);
  };

  return (
    <SafeAreaView className="flex-1 bg-[#f7fbfa]">
      <LinearGradient
        colors={['#f0fdf8', '#f8fafc', '#eef6ff']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View pointerEvents="none" className="absolute -right-20 -top-16 h-64 w-64 rounded-full bg-emerald-200/30" />
      <View pointerEvents="none" className="absolute -left-24 bottom-10 h-60 w-60 rounded-full bg-blue-200/25" />

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <View className="w-full max-w-[480px] self-center px-5">
            <View className="flex-row items-center justify-between">
              <TouchableOpacity
                onPress={goBack}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Go back"
                className="h-11 w-11 items-center justify-center rounded-2xl border border-white bg-white/90"
                style={styles.softShadow}
              >
                <MaterialCommunityIcons name="arrow-left" size={22} color="#0f172a" />
              </TouchableOpacity>
              <View className="flex-row items-center rounded-full border border-emerald-100 bg-white/90 px-3 py-2">
                <MaterialCommunityIcons name="shield-check" size={15} color="#059669" />
                <Text className="ml-1.5 text-[10px] font-black tracking-wider text-emerald-700">SECURE LOGIN</Text>
              </View>
            </View>

            <View className="mt-9">
              <LinearGradient colors={['#10b981', '#047857']} style={styles.heroIcon}>
                <MaterialCommunityIcons name={step === 'phone' ? 'cellphone-key' : 'message-lock-outline'} size={36} color="white" />
              </LinearGradient>
              <Text className="mt-6 text-[32px] font-black leading-[39px] tracking-tight text-slate-950">
                {step === 'phone' ? 'Your health journey\nstarts here' : 'Check your messages'}
              </Text>
              <Text className="mt-3 text-[15px] font-medium leading-6 text-slate-500">
                {step === 'phone'
                  ? 'Enter your mobile number to securely continue to AARX.'
                  : `We sent a one-time password to +91 ${mobile.slice(0, 5)} ${mobile.slice(5)}.`}
              </Text>
            </View>

            <View className="mt-8 rounded-[30px] border border-white bg-white/95 p-5" style={styles.cardShadow}>
              {step === 'phone' ? (
                <>
                  <Text className="mb-2.5 ml-1 text-[11px] font-black uppercase tracking-[1.5px] text-slate-500">
                    Mobile number
                  </Text>
                  <View className={`h-[62px] flex-row items-center rounded-2xl border px-4 ${mobile && !validMobile ? 'border-red-300 bg-red-50/40' : 'border-slate-200 bg-slate-50'}`}>
                    <Text className="text-lg">🇮🇳</Text>
                    <Text className="ml-2 border-r border-slate-200 pr-3 text-[15px] font-black text-slate-800">+91</Text>
                    <TextInput
                      value={mobile}
                      onChangeText={(value) => setMobile(value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="Enter 10-digit number"
                      placeholderTextColor="#94a3b8"
                      keyboardType="phone-pad"
                      autoComplete="tel"
                      maxLength={10}
                      returnKeyType="done"
                      onSubmitEditing={sendOtp}
                      className="ml-3 flex-1 text-[16px] font-bold tracking-wide text-slate-950"
                    />
                    {validMobile ? <MaterialCommunityIcons name="check-circle" size={21} color="#10b981" /> : null}
                  </View>
                  <Text className="mt-3 px-1 text-[11px] font-medium leading-4 text-slate-400">
                    We’ll send a one-time password to verify this number.
                  </Text>
                </>
              ) : (
                <>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-[11px] font-black uppercase tracking-[1.5px] text-slate-500">Enter OTP</Text>
                    <TouchableOpacity disabled={busy} onPress={() => setStep('phone')} className="flex-row items-center">
                      <MaterialCommunityIcons name="pencil-outline" size={14} color="#059669" />
                      <Text className="ml-1 text-xs font-black text-emerald-700">Change number</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    ref={otpRef}
                    value={otp}
                    onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, 8))}
                    placeholder="•  •  •  •  •  •"
                    placeholderTextColor="#94a3b8"
                    keyboardType="number-pad"
                    autoComplete="sms-otp"
                    textContentType="oneTimeCode"
                    maxLength={8}
                    returnKeyType="done"
                    onSubmitEditing={verifyOtp}
                    className="mt-3 h-[68px] rounded-2xl border border-slate-200 bg-slate-50 px-5 text-center text-[24px] font-black tracking-[8px] text-slate-950"
                  />
                  <View className="mt-4 flex-row items-center justify-center">
                    <Text className="text-xs font-semibold text-slate-400">Didn’t receive the code? </Text>
                    <TouchableOpacity disabled={resendIn > 0 || busy} onPress={resendOtp}>
                      <Text className={`text-xs font-black ${resendIn ? 'text-slate-400' : 'text-emerald-700'}`}>
                        {resendIn ? `Resend in ${resendIn}s` : 'Resend OTP'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              <TouchableOpacity
                onPress={step === 'phone' ? sendOtp : verifyOtp}
                disabled={busy || (step === 'phone' ? !validMobile : !validOtp)}
                activeOpacity={0.9}
                className="mt-5 overflow-hidden rounded-2xl"
                style={!busy && (step === 'phone' ? validMobile : validOtp) ? styles.buttonShadow : undefined}
              >
                <LinearGradient
                  colors={!busy && (step === 'phone' ? validMobile : validOtp) ? ['#10b981', '#047857'] : ['#cbd5e1', '#94a3b8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  className="h-[58px] flex-row items-center justify-center"
                >
                  {busy ? (
                    <>
                      <View className="mr-3 h-8 w-8 items-center justify-center rounded-full bg-white/15">
                        <ActivityIndicator size="small" color="white" />
                      </View>
                      <Text className="text-[15px] font-black text-white">
                        {step === 'phone' ? 'Sending secure code…' : 'Verifying securely…'}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text className="text-[15px] font-black text-white">{step === 'phone' ? 'Get OTP' : 'Verify & continue'}</Text>
                      <MaterialCommunityIcons name="arrow-right" size={20} color="white" style={{ marginLeft: 8 }} />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <View className="mt-6 flex-row items-center justify-center">
              <MaterialCommunityIcons name="lock-outline" size={14} color="#94a3b8" />
              <Text className="ml-1.5 text-[10px] font-bold text-slate-400">256-bit encrypted • Powered by MSG91</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', paddingVertical: 18, paddingBottom: 32 },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
  },
  softShadow: {
    elevation: 4,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  cardShadow: {
    elevation: 12,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
  },
  buttonShadow: {
    elevation: 8,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
  },
});
