import { LocalizedText as Text } from '@/components/Language/LocalizedPrimitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Camera, Logger, MapView, UserLocation } from 'mappls-map-react-native';
import React, { useEffect, useRef } from 'react';
import { Linking, Modal, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';

export type DeliveryDestination = {
  user_name?: string | null;
  user_address?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  user_latitude?: number | string | null;
  user_longitude?: number | string | null;
};

export default function DeliveryDestinationModal({ destination: item, onClose }: { destination: DeliveryDestination | null; onClose: () => void }) {
  const cameraRef = useRef<any>(null);
  const latitude = Number(item?.user_latitude ?? item?.latitude);
  const longitude = Number(item?.user_longitude ?? item?.longitude);
  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude) && latitude !== 0 && longitude !== 0;
  const coordinate = hasCoordinates ? [longitude, latitude] as [number, number] : [73.8567, 18.5204] as [number, number];

  useEffect(() => {
    const optionalMethods = ['setLogoGravity', 'enableTraffic', 'enableTrafficClosure', 'enableTrafficFreeFlow', 'enableTrafficNonFreeFlow', 'enableTrafficStopIcon'];
    Logger.setLogCallback((log) => log.message.includes('Method not Provisioned') && optionalMethods.some(method => log.message.includes(method)));
    return () => Logger.setLogCallback(() => false);
  }, []);

  const recenter = () => cameraRef.current?.setCamera({ centerCoordinate: coordinate, zoomLevel: 16, animationDuration: 700, animationMode: 'easeTo' });
  const navigate = async () => {
    if (!hasCoordinates) return;
    const label = encodeURIComponent(item?.user_address || 'Delivery destination');
    try {
      await Linking.openURL(`geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`);
    } catch {
      Toast.show({ type: 'error', text1: 'Navigation unavailable', text2: 'Use the in-app Mappls map.' });
    }
  };

  return (
    <Modal visible={Boolean(item)} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View className="flex-1 bg-slate-950">
        {hasCoordinates ? <MapView style={{ flex: 1 }} compassEnabled><Camera ref={cameraRef} defaultSettings={{ centerCoordinate: coordinate, zoomLevel: 16 }} /><UserLocation visible /></MapView> : (
          <View className="flex-1 items-center justify-center bg-slate-100 px-8"><MaterialCommunityIcons name="map-marker-alert-outline" size={48} color="#64748b" /><Text className="mt-4 text-base font-black text-slate-900">Location pin unavailable</Text><Text className="mt-2 text-center text-xs font-semibold text-slate-500">This order has no saved coordinates.</Text></View>
        )}
        {hasCoordinates && <View pointerEvents="none" className="absolute bottom-[190px] left-0 right-0 top-0 items-center justify-center"><View className="h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20"><View className="h-10 w-10 items-center justify-center rounded-full border-[3px] border-white bg-emerald-600"><MaterialCommunityIcons name="home-map-marker" size={22} color="white" /></View></View></View>}
        <View className="absolute left-4 right-4 top-12 flex-row justify-between"><TouchableOpacity onPress={onClose} className="h-11 w-11 items-center justify-center rounded-2xl bg-slate-950/85"><MaterialCommunityIcons name="arrow-left" size={23} color="white" /></TouchableOpacity><View className="rounded-full bg-slate-950/85 px-4 py-2"><Text className="text-[9px] font-black uppercase tracking-[1.8px] text-white">Delivery location</Text></View><TouchableOpacity onPress={recenter} className="h-11 w-11 items-center justify-center rounded-2xl bg-slate-950/85"><MaterialCommunityIcons name="crosshairs-gps" size={22} color="white" /></TouchableOpacity></View>
        <View className="absolute bottom-0 left-0 right-0 rounded-t-[2rem] bg-white px-5 pb-7 pt-5">
          <View className="mb-4 flex-row"><View className="h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50"><MaterialCommunityIcons name="account-location" size={25} color="#059669" /></View><View className="ml-3 flex-1"><Text className="text-[8px] font-black uppercase tracking-[1.8px] text-emerald-700">Deliver to</Text><Text className="text-base font-black text-slate-950">{item?.user_name || 'Customer'}</Text><Text className="mt-1 text-[11px] font-semibold leading-4 text-slate-600">{item?.user_address || 'Address unavailable'}</Text></View></View>
          <View className="flex-row gap-3"><TouchableOpacity onPress={recenter} disabled={!hasCoordinates} className="h-12 flex-1 flex-row items-center justify-center rounded-2xl border border-slate-200 bg-slate-50"><MaterialCommunityIcons name="map-marker-radius" size={18} color="#0f172a" /><Text className="ml-2 text-[10px] font-black uppercase text-slate-900">Show pin</Text></TouchableOpacity><TouchableOpacity onPress={navigate} disabled={!hasCoordinates} className={`h-12 flex-[1.35] flex-row items-center justify-center rounded-2xl ${hasCoordinates ? 'bg-emerald-600' : 'bg-slate-300'}`}><MaterialCommunityIcons name="navigation-variant" size={18} color="white" /><Text className="ml-2 text-[10px] font-black uppercase text-white">Navigate</Text></TouchableOpacity></View>
        </View>
      </View>
    </Modal>
  );
}
