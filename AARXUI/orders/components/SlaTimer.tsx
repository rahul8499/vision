import { LocalizedText as Text } from '@/components/Language/LocalizedPrimitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import {
  View
} from 'react-native';
import type { SlaInfo } from '../types';

const getTone = (state: SlaInfo['state']) => {
  if (state === 'breached') return { bg: '#fef2f2', fg: '#dc2626' };
  if (state === 'warning') return { bg: '#fff7ed', fg: '#ea580c' };
  return { bg: '#ecfdf5', fg: '#059669' };
};

export default function SlaTimer({ sla }: { sla: SlaInfo }) {
  const tone = getTone(sla.state);
  return (
    <View style={{ backgroundColor: tone.bg }} className="rounded-full px-2 py-1 flex-row items-center mb-1">
      <MaterialCommunityIcons name="timer-outline" size={10} color={tone.fg} />
      <Text style={{ color: tone.fg }} className="ml-1 text-[8px] font-black uppercase">{sla.label}</Text>
    </View>
  );
}
