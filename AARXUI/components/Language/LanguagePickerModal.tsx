import { LocalizedText as Text } from '@/components/Language/LocalizedPrimitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
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
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!applying) { setProgress(0); return; }
    const timer = setInterval(() => {
      setProgress(value => Math.min(88, value + (value < 45 ? 9 : 4)));
    }, 120);
    return () => clearInterval(timer);
  }, [applying]);

  const select = async (next: AppLanguage) => {
    if (next === language) { onClose(); return; }
    try {
      setApplying(next);
      setProgress(8);
      await Promise.all([
        changeLanguage(next),
        new Promise(resolve => setTimeout(resolve, 900)),
      ]);
      setProgress(100);
      await new Promise(resolve => setTimeout(resolve, 280));
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
        <View className="w-full max-w-sm bg-white rounded-[2.25rem] overflow-hidden border border-white/20 shadow-2xl">
          {applying ? (
            <LinearGradient colors={['#071a16', '#0f3d32', '#059669']} className="px-7 py-12 items-center">
              <View className="w-28 h-28 rounded-full border-[7px] border-white/20 items-center justify-center bg-white/10">
                <Text className="text-3xl font-black text-white">{progress}%</Text>
                <ActivityIndicator size="small" color="#6ee7b7" className="mt-1" />
              </View>
              <Text className="text-white text-xl font-black text-center mt-7">{t('language.applying')}</Text>
              <Text className="text-emerald-100 text-sm leading-5 text-center mt-3">{t('language.wait')}</Text>
              <View className="w-full h-2.5 overflow-hidden rounded-full bg-black/20 mt-7">
                <View className="h-full rounded-full bg-emerald-300" style={{ width: `${progress}%` }} />
              </View>
              <View className="flex-row mt-6 bg-white/15 border border-white/20 rounded-full px-4 py-2">
                <MaterialCommunityIcons name="translate" size={17} color="#a7f3d0" />
                <Text className="text-white font-black ml-2">{APP_LANGUAGES.find(x => x.code === applying)?.nativeLabel}</Text>
              </View>
              <Text className="mt-4 text-[10px] font-bold uppercase tracking-[2px] text-emerald-200">
                {progress < 35 ? t('language.saving') : progress < 75 ? t('language.translating') : progress < 100 ? t('language.refreshing') : t('language.ready')}
              </Text>
            </LinearGradient>
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
