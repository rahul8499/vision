import { LocalizedText as Text } from '@/components/Language/LocalizedPrimitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  Switch,
  TouchableOpacity,
  View
} from 'react-native';
import Svg, { Line, Polyline } from 'react-native-svg';
import Toast from 'react-native-toast-message';
import { useDispatch, useSelector } from 'react-redux';
import { useSellerDashboardSummary } from '../../orders/hooks/useSellerDashboardSummary';
import type { OrderStage, SellerDashboardSummary } from '../../orders/types';
import { AppDispatch, RootState } from '../../redux/store';
import { fetchUserProfile } from '../../redux/userSlice';

const formatCurrency = (value?: number | string | null) => {
  const amount = Number(value || 0);
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

const workloadTiles: {
  key: keyof SellerDashboardSummary['workload'];
  label: string;
  stage: OrderStage;
  icon: string;
  color: string;
  bg: string;
  border: string;
}[] = [
    { key: 'new', label: 'New', stage: 'NEW', icon: 'bell-ring-outline', color: '#0F8B8D', bg: '#E8F4F5', border: '#B9DDE0' },
    { key: 'billing', label: 'Billing', stage: 'BILLING', icon: 'script-text-outline', color: '#123B5D', bg: '#EEF3F7', border: '#D5E1E9' },
    { key: 'packed', label: 'Packed', stage: 'PACKED', icon: 'package-variant-closed', color: '#397A93', bg: '#EDF6F8', border: '#CDE5EA' },
    { key: 'ready', label: 'Ready', stage: 'READY', icon: 'scooter', color: '#F59E0B', bg: '#FFF7E6', border: '#F6D99A' },
    { key: 'delivery', label: 'Delivery', stage: 'DELIVERY', icon: 'truck-delivery-outline', color: '#0F8B8D', bg: '#E8F4F5', border: '#B9DDE0' },
    { key: 'otp', label: 'OTP', stage: 'OTP', icon: 'shield-key-outline', color: '#F59E0B', bg: '#FFF7E6', border: '#F6D99A' },
  ];

const getAttentionTone = (stage?: string) => {
  const key = (stage || '').toUpperCase();
  if (key === 'OTP') return { color: '#F59E0B', bg: '#FFF7E6', border: '#F6D99A', icon: 'shield-key-outline' };
  if (key === 'NEW') return { color: '#0F8B8D', bg: '#E8F4F5', border: '#B9DDE0', icon: 'bell-ring-outline' };
  if (key === 'BILLING') return { color: '#123B5D', bg: '#EEF3F7', border: '#D5E1E9', icon: 'script-text-outline' };
  if (key === 'PACKED') return { color: '#397A93', bg: '#EDF6F8', border: '#CDE5EA', icon: 'package-variant-closed' };
  if (key === 'READY') return { color: '#F59E0B', bg: '#FFF7E6', border: '#F6D99A', icon: 'scooter' };
  if (key === 'DELIVERY') return { color: '#0F8B8D', bg: '#E8F4F5', border: '#B9DDE0', icon: 'truck-delivery-outline' };
  return { color: '#F59E0B', bg: '#FFF7E6', border: '#F6D99A', icon: 'alert-circle-outline' };
};

const normalizeAttentionStage = (stage?: string): OrderStage => {
  const normalized = (stage || '').toUpperCase();
  const directStages: OrderStage[] = ['ACTIVE', 'NEW', 'BILLING', 'PACKED', 'READY', 'DELIVERY', 'OTP'];
  if (directStages.includes(normalized as OrderStage)) return normalized as OrderStage;
  if (normalized === 'ACCEPTED') return 'NEW';
  if (normalized === 'PROCESSING') return 'BILLING';
  if (normalized === 'LOCKED') return 'READY';
  if (normalized === 'OUT_FOR_DELIVERY') return 'DELIVERY';
  return 'ACTIVE';
};

const getLocalDayStr = (d: Date) => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const DATE_FILTERS = [
  { key: 'today', label: 'Today' },
  { key: '7days', label: '7 Days' },
  { key: '30days', label: '30 Days' },
];

const MiniTrend = ({ color, variant = 'rise' }: { color: string; variant?: 'rise' | 'dip' | 'flat' | 'wave' }) => {
  const points = {
    rise: '2,26 17,26 30,26 43,20 58,18 72,21 85,15 96,18 108,10',
    dip: '2,22 18,17 33,21 48,17 63,17 78,20 93,14 108,18',
    wave: '2,28 18,20 33,20 48,24 63,19 78,23 94,16 108,13',
    flat: '2,23 108,23',
  }[variant];

  return (
    <Svg width="100%" height={24} viewBox="0 0 110 34">
      <Line x1="2" y1="30" x2="108" y2="30" stroke={`${color}12`} strokeWidth="1" />
      <Polyline points={points} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
};

export default function SellerHomeScreen() {
  const BASE_URL = Constants.expoConfig?.extra?.BASE_URL || '';
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const { user, token } = useSelector((state: RootState) => state.user);

  const [dateFilter, setDateFilter] = useState('today');
  const [startDate, setStartDate] = useState<string | undefined>(undefined);
  const [endDate, setEndDate] = useState<string | undefined>(undefined);

  const dashboard = useSellerDashboardSummary({ baseUrl: BASE_URL, token, startDate, endDate });
  const summary = dashboard.summary;

  const [storeToggleLoading, setStoreToggleLoading] = useState(false);
  const [isStoreActive, setIsStoreActive] = useState(true);

  // Live Counts for Quick Access Services
  const [serviceCounts, setServiceCounts] = useState({
    reports: 0,
    complaints: 0,
    consultations: 0,
    support: 0,
  });

  const fetchServiceCounts = useCallback(async () => {
    if (!BASE_URL || !token) return;
    try {
      const [reportsRes, complaintsRes, consultsRes, supportRes] = await Promise.allSettled([
        axios.get(`${BASE_URL}/api/safety-reports/`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${BASE_URL}/api/complaints/counts/`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${BASE_URL}/api/pharmacist/store/inbox/`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${BASE_URL}/api/complaints/platform-support/`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      let reports = 0;
      if (reportsRes.status === 'fulfilled') {
        const data = reportsRes.value.data;
        reports = Array.isArray(data) ? data.filter((r: any) => r.status !== 'RESOLVED' && r.status !== 'DISMISSED').length : 0;
      }

      let complaints = 0;
      if (complaintsRes.status === 'fulfilled') {
        const data = complaintsRes.value.data;
        complaints = Number(data.open_against || data.open_filed || 0);
      }

      let consultations = 0;
      if (consultsRes.status === 'fulfilled') {
        const data = consultsRes.value.data;
        consultations = Array.isArray(data) ? data.filter((c: any) => c.status !== 'closed' && c.status !== 'RESOLVED').length : 0;
      }

      let support = 0;
      if (supportRes.status === 'fulfilled') {
        const data = supportRes.value.data;
        support = Array.isArray(data) ? data.filter((s: any) => s.status !== 'CLOSED' && s.status !== 'RESOLVED').length : 0;
      }

      setServiceCounts({ reports, complaints, consultations, support });
    } catch (err) {
      console.log('Error fetching service counts:', err);
    }
  }, [BASE_URL, token]);

  useFocusEffect(
    useCallback(() => {
      fetchServiceCounts();
    }, [fetchServiceCounts])
  );

  useEffect(() => {
    if (summary?.store?.is_active != null) setIsStoreActive(summary.store.is_active);
  }, [summary?.store?.is_active]);

  useEffect(() => {
    if (!token || !user) dispatch(fetchUserProfile());
  }, [dispatch, token, user]);

  useEffect(() => {
    const today = new Date();
    let start = new Date();
    if (dateFilter === '7days') start.setDate(today.getDate() - 7);
    else if (dateFilter === '30days') start.setDate(today.getDate() - 30);
    else if (dateFilter === 'today') start = today;

    if (dateFilter !== 'custom') {
      setStartDate(getLocalDayStr(start));
      setEndDate(getLocalDayStr(today));
    }
  }, [dateFilter]);

  const openOrders = useCallback((stage: OrderStage = 'ACTIVE', orderId?: number) => {
    router.push({
      pathname: '/(sellerTabs)/active-orders',
      params: {
        stage,
        focus: `${stage}-${orderId || 'all'}-${Date.now()}`,
        ...(orderId ? { orderId: String(orderId) } : {}),
      },
    } as any);
  }, [router]);

  const toggleStore = useCallback(async () => {
    if (!token || !BASE_URL || storeToggleLoading) return;
    const current = isStoreActive;
    setIsStoreActive(!current);
    setStoreToggleLoading(true);
    try {
      await axios.patch(
        `${BASE_URL}/api/store-me/`,
        { is_active: !current },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await dashboard.fetchSummary(false);
      Toast.show({
        type: 'success',
        text1: !current ? 'Store Opened' : 'Store Paused',
        text2: !current ? 'Store is now accepting orders.' : 'Store has been paused.',
        position: 'bottom',
      });
    } catch {
      setIsStoreActive(current);
      Toast.show({ type: 'error', text1: 'Toggle failed', text2: 'Could not update store status.', position: 'bottom' });
    } finally {
      setStoreToggleLoading(false);
    }
  }, [BASE_URL, dashboard, storeToggleLoading, isStoreActive, token]);

  const todayCards = [
    { label: 'Orders', value: summary?.today.orders ?? 0, icon: 'shopping-outline', color: '#0F8B8D', bg: '#E8F4F5', trend: 'wave' as const },
    { label: 'Revenue', value: formatCurrency(summary?.today.revenue), icon: 'currency-inr', color: '#123B5D', bg: '#EEF3F7', trend: 'dip' as const },
    { label: 'Completed', value: summary?.today.completed ?? 0, icon: 'check-decagram-outline', color: '#16A34A', bg: '#EDF8F0', trend: 'rise' as const },
    { label: 'Cancelled', value: summary?.today.cancelled ?? 0, icon: 'close-circle-outline', color: '#DC2626', bg: '#FFF1F1', trend: 'flat' as const },
  ];

  const selectedFilter = DATE_FILTERS.find((f) => f.key === dateFilter)?.label || 'Today';
  const attentionItems = summary?.attention ?? [];
  const attentionCount = attentionItems.length;

  const openAttention = () => {
    const firstAttention = attentionItems[0];
    if (!firstAttention) return;
    openOrders(normalizeAttentionStage(firstAttention.stage), firstAttention.response_id);
  };

  return (
    <View className="flex-1 bg-[#F4F8FA]">
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={dashboard.refreshing} onRefresh={dashboard.refresh} tintColor="#0F8B8D" />}
        contentContainerStyle={{ paddingBottom: 122 }}
      >
        <View className="px-4 pt-2 pb-1">
          <View className="overflow-hidden rounded-[1.45rem] shadow-sm shadow-slate-300">
            <LinearGradient
              colors={['#123B5D', '#0F8B8D']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              className="relative min-h-[150px] overflow-hidden px-4 py-4"
            >
              <View className="absolute -right-14 -bottom-8 h-[190px] w-[286px] items-center justify-center">
                <Image
                  source={require('../../assets/images/dashboard.png')}
                  className="h-full w-full"
                  resizeMode="contain"
                />
              </View>

              <View className="min-h-[118px] justify-center">
                <View className="z-10 w-[54%] min-w-0">
                  <View className="flex-row items-center">

                    <View className="min-w-0 flex-1">
                      <Text
                        className="text-[12px] font-black uppercase tracking-[1.6px] text-cyan-100 leading-4"
                        numberOfLines={1}
                      >
                        Dashboard
                      </Text>

                      <Text
                        className="text-[12px] font-black uppercase tracking-[1.2px] text-white leading-4"
                        numberOfLines={1}
                      >
                        {isStoreActive ? 'Overview' : 'Offline'}
                      </Text>
                    </View>
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    className="mt-3"
                    contentContainerStyle={{ gap: 8, paddingRight: 6 }}
                  >
                    <TouchableOpacity
                      activeOpacity={0.84}
                      disabled={storeToggleLoading}
                      onPress={toggleStore}
                      className="h-10 flex-row items-center rounded-full border border-white/20 bg-white/95 px-2 shadow-sm shadow-slate-950/10"
                    >
                      <MaterialCommunityIcons name="storefront-outline" size={14} color="#123B5D" />

                      <Text
                        className="ml-2 text-[10px] font-black uppercase tracking-[1px] text-[#123B5D]"
                        numberOfLines={1}
                      >
                        {isStoreActive ? 'Open Store' : 'Closed Store'}
                      </Text>
                      <Switch value={isStoreActive} onValueChange={toggleStore} disabled={storeToggleLoading} trackColor={{ false: "#CBD5E1", true: "#7DD3C7" }} thumbColor={isStoreActive ? "#0F8B8D" : "#F8FAFC"} ios_backgroundColor="#CBD5E1" />
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              </View>
            </LinearGradient>
          </View>

          <View className="mt-2 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm shadow-slate-200/70">
            <View className="flex-row">
              {DATE_FILTERS.map((f) => {
                const active = dateFilter === f.key;

                return (
                  <TouchableOpacity
                    key={f.key}
                    activeOpacity={0.86}
                    onPress={() => setDateFilter(f.key)}
                    className={`h-8 flex-1 items-center justify-center rounded-xl ${active ? 'bg-[#123B5D]' : 'bg-transparent'}`}
                  >
                    <Text
                      className={`text-[10px] font-black uppercase tracking-[0.8px] ${active ? 'text-white' : 'text-slate-500'}`}
                      numberOfLines={1}
                    >
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {dashboard.loading && !summary ? (
          <View className="mt-16 items-center">
            <ActivityIndicator color="#10996d" />
            <Text className="mt-4 text-xs font-bold text-slate-400">Loading dashboard</Text>
          </View>
        ) : (
          <View className="px-4 pt-4">
            <View className="mb-3 flex-row items-center justify-between px-1">
              <View className="flex-row items-center">
                <View className="mr-2 h-1.5 w-1.5 rounded-full bg-[#0d8a63]" />
                <Text className="text-[11px] font-black uppercase tracking-[2.2px] text-slate-600">{selectedFilter} Overview</Text>
              </View>
              <View className="flex-row items-center rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1">
                <MaterialCommunityIcons name="chart-timeline-variant-shimmer" size={12} color="#0d8a63" />
                <Text className="ml-1 text-[8px] font-black uppercase tracking-[0.7px] text-emerald-700">Live summary</Text>
              </View>
            </View>

            <View className="flex-row flex-wrap justify-between gap-y-2.5 rounded-[1.4rem] border border-slate-100 bg-white p-2 shadow-sm shadow-slate-200/80">
              {todayCards.map((card) => (
                <View
                  key={card.label}
                  className="min-h-[98px] w-[48.7%] overflow-hidden rounded-[1rem] border p-3"
                  style={{ backgroundColor: card.bg, borderColor: `${card.color}18` }}
                >
                  <View className="absolute -right-5 -top-6 h-16 w-16 rounded-full bg-white/45" />

                  <View className="flex-row items-center">
                    <View className="h-8 w-8 items-center justify-center rounded-[0.7rem] bg-white/90">
                      <MaterialCommunityIcons name={card.icon as any} size={17} color={card.color} />
                    </View>
                    <Text className="ml-2 flex-1 text-[10px] font-bold text-slate-500" numberOfLines={1}>{card.label}</Text>
                  </View>

                  <View className="mt-2.5 flex-row items-end justify-between">
                    <Text className="mr-2 flex-1 text-[21px] font-black leading-6 text-slate-950" numberOfLines={1} adjustsFontSizeToFit>{card.value}</Text>
                    <View className="h-6 w-[48px] overflow-hidden opacity-90">
                      <MiniTrend color={card.color} variant={card.trend} />
                    </View>
                  </View>
                </View>
              ))}
            </View>

            <View className="mt-6 flex-row items-center justify-between">
              <Text className="text-[11px] font-black uppercase tracking-[2.5px] text-slate-500">Work Pulse</Text>
              <TouchableOpacity activeOpacity={0.8} onPress={() => openOrders()} className="flex-row items-center">
                <Text className="mr-1 text-xs font-semibold text-[#0c8d66]">Open Orders</Text>
                <MaterialCommunityIcons name="arrow-right" size={16} color="#0c8d66" />
              </TouchableOpacity>
            </View>

            <View className="mt-4 flex-row flex-wrap justify-between gap-y-4">
              {workloadTiles.map((tile) => {
                const count = summary?.workload[tile.key] ?? 0;
                return (
                  <TouchableOpacity
                    key={tile.key}
                    activeOpacity={0.82}
                    onPress={() => openOrders(tile.stage)}
                    className="min-h-[112px] w-[31%] overflow-hidden rounded-[1rem] border p-3"
                    style={{ backgroundColor: tile.bg, borderColor: tile.border }}
                  >
                    <MaterialCommunityIcons name={tile.icon as any} size={19} color={tile.color} />
                    <Text className="mt-5 text-2xl font-black" style={{ color: tile.color }}>{count}</Text>
                    <Text className="mt-0.5 text-xs font-medium text-slate-500" numberOfLines={1}>{tile.label}</Text>
                    <View className="absolute -bottom-3 -right-3 opacity-10">
                      <MaterialCommunityIcons name={tile.icon as any} size={74} color={tile.color} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity 
              activeOpacity={0.82}
              onPress={() => router.push('/(sellerTabs)/replacements')}
              className="mt-4 flex-row items-center justify-between rounded-[1rem] border border-orange-100 bg-orange-50 p-4 shadow-sm shadow-slate-200/50"
            >
              <View className="flex-row items-center">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-white">
                  <MaterialCommunityIcons name="package-variant-closed" size={20} color="#ea580c" />
                </View>
                <View className="ml-3">
                  <Text className="text-sm font-black text-slate-900">Replacements</Text>
                  <Text className="mt-0.5 text-xs font-medium text-slate-500">Manage replacement requests</Text>
                </View>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color="#ea580c" />
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.82} onPress={() => router.push('/(sellerTabs)/emergency-rewards' as any)} className="mt-3 flex-row items-center justify-between rounded-[1rem] border border-rose-100 bg-rose-50 p-4"><View className="flex-row items-center"><View className="h-10 w-10 items-center justify-center rounded-full bg-white"><MaterialCommunityIcons name="medal-outline" size={21} color="#e11d48" /></View><View className="ml-3"><Text className="text-sm font-black text-slate-900">Emergency Rewards</Text><Text className="mt-0.5 text-xs font-medium text-slate-500">Points, Fast Responder and Gold status</Text></View></View><MaterialCommunityIcons name="chevron-right" size={24} color="#e11d48" /></TouchableOpacity>

            {/* Quick Access & Services Grid */}
            <View className="mt-6">
              <View className="flex-row items-center justify-between mb-3 px-1">
                <View className="flex-row items-center">
                  <View className="w-1.5 h-1.5 rounded-full bg-[#0F8B8D] mr-2" />
                  <Text className="text-[11px] font-black uppercase tracking-[2.2px] text-slate-600">Quick Access & Services</Text>
                </View>
                <View className="flex-row items-center rounded-full bg-[#E8F4F5] border border-[#B9DDE0] px-2.5 py-1">
                  <MaterialCommunityIcons name="lightning-bolt" size={12} color="#0F8B8D" />
                  <Text className="ml-1 text-[8px] font-black uppercase tracking-[0.7px] text-[#0F8B8D]">Live Sync</Text>
                </View>
              </View>

              <View className="flex-row flex-wrap justify-between gap-y-3">
                {/* Reports & Safety */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => router.push('/(sellerTabs)/reports')}
                  className="w-[48.5%] bg-white rounded-[1.25rem] border border-[#B9DDE0] p-3.5 shadow-sm shadow-slate-200"
                >
                  <View className="flex-row items-center justify-between">
                    <View className="w-10 h-10 rounded-xl bg-[#FFF1F1] border border-[#FECDD3] items-center justify-center">
                      <MaterialCommunityIcons name="shield-alert-outline" size={20} color="#DC2626" />
                    </View>
                    {serviceCounts.reports > 0 ? (
                      <View className="bg-[#DC2626] rounded-full px-2 py-0.5 min-w-[20px] items-center">
                        <Text className="text-white text-[10px] font-black">{serviceCounts.reports}</Text>
                      </View>
                    ) : (
                      <View className="bg-[#EDF8F0] border border-[#BBF7D0] rounded-full px-2 py-0.5">
                        <Text className="text-[#16A34A] text-[9px] font-black">Active</Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-[13px] font-black text-[#102A43] mt-3" numberOfLines={1}>Reports & Safety</Text>
                  <Text className="text-[10px] font-bold text-[#627D98] mt-0.5" numberOfLines={1}>Moderation & Flags</Text>
                </TouchableOpacity>

                {/* Help & Complaints */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => router.push('/(sellerTabs)/support')}
                  className="w-[48.5%] bg-white rounded-[1.25rem] border border-[#B9DDE0] p-3.5 shadow-sm shadow-slate-200"
                >
                  <View className="flex-row items-center justify-between">
                    <View className="w-10 h-10 rounded-xl bg-[#FFF7E6] border border-[#F6D99A] items-center justify-center">
                      <MaterialCommunityIcons name="hand-heart-outline" size={20} color="#F59E0B" />
                    </View>
                    {serviceCounts.complaints > 0 ? (
                      <View className="bg-[#F59E0B] rounded-full px-2 py-0.5 min-w-[20px] items-center">
                        <Text className="text-white text-[10px] font-black">{serviceCounts.complaints}</Text>
                      </View>
                    ) : (
                      <View className="bg-[#EDF8F0] border border-[#BBF7D0] rounded-full px-2 py-0.5">
                        <Text className="text-[#16A34A] text-[9px] font-black">0 Open</Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-[13px] font-black text-[#102A43] mt-3" numberOfLines={1}>Help & Complaints</Text>
                  <Text className="text-[10px] font-bold text-[#627D98] mt-0.5" numberOfLines={1}>Disputes & Cases</Text>
                </TouchableOpacity>

                {/* Pharmacist Consultations */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => router.push('/(sellerTabs)/pharmacist')}
                  className="w-[48.5%] bg-white rounded-[1.25rem] border border-[#B9DDE0] p-3.5 shadow-sm shadow-slate-200"
                >
                  <View className="flex-row items-center justify-between">
                    <View className="w-10 h-10 rounded-xl bg-[#E8F4F5] border border-[#B9DDE0] items-center justify-center">
                      <MaterialCommunityIcons name="account-question-outline" size={20} color="#0F8B8D" />
                    </View>
                    {serviceCounts.consultations > 0 ? (
                      <View className="bg-[#0F8B8D] rounded-full px-2 py-0.5 min-w-[20px] items-center">
                        <Text className="text-white text-[10px] font-black">{serviceCounts.consultations}</Text>
                      </View>
                    ) : (
                      <View className="bg-[#EDF8F0] border border-[#BBF7D0] rounded-full px-2 py-0.5">
                        <Text className="text-[#16A34A] text-[9px] font-black">Active</Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-[13px] font-black text-[#102A43] mt-3" numberOfLines={1}>Pharmacist Consult</Text>
                  <Text className="text-[10px] font-bold text-[#627D98] mt-0.5" numberOfLines={1}>Q&A & Callbacks</Text>
                </TouchableOpacity>

                {/* Seller Help & Support */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => router.push('/(sellerTabs)/help-center')}
                  className="w-[48.5%] bg-white rounded-[1.25rem] border border-[#B9DDE0] p-3.5 shadow-sm shadow-slate-200"
                >
                  <View className="flex-row items-center justify-between">
                    <View className="w-10 h-10 rounded-xl bg-[#EEF3F7] border border-[#D5E1E9] items-center justify-center">
                      <MaterialCommunityIcons name="headphones" size={20} color="#123B5D" />
                    </View>
                    {serviceCounts.support > 0 ? (
                      <View className="bg-[#123B5D] rounded-full px-2 py-0.5 min-w-[20px] items-center">
                        <Text className="text-white text-[10px] font-black">{serviceCounts.support}</Text>
                      </View>
                    ) : (
                      <View className="bg-[#EDF8F0] border border-[#BBF7D0] rounded-full px-2 py-0.5">
                        <Text className="text-[#16A34A] text-[9px] font-black">24/7</Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-[13px] font-black text-[#102A43] mt-3" numberOfLines={1}>Seller Support</Text>
                  <Text className="text-[10px] font-bold text-[#627D98] mt-0.5" numberOfLines={1}>AARX Help & Tickets</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View className="mt-6 rounded-[1rem] border border-slate-100 bg-white p-4 shadow-sm shadow-slate-200">
              <TouchableOpacity activeOpacity={0.85} disabled={!attentionCount} onPress={openAttention} className="flex-row items-center">
                <View className={`h-12 w-12 items-center justify-center rounded-full ${attentionCount ? 'bg-[#fff4cf]' : 'bg-emerald-50'}`}>
                  <MaterialCommunityIcons name={attentionCount ? 'alert-circle' : 'check-circle-outline'} size={22} color={attentionCount ? '#e0a10c' : '#10996d'} />
                </View>
                <View className="ml-4 flex-1">
                  <Text className="text-sm font-black text-slate-950">Attention Required</Text>
                  <Text className="mt-1 text-xs font-medium text-slate-500" numberOfLines={1}>
                    {attentionCount ? `${attentionCount} urgent ${attentionCount === 1 ? 'order needs' : 'orders need'} action` : 'No urgent work right now'}
                  </Text>
                </View>
                {!!attentionCount && <MaterialCommunityIcons name="chevron-right" size={28} color="#0c8d66" />}
              </TouchableOpacity>

              {attentionCount ? (
                <View className="mt-4 gap-y-3">
                  {attentionItems.map((item) => {
                    const tone = getAttentionTone(item.stage);
                    return (
                      <TouchableOpacity
                        key={`${item.response_id}-${item.reason}`}
                        activeOpacity={0.84}
                        onPress={() => openOrders(normalizeAttentionStage(item.stage), item.response_id)}
                        className="flex-row items-center rounded-[0.95rem] border p-3"
                        style={{ backgroundColor: tone.bg, borderColor: tone.border }}
                      >
                        {item.image ? (
                          <Image source={{ uri: item.image }} className="h-10 w-10 rounded-full bg-white/70" resizeMode="cover" />
                        ) : (
                          <View className="h-10 w-10 items-center justify-center rounded-full bg-white/70">
                            <MaterialCommunityIcons name={(item.icon || tone.icon) as any} size={18} color={tone.color} />
                          </View>
                        )}
                        <View className="ml-3 flex-1">
                          <View className="flex-row items-center">
                            <Text className="flex-1 text-sm font-black text-slate-950" numberOfLines={1}>{item.patient}</Text>
                            <Text className="ml-2 rounded-full bg-white/70 px-2 py-0.5 text-[8px] font-black uppercase" style={{ color: tone.color }}>
                              {item.stage || 'Active'}
                            </Text>
                          </View>
                          <Text className="mt-1 text-[10px] font-bold" style={{ color: tone.color }} numberOfLines={1}>{item.reason} • {item.minutes} min</Text>
                        </View>
                        <MaterialCommunityIcons name="arrow-right" size={18} color={tone.color} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View className="mt-4 flex-row items-center rounded-[0.95rem] bg-emerald-50 px-3 py-3">
                  <MaterialCommunityIcons name="check-circle-outline" size={20} color="#10996d" />
                  <Text className="ml-2 text-xs font-black text-emerald-800">No urgent work right now</Text>
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>
      <Toast />
    </View>
  );
}
