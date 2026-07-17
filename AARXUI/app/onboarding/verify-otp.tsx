import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/Language/LocalizedPrimitives';
import React, { useState, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Keyboard,
  Dimensions
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';

const { width, height } = Dimensions.get('window');
const isSmallPhone = width < 380 || height < 700;

export default function VerifyOTPScreen() {
  const router = useRouter();
  const { email, userType } = useLocalSearchParams<{ email?: string; userType?: string }>();
  const BASE_URL = Constants.expoConfig?.extra?.BASE_URL;

  const isSeller = userType === 'seller';
  const theme = {
    title: 'Verify OTP',
    subtitle: `Enter the 6-digit code sent to ${email}`,
    gradient: isSeller ? (['#3b82f6', '#2563eb'] as const) : (['#10b981', '#059669'] as const),
    accent: isSeller ? '#2563eb' : '#059669',
  };

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const isValid = otp.trim().length === 6;

  const handleVerifyOTP = async () => {
    if (!isValid || loading) return;

    Keyboard.dismiss();
    setLoading(true);

    try {
      const response = await fetch(`${BASE_URL}/api/password-reset/verify-otp/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: otp.trim(), userType }),
      });

      const data = await response.json();

      if (!response.ok) {
        Toast.show({
          type: 'error',
          text1: 'Verification Failed',
          text2: data.error || 'Invalid OTP.',
        });
        return;
      }

      Toast.show({
        type: 'success',
        text1: 'OTP Verified',
        text2: 'Please set your new password.',
      });

      router.push({
        pathname: '/onboarding/reset-password',
        params: { email, userType },
      });
    } catch (error) {
      console.error('Verify OTP error:', error);
      Toast.show({
        type: 'error',
        text1: 'Network Error',
        text2: 'Something went wrong. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
      >
        <LinearGradient
          colors={theme.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className={`px-6 pb-8 pt-16 ${isSmallPhone ? 'pt-12 pb-6' : ''}`}
          style={{ borderBottomLeftRadius: 40, borderBottomRightRadius: 40 }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            className="mb-6 h-10 w-10 items-center justify-center rounded-full bg-white/20"
          >
            <Feather name="arrow-left" size={20} color="#ffffff" />
          </TouchableOpacity>

          <Text className="mb-2 text-3xl font-black tracking-tight text-white shadow-sm">
            {theme.title}
          </Text>
          <Text className="text-[15px] font-medium text-white/90">
            {theme.subtitle}
          </Text>
        </LinearGradient>

        <View className="px-6 pt-8">
          <View className="mb-6">
            <Text className="mb-2 ml-1 text-[13px] font-bold uppercase tracking-wider text-slate-500">
              6-Digit OTP
            </Text>
            <View className="flex-row items-center rounded-[20px] border border-slate-100 bg-slate-50 px-3.5">
              <View className="h-8 w-8 items-center justify-center rounded-full bg-white">
                <Feather name="key" size={17} color="#64748b" />
              </View>
              <TextInput
                placeholder="Enter OTP"
                value={otp}
                onChangeText={setOtp}
                className="ml-3 flex-1 py-3.5 text-[15px] font-semibold text-slate-900"
                keyboardType="number-pad"
                maxLength={6}
                placeholderTextColor="#94a3b8"
                returnKeyType="done"
              />
            </View>
          </View>

          <TouchableOpacity
            onPress={handleVerifyOTP}
            disabled={!isValid || loading}
            activeOpacity={0.9}
            className="overflow-hidden rounded-[20px]"
          >
            <LinearGradient
              colors={isValid && !loading ? theme.gradient : (['#cbd5e1', '#94a3b8'] as const)}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              className="flex-row items-center justify-center py-3.5"
            >
              {loading ? (
                <>
                  <Text className="mr-2 text-[15px] font-black text-white">Verifying</Text>
                  <ActivityIndicator color="#ffffff" />
                </>
              ) : (
                <>
                  <Text className="text-[15px] font-black text-white">Verify OTP</Text>
                  <Feather name="check" size={19} color="#ffffff" style={{ marginLeft: 8 }} />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
