import { LocalizedText as Text } from '@/components/Language/LocalizedPrimitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  TouchableOpacity,
  View
} from 'react-native';
import Toast from 'react-native-toast-message';
import { APP_LANGUAGES, AppLanguage, useAppLanguage } from '@/context/LanguageContext';

export function LanguagePickerModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { language, changeLanguage, t } = useAppLanguage();
  const [applying, setApplying] = useState<AppLanguage | null>(null);

  const select = async (next: AppLanguage) => {
    if (next === language) { onClose(); return; }
    try {
      setApplying(next);
      await changeLanguage(next);
      await new Promise(resolve => setTimeout(resolve, 650));
      onClose();
      Toast.show({ type: 'success', text1: String(t('language.applied')), position: 'bottom' });
    } catch {
      Toast.show({ type: 'error', text1: String(t('language.failed')), text2: String(t('language.retry')), position: 'bottom' });
    } finally {
      setApplying(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => !applying && onClose()}>
      <View className="flex-1 bg-black/60 justify-center items-center px-5">
        <View className="w-full max-w-sm bg-white rounded-[2.25rem] overflow-hidden border border-slate-200 shadow-2xl">
          {applying ? (
            <View className="px-7 py-12 items-center">
              <View className="w-24 h-24 rounded-[2rem] bg-emerald-50 border border-emerald-100 items-center justify-center">
                <ActivityIndicator size="large" color="#059669" />
              </View>
              <Text className="text-slate-950 text-xl font-black text-center mt-7">{t('language.applying')}</Text>
              <Text className="text-slate-500 text-sm leading-5 text-center mt-3">{t('language.wait')}</Text>
              <View className="flex-row mt-6 bg-slate-100 rounded-full px-4 py-2">
                <Text className="text-slate-700 font-black">{APP_LANGUAGES.find(x => x.code === applying)?.nativeLabel}</Text>
              </View>
            </View>
          ) : (
            <View className="p-6">
              <View className="flex-row items-center mb-6">
                <View className="w-14 h-14 rounded-2xl bg-emerald-50 items-center justify-center"><MaterialCommunityIcons name="translate" size={27} color="#059669" /></View>
                <View className="ml-4 flex-1"><Text className="text-xl font-black text-slate-950">{t('language.select')}</Text><Text className="text-xs text-slate-500 mt-1">{t('language.subtitle')}</Text></View>
                <TouchableOpacity onPress={onClose} className="w-10 h-10 rounded-full bg-slate-100 items-center justify-center"><MaterialCommunityIcons name="close" size={20} color="#64748b" /></TouchableOpacity>
              </View>
              {APP_LANGUAGES.map(option => {
                const selected = option.code === language;
                return <TouchableOpacity key={option.code} onPress={() => select(option.code)} className={`flex-row items-center p-4 mb-3 rounded-2xl border ${selected ? 'bg-emerald-50 border-emerald-500' : 'bg-white border-slate-200'}`}><View className={`w-11 h-11 rounded-xl items-center justify-center ${selected ? 'bg-emerald-600' : 'bg-slate-100'}`}><Text className={`font-black ${selected ? 'text-white' : 'text-slate-600'}`}>{option.code.toUpperCase()}</Text></View><View className="ml-4 flex-1"><Text className="font-black text-slate-950">{option.nativeLabel}</Text><Text className="text-xs text-slate-400 mt-0.5">{option.label}</Text></View><MaterialCommunityIcons name={selected ? 'check-circle' : 'circle-outline'} size={23} color={selected ? '#059669' : '#cbd5e1'} /></TouchableOpacity>;
              })}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
