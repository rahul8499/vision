import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/Language/LocalizedPrimitives';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useSignup } from '../context/SignupContext';

const gradient = ['#34d399', '#059669'] as const;
const accent = '#059669';
const { width, height } = Dimensions.get('window');
const isSmallPhone = width < 380 || height < 700;

const getParamValue = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value || '';

export default function SignupStep2() {
  const BASE_URL = Constants.expoConfig?.extra?.BASE_URL;
  const router = useRouter();
  const { name, mobile, email } = useLocalSearchParams<{
    name?: string;
    mobile?: string;
    email?: string;
  }>();
  const routeName = getParamValue(name);
  const routeMobile = getParamValue(mobile);
  const routeEmail = getParamValue(email);
  const { signupData, setSignupData } = useSignup();

  const [address, setAddress] = useState('');
  const [pincode, setPincode] = useState('');
  const [password, setPassword] = useState('');
  const [secureEntry, setSecureEntry] = useState(true);
  const [loading, setLoading] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const isValid =
    address.trim() !== '' &&
    pincode.trim() !== '' &&
    password.trim() !== '';

  useEffect(() => {
    setAddress(signupData.address || '');
    setPincode(signupData.pincode || '');
    setPassword(signupData.password || '');
  }, [signupData.address, signupData.password, signupData.pincode]);


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
        y: isSmallPhone ? 165 : 135,
        animated: true,
      });
    }, 120);
  };

  const handleBack = () => {
    router.push({
      pathname: '/onboarding/buyer-signup-step1',
      params: { name: routeName, mobile: routeMobile, email: routeEmail },
    });
  };

  const handleRegister = async () => {
    if (!isValid || loading) return;

    const finalData = {
      name: signupData.name || routeName,
      mobile: signupData.mobile || routeMobile,
      email: signupData.email || routeEmail,
      password: password.trim(),
      address: address.trim(),
      pincode: pincode.trim(),
    };

    setSignupData((prev) => ({
      ...prev,
      name: finalData.name,
      mobile: finalData.mobile,
      email: finalData.email,
      password: finalData.password,
      address: finalData.address,
      pincode: finalData.pincode,
    }));

    try {
      setLoading(true);

      const response = await fetch(`${BASE_URL}/api/user/register/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(finalData),
      });

      const data = await response.json();

      if (response.ok) {
        Toast.show({
          type: 'success',
          text1: 'Registration successful!',
          position: 'bottom',
        });

        router.push({
          pathname: '/onboarding/login',
          params: { userType: 'buyer' },
        });
        return;
      }

      Toast.show({
        type: 'error',
        text1: 'Registration failed!',
        text2: data?.message || 'Please try again.',
        position: 'bottom',
      });
    } catch (error) {
      console.error('Error during register:', error);
      Toast.show({
        type: 'error',
        text1: 'Network error!',
        text2: 'Please try again later.',
        position: 'bottom',
      });
    } finally {
      setLoading(false);
    }
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
                disabled={loading}
                onPress={handleBack}
                className="h-10 w-10 items-center justify-center rounded-full bg-white/90"
                style={styles.softShadow}
              >
                <Feather name="arrow-left" size={21} color="#334155" />
              </TouchableOpacity>

              <View
                className="rounded-full bg-white p-1.5"
                style={styles.iconOuterShadow}
              >
                <LinearGradient
                  colors={gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.heroCircle}
                >
                  <MaterialCommunityIcons
                    name="map-marker-check-outline"
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
                  Secure Delivery
                </Text>
              </View>

              <Text className="mt-4 text-center text-[28px] font-black leading-9 text-slate-950">
                Delivery Details
              </Text>

              <Text className="mt-1.5 text-center text-[14px] font-bold leading-5 text-slate-500">
                Add address and password to finish
              </Text>
            </View>

            <View
              className="mt-6 rounded-[28px] border border-white bg-white/90 p-4"
              style={styles.cardShadow}
            >
              <View className="mb-3.5 flex-row items-center rounded-[20px] border border-slate-100 bg-slate-50 px-3.5">
                <View className="h-8 w-8 items-center justify-center rounded-full bg-white">
                  <Feather name="map-pin" size={17} color="#64748b" />
                </View>
                <TextInput
                  placeholder="Delivery address"
                  value={address}
                  onChangeText={setAddress}
                  className="ml-3 flex-1 py-3.5 text-[15px] font-semibold text-slate-900"
                  placeholderTextColor="#94a3b8"
                  returnKeyType="next"
                  onFocus={scrollInputIntoView}
                />
              </View>

              <View className="mb-3.5 flex-row items-center rounded-[20px] border border-slate-100 bg-slate-50 px-3.5">
                <View className="h-8 w-8 items-center justify-center rounded-full bg-white">
                  <MaterialCommunityIcons
                    name="map-marker-radius-outline"
                    size={18}
                    color="#64748b"
                  />
                </View>
                <TextInput
                  placeholder="Pincode"
                  value={pincode}
                  onChangeText={setPincode}
                  className="ml-3 flex-1 py-3.5 text-[15px] font-semibold text-slate-900"
                  keyboardType="number-pad"
                  placeholderTextColor="#94a3b8"
                  returnKeyType="next"
                  onFocus={scrollInputIntoView}
                />
              </View>

              <View className="mb-4 flex-row items-center rounded-[20px] border border-slate-100 bg-slate-50 px-3.5">
                <View className="h-8 w-8 items-center justify-center rounded-full bg-white">
                  <Feather name="lock" size={17} color="#64748b" />
                </View>
                <TextInput
                  placeholder="Create password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={secureEntry}
                  className="ml-3 flex-1 py-3.5 pr-3 text-[15px] font-semibold text-slate-900"
                  placeholderTextColor="#94a3b8"
                  returnKeyType="done"
                  onFocus={scrollInputIntoView}
                />
                <TouchableOpacity onPress={() => setSecureEntry(!secureEntry)}>
                  <Feather
                    name={secureEntry ? 'eye-off' : 'eye'}
                    size={19}
                    color="#64748b"
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                disabled={!isValid || loading}
                activeOpacity={0.9}
                onPress={handleRegister}
                className="overflow-hidden rounded-[22px]"
                style={isValid && !loading ? styles.buttonShadow : undefined}
              >
                <LinearGradient
                  colors={
                    isValid && !loading
                      ? gradient
                      : ['#cbd5e1', '#94a3b8']
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  className="flex-row items-center justify-center py-3.5"
                >
                  {loading ? (
                    <>
                      <Text className="mr-2 text-[15px] font-black text-white">
                        Creating account
                      </Text>
                      <ActivityIndicator color="#ffffff" />
                    </>
                  ) : (
                    <>
                      <Text className="text-[15px] font-black text-white">
                        Create Account
                      </Text>
                      <Feather
                        name="check-circle"
                        size={20}
                        color="#ffffff"
                        style={{ marginLeft: 8 }}
                      />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <View className="mt-5 flex-row items-center justify-center gap-3">
              <View className="h-2.5 w-2.5 rounded-full bg-slate-300" />
              <View
                className="h-2.5 w-7 rounded-full"
                style={{ backgroundColor: accent }}
              />
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
