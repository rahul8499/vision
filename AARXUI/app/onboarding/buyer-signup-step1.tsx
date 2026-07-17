import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/Language/LocalizedPrimitives';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import { useSignup } from '../context/SignupContext';

const gradient = ['#34d399', '#059669'] as const;
const accent = '#059669';
const { width, height } = Dimensions.get('window');
const isSmallPhone = width < 380 || height < 700;

const getParamValue = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value || '';

export default function SignupStep1() {
  const params = useLocalSearchParams<{
    userType?: string;
    name?: string;
    mobile?: string;
    email?: string;
  }>();
  const router = useRouter();
  const { signupData, setSignupData } = useSignup();

  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const isEmailValid = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const isValid =
    name.trim() !== '' &&
    mobile.trim() !== '' &&
    email.trim() !== '' &&
    isEmailValid(email) &&
    emailError === '';

  useEffect(() => {
    setName(signupData.name || getParamValue(params.name));
    setMobile(signupData.mobile || getParamValue(params.mobile));
    setEmail(signupData.email || getParamValue(params.email));
  }, [params.email, params.mobile, params.name, signupData.email, signupData.mobile, signupData.name]);


  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const scrollInputIntoView = () => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: isSmallPhone ? 155 : 125,
        animated: true,
      });
    }, 120);
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);

    if (value.trim() === '') {
      setEmailError('');
      return;
    }

    setEmailError(isEmailValid(value) ? '' : 'Please enter a valid email.');
  };

  const handleNext = () => {
    if (!isValid || isOpening) return;

    setIsOpening(true);
    setSignupData((prev) => ({
      ...prev,
      name: name.trim(),
      mobile: mobile.trim(),
      email: email.trim(),
    }));

    router.push({
      pathname: '/onboarding/buyer-signup-step2',
      params: { name, mobile, email },
    });
  };

  const handleBack = () => {
    router.push({
      pathname: '/onboarding/login',
      params: { userType: 'buyer' },
    });
  };

  return (
    <View className="flex-1 bg-slate-50">
      <LinearGradient
        colors={['#f0fdf4', '#ecfeff', '#eff6ff']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <View className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-emerald-200/40" />
      <View className="absolute -left-16 top-28 h-44 w-44 rounded-full bg-sky-200/40" />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            keyboardVisible && styles.keyboardScrollContent,
          ]}
          keyboardDismissMode="on-drag"
        >
          <View className="flex-1 px-5">
            <View className="flex-row items-center justify-between">
              <TouchableOpacity
                onPress={handleBack}
                className="h-10 w-10 items-center justify-center rounded-full bg-white/90"
                style={styles.softShadow}
              >
                <Feather name="arrow-left" size={21} color="#334155" />
              </TouchableOpacity>

              <View className="rounded-full bg-white p-1.5" style={styles.iconOuterShadow}>
                <LinearGradient
                  colors={gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.heroCircle}
                >
                  <MaterialCommunityIcons
                    name="account-plus"
                    size={isSmallPhone ? 34 : 38}
                    color="#ffffff"
                  />
                </LinearGradient>
              </View>

              <View className="h-10 w-10" />
            </View>

            <View className="items-center">
              <View className="mt-4 flex-row items-center rounded-full border border-white bg-white/80 px-3.5 py-1.5">
                <MaterialCommunityIcons
                  name="shield-check-outline"
                  size={14}
                  color={accent}
                />
                <Text className="ml-1.5 text-[11px] font-black text-emerald-700">
                  Buyer Signup
                </Text>
              </View>

              <Text className="mt-4 text-center text-[28px] font-black leading-9 text-slate-950">
                Create Account
              </Text>

              <Text className="mt-1.5 text-center text-[14px] font-bold leading-5 text-slate-500">
                Start your medicine delivery profile
              </Text>
            </View>

            <View
              className="mt-6 rounded-[28px] border border-white bg-white/90 p-4"
              style={styles.cardShadow}
            >
              <View className="mb-3.5 flex-row items-center rounded-[20px] border border-slate-100 bg-slate-50 px-3.5">
                <View className="h-8 w-8 items-center justify-center rounded-full bg-white">
                  <Feather name="user" size={17} color="#64748b" />
                </View>
                <TextInput
                  placeholder="Full name"
                  value={name}
                  onChangeText={setName}
                  className="ml-3 flex-1 py-3.5 text-[15px] font-semibold text-slate-900"
                  placeholderTextColor="#94a3b8"
                  returnKeyType="next"
                  onFocus={scrollInputIntoView}
                />
              </View>

              <View className="mb-3.5 flex-row items-center rounded-[20px] border border-slate-100 bg-slate-50 px-3.5">
                <View className="h-8 w-8 items-center justify-center rounded-full bg-white">
                  <Feather name="phone" size={17} color="#64748b" />
                </View>
                <TextInput
                  placeholder="Mobile number"
                  value={mobile}
                  onChangeText={setMobile}
                  className="ml-3 flex-1 py-3.5 text-[15px] font-semibold text-slate-900"
                  keyboardType="phone-pad"
                  placeholderTextColor="#94a3b8"
                  returnKeyType="next"
                  onFocus={scrollInputIntoView}
                />
              </View>

              <View className="mb-2 flex-row items-center rounded-[20px] border border-slate-100 bg-slate-50 px-3.5">
                <View className="h-8 w-8 items-center justify-center rounded-full bg-white">
                  <Feather name="mail" size={17} color="#64748b" />
                </View>
                <TextInput
                  placeholder="Email address"
                  value={email}
                  onChangeText={handleEmailChange}
                  className="ml-3 flex-1 py-3.5 text-[15px] font-semibold text-slate-900"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholderTextColor="#94a3b8"
                  returnKeyType="done"
                  onFocus={scrollInputIntoView}
                />
              </View>

              {emailError !== '' && (
                <Text className="mb-4 ml-2 text-xs font-bold text-red-500">
                  {emailError}
                </Text>
              )}

              <TouchableOpacity
                disabled={!isValid || isOpening}
                activeOpacity={0.9}
                onPress={handleNext}
                className="mt-3 overflow-hidden rounded-[22px]"
                style={isValid && !isOpening ? styles.buttonShadow : undefined}
              >
                <LinearGradient
                  colors={isValid && !isOpening ? gradient : ['#cbd5e1', '#94a3b8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  className="flex-row items-center justify-center py-3.5"
                >
                  <Text className="text-[15px] font-black text-white">
                    {isOpening ? 'Opening' : 'Next'}
                  </Text>
                  <Feather
                    name="arrow-right"
                    size={20}
                    color="#ffffff"
                    style={{ marginLeft: 8 }}
                  />
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <View className="mt-5 flex-row items-center justify-center gap-3">
              <View
                className="h-2.5 w-7 rounded-full"
                style={{ backgroundColor: accent }}
              />
              <View className="h-2.5 w-2.5 rounded-full bg-slate-300" />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingTop: isSmallPhone ? 10 : 18,
    paddingBottom: 120,
  },
  keyboardScrollContent: {
    paddingBottom: 300,
  },
  softShadow: {
    elevation: 5,
    shadowColor: '#94a3b8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
  },
  iconOuterShadow: {
    elevation: 12,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 22,
  },
  heroCircle: {
    width: isSmallPhone ? 70 : 78,
    height: isSmallPhone ? 70 : 78,
    borderRadius: isSmallPhone ? 35 : 39,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cardShadow: {
    elevation: 14,
    shadowColor: '#94a3b8',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.22,
    shadowRadius: 30,
  },
  buttonShadow: {
    elevation: 10,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
  },
});
