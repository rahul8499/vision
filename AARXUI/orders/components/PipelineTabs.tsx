import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { ORDER_STAGE_CONFIG, PIPELINE_STAGES } from '../helpers/orderWorkflow';
import type { OrderStage } from '../types';

type Props = {
  activeStage: OrderStage;
  counts: Record<OrderStage, number>;
  onStageChange: (stage: OrderStage) => void;
};

export default function PipelineTabs({ activeStage, counts, onStageChange }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3 mb-2" contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }}>
      {PIPELINE_STAGES.map((stage) => {
        const selected = activeStage === stage;
        const config = ORDER_STAGE_CONFIG[stage];
        return (
          <TouchableOpacity
            key={stage}
            onPress={() => onStageChange(stage)}
            className="min-w-[92px] rounded-[1rem] border px-3.5 py-2.5 shadow-xs"
            style={{
              backgroundColor: selected ? '#123B5D' : '#FFFFFF',
              borderColor: selected ? '#123B5D' : '#B9DDE0',
            }}
          >
            <View className="flex-row items-center">
              <MaterialCommunityIcons name={config.icon as any} size={18} color={selected ? '#34d399' : config.color} />
              <Text className="ml-2 text-[18px] font-black" style={{ color: selected ? '#FFFFFF' : '#102A43' }}>{counts[stage] || 0}</Text>
            </View>
            <Text className="mt-1 text-[9px] font-bold uppercase tracking-wider" style={{ color: selected ? '#E8F4F5' : '#627D98' }} numberOfLines={1}>{config.shortLabel}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
