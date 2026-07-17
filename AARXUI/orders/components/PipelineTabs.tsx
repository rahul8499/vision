import { LocalizedText as Text } from '@/components/Language/LocalizedPrimitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import {
  ScrollView,
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
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3 mb-2" contentContainerStyle={{ gap: 10, paddingRight: 12 }}>
      {PIPELINE_STAGES.map((stage) => {
        const selected = activeStage === stage;
        const config = ORDER_STAGE_CONFIG[stage];
        return (
          <TouchableOpacity
            key={stage}
            onPress={() => onStageChange(stage)}
            className={`min-w-[86px] rounded-[1rem] border px-3 py-2.5 shadow-sm shadow-slate-200/40 ${selected ? 'border-[#00664f] bg-[#005847]' : 'border-slate-200 bg-white'}`}
          >
            <View className="flex-row items-center">
              <MaterialCommunityIcons name={config.icon as any} size={18} color={selected ? '#6ee7b7' : config.color} />
              <Text className={`ml-2 text-[18px] font-black ${selected ? 'text-white' : 'text-slate-950'}`}>{counts[stage] || 0}</Text>
            </View>
            <Text className={`mt-1 text-[9px] font-bold ${selected ? 'text-emerald-100' : 'text-slate-500'}`} numberOfLines={1}>{config.shortLabel}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
