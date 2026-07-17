import { LocalizedText as Text } from '@/components/Language/LocalizedPrimitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, TouchableOpacity, View } from 'react-native';

const BASE_URL = Constants.expoConfig?.extra?.BASE_URL;

type Reward = { id: number; prescription_id: number; points: number; response_seconds: number; created_at: string };
type RewardData = {
  points: number; tier: string; tier_label: string; fast_responder: boolean;
  fast_response_count: number; valid_quote_count: number; points_to_gold: number; recent_rewards: Reward[];
};

export default function EmergencyRewardsScreen() {
  const router = useRouter();
  const [data, setData] = useState<RewardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync('storeToken');
      const response = await axios.get(`${BASE_URL}/api/emergency-service/store/rewards/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(response.data);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <View className="flex-1 items-center justify-center bg-slate-50"><ActivityIndicator size="large" color="#e11d48" /></View>;
  const progress = Math.min(100, data?.points || 0);
  return (
    <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={{ padding: 20, paddingBottom: 100 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
      <View className="flex-row items-center"><TouchableOpacity onPress={() => router.back()} className="h-11 w-11 items-center justify-center rounded-full bg-white"><MaterialCommunityIcons name="arrow-left" size={22} color="#0f172a" /></TouchableOpacity><View className="ml-4"><Text className="text-2xl font-black text-slate-950">Emergency Rewards</Text><Text className="text-xs text-slate-500">Fast, valid quotation performance</Text></View></View>
      <View className="mt-7 overflow-hidden rounded-[30px] bg-rose-600 p-6">
        <Text className="text-[10px] font-black uppercase tracking-[2px] text-rose-100">{data?.tier_label || 'Standard'}</Text>
        <Text className="mt-2 text-5xl font-black text-white">{data?.points || 0}</Text><Text className="text-sm font-bold text-rose-100">Emergency points</Text>
        <View className="mt-5 h-2 overflow-hidden rounded-full bg-white/25"><View style={{ width: `${progress}%` }} className="h-full rounded-full bg-white" /></View>
        <Text className="mt-2 text-xs font-semibold text-white">{data?.points_to_gold ? `${data.points_to_gold} points to Gold Emergency Pharmacy` : 'Gold Emergency Pharmacy unlocked'}</Text>
      </View>
      <View className="mt-5 flex-row gap-3"><View className="flex-1 rounded-2xl bg-white p-4"><Text className="text-2xl font-black text-slate-900">{data?.fast_response_count || 0}</Text><Text className="text-[10px] font-bold uppercase text-slate-400">Fast responses</Text></View><View className="flex-1 rounded-2xl bg-white p-4"><Text className="text-2xl font-black text-slate-900">{data?.valid_quote_count || 0}</Text><Text className="text-[10px] font-bold uppercase text-slate-400">Valid quotes</Text></View></View>
      <View className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-4"><Text className="font-black text-amber-900">How points work</Text><Text className="mt-2 text-xs leading-5 text-amber-800">Under 30 sec: +10 · up to 60 sec: +7 · up to 120 sec: +4 · later valid quote: +1. Gold unlocks at 100 points.</Text></View>
      <Text className="mb-3 mt-7 text-[10px] font-black uppercase tracking-[2px] text-slate-400">Recent rewards</Text>
      {data?.recent_rewards.map(item => <View key={item.id} className="mb-3 flex-row items-center rounded-2xl bg-white p-4"><View className="h-10 w-10 items-center justify-center rounded-full bg-emerald-50"><Text className="font-black text-emerald-700">+{item.points}</Text></View><View className="ml-3 flex-1"><Text className="font-black text-slate-900">Emergency #{item.prescription_id}</Text><Text className="text-xs text-slate-500">Responded in {item.response_seconds}s</Text></View><Text className="text-[10px] text-slate-400">{new Date(item.created_at).toLocaleDateString()}</Text></View>)}
    </ScrollView>
  );
}
