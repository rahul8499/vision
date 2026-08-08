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

const THEME = {
  navy: '#123B5D',
  teal: '#0F8B8D',
  border: '#B9DDE0',
  cardBg: '#F4F8FA',
  textDark: '#102A43',
  textMuted: '#627D98',
};

const STAGE_COLOR_LEGEND = [
  { label: 'NEW', title: 'New Order (Billing Pending)', color: '#2563eb', bg: '#eff6ff', desc: 'Naya order aaya hai. Dawaiyon ka bill banana shuru karein.' },
  { label: 'BILLING', title: 'Billing & Packing', color: '#ea580c', bg: '#fff7ed', desc: 'Bill banakar dawaiyan pack karein. Packing ke baad Packed dabayein.' },
  { label: 'PACKED', title: 'Packed & Awaiting Dispatch', color: '#4f46e5', bg: '#eef2ff', desc: 'Packing ready hai. Delivery partner chunein ya Pickup ke liye taiyar rakhein.' },
  { label: 'READY', title: 'Ready for Store Pickup', color: '#059669', bg: '#ecfdf5', desc: 'Customer store par aayega. Customer se OTP lekar order dein.' },
  { label: 'DELIVERY', title: 'Out for Home Delivery', color: '#0284c7', bg: '#f0f9ff', desc: 'Delivery partner raste me hai. Customer location par OTP verify hoga.' },
  { label: 'OTP', title: 'OTP Verification Pending', color: '#16a34a', bg: '#f0fdf4', desc: 'Customer se mila OTP enter karein order Complete karne ke liye.' },
  { label: 'COMPLETED', title: 'Order Completed', color: '#64748b', bg: '#f8fafc', desc: 'Order safaltapoorvak poora ho gaya hai.' },
  { label: 'CANCELLED', title: 'Order Cancelled', color: '#dc2626', bg: '#fef2f2', desc: 'Order kisi karan se radd kar diya gaya hai.' },
];

const PRIORITY_LEGEND = [
  { level: 'HIGH', color: '#dc2626', bg: '#fef2f2', icon: 'alert-decagram', desc: 'Emergency prescription ya SLA time khatam ho chuka hai. Turant action lein.' },
  { level: 'MEDIUM', color: '#d97706', bg: '#fffbeb', icon: 'alert-circle-outline', desc: 'OTP pending hai, customer message aaya hai ya time kam bacha hai.' },
  { level: 'NORMAL', color: '#16a34a', bg: '#f0fdf4', icon: 'check-circle-outline', desc: 'Standard order hai jo time par chal raha hai.' },
];

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function OrderGuideModal({ visible, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/50">
        <TouchableOpacity className="flex-1" activeOpacity={1} onPress={onClose} />
        <View className="max-h-[88%] rounded-t-[2rem] bg-white px-5 pb-8 pt-3 border-t shadow-2xl" style={{ borderColor: THEME.border }}>
          <View className="mb-3 items-center">
            <View className="h-1.5 w-12 rounded-full" style={{ backgroundColor: THEME.border }} />
          </View>

          {/* Header */}
          <View className="mb-4 flex-row items-center justify-between border-b pb-3" style={{ borderColor: THEME.border }}>
            <View className="flex-row items-center flex-1 pr-3">
              <View className="h-10 w-10 items-center justify-center rounded-2xl bg-teal-50 border border-teal-200">
                <MaterialCommunityIcons name="book-open-page-variant-outline" size={22} color={THEME.teal} />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-[9px] font-black uppercase tracking-[2px]" style={{ color: THEME.teal }}>
                  {t('Order System Guide')}
                </Text>
                <Text className="text-base font-black" style={{ color: THEME.textDark }}>
                  {t('Workflow, Colors & Rules')}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} className="h-9 w-9 items-center justify-center rounded-full border bg-slate-50" style={{ borderColor: THEME.border }}>
              <MaterialCommunityIcons name="close" size={18} color={THEME.textDark} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* 1️⃣ Card Left Strip Color Legend */}
            <View className="mb-5">
              <Text className="mb-2 text-[10px] font-black uppercase tracking-[1.5px]" style={{ color: THEME.navy }}>
                1. {t('Card Left Strip Colors (Card Color Patti)')}
              </Text>
              <Text className="mb-3 text-xs font-bold text-slate-500">
                {t('Card ke left side par vertical color patti order ki stage batati hai:')}
              </Text>

              <View className="gap-2">
                {STAGE_COLOR_LEGEND.map((item) => (
                  <View key={item.label} className="flex-row items-start rounded-xl border p-3" style={{ backgroundColor: item.bg, borderColor: `${item.color}30` }}>
                    <View className="h-full w-1.5 rounded-full mr-3" style={{ backgroundColor: item.color }} />
                    <View className="flex-1">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-xs font-black" style={{ color: item.color }}>
                          {t(item.title)}
                        </Text>
                        <View className="px-2 py-0.5 rounded-md bg-white border border-slate-200">
                          <Text className="text-[8px] font-black" style={{ color: item.color }}>{item.label}</Text>
                        </View>
                      </View>
                      <Text className="mt-1 text-[11px] font-semibold text-slate-700 leading-4">
                        {t(item.desc)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* 2️⃣ Order Priority Levels */}
            <View className="mb-5">
              <Text className="mb-2 text-[10px] font-black uppercase tracking-[1.5px]" style={{ color: THEME.navy }}>
                2. {t('Order Priority Levels (प्राथमिकता स्टैम्प)')}
              </Text>

              <View className="gap-2">
                {PRIORITY_LEGEND.map((item) => (
                  <View key={item.level} className="flex-row items-start rounded-xl border p-3" style={{ backgroundColor: item.bg, borderColor: `${item.color}40` }}>
                    <MaterialCommunityIcons name={item.icon as any} size={18} color={item.color} className="mt-0.5" />
                    <View className="ml-2.5 flex-1">
                      <Text className="text-xs font-black uppercase tracking-wider" style={{ color: item.color }}>
                        {item.level} Priority
                      </Text>
                      <Text className="mt-0.5 text-[11px] font-semibold text-slate-700 leading-4">
                        {t(item.desc)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* 3️⃣ Step-by-Step Store Operational Rules */}
            <View className="mb-4">
              <Text className="mb-2 text-[10px] font-black uppercase tracking-[1.5px]" style={{ color: THEME.navy }}>
                3. {t('Step-by-Step Store Workflow')}
              </Text>
              
              <View className="rounded-2xl border bg-slate-50 p-4" style={{ borderColor: THEME.border }}>
                <View className="mb-3 flex-row items-start">
                  <View className="h-6 w-6 items-center justify-center rounded-full bg-teal-600">
                    <Text className="text-xs font-black text-white">1</Text>
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="text-xs font-black" style={{ color: THEME.textDark }}>{t('New Order & Billing')}</Text>
                    <Text className="mt-0.5 text-[11px] font-semibold text-slate-600">{t('Dawaiyon ki list dekhein aur Start Billing button dabayein.')}</Text>
                  </View>
                </View>

                <View className="mb-3 flex-row items-start">
                  <View className="h-6 w-6 items-center justify-center rounded-full bg-teal-600">
                    <Text className="text-xs font-black text-white">2</Text>
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="text-xs font-black" style={{ color: THEME.textDark }}>{t('Packing & Bill Invoice')}</Text>
                    <Text className="mt-0.5 text-[11px] font-semibold text-slate-600">{t('Bill ke sath medicines pack karein aur Mark as Packed dabayein.')}</Text>
                  </View>
                </View>

                <View className="mb-3 flex-row items-start">
                  <View className="h-6 w-6 items-center justify-center rounded-full bg-teal-600">
                    <Text className="text-xs font-black text-white">3</Text>
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="text-xs font-black" style={{ color: THEME.textDark }}>{t('Dispatch (Delivery / Pickup)')}</Text>
                    <Text className="mt-0.5 text-[11px] font-semibold text-slate-600">{t('Delivery order ke liye partner select karein. Store pickup ke liye Ready for Pickup dabayein.')}</Text>
                  </View>
                </View>

                <View className="flex-row items-start">
                  <View className="h-6 w-6 items-center justify-center rounded-full bg-teal-600">
                    <Text className="text-xs font-black text-white">4</Text>
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="text-xs font-black" style={{ color: THEME.textDark }}>{t('OTP Verification & Completion')}</Text>
                    <Text className="mt-0.5 text-[11px] font-semibold text-slate-600">{t('Customer se 4-digit OTP lekar enter karein. Sahi OTP dalte hi order Complete ho jayega.')}</Text>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
