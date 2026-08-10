import { translateStatic as t } from '@/components/Language/LocalizedPrimitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import {
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { handleDownloadInvoice } from '../../app/(sellerTabs)/history';
import { getSlaState } from '../helpers/orderSla';
import { resolveOrderStage } from '../helpers/orderWorkflow';
import type { PriorityInfo, SellerOrder } from '../types';

const SELLER_THEME = {
  primaryNavy: '#123B5D',
  secondaryTeal: '#0F8B8D',
  background: '#F4F8FA',
  lightTealCard: '#E8F4F5',
  borderTeal: '#B9DDE0',
  whiteCard: '#FFFFFF',
  mainText: '#102A43',
  secondaryText: '#627D98',
  successGreen: '#16A34A',
  warningAmber: '#D97706',
  errorRed: '#DC2626',
};

const formatCurrency = (value?: number | string | null) => {
  if (value === null || value === undefined || value === '') return 'Included in total';
  const amount = Number(value);
  if (Number.isNaN(amount)) return String(value);
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
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
      <View className="flex-1 justify-end bg-black/50">
        <TouchableOpacity className="flex-1" activeOpacity={1} onPress={onClose} />
        <View className="max-h-[85%] rounded-t-[2rem] bg-white px-5 pb-8 pt-3 border-t shadow-2xl" style={{ borderColor: SELLER_THEME.borderTeal }}>
          <View className="mb-4 items-center">
            <View className="h-1.5 w-12 rounded-full" style={{ backgroundColor: SELLER_THEME.borderTeal }} />
          </View>
          {order && stageInfo && (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {/* Header Info */}
              <View className="mb-4 flex-row items-start justify-between">
                <View className="flex-1 pr-4">
                  <Text className="text-[9px] font-black uppercase tracking-[2px]" style={{ color: SELLER_THEME.secondaryTeal }}>
                    {t('Order Guidance & Details')}
                  </Text>
                  <Text className="mt-1 text-xl font-black" style={{ color: SELLER_THEME.mainText }} numberOfLines={1}>
                    {order.user_name || 'Patient'}
                  </Text>
                  <Text className="mt-1 text-xs font-bold" style={{ color: SELLER_THEME.secondaryText }} numberOfLines={2}>
                    {order.user_address || t('Address not available')}
                  </Text>
                </View>
                <TouchableOpacity onPress={onClose} className="h-10 w-10 items-center justify-center rounded-full border bg-slate-50" style={{ borderColor: SELLER_THEME.borderTeal }}>
                  <MaterialCommunityIcons name="close" size={20} color={SELLER_THEME.mainText} />
                </TouchableOpacity>
              </View>

              {/* Order Amount Banner */}
              <View className="mb-4 rounded-[1.25rem] border px-4 py-3 flex-row items-center justify-between" style={{ backgroundColor: SELLER_THEME.lightTealCard, borderColor: SELLER_THEME.borderTeal }}>
                <View>
                  <Text className="text-[9px] font-black uppercase tracking-[2px]" style={{ color: SELLER_THEME.secondaryTeal }}>
                    {t('Quoted Amount')}
                  </Text>
                  <Text className="mt-1 text-[10.5px] font-black" style={{ color: SELLER_THEME.primaryNavy }}>
                    {t(`${stageInfo.config.label} Stage`)}
                  </Text>
                </View>
                <Text className="text-xl font-black" style={{ color: SELLER_THEME.primaryNavy }}>
                  {order.total_amount ? `₹${Number(order.total_amount).toFixed(2)}` : 'Calculated'}
                </Text>
              </View>

              {/* 1️⃣ Priority Level */}
              <View className="mb-4 rounded-[1.25rem] border p-4" style={{
                backgroundColor: priority?.label === 'High' ? '#FEF2F2' : priority?.label === 'Medium' ? '#FFFBEB' : SELLER_THEME.background,
                borderColor: priority?.label === 'High' ? '#FECDD3' : priority?.label === 'Medium' ? '#FDE68A' : SELLER_THEME.borderTeal
              }}>
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center">
                    <MaterialCommunityIcons
                      name={priority?.label === 'High' ? 'alert-decagram' : priority?.label === 'Medium' ? 'alert-circle-outline' : 'check-circle-outline'}
                      size={18}
                      color={priority?.label === 'High' ? SELLER_THEME.errorRed : priority?.label === 'Medium' ? SELLER_THEME.warningAmber : SELLER_THEME.successGreen}
                    />
                    <Text className="ml-2 text-[11px] font-black uppercase tracking-wider" style={{
                      color: priority?.label === 'High' ? SELLER_THEME.errorRed : priority?.label === 'Medium' ? SELLER_THEME.warningAmber : SELLER_THEME.mainText
                    }}>
                      {t('Priority Level')}: {priority?.label === 'High' ? t('High (Urgent Action Needed)') : priority?.label === 'Medium' ? t('Medium (Pending Attention)') : t('Normal (On Schedule)')}
                    </Text>
                  </View>
                </View>

                {priority && priority.reasons.length > 0 ? (
                  <View className="mt-1">
                    <Text className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                      {t('Reasons')}:
                    </Text>
                    {priority.reasons.map((reason) => (
                      <View key={reason} className="flex-row items-center mt-1">
                        <MaterialCommunityIcons name="check-circle-outline" size={13} color={SELLER_THEME.primaryNavy} />
                        <Text className="ml-1.5 text-xs font-black" style={{ color: SELLER_THEME.mainText }}>
                          {t(reason)}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text className="mt-1 text-xs font-bold" style={{ color: SELLER_THEME.secondaryText }}>
                    {t('This is a normal order operating within standard timeline.')}
                  </Text>
                )}
              </View>

              {/* 2️⃣ Target Processing Time */}
              {sla && (
                <View className="mb-4 rounded-[1.25rem] border px-4 py-3" style={{ backgroundColor: SELLER_THEME.background, borderColor: SELLER_THEME.borderTeal }}>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-[9px] font-black uppercase tracking-[2px]" style={{ color: SELLER_THEME.secondaryTeal }}>
                      {t('Target Processing Time')}
                    </Text>
                    <View className="flex-row items-center">
                      <MaterialCommunityIcons name="clock-outline" size={12} color={SELLER_THEME.primaryNavy} />
                      <Text className="ml-1 text-[10px] font-black" style={{ color: SELLER_THEME.primaryNavy }}>
                        {sla.remainingMinutes > 0 ? `${sla.remainingMinutes} ${t('min remaining')}` : t('Target time elapsed')}
                      </Text>
                    </View>
                  </View>
                  <Text className="mt-1.5 text-xs font-bold" style={{ color: SELLER_THEME.mainText }}>
                    {t('Order elapsed time')}: {sla.elapsedMinutes} {t('minutes')}
                  </Text>
                </View>
              )}

              {/* 3️⃣ Repeat Customer Details */}
              {order.repeat_customer && (
                <View className="mb-4 rounded-[1.25rem] border border-amber-200 bg-amber-50 px-4 py-3">
                  <View className="flex-row items-center">
                    <MaterialCommunityIcons name="star-circle" size={16} color={SELLER_THEME.warningAmber} />
                    <Text className="ml-1.5 text-[10px] font-black uppercase tracking-[1.5px] text-amber-800">
                      {t('Repeat Customer')}
                    </Text>
                  </View>
                  <Text className="mt-1 text-xs font-bold text-amber-900">
                    {t('This customer has completed')} {order.repeat_order_count || 1} {t('orders previously.')}
                  </Text>
                </View>
              )}

              {/* 4️⃣ Medicines List Breakdown */}
              <View className="rounded-[1rem] border overflow-hidden mb-4" style={{ borderColor: SELLER_THEME.borderTeal }}>
                <View className="bg-slate-50 px-3.5 py-2.5 border-b border-slate-200 flex-row items-center justify-between">
                  <Text className="text-[9px] font-black uppercase tracking-widest" style={{ color: SELLER_THEME.secondaryTeal }}>
                    {t('Medicines List')} ({order.medicines?.length || 0} {t('items')})
                  </Text>
                  <Text className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                    Price
                  </Text>
                </View>
                {(order.medicines || []).length > 0 ? (order.medicines || []).map((medicine, idx) => {
                  const medPrice = medicine.price !== undefined && medicine.price !== null && medicine.price !== ''
                    ? `₹${Number(medicine.price).toFixed(2)}`
                    : (order.total_amount && (order.medicines || []).length > 0
                        ? `₹${(Number(order.total_amount) / (order.medicines || []).length).toFixed(2)}`
                        : 'Included');

                  return (
                    <View key={`${medicine.medicine_name || 'medicine'}-${idx}`} className={`flex-row items-center justify-between px-3.5 py-3 ${idx < (order.medicines || []).length - 1 ? 'border-b border-slate-100' : ''}`}>
                      <Text className="flex-1 pr-3 text-xs font-black" style={{ color: SELLER_THEME.mainText }} numberOfLines={1}>
                        {medicine.medicine_name || 'Medicine'}
                      </Text>
                      <Text className="text-xs font-black" style={{ color: SELLER_THEME.secondaryTeal }}>
                        {medPrice}
                      </Text>
                    </View>
                  );
                }) : (
                  <View className="px-3.5 py-3">
                    <Text className="text-xs font-bold text-slate-500">{t('Prescription request itemization')}</Text>
                  </View>
                )}
              </View>

              {/* Store / Customer Note */}
              {!!order.response_text && (
                <View className="mb-4 rounded-[1rem] border bg-slate-50 px-3.5 py-3" style={{ borderColor: SELLER_THEME.borderTeal }}>
                  <Text className="mb-1 text-[9px] font-black uppercase tracking-[2px]" style={{ color: SELLER_THEME.secondaryTeal }}>
                    {t('Store Note')}
                  </Text>
                  <Text className="text-xs font-semibold leading-5" style={{ color: SELLER_THEME.mainText }}>
                    {order.response_text}
                  </Text>
                </View>
              )}

              {/* Download Tax Invoice PDF Button (Completed Orders Only) */}
              {(stageInfo.stage === 'COMPLETED' || order.user_status === 'completed') && (
                <TouchableOpacity
                  onPress={() => handleDownloadInvoice(order)}
                  className="w-full bg-emerald-600 rounded-xl py-3.5 flex-row items-center justify-center shadow-sm active:bg-emerald-700 mt-1"
                >
                  <MaterialCommunityIcons name="file-pdf-box" size={20} color="#FFFFFF" />
                  <Text className="text-white font-black text-xs uppercase tracking-wider ml-2">Download GST Invoice PDF 📄</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
