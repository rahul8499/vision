import { translateStatic as t } from '@/components/Language/LocalizedPrimitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  Text,
  TouchableOpacity
} from 'react-native';

type Props = {
  label: string;
  icon: string;
  loading?: boolean;
  onPress: () => void;
};

export default function NextActionButton({ label, icon, loading, onPress }: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading}
      className="flex-1 flex-row items-center justify-center rounded-[0.95rem] py-3.5 shadow-xs active:opacity-90"
      style={{ backgroundColor: '#123B5D' }}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#ffffff" />
      ) : (
        <MaterialCommunityIcons name={icon as any} size={18} color="#ffffff" />
      )}
      <Text className="ml-2 text-[11px] font-black uppercase tracking-[1.4px] text-white" numberOfLines={1}>
        {t(label)}
      </Text>
    </TouchableOpacity>
  );
}
