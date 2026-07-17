import { LocalizedText as Text } from '@/components/Language/LocalizedPrimitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import {
  View
} from 'react-native';
import type { PriorityInfo } from '../types';

const getTone = (label: PriorityInfo['label']) => {
  if (label === 'High') return { bg: '#fef2f2', fg: '#dc2626', icon: 'alert-decagram' as const };
  if (label === 'Medium') return { bg: '#fff7ed', fg: '#ea580c', icon: 'alert-circle-outline' as const };
  return { bg: '#f0fdf4', fg: '#16a34a', icon: 'check-circle-outline' as const };
};

export default function PriorityBadge({ priority }: { priority: PriorityInfo }) {
  const tone = getTone(priority.label);
  return (
    <View style={{ backgroundColor: tone.bg }} className="rounded-full px-2 py-1 flex-row items-center mb-1">
      <MaterialCommunityIcons name={tone.icon} size={10} color={tone.fg} />
      <Text style={{ color: tone.fg }} className="ml-1 text-[8px] font-black uppercase">{priority.label}</Text>
    </View>
  );
}
