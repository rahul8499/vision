import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/Language/LocalizedPrimitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { getGoogleIdToken } from '@/utils/googleIdentity';
import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/redux/store';
import { setAuth } from '@/redux/userSlice';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput as NativeTextInput,
  TouchableOpacity,
  Dimensions,
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
  const dispatch = useDispatch<AppDispatch>();
  const params = useLocalSearchParams<{ userType?: string | string[] }>();
  const requestedRole = Array.isArray(params.userType) ? params.userType[0] : params.userType;
  const isSeller = requestedRole === 'seller';
  const expectedUserType = isSeller ? 'store' : 'user';
  const enterprisePrimary = isSeller ? '#123B5D' : '#064A24';
  const enterpriseAccent = isSeller ? '#0F8B8D' : '#1D6B3B';
  const enterpriseGradient = isSeller ? ['#123B5D', '#0F8B8D'] as const : ['#126331', '#72A942'] as const;
  // Keep the sheet height stable while Android adjustResize opens the keyboard.
  // A live window-height value here causes a second layout resize and can blur
  // the focused phone input on some devices.
  const screenHeight = useRef(Dimensions.get('window').height).current;
  const baseUrl = Constants.expoConfig?.extra?.BASE_URL as string | undefined;
  const widgetId = Constants.expoConfig?.extra?.MSG91_WIDGET_ID as string | undefined;
  const tokenAuth = Constants.expoConfig?.extra?.MSG91_TOKEN_AUTH as string | undefined;
  const [step, setStep] = useState<Step>('phone');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [requestId, setRequestId] = useState('');
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [pendingGoogleIdToken, setPendingGoogleIdToken] = useState<string | null>(null);
  const otpRef = useRef<any>(null);
  const phoneRef = useRef<NativeTextInput>(null);
  const keepPhoneFocusedRef = useRef(false);
  const entrance = useRef(new Animated.Value(0)).current;

  const validMobile = /^[6-9]\d{9}$/.test(mobile);
  const validOtp = /^\d{4,8}$/.test(otp);
  const canSubmit = !busy && (step === 'phone' ? validMobile : validOtp);

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 520,
      useNativeDriver: true,
    }).start();
  }, [entrance]);

  useEffect(() => {
    if (!resendIn) return;
    const timer = setInterval(() => setResendIn((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendIn]);

  const completeLogin = async (accessToken: string) => {
    if (!baseUrl) throw new Error('App API address is not configured.');
    const response = await fetch(`${baseUrl}/api/${isSeller ? 'store' : 'user'}/otp-login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile: `91${mobile}`, access_token: accessToken }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || 'Could not complete login.');
    if (data?.user_type !== expectedUserType) {
      throw new Error('Login role mismatch. Please go back and select Buyer or Seller again.');
    }

    if (pendingGoogleIdToken) {
      const linkResponse = await fetch(`${baseUrl}/api/${isSeller ? 'store' : 'user'}/google/link/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${data.token}`,
        },
        body: JSON.stringify({
          id_token: pendingGoogleIdToken,
          link_ticket: data.google_link_ticket,
        }),
      });
      const linkData = await linkResponse.json();
      if (!linkResponse.ok) {
        throw new Error(linkData?.error || 'Phone verified, but Google could not be linked.');
      }
      setPendingGoogleIdToken(null);
    }

    const secureWrites = [
      SecureStore.setItemAsync('authToken', data.token),
      SecureStore.setItemAsync('userType', isSeller ? 'store' : 'user'),
      SecureStore.setItemAsync('userId', String(isSeller ? data.store_id : data.user_id)),
    ];
    if (!pendingGoogleIdToken && data.google_link_ticket) {
      secureWrites.push(SecureStore.setItemAsync('googleLinkTicket', data.google_link_ticket));
    } else if (pendingGoogleIdToken) {
      secureWrites.push(SecureStore.deleteItemAsync('googleLinkTicket'));
    }
    await Promise.all(secureWrites);
    dispatch(setAuth({ token: data.token, userType: expectedUserType }));
    router.replace((isSeller
      ? data.needs_onboarding
        ? `/onboarding/seller-signup-step1?otpVerified=1&mobile=${mobile}`
        : '/(sellerTabs)/home'
      : data.needs_name
        ? '/onboarding/complete-profile'
        : '/(tabs)') as any);
  };

  const sendOtp = async () => {
    setPhoneTouched(true);
    if (!validMobile || busy) {
      if (!validMobile) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    if (!widgetId || !tokenAuth) {
      Alert.alert('OTP unavailable', 'MSG91 widget configuration is missing.');
      return;
    }
    keepPhoneFocusedRef.current = false;
    Keyboard.dismiss();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

  const loginWithGoogle = async () => {
    if (busy || googleBusy) return;
    keepPhoneFocusedRef.current = false;
    try {
      setGoogleBusy(true);
      const idToken = await getGoogleIdToken();
      if (!idToken) return;
      if (!baseUrl) throw new Error('App API address is not configured.');
      const response = await fetch(`${baseUrl}/api/${isSeller ? 'store' : 'user'}/google-login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: idToken }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 404 && data?.code === 'google_not_linked') {
          setPendingGoogleIdToken(idToken);
          Alert.alert(
            'Verify your phone',
            'Enter your phone number and OTP once. We will link this Google account automatically.',
          );
          return;
        }
        throw new Error(data?.error || 'Google login failed.');
      }
      if (data?.user_type !== expectedUserType) {
        throw new Error('Login role mismatch. Please go back and select Buyer or Seller again.');
      }
      await Promise.all([
        SecureStore.setItemAsync('authToken', data.token),
        SecureStore.setItemAsync('userType', isSeller ? 'store' : 'user'),
        SecureStore.setItemAsync('userId', String(isSeller ? data.store_id : data.user_id)),
      ]);
      dispatch(setAuth({ token: data.token, userType: expectedUserType }));
      router.replace((isSeller
        ? data.needs_onboarding
          ? '/onboarding/seller-signup-step1?otpVerified=1'
          : '/(sellerTabs)/home'
        : data.needs_name
          ? '/onboarding/complete-profile'
          : '/(tabs)') as any);
    } catch (error: any) {
      Alert.alert('Could not continue with Google', error?.message || 'Please try again.');
    } finally {
      setGoogleBusy(false);
    }
  };

  const goBack = () => {
    if (busy) return;
    keepPhoneFocusedRef.current = false;
    if (step === 'otp') {
      setStep('phone');
      setOtp('');
      setRequestId('');
      return;
    }
    router.replace('/onboarding' as any);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          bounces={false}
        >
          <View className="relative w-full overflow-hidden bg-white" style={styles.hero}>
            <Image
              source={isSeller
                ? require('../../assets/images/sellerlogin.png')
                : require('../../assets/images/userloginlatest.jpeg')}
              resizeMode="contain"
              style={styles.heroImage}
              accessibilityLabel={isSeller ? 'AARX pharmacy partner login' : 'AARX trusted pharmacy and medicine delivery services'}
            />
            <TouchableOpacity
              onPress={goBack}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              className="absolute left-5 top-4 h-11 w-11 items-center justify-center rounded-full bg-white/95"
              style={styles.softShadow}
            >
              <MaterialCommunityIcons name="arrow-left" size={23} color="#153e25" />
            </TouchableOpacity>
          </View>

          <Animated.View
            className="-mt-7 w-[87%] max-w-[470px] self-center rounded-[30px] border border-[#e8ebe5] bg-[#fffefa]"
            style={[
              styles.sheetShadow,
              { minHeight: Math.max(440, screenHeight * 0.5) },
              {
                opacity: entrance,
                transform: [
                  {
                    translateY: entrance.interpolate({
                      inputRange: [0, 1],
                      outputRange: [24, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View className="w-full self-center px-5 pb-5 pt-4">
              <View className="items-center">
                <View className="mb-2 flex-row items-center rounded-full border border-[#dce8d8] bg-[#f4f8f1] px-3 py-1.5" style={isSeller ? { borderColor: '#B9DDE0', backgroundColor: '#E8F4F5' } : undefined}>
                  <MaterialCommunityIcons name="shield-check" size={14} color={enterpriseAccent} />
                  <Text className="ml-1.5 text-[10px] font-black uppercase tracking-[1.2px] text-[#34713b]" style={isSeller ? { color: enterprisePrimary } : undefined}>
                    {isSeller ? 'Secure pharmacy login' : 'Secure customer login'}
                  </Text>
                </View>
                <Text className="text-center text-[24px] font-black leading-[30px] tracking-tight text-[#064a24]" style={{ color: enterprisePrimary }}>
                  {step === 'phone' ? (isSeller ? 'AARX Pharmacy Partner' : 'Welcome to AARX') : 'Check your messages'}
                </Text>
                <Text className="mt-1 text-center text-[13px] font-medium leading-5 text-[#68716b]">
                  {step === 'phone'
                    ? isSeller
                      ? 'Sign in securely to manage your pharmacy and orders'
                      : 'Sign in to find trusted medicines at the best prices'
                    : `We sent a one-time password to +91 ${mobile.slice(0, 5)} ${mobile.slice(5)}.`}
                </Text>
              </View>

              <View className="mt-3">
                {step === 'phone' ? (
                  <>
                    <Text className="mb-2.5 text-[11px] font-black uppercase tracking-[1.3px] text-[#245b32]" style={{ color: enterprisePrimary }}>
                      Mobile number
                    </Text>
                    <View className={`h-[58px] flex-row items-center rounded-xl border px-4 ${phoneTouched && !validMobile ? 'border-red-300 bg-red-50/40' : 'border-[#d7dfd9] bg-white'}`}>
                      <Text className="text-lg">🇮🇳</Text>
                      <Text className="ml-2 border-r border-[#d7dfd9] pr-3 text-[15px] font-black text-[#183c25]">+91</Text>
                      <NativeTextInput
                        ref={phoneRef}
                        value={mobile}
                        onChangeText={(value) => setMobile(value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="Enter 10-digit number"
                        placeholderTextColor="#89968d"
                        keyboardType="phone-pad"
                        autoComplete="tel"
                        maxLength={10}
                        returnKeyType="done"
                        onSubmitEditing={sendOtp}
                        onFocus={() => { keepPhoneFocusedRef.current = true; }}
                        onBlur={() => {
                          if (keepPhoneFocusedRef.current && step === 'phone' && !busy) {
                            setTimeout(() => phoneRef.current?.focus(), 80);
                          }
                        }}
                        className="ml-3 flex-1 text-[16px] font-bold tracking-wide text-[#102a1b]"
                      />
                      <View className="h-6 w-6 items-center justify-center">
                        {validMobile ? <MaterialCommunityIcons name="check-circle" size={21} color={enterpriseAccent} /> : null}
                      </View>
                    </View>
                    {phoneTouched && mobile.length > 0 && !validMobile ? (
                      <View className="mt-2 flex-row items-center px-1">
                        <MaterialCommunityIcons name="alert-circle-outline" size={14} color="#dc2626" />
                        <Text className="ml-1.5 text-[11px] font-bold text-red-600">
                          Enter a valid 10-digit Indian mobile number
                        </Text>
                      </View>
                    ) : null}
                    <Text className="mt-3 px-1 text-[11px] font-medium leading-4 text-[#7b8980]">
                      We’ll send a one-time password to verify this number.
                    </Text>
                  </>
                ) : (
                  <>
                    <View className="flex-row items-center justify-between">
                      <Text className="text-[11px] font-black uppercase tracking-[1.5px] text-slate-500">Enter OTP</Text>
                      <TouchableOpacity disabled={busy} onPress={() => setStep('phone')} className="flex-row items-center">
                        <MaterialCommunityIcons name="pencil-outline" size={14} color={enterpriseAccent} />
                        <Text className="ml-1 text-xs font-black text-[#1d6b3b]" style={{ color: enterpriseAccent }}>Change number</Text>
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
                      className="mt-3 h-[68px] rounded-2xl border-2 border-[#d7dfd9] bg-white px-5 text-center text-[24px] font-black tracking-[8px] text-[#102a1b]"
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
                  disabled={!canSubmit}
                  activeOpacity={0.9}
                  className="mt-3 overflow-hidden rounded-xl"
                  style={canSubmit ? styles.buttonShadow : undefined}
                >
                  <LinearGradient
                    colors={enterpriseGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    className="h-[55px] flex-row items-center justify-center"
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
                        <Text className="text-[16px] font-black text-white">
                          {step === 'phone' ? 'Get OTP' : 'Verify & continue'}
                        </Text>
                        <View className="ml-3 h-8 w-8 items-center justify-center rounded-full bg-white">
                          <MaterialCommunityIcons name="arrow-right" size={18} color={enterprisePrimary} />
                        </View>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {step === 'phone' ? (
                  <>
                    <View className="my-3 flex-row items-center">
                      <View className="h-px flex-1 bg-[#e0e7e2]" />
                      <Text className="mx-3 text-[10px] font-black uppercase tracking-[1.2px] text-[#8a968e]">
                        Or
                      </Text>
                      <View className="h-px flex-1 bg-[#e0e7e2]" />
                    </View>
                    <TouchableOpacity
                      onPress={loginWithGoogle}
                      disabled={busy || googleBusy}
                      activeOpacity={0.82}
                      className="h-[54px] flex-row items-center justify-center rounded-xl border border-[#dfe3df] bg-white"
                      style={styles.googleButtonShadow}
                    >
                      {googleBusy ? (
                        <ActivityIndicator color="#183c25" />
                      ) : (
                        <>
                          <GoogleMark />
                          <Text className="ml-3 text-[14px] font-black text-[#243229]">Continue with Google</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <Text className="mt-2.5 text-center text-[10px] font-semibold text-[#849087]">
                      Available after Google is linked to your phone-verified account.
                    </Text>
                  </>
                ) : null}

                <Text className="mt-3 px-1 text-center text-[10px] font-medium leading-[16px] text-[#6f7d74]">
                  By signing in, you agree to our{' '}
                  <Text className="font-black text-[#244c32] underline">Terms of Service</Text>
                  {' '}and{' '}
                  <Text className="font-black text-[#244c32] underline">Privacy Policy</Text>.
                </Text>
              </View>

            </View>
          </Animated.View>
          <PharmacyFooter isSeller={isSeller} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function GoogleMark() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" accessibilityLabel="Google">
      <Path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z" />
      <Path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.36l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.6 0-4.81-1.76-5.6-4.12H3.06v2.62A10 10 0 0 0 12 22Z" />
      <Path fill="#FBBC05" d="M6.4 13.94A6 6 0 0 1 6.08 12c0-.67.12-1.32.32-1.94V7.44H3.06A10 10 0 0 0 2 12c0 1.64.39 3.2 1.06 4.56l3.34-2.62Z" />
      <Path fill="#EA4335" d="M12 5.94c1.47 0 2.78.5 3.82 1.5l2.87-2.87A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.94 5.44l3.34 2.62c.79-2.36 3-4.12 5.6-4.12Z" />
    </Svg>
  );
}

function PharmacyFooter({ isSeller }: { isSeller: boolean }) {
  const footerPrimary = isSeller ? '#123B5D' : '#176235';
  const footerAccent = isSeller ? '#0F8B8D' : '#D4A72C';
  const footerLight = isSeller ? '#D8EEF0' : '#D9DFCE';
  return (
    <View style={styles.footerArt} pointerEvents="none">
      <View style={[styles.footerBottomFill, { backgroundColor: footerPrimary }]} />
      <Svg width="100%" height={100} viewBox="0 0 390 100" preserveAspectRatio="none">
        <Path d="M0 43 C47 33 69 8 117 21 C159 32 190 43 230 31 C281 15 315 9 390 36 L390 101 L0 101 Z" fill={footerPrimary} />
        <Path d="M0 34 C48 24 69 5 117 15 C159 26 190 37 230 25 C281 9 315 6 390 27" fill="none" stroke={footerAccent} strokeWidth="1.4" />
        <Path d="M20 60 C14 47 14 34 20 20 M20 45 C9 40 5 32 4 24 M21 36 C31 29 35 20 35 11 M365 59 C373 45 375 32 369 18 M370 44 C380 39 384 30 385 22 M369 34 C358 28 354 19 354 10" fill="none" stroke={footerLight} strokeWidth="1.2" />
        <Circle cx="195" cy="55" r="17" fill="#fffef9" stroke={footerAccent} strokeWidth="1.6" />
        <Path d="M195 43 L195 67 M188 50 L202 50" stroke={footerAccent} strokeWidth="3" strokeLinecap="round" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  footerArt: {
    width: '100%',
    height: 94,
    marginTop: -8,
    marginBottom: -6,
    overflow: 'hidden',
  },
  footerBottomFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 18,
    backgroundColor: '#176235',
  },
  content: { flexGrow: 1, backgroundColor: '#fffef9' },
  hero: {
    width: '100%',
    marginTop: -32,
    marginBottom: 8,
    aspectRatio: 1280 / 1127,
  },
  heroImage: {
    width: '100%',
    height: '100%',
    alignSelf: 'center',
  },
  sheetShadow: {
    elevation: 12,
    shadowColor: '#07170e',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.11,
    shadowRadius: 18,
  },
  googleButtonShadow: {
    elevation: 3,
    shadowColor: '#1f5030',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.09,
    shadowRadius: 10,
  },
  softShadow: {
    elevation: 4,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  buttonShadow: {
    elevation: 8,
    shadowColor: '#174f2e',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
  },
});
