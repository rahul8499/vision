import { LocalizedText as Text } from '@/components/Language/LocalizedPrimitives';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import axios from 'axios';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  ImageBackground,
  Modal,
  Platform,
  ScrollView,
  TouchableOpacity,
  View
} from 'react-native';
import Toast from 'react-native-toast-message';
import RemoteImageWithStatus from '../../components/RemoteImageWithStatus';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface PrescriptionItem {
  status: string;
  address: string;
  id: number;
  image: string;
  uploaded_at: string;
  latitude: number;
  longitude: number;
  user: number;
  user_address?: string;
  emergency?: boolean | string;
  target_stores?: {
    store_name: string,
    id: number; name: string
  }[];
}

interface PrescriptionsResponse {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  results: PrescriptionItem[];
}

const buildMediaUrl = (baseUrl: string | undefined, mediaPath?: string | null) => {
  if (!mediaPath) return null;
  if (/^https?:\/\//i.test(mediaPath)) return mediaPath;
  const base = (baseUrl || '').replace(/\/+$/, '');
  const path = mediaPath.startsWith('/') ? mediaPath : `/${mediaPath}`;
  return `${base}${path}`;
};

export default function HistoryScreen() {
  const BASE_URL = Constants.expoConfig?.extra?.BASE_URL;
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [data, setData] = useState<PrescriptionItem[]>([]);
  const [page, setPage] = useState(1);
  const [isLastPage, setIsLastPage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const isFocused = useIsFocused();

  // Temporal Scope Filtering
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState<{ mode: 'start' | 'end'; visible: boolean }>({
    mode: 'start',
    visible: false,
  });
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);

  const fetchPrescriptions = async (pageNum = 1, append = false, overrideStart?: Date | null, overrideEnd?: Date | null) => {
    const storedToken = token || await SecureStore.getItemAsync('authToken');
    const storedUserId = userId || await SecureStore.getItemAsync('userId');

    if (!storedToken || !storedUserId) {
      console.log("⚠️ History Scope: Context missing, aborting fetch");
      return;
    }

    try {
      if (append) setLoadingMore(true);
      else setLoading(true);

      let url = `${BASE_URL}/api/prescriptions/?user_id=${storedUserId}&page=${pageNum}&page_size=10`;

      const sDate = overrideStart !== undefined ? overrideStart : startDate;
      const eDate = overrideEnd !== undefined ? overrideEnd : endDate;

      if (sDate && eDate) {
        url += `&start_date=${encodeURIComponent(sDate.toISOString())}&end_date=${encodeURIComponent(eDate.toISOString())}`;
      }

      const response = await axios.get<PrescriptionsResponse>(url, {
        headers: { Authorization: `Bearer ${storedToken}` },
      });

      const newResults = response.data.results;
      setData((prev) => {
        if (append) {
          const existingIds = new Set(prev.map(item => item.id));
          const uniqueNew = newResults.filter((item: PrescriptionItem) => !existingIds.has(item.id));
          return [...prev, ...uniqueNew];
        }
        return newResults;
      });
      setPage(response.data.page);
      setIsLastPage(response.data.page >= response.data.total_pages);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      const init = async () => {
        const storedToken = await SecureStore.getItemAsync('authToken');
        const storedUserId = await SecureStore.getItemAsync('userId');
        setToken(storedToken);
        setUserId(storedUserId);
        if (storedToken && storedUserId) {
          // Directly fetch without any date filter
          fetchPrescriptions(1, false);
        }
      };
      init();
    }, [isFocused])
  );

  const deletePrescription = async (id: number) => {
    setDeleteTargetId(id);
  };

  const confirmDeletePrescription = async () => {
    if (!deleteTargetId) return;
    try {
      setDeleteBusy(true);
      await axios.delete(`${BASE_URL}/api/prescription/${deleteTargetId}/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      Toast.show({ type: 'success', text1: 'Record Purged', position: 'bottom' });
      setDeleteTargetId(null);
      fetchPrescriptions(1, false);
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Purge failed', position: 'bottom' });
    } finally {
      setDeleteBusy(false);
    }
  };

  const renderHistoryItem = ({ item }: { item: PrescriptionItem }) => {
    const isEmergency = item.status === 'emergency' || item.emergency === true || item.emergency === 'true';
    const imageUrl = buildMediaUrl(BASE_URL, item.image);
    const formattedDate = new Date(item.uploaded_at).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
    });

    return (
      <View
        key={item.id}
        className="bg-white rounded-[2.5rem] mb-8 border border-slate-200/60 shadow-2xl shadow-slate-400/40 overflow-hidden mx-4"
      >
        {/* Elite Status Header */}
        <View className="relative overflow-hidden">
          <LinearGradient
            colors={['#0f172a', '#1e293b', '#064e3b']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="absolute inset-0"
          />
          <View className="flex-row items-center justify-between px-6 py-4 relative z-10">
            <View className="flex-row items-center flex-1 mr-3">
              <View
                style={{ backgroundColor: 'rgba(16,185,129,0.14)' }}
                className="w-7 h-7 rounded-full items-center justify-center mr-3 border border-white/5 shadow-sm shadow-emerald-500"
              >
                <MaterialCommunityIcons
                  name={isEmergency ? 'alarm-light-outline' : 'archive-check-outline'}
                  size={12}
                  color="#34d399"
                />
              </View>
              <View className="flex-1">
                <Text className="font-black uppercase text-[8px] tracking-[3px] text-emerald-500/80">
                  Status
                </Text>
                <Text className="font-black uppercase tracking-widest text-[10px] text-white mt-0.5" numberOfLines={1}>
                  {isEmergency ? 'Urgent SOS Broadcast' : 'Archived Fulfillment'}
                </Text>
              </View>
            </View>
            <View className="px-3 py-1.5 rounded-full bg-white/10 border border-white/10 max-w-[132px]">
              <Text className="text-white/75 font-bold text-[8px] uppercase tracking-widest text-right" numberOfLines={1}>{formattedDate}</Text>
            </View>
          </View>
        </View>

        <View className="p-6">
          <View className="flex-row items-center mb-5">
            <TouchableOpacity
              onPress={() => imageUrl && setPreviewImage(imageUrl)}
              className="w-14 h-14 rounded-2xl bg-emerald-50 overflow-hidden shadow-sm border border-emerald-100/60"
            >
              {imageUrl ? (
                <RemoteImageWithStatus uri={imageUrl} loadingLabel="Loading prescription" />
              ) : (
                <View className="w-full h-full items-center justify-center">
                  <MaterialCommunityIcons name="script-text-outline" size={22} color="#10b981" />
                </View>
              )}
            </TouchableOpacity>
            <View className="ml-5 flex-1">
              <Text className="text-[9px] font-black text-slate-400 uppercase tracking-[3px]">Prescription Trace ID</Text>
              <View className="flex-row items-center mt-1">
                <Text className="text-xl font-black text-slate-900 tracking-tighter uppercase mr-2">#{item.id}</Text>
                <View className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 flex-row items-center">
                  <MaterialCommunityIcons name="shield-check" size={9} color="#34d399" />
                  <Text className="text-[7px] font-black uppercase text-white tracking-widest ml-1">
                    Saved
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Elite Registered Scope Block */}
          <View className="bg-emerald-50/30 p-5 rounded-[1.75rem] border border-emerald-100/50 mb-5 shadow-sm shadow-emerald-100">
            <View className="flex-row items-center mb-3">
              <View className="w-6 h-6 rounded-full bg-white items-center justify-center border border-emerald-100 mr-2">
                <MaterialCommunityIcons name="map-marker-radius-outline" size={13} color="#059669" />
              </View>
              <Text className="text-emerald-700/80 font-bold text-[8px] uppercase tracking-[2px]">Registered Origin Scope</Text>
            </View>
            <Text className="text-slate-900 font-bold text-[12px] leading-5 pr-4" numberOfLines={2}>
              {item.user_address || "Determining registered location scope..."}
            </Text>
          </View>

          {/* Premium Targeted Dispatch Disclosure */}
          {item.target_stores && item.target_stores.length > 0 && (
            <View className="mb-5 p-5 bg-slate-50 rounded-[1.75rem] border border-slate-100">
              <View className="flex-row items-center mb-4">
                <View className="w-6 h-6 rounded-full bg-emerald-50 items-center justify-center border border-emerald-100 mr-2">
                  <MaterialCommunityIcons name="broadcast" size={13} color="#10b981" />
                </View>
                <Text className="font-black text-[8px] uppercase tracking-[3px] text-emerald-600/70">
                  Elite Network Dispatched
                </Text>
              </View>
              <View className="flex-row flex-wrap gap-2">
                {item.target_stores.map((store: any, idx: number) => (
                  <View key={store.store_id || idx} className="px-3.5 py-2 rounded-full border bg-white border-emerald-100 flex-row items-center">
                    <View className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2" />
                    <Text className="text-[8.5px] font-black uppercase tracking-wider text-emerald-700">
                      {store.store_name}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Elite Action Portal */}
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => imageUrl && setPreviewImage(imageUrl)}
              disabled={!imageUrl}
              className="flex-[3] bg-slate-900 py-4.5 rounded-[1.25rem] flex-row justify-center items-center shadow-xl shadow-slate-300 border border-slate-800"
            >
              <MaterialCommunityIcons name="file-search-outline" size={16} color="#10b981" />
              <Text className="text-white font-black text-[10px] ml-3 tracking-[2px] uppercase">Review Visual RX</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => deletePrescription(item.id)}
              className="flex-1 bg-slate-50 border border-slate-200 py-4.5 rounded-[1.25rem] justify-center items-center active:bg-slate-100"
            >
              <MaterialCommunityIcons name="trash-can-outline" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderHistorySkeleton = () => (
    <ScrollView className="px-4 pt-10" contentContainerStyle={{ paddingBottom: 150 }} showsVerticalScrollIndicator={false}>
      {[1, 2, 3].map((item) => (
        <View
          key={item}
          className="bg-white rounded-[2.5rem] mb-8 border border-slate-200/60 shadow-2xl shadow-slate-300/30 overflow-hidden"
        >
          <LinearGradient
            colors={['#0f172a', '#1e293b', '#064e3b']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="h-14"
          />
          <View className="p-6">
            <View className="flex-row items-center mb-5">
              <View className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200" />
              <View className="ml-5 flex-1">
                <View className="h-3 w-32 bg-slate-100 rounded-full mb-3" />
                <View className="h-5 w-20 bg-slate-200 rounded-full" />
              </View>
            </View>
            <View className="bg-emerald-50/30 p-5 rounded-[1.75rem] border border-emerald-100/50 mb-5">
              <View className="h-3 w-44 bg-emerald-100 rounded-full mb-4" />
              <View className="h-3 w-full bg-slate-100 rounded-full mb-2" />
              <View className="h-3 w-2/3 bg-slate-100 rounded-full" />
            </View>
            <View className="flex-row gap-3">
              <View className="flex-[3] h-12 bg-slate-900 rounded-[1.25rem]" />
              <View className="flex-1 h-12 bg-slate-100 rounded-[1.25rem] border border-slate-200" />
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );

  return (
    <View className="flex-1 bg-slate-100">
      {/* ===== Premium Header (Synced with Elite Theme) ===== */}
      <View className="relative px-1 overflow-hidden z-50">
        <ImageBackground
          source={require('../../assets/images/historyuserprescription.png')}
          resizeMode="cover"
          className="relative h-[140px] overflow-hidden rounded-2xl"
        >
          {/* Refresh Button */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => fetchPrescriptions(1, false)}
            accessibilityLabel="Refresh history"
            className="absolute top-10 right-4 z-20 h-11 w-11 items-center justify-center rounded-full bg-black/35"
          >
            <MaterialCommunityIcons
              name="refresh"
              size={24}
              color="#FFFFFF"
            />
          </TouchableOpacity>

          {/* Date Chip */}
          <View className="absolute bottom-5 left-9 z-20">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {(startDate && endDate) ? (
                <View className="h-5 flex-row items-center overflow-hidden rounded-full bg-white px-2">
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => setFilterSheetVisible(true)}
                    className="flex-row items-center"
                  >
                    <MaterialIcons
                      name="event-note"
                      size={13}
                      color="#0d8a63"
                    />

                    <Text className="ml-2 text-[10px] font-bold uppercase text-[#0d8a63]">
                      {startDate.toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                      })}{' '}
                      –{' '}
                      {endDate.toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                      })}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      setData([]);
                      setStartDate(null);
                      setEndDate(null);
                      fetchPrescriptions(1, false, null, null);
                    }}
                    className="ml-2 h-5 w-5 items-center justify-center rounded-full bg-emerald-100"
                  >
                    <MaterialCommunityIcons
                      name="close"
                      size={11}
                      color="#0d8a63"
                    />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setFilterSheetVisible(true)}
                  className="h-5 flex-row items-center rounded-lg bg-white px-4"
                >
                  <MaterialIcons
                    name="event-note"
                    size={13}
                    color="#0d8a63"
                  />

                  <Text className="ml-2 text-[10px] font-bold uppercase text-[#0d8a63]">
                    Date
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </ImageBackground>
      </View>

      {loading && data.length === 0 ? (
        renderHistorySkeleton()
      ) : (
        <FlatList
          data={data}
          renderItem={renderHistoryItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 40, paddingBottom: 150 }}
          showsVerticalScrollIndicator={false}
          onEndReached={() => !loadingMore && !isLastPage && fetchPrescriptions(page + 1, true)}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color="#059669" className="py-12" /> : <View className="h-12" />}
          ListEmptyComponent={!loading ? (
            <View className="mt-40 items-center">
              <MaterialCommunityIcons name="folder-open-outline" size={64} color="#e2e8f0" />
              <Text className="text-gray-400 font-extrabold text-[11px] uppercase tracking-[4px] mt-8">No records in scope</Text>
            </View>
          ) : null}
        />
      )}

      {/* ===== Premium Filter Modal ===== */}
      <Modal animationType="slide" transparent visible={filterSheetVisible}>
        <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 40, borderTopRightRadius: 40, paddingHorizontal: 28, paddingTop: 16, paddingBottom: 44, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 24 }}>

            {/* Handle */}
            <View style={{ alignItems: 'center', marginBottom: 28 }}>
              <View style={{ width: 48, height: 5, backgroundColor: '#E2E8F0', borderRadius: 99 }} />
            </View>

            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
              <View>
                <Text style={{ fontSize: 26, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 }}>Filter by Date</Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#94A3B8', marginTop: 4, letterSpacing: 1 }}>Select a date range to narrow results</Text>
              </View>
              <TouchableOpacity
                onPress={() => setFilterSheetVisible(false)}
                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' }}
              >
                <MaterialCommunityIcons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Date Pickers */}
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 32 }}>
              <TouchableOpacity
                onPress={() => setShowDatePicker({ mode: 'start', visible: true })}
                style={{ flex: 1, backgroundColor: '#F8FAFC', borderRadius: 20, borderWidth: 1.5, borderColor: startDate ? '#059669' : '#E2E8F0', padding: 18 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <MaterialCommunityIcons name="calendar-start" size={14} color={startDate ? '#059669' : '#94A3B8'} />
                  <Text style={{ fontSize: 10, fontWeight: '700', color: startDate ? '#059669' : '#94A3B8', marginLeft: 6, letterSpacing: 1.5, textTransform: 'uppercase' }}>From</Text>
                </View>
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A', letterSpacing: -0.3 }}>
                  <Text>{startDate ? startDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Start date'}</Text>
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowDatePicker({ mode: 'end', visible: true })}
                style={{ flex: 1, backgroundColor: '#F8FAFC', borderRadius: 20, borderWidth: 1.5, borderColor: endDate ? '#059669' : '#E2E8F0', padding: 18 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <MaterialCommunityIcons name="calendar-end" size={14} color={endDate ? '#059669' : '#94A3B8'} />
                  <Text style={{ fontSize: 10, fontWeight: '700', color: endDate ? '#059669' : '#94A3B8', marginLeft: 6, letterSpacing: 1.5, textTransform: 'uppercase' }}>To</Text>
                </View>
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A', letterSpacing: -0.3 }}>
                  <Text>{endDate ? endDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'End date'}</Text>
                </Text>
              </TouchableOpacity>
            </View>

            {/* Quick Chips */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 32 }}>
              {[{ label: 'Last 7D', days: 7 }, { label: 'Last 30D', days: 30 }, { label: '3 Months', days: 90 }].map((chip) => {
                const isActive = startDate && (new Date().getTime() - startDate.getTime() >= (chip.days - 1) * 24 * 3600 * 1000) && endDate;
                return (
                  <TouchableOpacity
                    key={chip.label}
                    onPress={() => {
                      const d = new Date(); d.setDate(d.getDate() - chip.days); d.setHours(0, 0, 0, 0); setStartDate(d);
                      const e = new Date(); e.setHours(23, 59, 59, 999); setEndDate(e);
                    }}
                    style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: isActive ? '#059669' : '#F1F5F9', borderWidth: 1.5, borderColor: isActive ? '#059669' : '#E2E8F0' }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: isActive ? '#fff' : '#64748B', letterSpacing: 0.5 }}>{chip.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Action Buttons */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => { setData([]); setStartDate(null); setEndDate(null); setFilterSheetVisible(false); fetchPrescriptions(1, false, null, null); }}
                style={{ flex: 1, paddingVertical: 18, borderRadius: 20, alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E2E8F0' }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#64748B', letterSpacing: 0.5 }}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setFilterSheetVisible(false); fetchPrescriptions(1, false); }}
                style={{ flex: 2, paddingVertical: 18, borderRadius: 20, alignItems: 'center', backgroundColor: '#059669', shadowColor: '#059669', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 }}
              >
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff', letterSpacing: 1 }}>Apply Filter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ===== Premium Delete Confirmation Dialog ===== */}
      <Modal visible={deleteTargetId !== null} transparent animationType="fade" onRequestClose={() => setDeleteTargetId(null)}>
        <View className="flex-1 bg-black/60 justify-center items-center px-5">
          <View className="bg-white rounded-[2.25rem] w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200">
            <LinearGradient
              colors={['#0f172a', '#1e293b', '#064e3b']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              className="h-2"
            />
            <View className="p-6">
              <View className="flex-row items-center mb-5">
                <View className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200 items-center justify-center">
                  <MaterialCommunityIcons name="trash-can-outline" size={26} color="#DC2626" />
                </View>
                <View className="ml-4 flex-1">
                  <Text className="text-xl font-black text-slate-900">Delete Record?</Text>
                  <Text className="text-[9px] font-black text-red-500 uppercase tracking-[2px] mt-0.5">Permanent Action</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setDeleteTargetId(null)}
                  disabled={deleteBusy}
                  className="w-9 h-9 rounded-full bg-slate-50 border border-slate-200 items-center justify-center"
                >
                  <MaterialCommunityIcons name="close" size={18} color="#64748b" />
                </TouchableOpacity>
              </View>

              <View className="bg-slate-50 rounded-[1.5rem] border border-slate-200 p-4 mb-5">
                <View className="flex-row items-start">
                  <MaterialCommunityIcons name="shield-alert-outline" size={18} color="#059669" />
                  <Text className="text-sm font-semibold text-slate-500 leading-5 ml-3 flex-1">
                    This prescription will be removed from your history. This cannot be undone.
                  </Text>
                </View>
              </View>

              <View className="flex-row w-full gap-3" style={{ gap: 12 }}>
                <TouchableOpacity
                  onPress={() => setDeleteTargetId(null)}
                  disabled={deleteBusy}
                  className="flex-1 py-3.5 bg-slate-50 rounded-full items-center border border-slate-200"
                >
                  <Text className="text-slate-600 font-black text-sm">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={confirmDeletePrescription}
                  disabled={deleteBusy}
                  className="flex-1 py-3.5 bg-slate-900 rounded-full items-center shadow-sm"
                >
                  {deleteBusy ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-black text-sm">Delete</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Visual Verification Modal */}
      <Modal visible={!!previewImage} transparent animationType="fade">
        <View className="flex-1 bg-black justify-center items-center">
          <BlurView intensity={45} tint="dark" className="absolute inset-0" />
          <TouchableOpacity onPress={() => setPreviewImage(null)} className="absolute top-24 right-10 z-50 bg-white/10 p-5 rounded-full">
            <MaterialCommunityIcons name="close" size={32} color="white" />
          </TouchableOpacity>
          {previewImage && <View className="w-full h-[75%]"><RemoteImageWithStatus uri={previewImage} resizeMode="contain" loadingLabel="Opening prescription" /></View>}
        </View>
      </Modal>

      {showDatePicker.visible && (
        <DateTimePicker value={new Date()} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={(_e, d) => { setShowDatePicker({ ...showDatePicker, visible: false }); if (d) { if (showDatePicker.mode === 'start') setStartDate(d); else setEndDate(d); } }} />
      )}
      <Toast />
    </View>
  );
}
