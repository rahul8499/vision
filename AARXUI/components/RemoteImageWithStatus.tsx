import { LocalizedText as Text } from '@/components/Language/LocalizedPrimitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  TouchableOpacity,
  View
} from 'react-native';

export default function RemoteImageWithStatus({
  uri,
  resizeMode = 'cover',
  loadingLabel = 'Loading image',
}: {
  uri: string;
  resizeMode?: 'cover' | 'contain';
  loadingLabel?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setLoading(true);
    setFailed(false);
    setAttempt(0);
  }, [uri]);

  return (
    <View className="h-full w-full overflow-hidden bg-slate-100">
      <Image
        key={`${uri}:${attempt}`}
        source={{ uri }}
        style={{ width: '100%', height: '100%' }}
        resizeMode={resizeMode}
        onLoadStart={() => {
          setLoading(true);
          setFailed(false);
        }}
        onLoad={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setFailed(true);
        }}
      />
      {loading && (
        <View className="absolute inset-0 items-center justify-center bg-slate-100">
          <ActivityIndicator size="small" color="#059669" />
          <Text className="mt-2 text-[8px] font-black uppercase tracking-[1.5px] text-slate-500">{loadingLabel}</Text>
        </View>
      )}
      {failed && (
        <View className="absolute inset-0 items-center justify-center bg-slate-100 px-4">
          <MaterialCommunityIcons name="image-off-outline" size={25} color="#64748b" />
          <Text className="mt-2 text-center text-[9px] font-bold text-slate-600">Image load nahi hui</Text>
          <TouchableOpacity
            onPress={() => {
              setFailed(false);
              setLoading(true);
              setAttempt(value => value + 1);
            }}
            className="mt-2 flex-row items-center rounded-full bg-slate-900 px-3 py-1.5"
          >
            <MaterialCommunityIcons name="refresh" size={12} color="white" />
            <Text className="ml-1 text-[8px] font-black uppercase tracking-wider text-white">Retry</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
