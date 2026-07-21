import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/Language/LocalizedPrimitives';
import DateTimePicker from '@react-native-community/datetimepicker';

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import axios from 'axios';
import { BlurView } from 'expo-blur';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../../redux/store';
import { fetchUserProfile } from '../../redux/userSlice';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TouchableOpacity,
  View
} from 'react-native';
import Toast from 'react-native-toast-message';
import RatingBottomSheet from '../../components/RatingBottomSheet';
import UnavailableOverlay, { CapabilityFlags, shouldShowOverlay } from '../../components/UnavailableOverlay';
import { SellerHistoryScreen } from './history';
import RemoteImageWithStatus from '../../components/RemoteImageWithStatus';
import { Camera, Logger, MapView, UserLocation } from 'mappls-map-react-native';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const AI_SCAN_TIMEOUT_MS = 2 * 60 * 1000;

const isAiAnalysisFresh = (uploadedAt?: string) => {
  if (!uploadedAt) return true;

  const uploadedAtMs = new Date(uploadedAt).getTime();
  if (Number.isNaN(uploadedAtMs)) return true;

  return Date.now() - uploadedAtMs < AI_SCAN_TIMEOUT_MS;
};

const formatLocalDateParam = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const startOfLocalDay = (date: Date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
};

const endOfLocalDay = (date: Date) => {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
};

const getTodayDateRange = () => {
  const today = new Date();
  return { start: startOfLocalDay(today), end: endOfLocalDay(today) };
};

const getDateRangeForDays = (days: number) => {
  const end = endOfLocalDay(new Date());
  const start = startOfLocalDay(new Date());
  start.setDate(start.getDate() - Math.max(days - 1, 0));
  return { start, end };
};

const DATE_RANGE_PRESETS = [
  { label: 'Today', days: 1 },
  { label: 'Last 7D', days: 7 },
  { label: 'Last 30D', days: 30 },
  { label: '3 Months', days: 90 },
];

const isSameLocalDate = (first?: Date | null, second?: Date | null) => (
  Boolean(first && second) && formatLocalDateParam(first as Date) === formatLocalDateParam(second as Date)
);

const getDateFromKey = (dateKey: string) => new Date(`${dateKey}T00:00:00`);

const formatDateJumpLabel = (dateKey: string, todayDateKey: string) => {
  if (dateKey === todayDateKey) return 'Today';
  const date = getDateFromKey(dateKey);
  if (Number.isNaN(date.getTime())) return dateKey;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
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
  total_amount: number;
  distance_km: number;
  uploaded_at: string;
  user_address?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  user_latitude?: number | string | null;
  user_longitude?: number | string | null;
  user_name?: string;
  user_mobile?: string;
  has_responded?: boolean;
  status?: string;
  user_status?: string;
  user_contact_note?: string;
  user_report_note?: string;
  user_report_count?: number;
  store_contact_note?: string;
  store_report_count?: number;
  user_id: number;
  chat_thread_id?: number | null;
  delivery_option?: string;
  is_locked?: boolean;
  is_unresponsive?: boolean;
  response_version?: number;
  last_refresh_requested_at?: string;
  stock_verified_at?: string;
  is_processing_started?: boolean;
  is_packed?: boolean;
  accepted_at?: string;
  cancelled_by?: string;
  cancel_reason?: string;
  is_ratable?: boolean;
  user_rating?: any;
  store_rating?: any;
  completion_otp_requested?: boolean;
  completion_otp_expires_at?: string | null;
  response_id?: number;
  delivery_offer?: DeliveryOffer | null;
  quotation_scenario?: string;
  repeat_customer?: boolean;
  repeat_order_count?: number;
  last_order_at?: string | null;
  preferred_store_id?: number | null;
  capabilities?: CapabilityFlags;
  medicine_name?: string;
  description?: string;
  prescription_medicine_name?: string;
  prescription_description?: string;
  // AI Classification fields (prefix prescription_ because API nests these from Prescription model)
  user_upload_type?: 'prescription' | 'medicine' | 'text_only';
  prescription_upload_type?: 'prescription' | 'medicine' | 'text_only';
  ai_status?: 'pending' | 'processing' | 'completed' | 'failed';
  ai_classification?: 'prescription' | 'medicine' | 'unknown';
  ai_score?: number | null;
  ai_reason?: string;
  prescription_ai_status?: 'pending' | 'processing' | 'completed' | 'failed';
  prescription_ai_classification?: 'prescription' | 'medicine' | 'unknown';
  prescription_ai_score?: number | null;
  prescription_ai_reason?: string;
};

type DeliveryOffer = {
  distance_km?: number | string | null;
  pickup_available: boolean;
  home_delivery_available: boolean;
  eligibility_code: string;
  unavailable_reason?: string;
  delivery_charge: number | string;
  estimated_delivery_minutes?: number | null;
  delivery_message?: string;
};

const getScenarioColor = (scenario: string | undefined) => {
  if (!scenario || scenario === 'NOT SPECIFIED') return { bg: 'bg-slate-800', text: 'text-slate-400', icon: 'tag-outline' as const };

  switch (scenario.toUpperCase()) {
    case 'PRESCRIBED BRANDS':
      return { bg: 'bg-blue-900/40', text: 'text-blue-400', icon: 'check-decagram' as const };
    case 'ALL GENERICS':
      return { bg: 'bg-emerald-900/40', text: 'text-emerald-400', icon: 'flask-outline' as const };
    case 'BRANDS + GENERICS':
      return { bg: 'bg-orange-900/40', text: 'text-orange-400', icon: 'layers-outline' as const };
    case 'BRAND SUBSTITUTES':
      return { bg: 'bg-purple-900/40', text: 'text-purple-400', icon: 'swap-horizontal' as const };
    case 'PARTIAL AVAILABILITY':
      return { bg: 'bg-amber-900/40', text: 'text-amber-400', icon: 'alert-circle-outline' as const };
    default:
      return { bg: 'bg-slate-800', text: 'text-slate-400', icon: 'tag-outline' as const };
  }
};

type StoreCapabilityUpdate = {
  store_id?: number;
  response_ids?: number[];
  is_store_active?: boolean;
  is_store_verified?: boolean;
  capabilities?: CapabilityFlags;
  updated_at?: string;
};

const isSameStoreCapabilityTarget = (item: ResponseItem, update: StoreCapabilityUpdate) => {
  const responseIds = new Set((update.response_ids || []).map(Number));
  const itemResponseId = item.response_id ?? item.id;
  if (itemResponseId != null && responseIds.has(Number(itemResponseId))) return true;

  // Seller websocket receives only this seller's store capability event. Some
  // enquiry cards are prescription-shaped and do not include item.store yet.
  if (update.store_id != null && item.store == null) return true;
  return update.store_id != null && item.store != null && Number(item.store) === Number(update.store_id);
};

const mergeStoreCapabilityUpdate = (item: ResponseItem, update: StoreCapabilityUpdate): ResponseItem => ({
  ...item,
  capabilities: update.capabilities ?? item.capabilities,
});

const buildMediaUrl = (baseUrl: string, mediaPath?: string | null) => {
  if (!mediaPath) return null;
  if (/^https?:\/\//i.test(mediaPath)) return mediaPath;
  const base = baseUrl.replace(/\/+$/, '');
  const path = mediaPath.startsWith('/') ? mediaPath : `/${mediaPath}`;
  return `${base}${path}`;
};

const getRequestMedicineName = (item?: Pick<ResponseItem, 'medicine_name' | 'prescription_medicine_name'> | null) =>
  item?.medicine_name?.trim() || item?.prescription_medicine_name?.trim() || '';

const getRequestDescription = (item?: Pick<ResponseItem, 'description' | 'prescription_description'> | null) =>
  item?.description?.trim() || item?.prescription_description?.trim() || '';

const ORDER_WORKFLOW_STATUSES = new Set(['accepted', 'processing', 'locked', 'out_for_delivery', 'completed', 'cancelled']);
const QUOTE_REJECTED_STATUSES = new Set(['rejected', 'dismissed', 'declined']);
const QUOTE_EXPIRED_STATUSES = new Set(['expired']);

type EnquiryStage = 'new' | 'quoted' | 'waiting' | 'expired' | 'rejected' | 'reported';
type SellerEnquirySection = 'enquiry' | 'emergency' | 'verification' | 'quote' | 'rejected' | 'history';
type SellerEnquiryMenuSection = SellerEnquirySection;

const normalizeEnquiryStatus = (status?: string | null) => (status || '').toLowerCase();

const hasEnquiryReport = (item: ResponseItem) => (
  (item.store_report_count && item.store_report_count > 0) ||
  Boolean(item.store_contact_note) ||
  (item.user_report_count && item.user_report_count > 0) ||
  Boolean(item.user_contact_note) ||
  Boolean(item.user_report_note)
);

const isOrderWorkflowItem = (item: ResponseItem) => {
  const userStatus = normalizeEnquiryStatus(item.user_status);
  return ORDER_WORKFLOW_STATUSES.has(userStatus) || item.is_locked === true || item.is_processing_started === true || item.is_packed === true || item.completion_otp_requested === true;
};

const isQuoteRejected = (item: ResponseItem) => QUOTE_REJECTED_STATUSES.has(normalizeEnquiryStatus(item.user_status)) || QUOTE_REJECTED_STATUSES.has(normalizeEnquiryStatus(item.status));
const isQuoteExpired = (item: ResponseItem) => QUOTE_EXPIRED_STATUSES.has(normalizeEnquiryStatus(item.user_status)) || QUOTE_EXPIRED_STATUSES.has(normalizeEnquiryStatus(item.status));
const isQuoteSent = (item: ResponseItem) => Boolean(item.has_responded || item.response_id || Number(item.total_amount || 0) > 0);

const canAddPriceQuote = (item: ResponseItem) => (
  !isOrderWorkflowItem(item) &&
  !isQuoteRejected(item) &&
  !isQuoteExpired(item) &&
  !isQuoteSent(item) &&
  !item.last_refresh_requested_at
);

const isQuoteStageItem = (item: ResponseItem) => {
  // Rejected/dismissed items go to the Rejected tab — exclude from Enquiry
  if (isQuoteRejected(item)) return false;
  if (isQuoteExpired(item)) return true;
  return !isOrderWorkflowItem(item);
};

const isVerificationSectionItem = (item: ResponseItem) => (
  isQuoteStageItem(item) &&
  isQuoteSent(item) &&
  Boolean(item.last_refresh_requested_at) &&
  !isQuoteExpired(item)
);

const isSentQuoteSectionItem = (item: ResponseItem) => (
  isQuoteStageItem(item) &&
  isQuoteSent(item) &&
  !item.last_refresh_requested_at
);

const isSellerMenuCardItem = (item: ResponseItem) => (
  canAddPriceQuote(item) ||
  isVerificationSectionItem(item) ||
  isSentQuoteSectionItem(item)
);

const getEnquiryStage = (item: ResponseItem): EnquiryStage => {
  if (hasEnquiryReport(item)) return 'reported';
  if (isQuoteRejected(item)) return 'rejected';
  if (isQuoteExpired(item)) return 'expired';
  if (isQuoteSent(item)) return item.last_refresh_requested_at ? 'waiting' : 'quoted';
  return 'new';
};

const filterEnquiryItems = (items: ResponseItem[]) => items.filter(canAddPriceQuote);

const getSellerSectionItems = (items: ResponseItem[], section: SellerEnquirySection) => {
  switch (section) {
    case 'emergency':
      return items.filter(item => item.status === 'emergency' && !isOrderWorkflowItem(item) && !isQuoteRejected(item) && !isQuoteExpired(item));
    case 'verification':
      return items.filter(isVerificationSectionItem);
    case 'quote':
      return items.filter(isSentQuoteSectionItem);
    case 'rejected':
      return items.filter(isQuoteRejected);
    case 'enquiry':
      return filterEnquiryItems(items);
    default:
      return items;
  }
};

const HISTORY_FILTERS = [
  { key: 'all', label: 'All', icon: 'history', desc: 'All records', color: '#0f172a' },
  { key: 'completed', label: 'Completed', icon: 'check-circle-outline', desc: 'Finished requests', color: '#059669' },
  { key: 'cancelled', label: 'Cancelled', icon: 'close-circle-outline', desc: 'Cancelled requests', color: '#ef4444' },
  { key: 'rejected', label: 'Rejected', icon: 'alert-circle-outline', desc: 'Rejected requests', color: '#f59e0b' },
  { key: 'reported', label: 'Reported', icon: 'flag-triangle', desc: 'Reported records', color: '#dc2626' },
];

const ENQUIRY_SECTION_OPTIONS: { key: SellerEnquiryMenuSection; label: string; icon: string; color: string; bg: string; desc: string }[] = [
  { key: 'emergency', label: 'Emergency', icon: 'alarm-light-outline', color: '#e11d48', bg: '#fff1f2', desc: 'Urgent medicine requests' },
  { key: 'enquiry', label: 'Enquiry', icon: 'radar', color: '#059669', bg: '#ecfdf5', desc: 'Add price quote cards' },
  { key: 'verification', label: 'Verification', icon: 'cached', color: '#2563eb', bg: '#eff6ff', desc: 'Stock check cards' },
  { key: 'quote', label: 'Quote', icon: 'receipt-text-send-outline', color: '#7c3aed', bg: '#f5f3ff', desc: 'Sent quote cards' },
  { key: 'rejected', label: 'Rejected', icon: 'close-circle-outline', color: '#dc2626', bg: '#fef2f2', desc: 'Rejected quotes' },
  { key: 'history', label: 'History', icon: 'history', color: '#0f172a', bg: '#f1f5f9', desc: 'Past quote records' },
];

const SELLER_SECTION_COPY: Record<SellerEnquirySection, {
  title: string;
  caption: string;
  filterLabel: string;
  emptyTitle: string;
  emptySubtitle: string;
  emptyIcon: string;
}> = {
  emergency: {
    title: 'EMERGENCY',
    caption: 'Urgent Requests First',
    filterLabel: 'Emergency',
    emptyTitle: 'No emergency requests',
    emptySubtitle: 'Urgent medicine requests will appear here immediately',
    emptyIcon: 'alarm-light-outline',
  },
  enquiry: {
    title: 'STORE',
    caption: 'Add Price Quote Only',
    filterLabel: 'Add Price',
    emptyTitle: 'No quote requests found',
    emptySubtitle: 'Only enquiries needing Add Price Quote appear here',
    emptyIcon: 'radar',
  },
  verification: {
    title: 'VERIFY',
    caption: 'Stock Verification Cards',
    filterLabel: 'Verification',
    emptyTitle: 'No verification cards',
    emptySubtitle: 'Customer stock-check requests will appear here',
    emptyIcon: 'cached',
  },
  quote: {
    title: 'QUOTE',
    caption: 'Sent Quotes Only',
    filterLabel: 'Sent Quotes',
    emptyTitle: 'No sent quotes',
    emptySubtitle: 'Quotes you send will appear in this section',
    emptyIcon: 'receipt-text-send-outline',
  },
  rejected: {
    title: 'REJECTED',
    caption: 'Rejected / Dismissed Offers',
    filterLabel: 'Rejected',
    emptyTitle: 'No Rejected Offers',
    emptySubtitle: 'Rejected or dismissed quotes will appear here',
    emptyIcon: 'check-circle-outline',
  },
  history: {
    title: 'HISTORY',
    caption: 'Completed / Submitted',
    filterLabel: 'Filter',
    emptyTitle: 'No history found',
    emptySubtitle: 'Past quote records will appear here',
    emptyIcon: 'history',
  },
};

const getEnquiryCardTone = (item: ResponseItem) => {
  if (item.status === 'emergency') {
    return {
      title: 'Priority Enquiry',
      subtitle: 'Urgent request from patient',
      badge: 'Emergency',
      icon: 'alarm-light-outline',
      color: '#ef4444',
      bg: '#fff1f2',
      border: '#fee2e2',
      leftBar: true,
    };
  }

  const stage = getEnquiryStage(item);
  switch (stage) {
    case 'quoted':
      return { title: 'Quote Sent', subtitle: 'Response already submitted', badge: 'Quoted', icon: 'check-decagram-outline', color: '#1d8cf8', bg: '#eff6ff', border: '#dbeafe', leftBar: true };
    case 'waiting':
      return { title: 'Verification Needed', subtitle: 'Patient asked for fresh stock check', badge: 'Waiting', icon: 'cached', color: '#2563eb', bg: '#eff6ff', border: '#dbeafe', leftBar: true };
    case 'rejected':
      return { title: 'Quote Rejected', subtitle: 'Patient declined this quote', badge: 'Rejected', icon: 'close-circle-outline', color: '#ef4444', bg: '#fff1f2', border: '#fee2e2', leftBar: true };
    case 'reported':
      return { title: 'Attention Required', subtitle: 'Only work that needs action now', badge: 'Review', icon: 'flag-triangle', color: '#dc2626', bg: '#fff1f2', border: '#fee2e2', leftBar: true };
    case 'expired':
      return { title: 'Quote Expired', subtitle: 'Request is no longer active', badge: 'Expired', icon: 'timer-off-outline', color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', leftBar: true };
    default:
      return { title: 'New Enquiry', subtitle: 'Open request from patient', badge: 'New', icon: 'radar', color: '#059669', bg: '#ecfdf5', border: '#d1fae5', leftBar: false };
  }
};

const WorkflowHeroArt = ({ onRefresh }: { onRefresh: () => void }) => (
  <View className="relative h-[104px] w-[112px]">
    {/* Background Image */}
    <View className="absolute -right-14 -bottom-10 h-[170px] w-[286px]">
      <Image
        source={require('../../assets/images/enquirybg.png')}
        className="h-full w-full"
        resizeMode="contain"
      />
    </View>

    {/* Refresh Button */}
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onRefresh}
      className="absolute top-0 right-0 h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10"
    >
      <MaterialCommunityIcons
        name="refresh"
        size={24}
        color="#FFFFFF"
      />
    </TouchableOpacity>
  </View>
);

const DeliveryDestinationModal = ({ item, onClose }: { item: ResponseItem | null; onClose: () => void }) => {
  const cameraRef = useRef<any>(null);
  const latitude = Number(item?.user_latitude ?? item?.latitude);
  const longitude = Number(item?.user_longitude ?? item?.longitude);
  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude) && latitude !== 0 && longitude !== 0;
  const destination = hasCoordinates ? [longitude, latitude] as [number, number] : [73.8567, 18.5204] as [number, number];

  useEffect(() => {
    const optionalUnprovisionedMethods = ['setLogoGravity', 'enableTraffic', 'enableTrafficClosure', 'enableTrafficFreeFlow', 'enableTrafficNonFreeFlow', 'enableTrafficStopIcon'];
    Logger.setLogCallback((log) =>
      log.message.includes('Method not Provisioned') &&
      optionalUnprovisionedMethods.some((method) => log.message.includes(method))
    );
    return () => Logger.setLogCallback(() => false);
  }, []);

  const recenter = () => cameraRef.current?.setCamera({
    centerCoordinate: destination,
    zoomLevel: 16,
    animationDuration: 700,
    animationMode: 'easeTo',
  });

  const openNavigation = async () => {
    if (!hasCoordinates) return;
    const label = encodeURIComponent(item?.user_address || 'Delivery destination');
    const navigationUrl = `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`;
    try {
      await Linking.openURL(navigationUrl);
    } catch {
      Toast.show({ type: 'error', text1: 'Navigation app unavailable', text2: 'Use the in-app Mappls map to reach this address.' });
    }
  };

  return (
    <Modal visible={Boolean(item)} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View className="flex-1 bg-slate-950">
        {hasCoordinates ? (
          <MapView style={{ flex: 1 }} logoEnabled attributionEnabled compassEnabled>
            <Camera ref={cameraRef} defaultSettings={{ centerCoordinate: destination, zoomLevel: 16 }} />
            <UserLocation visible />
          </MapView>
        ) : (
          <View className="flex-1 items-center justify-center bg-slate-100 px-8">
            <MaterialCommunityIcons name="map-marker-alert-outline" size={46} color="#64748b" />
            <Text className="mt-4 text-center text-base font-black text-slate-900">Location pin unavailable</Text>
            <Text className="mt-2 text-center text-xs font-semibold leading-5 text-slate-500">Customer address is available, but this order has no saved coordinates.</Text>
          </View>
        )}

        {hasCoordinates && (
          <View pointerEvents="none" className="absolute left-0 right-0 top-0 bottom-[190px] items-center justify-center">
            <View className="h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20">
              <View className="h-10 w-10 items-center justify-center rounded-full border-[3px] border-white bg-emerald-600 shadow-lg">
                <MaterialCommunityIcons name="home-map-marker" size={22} color="#ffffff" />
              </View>
            </View>
          </View>
        )}

        <View className="absolute left-4 right-4 top-12 flex-row items-center justify-between">
          <TouchableOpacity onPress={onClose} className="h-11 w-11 items-center justify-center rounded-2xl border border-white/30 bg-slate-950/85">
            <MaterialCommunityIcons name="arrow-left" size={23} color="#ffffff" />
          </TouchableOpacity>
          <View className="rounded-full border border-white/30 bg-slate-950/85 px-4 py-2">
            <Text className="text-[9px] font-black uppercase tracking-[1.8px] text-white">Delivery destination</Text>
          </View>
          <TouchableOpacity onPress={recenter} disabled={!hasCoordinates} className="h-11 w-11 items-center justify-center rounded-2xl border border-white/30 bg-slate-950/85">
            <MaterialCommunityIcons name="crosshairs-gps" size={22} color="#ffffff" />
          </TouchableOpacity>
        </View>

        <View className="absolute bottom-0 left-0 right-0 rounded-t-[2rem] border-t border-slate-200 bg-white px-5 pb-7 pt-5 shadow-2xl">
          <View className="mb-4 flex-row items-start">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50">
              <MaterialCommunityIcons name="account-location" size={25} color="#059669" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-[8px] font-black uppercase tracking-[1.8px] text-emerald-700">Deliver to</Text>
              <Text className="mt-0.5 text-base font-black text-slate-950">{item?.user_name || 'Customer'}</Text>
              <Text className="mt-1 text-[11px] font-semibold leading-4 text-slate-600">{item?.user_address || 'Address not available'}</Text>
            </View>
          </View>
          <View className="flex-row gap-3">
            <TouchableOpacity onPress={recenter} disabled={!hasCoordinates} className="h-12 flex-1 flex-row items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
              <MaterialCommunityIcons name="map-marker-radius" size={18} color="#0f172a" />
              <Text className="ml-2 text-[10px] font-black uppercase tracking-[1px] text-slate-900">Show pin</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={openNavigation} disabled={!hasCoordinates} className={`h-12 flex-[1.35] flex-row items-center justify-center rounded-2xl ${hasCoordinates ? 'bg-emerald-600' : 'bg-slate-300'}`}>
              <MaterialCommunityIcons name="navigation-variant" size={18} color="#ffffff" />
              <Text className="ml-2 text-[10px] font-black uppercase tracking-[1px] text-white">Start navigation</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};


// 💎 Production Optimization: memoized Card Component to prevent laggy scrolling
const PrescriptionCard = React.memo(({
  item,
  BASE_URL,
  onImagePress,
  onAddPrice,
  onStartChat,
  onOpenStatus,
  onVerifyStock,
  onStoreUpdateProgress,
  onStoreCancel,
  onManualReviewInfo,
  onAiInfo,
  onOpenMap,
}: {
  item: ResponseItem;
  BASE_URL: string;
  onImagePress: (item: ResponseItem, url: string) => void;
  onAddPrice: (item: ResponseItem) => void;
  onStartChat: (item: ResponseItem) => void;
  onOpenStatus: (item: ResponseItem) => void;
  onVerifyStock: (id: number) => void;
  onStoreUpdateProgress: (id: number, action: string) => void;
  onStoreCancel: (item: ResponseItem, type?: 'cancel_order' | 'reject_enquiry') => void;
  onManualReviewInfo?: () => void;
  onAiInfo?: (type: 'mismatch' | 'rx' | 'medicine' | 'unknown', score?: number) => void;
  onOpenMap: (item: ResponseItem) => void;
}) => {
  const uploadedAt = new Date(item.uploaded_at);
  const formattedDate = uploadedAt.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
  });

  const isAccepted = item.user_status === 'accepted';
  const isProcessing = item.user_status === 'processing';
  const isLocked = item.user_status === 'locked' || item.user_status === 'out_for_delivery';
  const isRejected = item.user_status === 'rejected';
  const cardTone = getEnquiryCardTone(item);
  const distanceLabel = item.distance_km ? String(item.distance_km).toUpperCase() : 'NEARBY';
  const patientReportText = item.user_report_note || item.user_contact_note;
  const patientReportCount = item.user_report_count || (patientReportText ? 1 : 0);
  const hasPatientReport = patientReportCount > 0 || Boolean(patientReportText);
  const hasStoreSubmittedReport = (item.store_report_count || 0) > 0 || Boolean(item.store_contact_note);
  const imageUrl = buildMediaUrl(BASE_URL, item.image);
  const requestMedicineName = getRequestMedicineName(item);
  const requestDescription = getRequestDescription(item);
  const hasRequestText = Boolean(requestMedicineName || requestDescription);
  const isTextOnlyRequest = item.user_upload_type === 'text_only' || item.prescription_upload_type === 'text_only';
  const shouldUseTextOnlyLayout = isTextOnlyRequest || (!imageUrl && hasRequestText);
  const reportButtonLabel = hasPatientReport
    ? `Report ${patientReportCount}`
    : hasStoreSubmittedReport
      ? 'Reported'
      : 'Report';
  const canViewPatient = item.capabilities?.permissions?.view_address !== false;
  const canCallPatient = item.capabilities?.permissions?.call !== false && canViewPatient;

  // Pre-compute AI status for header badge
  const _aiUploadType = item.prescription_upload_type || item.user_upload_type;
  const _aiStatus = item.prescription_ai_status || item.ai_status;
  const _aiClass = item.prescription_ai_classification || item.ai_classification;
  const _aiScore = item.prescription_ai_score ?? item.ai_score;
  const _aiCompleted = _aiStatus === 'completed' && !!_aiClass;
  const _aiIsRx = _aiClass === 'prescription';
  const _aiIsMed = _aiClass === 'medicine';
  const _aiMismatch = _aiUploadType === 'prescription' && _aiCompleted && (_aiClass === 'medicine' || (_aiClass === 'unknown' && (_aiScore ?? 1) < 0.5));

  return (
    <View
      className="bg-white rounded-[1.15rem] mb-3 border border-slate-200/80 shadow-sm shadow-slate-200 overflow-hidden mx-1"
      style={{ borderLeftWidth: cardTone.leftBar ? 3 : 0, borderLeftColor: cardTone.color }}
    >
      <View className="px-4 pt-4 pb-3">
        <View className="flex-row items-start justify-between">
          <View className="flex-row items-center flex-1 pr-2">
            <View
              className="h-10 w-10 rounded-2xl items-center justify-center border shadow-sm"
              style={{ backgroundColor: cardTone.bg, borderColor: cardTone.border }}
            >
              <MaterialCommunityIcons name={cardTone.icon as any} size={20} color={cardTone.color} />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-slate-950 font-black uppercase tracking-[1px] text-[12px]" numberOfLines={1}>
                {cardTone.title}
              </Text>
              <Text className="text-slate-500 font-bold text-[10px] mt-0.5" numberOfLines={1}>
                {cardTone.subtitle}
              </Text>
            </View>
          </View>

          <View className="items-end pt-0.5">
            <View className="flex-row items-center mb-1.5">
              <MaterialCommunityIcons name="clock-outline" size={10} color="#94a3b8" />
              <Text className="text-slate-400 font-black text-[8px] uppercase tracking-widest ml-1">{formattedDate}</Text>
            </View>
            <View className="flex-row items-center flex-wrap justify-end">
              {/* Manual Review badge for text/no-image cards */}
              {shouldUseTextOnlyLayout && (
                <TouchableOpacity
                  onPress={() => onManualReviewInfo?.()}
                  className="flex-row items-center bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5 mr-1.5 mb-1 shadow-sm"
                  activeOpacity={0.75}
                >
                  <MaterialCommunityIcons name="eye-check-outline" size={9} color="#c2410c" />
                  <Text className="text-[7px] font-black text-orange-700 uppercase tracking-widest ml-1">Manual Review</Text>
                  <MaterialCommunityIcons name="information-outline" size={8} color="#c2410c" style={{ marginLeft: 2 }} />
                </TouchableOpacity>
              )}
              {/* Compact AI badge for image cards — tappable */}
              {item.image && _aiCompleted && (
                <TouchableOpacity
                  onPress={() => onAiInfo?.(
                    _aiMismatch ? 'mismatch' : _aiIsRx ? 'rx' : _aiIsMed ? 'medicine' : 'unknown',
                    _aiScore ?? undefined
                  )}
                  activeOpacity={0.75}
                  className={`flex-row items-center rounded-full px-2 py-0.5 mr-1.5 mb-1 border shadow-sm ${_aiMismatch ? 'bg-amber-50 border-amber-200' : _aiIsRx ? 'bg-emerald-50 border-emerald-200' : _aiIsMed ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'
                    }`}
                >
                  <MaterialCommunityIcons
                    name={(_aiMismatch ? 'alert-circle-outline' : _aiIsRx ? 'file-check-outline' : _aiIsMed ? 'pill' : 'help-circle-outline') as any}
                    size={9}
                    color={_aiMismatch ? '#d97706' : _aiIsRx ? '#059669' : _aiIsMed ? '#2563eb' : '#64748b'}
                  />
                  <Text className={`text-[7px] font-black uppercase tracking-wider ml-1 ${_aiMismatch ? 'text-amber-700' : _aiIsRx ? 'text-emerald-700' : _aiIsMed ? 'text-blue-700' : 'text-slate-600'
                    }`}>
                    {_aiMismatch ? 'AI Warning' : _aiIsRx ? 'Rx Verified' : _aiIsMed ? 'Medicine' : 'Unknown'}
                  </Text>
                  <MaterialCommunityIcons name="information-outline" size={8} color={_aiMismatch ? '#d97706' : _aiIsRx ? '#059669' : _aiIsMed ? '#2563eb' : '#64748b'} style={{ marginLeft: 2 }} />
                </TouchableOpacity>
              )}
              {item.image && _aiStatus === 'pending' && (
                <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-full px-2 py-0.5 mr-1.5 mb-1 shadow-sm">
                  <ActivityIndicator size={8} color="#64748b" />
                  <Text className="text-[7px] font-black text-slate-500 uppercase tracking-wider ml-1">AI Scan</Text>
                </View>
              )}
              {(isAccepted || item.is_locked) && item.delivery_option && (
                <View className="px-1.5 py-0.5 bg-blue-50 rounded-full flex-row items-center border border-blue-100 mr-1.5 mb-1 shadow-sm shadow-blue-100">
                  <MaterialCommunityIcons name={item.delivery_option === 'walk_in' ? 'walk' : 'truck-delivery'} size={9} color="#2563eb" />
                  <Text className="text-[7px] font-black text-blue-700 uppercase ml-0.5">{item.delivery_option === 'walk_in' ? 'Walk-in' : 'Online'}</Text>
                </View>
              )}
              <View
                className="px-2 py-0.5 rounded-full flex-row items-center border shadow-sm mb-1"
                style={{ backgroundColor: cardTone.bg, borderColor: cardTone.border }}
              >
                <Text className="text-[9px] font-black uppercase tracking-[0.7px]" style={{ color: cardTone.color }} numberOfLines={1}>
                  {cardTone.badge}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      <View className="px-4 pb-4" style={{ position: 'relative' }}>
        {shouldUseTextOnlyLayout ? (
          <View>
            <View className="mb-3">
              <View className="flex-row items-center justify-between mb-0.5">
                <View className="flex-row items-center">
                  <MaterialCommunityIcons name="account-outline" size={11} color="#059669" />
                  <Text className="text-[9px] font-black text-emerald-700 uppercase tracking-widest ml-1">PATIENT</Text>
                </View>
                {/* Distance moved here for compactness */}
                <View className="flex-row items-center">
                  <MaterialCommunityIcons name="map-marker-radius-outline" size={10} color="#64748b" />
                  <Text className="text-slate-500 text-[8.5px] font-black ml-1 uppercase tracking-wider">{distanceLabel}</Text>
                </View>
              </View>
              <View className="flex-row items-center flex-wrap">
                <Text className="text-[18px] font-black text-slate-950 leading-tight mr-2" numberOfLines={1}>{item.user_name || 'Patient'}</Text>
                {isQuoteSent(item) && (
                  <View className="px-1.5 py-0.5 bg-emerald-50 rounded flex-row items-center border border-emerald-100 mr-1 mb-1 mt-1">
                    <MaterialCommunityIcons name="check-bold" size={8} color="#059669" />
                    <Text className="text-[7px] font-black text-emerald-700 uppercase tracking-wider ml-1">Quoted</Text>
                  </View>
                )}
                {item.quotation_scenario && (
                  <View className={`px-1.5 py-0.5 rounded flex-row items-center border border-white/5 mr-1 mb-1 mt-1 ${getScenarioColor(item.quotation_scenario).bg}`}>
                    <MaterialCommunityIcons
                      name={getScenarioColor(item.quotation_scenario).icon}
                      size={8}
                      color={getScenarioColor(item.quotation_scenario).text.replace('text-', '') === 'blue-400' ? '#60a5fa' :
                        getScenarioColor(item.quotation_scenario).text.replace('text-', '') === 'emerald-400' ? '#34d399' :
                          getScenarioColor(item.quotation_scenario).text.replace('text-', '') === 'orange-400' ? '#fb923c' :
                            getScenarioColor(item.quotation_scenario).text.replace('text-', '') === 'purple-400' ? '#c084fc' :
                              getScenarioColor(item.quotation_scenario).text.replace('text-', '') === 'amber-400' ? '#fbbf24' : '#94a3b8'}
                    />
                    <Text className={`text-[7px] font-black uppercase ml-1 tracking-tighter ${getScenarioColor(item.quotation_scenario).text}`}>
                      {item.quotation_scenario}
                    </Text>
                  </View>
                )}
                {item.repeat_customer && (
                  <View className="flex-row items-center bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 mr-1 mb-1 mt-1">
                    <MaterialCommunityIcons name="star-circle" size={8} color="#d97706" />
                    <Text className="text-amber-700 text-[7px] font-black uppercase ml-0.5">
                      Repeat {item.repeat_order_count ? `(${item.repeat_order_count})` : ''}
                    </Text>
                  </View>
                )}
                {item.is_unresponsive && (
                  <View className="flex-row items-center bg-red-600 px-1.5 py-0.5 rounded mb-1 mt-1 border border-red-700">
                    <MaterialCommunityIcons name="alert-decagram" size={8} color="white" />
                    <Text className="text-white text-[7px] font-black uppercase ml-0.5">Unresponsive</Text>
                  </View>
                )}
              </View>
            </View>

            {requestMedicineName ? (
              <View className="mb-3">
                <View className="flex-row items-center justify-between mb-1.5">
                  <View className="flex-row items-center">
                    <MaterialCommunityIcons name="prescription" size={12} color="#059669" />
                    <Text className="text-[9px] font-black text-emerald-700 uppercase tracking-widest ml-1">
                      MEDICINE REQUEST
                    </Text>
                  </View>
                  <View className="bg-slate-100 rounded px-1.5 py-0.5 border border-slate-200">
                    <Text className="text-[8px] font-bold text-slate-700">1 Item</Text>
                  </View>
                </View>
                <View className="bg-slate-50 border border-slate-100 rounded-lg p-2.5 flex-row items-center">
                  <View className="w-5 h-5 rounded-full bg-emerald-700 items-center justify-center mr-2 shadow-sm shadow-emerald-900/20">
                    <Text className="text-white text-[9px] font-black">1</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-slate-950 font-black text-[11px] uppercase tracking-wide leading-tight">
                      {requestMedicineName}
                    </Text>
                  </View>
                </View>
              </View>
            ) : null}

            {requestDescription ? (
              <View className="mb-0">
                <View className="flex-row items-center mb-1">
                  <MaterialCommunityIcons name="note-edit-outline" size={11} color="#059669" />
                  <Text className="text-[9px] font-black text-emerald-700 uppercase tracking-widest ml-1">ADDITIONAL NOTES</Text>
                </View>
                <Text className="text-slate-800 font-semibold text-[10px] leading-tight">
                  {requestDescription}
                </Text>
              </View>
            ) : null}

          </View>
        ) : (
          <View>
            <View className="flex-row items-center mb-3">
              <TouchableOpacity
                onPress={() => canViewPatient && imageUrl ? onImagePress(item, imageUrl) : undefined}
                className="w-[70px] h-[70px] rounded-[0.9rem] bg-slate-50 border border-slate-200 items-center justify-center overflow-hidden shadow-sm"
              >
                {imageUrl ? (
                  <>
                    <RemoteImageWithStatus uri={imageUrl} />
                    <View className="absolute bottom-0 left-0 right-0 bg-slate-950/65 py-1 items-center">
                      <Text className="text-white text-[7px] font-black uppercase tracking-[1.5px]">Inspect</Text>
                    </View>
                  </>
                ) : (
                  <View className="items-center justify-center opacity-40">
                    <MaterialCommunityIcons name="image-off-outline" size={24} color="#0f172a" />
                    <Text className="text-[7px] font-black text-slate-900 mt-1 uppercase tracking-widest text-center leading-[9px]">No{'\n'}Image</Text>
                  </View>
                )}
              </TouchableOpacity>
              <View className="ml-4 flex-1 pr-2">
                <View className="flex-row items-center">
                  <Text className="text-[21px] font-black text-slate-950 leading-tight flex-1" numberOfLines={1}>{item.user_name || 'Patient'}</Text>
                  {isQuoteSent(item) && (
                    <View className="ml-1.5 px-2 py-0.5 bg-emerald-50 rounded-full flex-row items-center border border-emerald-100">
                      <MaterialCommunityIcons name="check-bold" size={9} color="#059669" />
                      <Text className="text-[7px] font-black text-emerald-700 uppercase tracking-wider ml-1">Quoted</Text>
                    </View>
                  )}
                </View>
                <View className="flex-row items-center mt-1.5 flex-wrap">
                  <View className="flex-row items-center bg-slate-100 px-2.5 py-0.5 rounded-full">
                    <MaterialCommunityIcons name="map-marker-radius-outline" size={10} color="#64748b" />
                    <Text className="text-slate-600 text-[9px] font-black ml-1 uppercase tracking-wider">{distanceLabel}</Text>
                  </View>
                  {item.quotation_scenario && (
                    <View className={`ml-1.5 px-2 py-0.5 rounded-full flex-row items-center border border-white/5 ${getScenarioColor(item.quotation_scenario).bg}`}>
                      <MaterialCommunityIcons
                        name={getScenarioColor(item.quotation_scenario).icon}
                        size={9}
                        color={getScenarioColor(item.quotation_scenario).text.replace('text-', '') === 'blue-400' ? '#60a5fa' :
                          getScenarioColor(item.quotation_scenario).text.replace('text-', '') === 'emerald-400' ? '#34d399' :
                            getScenarioColor(item.quotation_scenario).text.replace('text-', '') === 'orange-400' ? '#fb923c' :
                              getScenarioColor(item.quotation_scenario).text.replace('text-', '') === 'purple-400' ? '#c084fc' :
                                getScenarioColor(item.quotation_scenario).text.replace('text-', '') === 'amber-400' ? '#fbbf24' : '#94a3b8'}
                      />
                      <Text className={`text-[7px] font-black uppercase ml-1 tracking-tighter ${getScenarioColor(item.quotation_scenario).text}`}>
                        {item.quotation_scenario}
                      </Text>
                    </View>
                  )}
                  {item.repeat_customer && (
                    <View className="ml-1.5 flex-row items-center bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                      <MaterialCommunityIcons name="star-circle" size={9} color="#d97706" />
                      <Text className="text-amber-700 text-[7px] font-black uppercase ml-1">
                        Repeat {item.repeat_order_count ? `(${item.repeat_order_count})` : ''}
                      </Text>
                    </View>
                  )}
                  {item.is_unresponsive && (
                    <View className="ml-1.5 flex-row items-center bg-red-600 px-2 py-0.5 rounded-full">
                      <MaterialCommunityIcons name="alert-decagram" size={9} color="white" />
                      <Text className="text-white text-[7px] font-black uppercase ml-1">Unresponsive</Text>
                    </View>
                  )}
                </View>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={28} color="#0f172a" />
            </View>

            {hasRequestText ? (
              <View className="bg-slate-100/70 border border-slate-200/60 rounded-[1.15rem] p-4 mb-4 flex-row items-center shadow-sm">
                <View className="w-10 h-10 rounded-2xl bg-white border border-slate-200 items-center justify-center mr-3 shadow-sm shadow-slate-200/50">
                  <MaterialCommunityIcons name="pill" size={20} color="#0f172a" />
                </View>
                <View className="flex-1">
                  {requestMedicineName ? (
                    <Text className="text-slate-900 font-black text-[14px] uppercase tracking-wide leading-tight">
                      {requestMedicineName}
                    </Text>
                  ) : null}
                  {requestDescription ? (
                    <Text className="text-slate-600 font-bold text-[10px] mt-1 leading-4">
                      {requestDescription}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>
        )}


        <View style={{ position: 'relative', overflow: 'hidden', borderRadius: 20 }}>

          {item.user_status === 'completed' ? (
            <View className="bg-emerald-50 border border-emerald-100 rounded-[1.15rem] p-3 mb-4 flex-row items-center">
              <MaterialCommunityIcons name="lock-check" size={16} color="#059669" />
              <View className="ml-2 flex-1">
                <Text className="text-emerald-700 text-[9px] font-black uppercase tracking-[1.5px]">Delivered Successfully</Text>
                <Text className="text-emerald-600/80 text-[8px] font-bold mt-0.5">Details hidden for privacy</Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity activeOpacity={0.78} onPress={() => onOpenMap(item)} className="bg-emerald-50/60 border border-emerald-100 rounded-[0.95rem] px-4 py-3 mb-4">
              <View className="flex-row items-center justify-between mb-1.5">
                <View className="flex-row items-center">
                  <MaterialCommunityIcons name="map-marker-outline" size={12} color="#059669" />
                  <Text className="text-emerald-700 text-[7.5px] font-black uppercase tracking-[1.7px] ml-1.5">Patient Address</Text>
                </View>
                <View className="flex-row items-center rounded-full bg-emerald-600 px-2.5 py-1">
                  <Text className="text-[7px] font-black uppercase tracking-[1px] text-white">View map</Text>
                  <MaterialCommunityIcons name="chevron-right" size={11} color="#ffffff" />
                </View>
              </View>
              <Text className="text-slate-800 text-[13px] font-semibold leading-5" numberOfLines={2}>{item.user_address || 'Address not available'}</Text>
            </TouchableOpacity>
          )}

          {item.user_status === 'cancelled' && item.cancel_reason && (
            <View className="mb-4 bg-red-50 rounded-[1.25rem] p-3.5 border border-red-100/50 shadow-sm shadow-red-100/20">
              <View className="flex-row items-center mb-1.5">
                <MaterialCommunityIcons name="close-octagon-outline" size={13} color="#ef4444" />
                <Text className="text-red-700 text-[7.5px] font-black uppercase ml-1.5 tracking-[2px]">Cancellation Reason</Text>
              </View>
              <Text className="text-red-900 font-bold text-[11px] italic leading-4">{item.cancel_reason}</Text>
            </View>
          )}

          {item.last_refresh_requested_at && (
            <View className={`mb-4 p-3.5 rounded-[1.25rem] border ${item.is_unresponsive ? 'bg-red-50 border-red-100' : 'bg-blue-50 border-blue-100'}`}>
              <View className="flex-row items-center mb-1.5">
                <MaterialCommunityIcons name="cached" size={13} color={item.is_unresponsive ? "#ef4444" : "#2563eb"} />
                <Text className={`${item.is_unresponsive ? 'text-red-700' : 'text-blue-700'} text-[7.5px] font-black uppercase ml-1.5 tracking-[2px]`}>
                  {item.is_unresponsive ? 'Urgent Accountability Warning' : 'Patient requested Verification'}
                </Text>
              </View>
              <Text className={`${item.is_unresponsive ? 'text-red-900' : 'text-blue-900'} text-[11px] font-bold leading-4`}>
                {item.is_unresponsive
                  ? "User has marked you as UNRESPONSIVE. Update stock immediately to restore trust."
                  : "User is ready to buy but needs fresh stock verification. Please update now."}
              </Text>
            </View>
          )}

        </View>

        {/* ⭐ Customer Feedback — always visible, even after completion */}
        {/* {item.user_rating && (
          <View className="mx-0 mb-4 mt-2 bg-emerald-50 rounded-[1.25rem] p-3.5 border border-emerald-100/50 shadow-sm shadow-emerald-100/20">
            <View className="flex-row items-center justify-between mb-1.5">
              <View className="flex-row items-center">
                <MaterialCommunityIcons name="star-circle" size={13} color="#059669" />
                <Text className="text-emerald-700 text-[7.5px] font-black uppercase ml-1.5 tracking-[2px]">Customer Feedback</Text>
              </View>
              <View className="flex-row items-center">
                <Text className="text-emerald-700 font-black text-[11px] mr-1">{item.user_rating.rating}</Text>
                <MaterialCommunityIcons name="star" size={11} color="#059669" />
              </View>
            </View>
            <Text className="text-emerald-900 font-bold text-[11px] italic leading-4">{item.user_rating.review || 'No written review'}</Text>
          </View>
        )} */}

        {/* 🚩 Report — always accessible, outside overlay for completed orders */}
        {item.user_status === 'completed' && (
          <View className="flex-row justify-between items-center bg-gray-50 p-1.5 rounded-2xl border border-gray-100 mb-3">
            <TouchableOpacity
              className="flex-row items-center px-4 py-2 rounded-xl bg-white shadow-sm border border-gray-100"
              onPress={() => onOpenStatus(item)}
            >
              <MaterialCommunityIcons name="flag-outline" size={12} color="#ef4444" />
              <Text className="ml-2 text-red-500 font-bold text-[8.5px] uppercase tracking-widest">Report Problem</Text>
              {patientReportCount > 0 && (
                <View className="ml-2 min-w-[18px] h-[18px] px-1.5 rounded-full bg-red-50 border border-red-100 items-center justify-center">
                  <Text className="text-red-600 font-black text-[8px]">{patientReportCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* re-open sensitive section for action buttons */}
        <View style={{ position: 'relative', overflow: 'hidden', borderRadius: 20 }}>

          {/* 🔒 COMPLETED OVERLAY — dims upper card body, rating/report block below stays active */}
          {item.user_status === 'completed' && (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(248, 250, 252, 0.82)',
                borderRadius: 16,
                zIndex: 10,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View style={{ alignItems: 'center', opacity: 0.7 }}>
                <MaterialCommunityIcons name="lock-check" size={32} color="#059669" />
                <Text style={{ color: '#059669', fontWeight: '900', fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', marginTop: 6 }}>Order Locked</Text>
              </View>
            </View>
          )}

          {item.user_status !== 'completed' && (
            <View className="flex-row gap-2 mb-4">

              {/* ✅ STORE: Reject Enquiry & Add Price (only before quote, and only if not already responded) */}
              {canAddPriceQuote(item) && (
                <>
                  <TouchableOpacity
                    onPress={() => onStoreCancel(item, 'reject_enquiry')}
                    className="w-[70px] bg-red-50 border border-red-100 py-3 rounded-[0.85rem] flex-row justify-center items-center shadow-sm mr-2 active:bg-red-100"
                  >
                    <MaterialCommunityIcons name="close-circle-outline" size={17} color="#ef4444" />
                    <Text className="text-red-500 font-black text-[9px] ml-1 uppercase tracking-[1px]">Reject</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => onAddPrice(item)}
                    className="flex-1 bg-[#007a53] py-3 rounded-[0.85rem] flex-row justify-center items-center shadow-lg shadow-emerald-200 active:bg-emerald-800"
                  >
                    <MaterialCommunityIcons name="plus-circle-outline" size={17} color="white" />
                    <Text className="text-white font-black text-[10px] ml-1.5 uppercase tracking-[1.2px]">
                      Add Price Quote
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              {/* ✅ STORE: Verify Stock (ONLY when user requested refresh) */}
              {!isAccepted && !isRejected && !item.is_locked && item.last_refresh_requested_at && (
                <TouchableOpacity
                  onPress={() => onVerifyStock(item.id)}
                  className="flex-[2] bg-blue-600 py-3 rounded-[1.1rem] flex-row justify-center items-center shadow-lg shadow-blue-200 active:bg-blue-700"
                >
                  <MaterialCommunityIcons name="refresh" size={15} color="white" />
                  <Text className="text-white font-black text-[10px] ml-1.5 uppercase tracking-[1.2px]">
                    Verify Stock Available
                  </Text>
                </TouchableOpacity>
              )}

              {/* 🚩 Enquiry report stays available without mixing order workflow actions */}
              {!isAccepted && !item.is_locked && item.user_status !== 'completed' && (
                <TouchableOpacity
                  onPress={() => onOpenStatus(item)}
                  className="w-[54px] py-3 bg-white rounded-[0.85rem] flex-row justify-center items-center border border-red-100 shadow-sm shadow-red-50 active:bg-red-50"
                >
                  <MaterialCommunityIcons name={hasStoreSubmittedReport ? "check-circle-outline" : "flag-outline"} size={15} color={hasStoreSubmittedReport ? "#059669" : "#ef4444"} />
                </TouchableOpacity>
              )}

              {/* ✅ AFTER ACCEPT → OFFER-STYLE TOOLBAR */}
              {(isAccepted || item.is_locked) && (
                <View className="flex-1 flex-row items-center justify-between pt-3 border-t border-slate-100/80">
                  <TouchableOpacity
                    onPress={() => onOpenStatus(item)}
                    className="px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-full flex-row items-center active:bg-emerald-100"
                  >
                    <MaterialCommunityIcons name={hasStoreSubmittedReport ? "check-circle-outline" : "flag-outline"} size={15} color="#059669" />
                    <Text className="text-emerald-700 font-black text-[9px] ml-1.5 tracking-widest uppercase" numberOfLines={1}>{reportButtonLabel}</Text>
                    {hasStoreSubmittedReport && patientReportCount > 0 && (
                      <View className="w-1.5 h-1.5 rounded-full bg-emerald-500 ml-1.5" />
                    )}
                  </TouchableOpacity>

                  <View className="flex-row items-center gap-1.5">
                    <TouchableOpacity
                      onPress={() => onStartChat(item)}
                      className="w-[34px] h-[34px] justify-center items-center bg-slate-50 border border-slate-100 rounded-full shadow-sm active:bg-slate-100"
                    >
                      <MaterialCommunityIcons name="chat-outline" size={16} color="#64748b" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => canCallPatient && item.user_mobile ? Linking.openURL(`tel:${item.user_mobile}`) : undefined}
                      className="w-[34px] h-[34px] justify-center items-center bg-slate-50 border border-slate-100 rounded-full shadow-sm active:bg-slate-100"
                    >
                      <MaterialCommunityIcons name="phone-outline" size={16} color="#64748b" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

            </View>
          )}

          {/* 🚦 Store Progress & Cancel — shown after accepted/processing */}
          {(isAccepted || isProcessing || isLocked) && !isRejected && item.user_status !== 'completed' && item.user_status !== 'cancelled' && (
            <View className="bg-slate-50 border border-slate-100 rounded-[1.25rem] p-3.5 shadow-sm shadow-slate-100">
              <View className="flex-row items-center justify-between mb-2.5">
                <View className="flex-row items-center">
                  <View className="w-7 h-7 rounded-lg bg-white items-center justify-center border border-slate-200">
                    <MaterialCommunityIcons name="clipboard-check-outline" size={14} color="#0f172a" />
                  </View>
                  <View className="ml-2.5">
                    <Text className="text-slate-950 text-[9px] font-black uppercase tracking-[1.6px]">Fulfilment Actions</Text>
                    <Text className="text-slate-400 text-[7.5px] font-bold uppercase tracking-[1.2px] mt-0.5">Next operational step</Text>
                  </View>
                </View>
              </View>

              <View className="flex-row gap-2">
                {!item.is_processing_started && (
                  <TouchableOpacity
                    onPress={() => onStoreUpdateProgress(item.response_id || item.id, 'start_processing')}
                    className="flex-[2.1] py-3 bg-slate-950 rounded-[1.05rem] flex-row justify-center items-center shadow-lg shadow-slate-200 active:bg-slate-800"
                  >
                    <MaterialCommunityIcons name="script-text-outline" size={14} color="#34d399" />
                    <Text className="text-white font-black text-[8.5px] uppercase tracking-[1.4px] ml-1.5">Start Billing</Text>
                  </TouchableOpacity>
                )}

                {item.is_processing_started && !item.is_packed && (
                  <TouchableOpacity
                    onPress={() => onStoreUpdateProgress(item.response_id || item.id, 'mark_packed')}
                    className="flex-[2.1] py-3 bg-amber-500 rounded-[1.05rem] flex-row justify-center items-center shadow-lg shadow-amber-100 active:bg-amber-600"
                  >
                    <MaterialCommunityIcons name="package-variant-closed" size={14} color="white" />
                    <Text className="text-white font-black text-[8.5px] uppercase tracking-[1.4px] ml-1.5">Packed / Ready</Text>
                  </TouchableOpacity>
                )}

                {item.is_packed && !isLocked && (
                  <TouchableOpacity
                    onPress={() => onStoreUpdateProgress(item.response_id || item.id, 'mark_locked')}
                    className="flex-[2.1] py-3 bg-slate-950 rounded-[1.05rem] flex-row justify-center items-center shadow-lg shadow-slate-200 active:bg-slate-800"
                  >
                    <MaterialCommunityIcons name={item.delivery_option === 'online' ? 'truck-delivery' : 'lock-check-outline'} size={14} color="#34d399" />
                    <Text className="text-emerald-300 font-black text-[8.5px] uppercase tracking-[1.4px] ml-1.5">
                      {item.delivery_option === 'online' ? 'Out for Delivery' : 'Ready Pickup'}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Store Cancel */}
                {item.user_status !== 'locked' && (
                  <TouchableOpacity
                    onPress={() => onStoreCancel(item)}
                    className="flex-1 py-3 bg-white rounded-[1.05rem] flex-row justify-center items-center border border-red-100 shadow-sm shadow-red-50 active:bg-red-50"
                  >
                    <MaterialCommunityIcons name="close-circle-outline" size={13} color="#ef4444" />
                    <Text className="text-red-500 font-black text-[7.5px] uppercase tracking-[1px] ml-1">Cancel</Text>
                  </TouchableOpacity>
                )}
              </View>

              {item.user_status === 'locked' && (
                <TouchableOpacity
                  onPress={() => onStoreUpdateProgress(item.response_id || item.id, 'mark_completed')}
                  className="mt-2.5 py-3 bg-emerald-600 rounded-[1.05rem] flex-row justify-center items-center shadow-lg shadow-emerald-100 active:bg-emerald-700"
                >
                  <MaterialCommunityIcons name="check-decagram" size={14} color="white" />
                  <Text className="text-white font-black text-[8.5px] uppercase tracking-[1.4px] ml-1.5">Complete / Dispensed</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {item.user_status === 'completed' && (
            <View className="mb-4 mt-2">
              <View className="bg-slate-900 rounded-[1.5rem] p-5 border border-emerald-900 shadow-2xl shadow-emerald-900/30 overflow-hidden">
                <View className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full" />
                <View className="flex-row items-center justify-between mb-4">
                  <View>
                    <Text className="text-emerald-400 font-black text-[10px] uppercase tracking-[3px]">Delivered Successfully</Text>
                    <View className="flex-row items-center mt-1">
                      <MaterialCommunityIcons name="lock" size={14} color="#10b981" />
                      <Text className="text-white font-bold text-lg tracking-tight ml-1.5">COMPLETED</Text>
                    </View>
                  </View>
                  <MaterialCommunityIcons name="check-decagram" size={32} color="#10b981" />
                </View>

                {item.user_rating ? (
                  <View className="bg-emerald-500/20 rounded-xl p-4 border border-emerald-500/30">
                    {/* Stars Row */}
                    <View className="flex-row items-center mb-2">
                      {[1, 2, 3, 4, 5].map(star => (
                        <MaterialCommunityIcons
                          key={star}
                          name={star <= item.user_rating.rating ? 'star' : 'star-outline'}
                          size={18}
                          color={star <= item.user_rating.rating ? '#fbbf24' : '#475569'}
                          style={{ marginRight: 2 }}
                        />
                      ))}
                      <Text className="text-emerald-300 font-black text-sm ml-2">{item.user_rating.rating}/5</Text>
                    </View>
                    {/* Review text */}
                    {item.user_rating.review ? (
                      <Text className="text-emerald-100 font-bold text-xs italic leading-4">
                        {item.user_rating.review}
                      </Text>
                    ) : (
                      <Text className="text-emerald-400/60 font-bold text-[10px] italic">No written review</Text>
                    )}
                  </View>
                ) : (
                  <View className="bg-white/5 border border-white/10 rounded-xl py-3.5 flex-row justify-center items-center">
                    <MaterialCommunityIcons name="star-outline" size={16} color="#475569" />
                    <Text className="text-slate-500 font-black text-[10px] uppercase tracking-[2px] ml-2">
                      Awaiting Patient Review
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}
          {/* 🔒 Unverified Store Overlay removed from here */}
        </View>{/* end sensitive section */}

        {/* <View className="flex-row gap-3 mb-6">
          {!isAccepted && !isRejected && !item.is_locked && (
            <TouchableOpacity
              onPress={() => item.last_refresh_requested_at ? onVerifyStock(item.id) : onAddPrice(item)}
              className="flex-[2] bg-slate-900 py-4.5 rounded-[1.25rem] flex-row justify-center items-center shadow-lg shadow-gray-100 active:bg-slate-800"
            >
              <MaterialCommunityIcons name={item.last_refresh_requested_at ? "refresh" : "plus-circle-outline"} size={16} color="#10b981" />
              <Text className="text-white font-bold text-xs ml-2.5 tracking-widest uppercase">
                {item.last_refresh_requested_at ? 'Verify Stock Available' : 'Add Price Quote'}
              </Text>
            </TouchableOpacity>
          )}

          {(isAccepted || item.is_locked) && (
            <>
              <TouchableOpacity
                onPress={() => onStartChat(item)}
                className="w-12 bg-blue-600 py-4.5 rounded-[1.25rem] justify-center items-center shadow-xl shadow-blue-100 active:bg-blue-700"
              >
                <MaterialCommunityIcons name="chat" size={18} color="white" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => canCallPatient && item.user_mobile ? Linking.openURL(`tel:${item.user_mobile}`) : undefined}
                className="w-12 bg-emerald-600 py-4.5 rounded-[1.25rem] justify-center items-center shadow-xl shadow-emerald-100 active:bg-emerald-700"
              >
                <MaterialCommunityIcons name="phone" size={18} color="white" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => onOpenStatus(item)}
                className="w-12 bg-white border border-gray-200 rounded-[1.25rem] justify-center items-center shadow-lg shadow-gray-100 active:bg-gray-50"
              >
                <MaterialCommunityIcons name="bullseye-arrow" size={18} color="#0f172a" />
              </TouchableOpacity>
            </>
          )}
        </View> */}

        {/* 🔒 Capability-driven overlay — covers all sensitive details */}
        <UnavailableOverlay
          capabilities={item.capabilities}
          onPress={() => router.push('/(sellerTabs)/settings')}
        />
      </View>
    </View>
  );
});
PrescriptionCard.displayName = 'PrescriptionCard';

export default function Prescription() {
  const reportOptions = [
    { label: "Patient did not answer", category: "invalid_contact", icon: "phone-off-outline", hint: "Repeated call attempts were unanswered" },
    { label: "Wrong information", category: "wrong_information", icon: "account-alert-outline", hint: "Patient or order details are incorrect" },
    { label: "Invalid phone number", category: "invalid_contact", icon: "phone-alert-outline", hint: "The registered number is not reachable or valid" },
    { label: "Cancelled after confirmation", category: "suspicious_behavior", icon: "calendar-remove-outline", hint: "Patient cancelled after the order was confirmed" },
    { label: "Address / location issue", category: "wrong_information", icon: "map-marker-alert-outline", hint: "Address is incorrect, incomplete, or outside service area" },
    { label: "Suspected fake enquiry", category: "fake_or_spam", icon: "shield-alert-outline", hint: "The request appears suspicious or fraudulent" },
  ];

  const BASE_URL = Constants.expoConfig?.extra?.BASE_URL || '';
  const { user, token } = useSelector((state: RootState) => state.user);
  const dispatch = useDispatch<AppDispatch>();
  const [data, setData] = useState<ResponseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [nextPageUrl, setNextPageUrl] = useState<string | null>(null);
  const [isLastPage, setIsLastPage] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageItem, setSelectedImageItem] = useState<ResponseItem | null>(null);
  const [showManualReviewInfo, setShowManualReviewInfo] = useState(false);
  const [showAiInfoModal, setShowAiInfoModal] = useState<{ type: 'mismatch' | 'rx' | 'medicine' | 'unknown'; score?: number } | null>(null);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [currentItem, setCurrentItem] = useState<ResponseItem | null>(null);
  const [deliveryMapItem, setDeliveryMapItem] = useState<ResponseItem | null>(null);
  const [prescriptionDetail, setPrescriptionDetail] = useState<any>(null);
  const [medicines, setMedicines] = useState<{ medicine_name: string; price: string; is_available: boolean; medicine_brand: string; medicine_type: string }[]>([
    { medicine_name: '', price: '', is_available: true, medicine_brand: '', medicine_type: 'brand' },
  ]);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<string>('all');
  const { section: sectionParam } = useLocalSearchParams<{ section?: string }>();
  const [activeSection, setActiveSection] = useState<SellerEnquirySection>('enquiry');
  const [sectionMenuVisible, setSectionMenuVisible] = useState(false);
  const [sortFilterSheetOpen, setSortFilterSheetOpen] = useState(false);
  const isFocused = useIsFocused();

  const activeSectionOption = ENQUIRY_SECTION_OPTIONS.find(option => option.key === activeSection) || ENQUIRY_SECTION_OPTIONS[0];
  const sectionCopy = SELLER_SECTION_COPY[activeSection];
  const sectionTitle = sectionCopy.title;
  const sectionCaption = sectionCopy.caption;
  const sectionFilterLabel = activeSection === 'history' && historyFilter !== 'all'
    ? HISTORY_FILTERS.find(f => f.key === historyFilter)?.label || historyFilter
    : sectionCopy.filterLabel;
  const sheetTitle = activeSection === 'history' ? 'History Filter' : 'Date Scope';
  const sheetSubtitle = activeSection === 'history' ? 'Choose a history view' : 'Choose a date range';

  const initialDateRange = useMemo(() => getTodayDateRange(), []);
  const startDateRef = useRef<Date | null>(initialDateRange.start);
  const endDateRef = useRef<Date | null>(initialDateRange.end);
  const [startDate, setStartDate] = useState<Date | null>(initialDateRange.start);
  const [endDate, setEndDate] = useState<Date | null>(initialDateRange.end);
  const todayDateKey = formatLocalDateParam(new Date());
  const dateRangeLabel = useMemo(() => {
    if (!startDate && !endDate) return 'All Dates';

    if (startDate && endDate) {
      const startKey = formatLocalDateParam(startDate);
      const endKey = formatLocalDateParam(endDate);
      if (startKey === endKey) {
        return startKey === todayDateKey
          ? 'Today'
          : startDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      }

      return `${startDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} - ${endDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`;
    }

    if (startDate) return `From ${startDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`;
    return `Until ${endDate?.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`;
  }, [endDate, startDate, todayDateKey]);
  const selectedSingleDateKey = startDate && endDate && formatLocalDateParam(startDate) === formatLocalDateParam(endDate)
    ? formatLocalDateParam(startDate)
    : null;
  const isTodayDateRange = selectedSingleDateKey === todayDateKey;
  const enquirySectionCounts = useMemo<Record<SellerEnquiryMenuSection, number>>(() => ({
    emergency: data.filter(item => item.status === 'emergency' && !isOrderWorkflowItem(item) && !isQuoteRejected(item) && !isQuoteExpired(item)).length,
    enquiry: filterEnquiryItems(data).length,
    verification: data.filter(isVerificationSectionItem).length,
    quote: data.filter(isSentQuoteSectionItem).length,
    rejected: data.filter(isQuoteRejected).length,
    history: 0,
  }), [data]);
  const getEnquirySectionMetaText = useCallback((section: SellerEnquiryMenuSection) => {
    if (section === 'history') return 'Past records';
    return String(enquirySectionCounts[section]) + ' records';
  }, [enquirySectionCounts]);

  useEffect(() => {
    const requestedSection = Array.isArray(sectionParam) ? sectionParam[0] : sectionParam;
    if (requestedSection === 'emergency') setActiveSection('emergency');
  }, [sectionParam]);

  const selectEnquirySection = useCallback((section: SellerEnquiryMenuSection) => {
    setActiveSection(section);
    setSectionMenuVisible(false);
    if (section === 'emergency') {
      setStartDate(null);
      setEndDate(null);
      startDateRef.current = null;
      endDateRef.current = null;
      setTimeout(() => fetchResponses(1, false, null, null), 0);
    }
  }, []);

  const isDatePresetActive = useCallback((days: number) => {
    if (!startDate || !endDate) return false;
    const presetRange = getDateRangeForDays(days);
    return isSameLocalDate(startDate, presetRange.start) && isSameLocalDate(endDate, presetRange.end);
  }, [endDate, startDate]);

  const resetDateRangeToToday = useCallback(() => {
    const todayRange = getTodayDateRange();
    setStartDate(todayRange.start);
    setEndDate(todayRange.end);
    startDateRef.current = todayRange.start;
    endDateRef.current = todayRange.end;
    return todayRange;
  }, []);

  // Store cancel modal states
  const [storeCancelModalVisible, setStoreCancelModalVisible] = useState(false);
  const [storeCancelType, setStoreCancelType] = useState<'cancel_order' | 'reject_enquiry'>('cancel_order');
  const [storeCancelTargetId, setStoreCancelTargetId] = useState<number | null>(null);
  const [storeCancelReason, setStoreCancelReason] = useState('');
  const [storeCancelLoading, setStoreCancelLoading] = useState(false);
  const [completionOtpModalVisible, setCompletionOtpModalVisible] = useState(false);
  const [completionOtpTargetId, setCompletionOtpTargetId] = useState<number | null>(null);
  const [completionOtpInput, setCompletionOtpInput] = useState('');
  const [completionOtpLoading, setCompletionOtpLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState<{ mode: 'start' | 'end'; visible: boolean }>({
    mode: 'start',
    visible: false,
  });
  const [totalPrice, setTotalPrice] = useState('');
  const [note, setNote] = useState('');
  const [quotationScenario, setQuotationScenario] = useState('exact_brand');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [expandedMedIdx, setExpandedMedIdx] = useState<number | null>(null);

  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [pendingRatingOrder, setPendingRatingOrder] = useState<any>(null);

  useEffect(() => {
    startDateRef.current = startDate;
  }, [startDate]);

  useEffect(() => {
    endDateRef.current = endDate;
  }, [endDate]);
  const handleDateChange = (_event: any, selectedDate?: Date) => {
    setShowDatePicker({ ...showDatePicker, visible: false });
    if (selectedDate) {
      if (showDatePicker.mode === 'start') {
        setStartDate(startOfLocalDay(selectedDate));
      } else {
        setEndDate(endOfLocalDay(selectedDate));
      }
    }
  };
  useEffect(() => {
    if (!token || !user) {
      dispatch(fetchUserProfile());
    }
  }, [dispatch, token, user]);


  // const fetchResponses = useCallback(async (pageNum: number, append = false) => {
  //   if (!token || !userId) return;
  //   try {
  //     append ? setLoadingMore(true) : setLoading(true);
  //     setError(null);

  //     let url = `${BASE_URL}/api/nearby-prescriptions/?page=${pageNum}&page_size=10`;

  //     if (startDateRef.current) {
  //       const formattedStart = startDateRef.current.toISOString().split('T')[0];
  //       console.log("formattedStart--", formattedStart)

  //       url += `&start_date=${formattedStart}`;
  //     }

  //     if (endDateRef.current) {
  //       const formattedEnd = endDateRef.current.toISOString().split('T')[0];
  //       console.log("formattedEnd--", formattedEnd)

  //       url += `&end_date=${formattedEnd}`;
  //     }

  //     const response = await axios.get(url, {
  //       headers: { Authorization: `Bearer ${token}` },
  //     });

  //     const newResults = response.data.results;
  //     setData(prev => (append ? [...prev, ...newResults] : newResults));
  //     setPage(pageNum);
  //     setNextPageUrl(response.data.next);
  //     setIsLastPage(response.data.page >= response.data.total_pages);
  //   } catch (err) {
  //     console.error('Error fetching responses:', err);
  //     setError('Failed to load data');
  //   } finally {
  //     append ? setLoadingMore(false) : setLoading(false);
  //   }
  // }, [BASE_URL, token, userId]);
  const fetchResponses = useCallback(async (pageNum: number, append = false, overrideStart?: Date | null, overrideEnd?: Date | null, silent = false) => {
    if (!token || !user) return;

    if (!silent) {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);
    }

    try {
      let url = `${BASE_URL}/api/nearby-prescriptions/?page=${pageNum}&page_size=10`;

      // Use overrides if provided, otherwise fallback to refs
      const finalStart = overrideStart !== undefined ? overrideStart : startDateRef.current;
      const finalEnd = overrideEnd !== undefined ? overrideEnd : endDateRef.current;

      if (finalStart) {
        const formattedStart = formatLocalDateParam(finalStart);
        url += `&start_date=${formattedStart}`;
      }

      if (finalEnd) {
        const formattedEnd = formatLocalDateParam(finalEnd);
        url += `&end_date=${formattedEnd}`;
      }

      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const newResults = response.data?.results ?? [];
      // ✅ Append or reset data
      setData(prev => (append ? [...prev, ...newResults] : newResults));
      setPage(pageNum);
      setNextPageUrl(response.data?.next || null);
      setIsLastPage(response.data?.page >= response.data?.total_pages);

    } catch (err: any) {
      if (append && err.response?.status === 404) {
        setIsLastPage(true);
        return;
      }

      const errorMessage = err.response?.data?.error || 'Failed to load data. Please check your connection.';
      if (!silent) {
        setError(errorMessage);
        Toast.show({
          type: 'error',
          text1: 'Sync Failed',
          text2: errorMessage,
          position: 'bottom',
        });
      }
    } finally {
      if (!silent) {
        if (append) {
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
      }
    }
  }, [BASE_URL, token, user]);

  const hasPendingAiAnalysis = useMemo(
    () => data.some((item) => {
      const status = item.prescription_ai_status || item.ai_status;
      return status === 'pending' || status === 'processing';
    }),
    [data],
  );

  useEffect(() => {
    if (!hasPendingAiAnalysis) return;

    const refreshTimer = setInterval(() => {
      fetchResponses(1, false, undefined, undefined, true);
    }, 4000);

    return () => clearInterval(refreshTimer);
  }, [fetchResponses, hasPendingAiAnalysis]);

  const applyDateRange = useCallback((nextStart: Date | null, nextEnd: Date | null) => {
    let finalStart = nextStart ? startOfLocalDay(nextStart) : null;
    let finalEnd = nextEnd ? endOfLocalDay(nextEnd) : null;

    if (finalStart && finalEnd && finalStart.getTime() > finalEnd.getTime()) {
      const swappedStart = startOfLocalDay(finalEnd);
      const swappedEnd = endOfLocalDay(finalStart);
      finalStart = swappedStart;
      finalEnd = swappedEnd;
    }

    setStartDate(finalStart);
    setEndDate(finalEnd);
    startDateRef.current = finalStart;
    endDateRef.current = finalEnd;
    setPage(1);
    setFilterSheetVisible(false);
    fetchResponses(1, false, finalStart, finalEnd);
  }, [fetchResponses]);

  const dateJumpBadges = useMemo(() => {
    const badgeMap = new Map<string, { key: string; count: number; pendingCount: number; timestamp: number }>();

    const ensureBadge = (dateKey: string) => {
      if (!badgeMap.has(dateKey)) {
        badgeMap.set(dateKey, { key: dateKey, count: 0, pendingCount: 0, timestamp: getDateFromKey(dateKey).getTime() || 0 });
      }
      return badgeMap.get(dateKey)!;
    };

    data.filter(isSellerMenuCardItem).forEach((item) => {
      const value = item.uploaded_at || item.created_at || item.updated_at || item.accepted_at;
      if (!value) return;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return;

      const badge = ensureBadge(formatLocalDateParam(date));
      const stage = getEnquiryStage(item);
      badge.count += 1;
      if (stage === 'new' || stage === 'waiting' || stage === 'reported') {
        badge.pendingCount += 1;
      }
    });

    ensureBadge(todayDateKey);
    if (selectedSingleDateKey) ensureBadge(selectedSingleDateKey);

    return Array.from(badgeMap.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 12);
  }, [data, selectedSingleDateKey, todayDateKey]);

  const ws = useRef<WebSocket | null>(null);
  const seenEventIds = useRef<Set<string>>(new Set());
  const lastSeqMap = useRef<Map<number, number>>(new Map()); // id -> seq

  useEffect(() => {
    if (!token || !user) return;

    const connectWS = () => {
      const wsUrl = `${BASE_URL.replace(/^http/, 'ws')}/ws/store-orders/?token=${token}`;
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => console.log("🚀 Store WS Connected");
      ws.current.onclose = () => {
        console.log("⚠️ Store WS Disconnected, retrying...");
        setTimeout(connectWS, 3000);
      };

      ws.current.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type !== 'fulfillment_update') return;

          // 🛡️ Elite Reliability: Idempotency
          const eventId = msg.event_id;
          if (eventId) {
            if (seenEventIds.current.has(eventId)) return;
            seenEventIds.current.add(eventId);
            if (seenEventIds.current.size > 500) {
              const iter = seenEventIds.current.values();
              const oldestValue = iter.next().value;
              if (oldestValue !== undefined) {
                seenEventIds.current.delete(oldestValue);
              }
            }
          }

          const action = msg.action;
          const payload = msg.data;

          if (action === 'new_prescription') {
            // Keep the state updater pure. Calling Toast.show() inside the
            // updater can update Toast's ForwardRef while React is rendering
            // this screen, which triggers the red render-cycle warning.
            Toast.show({
              type: 'info',
              text1: '🔔 New Prescription Request',
              text2: 'A new patient order has arrived. Tap to verify.',
              position: 'top',
              visibilityTime: 5000,
            });
            setData(prev => (
              prev.some(item => item.id === payload.id)
                ? prev
                : [payload as ResponseItem, ...prev]
            ));
          } else if (action === 'status_change' || action === 'refresh_request') {
            // Live update for existing order
            const seq = msg.seq;
            const itemId = payload.response_id || payload.id;
            const prescriptionId = payload.prescription_id;

            if (seq) {
              const lastSeq = lastSeqMap.current.get(itemId) || 0;
              if (seq < lastSeq) return;
              lastSeqMap.current.set(itemId, seq);
            }

            setData(prev => prev.map(item => {
              if (
                (item.response_id && item.response_id === itemId) ||
                item.id === itemId ||
                (prescriptionId && item.id === prescriptionId)
              ) {
                // Ensure we don't overwrite the prescription 'id' with the response 'id'
                const { id: payloadId, ...safePayload } = payload;
                return {
                  ...item,
                  ...safePayload,
                  response_id: payloadId || item.response_id,
                  has_responded: true // If we got a status change, they definitely responded
                };
              }
              return item;
            }));
          } else if (action === 'ai_analysis_update') {
            const prescriptionId = payload.prescription_id || payload.id;
            if (!prescriptionId) return;

            setData(prev => prev.map(item => {
              const itemPrescriptionId = item.prescription || item.id;
              if (itemPrescriptionId === prescriptionId) {
                const { id: _payloadId, ...safePayload } = payload;
                return {
                  ...item,
                  ...safePayload,
                };
              }
              return item;
            }));
          } else if (action === 'store_capability_changed') {
            const capabilityUpdate = payload as StoreCapabilityUpdate;
            setData(prev => prev.map(item => (
              isSameStoreCapabilityTarget(item, capabilityUpdate)
                ? mergeStoreCapabilityUpdate(item, capabilityUpdate)
                : item
            )));

            if (capabilityUpdate.capabilities?.status?.code === 'store_unverified') {
              Toast.show({
                type: 'info',
                text1: 'Store Not Verified',
                text2: 'Actions are paused until verification is restored.',
                position: 'bottom',
              });
            }
          } else if (action === 'new_chat_message') {
            console.log("[DEBUG] Store WS received new_chat_message:", payload);
            Toast.show({
              type: 'info',
              text1: `💬 ${payload.sender_name}`,
              text2: payload.text,
              position: 'bottom',
              visibilityTime: 4000
            });
          }
        } catch (err) {
          console.error("Store WS Parse Error:", err);
        }
      };
    };

    connectWS();
    return () => {
      if (ws.current) {
        ws.current.onclose = null;
        ws.current.close();
      }
    };
  }, [token, user, BASE_URL]);


  // useEffect(() => {
  //   if (isFocused && token && userId) {

  //     fetchResponses(1, false);
  //   }
  // }, [isFocused, token, userId]);
  useFocusEffect(
    useCallback(() => {
      if (token && user) {
        const requestedSection = Array.isArray(sectionParam) ? sectionParam[0] : sectionParam;
        setPage(1);
        setFilterSheetVisible(false);
        if (requestedSection === 'emergency') {
          setStartDate(null);
          setEndDate(null);
          startDateRef.current = null;
          endDateRef.current = null;
          setTimeout(() => fetchResponses(1, false, null, null), 100);
        } else {
          const todayRange = resetDateRangeToToday();
          setTimeout(() => fetchResponses(1, false, todayRange.start, todayRange.end), 100);
        }
      } else {
        console.log("⚠️ Token or user missing");
      }
    }, [token, user, fetchResponses, resetDateRangeToToday, sectionParam])
  );

  const hasAiAnalysisInProgress = data.some(item => {
    const aiStatus = item.prescription_ai_status || item.ai_status;
    return Boolean(item.image)
      && (aiStatus === 'pending' || aiStatus === 'processing')
      && isAiAnalysisFresh(item.uploaded_at);
  });

  useEffect(() => {
    if (!isFocused || !token || !user || !hasAiAnalysisInProgress) return;

    const timer = setInterval(() => {
      fetchResponses(1, false, undefined, undefined, true);
    }, 5000);

    return () => clearInterval(timer);
  }, [isFocused, token, user, hasAiAnalysisInProgress, fetchResponses]);

  const checkPendingRatings = async () => {
    if (!token) return;
    try {
      const response = await axios.get(`${BASE_URL}/api/ratings/pending/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.data.results && response.data.results.length > 0) {
        setPendingRatingOrder(response.data.results[0]);
        setRatingModalVisible(true);
      }
    } catch (error) {
      console.log("Pending rating check for store failed:", error);
    }
  };

  useEffect(() => {
    if (isFocused && token) {
      const timer = setTimeout(checkPendingRatings, 2000);
      return () => clearTimeout(timer);
    }
  }, [isFocused, token]);

  const fetchPrescriptionDetails = async (id: number) => {

    try {
      const url = `${BASE_URL}/api/prescription/${id}/`;
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPrescriptionDetail(response.data);
    } catch (error) {
      console.error("Error fetching prescription detail:", error);
      Toast.show({
        type: 'error',
        text1: 'Load Failed',
        text2: 'Could not fetch prescription details.',
        position: 'bottom'
      });
    }
  };

  const handleAddPrice = (item: ResponseItem) => {
    if (!canAddPriceQuote(item)) {
      Toast.show({
        type: 'info',
        text1: 'Quote Already Sent',
        text2: 'This enquiry already has a quote.',
        position: 'bottom',
      });
      return;
    }

    setCurrentItem(item);
    const prefillName = getRequestMedicineName(item);
    setMedicines([{ medicine_name: prefillName, price: '', is_available: true, medicine_brand: '', medicine_type: 'brand' }]);
    setShowPriceModal(true);
    fetchPrescriptionDetails(item.id); // Fetch details
    fetchDeliveryPreview(item.id);
  };
  const [showItemsModal, setShowItemsModal] = useState(false);
  const [quoteSubmitting, setQuoteSubmitting] = useState(false);
  const [deliveryPreview, setDeliveryPreview] = useState<DeliveryOffer | null>(null);
  const [deliveryPreviewLoading, setDeliveryPreviewLoading] = useState(false);
  const [quoteHomeDelivery, setQuoteHomeDelivery] = useState(false);
  const [quoteDeliveryCharge, setQuoteDeliveryCharge] = useState('');
  const [quoteDeliveryEta, setQuoteDeliveryEta] = useState('');
  const [quoteDeliveryMessage, setQuoteDeliveryMessage] = useState('');
  const [quoteDeliveryReason, setQuoteDeliveryReason] = useState('');

  const fetchDeliveryPreview = async (prescriptionId: number) => {
    try {
      setDeliveryPreviewLoading(true);
      const response = await axios.get(`${BASE_URL}/api/prescriptions/${prescriptionId}/delivery-preview/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const preview = response.data as DeliveryOffer;
      setDeliveryPreview(preview);
      setQuoteHomeDelivery(Boolean(preview.home_delivery_available));
      setQuoteDeliveryCharge(String(preview.delivery_charge ?? '0'));
      setQuoteDeliveryEta(preview.estimated_delivery_minutes ? String(preview.estimated_delivery_minutes) : '');
      setQuoteDeliveryMessage(preview.delivery_message || '');
      setQuoteDeliveryReason(preview.unavailable_reason || '');
    } catch (error: any) {
      setDeliveryPreview(null);
      setQuoteHomeDelivery(false);
      setQuoteDeliveryReason(error?.response?.data?.error || 'Home delivery availability could not be calculated.');
    } finally {
      setDeliveryPreviewLoading(false);
    }
  };



  const handleSubmit = async () => {
    if (quoteSubmitting) return;

    if (!totalPrice) {
      Toast.show({
        type: 'error',
        text1: 'Input Required',
        text2: 'Please enter the total price.',
        position: 'bottom'
      });
      return;
    }

    const prescription = prescriptionDetail?.prescription;

    if (!prescription?.user_id || !prescription?.id) {
      Toast.show({
        type: 'error',
        text1: 'Logic Error',
        text2: 'Missing user or prescription information.',
        position: 'bottom'
      });
      return;
    }


    const formData = new FormData();
    formData.append('response_text', note || '');
    formData.append('total_amount', totalPrice.toString());
    formData.append('prescription_id', prescription.id.toString());
    formData.append('quotation_scenario', quotationScenario);
    formData.append('delivery_offer', JSON.stringify({
      home_delivery_available: quoteHomeDelivery,
      delivery_charge: quoteHomeDelivery ? quoteDeliveryCharge : '0',
      estimated_delivery_minutes: quoteHomeDelivery ? quoteDeliveryEta : null,
      delivery_message: quoteDeliveryMessage,
      unavailable_reason: quoteHomeDelivery ? '' : quoteDeliveryReason,
    }));

    // Safety Hub: Double check that at least one item is available before submission
    const availableCount = medicines.filter(m => m.is_available).length;
    if (availableCount === 0) {
      Toast.show({
        type: 'error',
        text1: 'Zero Availability',
        text2: 'At least one medicine must be available to send a quote.',
        position: 'bottom'
      });
      return;
    }

    formData.append('medicines', JSON.stringify(medicines));


    for (const [key, value] of formData.entries()) {
      console.log(`${key}:`, value);
    }

    try {
      setQuoteSubmitting(true);

      const url = `${BASE_URL}/api/user/${prescription.user_id}/send-response/`;
      const response = await axios.post(url, formData, {
        headers: {
          'Content-Type': 'multipart/form-data', // ✅ This is needed for axios, not fetch
          Authorization: `Bearer ${token}`,
        },
      });

      const submittedQuote = response.data?.response;
      const submittedResponseId = submittedQuote?.id;
      setData(prev => prev.map(item => {
        const itemPrescriptionId = item.prescription || item.id;
        if (item.id !== prescription.id && itemPrescriptionId !== prescription.id) return item;

        return {
          ...item,
          has_responded: true,
          response_id: submittedResponseId || item.response_id,
          total_amount: Number(submittedQuote?.total_amount ?? totalPrice),
          quotation_scenario: submittedQuote?.quotation_scenario ?? quotationScenario,
        };
      }));

      Toast.show({
        type: 'success',
        text1: 'Quote Transmitted!',
        text2: 'Your pricing has been sent to the patient.',
        position: 'bottom',
        visibilityTime: 3000,
      });

      setShowPriceModal(false);
      setTotalPrice('');
      setNote('');
      setQuotationScenario('exact_brand');
      setMedicines([{ medicine_name: '', price: '', is_available: true, medicine_brand: '', medicine_type: 'brand' }]);
      setDeliveryPreview(null);
      setQuoteHomeDelivery(false);
      setQuoteDeliveryCharge('');
      setQuoteDeliveryEta('');
      setQuoteDeliveryMessage('');
      setQuoteDeliveryReason('');

      setCurrentItem(null);
      setPrescriptionDetail(null);
      setActiveSection('quote');
      // console.log("response--", response)
      // const data = await res.json();

      // if (res.ok) {
      //   alert("Response submitted successfully!");
      //   setShowPriceModal(false);
      //   setTotalPrice('');
      //   setNote('');
      //   setMedicines([{ name: '', price: '' }]);
      //   fetchResponses(1, false); // reload list
      // } else {
      //   console.error(data);
      //   alert(data?.detail || 'Failed to submit response.');
      // }

    } catch (error: any) {
      const backendMessage =
        error?.response?.data?.error ||
        error?.response?.data?.detail ||
        'Something went wrong. Please try again later.';
      console.error('Quote submission failed:', error?.response?.data || error);
      Toast.show({
        type: 'error',
        text1: 'Submission Failed',
        text2: backendMessage,
        position: 'bottom'
      });
    } finally {
      setQuoteSubmitting(false);
    }
  };

  const handleStartChat = (item: ResponseItem) => {
    // Lazy Navigation: Navigate to id '0' and pass context
    router.push({
      pathname: '/chat/[id]',
      params: {
        id: item.chat_thread_id?.toString() || '0',
        user_id: item.user_id,
        prescription_id: item.id,
        prescription_image: item.image, // Pass image for immediate context
        storeName: item.user_name || 'Patient'
      }
    } as any);
  };

  const handleVerifyStock = async (id: number) => {
    try {
      setLoading(true);
      await axios.post(`${BASE_URL}/api/responses/${id}/verify-stock/`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      Toast.show({
        type: 'success',
        text1: 'Stock Verified!',
        text2: 'The patient has been notified that your offer is valid.',
        position: 'bottom'
      });
      await fetchResponses(1, false); // ← await so list refreshes instantly
    } catch (error) {
      console.error("verify stock error:", error);
      Toast.show({
        type: 'error',
        text1: 'Verification Failed',
        text2: 'Could not update stock status. Please try again.',
        position: 'bottom'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStoreUpdateProgress = async (id: number, action: string) => {
    try {
      setLoading(true);
      const response = await axios.post(`${BASE_URL}/api/responses/${id}/progress/`, { action }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (action === 'mark_completed' && response.data?.otp_required) {
        setCompletionOtpTargetId(response.data.response_id || id);
        setCompletionOtpInput('');
        setCompletionOtpModalVisible(true);
        Toast.show({
          type: 'success',
          text1: 'OTP Sent',
          text2: 'Ask the customer for the completion OTP.',
          position: 'bottom'
        });
        await fetchResponses(1, false);
        return;
      }
      Toast.show({
        type: 'success',
        text1: 'Progress Updated',
        text2: 'Order status has been updated successfully.',
        position: 'bottom'
      });
      await fetchResponses(1, false);
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Could not update progress.';
      Toast.show({
        type: 'error',
        text1: 'Update Failed',
        text2: msg,
        position: 'bottom'
      });
    } finally {
      setLoading(false);
    }
  };

  const verifyCompletionOtp = async () => {
    if (!completionOtpTargetId || completionOtpInput.trim().length < 4) {
      Toast.show({ type: 'error', text1: 'Enter OTP', text2: 'Ask the customer for the OTP shown in their app.', position: 'bottom' });
      return;
    }
    try {
      setCompletionOtpLoading(true);
      await axios.post(
        `${BASE_URL}/api/responses/${completionOtpTargetId}/completion-otp/verify/`,
        { otp: completionOtpInput.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Toast.show({
        type: 'success',
        text1: 'Order Completed',
        text2: 'Customer OTP verified successfully.',
        position: 'bottom'
      });
      setCompletionOtpModalVisible(false);
      setCompletionOtpTargetId(null);
      setCompletionOtpInput('');
      await fetchResponses(1, false);
    } catch (error: any) {
      const msg = error.response?.data?.error || 'OTP verification failed.';
      Toast.show({ type: 'error', text1: 'Invalid OTP', text2: msg, position: 'bottom' });
    } finally {
      setCompletionOtpLoading(false);
    }
  };

  const executeStoreCancel = async () => {
    if (!storeCancelTargetId) return;
    if (!storeCancelReason.trim()) {
      Toast.show({ type: 'error', text1: 'Reason Required', text2: 'Please provide a reason to cancel.', position: 'bottom' });
      return;
    }

    try {
      setStoreCancelLoading(true);
      let endpoint = `${BASE_URL}/api/responses/${storeCancelTargetId}/store-cancel/`;
      if (storeCancelType === 'reject_enquiry') {
        endpoint = `${BASE_URL}/api/prescriptions/${storeCancelTargetId}/store-reject/`;
      }
      
      await axios.post(endpoint,
        { reason: storeCancelReason.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStoreCancelModalVisible(false);
      Toast.show({ type: 'success', text1: 'Order Cancelled', text2: 'You have cancelled the order.', position: 'bottom' });
      await fetchResponses(1, false);
    } catch (error: any) {
      const msg = error.response?.data?.error || 'Could not cancel order.';
      Toast.show({ type: 'error', text1: 'Cannot Cancel', text2: msg, position: 'bottom' });
    } finally {
      setStoreCancelLoading(false);
    }
  };

  const handleStoreCancel = (item: ResponseItem, type: 'cancel_order' | 'reject_enquiry' = 'cancel_order') => {
    setStoreCancelTargetId(item.id);
    setStoreCancelReason('');
    setStoreCancelType(type);
    setStoreCancelModalVisible(true);
  };

  useEffect(() => {
    console.log("startDate--", startDate);
  }, [startDate]);

  useEffect(() => {
    console.log("endDate--", endDate?.toISOString());
  }, [endDate]);




  const [modalReportVisible, setReportModalVisible] = useState(false);
  const [selectedReportReason, setSelectedReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [currentReportItem, setCurrentReportItem] = useState<ResponseItem | null>(null);
  const [SelectedReportId, setSelectedReportId] = useState<number | null>(null);

  const submitReport = async () => {
    const trimmedReason = selectedReportReason.trim();
    const trimmedDetails = reportDetails.trim();
    if (!SelectedReportId || (!trimmedReason && !trimmedDetails)) {
      Toast.show({
        type: 'error',
        text1: 'Report Required',
        text2: 'Please select or enter a report before submitting.',
        position: 'bottom'
      });
      return;
    }

    try {
      setReportSubmitting(true);
      const note = [
        trimmedReason ? `Reason: ${trimmedReason}` : '',
        trimmedDetails ? `Details: ${trimmedDetails}` : '',
      ].filter(Boolean).join('\n');
      const selectedOption = reportOptions.find((option) => option.label === trimmedReason);
      const payload = {
        reference_id: SelectedReportId,
        category: selectedOption?.category || 'other',
        description: note,
      };
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        }
      };
      await axios.post(`${BASE_URL}/api/safety-reports/`, payload, config);


      Toast.show({
        type: 'success',
        text1: 'Report Submitted',
        text2: 'Your report has been submitted for review.',
        position: 'bottom',
      });
      // Optionally clear note or close modal
      setSelectedReportReason("");
      setReportDetails("");
      fetchResponses(1, false);

      setReportModalVisible(false);
    } catch (error: any) {
      console.error("Error submitting report:", error.response?.status, error.response?.data || error.message);
      const apiMessage = error.response?.data?.detail
        || error.response?.data?.error
        || Object.values(error.response?.data || {}).flat().join(' ');
      Toast.show({
        type: 'error',
        text1: 'Report Failed',
        text2: apiMessage || 'Could not submit report. Please try again.',
        position: 'bottom'
      });
    } finally {
      setReportSubmitting(false);
    }
  };
  const [storeReports, setStoreReports] = useState<{ id: number; description: string; status: string; status_display: string; created_at: string }[]>([]);
  const [storeReportCount, setStoreReportCount] = useState(0);

  const fetchStoreReports = async (responseId: number) => {
    try {
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      };
      const res = await axios.get(`${BASE_URL}/api/safety-reports/?reference_id=${responseId}`, config);
      setStoreReports(res.data.reports || []);
      setStoreReportCount(res.data.count || 0);
    } catch (err) {
      console.error("Failed to fetch store reports", err);
      setStoreReports([]);
      setStoreReportCount(0);
    }
  };

  const openImageViewer = useCallback((item: ResponseItem, url: string) => {
    setSelectedImage(url);
    setSelectedImageItem(item);
  }, []);

  const renderItem = useCallback(({ item }: { item: ResponseItem }) => (
    <PrescriptionCard
      item={item}
      BASE_URL={BASE_URL}
      onImagePress={openImageViewer}
      onAddPrice={handleAddPrice}
      onStartChat={handleStartChat}
      onVerifyStock={handleVerifyStock}
      onStoreUpdateProgress={handleStoreUpdateProgress}
      onStoreCancel={handleStoreCancel}
      onManualReviewInfo={() => setShowManualReviewInfo(true)}
      onAiInfo={(type, score) => setShowAiInfoModal({ type, score })}
      onOpenMap={setDeliveryMapItem}
      onOpenStatus={(item) => {
        setReportModalVisible(true);
        setSelectedReportId(item.id);
        setCurrentReportItem(item);
        setSelectedReportReason("");
        setReportDetails("");
        fetchStoreReports(item.id);
      }}
    />
  ), [BASE_URL, handleAddPrice, handleStartChat, openImageViewer]);

  const currentPatientReportText = currentReportItem?.user_report_note || currentReportItem?.user_contact_note;
  const currentPatientReportCount = currentReportItem?.user_report_count || (currentPatientReportText ? 1 : 0);
  const currentRequestMedicineName = getRequestMedicineName(currentItem);
  const currentRequestDescription = getRequestDescription(currentItem);
  const currentImageUrl = buildMediaUrl(BASE_URL, currentItem?.image);
  const currentAddressLabel = currentItem?.user_address || 'Address not available';
  const currentDistanceLabel = currentItem?.distance_km ? `${currentItem.distance_km}` : 'NEARBY';
  const quoteSheetMaxHeight = SCREEN_HEIGHT * (SCREEN_HEIGHT < 700 ? 0.94 : 0.88);
  const quoteSheetScrollMaxHeight = Math.max(220, quoteSheetMaxHeight - (SCREEN_HEIGHT < 700 ? 214 : 236));
  const itemSheetMaxHeight = SCREEN_HEIGHT * (SCREEN_HEIGHT < 700 ? 0.94 : 0.88);
  const itemSheetScrollMaxHeight = Math.max(240, itemSheetMaxHeight - (SCREEN_HEIGHT < 700 ? 120 : 136));
  const hasCurrentRequestText = Boolean(currentRequestMedicineName || currentRequestDescription);

  return (
    <>


      <View className="flex-1 bg-[#fbfcfd]">
        <View className="px-4 pt-2 pb-1">
          <View className="overflow-hidden rounded-[1.45rem] shadow-sm shadow-slate-300">
            <LinearGradient colors={['#123b59', '#0d8a63']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} className="relative min-h-[150px] overflow-hidden px-4 py-4">

              {/* Background Image — absolutely positioned, right side */}
              <View className="absolute -right-14 -bottom-8 h-[190px] w-[286px] items-center justify-center">
                <Image
                  source={require('../../assets/images/enquirybg.png')}
                  className="h-full w-full"
                  resizeMode="contain"
                />
              </View>

              {/* Refresh Button — top right */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => fetchResponses(1, false)}
                className="absolute top-4 right-4 z-20 h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10"
              >
                <MaterialCommunityIcons name="refresh" size={24} color="#FFFFFF" />
              </TouchableOpacity>

              <View className="min-h-[118px] justify-center">
                <View className="z-10 w-[54%] min-w-0">
                  <View className="flex-row items-center">
                    <Text className="text-[31px] font-black text-white tracking-[2px] leading-9" numberOfLines={1}>{sectionTitle}</Text>
                    <View className="mx-3 h-9 w-px rounded-full bg-emerald-300/80" />
                    {/* <View className="min-w-0 flex-1">
                      <Text className="text-[12px] font-black uppercase tracking-[1.6px] text-emerald-300 leading-4" numberOfLines={1}>{sectionSubTitle.split(' ')[0]}</Text>
                      <Text className="text-[12px] font-black uppercase tracking-[1.2px] text-white leading-4" numberOfLines={1}>{sectionSubTitle.split(' ')[1] || ''}</Text>
                    </View> */}
                  </View>
                  <Text className="mt-1.5 text-[10px] font-black uppercase tracking-[2px] text-white/45" numberOfLines={1}>{sectionCaption}</Text>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    className="mt-3"
                    contentContainerStyle={{ gap: 8, paddingRight: 6 }}
                  >
                    <TouchableOpacity
                      activeOpacity={0.84}
                      onPress={() => setSortFilterSheetOpen(true)}
                      className="h-10 flex-row items-center rounded-full bg-white px-3 shadow-sm shadow-slate-950/10"
                    >
                      <MaterialCommunityIcons
                        name={(activeSection === 'history' ? 'history' : activeSectionOption.icon) as any}
                        size={16}
                        color={activeSectionOption.color}
                      />
                      <Text
                        className="ml-2 text-[10px] font-black uppercase tracking-[1px]"
                        style={{ color: activeSectionOption.color }}
                        numberOfLines={1}
                      >
                        {sectionFilterLabel}
                      </Text>
                      <View style={{ backgroundColor: activeSectionOption.bg }} className="ml-2 flex-row items-center rounded-full px-2 py-0.5">
                        <MaterialCommunityIcons name="calendar-range" size={10} color={activeSectionOption.color} />
                        <Text
                          className="ml-1 text-[8px] font-black uppercase tracking-[0.6px]"
                          style={{ color: activeSectionOption.color }}
                          numberOfLines={1}
                        >
                          {dateRangeLabel}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              </View>
            </LinearGradient>
          </View>
        </View>

        <View className="px-4 pt-2 pb-1" style={{ zIndex: 50, elevation: 10 }}>
          <View className="flex-row items-center gap-3">
            <TouchableOpacity
              activeOpacity={0.86}
              onPress={() => setSectionMenuVisible(true)}
              className="flex-1 flex-row items-center rounded-[1.1rem] border border-slate-200 bg-white px-4 py-3 shadow-sm shadow-slate-200/60"
            >
              <View style={{ backgroundColor: activeSectionOption.bg }} className="h-10 w-10 items-center justify-center rounded-xl">
                <MaterialCommunityIcons name={activeSectionOption.icon as any} size={20} color={activeSectionOption.color} />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-[13px] font-black text-slate-950" numberOfLines={1}>{activeSectionOption.label}</Text>
                <Text className="mt-0.5 text-[8px] font-black uppercase tracking-[0.8px] text-slate-400" numberOfLines={1}>
                  {getEnquirySectionMetaText(activeSectionOption.key)}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-down" size={20} color="#64748b" />
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.86}
              onPress={() => setSectionMenuVisible(true)}
              className="h-[48px] w-[48px] items-center justify-center rounded-[1rem] border border-slate-200 bg-white shadow-sm shadow-slate-200/60"
            >
              <MaterialCommunityIcons name="menu" size={24} color={activeSectionOption.color} />
            </TouchableOpacity>
          </View>
        </View>

        <Modal visible={sectionMenuVisible} transparent animationType="fade" onRequestClose={() => setSectionMenuVisible(false)}>
          <View className="flex-1">
            <TouchableOpacity activeOpacity={1} onPress={() => setSectionMenuVisible(false)} className="absolute inset-0 bg-black/5" />
            <View className="absolute right-4 top-[224px] w-[236px] overflow-hidden rounded-[1.15rem] border border-slate-200 bg-white shadow-xl shadow-slate-300/50">
              <View className="border-b border-slate-100 px-4 py-3">
                <Text className="text-[10px] font-black uppercase tracking-[1.4px] text-slate-400">Enquiry Tab</Text>
              </View>
              {ENQUIRY_SECTION_OPTIONS.map((option) => {
                const selected = activeSection === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    activeOpacity={0.86}
                    onPress={() => selectEnquirySection(option.key)}
                    style={{ backgroundColor: selected ? option.bg : '#ffffff' }}
                    className="flex-row items-center border-b border-slate-100 px-4 py-3.5"
                  >
                    <View style={{ backgroundColor: option.bg }} className="h-9 w-9 items-center justify-center rounded-xl">
                      <MaterialCommunityIcons name={option.icon as any} size={19} color={option.color} />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-[12px] font-black text-slate-950" numberOfLines={1}>{option.label}</Text>
                      <Text className="mt-0.5 text-[8px] font-black uppercase tracking-[0.8px] text-slate-400" numberOfLines={1}>
                        {getEnquirySectionMetaText(option.key)}
                      </Text>
                    </View>
                    {selected && <MaterialCommunityIcons name="check-circle" size={18} color={option.color} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Modal>

        {/* ===== History Filter Row (removed as per request) ===== */}

        {/* ===== Cancel Order Modal (Store) ===== */}
        <Modal animationType="fade" transparent visible={storeCancelModalVisible}>
          <View className="flex-1 bg-gray-950/70 justify-center px-6">
            <View className="bg-white rounded-[2.5rem] p-8 shadow-2xl">
              <View className="items-center mb-6">
                <View className="w-14 h-14 bg-red-50 rounded-[1.5rem] items-center justify-center mb-4">
                  <MaterialCommunityIcons name="close-circle-outline" size={28} color="#ef4444" />
                </View>
                <Text className="text-xl font-black text-gray-900 tracking-tighter">Cancel Order?</Text>
                <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                  Reason is strictly mandatory
                </Text>
              </View>

              <View className="mb-6">
                <Text className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">
                  Cancellation Reason
                </Text>
                <TextInput
                  value={storeCancelReason}
                  onChangeText={setStoreCancelReason}
                  placeholder="e.g. Out of stock, Not serving this area..."
                  placeholderTextColor="#94a3b8"
                  className="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-gray-900 text-sm font-medium"
                  multiline
                  numberOfLines={3}
                  style={{ textAlignVertical: 'top' }}
                />
              </View>

              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={() => setStoreCancelModalVisible(false)}
                  className="flex-1 py-4 bg-gray-100 rounded-[1.25rem] items-center"
                >
                  <Text className="text-gray-700 font-bold text-xs uppercase tracking-widest">Keep Order</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={executeStoreCancel}
                  disabled={storeCancelLoading}
                  className="flex-1 py-4 bg-red-500 rounded-[1.25rem] items-center"
                >
                  {storeCancelLoading
                    ? <ActivityIndicator size="small" color="white" />
                    : <Text className="text-white font-bold text-xs uppercase tracking-widest">Confirm Cancel</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={showPriceModal} transparent animationType="slide">
          <View className="flex-1 bg-gray-950/60 justify-end">
            <BlurView intensity={25} tint="dark" className="absolute inset-0" />
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              className="bg-white rounded-t-[2.25rem] shadow-2xl overflow-hidden"
              style={{ maxHeight: quoteSheetMaxHeight }}
            >
              <View className="items-center pt-2 pb-1"><View className="w-12 h-1 bg-slate-200 rounded-full" /></View>
              <View className="px-4 pb-2.5 border-b border-slate-100">
                <View className="flex-row items-center justify-between gap-3">
                  <View className="flex-1 pr-2">
                    <View className="flex-row items-center mb-1">
                      <View className="h-5 w-5 rounded-full bg-emerald-50 border border-emerald-100 items-center justify-center mr-2">
                        <MaterialCommunityIcons name="currency-inr" size={11} color="#059669" />
                      </View>
                      <Text className="text-[8px] font-black text-emerald-600 uppercase tracking-[1.5px]">Direct Patient Response</Text>
                    </View>
                    <Text className="text-[21px] leading-6 font-black text-slate-950 uppercase" numberOfLines={1}>Send Price Quote</Text>
                    <View className="mt-1 flex-row items-center">
                      <MaterialCommunityIcons name="map-marker-distance" size={11} color="#64748b" />
                      <Text className="ml-1 text-[8px] font-black uppercase tracking-[1.2px] text-slate-400" numberOfLines={1}>Quote sheet | {currentDistanceLabel}</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => setShowPriceModal(false)} className="h-9 w-9 bg-slate-100 border border-slate-200 items-center justify-center rounded-xl">
                    <MaterialCommunityIcons name="close" size={18} color="#1e293b" />
                  </TouchableOpacity>
                </View>
              </View>

              <View className="px-4 pt-2.5 pb-2 border-b border-slate-100 bg-white">
                <View className="rounded-[1.15rem] border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <View className="mb-1 flex-row items-center justify-between gap-2">
                    <View className="flex-row items-center">
                      <MaterialCommunityIcons name="account-outline" size={12} color="#059669" />
                      <Text className="ml-1.5 text-[8px] font-black uppercase tracking-[1.5px] text-emerald-700">Patient Details</Text>
                    </View>
                    <View className="flex-row items-center rounded-full bg-white px-2 py-0.5 border border-slate-200">
                      <MaterialCommunityIcons name="map-marker-distance" size={10} color="#0f766e" />
                      <Text className="ml-1 text-[7.5px] font-black uppercase tracking-[1px] text-teal-700">{currentDistanceLabel}</Text>
                    </View>
                  </View>

                  <Text className="text-[15px] leading-5 font-black text-slate-950" numberOfLines={1}>
                    {currentItem?.user_name || 'Patient'}
                  </Text>

                  <TouchableOpacity onPress={() => currentItem && setDeliveryMapItem(currentItem)} activeOpacity={0.75} className="mt-1.5 flex-row items-start rounded-xl border border-emerald-100 bg-white px-2.5 py-2">
                    <MaterialCommunityIcons name="map-marker-radius-outline" size={12} color="#059669" style={{ marginTop: 1 }} />
                    <Text className="ml-2 flex-1 text-[9px] leading-4 font-semibold text-slate-600" numberOfLines={2}>
                      {currentAddressLabel}
                    </Text>
                    <View className="ml-2 flex-row items-center self-center">
                      <Text className="text-[7px] font-black uppercase tracking-[1px] text-emerald-700">Map</Text>
                      <MaterialCommunityIcons name="chevron-right" size={13} color="#047857" />
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              <ScrollView
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                showsVerticalScrollIndicator
                className="px-4 pt-2.5"
                style={{ maxHeight: quoteSheetScrollMaxHeight }}
                contentContainerStyle={{ paddingBottom: 104 }}
              >
                {/* 1. Request Reference */}
                <View className="mb-2.5 bg-slate-50 p-2.5 rounded-[1.15rem] border border-slate-100 shadow-sm">
                  <View className="flex-row items-center mb-2.5 justify-between">
                    <View className="flex-row items-center">
                      <MaterialCommunityIcons name={currentImageUrl ? "file-document-outline" : "pill"} size={14} color="#059669" />
                      <Text className="text-[8px] font-black text-emerald-600 uppercase tracking-[2px] ml-2">
                        {currentImageUrl ? 'Prescription Reference' : 'Medicine Reference'}
                      </Text>
                    </View>
                    {currentImageUrl ? (
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedImage(currentImageUrl);
                          setSelectedImageItem(null);
                        }}
                        className="bg-emerald-100 px-2.5 py-1 rounded-full flex-row items-center"
                      >
                        <MaterialCommunityIcons name="magnify-plus-outline" size={11} color="#059669" />
                        <Text className="text-[7.5px] font-black text-emerald-700 uppercase tracking-wider ml-1">Zoom</Text>
                      </TouchableOpacity>
                    ) : (
                      <View className="bg-white px-2.5 py-1 rounded-full flex-row items-center border border-slate-200">
                        <MaterialCommunityIcons name="text-box-check-outline" size={11} color="#64748b" />
                        <Text className="text-[7.5px] font-black text-slate-500 uppercase tracking-wider ml-1">Text Request</Text>
                      </View>
                    )}
                  </View>

                  {currentImageUrl ? (
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedImage(currentImageUrl);
                        setSelectedImageItem(null);
                      }}
                      className="w-full h-[180px] bg-slate-200 rounded-3xl border border-slate-200 shadow-sm overflow-hidden relative"
                    >
                      <RemoteImageWithStatus uri={currentImageUrl} loadingLabel="Loading prescription" />
                      <BlurView intensity={30} tint="dark" className="absolute bottom-0 left-0 right-0 py-2 items-center">
                        <Text className="text-white text-[10px] font-bold uppercase tracking-widest">Tap to view full image</Text>
                      </BlurView>
                    </TouchableOpacity>
                  ) : hasCurrentRequestText ? (
                    <View className="bg-white rounded-[1.25rem] border border-slate-200 p-3 shadow-sm">
                      <View className="flex-row items-center">
                        <View className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 items-center justify-center mr-3">
                          <MaterialCommunityIcons name="pill" size={20} color="#059669" />
                        </View>
                        <View className="flex-1">
                          <Text className="text-[7.5px] font-black text-emerald-600 uppercase tracking-[1.5px] mb-0.5">Medicine Name</Text>
                          <Text className="text-slate-950 font-black text-[14px] uppercase tracking-wide leading-5" numberOfLines={2}>
                            {currentRequestMedicineName || 'Medicine name not provided'}
                          </Text>
                        </View>
                      </View>
                      {currentRequestDescription ? (
                        <View className="mt-2 pt-2 border-t border-slate-100">
                          <Text className="text-[7.5px] font-black text-slate-400 uppercase tracking-[1.5px] mb-1">Patient Note</Text>
                          <Text className="text-slate-700 font-bold text-[10px] leading-4">
                            {currentRequestDescription}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : (
                    <View className="h-[120px] items-center justify-center bg-white rounded-[1.25rem] border border-slate-200">
                      <MaterialCommunityIcons name="image-off-outline" size={30} color="#cbd5e1" />
                      <Text className="text-slate-400 text-[9px] font-bold mt-2 uppercase">No prescription image</Text>
                    </View>
                  )}
                </View>

                {/* 2. Total Price Input */}
                <LinearGradient
                  colors={['#0f172a', '#064e3b']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  className="px-4 py-3 rounded-[1.35rem] mb-3 relative overflow-hidden shadow-lg shadow-slate-300"
                >
                  <Text className="text-[8px] font-black text-emerald-400 uppercase tracking-[2px] mb-1 z-10">
                    Total Amount (INR)
                  </Text>
                  <View className="flex-row items-center z-10">
                    <Text className="text-emerald-500 text-xl font-bold mr-2">₹</Text>
                    <TextInput
                      value={totalPrice}
                      onChangeText={setTotalPrice}
                      placeholder="0.00"
                      placeholderTextColor="#475569"
                      keyboardType="numeric"
                      className="text-white text-3xl font-black tracking-tighter flex-1 py-0.5"
                    />
                  </View>
                </LinearGradient>

                {/* 3. Advanced Toggle */}
                <TouchableOpacity
                  onPress={() => setShowAdvanced(!showAdvanced)}
                  className="mb-3 flex-row justify-center items-center py-3 bg-slate-50 rounded-[1rem] border border-slate-200"
                >
                  <MaterialCommunityIcons name={showAdvanced ? "chevron-up" : "chevron-down"} size={16} color="#475569" />
                  <Text className="text-slate-600 font-bold text-[9px] ml-2 tracking-[1.5px] uppercase">
                    {showAdvanced ? "Hide Advanced Details" : "Show Advanced Details (Optional)"}
                  </Text>
                </TouchableOpacity>

                {/* 4. Advanced Details Section */}
                {showAdvanced && (
                  <View className="bg-white rounded-[1.35rem] p-3.5 border border-slate-100 shadow-sm mb-4">
                    <View className="mb-3">
                      <View className="flex-row items-center mb-2">
                        <View className="w-1 h-3.5 bg-emerald-500 rounded-full mr-2" />
                        <Text className="text-[8px] font-black text-slate-700 uppercase tracking-[1.5px]">Availability Scenario</Text>
                      </View>
                      <View className="flex-row flex-wrap justify-between">
                        {[
                          { id: 'exact_brand', label: 'Brands', sub: 'Exact', icon: 'check-decagram' },
                          { id: 'all_generic', label: 'Generic', sub: 'Low cost', icon: 'flask-outline' },
                          { id: 'mixed', label: 'Mixed', sub: 'B + G', icon: 'layers-outline' },
                          { id: 'substitutes', label: 'Subs', sub: 'Alt', icon: 'swap-horizontal' },
                          { id: 'partial', label: 'Partial', sub: 'Some', icon: 'alert-circle-outline' },
                        ].map((scenario, scenarioIndex) => {
                          const isSelected = quotationScenario === scenario.id;
                          return (
                            <TouchableOpacity
                              key={scenario.id}
                              onPress={() => setQuotationScenario(scenario.id)}
                              style={{ width: '32%', height: 34, marginBottom: scenarioIndex < 3 ? 8 : 0 }}
                              className={`px-1.5 rounded-lg border flex-row items-center justify-center ${isSelected
                                ? 'bg-slate-900 border-slate-900'
                                : 'bg-slate-50 border-slate-200'
                                }`}
                            >
                              <View className="flex-row items-center justify-center">
                                <View
                                  className={`w-[18px] h-[18px] rounded-full items-center justify-center mr-1 ${isSelected ? 'bg-emerald-500/20' : 'bg-slate-200'
                                    }`}
                                >
                                  <MaterialCommunityIcons
                                    name={scenario.icon as any}
                                    size={10}
                                    color={isSelected ? '#34d399' : '#94a3b8'}
                                  />
                                </View>

                                <Text
                                  className={`text-center font-black text-[8.5px] tracking-tight ${isSelected ? 'text-white' : 'text-slate-800'
                                    }`}
                                  numberOfLines={1}
                                >
                                  {scenario.label}
                                </Text>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                        <View style={{ width: '32%', height: 34 }} />
                      </View>
                    </View>

                    <TouchableOpacity
                      onPress={() => setShowItemsModal(true)}
                      className="mb-4 bg-slate-50 border border-slate-200 py-3 rounded-[1rem] flex-row justify-center items-center active:bg-slate-100"
                    >
                      <MaterialCommunityIcons name="format-list-bulleted" size={15} color="#059669" />
                      <Text className="text-slate-700 font-bold text-[9px] ml-2 tracking-[1.5px] uppercase">Itemized Inventory Details</Text>
                      {medicines.length > 1 && (
                        <View className="ml-2 bg-emerald-100 px-2 py-0.5 rounded-full">
                          <Text className="text-emerald-700 text-[9px] font-black">{medicines.length}</Text>
                        </View>
                      )}
                    </TouchableOpacity>

                    <View className="mb-4 rounded-[1rem] border border-blue-100 bg-blue-50 p-3">
                      <View className="mb-2 flex-row items-center justify-between">
                        <View className="flex-1 pr-3">
                          <Text className="text-[8px] font-black uppercase tracking-[1.5px] text-blue-700">Fulfillment offer</Text>
                          <Text className="mt-1 text-[10px] font-bold text-slate-600">
                            {deliveryPreviewLoading
                              ? 'Checking customer distance and store settings...'
                              : deliveryPreview?.distance_km
                                ? `Approx. ${deliveryPreview.distance_km} km from store`
                                : 'Pickup remains available when delivery cannot be calculated.'}
                          </Text>
                        </View>
                        {deliveryPreviewLoading ? (
                          <ActivityIndicator size="small" color="#2563eb" />
                        ) : (
                          <TouchableOpacity
                            disabled={!deliveryPreview?.home_delivery_available}
                            onPress={() => setQuoteHomeDelivery(value => !value)}
                            className={`rounded-full px-3 py-2 ${quoteHomeDelivery ? 'bg-emerald-600' : 'bg-slate-300'}`}
                          >
                            <Text className="text-[8px] font-black uppercase text-white">
                              {quoteHomeDelivery ? 'Delivery On' : 'Delivery Off'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {quoteHomeDelivery ? (
                        <>
                          <View className="mb-2 flex-row gap-2">
                            <View className="flex-1 rounded-xl border border-blue-100 bg-white px-3 py-2">
                              <Text className="text-[7px] font-black uppercase text-slate-400">Charge ₹</Text>
                              <TextInput value={quoteDeliveryCharge} onChangeText={setQuoteDeliveryCharge} keyboardType="decimal-pad" className="mt-1 font-black text-slate-900" />
                            </View>
                            <View className="flex-1 rounded-xl border border-blue-100 bg-white px-3 py-2">
                              <Text className="text-[7px] font-black uppercase text-slate-400">ETA minutes</Text>
                              <TextInput value={quoteDeliveryEta} onChangeText={setQuoteDeliveryEta} keyboardType="number-pad" className="mt-1 font-black text-slate-900" />
                            </View>
                          </View>
                          <TextInput
                            value={quoteDeliveryMessage}
                            onChangeText={setQuoteDeliveryMessage}
                            placeholder="Customer delivery message"
                            placeholderTextColor="#94a3b8"
                            multiline
                            className="min-h-[52px] rounded-xl border border-blue-100 bg-white p-3 text-[10px] font-bold text-slate-800"
                          />
                        </>
                      ) : (
                        <TextInput
                          value={quoteDeliveryReason}
                          onChangeText={setQuoteDeliveryReason}
                          placeholder="Reason, e.g. delivery person unavailable"
                          placeholderTextColor="#94a3b8"
                          multiline
                          className="min-h-[52px] rounded-xl border border-blue-100 bg-white p-3 text-[10px] font-bold text-slate-800"
                        />
                      )}
                    </View>

                    <View className="bg-gray-50 p-3 rounded-[1rem] border border-gray-100">
                      <View className="flex-row items-center mb-2">
                        <MaterialCommunityIcons name="chat-outline" size={13} color="#475569" />
                        <Text className="text-[8px] font-bold text-gray-500 uppercase tracking-[2px] ml-2">Internal Notes</Text>
                      </View>
                      <TextInput
                        value={note}
                        onChangeText={setNote}
                        placeholder="e.g. Price negotiable, 1hr delivery..."
                        placeholderTextColor="#94a3b8"
                        multiline
                        numberOfLines={3}
                        className="text-gray-900 font-bold text-[11px] leading-4 min-h-[48px]"
                        textAlignVertical="top"
                      />
                    </View>
                  </View>
                )}
              </ScrollView>

              <View className="absolute bottom-0 left-0 right-0 px-4 pt-3 pb-4 bg-white/95 border-t border-slate-100 flex-row gap-3 shadow-2xl shadow-slate-300">
                <TouchableOpacity onPress={() => setShowPriceModal(false)} className="w-[82px] h-12 bg-slate-50 border border-slate-200 rounded-[1rem] items-center justify-center">
                  <Text className="text-gray-500 font-bold text-[9px] uppercase tracking-wider">Abort</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={quoteSubmitting}
                  onPress={() => {
                    const availableCount = medicines.filter(m => m.is_available).length;
                    if (availableCount === 0) {
                      Toast.show({
                        type: 'error',
                        text1: 'Selection Required',
                        text2: 'Mark at least one medicine as available in Advanced Details.',
                        position: 'bottom'
                      });
                      return;
                    }
                    if (!totalPrice) {
                      Toast.show({
                        type: 'error',
                        text1: 'Price Required',
                        text2: 'Please enter the total amount.',
                        position: 'bottom'
                      });
                      return;
                    }
                    handleSubmit();
                  }}
                  className={`flex-1 h-12 rounded-[1rem] items-center justify-center shadow-xl shadow-slate-300 flex-row ${quoteSubmitting ? 'bg-slate-500' : 'bg-slate-900 active:bg-slate-800'}`}
                >
                  {quoteSubmitting ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="send-check-outline" size={16} color="#34d399" />
                      <Text className="text-emerald-400 font-black text-[10px] uppercase tracking-[1.5px] ml-2">Send Quote Now</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>

        {activeSection === 'history' ? (
          <SellerHistoryScreen
            hideHeader
            onOpenFilterSheet={() => setSortFilterSheetOpen(true)}
            statusFilter={historyFilter}
            onStatusFilterChange={(key) => setHistoryFilter(key)}
            dateStart={startDate}
            dateEnd={endDate}
          />
        ) : activeSection === 'rejected' ? (
          <FlatList
            data={getSellerSectionItems(data, 'rejected')}
            keyExtractor={(item, index) => `rej-${item.id}-${index}`}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 150 }}
            showsVerticalScrollIndicator={false}
            onEndReached={() => !loadingMore && !isLastPage && fetchResponses(page + 1, true)}
            onEndReachedThreshold={0.5}
            ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color={activeSectionOption.color} className="py-12" /> : <View className="h-12" />}
            ListEmptyComponent={!loading ? (
              <View className="mt-40 items-center px-10">
                <MaterialCommunityIcons name={sectionCopy.emptyIcon as any} size={64} color="#e2e8f0" />
                <Text className="text-gray-400 font-extrabold text-[11px] uppercase tracking-[4px] mt-8 text-center px-4">{sectionCopy.emptyTitle}</Text>
                <Text className="text-gray-300 font-bold text-[9px] uppercase tracking-[2px] mt-2 text-center px-10">{sectionCopy.emptySubtitle}</Text>
              </View>
            ) : null}
            renderItem={({ item }) => {
              const imageUrl = buildMediaUrl(BASE_URL, item.image);
              const rejectedAt = new Date(item.updated_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
              const isUserRejected = item.cancelled_by === 'user' || !item.cancelled_by;
              return (
                <View className="bg-white mb-3 rounded-[1.15rem] border border-red-100 shadow-sm overflow-hidden mx-1">
                  <View className="bg-red-600 px-4 py-2.5 flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1 pr-3">
                      <View className="w-8 h-8 rounded-xl bg-red-50/20 items-center justify-center">
                        <MaterialCommunityIcons name="close-circle-outline" size={16} color="white" />
                      </View>
                      <View className="ml-2.5 flex-1">
                        <Text className="text-white font-black text-[9px] uppercase tracking-[1.5px]">
                          {isUserRejected ? 'Rejected by User' : 'Rejected by Store'}
                        </Text>
                        <Text className="text-red-200 font-bold text-[7px] uppercase tracking-[1px] mt-0.5">Declined Offer</Text>
                      </View>
                    </View>
                    <Text className="text-red-200 font-bold text-[7px] uppercase tracking-widest">{rejectedAt}</Text>
                  </View>

                  <View className="p-4">
                    <View className="flex-row items-center mb-3">
                      <View className="w-14 h-14 rounded-[1rem] bg-slate-50 border border-slate-200 items-center justify-center overflow-hidden">
                        {imageUrl ? (
                          <Image source={{ uri: imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                        ) : (
                          <MaterialCommunityIcons name="file-image-outline" size={22} color="#94a3b8" />
                        )}
                      </View>
                      <View className="ml-3 flex-1">
                        <Text className="text-slate-900 font-black text-[17px] tracking-tight" numberOfLines={1}>{item.user_name || 'Patient'}</Text>
                        <View className="flex-row items-center mt-1 flex-wrap gap-1">
                          {item.total_amount > 0 && (
                            <View className="bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                              <Text className="text-emerald-700 text-[8.5px] font-black uppercase">₹{item.total_amount}</Text>
                            </View>
                          )}
                          <View className="bg-slate-100 px-2 py-0.5 rounded-full flex-row items-center">
                            <MaterialCommunityIcons name="map-marker-radius-outline" size={9} color="#64748b" />
                            <Text className="text-slate-600 text-[8px] font-black uppercase ml-1">{item.distance_km || 'Nearby'}</Text>
                          </View>
                        </View>
                      </View>
                    </View>

                    {item.cancel_reason ? (
                      <View className="bg-red-50 border border-red-100 rounded-xl p-3">
                        <Text className="text-red-700 text-[7.5px] font-black uppercase tracking-[2px] mb-1">
                          {isUserRejected ? 'Patient Reason' : 'Store Reason'}
                        </Text>
                        <Text className="text-red-900 font-medium text-[11px] italic leading-4">{"'"}{item.cancel_reason}{"'"}</Text>
                      </View>
                    ) : (
                      <View className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex-row items-center">
                        <MaterialCommunityIcons name="information-outline" size={13} color="#94a3b8" />
                        <Text className="text-slate-400 text-[9px] font-bold ml-1.5 uppercase tracking-wider">No reason provided</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            }}
          />
        ) : (
          <FlatList
            data={getSellerSectionItems(data, activeSection)}
            renderItem={renderItem}
            keyExtractor={(item, index) => `${activeSection}-${item.id}-${index}`}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 150 }}
            showsVerticalScrollIndicator={false}
            onEndReached={() => !loadingMore && !isLastPage && fetchResponses(page + 1, true)}
            onEndReachedThreshold={0.5}
            initialNumToRender={5}
            maxToRenderPerBatch={5}
            windowSize={11}
            removeClippedSubviews={Platform.OS === 'android'}
            ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color={activeSectionOption.color} className="py-12" /> : <View className="h-12" />}
            ListEmptyComponent={!loading ? (
              <View className="mt-40 items-center px-10">
                {error ? (
                  <>
                    <View className="w-24 h-24 bg-red-50 rounded-[3rem] items-center justify-center mb-6 border border-red-100">
                      <MaterialCommunityIcons name="alert-circle-outline" size={40} color="#ef4444" />
                    </View>
                    <Text className="text-slate-900 font-black text-xl tracking-tighter mb-2 uppercase">Sync Failed</Text>
                    <Text className="text-red-500 font-bold text-xs text-center leading-5 px-6 mb-6">{error}</Text>
                    <TouchableOpacity
                      onPress={() => fetchResponses(1, false)}
                      className="bg-slate-900 px-8 py-4 rounded-2xl shadow-xl active:bg-slate-800"
                    >
                      <Text className="text-white font-black text-[10px] uppercase tracking-[3px]">Retry Sync</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <MaterialCommunityIcons name={sectionCopy.emptyIcon as any} size={64} color="#e2e8f0" />
                    <Text className="text-gray-400 font-extrabold text-[11px] uppercase tracking-[4px] mt-8 text-center px-4">{sectionCopy.emptyTitle}</Text>
                    <Text className="text-gray-300 font-bold text-[9px] uppercase tracking-[2px] mt-2 text-center px-10">{sectionCopy.emptySubtitle}</Text>
                  </>
                )}
              </View>
            ) : null}
          />
        )}

        {/* <FlatList
          data={data}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 16 }}
          onEndReached={() => !loadingMore && !isLastPage && fetchResponses(page + 1, true)}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <View className="py-4 items-center">
                <ActivityIndicator size="small" color="#10B981" />
                <Text className="text-sm mt-1">Loading more...</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            !loading ? (
              <View className="mt-8 items-center">
                <Text className="text-gray-600 text-sm">No prescriptions found.</Text>
              </View>
            ) : null
          }
        // ListFooterComponent={loadingMore ? <ActivityIndicator color="#10B981" /> : null}
        // ListEmptyComponent={!loading ? <Text className="text-center mt-10">No prescriptions found.</Text> : null}
        /> */}

        <Modal transparent visible={modalReportVisible} animationType="slide" onRequestClose={() => setReportModalVisible(false)}>
          <View className="flex-1 justify-end bg-slate-950/60">
            <BlurView intensity={22} tint="dark" className="absolute inset-0" />
            <Pressable className="absolute inset-0" onPress={() => setReportModalVisible(false)} />
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              className="w-full"
            >
              <View
                className="bg-white rounded-t-[2rem] shadow-2xl overflow-hidden border-t border-slate-100"
                style={{ height: SCREEN_HEIGHT * 0.75 }}
              >
                <LinearGradient
                  colors={['#020617', '#0f172a', '#064e3b']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <View className="items-center pt-3 pb-2">
                    <View className="w-12 h-1.5 rounded-full bg-white/20" />
                  </View>

                  <View className="px-5 pt-3 pb-5 flex-row items-start justify-between">
                    <View className="flex-1 pr-4">
                      <Text className="text-white text-xl font-black uppercase tracking-tight">Report Enquiry</Text>
                      <Text className="text-emerald-300 text-[9px] font-black uppercase tracking-[2px] mt-1">
                        Patient / order issue
                      </Text>
                      <View className="flex-row items-center mt-4">
                        <View className="w-9 h-9 rounded-2xl bg-white/10 border border-white/10 items-center justify-center mr-3">
                          <MaterialCommunityIcons name="account-alert-outline" size={18} color="#a7f3d0" />
                        </View>
                        <View className="flex-1">
                          <Text className="text-white font-black text-sm" numberOfLines={1}>{currentReportItem?.user_name || 'Patient'}</Text>
                          <Text className="text-slate-300 font-bold text-[10px] mt-0.5" numberOfLines={1}>
                            Order #{currentReportItem?.response_id || currentReportItem?.id || SelectedReportId} • {currentReportItem?.user_status || 'enquiry'}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => setReportModalVisible(false)}
                      className="w-10 h-10 rounded-2xl bg-white/10 border border-white/10 items-center justify-center active:bg-white/20"
                    >
                      <MaterialCommunityIcons name="close" size={20} color="white" />
                    </TouchableOpacity>
                  </View>
                </LinearGradient>

                <ScrollView
                  className="flex-1"
                  contentContainerStyle={{ padding: 18, paddingBottom: 18 }}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  {currentPatientReportText && (
                    <View className="mb-5 bg-amber-50 rounded-[1.25rem] border border-amber-100 p-4">
                      <View className="flex-row items-center mb-2">
                        <MaterialCommunityIcons name="account-voice" size={15} color="#d97706" />
                        <Text className="text-amber-700 font-black text-[8px] uppercase tracking-[2px] ml-2">
                          Patient Report {currentPatientReportCount}
                        </Text>
                      </View>
                      <Text className="text-amber-950 font-bold text-[12px] leading-5">{currentPatientReportText}</Text>
                    </View>
                  )}

                  {storeReportCount > 0 && (
                    <View className="mb-5 bg-slate-50 rounded-[1.25rem] border border-slate-100 overflow-hidden">
                      <View className="px-4 py-3 border-b border-slate-100 flex-row items-center justify-between">
                        <Text className="text-slate-500 font-black text-[8px] uppercase tracking-[2px]">Submitted Reports</Text>
                        <Text className="text-emerald-700 font-black text-[10px]">{storeReportCount}</Text>
                      </View>
                      <ScrollView style={{ maxHeight: Math.min(150, SCREEN_HEIGHT * 0.18) }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                        {storeReports.map((note, index) => (
                          <View key={`${note.created_at}-${index}`} className="px-4 py-3 border-b border-slate-100/80">
                            <Text className="text-slate-900 font-bold text-[12px] leading-5">{note.description}</Text>
                            <View className="flex-row items-center justify-between mt-1"><Text className="text-slate-400 font-black text-[8px] uppercase tracking-widest">{note.created_at}</Text><Text className="text-emerald-700 font-black text-[8px] uppercase">{note.status_display}</Text></View>
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  <Text className="text-slate-400 font-black text-[9px] uppercase tracking-[2.5px] mb-3">Report Reason</Text>
                  <View className="flex-row flex-wrap gap-2 mb-5">
                    {reportOptions.map((option) => {
                      const selected = selectedReportReason === option.label;
                      return (
                        <TouchableOpacity
                          key={option.label}
                          onPress={() => setSelectedReportReason(option.label)}
                          className={`px-3.5 py-3 rounded-2xl border ${selected ? 'bg-slate-950 border-slate-950' : 'bg-slate-50 border-slate-100'}`}
                          style={{ maxWidth: SCREEN_WIDTH < 380 ? '100%' : '48%' }}
                        >
                          <Text className={`font-black text-[10px] uppercase leading-4 ${selected ? 'text-emerald-300' : 'text-slate-500'}`} numberOfLines={2}>
                            {option.label}
                          </Text>
                          <Text className="text-slate-400 text-[9px] leading-3.5 mt-1" numberOfLines={2}>{option.hint}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <View className="bg-slate-50 rounded-[1.25rem] border border-slate-100 p-4 mb-4">
                    <View className="flex-row items-center mb-3">
                      <MaterialCommunityIcons name="text-box-outline" size={15} color="#64748b" />
                      <Text className="text-slate-400 font-black text-[8px] uppercase tracking-[2px] ml-2">Additional Details</Text>
                    </View>
                    <TextInput
                      placeholder="Add call attempts, patient response, address issue, or other context..."
                      placeholderTextColor="#94a3b8"
                      className="text-slate-950 font-bold text-[13px] leading-5"
                      style={{ minHeight: SCREEN_HEIGHT < 700 ? 86 : 116 }}
                      multiline
                      value={reportDetails}
                      onChangeText={setReportDetails}
                      textAlignVertical="top"
                    />
                  </View>
                </ScrollView>

                <View className="px-5 pt-3 pb-5 bg-white border-t border-slate-100">
                  <TouchableOpacity
                    onPress={submitReport}
                    disabled={reportSubmitting || (!selectedReportReason.trim() && !reportDetails.trim())}
                    className={`py-4 rounded-[1.35rem] items-center justify-center flex-row shadow-xl ${reportSubmitting || (!selectedReportReason.trim() && !reportDetails.trim()) ? 'bg-slate-300 shadow-transparent' : 'bg-emerald-600 shadow-emerald-200 active:bg-emerald-700'}`}
                  >
                    {reportSubmitting ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <MaterialCommunityIcons name="send-check-outline" size={18} color="white" />
                    )}
                    <Text className="text-white font-black uppercase text-[11px] tracking-[3px] ml-2">
                      {reportSubmitting ? 'Submitting' : 'Submit Report'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>

        {/* Nested Modal: Add Medicines */}
        <Modal visible={showItemsModal} transparent animationType="slide">
          <View className="flex-1 bg-gray-950/60 justify-end">
            <BlurView intensity={25} tint="dark" className="absolute inset-0" />
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              className="bg-white rounded-t-[2.25rem] shadow-2xl overflow-hidden"
              style={{ maxHeight: itemSheetMaxHeight }}
            >
              <View className="items-center pt-2 pb-1"><View className="w-12 h-1 bg-gray-100 rounded-full" /></View>
              <View className="px-4 pb-3 flex-row justify-between items-center border-b border-gray-100">
                <View>
                  <Text className="text-[21px] leading-6 font-black text-gray-900 tracking-tighter uppercase">Inventory Build</Text>
                  <Text className="text-[8px] font-bold text-emerald-600 uppercase tracking-[2px] mt-0.5">Itemized Pricing Table</Text>
                </View>
                <TouchableOpacity onPress={() => setShowItemsModal(false)} className="h-9 w-9 bg-gray-100 rounded-xl items-center justify-center"><MaterialCommunityIcons name="close" size={18} color="#1e293b" /></TouchableOpacity>
              </View>

              <ScrollView
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                showsVerticalScrollIndicator
                className="px-4 pt-3"
                style={{ maxHeight: itemSheetScrollMaxHeight }}
                contentContainerStyle={{ paddingBottom: 104 }}
              >
                {/* Request Reference */}
                {currentImageUrl ? (
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedImage(currentImageUrl);
                      setSelectedImageItem(null);
                    }}
                    className="mb-5 w-full h-[140px] bg-slate-200 rounded-3xl border border-slate-200 shadow-sm overflow-hidden relative"
                  >
                    <RemoteImageWithStatus uri={currentImageUrl} loadingLabel="Loading prescription" />
                    <BlurView intensity={30} tint="dark" className="absolute bottom-0 left-0 right-0 py-1.5 items-center">
                      <Text className="text-white text-[9px] font-bold uppercase tracking-widest">Tap to view full prescription</Text>
                    </BlurView>
                  </TouchableOpacity>
                ) : hasCurrentRequestText ? (
                  <View className="mb-3 bg-white rounded-[1.35rem] border border-slate-200 p-3 shadow-sm flex-row items-center">
                    <View className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 items-center justify-center mr-3">
                      <MaterialCommunityIcons name="pill" size={20} color="#059669" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[7.5px] font-black text-emerald-600 uppercase tracking-[1.5px] mb-0.5">Medicine Name</Text>
                      <Text className="text-slate-950 font-black text-[13px] uppercase tracking-wide leading-5" numberOfLines={2}>
                        {currentRequestMedicineName || 'Medicine name not provided'}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View className="mb-3 w-full h-[110px] bg-white rounded-[1.35rem] border border-slate-200 shadow-sm items-center justify-center">
                    <MaterialCommunityIcons name="image-off-outline" size={30} color="#cbd5e1" />
                    <Text className="text-slate-400 text-[9px] font-bold mt-2 uppercase tracking-widest">No reference image</Text>
                  </View>
                )}

                {/* Medicine Cards */}
                <View className="gap-2">
                  {medicines.map((med, idx) => {
                    const isExpanded = expandedMedIdx === idx;
                    return (
                      <View key={idx} className={`rounded-[1rem] border overflow-hidden ${med.is_available ? 'border-emerald-100 bg-white' : 'border-red-100 bg-red-50/30'}`}>
                        {/* Row 1: Name + Stock Toggle + Delete */}
                        <View className="flex-row items-center px-3 pt-3 pb-2 gap-2">
                          <View className="w-7 h-7 rounded-full bg-emerald-50 border border-emerald-100 items-center justify-center">
                            <MaterialCommunityIcons name="pill" size={14} color="#059669" />
                          </View>
                          <TextInput
                            value={med.medicine_name}
                            onChangeText={(text) => {
                              const newMed = [...medicines];
                              newMed[idx].medicine_name = text;
                              setMedicines(newMed);
                            }}
                            placeholder="Medicine name..."
                            placeholderTextColor="#94a3b8"
                            className="flex-1 text-slate-900 font-black text-[13px]"
                          />
                          <TouchableOpacity
                            onPress={() => {
                              const newMed = [...medicines];
                              newMed[idx].is_available = !newMed[idx].is_available;
                              setMedicines(newMed);
                            }}
                            className={`px-2.5 py-1 rounded-full ${med.is_available ? 'bg-emerald-500' : 'bg-red-400'}`}
                          >
                            <Text className="text-white text-[8px] font-black uppercase">{med.is_available ? '✓ In Stock' : '✗ Out'}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => { setMedicines(medicines.filter((_, i) => i !== idx)); }}
                            className="p-1"
                          >
                            <MaterialCommunityIcons name="trash-can-outline" size={15} color="#94a3b8" />
                          </TouchableOpacity>
                        </View>

                        {/* Row 2: Type Selector */}
                        <View className="flex-row mx-3 mb-2 rounded-lg overflow-hidden border border-slate-100">
                          {['brand', 'generic', 'substitute'].map((type) => (
                            <TouchableOpacity
                              key={type}
                              onPress={() => {
                                const newMed = [...medicines];
                                newMed[idx].medicine_type = type;
                                setMedicines(newMed);
                              }}
                              className={`flex-1 py-1.5 items-center ${med.medicine_type === type ? 'bg-slate-900' : 'bg-slate-50'}`}
                            >
                              <Text className={`font-black text-[8px] uppercase tracking-wider ${med.medicine_type === type ? 'text-emerald-400' : 'text-slate-400'}`}>{type}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>

                        {/* Row 3: Expand Toggle (Optional Details) */}
                        <TouchableOpacity
                          onPress={() => setExpandedMedIdx(isExpanded ? null : idx)}
                          className="flex-row items-center justify-center py-1.5 mx-3 mb-2.5 bg-slate-50 rounded-lg border border-slate-100"
                        >
                          <MaterialCommunityIcons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={13} color="#94a3b8" />
                          <Text className="text-slate-400 text-[8px] font-bold uppercase tracking-wider ml-1">
                            {isExpanded ? 'Hide optional details' : 'Add company & price (optional)'}
                          </Text>
                        </TouchableOpacity>

                        {/* Expanded: Company + Price */}
                        {isExpanded && (
                          <View className="px-3 pb-3 gap-2">
                            <View>
                              <Text className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wider mb-1">Company / Brand</Text>
                              <TextInput
                                value={med.medicine_brand}
                                onChangeText={(text) => {
                                  const newMed = [...medicines];
                                  newMed[idx].medicine_brand = text;
                                  setMedicines(newMed);
                                }}
                                placeholder="e.g. Sun Pharma, GSK..."
                                placeholderTextColor="#cbd5e1"
                                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-slate-900 font-bold text-[13px]"
                              />
                            </View>
                            <View>
                              <Text className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wider mb-1">Price per strip (₹)</Text>
                              <TextInput
                                value={med.price}
                                onChangeText={(text) => {
                                  const newMed = [...medicines];
                                  newMed[idx].price = text;
                                  setMedicines(newMed);
                                }}
                                placeholder="0.00"
                                placeholderTextColor="#cbd5e1"
                                keyboardType="numeric"
                                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-slate-900 font-black text-[13px]"
                              />
                            </View>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>

                <TouchableOpacity
                  onPress={() => setMedicines([...medicines, { medicine_name: '', price: '', is_available: true, medicine_brand: '', medicine_type: 'brand' }])}
                  className="mt-3 py-3 border-2 border-dashed border-emerald-500/30 rounded-[1rem] items-center justify-center bg-emerald-50/30 active:bg-emerald-50"
                >
                  <View className="flex-row items-center">
                    <MaterialCommunityIcons name="plus-circle" size={18} color="#059669" />
                    <Text className="text-emerald-700 font-black text-[10px] ml-2 uppercase tracking-[1.5px]">Append New Line Item</Text>
                  </View>
                </TouchableOpacity>
              </ScrollView>

              <View className="absolute bottom-0 left-0 right-0 px-4 pt-3 pb-4 bg-white/95 border-t border-gray-100 flex-row gap-3">
                <TouchableOpacity onPress={() => setShowItemsModal(false)} className="flex-1 h-12 bg-gray-50 rounded-[1rem] items-center justify-center">
                  <Text className="text-gray-500 font-bold text-[10px] uppercase tracking-wider">Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowItemsModal(false)}
                  className="flex-[2.5] h-12 bg-slate-900 rounded-[1rem] items-center justify-center shadow-xl shadow-slate-300"
                >
                  <Text className="text-emerald-500 font-bold text-[12px] uppercase tracking-[1.5px]">Save Inventory</Text>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>



        {/* AI Info Modal — dynamic content based on AI result */}
        <Modal visible={!!showAiInfoModal} transparent animationType="slide" onRequestClose={() => setShowAiInfoModal(null)}>
          <Pressable className="flex-1 bg-black/50" onPress={() => setShowAiInfoModal(null)}>
            <View className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl overflow-hidden" style={{ paddingBottom: 32 }}>
              {(() => {
                const t = showAiInfoModal?.type;
                const score = showAiInfoModal?.score;
                const confidenceText = score != null ? `${Math.round(score * 100)}% confidence` : null;

                const cfg = {
                  mismatch: {
                    bg: 'bg-amber-50', border: 'border-amber-100', icon: 'alert-circle-outline', iconColor: '#d97706',
                    titleColor: 'text-amber-900', subtitleColor: 'text-amber-600',
                    title: 'AI Warning', subtitle: 'Possible Mismatch Detected',
                    description: 'Patient ne Prescription upload kiya tha, lekin AI ne is image ko Medicine Photo ke roop mein detect kiya hai.',
                    steps: [
                      { icon: 'magnify', color: '#0369a1', bg: '#e0f2fe', title: 'Image manually check karein', desc: 'Card par prescription image tap karein aur khud verify karein.' },
                      { icon: 'phone-check-outline', color: '#059669', bg: '#d1fae5', title: 'Patient se confirm karein', desc: 'Agar doubt ho to patient ko call karein aur prescription ki validity confirm karein.' },
                      { icon: 'truck-delivery-outline', color: '#7c3aed', bg: '#ede9fe', title: 'Valid lage to Home Delivery karein', desc: 'Agar aap satisfy hain to quote add karein aur Home Delivery offer karein.' },
                      { icon: 'flag-outline', color: '#dc2626', bg: '#fee2e2', title: 'Suspicious ho to report karein', desc: 'Galat ya fake prescription ho to Report button press karein.' },
                    ],
                    warning: 'AI ek tool hai — final decision aapka hoga. Sirf verified prescriptions quote karein.',
                    btnBg: 'bg-amber-700', btnText: 'Samajh Gaya',
                  },
                  rx: {
                    bg: 'bg-emerald-50', border: 'border-emerald-100', icon: 'file-check-outline', iconColor: '#059669',
                    titleColor: 'text-emerald-900', subtitleColor: 'text-emerald-600',
                    title: 'Rx Verified', subtitle: 'Prescription Detected',
                    description: 'AI ne is image ko ek valid Prescription document ke roop mein identify kiya hai.',
                    steps: [
                      { icon: 'eye-check-outline', color: '#059669', bg: '#d1fae5', title: 'Image verify karein', desc: 'Prescription image dekh kar confirm karein ki medicines clearly listed hain.' },
                      { icon: 'currency-inr', color: '#0369a1', bg: '#e0f2fe', title: 'Quote add karein', desc: 'Prescription valid hai to "Add Price Quote" button press karein aur medicines ke daam bharo.' },
                      { icon: 'truck-delivery-outline', color: '#7c3aed', bg: '#ede9fe', title: 'Home Delivery offer karein', desc: 'Patient ko Home Delivery ka option provide karein agar available ho.' },
                    ],
                    warning: 'AI verification advisory hai. Always apni professional judgement use karein.',
                    btnBg: 'bg-emerald-700', btnText: 'Samajh Gaya',
                  },
                  medicine: {
                    bg: 'bg-blue-50', border: 'border-blue-100', icon: 'pill', iconColor: '#2563eb',
                    titleColor: 'text-blue-900', subtitleColor: 'text-blue-600',
                    title: 'Medicine Photo', subtitle: 'Medicine Box Detected',
                    description: 'AI ne is image ko ek Medicine Box / Strip photo ke roop mein detect kiya hai, na ki prescription document.',
                    steps: [
                      { icon: 'magnify', color: '#0369a1', bg: '#e0f2fe', title: 'Image manually check karein', desc: 'Confirm karein ki patient ne sahi photo upload ki hai ya galti se medicine photo bhej di.' },
                      { icon: 'phone-check-outline', color: '#059669', bg: '#d1fae5', title: 'Patient se clarify karein', desc: 'Patient ko contact karein — kya unhe prescription needed hai ya sirf ye medicine chahiye.' },
                      { icon: 'flag-outline', color: '#dc2626', bg: '#fee2e2', title: 'Zaroorat ho to report karein', desc: 'Agar request incomplete ya suspicious ho to Report karein.' },
                    ],
                    warning: 'Medicine photo se prescription validity confirm nahi hoti. Manual review zaroori hai.',
                    btnBg: 'bg-blue-700', btnText: 'Samajh Gaya',
                  },
                  unknown: {
                    bg: 'bg-slate-50', border: 'border-slate-100', icon: 'help-circle-outline', iconColor: '#64748b',
                    titleColor: 'text-slate-900', subtitleColor: 'text-slate-500',
                    title: 'AI Classify Nahi Kar Saka', subtitle: 'Low Confidence Result',
                    description: 'AI is image ko confidently classify nahi kar paaya. Ho sakta hai image blur, unclear, ya unusual ho.',
                    steps: [
                      { icon: 'eye-check-outline', color: '#64748b', bg: '#f1f5f9', title: 'Image manually dekhen', desc: 'Khud image open karein aur check karein ki prescription readable hai ya nahi.' },
                      { icon: 'phone-check-outline', color: '#059669', bg: '#d1fae5', title: 'Patient se contact karein', desc: 'Patient ko ek clear prescription photo re-upload karne ko bolein.' },
                      { icon: 'flag-outline', color: '#dc2626', bg: '#fee2e2', title: 'Suspicious ho to report karein', desc: 'Agar request doubtful lage to flag karein.' },
                    ],
                    warning: 'Jab AI confident na ho, manual review hamesha zaroori hai.',
                    btnBg: 'bg-slate-700', btnText: 'Samajh Gaya',
                  },
                }[t ?? 'unknown'];

                return (
                  <>
                    <View className={`${cfg.bg} px-5 pt-5 pb-4 border-b ${cfg.border}`}>
                      <View className="flex-row items-center justify-between mb-2">
                        <View className="flex-row items-center">
                          <View className={`w-9 h-9 rounded-2xl ${cfg.bg} border ${cfg.border} items-center justify-center mr-3`} style={{ borderWidth: 1.5 }}>
                            <MaterialCommunityIcons name={cfg.icon as any} size={20} color={cfg.iconColor} />
                          </View>
                          <View>
                            <Text className={`${cfg.titleColor} font-black text-[15px] uppercase tracking-wide`}>{cfg.title}</Text>
                            <Text className={`${cfg.subtitleColor} font-bold text-[10px] mt-0.5 uppercase tracking-widest`}>{cfg.subtitle}</Text>
                          </View>
                        </View>
                        <Pressable onPress={() => setShowAiInfoModal(null)} className="p-2">
                          <MaterialCommunityIcons name="close-circle" size={22} color="#94a3b8" />
                        </Pressable>
                      </View>
                      <Text className={`${cfg.subtitleColor} text-[11px] font-semibold leading-5`}>{cfg.description}</Text>
                      {confidenceText && (
                        <View className={`mt-2 flex-row items-center self-start px-2.5 py-1 rounded-full border ${cfg.border}`} style={{ backgroundColor: `${cfg.iconColor}15` }}>
                          <MaterialCommunityIcons name="robot-outline" size={10} color={cfg.iconColor} />
                          <Text className={`text-[9px] font-black ml-1 uppercase tracking-widest`} style={{ color: cfg.iconColor }}>{confidenceText}</Text>
                        </View>
                      )}
                    </View>

                    <View className="px-5 pt-4">
                      <Text className="text-slate-500 font-black text-[9px] uppercase tracking-widest mb-3">Aapko kya karna hai</Text>
                      {cfg.steps.map((s, i) => (
                        <View key={i} className="flex-row items-start mb-3.5">
                          <View className="w-7 h-7 rounded-full items-center justify-center mr-3 mt-0.5 shadow-sm" style={{ backgroundColor: s.bg }}>
                            <MaterialCommunityIcons name={s.icon as any} size={14} color={s.color} />
                          </View>
                          <View className="flex-1">
                            <Text className="text-slate-900 font-black text-[12px] leading-tight">{s.title}</Text>
                            <Text className="text-slate-500 font-medium text-[10px] mt-0.5 leading-4">{s.desc}</Text>
                          </View>
                        </View>
                      ))}
                      <View className="mt-1 bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex-row items-start">
                        <MaterialCommunityIcons name="shield-alert-outline" size={16} color="#b45309" />
                        <Text className="text-amber-800 font-bold text-[10px] ml-2 flex-1 leading-5">{cfg.warning}</Text>
                      </View>
                      <Pressable
                        onPress={() => setShowAiInfoModal(null)}
                        className={`mt-4 ${cfg.btnBg} rounded-2xl py-3.5 items-center shadow-lg`}
                      >
                        <Text className="text-white font-black text-[13px] uppercase tracking-wider">{cfg.btnText}</Text>
                      </Pressable>
                    </View>
                  </>
                );
              })()}
            </View>
          </Pressable>
        </Modal>

        {/* Manual Review Info Modal */}
        <Modal visible={showManualReviewInfo} transparent animationType="slide" onRequestClose={() => setShowManualReviewInfo(false)}>
          <Pressable className="flex-1 bg-black/50" onPress={() => setShowManualReviewInfo(false)}>
            <View className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl overflow-hidden" style={{ paddingBottom: 32 }}>
              {/* Header */}
              <View className="bg-orange-50 px-5 pt-5 pb-4 border-b border-orange-100">
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center">
                    <View className="w-9 h-9 rounded-2xl bg-orange-100 border border-orange-200 items-center justify-center mr-3">
                      <MaterialCommunityIcons name="eye-check-outline" size={20} color="#c2410c" />
                    </View>
                    <View>
                      <Text className="text-orange-900 font-black text-[15px] uppercase tracking-wide">Manual Review</Text>
                      <Text className="text-orange-600 font-bold text-[10px] mt-0.5 uppercase tracking-widest">No Image Uploaded</Text>
                    </View>
                  </View>
                  <Pressable onPress={() => setShowManualReviewInfo(false)} className="p-2">
                    <MaterialCommunityIcons name="close-circle" size={22} color="#9a3412" />
                  </Pressable>
                </View>
                <Text className="text-orange-800 text-[11px] font-semibold leading-5">
                  Is patient ne sirf medicine ka naam aur details bheje hain — koi prescription image nahi hai. AI verification is case mein possible nahi hai.
                </Text>
              </View>

              {/* Steps */}
              <View className="px-5 pt-4">
                <Text className="text-slate-500 font-black text-[9px] uppercase tracking-widest mb-3">Aapko kya karna hai</Text>

                {[
                  { icon: 'magnify', color: '#0369a1', bg: '#e0f2fe', step: '1', title: 'Request verify karein', desc: 'Patient ke bheje medicine naam aur quantity carefully padhe aur check karein.' },
                  { icon: 'phone-check-outline', color: '#059669', bg: '#d1fae5', step: '2', title: 'Patient se confirm karein', desc: 'Zaroorat ho to call karein aur prescription validity ya exact requirement confirm karein.' },
                  { icon: 'truck-delivery-outline', color: '#7c3aed', bg: '#ede9fe', step: '3', title: 'Home Delivery offer karein', desc: 'Agar request valid lage to quote add karein aur Home Delivery select karein.' },
                  { icon: 'flag-outline', color: '#dc2626', bg: '#fee2e2', step: '!', title: 'Suspicious lage to report karein', desc: 'Agar request fake ya incomplete lage, neeche Report button use karein.' },
                ].map((s, i) => (
                  <View key={i} className="flex-row items-start mb-3.5">
                    <View className="w-7 h-7 rounded-full items-center justify-center mr-3 mt-0.5 shadow-sm" style={{ backgroundColor: s.bg }}>
                      <MaterialCommunityIcons name={s.icon as any} size={14} color={s.color} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-slate-900 font-black text-[12px] leading-tight">{s.title}</Text>
                      <Text className="text-slate-500 font-medium text-[10px] mt-0.5 leading-4">{s.desc}</Text>
                    </View>
                  </View>
                ))}

                <View className="mt-1 bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex-row items-start">
                  <MaterialCommunityIcons name="shield-alert-outline" size={16} color="#b45309" />
                  <Text className="text-amber-800 font-bold text-[10px] ml-2 flex-1 leading-5">
                    AARX platform pe aap responsible ho is request ki genuineness ke liye. Sirf legitimate requests quote karein.
                  </Text>
                </View>

                <Pressable
                  onPress={() => setShowManualReviewInfo(false)}
                  className="mt-4 bg-orange-700 rounded-2xl py-3.5 items-center shadow-lg shadow-orange-900/30"
                >
                  <Text className="text-white font-black text-[13px] uppercase tracking-wider">Samajh Gaya, Dismiss</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Modal>

        {/* Fullscreen Image Modal */}
        <Modal
          visible={!!selectedImage}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setSelectedImage(null);
            setSelectedImageItem(null);
          }}
        >
          <View className="flex-1 bg-black/90 justify-center items-center">
            <Pressable
              onPress={() => {
                setSelectedImage(null);
                setSelectedImageItem(null);
              }}
              className="absolute top-10 right-10 z-50 p-2"
            >
              <MaterialCommunityIcons name="close" size={30} color="white" />
            </Pressable>
            {selectedImage && (
              <>
                <ScrollView
                  contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}
                  maximumZoomScale={3}
                  minimumZoomScale={1}
                  showsVerticalScrollIndicator={false}
                  showsHorizontalScrollIndicator={false}
                >
                  <View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.8 }}>
                    <RemoteImageWithStatus
                      uri={selectedImage}
                      resizeMode="contain"
                      loadingLabel="Opening secure prescription"
                    />
                  </View>
                </ScrollView>
                <View className="absolute bottom-10 left-8 right-8 gap-4">
                  {selectedImageItem && canAddPriceQuote(selectedImageItem) && (
                    <TouchableOpacity
                      onPress={() => {
                        const quoteItem = selectedImageItem;
                        setSelectedImage(null);
                        setSelectedImageItem(null);
                        handleAddPrice(quoteItem);
                      }}
                      className="bg-emerald-600 py-5 rounded-[2rem] items-center shadow-2xl flex-row justify-center"
                    >
                      <MaterialCommunityIcons name="currency-inr" size={20} color="white" />
                      <Text className="text-white font-black uppercase text-sm tracking-[4px] ml-2">Send Price Quote</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    onPress={() => {
                      setSelectedImage(null);
                      setSelectedImageItem(null);
                    }}
                    className="bg-white/10 border border-white/20 py-4 rounded-[1.75rem] items-center"
                  >
                    <Text className="text-white font-bold uppercase text-[10px] tracking-[5px]">Close Viewer</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </Modal>


        <Modal
          visible={completionOtpModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => !completionOtpLoading && setCompletionOtpModalVisible(false)}
        >
          <View className="flex-1 bg-black/60 justify-center items-center px-6">
            <View className="bg-white rounded-[2rem] w-full p-6 border border-slate-200 shadow-2xl">
              <View className="items-center mb-5">
                <View className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 items-center justify-center mb-4">
                  <MaterialCommunityIcons name="shield-key-outline" size={28} color="#059669" />
                </View>
                <Text className="text-slate-950 text-xl font-black uppercase tracking-tight">Verify Customer OTP</Text>
                <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-[2px] mt-2 text-center">
                  Ask customer for the hidden OTP shown in their order card
                </Text>
              </View>

              <TextInput
                value={completionOtpInput}
                onChangeText={(text) => setCompletionOtpInput(text.replace(/[^0-9]/g, '').slice(0, 6))}
                placeholder="6 digit OTP"
                placeholderTextColor="#94a3b8"
                keyboardType="number-pad"
                maxLength={6}
                className="bg-slate-50 border border-slate-200 rounded-[1.25rem] px-5 py-4 text-slate-950 text-center text-2xl font-black tracking-[8px]"
              />

              <View className="flex-row gap-3 mt-6">
                <TouchableOpacity
                  onPress={() => {
                    if (completionOtpLoading) return;
                    setCompletionOtpModalVisible(false);
                    setCompletionOtpInput('');
                  }}
                  disabled={completionOtpLoading}
                  className="flex-1 py-4 bg-slate-50 border border-slate-200 rounded-[1.25rem] items-center"
                >
                  <Text className="text-slate-500 font-black text-xs uppercase tracking-widest">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={verifyCompletionOtp}
                  disabled={completionOtpLoading}
                  className="flex-[1.6] py-4 bg-emerald-600 rounded-[1.25rem] items-center shadow-xl shadow-emerald-100"
                >
                  {completionOtpLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-white font-black text-xs uppercase tracking-widest">Complete Order</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>


        {showDatePicker.visible && (
          <DateTimePicker
            mode="date"
            value={showDatePicker.mode === 'start' ? (startDate || new Date()) : (endDate || new Date())}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDateChange}
          />
        )}
        {/* Filter Sheet modal - your existing filter code */}
        {/* ===== Premium Filter Modal ===== */}
        <Modal animationType="slide" transparent visible={filterSheetVisible} onRequestClose={() => setFilterSheetVisible(false)}>
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
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#94A3B8', marginTop: 4, letterSpacing: 1 }}>Select a date range to narrow scope</Text>
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
                {DATE_RANGE_PRESETS.map((chip) => {
                  const isActive = isDatePresetActive(chip.days);
                  return (
                    <TouchableOpacity
                      key={chip.label}
                      onPress={() => {
                        const range = getDateRangeForDays(chip.days);
                        applyDateRange(range.start, range.end);
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
                  onPress={() => {
                    const todayRange = getTodayDateRange();
                    applyDateRange(todayRange.start, todayRange.end);
                  }}
                  style={{ flex: 1, paddingVertical: 18, borderRadius: 20, alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E2E8F0' }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#64748B', letterSpacing: 0.5 }}>Today</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => applyDateRange(startDate, endDate)}
                  style={{ flex: 2, paddingVertical: 18, borderRadius: 20, alignItems: 'center', backgroundColor: '#059669', shadowColor: '#059669', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff', letterSpacing: 1 }}>Apply Scope</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>


      </View>

      {/* ===== ✨ Premium Sort & Filter Bottom Sheet (root level) ===== */}
      <Modal
        visible={sortFilterSheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSortFilterSheetOpen(false)}
        statusBarTranslucent
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
          activeOpacity={1}
          onPress={() => setSortFilterSheetOpen(false)}
        />
        <View style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          maxHeight: SCREEN_HEIGHT * 0.86,
          backgroundColor: '#ffffff',
          borderTopLeftRadius: 32,
          borderTopRightRadius: 32,
          paddingBottom: 40,
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 24,
          elevation: 24,
        }}>
          {/* Handle */}
          <View style={{ alignItems: 'center', paddingTop: 14, marginBottom: 4 }}>
            <View style={{ width: 44, height: 4, backgroundColor: '#e2e8f0', borderRadius: 99 }} />
          </View>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 16 }}>
            <View>
              <Text style={{ fontSize: 18, fontWeight: '900', color: '#0f172a', letterSpacing: -0.5 }}>{sheetTitle}</Text>
              <Text style={{ fontSize: 10, fontWeight: '600', color: '#94a3b8', letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 2 }}>{sheetSubtitle}</Text>
            </View>
            {((activeSection === 'history' && historyFilter !== 'all') || !isTodayDateRange) && (
              <TouchableOpacity
                onPress={() => {
                  if (activeSection === 'history') setHistoryFilter('all');
                  const todayRange = getTodayDateRange();
                  applyDateRange(todayRange.start, todayRange.end);
                  setSortFilterSheetOpen(false);
                }}
                style={{ backgroundColor: '#f1f5f9', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 }}
              >
                <Text style={{ fontSize: 10, fontWeight: '900', color: '#64748b', letterSpacing: 1, textTransform: 'uppercase' }}>Reset</Text>
              </TouchableOpacity>
            )}
          </View>
          {/* Divider */}
          <View style={{ height: 1, backgroundColor: '#f1f5f9', marginHorizontal: 24 }} />
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: SCREEN_HEIGHT * 0.64 }}
            contentContainerStyle={{ paddingBottom: 4 }}
          >
            {/* Filter Options Grid */}
            {activeSection === 'history' && (
              <View style={{ paddingHorizontal: 20, paddingTop: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                {HISTORY_FILTERS.map(f => {
                  const isActive = historyFilter === f.key;
                  return (
                    <TouchableOpacity
                      key={f.key}
                      onPress={() => {
                        setHistoryFilter(f.key);
                        setSortFilterSheetOpen(false);
                      }}
                      style={{
                        width: '47%', flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 18,
                        backgroundColor: isActive ? f.color : '#f8fafc',
                        borderWidth: isActive ? 0 : 1.5, borderColor: isActive ? 'transparent' : '#e2e8f0',
                        shadowColor: isActive ? f.color : 'transparent', shadowOpacity: isActive ? 0.3 : 0, shadowRadius: 10, elevation: isActive ? 6 : 0,
                      }}
                    >
                      <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : `${f.color}15`, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                        <MaterialCommunityIcons name={f.icon as any} size={18} color={isActive ? '#fff' : f.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, fontWeight: '900', color: isActive ? '#ffffff' : '#0f172a', letterSpacing: 0.5 }}>{f.label}</Text>
                        <Text style={{ fontSize: 8.5, fontWeight: '600', color: isActive ? 'rgba(255,255,255,0.75)' : '#94a3b8', marginTop: 1 }}>{f.desc}</Text>
                      </View>
                      {isActive && (<MaterialCommunityIcons name="check-circle" size={16} color="rgba(255,255,255,0.9)" />)}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <View style={{ marginHorizontal: 20, marginTop: 20, padding: 16, borderRadius: 22, backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 10 }}>
                  <View style={{ width: 38, height: 38, borderRadius: 14, backgroundColor: '#ecfdf5', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                    <MaterialCommunityIcons name="calendar-clock" size={19} color="#007a53" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: '900', color: '#0f172a', letterSpacing: 0.4 }}>Date Jump</Text>
                    <Text style={{ fontSize: 8.5, fontWeight: '700', color: '#64748b', marginTop: 1, textTransform: 'uppercase', letterSpacing: 1 }} numberOfLines={1}>
                      Current scope: {dateRangeLabel}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setSortFilterSheetOpen(false);
                    setFilterSheetVisible(true);
                  }}
                  style={{ paddingHorizontal: 11, paddingVertical: 7, borderRadius: 12, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0' }}
                >
                  <Text style={{ fontSize: 9, fontWeight: '900', color: '#475569', textTransform: 'uppercase', letterSpacing: 0.8 }}>Custom</Text>
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {DATE_RANGE_PRESETS.map((chip) => {
                  const isActive = isDatePresetActive(chip.days);
                  return (
                    <TouchableOpacity
                      key={chip.label}
                      activeOpacity={0.84}
                      onPress={() => {
                        const range = getDateRangeForDays(chip.days);
                        applyDateRange(range.start, range.end);
                        setSortFilterSheetOpen(false);
                      }}
                      style={{ width: '48%', minHeight: 46, borderRadius: 15, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: isActive ? '#007a53' : '#ffffff', borderWidth: 1.5, borderColor: isActive ? '#007a53' : '#e2e8f0', justifyContent: 'center' }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: '900', color: isActive ? '#ffffff' : '#0f172a', letterSpacing: 0.5 }} numberOfLines={1}>{chip.label}</Text>
                      <Text style={{ fontSize: 8, fontWeight: '800', color: isActive ? 'rgba(255,255,255,0.72)' : '#94a3b8', marginTop: 1, textTransform: 'uppercase', letterSpacing: 0.8 }} numberOfLines={1}>
                        {chip.days === 1 ? 'Today only' : `${chip.days} day scope`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={{ marginTop: 16 }}>
                <Text style={{ fontSize: 9, fontWeight: '900', color: '#64748b', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 9 }}>Recent quote dates</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
                  {dateJumpBadges.map((badge) => {
                    const selected = selectedSingleDateKey === badge.key;
                    const date = getDateFromKey(badge.key);
                    return (
                      <TouchableOpacity
                        key={badge.key}
                        activeOpacity={0.84}
                        onPress={() => {
                          applyDateRange(date, date);
                          setSortFilterSheetOpen(false);
                        }}
                        style={{ minWidth: 94, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: selected ? '#0f172a' : '#ffffff', borderWidth: 1.5, borderColor: selected ? '#0f172a' : '#e2e8f0' }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '900', color: selected ? '#ffffff' : '#0f172a' }} numberOfLines={1}>
                          {formatDateJumpLabel(badge.key, todayDateKey)}
                        </Text>
                        <Text style={{ fontSize: 8, fontWeight: '900', color: selected ? 'rgba(255,255,255,0.68)' : '#64748b', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.8 }} numberOfLines={1}>
                          {badge.count} {badge.count === 1 ? 'quote' : 'quotes'}
                        </Text>
                        <View style={{ alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, backgroundColor: badge.pendingCount > 0 ? '#fee2e2' : (selected ? 'rgba(255,255,255,0.14)' : '#ecfdf5') }}>
                          <Text style={{ fontSize: 7.5, fontWeight: '900', color: badge.pendingCount > 0 ? '#dc2626' : (selected ? '#a7f3d0' : '#007a53'), textTransform: 'uppercase', letterSpacing: 0.7 }} numberOfLines={1}>
                            {badge.pendingCount > 0 ? `${badge.pendingCount} pending` : 'Clear'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>



      <DeliveryDestinationModal item={deliveryMapItem} onClose={() => setDeliveryMapItem(null)} />

      <RatingBottomSheet
        isVisible={ratingModalVisible}
        onClose={() => setRatingModalVisible(false)}
        orderId={pendingRatingOrder?.id || 0}
        raterType="store"
        orderStatus={pendingRatingOrder?.user_status || ''}
        cancelledBy={pendingRatingOrder?.cancelled_by}
        onSuccess={() => {
          setRatingModalVisible(false);
        }}
      />
    </>
  );
}
