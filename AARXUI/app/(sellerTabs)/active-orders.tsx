import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/Language/LocalizedPrimitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  View
} from 'react-native';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';
import Toast from 'react-native-toast-message';
import { useDispatch, useSelector } from 'react-redux';
import DetailsSheet from '../../orders/components/DetailsSheet';
import OrderCard from '../../orders/components/OrderCard';
import PipelineTabs from '../../orders/components/PipelineTabs';
import { isActiveOrder, isCancelledOrder, isCompletedOrder, ORDER_STAGE_CONFIG, PIPELINE_STAGES, resolveOrderStage } from '../../orders/helpers/orderWorkflow';
import { useOrderPipeline } from '../../orders/hooks/useOrderPipeline';
import type { PipelineOrder } from '../../orders/hooks/useOrderPipeline';
import { useSellerOrders } from '../../orders/hooks/useSellerOrders';
import type { OrderFilterMode, OrderStage, SellerOrder } from '../../orders/types';
import { AppDispatch, RootState } from '../../redux/store';
import { fetchUserProfile } from '../../redux/userSlice';
import DeliveryDestinationModal from '../../components/DeliveryDestinationModal';

const FILTER_OPTIONS: { key: OrderFilterMode; label: string; icon: string }[] = [
  { key: 'all', label: 'All', icon: 'view-grid-outline' },
  { key: 'pickup', label: 'Pickup', icon: 'walk' },
  { key: 'delivery', label: 'Delivery', icon: 'truck-delivery-outline' },
  { key: 'repeat', label: 'Repeat', icon: 'sync' },
  { key: 'otp', label: 'OTP', icon: 'shield-check-outline' },
];

type TerminalOrderStage = Extract<OrderStage, 'COMPLETED' | 'CANCELLED'>;
type DeliveryPerson = { id:number; name:string; mobile:string; vehicle_type:string; vehicle_number?:string; is_active:boolean; is_available:boolean; can_login:boolean; current_order_count:number; max_concurrent_orders:number };

const TERMINAL_ORDER_OPTIONS: { key: TerminalOrderStage; label: string; icon: string; color: string; bg: string }[] = [
  { key: 'COMPLETED', label: 'Completed', icon: 'check-decagram-outline', color: '#059669', bg: '#ecfdf5' },
  { key: 'CANCELLED', label: 'Cancelled', icon: 'close-octagon-outline', color: '#dc2626', bg: '#fef2f2' },
];

const ORDER_FILTER_STAGES: OrderStage[] = [...PIPELINE_STAGES, 'CANCELLED'];

const formatLocalDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getOrderDateValue = (order: SellerOrder) => {
  if (isCompletedOrder(order)) return order.completed_at || order.updated_at || order.accepted_at || order.created_at || null;
  if (isCancelledOrder(order)) return order.updated_at || order.accepted_at || order.created_at || null;
  return order.accepted_at || order.created_at || order.updated_at || null;
};

const getOrderDateKey = (order: SellerOrder) => {
  const value = getOrderDateValue(order);
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return formatLocalDateKey(date);
};

const getDateKeyTime = (dateKey: string) => new Date(`${dateKey}T00:00:00`).getTime() || 0;

const formatDateChipLabel = (dateKey: string, todayDateKey: string) => {
  if (dateKey === todayDateKey) return 'Today';
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

const formatFullDateLabel = (dateKey: string | null, fallback = 'Select date') => {
  if (!dateKey) return fallback;
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const normalizeRangeKeys = (startDateKey: string | null, endDateKey: string | null) => {
  if (!startDateKey && !endDateKey) return null;
  const startKey = startDateKey || endDateKey!;
  const endKey = endDateKey || startDateKey!;
  return getDateKeyTime(startKey) <= getDateKeyTime(endKey)
    ? { startKey, endKey }
    : { startKey: endKey, endKey: startKey };
};

const formatDateScopeLabel = (dateKey: string, todayDateKey: string, startDateKey: string | null, endDateKey: string | null) => {
  const range = normalizeRangeKeys(startDateKey, endDateKey);
  if (!range) return formatDateChipLabel(dateKey, todayDateKey);
  if (range.startKey === range.endKey) return formatDateChipLabel(range.startKey, todayDateKey);
  return `${formatDateChipLabel(range.startKey, todayDateKey)} - ${formatDateChipLabel(range.endKey, todayDateKey)}`;
};

const isDateKeyInRange = (dateKey: string, startDateKey: string | null, endDateKey: string | null) => {
  const range = normalizeRangeKeys(startDateKey, endDateKey);
  if (!range) return false;
  const timestamp = getDateKeyTime(dateKey);
  return timestamp >= getDateKeyTime(range.startKey) && timestamp <= getDateKeyTime(range.endKey);
};

const orderMatchesStage = (order: SellerOrder, stage: OrderStage) => {
  if (stage === 'COMPLETED') return isCompletedOrder(order);
  if (stage === 'CANCELLED') return isCancelledOrder(order);
  return isActiveOrder(order) && (stage === 'ACTIVE' || resolveOrderStage(order).stage === stage);
};

const HeroIllustration = () => (
  <Svg width={190} height={118} viewBox="0 0 190 118">
    <Path d="M8 93 C45 79 69 86 101 74 C134 61 154 64 184 47 L184 118 L8 118 Z" fill="#08765f" opacity={0.36} />
    <G transform="translate(105 8)">
      <Rect x={18} y={0} width={44} height={64} rx={7} fill="#f8fafc" />
      <Rect x={28} y={0} width={24} height={7} rx={3} fill="#94a3b8" />
      <Path d="M28 22 l5 5 l11 -13" fill="none" stroke="#059669" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1={51} y1={23} x2={63} y2={23} stroke="#cbd5e1" strokeWidth={4} strokeLinecap="round" />
      <Path d="M28 43 l5 5 l11 -13" fill="none" stroke="#059669" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1={51} y1={44} x2={63} y2={44} stroke="#cbd5e1" strokeWidth={4} strokeLinecap="round" />
    </G>
    <G transform="translate(48 44)">
      <Path d="M0 19 L56 5 L112 19 L100 75 L14 75 Z" fill="#c99043" />
      <Path d="M0 19 L37 35 L14 75 Z" fill="#e4ad5d" />
      <Path d="M112 19 L75 35 L100 75 Z" fill="#b87a2e" />
      <Path d="M37 35 H75 L100 75 H14 Z" fill="#d89b49" />
      <Path d="M51 47 H62 M56.5 41 V53" fill="none" stroke="#007a5c" strokeWidth={6} strokeLinecap="round" />
    </G>
    <G transform="translate(70 31)">
      <Rect x={0} y={18} width={14} height={28} rx={3} fill="#f8fafc" />
      <Rect x={3} y={12} width={8} height={8} rx={2} fill="#94a3b8" />
      <Rect x={20} y={8} width={16} height={37} rx={4} fill="#eef2ff" />
      <Rect x={23} y={2} width={10} height={8} rx={2} fill="#94a3b8" />
      <Rect x={42} y={16} width={14} height={29} rx={3} fill="#dcfce7" />
      <Rect x={45} y={10} width={8} height={8} rx={2} fill="#94a3b8" />
    </G>
    <G transform="translate(144 52) rotate(8)">
      <Rect x={0} y={0} width={31} height={19} rx={7} fill="#263238" />
      <Rect x={7} y={5} width={17} height={7} rx={3} fill="#10b981" />
      <Rect x={16} y={16} width={14} height={44} rx={5} fill="#1f2937" />
    </G>
    <Circle cx={168} cy={22} r={22} fill="#0b8f6c" opacity={0.34} />
  </Svg>
);

export default function ActiveOrdersScreen() {
  const BASE_URL = Constants.expoConfig?.extra?.BASE_URL || '';
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const { user, token } = useSelector((state: RootState) => state.user);
  const [selectedOrder, setSelectedOrder] = useState<SellerOrder | null>(null);
  const [deliveryMapOrder, setDeliveryMapOrder] = useState<SellerOrder | null>(null);
  const [dispatchOrder, setDispatchOrder] = useState<SellerOrder | null>(null);
  const [deliveryPeople, setDeliveryPeople] = useState<DeliveryPerson[]>([]);
  const [selectedDeliveryPersonId, setSelectedDeliveryPersonId] = useState<number | null>(null);
  const [deliveryPeopleLoading, setDeliveryPeopleLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [completionOtpModalVisible, setCompletionOtpModalVisible] = useState(false);
  const [completionOtpTargetId, setCompletionOtpTargetId] = useState<number | null>(null);
  const [completionOtpInput, setCompletionOtpInput] = useState('');
  const [completionOtpLoading, setCompletionOtpLoading] = useState(false);
  const [storeCancelModalVisible, setStoreCancelModalVisible] = useState(false);
  const [storeCancelTargetId, setStoreCancelTargetId] = useState<number | null>(null);
  const [storeCancelReason, setStoreCancelReason] = useState('');
  const [storeCancelLoading, setStoreCancelLoading] = useState(false);
  const [todayDateKey] = useState(() => formatLocalDateKey(new Date()));
  const [selectedDateKey, setSelectedDateKey] = useState(() => formatLocalDateKey(new Date()));
  const [selectedStartDateKey, setSelectedStartDateKey] = useState<string | null>(null);
  const [selectedEndDateKey, setSelectedEndDateKey] = useState<string | null>(null);
  const [orderFilterSheetVisible, setOrderFilterSheetVisible] = useState(false);
  const [orderArchiveMenuVisible, setOrderArchiveMenuVisible] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'single' | 'start' | 'end' | null>(null);

  const { stage: stageParam, focus: focusParam, orderId: orderIdParam } = useLocalSearchParams<{ stage?: string; focus?: string; orderId?: string }>();

  useEffect(() => {
    if (!token || !user) dispatch(fetchUserProfile());
  }, [dispatch, token, user]);

  const openOtpModal = useCallback((responseId: number) => {
    setCompletionOtpTargetId(responseId);
    setCompletionOtpInput('');
    setCompletionOtpModalVisible(true);
  }, []);

  const sellerOrders = useSellerOrders({ baseUrl: BASE_URL, token, onOtpRequired: openOtpModal });
  const selectedDateOrders = useMemo(() => (
    sellerOrders.orders.filter((order) => {
      const orderDateKey = getOrderDateKey(order);
      if (!orderDateKey) return false;
      if (selectedStartDateKey || selectedEndDateKey) {
        return isDateKeyInRange(orderDateKey, selectedStartDateKey, selectedEndDateKey);
      }
      return orderDateKey === selectedDateKey;
    })
  ), [sellerOrders.orders, selectedDateKey, selectedEndDateKey, selectedStartDateKey]);
  const pipeline = useOrderPipeline(selectedDateOrders);

  const selectedDateLabel = useMemo(
    () => formatDateScopeLabel(selectedDateKey, todayDateKey, selectedStartDateKey, selectedEndDateKey),
    [selectedDateKey, selectedEndDateKey, selectedStartDateKey, todayDateKey]
  );
  const dateBadges = useMemo(() => {
    const badgeMap = new Map<string, { key: string; count: number; timestamp: number }>();

    const ensureBadge = (dateKey: string) => {
      if (!badgeMap.has(dateKey)) {
        badgeMap.set(dateKey, { key: dateKey, count: 0, timestamp: getDateKeyTime(dateKey) });
      }
      return badgeMap.get(dateKey)!;
    };

    sellerOrders.orders.forEach((order) => {
      if (!orderMatchesStage(order, pipeline.activeStage)) return;
      const orderDateKey = getOrderDateKey(order);
      if (!orderDateKey) return;
      ensureBadge(orderDateKey).count += 1;
    });

    ensureBadge(todayDateKey);
    ensureBadge(selectedDateKey);
    if (selectedStartDateKey) ensureBadge(selectedStartDateKey);
    if (selectedEndDateKey) ensureBadge(selectedEndDateKey);

    return Array.from(badgeMap.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 12);
  }, [pipeline.activeStage, selectedDateKey, selectedEndDateKey, selectedStartDateKey, sellerOrders.orders, todayDateKey]);

  useEffect(() => {
    const stageValue = Array.isArray(stageParam) ? stageParam[0] : stageParam;
    const normalizedStage = stageValue?.toUpperCase() as OrderStage | undefined;

    pipeline.setFilterMode('all');
    pipeline.setSearchQuery('');
    if (normalizedStage && ORDER_FILTER_STAGES.includes(normalizedStage)) {
      pipeline.setActiveStage(normalizedStage);
    }
    sellerOrders.fetchOrders(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusParam, orderIdParam, stageParam]);

  useEffect(() => {
    const orderIdValue = Number(Array.isArray(orderIdParam) ? orderIdParam[0] : orderIdParam);
    if (!Number.isFinite(orderIdValue) || orderIdValue <= 0) return;

    const focusedOrder = sellerOrders.orders.find(
      (order) => Number(order.response_id || order.id) === orderIdValue
    );
    if (!focusedOrder) return;

    const orderDateKey = getOrderDateKey(focusedOrder);
    if (orderDateKey) jumpToDate(orderDateKey);

    const stageValue = Array.isArray(stageParam) ? stageParam[0] : stageParam;
    const normalizedStage = stageValue?.toUpperCase() as OrderStage | undefined;
    pipeline.setFilterMode('all');
    pipeline.setSearchQuery('');
    pipeline.setActiveStage(
      normalizedStage && ORDER_FILTER_STAGES.includes(normalizedStage)
        ? normalizedStage
        : resolveOrderStage(focusedOrder).stage
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusParam, orderIdParam, sellerOrders.orders, stageParam]);

  const selectedOrderPriority = useMemo(() => {
    if (!selectedOrder) return undefined;
    return pipeline.visibleOrders.find(({ order }) => (order.response_id || order.id) === (selectedOrder.response_id || selectedOrder.id))?.priority;
  }, [pipeline.visibleOrders, selectedOrder]);

  const verifyCompletionOtp = useCallback(async () => {
    if (!completionOtpTargetId || completionOtpInput.trim().length < 4) {
      Toast.show({ type: 'error', text1: 'Enter OTP', text2: 'Ask customer for the OTP shown in their app.', position: 'bottom' });
      return;
    }
    setCompletionOtpLoading(true);
    const ok = await sellerOrders.verifyCompletionOtp(completionOtpTargetId, completionOtpInput);
    setCompletionOtpLoading(false);
    if (ok) {
      setCompletionOtpModalVisible(false);
      setCompletionOtpTargetId(null);
      setCompletionOtpInput('');
    }
  }, [completionOtpInput, completionOtpTargetId, sellerOrders]);

  const handleStoreCancel = useCallback((order: SellerOrder) => {
    setStoreCancelTargetId(order.response_id || order.id);
    setStoreCancelReason('');
    setStoreCancelModalVisible(true);
  }, []);

  const executeStoreCancel = useCallback(async () => {
    if (!storeCancelTargetId) return;
    if (!storeCancelReason.trim()) {
      Toast.show({ type: 'error', text1: 'Reason Required', text2: 'Please provide a reason to cancel.', position: 'bottom' });
      return;
    }
    setStoreCancelLoading(true);
    const ok = await sellerOrders.cancelOrder(storeCancelTargetId, storeCancelReason);
    setStoreCancelLoading(false);
    if (ok) {
      setStoreCancelModalVisible(false);
      setStoreCancelTargetId(null);
    }
  }, [storeCancelTargetId, storeCancelReason, sellerOrders]);

  const openChat = useCallback((order: SellerOrder) => {
    router.push({
      pathname: '/chat/[id]',
      params: {
        id: order.chat_thread_id?.toString() || '0',
        user_id: order.user_id || order.user,
        prescription_id: order.prescription || order.id,
        prescription_image: order.image,
        storeName: order.user_name || 'Patient',
      },
    } as any);
  }, [router]);

  const raiseComplaint = useCallback((order: SellerOrder) => {
    const respondentId = order.user_id || order.user;
    if (!respondentId) {
      Alert.alert('Customer unavailable', 'This order does not include a valid customer reference.');
      return;
    }
    const orderId = order.response_id || order.id;
    router.push({
      pathname: '/support/raise',
      params: {
        respondent_type: 'user',
        respondent_id: String(respondentId),
        respondent_name: order.user_name || 'Customer',
        order_id: String(orderId),
        order_label: `Order #${orderId}`,
      },
    } as any);
  }, [router]);

  const handlePrimaryAction = useCallback(async (order: SellerOrder, progressAction: string) => {
    if (progressAction !== 'mark_locked' || order.delivery_option !== 'online') {
      await sellerOrders.updateProgress(order, progressAction);
      return;
    }
    setDispatchOrder(order);
    setSelectedDeliveryPersonId(null);
    setDeliveryPeopleLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/api/store/delivery-persons/`, { headers: { Authorization: `Bearer ${token}` } });
      const people = await response.json();
      if (!response.ok) throw new Error(people.error || 'Could not load delivery team.');
      setDeliveryPeople((people || []).filter((person: DeliveryPerson) => person.is_active));
    } catch (error: any) {
      setDispatchOrder(null);
      Toast.show({ type: 'error', text1: 'Delivery team unavailable', text2: error.message });
    } finally {
      setDeliveryPeopleLoading(false);
    }
  }, [BASE_URL, sellerOrders, token]);

  const confirmDispatch = useCallback(async () => {
    if (!dispatchOrder || !selectedDeliveryPersonId) {
      Toast.show({ type: 'error', text1: 'Select a delivery partner' });
      return;
    }
    const result = await sellerOrders.updateProgress(dispatchOrder, 'mark_locked', selectedDeliveryPersonId);
    if (result.success) {
      setDispatchOrder(null);
      setSelectedDeliveryPersonId(null);
    }
  }, [dispatchOrder, selectedDeliveryPersonId, sellerOrders]);

  const jumpToDate = useCallback((dateKey: string) => {
    setSelectedStartDateKey(null);
    setSelectedEndDateKey(null);
    setSelectedDateKey(dateKey);
  }, []);

  const jumpToToday = useCallback(() => {
    jumpToDate(todayDateKey);
    sellerOrders.fetchOrders(false);
  }, [jumpToDate, sellerOrders, todayDateKey]);

  const handleOrderDatePickerChange = useCallback((_event: any, selectedDate?: Date) => {
    const mode = datePickerMode;
    setDatePickerMode(null);
    if (!selectedDate || !mode) return;

    const dateKey = formatLocalDateKey(selectedDate);
    if (mode === 'single') {
      jumpToDate(dateKey);
      return;
    }

    if (mode === 'start') {
      if (selectedEndDateKey && getDateKeyTime(dateKey) > getDateKeyTime(selectedEndDateKey)) {
        setSelectedStartDateKey(selectedEndDateKey);
        setSelectedEndDateKey(dateKey);
      } else {
        setSelectedStartDateKey(dateKey);
      }
      setSelectedDateKey(dateKey);
      return;
    }

    if (selectedStartDateKey && getDateKeyTime(dateKey) < getDateKeyTime(selectedStartDateKey)) {
      setSelectedStartDateKey(dateKey);
      setSelectedEndDateKey(selectedStartDateKey);
    } else {
      setSelectedEndDateKey(dateKey);
    }
    setSelectedDateKey(dateKey);
  }, [datePickerMode, jumpToDate, selectedEndDateKey, selectedStartDateKey]);

  const datePickerValue = useMemo(() => {
    const dateKey = datePickerMode === 'start'
      ? selectedStartDateKey
      : datePickerMode === 'end'
        ? selectedEndDateKey
        : selectedDateKey;
    const date = dateKey ? new Date(`${dateKey}T00:00:00`) : new Date();
    return Number.isNaN(date.getTime()) ? new Date() : date;
  }, [datePickerMode, selectedDateKey, selectedEndDateKey, selectedStartDateKey]);

  const renderOrderCard = useCallback(({ item }: { item: PipelineOrder }) => (
    <OrderCard
      order={item.order}
      baseUrl={BASE_URL}
      stageInfo={item.stageInfo}
      priority={item.priority}
      sla={item.sla}
      progressLoadingId={sellerOrders.progressLoadingId}
      onPrimaryAction={handlePrimaryAction}
      onCall={(order) => order.user_mobile ? Linking.openURL(`tel:${order.user_mobile}`) : undefined}
      onChat={openChat}
      onViewRx={setSelectedImage}
      onOpenDetails={setSelectedOrder}
      onRaiseComplaint={raiseComplaint}
      onOpenMap={setDeliveryMapOrder}
      onCancel={handleStoreCancel}
    />
  ), [BASE_URL, handlePrimaryAction, handleStoreCancel, openChat, raiseComplaint, sellerOrders.progressLoadingId]);

  const terminalStageActive = pipeline.activeStage === 'COMPLETED' || pipeline.activeStage === 'CANCELLED';
  const activeStageConfig = ORDER_STAGE_CONFIG[pipeline.activeStage];
  const emptyStateTitle = pipeline.activeStage === 'ACTIVE'
    ? 'No ' + selectedDateLabel + ' orders'
    : 'No ' + activeStageConfig.label + ' orders';
  const emptyStateDescription = terminalStageActive
    ? 'No ' + activeStageConfig.label.toLowerCase() + ' orders found for ' + selectedDateLabel + '.'
    : 'No matching orders found for this status and date.';

  const selectOrderStage = useCallback((stage: OrderStage) => {
    if (stage === 'COMPLETED' || stage === 'CANCELLED') {
      pipeline.setFilterMode('all');
    }
    pipeline.setActiveStage(stage);
  }, [pipeline]);

  const selectTerminalOrderStage = useCallback((stage: TerminalOrderStage) => {
    setOrderArchiveMenuVisible(false);
    selectOrderStage(stage);
  }, [selectOrderStage]);

  const resetQuoteFilters = useCallback(() => {
    pipeline.setFilterMode('all');
    pipeline.setSearchQuery('');
    pipeline.setActiveStage('ACTIVE');
  }, [pipeline]);

  const resetOrderSheetFilters = useCallback(() => {
    resetQuoteFilters();
    jumpToDate(todayDateKey);
  }, [jumpToDate, resetQuoteFilters, todayDateKey]);

  return (
    <View className="flex-1 bg-[#f7faf9]">
      <DeliveryDestinationModal destination={deliveryMapOrder} onClose={() => setDeliveryMapOrder(null)} />
      <View className="overflow-hidden rounded-[1.45rem] shadow-sm shadow-slate-300">

        <View className="px-4 pt-2">
          {/* <LinearGradient
          colors={['#00664f', '#004838', '#00352e']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="relative overflow-hidden rounded-[1.35rem] px-5 pb-5 pt-5 shadow-lg shadow-emerald-900/15"
        > */}
          <LinearGradient
            colors={['#123b59', '#0d8a63']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="relative min-h-[150px] rounded-[1.45rem]  overflow-hidden px-4 py-4"
          >
            <View className="absolute -right-6 -bottom-5 h-[190px] w-[286px] items-center justify-center">
              <Image
                source={require('../../assets/images/order.png')}
                className="h-full w-full"
                resizeMode="contain"
              />
            </View>
            <TouchableOpacity onPress={() => sellerOrders.fetchOrders()} className="absolute right-4 top-4 h-12 w-12 items-center justify-center rounded-full bg-white/12">
              <MaterialCommunityIcons name="refresh" size={27} color="#ffffff" />
            </TouchableOpacity>

            <View className="w-[66%]">
              <View className="flex-row items-center">
                <Text className="text-[31px] font-black tracking-[1.2px] text-white">STORE</Text>
                <View className="mx-2.5 h-9 w-[1.5px] bg-emerald-300/60" />
                <View>
                  <Text className="text-[11px] font-black uppercase tracking-[1.5px] text-emerald-300">Workflow</Text>
                  <Text className="text-[15px] font-black uppercase tracking-[1px] text-white">Board</Text>
                </View>
              </View>
              <Text className="mt-2 text-[13px] font-bold text-white/85">Quote requests only</Text>

              <View className="mt-6 flex-row gap-2">
                <TouchableOpacity onPress={() => setOrderFilterSheetVisible(true)} className="flex-row items-center rounded-2xl bg-white px-3 py-2.5 shadow-sm shadow-black/10">
                  <MaterialCommunityIcons name="filter-variant" size={17} color="#007a5c" />
                  <Text className="ml-1.5 text-[10px] font-black text-[#007a5c]">Order Filter </Text>
                </TouchableOpacity>
                {/* <TouchableOpacity
                  onPress={() => setOrderFilterSheetVisible(true)}
                  className="flex-row items-center rounded-2xl bg-white px-3 py-2.5 shadow-sm shadow-black/10"
                >
                  <MaterialCommunityIcons name="calendar-today" size={17} color="#007a5c" />
                  <Text className="ml-1.5 text-[10px] font-black text-[#007a5c]" numberOfLines={1} style={{ maxWidth: 86 }}>{selectedDateLabel}</Text>
                </TouchableOpacity> */}
              </View>
            </View>
          </LinearGradient>
        </View>
      </View>

      {/* <View className="mx-4 mt-3 rounded-[1.35rem] border border-slate-100 bg-white px-4 py-4 shadow-md shadow-slate-200/60">
        <View className="flex-row items-center justify-between">
          <TouchableOpacity onPress={() => pipeline.setActiveStage('ACTIVE')} className="flex-1 flex-row items-center">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-emerald-50">
              <MaterialCommunityIcons name="pulse" size={23} color="#007a5c" />
            </View>
            <View className="ml-1.5">
              <Text className="text-[20px] font-black text-slate-950">{pipeline.stats.counts.ACTIVE}</Text>
              <Text className="text-[9px] font-black text-[#007a5c]">Active Now</Text>
            </View>
          </TouchableOpacity>
          <View className="mx-1.5 h-9 w-px bg-slate-100" />
          <TouchableOpacity onPress={() => pipeline.setActiveStage('BILLING')} className="flex-1 flex-row items-center">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-blue-50">
              <MaterialCommunityIcons name="file-document-edit" size={21} color="#2f80d9" />
            </View>
            <View className="ml-1.5">
              <Text className="text-[20px] font-black text-slate-950">{pipeline.stats.billing}</Text>
              <Text className="text-[9px] font-bold text-slate-500">Billing</Text>
            </View>
          </TouchableOpacity>
          <View className="mx-1.5 h-9 w-px bg-slate-100" />
          <TouchableOpacity onPress={() => pipeline.setActiveStage('READY')} className="flex-1 flex-row items-center">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-purple-50">
              <MaterialCommunityIcons name="check-circle" size={22} color="#8b5cf6" />
            </View>
            <View className="ml-1.5">
              <Text className="text-[20px] font-black text-slate-950">{pipeline.stats.ready}</Text>
              <Text className="text-[9px] font-bold text-slate-500">Ready</Text>
            </View>
          </TouchableOpacity>
          <View className="mx-1.5 h-9 w-px bg-slate-100" />
          <TouchableOpacity onPress={() => pipeline.setActiveStage('OTP')} className="flex-1 flex-row items-center">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-amber-50">
              <MaterialCommunityIcons name="shield-key-outline" size={22} color="#f59e0b" />
            </View>
            <View className="ml-1.5">
              <Text className="text-[20px] font-black text-slate-950">{nextOtpPending}</Text>
              <Text className="text-[9px] font-bold text-slate-500">OTP</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {(nextBillingPending > 0 || nextOtpPending > 0) && (
        <TouchableOpacity
          activeOpacity={0.86}
          onPress={() => pipeline.setActiveStage(nextBillingPending > 0 ? 'BILLING' : 'OTP')}
          className="mx-4 mt-3 flex-row items-center rounded-[1rem] border border-slate-200 bg-white px-4 py-3 shadow-sm shadow-slate-200/50"
        >
          <View className="h-7 w-7 items-center justify-center rounded-full bg-[#007a5c]">
            <MaterialCommunityIcons name="lightning-bolt" size={17} color="#ffffff" />
          </View>
          <Text className="ml-3 text-[11px] font-black uppercase tracking-[1.4px] text-[#007a5c]">Next Best Action</Text>
          <View className="ml-3 flex-1 flex-row flex-wrap gap-2">
            {nextBillingPending > 0 && (
              <TouchableOpacity onPress={() => pipeline.setActiveStage('BILLING')} className="rounded-full bg-emerald-50 px-3 py-1.5">
                <Text className="text-[9px] font-black text-[#007a5c]">{nextBillingPending} Billing pending</Text>
              </TouchableOpacity>
            )}
            {nextOtpPending > 0 && (
              <TouchableOpacity onPress={() => pipeline.setActiveStage('OTP')} className="rounded-full bg-red-50 px-3 py-1.5">
                <Text className="text-[10px] font-black text-red-700">{nextOtpPending} OTP pending</Text>
              </TouchableOpacity>
            )}
          </View>
          <MaterialCommunityIcons name="chevron-right" size={25} color="#64748b" />
        </TouchableOpacity>
      )} */}

      <View className="px-4 pt-3">
        <View className="flex-row items-center gap-3">
          <View className="flex-1 flex-row items-center rounded-[1.1rem] border border-slate-200 bg-white px-4 py-2.5 shadow-sm shadow-slate-200/40">
            <MaterialCommunityIcons name="magnify" size={22} color="#64748b" />
            <TextInput
              value={pipeline.searchQuery}
              onChangeText={pipeline.setSearchQuery}
              placeholder="Search patient, phone, RX, order ID"
              placeholderTextColor="#94a3b8"
              className="ml-3 flex-1 text-[12px] font-bold text-slate-900"
            />
            {!!pipeline.searchQuery && (
              <TouchableOpacity onPress={() => pipeline.setSearchQuery('')}>
                <MaterialCommunityIcons name="close-circle" size={18} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            onPress={() => setOrderArchiveMenuVisible(true)}
            className="h-[48px] w-[48px] items-center justify-center rounded-[1rem] border border-slate-200 bg-white shadow-sm shadow-slate-200/40"
          >
            <MaterialCommunityIcons name="menu" size={24} color={terminalStageActive ? '#007a5c' : '#0f172a'} />
          </TouchableOpacity>
        </View>

        <Modal visible={orderArchiveMenuVisible} transparent animationType="fade" onRequestClose={() => setOrderArchiveMenuVisible(false)}>
          <View className="flex-1">
            <TouchableOpacity activeOpacity={1} onPress={() => setOrderArchiveMenuVisible(false)} className="absolute inset-0 bg-black/5" />
            <View className="absolute right-4 top-[236px] w-[236px] overflow-hidden rounded-[1.15rem] border border-slate-200 bg-white shadow-xl shadow-slate-300/50">
              <View className="border-b border-slate-100 px-4 py-3">
                <Text className="text-[10px] font-black uppercase tracking-[1.4px] text-slate-400">Order Status</Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.86}
                onPress={() => {
                  setOrderArchiveMenuVisible(false);
                  pipeline.setActiveStage('ACTIVE');
                  pipeline.setFilterMode('emergency');
                  pipeline.setSearchQuery('');
                  jumpToDate(todayDateKey);
                }}
                className="flex-row items-center border-b border-slate-100 bg-rose-50 px-4 py-3.5"
              >
                <View className="h-9 w-9 items-center justify-center rounded-xl bg-white"><MaterialCommunityIcons name="alarm-light-outline" size={19} color="#e11d48" /></View>
                <View className="ml-3 flex-1"><Text className="text-[12px] font-black text-slate-950">Emergency Orders</Text><Text className="mt-0.5 text-[8px] font-black uppercase tracking-[0.8px] text-rose-700">{sellerOrders.orders.filter(order => order.prescription_is_emergency && isActiveOrder(order)).length} active urgent orders</Text></View>
                {pipeline.filterMode === 'emergency' && <MaterialCommunityIcons name="check-circle" size={18} color="#e11d48" />}
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.86}
                onPress={() => {
                  setOrderArchiveMenuVisible(false);
                  pipeline.setFilterMode('all');
                  pipeline.setSearchQuery('');
                  pipeline.setActiveStage('NEW');
                  jumpToDate(todayDateKey);
                }}
                className="flex-row items-center border-b border-slate-100 bg-emerald-50 px-4 py-3.5"
              >
                <View className="h-9 w-9 items-center justify-center rounded-xl bg-white">
                  <MaterialCommunityIcons name="clipboard-list-outline" size={19} color="#047857" />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-[12px] font-black text-slate-950">Orders</Text>
                  <Text className="mt-0.5 text-[8px] font-black uppercase tracking-[0.8px] text-emerald-700">Open New orders by default</Text>
                </View>
                {pipeline.activeStage === 'NEW' && <MaterialCommunityIcons name="check-circle" size={18} color="#047857" />}
              </TouchableOpacity>
              {TERMINAL_ORDER_OPTIONS.map((option) => {
                const selected = pipeline.activeStage === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    activeOpacity={0.86}
                    onPress={() => selectTerminalOrderStage(option.key)}
                    style={{ backgroundColor: selected ? option.bg : '#ffffff' }}
                    className="flex-row items-center border-b border-slate-100 px-4 py-3.5"
                  >
                    <View style={{ backgroundColor: option.bg }} className="h-9 w-9 items-center justify-center rounded-xl">
                      <MaterialCommunityIcons name={option.icon as any} size={19} color={option.color} />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-[12px] font-black text-slate-950" numberOfLines={1}>{option.label}</Text>
                      <Text className="mt-0.5 text-[8px] font-black uppercase tracking-[0.8px] text-slate-400" numberOfLines={1}>{pipeline.stats.counts[option.key] || 0} orders</Text>
                    </View>
                    {selected && <MaterialCommunityIcons name="check-circle" size={18} color={option.color} />}
                  </TouchableOpacity>
                );
              })}
              <View className="border-t border-slate-100 px-4 py-2">
                <Text className="text-[9px] font-black uppercase tracking-[1.2px] text-orange-500">Post-sale orders</Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.86}
                onPress={() => { setOrderArchiveMenuVisible(false); router.push('/(sellerTabs)/replacements'); }}
                className="flex-row items-center bg-orange-50 px-4 py-3.5"
              >
                <View className="h-9 w-9 items-center justify-center rounded-xl bg-white">
                  <MaterialCommunityIcons name="package-variant-closed" size={19} color="#ea580c" />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-[12px] font-black text-slate-950">Replacement Requests</Text>
                  <Text className="mt-0.5 text-[8px] font-black uppercase tracking-[0.8px] text-orange-600">Review and approve requests</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={18} color="#ea580c" />
              </TouchableOpacity>
              <View className="border-t border-slate-100 px-4 py-2">
                <Text className="text-[9px] font-black uppercase tracking-[1.2px] text-blue-500">Clinical support</Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.86}
                onPress={() => { setOrderArchiveMenuVisible(false); router.push('/(sellerTabs)/pharmacist'); }}
                className="flex-row items-center bg-blue-50 px-4 py-3.5"
              >
                <View className="h-9 w-9 items-center justify-center rounded-xl bg-white">
                  <MaterialCommunityIcons name="account-question-outline" size={19} color="#2563eb" />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-[12px] font-black text-slate-950">Pharmacist Consultations</Text>
                  <Text className="mt-0.5 text-[8px] font-black uppercase tracking-[0.8px] text-blue-600">Customer medicine questions</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={18} color="#2563eb" />
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3" contentContainerStyle={{ gap: 10, paddingRight: 12 }}>
          {FILTER_OPTIONS.map((filter) => {
            const selected = pipeline.filterMode === filter.key;
            return (
              <TouchableOpacity key={filter.key} onPress={() => pipeline.setFilterMode(filter.key)} className={`flex-row items-center rounded-[1rem] border px-4 py-3 ${selected ? 'border-[#007a5c] bg-[#007a5c]' : 'border-slate-200 bg-white'}`}>
                <MaterialCommunityIcons name={filter.icon as any} size={18} color={selected ? '#ffffff' : '#0f172a'} />
                <Text className={`ml-2 text-[11px] font-black ${selected ? 'text-white' : 'text-slate-700'}`}>{filter.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView> */}

        <PipelineTabs activeStage={pipeline.activeStage} counts={pipeline.stats.counts} onStageChange={selectOrderStage} />

        {/* <View className="mt-3 rounded-[1.1rem] border border-slate-200 bg-white px-3 py-3 shadow-sm shadow-slate-200/40">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className="h-8 w-8 items-center justify-center rounded-xl bg-emerald-50">
                <MaterialCommunityIcons name="calendar-range" size={17} color="#007a5c" />
              </View>
              <View className="ml-2">
                <Text className="text-[9px] font-black uppercase tracking-[1.5px] text-slate-400">Order Date</Text>
                <Text className="text-[12px] font-black text-slate-950" numberOfLines={1}>{selectedDateLabel}</Text>
              </View>
            </View>
            {(selectedStartDateKey || selectedEndDateKey || selectedDateKey !== todayDateKey) && (
              <TouchableOpacity onPress={jumpToToday} className="rounded-full bg-emerald-50 px-3 py-1.5">
                <Text className="text-[9px] font-black uppercase tracking-[1px] text-[#007a5c]">Today</Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mt-3"
            contentContainerStyle={{ gap: 8, paddingRight: 8 }}
          >
            {dateBadges.map((badge) => {
              const selected = !selectedStartDateKey && !selectedEndDateKey && badge.key === selectedDateKey;
              const label = formatDateChipLabel(badge.key, todayDateKey);

              return (
                <TouchableOpacity
                  key={badge.key}
                  activeOpacity={0.84}
                  onPress={() => jumpToDate(badge.key)}
                  className={`min-w-[84px] rounded-[0.95rem] border px-3 py-2 ${selected ? 'border-[#007a5c] bg-[#007a5c]' : 'border-slate-200 bg-slate-50'}`}
                >
                  <Text className={`text-[10px] font-black ${selected ? 'text-white' : 'text-slate-900'}`} numberOfLines={1}>{label}</Text>
                  <Text className={`mt-0.5 text-[8px] font-black uppercase tracking-[1px] ${selected ? 'text-white/75' : 'text-slate-400'}`} numberOfLines={1}>
                    {badge.count} {badge.count === 1 ? 'order' : 'orders'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View> */}
      </View>

      <FlatList
        data={pipeline.visibleOrders}
        renderItem={renderOrderCard}
        keyExtractor={(item, index) => `${item.order.response_id || item.order.id}-${index}`}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 140 }}
        refreshControl={<RefreshControl refreshing={sellerOrders.refreshing} onRefresh={sellerOrders.refresh} tintColor="#059669" />}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={sellerOrders.loading && pipeline.visibleOrders.length > 0 ? <ActivityIndicator color="#059669" className="py-6" /> : <View className="h-8" />}
        ListEmptyComponent={!sellerOrders.loading ? (
          <View className="mt-20 items-center px-10">
            <MaterialCommunityIcons name={activeStageConfig.icon as any} size={56} color="#cbd5e1" />
            <Text className="mt-6 text-center text-lg font-black text-slate-900">{emptyStateTitle}</Text>
            <Text className="mt-2 text-center text-xs font-semibold leading-5 text-slate-400">{emptyStateDescription}</Text>
          </View>
        ) : null}
      />

      <DetailsSheet
        visible={!!selectedOrder}
        order={selectedOrder}
        priority={selectedOrderPriority}
        onClose={() => setSelectedOrder(null)}
      />

      <Modal visible={Boolean(dispatchOrder)} transparent animationType="slide" onRequestClose={() => !deliveryPeopleLoading && setDispatchOrder(null)}>
        <View className="flex-1 justify-end bg-slate-950/60">
          <TouchableOpacity activeOpacity={1} onPress={() => setDispatchOrder(null)} className="absolute inset-0" />
          <View className="max-h-[82%] rounded-t-[2rem] bg-white px-5 pb-8 pt-4">
            <View className="items-center"><View className="h-1.5 w-12 rounded-full bg-slate-200" /></View>
            <View className="mt-4 flex-row items-start justify-between"><View className="flex-1 pr-4"><Text className="text-[9px] font-black uppercase tracking-[1.8px] text-emerald-600">Packed & ready</Text><Text className="mt-1 text-2xl font-black text-slate-950">Assign Delivery Partner</Text><Text className="mt-1 text-[11px] font-semibold leading-5 text-slate-500">Select who will carry Order #{dispatchOrder?.response_id || dispatchOrder?.id}. Dispatch starts only after confirmation.</Text></View><TouchableOpacity onPress={() => setDispatchOrder(null)} className="h-10 w-10 items-center justify-center rounded-2xl bg-slate-100"><MaterialCommunityIcons name="close" size={20} color="#334155" /></TouchableOpacity></View>
            {deliveryPeopleLoading ? <View className="items-center py-12"><ActivityIndicator color="#059669"/><Text className="mt-3 text-xs font-bold text-slate-400">Loading delivery team…</Text></View> : (
              <ScrollView className="mt-5" showsVerticalScrollIndicator={false}>
                {!deliveryPeople.length ? <View className="items-center rounded-2xl bg-amber-50 p-6"><MaterialCommunityIcons name="account-alert-outline" size={34} color="#d97706"/><Text className="mt-3 font-black text-amber-900">No active delivery partner</Text><Text className="mt-1 text-center text-xs font-semibold text-amber-700">Add a partner from Seller Settings → Delivery Team.</Text></View> : deliveryPeople.map(person=>{
                  const full=person.current_order_count>=person.max_concurrent_orders; const selected=selectedDeliveryPersonId===person.id; const available=person.is_available&&person.can_login&&!full;
                  return <TouchableOpacity key={person.id} disabled={!available} onPress={()=>setSelectedDeliveryPersonId(person.id)} className={`mb-3 flex-row items-center rounded-[1.2rem] border p-4 ${selected?'border-emerald-500 bg-emerald-50':available?'border-slate-200 bg-white':'border-slate-100 bg-slate-50 opacity-50'}`}><View className={`h-12 w-12 items-center justify-center rounded-2xl ${selected?'bg-emerald-600':'bg-blue-50'}`}><MaterialCommunityIcons name={person.vehicle_type==='bike'||person.vehicle_type==='scooter'?'moped':'account'} size={24} color={selected?'white':'#2563eb'}/></View><View className="ml-3 flex-1"><Text className="text-base font-black text-slate-950">{person.name}</Text><Text className="mt-0.5 text-[9px] font-bold uppercase text-slate-400">{person.vehicle_type}{person.vehicle_number?` • ${person.vehicle_number}`:''}</Text><Text className={`mt-1 text-[8px] font-black uppercase ${available?'text-emerald-600':'text-red-500'}`}>{!person.can_login?'Set partner PIN first':full?'Order limit reached':person.is_available?'Available now':'Unavailable'} • {person.current_order_count}/{person.max_concurrent_orders} jobs</Text></View><MaterialCommunityIcons name={selected?'check-circle':'circle-outline'} size={23} color={selected?'#059669':'#cbd5e1'}/></TouchableOpacity>;
                })}
              </ScrollView>
            )}
            <TouchableOpacity disabled={!selectedDeliveryPersonId || deliveryPeopleLoading || sellerOrders.progressLoadingId !== null} onPress={confirmDispatch} className={`mt-4 h-14 flex-row items-center justify-center rounded-2xl ${selectedDeliveryPersonId?'bg-emerald-600':'bg-slate-200'}`}>{sellerOrders.progressLoadingId!==null?<ActivityIndicator color="white"/>:<><MaterialCommunityIcons name="truck-fast-outline" size={21} color={selectedDeliveryPersonId?'white':'#94a3b8'}/><Text className={`ml-2 font-black uppercase tracking-[1.2px] ${selectedDeliveryPersonId?'text-white':'text-slate-400'}`}>Confirm & Dispatch</Text></>}</TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={orderFilterSheetVisible} transparent animationType="slide" onRequestClose={() => setOrderFilterSheetVisible(false)}>
        <View className="flex-1 justify-end bg-black/50">
          <TouchableOpacity activeOpacity={1} onPress={() => setOrderFilterSheetVisible(false)} className="absolute inset-0" />
          <View className="max-h-[86%] rounded-t-[2rem] bg-white px-5 pb-8 pt-3">
            <View className="items-center pb-4">
              <View className="h-1.5 w-12 rounded-full bg-slate-200" />
            </View>

            <View className="flex-row items-start justify-between">
              <View className="flex-1 pr-4">
                <Text className="text-[22px] font-black text-slate-950">Order Filter </Text>
                <Text className="mt-1 text-[11px] font-bold uppercase tracking-[1.3px] text-slate-400">Order stage, mode and date jump</Text>
              </View>
              <TouchableOpacity onPress={() => setOrderFilterSheetVisible(false)} className="h-10 w-10 items-center justify-center rounded-2xl bg-slate-100">
                <MaterialCommunityIcons name="close" size={20} color="#334155" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="mt-5" contentContainerStyle={{ paddingBottom: 12 }}>
              <Text className="text-[10px] font-black uppercase tracking-[1.6px] text-slate-400">Order Status</Text>
              <View className="mt-3 flex-row flex-wrap gap-2">
                {ORDER_FILTER_STAGES.map((stage) => {
                  const config = ORDER_STAGE_CONFIG[stage];
                  const selected = pipeline.activeStage === stage;
                  return (
                    <TouchableOpacity
                      key={stage}
                      onPress={() => selectOrderStage(stage)}
                      className={`w-[48%] flex-row items-center rounded-[1rem] border px-3 py-3 ${selected ? 'border-[#007a5c] bg-[#007a5c]' : 'border-slate-200 bg-slate-50'}`}
                    >
                      <MaterialCommunityIcons name={config.icon as any} size={18} color={selected ? '#ffffff' : config.color} />
                      <View className="ml-2 flex-1">
                        <Text className={`text-[10px] font-black ${selected ? 'text-white' : 'text-slate-900'}`} numberOfLines={1}>{config.shortLabel || config.label}</Text>
                        <Text className={`mt-0.5 text-[8px] font-black uppercase tracking-[0.8px] ${selected ? 'text-white/70' : 'text-slate-400'}`} numberOfLines={1}>{pipeline.stats.counts[stage] || 0} orders</Text>
                      </View>
                      {selected && <MaterialCommunityIcons name="check-circle" size={15} color="#ffffff" />}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text className="mt-5 text-[10px] font-black uppercase tracking-[1.6px] text-slate-400">Quote Mode</Text>
              <View className="mt-3 flex-row flex-wrap gap-2">
                {FILTER_OPTIONS.map((filter) => {
                  const selected = pipeline.filterMode === filter.key;
                  return (
                    <TouchableOpacity
                      key={filter.key}
                      onPress={() => pipeline.setFilterMode(filter.key)}
                      className={`w-[48%] flex-row items-center rounded-[1rem] border px-3 py-3 ${selected ? 'border-[#007a5c] bg-[#007a5c]' : 'border-slate-200 bg-white'}`}
                    >
                      <MaterialCommunityIcons name={filter.icon as any} size={18} color={selected ? '#ffffff' : '#0f172a'} />
                      <Text className={`ml-2 flex-1 text-[11px] font-black ${selected ? 'text-white' : 'text-slate-700'}`}>{filter.label}</Text>
                      {selected && <MaterialCommunityIcons name="check-circle" size={15} color="#ffffff" />}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View className="mt-5 rounded-[1.25rem] border border-slate-200 bg-slate-50 p-3">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 pr-3">
                    <Text className="text-[13px] font-black text-slate-950">Date Jump</Text>
                    <Text className="mt-0.5 text-[9px] font-black uppercase tracking-[1px] text-slate-400" numberOfLines={1}>Current: {selectedDateLabel}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setDatePickerMode('single')} className="flex-row items-center rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <MaterialCommunityIcons name="calendar-range" size={15} color="#007a5c" />
                    <Text className="ml-1.5 text-[9px] font-black uppercase tracking-[0.8px] text-[#007a5c]">Custom</Text>
                  </TouchableOpacity>
                </View>

                <View className="mt-3 flex-row gap-2">
                  <TouchableOpacity onPress={() => setDatePickerMode('start')} className={`flex-1 rounded-[1rem] border px-3 py-3 ${selectedStartDateKey ? 'border-[#007a5c] bg-white' : 'border-slate-200 bg-white'}`}>
                    <View className="flex-row items-center">
                      <MaterialCommunityIcons name="calendar-start" size={15} color={selectedStartDateKey ? '#007a5c' : '#94a3b8'} />
                      <Text className={`ml-1.5 text-[8px] font-black uppercase tracking-[1px] ${selectedStartDateKey ? 'text-[#007a5c]' : 'text-slate-400'}`}>From</Text>
                    </View>
                    <Text className="mt-1.5 text-[11px] font-black text-slate-950" numberOfLines={1}>{formatFullDateLabel(selectedStartDateKey, 'Start date')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setDatePickerMode('end')} className={`flex-1 rounded-[1rem] border px-3 py-3 ${selectedEndDateKey ? 'border-[#007a5c] bg-white' : 'border-slate-200 bg-white'}`}>
                    <View className="flex-row items-center">
                      <MaterialCommunityIcons name="calendar-end" size={15} color={selectedEndDateKey ? '#007a5c' : '#94a3b8'} />
                      <Text className={`ml-1.5 text-[8px] font-black uppercase tracking-[1px] ${selectedEndDateKey ? 'text-[#007a5c]' : 'text-slate-400'}`}>To</Text>
                    </View>
                    <Text className="mt-1.5 text-[11px] font-black text-slate-950" numberOfLines={1}>{formatFullDateLabel(selectedEndDateKey, 'End date')}</Text>
                  </TouchableOpacity>
                </View>

                {(selectedStartDateKey || selectedEndDateKey) && (
                  <TouchableOpacity onPress={() => { setSelectedStartDateKey(null); setSelectedEndDateKey(null); }} className="mt-3 self-start rounded-full bg-white px-3 py-2">
                    <Text className="text-[9px] font-black uppercase tracking-[1px] text-slate-500">Clear Range</Text>
                  </TouchableOpacity>
                )}

                <View className="mt-4 flex-row gap-2">
                  <TouchableOpacity onPress={jumpToToday} className="rounded-[0.95rem] border border-[#007a5c] bg-[#007a5c] px-4 py-2.5">
                    <Text className="text-[10px] font-black text-white">Today</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setDatePickerMode('single')} className="rounded-[0.95rem] border border-slate-200 bg-white px-4 py-2.5">
                    <Text className="text-[10px] font-black text-slate-700">Pick Date</Text>
                  </TouchableOpacity>
                </View>

                <Text className="mt-4 text-[9px] font-black uppercase tracking-[1.3px] text-slate-400">Older order dates</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2" contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
                  {dateBadges.map((badge) => {
                    const selected = !selectedStartDateKey && !selectedEndDateKey && badge.key === selectedDateKey;
                    return (
                      <TouchableOpacity
                        key={badge.key}
                        onPress={() => jumpToDate(badge.key)}
                        className={`min-w-[88px] rounded-[0.95rem] border px-3 py-2 ${selected ? 'border-[#007a5c] bg-[#007a5c]' : 'border-slate-200 bg-white'}`}
                      >
                        <Text className={`text-[10px] font-black ${selected ? 'text-white' : 'text-slate-900'}`} numberOfLines={1}>{formatDateChipLabel(badge.key, todayDateKey)}</Text>
                        <Text className={`mt-0.5 text-[8px] font-black uppercase tracking-[1px] ${selected ? 'text-white/75' : 'text-slate-400'}`} numberOfLines={1}>
                          {badge.count} {badge.count === 1 ? 'order' : 'orders'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              <View className="mt-5 flex-row gap-3">
                <TouchableOpacity onPress={resetOrderSheetFilters} className="flex-1 items-center rounded-[1.15rem] border border-slate-200 bg-white py-4">
                  <Text className="text-[11px] font-black uppercase tracking-[1.5px] text-slate-500">Reset</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setOrderFilterSheetVisible(false)} className="flex-[1.4] items-center rounded-[1.15rem] bg-[#007a5c] py-4">
                  <Text className="text-[11px] font-black uppercase tracking-[1.5px] text-white">Apply</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {datePickerMode && (
        <DateTimePicker
          mode="date"
          value={datePickerValue}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={new Date()}
          onChange={handleOrderDatePickerChange}
        />
      )}

      <Modal visible={completionOtpModalVisible} transparent animationType="fade" onRequestClose={() => setCompletionOtpModalVisible(false)}>
        <View className="flex-1 justify-center bg-black/60 px-6">
          <View className="rounded-[2rem] bg-white p-6">
            <Text className="text-xl font-black text-slate-950">Enter Completion OTP</Text>
            <Text className="mt-2 text-xs font-semibold text-slate-500">Ask the customer for the OTP shown in their app.</Text>
            <TextInput
              value={completionOtpInput}
              onChangeText={setCompletionOtpInput}
              keyboardType="number-pad"
              placeholder="6 digit OTP"
              placeholderTextColor="#94a3b8"
              className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-center text-2xl font-black tracking-[6px] text-slate-950"
            />
            <View className="mt-5 flex-row gap-3">
              <TouchableOpacity onPress={() => setCompletionOtpModalVisible(false)} className="flex-1 items-center rounded-[1.25rem] bg-slate-100 py-4">
                <Text className="text-xs font-black uppercase tracking-[2px] text-slate-600">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={verifyCompletionOtp} disabled={completionOtpLoading} className="flex-1 items-center rounded-[1.25rem] bg-emerald-600 py-4">
                {completionOtpLoading ? <ActivityIndicator size="small" color="white" /> : <Text className="text-xs font-black uppercase tracking-[2px] text-white">Verify</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal animationType="fade" transparent visible={storeCancelModalVisible}>
        <View className="flex-1 justify-center bg-black/60 px-5">
          <View className="bg-white rounded-[2rem] p-6 shadow-2xl">
            <View className="items-center mb-4">
              <View className="w-16 h-16 rounded-full bg-red-50 items-center justify-center mb-3">
                <MaterialCommunityIcons name="alert-decagram-outline" size={32} color="#ef4444" />
              </View>
              <Text className="text-xl font-black text-gray-900 tracking-tighter">Cancel Order?</Text>
              <Text className="text-gray-500 text-xs font-semibold text-center mt-1">This action cannot be undone and the customer will be notified.</Text>
            </View>

            <View className="mb-5">
              <Text className="text-[10px] font-black uppercase text-gray-400 tracking-[1.5px] ml-1 mb-2">
                Cancellation Reason
              </Text>
              <TextInput
                value={storeCancelReason}
                onChangeText={setStoreCancelReason}
                placeholder="Why are you cancelling?"
                placeholderTextColor="#94a3b8"
                className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3.5 text-sm font-semibold text-gray-800 h-24"
                multiline
                textAlignVertical="top"
              />
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1 py-4 bg-gray-100 rounded-[1.25rem] items-center"
                onPress={() => setStoreCancelModalVisible(false)}
                disabled={storeCancelLoading}
              >
                <Text className="text-gray-600 font-bold text-xs uppercase tracking-widest">Keep It</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-[1.2] py-4 bg-red-500 rounded-[1.25rem] items-center justify-center flex-row shadow-lg shadow-red-200"
                onPress={executeStoreCancel}
                disabled={storeCancelLoading}
              >
                {storeCancelLoading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text className="text-white font-bold text-xs uppercase tracking-widest">Confirm Cancel</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!selectedImage} transparent animationType="fade" onRequestClose={() => setSelectedImage(null)}>
        <View className="flex-1 items-center justify-center bg-black/90 px-4">
          <TouchableOpacity onPress={() => setSelectedImage(null)} className="absolute right-5 top-12 z-10 h-11 w-11 items-center justify-center rounded-full bg-white/10">
            <MaterialCommunityIcons name="close" size={24} color="white" />
          </TouchableOpacity>
          {selectedImage && <Image source={{ uri: selectedImage }} style={{ width: '100%', height: '78%' }} resizeMode="contain" />}
        </View>
      </Modal>
    </View>
  );
}
