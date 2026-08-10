import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/Language/LocalizedPrimitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  DeviceEventEmitter,
  FlatList,
  Modal,
  RefreshControl,
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

// Enterprise Color Tokens
const PALETTE = {
  primaryNavy: '#123B5D',
  secondaryTeal: '#0F8B8D',
  background: '#F4F8FA',
  lightTealCard: '#E8F4F5',
  borderTeal: '#B9DDE0',
  whiteCard: '#FFFFFF',
  mainText: '#102A43',
  secondaryText: '#627D98',
  successGreen: '#16A34A',
  warningAmber: '#F59E0B',
  errorRed: '#DC2626',
};

type Action = 'approve' | 'reject' | 'in-transit' | 'complete';
type DeliveryPerson = {
  id: number;
  name: string;
  mobile: string;
  vehicle_type: string;
  vehicle_number?: string;
  is_active: boolean;
  is_available: boolean;
  current_order_count: number;
  max_concurrent_orders: number;
};

const actionMeta: Record<Action, { title: string; button: string; placeholder: string; color: string }> = {
  approve: { title: 'Approve Replacement', button: 'Approve', placeholder: 'Pickup instructions or delivery plan (required)', color: PALETTE.secondaryTeal },
  reject: { title: 'Reject Replacement', button: 'Reject', placeholder: 'Reason for rejection (required)', color: PALETTE.errorRed },
  'in-transit': { title: 'Dispatch Replacement', button: 'Mark In Transit', placeholder: 'Courier or dispatch details (optional)', color: PALETTE.primaryNavy },
  complete: { title: 'Complete Replacement', button: 'Complete', placeholder: 'Completion confirmation note (required)', color: PALETTE.successGreen },
};

function ReplacementActionModal({
  target,
  action,
  note,
  setNote,
  people,
  selectedPersonId,
  setSelectedPersonId,
  eta,
  setEta,
  submitting,
  onClose,
  onSubmit,
}: any) {
  const meta = actionMeta[action as Action];
  if (!target) return null;

  return (
    <Modal visible={target !== null} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View className="flex-1 justify-end bg-black/60">
        <View className="max-h-[92%] rounded-t-[2rem] bg-white overflow-hidden shadow-2xl">
          {/* Header Banner */}
          <LinearGradient
            colors={[PALETTE.primaryNavy, PALETTE.secondaryTeal]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="flex-row items-center justify-between px-6 py-5"
          >
            <View>
              <Text className="text-lg font-black text-white">{meta.title}</Text>
              <Text className="text-xs font-semibold text-cyan-100 mt-0.5">Order #{target?.order}</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              disabled={submitting}
              className="h-10 w-10 items-center justify-center rounded-xl bg-white/20"
            >
              <MaterialCommunityIcons name="close" size={21} color="white" />
            </TouchableOpacity>
          </LinearGradient>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
            {(action === 'approve' || action === 'in-transit') && (
              <View className="rounded-2xl bg-[#E8F4F5] border border-[#B9DDE0] p-4 mb-4">
                <Text className="text-[10px] font-black uppercase text-[#0F8B8D] tracking-wider">Delivery Destination</Text>
                <Text className="mt-1 text-sm font-bold text-[#102A43]">
                  {target?.original_order?.customer_address || 'Address unavailable'}
                </Text>
                <Text className="mt-2 text-xs font-black text-[#0F8B8D]">
                  {target?.original_order?.distance_km ? `${target.original_order.distance_km} km from store` : 'Distance unavailable'}
                </Text>
              </View>
            )}

            {action === 'in-transit' && (
              <View className="mt-2 mb-4">
                <Text className="mb-2 text-[10px] font-black uppercase tracking-wider text-[#627D98]">
                  Select Active Delivery Personnel
                </Text>
                {people
                  .filter((person: DeliveryPerson) => person.is_active)
                  .map((person: DeliveryPerson) => {
                    const available = person.is_available && person.current_order_count < person.max_concurrent_orders;
                    const selected = selectedPersonId === person.id;
                    return (
                      <TouchableOpacity
                        key={person.id}
                        disabled={!available}
                        onPress={() => setSelectedPersonId(person.id)}
                        className={`mb-2.5 flex-row items-center rounded-2xl border p-3.5 ${selected
                            ? 'border-[#0F8B8D] bg-[#E8F4F5]'
                            : available
                              ? 'border-[#B9DDE0] bg-white'
                              : 'border-slate-100 bg-slate-50 opacity-50'
                          }`}
                      >
                        <MaterialCommunityIcons
                          name={selected ? 'radiobox-marked' : 'radiobox-blank'}
                          size={20}
                          color={selected ? PALETTE.secondaryTeal : PALETTE.secondaryText}
                        />
                        <View className="ml-3 flex-1">
                          <Text className="font-black text-[#102A43]">{person.name}</Text>
                          <Text className="text-xs text-[#627D98]">
                            {person.mobile} · {person.vehicle_type}
                            {person.vehicle_number ? ` · ${person.vehicle_number}` : ''}
                          </Text>
                        </View>
                        <View className={`rounded-full px-2.5 py-1 ${available ? 'bg-[#EDF8F0]' : 'bg-[#FFF1F1]'}`}>
                          <Text className={`text-[9px] font-black uppercase ${available ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                            {available ? 'Available' : 'Busy'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                {!people.some((person: DeliveryPerson) => person.is_active) && (
                  <View className="rounded-xl bg-[#FFF1F1] border border-[#FECDD3] p-3 mb-2">
                    <Text className="text-xs font-bold text-[#DC2626]">
                      No active delivery personnel found. Add one in Settings first.
                    </Text>
                  </View>
                )}

                <Text className="mb-2 mt-3 text-[10px] font-black uppercase tracking-wider text-[#627D98]">
                  Estimated Delivery Time (Minutes)
                </Text>
                <View className="flex-row items-center rounded-2xl border border-[#B9DDE0] bg-[#F4F8FA] px-4">
                  <TextInput
                    value={eta}
                    onChangeText={setEta}
                    keyboardType="number-pad"
                    placeholder="45"
                    className="flex-1 py-3 text-[#102A43] font-bold"
                  />
                  <Text className="font-bold text-[#627D98]">mins</Text>
                </View>
              </View>
            )}

            <Text className="mb-2 text-[10px] font-black uppercase tracking-wider text-[#627D98]">
              Note / Remarks
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder={meta.placeholder}
              placeholderTextColor={PALETTE.secondaryText}
              multiline
              numberOfLines={4}
              className="min-h-[100px] rounded-2xl border border-[#B9DDE0] bg-[#F4F8FA] p-4 text-[#102A43] font-medium"
              style={{ textAlignVertical: 'top' }}
            />

            <View className="mt-6 flex-row gap-3">
              <TouchableOpacity
                disabled={submitting}
                onPress={onClose}
                className="flex-1 items-center justify-center rounded-xl bg-slate-100 py-4"
              >
                <Text className="font-bold text-slate-700">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={submitting}
                onPress={onSubmit}
                style={{ backgroundColor: meta.color }}
                className="flex-1 items-center justify-center rounded-xl py-4 shadow-sm"
              >
                {submitting ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="font-black text-white">{meta.button}</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function StoreReplacements() {
  const router = useRouter();
  const params = useLocalSearchParams<{ fromDrawer?: string; fromSettings?: string }>();
  const { token } = useSelector((state: RootState) => state.user);

  const handleBack = () => {
    const isFromDrawer = params?.fromDrawer === 'true';
    const isFromSettings = params?.fromSettings === 'true';

    if (isFromSettings) {
      router.push('/(sellerTabs)/settings');
      return;
    }

    if (isFromDrawer) {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.push('/(sellerTabs)/home');
      }
      setTimeout(() => {
        DeviceEventEmitter.emit('open-seller-drawer');
      }, 150);
      return;
    }

    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/(sellerTabs)/settings');
    }
  };
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

  // Status Filter Tab state
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'REQUESTED' | 'APPROVED' | 'IN_TRANSIT' | 'COMPLETED' | 'REJECTED'>('ALL');

  const load = useCallback(async () => {
    if (!token) return setLoading(false);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [replacementResponse, peopleResponse] = await Promise.all([
        axios.get(`${BASE_URL}/api/store/replacements/`, { headers }),
        axios.get(`${BASE_URL}/api/store/delivery-persons/`, { headers }),
      ]);
      setItems(replacementResponse.data || []);
      setDeliveryPeople(peopleResponse.data || []);
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Could not load replacements',
        text2: error.response?.data?.error,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

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
      await axios.post(
        `${BASE_URL}/api/store/replacements/${target.id}/${action}/`,
        {
          store_note: note.trim(),
          delivery_person_id: action === 'in-transit' ? selectedDeliveryPersonId : undefined,
          estimated_delivery_minutes: action === 'in-transit' ? eta : undefined,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Toast.show({ type: 'success', text1: `${actionMeta[action].button} successful` });
      setTarget(null);
      setNote('');
      await load();
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Action failed', text2: error.response?.data?.error });
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!token || !BASE_URL) return;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let active = true;
    let attempts = 0;

    const connect = () => {
      socket = new WebSocket(`${BASE_URL.replace(/^http/, 'ws')}/ws/store-orders/?token=${token}`);
      socket.onopen = () => {
        attempts = 0;
        load();
      };
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          const notification = message?.data?.notification;
          const eventType = notification?.notification_type || notification?.data?.type;
          if (
            message.type === 'fulfillment_update' &&
            message.action === 'app_notification' &&
            String(eventType || '').toLowerCase().startsWith('replacement_')
          ) {
            load();
            Toast.show({
              type: 'info',
              text1: notification?.title || 'Replacement updated',
              text2: notification?.body,
            });
          }
        } catch (error) {
          console.warn('Replacement WS parse error', error);
        }
      };
      socket.onclose = () => {
        if (!active) return;
        const delay = Math.min(10000, Math.pow(2, attempts++) * 1000);
        reconnectTimer = setTimeout(connect, delay);
      };
      socket.onerror = () => socket?.close();
    };
    connect();
    return () => {
      active = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [load, token]);

  const filteredItems = items.filter((item) => {
    if (activeFilter === 'ALL') return true;
    if (activeFilter === 'REQUESTED') return item.status === 'requested';
    if (activeFilter === 'APPROVED') return item.status === 'approved';
    if (activeFilter === 'IN_TRANSIT') return item.status === 'in_transit';
    if (activeFilter === 'COMPLETED') return item.status === 'completed';
    if (activeFilter === 'REJECTED') return item.status === 'rejected';
    return true;
  });

  const getStatusBadge = (status: string, statusDisplay: string) => {
    switch (status) {
      case 'requested':
        return { label: statusDisplay || 'Pending Approval', bg: '#FFF7E6', border: '#F6D99A', text: '#F59E0B' };
      case 'approved':
        return { label: statusDisplay || 'Approved', bg: '#E8F4F5', border: '#B9DDE0', text: '#0F8B8D' };
      case 'in_transit':
        return { label: statusDisplay || 'In Transit', bg: '#EEF3F7', border: '#D5E1E9', text: '#123B5D' };
      case 'completed':
        return { label: statusDisplay || 'Completed', bg: '#EDF8F0', border: '#BBF7D0', text: '#16A34A' };
      case 'rejected':
        return { label: statusDisplay || 'Rejected', bg: '#FFF1F1', border: '#FECDD3', text: '#DC2626' };
      default:
        return { label: statusDisplay || status, bg: '#F4F8FA', border: '#B9DDE0', text: '#102A43' };
    }
  };

  const renderItem = ({ item }: any) => {
    const badge = getStatusBadge(item.status, item.status_display);

    return (
      <View className="mb-4 rounded-[1.4rem] border border-[#B9DDE0] bg-white p-5 shadow-sm shadow-slate-200">
        <View className="flex-row items-start justify-between">
          <View>
            <View className="flex-row items-center">
              <View className="h-2 w-2 rounded-full bg-[#0F8B8D] mr-2" />
              <Text className="text-base font-black text-[#102A43]">Order #{item.order}</Text>
            </View>
            <Text className="mt-1 text-xs font-bold text-[#627D98]">
              {new Date(item.created_at).toLocaleString('en-IN', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </Text>
          </View>
          <View
            className="rounded-full px-3 py-1 border"
            style={{ backgroundColor: badge.bg, borderColor: badge.border }}
          >
            <Text className="text-[10px] font-black uppercase tracking-wider" style={{ color: badge.text }}>
              {badge.label}
            </Text>
          </View>
        </View>

        {/* Customer & Fulfillment Pill */}
        <View className="mt-4 rounded-2xl bg-[#E8F4F5] border border-[#B9DDE0] p-3.5">
          <Text className="text-[10px] font-black uppercase tracking-wider text-[#0F8B8D]">Customer & Order Type</Text>
          <Text className="mt-1 font-black text-[#102A43]">
            {item.user_name} · {item.user_mobile}
          </Text>
          <View className="mt-2 flex-row items-center justify-between">
            <View className="flex-row items-center">
              <MaterialCommunityIcons
                name={item.is_walk_in ? 'storefront-outline' : 'truck-delivery-outline'}
                size={16}
                color={PALETTE.primaryNavy}
              />
              <Text className="ml-1.5 text-xs font-bold text-[#123B5D]">
                {item.is_walk_in ? 'Walk-in Store Pickup' : 'Home Delivery Dispatch'}
              </Text>
            </View>
          </View>
        </View>

        {/* Reason for Replacement */}
        <View className="mt-3.5">
          <Text className="text-[10px] font-black uppercase tracking-wider text-[#627D98]">Replacement Reason</Text>
          <Text className="mt-1 text-sm font-black text-[#102A43]">
            {item.reason_display || item.reason.replace('_', ' ')}
          </Text>
          {!!item.description && <Text className="mt-1 text-xs font-medium text-[#627D98]">{item.description}</Text>}
        </View>

        {/* Proof Image */}
        {!!item.proof_image_url && (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setFullImage(item.proof_image_url)}
            className="mt-3.5 overflow-hidden rounded-2xl bg-slate-100 border border-[#B9DDE0]"
          >
            <View className="h-44 w-full">
              <RemoteImageWithStatus uri={item.proof_image_url} loadingLabel="Loading proof image" />
            </View>
            <View className="absolute bottom-2.5 right-2.5 flex-row items-center rounded-full bg-[#123B5D]/85 px-3 py-1.5">
              <MaterialCommunityIcons name="magnify-plus-outline" size={15} color="white" />
              <Text className="ml-1 text-[9px] font-black text-white">VIEW PROOF</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Store Note */}
        {!!item.store_note && (
          <View className="mt-3.5 rounded-xl bg-[#EEF3F7] border border-[#D5E1E9] p-3">
            <Text className="text-[10px] font-black uppercase text-[#123B5D]">Store Note</Text>
            <Text className="mt-0.5 text-xs font-bold text-[#102A43]">{item.store_note}</Text>
          </View>
        )}

        {/* Assigned Delivery Person */}
        {!!item.delivery_person && (
          <View className="mt-3.5 rounded-2xl border border-[#B9DDE0] bg-[#E8F4F5] p-3.5">
            <Text className="text-[10px] font-black uppercase tracking-wider text-[#0F8B8D]">Assigned Courier</Text>
            <Text className="mt-1 font-black text-[#102A43]">
              {item.delivery_person.name} · {item.delivery_person.mobile}
            </Text>
            <Text className="mt-1 text-xs font-bold text-[#627D98]">
              {item.delivery_person.vehicle_type}
              {item.delivery_person.vehicle_number ? ` · ${item.delivery_person.vehicle_number}` : ''}
              {item.estimated_delivery_minutes ? ` · ETA ${item.estimated_delivery_minutes} mins` : ''}
            </Text>
          </View>
        )}

        {/* View Original Order button */}
        <TouchableOpacity
          activeOpacity={0.84}
          onPress={() => setDetailItem(item)}
          className="mt-4 flex-row items-center justify-center rounded-xl border border-[#B9DDE0] bg-[#E8F4F5] py-3"
        >
          <MaterialCommunityIcons name="file-document-outline" size={18} color={PALETTE.secondaryTeal} />
          <Text className="ml-2 font-black text-[#0F8B8D]">View Original Order Details</Text>
        </TouchableOpacity>

        {/* Action Buttons */}
        {item.status === 'requested' && (
          <View className="mt-3.5 flex-row gap-3">
            <TouchableOpacity
              activeOpacity={0.84}
              onPress={() => openAction(item, 'reject')}
              className="flex-1 items-center justify-center rounded-xl bg-[#FFF1F1] border border-[#FECDD3] py-3.5"
            >
              <Text className="font-black text-[#DC2626]">Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.84}
              onPress={() => setDetailItem(item)}
              className="flex-1 items-center justify-center rounded-xl bg-[#0F8B8D] py-3.5 shadow-sm"
            >
              <Text className="font-black text-white">Review & Approve</Text>
            </TouchableOpacity>
          </View>
        )}

        {item.status === 'approved' && !item.is_walk_in && (
          <TouchableOpacity
            activeOpacity={0.84}
            disabled={submitting}
            onPress={() => openAction(item, 'in-transit')}
            className="mt-4 flex-row items-center justify-center rounded-xl bg-[#123B5D] py-4 shadow-sm"
          >
            <MaterialCommunityIcons name="truck-fast-outline" size={19} color="white" />
            <Text className="ml-2 font-black text-white">Dispatch / Mark In Transit</Text>
          </TouchableOpacity>
        )}

        {((item.status === 'approved' && item.is_walk_in) || item.status === 'in_transit') && (
          <TouchableOpacity
            activeOpacity={0.84}
            onPress={() => openAction(item, 'complete')}
            className="mt-4 flex-row items-center justify-center rounded-xl bg-[#16A34A] py-4 shadow-sm"
          >
            <MaterialCommunityIcons name="check-decagram-outline" size={19} color="white" />
            <Text className="ml-2 font-black text-white">Complete Replacement</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F4F8FA]">
      {/* Modern Gradient Banner Header */}
      <View className="overflow-hidden shadow-sm shadow-slate-300">
        <LinearGradient
          colors={[PALETTE.primaryNavy, PALETTE.secondaryTeal]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          className="px-5 pt-4 pb-5 flex-row items-center justify-between"
        >
          <View className="flex-row items-center flex-1">
            <TouchableOpacity
              onPress={handleBack}
              className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-white/15"
            >
              <MaterialCommunityIcons name="arrow-left" size={22} color="white" />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-xl font-black text-white leading-6">Replacement Requests</Text>
              <Text className="text-xs font-semibold text-cyan-100 mt-0.5">
                Approve, dispatch and complete customer replacements
              </Text>
            </View>
          </View>
          <View className="bg-white/20 px-3 py-1.5 rounded-full flex-row items-center ml-2">
            <MaterialCommunityIcons name="sync" size={14} color="white" />
            <Text className="ml-1 text-[9px] font-black uppercase text-white tracking-wider">Live</Text>
          </View>
        </LinearGradient>
      </View>

      {/* Horizontal Status Filter Tabs */}
      <View className="bg-white border-b border-[#B9DDE0] py-2.5 px-4">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {[
            { key: 'ALL', label: 'All', count: items.length },
            { key: 'REQUESTED', label: 'Pending', count: items.filter((i) => i.status === 'requested').length },
            { key: 'APPROVED', label: 'Approved', count: items.filter((i) => i.status === 'approved').length },
            { key: 'IN_TRANSIT', label: 'In Transit', count: items.filter((i) => i.status === 'in_transit').length },
            { key: 'COMPLETED', label: 'Completed', count: items.filter((i) => i.status === 'completed').length },
            { key: 'REJECTED', label: 'Rejected', count: items.filter((i) => i.status === 'rejected').length },
          ].map((tab) => {
            const active = activeFilter === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                activeOpacity={0.84}
                onPress={() => setActiveFilter(tab.key as any)}
                className={`flex-row items-center rounded-full px-3.5 py-1.5 border ${active
                    ? 'bg-[#123B5D] border-[#123B5D]'
                    : 'bg-[#F4F8FA] border-[#B9DDE0]'
                  }`}
              >
                <Text className={`text-[11px] font-black tracking-tight ${active ? 'text-white' : 'text-[#627D98]'}`}>
                  {tab.label}
                </Text>
                {tab.count > 0 && (
                  <View
                    className={`ml-1.5 rounded-full px-1.5 py-0.2 min-w-[18px] items-center justify-center ${active ? 'bg-[#0F8B8D]' : 'bg-[#B9DDE0]'
                      }`}
                  >
                    <Text className={`text-[9px] font-black ${active ? 'text-white' : 'text-[#102A43]'}`}>
                      {tab.count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Main List Area */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={PALETTE.secondaryTeal} />
          <Text className="mt-3 text-xs font-bold text-[#627D98]">Syncing replacement requests...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          renderItem={renderItem}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 80, flexGrow: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={PALETTE.secondaryTeal}
            />
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center p-10">
              <View className="w-20 h-20 rounded-full bg-[#E8F4F5] border border-[#B9DDE0] items-center justify-center">
                <MaterialCommunityIcons name="package-variant" size={42} color={PALETTE.secondaryTeal} />
              </View>
              <Text className="mt-4 font-black text-[#102A43] text-base">No replacement requests found</Text>
              <Text className="mt-1 text-xs text-[#627D98] text-center">
                Customer replacement requests for your pharmacy will appear here in real time.
              </Text>
            </View>
          }
        />
      )}

      {/* Full Image Preview Modal */}
      <Modal visible={!!fullImage} transparent animationType="fade" onRequestClose={() => setFullImage(null)}>
        <View className="flex-1 bg-black">
          <TouchableOpacity
            onPress={() => setFullImage(null)}
            className="absolute right-5 top-12 z-20 h-12 w-12 items-center justify-center rounded-full bg-white/20"
          >
            <MaterialCommunityIcons name="close" size={27} color="white" />
          </TouchableOpacity>
          {fullImage && (
            <View className="h-full w-full">
              <RemoteImageWithStatus uri={fullImage} resizeMode="contain" loadingLabel="Opening image preview" />
            </View>
          )}
        </View>
      </Modal>

      {/* Detail Item Sheet Modal */}
      <Modal visible={!!detailItem} transparent animationType="slide" onRequestClose={() => setDetailItem(null)}>
        <View className="flex-1 justify-end bg-black/60">
          <View className="max-h-[92%] rounded-t-[2rem] bg-white overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <LinearGradient
              colors={[PALETTE.primaryNavy, PALETTE.secondaryTeal]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              className="flex-row items-center justify-between p-5"
            >
              <View>
                <Text className="text-lg font-black text-white">Original Order #{detailItem?.order}</Text>
                <Text className="text-xs font-semibold text-cyan-100">Review details before approval</Text>
              </View>
              <TouchableOpacity
                onPress={() => setDetailItem(null)}
                className="h-10 w-10 items-center justify-center rounded-xl bg-white/20"
              >
                <MaterialCommunityIcons name="close" size={21} color="white" />
              </TouchableOpacity>
            </LinearGradient>

            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
              {/* Prescription Image */}
              {!!detailItem?.original_order?.prescription_image_url && (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => setFullImage(detailItem.original_order.prescription_image_url)}
                  className="overflow-hidden rounded-2xl bg-slate-100 border border-[#B9DDE0]"
                >
                  <View className="h-64 w-full">
                    <RemoteImageWithStatus
                      uri={detailItem.original_order.prescription_image_url}
                      resizeMode="contain"
                      loadingLabel="Loading prescription"
                    />
                  </View>
                  <View className="absolute bottom-3 right-3 flex-row items-center rounded-full bg-[#123B5D]/85 px-3 py-2">
                    <MaterialCommunityIcons name="magnify-plus-outline" size={16} color="white" />
                    <Text className="ml-1 text-[9px] font-black text-white">VIEW PRESCRIPTION</Text>
                  </View>
                </TouchableOpacity>
              )}

              {/* Issue Pill */}
              <View className="mt-4 rounded-2xl border border-[#F6D99A] bg-[#FFF7E6] p-4">
                <Text className="text-[10px] font-black uppercase text-[#F59E0B] tracking-wider">Replacement issue reported</Text>
                <Text className="mt-1 font-black text-[#102A43]">{detailItem?.reason_display}</Text>
                {!!detailItem?.description && (
                  <Text className="mt-1 text-sm text-[#627D98]">{detailItem.description}</Text>
                )}
              </View>

              {/* Customer & Delivery Context */}
              <View className="mt-4 rounded-2xl bg-[#E8F4F5] border border-[#B9DDE0] p-4">
                <Text className="text-[10px] font-black uppercase tracking-wider text-[#0F8B8D]">Customer & Delivery</Text>
                <Text className="mt-2 font-black text-[#102A43]">
                  {detailItem?.user_name} · {detailItem?.user_mobile}
                </Text>
                <Text className="mt-1.5 text-sm leading-5 text-[#627D98]">
                  {detailItem?.original_order?.customer_address || 'Address unavailable'}
                </Text>
                <View className="mt-3 flex-row gap-2">
                  <View className="rounded-full bg-[#EEF3F7] border border-[#D5E1E9] px-3 py-1.5">
                    <Text className="text-[10px] font-black text-[#123B5D]">
                      {detailItem?.original_order?.distance_km ? `${detailItem.original_order.distance_km} km away` : 'Distance N/A'}
                    </Text>
                  </View>
                  <View className="rounded-full bg-[#E8F4F5] border border-[#B9DDE0] px-3 py-1.5">
                    <Text className="text-[10px] font-black text-[#0F8B8D]">
                      {detailItem?.is_walk_in ? 'Walk-in Store Pickup' : 'Home Delivery'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Prescription Request details */}
              {!!detailItem?.original_order?.prescription_medicine_name && (
                <View className="mt-4 rounded-2xl border border-[#B9DDE0] bg-white p-4">
                  <Text className="text-[10px] font-black uppercase text-[#627D98] tracking-wider">Prescription Request</Text>
                  <Text className="mt-2 font-black text-[#102A43]">{detailItem.original_order.prescription_medicine_name}</Text>
                  <Text className="mt-1 text-sm text-[#627D98]">{detailItem.original_order.prescription_description}</Text>
                </View>
              )}

              {/* Supplied Medicines */}
              <View className="mt-5">
                <Text className="text-[10px] font-black uppercase tracking-wider text-[#627D98]">Medicines Supplied</Text>
                {detailItem?.original_order?.medicines?.length ? (
                  detailItem.original_order.medicines.map((medicine: any, index: number) => (
                    <View key={`${medicine.name}-${index}`} className="mt-2.5 rounded-2xl border border-[#B9DDE0] bg-white p-4">
                      <View className="flex-row justify-between">
                        <View className="flex-1">
                          <Text className="font-black text-[#102A43]">{medicine.name}</Text>
                          <Text className="mt-1 text-xs text-[#627D98]">
                            {medicine.brand || 'Brand not specified'} · {medicine.type}
                          </Text>
                        </View>
                        <Text className="font-black text-[#16A34A]">{medicine.price ? `₹${medicine.price}` : 'Price N/A'}</Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text className="mt-2 text-sm text-[#627D98]">No itemized medicines recorded for this order.</Text>
                )}
              </View>

              {/* Original Order Total */}
              <View className="mt-5 rounded-2xl bg-[#123B5D] p-4">
                <View className="flex-row justify-between">
                  <Text className="font-bold text-white">Original Order Total</Text>
                  <Text className="font-black text-cyan-200">
                    {detailItem?.original_order?.total_amount ? `₹${detailItem.original_order.total_amount}` : 'N/A'}
                  </Text>
                </View>
                {!!detailItem?.original_order?.response_text && (
                  <Text className="mt-3 text-xs text-cyan-100 font-medium">Store quote: {detailItem.original_order.response_text}</Text>
                )}
              </View>

              {/* Action Button inside modal */}
              {detailItem?.status === 'requested' && (
                <TouchableOpacity
                  activeOpacity={0.84}
                  onPress={() => {
                    const item = detailItem;
                    setDetailItem(null);
                    openAction(item, 'approve');
                  }}
                  className="mt-6 items-center justify-center rounded-xl bg-[#0F8B8D] py-4 shadow-sm"
                >
                  <Text className="font-black text-white text-base">Continue to Approve Replacement</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Action Modal */}
      <ReplacementActionModal
        target={target}
        action={action}
        note={note}
        setNote={setNote}
        people={deliveryPeople}
        selectedPersonId={selectedDeliveryPersonId}
        setSelectedPersonId={setSelectedDeliveryPersonId}
        eta={deliveryEta}
        setEta={setDeliveryEta}
        submitting={submitting}
        onClose={() => setTarget(null)}
        onSubmit={submit}
      />
    </SafeAreaView>
  );
}
