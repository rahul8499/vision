import { LocalizedText as Text } from '@/components/Language/LocalizedPrimitives';
import RemoteImageWithStatus from '@/components/RemoteImageWithStatus';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, AppState, FlatList, Modal, RefreshControl, ScrollView,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import Toast from 'react-native-toast-message';

type StoreDispatch = {
  id: number; name: string; address?: string; image?: string; distance_km?: number | null;
  average_rating: number; ratings_count: number; typical_response_minutes: number;
  batch_number: number; dispatch_status: string; opened_at?: string | null; responded_at?: string | null;
};

type EmergencyRequest = {
  id: number; status: string; dispatch_status: string; dispatch_current_batch: number;
  dispatch_next_check_at?: string | null; created_at: string; cancelled_at?: string | null;
  medicine_name?: string | null; description?: string | null; image?: string | null; address?: string | null;
  stores_notified: number; stores_opened: number; stores_responded: number; quotes_received: number;
  billing?: { kind: string; status: string; amount_paise: number; amount_rupees: number; refund_reason?: string; refunded_at?: string | null } | null;
  can_cancel: boolean; stores: StoreDispatch[];
};

const BASE_URL = Constants.expoConfig?.extra?.BASE_URL;
const TERMINAL = new Set(['cancelled', 'fulfilled', 'no_store_available']);
const statusCopy: Record<string, { title: string; body: string; color: string; icon: any }> = {
  dispatching: { title: 'Starting pharmacy search', body: 'Finding verified pharmacies around your confirmed location.', color: '#e11d48', icon: 'radar' },
  stores_notified: { title: 'Pharmacies notified', body: 'Your request is live. Pharmacies can now review and quote.', color: '#ea580c', icon: 'broadcast' },
  quote_received: { title: 'Quotation received', body: 'Open My Offers to compare the pharmacy response.', color: '#059669', icon: 'message-text-fast-outline' },
  quotes_ready: { title: 'Quotations ready', body: 'The dispatch target has been reached. Review your offers.', color: '#059669', icon: 'check-decagram-outline' },
  order_confirmed: { title: 'Order confirmed', body: 'Continue tracking fulfillment from My Orders.', color: '#2563eb', icon: 'package-variant-closed-check' },
  fulfilled: { title: 'Request fulfilled', body: 'The associated pharmacy order is completed.', color: '#047857', icon: 'check-circle-outline' },
  cancelled: { title: 'Request cancelled', body: 'Pharmacies will no longer receive this request.', color: '#64748b', icon: 'close-circle-outline' },
  no_store_available: { title: 'No pharmacy response', body: 'No eligible pharmacy was available in the current search area.', color: '#b45309', icon: 'store-alert-outline' },
};

export default function EmergencyRequestsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<EmergencyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<EmergencyRequest | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<EmergencyRequest | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelBusy, setCancelBusy] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  const fetchRequests = useCallback(async (quiet = false) => {
    const token = await SecureStore.getItemAsync('authToken');
    if (!token) return;
    if (!quiet) setLoading(true);
    try {
      const response = await axios.get(`${BASE_URL}/api/emergency-requests/`, { headers: { Authorization: `Bearer ${token}` } });
      setItems(response.data.results || []);
      setSelected(current => current ? (response.data.results || []).find((item: EmergencyRequest) => item.id === current.id) || null : null);
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Could not load emergency requests', text2: error.response?.data?.error || 'Pull down to retry.' });
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchRequests(); }, [fetchRequests]));

  useEffect(() => {
    let mounted = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const connect = async () => {
      const token = await SecureStore.getItemAsync('authToken');
      if (!mounted || !token || !BASE_URL) return;
      const ws = new WebSocket(`${BASE_URL.replace(/^http/, 'ws')}/ws/orders/?token=${token}`);
      socketRef.current = ws;
      ws.onmessage = event => {
        try {
          const payload = JSON.parse(event.data);
          if (payload?.type === 'fulfillment_update') fetchRequests(true);
        } catch { /* REST reconciliation remains authoritative. */ }
      };
      ws.onclose = () => { if (mounted) retry = setTimeout(connect, 2500); };
      ws.onerror = () => ws.close();
    };
    connect();
    const interval = setInterval(() => fetchRequests(true), 15000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') fetchRequests(true); });
    return () => { mounted = false; if (retry) clearTimeout(retry); clearInterval(interval); subscription.remove(); socketRef.current?.close(); };
  }, [fetchRequests]);

  const cancelRequest = async () => {
    if (!cancelTarget) return;
    const token = await SecureStore.getItemAsync('authToken');
    if (!token) return;
    setCancelBusy(true);
    try {
      await axios.post(`${BASE_URL}/api/emergency-requests/${cancelTarget.id}/cancel/`, { reason: cancelReason.trim() }, { headers: { Authorization: `Bearer ${token}` } });
      setCancelTarget(null); setCancelReason(''); setSelected(null);
      Toast.show({ type: 'success', text1: 'Emergency request cancelled' });
      await fetchRequests(true);
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Cancellation failed', text2: error.response?.data?.error || 'Please try again.' });
    } finally { setCancelBusy(false); }
  };

  const renderRequest = ({ item }: { item: EmergencyRequest }) => {
    const copy = statusCopy[item.status] || statusCopy.dispatching;
    const active = !TERMINAL.has(item.status);
    return (
      <TouchableOpacity onPress={() => setSelected(item)} activeOpacity={0.85} className="mx-4 mb-4 overflow-hidden rounded-[28px] border border-slate-200 bg-white p-5">
        <View className="flex-row items-start">
          <View style={{ backgroundColor: `${copy.color}15` }} className="h-12 w-12 items-center justify-center rounded-2xl">
            <MaterialCommunityIcons name={copy.icon} size={25} color={copy.color} />
          </View>
          <View className="ml-4 flex-1">
            <View className="flex-row items-center justify-between">
              <Text className="text-[10px] font-black uppercase tracking-[2px] text-rose-600">Emergency #{item.id}</Text>
              {active && <View className="rounded-full bg-rose-50 px-2.5 py-1"><Text className="text-[8px] font-black uppercase text-rose-600">Live</Text></View>}
            </View>
            <Text className="mt-1 text-base font-black text-slate-900">{copy.title}</Text>
            <Text className="mt-1 text-xs leading-5 text-slate-500">{copy.body}</Text>
          </View>
        </View>
        <View className="mt-5 flex-row rounded-2xl bg-slate-50 p-3">
          {[['broadcast', item.stores_notified, 'Notified'], ['eye-outline', item.stores_opened, 'Opened'], ['message-text-outline', item.quotes_received, 'Quotes']].map(([icon, value, label]) => (
            <View key={String(label)} className="flex-1 items-center"><MaterialCommunityIcons name={icon as any} size={16} color="#64748b" /><Text className="mt-1 font-black text-slate-900">{String(value)}</Text><Text className="text-[8px] font-bold uppercase text-slate-400">{String(label)}</Text></View>
          ))}
        </View>
        {item.billing && <View className={`mt-3 rounded-xl px-3 py-2 ${item.billing.status === 'refunded' ? 'bg-blue-50' : item.billing.status === 'service_delivered' ? 'bg-emerald-50' : 'bg-amber-50'}`}><Text className="text-[10px] font-black uppercase text-slate-700">{item.billing.kind === 'free' ? 'FREE Emergency Broadcast' : '₹5 Emergency Broadcast'} · {item.billing.status.replace(/_/g, ' ')}</Text>{item.billing.refund_reason ? <Text className="mt-1 text-[10px] text-slate-500">{item.billing.refund_reason}</Text> : null}</View>}
        <Text className="mt-4 text-[10px] font-semibold text-slate-400">{new Date(item.created_at).toLocaleString()} · Batch {item.dispatch_current_batch || 0}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 bg-slate-50">
      <View className="border-b border-slate-100 bg-white px-5 pb-5 pt-4">
        <View className="flex-row items-center justify-between"><View><Text className="text-2xl font-black text-slate-950">Emergency Requests</Text><Text className="mt-1 text-xs text-slate-500">Live pharmacy search and history</Text></View><TouchableOpacity onPress={() => router.push('/(tabs)' as any)} className="rounded-2xl bg-rose-600 px-4 py-3"><Text className="text-[10px] font-black uppercase text-white">New request</Text></TouchableOpacity></View>
        <TouchableOpacity onPress={() => router.push('/(tabs)/emergency-payments' as any)} className="mt-4 flex-row items-center rounded-2xl border border-blue-100 bg-blue-50 p-3"><View className="h-9 w-9 items-center justify-center rounded-xl bg-blue-600"><MaterialCommunityIcons name="credit-card-clock-outline" size={19} color="white" /></View><View className="ml-3 flex-1"><Text className="text-xs font-black text-blue-950">Emergency Payment History</Text><Text className="mt-0.5 text-[9px] font-semibold text-blue-700">Payments, refunds and how many pharmacies received each request</Text></View><MaterialCommunityIcons name="chevron-right" size={22} color="#2563eb" /></TouchableOpacity><View className="mt-3 flex-row rounded-2xl border border-amber-200 bg-amber-50 p-3"><MaterialCommunityIcons name="alert-outline" size={19} color="#b45309" /><Text className="ml-2 flex-1 text-[10px] font-semibold leading-4 text-amber-800">This service contacts pharmacies for medicine availability. It is not emergency medical treatment. For severe symptoms, contact your local emergency medical service immediately.</Text></View>
      </View>
      {loading ? <View className="flex-1 items-center justify-center"><ActivityIndicator size="large" color="#e11d48" /><Text className="mt-3 text-xs font-bold text-slate-500">Loading emergency requests</Text></View> : (
        <FlatList data={items} keyExtractor={item => String(item.id)} renderItem={renderRequest} contentContainerStyle={{ paddingTop: 18, paddingBottom: 120, flexGrow: items.length ? undefined : 1 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRequests(true); }} />} ListEmptyComponent={<View className="flex-1 items-center justify-center px-10"><MaterialCommunityIcons name="shield-check-outline" size={58} color="#cbd5e1" /><Text className="mt-5 text-lg font-black text-slate-800">No emergency requests</Text><Text className="mt-2 text-center text-sm leading-5 text-slate-500">Emergency-priority pharmacy requests will remain available here after you close the initial message or reopen the app.</Text></View>} />
      )}

      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View className="flex-1 justify-end bg-slate-950/55"><View className="max-h-[90%] rounded-t-[34px] bg-white p-5"><View className="mb-4 flex-row items-center justify-between"><View><Text className="text-xl font-black text-slate-950">Request #{selected?.id}</Text><Text className="mt-1 text-xs text-slate-500">{selected ? statusCopy[selected.status]?.title || selected.status : ''}</Text></View><TouchableOpacity onPress={() => setSelected(null)} className="h-10 w-10 items-center justify-center rounded-full bg-slate-100"><MaterialCommunityIcons name="close" size={21} color="#334155" /></TouchableOpacity></View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {selected?.image && <TouchableOpacity onPress={() => setPreview(selected.image!)} className="h-44 overflow-hidden rounded-3xl bg-slate-100"><RemoteImageWithStatus uri={selected.image} loadingLabel="Loading prescription" /></TouchableOpacity>}
            <View className="mt-4 rounded-2xl bg-slate-900 p-4"><Text className="text-[9px] font-black uppercase tracking-[2px] text-emerald-300">Confirmed location</Text><Text className="mt-2 text-sm font-semibold leading-5 text-white">{selected?.address || 'Pinned map location'}</Text></View>
            {!!selected?.medicine_name && <View className="mt-4"><Text className="text-[9px] font-black uppercase text-slate-400">Medicine request</Text><Text className="mt-1 text-base font-black text-slate-900">{selected.medicine_name}</Text>{!!selected.description && <Text className="mt-1 text-sm text-slate-500">{selected.description}</Text>}</View>}
            {selected?.billing && <View className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4"><Text className="text-[9px] font-black uppercase tracking-[2px] text-slate-400">Broadcast service</Text><Text className="mt-2 text-sm font-black text-slate-900">{selected.billing.kind === 'free' ? 'First broadcast · FREE' : 'Emergency Broadcast · ₹5'}</Text><Text className="mt-1 text-xs capitalize text-slate-500">{selected.billing.status.replace(/_/g, ' ')}</Text>{selected.billing.refund_reason ? <Text className="mt-2 text-xs font-semibold text-blue-700">{selected.billing.refund_reason}</Text> : null}</View>}
            <Text className="mb-2 mt-6 text-[10px] font-black uppercase tracking-[2px] text-slate-400">Pharmacy dispatch</Text>
            {selected?.stores.map(store => <View key={store.id} className="mb-3 rounded-2xl border border-slate-100 bg-slate-50 p-4"><View className="flex-row justify-between"><View className="flex-1 pr-3"><Text className="font-black text-slate-900">{store.name}</Text><Text className="mt-1 text-xs text-slate-500" numberOfLines={2}>{store.address || 'Address unavailable'}</Text></View><Text className="font-black text-rose-600">{store.distance_km == null ? 'Nearby' : `${store.distance_km.toFixed(1)} km`}</Text></View><View className="mt-3 flex-row"><Text className="text-[10px] font-bold text-amber-600">★ {store.average_rating.toFixed(1)} ({store.ratings_count})</Text><Text className="ml-4 text-[10px] font-bold text-slate-500">Usually ~{store.typical_response_minutes} min</Text><Text className="ml-4 text-[10px] font-black uppercase text-emerald-600">{store.responded_at ? 'Responded' : store.opened_at ? 'Viewed' : 'Notified'}</Text></View></View>)}
            {selected?.stores.length === 0 && <Text className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Search is starting. Pull to refresh if pharmacies do not appear shortly.</Text>}
            {!!selected?.quotes_received && <TouchableOpacity onPress={() => { setSelected(null); router.push('/(tabs)/prescription' as any); }} className="mt-4 items-center rounded-2xl bg-emerald-600 py-4"><Text className="font-black text-white">View pharmacy offers</Text></TouchableOpacity>}
            {selected?.can_cancel && <TouchableOpacity onPress={() => { setCancelTarget(selected); setSelected(null); }} className="mb-8 mt-3 items-center rounded-2xl border border-rose-200 bg-rose-50 py-4"><Text className="font-black text-rose-700">Cancel emergency request</Text></TouchableOpacity>}
          </ScrollView>
        </View></View>
      </Modal>

      <Modal visible={!!cancelTarget} transparent animationType="fade" onRequestClose={() => setCancelTarget(null)}><View className="flex-1 items-center justify-center bg-slate-950/60 px-6"><View className="w-full rounded-[28px] bg-white p-6"><Text className="text-xl font-black text-slate-950">Cancel emergency request?</Text><Text className="mt-2 text-sm leading-5 text-slate-500">Pharmacies will be told that this request is no longer active.</Text><TextInput value={cancelReason} onChangeText={setCancelReason} placeholder="Reason (optional)" multiline className="mt-5 min-h-[90px] rounded-2xl bg-slate-100 p-4 text-sm text-slate-900" /><View className="mt-5 flex-row gap-3"><TouchableOpacity disabled={cancelBusy} onPress={() => setCancelTarget(null)} className="flex-1 items-center rounded-2xl bg-slate-100 py-4"><Text className="font-black text-slate-600">Keep active</Text></TouchableOpacity><TouchableOpacity disabled={cancelBusy} onPress={cancelRequest} className="flex-1 items-center rounded-2xl bg-rose-600 py-4">{cancelBusy ? <ActivityIndicator color="white" /> : <Text className="font-black text-white">Cancel request</Text>}</TouchableOpacity></View></View></View></Modal>
      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}><View className="flex-1 bg-black"><TouchableOpacity onPress={() => setPreview(null)} className="absolute right-5 top-14 z-10 h-11 w-11 items-center justify-center rounded-full bg-white/20"><MaterialCommunityIcons name="close" size={25} color="white" /></TouchableOpacity>{preview && <View className="flex-1"><RemoteImageWithStatus uri={preview} resizeMode="contain" loadingLabel="Opening prescription" /></View>}</View></Modal>
    </View>
  );
}
