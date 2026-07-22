import type { OrderAction, OrderCapabilities, OrderStage, SellerOrder, StageConfig, StageResolution } from '../types';

const ACTIVE_STATUSES = new Set(['accepted', 'processing', 'locked', 'out_for_delivery']);

export const PIPELINE_STAGES: OrderStage[] = ['ACTIVE', 'NEW', 'BILLING', 'PACKED', 'READY', 'DELIVERY', 'OTP', 'COMPLETED'];

export const ORDER_STAGE_CONFIG: Record<OrderStage, StageConfig> = {
  ACTIVE: {
    key: 'ACTIVE',
    label: 'Active',
    shortLabel: 'Active',
    color: '#0f172a',
    backgroundColor: '#f8fafc',
    icon: 'clipboard-list-outline',
    slaMinutes: 0,
    allowedActions: ['CHAT', 'CALL', 'VIEW_RX'],
  },
  NEW: {
    key: 'NEW',
    label: 'New',
    shortLabel: 'New',
    color: '#2563eb',
    backgroundColor: '#eff6ff',
    icon: 'bell-ring-outline',
    slaMinutes: 10,
    allowedActions: ['START_BILLING', 'CHAT', 'CALL', 'VIEW_RX', 'CANCEL'],
  },
  BILLING: {
    key: 'BILLING',
    label: 'Billing',
    shortLabel: 'Billing',
    color: '#ea580c',
    backgroundColor: '#fff7ed',
    icon: 'script-text-outline',
    slaMinutes: 20,
    allowedActions: ['MARK_PACKED', 'CHAT', 'CALL', 'VIEW_RX', 'CANCEL'],
  },
  PACKED: {
    key: 'PACKED',
    label: 'Packed',
    shortLabel: 'Packed',
    color: '#4f46e5',
    backgroundColor: '#eef2ff',
    icon: 'package-variant-closed',
    slaMinutes: 15,
    allowedActions: ['READY_PICKUP', 'OUT_FOR_DELIVERY', 'CHAT', 'CALL', 'VIEW_RX'],
  },
  READY: {
    key: 'READY',
    label: 'Ready Pickup',
    shortLabel: 'Ready',
    color: '#059669',
    backgroundColor: '#ecfdf5',
    icon: 'store-clock-outline',
    slaMinutes: 10,
    allowedActions: ['COMPLETE', 'CHAT', 'CALL', 'VIEW_RX'],
  },
  DELIVERY: {
    key: 'DELIVERY',
    label: 'Delivery',
    shortLabel: 'Delivery',
    color: '#0284c7',
    backgroundColor: '#f0f9ff',
    icon: 'truck-delivery-outline',
    slaMinutes: 30,
    allowedActions: ['COMPLETE', 'CHAT', 'CALL', 'VIEW_RX'],
  },
  OTP: {
    key: 'OTP',
    label: 'OTP Pending',
    shortLabel: 'OTP',
    color: '#16a34a',
    backgroundColor: '#f0fdf4',
    icon: 'shield-key-outline',
    slaMinutes: 10,
    allowedActions: ['COMPLETE', 'CHAT', 'CALL', 'VIEW_RX'],
  },
  COMPLETED: {
    key: 'COMPLETED',
    label: 'Completed',
    shortLabel: 'Done',
    color: '#64748b',
    backgroundColor: '#f8fafc',
    icon: 'check-decagram-outline',
    slaMinutes: 0,
    allowedActions: ['VIEW_RX'],
  },
  CANCELLED: {
    key: 'CANCELLED',
    label: 'Cancelled',
    shortLabel: 'Cancelled',
    color: '#dc2626',
    backgroundColor: '#fef2f2',
    icon: 'close-circle-outline',
    slaMinutes: 0,
    allowedActions: ['VIEW_RX'],
  },
};

export const normalizeStatus = (status?: string | null) => (status || '').toLowerCase();

export const getOrderId = (order?: { id?: number; response_id?: number } | null) => order?.response_id ?? order?.id;

export const isCompletedOrder = (order: SellerOrder) => normalizeStatus(order.user_status) === 'completed';

export const isCancelledOrder = (order: SellerOrder) => ['cancelled', 'rejected'].includes(normalizeStatus(order.user_status));

export const isOtpPendingOrder = (order: SellerOrder) => {
  const status = normalizeStatus(order.user_status);
  return !!order.completion_otp_requested || !!order.completion_otp_expires_at || status.includes('otp');
};

export const isActiveOrder = (order: SellerOrder) => (
  !isCompletedOrder(order) &&
  !isCancelledOrder(order) &&
  (
    ACTIVE_STATUSES.has(normalizeStatus(order.user_status)) ||
    !!order.is_processing_started ||
    !!order.is_packed ||
    !!order.is_locked ||
    isOtpPendingOrder(order)
  )
);

export const getOrderStageKey = (order: SellerOrder): OrderStage => {
  const status = normalizeStatus(order.user_status);
  if (isCompletedOrder(order)) return 'COMPLETED';
  if (isCancelledOrder(order)) return 'CANCELLED';
  if (isOtpPendingOrder(order)) return 'OTP';
  if (status === 'out_for_delivery') return 'DELIVERY';
  if (order.is_locked || status === 'locked') return order.delivery_option === 'online' ? 'DELIVERY' : 'READY';
  if (order.is_packed) return 'PACKED';
  if (order.is_processing_started || status === 'processing') return 'BILLING';
  return 'NEW';
};

export const getOrderCapabilities = (order: SellerOrder, stage = getOrderStageKey(order)): OrderCapabilities => {
  const done = isCompletedOrder(order) || isCancelledOrder(order);
  return {
    canStartBilling: !done && stage === 'NEW',
    canPack: !done && stage === 'BILLING',
    canMarkReady: !done && stage === 'PACKED' && order.delivery_option !== 'online',
    canSendDelivery: !done && stage === 'PACKED' && order.delivery_option === 'online',
    canComplete: !done && ['READY', 'DELIVERY', 'OTP'].includes(stage),
    canCancel: !done && !['READY', 'DELIVERY', 'OTP'].includes(stage),
    canCall: !!order.user_mobile,
    canChat: true,
    canViewPrescription: !!order.image,
  };
};

export const resolveOrderStage = (order: SellerOrder): StageResolution => {
  const stage = getOrderStageKey(order);
  return {
    stage,
    config: ORDER_STAGE_CONFIG[stage],
    capabilities: getOrderCapabilities(order, stage),
  };
};

export const getPrimaryAction = (order: SellerOrder): { action: OrderAction; label: string; icon: string; progressAction: string } | null => {
  const { stage, capabilities } = resolveOrderStage(order);
  if (capabilities.canStartBilling) return { action: 'START_BILLING', label: 'बिल बनाना शुरू करें', icon: 'script-text-outline', progressAction: 'start_processing' };
  if (capabilities.canPack) return { action: 'MARK_PACKED', label: 'Packing पूरी हो गई', icon: 'package-variant-closed', progressAction: 'mark_packed' };
  if (capabilities.canMarkReady) return { action: 'READY_PICKUP', label: 'Customer के लिए तैयार', icon: 'store-check-outline', progressAction: 'mark_locked' };
  if (capabilities.canSendDelivery) return { action: 'OUT_FOR_DELIVERY', label: 'Delivery Partner चुनें', icon: 'truck-delivery', progressAction: 'mark_locked' };
  if (capabilities.canComplete) return { action: 'COMPLETE', label: 'OTP लेकर पूरा करें', icon: 'check-decagram-outline', progressAction: 'mark_completed' };
  if (stage === 'COMPLETED') return null;
  return null;
};
