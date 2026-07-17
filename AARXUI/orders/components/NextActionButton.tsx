import { LocalizedText as Text } from '@/components/Language/LocalizedPrimitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
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
      className="flex-1 flex-row items-center justify-center rounded-[0.95rem] bg-[#007a5c] py-3 shadow-md shadow-emerald-900/15"
    >
      {loading ? (
        <ActivityIndicator size="small" color="#ffffff" />
      ) : (
        <MaterialCommunityIcons name={icon as any} size={18} color="#ffffff" />
      )}
      <Text className="ml-2 text-[11px] font-black uppercase tracking-[1.4px] text-white" numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}
