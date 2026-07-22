import { LocalizedText as Text } from '@/components/Language/LocalizedPrimitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import {
  Image,
  TouchableOpacity,
  View
} from 'react-native';
import { getOrderId, getPrimaryAction } from '../helpers/orderWorkflow';
import type { PriorityInfo, SellerOrder, SlaInfo, StageResolution } from '../types';
import NextActionButton from './NextActionButton';
import PriorityBadge from './PriorityBadge';
import SlaTimer from './SlaTimer';

const buildMediaUrl = (baseUrl: string | undefined, mediaPath?: string | null) => {
  if (!mediaPath) return null;
  if (/^https?:\/\//i.test(mediaPath)) return mediaPath;
  const base = (baseUrl || '').replace(/\/+$/, '');
  const path = mediaPath.startsWith('/') ? mediaPath : `/${mediaPath}`;
  return `${base}${path}`;
};

const formatCurrency = (value?: number | string | null) => {
  if (value === null || value === undefined || value === '') return 'Amount pending';
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
  if (order.delivery_reached_at) return 'Delivery partner reached customer';
  if (order.delivery_picked_up_at) return 'Picked up • On the way';
  if (stageInfo.stage === 'NEW') return 'Billing Pending';
  if (stageInfo.stage === 'COMPLETED' || stageInfo.stage === 'CANCELLED') return stageInfo.config.label;
  return `${stageInfo.config.label} Stage`;
};

const getSellerGuidance = (order: SellerOrder, stageInfo: StageResolution) => {
  switch (stageInfo.stage) {
    case 'NEW': return { title: 'दवाइयों का बिल बनाना शुरू करें', next: 'बटन दबाने के बाद यह order Billing में मिलेगा।', icon: 'receipt-text-outline' };
    case 'BILLING': return { title: 'बिल बनाकर दवाइयां pack करें', next: 'Packing पूरी होने पर यह order Packed में मिलेगा।', icon: 'package-variant' };
    case 'PACKED':
      return order.delivery_option === 'online'
        ? { title: 'Delivery के लिए partner चुनें', next: 'Partner चुनते ही order Delivery में चला जाएगा।', icon: 'moped' }
        : { title: 'Order customer को देने के लिए तैयार रखें', next: 'बटन दबाने के बाद यह Ready for Pickup में मिलेगा।', icon: 'store-check-outline' };
    case 'READY': return { title: 'Customer आने पर OTP लेकर order दें', next: 'सही OTP डालने के बाद order Completed हो जाएगा।', icon: 'account-check-outline' };
    case 'DELIVERY':
      return order.delivery_reached_at
        ? { title: 'Partner customer के पास पहुंच गया है', next: 'Customer का OTP verify होते ही order Completed होगा।', icon: 'map-marker-check-outline' }
        : { title: 'Delivery partner यह order पहुंचा रहा है', next: 'Pickup, रास्ते और delivery की स्थिति यहीं update होगी।', icon: 'truck-fast-outline' };
    case 'OTP': return { title: 'Customer से मिला OTP verify करें', next: 'सही OTP के बाद order Completed में सुरक्षित हो जाएगा।', icon: 'shield-key-outline' };
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

const FooterButton = ({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) => (
  <TouchableOpacity onPress={onPress} className="flex-1 flex-row items-center justify-center rounded-xl border border-slate-200 bg-white px-2 py-2.5">
    <MaterialCommunityIcons name={icon as any} size={16} color="#64748b" />
    <Text className="ml-1.5 text-[10px] font-black text-slate-500" numberOfLines={1}>{label}</Text>
  </TouchableOpacity>
);

export default function OrderCard({ order, baseUrl, stageInfo, priority, sla, progressLoadingId, onPrimaryAction, onCall, onChat, onViewRx, onOpenDetails, onRaiseComplaint, onOpenMap, onCancel }: Props) {
  const primaryAction = getPrimaryAction(order);
  const id = getOrderId(order);
  const imageUrl = buildMediaUrl(baseUrl, order.image);
  const medicineCount = order.medicines?.length || 0;
  const isPickup = order.delivery_option === 'walk_in';
  const deliveryTone = isPickup
    ? { bg: '#f8fafc', fg: '#475569', icon: 'store-marker-outline', label: 'Customer collection' }
    : { bg: '#f8fafc', fg: '#475569', icon: 'home-map-marker', label: 'Doorstep order' };
  const sellerGuidance = getSellerGuidance(order, stageInfo);

  return (
    <View className="mb-4 overflow-hidden rounded-[1.25rem] border border-slate-100 bg-white shadow-lg shadow-slate-200/60">
      <View className="absolute bottom-0 left-0 top-0 w-1 bg-[#007a5c]" />
      <View className="p-4 pl-5">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-[18px] font-black text-slate-950" numberOfLines={1}>{order.user_name || 'Patient'}</Text>
            <Text className="mt-1 text-[11px] font-bold uppercase text-slate-500" numberOfLines={1}>
              {formatDate(order.accepted_at || order.updated_at || order.created_at)}
            </Text>
          </View>
          <View style={{ backgroundColor: deliveryTone.bg }} className="flex-row items-center rounded-xl px-3 py-2">
            <MaterialCommunityIcons name={deliveryTone.icon as any} size={15} color={deliveryTone.fg} />
            <Text style={{ color: deliveryTone.fg }} className="ml-1.5 text-[10px] font-black uppercase">{deliveryTone.label}</Text>
          </View>
        </View>

        <View className="mt-3 flex-row items-center rounded-[1rem] border border-slate-200 bg-slate-50 px-3 py-2.5">
          <View className="h-10 w-10 items-center justify-center rounded-[0.85rem] bg-white border border-slate-200">
            <MaterialCommunityIcons name={isPickup ? 'storefront-outline' : 'moped'} size={20} color="#0f172a" />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-[11px] font-black text-slate-900">{isPickup ? 'Store pickup' : 'Home delivery'}</Text>
            <Text className="mt-0.5 text-[8.5px] font-bold text-slate-500" numberOfLines={1}>{isPickup ? 'Customer will collect from your pharmacy' : 'Assign a partner after packing the order'}</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={19} color="#94a3b8" />
        </View>

        <View className="mt-3 flex-row items-start">
          <TouchableOpacity
            onPress={() => imageUrl ? onViewRx(imageUrl) : undefined}
            className="h-20 w-20 items-center justify-center overflow-hidden rounded-[1rem] border border-slate-200 bg-slate-50"
          >
            {imageUrl ? <Image source={{ uri: imageUrl }} className="h-full w-full" resizeMode="cover" /> : <MaterialCommunityIcons name="file-image-outline" size={28} color="#94a3b8" />}
          </TouchableOpacity>
          <View className="ml-3 flex-1">
            <View className="flex-row flex-wrap items-center gap-1">
              <View style={{ backgroundColor: stageInfo.config.backgroundColor }} className="mb-1 flex-row items-center rounded-full px-2.5 py-1">
                <MaterialCommunityIcons name={stageInfo.config.icon as any} size={11} color={stageInfo.config.color} />
                <Text style={{ color: stageInfo.config.color }} className="ml-1 text-[8px] font-black uppercase tracking-wider">{stageInfo.config.shortLabel}</Text>
              </View>
              {order.prescription_is_emergency && (
                <View className="mb-1 flex-row items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-1">
                  <MaterialCommunityIcons name="alarm-light-outline" size={10} color="#e11d48" />
                  <Text className="ml-1 text-[8px] font-black uppercase text-rose-700">Emergency</Text>
                </View>
              )}
              <PriorityBadge priority={priority} />
              <SlaTimer sla={sla} />
              {order.repeat_customer && (
                <View className="mb-1 flex-row items-center rounded-full border border-amber-100 bg-amber-50 px-2 py-1">
                  <MaterialCommunityIcons name="star-circle" size={10} color="#d97706" />
                  <Text className="ml-1 text-[8px] font-black uppercase text-amber-700">Repeat</Text>
                </View>
              )}
            </View>
            <Text className="mt-1 text-[21px] font-black text-slate-950" numberOfLines={1}>{formatCurrency(order.total_amount)}</Text>
            <Text className="mt-0.5 text-[11px] font-bold text-slate-400" numberOfLines={1}>{medicineCount || 'No'} medicine{medicineCount === 1 ? '' : 's'} quoted</Text>
          </View>
        </View>

        <View className="mt-4 rounded-[1rem] bg-[#f5f8f7] px-4 py-3">
          <Text className="text-[8px] font-black uppercase tracking-[1.8px] text-[#007a5c]">Status</Text>
          <Text className="mt-1 text-[13px] font-black text-slate-950" numberOfLines={1}>{getStatusLabel(stageInfo, order)}</Text>
        </View>

        {sellerGuidance && (
          <View className="mt-2.5 flex-row items-center rounded-[1rem] border border-amber-100 bg-amber-50 px-3.5 py-3">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-white">
              <MaterialCommunityIcons name={sellerGuidance.icon as any} size={21} color="#b45309" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-[8px] font-black uppercase tracking-[1.4px] text-amber-700">अब आपको क्या करना है?</Text>
              <Text className="mt-1 text-[12px] font-black leading-4 text-slate-900">{sellerGuidance.title}</Text>
              <Text className="mt-1 text-[9px] font-semibold leading-4 text-slate-500">{sellerGuidance.next}</Text>
            </View>
          </View>
        )}

        {!isPickup && stageInfo.stage !== 'COMPLETED' && stageInfo.stage !== 'CANCELLED' && (
          <TouchableOpacity onPress={() => onOpenMap(order)} activeOpacity={0.78} className="mt-3 flex-row items-center rounded-[1rem] border border-emerald-100 bg-emerald-50 px-4 py-3.5">
            <View className="h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600"><MaterialCommunityIcons name="map-marker-path" size={20} color="white" /></View>
            <View className="ml-3 flex-1"><Text className="text-[8px] font-black uppercase tracking-[1.5px] text-emerald-700">Delivery location</Text><Text className="mt-1 text-[11px] font-bold leading-4 text-slate-700" numberOfLines={2}>{order.user_address || 'Customer address unavailable'}</Text></View>
            <View className="ml-2 flex-row items-center rounded-full bg-white px-3 py-2"><Text className="text-[8px] font-black uppercase text-emerald-700">View map</Text><MaterialCommunityIcons name="chevron-right" size={14} color="#047857" /></View>
          </TouchableOpacity>
        )}

        <View className="mt-3 flex-row gap-3">
          {primaryAction ? (
            <NextActionButton
              label={primaryAction.label}
              icon={primaryAction.icon}
              loading={progressLoadingId === id}
              onPress={() => onPrimaryAction(order, primaryAction.progressAction)}
            />
          ) : (
            <TouchableOpacity onPress={() => onOpenDetails(order)} className="flex-1 items-center justify-center rounded-[0.95rem] bg-[#007a5c] py-3 shadow-md shadow-emerald-900/15">
              <Text className="text-[11px] font-black uppercase tracking-[1.4px] text-white">Details</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => onOpenDetails(order)} className="w-[86px] items-center justify-center rounded-[0.95rem] border border-slate-200 bg-white py-3">
            <MaterialCommunityIcons name="dots-horizontal" size={22} color="#475569" />
          </TouchableOpacity>
        </View>

        <View className="mt-3 flex-row gap-2">
          {onCancel && stageInfo.stage !== 'COMPLETED' && stageInfo.stage !== 'CANCELLED' && order.user_status !== 'locked' ? (
            <FooterButton icon="close-circle-outline" label="Cancel" onPress={() => onCancel(order)} />
          ) : (
            <FooterButton icon="dots-horizontal" label="More" onPress={() => imageUrl ? onViewRx(imageUrl) : onOpenDetails(order)} />
          )}
          <FooterButton icon="phone-outline" label="Call" onPress={() => onCall(order)} />
          <FooterButton icon="chat-outline" label="Chat" onPress={() => onChat(order)} />
          <FooterButton icon="clipboard-text-outline" label="Details" onPress={() => onOpenDetails(order)} />
        </View>

        <TouchableOpacity onPress={() => onRaiseComplaint(order)} className="mt-3 flex-row items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
          <MaterialCommunityIcons name="alert-box-outline" size={17} color="#b45309" />
          <Text className="ml-2 text-[10px] font-black uppercase tracking-[1.4px] text-amber-700">Raise Complaint</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
