import { LocalizedText as Text } from '@/components/Language/LocalizedPrimitives';
// import {
  // StyleSheet,
  // View
// } from 'react-native';

// export default function SellerHistoryScreen() {
//   return (
//     <View style={styles.container}>
//       <Text style={styles.text}>Seller History Screen</Text>
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1, justifyContent: 'center', alignItems: 'center',
//   },
//   text: {
//     fontSize: 18, fontWeight: 'bold',
//   },
// });
// import { useIsFocused } from '@react-navigation/native';
// import axios from 'axios';
// import Constants from 'expo-constants';
// import * as SecureStore from 'expo-secure-store';
// import React, { useEffect, useRef, useState } from 'react';
// import {
  // ActivityIndicator,
  // FlatList,
  // Image,
  // StyleSheet,
  // TouchableOpacity,
  // View
// } from 'react-native';


// export default function SellerHistoryScreen() {
//   const isFocused = useIsFocused();
//   const [token, setToken] = useState<string | null>(null);
//   const [userId, setUserId] = useState<string | null>(null);
//   const [data, setData] = useState<any[]>([]);
//   const [page, setPage] = useState(1);
//   const [loading, setLoading] = useState(false);
//   const [loadingMore, setLoadingMore] = useState(false);
//   const [error, setError] = useState<string | null>(null);
//   const [isLastPage, setIsLastPage] = useState(false);
//   const BASE_URL = Constants.expoConfig?.extra?.BASE_URL || '';

//   const startDateRef = useRef<Date | null>(null);
//   const endDateRef = useRef<Date | null>(null);

//   useEffect(() => {
//     const getToken = async () => {
//       const storedToken = await SecureStore.getItemAsync('authToken');
//       const storedUserId = await SecureStore.getItemAsync('userId');
//       setToken(storedToken);
//       setUserId(storedUserId);
//     };
//     if (isFocused) {
//       getToken();
//     }
//   }, [isFocused]);

//   useEffect(() => {
//     if (token && userId) {
//       fetchResponses(1, false); // Load first page on mount
//     }
//   }, [token, userId]);

//   const fetchResponses = async (pageNum = 1, append = false) => {
//     if (!token || !userId) return;

//     try {
//       append ? setLoadingMore(true) : setLoading(true);
//       setError(null);

//       let url = `${BASE_URL}/api/store/my-responses/?page=${pageNum}&page_size=10`;

//       if (startDateRef.current) {
//         const formattedStart = startDateRef.current.toISOString().split('T')[0];
//         url += `&start_date=${formattedStart}`;
//       }

//       if (endDateRef.current) {
//         const formattedEnd = endDateRef.current.toISOString().split('T')[0];
//         url += `&end_date=${formattedEnd}`;
//       }

//       const response = await axios.get(url, {
//         headers: { Authorization: `Bearer ${token}` },
//       });

//       const newResults = response.data.results;
//       setData(prev => (append ? [...prev, ...newResults] : newResults));
//       setPage(pageNum);
//       setIsLastPage(!response.data.next);
//     } catch (err) {
//       console.error('Error fetching responses:', err);
//       setError('Failed to load data');
//     } finally {
//       append ? setLoadingMore(false) : setLoading(false);
//     }
//   };

//   const loadMore = () => {
//     if (!loadingMore && !isLastPage) {
//       fetchResponses(page + 1, true);
//     }
//   };

// const renderCard = ({ item }: { item: any }) => {
//   return (
//     <View style={styles.card}>
//    <TouchableOpacity style={{ width: 112, height: 112 }}> {/* 28 x 4 = 112 */}
//   <Image
//     source={{ uri: `${BASE_URL}${item.image}` }}
//     style={{ width: '100%', height: '100%' }}
//     resizeMode="cover"
//   />
// </TouchableOpacity>


//       <View style={styles.cardContent}>
//         <Text style={styles.storeName}>{item.store_name}</Text>
//         <Text style={styles.text}>Amount: ₹{item.total_amount}</Text>
//         <Text style={styles.text}>Address: {item.store_address}</Text>
//         <Text style={styles.text}>Distance: {item.distance_km}</Text>
//         {item.medicines.length > 0 && (
//           <View style={styles.medicines}>
//             <Text style={styles.medicineHeading}>Medicines:</Text>
//             {item.medicines.map((med: any, index: number) => (
//               <Text key={index} style={styles.text}>
//                 - {med.medicine_name.trim()} ₹{med.price}
//               </Text>
//             ))}
//           </View>
//         )}
//         <Text style={styles.time}>{new Date(item.created_at).toLocaleString()}</Text>
//       </View>
//     </View>
//   );
// };

//   return (
//     <View style={styles.container}>
//       {loading && <ActivityIndicator size="large" color="#0000ff" />}
//       {error && <Text style={styles.error}>{error}</Text>}
//       <FlatList
//         data={data}
//         keyExtractor={(item, index) => `${item.id}-${index}`}
//         renderItem={renderCard}
//         onEndReached={loadMore}
//         onEndReachedThreshold={0.5}
//         ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color="#666" /> : null}
//       />
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//     container: {
//     flex: 1,
//     backgroundColor: '#f2f2f2',
//   },
//   error: {
//     color: 'red',
//     textAlign: 'center',
//     marginTop: 20,
//   },
//   card: {
//     backgroundColor: '#fff',
//     marginBottom: 10,
//     borderRadius: 10,
//     overflow: 'hidden',
//   },
//   image: {
//     height: 200,
//     width: '100%',
//   },
//   cardContent: {
//     padding: 10,
//   },
//   storeName: {
//     fontWeight: 'bold',
//     fontSize: 16,
//   },
//   text: {
//     fontSize: 14,
//   },
//   medicineHeading: {
//     marginTop: 6,
//     fontWeight: 'bold',
//   },
//   medicines: {
//     marginTop: 4,
//   },
//   time: {
//     marginTop: 8,
//     fontSize: 12,
//     color: '#666',
//   },
// });
// import { useIsFocused } from '@react-navigation/native';
// import axios from 'axios';
// import Constants from 'expo-constants';
// import * as SecureStore from 'expo-secure-store';
// import React, { useEffect, useState } from 'react';
// import {
  //   ActivityIndicator,
  //   FlatList,
  //   Image,
  //   Text,
  //   TouchableOpacity,
  //   View,
  //
// } from 'react-native';

// export default function SellerHistoryScreen() {
//   const isFocused = useIsFocused();
//   const BASE_URL = Constants.expoConfig?.extra?.BASE_URL || '';

//   const [token, setToken] = useState<string | null>(null);
//   const [userId, setUserId] = useState<string | null>(null);
//   const [data, setData] = useState<any[]>([]);
//   const [page, setPage] = useState(1);
//   const [loading, setLoading] = useState(false);
//   const [loadingMore, setLoadingMore] = useState(false);
//   const [isLastPage, setIsLastPage] = useState(false);
//   const [error, setError] = useState<string | null>(null);
//   const [startDate, setStartDate] = useState<Date | null>(null);
//   const [endDate, setEndDate] = useState<Date | null>(null);

//   useEffect(() => {
//     const getToken = async () => {
//       const storedToken = await SecureStore.getItemAsync('authToken');
//       const storedUserId = await SecureStore.getItemAsync('userId');
//       setToken(storedToken);
//       setUserId(storedUserId);
//     };
//     if (isFocused) getToken();
//   }, [isFocused]);

//   useEffect(() => {
//     if (token && userId) {
//       fetchResponses(1, false);
//     }
//   }, [token, userId, startDate, endDate]);

//   const fetchResponses = async (pageNum = 1, append = false) => {
//     if (!token || !userId) return;
//     try {
//       append ? setLoadingMore(true) : setLoading(true);
//       setError(null);

//       let url = `${BASE_URL}/api/store/my-responses/?page=${pageNum}&page_size=1`; // 👈 keep at least 3 for scroll
//       if (startDate) url += `&start_date=${startDate.toISOString().split('T')[0]}`;
//       if (endDate) url += `&end_date=${endDate.toISOString().split('T')[0]}`;

//       const response = await axios.get(url, {
//         headers: { Authorization: `Bearer ${token}` },
//       });

//       const newResults = response.data.results || [];
//       setData(prev => (append ? [...prev, ...newResults] : newResults));
//       setPage(pageNum);
//       setIsLastPage(!response.data.next);
//     } catch (err) {
//       console.error('Fetch Error:', err);
//       setError('Failed to load data');
//     } finally {
//       append ? setLoadingMore(false) : setLoading(false);
//     }
//   };

//   const renderCard = ({ item }: { item: any }) => (
//     <View className="bg-white mb-3 rounded-xl p-4 shadow-sm">
//       <View className="flex-row space-x-4">
//         <Image
//           source={{ uri: `${BASE_URL}${item.image}` }}
//           className="w-24 h-24 rounded-md bg-gray-200"
//         />
//         <View className="flex-1">
//           <Text className="font-semibold text-base">{item.store_name}</Text>
//           <Text className="text-sm mt-1">Amount: ₹{item.total_amount}</Text>
//           <Text className="text-sm">Address: {item.store_address}</Text>
//           <Text className="text-sm">Distance: {item.distance_km} km</Text>

//           {item.medicines?.length > 0 && (
//             <View className="mt-1">
//               <Text className="font-semibold text-sm">Medicines:</Text>
//               {item.medicines.map((med: any, index: number) => (
//                 <Text key={index} className="text-sm">
//                   - {med.medicine_name?.trim()} ₹{med.price}
//                 </Text>
//               ))}
//             </View>
//           )}
//           <Text className="text-xs text-gray-500 mt-2">
//             {new Date(item.created_at).toLocaleString()}
//           </Text>
//         </View>
//       </View>
//     </View>
//   );

//   const loadMore = () => {
//     if (!loading && !loadingMore && !isLastPage) {
//       console.log('➡️ Loading more...');
//       fetchResponses(page + 1, true);
//     }
//   };

//   return (
//     <View className="flex-1 bg-gray-100 px-3 pt-3" style={{ flex: 1 }}>
//       <View className="flex-row justify-end mb-2">
//         <TouchableOpacity
//           className="bg-emerald-600 px-4 py-2 rounded-lg"
//           onPress={() => {
//             setStartDate(null);
//             setEndDate(null);
//             fetchResponses(1, false);
//           }}
//         >
//           <Text className="text-white font-bold">Clear Filter</Text>
//         </TouchableOpacity>
//       </View>

//       {error && <Text className="text-center text-red-600">{error}</Text>}
//       {loading && !loadingMore && (
//         <ActivityIndicator size="large" color="#0000ff" className="mt-4" />
//       )}

//       <FlatList
//         data={data}
//         renderItem={renderCard}
//         keyExtractor={(item) => item.id.toString()}
//         contentContainerStyle={{ paddingBottom: 20 }}
//         onEndReached={loadMore}
//         onEndReachedThreshold={0.2} // 👈 20% from bottom
//         ListFooterComponent={
//           loadingMore ? <ActivityIndicator className="my-5" /> : null
//         }
//         ListEmptyComponent={
//           !loading ? (
//             <Text className="text-center mt-10">No prescriptions found.</Text>
//           ) : null
//         }
//       />
//     </View>
//   );
// }
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import axios from 'axios';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import * as SecureStore from 'expo-secure-store';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../../redux/store';
import { fetchUserProfile } from '../../redux/userSlice';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TouchableOpacity,
  View
} from 'react-native';
import Toast from 'react-native-toast-message';
import RatingBottomSheet from '../../components/RatingBottomSheet';
import UnavailableOverlay, { type CapabilityFlags } from '../../components/UnavailableOverlay';

const formatLocalDateParam = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const startOfLocalDay = (date: Date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
};

const endOfLocalDay = (date: Date) => {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
};

const getDateRangeForDays = (days: number) => {
  const end = endOfLocalDay(new Date());
  const start = startOfLocalDay(new Date());
  start.setDate(start.getDate() - Math.max(days - 1, 0));
  return { start, end };
};

type ApiResponse = {
  count: number;
  page: number;            // <-- add this if it exists in your API response
  total_pages: number;
  next: string | null;
  previous: string | null;
  results: ResponseItem[];
};

type ResponseItem = {
  id: number;
  prescription: number;
  user: number;
  response_text: string;
  image: string | null;
  store: number;
  store_name: string;
  store_address: string;
  store_contact: string;
  store_latitude: string;
  store_longitude: string;
  created_at: string;
  updated_at: string;
  total_amount: number;
  distance_km: number;
  uploaded_at: string;
  user_name?: string;
  user_address?: string;
  user_contact?: string;
  user_status?: string;
  delivery_option?: string;
  is_ratable?: boolean;
  user_rating?: any;
  store_rating?: any;
  cancelled_by?: string;
  capabilities?: CapabilityFlags;
  store_report_count?: number;
  user_report_count?: number;
  store_contact_note?: string;
  user_contact_note?: string;
  user_report_note?: string;
  cancel_reason?: string;
};

type Medicine = {
  medicine_name: string;
  price: number;
};

type OfferDetails = {
  image?: string;
  store_name: string;
  store_address: string;
  store_contact: string;
  medicines: Medicine[];
  response_text: string;
  total_amount: number;
  user_name: string;
  user_address: string;
  user_contact?: string | null;
  capabilities?: CapabilityFlags;
};

const buildMediaUrl = (baseUrl: string, mediaPath?: string | null) => {
  if (!mediaPath) return null;
  if (/^https?:\/\//i.test(mediaPath)) return mediaPath;
  const base = baseUrl.replace(/\/+$/, '');
  const path = mediaPath.startsWith('/') ? mediaPath : `/${mediaPath}`;
  return `${base}${path}`;
};

// 💎 Production Optimization: memoized Card Component for History
const HistoryResponseCard = React.memo(({
  item,
  BASE_URL,
  onImagePress,
  onFetchDetails,
  onRatePress
}: {
  item: ResponseItem;
  BASE_URL: string;
  onImagePress: (url: string) => void;
  onFetchDetails: (id: number) => void;
  onRatePress: (item: ResponseItem) => void;
}) => {
  const uploadedAt = new Date(item.updated_at);
  const formattedDate = uploadedAt.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  const statusMeta = (() => {
    switch (item.user_status) {
      case 'accepted':
        return { label: 'Accepted', icon: 'check-circle-outline' as const, color: '#059669', bg: '#ecfdf5' };
      case 'processing':
        return { label: 'Processing', icon: 'pill' as const, color: '#2563eb', bg: '#eff6ff' };
      case 'out_for_delivery':
        return { label: 'Out for Delivery', icon: 'truck-delivery-outline' as const, color: '#2563eb', bg: '#eff6ff' };
      case 'locked':
        return { label: 'Locked', icon: 'lock-outline' as const, color: '#10b981', bg: '#0f172a' };
      case 'completed':
        return { label: 'Completed', icon: 'check-all' as const, color: '#ffffff', bg: '#059669' };
      case 'rejected':
        return { label: item.cancelled_by === 'user' ? 'Rejected by User' : item.cancelled_by === 'store' ? 'Rejected by Store' : 'Rejected', icon: 'close-circle-outline' as const, color: '#dc2626', bg: '#fef2f2' };
      case 'dismissed':
        return { label: item.cancelled_by === 'user' ? 'Rejected by User' : 'Offer Dismissed', icon: 'close-circle-outline' as const, color: '#dc2626', bg: '#fef2f2' };
      case 'cancelled':
        return { label: item.cancelled_by === 'store' ? 'Cancelled by Store' : item.cancelled_by === 'user' ? 'Cancelled by User' : 'Cancelled', icon: 'close-octagon-outline' as const, color: '#dc2626', bg: '#fef2f2' };
      default:
        return { label: 'Pending', icon: 'clock-outline' as const, color: '#64748b', bg: '#f1f5f9' };
    }
  })();
  const imageUrl = buildMediaUrl(BASE_URL, item.image);
  const canViewPatient = item.capabilities?.permissions?.view_address !== false;

  return (
    <View className="bg-white mb-4 rounded-[1.5rem] border border-slate-200/70 shadow-xl shadow-slate-200/50 overflow-hidden">
      <TouchableOpacity activeOpacity={0.9} onPress={() => canViewPatient && onFetchDetails(item.id)}>
        <LinearGradient
          colors={['#0f172a', '#18243a', '#064e3b']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          className="px-4 py-3"
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center flex-1 pr-3">
              <View style={{ backgroundColor: statusMeta.bg }} className="w-9 h-9 rounded-xl items-center justify-center border border-white/10">
                <MaterialCommunityIcons name={statusMeta.icon} size={16} color={statusMeta.color} />
              </View>
              <View className="ml-2.5 flex-1">
                <Text className="text-white font-black text-[9px] uppercase tracking-[1.7px]" numberOfLines={1}>{statusMeta.label}</Text>
                <Text className="text-emerald-200/60 font-bold text-[6.5px] uppercase tracking-[1.4px] mt-0.5" numberOfLines={1}>Archived Quote Record</Text>
              </View>
            </View>
            <Text className="text-white/45 font-bold text-[7px] uppercase tracking-widest">{formattedDate}</Text>
          </View>
        </LinearGradient>

        <View className="p-4 relative">
          <View className="flex-row items-center mb-4">
            <Pressable onPress={() => canViewPatient && imageUrl && onImagePress(imageUrl)} className="w-16 h-16 rounded-[1.15rem] bg-slate-50 border border-slate-200 items-center justify-center overflow-hidden shadow-sm">
              {imageUrl ? (
                <>
                  <Image source={{ uri: imageUrl }} className="w-full h-full" resizeMode="cover" />
                  <View className="absolute bottom-0 left-0 right-0 bg-slate-950/65 py-1 items-center">
                    <Text className="text-white text-[7px] font-black uppercase tracking-[1.5px]">Inspect</Text>
                  </View>
                </>
              ) : (
                <MaterialCommunityIcons name="file-image-outline" size={21} color="#94a3b8" />
              )}
            </Pressable>

            <View className="ml-4 flex-1">
              <Text className="text-lg font-black text-slate-950 tracking-tight" numberOfLines={1}>{item.user_name || 'Patient'}</Text>
              <View className="flex-row items-center flex-wrap mt-1.5">
                <View className="bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-full">
                  <Text className="text-emerald-700 text-[9px] font-black uppercase tracking-wider">₹{item.total_amount || 0}</Text>
                </View>
                <View className="ml-1.5 bg-slate-100 px-2.5 py-0.5 rounded-full flex-row items-center">
                  <MaterialCommunityIcons name="map-marker-radius-outline" size={10} color="#64748b" />
                  <Text className="text-slate-600 text-[8px] font-black uppercase tracking-wider ml-1">{item.distance_km || 'Nearby'}</Text>
                </View>
                {item.delivery_option && (
                  <View className="ml-1.5 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full flex-row items-center">
                    <MaterialCommunityIcons name={item.delivery_option === 'walk_in' ? 'walk' : 'truck-delivery-outline'} size={9} color="#2563eb" />
                    <Text className="text-blue-700 text-[7.5px] font-black uppercase tracking-wider ml-1">{item.delivery_option === 'walk_in' ? 'Walk-in' : 'Online'}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          <View className="bg-slate-50 border border-slate-100 rounded-[1.15rem] p-3 mb-4">
            <View className="flex-row items-center mb-1.5">
              <MaterialCommunityIcons name="map-marker-outline" size={12} color="#059669" />
              <Text className="text-emerald-700 text-[7.5px] font-black uppercase tracking-[1.7px] ml-1.5">Patient Address</Text>
            </View>
            <Text className="text-slate-600 text-[11px] font-semibold leading-4" numberOfLines={2}>{item.user_address || 'Address not available'}</Text>
          </View>

          {(item.user_status === 'cancelled' || item.user_status === 'rejected' || item.user_status === 'dismissed') && item.cancel_reason && (
            <View className="mb-4 p-3 bg-red-50 rounded-[1.15rem] border border-red-100">
              <Text className="text-red-700 text-[8px] font-black uppercase tracking-[2px] mb-1">
                {item.user_status === 'cancelled' 
                  ? (item.cancelled_by === 'user' ? 'Cancelled by User' : item.cancelled_by === 'store' ? 'Cancelled by You' : 'Cancellation Reason')
                  : (item.cancelled_by === 'user' ? 'Rejected by User' : item.cancelled_by === 'store' ? 'Rejected by You' : 'Rejection Reason')
                }
              </Text>
              <Text className="text-red-900 font-medium text-xs italic">"{item.cancel_reason}"</Text>
            </View>
          )}

          <View className="flex-row items-center justify-between pt-3 border-t border-slate-100/80">
            <TouchableOpacity onPress={() => canViewPatient && onFetchDetails(item.id)} className="px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-full flex-row items-center active:bg-emerald-100">
              <MaterialCommunityIcons name="eye-outline" size={15} color="#059669" />
              <Text className="text-emerald-700 font-black text-[9px] ml-1.5 tracking-widest uppercase">Details</Text>
            </TouchableOpacity>

            <View className="flex-row items-center gap-1.5">
              {canViewPatient && item.user_contact && (
                <TouchableOpacity onPress={() => Linking.openURL(`tel:${item.user_contact}`)} className="w-[34px] h-[34px] justify-center items-center bg-slate-50 border border-slate-100 rounded-full shadow-sm active:bg-slate-100">
                  <MaterialCommunityIcons name="phone-outline" size={16} color="#64748b" />
                </TouchableOpacity>
              )}

              {item.is_ratable && !item.store_rating && (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    onRatePress(item);
                  }}
                  className="w-[34px] h-[34px] justify-center items-center bg-emerald-50 border border-emerald-100 rounded-full shadow-sm active:bg-emerald-100"
                >
                  <MaterialCommunityIcons name="star-face" size={16} color="#059669" />
                </TouchableOpacity>
              )}
            </View>
          </View>
          <UnavailableOverlay capabilities={item.capabilities} borderRadius={24} />
        </View>
      </TouchableOpacity>
    </View>
  );
});
HistoryResponseCard.displayName = 'HistoryResponseCard';
export interface SellerHistoryScreenProps {
  hideHeader?: boolean;
  onOpenFilterSheet?: () => void;
  statusFilter?: string;
  onStatusFilterChange?: (key: string) => void;
  dateStart?: Date | null;
  dateEnd?: Date | null;
}

export function SellerHistoryScreen({ hideHeader = false, onOpenFilterSheet, statusFilter: externalStatusFilter, onStatusFilterChange, dateStart, dateEnd }: SellerHistoryScreenProps) {
  // const userId = 4;
  // const token = '7cdfff79-c7a9-445f-ae95-ecaecf80496c';
  const BASE_URL = Constants.expoConfig?.extra?.BASE_URL || '';
  const { user, token } = useSelector((state: RootState) => state.user);
  const dispatch = useDispatch<AppDispatch>();

  const [data, setData] = useState<ResponseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [nextPageUrl, setNextPageUrl] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const startDateRef = useRef<Date | null>(null);
  const endDateRef = useRef<Date | null>(null);
  const [isLastPage, setIsLastPage] = useState(false);
  const [offerDetails, setOfferDetails] = useState<OfferDetails | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loadingOffer, setLoadingOffer] = useState(false);

  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [ratingOrderTarget, setRatingOrderTarget] = useState<ResponseItem | null>(null);

  const [startDate, setStartDate] = useState<Date | null>(dateStart ?? null);
  const [endDate, setEndDate] = useState<Date | null>(dateEnd ?? null);
  const [showDatePicker, setShowDatePicker] = useState<{ mode: 'start' | 'end'; visible: boolean }>({
    mode: 'start',
    visible: false,
  });

  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [internalStatusFilter, setInternalStatusFilter] = useState<string>('all');
  const statusFilter = externalStatusFilter ?? internalStatusFilter;
  const setStatusFilter = (key: string) => {
    if (onStatusFilterChange) onStatusFilterChange(key);
    else setInternalStatusFilter(key);
  };
  const isDateControlled = dateStart !== undefined || dateEnd !== undefined;

  const STATUS_FILTERS = [
    { key: 'all', label: 'All', icon: 'view-grid-outline', color: '#64748b' },
    { key: 'completed', label: 'Completed', icon: 'check-decagram-outline', color: '#059669' },
    { key: 'cancelled', label: 'Cancelled', icon: 'close-octagon-outline', color: '#dc2626' },
    { key: 'rejected', label: 'Rejected', icon: 'close-circle-outline', color: '#ef4444' },
    { key: 'reported', label: 'Reported', icon: 'flag-triangle', color: '#d97706' },
  ];

  const DATE_QUICK_FILTERS = [
    { label: 'Today', days: 1 },
    { label: '7 Days', days: 7 },
    { label: '30 Days', days: 30 },
  ];

  // Client-side status filter applied on top of fetched data
  const filteredData = React.useMemo(() => {
    if (statusFilter === 'all') return data;
    if (statusFilter === 'reported') {
      return data.filter((item) => (
        (item.store_report_count ?? 0) > 0 ||
        Boolean(item.store_contact_note) ||
        (item.user_report_count ?? 0) > 0
      ));
    }
    return data.filter((item) => {
      const s = (item.user_status || '').toLowerCase();
      if (statusFilter === 'completed') return s === 'completed';
      if (statusFilter === 'cancelled') return s === 'cancelled';
      // 'dismissed' = user rejected a pending offer (before quote), 'rejected' = user rejected a quoted offer
      if (statusFilter === 'rejected') return s === 'rejected' || s === 'dismissed' || s === 'declined';
      return true;
    });
  }, [data, statusFilter]);

  const applyQuickDate = (days: number) => {
    const { start, end } = getDateRangeForDays(days);
    setStartDate(start);
    setEndDate(end);
    startDateRef.current = start;
    endDateRef.current = end;
    setPage(1);
    setFilterSheetVisible(false);
    fetchResponses(1, false, start, end);
  };

  useEffect(() => {
    startDateRef.current = startDate;
  }, [startDate]);

  useEffect(() => {
    endDateRef.current = endDate;
  }, [endDate]);
  const handleDateChange = (_event: any, selectedDate?: Date) => {
    setShowDatePicker({ ...showDatePicker, visible: false });
    if (selectedDate) {
      if (showDatePicker.mode === 'start') {
        setStartDate(startOfLocalDay(selectedDate));
      } else {
        setEndDate(endOfLocalDay(selectedDate));
      }
    }
  };
  const isFocused = useIsFocused();




  const fetchResponses = useCallback(async (pageNum = 1, append = false, overrideStart?: Date | null, overrideEnd?: Date | null) => {
    if (!token || !user) return; // ✅ Don't call if missing

    try {
      if (append) setLoadingMore(true);
      else setLoading(true);

      let url = `${BASE_URL}/api/store/my-responses/?page=${pageNum}&page_size=10`;

      // Use overrides if provided, otherwise fallback to refs
      const finalStart = overrideStart !== undefined ? overrideStart : startDateRef.current;
      const finalEnd = overrideEnd !== undefined ? overrideEnd : endDateRef.current;

      if (finalStart) {
        const s = formatLocalDateParam(finalStart);
        url += `&start_date=${s}`;
      }

      if (finalEnd) {
        const e = formatLocalDateParam(finalEnd);
        url += `&end_date=${e}`;
      }


      // const response = await axios.get<PrescriptionsResponse>(url);
      // const response = await axios.get<PrescriptionsResponse>(url, {
      //   headers: { Authorization: `Bearer ${token}` },
      // });
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${token}`, // ✅ Token added here
          Accept: 'application/json',
        },
      });
      const newResults = response.data.results;
      // setData(newResults)
      // Append data only if append=true, else replace the data
      setData((prevData) => (append ? [...prevData, ...newResults] : newResults));

      setPage(response.data.page);
      setIsLastPage(response.data.page >= response.data.total_pages);
      setError(null);
    } catch (err: any) {
      if (append && err.response?.status === 404) {
        setIsLastPage(true);
        return;
      }

      const errorMessage = err.message || 'Failed to fetch data';
      setError(errorMessage);
      Toast.show({
        type: 'error',
        text1: 'Sync Failed',
        text2: errorMessage,
        position: 'bottom',
      });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [BASE_URL, token, user]);
  useEffect(() => {
    if (!token || !user) {
      dispatch(fetchUserProfile());
    }
  }, [dispatch, token, user]);
  useFocusEffect(
    useCallback(() => {
      if (token && user) {
        const nextStart = isDateControlled ? (dateStart ?? null) : null;
        const nextEnd = isDateControlled ? (dateEnd ?? null) : null;

        setStartDate(nextStart);
        setEndDate(nextEnd);
        startDateRef.current = nextStart;
        endDateRef.current = nextEnd;
        setPage(1);
        setFilterSheetVisible(false);

        setTimeout(() => {
          fetchResponses(1, false, nextStart, nextEnd);
        }, 100);
      }
    }, [dateEnd, dateStart, fetchResponses, isDateControlled, token, user])
  );
  const fetchOfferDetails = async (id: number) => {
    try {
      setLoadingOffer(true);
      const url = `${BASE_URL}/api/store/my-responses/${id}/`;  // Note singular 'response' as per your example
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Assume the response contains offer text in response.data.response_text
      setOfferDetails(response.data); // <-- assign whole object
      setModalVisible(true);
    } catch (error) {
      console.error("Failed to fetch offer details:", error);
      Toast.show({
        type: 'error',
        text1: 'Load Failed',
        text2: 'Could not fetch offer details.',
        position: 'bottom'
      });
      setOfferDetails(null);
      setModalVisible(true);
    } finally {
      setLoadingOffer(false);
    }
  };



  const ws = useRef<WebSocket | null>(null);
  const seenEventIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!token || !user) return;

    const connectWS = () => {
      const wsUrl = `${BASE_URL.replace(/^http/, 'ws')}/ws/store-orders/?token=${token}`;
      ws.current = new WebSocket(wsUrl);

      ws.current.onclose = () => {
        setTimeout(connectWS, 3000);
      };

      ws.current.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type !== 'fulfillment_update') return;

          const eventId = msg.event_id;
          if (eventId) {
            if (seenEventIds.current.has(eventId)) return;
            seenEventIds.current.add(eventId);
            if (seenEventIds.current.size > 500) {
              const oldestValue = seenEventIds.current.values().next().value;
              if (oldestValue !== undefined) seenEventIds.current.delete(oldestValue);
            }
          }

          if (msg.action === 'store_capability_changed') {
            fetchResponses(1, false);
          }
        } catch (err) {
          console.log('History WS parse error:', err);
        }
      };
    };

    connectWS();
    return () => ws.current?.close();
  }, [BASE_URL, fetchResponses, token, user]);

  const loadMore = () => {
    if (!loadingMore && !isLastPage) {
      fetchResponses(page + 1, true);
    }
  };
  const renderCard = useCallback(({ item }: { item: ResponseItem }) => (
    <HistoryResponseCard
      item={item}
      BASE_URL={BASE_URL}
      onImagePress={setSelectedImage}
      onFetchDetails={fetchOfferDetails}
      onRatePress={(target) => {
        setRatingOrderTarget(target);
        setRatingModalVisible(true);
      }}
    />
  ), [BASE_URL, fetchOfferDetails]);

  const renderSellerHistorySkeleton = () => (
    <ScrollView className="px-4 pt-6" contentContainerStyle={{ paddingBottom: 150 }} showsVerticalScrollIndicator={false}>
      {[1, 2, 3].map((item) => (
        <View key={item} className="bg-white rounded-[2rem] mb-5 border border-slate-200/60 shadow-xl shadow-slate-200/50 overflow-hidden">
          <View className="h-12 bg-slate-900" />
          <View className="p-5">
            <View className="flex-row items-center mb-5">
              <View className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100" />
              <View className="ml-4 flex-1">
                <View className="h-5 w-44 bg-slate-200 rounded-full mb-3" />
                <View className="h-3 w-full bg-slate-100 rounded-full" />
              </View>
            </View>
            <View className="h-3 w-full bg-slate-100 rounded-full mb-2" />
            <View className="h-3 w-3/4 bg-slate-100 rounded-full mb-5" />
            <View className="flex-row gap-3">
              <View className="flex-1 h-11 bg-slate-100 rounded-2xl" />
              <View className="flex-1 h-11 bg-slate-900 rounded-2xl" />
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );

  return (
    <View className="flex-1 bg-slate-100">
      {!hideHeader && (
        <View className="relative overflow-hidden z-50">
          <LinearGradient
            colors={['#0f172a', '#1e293b', '#064e3b']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="absolute inset-0 rounded-bl-[5rem] rounded-br-[8rem]"
          />
          <View className="pt-8 pb-4 px-8 relative z-10">
            <View className="flex-row items-center justify-between mb-8">
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 30, fontWeight: '900', color: '#ffffff', letterSpacing: 3, lineHeight: 34 }}>
                    HISTORY
                  </Text>
                  <View style={{ width: 1.5, height: 34, backgroundColor: '#34d399', marginHorizontal: 10, borderRadius: 2, opacity: 0.8 }} />
                  <View style={{ justifyContent: 'center' }}>
                    <Text style={{ fontSize: 9, fontWeight: '800', color: '#34d399', letterSpacing: 2, textTransform: 'uppercase', lineHeight: 13 }}>Past</Text>
                    <Text style={{ fontSize: 9, fontWeight: '800', color: '#ffffff', letterSpacing: 1.5, textTransform: 'uppercase', lineHeight: 13 }}>Quotes</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 6.5, fontWeight: '500', color: 'rgba(255,255,255,0.45)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 }}>
                  Completed & Submitted Records
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setPage(1);
                  setFilterSheetVisible(false);
                  setData([]);
                  fetchResponses(1, false);
                }}
                className="w-16 h-16 rounded-[1.75rem] bg-white/10 items-center justify-center border border-white/5 shadow-2xl"
              >
                <MaterialCommunityIcons name="refresh" size={28} color="white" />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
              <TouchableOpacity
                onPress={() => onOpenFilterSheet ? onOpenFilterSheet() : undefined}
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: '#e2e8f0' }}
              >
                <MaterialCommunityIcons name="tune-variant" size={12} color="#059669" />
                <Text style={{ color: '#059669', fontSize: 10, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase', marginLeft: 5 }}>
                  {statusFilter !== 'all' ? STATUS_FILTERS.find(f => f.key === statusFilter)?.label : 'Status Filter'}
                </Text>
                {statusFilter !== 'all' && (
                  <TouchableOpacity
                    onPress={() => setStatusFilter('all')}
                    style={{ marginLeft: 6, backgroundColor: '#ecfdf5', borderRadius: 10, padding: 2 }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <MaterialCommunityIcons name="close" size={10} color="#059669" />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
              {/* Quick date chips */}
              {DATE_QUICK_FILTERS.map((chip) => (
                <TouchableOpacity
                  key={chip.label}
                  onPress={() => applyQuickDate(chip.days)}
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' }}
                >
                  <Text style={{ color: '#d1fae5', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, textTransform: 'uppercase' }}>{chip.label}</Text>
                </TouchableOpacity>
              ))}
              {(startDate && endDate) ? (
                <TouchableOpacity
                  onPress={() => {
                    setStartDate(null);
                    setEndDate(null);
                    startDateRef.current = null;
                    endDateRef.current = null;
                    setPage(1);
                    setFilterSheetVisible(false);
                    fetchResponses(1, false, null, null);
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 9 }}
                >
                  <MaterialCommunityIcons name="calendar-check" size={12} color="#059669" />
                  <Text style={{ color: '#059669', fontSize: 10, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase', marginLeft: 5 }}>
                    {startDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} – {endDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </Text>
                  <MaterialCommunityIcons name="close" size={11} color="#059669" style={{ marginLeft: 5 }} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => setFilterSheetVisible(true)}
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' }}
                >
                  <MaterialCommunityIcons name="calendar-range" size={12} color="#a7f3d0" />
                  <Text style={{ color: '#d1fae5', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, textTransform: 'uppercase', marginLeft: 5 }}>Custom</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      )}
      {/* <FlatList
        data={data}
        renderItem={renderCard}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? (
            <View className="py-4 items-center">
              <ActivityIndicator size="small"  color="#10B981" />
              <Text className="text-sm mt-1">Loading more...</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          !loading ? (
            <View className="mt-8 items-center">
              <Text className="text-gray-600 text-sm">No prescriptions found.</Text>
            </View>
          ) : null
        }
      /> */}
      {false ? (
        <View className="flex-1 items-center justify-center px-10 pt-20">
          <View style={{
            width: 72, height: 72, borderRadius: 20,
            backgroundColor: '#f1f5f9',
            alignItems: 'center', justifyContent: 'center',
            marginBottom: 16,
            borderWidth: 1, borderColor: '#e2e8f0'
          }}>
            <MaterialCommunityIcons name="lock" size={36} color="#10b981" />
          </View>
          <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 16, letterSpacing: 1.5, textTransform: 'uppercase', textAlign: 'center' }}>
            Verification Required
          </Text>
          <Text style={{ color: '#64748b', fontSize: 11, fontWeight: '600', textAlign: 'center', marginTop: 8, marginBottom: 20, lineHeight: 18 }}>
            Verify your store to access your past quote history and patient details.
          </Text>
        </View>
      ) : loading && data.length === 0 ? (
        renderSellerHistorySkeleton()
      ) : (
        <>
          {/* ───── Status Filter Tabs (Replaced by Sheet) ───── */}
          <FlatList
            data={filteredData}
            renderItem={renderCard}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 150 }}
            showsVerticalScrollIndicator={false}
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            // 💎 Production Tweak
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={21}
            removeClippedSubviews={Platform.OS === 'android'}
            ListFooterComponent={
              loadingMore ? (
                <View className="py-4 items-center">
                  <ActivityIndicator size="small" color="#10B981" />
                  <Text className="text-sm mt-1">Scanning archives...</Text>
                </View>
              ) : <View className="h-20" />
            }
            ListEmptyComponent={
              !loading ? (
                <View className="mt-24 items-center px-10">
                  <View className="w-24 h-24 bg-slate-50 rounded-[3rem] items-center justify-center mb-6 border border-slate-100">
                    <MaterialCommunityIcons name="archive-search-outline" size={42} color="#cbd5e1" />
                  </View>
                  <Text className="text-slate-900 font-black text-lg tracking-tight mb-2 uppercase">No Records</Text>
                  <Text className="text-gray-400 font-bold text-[10px] uppercase tracking-[2px] text-center leading-5">
                    {statusFilter !== 'all' ? `No ${statusFilter} records found.` : 'No previous quote history found for this date range.'}
                  </Text>
                </View>
              ) : null
            }
          />
        </>
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/60">
          <View className="bg-white rounded-lg shadow-lg w-11/12 max-h-[80%]">
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              {/* Store Profile Section */}
              <View className="flex-row items-center mb-4">
                {/* {offerDetails?.image ? (
                <Image
                  source={{ uri: `${BASE_URL}${offerDetails.image}` }}
                  className="w-16 h-16 rounded-full mr-4"
                  resizeMode="cover"
                />
              ) : (
                <View className="w-16 h-16 rounded-full bg-gray-300 mr-4 justify-center items-center">
                  <Text className="text-gray-600 font-bold text-xl">S</Text>
                </View>
              )} */}
                <View className="w-16 h-16 rounded-full bg-gray-300 mr-4 justify-center items-center">
                  <MaterialCommunityIcons name="account" size={32} color="#047857" />
                </View>
                <View className="flex-1">
                  <Text className="text-xl font-bold text-gray-900">
                    {offerDetails?.user_name}
                  </Text>
                  <Text className="text-gray-700">{offerDetails?.user_address}</Text>
                  <Text className="text-gray-700">
                    <MaterialCommunityIcons name="phone" size={22} color="#047857" />{offerDetails?.user_contact}
                  </Text>
                </View>
              </View>

              {/* Medicines Table */}
              <View className="border border-gray-300 rounded-md mb-4">
                <View className="flex-row bg-gray-100 p-2 border-b border-gray-300">
                  <Text className="flex-1 font-semibold text-gray-800">Medicine</Text>
                  <Text className="w-24 font-semibold text-gray-800 text-right">Price</Text>
                </View>
                {offerDetails?.medicines && offerDetails.medicines.length > 0 ? (
                  offerDetails.medicines.map((med: Medicine, idx: number) => (
                    <View
                      key={idx}
                      className={`flex-row p-2 border-b border-gray-200 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                        }`}
                    >
                      <Text className="flex-1 text-gray-800">{med.medicine_name}</Text>
                      <Text className="w-24 text-right text-gray-800">₹{med.price}</Text>
                    </View>
                  ))
                ) : (
                  <Text className="p-2 text-center text-gray-500">No medicines found.</Text>
                )}
              </View>
              <View className="mb-2 flex-row items-center justify-end">
                <Text className="text-gray-900 font-medium">Total: </Text>
                <Text className="text-gray-900 font-medium">₹ {offerDetails?.total_amount}</Text>
              </View>

              {/* Response Text */}
              <View className="mb-6">
                <Text className="text-gray-900 font-medium mb-1">Offer Message:</Text>
                <Text className="text-gray-700">{offerDetails?.response_text}</Text>
              </View>

              {/* Close Button */}
              <Pressable
                className="bg-gray-300  py-3"
                onPress={() => setModalVisible(false)}
              >
                <Text className="text-white text-center font-semibold text-lg">Close</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal for image fullscreen */}
      <Modal visible={!!selectedImage} transparent animationType="fade">
        <View className="flex-1 bg-black/90 justify-center items-center">
          <Pressable
            onPress={() => setSelectedImage(null)}
            className="absolute top-10 right-10 z-50 p-2"
          >
            <MaterialCommunityIcons name="close" size={30} color="white" />
          </Pressable>
          {selectedImage && (
            <Image
              source={{ uri: selectedImage }}
              style={{ width: '90%', height: '70%', resizeMode: 'contain' }}
            />
          )}
        </View>
      </Modal>
      {showDatePicker.visible && (
        <DateTimePicker
          mode="date"
          value={showDatePicker.mode === 'start' ? (startDate || new Date()) : (endDate || new Date())}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
        />
      )}
      {/* ===== Premium Filter Modal ===== */}
      <Modal animationType="slide" transparent visible={filterSheetVisible} onRequestClose={() => setFilterSheetVisible(false)}>
        <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 40, borderTopRightRadius: 40, paddingHorizontal: 28, paddingTop: 16, paddingBottom: 44, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 24 }}>
            <View style={{ alignItems: 'center', marginBottom: 28 }}>
              <View style={{ width: 48, height: 5, backgroundColor: '#E2E8F0', borderRadius: 99 }} />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
              <View>
                <Text style={{ fontSize: 26, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 }}>Filter by Date</Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#94A3B8', marginTop: 4, letterSpacing: 1 }}>Select a date range to narrow history</Text>
              </View>
              <TouchableOpacity
                onPress={() => setFilterSheetVisible(false)}
                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' }}
              >
                <MaterialCommunityIcons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

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
                  {startDate ? startDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Start date'}
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
                  {endDate ? endDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'End date'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 32 }}>
              {DATE_QUICK_FILTERS.map((chip) => {
                const range = getDateRangeForDays(chip.days);
                const isActive = Boolean(startDate && endDate)
                  && formatLocalDateParam(startDate as Date) === formatLocalDateParam(range.start)
                  && formatLocalDateParam(endDate as Date) === formatLocalDateParam(range.end);
                return (
                  <TouchableOpacity
                    key={chip.label}
                    onPress={() => applyQuickDate(chip.days)}
                    style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: isActive ? '#059669' : '#F1F5F9', borderWidth: 1.5, borderColor: isActive ? '#059669' : '#E2E8F0' }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: isActive ? '#fff' : '#64748B', letterSpacing: 0.5 }}>{chip.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => {
                  setStartDate(null);
                  setEndDate(null);
                  startDateRef.current = null;
                  endDateRef.current = null;
                  setPage(1);
                  setFilterSheetVisible(false);
                  fetchResponses(1, false, null, null);
                }}
                style={{ flex: 1, paddingVertical: 18, borderRadius: 20, alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E2E8F0' }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#64748B', letterSpacing: 0.5 }}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  let finalStart = startDate ? startOfLocalDay(startDate) : null;
                  let finalEnd = endDate ? endOfLocalDay(endDate) : null;
                  if (finalStart && finalEnd && finalStart.getTime() > finalEnd.getTime()) {
                    const swappedStart = startOfLocalDay(finalEnd);
                    const swappedEnd = endOfLocalDay(finalStart);
                    finalStart = swappedStart;
                    finalEnd = swappedEnd;
                  }
                  setStartDate(finalStart);
                  setEndDate(finalEnd);
                  startDateRef.current = finalStart;
                  endDateRef.current = finalEnd;
                  setPage(1);
                  setFilterSheetVisible(false);
                  fetchResponses(1, false, finalStart, finalEnd);
                }}
                style={{ flex: 2, paddingVertical: 18, borderRadius: 20, alignItems: 'center', backgroundColor: '#059669', shadowColor: '#059669', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 }}
              >
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff', letterSpacing: 1 }}>Apply Scope</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Filter sheet is handled by parent index.tsx via onOpenFilterSheet prop */}

      <RatingBottomSheet
        isVisible={ratingModalVisible}
        onClose={() => setRatingModalVisible(false)}
        orderId={ratingOrderTarget?.id || 0}
        raterType="store"
        orderStatus={ratingOrderTarget?.user_status || ''}
        cancelledBy={ratingOrderTarget?.cancelled_by}
        onSuccess={() => fetchResponses(1, false)}
      />
    </View>
  );
}

export default SellerHistoryScreen;
