import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/Language/LocalizedPrimitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  View
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import RemoteImageWithStatus from '../../components/RemoteImageWithStatus';

const BASE_URL = Constants.expoConfig?.extra?.BASE_URL;
type Action = 'approve' | 'reject' | 'in-transit' | 'complete';
type DeliveryPerson = { id: number; name: string; mobile: string; vehicle_type: string; vehicle_number?: string; is_active: boolean; is_available: boolean; current_order_count: number; max_concurrent_orders: number };
const actionMeta: Record<Action, { title: string; button: string; placeholder: string }> = {
  approve: { title: 'Approve Replacement', button: 'Approve', placeholder: 'Pickup instructions or delivery plan (required)' },
  reject: { title: 'Reject Replacement', button: 'Reject', placeholder: 'Reason for rejection (required)' },
  'in-transit': { title: 'Dispatch Replacement', button: 'Mark In Transit', placeholder: 'Courier or dispatch details (optional)' },
  complete: { title: 'Complete Replacement', button: 'Complete', placeholder: 'Completion confirmation note (required)' },
};

function ReplacementActionModal({ target, action, note, setNote, people, selectedPersonId, setSelectedPersonId, eta, setEta, submitting, onClose, onSubmit }: any) {
  const meta = actionMeta[action as Action];
  return <Modal visible={target !== null} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
    <View className="flex-1 justify-end bg-black/60">
      <View className="max-h-[92%] rounded-t-[2rem] bg-white">
        <View className="flex-row items-center justify-between border-b border-slate-100 px-6 py-5">
          <Text className="text-lg font-black text-slate-900">{meta.title}</Text>
          <TouchableOpacity onPress={onClose} disabled={submitting} className="h-10 w-10 items-center justify-center rounded-xl bg-slate-100"><MaterialCommunityIcons name="close" size={21} color="#0f172a" /></TouchableOpacity>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
          {(action === 'approve' || action === 'in-transit') && <View className="rounded-2xl bg-blue-50 p-3"><Text className="text-[10px] font-black uppercase text-blue-600">Delivery location</Text><Text className="mt-1 text-sm font-bold text-blue-950">{target?.original_order?.customer_address || 'Address unavailable'}</Text><Text className="mt-2 font-black text-blue-700">{target?.original_order?.distance_km ? `${target.original_order.distance_km} km from store` : 'Distance unavailable'}</Text></View>}
          {action === 'in-transit' && <View className="mt-4">
            <Text className="mb-2 text-[10px] font-black uppercase text-slate-500">Select delivery person</Text>
            {people.filter((person: DeliveryPerson) => person.is_active).map((person: DeliveryPerson) => { const available = person.is_available && person.current_order_count < person.max_concurrent_orders; const selected = selectedPersonId === person.id; return <TouchableOpacity key={person.id} disabled={!available} onPress={() => setSelectedPersonId(person.id)} className={`mb-2 flex-row items-center rounded-2xl border p-3 ${selected ? 'border-blue-500 bg-blue-50' : available ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-50'}`}><MaterialCommunityIcons name={selected ? 'radiobox-marked' : 'radiobox-blank'} size={20} color={selected ? '#2563eb' : '#94a3b8'} /><View className="ml-3 flex-1"><Text className="font-black text-slate-900">{person.name}</Text><Text className="text-xs text-slate-500">{person.mobile} · {person.vehicle_type}{person.vehicle_number ? ` · ${person.vehicle_number}` : ''}</Text></View><Text className={`text-[9px] font-black uppercase ${available ? 'text-emerald-600' : 'text-red-500'}`}>{available ? 'Available' : 'Busy'}</Text></TouchableOpacity>; })}
            {!people.some((person: DeliveryPerson) => person.is_active) && <Text className="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-600">Add an active delivery person in Seller Settings first.</Text>}
            <Text className="mb-2 mt-3 text-[10px] font-black uppercase text-slate-500">Expected delivery time</Text>
            <View className="flex-row items-center rounded-2xl border border-slate-200 bg-slate-50 px-4"><TextInput value={eta} onChangeText={setEta} keyboardType="number-pad" placeholder="45" className="flex-1 py-3 text-slate-900" /><Text className="font-bold text-slate-500">minutes</Text></View>
          </View>}
          <TextInput value={note} onChangeText={setNote} placeholder={meta.placeholder} placeholderTextColor="#94a3b8" multiline numberOfLines={4} className="mt-4 min-h-[100px] rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-900" style={{ textAlignVertical: 'top' }} />
          <View className="mt-5 flex-row gap-3"><TouchableOpacity disabled={submitting} onPress={onClose} className="flex-1 items-center rounded-xl bg-slate-100 py-4"><Text className="font-bold text-slate-700">Cancel</Text></TouchableOpacity><TouchableOpacity disabled={submitting} onPress={onSubmit} className="flex-1 items-center rounded-xl bg-orange-600 py-4">{submitting ? <ActivityIndicator color="white" /> : <Text className="font-black text-white">{meta.button}</Text>}</TouchableOpacity></View>
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

export default function StoreReplacements() {
  const { token } = useSelector((state: RootState) => state.user);
  const [items, setItems] = useState<any[]>([]);
  const [deliveryPeople, setDeliveryPeople] = useState<DeliveryPerson[]>([]);
  const [selectedDeliveryPersonId, setSelectedDeliveryPersonId] = useState<number | null>(null);
  const [deliveryEta, setDeliveryEta] = useState('45');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [target, setTarget] = useState<any>(null);
  const [detailItem, setDetailItem] = useState<any>(null);
  const [fullImage, setFullImage] = useState<string | null>(null);
  const [action, setAction] = useState<Action>('approve');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!token) return setLoading(false);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [replacementResponse, peopleResponse] = await Promise.all([
        axios.get(`${BASE_URL}/api/store/replacements/`, { headers }),
        axios.get(`${BASE_URL}/api/store/delivery-persons/`, { headers }),
      ]);
      setItems(replacementResponse.data);
      setDeliveryPeople(peopleResponse.data);
    } catch (error: any) { Toast.show({ type: 'error', text1: 'Could not load replacements', text2: error.response?.data?.error }); }
    finally { setLoading(false); setRefreshing(false); }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const openAction = (item: any, nextAction: Action) => {
    setFullImage(null);
    setDetailItem(null);
    setAction(nextAction);
    setNote(nextAction === 'approve' && item.is_walk_in ? 'Please visit the store for replacement.' : '');
    setSelectedDeliveryPersonId(null);
    setDeliveryEta('45');
    setTarget(item);
  };
  const submit = async () => {
    const required = action !== 'in-transit';
    if (required && !note.trim()) return Toast.show({ type: 'error', text1: 'A note is required' });
    if (action === 'in-transit' && !selectedDeliveryPersonId) return Toast.show({ type: 'error', text1: 'Select a delivery person' });
    const eta = Number(deliveryEta);
    if (action === 'in-transit' && (!Number.isInteger(eta) || eta < 5 || eta > 240)) return Toast.show({ type: 'error', text1: 'ETA must be 5 to 240 minutes' });
    setSubmitting(true);
    try {
      await axios.post(`${BASE_URL}/api/store/replacements/${target.id}/${action}/`, {
        store_note: note.trim(),
        delivery_person_id: action === 'in-transit' ? selectedDeliveryPersonId : undefined,
        estimated_delivery_minutes: action === 'in-transit' ? eta : undefined,
      }, { headers: { Authorization: `Bearer ${token}` } });
      Toast.show({ type: 'success', text1: `${actionMeta[action].button} successful` });
      setTarget(null); setNote(''); await load();
    } catch (error: any) { Toast.show({ type: 'error', text1: 'Action failed', text2: error.response?.data?.error }); }
    finally { setSubmitting(false); }
  };

  useEffect(() => {
    if (!token || !BASE_URL) return;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let active = true;
    let attempts = 0;

    const connect = () => {
      socket = new WebSocket(`${BASE_URL.replace(/^http/, 'ws')}/ws/store-orders/?token=${token}`);
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

  const renderItem = ({ item }: any) => <View className="mb-4 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
    <View className="flex-row items-start justify-between"><View><Text className="text-base font-black text-slate-900">Order #{item.order}</Text><Text className="mt-1 text-xs text-slate-400">{new Date(item.created_at).toLocaleString()}</Text></View><View className="rounded-full bg-orange-50 px-3 py-1"><Text className="text-[10px] font-black uppercase text-orange-700">{item.status_display || item.status.replace('_', ' ')}</Text></View></View>
    <View className="mt-4 rounded-2xl bg-slate-50 p-3"><Text className="text-[10px] font-black uppercase text-slate-400">Customer</Text><Text className="mt-1 font-bold text-slate-800">{item.user_name} · {item.user_mobile}</Text><Text className="mt-1 text-xs font-bold text-blue-600">{item.is_walk_in ? 'Walk-in pickup' : 'Home delivery'}</Text></View>
    <Text className="mt-4 font-bold text-slate-700">{item.reason_display || item.reason.replace('_', ' ')}</Text>{!!item.description && <Text className="mt-1 text-sm text-slate-500">{item.description}</Text>}
    {!!item.proof_image_url && <TouchableOpacity activeOpacity={0.9} onPress={() => setFullImage(item.proof_image_url)} className="mt-3 overflow-hidden rounded-2xl bg-slate-100"><View className="h-44 w-full"><RemoteImageWithStatus uri={item.proof_image_url} loadingLabel="Loading proof image" /></View><View className="absolute bottom-2 right-2 flex-row items-center rounded-full bg-slate-950/80 px-3 py-2"><MaterialCommunityIcons name="magnify-plus-outline" size={16} color="white" /><Text className="ml-1 text-[9px] font-black text-white">VIEW FULL</Text></View></TouchableOpacity>}
    {!!item.store_note && <View className="mt-3 rounded-xl bg-blue-50 p-3"><Text className="text-xs text-blue-900">{item.store_note}</Text></View>}
    {!!item.delivery_person && <View className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-3"><Text className="text-[10px] font-black uppercase text-emerald-600">Assigned delivery person</Text><Text className="mt-1 font-black text-emerald-950">{item.delivery_person.name} · {item.delivery_person.mobile}</Text><Text className="mt-1 text-xs text-emerald-700">{item.delivery_person.vehicle_type}{item.delivery_person.vehicle_number ? ` · ${item.delivery_person.vehicle_number}` : ''} · ETA {item.estimated_delivery_minutes} min</Text></View>}
    <TouchableOpacity onPress={() => setDetailItem(item)} className="mt-4 flex-row items-center justify-center rounded-xl border border-blue-100 bg-blue-50 py-3"><MaterialCommunityIcons name="file-document-outline" size={18} color="#2563eb" /><Text className="ml-2 font-black text-blue-700">View Original Order</Text></TouchableOpacity>
    {item.status === 'requested' && <View className="mt-3 flex-row gap-3"><TouchableOpacity onPress={() => openAction(item, 'reject')} className="flex-1 items-center rounded-xl bg-red-50 py-3"><Text className="font-black text-red-600">Reject</Text></TouchableOpacity><TouchableOpacity onPress={() => setDetailItem(item)} className="flex-1 items-center rounded-xl bg-emerald-50 py-3"><Text className="font-black text-emerald-700">Review & Approve</Text></TouchableOpacity></View>}
    {item.status === 'approved' && !item.is_walk_in && <TouchableOpacity activeOpacity={0.75} disabled={submitting} onPress={() => openAction(item, 'in-transit')} className="mt-4 flex-row items-center justify-center rounded-xl bg-blue-600 py-4"><MaterialCommunityIcons name="truck-fast-outline" size={19} color="white" /><Text className="ml-2 font-black text-white">Mark In Transit</Text></TouchableOpacity>}
    {((item.status === 'approved' && item.is_walk_in) || item.status === 'in_transit') && <TouchableOpacity onPress={() => openAction(item, 'complete')} className="mt-4 items-center rounded-xl bg-emerald-600 py-3"><Text className="font-black text-white">Complete Replacement</Text></TouchableOpacity>}
  </View>;

  return <SafeAreaView className="flex-1 bg-slate-50"><View className="border-b border-slate-100 bg-white px-5 py-4"><Text className="text-xl font-black text-slate-900">Replacement Requests</Text><Text className="text-xs text-slate-400">Approve, dispatch and complete replacements</Text></View>{loading ? <View className="flex-1 items-center justify-center"><ActivityIndicator size="large" color="#ea580c" /></View> : <FlatList data={items} renderItem={renderItem} keyExtractor={(item) => String(item.id)} contentContainerStyle={{ padding: 16, paddingBottom: 60, flexGrow: 1 }} refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} ListEmptyComponent={<View className="flex-1 items-center justify-center"><MaterialCommunityIcons name="package-variant" size={52} color="#cbd5e1" /><Text className="mt-4 font-bold text-slate-500">No replacement requests</Text></View>} />}
    <Modal visible={!!fullImage} transparent animationType="fade" onRequestClose={() => setFullImage(null)}><View className="flex-1 bg-black"><TouchableOpacity onPress={() => setFullImage(null)} className="absolute right-5 top-12 z-20 h-12 w-12 items-center justify-center rounded-full bg-white/20"><MaterialCommunityIcons name="close" size={27} color="white" /></TouchableOpacity>{fullImage && <View className="h-full w-full"><RemoteImageWithStatus uri={fullImage} resizeMode="contain" loadingLabel="Opening full image" /></View>}</View></Modal>
    <Modal visible={!!detailItem} transparent animationType="slide" onRequestClose={() => setDetailItem(null)}><View className="flex-1 justify-end bg-black/60"><View className="max-h-[92%] rounded-t-[2rem] bg-white"><View className="flex-row items-center justify-between border-b border-slate-100 p-5"><View><Text className="text-xl font-black text-slate-900">Original Order #{detailItem?.order}</Text><Text className="text-xs text-slate-400">Review before replacement approval</Text></View><TouchableOpacity onPress={() => setDetailItem(null)} className="h-10 w-10 items-center justify-center rounded-xl bg-slate-100"><MaterialCommunityIcons name="close" size={21} color="#0f172a" /></TouchableOpacity></View><ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 36 }}>{!!detailItem?.original_order?.prescription_image_url && <TouchableOpacity activeOpacity={0.9} onPress={() => setFullImage(detailItem.original_order.prescription_image_url)} className="overflow-hidden rounded-3xl bg-slate-100"><View className="h-64 w-full"><RemoteImageWithStatus uri={detailItem.original_order.prescription_image_url} resizeMode="contain" loadingLabel="Loading prescription" /></View><View className="absolute bottom-3 right-3 flex-row items-center rounded-full bg-slate-950/80 px-3 py-2"><MaterialCommunityIcons name="magnify-plus-outline" size={16} color="white" /><Text className="ml-1 text-[9px] font-black text-white">VIEW FULL</Text></View></TouchableOpacity>}<View className="mt-4 rounded-2xl border border-orange-100 bg-orange-50 p-4"><Text className="text-[10px] font-black uppercase text-orange-600">Replacement issue</Text><Text className="mt-1 font-black text-slate-900">{detailItem?.reason_display}</Text>{!!detailItem?.description && <Text className="mt-1 text-sm text-slate-600">{detailItem.description}</Text>}</View><View className="mt-4 rounded-2xl bg-slate-50 p-4"><Text className="text-[10px] font-black uppercase text-slate-400">Customer & delivery</Text><Text className="mt-2 font-black text-slate-900">{detailItem?.user_name} · {detailItem?.user_mobile}</Text><Text className="mt-2 text-sm leading-5 text-slate-600">{detailItem?.original_order?.customer_address || 'Address unavailable'}</Text><View className="mt-3 flex-row gap-2"><View className="rounded-full bg-blue-100 px-3 py-1.5"><Text className="text-[10px] font-black text-blue-700">{detailItem?.original_order?.distance_km ? `${detailItem.original_order.distance_km} km away` : 'Distance unavailable'}</Text></View><View className="rounded-full bg-emerald-100 px-3 py-1.5"><Text className="text-[10px] font-black text-emerald-700">{detailItem?.is_walk_in ? 'Walk-in' : 'Home delivery'}</Text></View></View></View>{!!detailItem?.original_order?.prescription_medicine_name && <View className="mt-4"><Text className="text-[10px] font-black uppercase text-slate-400">Prescription request</Text><Text className="mt-2 font-black text-slate-900">{detailItem.original_order.prescription_medicine_name}</Text><Text className="mt-1 text-sm text-slate-600">{detailItem.original_order.prescription_description}</Text></View>}<View className="mt-5"><Text className="text-[10px] font-black uppercase text-slate-400">Medicines supplied</Text>{detailItem?.original_order?.medicines?.length ? detailItem.original_order.medicines.map((medicine: any, index: number) => <View key={`${medicine.name}-${index}`} className="mt-2 rounded-2xl border border-slate-100 bg-white p-4"><View className="flex-row justify-between"><View className="flex-1"><Text className="font-black text-slate-900">{medicine.name}</Text><Text className="mt-1 text-xs text-slate-500">{medicine.brand || 'Brand not specified'} · {medicine.type}</Text></View><Text className="font-black text-emerald-700">{medicine.price ? `₹${medicine.price}` : 'Price N/A'}</Text></View></View>) : <Text className="mt-2 text-sm text-slate-500">No itemized medicines were recorded for this order.</Text>}</View><View className="mt-5 rounded-2xl bg-slate-900 p-4"><View className="flex-row justify-between"><Text className="font-bold text-white">Original total</Text><Text className="font-black text-emerald-300">{detailItem?.original_order?.total_amount ? `₹${detailItem.original_order.total_amount}` : 'N/A'}</Text></View>{!!detailItem?.original_order?.response_text && <Text className="mt-3 text-sm text-slate-300">Store quote: {detailItem.original_order.response_text}</Text>}</View><View className="mt-5"><Text className="text-[10px] font-black uppercase text-slate-400">Original order timeline</Text>{detailItem?.original_order?.timeline?.map((entry: any, index: number) => <View key={`${entry.to_status}-${index}`} className="mt-3 flex-row"><View className="mt-1 h-3 w-3 rounded-full bg-emerald-500" /><View className="ml-3 flex-1"><Text className="font-bold capitalize text-slate-800">{entry.from_status} → {entry.to_status}</Text><Text className="text-xs text-slate-400">{new Date(entry.created_at).toLocaleString()}{entry.changed_by ? ` · ${entry.changed_by}` : ''}</Text></View></View>)}</View>{detailItem?.status === 'requested' && <TouchableOpacity onPress={() => { const item = detailItem; setDetailItem(null); openAction(item, 'approve'); }} className="mt-6 items-center rounded-2xl bg-emerald-600 py-4"><Text className="font-black text-white">Continue to Approve</Text></TouchableOpacity>}</ScrollView></View></View></Modal>
    <ReplacementActionModal target={target} action={action} note={note} setNote={setNote} people={deliveryPeople} selectedPersonId={selectedDeliveryPersonId} setSelectedPersonId={setSelectedDeliveryPersonId} eta={deliveryEta} setEta={setDeliveryEta} submitting={submitting} onClose={() => setTarget(null)} onSubmit={submit} />
  </SafeAreaView>;
}
