import { translateStatic as t } from '@/components/Language/LocalizedPrimitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import {
  Image,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { handleDownloadInvoice } from '../../app/(sellerTabs)/history';
import { getOrderId, getPrimaryAction } from '../helpers/orderWorkflow';
import type { PriorityInfo, SellerOrder, SlaInfo, StageResolution } from '../types';
import NextActionButton from './NextActionButton';
import PriorityBadge from './PriorityBadge';
import SlaTimer from './SlaTimer';

const SELLER_CARD_COLORS = {
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

const buildMediaUrl = (baseUrl: string | undefined, mediaPath?: string | null) => {
  if (!mediaPath) return null;
  if (/^https?:\/\//i.test(mediaPath)) return mediaPath;
  const base = (baseUrl || '').replace(/\/+$/, '');
  const path = mediaPath.startsWith('/') ? mediaPath : `/${mediaPath}`;
  return `${base}${path}`;
};

const formatCurrency = (value?: number | string | null) => {
  if (value === null || value === undefined || value === '') return 'Calculated';
  const amount = Number(value);
  if (Number.isNaN(amount)) return String(value);
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};

const formatDate = (value?: string | null) => {
  if (!value) return 'Recently';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';
  return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
};

const getStatusLabel = (stageInfo: StageResolution, order: SellerOrder) => {
  if (order.delivery_assignment_status === 'pending') return 'Waiting for partner response';
  if (order.delivery_assignment_status === 'rejected') return 'Partner rejected delivery';
  if (order.delivery_reached_at) return 'Delivery partner arrived at customer';
  if (order.delivery_picked_up_at) return 'Picked up • On the way';
  if (order.delivery_offer?.assignment_status === 'accepted') return 'Partner accepted • En route';
  if (stageInfo.stage === 'NEW') return 'Billing Pending';
  if (stageInfo.stage === 'COMPLETED' || stageInfo.stage === 'CANCELLED') return stageInfo.config.label;
  return `${stageInfo.config.label} Stage`;
};

const getSellerGuidance = (order: SellerOrder, stageInfo: StageResolution) => {
  switch (stageInfo.stage) {
    case 'NEW': return { title: 'Start medicine billing', next: 'Order will move to Billing stage after action.', icon: 'receipt-text-outline' };
    case 'BILLING': return { title: 'Pack medicines & generate bill', next: 'Order will move to Packed stage when ready.', icon: 'package-variant' };
    case 'PACKED':
      if (order.delivery_assignment_status === 'pending') return { title: 'Delivery request sent to partner', next: 'Order moves to Delivery once accepted.', icon: 'timer-sand' };
      if (order.delivery_assignment_status === 'rejected') return { title: 'Partner declined delivery request', next: 'Select another available delivery partner.', icon: 'account-switch-outline' };
      return order.delivery_option === 'online'
        ? { title: 'Select delivery partner for order', next: 'Order moves to Delivery upon selection.', icon: 'moped' }
        : { title: 'Keep order ready for customer pickup', next: 'Order moves to Ready for Pickup after action.', icon: 'store-check-outline' };
    case 'READY': return { title: 'Verify customer OTP upon arrival', next: 'Order will be completed after valid OTP.', icon: 'account-check-outline' };
    case 'DELIVERY':
      return order.delivery_reached_at
        ? { title: 'Partner reached customer location', next: 'Order completes upon customer OTP verification.', icon: 'map-marker-check-outline' }
        : { title: 'Delivery partner is delivering order', next: 'Pickup and location updates shown here.', icon: 'truck-fast-outline' };
    case 'OTP': return { title: 'Verify OTP received from customer', next: 'Order safely completed after valid OTP.', icon: 'shield-key-outline' };
    default: return null;
  }
};

type Props = {
  order: SellerOrder;
  baseUrl: string;
  stageInfo: StageResolution;
  priority: PriorityInfo;
  sla: SlaInfo;
  progressLoadingId: number | null;
  onPrimaryAction: (order: SellerOrder, progressAction: string) => void;
  onCall: (order: SellerOrder) => void;
  onChat: (order: SellerOrder) => void;
  onViewRx: (url: string) => void;
  onOpenDetails: (order: SellerOrder) => void;
  onRaiseComplaint: (order: SellerOrder) => void;
  onOpenMap: (order: SellerOrder) => void;
  onCancel?: (order: SellerOrder) => void;
};

const QuickActionBtn = ({ icon, label, onPress, danger }: { icon: string; label: string; onPress: () => void; danger?: boolean }) => (
  <TouchableOpacity
    onPress={onPress}
    className="flex-1 flex-row items-center justify-center rounded-xl border py-2 px-1.5 active:opacity-80"
    style={{
      backgroundColor: danger ? '#FEF2F2' : '#FFFFFF',
      borderColor: danger ? '#FECDD3' : SELLER_CARD_COLORS.borderTeal,
    }}
  >
    <MaterialCommunityIcons name={icon as any} size={14} color={danger ? SELLER_CARD_COLORS.errorRed : SELLER_CARD_COLORS.primaryNavy} />
    <Text
      className="ml-1 text-[9.5px] font-black uppercase tracking-wider"
      style={{ color: danger ? SELLER_CARD_COLORS.errorRed : SELLER_CARD_COLORS.mainText }}
      numberOfLines={1}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

export default function OrderCard({ order, baseUrl, stageInfo, priority, sla, progressLoadingId, onPrimaryAction, onCall, onChat, onViewRx, onOpenDetails, onRaiseComplaint, onOpenMap, onCancel }: Props) {
  const primaryAction = getPrimaryAction(order);
  const id = getOrderId(order);
  const imageUrl = buildMediaUrl(baseUrl, order.image);
  const medicineCount = order.medicines?.length || 0;
  const isPickup = order.delivery_option === 'walk_in';
  const sellerGuidance = getSellerGuidance(order, stageInfo);
  const assignedDeliveryPerson = order.delivery_offer?.assigned_delivery_person;

  return (
    <View
      className="mb-3 overflow-hidden rounded-2xl border"
      style={{
        backgroundColor: SELLER_CARD_COLORS.whiteCard,
        borderColor: SELLER_CARD_COLORS.borderTeal,
        position: 'relative',
      }}
    >
      {/* 🔴 Left Status Color Accent Strip */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: 4,
          backgroundColor: stageInfo.config.color || SELLER_CARD_COLORS.primaryNavy,
          zIndex: 10,
        }}
      />

      <View className="p-3.5 pl-4.5">
        {/* 1️⃣ Header Row: Patient Name, Date & Store Pickup / Delivery Badge */}
        <View className="flex-row items-start justify-between gap-2">
          <View className="flex-1">
            <View className="flex-row items-center gap-1.5 mb-0.5">
              <Text className="text-[9px] font-black uppercase tracking-widest" style={{ color: SELLER_CARD_COLORS.secondaryTeal }}>
                PATIENT
              </Text>
              <Text className="text-[9px] font-bold text-slate-300">•</Text>
              <View className="flex-row items-center">
                <MaterialCommunityIcons name="clock-outline" size={10} color={SELLER_CARD_COLORS.secondaryText} />
                <Text className="font-bold text-[9.5px] ml-1 uppercase" style={{ color: SELLER_CARD_COLORS.secondaryText }} numberOfLines={1}>
                  {formatDate(order.accepted_at || order.updated_at || order.created_at)}
                </Text>
              </View>
            </View>
            <Text className="text-[17px] font-black leading-tight" style={{ color: SELLER_CARD_COLORS.mainText }} numberOfLines={1}>
              {order.user_name || 'Patient'}
            </Text>
          </View>

          {/* Clean Pickup / Delivery Badge */}
          <View
            className="flex-row items-center rounded-full px-2.5 py-1 border"
            style={{
              backgroundColor: SELLER_CARD_COLORS.lightTealCard,
              borderColor: SELLER_CARD_COLORS.borderTeal
            }}
          >
            <MaterialCommunityIcons
              name={isPickup ? 'walk' : 'truck-delivery-outline'}
              size={12}
              color={SELLER_CARD_COLORS.primaryNavy}
            />
            <Text className="ml-1 text-[8.5px] font-black uppercase tracking-wider" style={{ color: SELLER_CARD_COLORS.primaryNavy }}>
              {isPickup ? 'Store Pickup' : 'Home Delivery'}
            </Text>
          </View>
        </View>

        {/* 2️⃣ Badges Row (Stage, Emergency, Priority, SLA, Repeat) - Tapping opens Details Sheet */}
        <TouchableOpacity
          onPress={() => onOpenDetails(order)}
          activeOpacity={0.75}
          className="flex-row flex-wrap items-center gap-1 mt-2 mb-2.5"
        >
          <View
            style={{ backgroundColor: stageInfo.config.backgroundColor }}
            className="flex-row items-center rounded-full px-2 py-0.5 border"
          >
            <MaterialCommunityIcons name={stageInfo.config.icon as any} size={9} color={stageInfo.config.color} />
            <Text style={{ color: stageInfo.config.color }} className="ml-1 text-[8px] font-black uppercase tracking-wider">
              {stageInfo.config.shortLabel}
            </Text>
          </View>
          {order.prescription_is_emergency && (
            <View className="flex-row items-center rounded-full px-2 py-0.5 border bg-rose-50 border-rose-200">
              <MaterialCommunityIcons name="alarm-light-outline" size={9} color={SELLER_CARD_COLORS.errorRed} />
              <Text className="ml-1 text-[8px] font-black uppercase text-rose-700">Emergency</Text>
            </View>
          )}
          <PriorityBadge priority={priority} />
          <SlaTimer sla={sla} />
          {order.repeat_customer && (
            <View className="flex-row items-center rounded-full px-2 py-0.5 border border-amber-200 bg-amber-50">
              <MaterialCommunityIcons name="star-circle" size={9} color={SELLER_CARD_COLORS.warningAmber} />
              <Text className="ml-1 text-[8px] font-black uppercase" style={{ color: SELLER_CARD_COLORS.warningAmber }}>Repeat</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* 3️⃣ Main Card Body: Prescription Image + Quoted Amount */}
        <View className="flex-row items-center justify-between border-t border-b py-2.5 my-1" style={{ borderColor: SELLER_CARD_COLORS.background }}>
          <View className="flex-row items-center flex-1">
            <TouchableOpacity
              onPress={() => imageUrl ? onViewRx(imageUrl) : undefined}
              activeOpacity={0.85}
              className="items-center justify-center overflow-hidden rounded-xl border"
              style={{ backgroundColor: SELLER_CARD_COLORS.lightTealCard, borderColor: SELLER_CARD_COLORS.borderTeal, width: 52, height: 52 }}
            >
              {imageUrl ? (
                <Image source={{ uri: imageUrl }} className="h-full w-full" resizeMode="cover" />
              ) : (
                <View className="items-center justify-center opacity-40">
                  <MaterialCommunityIcons name="file-image-outline" size={20} color={SELLER_CARD_COLORS.secondaryText} />
                </View>
              )}
            </TouchableOpacity>

            <View className="ml-3 flex-1">
              <Text className="text-[8.5px] font-black uppercase tracking-widest" style={{ color: SELLER_CARD_COLORS.secondaryText }}>
                QUOTED AMOUNT
              </Text>
              <Text className="text-[19px] font-black leading-tight" style={{ color: SELLER_CARD_COLORS.mainText }} numberOfLines={1}>
                {formatCurrency(order.total_amount)}
              </Text>
              <Text className="text-[9.5px] font-bold" style={{ color: SELLER_CARD_COLORS.secondaryText }} numberOfLines={1}>
                {medicineCount || 'No'} medicine{medicineCount === 1 ? '' : 's'} quoted
              </Text>
            </View>
          </View>

          {!isPickup && (
            <TouchableOpacity
              onPress={() => onOpenMap(order)}
              className="flex-row items-center rounded-lg px-2.5 py-1.5 border"
              style={{ backgroundColor: SELLER_CARD_COLORS.lightTealCard, borderColor: SELLER_CARD_COLORS.borderTeal }}
            >
              <MaterialCommunityIcons name="map-marker-outline" size={12} color={SELLER_CARD_COLORS.secondaryTeal} />
              <Text className="ml-1 text-[8.5px] font-black uppercase" style={{ color: SELLER_CARD_COLORS.primaryNavy }}>
                Address / Map
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 4️⃣ Clean Guidance & Operational Status Line */}
        {sellerGuidance ? (
          <View className="mt-2 mb-1 flex-row items-center justify-between rounded-xl px-3 py-2 border" style={{ backgroundColor: SELLER_CARD_COLORS.background, borderColor: SELLER_CARD_COLORS.borderTeal }}>
            <View className="flex-row items-center flex-1 pr-2">
              <MaterialCommunityIcons name={sellerGuidance.icon as any} size={15} color={SELLER_CARD_COLORS.primaryNavy} />
              <View className="ml-2 flex-1">
                <Text className="text-[8px] font-black uppercase tracking-wider" style={{ color: SELLER_CARD_COLORS.secondaryTeal }}>
                  {t('NEXT STEP')}
                </Text>
                <Text className="text-[11px] font-black leading-tight" style={{ color: SELLER_CARD_COLORS.mainText }} numberOfLines={1}>
                  {t(sellerGuidance.title)}
                </Text>
              </View>
            </View>
            <View className="px-2 py-0.5 rounded bg-white border border-slate-200">
              <Text className="text-[8.5px] font-bold" style={{ color: SELLER_CARD_COLORS.secondaryText }}>
                {t(getStatusLabel(stageInfo, order))}
              </Text>
            </View>
          </View>
        ) : (
          <View className="mt-2 mb-1 flex-row items-center justify-between rounded-xl px-3 py-1.5 border" style={{ backgroundColor: SELLER_CARD_COLORS.background, borderColor: SELLER_CARD_COLORS.borderTeal }}>
            <Text className="text-[8.5px] font-black uppercase tracking-wider" style={{ color: SELLER_CARD_COLORS.secondaryTeal }}>
              STATUS: {t(getStatusLabel(stageInfo, order))}
            </Text>
          </View>
        )}

        {/* Assigned Partner (if active) */}
        {assignedDeliveryPerson && (
          <View className="mt-1.5 flex-row items-center justify-between rounded-xl px-3 py-2 border bg-blue-50/50 border-blue-200">
            <View className="flex-row items-center flex-1 pr-2">
              <MaterialCommunityIcons name="account-check-outline" size={15} color={SELLER_CARD_COLORS.primaryNavy} />
              <Text className="ml-2 text-[10.5px] font-black text-slate-800" numberOfLines={1}>
                {t('Partner')}: {assignedDeliveryPerson.name || 'Assigned'}
              </Text>
            </View>
            {assignedDeliveryPerson.mobile && (
              <TouchableOpacity onPress={() => onCall(order)} className="px-2 py-1 rounded bg-white border border-blue-200">
                <Text className="text-[8.5px] font-black uppercase text-blue-700">{t('Call')}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* 5️⃣ Primary Action Button */}
        <View className="mt-2.5 flex-row gap-2">
          {primaryAction ? (
            <NextActionButton
              label={primaryAction.label}
              icon={primaryAction.icon}
              loading={progressLoadingId === id}
              onPress={() => onPrimaryAction(order, primaryAction.progressAction)}
            />
          ) : (
            <TouchableOpacity
              onPress={() => onOpenDetails(order)}
              className="flex-1 items-center justify-center rounded-[0.95rem] py-3 shadow-xs active:opacity-90"
              style={{ backgroundColor: SELLER_CARD_COLORS.primaryNavy }}
            >
              <Text className="text-[11px] font-black uppercase tracking-[1.4px] text-white">{t('View Details')}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => onOpenDetails(order)}
            className="w-[44px] items-center justify-center rounded-[0.95rem] border bg-white py-2.5"
            style={{ borderColor: SELLER_CARD_COLORS.borderTeal }}
          >
            <MaterialCommunityIcons name="dots-horizontal" size={20} color={SELLER_CARD_COLORS.secondaryText} />
          </TouchableOpacity>
        </View>

        {/* 6️⃣ Quick Toolbar (Invoice (Completed only), Call, Chat, Cancel / Report) */}
        <View className="mt-2 flex-row gap-1.5">
          {(stageInfo.stage === 'COMPLETED' || order.user_status === 'completed') && (
            <TouchableOpacity
              onPress={() => handleDownloadInvoice(order)}
              className="flex-1 flex-row items-center justify-center rounded-xl border py-2 px-1.5 bg-emerald-50 border-emerald-200 active:opacity-80 shadow-xs"
            >
              <MaterialCommunityIcons name="file-pdf-box" size={14} color="#059669" />
              <Text className="ml-1 text-[9.5px] font-black uppercase tracking-wider text-emerald-700" numberOfLines={1}>
                Invoice
              </Text>
            </TouchableOpacity>
          )}

          {onCancel && stageInfo.stage !== 'COMPLETED' && stageInfo.stage !== 'CANCELLED' && order.user_status !== 'locked' ? (
            <QuickActionBtn icon="close-circle-outline" label={t('Cancel')} onPress={() => onCancel(order)} danger />
          ) : null}
          <QuickActionBtn icon="phone-outline" label={t('Call')} onPress={() => onCall(order)} />
          <QuickActionBtn icon="chat-outline" label={t('Chat')} onPress={() => onChat(order)} />
          <QuickActionBtn icon="flag-outline" label={t('Report')} onPress={() => onRaiseComplaint(order)} />
        </View>
      </View>
    </View>
  );
}
