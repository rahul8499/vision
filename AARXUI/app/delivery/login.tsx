import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/Language/LocalizedPrimitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, SafeAreaView, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';

export default function DeliveryLoginScreen() {
  const baseUrl = Constants.expoConfig?.extra?.BASE_URL || '';
  const [loginId, setLoginId] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);

  const login = async () => {
    if (!loginId.trim() || !/^\d{4,6}$/.test(pin)) {
      Toast.show({ type: 'error', text1: 'Enter Partner ID and PIN' });
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`${baseUrl}/api/delivery/login/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login_id: loginId.trim(), pin }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Login failed');
      await SecureStore.setItemAsync('deliveryAuthToken', data.token);
      await SecureStore.setItemAsync('deliveryPartner', JSON.stringify(data.partner));
      router.replace('/delivery' as any);
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Partner login failed', text2: error.message });
    } finally {
      setBusy(false);
    }
  };

  return <SafeAreaView className="flex-1 bg-[#f7faf9]"><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-center px-6">
    <TouchableOpacity onPress={() => router.replace('/onboarding')} className="absolute left-6 top-8 h-11 w-11 items-center justify-center rounded-2xl bg-white"><MaterialCommunityIcons name="arrow-left" size={22} color="#0f172a" /></TouchableOpacity>
    <View className="mb-8"><View className="h-16 w-16 items-center justify-center rounded-[1.4rem] bg-orange-600"><MaterialCommunityIcons name="bike-fast" size={34} color="white" /></View><Text className="mt-5 text-3xl font-black text-slate-950">Delivery Partner</Text><Text className="mt-2 text-sm font-semibold text-slate-500">Sign in using the Partner ID and PIN provided by your pharmacy.</Text></View>
    <View className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-xl shadow-slate-200"><Text className="mb-2 text-[9px] font-black uppercase tracking-[1.5px] text-slate-400">Partner ID</Text><TextInput value={loginId} onChangeText={setLoginId} autoCapitalize="none" placeholder="Paste your Partner ID" className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 font-bold text-slate-900" /><Text className="mb-2 text-[9px] font-black uppercase tracking-[1.5px] text-slate-400">Secure PIN</Text><TextInput value={pin} onChangeText={setPin} keyboardType="number-pad" secureTextEntry maxLength={6} placeholder="4–6 digit PIN" className="rounded-2xl border border-slate-200 bg-slate-50 p-4 font-bold text-slate-900" /><TouchableOpacity onPress={login} disabled={busy} className="mt-5 h-14 flex-row items-center justify-center rounded-2xl bg-orange-600">{busy ? <ActivityIndicator color="white" /> : <><MaterialCommunityIcons name="login-variant" size={20} color="white" /><Text className="ml-2 font-black uppercase tracking-[1.3px] text-white">Start delivery shift</Text></>}</TouchableOpacity></View>
    <Text className="mt-6 text-center text-[10px] font-semibold leading-4 text-slate-400">No account? Ask the pharmacy owner to add you under Settings → Delivery Team.</Text>
  </KeyboardAvoidingView></SafeAreaView>;
}
