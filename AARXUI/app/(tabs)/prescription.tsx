import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/Language/LocalizedPrimitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import axios from 'axios';
import { BlurView } from 'expo-blur';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../../redux/store';
import { fetchUserProfile } from '../../redux/userSlice';
import { ImageBackground } from 'react-native';

import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  TouchableOpacity,
  View
} from 'react-native';
import Toast from 'react-native-toast-message';
import RatingBottomSheet from '../../components/RatingBottomSheet';
import UnavailableOverlay, { shouldShowOverlay, type CapabilityFlags } from '../../components/UnavailableOverlay';
import RemoteImageWithStatus from '../../components/RemoteImageWithStatus';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const formatLocalDateParam = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const startOfLocalDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfLocalDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

const buildMediaUrl = (baseUrl: string, mediaPath?: string | null) => {
  if (!mediaPath) return null;
  if (/^https?:\/\//i.test(mediaPath)) return mediaPath;
  const base = baseUrl.replace(/\/+$/, '');
  const path = mediaPath.startsWith('/') ? mediaPath : `/${mediaPath}`;
  return `${base}${path}`;
};

const formatCompletionOtp = (otp?: string | null) => {
  if (!otp) return '';
  const digits = String(otp).replace(/\D/g, '');
  return digits.padStart(6, '0').slice(-6);
};

const formatStoreRating = (rating?: number | string | null) => {
  if (rating === null || rating === undefined || rating === '') return 'NEW';
  const numericRating = Number(rating);
  if (Number.isNaN(numericRating) || numericRating <= 0) return 'NEW';
  return numericRating.toFixed(1);
};

const getStoreBadgeMeta = (label: string) => {
  const normalizedLabel = label.toLowerCase();
  if (normalizedLabel.includes('fast')) {
    return { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-700', icon: 'lightning-bolt', iconColor: '#b45309' };
  }
  if (normalizedLabel.includes('order') || normalizedLabel.includes('deliver')) {
    return { bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-700', icon: 'truck-delivery-outline', iconColor: '#1d4ed8' };
  }
  if (normalizedLabel.includes('top') || normalizedLabel.includes('seller')) {
    return { bg: 'bg-violet-50', border: 'border-violet-100', text: 'text-violet-700', icon: 'medal-outline', iconColor: '#6d28d9' };
  }
  if (normalizedLabel.includes('value') || normalizedLabel.includes('deal')) {
    return { bg: 'bg-green-50', border: 'border-green-100', text: 'text-green-700', icon: 'tag-heart', iconColor: '#15803d' };
  }
  if (normalizedLabel.includes('rated') || normalizedLabel.includes('rating')) {
    return { bg: 'bg-indigo-50', border: 'border-indigo-100', text: 'text-indigo-700', icon: 'star-circle', iconColor: '#4f46e5' };
  }
  if (normalizedLabel.includes('trust') || normalizedLabel.includes('verified')) {
    return { bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-700', icon: 'shield-check', iconColor: '#059669' };
  }
  return { bg: 'bg-slate-100', border: 'border-slate-200', text: 'text-slate-600', icon: 'check-decagram-outline', iconColor: '#64748b' };
};

type ResponseItem = {
  id: number;
  prescription: number;
  user: number;
  response_text: string;
  image: string | null;
  store: number;
  store_name: string;
  store_address: string;
  store_contact: string;
  store_latitude: string;
  store_longitude: string;
  created_at: string;
  updated_at: string;
  total_amount: number | string;
  distance_km: number | string | null;
  uploaded_at: string;
  is_store_verified: boolean;
  is_store_active: boolean;
  capabilities?: CapabilityFlags;
  user_status?: string;
  user_contact_note?: string;
  user_report_note?: string;
  store_contact_note?: string;
  store_report_count?: number;
  user_report_count?: number;
  chat_thread_id?: number | null;
  medicines: Medicine[];
  stock_verified_at?: string;
  is_locked?: boolean;
  is_unresponsive?: boolean;
  response_version?: number;
  response_id?: number;
  last_refresh_requested_at?: string;
  // Cancel flow fields
  is_processing_started?: boolean;
  is_packed?: boolean;
  accepted_at?: string;
  processing_at?: string;
  locked_at?: string;
  completed_at?: string;
  cancelled_by?: string;
  cancel_reason?: string;
  delivery_option?: string;
  is_ratable?: boolean;
  user_rating?: any;
  store_rating?: any;
  store_overall_rating?: number;
  store_total_ratings?: number;
  quotation_scenario?: string;
  quality_score?: number;
  smart_tags?: string[];
  store_badges?: string[];
  trust_signal?: string;
  completion_otp?: string | null;
  completion_otp_requested?: boolean;
  completion_otp_expires_at?: string | null;
  can_order_again?: boolean;
  repeat_customer?: boolean;
  repeat_order_count?: number;
  last_order_at?: string | null;
  payable_amount?: number | string;
  delivery_offer?: {
    distance_km?: number | string | null;
    pickup_available: boolean;
    home_delivery_available: boolean;
    eligibility_code: string;
    unavailable_reason?: string;
    delivery_charge: number | string;
    estimated_delivery_minutes?: number | null;
    delivery_message?: string;
    assigned_delivery_person?: {
      id: number;
      name: string;
      vehicle_type: string;
      vehicle_number?: string;
    } | null;
  } | null;
  medicine_breakdown?: {
    total: number;
    available: number;
    unavailable: number;
    brand: number;
    generic: number;
    substitute: number;
    brand_pct: number;
    generic_pct: number;
    substitute_pct: number;
    unavailable_pct: number;
    unavailable_names: string[];
  };
  best_deal?: {
    is_best: boolean;
    savings: number;
  };
};

type StoreBadgeCountField =
  | 'store_orders_delivered'
  | 'store_completed_orders_count'
  | 'store_total_completed_orders'
  | 'completed_orders_count'
  | 'total_completed_orders'
  | 'orders_delivered';

const getStoreHighlightLabels = (item?: ResponseItem | null) => {
  if (!item) return [];

  const rawLabels = [
    item.trust_signal,
    ...(item.store_badges || []),
    ...(item.smart_tags || []),
  ];

  return Array.from(
    new Set(
      rawLabels
        .map((label) => String(label || '').trim())
        .filter(Boolean)
    )
  );
};

const getDeliveredOrdersLabel = (item?: ResponseItem | null, labels: string[] = []) => {
  const labelMatch = labels.find((label) => {
    const normalizedLabel = label.toLowerCase();
    return normalizedLabel.includes('order') && (normalizedLabel.includes('deliver') || normalizedLabel.includes('completed'));
  });

  if (labelMatch) return labelMatch;

  const source = item as (ResponseItem & Partial<Record<StoreBadgeCountField, number | string | null>>) | null | undefined;
  const possibleCounts = [
    source?.store_orders_delivered,
    source?.store_completed_orders_count,
    source?.store_total_completed_orders,
    source?.completed_orders_count,
    source?.total_completed_orders,
    source?.orders_delivered,
    item?.repeat_order_count,
  ];
  const count = possibleCounts
    .map((value) => Number(value))
    .find((value) => Number.isFinite(value) && value > 0);

  if (!count) return null;

  const roundedCount = Math.floor(count);
  return `${roundedCount}${roundedCount >= 50 ? '+' : ''} Completed`;
};

const getPrimaryStoreBadgeLabel = (item?: ResponseItem | null, labels = getStoreHighlightLabels(item)) => {
  return getDeliveredOrdersLabel(item, labels) || labels[0] || null;
};

const getStoreBadgeSheetLabels = (item?: ResponseItem | null) => {
  const labels = getStoreHighlightLabels(item);
  const primaryLabel = getPrimaryStoreBadgeLabel(item, labels);

  return Array.from(
    new Set(
      [primaryLabel, ...labels].filter((label): label is string => Boolean(label))
    )
  );
};

type OfferSection = 'offers' | 'refresh' | 'rejected';

const OFFER_SECTION_OPTIONS: { key: OfferSection; label: string; icon: string; color: string; bg: string; desc: string }[] = [
  { key: 'offers', label: 'Offers', icon: 'tag-heart-outline', color: '#059669', bg: '#ecfdf5', desc: 'Fresh pharmacy quotes' },
  { key: 'refresh', label: 'Refresh Quote', icon: 'cached', color: '#d97706', bg: '#fffbeb', desc: 'Needs stock refresh' },
  { key: 'rejected', label: 'Discarded', icon: 'close-circle-outline', color: '#dc2626', bg: '#fef2f2', desc: 'Rejected offers' },
];

const normalizeOfferStatus = (status?: string | null) => (status || 'pending').toLowerCase();
const isRejectedOfferStatus = (status?: string | null) => ['rejected', 'dismissed'].includes(normalizeOfferStatus(status));
const isOrderStatus = (status?: string | null) => ['accepted', 'processing', 'locked', 'out_for_delivery', 'completed', 'cancelled'].includes(normalizeOfferStatus(status));
const isRefreshQuoteDue = (item: Pick<ResponseItem, 'user_status' | 'stock_verified_at' | 'is_unresponsive' | 'last_refresh_requested_at'>, now: number) => {
  const status = normalizeOfferStatus(item.user_status);
  if (isOrderStatus(status) || isRejectedOfferStatus(status)) return false;
  const stockAgeMs = item.stock_verified_at ? now - new Date(item.stock_verified_at).getTime() : 0;
  return !!item.is_unresponsive || !!item.last_refresh_requested_at || (!!item.stock_verified_at && stockAgeMs > 30 * 60000);
};
const isOpenOfferCard = (item: ResponseItem) => {
  const status = normalizeOfferStatus(item.user_status);
  return !isOrderStatus(status) && !isRejectedOfferStatus(status);
};
const isActiveOfferCard = (item: ResponseItem, now: number) => (
  isOpenOfferCard(item) && !isRefreshQuoteDue(item, now)
);
const isBestDealOffer = (item: ResponseItem) => item.best_deal?.is_best === true;
const getOfferAmountValue = (item: Pick<ResponseItem, 'total_amount'>) => {
  const value = Number(item.total_amount);
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
};
const getOfferCreatedTime = (item: Pick<ResponseItem, 'created_at' | 'updated_at'>) => {
  const value = new Date(item.created_at || item.updated_at || 0).getTime();
  return Number.isFinite(value) ? value : 0;
};
const getOfferDistanceValue = (item: Pick<ResponseItem, 'distance_km'>) => {
  const rawDistance = String(item.distance_km ?? '').toLowerCase();
  const value = parseFloat(rawDistance);
  if (!Number.isFinite(value)) return Number.POSITIVE_INFINITY;
  return rawDistance.includes('meter') ? value / 1000 : value;
};
const getOfferScenario = (item: Pick<ResponseItem, 'quotation_scenario'>) =>
  String(item.quotation_scenario || '').toUpperCase();
const formatOfferDistanceLabel = (distance?: ResponseItem['distance_km']) => {
  const rawDistance = String(distance ?? '').trim();
  if (!rawDistance) return 'Nearby';
  const normalizedDistance = rawDistance.toLowerCase();
  if (normalizedDistance.includes('km') || normalizedDistance.includes('meter') || normalizedDistance.includes('near')) {
    return rawDistance;
  }
  const value = Number(rawDistance);
  return Number.isFinite(value) ? value + ' km' : rawDistance;
};
const hasOfferReport = (item: ResponseItem) => (
  Number(item.store_report_count || 0) > 0 ||
  Boolean(item.store_contact_note) ||
  Number(item.user_report_count || 0) > 0 ||
  Boolean(item.user_contact_note) ||
  Boolean(item.user_report_note)
);

type Medicine = {
  medicine_name: string;
  medicine_brand?: string;
  medicine_type?: string;
  price: number;
  is_available: boolean;
};

type OfferDetails = {
  id?: number;
  image?: string;
  store_name: string;
  store_address: string;
  store_contact: string;
  store?: number;
  medicines: Medicine[];
  response_text: string;
  total_amount: number;
  is_store_verified: boolean;
  is_store_active?: boolean;
  capabilities?: CapabilityFlags;
  stock_verified_at?: string;
  quotation_scenario?: string;
  user_status?: string;
  delivery_option?: string;
  accepted_at?: string;
  updated_at?: string;
  response_id?: number;
  response_version?: number;
  is_processing_started?: boolean;
  is_packed?: boolean;
  is_locked?: boolean;
  processing_at?: string;
  locked_at?: string;
  completed_at?: string;
  delivery_offer?: ResponseItem['delivery_offer'];
  payable_amount?: number | string;
  medicine_breakdown?: {
    total: number;
    available: number;
    unavailable: number;
    brand: number;
    generic: number;
    substitute: number;
    brand_pct: number;
    generic_pct: number;
    substitute_pct: number;
    unavailable_pct: number;
    unavailable_names: string[];
  };
};

type MedicineTypeInfoTarget = 'brand' | 'generic' | 'substitute' | 'mixed' | 'partial';

type MedicineDealSource = {
  quotation_scenario?: string | null;
  medicine_breakdown?: {
    total?: number;
    available?: number;
    unavailable?: number;
    brand?: number;
    generic?: number;
    substitute?: number;
  } | null;
  medicines?: Medicine[] | null;
};

type MedicineDealMeta = {
  target: MedicineTypeInfoTarget;
  label: string;
  subtitle: string;
  icon: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  iconColor: string;
};

const MEDICINE_DEAL_META: Record<MedicineTypeInfoTarget, MedicineDealMeta> = {
  brand: {
    target: 'brand',
    label: 'Brand',
    subtitle: 'Prescribed brand',
    icon: 'pill',
    bgClass: 'bg-blue-50',
    borderClass: 'border-blue-100',
    textClass: 'text-blue-700',
    iconColor: '#2563eb',
  },
  generic: {
    target: 'generic',
    label: 'Generic',
    subtitle: 'Low-cost generic',
    icon: 'flask-outline',
    bgClass: 'bg-amber-50',
    borderClass: 'border-amber-100',
    textClass: 'text-amber-700',
    iconColor: '#d97706',
  },
  substitute: {
    target: 'substitute',
    label: 'Alt Brand',
    subtitle: 'Substitute option',
    icon: 'swap-horizontal-bold',
    bgClass: 'bg-purple-50',
    borderClass: 'border-purple-100',
    textClass: 'text-purple-700',
    iconColor: '#9333ea',
  },
  mixed: {
    target: 'mixed',
    label: 'Mixed',
    subtitle: 'Brand + Generic',
    icon: 'layers-triple',
    bgClass: 'bg-emerald-50',
    borderClass: 'border-emerald-100',
    textClass: 'text-emerald-700',
    iconColor: '#059669',
  },
  partial: {
    target: 'partial',
    label: 'Partial',
    subtitle: 'Some items missing',
    icon: 'alert-circle-outline',
    bgClass: 'bg-red-50',
    borderClass: 'border-red-100',
    textClass: 'text-red-700',
    iconColor: '#dc2626',
  },
};

const normalizeMedicineDealTarget = (scenario?: string | null): MedicineTypeInfoTarget | null => {
  const key = String(scenario || '').toLowerCase().replace(/[\s.+-]+/g, '_');
  if (!key) return null;
  if (key.includes('exact_brand') || key.includes('prescribed_brand')) return 'brand';
  if (key.includes('all_generic') || key === 'generic' || key.includes('generics')) return 'generic';
  if (key.includes('mixed') || key.includes('brand_generic') || key.includes('brands_generics')) return 'mixed';
  if (key.includes('substitute') || key.includes('alt_brand')) return 'substitute';
  if (key.includes('partial') || key.includes('some_items')) return 'partial';
  return null;
};

const getMedicineDealTarget = (source?: MedicineDealSource | null): MedicineTypeInfoTarget | null => {
  const scenarioTarget = normalizeMedicineDealTarget(source?.quotation_scenario);
  if (scenarioTarget) return scenarioTarget;

  const breakdown = source?.medicine_breakdown;
  if (breakdown) {
    const typedCounts = [
      { target: 'brand' as const, count: Number(breakdown.brand || 0) },
      { target: 'generic' as const, count: Number(breakdown.generic || 0) },
      { target: 'substitute' as const, count: Number(breakdown.substitute || 0) },
    ].filter((entry) => entry.count > 0);

    if (Number(breakdown.available || 0) > 0 && Number(breakdown.unavailable || 0) > 0) return 'partial';
    if (typedCounts.length > 1) return 'mixed';
    if (typedCounts.length === 1) return typedCounts[0].target;
  }

  const medicineTypes = Array.from(new Set((source?.medicines || [])
    .filter((medicine) => medicine.is_available !== false)
    .map((medicine) => normalizeMedicineDealTarget(medicine.medicine_type) || (medicine.medicine_type === 'brand' ? 'brand' : null))
    .filter(Boolean))) as MedicineTypeInfoTarget[];

  if (medicineTypes.length > 1) return 'mixed';
  return medicineTypes[0] || null;
};

const getMedicineDealMeta = (source?: MedicineDealSource | null) => {
  const target = getMedicineDealTarget(source);
  return target ? MEDICINE_DEAL_META[target] : null;
};

type OrderProgressUpdate = Partial<ResponseItem> & {
  response_id?: number;
  id?: number;
};

type OrderLike = {
  id?: number;
  response_id?: number;
  updated_at?: string;
};

type StoreCapabilityUpdate = {
  store_id?: number;
  response_ids?: number[];
  is_store_active?: boolean;
  is_store_verified?: boolean;
  capabilities?: CapabilityFlags;
  updated_at?: string;
};

type StoreCapabilityOrderLike = OrderLike & {
  store?: number;
  is_store_active?: boolean;
  is_store_verified?: boolean;
  capabilities?: CapabilityFlags;
};

const getOrderIdentity = (item?: OrderLike | null) => {
  if (!item) return undefined;
  return item.response_id ?? item.id;
};

const isSameOrder = (
  item: OrderLike | null | undefined,
  update: OrderProgressUpdate
) => {
  const itemId = getOrderIdentity(item);
  const updateId = update.response_id ?? update.id;
  return itemId != null && updateId != null && itemId === updateId;
};

const isSameStoreCapabilityTarget = (
  item: StoreCapabilityOrderLike | null | undefined,
  update: StoreCapabilityUpdate
) => {
  if (!item) return false;

  const responseIds = new Set((update.response_ids || []).map(Number));
  const itemId = getOrderIdentity(item);
  if (itemId != null && responseIds.has(Number(itemId))) return true;

  return update.store_id != null && item.store != null && Number(item.store) === Number(update.store_id);
};

const mergeStoreCapabilityUpdate = <T extends StoreCapabilityOrderLike>(
  item: T,
  update: StoreCapabilityUpdate
): T => ({
  ...item,
  capabilities: update.capabilities ?? item.capabilities,
  is_store_active: update.is_store_active ?? update.capabilities?.availability?.store ?? item.is_store_active,
  is_store_verified: update.is_store_verified ?? update.capabilities?.availability?.store_verified ?? item.is_store_verified,
});

const shouldApplyOrderUpdate = (
  item: OrderLike,
  update: OrderProgressUpdate
) => {
  if (!update.updated_at || !item.updated_at) return true;
  const existingTime = new Date(item.updated_at).getTime() || 0;
  const newTime = new Date(update.updated_at).getTime() || Date.now();
  return newTime >= existingTime;
};

const mergeOrderUpdate = <T extends OrderLike>(
  item: T,
  update: OrderProgressUpdate
): T => {
  const { id: updateId, ...safeUpdate } = update;
  const normalizedResponseId = update.response_id ?? updateId ?? item.response_id ?? item.id;

  return {
    ...item,
    ...safeUpdate,
    response_id: normalizedResponseId,
  } as T;
};

const RefreshTimer = ({ stockVerifiedAt }: { stockVerifiedAt: string }) => {
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    const updateTimer = () => {
      const verifiedTime = new Date(stockVerifiedAt).getTime();
      const expiryTime = verifiedTime + 30 * 60 * 1000;
      const now = Date.now();
      const diff = expiryTime - now;

      if (diff <= 0) {
        setTimeLeft('Expired');
        return;
      }

      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${mins}:${secs < 10 ? '0' : ''}${secs}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [stockVerifiedAt]);

  if (timeLeft === 'Expired') return null;

  return (
    <View className="flex-row items-center mt-1">
      <MaterialCommunityIcons name="clock-fast" size={10} color="#10b981" />
      <Text className="text-emerald-400 font-bold uppercase text-[7px] tracking-widest ml-1">
        Fulfillment expires in {timeLeft}
      </Text>
    </View>
  );
};

// const QuotationHintBanner = ({
//   breakdown,
//   scenario
// }: {
//   breakdown?: {
//     total: number;
//     available: number;
//     unavailable: number;
//     brand: number;
//     generic: number;
//     substitute: number;
//     brand_pct: number;
//     generic_pct: number;
//     substitute_pct: number;
//     unavailable_pct: number;
//     unavailable_names: string[];
//   };
//   scenario?: string;
// }) => {
//   if (!breakdown) return null;

//   const {
//     total,
//     available,
//     unavailable,
//     brand,
//     generic,
//     substitute,
//     brand_pct,
//     generic_pct,
//     substitute_pct,
//     unavailable_pct,
//     unavailable_names
//   } = breakdown;

//   const scenarioKey = scenario?.toUpperCase().replace(/[\s\.\+]/g, '_') || '';

//   let hintTitle = "Medicine Breakdown";
//   let hintMsg = "Check the visual breakdown of brand and generic medicines below.";
//   let hintIcon = "pill";
//   let hintColor = "#10b981";
//   let hintBg = "bg-slate-50";
//   let borderStyle = "border-slate-100";

//   if (scenarioKey.includes("PRESCRIBED") || scenarioKey.includes("EXACT_BRAND")) {
//     hintTitle = "Perfect Brand Match!";
//     hintMsg = "All prescribed brands are available. No substitutions were made.";
//     hintIcon = "check-decagram";
//     hintColor = "#3b82f6";
//     hintBg = "bg-blue-50/70";
//     borderStyle = "border-blue-100/60";
//   } else if (scenarioKey.includes("ALL_GENERIC") || scenarioKey.includes("GENERICS")) {
//     hintTitle = "100% Generic Efficiency";
//     hintMsg = "Same exact active formula & strength, but in high-quality generic alternative brands. Maximizes your savings!";
//     hintIcon = "flask-outline";
//     hintColor = "#10b981";
//     hintBg = "bg-emerald-50/70";
//     borderStyle = "border-emerald-100/60";
//   } else if (scenarioKey.includes("BRANDS_GENERICS") || scenarioKey.includes("MIXED")) {
//     hintTitle = "Smart Mixed Option";
//     hintMsg = `A combination of original brands (${brand_pct}%) and generic equivalents (${generic_pct}%) to optimize both availability and cost.`;
//     hintIcon = "layers-outline";
//     hintColor = "#f59e0b";
//     hintBg = "bg-amber-50/70";
//     borderStyle = "border-amber-100/60";
//   } else if (scenarioKey.includes("ALT") || scenarioKey.includes("SUBSTITUTES")) {
//     hintTitle = "Alternative Brand Options";
//     hintMsg = "Alternative premium brands with exact same salts are available. Consult your doctor if needed.";
//     hintIcon = "swap-horizontal";
//     hintColor = "#8b5cf6";
//     hintBg = "bg-purple-50/70";
//     borderStyle = "border-purple-100/60";
//   } else if (scenarioKey.includes("SOME") || scenarioKey.includes("PARTIAL")) {
//     hintTitle = "Partial Availability";
//     hintMsg = `Only ${available} out of ${total} medicines are available from this pharmacy.`;
//     hintIcon = "alert-circle-outline";
//     hintColor = "#ef4444";
//     hintBg = "bg-red-50/70";
//     borderStyle = "border-red-100/60";
//   }

//   return (
//     <View className={`p-5 rounded-[2rem] mb-6 border ${borderStyle} ${hintBg} shadow-sm`}>
//       <View className="flex-row items-center mb-3">
//         <View style={{ backgroundColor: `${hintColor}15` }} className="w-9 h-9 rounded-full items-center justify-center mr-3">
//           <MaterialCommunityIcons name={hintIcon as any} size={18} color={hintColor} />
//         </View>
//         <View className="flex-1">
//           <Text style={{ color: hintColor }} className="text-xs font-black uppercase tracking-wider">{hintTitle}</Text>
//           <Text className="text-slate-600 text-[10.5px] font-bold mt-0.5 leading-4">{hintMsg}</Text>
//         </View>
//       </View>

//       <View className="h-2.5 w-full bg-slate-200/60 rounded-full flex-row overflow-hidden my-3.5">
//         {brand > 0 && <View style={{ width: `${brand_pct}%`, backgroundColor: '#3b82f6' }} />}
//         {generic > 0 && <View style={{ width: `${generic_pct}%`, backgroundColor: '#10b981' }} />}
//         {substitute > 0 && <View style={{ width: `${substitute_pct}%`, backgroundColor: '#8b5cf6' }} />}
//         {unavailable > 0 && <View style={{ width: `${unavailable_pct}%`, backgroundColor: '#ef4444' }} />}
//       </View>

//       {/* Commented out as these details are already shown in the Inventory details section below */}
//       {/* 
//       <View className="flex-row flex-wrap gap-2.5 mt-1.5">
//         {brand > 0 && (
//           <View className="bg-white/80 border border-blue-100 px-3 py-1 rounded-full flex-row items-center">
//             <View className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-2" />
//             <Text className="text-blue-700 text-[9.5px] font-extrabold">{brand} Brand ({brand_pct}%)</Text>
//           </View>
//         )}
//         {generic > 0 && (
//           <View className="bg-white/80 border border-emerald-100 px-3 py-1 rounded-full flex-row items-center">
//             <View className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2" />
//             <Text className="text-emerald-700 text-[9.5px] font-extrabold">{generic} Generic ({generic_pct}%)</Text>
//           </View>
//         )}
//         {substitute > 0 && (
//           <View className="bg-white/80 border border-purple-100 px-3 py-1 rounded-full flex-row items-center">
//             <View className="w-1.5 h-1.5 rounded-full bg-purple-500 mr-2" />
//             <Text className="text-purple-700 text-[9.5px] font-extrabold">{substitute} Substitute ({substitute_pct}%)</Text>
//           </View>
//         )}
//         {unavailable > 0 && (
//           <View className="bg-white/80 border border-red-100 px-3 py-1 rounded-full flex-row items-center">
//             <View className="w-1.5 h-1.5 rounded-full bg-red-500 mr-2" />
//             <Text className="text-red-700 text-[9.5px] font-extrabold">{unavailable} Unavailable ({unavailable_pct}%)</Text>
//           </View>
//         )}
//       </View>

//       {unavailable > 0 && unavailable_names && unavailable_names.length > 0 && (
//         <View className="mt-4 bg-red-50/50 border border-red-100/50 p-3.5 rounded-2xl">
//           <View className="flex-row items-center mb-1.5">
//             <MaterialCommunityIcons name="alert-circle-outline" size={13} color="#ef4444" />
//             <Text className="text-red-700 text-[9px] font-black uppercase tracking-wider ml-1.5">Missing Medicines (Not in Quote)</Text>
//           </View>
//           <View className="flex-row flex-wrap gap-1.5">
//             {unavailable_names.map((name, idx) => (
//               <View key={idx} className="bg-white border border-red-100 px-2 py-0.5 rounded-lg">
//                 <Text className="text-red-600 text-[9px] font-bold line-through">{name}</Text>
//               </View>
//             ))}
//           </View>
//         </View>
//       )}
//       */}
//     </View>
//   );
// };

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🏆 Best Deal Badge — Pulsing glow animation
// Shows on the response card with lowest price
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const BestDealBadge = ({ savings }: { savings?: number }) => {
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  const glowAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    // Pulse scale animation
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 750, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 750, useNativeDriver: true }),
      ])
    );
    // Glow opacity animation
    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.3, duration: 900, useNativeDriver: true }),
      ])
    );
    pulse.start();
    glow.start();
    return () => { pulse.stop(); glow.stop(); };
  }, []);

  return (
    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
      <Animated.View
        style={{
          opacity: glowAnim,
          position: 'absolute',
          top: -4, left: -4, right: -4, bottom: -4,
          borderRadius: 18,
          backgroundColor: '#10b981',
          shadowColor: '#10b981',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 1,
          shadowRadius: 12,
          elevation: 8,
        }}
      />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#059669',
          borderRadius: 14,
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderWidth: 1,
          borderColor: '#34d399',
        }}
      >
        <MaterialCommunityIcons name="trophy-award" size={13} color="#fef3c7" style={{ marginRight: 5 }} />
        <View>
          <Text style={{ color: '#fff', fontSize: 8, fontWeight: '900', letterSpacing: 1.5, textTransform: 'uppercase' }} numberOfLines={1}>
            Best Deal
          </Text>
          {savings != null && savings > 0 && (
            <Text style={{ color: '#a7f3d0', fontSize: 7, fontWeight: '700' }} numberOfLines={1}>
              Save ₹{savings} vs others
            </Text>
          )}
        </View>
      </View>
    </Animated.View>
  );
};

export default function Prescription() {
  const predefinedReasons = [
    "Store did not answer",
    "Invalid number",
    "Store denied service",
    "Wrong address",
    "Others",
  ];

  const BASE_URL = Constants.expoConfig?.extra?.BASE_URL || '';
  const { user, token } = useSelector((state: RootState) => state.user);
  const dispatch = useDispatch<AppDispatch>();
  const [data, setData] = useState<ResponseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [isLastPage, setIsLastPage] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [offerDetails, setOfferDetails] = useState<OfferDetails | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loadingOffer, setLoadingOffer] = useState(false);
  const [startDate, setStartDate] = useState<Date | null>(new Date());
  const [endDate, setEndDate] = useState<Date | null>(new Date());
  const [showDatePicker, setShowDatePicker] = useState<{ mode: 'start' | 'end'; visible: boolean }>({
    mode: 'start',
    visible: false,
  });
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [offerSection, setOfferSection] = useState<OfferSection>('offers');
  const [offerMenuVisible, setOfferMenuVisible] = useState(false);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [selectedResponseId, setSelectedResponseId] = useState<number | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<"accepted" | "rejected" | null>(null);
  const [deliveryModalVisible, setDeliveryModalVisible] = useState(false);
  const [modalReportVisible, setReportModalVisible] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [selectedReason, setSelectedReason] = useState("");
  const [SelectedReportId, setSelectedReportId] = useState<number | null>(null);
  const [userReports, setUserReports] = useState<{ note: string; created_at: string }[]>([]);
  const [reportCount, setReportCount] = useState(0);
  const [storeReports, setStoreReports] = useState<{ note: string; created_at: string; store_name?: string }[]>([]);
  const [storeReportCount, setStoreReportCount] = useState(0);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [cancelTargetId, setCancelTargetId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelStatus, setCancelStatus] = useState<string>('');
  const [cancelLoading, setCancelLoading] = useState(false);

  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [ratingOrderTarget, setRatingOrderTarget] = useState<ResponseItem | null>(null);

  const [trackingModalVisible, setTrackingModalVisible] = useState(false);
  const [trackingOrderTarget, setTrackingOrderTarget] = useState<ResponseItem | null>(null);
  const [visibleCompletionOtpId, setVisibleCompletionOtpId] = useState<number | null>(null);
  const [orderAgainLoadingId, setOrderAgainLoadingId] = useState<number | null>(null);

  const [storeReviewsVisible, setStoreReviewsVisible] = useState(false);
  const [currentStoreReviews, setCurrentStoreReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [currentStoreName, setCurrentStoreName] = useState("");
  const [currentReviewStoreItem, setCurrentReviewStoreItem] = useState<ResponseItem | null>(null);
  const [storeBadgesVisible, setStoreBadgesVisible] = useState(false);
  const [storeBadgesTarget, setStoreBadgesTarget] = useState<ResponseItem | null>(null);
  const [medTypeInfoVisible, setMedTypeInfoVisible] = useState(false);
  const [medTypeInfoTarget, setMedTypeInfoTarget] = useState<MedicineTypeInfoTarget | null>(null);

  const storeBadgesSheetLabels = getStoreBadgeSheetLabels(storeBadgesTarget);
  const storeBadgesPrimaryLabel = getPrimaryStoreBadgeLabel(
    storeBadgesTarget,
    getStoreHighlightLabels(storeBadgesTarget)
  );

  const openStoreBadgesSheet = (item: ResponseItem) => {
    setStoreBadgesTarget(item);
    setStoreBadgesVisible(true);
  };

  const fetchStoreReviews = async (storeId: number, storeName: string, itemResponse?: ResponseItem) => {
    try {
      setReviewsLoading(true);
      setCurrentStoreName(storeName);
      if (itemResponse) {
        setCurrentReviewStoreItem(itemResponse);
      }
      setStoreReviewsVisible(true);
      const res = await axios.get(`${BASE_URL}/api/ratings/store/${storeId}/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCurrentStoreReviews(res.data);
    } catch {
      Toast.show({ type: 'error', text1: 'Could not load reviews', position: 'bottom' });
    } finally {
      setReviewsLoading(false);
    }
  };

  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const router = useRouter();

  const initiateChat = (item: ResponseItem) => {
    // Lazy Navigation: Navigate to id '0' and pass context
    // The thread will be created ONLY when the first message is sent
    router.push({
      pathname: "/chat/[id]",
      params: {
        id: (item as any).chat_thread_id?.toString() || "0",
        store_id: item.store,
        prescription_id: item.prescription,
        prescription_image: item.image, // Added image context
        store_name: item.store_name // Optional: for display header
      }
    } as any);
  };

  const startDateRef = useRef<Date | null>(new Date());
  const endDateRef = useRef<Date | null>(new Date());
  const isFocused = useIsFocused();

  // 🛡️ Idempotency: Track processed event IDs — prevents duplicate UI updates on retry/glitch
  const seenEventIds = useRef<Set<string>>(new Set());
  // 🔢 Ordering: Track last applied seq per response_id — discards stale out-of-order events
  const lastSeqMap = useRef<Map<number, number>>(new Map());

  useEffect(() => { startDateRef.current = startDate; }, [startDate]);
  useEffect(() => { endDateRef.current = endDate; }, [endDate]);

  const fetchResponses = async (pageNum = 1, append = false, overrideStart?: Date | null, overrideEnd?: Date | null) => {
    if (!token || !user || user.user_type !== 'user') return;
    try {
      if (append) setLoadingMore(true);
      else setLoading(true);

      let url = `${BASE_URL}/api/responses/${user.id}/?page=${pageNum}&page_size=10`;

      // Use explicit override dates if provided (for reset), otherwise fall back to refs
      const sDate = overrideStart !== undefined ? overrideStart : startDateRef.current;
      const eDate = overrideEnd !== undefined ? overrideEnd : endDateRef.current;

      if (sDate && eDate) {
        const start = startOfLocalDay(sDate);
        const end = endOfLocalDay(eDate);
        url += `&start_date=${formatLocalDateParam(start)}&end_date=${formatLocalDateParam(end)}`;
      }

      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const newResults = response.data.results;
      setData((prev) => (append ? [...prev, ...newResults] : newResults));
      setPage(response.data.page);
      setIsLastPage(response.data.page >= response.data.total_pages);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!token || !user) {
      dispatch(fetchUserProfile());
    }
  }, [dispatch, token, user]);

  useFocusEffect(
    useCallback(() => {
      if (token && user) {
        setStartDate(new Date());
        setEndDate(new Date());
        setPage(1);
        setFilterSheetVisible(false);
        // Throttle check: Only fetch if needed or just follow logic
        setTimeout(() => fetchResponses(1, false), 100);
      }
    }, [token, user])
  );

  // 🔄 Hybrid Real-Time Strategy: WebSocket (Instant) + API (Consistency)
  useEffect(() => {
    if (!token || !user || user.user_type !== 'user') return;

    let socket: WebSocket | null = null;
    let reconnectTimeout: any;
    let retryCount = 0;

    const connect = () => {
      // Build socket URL
      const socketUrl = BASE_URL.replace('http', 'ws') + '/ws/orders/';
      socket = new WebSocket(`${socketUrl}?token=${token}`);

      socket.onopen = () => {
        console.log('Fulfillment WS Connected');
        retryCount = 0; // Reset backoff on success

        // 🏁 Gap Fix: Fetch latest state from API on every connect/reconnect
        // This ensures if we missed events while offline, the UI is now in sync.
        fetchResponses(1, false);
      };

      socket.onmessage = (e) => {
        try {
          const message = JSON.parse(e.data);
          if (message.type === 'fulfillment_update') {
            const update = message.data;

            // 🛡️ Idempotency Check: Drop events we've already processed (retry / network glitch)
            const eventId: string | undefined = message.event_id;
            if (eventId) {
              if (seenEventIds.current.has(eventId)) {
                console.log(`[WS] Duplicate event dropped: ${eventId.slice(0, 8)}…`);
                return;
              }
              seenEventIds.current.add(eventId);
              // Bound set to last 200 events to prevent memory leak
              if (seenEventIds.current.size > 200) {
                const first = seenEventIds.current.values().next().value;
                if (first) seenEventIds.current.delete(first);
              }
            }

            // 🔢 Ordering Check: Drop stale out-of-order events using sequence number
            const seq: number | undefined = message.seq;
            if (!['new_offer', 'completion_otp_requested'].includes(message.action) && seq != null) {
              const itemId: number | undefined = update?.id ?? update?.response_id;
              if (itemId != null) {
                const lastSeq = lastSeqMap.current.get(itemId) ?? -1;
                if (seq <= lastSeq) {
                  console.log(`[WS] Stale event dropped: seq=${seq} <= lastSeq=${lastSeq} for response ${itemId}`);
                  return;
                }
                lastSeqMap.current.set(itemId, seq);
              }
            }

            if (message.action === 'store_capability_changed') {
              const capabilityUpdate = update as StoreCapabilityUpdate;

              setData(prevData => prevData.map(item => (
                isSameStoreCapabilityTarget(item, capabilityUpdate)
                  ? mergeStoreCapabilityUpdate(item, capabilityUpdate)
                  : item
              )));

              setTrackingOrderTarget(prev => {
                if (!prev) return prev;
                return isSameStoreCapabilityTarget(prev, capabilityUpdate)
                  ? mergeStoreCapabilityUpdate(prev, capabilityUpdate)
                  : prev;
              });

              setOfferDetails(prev => {
                if (!prev) return prev;
                return isSameStoreCapabilityTarget(prev, capabilityUpdate)
                  ? mergeStoreCapabilityUpdate(prev, capabilityUpdate)
                  : prev;
              });

              const statusCode = capabilityUpdate.capabilities?.status?.code;
              if (statusCode === 'store_inactive' || statusCode === 'store_unverified') {
                const isUnverified = statusCode === 'store_unverified';
                Toast.show({
                  type: 'info',
                  text1: isUnverified ? 'Store Not Verified' : 'Store is unavailable',
                  text2: isUnverified ? 'Actions for this pharmacy are temporarily paused for your safety.' : 'Actions for this pharmacy are paused.',
                  position: 'bottom',
                });
              }
              return;
            }

            if (message.action === 'new_offer') {
              setData(prev => {
                if (prev.some(i => i.id === update.id)) return prev;
                return [update, ...prev];
              });

              // Ensure backend recalculates and pushes the latest "Best Deal" statuses for ALL cards
              fetchResponses(1, false);

              Toast.show({
                type: 'success',
                text1: 'New Price Quote!',
                text2: `${update.store_name} just sent a quote for ₹${update.total_amount}`,
                position: 'bottom'
              });
              return;
            }

            if (message.action === 'new_chat_message') {
              console.log("[DEBUG] User WS received new_chat_message:", update);
              Toast.show({
                type: 'info',
                text1: `💬 ${update.sender_name}`,
                text2: update.text,
                position: 'bottom',
                visibilityTime: 4000
              });
              return;
            }

            if (message.action === 'completion_otp_requested') {
              Toast.show({
                type: 'info',
                text1: 'Completion OTP Requested',
                text2: 'Share the OTP shown on your order card with the store.',
                position: 'bottom',
                visibilityTime: 5000
              });
            }

            setData(prevData => prevData.map(item => {
              if (isSameOrder(item, update) && shouldApplyOrderUpdate(item, update)) {
                return mergeOrderUpdate(item, update);
              }
              return item;
            }));

            setTrackingOrderTarget(prev => {
              if (!prev) return prev;
              if (isSameOrder(prev, update) && shouldApplyOrderUpdate(prev, update)) {
                return mergeOrderUpdate(prev, update);
              }
              return prev;
            });

            setOfferDetails(prev => {
              if (!prev) return prev;
              if (isSameOrder(prev, update) && shouldApplyOrderUpdate(prev, update)) {
                return mergeOrderUpdate(prev, update);
              }
              return prev;
            });

            if (update.user_status === 'locked' || update.is_locked) {
              Toast.show({ type: 'success', text1: 'Order Secured!', text2: 'Pharmacy has billed your order.', position: 'bottom' });
            }
          }
        } catch (err) {
          console.warn('Fulfillment WS Parse Error:', err);
        }
      };

      socket.onclose = (e) => {
        // 🚀 Exponential Backoff: 2s -> 4s -> 8s -> 10s max
        const delay = Math.min(10000, Math.pow(2, retryCount) * 1000);
        console.log(`Fulfillment WS Closed. Retrying in ${delay / 1000}s...`);

        reconnectTimeout = setTimeout(() => {
          retryCount++;
          connect();
        }, delay);
      };

      socket.onerror = () => {
        socket?.close();
      };
    };

    connect();

    return () => {
      if (socket) socket.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [token, user, BASE_URL]);

  const fetchOfferDetails = async (id: number, initialData?: any) => {
    try {
      if (initialData) {
        setOfferDetails(initialData);
        setModalVisible(true);
      }
      setLoadingOffer(true);
      setSelectedResponseId(id);
      const url = `${BASE_URL}/api/response/${id}/`;
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOfferDetails(response.data);
      setModalVisible(true);
    } catch (error) {
      console.error(error);
      setOfferDetails(null);
      setModalVisible(true);
    } finally {
      setLoadingOffer(false);
    }
  };

  const updateResponseStatus = async (responseId: number, status: "accepted" | "rejected", reason?: string) => {
    // 🛡️ FSM Fix: Backend only allows 'pending' → 'dismissed' and 'quoted' → 'rejected'
    // Never send 'rejected' for a 'pending' item — it will 400 Bad Request
    const item = data.find(d => d.id === responseId);
    const currentStatus = item?.user_status || 'pending';
    const resolvedStatus = status === 'rejected'
      ? (currentStatus === 'quoted' ? 'rejected' : 'dismissed')
      : 'accepted';
    if (resolvedStatus === 'accepted') {
      setSelectedResponseId(responseId);
      setConfirmModalVisible(false);
      setDeliveryModalVisible(true);
      return;
    }
    try {
      await axios.patch(`${BASE_URL}/api/responses/${responseId}/status/`, {
        user_status: resolvedStatus,
        cancel_reason: reason,
      }, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });

      Toast.show({
        type: 'success',
        text1: 'Decline Recorded',
        text2: 'Update recorded successfully.',
        position: 'bottom',
      });
      fetchResponses(1, false);
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Update failed', position: 'bottom' });
    }
  };

  const updateDeliveryOption = async (option: "walk_in" | "online") => {
    if (!selectedResponseId) return;
    try {
      await axios.patch(`${BASE_URL}/api/responses/${selectedResponseId}/status/`, {
        user_status: 'accepted',
        delivery_option: option,
      }, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });

      setDeliveryModalVisible(false);
      Toast.show({
        type: 'success',
        text1: 'Order Secured!',
        text2: `Order accepted for ${option === 'walk_in' ? 'store pickup' : 'home delivery'}.`,
        position: 'bottom',
      });
      fetchResponses(1, false);
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Failed to set delivery', position: 'bottom' });
    }
  };

  const handleStatusPress = (id: number, status: "accepted" | "rejected") => {
    setSelectedResponseId(id);
    setSelectedStatus(status);
    setConfirmModalVisible(true);
  };

  const submitContactNote = async () => {
    if (!SelectedReportId || (!selectedReason && !noteText.trim())) return;
    const finalNote = selectedReason === "Others" ? noteText.trim() : `${selectedReason}${noteText.trim() ? `: ${noteText}` : ""}`;
    try {
      await axios.post(`${BASE_URL}/api/safety-reports/`, { reference_id: SelectedReportId, category: 'other', description: finalNote }, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
      });
      Alert.alert("Success", "Report Submitted Successfully");
      setNoteText("");
      setSelectedReason("");
      fetchResponses(1, false);
      setReportModalVisible(false);
    } catch (error) {
      Alert.alert("Error", "Submission Failed");
    }
  };

  const fetchUserNotes = async (
    responseId: number,
    fallbackStoreReports: { note: string; created_at: string; store_name?: string }[] = []
  ) => {
    try {
      const res = await axios.get(`${BASE_URL}/api/safety-reports/?reference_id=${responseId}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const reports = (res.data.reports || []).map((report: any) => ({
        note: report.description, created_at: report.created_at, status: report.status_display,
      }));
      setUserReports(reports);
      setReportCount(res.data.count || reports.length);
      setStoreReports(fallbackStoreReports);
      setStoreReportCount(fallbackStoreReports.length);
    } catch (err) {
      if (fallbackStoreReports.length) {
        setStoreReports(fallbackStoreReports);
        setStoreReportCount(fallbackStoreReports.length);
      }
      console.error(err);
    }
  };

  const requestStockRefresh = async (responseId: number) => {
    try {
      setLoading(true);
      await axios.post(`${BASE_URL}/api/responses/${responseId}/refresh-request/`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      Toast.show({
        type: 'success',
        text1: 'Refresh Requested',
        text2: 'Pharmacist has 10 mins to verify stock.',
        position: 'bottom'
      });
      fetchResponses(1, false);
    } catch (error: any) {
      if (error.response?.status === 429) {
        const cooldown = error.response.data.cooldown_seconds || 300;
        Toast.show({
          type: 'info',
          text1: 'Slow Down',
          text2: `You can refresh again in ${Math.ceil(cooldown / 60)} mins.`,
          position: 'bottom'
        });
      } else {
        Toast.show({ type: 'error', text1: 'Request failed', position: 'bottom' });
      }
    } finally {
      setLoading(false);
    }
  };

  const openCancelModal = (item: ResponseItem) => {
    setCancelTargetId(item.id);
    setCancelStatus(item.user_status || '');
    setCancelReason('');
    setCancelModalVisible(true);
  };

  const openRejectModal = (id: number) => {
    setRejectTargetId(id);
    setRejectReason('');
    setRejectModalVisible(true);
  };

  const handleRejectSubmit = async () => {
    if (!rejectTargetId) return;
    if (!rejectReason.trim()) {
      Toast.show({ type: 'error', text1: 'Reason Required', text2: 'Please provide a reason to reject.', position: 'bottom' });
      return;
    }
    setRejectModalVisible(false);
    await updateResponseStatus(rejectTargetId, "rejected", rejectReason.trim());
  };

  const handleCancelOrder = async () => {
    if (!cancelTargetId) return;
    const needsReason = cancelStatus === 'processing';
    if (needsReason && !cancelReason.trim()) {
      Toast.show({ type: 'error', text1: 'Reason Required', text2: 'Please provide a reason for cancellation.', position: 'bottom' });
      return;
    }
    try {
      setCancelLoading(true);
      await axios.post(`${BASE_URL}/api/responses/${cancelTargetId}/cancel/`,
        { reason: cancelReason.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCancelModalVisible(false);
      Toast.show({ type: 'success', text1: 'Order Cancelled', text2: 'Your order has been cancelled.', position: 'bottom' });
      await fetchResponses(1, false);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Could not cancel order.';
      Toast.show({ type: 'error', text1: 'Cannot Cancel', text2: msg, position: 'bottom' });
    } finally {
      setCancelLoading(false);
    }
  };

  const submitOrderAgain = async (item: ResponseItem, scope: 'preferred_only' | 'all_stores') => {
    if (!token) return;
    try {
      setOrderAgainLoadingId(item.id);
      const res = await axios.post(
        `${BASE_URL}/api/responses/${item.id}/order-again/`,
        { scope },
        { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
      );
      const dispatchStatus = res.data?.dispatch?.status;
      Toast.show({
        type: dispatchStatus === 'preferred_store_unavailable' ? 'info' : 'success',
        text1: dispatchStatus === 'preferred_store_unavailable' ? 'Store unavailable' : 'Prescription sent again',
        text2: dispatchStatus === 'preferred_store_unavailable'
          ? 'Last store is unavailable right now. Try all verified stores.'
          : scope === 'preferred_only'
            ? 'Sent to your last successful store.'
            : 'Quotes are being requested from eligible stores.',
        position: 'bottom',
      });
      await fetchResponses(1, false);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Could not create a new request.';
      Toast.show({ type: 'error', text1: 'Order Again failed', text2: msg, position: 'bottom' });
    } finally {
      setOrderAgainLoadingId(null);
    }
  };

  const confirmOrderAgain = (item: ResponseItem) => {
    Alert.alert(
      'Order Again',
      'Create a new prescription request from this completed order. This will restart the quote process.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Last store only', onPress: () => submitOrderAgain(item, 'preferred_only') },
        { text: 'All verified stores', onPress: () => submitOrderAgain(item, 'all_stores') },
      ]
    );
  };

  const renderItem = ({ item }: { item: ResponseItem }) => {
    const formattedDate = new Date(item.updated_at).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
    });

    const status = item.user_status || 'pending';
    const isExpired = !!item.stock_verified_at && (new Date().getTime() - new Date(item.stock_verified_at).getTime()) > 30 * 60000;

    const getStatusTheme = () => {
      if (status === 'completed') return { bg: ['#0f172a', '#18243a', '#064e3b'], icon: 'check-decagram', color: '#10b981', label: 'Order Completed', sub: 'Successfully Delivered' };
      if (status === 'cancelled' || status === 'rejected' || status === 'dismissed') return { bg: ['#450a0a', '#7f1d1d', '#991b1b'], icon: 'close-octagon', color: '#fca5a5', label: (status === 'dismissed' || status === 'rejected') ? 'Offer Rejected' : 'Order Cancelled', sub: 'Request Terminated' };
      if (item.is_locked || status === 'locked' || status === 'out_for_delivery') return { bg: ['#1e1b4b', '#312e81', '#4338ca'], icon: 'shield-key', color: '#818cf8', label: 'Action Required', sub: 'Ready for Fulfillment' };
      if (status === 'accepted' || status === 'processing') return { bg: ['#0f172a', '#1e293b', '#0ea5e9'], icon: 'progress-clock', color: '#38bdf8', label: 'Pharmacy Processing', sub: 'Order is being prepared' };
      if (isExpired) return { bg: ['#451a03', '#78350f', '#9a3412'], icon: 'clock-alert', color: '#fdba74', label: 'Offer Expired', sub: 'Refresh for latest price' };
      return { bg: ['#0f172a', '#1e293b', '#10b981'], icon: 'store-clock', color: '#34d399', label: 'Market Offer', sub: 'New Quote Available' };
    };

    const theme = getStatusTheme();
    const hasCompletionOtp = !!(item.completion_otp_requested && item.completion_otp && status !== 'completed');
    const pharmacyReportCount = item.store_report_count || (item.store_contact_note ? 1 : 0);
    const imageUrl = buildMediaUrl(BASE_URL, item.image);
    const storeHighlights = getStoreHighlightLabels(item);
    const primaryStoreBadgeLabel = getPrimaryStoreBadgeLabel(item, storeHighlights);
    const storeBadgeSheetLabels = getStoreBadgeSheetLabels(item);
    const extraStoreHighlightCount = Math.max(storeBadgeSheetLabels.length - 1, 0);
    const ratingLabel = formatStoreRating(item.store_overall_rating);
    const ratingCountLabel = item.store_total_ratings ? `${item.store_total_ratings} ratings` : 'Reviews';
    const formattedOfferAmount = Number.isNaN(Number(item.total_amount))
      ? String(item.total_amount || 'Quote')
      : Number(item.total_amount).toLocaleString('en-IN', { maximumFractionDigits: 2 });
    const medicineTotal = item.medicine_breakdown?.total || item.medicines?.length || 0;
    const medicineAvailable = item.medicine_breakdown?.available ?? item.medicines?.filter((medicine) => medicine.is_available).length ?? 0;
    const medicineAvailabilityPct = medicineTotal > 0 ? Math.min(100, Math.max(0, Math.round((medicineAvailable / medicineTotal) * 100))) : 0;
    const savingsLabel = item.best_deal?.savings && item.best_deal.savings > 0 ? `Save ₹${item.best_deal.savings}` : null;
    const distanceLabel = formatOfferDistanceLabel(item.distance_km);
    // const fulfillmentLabel = item.delivery_option === 'walk_in' ? 'Pickup' : item.delivery_option === 'online' ? 'Delivery' : 'Quote';
    const scenarioLabel = item.quotation_scenario
      ? item.quotation_scenario.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
      : 'Medicine quote';
    const medicineDeal = getMedicineDealMeta(item);
    const hasVisibleStoreHighlights = Boolean(primaryStoreBadgeLabel);
    const hasMedicineBreakdown = !!item.medicine_breakdown && (
      Number(item.medicine_breakdown.brand || 0) > 0 ||
      Number(item.medicine_breakdown.generic || 0) > 0 ||
      Number(item.medicine_breakdown.substitute || 0) > 0 ||
      Number(item.medicine_breakdown.unavailable || 0) > 0
    );

    const renderStoreInfo = () => (
      <View className="mb-3">
        <View className="flex-row items-start">
          <View className="w-[52px] h-[52px] rounded-[1.05rem] bg-slate-100 border border-slate-200 items-center justify-center overflow-hidden shadow-sm">
            {imageUrl ? (
              <RemoteImageWithStatus uri={imageUrl} loadingLabel="Loading prescription" />
            ) : (
              <MaterialCommunityIcons name="storefront-outline" size={22} color="#94a3b8" />
            )}
          </View>

          <View className="ml-3 flex-1">
            <View className="flex-row items-start justify-between">
              <View className="flex-1 pr-2">
                <View className="flex-row items-center">
                  <Text className="flex-1 text-[15px] font-black text-slate-950 leading-5" numberOfLines={1}>{item.store_name}</Text>
                  {Boolean(item.is_store_verified) ? (
                    <View className="ml-1.5 h-5 w-5 rounded-full bg-emerald-50 border border-emerald-100 items-center justify-center">
                      <MaterialCommunityIcons name="check-decagram" size={11} color="#059669" />
                    </View>
                  ) : null}
                </View>
                <View className="mt-1.5 flex-row flex-wrap gap-1">

                  <View className="h-5 rounded-full bg-slate-100 border border-slate-200 px-1.5 flex-row items-center">
                    <MaterialCommunityIcons name="map-marker-radius-outline" size={10} color="#64748b" />
                    <Text className="ml-1 text-[7.5px] font-black uppercase tracking-[0.7px] text-slate-600">{distanceLabel}</Text>
                  </View>
                  {hasVisibleStoreHighlights ? (
                    <TouchableOpacity
                      activeOpacity={0.86}
                      onPress={() => openStoreBadgesSheet(item)}
                      className="mt-2 h-8 max-w-full self-start flex-row items-center rounded-full border border-blue-100 bg-blue-50 px-2.5"
                    >
                      <MaterialCommunityIcons name="truck-delivery-outline" size={14} color="#1d4ed8" />
                      <Text
                        className="ml-1.5 max-w-[190px] flex-shrink text-[11px] font-black text-blue-700"
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.82}
                      >
                        {primaryStoreBadgeLabel}
                      </Text>
                      {extraStoreHighlightCount > 0 ? (
                        <View className="ml-1.5 rounded-full bg-white/90 px-1.5 py-0.5">
                          <Text className="text-[9px] font-black text-blue-700">+{extraStoreHighlightCount}</Text>
                        </View>
                      ) : null}
                      <MaterialCommunityIcons name="chevron-up" size={14} color="#2563eb" />
                    </TouchableOpacity>
                  ) : null}
                  {/* <View className="h-5 rounded-full bg-cyan-50 border border-cyan-100 px-1.5 flex-row items-center">
                    <MaterialCommunityIcons name={item.delivery_option === "walk_in" ? "store-clock-outline" : "truck-fast-outline"} size={10} color="#0891b2" />
                    <Text className="ml-1 text-[7.5px] font-black uppercase tracking-[0.7px] text-cyan-700">{fulfillmentLabel}</Text>
                  </View> */}
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => item.store && fetchStoreReviews(Number(item.store), item.store_name || "Pharmacy Store", item)}
                className="min-w-[64px] rounded-xl bg-emerald-600 border border-emerald-700 px-2 py-1 items-center shadow-sm shadow-emerald-200"
              >
                <View className="flex-row items-center">
                  <Text className="text-white text-[11px] font-black">{ratingLabel}</Text>
                  <MaterialCommunityIcons name="star" size={10} color="#fef3c7" style={{ marginLeft: 3 }} />
                </View>
                <Text className="mt-0.5 text-[6.5px] font-black uppercase tracking-[0.8px] text-emerald-100" numberOfLines={1}>{ratingCountLabel}</Text>
              </TouchableOpacity>
            </View>

            <Text className=" text-[9.5px] font-semibold leading-4 text-slate-500" numberOfLines={2}>{item.store_address}</Text>
          </View>
        </View>

        {/* {hasVisibleStoreHighlights ? (
          <TouchableOpacity
            activeOpacity={0.86}
            onPress={() => openStoreBadgesSheet(item)}
            className="mt-2 h-8 max-w-full self-start flex-row items-center rounded-full border border-blue-100 bg-blue-50 px-2.5"
          >
            <MaterialCommunityIcons name="truck-delivery-outline" size={14} color="#1d4ed8" />
            <Text
              className="ml-1.5 max-w-[190px] flex-shrink text-[11px] font-black text-blue-700"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
            >
              {primaryStoreBadgeLabel}
            </Text>
            {extraStoreHighlightCount > 0 ? (
              <View className="ml-1.5 rounded-full bg-white/90 px-1.5 py-0.5">
                <Text className="text-[9px] font-black text-blue-700">+{extraStoreHighlightCount}</Text>
              </View>
            ) : null}
            <MaterialCommunityIcons name="chevron-up" size={14} color="#2563eb" />
          </TouchableOpacity>
        ) : null} */}
      </View>
    );

    const renderPricingAndBadges = () => (
      <View className="mb-3 overflow-hidden rounded-[1.15rem] border border-emerald-100 bg-emerald-50/50 shadow-sm shadow-emerald-100/70">
        <View className="px-3 py-3">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-2">
              <View className="flex-row items-center">
                <View className="h-7 w-7 items-center justify-center rounded-xl bg-white border border-emerald-100 shadow-sm shadow-emerald-100">
                  <MaterialCommunityIcons name="ticket-percent" size={14} color="#047857" />
                </View>
                <View className="ml-2 flex-1">
                  <Text className="text-[8px] font-black uppercase tracking-[1.8px] text-emerald-700">Total Offer</Text>
                  <Text className="mt-0.5 text-[9px] font-bold text-slate-500" numberOfLines={1}>{scenarioLabel}</Text>
                </View>
              </View>

              <View className="mt-2 flex-row items-end flex-wrap">
                <Text className="mb-1 mr-1 text-base font-black text-emerald-700">₹</Text>
                <Text className="text-[32px] font-black tracking-tight text-slate-950" numberOfLines={1}>{formattedOfferAmount}</Text>
                {!!medicineDeal ? (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => { setMedTypeInfoTarget(medicineDeal.target); setMedTypeInfoVisible(true); }}
                    className={`mb-1 ml-2 h-7 flex-row items-center rounded-full border px-2.5 ${medicineDeal.bgClass} ${medicineDeal.borderClass}`}
                  >
                    <MaterialCommunityIcons name={medicineDeal.icon as any} size={11} color={medicineDeal.iconColor} />
                    <Text className={`ml-1 text-[8px] font-black uppercase tracking-[0.8px] ${medicineDeal.textClass}`} numberOfLines={1}>
                      {medicineDeal.label}
                    </Text>
                    <MaterialCommunityIcons name="information-outline" size={9} color={medicineDeal.iconColor} style={{ marginLeft: 3 }} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            <View className="items-end max-w-[128px]">
              {item.best_deal?.is_best ? (
                <BestDealBadge savings={item.best_deal.savings} />
              ) : (
                <View className="h-7 rounded-full border border-white bg-white/85 px-2.5 flex-row items-center">
                  <MaterialCommunityIcons name="tag-outline" size={11} color="#047857" />
                  <Text className="ml-1 text-[7.5px] font-black uppercase tracking-[0.7px] text-emerald-700" numberOfLines={1}>Quote</Text>
                </View>
              )}
              {!!savingsLabel && !item.best_deal?.is_best ? (
                <View className="mt-1.5 h-6 rounded-full border border-emerald-200 bg-white px-2 flex-row items-center">
                  <MaterialCommunityIcons name="cash-refund" size={10} color="#059669" />
                  <Text className="ml-1 text-[7.5px] font-black uppercase tracking-[0.7px] text-emerald-700" numberOfLines={1}>{savingsLabel}</Text>
                </View>
              ) : null}
            </View>
          </View>



        </View>
      </View>
    );

    const renderActionToolbar = () => {
      const isActiveOrder = ['accepted', 'processing', 'locked', 'out_for_delivery'].includes(status) || !!item.is_locked;

      return (
        <View className="mt-1 flex-row items-center gap-2 border-t border-slate-100 pt-3">
          <TouchableOpacity
            onPress={() => fetchOfferDetails(item.id, item)}
            className="h-10 flex-1 rounded-[1rem] bg-slate-950 px-3 flex-row items-center justify-center active:bg-slate-800"
          >
            <MaterialCommunityIcons name="text-box-search-outline" size={16} color="#34d399" />
            <Text className="ml-2 text-[10px] font-black uppercase tracking-[1.5px] text-white">View Offer</Text>
          </TouchableOpacity>

          <View className="flex-row items-center gap-1.5">
            {isActiveOrder && (
              <TouchableOpacity
                onPress={() => {
                  setTrackingOrderTarget(item);
                  setTrackingModalVisible(true);
                }}
                className="h-10 w-10 justify-center items-center bg-slate-50 border border-slate-200 rounded-[1rem] active:bg-slate-100"
              >
                <MaterialCommunityIcons name="truck-delivery-outline" size={17} color="#475569" />
              </TouchableOpacity>
            )}
            {!!item.image && (
              <TouchableOpacity onPress={() => setSelectedImage(imageUrl)} className="h-10 w-10 justify-center items-center bg-slate-50 border border-slate-200 rounded-[1rem] active:bg-slate-100">
                <MaterialCommunityIcons name="file-image-outline" size={17} color="#475569" />
              </TouchableOpacity>
            )}
            {status !== 'completed' && status !== 'cancelled' && status !== 'rejected' && status !== 'dismissed' && (
              <>
                <TouchableOpacity onPress={() => initiateChat(item)} className="h-10 w-10 justify-center items-center bg-slate-50 border border-slate-200 rounded-[1rem] active:bg-slate-100">
                  <MaterialCommunityIcons name="chat-outline" size={17} color="#475569" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => Linking.openURL(`tel:${item.store_contact}`)} className="h-10 w-10 justify-center items-center bg-emerald-50 border border-emerald-200 rounded-[1rem] active:bg-emerald-100">
                  <MaterialCommunityIcons name="phone" size={17} color="#059669" />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      );
    };

    return (
      <View
        key={item.id}
        style={{ borderTopColor: theme.color, borderTopWidth: 3 }}
        className="bg-white rounded-[1.5rem] mb-4 border border-slate-200 shadow-lg shadow-slate-300/30 mx-3 overflow-hidden"
      >
        <View className="bg-white px-3.5 py-2.5 border-b border-slate-100">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center flex-1 pr-3">
              <View style={{ backgroundColor: `${theme.color}14`, borderColor: `${theme.color}30` }} className="w-9 h-9 rounded-[1rem] items-center justify-center border">
                <MaterialCommunityIcons name={theme.icon as any} size={15} color={theme.color} />
              </View>
              <View className="ml-3 flex-1">
                <Text style={{ color: theme.color }} className="font-black text-[9px] uppercase tracking-[2px]" numberOfLines={1}>{theme.label}</Text>
                <Text className="text-slate-500 font-bold text-[8px] uppercase tracking-[1px] mt-0.5" numberOfLines={1}>{theme.sub}</Text>
              </View>
            </View>
            <View className="items-end max-w-[118px]">
              <Text className="text-[7px] font-black uppercase tracking-[1.4px] text-slate-400">Updated</Text>
              <Text className="mt-0.5 text-[8px] font-bold text-slate-600" numberOfLines={1}>{formattedDate}</Text>
            </View>
          </View>
        </View>

        {/* OTP Banner (Active Orders) */}
        {hasCompletionOtp && (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setVisibleCompletionOtpId((current) => current === item.id ? null : item.id)}
            className="bg-indigo-600 border-b border-indigo-700/30"
          >
            <LinearGradient
              colors={['#4338ca', '#4f46e5', '#3730a3']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              className="px-4 py-3 flex-row items-center justify-between"
            >
              <View className="flex-row items-center flex-1">
                <MaterialCommunityIcons name="shield-key" size={20} color="#a5b4fc" />
                <View className="ml-2 flex-1">
                  <Text className="text-indigo-200 text-[8px] font-black uppercase tracking-[2px]">Action Required</Text>
                  <Text className="text-white text-xs font-black mt-0.5">Show OTP to Store</Text>
                </View>
              </View>
              <View className="min-w-[90px] px-2 py-1.5 rounded-xl bg-white/95 items-center">
                <Text className="text-indigo-700 font-black text-lg tracking-[3px]">
                  {visibleCompletionOtpId === item.id ? formatCompletionOtp(item.completion_otp) : '••••••'}
                </Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        <View className="px-3.5 pt-3 pb-3 relative">
          {renderStoreInfo()}
          {renderPricingAndBadges()}
          {renderActionToolbar()}

          {/* Conditional Actions based on status */}

          {/* 1. Pending (Needs Accept/Discard) */}
          {(status === 'pending' || !status) && (
            <View className="mt-3 flex-row gap-2">
              <TouchableOpacity
                onPress={() => openRejectModal(item.id)}
                className="h-10 flex-1 rounded-[1rem] border border-slate-200 bg-white flex-row items-center justify-center"
              >
                <MaterialCommunityIcons name="close-circle-outline" size={15} color="#64748b" />
                <Text className="ml-1.5 text-[9px] font-black tracking-[1.4px] uppercase text-slate-500">Reject</Text>
              </TouchableOpacity>
              {isExpired ? (
                <TouchableOpacity
                  onPress={() => requestStockRefresh(item.id)}
                  className="h-10 flex-[1.7] rounded-[1rem] bg-amber-500 flex-row items-center justify-center shadow-sm shadow-amber-200"
                >
                  <MaterialCommunityIcons name="cached" size={15} color="white" />
                  <Text className="ml-1.5 text-white font-black tracking-[1.4px] uppercase text-[9px]">Refresh Quote</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => handleStatusPress(item.id, "accepted")}
                  className="h-10 flex-[1.7] rounded-[1rem] bg-emerald-600 items-center justify-center shadow-sm shadow-emerald-200"
                >
                  <View className="flex-row items-center">
                    <MaterialCommunityIcons name="check-bold" size={14} color="white" />
                    <Text className="ml-1.5 text-white font-black tracking-[1.4px] uppercase text-[9px]">Accept Offer</Text>
                  </View>
                  {!!item.stock_verified_at && <RefreshTimer stockVerifiedAt={item.stock_verified_at} />}
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* 2. Accepted / Processing (Needs Cancel option) */}
          {(status === 'accepted' || status === 'processing') && !item.is_locked && (
            <TouchableOpacity
              onPress={() => openCancelModal(item)}
              className="mt-4 py-2.5 bg-red-50 rounded-xl flex-row justify-center items-center border border-red-100"
            >
              <MaterialCommunityIcons name="close-circle-outline" size={14} color="#ef4444" />
              <Text className="text-red-500 font-bold text-[9px] uppercase tracking-widest ml-1.5">
                {status === 'processing' ? 'Cancel Order (Reason Required)' : 'Cancel Order'}
              </Text>
            </TouchableOpacity>
          )}

          {/* 3. Completed (Needs Rating and Order Again) */}
          {status === 'completed' && (
            <View className="mt-4 pt-4 border-t border-slate-100">
              <View className="flex-row gap-2">
                {!item.user_rating && item.is_ratable && (
                  <TouchableOpacity
                    onPress={() => { setRatingOrderTarget(item); setRatingModalVisible(true); }}
                    className="flex-1 py-3 bg-emerald-50 rounded-xl flex-row justify-center items-center border border-emerald-100"
                  >
                    <MaterialCommunityIcons name="star-outline" size={14} color="#059669" />
                    <Text className="text-emerald-700 font-bold text-[9px] uppercase tracking-widest ml-1.5">Rate Store</Text>
                  </TouchableOpacity>
                )}
                {
                  <TouchableOpacity
                    onPress={() => confirmOrderAgain(item)}
                    disabled={orderAgainLoadingId === item.id}
                    className="flex-1 py-3 bg-slate-900 rounded-xl flex-row justify-center items-center shadow-sm shadow-slate-300"
                  >
                    {orderAgainLoadingId === item.id ? (
                      <ActivityIndicator size="small" color="#10b981" />
                    ) : (
                      <MaterialCommunityIcons name="repeat" size={14} color="#34d399" />
                    )}
                    <Text className="text-white font-bold text-[9px] uppercase tracking-widest ml-1.5">Order Again</Text>
                  </TouchableOpacity>
                }
              </View>
            </View>
          )}

          {/* 4. Cancelled (Shows reason) */}
          {(status === 'cancelled' || status === 'rejected' || status === 'dismissed') && !!item.cancel_reason && (
            <View className="mt-4 p-3 bg-red-50 rounded-xl border border-red-100">
              <Text className="text-red-700 text-[8px] font-black uppercase tracking-[2px] mb-1">
                {(status === 'cancelled')
                  ? (item.cancelled_by === 'store' ? 'Cancelled by Store' : item.cancelled_by === 'user' ? 'Cancelled by You' : 'Cancellation Reason')
                  : (item.cancelled_by === 'store' ? 'Rejected by Store' : item.cancelled_by === 'user' ? 'Rejected by You' : 'Rejection Reason')
                }
              </Text>
              <Text className="text-red-900 font-medium text-xs italic">{'"'}{item.cancel_reason}{'"'}</Text>
            </View>
          )}

          {/* 5. Report Problem Button */}
          <TouchableOpacity
            className="mt-4 flex-row items-center px-4 py-2 rounded-xl bg-gray-50 border border-gray-100 justify-center"
            onPress={() => {
              const fallbackStoreReports = item.store_contact_note ? [{
                note: item.store_contact_note,
                created_at: item.updated_at || item.created_at,
                store_name: item.store_name,
              }] : [];
              setReportModalVisible(true);
              setSelectedReportId(item.id);
              setUserReports([]);
              setReportCount(0);
              setStoreReports(fallbackStoreReports);
              setStoreReportCount(pharmacyReportCount);
              fetchUserNotes(item.id, fallbackStoreReports);
            }}
          >
            <MaterialCommunityIcons name="flag-outline" size={12} color="#ef4444" />
            <Text className="ml-1.5 text-red-500 font-bold text-[8.5px] uppercase tracking-widest">Report Problem</Text>
            {pharmacyReportCount > 0 && (
              <View className="ml-2 min-w-[18px] h-[18px] px-1.5 rounded-full bg-red-100 items-center justify-center">
                <Text className="text-red-700 font-black text-[8px]">{pharmacyReportCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Capabilities Overlay */}
          {shouldShowOverlay(item.capabilities) && (
            <UnavailableOverlay capabilities={item.capabilities} borderRadius={24} variant="overlay" />
          )}
        </View>
      </View>
    );
  };


  const renderOfferSkeleton = () => (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 40, paddingBottom: 150 }} showsVerticalScrollIndicator={false}>
      {[1, 2, 3].map((item) => (
        <View key={item} className="bg-white rounded-[2.5rem] mb-8 border border-slate-200/60 shadow-2xl shadow-slate-300/40 overflow-hidden mx-4">
          <LinearGradient
            colors={['#0f172a', '#1e293b', '#064e3b']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="h-14"
          />
          <View className="p-6">
            <View className="flex-row items-center mb-5">
              <View className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100/50" />
              <View className="ml-5 flex-1">
                <View className="h-5 w-40 bg-slate-200 rounded-full mb-3" />
                <View className="h-3 w-52 bg-slate-100 rounded-full" />
              </View>
            </View>
            <View className="bg-slate-50 rounded-[1.75rem] p-5 border border-slate-100 mb-5">
              <View className="h-3 w-36 bg-emerald-100 rounded-full mb-4" />
              <View className="h-3 w-full bg-slate-100 rounded-full mb-2" />
              <View className="h-3 w-3/4 bg-slate-100 rounded-full" />
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1 h-12 bg-slate-100 rounded-[1.25rem]" />
              <View className="flex-[1.8] h-12 bg-slate-900 rounded-[1.25rem]" />
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );

  const offerFilterLabel = activeFilter !== 'all'
    ? activeFilter.replace(/_/g, ' ')
    : 'Filter';
  const offerDateRangeLabel = startDate && endDate
    ? `${startDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} - ${endDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`
    : 'Date';
  const offerCombinedFilterLabel = `${offerFilterLabel} • ${offerDateRangeLabel}`;
  const activeOfferSectionOption = OFFER_SECTION_OPTIONS.find((option) => option.key === offerSection) || OFFER_SECTION_OPTIONS[0];
  const offerSectionCounts = useMemo(() => ({
    offers: data.filter((item) => isActiveOfferCard(item, currentTime)).length,
    refresh: data.filter((item) => isRefreshQuoteDue(item, currentTime)).length,
    rejected: data.filter((item) => isRejectedOfferStatus(item.user_status)).length,
  }), [currentTime, data]);
  const visibleOfferData = useMemo(() => {
    let list = [...data];

    if (activeFilter === 'best_deal') {
      return list.filter((item) => isOpenOfferCard(item) && isBestDealOffer(item));
    }

    if (offerSection === 'offers') list = list.filter((item) => isActiveOfferCard(item, currentTime));
    if (offerSection === 'refresh') list = list.filter((item) => isRefreshQuoteDue(item, currentTime));
    if (offerSection === 'rejected') list = list.filter((item) => isRejectedOfferStatus(item.user_status));

    switch (activeFilter) {
      case 'lowest_price':
        return list.sort((a, b) => getOfferAmountValue(a) - getOfferAmountValue(b));
      case 'fastest':
        return list.sort((a, b) => getOfferCreatedTime(b) - getOfferCreatedTime(a));
      case 'nearest':
        return list.sort((a, b) => getOfferDistanceValue(a) - getOfferDistanceValue(b));
      case 'generic':
        return list.filter((item) => getOfferScenario(item).includes('GENERIC'));
      case 'brand':
        return list.filter((item) => {
          const scenario = getOfferScenario(item);
          return scenario.includes('BRAND') || scenario.includes('PRESCRIBED');
        });
      case 'reported':
        return list.filter(hasOfferReport);
      default:
        return list;
    }
  }, [activeFilter, currentTime, data, offerSection]);
  const selectedOfferDeal = getMedicineDealMeta(offerDetails);
  const selectedDeliveryQuote = offerDetails?.delivery_offer
    || data.find(item => item.id === selectedResponseId)?.delivery_offer
    || null;

  return (
    <View className="flex-1 bg-[#fbfcfd]">
      <View className="relative overflow-hidden px-2 z-50">
        {/* <View className="relative overflow-hidden  z-50"> */}
        {/* <LinearGradient
            colors={['#123b59', '#0d8a63']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="relative min-h-[150px] overflow-hidden px-4 py-4"
          >
            <View className="absolute -right-10 -bottom-8 h-[190px] w-[245px] items-center justify-center">
              <Image
                source={require('../../assets/images/useroffer.png')}
                className="h-full w-full"
                resizeMode="contain"
              />
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => fetchResponses(1, false)}
              accessibilityLabel="Refresh offers"
              className="absolute top-4 right-4 z-20 h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10"
            >
              <MaterialCommunityIcons name="refresh" size={24} color="#FFFFFF" />
            </TouchableOpacity>

            <View className="min-h-[118px] justify-center">
              <View className="z-10 w-[58%] min-w-0">
                <View className="flex-row items-center">
                  <Text className="text-[31px] font-black text-white tracking-[2px] leading-9" numberOfLines={1}>Offers</Text>
                  <View className="mx-3 h-9 w-px rounded-full bg-emerald-300/80" />
                </View>
                <Text className="mt-1.5 text-[10px] font-black uppercase tracking-[2px] text-white/45" numberOfLines={1}>
                  Live Price Responses
                </Text>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  className="mt-3"
                  contentContainerStyle={{ gap: 8, paddingRight: 6 }}
                >
                  <TouchableOpacity
                    activeOpacity={0.84}
                    onPress={() => setFilterSheetOpen(true)}
                    className="h-10 flex-row items-center rounded-full bg-white px-3 shadow-sm shadow-slate-950/10"
                  >
                    <MaterialCommunityIcons name="tune-variant" size={16} color="#007a53" />
                    <Text className="ml-2 text-[10px] font-black uppercase tracking-[1px] text-[#007a53]" numberOfLines={1}>
                      {offerFilterLabel}
                    </Text>
                    {activeFilter !== 'all' && (
                      <TouchableOpacity
                        onPress={() => setActiveFilter('all')}
                        className="ml-2 h-5 w-5 items-center justify-center rounded-full bg-emerald-50"
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <MaterialCommunityIcons name="close" size={11} color="#007a53" />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.84}
                    onPress={() => setFilterSheetVisible(true)}
                    className="h-10 flex-row items-center rounded-full bg-white px-3 shadow-sm shadow-slate-950/10"
                  >
                    <MaterialCommunityIcons name="calendar-range" size={15} color="#007a53" />
                    <Text className="ml-2 text-[9px] font-black uppercase tracking-[0.8px] text-[#007a53]" numberOfLines={1}>
                      {offerDateRangeLabel}
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </View>
          </LinearGradient> */}

        <ImageBackground
          source={require('../../assets/images/offeruser.png')}
          resizeMode="cover"
          className="relative h-[135px] overflow-hidden rounded-2xl"
        >
          {/* Refresh Button */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => fetchResponses(1, false)}
            accessibilityLabel="Refresh offers"
            className="absolute top-4 right-4 z-20 h-11 w-11 items-center justify-center rounded-full bg-black/35"
          >
            <MaterialCommunityIcons
              name="refresh"
              size={24}
              color="#FFFFFF"
            />
          </TouchableOpacity>

        </ImageBackground>

        {/* </View> */}
      </View>

      <View className="px-4 pt-2 pb-0" style={{ zIndex: 50, elevation: 10 }}>
        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            activeOpacity={0.86}
            onPress={() => setOfferMenuVisible(true)}
            className="h-9 flex-[1.05] flex-row items-center rounded-[1rem] border border-slate-200 bg-white px-3 shadow-sm shadow-slate-200/60"
          >
            <View style={{ backgroundColor: activeOfferSectionOption.bg }} className="h-9 w-9 items-center justify-center rounded-xl">
              <MaterialCommunityIcons name={activeOfferSectionOption.icon as any} size={18} color={activeOfferSectionOption.color} />
            </View>
            <View className="ml-2 flex-1">
              <Text className="text-[10px] font-black text-slate-950" numberOfLines={1}>{activeOfferSectionOption.label}</Text>
              <Text className="mt-0.5 text-[8px] font-black uppercase tracking-[0.8px] text-slate-400" numberOfLines={1}>
                {offerSectionCounts[activeOfferSectionOption.key]} records
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-down" size={18} color="#64748b" />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.86}
            onPress={() => setFilterSheetOpen(true)}
            accessibilityLabel={`Filter offers: ${offerCombinedFilterLabel}`}
            style={{
              borderColor: activeFilter !== 'all' ? '#a7f3d0' : '#e2e8f0',
              backgroundColor: activeFilter !== 'all' ? '#ecfdf5' : '#ffffff',
            }}
            className="h-9 flex-1 flex-row items-center rounded-[1rem] border px-3 shadow-sm shadow-slate-200/60"
          >
            <View className="h-9 w-9 items-center justify-center rounded-xl bg-emerald-50">
              <MaterialCommunityIcons name="tune-variant" size={18} color="#0d8a63" />
            </View>
            <View className="ml-2 flex-1">
              <Text className="text-[10px] font-black capitalize text-slate-950" numberOfLines={1}>
                {offerFilterLabel}
              </Text>
              <Text className="mt-0.5 text-[8px] font-black uppercase tracking-[0.8px] text-slate-400" numberOfLines={1}>
                {offerDateRangeLabel}
              </Text>
            </View>
            {activeFilter !== 'all' ? (
              <TouchableOpacity
                onPress={() => setActiveFilter('all')}
                className="h-6 w-6 items-center justify-center rounded-full bg-white"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialCommunityIcons name="close" size={13} color="#0d8a63" />
              </TouchableOpacity>
            ) : (
              <MaterialCommunityIcons name="chevron-down" size={18} color="#64748b" />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.86}
            onPress={() => setOfferMenuVisible(true)}
            className="h-9 w-14 items-center justify-center rounded-[1rem] border border-slate-200 bg-white shadow-sm shadow-slate-200/60"
          >
            <MaterialCommunityIcons name="menu" size={24} color={activeOfferSectionOption.color} />
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={offerMenuVisible} transparent animationType="fade" onRequestClose={() => setOfferMenuVisible(false)}>
        <View className="flex-1">
          <TouchableOpacity activeOpacity={1} onPress={() => setOfferMenuVisible(false)} className="absolute inset-0 bg-black/5" />
          <View className="absolute right-4 top-[236px] w-[238px] overflow-hidden rounded-[1.15rem] border border-slate-200 bg-white shadow-xl shadow-slate-300/50">
            <View className="border-b border-slate-100 px-4 py-3">
              <Text className="text-[10px] font-black uppercase tracking-[1.4px] text-slate-400">Offer Status</Text>
            </View>
            {OFFER_SECTION_OPTIONS.map((option) => {
              const selected = offerSection === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  activeOpacity={0.86}
                  onPress={() => { setOfferSection(option.key); setOfferMenuVisible(false); }}
                  style={{ backgroundColor: selected ? option.bg : '#ffffff' }}
                  className="flex-row items-center border-b border-slate-100 px-4 py-3.5"
                >
                  <View style={{ backgroundColor: selected ? '#ffffff' : option.bg }} className="h-10 w-10 items-center justify-center rounded-xl">
                    <MaterialCommunityIcons name={option.icon as any} size={20} color={option.color} />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="text-[12px] font-black text-slate-950" numberOfLines={1}>{option.label}</Text>
                    <Text className="mt-0.5 text-[8px] font-black uppercase tracking-[0.8px] text-slate-400" numberOfLines={1}>
                      {offerSectionCounts[option.key]} records
                    </Text>
                  </View>
                  {selected && <MaterialCommunityIcons name="check-circle" size={18} color={option.color} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>

      {loading && data.length === 0 ? (
        renderOfferSkeleton()
      ) : (
        <FlatList
          data={visibleOfferData}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 40, paddingBottom: 150 }}
          showsVerticalScrollIndicator={false}
          onEndReached={() => offerSection === 'offers' && activeFilter === 'all' && !loadingMore && !isLastPage && fetchResponses(page + 1, true)}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color="#059669" className="py-12" /> : <View className="h-12" />}
          ListEmptyComponent={!loading ? (
            <View className="mt-40 items-center">
              <MaterialCommunityIcons name="tag-heart-outline" size={64} color={activeFilter !== 'all' ? '#059669' : '#e2e8f0'} />
              <Text className="text-gray-400 font-extrabold text-[11px] uppercase tracking-[4px] mt-8">
                {activeFilter !== 'all' ? `No results for "${activeFilter.replace('_', ' ')}"` : `No ${activeOfferSectionOption.label}...`}
              </Text>
              {activeFilter !== 'all' && (
                <TouchableOpacity onPress={() => setActiveFilter('all')} style={{ marginTop: 12, backgroundColor: '#059669', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 8 }}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase' }}>Show All</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}
        />
      )}
      {/* ===== Combined Offer Filter Bottom Sheet ===== */}
      <Modal
        visible={filterSheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterSheetOpen(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <TouchableOpacity activeOpacity={1} onPress={() => setFilterSheetOpen(false)} className="absolute inset-0" />
          <View className="max-h-[88%] rounded-t-[2rem] bg-white px-5 pb-8 pt-3 shadow-2xl">
            <View className="items-center pb-4">
              <View className="h-1.5 w-12 rounded-full bg-slate-200" />
            </View>

            <View className="flex-row items-start justify-between">
              <View className="flex-1 pr-4">
                <Text className="text-[22px] font-black text-slate-950">Offer Filter</Text>
                <Text className="mt-1 text-[11px] font-bold uppercase tracking-[1.3px] text-slate-400">Sort, issue type and date range</Text>
              </View>
              <TouchableOpacity onPress={() => setFilterSheetOpen(false)} className="h-10 w-10 items-center justify-center rounded-2xl bg-slate-100">
                <MaterialCommunityIcons name="close" size={20} color="#334155" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="mt-5" contentContainerStyle={{ paddingBottom: 12 }}>
              <Text className="text-[10px] font-black uppercase tracking-[1.6px] text-slate-400">Date Range</Text>
              <View className="mt-3 flex-row gap-3">
                <TouchableOpacity
                  onPress={() => setShowDatePicker({ mode: 'start', visible: true })}
                  style={{ flex: 1, borderColor: startDate ? '#059669' : '#e2e8f0' }}
                  className="rounded-[1rem] border bg-slate-50 px-3 py-3"
                >
                  <View className="mb-1 flex-row items-center">
                    <MaterialCommunityIcons name="calendar-start" size={14} color={startDate ? '#059669' : '#94a3b8'} />
                    <Text className="ml-1.5 text-[9px] font-black uppercase tracking-[1px] text-slate-400">From</Text>
                  </View>
                  <Text className="text-[12px] font-black text-slate-900" numberOfLines={1}>
                    {startDate ? startDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Start date'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowDatePicker({ mode: 'end', visible: true })}
                  style={{ flex: 1, borderColor: endDate ? '#059669' : '#e2e8f0' }}
                  className="rounded-[1rem] border bg-slate-50 px-3 py-3"
                >
                  <View className="mb-1 flex-row items-center">
                    <MaterialCommunityIcons name="calendar-end" size={14} color={endDate ? '#059669' : '#94a3b8'} />
                    <Text className="ml-1.5 text-[9px] font-black uppercase tracking-[1px] text-slate-400">To</Text>
                  </View>
                  <Text className="text-[12px] font-black text-slate-900" numberOfLines={1}>
                    {endDate ? endDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'End date'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View className="mt-3 flex-row gap-2">
                {[{ label: 'Last 7D', days: 7 }, { label: 'Last 30D', days: 30 }, { label: '3 Months', days: 90 }].map((chip) => (
                  <TouchableOpacity
                    key={chip.label}
                    onPress={() => {
                      const d = new Date();
                      d.setDate(d.getDate() - (chip.days - 1));
                      setStartDate(startOfLocalDay(d));
                      setEndDate(endOfLocalDay(new Date()));
                    }}
                    className="flex-1 items-center rounded-xl border border-slate-200 bg-slate-50 py-2.5"
                  >
                    <Text className="text-[10px] font-black text-slate-600">{chip.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text className="mt-6 text-[10px] font-black uppercase tracking-[1.6px] text-slate-400">Sort & Filter</Text>
              <View className="mt-3 flex-row flex-wrap gap-2.5">
                {[
                  { key: 'all', label: 'All', icon: 'view-grid-outline', desc: 'Everything', color: '#64748b' },
                  { key: 'best_deal', label: 'Best Deal', icon: 'star-shooting', desc: 'Best price', color: '#f59e0b' },
                  { key: 'lowest_price', label: 'Lowest Price', icon: 'currency-inr', desc: 'Amount sort', color: '#10b981' },
                  { key: 'fastest', label: 'Fastest', icon: 'lightning-bolt', desc: 'Recent first', color: '#6366f1' },
                  { key: 'nearest', label: 'Nearest', icon: 'map-marker-radius', desc: 'Closest store', color: '#ef4444' },
                  { key: 'generic', label: 'Generic', icon: 'flask-outline', desc: 'Generic meds', color: '#06b6d4' },
                  { key: 'brand', label: 'Brand', icon: 'pill', desc: 'Brand meds', color: '#8b5cf6' },
                  { key: 'reported', label: 'Reported', icon: 'flag-triangle', desc: 'Store issues', color: '#ef4444' },
                ].map(f => {
                  const isActive = activeFilter === f.key;
                  return (
                    <TouchableOpacity
                      key={f.key}
                      onPress={() => { setActiveFilter(f.key); setFilterSheetOpen(false); }}
                      style={{ borderColor: isActive ? f.color : '#e2e8f0', backgroundColor: isActive ? f.color : '#ffffff' }}
                      className="w-[48%] flex-row items-center rounded-[1rem] border px-3 py-3"
                    >
                      <View style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.22)' : `${f.color}15` }} className="h-9 w-9 items-center justify-center rounded-xl">
                        <MaterialCommunityIcons name={f.icon as any} size={17} color={isActive ? '#ffffff' : f.color} />
                      </View>
                      <View className="ml-2 flex-1">
                        <Text className={`text-[10px] font-black ${isActive ? 'text-white' : 'text-slate-900'}`} numberOfLines={1}>{f.label}</Text>
                        <Text className={`mt-0.5 text-[8px] font-bold ${isActive ? 'text-white/75' : 'text-slate-400'}`} numberOfLines={1}>{f.desc}</Text>
                      </View>
                      {isActive && <MaterialCommunityIcons name="check-circle" size={15} color="#ffffff" />}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View className="mt-6 flex-row gap-3">
                <TouchableOpacity
                  onPress={() => {
                    const today = new Date();
                    const start = startOfLocalDay(today);
                    const end = endOfLocalDay(today);
                    setActiveFilter('all');
                    setStartDate(start);
                    setEndDate(end);
                    startDateRef.current = start;
                    endDateRef.current = end;
                    setFilterSheetOpen(false);
                    fetchResponses(1, false, start, end);
                  }}
                  className="flex-1 items-center rounded-[1.15rem] border border-slate-200 bg-white py-4"
                >
                  <Text className="text-[11px] font-black uppercase tracking-[1.5px] text-slate-500">Reset</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    const normalizedStart = startDate ? startOfLocalDay(startDate) : null;
                    const normalizedEnd = endDate ? endOfLocalDay(endDate) : (normalizedStart ? endOfLocalDay(normalizedStart) : null);
                    setStartDate(normalizedStart);
                    setEndDate(normalizedEnd);
                    startDateRef.current = normalizedStart;
                    endDateRef.current = normalizedEnd;
                    setFilterSheetOpen(false);
                    fetchResponses(1, false, normalizedStart, normalizedEnd);
                  }}
                  className="flex-[1.4] items-center rounded-[1.15rem] bg-[#007a5c] py-4"
                >
                  <Text className="text-[11px] font-black uppercase tracking-[1.5px] text-white">Apply</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ===== Cancel Order Modal ===== */}

      <Modal animationType="fade" transparent visible={cancelModalVisible}>
        <View className="flex-1 bg-gray-950/70 justify-center px-6">
          <View className="bg-white rounded-[2.5rem] p-8 shadow-2xl">
            <View className="items-center mb-6">
              <View className="w-14 h-14 bg-red-50 rounded-[1.5rem] items-center justify-center mb-4">
                <MaterialCommunityIcons name="close-circle-outline" size={28} color="#ef4444" />
              </View>
              <Text className="text-xl font-black text-gray-900 tracking-tighter">Cancel Order?</Text>
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                {cancelStatus === 'processing' ? 'Order is being prepared' : 'This action cannot be undone'}
              </Text>
            </View>

            {cancelStatus === 'processing' && (
              <View className="mb-5 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                <Text className="text-amber-700 text-xs font-bold mb-1">⚠️ Order is processing</Text>
                <Text className="text-amber-600 text-[10px]">The pharmacist has started preparing your order. A reason is required.</Text>
              </View>
            )}

            <View className="mb-6">
              <Text className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">
                {cancelStatus === 'processing' ? 'Reason (Required)' : 'Reason (Optional)'}
              </Text>
              <TextInput
                value={cancelReason}
                onChangeText={setCancelReason}
                placeholder="e.g. Found a closer pharmacy, changed my mind..."
                placeholderTextColor="#94a3b8"
                className="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-gray-900 text-sm font-medium"
                multiline
                numberOfLines={3}
                style={{ textAlignVertical: 'top' }}
              />
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setCancelModalVisible(false)}
                className="flex-1 py-4 bg-gray-100 rounded-[1.25rem] items-center"
              >
                <Text className="text-gray-700 font-bold text-xs uppercase tracking-widest">Keep Order</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCancelOrder}
                disabled={cancelLoading}
                className="flex-1 py-4 bg-red-500 rounded-[1.25rem] items-center"
              >
                {cancelLoading
                  ? <ActivityIndicator size="small" color="white" />
                  : <Text className="text-white font-bold text-xs uppercase tracking-widest">Cancel Order</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ===== Reject Offer Modal ===== */}
      <Modal animationType="fade" transparent visible={rejectModalVisible}>
        <View className="flex-1 bg-slate-900/60 justify-center px-6">
          <View className="bg-white rounded-[2rem] p-6 shadow-2xl">
            <View className="items-center mb-5">
              <View className="w-12 h-12 bg-red-50 rounded-[1.2rem] items-center justify-center mb-3">
                <MaterialCommunityIcons name="close-circle-outline" size={24} color="#ef4444" />
              </View>
              <Text className="text-lg font-black text-slate-900 tracking-tight">Reject Offer?</Text>
              <Text className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                Help pharmacies improve their offers
              </Text>
            </View>

            <View className="mb-5">
              <Text className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                Reason for Rejection
              </Text>
              <TextInput
                value={rejectReason}
                onChangeText={setRejectReason}
                placeholder="e.g. Price too high, Delivery too late..."
                placeholderTextColor="#94a3b8"
                className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-slate-900 text-xs font-medium"
                multiline
                numberOfLines={3}
                style={{ textAlignVertical: 'top' }}
              />
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setRejectModalVisible(false)}
                className="flex-1 bg-slate-100 py-3.5 rounded-[1.1rem] items-center"
              >
                <Text className="text-slate-600 font-bold text-[10px] uppercase tracking-widest">Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleRejectSubmit}
                className="flex-1 bg-red-600 py-3.5 rounded-[1.1rem] items-center shadow-lg shadow-red-200"
              >
                <Text className="text-white font-black text-[10px] uppercase tracking-widest">Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ===== Ghost Modal: Detail Inventory ===== */}
      <Modal animationType="slide" transparent visible={modalVisible}>
        <View className="flex-1 bg-gray-950/60 justify-end">
          <BlurView intensity={25} tint="dark" className="absolute inset-0" />
          <View style={{ maxHeight: SCREEN_HEIGHT * 0.85 }} className="bg-white rounded-t-[2.5rem] shadow-2xl overflow-hidden">

            {/* Top Sheet Curvy Header with Premium Gradient */}
            <View className="relative overflow-hidden pt-4 pb-8">
              <LinearGradient
                colors={['#0f172a', '#1e293b', '#059669']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="absolute inset-0"
              />

              {/* Grab handle inside the dark header */}
              <View className="items-center mb-6">
                <View className="w-12 h-1.5 bg-white/20 rounded-full" />
              </View>

              <View className="px-8 flex-row justify-between items-center relative z-10">
                <View>
                  <Text className="text-2xl font-black text-white tracking-tighter uppercase">Medicine Details</Text>
                  <Text className="text-[9.5px] font-bold text-emerald-400 uppercase tracking-[3px] mt-1.5">Pharmacy Inventory</Text>
                </View>
                <TouchableOpacity onPress={() => setModalVisible(false)} className="bg-white/10 w-11 h-11 rounded-full border border-white/10 shadow-sm items-center justify-center">
                  <MaterialCommunityIcons name="close" size={20} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="p-8 pt-8" contentContainerStyle={{ paddingBottom: 120 }}>
              <View className="flex-row items-center mb-6 bg-gray-50 p-5 rounded-[1.75rem] border border-gray-100 shadow-sm shadow-gray-200">
                <View className="w-14 h-14 rounded-2xl bg-white items-center justify-center border border-gray-100 shadow-sm">
                  <MaterialCommunityIcons name="store-outline" size={28} color="#059669" />
                </View>
                <View className="ml-4 flex-1">
                  <Text className="text-lg font-black text-gray-900 tracking-tighter uppercase" numberOfLines={1}>{offerDetails?.store_name}</Text>
                  <Text className="text-gray-500 text-[11px] font-semibold leading-5 mt-1 opacity-80" numberOfLines={2}>{offerDetails?.store_address}</Text>
                </View>
              </View>

              {/* <View className="bg-slate-900 p-7 rounded-[2.25rem] mb-8 relative overflow-hidden shadow-xl shadow-slate-300">
                <View className="absolute -top-10 -right-10 bg-emerald-500/10 w-48 h-48 rounded-full" />
                <Text className="text-[9px] font-bold text-emerald-400 uppercase tracking-[3px] mb-2">Total Deal Amount</Text>
                <View className="flex-row items-baseline"><Text className="text-emerald-500 text-2xl font-bold mr-3">₹</Text><Text className="text-white text-5xl font-black tracking-tighter">{offerDetails?.total_amount}</Text></View>
              </View>

              {!!offerDetails?.quotation_scenario && (
                <View className="mb-8">
                  <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-[3px] mb-2 ml-3">Availability Match</Text>
                  <View className={`rounded-2xl p-4 border flex-row items-center shadow-sm shadow-emerald-100/50 ${getScenarioColor(offerDetails.quotation_scenario).bg} ${getScenarioColor(offerDetails.quotation_scenario).text.replace('text-', 'border-')}/20`}>
                    <MaterialCommunityIcons
                      name={getScenarioColor(offerDetails.quotation_scenario).icon}
                      size={18}
                      color={getScenarioColor(offerDetails.quotation_scenario).text.replace('text-', '') === 'blue-600' ? '#2563eb' :
                        getScenarioColor(offerDetails.quotation_scenario).text.replace('text-', '') === 'emerald-600' ? '#059669' :
                          getScenarioColor(offerDetails.quotation_scenario).text.replace('text-', '') === 'orange-600' ? '#ea580c' :
                            getScenarioColor(offerDetails.quotation_scenario).text.replace('text-', '') === 'purple-600' ? '#9333ea' :
                              getScenarioColor(offerDetails.quotation_scenario).text.replace('text-', '') === 'amber-600' ? '#d97706' : '#475569'}
                    />
                    <Text className={`ml-3 font-black text-xs uppercase tracking-widest ${getScenarioColor(offerDetails.quotation_scenario).text}`}>
                      {formatScenarioName(offerDetails.quotation_scenario)}
                    </Text>
                  </View>
                </View>
              )} */}

              <View className="bg-slate-900 p-6 rounded-[2rem] mb-6 relative overflow-hidden shadow-xl shadow-slate-200">
                <View className="absolute -top-5 -right-5 bg-emerald-500/10 w-20 h-20 rounded-full" />
                <Text className="text-[9px] font-bold text-emerald-400 uppercase tracking-[3px] mb-2">Total Deal Amount</Text>
                <View className="flex-row items-baseline">
                  <Text className="text-emerald-500 text-xl font-bold mr-2">₹</Text>
                  <Text className="text-white text-4xl font-black tracking-tighter">{offerDetails?.total_amount}</Text>
                  {!!selectedOfferDeal && (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => { setMedTypeInfoTarget(selectedOfferDeal.target); setMedTypeInfoVisible(true); }}
                      className={`mt-3 ml-4 flex-row items-center self-start rounded-2xl border px-4 py-2 ${selectedOfferDeal.bgClass} ${selectedOfferDeal.borderClass}`}
                    >
                      <MaterialCommunityIcons
                        name={selectedOfferDeal.icon as any}
                        size={14}
                        color={selectedOfferDeal.iconColor}
                      />
                      <Text className={`ml-2 text-[9px] font-black uppercase tracking-[2px] ${selectedOfferDeal.textClass}`}>
                        {selectedOfferDeal.label}
                      </Text>
                      <MaterialCommunityIcons name="information-outline" size={11} color={selectedOfferDeal.iconColor} style={{ marginLeft: 5 }} />
                    </TouchableOpacity>
                  )}

                </View>

                {/* {item.quotation_scenario && (
              <View className={`mt-3 flex-row items-center self-start px-4 py-2 rounded-2xl border border-black/5 ${getScenarioColor(item.quotation_scenario).bg}`}>
                <MaterialCommunityIcons
                  name={getScenarioColor(item.quotation_scenario).icon}
                  size={14}
                  color={getScenarioColor(item.quotation_scenario).text.replace('text-', '') === 'blue-600' ? '#2563eb' :
                    getScenarioColor(item.quotation_scenario).text.replace('text-', '') === 'emerald-600' ? '#059669' :
                      getScenarioColor(item.quotation_scenario).text.replace('text-', '') === 'orange-600' ? '#ea580c' :
                        getScenarioColor(item.quotation_scenario).text.replace('text-', '') === 'purple-600' ? '#9333ea' :
                          getScenarioColor(item.quotation_scenario).text.replace('text-', '') === 'amber-600' ? '#d97706' : '#475569'}
                />
                <Text className={`text-[9px] font-black uppercase ml-2 tracking-[2px] ${getScenarioColor(item.quotation_scenario).text}`}>
                  {item.quotation_scenario}
                </Text>
              </View>
            )} */}

              </View>

              {!!offerDetails?.user_status && !['pending', 'rejected'].includes(offerDetails.user_status) && (
                <TouchableOpacity
                  onPress={() => { setTrackingOrderTarget(offerDetails as any); setTrackingModalVisible(true); }}
                  className="bg-emerald-50 border border-emerald-100 p-5 rounded-[1.75rem] mb-6 flex-row items-center justify-between shadow-sm"
                >
                  <View className="flex-row items-center">
                    <View className="w-12 h-12 bg-white rounded-2xl items-center justify-center mr-4 border border-emerald-50">
                      <MaterialCommunityIcons name="truck-delivery" size={24} color="#059669" />
                    </View>
                    <View>
                      <Text className="text-emerald-950 font-black text-sm uppercase tracking-tight">Track Your Order</Text>
                      <Text className="text-emerald-600/80 font-bold text-[10px] uppercase tracking-widest mt-0.5">Live Order Status</Text>
                    </View>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color="#059669" />
                </TouchableOpacity>
              )}

              {offerDetails?.delivery_offer && (
                <View className="mx-5 mb-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                  <View className="flex-row items-center">
                    <MaterialCommunityIcons name={offerDetails.delivery_offer.home_delivery_available ? 'truck-fast-outline' : 'store-marker-outline'} size={20} color={offerDetails.delivery_offer.home_delivery_available ? '#2563eb' : '#059669'} />
                    <View className="ml-3 flex-1">
                      <Text className="text-[9px] font-black uppercase tracking-[1.5px] text-slate-500">Fulfillment options</Text>
                      <Text className="mt-1 text-xs font-black text-slate-900">
                        {offerDetails.delivery_offer.home_delivery_available
                          ? `Home delivery ₹${offerDetails.delivery_offer.delivery_charge}${offerDetails.delivery_offer.estimated_delivery_minutes ? ` • ${offerDetails.delivery_offer.estimated_delivery_minutes} min` : ''}`
                          : 'Store pickup available'}
                      </Text>
                    </View>
                  </View>
                  {!!offerDetails.delivery_offer.delivery_message && (
                    <Text className="mt-3 text-[11px] font-semibold leading-4 text-slate-600">{offerDetails.delivery_offer.delivery_message}</Text>
                  )}
                  {!!offerDetails.delivery_offer.assigned_delivery_person && (
                    <View className="mt-3 flex-row items-center rounded-xl bg-white p-3">
                      <MaterialCommunityIcons name="account-check-outline" size={18} color="#059669" />
                      <Text className="ml-2 flex-1 text-[10px] font-black text-slate-700">
                        {offerDetails.delivery_offer.assigned_delivery_person.name}
                        {offerDetails.delivery_offer.assigned_delivery_person.vehicle_number
                          ? ` • ${offerDetails.delivery_offer.assigned_delivery_person.vehicle_number}`
                          : ` • ${offerDetails.delivery_offer.assigned_delivery_person.vehicle_type}`}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* {offerDetails?.medicine_breakdown && (
                <QuotationHintBanner
                  breakdown={offerDetails.medicine_breakdown}
                  scenario={offerDetails.quotation_scenario}
                />
              )} */}

              <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-[3px] mb-6 ml-3">Inventory details</Text>
              <ScrollView showsVerticalScrollIndicator={false} className="max-h-[200px]"
                contentContainerStyle={{ paddingBottom: 120 }}>

                <View className="gap-3.5">
                  {offerDetails?.medicines?.map((med, i) => (
                    <View key={i} className={`flex-row items-center bg-white border ${med.is_available ? 'border-gray-100' : 'border-red-100 opacity-60'} p-4 rounded-2xl shadow-sm`}>
                      <MaterialCommunityIcons
                        name="pill"
                        size={18}
                        color={med.is_available ? "#059669" : "#ef4444"}
                      />
                      <View className="ml-4 flex-1">
                        <View className="flex-row items-center">
                          <Text className={`font-bold text-sm leading-tight uppercase tracking-tight ${med.is_available ? 'text-gray-950' : 'text-gray-400 line-through'}`}>{med.medicine_name}</Text>
                          {!!med.medicine_brand && (
                            <Text className="text-[10px] text-emerald-600 font-black ml-2 uppercase border border-emerald-100 px-1 rounded-sm">({med.medicine_brand})</Text>
                          )}
                          {!!med.medicine_type && (
                            <TouchableOpacity
                              onPress={() => { setMedTypeInfoTarget(med.medicine_type as any); setMedTypeInfoVisible(true); }}
                              className={`ml-2 px-1.5 py-0.5 rounded-sm border flex-row items-center ${med.medicine_type === 'brand' ? 'bg-blue-50 border-blue-200' : med.medicine_type === 'generic' ? 'bg-amber-50 border-amber-200' : 'bg-purple-50 border-purple-200'}`}
                            >
                              <Text className={`text-[7px] font-black uppercase ${med.medicine_type === 'brand' ? 'text-blue-700' : med.medicine_type === 'generic' ? 'text-amber-700' : 'text-purple-700'}`}>
                                {med.medicine_type === 'brand' ? 'BRAND' :
                                  med.medicine_type === 'generic' ? 'GENERIC' : 'ALT. BRAND'}
                              </Text>
                              <MaterialCommunityIcons
                                name="information-outline"
                                size={8}
                                color={med.medicine_type === 'brand' ? '#1d4ed8' : med.medicine_type === 'generic' ? '#b45309' : '#7e22ce'}
                                style={{ marginLeft: 2 }}
                              />
                            </TouchableOpacity>
                          )}
                          {med.is_available ? (
                            <View className="ml-2 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                              <Text className="text-emerald-700 text-[7px] font-black uppercase">Available</Text>
                            </View>
                          ) : (
                            <View className="ml-2 bg-red-100 px-1.5 py-0.5 rounded-full">
                              <Text className="text-red-700 text-[7px] font-black uppercase">Out of Stock</Text>
                            </View>
                          )}
                        </View>
                        <Text className="text-[8px] text-gray-400 font-extrabold tracking-widest uppercase mt-0.5">
                          {med.is_available ? (
                            med.medicine_type === 'brand' ? 'Prescribed Brand Verified ✓' :
                              med.medicine_type === 'generic' ? 'Lower Cost Generic Item ✓' :
                                med.medicine_type === 'substitute' ? 'Other Brand Option Verified ✓' : 'Verified Item ✓'
                          ) : 'Inventory mismatch'}
                        </Text>
                      </View>
                      <Text className={`font-black text-lg tracking-tighter ${med.is_available ? 'text-gray-950' : 'text-gray-300'}`}>₹{med.price}</Text>
                    </View>
                  )) || <Text className="text-gray-400 font-bold text-center py-10 text-xs">No items found.</Text>}
                </View>
              </ScrollView>

              {!!offerDetails?.response_text && (
                <View className="mt-10 bg-amber-50 rounded-[2.5rem] p-8 border border-amber-100">
                  <View className="flex-row items-center mb-5"><MaterialCommunityIcons name="chat-outline" size={20} color="#d97706" /><Text className="text-[10px] font-bold text-amber-600 uppercase tracking-[3px] ml-3">Notes from Pharmacist</Text></View>
                  <Text className="text-amber-900 font-bold text-base italic leading-relaxed">{'"'}{offerDetails.response_text}{'"'}</Text>
                </View>
              )}
            </ScrollView>

            <View className="absolute bottom-0 left-0 right-0 p-8 pt-5 bg-white/95 border-t border-gray-100 flex-row gap-4">
              <TouchableOpacity onPress={() => setModalVisible(false)} className="flex-1 py-5 bg-gray-50 rounded-[1.5rem] items-center"><Text className="text-gray-500 font-bold text-xs uppercase tracking-widest">Back</Text></TouchableOpacity>
              {(!offerDetails?.user_status || offerDetails.user_status === 'pending') && (
                <>
                  {!!offerDetails?.stock_verified_at && (new Date().getTime() - new Date(offerDetails.stock_verified_at).getTime()) > 30 * 60000 ? (
                    <TouchableOpacity
                      onPress={() => { setModalVisible(false); requestStockRefresh(selectedResponseId!); }}
                      className="flex-[2.5] py-5 bg-amber-500 rounded-[1.5rem] items-center shadow-2xl shadow-amber-200"
                    >
                      <View className="flex-row items-center">
                        <MaterialCommunityIcons name="cached" size={16} color="white" />
                        <Text className="text-white font-bold text-sm uppercase tracking-[1px] ml-2">Refresh Stock</Text>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity onPress={() => { setModalVisible(false); if (selectedResponseId) handleStatusPress(selectedResponseId, "accepted"); }} className={`flex-[2.5] py-5 bg-slate-900 rounded-[1.5rem] items-center shadow-2xl shadow-slate-300`}>
                      <Text className="text-emerald-500 font-bold text-sm uppercase tracking-[1px]">Accept & Order</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* ===== Report Bottom Sheet ===== */}
      <Modal transparent visible={modalReportVisible} animationType="slide" onRequestClose={() => setReportModalVisible(false)}>
        <View className="flex-1 justify-end bg-slate-950/40">
          <TouchableOpacity activeOpacity={1} onPress={() => setReportModalVisible(false)} className="absolute inset-0" />
          <View style={{ height: SCREEN_HEIGHT * 0.75 }} className="bg-white rounded-t-[2.25rem] w-full shadow-2xl overflow-hidden border border-gray-100">
            <LinearGradient
              colors={['#020617', '#0f172a', '#7f1d1d']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <View className="items-center pt-3 pb-1">
                <View className="w-12 h-1.5 rounded-full bg-white/20" />
              </View>
              <View className="px-7 pb-6 pt-4 flex-row justify-between items-center">
                <View>
                  <Text className="text-xl font-black text-white tracking-tighter uppercase">Report Portal</Text>
                  <Text className="text-[9px] font-bold text-red-400 uppercase tracking-[3px] mt-1">Direct store Escalation</Text>
                </View>
                <TouchableOpacity onPress={() => setReportModalVisible(false)} className="bg-white/10 p-2.5 rounded-xl"><MaterialCommunityIcons name="close" size={18} color="white" /></TouchableOpacity>
              </View>
            </LinearGradient>

            <ScrollView className="flex-1" contentContainerStyle={{ padding: 28, paddingTop: 32, paddingBottom: 28 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {storeReportCount > 0 && (
                <View className="mb-5 p-5 bg-amber-50 rounded-[1.75rem] border border-amber-100">
                  <View className="flex-row items-center justify-between mb-3">
                    <Text className="text-amber-700 font-black text-[8px] uppercase tracking-[2px]">Pharmacy Reports</Text>
                    <Text className="text-amber-700 font-black text-[10px]">{storeReportCount}</Text>
                  </View>
                  <ScrollView style={{ maxHeight: 95 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                    {storeReports.map((note, index) => (
                      <View key={`${note.created_at}-${index}`} className="mb-3 border-l-2 border-amber-500/30 pl-3">
                        <Text className="text-amber-950 font-bold text-[12px] leading-4">{note.note}</Text>
                        <Text className="text-amber-600/70 font-black text-[8px] uppercase tracking-widest mt-1">
                          {note.store_name || 'Pharmacy'} • {note.created_at}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}

              {reportCount > 0 && (
                <View className="mb-6 p-5 bg-slate-50 rounded-[1.75rem] border border-slate-100">
                  <View className="flex-row items-center justify-between mb-3">
                    <Text className="text-slate-500 font-black text-[8px] uppercase tracking-[2px]">Your Reports</Text>
                    <Text className="text-red-500 font-black text-[10px]">{reportCount}</Text>
                  </View>
                  <ScrollView style={{ maxHeight: 80 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                    {userReports.map((note, index) => (
                      <View key={`${note.created_at}-${index}`} className="mb-3 border-l-2 border-red-500/20 pl-3">
                        <Text className="text-slate-900 font-bold text-[12px] leading-4">{note.note}</Text>
                        <Text className="text-slate-400 font-bold text-[8px] uppercase tracking-widest mt-1">{note.created_at}</Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}

              <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-[3px] mb-5 ml-1">Issue Category</Text>
              <View className="flex-row flex-wrap gap-2.5 mb-8">
                {predefinedReasons.map((r) => (
                  <TouchableOpacity key={r} onPress={() => setSelectedReason(r)} className={`px-5 py-3 rounded-xl border ${selectedReason === r ? 'bg-red-600 border-red-600 shadow-xl shadow-red-200' : 'bg-gray-50 border-gray-100 shadow-sm shadow-gray-50'}`}>
                    <Text className={`font-bold text-[10px] uppercase tracking-wide ${selectedReason === r ? 'text-white' : 'text-gray-400'}`}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View className="bg-gray-50/80 p-6 rounded-[1.75rem] border border-gray-100 mb-8">
                <Text className="text-[8px] font-bold text-gray-400 uppercase tracking-[2px] mb-3">Narrative Context</Text>
                <TextInput placeholder="Provide context..." placeholderTextColor="#cbd5e1" className="text-gray-950 font-bold text-[14px] min-h-[100px]" multiline value={noteText} onChangeText={setNoteText} textAlignVertical="top" />
              </View>

              <TouchableOpacity onPress={submitContactNote} className="bg-red-600 py-5 rounded-[1.75rem] items-center shadow-2xl shadow-red-200"><Text className="text-white font-black uppercase text-xs tracking-[4px]">Submit Issue</Text></TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ===== Choice Portal ===== */}
      <Modal transparent visible={confirmModalVisible} animationType="fade">
        <View className="flex-1 justify-center items-center bg-gray-900/10 px-12">
          <BlurView intensity={5} tint="light" className="absolute inset-0" />
          <View className="bg-white p-12 rounded-[3.5rem] w-full items-center shadow-2xl border border-gray-100">
            <View className={`w-28 h-28 rounded-[2.5rem] items-center justify-center mb-10 shadow-2xl ${selectedStatus === 'accepted' ? 'bg-slate-900 shadow-slate-200/50' : 'bg-red-600 shadow-red-100'}`}>
              <MaterialCommunityIcons name={selectedStatus === 'accepted' ? "check-bold" : "close-thick"} size={48} color={selectedStatus === 'accepted' ? '#10b981' : 'white'} />
            </View>
            <Text className="text-3xl font-black text-gray-900 text-center mb-5 tracking-tighter uppercase">{selectedStatus === 'accepted' ? 'Confirm order?' : 'Discard Deal?'}</Text>
            <Text className="text-gray-400 font-bold text-center text-sm px-8 mb-14 leading-7 uppercase tracking-widest opacity-60">Ready to finalize this professional quote? This action is immutable.</Text>
            <View className="flex-row gap-5">
              <TouchableOpacity onPress={() => setConfirmModalVisible(false)} className="flex-1 py-6 bg-gray-50 rounded-[2rem] items-center shadow-sm"><Text className="text-gray-500 font-bold text-[10px] uppercase tracking-[4px]">Abort</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => { if (selectedResponseId && selectedStatus) updateResponseStatus(selectedResponseId, selectedStatus); setConfirmModalVisible(false); }} className={`flex-[2] py-6 rounded-[2rem] items-center shadow-2xl ${selectedStatus === 'accepted' ? 'bg-slate-900 shadow-slate-400' : 'bg-red-600 shadow-red-200'}`}>
                <Text className={selectedStatus === 'accepted' ? "text-emerald-500 font-bold text-[10px] uppercase tracking-[4px]" : "text-white font-bold text-[10px] uppercase tracking-[4px]"}>{selectedStatus === 'accepted' ? 'Yes, Confim' : 'Yes, Delete'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ===== Delivery Choice Modal ===== */}
      <Modal transparent visible={deliveryModalVisible} animationType="slide">
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-[3.5rem] p-10 pb-16">
            <View className="items-center mb-8">
              <View className="w-16 h-1.5 bg-gray-100 rounded-full mb-8" />
              <View className="w-24 h-24 bg-slate-900 rounded-full items-center justify-center mb-6 shadow-xl shadow-slate-200">
                <MaterialCommunityIcons name="truck-delivery-outline" size={44} color="#10b981" />
              </View>
              <Text className="text-3xl font-black text-gray-900 tracking-tighter uppercase mb-2">Fulfillment Method</Text>
              <Text className="text-gray-400 font-bold text-center text-xs tracking-widest leading-5 px-6 uppercase opacity-70">How would you like to receive your medicines?</Text>
            </View>

            <View className="gap-4">
              {(selectedDeliveryQuote?.pickup_available ?? true) && (
                <TouchableOpacity
                  onPress={() => updateDeliveryOption("walk_in")}
                  className="flex-row items-center bg-slate-50 border-2 border-slate-900/5 p-6 rounded-[2rem] shadow-sm active:bg-slate-100"
                >
                  <View className="w-14 h-14 bg-white rounded-2xl items-center justify-center shadow-sm">
                    <MaterialCommunityIcons name="walk" size={28} color="#0f172a" />
                  </View>
                  <View className="ml-5 flex-1">
                    <Text className="text-lg font-black text-slate-900 tracking-tight uppercase">Store Pickup</Text>
                    <Text className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest mt-0.5">Collect from the pharmacy</Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={24} color="#0f172a" />
                </TouchableOpacity>
              )}

              {selectedDeliveryQuote?.home_delivery_available && (
                <TouchableOpacity
                  onPress={() => updateDeliveryOption("online")}
                  className="flex-row items-center bg-blue-50 border-2 border-blue-100 p-6 rounded-[2rem] shadow-sm active:bg-blue-100"
                >
                  <View className="w-14 h-14 bg-white rounded-2xl items-center justify-center shadow-sm">
                    <MaterialCommunityIcons name="moped" size={28} color="#2563eb" />
                  </View>
                  <View className="ml-5 flex-1">
                    <Text className="text-lg font-black text-slate-900 tracking-tight uppercase">Home Delivery</Text>
                    <Text className="text-[10px] text-blue-600 font-bold uppercase tracking-widest mt-0.5">
                      ₹{selectedDeliveryQuote.delivery_charge}{selectedDeliveryQuote.estimated_delivery_minutes ? ` • ${selectedDeliveryQuote.estimated_delivery_minutes} min` : ''}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={24} color="#2563eb" />
                </TouchableOpacity>
              )}

              {!selectedDeliveryQuote?.home_delivery_available && !!selectedDeliveryQuote?.delivery_message && (
                <View className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                  <Text className="text-[11px] font-bold leading-5 text-amber-800">{selectedDeliveryQuote.delivery_message}</Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              onPress={() => setDeliveryModalVisible(false)}
              className="mt-10 py-5 items-center"
            >
              <Text className="text-gray-400 font-bold text-xs uppercase tracking-[3px]">Select Later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={!!selectedImage} transparent animationType="fade">
        <View className="flex-1 bg-black justify-center items-center">
          <BlurView intensity={45} tint="dark" className="absolute inset-0" />
          <TouchableOpacity onPress={() => setSelectedImage(null)} className="absolute top-24 right-10 z-50 bg-white/10 p-5 rounded-full"><MaterialCommunityIcons name="close" size={32} color="white" /></TouchableOpacity>
          {!!selectedImage && <View className="w-full h-[75%]"><RemoteImageWithStatus uri={selectedImage} resizeMode="contain" loadingLabel="Opening prescription" /></View>}
        </View>
      </Modal>

      {/* ===== Premium Filter Modal ===== */}
      <Modal animationType="slide" transparent visible={filterSheetVisible}>
        <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 40, borderTopRightRadius: 40, paddingHorizontal: 28, paddingTop: 16, paddingBottom: 44, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 24 }}>

            {/* Handle */}
            <View style={{ alignItems: 'center', marginBottom: 28 }}>
              <View style={{ width: 48, height: 5, backgroundColor: '#E2E8F0', borderRadius: 99 }} />
            </View>

            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
              <View>
                <Text style={{ fontSize: 26, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 }}>Filter by Date</Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#94A3B8', marginTop: 4, letterSpacing: 1 }}>Select a date range to narrow offers</Text>
              </View>
              <TouchableOpacity
                onPress={() => setFilterSheetVisible(false)}
                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' }}
              >
                <MaterialCommunityIcons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Date Pickers */}
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 32 }}>
              <TouchableOpacity
                onPress={() => setShowDatePicker({ mode: 'start', visible: true })}
                style={{ flex: 1, backgroundColor: '#F8FAFC', borderRadius: 20, borderWidth: 1.5, borderColor: startDate ? '#059669' : '#E2E8F0', padding: 18 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <MaterialCommunityIcons name="calendar-start" size={14} color={startDate ? '#059669' : '#94A3B8'} />
                  <Text style={{ fontSize: 10, fontWeight: '700', color: startDate ? '#059669' : '#94A3B8', marginLeft: 6, letterSpacing: 1.5, textTransform: 'uppercase' }}>From</Text>
                </View>
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A', letterSpacing: -0.3 }}>
                  {startDate ? startDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Start date'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowDatePicker({ mode: 'end', visible: true })}
                style={{ flex: 1, backgroundColor: '#F8FAFC', borderRadius: 20, borderWidth: 1.5, borderColor: endDate ? '#059669' : '#E2E8F0', padding: 18 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <MaterialCommunityIcons name="calendar-end" size={14} color={endDate ? '#059669' : '#94A3B8'} />
                  <Text style={{ fontSize: 10, fontWeight: '700', color: endDate ? '#059669' : '#94A3B8', marginLeft: 6, letterSpacing: 1.5, textTransform: 'uppercase' }}>To</Text>
                </View>
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A', letterSpacing: -0.3 }}>
                  {endDate ? endDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'End date'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Quick Chips */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 32 }}>
              {[{ label: 'Last 7D', days: 7 }, { label: 'Last 30D', days: 30 }, { label: '3 Months', days: 90 }].map((chip) => {
                const isActive = startDate && (new Date().getTime() - startDate.getTime() >= (chip.days - 1) * 24 * 3600 * 1000) && endDate;
                return (
                  <TouchableOpacity
                    key={chip.label}
                    onPress={() => {
                      const d = new Date(); d.setDate(d.getDate() - (chip.days - 1)); setStartDate(startOfLocalDay(d));
                      setEndDate(endOfLocalDay(new Date()));
                    }}
                    style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: isActive ? '#059669' : '#F1F5F9', borderWidth: 1.5, borderColor: isActive ? '#059669' : '#E2E8F0' }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: isActive ? '#fff' : '#64748B', letterSpacing: 0.5 }}>{chip.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Action Buttons */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => { setData([]); setStartDate(new Date()); setEndDate(new Date()); startDateRef.current = new Date(); endDateRef.current = new Date(); setFilterSheetVisible(false); fetchResponses(1, false, new Date(), new Date()); }}
                style={{ flex: 1, paddingVertical: 18, borderRadius: 20, alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E2E8F0' }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#64748B', letterSpacing: 0.5 }}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  const normalizedStart = startDate ? startOfLocalDay(startDate) : null;
                  const normalizedEnd = endDate ? endOfLocalDay(endDate) : (normalizedStart ? endOfLocalDay(normalizedStart) : null);
                  setStartDate(normalizedStart);
                  setEndDate(normalizedEnd);
                  startDateRef.current = normalizedStart;
                  endDateRef.current = normalizedEnd;
                  setFilterSheetVisible(false);
                  fetchResponses(1, false, normalizedStart, normalizedEnd);
                }}
                style={{ flex: 2, paddingVertical: 18, borderRadius: 20, alignItems: 'center', backgroundColor: '#059669', shadowColor: '#059669', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 }}
              >
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff', letterSpacing: 1 }}>Apply Filter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {showDatePicker.visible && (
        <DateTimePicker value={showDatePicker.mode === 'start' ? (startDate || new Date()) : (endDate || new Date())} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={(_e, d) => { setShowDatePicker({ ...showDatePicker, visible: false }); if (d) { if (showDatePicker.mode === 'start') setStartDate(startOfLocalDay(d)); else setEndDate(endOfLocalDay(d)); } }} />
      )}
      <RatingBottomSheet
        isVisible={ratingModalVisible}
        onClose={() => setRatingModalVisible(false)}
        orderId={ratingOrderTarget?.id || 0}
        raterType="user"
        orderStatus={ratingOrderTarget?.user_status || ''}
        cancelledBy={ratingOrderTarget?.cancelled_by}
        onSuccess={() => fetchResponses(1, false)}
      />
      <Toast />
      <Modal
        visible={storeBadgesVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setStoreBadgesVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <TouchableOpacity
            activeOpacity={1}
            className="absolute inset-0"
            onPress={() => setStoreBadgesVisible(false)}
          />
          <View className="max-h-[72%] rounded-t-[30px] bg-white px-5 pb-8 pt-4">
            <View className="mb-3 h-1.5 w-12 self-center rounded-full bg-slate-200" />
            <View className="mb-4 flex-row items-center justify-between">
              <View className="flex-1 pr-3">
                <Text className="text-xs font-black uppercase tracking-wide text-slate-400">Store badges</Text>
                <Text className="text-xl font-black text-slate-900" numberOfLines={1}>
                  {storeBadgesTarget?.store_name || 'Medical Store'}
                </Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setStoreBadgesVisible(false)}
                className="h-10 w-10 items-center justify-center rounded-full bg-slate-100"
              >
                <MaterialCommunityIcons name="close" size={21} color="#334155" />
              </TouchableOpacity>
            </View>

            {storeBadgesPrimaryLabel ? (
              <View className="mb-4 flex-row items-center rounded-2xl border border-blue-100 bg-blue-50 p-3">
                <View className="mr-3 h-11 w-11 items-center justify-center rounded-full bg-white">
                  <MaterialCommunityIcons name="truck-delivery-outline" size={24} color="#2563eb" />
                </View>
                <View className="flex-1">
                  <Text className="text-[11px] font-black uppercase text-blue-500">Primary badge</Text>
                  <Text className="text-base font-black text-blue-900" numberOfLines={2}>
                    {storeBadgesPrimaryLabel}
                  </Text>
                </View>
              </View>
            ) : null}

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
              {storeBadgesSheetLabels.length > 0 ? (
                <View className="gap-2">
                  {storeBadgesSheetLabels.map((badge, index) => {
                    const meta = getStoreBadgeMeta(badge);
                    return (
                      <View
                        key={`store-badge-sheet-${index}-${badge}`}
                        className={`flex-row items-center rounded-2xl border p-3 ${meta.bg} ${meta.border}`}
                      >
                        <View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-white">
                          <MaterialCommunityIcons name={meta.icon as any} size={20} color={meta.iconColor} />
                        </View>
                        <Text className={`flex-1 text-sm font-black ${meta.text}`} numberOfLines={2}>
                          {badge}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View className="items-center rounded-2xl border border-slate-100 bg-slate-50 p-5">
                  <MaterialCommunityIcons name="shield-star-outline" size={30} color="#94a3b8" />
                  <Text className="mt-2 text-sm font-bold text-slate-500">No badges available</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ⭐ Store Reviews Modal */}
      <Modal
        visible={storeReviewsVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setStoreReviewsVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-white rounded-t-[2.5rem] w-full max-h-[85%] pb-10">
            {/* Header */}
            <View className="flex-row items-center justify-between p-6 border-b border-gray-100">
              <View>
                <Text className="text-gray-900 font-black text-lg">{currentStoreName}</Text>
                <Text className="text-gray-500 text-[10px] uppercase tracking-[3px] font-bold mt-1">Customer Reviews</Text>
              </View>
              <TouchableOpacity onPress={() => setStoreReviewsVisible(false)} className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center border border-gray-100">
                <MaterialCommunityIcons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* 🔥 Expanded Badges & Smart Tags Section 🔥 */}
            {!!currentReviewStoreItem && !!(currentReviewStoreItem.store_badges || currentReviewStoreItem.smart_tags) && (
              <View className="px-6 py-5 bg-slate-50 border-b border-slate-100">
                <Text className="text-slate-400 font-bold text-[9px] uppercase tracking-widest mb-3">Store Badges & Highlights</Text>
                <View className="flex-row flex-wrap gap-2">
                  {currentReviewStoreItem.store_badges?.map(badge => (
                    <View key={badge} className="flex-row items-center bg-white px-3 py-1.5 rounded-full border border-gray-200 shadow-sm">
                      <MaterialCommunityIcons name="shield-star" size={12} color="#059669" />
                      <Text className="text-[10px] font-black uppercase tracking-widest text-slate-700 ml-1.5">{badge}</Text>
                    </View>
                  ))}
                  {currentReviewStoreItem.smart_tags?.map(tag => {
                    let config = { bg: 'bg-slate-100', text: 'text-slate-600', icon: 'tag-outline', iconColor: '#64748b', border: 'border-slate-200' };
                    if (tag === 'Best Value') config = { bg: 'bg-green-50', text: 'text-green-700', icon: 'star-face', iconColor: '#15803d', border: 'border-green-100' };
                    if (tag === 'Fast Delivery') config = { bg: 'bg-amber-50', text: 'text-amber-700', icon: 'lightning-bolt', iconColor: '#b45309', border: 'border-amber-100' };
                    if (tag === 'Top Rated Store') config = { bg: 'bg-purple-50', text: 'text-purple-700', icon: 'shield-star', iconColor: '#7e22ce', border: 'border-purple-100' };
                    return (
                      <View key={tag} className={`flex-row items-center px-3 py-1.5 rounded-full border shadow-sm ${config.bg} ${config.border}`}>
                        <MaterialCommunityIcons name={config.icon as any} size={12} color={config.iconColor} />
                        <Text className={`text-[10px] font-black uppercase tracking-widest ml-1.5 ${config.text}`}>{tag}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}


            {reviewsLoading ? (
              <View className="p-10 items-center justify-center h-64">
                <ActivityIndicator size="large" color="#10b981" />
              </View>
            ) : currentStoreReviews.length === 0 ? (
              <View className="p-10 items-center justify-center h-64">
                <MaterialCommunityIcons name="star-outline" size={48} color="#cbd5e1" />
                <Text className="text-gray-400 font-bold mt-4">No reviews yet</Text>
              </View>
            ) : (
              <FlatList
                data={currentStoreReviews}
                keyExtractor={(r, idx) => idx.toString()}
                contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
                renderItem={({ item: review }) => (
                  <View className="bg-slate-50 p-5 rounded-[1.5rem] border border-slate-100 mb-4 shadow-sm shadow-slate-200">
                    <View className="flex-row items-center justify-between mb-3">
                      <View className="flex-row items-center">
                        <View className="w-8 h-8 rounded-full bg-slate-200 items-center justify-center mr-3">
                          <Text className="text-slate-600 font-black text-xs">{review.user_name?.charAt(0) || 'A'}</Text>
                        </View>
                        <View>
                          <Text className="text-gray-900 font-bold text-xs">{review.user_name || 'Anonymous'}</Text>
                          <Text className="text-gray-400 text-[9px] uppercase tracking-wider font-bold mt-0.5">
                            {new Date(review.created_at).toLocaleDateString()}
                          </Text>
                        </View>
                      </View>
                      <View className="flex-row items-center bg-emerald-50 px-2 py-1 rounded border border-emerald-100/50">
                        <Text className="text-emerald-700 font-black text-[10px] mr-1">{review.rating}</Text>
                        <MaterialCommunityIcons name="star" size={10} color="#059669" />
                      </View>
                    </View>
                    <Text className="text-gray-700 text-xs leading-5 italic">
                      {'"'}{review.review || 'No written review provided'}{'"'}
                    </Text>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
      {/* ===== Order Tracking View (Amazon/Flipkart style) ===== */}
      <Modal
        visible={trackingModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setTrackingModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-white rounded-t-[2.5rem] w-full min-h-[60%] pb-10 shadow-2xl">
            {/* Handle & Header */}
            <View className="items-center pt-4 pb-6 border-b border-gray-100">
              <View className="w-12 h-1.5 bg-gray-200 rounded-full mb-4" />
              <View className="flex-row items-center justify-between w-full px-6">
                <View>
                  <Text className="text-gray-900 font-black text-xl uppercase tracking-tight">Order Tracking</Text>
                  <Text className="text-gray-400 text-[10px] uppercase font-bold tracking-[2px] mt-1">Status Updates</Text>
                </View>
                <TouchableOpacity onPress={() => setTrackingModalVisible(false)} className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center border border-gray-200">
                  <MaterialCommunityIcons name="close" size={20} color="#64748b" />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
              {!!trackingOrderTarget && (() => {
                const item = trackingOrderTarget;
                const trackerSteps = [
                  {
                    label: 'Order Accepted',
                    subtext: 'You accepted the pharmacy quotation',
                    icon: 'check-decagram-outline' as const,
                    done: !!(['accepted', 'processing', 'locked', 'out_for_delivery', 'completed'].includes(item.user_status || '') || item.is_locked),
                    date: item.accepted_at ? new Date(item.accepted_at).toLocaleString() : new Date(item.created_at).toLocaleString()
                  },
                  {
                    label: 'Billing & Processing',
                    subtext: 'Verifying prescription and generating bill',
                    icon: 'script-text-outline' as const,
                    done: !!(['processing', 'locked', 'out_for_delivery', 'completed'].includes(item.user_status || '') || item.is_locked || item.is_processing_started),
                    date: item.processing_at ? new Date(item.processing_at).toLocaleString() : item.is_processing_started ? 'System Update Logged' : 'Pending Update'
                  },
                  {
                    label: 'Packed & Ready',
                    subtext: 'Medicines have been neatly packed',
                    icon: 'package-variant-closed' as const,
                    done: !!(['locked', 'out_for_delivery', 'completed'].includes(item.user_status || '') || item.is_locked || item.is_packed),
                    date: item.is_packed ? 'System Update Logged' : 'Pending Update'
                  },
                  {
                    label: item.delivery_option === 'online' ? 'Out for Delivery' : 'Ready for Pickup',
                    subtext: item.delivery_option === 'online' ? 'Our delivery partner is on the way' : 'Your order is waiting at the counter',
                    icon: item.delivery_option === 'online' ? 'truck-delivery' as const : 'store-clock' as const,
                    done: !!(['locked', 'out_for_delivery', 'completed'].includes(item.user_status || '') || item.is_locked),
                    date: item.locked_at ? new Date(item.locked_at).toLocaleString() : item.is_locked || item.user_status === 'out_for_delivery' ? 'Store Authenticated' : 'Pending Update'
                  },
                  {
                    label: 'Completed',
                    subtext: 'Order perfectly fulfilled',
                    icon: 'flag-checkered' as const,
                    done: item.user_status === 'completed',
                    date: item.user_status === 'completed' ? new Date(item.completed_at || item.updated_at).toLocaleString() : 'Pending Update'
                  },
                ];

                return (
                  <View className="relative pl-6 pt-2">
                    {!!item.completion_otp_requested && !!item.completion_otp && item.user_status !== 'completed' && (
                      <TouchableOpacity
                        onPress={() => setVisibleCompletionOtpId((current) => current === item.id ? null : item.id)}
                        className="mr-2 mb-7 p-4 bg-slate-950 rounded-[1.5rem] border border-emerald-500/30"
                      >
                        <View className="flex-row items-center justify-between">
                          <View className="flex-row items-center flex-1 pr-3">
                            <MaterialCommunityIcons name="shield-key-outline" size={22} color="#34d399" />
                            <View className="ml-3 flex-1">
                              <Text className="text-emerald-400 text-[9px] font-black uppercase tracking-[2px]">Store Completion OTP</Text>
                              <Text className="text-white/50 text-[8px] font-bold uppercase tracking-[1.5px] mt-1">Tap to reveal only at handover</Text>
                            </View>
                          </View>
                          <View className="min-w-[118px] items-end">
                            <Text
                              className="text-white font-black text-xl"
                              numberOfLines={1}
                              adjustsFontSizeToFit
                              minimumFontScale={0.75}
                              allowFontScaling={false}
                              style={{ letterSpacing: 2 }}
                            >
                              {visibleCompletionOtpId === item.id ? formatCompletionOtp(item.completion_otp) : '••••••'}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    )}
                    {/* Vertical Connector Line */}
                    <View className="absolute left-[39px] top-6 bottom-10 w-0.5 bg-gray-200" />

                    {trackerSteps.map((step, idx) => (
                      <View key={step.label} className="flex-row items-start mb-8 relative">
                        {/* Step Icon */}
                        <View
                          className={`w-10 h-10 rounded-full items-center justify-center border-4 border-white mr-5 shadow-sm z-10 ${step.done ? 'bg-emerald-500' : 'bg-gray-200'}`}
                        >
                          <MaterialCommunityIcons name={step.icon} size={18} color="white" />
                        </View>

                        {/* Step Content */}
                        <View className="flex-1 pt-1 border-b border-gray-100 pb-5">
                          <Text className={`font-black text-sm uppercase tracking-tight ${step.done ? 'text-gray-900' : 'text-gray-400'}`}>
                            {step.label}
                          </Text>
                          <Text className={`text-xs font-bold leading-5 mt-1 ${step.done ? 'text-gray-500' : 'text-gray-300'}`}>
                            {step.subtext}
                          </Text>
                          {step.done && (
                            <View className="flex-row items-center mt-2 bg-slate-50 self-start px-2 py-1 rounded">
                              <MaterialCommunityIcons name="clock-outline" size={10} color="#94a3b8" className="mr-1" />
                              <Text className="text-[9px] text-gray-500 font-bold uppercase tracking-widest ml-1">{step.date}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                );
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ===== Medicine Type Educational Modal ===== */}
      <Modal
        visible={medTypeInfoVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMedTypeInfoVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setMedTypeInfoVisible(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => { }}>
            <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 36, borderTopRightRadius: 36, paddingBottom: 48, overflow: 'hidden' }}>

              {/* Colour accent bar */}
              <View style={{
                height: 6,
                backgroundColor: medTypeInfoTarget === 'brand' ? '#3b82f6' : medTypeInfoTarget === 'generic' ? '#f59e0b' : medTypeInfoTarget === 'mixed' ? '#059669' : medTypeInfoTarget === 'partial' ? '#ef4444' : '#a855f7',
                marginBottom: 0,
              }} />

              {/* Handle */}
              <View style={{ alignItems: 'center', paddingTop: 16, paddingBottom: 8 }}>
                <View style={{ width: 44, height: 4, backgroundColor: '#E2E8F0', borderRadius: 99 }} />
              </View>

              <View style={{ paddingHorizontal: 28, paddingTop: 8 }}>
                {/* Icon + Title */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                  <View style={{
                    width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 14,
                    backgroundColor: medTypeInfoTarget === 'brand' ? '#eff6ff' : medTypeInfoTarget === 'generic' ? '#fffbeb' : medTypeInfoTarget === 'mixed' ? '#f0fdf4' : medTypeInfoTarget === 'partial' ? '#fef2f2' : '#faf5ff',
                  }}>
                    <MaterialCommunityIcons
                      name={medTypeInfoTarget === 'brand' ? 'pill' : medTypeInfoTarget === 'generic' ? 'flask-round-bottom' : medTypeInfoTarget === 'mixed' ? 'layers-triple' : medTypeInfoTarget === 'partial' ? 'alert-circle-outline' : 'swap-horizontal-bold'}
                      size={28}
                      color={medTypeInfoTarget === 'brand' ? '#2563eb' : medTypeInfoTarget === 'generic' ? '#d97706' : medTypeInfoTarget === 'mixed' ? '#059669' : medTypeInfoTarget === 'partial' ? '#dc2626' : '#9333ea'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 22, fontWeight: '900', color: '#0f172a', letterSpacing: -0.5 }}>
                      {medTypeInfoTarget === 'brand' ? 'Brand Medicine' : medTypeInfoTarget === 'generic' ? 'Generic Medicine' : medTypeInfoTarget === 'mixed' ? 'Mixed Deal' : medTypeInfoTarget === 'partial' ? 'Partial Availability' : 'Alt. Brand Option'}
                    </Text>
                    <Text style={{
                      fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', marginTop: 2,
                      color: medTypeInfoTarget === 'brand' ? '#3b82f6' : medTypeInfoTarget === 'generic' ? '#f59e0b' : medTypeInfoTarget === 'mixed' ? '#059669' : medTypeInfoTarget === 'partial' ? '#ef4444' : '#a855f7'
                    }}>
                      {medTypeInfoTarget === 'brand' ? 'Branded / Original' : medTypeInfoTarget === 'generic' ? 'Sasti & Utni hi asardar' : medTypeInfoTarget === 'mixed' ? 'Brand + Generic + Alt. Brand ka combination' : medTypeInfoTarget === 'partial' ? 'Kuch items missing hain' : 'Alternate Brand'}
                    </Text>
                  </View>
                </View>

                {/* Divider */}
                <View style={{ height: 1, backgroundColor: '#f1f5f9', marginVertical: 20 }} />

                {/* Info Cards */}
                {medTypeInfoTarget === 'generic' && (
                  <>
                    {[
                      { icon: 'currency-inr', color: '#059669', bg: '#f0fdf4', title: 'Kaafi Sasti Hoti Hai', body: 'Generic medicine Brand se 50–80% sasti hoti hai kyunki company marketing pe kharcha nahi karti.' },
                      { icon: 'check-decagram', color: '#2563eb', bg: '#eff6ff', title: '100% Safe & Effective', body: 'Sarkaar ki maan karo — CDSCO aur WHO dono generic ko approved karti hain. Same salt, same dose, same effect.' },
                      { icon: 'store', color: '#7c3aed', bg: '#faf5ff', title: 'Jan Aushidhi Kendras', body: 'India mein 10,000+ sarkari Jan Aushidhi stores sirf generic medicines bechte hain. PM Modi bhi yahi recommend karte hain.' },
                      { icon: 'information', color: '#f59e0b', bg: '#fffbeb', title: 'Ek Example Samjho', body: 'Crocin (brand) = ₹30. Paracetamol 500mg (generic) = ₹3. Dono ka kaam bilkul same — bukhar utaarna.' },
                    ].map(card => (
                      <View key={card.title} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, backgroundColor: card.bg, borderRadius: 18, padding: 16 }}>
                        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginRight: 14, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }}>
                          <MaterialCommunityIcons name={card.icon as any} size={20} color={card.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, fontWeight: '900', color: '#0f172a', marginBottom: 3 }}>{card.title}</Text>
                          <Text style={{ fontSize: 11, color: '#475569', lineHeight: 17, fontWeight: '600' }}>{card.body}</Text>
                        </View>
                      </View>
                    ))}
                  </>
                )}

                {medTypeInfoTarget === 'brand' && (
                  <>
                    {[
                      { icon: 'pill', color: '#2563eb', bg: '#eff6ff', title: 'Original / Branded Medicine', body: 'Doctor ne jo naam likha hai prescription mein, bilkul wahi medicine. Koi change nahi.' },
                      { icon: 'currency-inr', color: '#dc2626', bg: '#fef2f2', title: 'Thodi Mehengi Hoti Hai', body: 'Brand marketing aur packaging ke kharche ki wajah se generic se zyada price hoti hai, lekin quality guaranteed hai.' },
                      { icon: 'check-circle', color: '#059669', bg: '#f0fdf4', title: 'Doctor ki First Choice', body: 'Doctors pehle branded medicine likhte hain taki patients ko exactly wahi milein jo test kiya gaya ho.' },
                    ].map(card => (
                      <View key={card.title} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, backgroundColor: card.bg, borderRadius: 18, padding: 16 }}>
                        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginRight: 14, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }}>
                          <MaterialCommunityIcons name={card.icon as any} size={20} color={card.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, fontWeight: '900', color: '#0f172a', marginBottom: 3 }}>{card.title}</Text>
                          <Text style={{ fontSize: 11, color: '#475569', lineHeight: 17, fontWeight: '600' }}>{card.body}</Text>
                        </View>
                      </View>
                    ))}
                  </>
                )}

                {medTypeInfoTarget === 'substitute' && (
                  <>
                    {[
                      { icon: 'swap-horizontal-bold', color: '#9333ea', bg: '#faf5ff', title: 'Alternate Brand / Substitute', body: 'Same kaam karne wali ek alag company ki medicine. Jab original brand stock mein na ho tab use karte hain.' },
                      { icon: 'shield-check', color: '#059669', bg: '#f0fdf4', title: 'Same Salt, Same Effect', body: 'Substitute mein same active ingredient hota hai. Sirf manufacturer alag hota hai — kaam bilkul same.' },
                      { icon: 'currency-inr', color: '#d97706', bg: '#fffbeb', title: 'Cost Benefit', body: 'Substitute usually brand se sasti hoti hai. Agar doctor allow kare to lena sahi rahega.' },
                    ].map(card => (
                      <View key={card.title} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, backgroundColor: card.bg, borderRadius: 18, padding: 16 }}>
                        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginRight: 14, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }}>
                          <MaterialCommunityIcons name={card.icon as any} size={20} color={card.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, fontWeight: '900', color: '#0f172a', marginBottom: 3 }}>{card.title}</Text>
                          <Text style={{ fontSize: 11, color: '#475569', lineHeight: 17, fontWeight: '600' }}>{card.body}</Text>
                        </View>
                      </View>
                    ))}
                  </>
                )}

                {medTypeInfoTarget === 'mixed' && (
                  <>
                    {[
                      { icon: 'layers-triple', color: '#059669', bg: '#f0fdf4', title: 'Mixed Deal Kya Hoti Hai?', body: 'Pharmacy ne aapki prescription mein alag-alag type ki medicines dene ka plan banaya hai — kuch Brand, kuch Generic, aur kuch Alt. Brand. Sab milake ek deal bana di.' },
                      { icon: 'pill', color: '#2563eb', bg: '#eff6ff', title: '💊 Brand', body: 'Doctor ke prescription mein likhi original medicine. Thodi mehengi hoti hai lekin bilkul accurate.' },
                      { icon: 'flask-round-bottom', color: '#d97706', bg: '#fffbeb', title: '🧪 Generic', body: 'Same kaam ki sasti medicine. Same salt, same dose — sirf naam alag. 50–80% kam price.' },
                      { icon: 'swap-horizontal-bold', color: '#9333ea', bg: '#faf5ff', title: '🔄 Alt. Brand', body: 'Alag company ka same ingredient — jab exact brand available na ho. Utna hi effective.' },
                      { icon: 'information', color: '#f59e0b', bg: '#fffbeb', title: 'Kya Main Mixed Deal Le Sakta Hu?', body: 'Haan! Mixed deal bilkul safe hai. Agar koi doubt ho toh apne doctor se ek baar confirm kar lo ki kaunse medicines generic le sakte hain.' },
                    ].map(card => (
                      <View key={card.title} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, backgroundColor: card.bg, borderRadius: 18, padding: 16 }}>
                        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginRight: 14, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }}>
                          <MaterialCommunityIcons name={card.icon as any} size={20} color={card.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, fontWeight: '900', color: '#0f172a', marginBottom: 3 }}>{card.title}</Text>
                          <Text style={{ fontSize: 11, color: '#475569', lineHeight: 17, fontWeight: '600' }}>{card.body}</Text>
                        </View>
                      </View>
                    ))}
                  </>
                )}

                {medTypeInfoTarget === 'partial' && (
                  <>
                    {[
                      { icon: 'alert-circle-outline', color: '#dc2626', bg: '#fef2f2', title: 'Kuch Medicines Missing Hain', body: 'Is quote mein kuch medicines available nahi hain. Inventory details mein Missing / Out of Stock items check karein.' },
                      { icon: 'pill', color: '#2563eb', bg: '#eff6ff', title: 'Available Items Safe Hain', body: 'Jo medicines available dikh rahi hain unka type aur price detail sheet mein verify kar sakte ho.' },
                      { icon: 'cached', color: '#d97706', bg: '#fffbeb', title: 'Refresh Quote Kar Sakte Ho', body: 'Stock old ya incomplete lage to Refresh Stock se pharmacy ko latest availability confirm karne bol sakte ho.' },
                    ].map(card => (
                      <View key={card.title} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, backgroundColor: card.bg, borderRadius: 18, padding: 16 }}>
                        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginRight: 14, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }}>
                          <MaterialCommunityIcons name={card.icon as any} size={20} color={card.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, fontWeight: '900', color: '#0f172a', marginBottom: 3 }}>{card.title}</Text>
                          <Text style={{ fontSize: 11, color: '#475569', lineHeight: 17, fontWeight: '600' }}>{card.body}</Text>
                        </View>
                      </View>
                    ))}
                  </>
                )}

                {/* Close Button */}
                <TouchableOpacity
                  onPress={() => setMedTypeInfoVisible(false)}
                  style={{ marginTop: 4, backgroundColor: '#0f172a', borderRadius: 20, paddingVertical: 18, alignItems: 'center' }}
                >
                  <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' }}>Samajh Gaya ✓</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

    </View>
  );
}
