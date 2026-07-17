import { LocalizedText as Text } from '@/components/Language/LocalizedPrimitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import {
  Modal,
  ScrollView,
  TouchableOpacity,
  View
} from 'react-native';
import { getSlaState } from '../helpers/orderSla';
import { resolveOrderStage } from '../helpers/orderWorkflow';
import type { PriorityInfo, SellerOrder } from '../types';

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

type Props = {
  order: SellerOrder | null;
  priority?: PriorityInfo;
  visible: boolean;
  onClose: () => void;
};

export default function DetailsSheet({ order, priority, visible, onClose }: Props) {
  const stageInfo = order ? resolveOrderStage(order) : null;
  const sla = order && stageInfo ? getSlaState(order, stageInfo.config) : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/45">
        <TouchableOpacity className="flex-1" activeOpacity={1} onPress={onClose} />
        <View className="max-h-[82%] rounded-t-[2rem] bg-white px-5 pb-8 pt-3">
          <View className="mb-4 items-center"><View className="h-1.5 w-12 rounded-full bg-slate-200" /></View>
          {order && stageInfo && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="mb-4 flex-row items-start justify-between">
                <View className="flex-1 pr-4">
                  <Text className="text-[9px] font-black uppercase tracking-[2px] text-slate-400">Order Details</Text>
                  <Text className="mt-1 text-xl font-black text-slate-950" numberOfLines={1}>{order.user_name || 'Patient'}</Text>
                  <Text className="mt-1 text-xs font-bold text-slate-500" numberOfLines={2}>{order.user_address || 'Address not available'}</Text>
                </View>
                <TouchableOpacity onPress={onClose} className="h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
                  <MaterialCommunityIcons name="close" size={20} color="#0f172a" />
                </TouchableOpacity>
              </View>

              <View className="mb-4 rounded-[1.25rem] border border-emerald-100 bg-emerald-50/70 px-4 py-3 flex-row items-center justify-between">
                <View>
                  <Text className="text-[9px] font-black uppercase tracking-[2px] text-emerald-700">Amount</Text>
                  <Text className="mt-1 text-[10px] font-bold text-slate-500">{stageInfo.config.label} stage</Text>
                </View>
                <Text className="text-xl font-black text-emerald-700">{formatCurrency(order.total_amount)}</Text>
              </View>

              {priority && priority.reasons.length > 0 && (
                <View className="mb-4 rounded-[1.25rem] border border-red-100 bg-red-50 px-4 py-3">
                  <Text className="text-[9px] font-black uppercase tracking-[2px] text-red-700">{priority.label} Priority</Text>
                  {priority.reasons.map((reason) => (
                    <Text key={reason} className="mt-1 text-xs font-bold text-red-900">• {reason}</Text>
                  ))}
                </View>
              )}

              {sla && (
                <View className="mb-4 rounded-[1.25rem] border border-slate-100 bg-slate-50 px-4 py-3">
                  <Text className="text-[9px] font-black uppercase tracking-[2px] text-slate-400">SLA</Text>
                  <Text className="mt-1 text-xs font-bold text-slate-700">Elapsed: {sla.elapsedMinutes} min • Remaining: {sla.remainingMinutes} min</Text>
                </View>
              )}

              {order.repeat_customer && (
                <View className="mb-4 rounded-[1.25rem] border border-amber-100 bg-amber-50 px-4 py-3">
                  <Text className="text-[9px] font-black uppercase tracking-[2px] text-amber-700">Repeat Customer</Text>
                  <Text className="mt-1 text-xs font-bold text-amber-900">Completed Orders: {order.repeat_order_count || 1}</Text>
                  {!!order.last_order_at && <Text className="mt-1 text-xs font-bold text-amber-900">Last Order: {formatDate(order.last_order_at)}</Text>}
                </View>
              )}

              <View className="rounded-[1rem] border border-slate-100 overflow-hidden">
                {(order.medicines || []).length > 0 ? (order.medicines || []).map((medicine, idx) => (
                  <View key={`${medicine.medicine_name || 'medicine'}-${idx}`} className={`flex-row items-center justify-between px-3 py-3 ${idx < (order.medicines || []).length - 1 ? 'border-b border-slate-100' : ''}`}>
                    <Text className="flex-1 pr-3 text-xs font-black text-slate-900" numberOfLines={1}>{medicine.medicine_name || 'Medicine'}</Text>
                    <Text className="text-xs font-black text-slate-700">{formatCurrency(medicine.price)}</Text>
                  </View>
                )) : (
                  <View className="px-3 py-3"><Text className="text-xs font-bold text-slate-500">Medicine details are not shared yet.</Text></View>
                )}
              </View>

              {!!order.response_text && (
                <View className="mt-3 rounded-[1rem] border border-slate-100 bg-slate-50 px-3 py-3">
                  <Text className="mb-1 text-[9px] font-black uppercase tracking-[2px] text-slate-400">Note</Text>
                  <Text className="text-xs font-semibold leading-5 text-slate-700">{order.response_text}</Text>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
