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

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { userType } = useLocalSearchParams<{ userType?: string }>();
  const BASE_URL = Constants.expoConfig?.extra?.BASE_URL;

  const isSeller = userType === 'seller';
  const theme = {
    title: 'Forgot Password',
    subtitle: 'Enter your email to receive an OTP',
    gradient: isSeller ? (['#3b82f6', '#2563eb'] as const) : (['#10b981', '#059669'] as const),
    accent: isSeller ? '#2563eb' : '#059669',
  };

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const isEmailValid = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  const isValid = email.trim() !== '' && isEmailValid(email);

  const handleSendOTP = async () => {
    if (!isValid || loading) return;

    Keyboard.dismiss();
    setLoading(true);

    try {
      const response = await fetch(`${BASE_URL}/api/password-reset/request-otp/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), userType }),
      });

      const data = await response.json();

      if (!response.ok) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: data.error || 'Failed to send OTP.',
        });
        return;
      }

      Toast.show({
        type: 'success',
        text1: 'OTP Sent',
        text2: 'Please check your email for the OTP.',
      });

      router.push({
        pathname: '/onboarding/verify-otp',
        params: { email: email.trim(), userType },
      });
    } catch (error) {
      console.error('Request OTP error:', error);
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
              Email Address
            </Text>
            <View className="flex-row items-center rounded-[20px] border border-slate-100 bg-slate-50 px-3.5">
              <View className="h-8 w-8 items-center justify-center rounded-full bg-white">
                <Feather name="mail" size={17} color="#64748b" />
              </View>
              <TextInput
                placeholder="Enter your registered email"
                value={email}
                onChangeText={setEmail}
                className="ml-3 flex-1 py-3.5 text-[15px] font-semibold text-slate-900"
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor="#94a3b8"
                returnKeyType="done"
              />
            </View>
          </View>

          <TouchableOpacity
            onPress={handleSendOTP}
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
                  <Text className="mr-2 text-[15px] font-black text-white">Sending</Text>
                  <ActivityIndicator color="#ffffff" />
                </>
              ) : (
                <>
                  <Text className="text-[15px] font-black text-white">Send OTP</Text>
                  <Feather name="arrow-right" size={19} color="#ffffff" style={{ marginLeft: 8 }} />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
