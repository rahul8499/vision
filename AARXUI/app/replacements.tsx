import { LocalizedText as Text } from '@/components/Language/LocalizedPrimitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  SafeAreaView,
  TouchableOpacity,
  View
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import RemoteImageWithStatus from '../components/RemoteImageWithStatus';

const BASE_URL = Constants.expoConfig?.extra?.BASE_URL;
const STEPS = ['requested', 'approved', 'in_transit', 'completed'];
const terminal = ['rejected', 'cancelled'];

export default function ReplacementHistory() {
  const router = useRouter();
  const { token } = useSelector((state: RootState) => state.user);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);
  const [fullImage, setFullImage] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const load = useCallback(async () => {
    if (!token) return setLoading(false);
    try {
      const response = await axios.get(`${BASE_URL}/api/replacements/`, { headers: { Authorization: `Bearer ${token}` } });
      setItems(response.data);
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Could not load replacements', text2: error.response?.data?.error });
    } finally { setLoading(false); setRefreshing(false); }
  }, [token]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const cancel = (id: number) => Alert.alert('Cancel request?', 'Only pending requests can be cancelled.', [
    { text: 'Keep', style: 'cancel' },
    { text: 'Cancel request', style: 'destructive', onPress: async () => {
      setActionId(id);
      try {
        await axios.post(`${BASE_URL}/api/replacements/${id}/cancel/`, {}, { headers: { Authorization: `Bearer ${token}` } });
        Toast.show({ type: 'success', text1: 'Replacement request cancelled' });
        await load();
      } catch (error: any) {
        Toast.show({ type: 'error', text1: 'Cannot cancel', text2: error.response?.data?.error });
      } finally { setActionId(null); }
    } },
  ]);

  useEffect(() => {
    if (!token || !BASE_URL) return;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let active = true;
    let attempts = 0;

    const connect = () => {
      socket = new WebSocket(`${BASE_URL.replace(/^http/, 'ws')}/ws/orders/?token=${token}`);
      socket.onopen = () => { attempts = 0; load(); };
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          const notification = message?.data?.notification;
          const eventType = notification?.notification_type || notification?.data?.type;
          if (message.type === 'fulfillment_update' && message.action === 'app_notification' && String(eventType || '').toLowerCase().startsWith('replacement_')) {
            load();
            Toast.show({ type: 'info', text1: notification?.title || 'Replacement updated', text2: notification?.body });
          }
        } catch (error) { console.warn('Replacement WS parse error', error); }
      };
      socket.onclose = () => {
        if (!active) return;
        const delay = Math.min(10000, Math.pow(2, attempts++) * 1000);
        reconnectTimer = setTimeout(connect, delay);
      };
      socket.onerror = () => socket?.close();
    };
    connect();
    return () => { active = false; if (reconnectTimer) clearTimeout(reconnectTimer); socket?.close(); };
  }, [load, token]);

  const renderItem = ({ item }: any) => {
    const currentIndex = STEPS.indexOf(item.status);
    const flow = item.is_walk_in ? STEPS.filter((step) => step !== 'in_transit') : STEPS;
    const arrivalMs = item.estimated_arrival_at ? new Date(item.estimated_arrival_at).getTime() : 0;
    const remainingMinutes = arrivalMs ? Math.max(0, Math.ceil((arrivalMs - now) / 60000)) : null;
    return <View className="mx-4 mb-4 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
      <View className="flex-row items-start justify-between">
        <View><Text className="text-base font-black text-slate-900">Order #{item.order}</Text><Text className="mt-1 text-xs text-slate-400">{item.store_name} · {new Date(item.created_at).toLocaleString()}</Text></View>
        <View className={`rounded-full px-3 py-1 ${terminal.includes(item.status) ? 'bg-red-50' : item.status === 'completed' ? 'bg-emerald-50' : 'bg-orange-50'}`}><Text className="text-[10px] font-black uppercase text-slate-700">{item.status_display || item.status.replace('_', ' ')}</Text></View>
      </View>
      <Text className="mt-4 text-sm font-bold text-slate-700">{item.reason_display || item.reason.replace('_', ' ')}</Text>
      {!!item.description && <Text className="mt-1 text-sm text-slate-500">{item.description}</Text>}
      {!!item.proof_image_url && <TouchableOpacity activeOpacity={0.9} onPress={() => setFullImage(item.proof_image_url)} className="mt-3 overflow-hidden rounded-2xl bg-slate-100"><View className="h-40 w-full"><RemoteImageWithStatus uri={item.proof_image_url} loadingLabel="Loading proof image" /></View><View className="absolute bottom-2 right-2 flex-row items-center rounded-full bg-slate-950/80 px-3 py-2"><MaterialCommunityIcons name="magnify-plus-outline" size={16} color="white" /><Text className="ml-1 text-[9px] font-black text-white">VIEW FULL</Text></View></TouchableOpacity>}
      {!terminal.includes(item.status) && <View className="mt-5 flex-row items-start justify-between">{flow.map((step, index) => {
        const stepIndex = STEPS.indexOf(step); const active = currentIndex >= stepIndex;
        return <View key={step} className="flex-1 items-center"><View className={`h-7 w-7 items-center justify-center rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-200'}`}><MaterialCommunityIcons name={active ? 'check' : 'circle-small'} size={16} color="white" /></View><Text className="mt-2 text-center text-[8px] font-black uppercase text-slate-500">{step.replace('_', ' ')}</Text></View>;
      })}</View>}
      {!!item.store_note && <View className="mt-4 rounded-2xl bg-blue-50 p-3"><Text className="text-[10px] font-black uppercase text-blue-500">Store update</Text><Text className="mt-1 text-sm text-blue-900">{item.store_note}</Text></View>}
      {!!item.delivery_person && <View className="mt-4 rounded-3xl border border-emerald-100 bg-emerald-50 p-4"><View className="flex-row items-center"><View className="h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600"><MaterialCommunityIcons name="bike-fast" size={23} color="white" /></View><View className="ml-3 flex-1"><Text className="text-[9px] font-black uppercase tracking-wider text-emerald-600">Your delivery person</Text><Text className="mt-0.5 text-base font-black text-emerald-950">{item.delivery_person.name}</Text></View>{item.delivery_person.contact_visible && item.delivery_person.mobile ? <TouchableOpacity onPress={() => Linking.openURL(`tel:${item.delivery_person.mobile}`)} className="h-10 w-10 items-center justify-center rounded-xl bg-white"><MaterialCommunityIcons name="phone" size={20} color="#059669" /></TouchableOpacity> : null}</View><View className="mt-3 border-t border-emerald-100 pt-3">{item.delivery_person.contact_visible ? <><Text className="font-bold text-emerald-900">{item.delivery_person.mobile}</Text><Text className="mt-1 text-xs text-emerald-700">{item.delivery_person.vehicle_type}{item.delivery_person.vehicle_number ? ` · ${item.delivery_person.vehicle_number}` : ''}</Text></> : <Text className="text-xs font-bold text-slate-500">Contact details hidden after the delivery privacy window.</Text>}<Text className="mt-2 font-black text-emerald-700">{item.status === 'completed' ? 'Replacement delivered' : remainingMinutes === 0 ? 'Expected any moment' : `Expected in about ${remainingMinutes} minutes`}</Text>{!!item.estimated_arrival_at && item.status !== 'completed' && <Text className="mt-1 text-xs text-emerald-600">Estimated arrival: {new Date(item.estimated_arrival_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>}</View></View>}
      {item.status === 'requested' && <TouchableOpacity disabled={actionId === item.id} onPress={() => cancel(item.id)} className="mt-4 items-center rounded-2xl border border-red-100 bg-red-50 py-3">{actionId === item.id ? <ActivityIndicator color="#dc2626" /> : <Text className="font-black text-red-600">Cancel Request</Text>}</TouchableOpacity>}
    </View>;
  };

  return <SafeAreaView className="flex-1 bg-slate-50"><Modal visible={!!fullImage} transparent animationType="fade" onRequestClose={() => setFullImage(null)}><View className="flex-1 bg-black"><TouchableOpacity onPress={() => setFullImage(null)} className="absolute right-5 top-12 z-20 h-12 w-12 items-center justify-center rounded-full bg-white/20"><MaterialCommunityIcons name="close" size={27} color="white" /></TouchableOpacity>{fullImage && <View className="h-full w-full"><RemoteImageWithStatus uri={fullImage} resizeMode="contain" loadingLabel="Opening full image" /></View>}</View></Modal><View className="flex-row items-center border-b border-slate-100 bg-white px-4 py-4"><TouchableOpacity onPress={() => router.back()} className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-slate-100"><MaterialCommunityIcons name="arrow-left" size={22} color="#0f172a" /></TouchableOpacity><View><Text className="text-xl font-black text-slate-900">My Replacements</Text><Text className="text-xs text-slate-400">Track every replacement request</Text></View></View>{loading ? <View className="flex-1 items-center justify-center"><ActivityIndicator size="large" color="#ea580c" /></View> : <FlatList data={items} renderItem={renderItem} keyExtractor={(item) => String(item.id)} contentContainerStyle={{ paddingTop: 16, paddingBottom: 40, flexGrow: 1 }} refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} ListEmptyComponent={<View className="flex-1 items-center justify-center p-10"><MaterialCommunityIcons name="package-variant" size={54} color="#cbd5e1" /><Text className="mt-4 font-bold text-slate-500">No replacement requests yet</Text></View>} />}</SafeAreaView>;
}
