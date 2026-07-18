import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/Language/LocalizedPrimitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import Constants from 'expo-constants';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  View
} from 'react-native';
import Toast from 'react-native-toast-message';
import RatingBottomSheet from '../../components/RatingBottomSheet';
import RemoteImageWithStatus from '../../components/RemoteImageWithStatus';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../redux/store';
import { fetchUserProfile } from '../../redux/userSlice';

type OrderMedicine = {
  medicine_name?: string | null;
  medicine_brand?: string | null;
  medicine_type?: string | null;
  price?: number | string | null;
  is_available?: boolean;
};

type OrderResponse = {
  id: number;
  prescription?: number | string | null;
  prescription_is_emergency?: boolean;
  image?: string | null;
  store?: number | string | null;
  store_name?: string | null;
  store_address?: string | null;
  store_contact?: string | null;
  distance_km?: number | string | null;
  total_amount?: number | string | null;
  response_text?: string | null;
  medicines?: OrderMedicine[];
  user_status?: string | null;
  delivery_option?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  is_locked?: boolean;
  is_processing_started?: boolean;
  is_packed?: boolean;
  accepted_at?: string | null;
  processing_at?: string | null;
  locked_at?: string | null;
  completed_at?: string | null;
  cancelled_by?: string | null;
  cancel_reason?: string | null;
  store_contact_note?: string | null;
  store_report_count?: number;
  user_report_count?: number;
  is_ratable?: boolean;
  user_rating?: any;
  store_overall_rating?: number | string | null;
  store_total_ratings?: number;
  smart_tags?: string[];
  store_badges?: string[];
  trust_signal?: string | null;
  completion_otp?: string | null;
  completion_otp_requested?: boolean;
  completion_otp_expires_at?: string | null;
  can_order_again?: boolean;
  can_request_replacement?: boolean;
  replacement_status?: string | null;
  replacement_id?: number | null;
  chat_thread_id?: number | null;
  best_deal?: {
    is_best: boolean;
    savings: number | string;
  } | null;
};

type PaginatedOrders = {
  results?: OrderResponse[];
};

type OrderProgressUpdate = Partial<OrderResponse> & {
  response_id?: number;
  id?: number;
};

type OrderLike = {
  id?: number;
  response_id?: number;
  updated_at?: string | null;
};

type OrderSection = 'active' | 'completed' | 'cancelled';

const ORDER_SECTION_OPTIONS: { key: OrderSection; label: string; icon: string; color: string; bg: string; desc: string }[] = [
  { key: 'active', label: 'Orders', icon: 'progress-clock', color: '#059669', bg: '#ecfdf5', desc: 'Accepted & live orders' },
  { key: 'completed', label: 'Completed', icon: 'check-circle-outline', color: '#16a34a', bg: '#f0fdf4', desc: 'Delivered orders' },
  { key: 'cancelled', label: 'Cancelled', icon: 'close-circle-outline', color: '#dc2626', bg: '#fef2f2', desc: 'Cancelled orders' },
];

const predefinedReportReasons = [
  'Store did not answer',
  'Invalid number',
  'Store denied service',
  'Wrong address',
  'Others',
];

const getOrderIdentity = (item?: OrderLike | null) => {
  if (!item) return undefined;
  return item.response_id ?? item.id;
};

const isSameOrder = (item: OrderLike | null | undefined, update: OrderProgressUpdate) => {
  const itemId = getOrderIdentity(item);
  const updateId = update.response_id ?? update.id;
  return itemId != null && updateId != null && Number(itemId) === Number(updateId);
};

const shouldApplyOrderUpdate = (item: OrderLike, update: OrderProgressUpdate) => {
  if (!update.updated_at || !item.updated_at) return true;
  const existingTime = new Date(item.updated_at).getTime() || 0;
  const newTime = new Date(update.updated_at).getTime() || Date.now();
  return newTime >= existingTime;
};

const mergeOrderUpdate = <T extends OrderLike>(item: T, update: OrderProgressUpdate): T => {
  const { id: updateId, ...safeUpdate } = update;
  const normalizedResponseId = update.response_id ?? updateId ?? item.response_id ?? item.id;

  return {
    ...item,
    ...safeUpdate,
    response_id: normalizedResponseId,
  } as T;
};

const isVisibleOrderStatus = (status?: string | null) => ORDER_STATUSES.has(normalizeStatus(status));

const ORDER_STATUSES = new Set([
  'accepted',
  'processing',
  'locked',
  'out_for_delivery',
  'completed',
  'cancelled',
]);

const STATUS_META: Record<string, { label: string; icon: any; bg: string; fg: string; border: string }> = {
  accepted: {
    label: 'Accepted',
    icon: 'check-decagram-outline',
    bg: '#eff6ff',
    fg: '#2563eb',
    border: '#bfdbfe',
  },
  processing: {
    label: 'Processing',
    icon: 'progress-clock',
    bg: '#fff7ed',
    fg: '#ea580c',
    border: '#fed7aa',
  },
  locked: {
    label: 'Ready at store',
    icon: 'lock-check-outline',
    bg: '#ecfdf5',
    fg: '#059669',
    border: '#bbf7d0',
  },
  packed: {
    label: 'Medicine packed',
    icon: 'package-variant-closed',
    bg: '#eef2ff',
    fg: '#4f46e5',
    border: '#c7d2fe',
  },
  out_for_delivery: {
    label: 'Out for delivery',
    icon: 'truck-delivery-outline',
    bg: '#f0f9ff',
    fg: '#0284c7',
    border: '#bae6fd',
  },
  completed: {
    label: 'Completed',
    icon: 'check-circle-outline',
    bg: '#f0fdf4',
    fg: '#16a34a',
    border: '#bbf7d0',
  },
  cancelled: {
    label: 'Cancelled',
    icon: 'close-circle-outline',
    bg: '#fef2f2',
    fg: '#dc2626',
    border: '#fecaca',
  },
};

const buildMediaUrl = (baseUrl: string | undefined, mediaPath?: string | null) => {
  if (!mediaPath) return null;
  if (/^https?:\/\//i.test(mediaPath)) return mediaPath;
  const base = (baseUrl || '').replace(/\/+$/, '');
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

const formatOrderDate = (value?: string | null) => {
  if (!value) return 'Recently updated';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently updated';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

const formatLocalDateParam = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
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

const getOrderDateValue = (order: OrderResponse) => order.updated_at || order.accepted_at || order.created_at || null;

const isOrderWithinDateRange = (order: OrderResponse, startDate: Date, endDate: Date) => {
  if (order.completion_otp_requested && order.completion_otp && normalizeStatus(order.user_status) !== 'completed') {
    return true;
  }

  const orderDateValue = getOrderDateValue(order);
  if (!orderDateValue) return false;
  const orderTime = new Date(orderDateValue).getTime();
  if (Number.isNaN(orderTime)) return false;
  return orderTime >= startDate.getTime() && orderTime <= endDate.getTime();
};

const normalizeStatus = (status?: string | null) => (status || '').toLowerCase();

const formatCurrency = (value?: number | string | null) => {
  if (value === null || value === undefined || value === '') return 'Amount pending';
  const amount = Number(value);
  if (Number.isNaN(amount)) return String(value);
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};

const formatMedicinePrice = (value?: number | string | null) => {
  if (value === null || value === undefined || value === '') return 'Price pending';
  const amount = Number(value);
  if (Number.isNaN(amount)) return String(value);
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};

const OrderBestDealBadge = ({ savings }: { savings?: number | string | null }) => {
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  const glowAnim = React.useRef(new Animated.Value(0)).current;
  const savingsAmount = Number(savings || 0);

  React.useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 750, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 750, useNativeDriver: true }),
      ])
    );
    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.3, duration: 900, useNativeDriver: true }),
      ])
    );
    pulse.start();
    glow.start();
    return () => { pulse.stop(); glow.stop(); };
  }, [glowAnim, pulseAnim]);

  return (
    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
      <Animated.View
        style={{
          opacity: glowAnim,
          position: "absolute",
          top: -4,
          left: -4,
          right: -4,
          bottom: -4,
          borderRadius: 18,
          backgroundColor: "#10b981",
          shadowColor: "#10b981",
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 1,
          shadowRadius: 12,
          elevation: 8,
        }}
      />
      <View className="flex-row items-center rounded-[14px] border border-emerald-300 bg-emerald-600 px-2.5 py-1.5">
        <MaterialCommunityIcons name="trophy-award" size={13} color="#fef3c7" />
        <View className="ml-1.5">
          <Text className="text-[8px] font-black uppercase tracking-[1.5px] text-white" numberOfLines={1}>Best Deal</Text>
          {savingsAmount > 0 && (
            <Text className="text-[7px] font-bold text-emerald-100" numberOfLines={1}>
              Save ₹{savingsAmount} vs others
            </Text>
          )}
        </View>
      </View>
    </Animated.View>
  );
};

export default function OrdersScreen() {
  const BASE_URL = Constants.expoConfig?.extra?.BASE_URL || '';
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const { user, token } = useSelector((state: RootState) => state.user);
  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderAgainLoadingId, setOrderAgainLoadingId] = useState<number | null>(null);
  const [selectedDetailsOrderId, setSelectedDetailsOrderId] = useState<number | null>(null);
  const [visibleCompletionOtpId, setVisibleCompletionOtpId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [orderSection, setOrderSection] = useState<OrderSection>('active');
  const [orderMenuVisible, setOrderMenuVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelTargetId, setCancelTargetId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelStatus, setCancelStatus] = useState<string>('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [modalReportVisible, setReportModalVisible] = useState(false);
  const [SelectedReportId, setSelectedReportId] = useState<number | null>(null);
  const [noteText, setNoteText] = useState('');
  const [selectedReason, setSelectedReason] = useState('');
  const [userReports, setUserReports] = useState<{ note: string; created_at: string }[]>([]);
  const [reportCount, setReportCount] = useState(0);
  const [storeReports, setStoreReports] = useState<{ note: string; created_at: string; store_name?: string }[]>([]);
  const [storeReportCount, setStoreReportCount] = useState(0);
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [ratingOrderTarget, setRatingOrderTarget] = useState<OrderResponse | null>(null);
  const [storeReviewsVisible, setStoreReviewsVisible] = useState(false);
  const [currentStoreReviews, setCurrentStoreReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [currentStoreName, setCurrentStoreName] = useState('');
  const [currentReviewStoreItem, setCurrentReviewStoreItem] = useState<OrderResponse | null>(null);
  const [replaceModalVisible, setReplaceModalVisible] = useState(false);
  const [replaceTargetOrder, setReplaceTargetOrder] = useState<OrderResponse | null>(null);
  const [replaceReason, setReplaceReason] = useState('wrong_medicine');
  const [replaceNote, setReplaceNote] = useState('');
  const [replaceLoading, setReplaceLoading] = useState(false);
  const [replaceProof, setReplaceProof] = useState<ImagePicker.ImagePickerAsset | null>(null);

  const selectedDateKey = useMemo(() => formatLocalDateParam(selectedDate), [selectedDate]);
  const todayDateKey = formatLocalDateParam(new Date());
  const selectedStartDate = useMemo(() => startOfLocalDay(selectedDate), [selectedDate]);
  const selectedEndDate = useMemo(() => endOfLocalDay(selectedDate), [selectedDate]);
  const selectedDateLabel = useMemo(() => selectedDate.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }), [selectedDate]);
  const isSelectedDateToday = selectedDateKey === todayDateKey;
  const canGoNextDate = selectedDateKey < todayDateKey;
  const activeOrderSectionOption = ORDER_SECTION_OPTIONS.find((option) => option.key === orderSection) || ORDER_SECTION_OPTIONS[0];

  const shiftSelectedDate = useCallback((days: number) => {
    setSelectedDate((currentDate) => {
      const nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() + days);
      return nextDate;
    });
  }, []);

  const resetSelectedDate = useCallback(() => {
    setSelectedDate(new Date());
  }, []);

  useEffect(() => {
    if (!token || !user) {
      dispatch(fetchUserProfile());
    }
  }, [dispatch, token, user]);

  const fetchOrders = useCallback(async (showLoading = true) => {
    if (!token || !user?.id) {
      setLoading(false);
      return;
    }

    try {
      if (showLoading) setLoading(true);
      const res = await axios.get<PaginatedOrders | OrderResponse[]>(`${BASE_URL}/api/responses/${user.id}/`, {
        params: {
          page: 1,
          page_size: 100,
          sort_by: 'updated_at',
          start_date: selectedDateKey,
          end_date: selectedDateKey,
        },
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      const rawOrders = Array.isArray(res.data) ? res.data : res.data.results || [];
      const acceptedOrders = rawOrders.filter((item) => isVisibleOrderStatus(item.user_status));
      setOrders(acceptedOrders);
      setError(null);
    } catch (err: any) {
      console.error('Settings orders fetch error:', err?.response?.data || err.message);
      setError('Unable to load your orders right now.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [BASE_URL, selectedDateKey, token, user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchOrders();
    }, [fetchOrders])
  );

  const seenEventIds = useRef<Set<string>>(new Set());
  const lastSeqMap = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    if (!token || !user?.id || user.user_type !== 'user' || !BASE_URL) return;

    let socket: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let isMounted = true;
    let retryCount = 0;

    const applyFulfillmentUpdate = (update: OrderProgressUpdate) => {
      let matched = false;

      setOrders((currentOrders) => {
        const nextOrders = currentOrders
          .map((order) => {
            if (isSameOrder(order, update) && shouldApplyOrderUpdate(order, update)) {
              matched = true;
              return mergeOrderUpdate(order, update);
            }
            return order;
          })
          .filter((order) => isVisibleOrderStatus(order.user_status));

        return nextOrders;
      });

      if (!matched && (isVisibleOrderStatus(update.user_status) || update.completion_otp_requested || update.completion_otp)) {
        fetchOrders(false);
      }
    };

    const connect = () => {
      const socketUrl = `${BASE_URL.replace(/^http/, 'ws')}/ws/orders/?token=${token}`;
      socket = new WebSocket(socketUrl);

      socket.onopen = () => {
        retryCount = 0;
        fetchOrders(false);
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type !== 'fulfillment_update') return;

          const update = message.data as OrderProgressUpdate | undefined;
          if (!update) return;

          const eventId: string | undefined = message.event_id;
          if (eventId) {
            if (seenEventIds.current.has(eventId)) return;
            seenEventIds.current.add(eventId);
            if (seenEventIds.current.size > 200) {
              const first = seenEventIds.current.values().next().value;
              if (first) seenEventIds.current.delete(first);
            }
          }

          const seq: number | undefined = message.seq;
          const updateId = update.response_id ?? update.id;
          if (message.action !== 'completion_otp_requested' && seq != null && updateId != null) {
            const lastSeq = lastSeqMap.current.get(updateId) ?? -1;
            if (seq <= lastSeq) return;
            lastSeqMap.current.set(updateId, seq);
          }

          if (message.action === 'new_offer' || message.action === 'new_chat_message') return;

          applyFulfillmentUpdate(update);

          // Completion changes replacement eligibility on the backend. Refetch the
          // serialized order immediately so the Replace Medicine button appears live.
          if (normalizeStatus(update.user_status) === 'completed') {
            fetchOrders(false);
          }

          if (message.action === 'completion_otp_requested') {
            Toast.show({
              type: 'info',
              text1: 'Completion OTP Requested',
              text2: 'Share the OTP shown on your order card with the store.',
              position: 'bottom',
              visibilityTime: 5000,
            });
            fetchOrders(false);
          }
        } catch (err) {
          console.warn('Orders WS parse error:', err);
        }
      };

      socket.onclose = () => {
        if (!isMounted) return;
        const delay = Math.min(10000, Math.pow(2, retryCount) * 1000);
        reconnectTimeout = setTimeout(() => {
          retryCount += 1;
          connect();
        }, delay);
      };

      socket.onerror = () => {
        socket?.close();
      };
    };

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      socket?.close();
    };
  }, [BASE_URL, fetchOrders, token, user?.id, user?.user_type]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchOrders(false);
  }, [fetchOrders]);


  const submitOrderAgain = useCallback(async (item: OrderResponse, scope: 'preferred_only' | 'all_stores') => {
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
      await fetchOrders(false);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Could not create a new request.';
      Toast.show({ type: 'error', text1: 'Order Again failed', text2: msg, position: 'bottom' });
    } finally {
      setOrderAgainLoadingId(null);
    }
  }, [BASE_URL, fetchOrders, token]);

  const confirmOrderAgain = useCallback((item: OrderResponse) => {
    Alert.alert(
      'Order Again',
      'Create a new prescription request from this completed order. This will restart the quote process.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Last store only', onPress: () => submitOrderAgain(item, 'preferred_only') },
        { text: 'All verified stores', onPress: () => submitOrderAgain(item, 'all_stores') },
      ]
    );
  }, [submitOrderAgain]);

  const fetchStoreReviews = useCallback(async (storeId: number | string, storeName: string, itemResponse?: OrderResponse) => {
    try {
      setReviewsLoading(true);
      setCurrentStoreName(storeName);
      setCurrentReviewStoreItem(itemResponse || null);
      setStoreReviewsVisible(true);
      const res = await axios.get(`${BASE_URL}/api/ratings/store/${storeId}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const reviews = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setCurrentStoreReviews(reviews);
    } catch {
      Toast.show({ type: 'error', text1: 'Could not load reviews', position: 'bottom' });
    } finally {
      setReviewsLoading(false);
    }
  }, [BASE_URL, token]);

  const initiateChat = useCallback((item: OrderResponse) => {
    router.push({
      pathname: '/chat/[id]',
      params: {
        id: item.chat_thread_id?.toString() || '0',
        store_id: item.store ? String(item.store) : '',
        prescription_id: item.prescription ? String(item.prescription) : '',
        prescription_image: item.image || '',
        store_name: item.store_name || 'Pharmacy',
      },
    } as any);
  }, [router]);

  const raiseComplaint = useCallback((item: OrderResponse) => {
    if (!item.store) {
      Alert.alert('Pharmacy unavailable', 'This order does not include a valid pharmacy reference.');
      return;
    }
    router.push({
      pathname: '/support/raise',
      params: {
        respondent_type: 'store',
        respondent_id: String(item.store),
        respondent_name: item.store_name || 'Pharmacy',
        order_id: String(item.id),
        order_label: `Order #${item.id}`,
      },
    } as any);
  }, [router]);

  const openCancelModal = useCallback((item: OrderResponse) => {
    setCancelTargetId(item.id);
    setCancelStatus(normalizeStatus(item.user_status));
    setCancelReason('');
    setCancelModalVisible(true);
  }, []);

  const handleCancelOrder = useCallback(async () => {
    if (!cancelTargetId) return;
    const needsReason = cancelStatus === 'processing';
    if (needsReason && !cancelReason.trim()) {
      Toast.show({ type: 'error', text1: 'Reason Required', text2: 'Please provide a reason for cancellation.', position: 'bottom' });
      return;
    }
    try {
      setCancelLoading(true);
      await axios.post(
        `${BASE_URL}/api/responses/${cancelTargetId}/cancel/`,
        { reason: cancelReason.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCancelModalVisible(false);
      Toast.show({ type: 'success', text1: 'Order Cancelled', text2: 'Your order has been cancelled.', position: 'bottom' });
      await fetchOrders(false);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Could not cancel order.';
      Toast.show({ type: 'error', text1: 'Cannot Cancel', text2: msg, position: 'bottom' });
    } finally {
      setCancelLoading(false);
    }
  }, [BASE_URL, cancelReason, cancelStatus, cancelTargetId, fetchOrders, token]);

  const fetchUserNotes = useCallback(async (
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
  }, [BASE_URL, token]);

  const openReportModal = useCallback((item: OrderResponse) => {
    const fallbackStoreReports = item.store_contact_note ? [{
      note: item.store_contact_note,
      created_at: item.updated_at || item.created_at || '',
      store_name: item.store_name || 'Pharmacy',
    }] : [];
    const pharmacyReportCount = item.store_report_count || (item.store_contact_note ? 1 : 0);
    setReportModalVisible(true);
    setSelectedReportId(item.id);
    setUserReports([]);
    setReportCount(0);
    setNoteText('');
    setSelectedReason('');
    setStoreReports(fallbackStoreReports);
    setStoreReportCount(pharmacyReportCount);
    fetchUserNotes(item.id, fallbackStoreReports);
  }, [fetchUserNotes]);

  const pickReplacementProof = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert('Permission required', 'Allow photo access to attach proof.');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.75 });
    if (!result.canceled) setReplaceProof(result.assets[0]);
  };

  const handleReplaceOrder = async () => {
    if (!replaceTargetOrder || !token) return;
    if (replaceReason === 'other' && !replaceNote.trim()) return Alert.alert('Details required', 'Please describe the issue.');
    setReplaceLoading(true);
    try {
      const form = new FormData();
      form.append('reason', replaceReason);
      form.append('description', replaceNote.trim());
      if (replaceProof) form.append('proof_image', {
        uri: replaceProof.uri,
        name: replaceProof.fileName || 'replacement-proof.jpg',
        type: replaceProof.mimeType || 'image/jpeg',
      } as any);
      await axios.post(`${BASE_URL}/api/orders/${replaceTargetOrder.id}/replace/`, form, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });
      Toast.show({ type: 'success', text1: 'Replacement requested successfully' });
      setReplaceModalVisible(false);
      setReplaceNote('');
      setReplaceProof(null);
      router.push('/replacements');
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.error || 'Failed to request replacement' });
    } finally { setReplaceLoading(false); }
  };

  const submitContactNote = useCallback(async () => {
    if (!SelectedReportId || (!selectedReason && !noteText.trim())) return;
    const finalNote = selectedReason === 'Others' ? noteText.trim() : `${selectedReason}${noteText.trim() ? `: ${noteText}` : ''}`;
    try {
      await axios.post(`${BASE_URL}/api/safety-reports/`, { reference_id: SelectedReportId, category: 'other', description: finalNote }, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      Alert.alert('Success', 'Report Submitted Successfully');
      setNoteText('');
      setSelectedReason('');
      setReportModalVisible(false);
      fetchOrders(false);
    } catch {
      Alert.alert('Error', 'Submission Failed');
    }
  }, [BASE_URL, SelectedReportId, fetchOrders, noteText, selectedReason, token]);

  const openOrderDetails = useCallback((orderId: number) => {
    setSelectedDetailsOrderId(orderId);
  }, []);

  const closeOrderDetails = useCallback(() => {
    setSelectedDetailsOrderId(null);
  }, []);

  const selectedDetailsOrder = useMemo(() => {
    if (selectedDetailsOrderId == null) return null;
    return orders.find((order) => order.id === selectedDetailsOrderId) || null;
  }, [orders, selectedDetailsOrderId]);

  const orderSectionCounts = useMemo(() => ({
    active: orders.filter((order) => {
      const status = normalizeStatus(order.user_status);
      return status !== 'completed' && status !== 'cancelled';
    }).length,
    completed: orders.filter((order) => normalizeStatus(order.user_status) === 'completed').length,
    cancelled: orders.filter((order) => normalizeStatus(order.user_status) === 'cancelled').length,
  }), [orders]);

  const sortedOrders = useMemo(() => {
    return orders
      .filter((order) => isOrderWithinDateRange(order, selectedStartDate, selectedEndDate))
      .filter((order) => {
        const status = normalizeStatus(order.user_status);
        if (orderSection === 'completed') return status === 'completed';
        if (orderSection === 'cancelled') return status === 'cancelled';
        return status !== 'completed' && status !== 'cancelled';
      })
      .sort((a, b) => {
        if (a.prescription_is_emergency !== b.prescription_is_emergency) return a.prescription_is_emergency ? -1 : 1;
        const aDate = new Date(getOrderDateValue(a) || '').getTime() || 0;
        const bDate = new Date(getOrderDateValue(b) || '').getTime() || 0;
        return bDate - aDate;
      });
  }, [orders, orderSection, selectedEndDate, selectedStartDate]);

  const renderMedicineDetails = useCallback((item: OrderResponse) => {
    const medicines = item.medicines || [];

    return (
      <>
        {medicines.length > 0 ? (
          <View className="overflow-hidden rounded-[1rem] border border-slate-100">
            {medicines.map((medicine, idx) => (
              <View
                key={`${medicine.medicine_name || 'medicine'}-${idx}`}
                className={`flex-row items-center justify-between px-3 py-3 ${idx < medicines.length - 1 ? 'border-b border-slate-100' : ''}`}
              >
                <View className="flex-1 pr-3">
                  <Text className="text-xs font-black text-slate-900" numberOfLines={1}>
                    {medicine.medicine_name || 'Medicine'}
                  </Text>
                  <Text className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400" numberOfLines={1}>
                    {medicine.medicine_brand || medicine.medicine_type || (medicine.is_available === false ? 'Unavailable' : 'Available')}
                  </Text>
                </View>
                <Text className="text-xs font-black text-slate-700" numberOfLines={1}>
                  {formatMedicinePrice(medicine.price)}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View className="rounded-[1rem] border border-slate-100 bg-slate-50 px-3 py-3">
            <Text className="text-xs font-bold text-slate-500">Item details are not shared yet.</Text>
          </View>
        )}

        {!!item.response_text && (
          <View className="mt-3 rounded-[1rem] border border-emerald-100 bg-emerald-50/60 px-3 py-3">
            <Text className="mb-1 text-[9px] font-black uppercase tracking-[2px] text-emerald-700">Pharmacy Note</Text>
            <Text className="text-xs font-semibold leading-5 text-slate-700">
              {item.response_text}
            </Text>
          </View>
        )}
      </>
    );
  }, []);

  const renderOrderCard = ({ item }: { item: OrderResponse }) => {
    const statusKey = normalizeStatus(item.user_status);
    const isEmergencyOrder = item.prescription_is_emergency === true;
    const displayStatusKey = statusKey === 'completed' || statusKey === 'cancelled' || statusKey === 'out_for_delivery'
      ? statusKey
      : item.is_locked || statusKey === 'locked'
        ? 'locked'
        : item.is_packed
          ? 'packed'
          : item.is_processing_started || statusKey === 'processing'
            ? 'processing'
            : statusKey;
    const statusMeta = STATUS_META[displayStatusKey] || {
      label: item.user_status || 'Order placed',
      icon: 'clipboard-check-outline',
      bg: '#f8fafc',
      fg: '#475569',
      border: '#e2e8f0',
    };
    const imageUrl = buildMediaUrl(BASE_URL, item.image);
    const isWalkIn = item.delivery_option === 'walk_in';
    const hasCompletionOtp = !!(item.completion_otp_requested && item.completion_otp && statusKey !== 'completed');
    const liveSteps = [
      { label: 'Accepted', icon: 'check-bold' as const, done: ['accepted', 'processing', 'locked', 'out_for_delivery', 'completed'].includes(statusKey) || !!item.is_locked },
      { label: 'Billing', icon: 'script-text-outline' as const, done: ['processing', 'locked', 'out_for_delivery', 'completed'].includes(statusKey) || !!item.is_processing_started },
      { label: 'Packed', icon: 'package-variant-closed' as const, done: ['locked', 'out_for_delivery', 'completed'].includes(statusKey) || !!item.is_packed },
      { label: isWalkIn ? 'Ready' : 'Delivery', icon: isWalkIn ? 'store-clock' as const : 'truck-delivery' as const, done: ['locked', 'out_for_delivery', 'completed'].includes(statusKey) || !!item.is_locked },
      { label: 'Done', icon: 'flag-checkered' as const, done: statusKey === 'completed' },
    ];
    const canOrderAgain = statusKey === 'completed';
    const canCancelOrder = ['accepted', 'processing'].includes(statusKey) && !item.is_locked;
    const canContactStore = statusKey !== 'completed' && statusKey !== 'cancelled';
    const pharmacyReportCount = item.store_report_count || (item.store_contact_note ? 1 : 0);
    const storeHighlights = Array.from(new Set([
      ...(item.trust_signal ? [item.trust_signal] : []),
      ...(item.store_badges || []),
      ...(item.smart_tags || []),
    ].filter(Boolean))).slice(0, 5);
    const ratingLabel = formatStoreRating(item.store_overall_rating);
    const ratingCountLabel = item.store_total_ratings ? String(item.store_total_ratings) + ' reviews' : 'Reviews';
    const isBestDealOrder = item.best_deal?.is_best === true;

    return (
      <View className="bg-white rounded-[2rem] mb-5 border border-slate-200/70 shadow-xl shadow-slate-200/60 overflow-hidden">
        <View className="relative overflow-hidden">
          <LinearGradient
            colors={['#0f172a', '#1e293b', '#064e3b']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="absolute inset-0"
          />
          <View className="px-5 py-4 flex-row items-center justify-between">
            <View className="flex-row items-center flex-1 mr-3">
              <View className="w-9 h-9 rounded-2xl bg-white/10 border border-white/10 items-center justify-center">
                <MaterialCommunityIcons name="shopping-outline" size={18} color="#34d399" />
              </View>
              <View className="ml-3 flex-1">
                <View className="flex-row items-center">
                  <Text className="text-[8px] font-black text-emerald-400 uppercase tracking-[3px]">Order</Text>
                  {isEmergencyOrder && <View className="ml-2 flex-row items-center rounded-full border border-rose-400/40 bg-rose-500/20 px-2 py-0.5"><MaterialCommunityIcons name="alarm-light-outline" size={10} color="#fda4af" /><Text className="ml-1 text-[7px] font-black uppercase tracking-wider text-rose-200">Emergency</Text></View>}
                </View>
                <Text className="text-white font-black text-sm tracking-tight" numberOfLines={1}>
                  {item.store_name || 'Pharmacy Store'}
                </Text>
              </View>
            </View>
            <View
              style={{ backgroundColor: statusMeta.bg, borderColor: statusMeta.border }}
              className="px-3 py-1.5 rounded-full border flex-row items-center max-w-[150px]"
            >
              <MaterialCommunityIcons name={statusMeta.icon} size={12} color={statusMeta.fg} />
              <Text style={{ color: statusMeta.fg }} className="text-[8px] font-black uppercase tracking-wider ml-1" numberOfLines={1}>
                {statusMeta.label}
              </Text>
            </View>
          </View>
        </View>

        {hasCompletionOtp && (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setVisibleCompletionOtpId((current) => current === item.id ? null : item.id)}
            className="bg-emerald-600 border-b border-emerald-700/30"
          >
            <LinearGradient
              colors={['#047857', '#10b981', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              className="px-5 py-3"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1 pr-3">
                  <View className="w-9 h-9 rounded-xl bg-white/20 border border-white/25 items-center justify-center">
                    <MaterialCommunityIcons name="shield-key-outline" size={20} color="#ffffff" />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="text-white/90 text-[8px] font-black uppercase tracking-[2px]">Action Required</Text>
                    <Text className="text-white text-xs font-black mt-0.5" numberOfLines={1}>Completion OTP Available</Text>
                    {item.completion_otp_expires_at && (
                      <Text className="text-white/70 text-[8px] font-bold mt-0.5" numberOfLines={1}>
                        Expires {new Date(item.completion_otp_expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    )}
                  </View>
                </View>
                <View className="min-w-[104px] px-2 py-1.5 rounded-xl bg-white/95 border border-white/70 items-center">
                  <Text
                    className="text-emerald-700 font-black text-lg"
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                    allowFontScaling={false}
                    style={{ letterSpacing: 2 }}
                  >
                    {visibleCompletionOtpId === item.id ? formatCompletionOtp(item.completion_otp) : '••••••'}
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        <View className="p-5">
          <View className="flex-row items-center mb-4">
            <View className="w-16 h-16 rounded-[1.35rem] bg-emerald-50 border border-emerald-100 overflow-hidden items-center justify-center">
              {imageUrl ? (
                <RemoteImageWithStatus uri={imageUrl} loadingLabel="Loading order image" />
              ) : (
                <MaterialCommunityIcons name="script-text-outline" size={25} color="#059669" />
              )}
            </View>
            <View className="ml-4 flex-1">
              <Text className="text-[9px] font-black text-slate-400 uppercase tracking-[2.5px]">
                {isWalkIn ? 'Pickup Address' : 'Store Address'}
              </Text>
              <Text className="text-sm font-black text-slate-900 mt-0.5 leading-5" numberOfLines={2}>
                {item.store_address || 'Store pickup address will appear here once shared.'}
              </Text>
              <View className="mt-1 flex-row items-center">
                <MaterialCommunityIcons name="phone-outline" size={13} color="#64748b" />
                <Text className="ml-1.5 flex-1 text-[10px] font-bold text-slate-500" numberOfLines={1}>
                  {item.store_contact || 'Store contact not shared yet'}
                </Text>
              </View>
              <Text className="text-[10px] font-bold text-slate-400 mt-1" numberOfLines={1}>
                {formatOrderDate(item.updated_at || item.created_at)}
              </Text>
            </View>
          </View>

          <View className="mb-4 flex-row flex-wrap gap-2">
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={!item.store}
              onPress={() => item.store && fetchStoreReviews(item.store, item.store_name || 'Pharmacy Store', item)}
              className="min-h-[34px] rounded-full border border-amber-100 bg-amber-50 px-3 py-2 flex-row items-center"
            >
              <MaterialCommunityIcons name="star" size={13} color="#d97706" />
              <Text className="ml-1.5 text-[10px] font-black uppercase tracking-wider text-amber-700">{ratingLabel}</Text>
              <Text className="ml-1.5 text-[9px] font-bold uppercase tracking-wider text-amber-600">{ratingCountLabel}</Text>
            </TouchableOpacity>
            {storeHighlights.map((badge, index) => {
              const meta = getStoreBadgeMeta(String(badge));
              return (
                <View key={`${badge}-${index}`} className={`min-h-[34px] rounded-full border px-3 py-2 flex-row items-center ${meta.bg} ${meta.border}`}>
                  <MaterialCommunityIcons name={meta.icon as any} size={13} color={meta.iconColor} />
                  <Text className={`ml-1.5 text-[9px] font-black uppercase tracking-wider ${meta.text}`}>{badge}</Text>
                </View>
              );
            })}
          </View>

          <View className="mb-4 rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4">
            <View className="mb-4 flex-row items-center justify-between">
              <View className="flex-row items-center flex-1 pr-3">
                <View className="h-9 w-9 items-center justify-center rounded-full bg-white border border-slate-200">
                  <MaterialCommunityIcons name={isWalkIn ? 'walk' : 'truck-delivery'} size={18} color="#059669" />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-[9px] font-black uppercase tracking-[2px] text-slate-400">Live Status</Text>
                  <Text className="text-xs font-black text-slate-900" numberOfLines={1}>
                    {isWalkIn ? 'Walk-in pickup at store' : 'Delivery order tracking'}
                  </Text>
                </View>
              </View>
              <View className="rounded-full border border-emerald-100 bg-white px-2.5 py-1 flex-row items-center">
                <View className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <Text className="text-[8px] font-black uppercase tracking-wider text-emerald-700">Live</Text>
              </View>
            </View>

            <View className="flex-row items-start justify-between">
              {liveSteps.map((step, index) => (
                <View key={step.label} className="flex-1 items-center">
                  <View className="w-full flex-row items-center">
                    {index > 0 && (
                      <View className={`h-0.5 flex-1 ${liveSteps[index - 1].done && step.done ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                    )}
                    <View className={`h-8 w-8 items-center justify-center rounded-full border ${step.done ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-200'}`}>
                      <MaterialCommunityIcons name={step.icon} size={14} color={step.done ? '#ffffff' : '#94a3b8'} />
                    </View>
                    {index < liveSteps.length - 1 && (
                      <View className={`h-0.5 flex-1 ${step.done && liveSteps[index + 1].done ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                    )}
                  </View>
                  <Text className={`mt-2 text-center text-[7.5px] font-black uppercase tracking-tighter ${step.done ? 'text-emerald-700' : 'text-slate-400'}`} numberOfLines={1}>
                    {step.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View className="rounded-[1.5rem] border border-slate-100 bg-white p-4">
            <View className="mb-3 flex-row items-center justify-between">
              <View className="flex-row items-center flex-1 pr-3">
                <View className="h-9 w-9 items-center justify-center rounded-full bg-slate-900">
                  <MaterialCommunityIcons name="script-text-outline" size={18} color="#34d399" />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-[9px] font-black uppercase tracking-[2px] text-slate-400">Bill Summary</Text>
                  <Text className="text-xs font-black text-slate-900" numberOfLines={1}>
                    Offer details from pharmacy
                  </Text>
                </View>
              </View>
              <View className="items-end max-w-[154px]">
                {isBestDealOrder && (
                  <View className="mb-2">
                    <OrderBestDealBadge savings={item.best_deal?.savings} />
                  </View>
                )}
                <Text className="text-right text-lg font-black text-emerald-700" numberOfLines={1}>
                  {formatCurrency(item.total_amount)}
                </Text>
              </View>
            </View>

            <View className="flex-row items-center gap-2">
              <TouchableOpacity
                onPress={() => openOrderDetails(item.id)}
                className="flex-1 rounded-[1rem] border border-slate-200 bg-slate-50 px-3 py-3 flex-row items-center justify-center"
              >
                <MaterialCommunityIcons name="text-box-search-outline" size={18} color="#059669" />
                <Text className="ml-1.5 text-[11px] font-black uppercase tracking-[2px] text-slate-800">
                  Details
                </Text>
              </TouchableOpacity>
              {imageUrl && (
                <TouchableOpacity
                  onPress={() => setSelectedImage(imageUrl)}
                  className="h-11 w-11 items-center justify-center rounded-[1rem] border border-slate-200 bg-slate-50"
                >
                  <MaterialCommunityIcons name="file-image-outline" size={18} color="#64748b" />
                </TouchableOpacity>
              )}
            </View>

            {!!item.response_text && (
              <View className="mt-3 rounded-[1rem] border border-emerald-100 bg-emerald-50/60 px-3 py-3">
                <Text className="mb-1 text-[9px] font-black uppercase tracking-[2px] text-emerald-700">Pharmacy Note</Text>
                <Text className="text-xs font-semibold leading-5 text-slate-700" numberOfLines={3}>
                  {item.response_text}
                </Text>
              </View>
            )}
          </View>

          <View className="mt-4 flex-row items-center gap-2">
            {canContactStore && (
              <>
                <TouchableOpacity
                  onPress={() => initiateChat(item)}
                  className="h-11 w-11 items-center justify-center rounded-[1rem] border border-slate-200 bg-slate-50"
                >
                  <MaterialCommunityIcons name="chat-outline" size={18} color="#64748b" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => item.store_contact ? Linking.openURL(`tel:${item.store_contact}`) : Toast.show({ type: 'info', text1: 'Contact not available', position: 'bottom' })}
                  className="h-11 w-11 items-center justify-center rounded-[1rem] border border-emerald-200 bg-emerald-50"
                >
                  <MaterialCommunityIcons name="phone" size={18} color="#059669" />
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity onPress={() => openReportModal(item)} className="h-11 w-11 items-center justify-center rounded-[1rem] border border-red-100 bg-red-50">
              <MaterialCommunityIcons name="flag-outline" size={16} color="#ef4444" />
              {pharmacyReportCount > 0 && (
                <View className="absolute -right-1 -top-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 items-center justify-center">
                  <Text className="text-white font-black text-[8px]">{pharmacyReportCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => raiseComplaint(item)}
              className="h-11 flex-1 flex-row items-center justify-center rounded-[1rem] border border-amber-200 bg-amber-50 px-3"
            >
              <MaterialCommunityIcons name="alert-box-outline" size={16} color="#b45309" />
              <Text className="ml-1.5 text-[9px] font-black uppercase tracking-[1.2px] text-amber-700">Raise Complaint</Text>
            </TouchableOpacity>
          </View>

          {canCancelOrder && (
            <TouchableOpacity
              onPress={() => openCancelModal(item)}
              className="mt-3 rounded-[1.15rem] border border-red-100 bg-red-50 py-3 flex-row justify-center items-center"
            >
              <MaterialCommunityIcons name="close-circle-outline" size={16} color="#ef4444" />
              <Text className="ml-1.5 text-[10px] font-black uppercase tracking-[1.6px] text-red-500">
                {statusKey === 'processing' ? 'Cancel Order (Reason Required)' : 'Cancel Order'}
              </Text>
            </TouchableOpacity>
          )}

          {statusKey === 'cancelled' && item.cancel_reason && (
            <View className="mt-3 rounded-[1rem] border border-red-100 bg-red-50 p-3">
              <Text className="mb-1 text-[8px] font-black uppercase tracking-[1.8px] text-red-700">
                {item.cancelled_by === 'store' ? 'Cancelled by Store' : item.cancelled_by === 'user' ? 'Cancelled by You' : 'Cancellation Reason'}
              </Text>
              <Text className="text-xs font-semibold italic text-red-900">{'"'}{item.cancel_reason}{'"'}</Text>
            </View>
          )}

          {statusKey === 'completed' && (
            <TouchableOpacity onPress={() => router.push(`/pharmacist/order/${item.id}`)} className="mt-4 rounded-[1.15rem] border border-blue-100 bg-blue-50 py-4 flex-row justify-center items-center">
              <MaterialCommunityIcons name="account-question-outline" size={18} color="#2563eb" />
              <Text className="ml-2 text-[10px] font-black uppercase tracking-[1.5px] text-blue-700">Ask the Store Pharmacist</Text>
            </TouchableOpacity>
          )}

          {statusKey === 'completed' && (
            <View className="mt-3 flex-row gap-2">
              {!item.user_rating && item.is_ratable && (
                <TouchableOpacity
                  onPress={() => { setRatingOrderTarget(item); setRatingModalVisible(true); }}
                  className="flex-1 rounded-[1.25rem] border border-emerald-100 bg-emerald-50 py-4 flex-row justify-center items-center"
                >
                  <MaterialCommunityIcons name="star-outline" size={18} color="#059669" />
                  <Text className="ml-2 text-[10px] font-black uppercase tracking-[1.6px] text-emerald-700">Rate Store</Text>
                </TouchableOpacity>
              )}
              {canOrderAgain && (
                <TouchableOpacity
                  onPress={() => confirmOrderAgain(item)}
                  disabled={orderAgainLoadingId === item.id}
                  className={`flex-1 rounded-[1.25rem] py-4 flex-row justify-center items-center border ${orderAgainLoadingId === item.id ? 'bg-slate-100 border-slate-200' : 'bg-slate-900 border-slate-800'}`}
                >
                  {orderAgainLoadingId === item.id ? (
                    <ActivityIndicator size="small" color="#059669" />
                  ) : (
                    <MaterialCommunityIcons name="repeat" size={18} color="#34d399" />
                  )}
                  <Text className={`font-black text-[10px] uppercase tracking-[1.6px] ml-2 ${orderAgainLoadingId === item.id ? 'text-slate-500' : 'text-white'}`}>
                    Order Again
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {statusKey === 'completed' && item.can_request_replacement && (
            <TouchableOpacity
              onPress={() => { setReplaceTargetOrder(item); setReplaceModalVisible(true); }}
              className="mt-3 rounded-[1.25rem] border border-orange-200 bg-orange-50 py-4 flex-row justify-center items-center"
            >
              <MaterialCommunityIcons name="package-variant-closed" size={18} color="#ea580c" />
              <Text className="ml-2 font-black text-[10px] uppercase tracking-[1.6px] text-orange-700">
                Replace Medicine
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderSkeleton = () => (
    <View className="px-5 pt-8">
      {[1, 2, 3].map((item) => (
        <View key={item} className="bg-white rounded-[2rem] mb-5 border border-slate-200/70 shadow-xl shadow-slate-200/50 overflow-hidden">
          <LinearGradient colors={['#0f172a', '#1e293b', '#064e3b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} className="h-16" />
          <View className="p-5">
            <View className="flex-row items-center mb-4">
              <View className="w-16 h-16 rounded-[1.35rem] bg-slate-100" />
              <View className="ml-4 flex-1">
                <View className="h-3 w-28 bg-slate-100 rounded-full mb-3" />
                <View className="h-5 w-36 bg-slate-200 rounded-full" />
              </View>
            </View>
            <View className="h-20 bg-slate-50 rounded-[1.5rem] border border-slate-100" />
          </View>
        </View>
      ))}
    </View>
  );

  return (
    <View className="flex-1 bg-slate-100">
      <View className="relative overflow-hidden z-50">
        <LinearGradient
          colors={['#0f172a', '#1e293b', '#064e3b']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="absolute inset-0 rounded-bl-[5rem] rounded-br-[8rem]"
        />
        <View className="pt-16 pb-8 px-6 relative z-10">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center flex-1 mr-4">
              <TouchableOpacity
                onPress={() => router.back()}
                className="w-12 h-12 rounded-[1.25rem] bg-white/10 border border-white/10 items-center justify-center mr-4"
              >
                <MaterialCommunityIcons name="arrow-left" size={22} color="#ffffff" />
              </TouchableOpacity>
              <View className="flex-1">
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 28, fontWeight: '900', color: '#ffffff', letterSpacing: 2.5, lineHeight: 34 }}>
                    ORDERS
                  </Text>
                  <View style={{ width: 1.5, height: 32, backgroundColor: '#34d399', marginHorizontal: 9, borderRadius: 2, opacity: 0.8 }} />
                  <View style={{ justifyContent: 'center' }}>
                    <Text style={{ fontSize: 9, fontWeight: '800', color: '#34d399', letterSpacing: 2, textTransform: 'uppercase', lineHeight: 13 }}>{activeOrderSectionOption.label}</Text>
                    <Text style={{ fontSize: 9, fontWeight: '800', color: '#ffffff', letterSpacing: 1.5, textTransform: 'uppercase', lineHeight: 13 }}>Records</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 6.5, fontWeight: '500', color: 'rgba(255,255,255,0.45)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 }}>
                  Quotation & Walk-In Timeline
                </Text>
              </View>
            </View>
            <View className="flex-row items-center gap-2">
              <TouchableOpacity
                onPress={() => setOrderMenuVisible(true)}
                className="w-12 h-12 rounded-[1.2rem] bg-white/10 border border-white/10 items-center justify-center"
              >
                <MaterialCommunityIcons name="menu" size={24} color="#ffffff" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => fetchOrders()}
                className="w-12 h-12 rounded-[1.2rem] bg-white/10 border border-white/10 items-center justify-center"
              >
                <MaterialCommunityIcons name="refresh" size={21} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      <View className="px-5 -mt-4 mb-1 z-40">
        <View className="rounded-[1.25rem] bg-white border border-slate-200 shadow-lg shadow-slate-200/50 px-3 py-2 flex-row items-center">
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => shiftSelectedDate(-1)}
            className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-100 items-center justify-center"
          >
            <MaterialCommunityIcons name="chevron-left" size={22} color="#0f172a" />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={resetSelectedDate}
            className="flex-1 mx-3 items-center justify-center"
          >
            <Text className="text-[9px] font-black uppercase tracking-[2px] text-emerald-600" numberOfLines={1}>
              {isSelectedDateToday ? 'Today Orders' : 'Selected Date'}
            </Text>
            <Text className="mt-0.5 text-sm font-black text-slate-900" numberOfLines={1}>
              {selectedDateLabel}
            </Text>
            <Text className="mt-0.5 text-[10px] font-bold text-slate-400" numberOfLines={1}>
              {sortedOrders.length} {activeOrderSectionOption.label.toLowerCase()} {sortedOrders.length === 1 ? 'order' : 'orders'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => shiftSelectedDate(1)}
            disabled={!canGoNextDate}
            className={`w-10 h-10 rounded-2xl border items-center justify-center ${canGoNextDate ? 'bg-slate-50 border-slate-100' : 'bg-slate-50/50 border-slate-100/60'}`}
          >
            <MaterialCommunityIcons name="chevron-right" size={22} color={canGoNextDate ? '#0f172a' : '#cbd5e1'} />
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={orderMenuVisible} transparent animationType="fade" onRequestClose={() => setOrderMenuVisible(false)}>
        <View className="flex-1">
          <TouchableOpacity activeOpacity={1} onPress={() => setOrderMenuVisible(false)} className="absolute inset-0 bg-black/5" />
          <View className="absolute right-5 top-[170px] w-[236px] overflow-hidden rounded-[1.15rem] border border-slate-200 bg-white shadow-xl shadow-slate-300/50">
            <View className="border-b border-slate-100 px-4 py-3">
              <Text className="text-[10px] font-black uppercase tracking-[1.4px] text-slate-400">Order Status</Text>
            </View>
            {ORDER_SECTION_OPTIONS.map((option) => {
              const selected = orderSection === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  activeOpacity={0.86}
                  onPress={() => { setOrderSection(option.key); setOrderMenuVisible(false); }}
                  style={{ backgroundColor: selected ? option.bg : '#ffffff' }}
                  className="flex-row items-center border-b border-slate-100 px-4 py-3.5"
                >
                  <View style={{ backgroundColor: selected ? '#ffffff' : option.bg }} className="h-10 w-10 items-center justify-center rounded-xl">
                    <MaterialCommunityIcons name={option.icon as any} size={20} color={option.color} />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="text-[12px] font-black text-slate-950" numberOfLines={1}>{option.label}</Text>
                    <Text className="mt-0.5 text-[8px] font-black uppercase tracking-[0.8px] text-slate-400" numberOfLines={1}>
                      {orderSectionCounts[option.key]} records
                    </Text>
                  </View>
                  {selected && <MaterialCommunityIcons name="check-circle" size={18} color={option.color} />}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity onPress={() => { setOrderMenuVisible(false); router.push("/replacements"); }} className="flex-row items-center bg-orange-50 px-4 py-3.5">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-white"><MaterialCommunityIcons name="package-variant-closed" size={20} color="#ea580c" /></View>
              <View className="ml-3"><Text className="text-[12px] font-black text-slate-950">My Replacements</Text><Text className="mt-0.5 text-[8px] font-black uppercase text-orange-500">Track and manage requests</Text></View>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {loading && sortedOrders.length === 0 ? (
        renderSkeleton()
      ) : (
        <FlatList
          data={sortedOrders}
          renderItem={renderOrderCard}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 28, paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#059669" />}
          ListEmptyComponent={
            <View className="mt-28 items-center px-8">
              <View className="w-24 h-24 rounded-[2rem] bg-white border border-slate-200 items-center justify-center shadow-xl shadow-slate-200/60">
                <MaterialCommunityIcons name={error ? 'alert-circle-outline' : 'shopping-outline'} size={42} color={error ? '#dc2626' : '#cbd5e1'} />
              </View>
              <Text className="text-slate-900 text-xl font-black mt-7 text-center">
                {error ? 'Orders unavailable' : `No ${activeOrderSectionOption.label.toLowerCase()} orders`}
              </Text>
              <Text className="text-slate-400 text-xs font-semibold leading-5 text-center mt-2">
                {error || (isSelectedDateToday ? `Today ${activeOrderSectionOption.label.toLowerCase()} orders will appear here.` : `${selectedDateLabel} ${activeOrderSectionOption.label.toLowerCase()} orders will appear here.`)}
              </Text>
            </View>
          }
          ListFooterComponent={loading && sortedOrders.length > 0 ? <ActivityIndicator color="#059669" className="py-6" /> : <View className="h-6" />}
        />
      )}

      <Modal visible={!!selectedImage} transparent animationType="fade">
        <View className="flex-1 bg-black justify-center items-center">
          <BlurView intensity={45} tint="dark" className="absolute inset-0" />
          <TouchableOpacity onPress={() => setSelectedImage(null)} className="absolute top-20 right-8 z-50 bg-white/10 p-4 rounded-full">
            <MaterialCommunityIcons name="close" size={28} color="white" />
          </TouchableOpacity>
          {selectedImage && <View className="w-full h-[75%]"><RemoteImageWithStatus uri={selectedImage} resizeMode="contain" loadingLabel="Opening order image" /></View>}
        </View>
      </Modal>

      <Modal animationType="fade" transparent visible={cancelModalVisible} onRequestClose={() => setCancelModalVisible(false)}>
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
                <Text className="text-amber-700 text-xs font-bold mb-1">Order is processing</Text>
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
                placeholder="e.g. Changed my mind..."
                placeholderTextColor="#94a3b8"
                className="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-gray-900 text-sm font-medium"
                multiline
                numberOfLines={3}
                style={{ textAlignVertical: 'top' }}
              />
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity onPress={() => setCancelModalVisible(false)} className="flex-1 py-4 bg-gray-100 rounded-[1.25rem] items-center">
                <Text className="text-gray-700 font-bold text-xs uppercase tracking-widest">Keep Order</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCancelOrder} disabled={cancelLoading} className="flex-1 py-4 bg-red-500 rounded-[1.25rem] items-center">
                {cancelLoading ? <ActivityIndicator size="small" color="white" /> : <Text className="text-white font-bold text-xs uppercase tracking-widest">Cancel Order</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal animationType="fade" transparent visible={replaceModalVisible} onRequestClose={() => setReplaceModalVisible(false)}>
        <View className="flex-1 bg-gray-950/70 justify-center px-6">
          <View className="bg-white rounded-[2.5rem] p-8 shadow-2xl">
            <View className="items-center mb-6">
              <View className="w-14 h-14 bg-orange-50 rounded-[1.5rem] items-center justify-center mb-4">
                <MaterialCommunityIcons name="package-variant-closed" size={28} color="#ea580c" />
              </View>
              <Text className="text-xl font-black text-gray-900 tracking-tighter">Replace Medicine</Text>
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                Select reason and provide details
              </Text>
            </View>

            <View className="mb-4">
              <Text className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Reason</Text>
              <View className="flex-row flex-wrap gap-2">
                {[
                  { id: 'wrong_medicine', label: 'Wrong Medicine' },
                  { id: 'expired_medicine', label: 'Expired' },
                  { id: 'damaged', label: 'Damaged' },
                  { id: 'other', label: 'Other' },
                ].map((r) => (
                  <TouchableOpacity
                    key={r.id}
                    onPress={() => setReplaceReason(r.id)}
                    className={`px-3 py-2 rounded-xl border ${replaceReason === r.id ? 'bg-orange-600 border-orange-600' : 'bg-gray-50 border-gray-100'}`}
                  >
                    <Text className={`font-bold text-[10px] uppercase tracking-wide ${replaceReason === r.id ? 'text-white' : 'text-gray-400'}`}>
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View className="mb-6">
              <Text className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">
                Details (Optional)
              </Text>
              <TextInput
                value={replaceNote}
                onChangeText={setReplaceNote}
                placeholder="Describe the issue..."
                placeholderTextColor="#94a3b8"
                className="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-gray-900 text-sm font-medium"
                multiline
                numberOfLines={3}
                style={{ textAlignVertical: 'top' }}
              />
            </View>

            <TouchableOpacity onPress={pickReplacementProof} className="mb-5 flex-row items-center justify-center rounded-2xl border border-dashed border-orange-200 bg-orange-50 py-3">
              <MaterialCommunityIcons name={replaceProof ? "check-circle" : "camera-plus-outline"} size={19} color="#ea580c" />
              <Text className="ml-2 text-xs font-black text-orange-700">{replaceProof ? 'Proof attached' : 'Attach proof image (optional)'}</Text>
            </TouchableOpacity>

            <View className="flex-row gap-3">
              <TouchableOpacity onPress={() => { setReplaceModalVisible(false); setReplaceProof(null); }} className="flex-1 py-4 bg-gray-100 rounded-[1.25rem] items-center">
                <Text className="text-gray-700 font-bold text-xs uppercase tracking-widest">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleReplaceOrder} disabled={replaceLoading} className="flex-1 py-4 bg-orange-600 rounded-[1.25rem] items-center">
                {replaceLoading ? <ActivityIndicator size="small" color="white" /> : <Text className="text-white font-bold text-xs uppercase tracking-widest">Submit</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={modalReportVisible} animationType="slide" onRequestClose={() => setReportModalVisible(false)}>
        <View className="flex-1 justify-end bg-slate-950/40">
          <TouchableOpacity activeOpacity={1} onPress={() => setReportModalVisible(false)} className="absolute inset-0" />
          <View className="bg-white rounded-t-[2.25rem] w-full max-h-[78%] shadow-2xl overflow-hidden border border-gray-100">
            <LinearGradient colors={['#020617', '#0f172a', '#7f1d1d']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <View className="items-center pt-3 pb-1"><View className="w-12 h-1.5 rounded-full bg-white/20" /></View>
              <View className="px-7 pb-6 pt-4 flex-row justify-between items-center">
                <View>
                  <Text className="text-xl font-black text-white tracking-tighter uppercase">Report Portal</Text>
                  <Text className="text-[9px] font-bold text-red-400 uppercase tracking-[3px] mt-1">Order Issue</Text>
                </View>
                <TouchableOpacity onPress={() => setReportModalVisible(false)} className="bg-white/10 p-2.5 rounded-xl"><MaterialCommunityIcons name="close" size={18} color="white" /></TouchableOpacity>
              </View>
            </LinearGradient>

            <ScrollView className="flex-1" contentContainerStyle={{ padding: 28, paddingTop: 32, paddingBottom: 32 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {storeReportCount > 0 && (
                <View className="mb-5 p-5 bg-amber-50 rounded-[1.75rem] border border-amber-100">
                  <View className="flex-row items-center justify-between mb-3">
                    <Text className="text-amber-700 font-black text-[8px] uppercase tracking-[2px]">Pharmacy Reports</Text>
                    <Text className="text-amber-700 font-black text-[10px]">{storeReportCount}</Text>
                  </View>
                  {storeReports.map((note, index) => (
                    <View key={`${note.created_at}-${index}`} className="mb-3 border-l-2 border-amber-500/30 pl-3">
                      <Text className="text-amber-950 font-bold text-[12px] leading-4">{note.note}</Text>
                      <Text className="text-amber-600/70 font-black text-[8px] uppercase tracking-widest mt-1">{note.store_name || 'Pharmacy'} • {note.created_at}</Text>
                    </View>
                  ))}
                </View>
              )}

              {reportCount > 0 && (
                <View className="mb-6 p-5 bg-slate-50 rounded-[1.75rem] border border-slate-100">
                  <View className="flex-row items-center justify-between mb-3">
                    <Text className="text-slate-500 font-black text-[8px] uppercase tracking-[2px]">Your Reports</Text>
                    <Text className="text-red-500 font-black text-[10px]">{reportCount}</Text>
                  </View>
                  {userReports.map((note, index) => (
                    <View key={`${note.created_at}-${index}`} className="mb-3 border-l-2 border-red-500/20 pl-3">
                      <Text className="text-slate-900 font-bold text-[12px] leading-4">{note.note}</Text>
                      <Text className="text-slate-400 font-bold text-[8px] uppercase tracking-widest mt-1">{note.created_at}</Text>
                    </View>
                  ))}
                </View>
              )}

              <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-[3px] mb-5 ml-1">Issue Category</Text>
              <View className="flex-row flex-wrap gap-2.5 mb-8">
                {predefinedReportReasons.map((r) => (
                  <TouchableOpacity key={r} onPress={() => setSelectedReason(r)} className={`px-5 py-3 rounded-xl border ${selectedReason === r ? 'bg-red-600 border-red-600 shadow-xl shadow-red-200' : 'bg-gray-50 border-gray-100 shadow-sm shadow-gray-50'}`}>
                    <Text className={`font-bold text-[10px] uppercase tracking-wide ${selectedReason === r ? 'text-white' : 'text-gray-400'}`}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View className="bg-gray-50/80 p-6 rounded-[1.75rem] border border-gray-100 mb-8">
                <Text className="text-[8px] font-bold text-gray-400 uppercase tracking-[2px] mb-3">Narrative Context</Text>
                <TextInput placeholder="Provide context..." placeholderTextColor="#cbd5e1" className="text-gray-950 font-bold text-[14px] min-h-[100px]" multiline value={noteText} onChangeText={setNoteText} textAlignVertical="top" />
              </View>

              <TouchableOpacity onPress={submitContactNote} className="bg-red-600 py-5 rounded-[1.75rem] items-center shadow-2xl shadow-red-200">
                <Text className="text-white font-black uppercase text-xs tracking-[4px]">Submit Issue</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!selectedDetailsOrder}
        transparent
        animationType="slide"
        onRequestClose={closeOrderDetails}
      >
        <View className="flex-1 justify-end bg-black/45">
          <TouchableOpacity className="flex-1" activeOpacity={1} onPress={closeOrderDetails} />
          <View className="max-h-[82%] rounded-t-[2rem] bg-white px-5 pb-8 pt-3">
            <View className="mb-4 items-center">
              <View className="h-1.5 w-12 rounded-full bg-slate-200" />
            </View>

            {selectedDetailsOrder && (
              <>
                <View className="mb-4 flex-row items-start justify-between">
                  <View className="flex-1 pr-4">
                    <Text className="text-[9px] font-black uppercase tracking-[2px] text-slate-400">Order Details</Text>
                    <Text className="mt-1 text-lg font-black text-slate-900" numberOfLines={1}>
                      {selectedDetailsOrder.store_name || 'Pharmacy Store'}
                    </Text>
                    <Text className="mt-1 text-[10px] font-bold text-slate-400" numberOfLines={1}>
                      {formatOrderDate(selectedDetailsOrder.updated_at || selectedDetailsOrder.created_at)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={closeOrderDetails}
                    className="h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50"
                  >
                    <MaterialCommunityIcons name="close" size={20} color="#0f172a" />
                  </TouchableOpacity>
                </View>

                <View className="mb-4 rounded-[1.25rem] border border-emerald-100 bg-emerald-50/70 px-4 py-3 flex-row items-center justify-between">
                  <View>
                    <Text className="text-[9px] font-black uppercase tracking-[2px] text-emerald-700">Total Amount</Text>
                    <Text className="mt-1 text-[10px] font-bold text-slate-500">Item-wise pharmacy quote</Text>
                  </View>
                  <View className="items-end max-w-[160px]">
                    {selectedDetailsOrder.best_deal?.is_best && (
                      <View className="mb-2 rounded-full border border-emerald-200 bg-white px-2 py-1 flex-row items-center">
                        <MaterialCommunityIcons name="trophy-award" size={11} color="#059669" />
                        <Text className="ml-1 text-[7.5px] font-black uppercase tracking-[0.8px] text-emerald-700" numberOfLines={1}>
                          {Number(selectedDetailsOrder.best_deal?.savings || 0) > 0 ? 'Save ₹' + selectedDetailsOrder.best_deal?.savings : 'Best Deal'}
                        </Text>
                      </View>
                    )}
                    <Text className="text-right text-xl font-black text-emerald-700" numberOfLines={1}>
                      {formatCurrency(selectedDetailsOrder.total_amount)}
                    </Text>
                  </View>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  {renderMedicineDetails(selectedDetailsOrder)}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={storeReviewsVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setStoreReviewsVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/60">
          <View className="max-h-[85%] rounded-t-[2rem] bg-white pb-8">
            <View className="flex-row items-center justify-between border-b border-slate-100 px-6 py-5">
              <View className="flex-1 pr-4">
                <Text className="text-lg font-black text-slate-900" numberOfLines={1}>{currentStoreName || 'Pharmacy Store'}</Text>
                <Text className="mt-1 text-[10px] font-bold uppercase tracking-[2.5px] text-slate-400">Customer Reviews</Text>
              </View>
              <TouchableOpacity onPress={() => setStoreReviewsVisible(false)} className="h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
                <MaterialCommunityIcons name="close" size={20} color="#0f172a" />
              </TouchableOpacity>
            </View>

            {currentReviewStoreItem && (() => {
              const modalHighlights = Array.from(new Set([
                ...(currentReviewStoreItem.trust_signal ? [currentReviewStoreItem.trust_signal] : []),
                ...(currentReviewStoreItem.store_badges || []),
                ...(currentReviewStoreItem.smart_tags || []),
              ].filter(Boolean))).slice(0, 6);

              if (modalHighlights.length === 0) return null;

              return (
                <View className="border-b border-slate-100 bg-slate-50 px-6 py-4">
                  <Text className="mb-3 text-[9px] font-black uppercase tracking-[2px] text-slate-400">Store Badges & Highlights</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {modalHighlights.map((badge, index) => {
                      const meta = getStoreBadgeMeta(String(badge));
                      return (
                        <View key={`${badge}-${index}`} className={`rounded-full border px-3 py-1.5 flex-row items-center ${meta.bg} ${meta.border}`}>
                          <MaterialCommunityIcons name={meta.icon as any} size={12} color={meta.iconColor} />
                          <Text className={`ml-1.5 text-[9px] font-black uppercase tracking-wider ${meta.text}`}>{badge}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })()}

            {reviewsLoading ? (
              <View className="h-64 items-center justify-center p-10">
                <ActivityIndicator size="large" color="#059669" />
              </View>
            ) : currentStoreReviews.length === 0 ? (
              <View className="h-64 items-center justify-center p-10">
                <MaterialCommunityIcons name="star-outline" size={44} color="#cbd5e1" />
                <Text className="mt-4 text-sm font-black text-slate-400">No reviews yet</Text>
              </View>
            ) : (
              <FlatList
                data={currentStoreReviews}
                keyExtractor={(review, index) => `${review.id || index}`}
                contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
                renderItem={({ item: review }) => (
                  <View className="mb-4 rounded-[1.5rem] border border-slate-100 bg-slate-50 p-5">
                    <View className="mb-3 flex-row items-center justify-between">
                      <View className="flex-row items-center flex-1 pr-3">
                        <View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-slate-200">
                          <Text className="text-xs font-black text-slate-600">{review.user_name?.charAt(0) || 'A'}</Text>
                        </View>
                        <View className="flex-1">
                          <Text className="text-xs font-black text-slate-900" numberOfLines={1}>{review.user_name || 'Anonymous'}</Text>
                          <Text className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                            {review.created_at ? new Date(review.created_at).toLocaleDateString() : 'Recent'}
                          </Text>
                        </View>
                      </View>
                      <View className="flex-row items-center rounded-md border border-emerald-100 bg-emerald-50 px-2 py-1">
                        <Text className="mr-1 text-[10px] font-black text-emerald-700">{review.rating || '5'}</Text>
                        <MaterialCommunityIcons name="star" size={10} color="#059669" />
                      </View>
                    </View>
                    <Text className="text-xs font-semibold leading-5 text-slate-700">
                      {'"'}{review.review || 'No written review provided'}{'"'}
                    </Text>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      <RatingBottomSheet
        isVisible={ratingModalVisible}
        onClose={() => setRatingModalVisible(false)}
        orderId={ratingOrderTarget?.id || 0}
        raterType="user"
        orderStatus={ratingOrderTarget?.user_status || ''}
        cancelledBy={ratingOrderTarget?.cancelled_by || undefined}
        onSuccess={() => fetchOrders(false)}
      />
      <Toast />
    </View>
  );
}
