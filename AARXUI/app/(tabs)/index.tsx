import { LocalizedText as RNText, LocalizedTextInput as TextInput, translateStatic } from '@/components/Language/LocalizedPrimitives';


import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { ImagePickerAsset } from 'expo-image-picker';

import axios from 'axios';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import Toast from 'react-native-toast-message';
import RazorpayCheckout from 'react-native-razorpay';

import * as SecureStore from 'expo-secure-store';
import { uploadFileToS3 } from '../../utils/s3Upload';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import { LatLng } from 'react-native-maps';
import {
  Portal
} from 'react-native-paper';
import RatingBottomSheet from '../../components/RatingBottomSheet';

import MapModal from '../../components/MapModal';

import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
import {
  ImageBackground
} from 'react-native';

interface Address {
  road?: string;
  city?: string;
  state?: string;
  country?: string;
  postcode?: string;
  [key: string]: string | undefined;
}

type Store = {
  id: number;
  name: string;
  owner_name: string;
  address: string;
  mobile: string;
  store_image?: string;
};

const getUploadFileMeta = (asset: ImagePickerAsset) => {
  const mimeType = asset.mimeType || (asset.uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
  const extension = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
  const rawName = asset.fileName || `photo.${extension}`;
  const safeName = rawName.includes('.') ? rawName : `${rawName}.${extension}`;

  return {
    name: safeName.replace(/\.(jpg|jpeg|png|webp)$/i, `.${extension}`),
    type: mimeType,
  };
};

const QuickActionTile = ({ icon, title, subtitle, color, onPress }: any) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.8}
    className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200 border border-slate-100 overflow-hidden"
    style={{ width: '47%', height: 160 }}
  >
    <LinearGradient
      colors={[`${color}05`, 'transparent']}
      className="absolute inset-0"
    />
    <View className="flex-1 p-6 justify-between">
      <View
        style={{ backgroundColor: `${color}15` }}
        className="w-12 h-12 rounded-2xl items-center justify-center"
      >
        <MaterialCommunityIcons name={icon} size={24} color={color} />
      </View>
      <View>
        <RNText className="text-base font-black text-slate-900 leading-tight uppercase">{title}</RNText>
        <RNText className="text-[8px] font-bold text-slate-400 uppercase tracking-[2px] mt-1">{subtitle}</RNText>
      </View>
    </View>
  </TouchableOpacity>
);

export default function HomeScreen() {
  const BASE_URL = Constants.expoConfig?.extra?.BASE_URL;
  const [token, setToken] = useState<string | null>(null);

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [image, setImage] = useState<ImagePickerAsset | null>(null);
  const [medicineName, setMedicineName] = useState("");
  const [description, setDescription] = useState("");
  const [isOptionModalVisible, setOptionModalVisible] = useState(false);
  const [isImageOptionsVisible, setImageOptionsVisible] = useState(false);
  const [isImageViewVisible, setImageViewVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [uploadType, setUploadType] = useState<string>("text_only");
  const [uploadMode, setUploadMode] = useState<'prescription' | 'medicine' | 'text' | null>(null);
  const [uploadTypeModalVisible, setUploadTypeModalVisible] = useState(false);

  const [currentlocation, setCurrentLocation] = useState<LatLng | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [showStoresModal, setShowStoresModal] = useState(false);
  const [nearbyStores, setNearbyStores] = useState<Store[]>([]);
  const [emergency, setEmergency] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [emergencyOffer, setEmergencyOffer] = useState<{ free: boolean; waitMinutes: number } | null>(null);
  const emergencyOfferResolver = useRef<((approved: boolean) => void) | null>(null);

  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [pendingRatingOrder, setPendingRatingOrder] = useState<any>(null);
  const [reviewingModalVisible, setReviewingModalVisible] = useState(false);
  const [reviewingCount, setReviewingCount] = useState(0);
  const [activeEmergency, setActiveEmergency] = useState<any | null>(null);
  const [activeEmergencyCount, setActiveEmergencyCount] = useState(0);

  const router = useRouter();
  console.log("imageUri--", imageUri)
  console.log("image", image)
  const getLocation = async () => {
    console.log("--- getLocation Clicked ---");
    if (currentlocation) {
      console.log("Location already exists, opening map modal:", currentlocation);
      setModalVisible(true);
      return;
    }

    console.log("Location not found, checking services and permissions...");
    const enabled = await Location.hasServicesEnabledAsync();
    console.log("Location services enabled:", enabled);
    if (!enabled) {
      Alert.alert('Location Disabled', 'Please enable location services or select manually on the map.');
      setModalVisible(true);
      return;
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    console.log("Permission status:", status);
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Location permission is required to find you automatically.');
      setModalVisible(true);
      return;
    }

    console.log("Fetching location with fallbacks...");
    setLoadingLocation(true); // Assuming you have this state
    try {
      // 1. Try last known position first (fastest, saves battery/time)
      let loc = await Location.getLastKnownPositionAsync({});
      console.log("Last known position fetched:", loc?.coords);

      // 2. If no last known or we want fresh, try current with a strict timeout
      if (!loc) {
        console.log("No last known position, trying getCurrentPositionAsync with 6s timeout...");
        const positionPromise = Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        // Competitive race to prevent app hang if GPS is weak
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Location Detection Timeout")), 6000)
        );

        loc = await Promise.race([positionPromise, timeoutPromise]) as Location.LocationObject;
        console.log("Current position received:", loc.coords);
      }

      if (loc) {
        const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setCurrentLocation(coords);

        console.log("Reverse geocoding position...");
        // Reverse geocoding can also hang, using a try/catch specifically for it
        try {
          const addressResult = await Location.reverseGeocodeAsync(coords);
          if (addressResult && addressResult.length > 0) {
            setAddress(addressResult[0]?.formattedAddress || "");
          }
        } catch (geoError) {
          console.warn("Reverse geocode failed, user will need to verify on map.");
        }
      }

      console.log("Opening map modal...");
      setModalVisible(true);
    } catch (error: any) {
      console.log("Location detection failure:", error.message);
      // Fallback: Just open the modal so user can pick manually
      setModalVisible(true);
      Toast.show({
        type: 'info',
        text1: 'Manual Selection',
        text2: 'GPS seems weak. Please pick your area on the map.',
        position: 'bottom'
      });
    } finally {
      setLoadingLocation(false);
    }
  };

  console.log("Adress", address)
  const handleMapPress = (e: any) => {
    setCurrentLocation(e.nativeEvent.coordinate);
    setModalVisible(false);
  };

  const requestPermissions = async () => {
    const cameraPerm = await ImagePicker.requestCameraPermissionsAsync();
    const mediaPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return cameraPerm.granted && mediaPerm.granted;
  };


  const openCamera = async () => {
    setLoadingImage(true);

    const result = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (!result.canceled && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
      setImage(result.assets[0]);
    }
    setLoadingImage(false);

  };

  const openGallery = async () => {
    setLoadingImage(true);

    const result = await ImagePicker.launchImageLibraryAsync({ quality: 1 });
    if (!result.canceled && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
      setImage(result.assets[0]);
    }
    setLoadingImage(false);

  };

  const handleImageTap = () => {
    if (!token) return; // ✅ Don't call if missing

    if (imageUri) {
      setImageOptionsVisible(true);
      return;
    }

    if (uploadMode === 'prescription' || uploadMode === 'medicine') {
      setOptionModalVisible(true);
      return;
    }

    setUploadTypeModalVisible(true);
  };

  // const handleSubmit = async () => {
  //   if (!image) return;

  //   const uri = image.uri;

  //   if (Platform.OS !== 'web') {
  //     const fileInfo = await FileSystem.getInfoAsync(uri);

  //     if (!fileInfo.exists) {
  //       Alert.alert('Error', 'File not found');
  //       return;
  //     }
  //   } else {
  //     // On web, you might want to add some fallback or skip this check
  //     console.log("Running on web, skipping FileSystem check");
  //   }

  //   const formData = new FormData();
  //   formData.append('image', {
  //     uri: uri,
  //     name: 'photo.jpg',
  //     type: 'image/jpeg',
  //   } as any);
  //   formData.append('emergency', emergency ? 'true' : 'false'); // 👈 Add this line

  //   // const formattedAddress = `${address?.street}, ${address?.city}, ${address?.state}`;
  //   if (address) {
  //     formData.append('user_address', address);
  //   } else {
  //     console.warn("Address is missing");
  //   }
  //   if (currentlocation?.latitude !== undefined && currentlocation?.longitude !== undefined) {
  //     formData.append('latitude', currentlocation.latitude.toString());
  //     formData.append('longitude', currentlocation.longitude.toString());
  //   } else {
  //     console.warn("Location is missing");
  //   }


  //   try {
  //     const response = await axios.post(`${BASE_URL}/api/upload/`, formData, {
  //       headers: {
  //         'Content-Type': 'multipart/form-data',
  //         'Authorization': `Bearer ${token}`,
  //       },
  //     });

  //     // console.log('Upload successful:', response.data);
  //     setImageUri(null);
  //     setImage(null);
  //     console.log("Sending data:");
  //     console.log("Address:", address);
  //     console.log("Lat:", currentlocation?.latitude);
  //     console.log("Lon:", currentlocation?.longitude);
  //     const stores = response.data.nearby_stores;

  //   if (stores && stores.length > 0) {
  //     // ✅ Show stores modal
  //     setNearbyStores(stores);
  //     setShowStoresModal(true);
  //   } else {
  //     // ✅ No stores — navigate directly
  //     router.push('/history');
  //   }
  //   //    setNearbyStores(response.data.nearby_stores);
  //   // setShowStoresModal(true); // <-- Show modal with stores
  //     // router.push('/history'); // ✅ Navigate to prescription screen

  //   } catch (error: any) {
  //     console.log("❌ Upload error caught!");

  //     if (error.response) {
  //       console.error('🔴 Response Error:', error.response.data);
  //       console.error('🔴 Status:', error.response.status);
  //       console.error('🔴 Headers:', error.response.headers);
  //     } else if (error.request) {
  //       console.error('🟡 Request Made But No Response:', error.request);
  //     } else {
  //       console.error('🔵 Other Error:', error.message);
  //     }

  //     console.log("Full error object:", error);
  //   }

  // };
  const [prescriptionId, setPrescriptionId] = useState<number | null>(null);
  const resetState = () => {
    setShowStoresModal(false);
    setSelectedStores([]);
    setEmergency(false);
    setImageUri(null);
    setImage(null);
    setUploadMode(null);
    setUploadType("text_only");
    setMedicineName("");
    setDescription("");
    setPrescriptionId(null);
  };
  const handleSubmit = async () => {
    if (!image && !medicineName.trim()) {
      Alert.alert('Error', 'Please provide either a prescription photo or type a medicine name.');
      return;
    }
    setSubmitting(true); // 🟢 Show loading

    let emergencyChargeId: string | null = null;
    if (emergency) {
      try {
        const authHeaders = { Authorization: `Bearer ${token}` };
        const eligibility = await axios.get(`${BASE_URL}/api/emergency-service/eligibility/`, { headers: authHeaders });
        const free = eligibility.data.free_broadcasts_remaining > 0;
        const approved = await new Promise<boolean>((resolve) => {
          emergencyOfferResolver.current = resolve;
          setEmergencyOffer({ free, waitMinutes: eligibility.data.quote_wait_minutes || 10 });
        });
        if (!approved) { setSubmitting(false); return; }
        const idempotencyKey = `emergency-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const created = await axios.post(
          `${BASE_URL}/api/emergency-service/charges/`,
          { idempotency_key: idempotencyKey },
          { headers: authHeaders },
        );
        let charge = created.data.charge;
        if (charge.kind === 'paid' && charge.status === 'payment_pending') {
          const payment: any = await RazorpayCheckout.open({
            key: created.data.razorpay_key_id,
            order_id: charge.razorpay_order_id,
            amount: charge.amount_paise,
            currency: charge.currency,
            name: 'AARX Pharmacy',
            description: 'Emergency Broadcast service',
            theme: { color: '#DC2626' },
          });
          const verified = await axios.post(
            `${BASE_URL}/api/emergency-service/charges/${charge.id}/verify/`,
            {
              razorpay_payment_id: payment.razorpay_payment_id,
              razorpay_signature: payment.razorpay_signature,
            },
            { headers: authHeaders },
          );
          charge = verified.data.charge;
        }
        if (charge.status !== 'authorized') throw new Error('Emergency payment was not authorized.');
        emergencyChargeId = charge.id;
      } catch (error: any) {
        const cancelled = error?.code === 0;
        if (!cancelled) Alert.alert('Emergency Broadcast', error?.response?.data?.error || error?.message || 'Could not start emergency broadcast.');
        setSubmitting(false);
        return;
      }
    }

    // ✅ Check file existence on native platforms if image is provided
    if (image && Platform.OS !== 'web') {
      const fileInfo = await FileSystem.getInfoAsync(image.uri);
      if (!fileInfo.exists) {
        Alert.alert('Error', 'File not found');
        setSubmitting(false);
        return;
      }
    }

    // Upload the binary directly to S3, then send only its verified object key
    // to Django with the remaining prescription data.
    const formData = new FormData();
    if (image) {
      const uploadFile = getUploadFileMeta(image);
      const imageKey = await uploadFileToS3(
        { uri: image.uri, name: uploadFile.name, type: uploadFile.type },
        'prescriptions',
        token || '',
      );
      formData.append('image_key', imageKey);
      formData.append('upload_type', uploadType);
    } else {
      formData.append('upload_type', 'text_only');
    }

    if (medicineName.trim()) {
      formData.append('medicine_name', medicineName.trim());
    }
    if (description.trim()) {
      formData.append('description', description.trim());
    }

    formData.append('emergency', emergency ? 'true' : 'false');
    if (emergencyChargeId) formData.append('emergency_charge_id', emergencyChargeId);

    if (address) {
      formData.append('user_address', address);
    } else {
      console.warn("⚠ Address missing");
    }

    if (
      currentlocation?.latitude !== undefined &&
      currentlocation?.longitude !== undefined
    ) {
      formData.append('latitude', currentlocation.latitude.toString());
      formData.append('longitude', currentlocation.longitude.toString());
    } else {
      console.warn("⚠ Location missing");
    }

    try {
      const response = await axios.post(`${BASE_URL}/api/upload/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`,
        },
      });

      // ✅ Reset UI state after successful upload
      // setImageUri(null);
      // setImage(null);

      console.log("✅ Upload success:", response.data);

      const stores = response.data.nearby_stores || [];
      const dispatchInfo = response.data.dispatch;
      const reviewingStoresCount = dispatchInfo?.stores_notified ?? stores.length;
      const uploadedPrescriptionId = response.data.prescription_id;  // ✅ Extract prescription ID here
      setPrescriptionId(uploadedPrescriptionId);

      if (emergency && stores.length > 0) {
        setNearbyStores(stores);
        setShowStoresModal(true);
      } else if (emergency) {
        setReviewingCount(reviewingStoresCount);
        setReviewingModalVisible(true);
      } else if (reviewingStoresCount > 0) {
        // Auto-dispatch sends the request to the ranked first batch.
        setReviewingCount(reviewingStoresCount);
        setReviewingModalVisible(true);
      } else {
        setImageUri(null);
        setImage(null);
        setUploadMode(null);
        setUploadType("text_only");
        setMedicineName("");
        setDescription("");
        // ✅ No nearby stores — navigate to history
        router.push('/history');
      }

    } catch (error: any) {
      console.log("❌ Upload error caught!");

      if (error.response) {
        console.error('🔴 Response Error:', error.response.data);
        if (error.response.status === 409 && error.response.data?.code === 'active_emergency_exists') {
          resetState();
          router.push('/(tabs)/emergency-requests' as any);
          Toast.show({ type: 'info', text1: 'Emergency request already active', text2: 'Opening its live tracking screen.' });
          return;
        }
      } else if (error.request) {
        console.error('🟡 Request sent but no response:', error.request);
      } else {
        console.error('🔵 Other Error:', error.message);
      }
      console.log("Full error:", error);
    }
    finally {
      setSubmitting(false); // 🔴 Hide loading in all cases
    }
  };

  useEffect(() => {
    const getToken = async () => {
      const storedToken = await SecureStore.getItemAsync('authToken');
      setToken(storedToken);
    };

    getToken();
    // ✅ Verification Toast
    Toast.show({
      type: 'success',
      text1: 'Aarx Elite Ready',
      text2: 'System status: Active',
      position: 'top',
      visibilityTime: 2000,
    });
  }, []);

  const checkPendingRatings = async () => {
    const storedToken = await SecureStore.getItemAsync('authToken');
    if (!storedToken) return;

    try {
      const response = await axios.get(`${BASE_URL}/api/ratings/pending/`, {
        headers: { 'Authorization': `Bearer ${storedToken}` }
      });
      if (response.data.results && response.data.results.length > 0) {
        setPendingRatingOrder(response.data.results[0]);
        setRatingModalVisible(true);
      }
    } catch (error) {
      console.log("Pending rating check failed:", error);
    }
  };

  useEffect(() => {
    if (token) {
      // Small delay to not overwhelm on mount
      const timer = setTimeout(checkPendingRatings, 1500);
      return () => clearTimeout(timer);
    }
  }, [token]);

  const [selectedStores, setSelectedStores] = useState<number[]>([]);
  const [sending, setSending] = useState(false);

  // const toggleStore = (storeId: number) => {
  //   setSelectedStores((prev) =>
  //     prev.includes(storeId) ? prev.filter((id) => id !== storeId) : [...prev, storeId]
  //   );
  // };
  const MAX_SELECTION = 5;

  const toggleStore = (storeId: number) => {
    let canShowToast = false;

    setSelectedStores((prev) => {
      if (prev.includes(storeId)) {
        return prev.filter((id) => id !== storeId);
      } else {
        if (prev.length >= MAX_SELECTION) {
          canShowToast = true;
          return prev;
        }
        return [...prev, storeId];
      }
    });

    // Side effect setState ke baad
    if (canShowToast) {
      Toast.show({
        type: 'error',
        text1: 'Limit reached',
        text2: 'Maximum 5 stores select kar sakte ho',
        position: 'top',
      });
    }
  };


  const handleSendToStores = async () => {
    if (selectedStores.length === 0) {
      Alert.alert('Select Store', 'कृपया कम से कम एक मेडिकल स्टोर चुनें');
      return;
    }

    try {
      setSending(true);

      const formData = new FormData();

      if (!prescriptionId) {
        Alert.alert('Error', 'Prescription ID missing. Please re-upload.');
        setSending(false);
        return;
      }

      formData.append('prescription_id', prescriptionId.toString());

      selectedStores.forEach(storeId => {
        formData.append('store_ids', storeId.toString());
      });

      if (emergency) {
        formData.append('emergency', 'true');
      }


      const response = await axios.post(`${BASE_URL}/api/send-prescription-to-stores/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`,
        },
      });

      Toast.show({
        type: 'success',
        text1: 'प्रिस्क्रिप्शन सफलतापूर्वक भेजा गया!',
        text2: 'स्टोर जल्दी ही आपको दवा की कीमत बताएगा। The store will contact you soon.',
        position: 'top',
        visibilityTime: 5000,
      });

      if (emergency) {
        setReviewingCount(response.data.reviewing_pharmacies_count || 0);
        setReviewingModalVisible(true);
      } else {
        resetState();
        router.push('/history');
      }

      // ✅ Delay navigation so user can see the Toast
      // setTimeout(() => {
      //   router.push('/history');
      // }, 1500);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'प्रिस्क्रिप्शन भेजने में समस्या आई!',
        text2: 'कृपया पुनः प्रयास करें। There was an issue sending the prescription.',
        position: 'top',
        visibilityTime: 5000,
      });
      console.error("Error sending prescription:", error);
    } finally {
      setSending(false);
    }
  };
  useFocusEffect(useCallback(() => {
    let active = true;
    const loadActiveEmergency = async () => {
      const storedToken = token || await SecureStore.getItemAsync('authToken');
      if (!storedToken) return;
      try {
        const response = await axios.get(BASE_URL + '/api/emergency-requests/?active=true', { headers: { Authorization: 'Bearer ' + storedToken } });
        if (active) { const activeItems = response.data.results || []; setActiveEmergency(activeItems[0] || null); setActiveEmergencyCount(activeItems.length); }
      } catch {
        if (active) { setActiveEmergency(null); setActiveEmergencyCount(0); }
      }
    };
    loadActiveEmergency();
    return () => { active = false; };
  }, [token, BASE_URL]));

  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    if (!showStoresModal) {
      setSelectedStores([]);
    }
  }, [showStoresModal]);

  return (
    <View className="flex-1 bg-slate-100">
      {/* ── Zomato/Swiggy-style Sticky Header ── */}
      <View className="bg-white" style={{ elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6 }}>
        {/* Location Row */}
        <TouchableOpacity
          onPress={getLocation}
          activeOpacity={0.75}
          className="flex-row items-center px-5 pt-4 pb-3"
        >
          <MaterialIcons name="location-on" size={24} color="#e11d48" />
          <View className="flex-1 ml-1.5">
            <View className="flex-row items-center">
              <RNText
                style={{ fontSize: 17, fontWeight: '900', color: '#0f172a', maxWidth: '85%' }}
                numberOfLines={1}
              >
                {address ? address.split(',')[0] : 'Select Location'}
              </RNText>
              <MaterialCommunityIcons name="chevron-down" size={20} color="#0f172a" style={{ marginLeft: 2 }} />
            </View>
            <RNText style={{ color: '#94a3b8', fontSize: 11, fontWeight: '500', marginTop: 1 }} numberOfLines={1}>
              {address ? address : 'Tap to set your delivery area'}
            </RNText>
          </View>
          {loadingLocation && <ActivityIndicator size="small" color="#10b981" />}
        </TouchableOpacity>

        {/* Thin divider */}
        <View style={{ height: 1, backgroundColor: '#f1f5f9', marginHorizontal: 20 }} />

        {/* Banner card */}
        {/* <View className="px-4 pt-3 pb-4">
          <View className="overflow-hidden rounded-[1.45rem]">
            <LinearGradient
              colors={['#0f172a', '#064e3b']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ minHeight: 170, overflow: 'hidden', paddingHorizontal: 20, paddingVertical: 16, position: 'relative' }}
            >
              <View style={{ position: 'absolute', right: -8, bottom: -36, height: 250, width: 210 }}>
                <Image
                  source={require('../../assets/images/useruploadprescription.png')}
                  style={{ height: '100%', width: '100%' }}
                  resizeMode="contain"
                />
              </View>
              <View style={{ width: '60%', justifyContent: 'center', minHeight: 88 }}>
                <RNText style={{ fontSize: 26, fontWeight: '900', color: '#fff', letterSpacing: 2, lineHeight: 30 }}>UPLOAD</RNText>
                <View style={{ height: 1, width: 56, backgroundColor: 'rgba(52,211,153,0.6)', marginVertical: 8 }} />
                <RNText style={{ fontSize: 9, fontWeight: '800', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 1 }}>
                  Prescription {'&'} Medicines
                </RNText>
              </View>
            </LinearGradient>
          </View>
        </View> */}
        <View className="px-2 pt-0 pb-0">
          <View className="overflow-hidden rounded-[24px]">
            <ImageBackground
              source={require('../../assets/images/uploadprescription.png')}
              resizeMode="cover"
              style={{
                width: '100%',
                height: 170,
              }}
            />
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 150, paddingHorizontal: 16, paddingTop: 14 }}
        className="flex-1"
      >
        {activeEmergency && (
          <View className="mb-4 overflow-hidden rounded-[24px] border border-rose-200 bg-white">
            <TouchableOpacity onPress={() => router.push('/(tabs)/emergency-requests' as any)} activeOpacity={0.88} className="p-4">
              <View className="flex-row items-center"><View className="h-12 w-12 items-center justify-center rounded-2xl bg-rose-600"><MaterialCommunityIcons name="radar" size={24} color="white" /></View><View className="ml-3 flex-1"><View className="flex-row items-center"><View className="mr-2 h-2 w-2 rounded-full bg-rose-500" /><RNText className="text-[9px] font-black uppercase tracking-[2px] text-rose-600">Emergency request live</RNText></View><RNText className="mt-1 text-sm font-black text-slate-900">{activeEmergencyCount} {activeEmergencyCount === 1 ? 'active request' : 'active requests'} · {'Latest Rx #'}{activeEmergency.id}</RNText><RNText className="mt-1 text-[10px] font-semibold text-slate-500">Showing latest here · tap to view all emergency requests</RNText></View><MaterialCommunityIcons name="chevron-right" size={23} color="#e11d48" /></View>
              <View className="mt-4 flex-row rounded-2xl bg-rose-50 p-3">
                {[['send-outline', activeEmergency.stores_notified || 0, 'Sent'], ['eye-outline', activeEmergency.stores_opened || 0, 'Opened'], ['store-check-outline', activeEmergency.stores_responded || 0, 'Responded'], ['message-text-outline', activeEmergency.quotes_received || 0, 'Quotes']].map(([icon, value, label]) => <View key={String(label)} className="flex-1 items-center"><MaterialCommunityIcons name={icon as any} size={16} color="#e11d48" /><RNText className="mt-1 text-sm font-black text-slate-900">{String(value)}</RNText><RNText className="text-[8px] font-bold uppercase text-slate-400">{String(label)}</RNText></View>)}
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/(tabs)/emergency-payments' as any)} className="flex-row items-center justify-center border-t border-rose-100 bg-blue-50 py-3"><MaterialCommunityIcons name="credit-card-clock-outline" size={17} color="#2563eb" /><RNText className="ml-2 text-[10px] font-black uppercase tracking-wider text-blue-700">View payment & refund history</RNText></TouchableOpacity>
          </View>
        )}

        {/* Mode Based Digital Prescription */}
        <View className="mb-8">
          <View className="bg-white rounded-[2.2rem] p-5 border border-slate-100 shadow-xl shadow-slate-200/60">
            <View className="flex-row items-center justify-between mb-5">
              <View className="flex-1 pr-3">
                <RNText className="text-2xl font-black text-slate-900 tracking-[-1px]">
                  What do you have?
                </RNText>
                <RNText className="text-[10px] font-bold text-slate-400 uppercase tracking-[2px] mt-1">
                  Choose one option to continue
                </RNText>
              </View>

              {uploadMode && (
                <TouchableOpacity
                  onPress={() => {
                    setUploadMode(null);
                    setUploadType("text_only");
                    setImageUri(null);
                    setImage(null);
                    setMedicineName("");
                    setDescription("");
                  }}
                  activeOpacity={0.8}
                  className="w-10 h-10 rounded-full bg-slate-100 items-center justify-center"
                >
                  <MaterialCommunityIcons name="close" size={20} color="#64748b" />
                </TouchableOpacity>
              )}
            </View>

            {!uploadMode && (
              <View className="flex-row justify-between w-full">
                {[
                  {
                    mode: 'prescription',
                    type: 'prescription',
                    title: 'Doctor\nRx',
                    sub: 'Scan Rx',
                    icon: 'file-document-outline',
                    color: '#059669',
                    gradStart: '#34d399',
                    gradEnd: '#059669',
                  },
                  {
                    mode: 'medicine',
                    type: 'medicine',
                    title: 'Pill\nPhoto',
                    sub: 'Scan Pack',
                    icon: 'camera-outline',
                    color: '#2563eb',
                    gradStart: '#60a5fa',
                    gradEnd: '#2563eb',
                  },
                  {
                    mode: 'text',
                    type: 'text_only',
                    title: 'Type\nName',
                    sub: 'Search',
                    icon: 'magnify',
                    color: '#d97706',
                    gradStart: '#fbbf24',
                    gradEnd: '#ea580c',
                  },
                ].map((item: any) => (
                  <TouchableOpacity
                    key={item.title}
                    activeOpacity={0.85}
                    onPress={() => {
                      setUploadMode(item.mode);
                      setUploadType(item.type);
                      if (item.mode !== 'text') {
                        setTimeout(() => setOptionModalVisible(true), 200);
                      }
                    }}
                    className="rounded-[14px] shadow-sm overflow-hidden"
                    style={{
                      width: '31.5%',
                      shadowColor: item.color, elevation: 4, shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }
                    }}
                  >
                    <LinearGradient
                      colors={[item.gradStart, item.gradEnd]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      className="p-2 items-center justify-center border-t border-l border-white/40 h-[100px]"
                    >
                      <MaterialCommunityIcons
                        name={item.icon}
                        size={35}
                        color="rgba(255,255,255,0.15)"
                        style={{ position: 'absolute', right: -2, bottom: -2, transform: [{ rotate: '-10deg' }] }}
                      />

                      <View
                        style={{ backgroundColor: '#fff', shadowColor: '#000', elevation: 3, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2 }}
                        className="w-7 h-7 rounded-lg items-center justify-center mb-1.5"
                      >
                        <MaterialCommunityIcons name={item.icon} size={15} color={item.color} />
                      </View>

                      <View className="z-10 items-center">
                        <RNText
                          numberOfLines={2}
                          adjustsFontSizeToFit
                          minimumFontScale={0.78}
                          style={{ color: '#fff', textShadowColor: 'rgba(0,0,0,0.1)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 }}
                          className="text-[11px] font-black text-center leading-4"
                        >
                          {item.title}
                        </RNText>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {!uploadMode && (
              <TouchableOpacity
                onPress={() => router.push('/history')}
                activeOpacity={0.9}
                className="mt-6 rounded-[24px] overflow-hidden bg-white"
                style={{
                  shadowColor: '#10b981',
                  elevation: 12,
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.25,
                  shadowRadius: 12
                }}
              >
                <LinearGradient
                  colors={['#ffffff', '#f0fdf4', '#dcfce7']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  className="flex-row items-center p-2 border border-white"
                >
                  {/* <View
                    className="bg-white rounded-[18px] p-2"
                    style={{ shadowColor: '#059669', elevation: 8, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6 }}
                  > */}
                  <Image
                    source={require('../../assets/images/historyicon.jpeg')}
                    style={{ width: 55, height: 75 }}
                    resizeMode="cover"
                    className="rounded-[14px]"
                  />
                  {/* </View> */}

                  <View className="flex-1 ml-4 justify-center">
                    <View className="flex-row items-center mb-1">
                      <MaterialCommunityIcons name="clock-check-outline" size={14} color="#059669" />
                      <RNText className="text-[10px] text-emerald-700 font-black uppercase tracking-widest ml-1.5">
                        Live Tracking
                      </RNText>
                    </View>
                    <RNText numberOfLines={2} className="text-[16px] text-slate-900 font-black leading-[20px]">
                      Track your Orders
                    </RNText>
                    <RNText numberOfLines={2} className="text-[11px] text-slate-500 font-bold leading-4 mt-1">
                      View quotes & delivery status
                    </RNText>
                  </View>

                  <View
                    className="w-12 h-12 rounded-[16px] items-center justify-center shadow-lg"
                    style={{
                      backgroundColor: '#10b981',
                      shadowColor: '#059669',
                      elevation: 8,
                      shadowOpacity: 0.4,
                      shadowRadius: 6,
                      shadowOffset: { width: 0, height: 4 }
                    }}
                  >
                    <MaterialCommunityIcons name="arrow-right" size={24} color="#fff" style={{ transform: [{ rotate: '-15deg' }] }} />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {(uploadMode === 'prescription' || uploadMode === 'medicine') && (
              <View>
                <TouchableOpacity
                  onPress={handleImageTap}
                  activeOpacity={0.9}
                  className="bg-slate-950 rounded-[2rem] p-4 mb-4 border border-slate-800 overflow-hidden"
                >
                  {loadingImage ? (
                    <View className="h-36 items-center justify-center">
                      <ActivityIndicator color="#10b981" />
                    </View>
                  ) : imageUri ? (
                    <View>
                      <Image
                        source={{ uri: imageUri }}
                        className="w-full h-40 rounded-[1.5rem]"
                        resizeMode="cover"
                      />
                      <View className="absolute left-3 right-3 bottom-3 flex-row items-center justify-between bg-black/55 rounded-2xl px-3 py-2">
                        <View className="flex-row items-center">
                          <MaterialCommunityIcons className="image-check-outline" size={18} color="#34d399" />
                          <RNText className="text-white text-[10px] font-black uppercase tracking-[1px] ml-2">
                            Photo Added
                          </RNText>
                        </View>
                        <MaterialCommunityIcons className="chevron-right" size={20} color="#fff" />
                      </View>
                    </View>
                  ) : (
                    <View className="h-36 items-center justify-center">
                      <View className="w-16 h-16 rounded-full bg-emerald-500/15 items-center justify-center mb-3">
                        <MaterialCommunityIcons
                          className={uploadMode === 'prescription' ? 'file-document-plus-outline' : 'camera-plus'}
                          size={34}
                          color="#10b981"
                        />
                      </View>
                      <RNText className="text-white text-sm font-black uppercase tracking-[2px]">
                        {uploadMode === 'prescription' ? 'Upload Prescription' : 'Upload Medicine Photo'}
                      </RNText>
                      <RNText className="text-slate-500 text-[10px] font-semibold mt-2">
                        Tap to open camera or gallery
                      </RNText>
                    </View>
                  )}
                </TouchableOpacity>

                <View className="bg-slate-50 rounded-2xl px-4 flex-row items-center mb-3 border border-slate-100">
                  <MaterialCommunityIcons name="notebook-edit-outline" size={19} color="#10b981" />
                  <TextInput
                    placeholder="Notes optional"
                    placeholderTextColor="#94a3b8"
                    className="flex-1 ml-3 text-slate-900 text-sm font-medium py-4"
                    value={description}
                    onChangeText={setDescription}
                  />
                </View>
              </View>
            )}

            {uploadMode === 'text' && (
              <View>
                <View className="bg-slate-50 rounded-2xl px-4 flex-row items-center mb-3 border border-slate-100">
                  <MaterialCommunityIcons name="pill" size={20} color="#10b981" />
                  <TextInput
                    placeholder="Type medicine name"
                    placeholderTextColor="#94a3b8"
                    className="flex-1 ml-3 text-slate-900 text-base font-semibold py-4"
                    value={medicineName}
                    onChangeText={setMedicineName}
                    autoFocus
                  />
                </View>

                <View className="bg-slate-50 rounded-2xl px-4 flex-row items-center mb-3 border border-slate-100">
                  <MaterialCommunityIcons name="notebook-edit-outline" size={19} color="#10b981" />
                  <TextInput
                    placeholder="Notes optional"
                    placeholderTextColor="#94a3b8"
                    className="flex-1 ml-3 text-slate-900 text-sm font-medium py-4"
                    value={description}
                    onChangeText={setDescription}
                  />
                </View>
              </View>
            )}

            {uploadMode && (
              <TouchableOpacity
                onPress={() => setEmergency(!emergency)}
                activeOpacity={0.9}
                className={`flex-row items-center justify-between rounded-2xl p-4 border ${emergency ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-100'
                  }`}
              >
                <View className="flex-row items-center flex-1">
                  <View
                    className={`w-11 h-11 rounded-2xl items-center justify-center mr-3 ${emergency ? 'bg-rose-500' : 'bg-slate-200'
                      }`}
                  >
                    <MaterialCommunityIcons
                      name={emergency ? 'ambulance' : 'flash-outline'}
                      size={22}
                      color={emergency ? '#fff' : '#64748b'}
                    />
                  </View>

                  <View className="flex-1">
                    <RNText className={`text-xs font-black uppercase ${emergency ? 'text-rose-600' : 'text-slate-700'}`}>
                      Emergency Priority
                    </RNText>
                    <RNText className="text-[10px] text-slate-500 font-semibold mt-1">
                      Faster verified-pharmacy dispatch; medicine availability is not guaranteed
                    </RNText>
                  </View>
                </View>

                <MaterialCommunityIcons
                  name={emergency ? 'toggle-switch' : 'toggle-switch-off-outline'}
                  size={40}
                  color={emergency ? '#f43f5e' : '#94a3b8'}
                />
              </TouchableOpacity>
            )}
          </View>

          {address && uploadMode && (
            <TouchableOpacity
              disabled={submitting}
              onPress={handleSubmit}
              activeOpacity={0.9}
              className={`mt-4 py-5 rounded-[1.8rem] items-center justify-center flex-row shadow-xl ${emergency ? 'bg-rose-600 shadow-rose-300' : 'bg-emerald-600 shadow-emerald-300'
                }`}
            >
              <MaterialCommunityIcons
                name={emergency ? 'ambulance' : 'lightning-bolt'}
                size={21}
                color="#FFF"
              />

              <RNText className="text-white font-black text-sm ml-2 uppercase tracking-[2px]">
                {submitting ? 'Sending Request' : emergency ? 'Emergency Dispatch' : 'Send Price Request'}
              </RNText>

              {submitting && <ActivityIndicator color="#FFF" className="ml-3" />}
            </TouchableOpacity>
          )}


          {true && (
            <View className="mt-3 overflow-hidden rounded-[26px] border border-rose-200 bg-white p-5">
              <View className="flex-row items-center">
                <View className="h-11 w-11 items-center justify-center rounded-2xl bg-rose-600"><MaterialCommunityIcons name="broadcast" size={22} color="white" /></View>
                <View className="ml-3 flex-1"><RNText className="text-sm font-black text-slate-950">Emergency Broadcast Benefits</RNText><RNText className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-600">First broadcast free · then ₹5</RNText></View>
              </View>
              {[
                ['bell-ring-outline', 'High-priority pharmacy notifications'],
                ['radar', 'Instant nearby verified-pharmacy dispatch'],
                ['timer-sand', 'Faster quotation collection'],
                ['cash-refund', 'Automatic refund if no valid quote arrives'],
              ].map(([icon, label]) => (
                <View key={label} className="mt-3 flex-row items-center"><MaterialCommunityIcons name={icon as any} size={17} color="#e11d48" /><RNText className="ml-3 flex-1 text-xs font-semibold text-slate-700">{label}</RNText><MaterialCommunityIcons name="check-circle" size={16} color="#10b981" /></View>
              ))}
              <View className="mt-4 flex-row rounded-2xl bg-amber-50 p-3"><MaterialCommunityIcons name="alert-outline" size={17} color="#b45309" /><RNText className="ml-2 flex-1 text-[9px] font-semibold leading-4 text-amber-800">Pharmacy availability service only—not emergency medical treatment.</RNText></View>
            </View>
          )}
        </View>
        {/* 💎 Professional Service Grid */}
        <View className="mb-6">
          <RNText className="text-[10px] font-black text-slate-400 uppercase tracking-[4px] ml-2 mb-6">Medical Logistics Suite</RNText>
          <View className="flex-row flex-wrap justify-between gap-y-6">
            <QuickActionTile
              icon="layers-search-outline"
              title="Active Bids"
              subtitle="Real-time Quotes"
              color="#10b981"
              onPress={() => router.push('/prescription')}
            />
            <QuickActionTile
              icon="calendar-check-outline"
              title="History"
              subtitle="Order Records"
              color="#3b82f6"
              onPress={() => router.push('/history')}
            />
          </View>
        </View>
      </ScrollView>

      {/* --- Modals Integration (Light Contrast) --- */}

      {/* Upload Options Modal */}
      <Portal>
        <Modal visible={isOptionModalVisible} transparent animationType="slide">
          <View className="flex-1 justify-end bg-slate-900/10">
            <BlurView intensity={30} tint="light" className="absolute inset-0" />
            <View className="bg-white rounded-t-[3.5rem] p-12 shadow-2xl border-t border-slate-100">
              <View className="items-center mb-10"><View className="w-16 h-1.5 bg-slate-100 rounded-full" /></View>
              <RNText className="text-3xl font-black text-slate-900 tracking-tighter uppercase mb-2">Digital Scan</RNText>
              <RNText className="text-[10px] font-bold text-emerald-600 uppercase tracking-[4px] mb-12">Select visual source hub</RNText>

              <View className="flex-row gap-6 mb-10">
                <TouchableOpacity
                  className="flex-1 bg-slate-50 p-10 rounded-[2.5rem] items-center border border-slate-100 shadow-sm"
                  onPress={async () => (await requestPermissions()) && (openCamera(), setOptionModalVisible(false))}
                >
                  <View className="w-16 h-16 rounded-[1.5rem] bg-emerald-500 items-center justify-center mb-4 shadow-lg shadow-emerald-500/20">
                    <MaterialCommunityIcons name="camera" size={32} color="white" />
                  </View>
                  <RNText className="text-slate-900 font-black text-xs uppercase tracking-widest">Camera</RNText>
                </TouchableOpacity>

                <TouchableOpacity
                  className="flex-1 bg-slate-50 p-10 rounded-[2.5rem] items-center border border-slate-100 shadow-sm"
                  onPress={async () => (await requestPermissions()) && (openGallery(), setOptionModalVisible(false))}
                >
                  <View className="w-16 h-16 rounded-[1.5rem] bg-blue-500 items-center justify-center mb-4 shadow-lg shadow-blue-500/20">
                    <MaterialCommunityIcons name="image" size={32} color="white" />
                  </View>
                  <RNText className="text-slate-900 font-black text-xs uppercase tracking-widest">Library</RNText>
                </TouchableOpacity>
              </View>

              <TouchableOpacity onPress={() => setOptionModalVisible(false)} className="py-6 bg-slate-900 rounded-[2rem] items-center shadow-lg shadow-slate-400">
                <RNText className="text-white font-bold text-xs uppercase tracking-[4px]">Abort Action</RNText>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </Portal>

      {/* Stores Selection Modal */}
      <Modal visible={showStoresModal} animationType="slide" transparent>
        <View className="flex-1 bg-slate-900/10 justify-end">
          <BlurView intensity={30} tint="light" className="absolute inset-0" />
          <View style={{ maxHeight: '85%' }} className="bg-white rounded-t-[3.5rem] shadow-2xl border-t border-slate-100 p-10">
            <View className="items-center py-4 mb-4"><View className="w-16 h-1.5 bg-slate-100 rounded-full" /></View>
            <View className="flex-row justify-between items-center mb-8">
              <View>
                <RNText className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Nearby Pharmacies</RNText>
                <RNText className="text-[10px] font-bold text-emerald-600 uppercase tracking-[3px] mt-1.5 ml-1">{emergency ? 'Request automatically sent to these pharmacies' : 'Select stores to get quotes from'}</RNText>
              </View>
              <TouchableOpacity onPress={() => { if (emergency) { setShowStoresModal(false); resetState(); router.push('/(tabs)/emergency-requests' as any); } else { setShowConfirmModal(true); } }} className="bg-slate-50 p-4 rounded-2xl">
                <MaterialCommunityIcons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="mb-10">
              <RNText className="text-rose-600 text-[10px] font-black uppercase tracking-widest mb-6 bg-rose-50 p-3 rounded-xl border border-rose-100 text-center">
                {emergency ? nearbyStores.length + ' verified pharmacies notified automatically' : 'Selection Restricted to ' + MAX_SELECTION + ' Units Maximum'}
              </RNText>

              {nearbyStores?.map((store) => {
                const isSelected = selectedStores.includes(store.id);

                return (
                  <TouchableOpacity
                    key={store.id}
                    disabled={emergency}
                    onPress={() => !emergency && toggleStore(store.id)}
                    className={`p-6 rounded-[2rem] mb-5 border-2 ${isSelected
                      ? 'bg-emerald-50 border-emerald-500'
                      : 'bg-slate-50 border-transparent'
                      }`}
                    style={{
                      opacity:
                        !isSelected && selectedStores.length >= MAX_SELECTION
                          ? 0.5
                          : 1,
                    }}
                  >
                    <View className="flex-row items-center">
                      <Image
                        source={{
                          uri: store.store_image
                            ? `${BASE_URL}${store.store_image}`
                            : 'https://via.placeholder.com/100',
                        }}
                        className="w-16 h-16 rounded-2xl mr-4 bg-slate-200"
                      />

                      <View className="flex-1">
                        <RNText className="text-slate-900 font-black text-base uppercase tracking-tighter">
                          {store.name}
                        </RNText>
                        <RNText
                          className="text-slate-500 font-bold text-[9px] uppercase tracking-widest mt-1"
                          numberOfLines={1}
                        >
                          {store.address}
                        </RNText>
                      </View>

                      <MaterialCommunityIcons
                        name={emergency ? "broadcast" : isSelected ? "checkbox-marked-circle" : "checkbox-blank-circle-outline"}
                        size={24}
                        color={emergency || isSelected ? "#10b981" : "#cbd5e1"}
                      />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View className="pt-6 border-t border-slate-100">
              <TouchableOpacity
                disabled={!emergency && (sending || selectedStores.length === 0)}
                onPress={() => { if (emergency) { setShowStoresModal(false); resetState(); router.push('/(tabs)/emergency-requests' as any); } else { handleSendToStores(); } }}
                activeOpacity={0.92}
                className="rounded-[2rem] overflow-hidden shadow-2xl"
                style={{ shadowColor: selectedStores.length === 0 ? '#cbd5e1' : '#10b981', shadowOpacity: 0.28, shadowRadius: 16, elevation: 8 }}
              >
                <LinearGradient
                  colors={emergency ? ['#fb7185', '#e11d48', '#be123c'] : sending || selectedStores.length === 0 ? ['#e2e8f0', '#cbd5e1'] : ['#34d399', '#10b981', '#0f766e']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  className="py-5 px-5 flex-row items-center justify-center"
                >
                  <View className={`w-10 h-10 rounded-2xl items-center justify-center mr-3 ${sending || selectedStores.length === 0 ? 'bg-white/50' : 'bg-white/20'}`}>
                    {sending ? (
                      <ActivityIndicator color="#64748b" size="small" />
                    ) : (
                      <MaterialCommunityIcons
                        name={emergency ? 'radar' : selectedStores.length === 0 ? 'store-off-outline' : 'send-check-outline'}
                        size={23}
                        color={emergency ? '#fff' : selectedStores.length === 0 ? '#64748b' : '#fff'}
                      />
                    )}
                  </View>

                  <View>
                    <RNText className={`font-black text-xs uppercase tracking-[3px] ${emergency ? 'text-white' : selectedStores.length === 0 ? 'text-slate-500' : 'text-white'}`}>
                      {emergency ? 'Track Live Request' : sending ? 'Sending Price Request' : selectedStores.length === 0 ? 'Select Pharmacy First' : 'Send Price Request'}
                    </RNText>
                    <RNText className={`text-[9px] font-bold uppercase tracking-[2px] mt-0.5 ${emergency ? 'text-white/80' : selectedStores.length === 0 ? 'text-slate-500' : 'text-white/80'}`}>
                      {emergency ? 'Already dispatched - no resend needed' : selectedStores.length === 0 ? 'Choose up to ' + MAX_SELECTION + ' stores' : selectedStores.length + ' pharmacies selected'}
                    </RNText>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Upload Type Modal */}
      <Portal>
        <Modal
          animationType="fade"
          transparent={true}
          visible={uploadTypeModalVisible}
          onRequestClose={() => setUploadTypeModalVisible(false)}
        >
          <View className="flex-1 justify-end">
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              className="bg-black/60"
              activeOpacity={1}
              onPress={() => setUploadTypeModalVisible(false)}
            />
            <View className="bg-slate-900 rounded-t-[2.5rem] p-8 border-t border-white/10 shadow-2xl">
              <View className="w-12 h-1.5 bg-slate-700 rounded-full self-center mb-6" />
              <RNText className="text-xl font-black text-white text-center mb-2">What are you uploading?</RNText>
              <RNText className="text-sm font-medium text-slate-400 text-center mb-6">Select the type of image to help our AI serve you better</RNText>

              <TouchableOpacity
                onPress={() => {
                  setUploadMode('prescription');
                  setUploadType("prescription");
                  setUploadTypeModalVisible(false);
                  setTimeout(() => setOptionModalVisible(true), 300);
                }}
                className="bg-slate-800 p-5 rounded-2xl flex-row items-center mb-4 border border-white/5"
              >
                <View className="w-12 h-12 bg-emerald-500/10 rounded-full items-center justify-center mr-4">
                  <MaterialCommunityIcons name="file-document-outline" size={24} color="#10B981" />
                </View>
                <View className="flex-1">
                  <RNText className="text-white font-black text-base">Doctor Prescription</RNText>
                  <RNText className="text-slate-400 text-xs mt-1">Official Rx document</RNText>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={24} color="#64748B" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setUploadMode('medicine');
                  setUploadType("medicine");
                  setUploadTypeModalVisible(false);
                  setTimeout(() => setOptionModalVisible(true), 300);
                }}
                className="bg-slate-800 p-5 rounded-2xl flex-row items-center border border-white/5"
              >
                <View className="w-12 h-12 bg-blue-500/10 rounded-full items-center justify-center mr-4">
                  <MaterialCommunityIcons name="pill" size={24} color="#3B82F6" />
                </View>
                <View className="flex-1">
                  <RNText className="text-white font-black text-base">Medicine Box / Strip</RNText>
                  <RNText className="text-slate-400 text-xs mt-1">Photo of the medicine itself</RNText>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </Portal>

      {/* Image Options Modal (Change/View/Remove) - Implementation requested */}
      <Portal>
        <Modal visible={isImageOptionsVisible} transparent animationType="slide">
          <View className="flex-1 justify-end bg-slate-900/10">
            <BlurView intensity={30} tint="light" className="absolute inset-0" />
            <View className="bg-white rounded-t-[3.5rem] p-12 shadow-2xl border-t border-slate-100">
              <View className="items-center mb-10"><View className="w-16 h-1.5 bg-slate-100 rounded-full" /></View>
              <RNText className="text-3xl font-black text-slate-900 tracking-tighter uppercase mb-2">Photo Hub</RNText>
              <RNText className="text-[10px] font-bold text-emerald-600 uppercase tracking-[4px] mb-12">Manage active prescription</RNText>

              <View className="flex-row gap-4 mb-10">
                <TouchableOpacity
                  className="flex-1 bg-slate-50 p-6 rounded-[2rem] items-center border border-slate-100 shadow-sm"
                  onPress={() => { setImageOptionsVisible(false); setOptionModalVisible(true); }}
                >
                  <View className="w-14 h-14 rounded-2xl bg-emerald-500 items-center justify-center mb-3 shadow-lg shadow-emerald-500/20">
                    <MaterialCommunityIcons name="camera-flip" size={24} color="white" />
                  </View>
                  <RNText className="text-slate-900 font-black text-[10px] uppercase tracking-widest">Change</RNText>
                </TouchableOpacity>

                <TouchableOpacity
                  className="flex-1 bg-slate-50 p-6 rounded-[2rem] items-center border border-slate-100 shadow-sm"
                  onPress={() => { setImageOptionsVisible(false); setImageViewVisible(true); }}
                >
                  <View className="w-14 h-14 rounded-2xl bg-blue-500 items-center justify-center mb-3 shadow-lg shadow-blue-500/20">
                    <MaterialCommunityIcons name="eye-outline" size={24} color="white" />
                  </View>
                  <RNText className="text-slate-900 font-black text-[10px] uppercase tracking-widest">View</RNText>
                </TouchableOpacity>

                <TouchableOpacity
                  className="flex-1 bg-slate-100 p-6 rounded-[2rem] items-center border border-slate-100 shadow-sm"
                  onPress={() => { setImageUri(null); setImage(null); setImageOptionsVisible(false); }}
                >
                  <View className="w-14 h-14 rounded-2xl bg-rose-500 items-center justify-center mb-3 shadow-lg shadow-rose-500/20">
                    <MaterialCommunityIcons name="trash-can-outline" size={24} color="white" />
                  </View>
                  <RNText className="text-slate-900 font-black text-[10px] uppercase tracking-widest text-rose-600">Remove</RNText>
                </TouchableOpacity>
              </View>

              <TouchableOpacity onPress={() => setImageOptionsVisible(false)} className="py-6 bg-slate-900 rounded-[2rem] items-center shadow-lg shadow-slate-400">
                <RNText className="text-white font-bold text-xs uppercase tracking-[4px]">Close Lab</RNText>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </Portal>

      {/* Full Screen Image Viewer Modal */}
      <Modal visible={isImageViewVisible} transparent animationType="fade">
        <View style={styles.fullScreenModal}>
          <BlurView intensity={90} tint="dark" className="absolute inset-0" />
          <TouchableOpacity
            onPress={() => setImageViewVisible(false)}
            style={[styles.closeButton, { zIndex: 100, backgroundColor: 'rgba(255,255,255,0.2)', padding: 10, borderRadius: 20 }]}
          >
            <MaterialCommunityIcons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          {imageUri && (
            <Image
              source={{ uri: imageUri }}
              style={{ width: '90%', height: '80%', resizeMode: 'contain' }}
            />
          )}
        </View>
      </Modal>

      {/* Confirmation Modal */}
      <Modal visible={showConfirmModal} transparent animationType="fade">
        <View className="flex-1 justify-center items-center bg-slate-900/10 p-6">
          <BlurView intensity={20} tint="light" className="absolute inset-0" />
          <View className="bg-white w-full rounded-[3rem] p-10 shadow-2xl border border-slate-100">
            <View className="w-20 h-20 bg-rose-50 rounded-[2rem] items-center justify-center mb-8 border border-rose-100">
              <MaterialCommunityIcons name="alert-decagram" size={40} color="#e11d48" />
            </View>
            <RNText className="text-3xl font-black text-slate-900 mb-2 uppercase tracking-tighter">Cancel Order?</RNText>
            <RNText className="text-slate-500 text-[10px] font-bold leading-5 mb-10 uppercase tracking-widest">
              This will clear your current prescription data.
            </RNText>
            <View className="flex-row gap-4">
              <TouchableOpacity onPress={() => setShowConfirmModal(false)} className="flex-1 bg-slate-100 h-16 rounded-2xl items-center justify-center">
                <RNText className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Go Back</RNText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setShowConfirmModal(false);
                  resetState();
                }}
                className="flex-1 bg-rose-500 h-16 rounded-2xl items-center justify-center shadow-lg shadow-rose-500/30"
              >
                <RNText className="text-white text-[10px] font-black uppercase tracking-widest">Yes, Cancel</RNText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Map Modal Integration */}
      {modalVisible && (
        <MapModal
          setModalVisible={(val: boolean) => setModalVisible(val)}
          setCurrentLocation={(loc: any) => setCurrentLocation(loc)}
          currentlocation={currentlocation as any}
          setAddress={(addr: string) => setAddress(addr)}
          address={address || ""}
        />
      )}

      {/* Premium Emergency Broadcast confirmation */}
      <Modal visible={!!emergencyOffer} transparent animationType="slide" onRequestClose={() => { emergencyOfferResolver.current?.(false); emergencyOfferResolver.current = null; setEmergencyOffer(null); }}>
        <View className="flex-1 justify-end bg-slate-950/70">
          <View className="overflow-hidden rounded-t-[38px] bg-white">
            <LinearGradient colors={['#881337', '#e11d48', '#fb7185']} className="px-6 pb-7 pt-5">
              <View className="mb-5 h-1.5 w-12 self-center rounded-full bg-white/40" />
              <View className="flex-row items-center justify-between"><View className="h-16 w-16 items-center justify-center rounded-[22px] bg-white/15"><MaterialCommunityIcons name="ambulance" size={32} color="white" /></View><View className="rounded-full border border-white/25 bg-white/15 px-4 py-2"><RNText className="text-[10px] font-black uppercase tracking-[2px] text-white">{emergencyOffer?.free ? 'First Broadcast FREE' : 'Service Fee ₹5'}</RNText></View></View>
              <RNText className="mt-5 text-3xl font-black tracking-tight text-white">Emergency Broadcast</RNText>
              <RNText className="mt-2 text-xs font-semibold leading-5 text-rose-100">Priority dispatch to nearby verified pharmacies for faster medicine quotations.</RNText>
            </LinearGradient>
            <View className="px-6 pb-8 pt-6">
              {[
                ['bell-badge-outline', 'Priority alerts', 'High-priority notification to eligible pharmacies'],
                ['store-marker-outline', 'Smart nearby dispatch', 'Ranked pharmacies contacted in expanding batches'],
                ['message-text-fast-outline', 'Live response tracking', 'See notified, opened and responded pharmacies'],
                ['shield-refresh-outline', 'Protected fee', (translateStatic('No valid quote within') || '') + ' ' + (emergencyOffer?.waitMinutes || 15) + ' ' + (translateStatic('minutes means automatic refund') || '')],
              ].map(([icon, title, body]) => <View key={title} className="mb-4 flex-row items-center"><View className="h-11 w-11 items-center justify-center rounded-2xl bg-rose-50"><MaterialCommunityIcons name={icon as any} size={21} color="#e11d48" /></View><View className="ml-3 flex-1"><RNText className="text-xs font-black text-slate-900">{title}</RNText><RNText className="mt-0.5 text-[10px] font-medium leading-4 text-slate-500">{body}</RNText></View></View>)}
              <View className="mb-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4"><RNText className="text-xs font-black text-emerald-800">{emergencyOffer?.free ? '₹0 today · First broadcast complimentary' : '₹5 one-time broadcast service fee'}</RNText><RNText className="mt-1 text-[10px] font-semibold leading-4 text-emerald-700">No store emergency fee. Zero valid quotes means your payment—or free benefit—is restored automatically.</RNText></View>
              <View className="flex-row gap-3">
                <TouchableOpacity onPress={() => { emergencyOfferResolver.current?.(false); emergencyOfferResolver.current = null; setEmergencyOffer(null); }} className="h-16 flex-1 items-center justify-center rounded-2xl bg-slate-100"><RNText className="text-xs font-black uppercase tracking-wider text-slate-600">Not now</RNText></TouchableOpacity>
                <TouchableOpacity onPress={() => { emergencyOfferResolver.current?.(true); emergencyOfferResolver.current = null; setEmergencyOffer(null); }} className="h-16 flex-[1.6] flex-row items-center justify-center rounded-2xl bg-rose-600"><MaterialCommunityIcons name={emergencyOffer?.free ? 'broadcast' : 'lock-check-outline'} size={20} color="white" /><RNText className="ml-2 text-xs font-black uppercase tracking-wider text-white">{emergencyOffer?.free ? 'Broadcast FREE' : 'Pay ₹5 Securely'}</RNText></TouchableOpacity>
              </View>
              <RNText className="mt-4 text-center text-[9px] font-medium leading-4 text-slate-400">Not an ambulance or medical emergency service. For severe symptoms, contact local emergency services.</RNText>
            </View>
          </View>
        </View>
      </Modal>

      {/* 🚨 Emergency Mode Reviewing Modal */}
      <Portal>
        <Modal visible={reviewingModalVisible} transparent animationType="fade">
          <View className="flex-1 bg-black/60 items-center justify-center px-6">
            <View className="bg-white rounded-[2rem] w-full p-8 items-center shadow-2xl">
              <View className="w-20 h-20 rounded-full bg-emerald-50 mb-6 items-center justify-center">
                <MaterialCommunityIcons name="radar" size={40} color="#10b981" />
              </View>

              <RNText className="text-xl font-black text-slate-900 text-center uppercase tracking-tight mb-2">
                {reviewingCount > 0 ? reviewingCount + ' ' + (translateStatic('Pharmacies') || 'Pharmacies') : 'Waiting for Pharmacies'}
              </RNText>

              <RNText className="text-sm font-medium text-slate-500 text-center mb-8">
                {reviewingCount > 0
                  ? "are reviewing your prescription. You will be notified as soon as they provide a quote."
                  : "to review your prescription. We will alert you once they respond."}
              </RNText>

              <TouchableOpacity
                onPress={() => {
                  setReviewingModalVisible(false);
                  resetState();
                  router.push(emergency ? '/(tabs)/emergency-requests' as any : '/history');
                }}
                className="w-full bg-emerald-600 py-4 rounded-xl items-center flex-row justify-center shadow-lg shadow-emerald-500/30"
              >
                <MaterialCommunityIcons name="timeline-check-outline" size={20} color="#FFF" />
                <RNText className="text-white font-bold text-sm uppercase tracking-widest ml-2">
                  Track Status
                </RNText>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </Portal>

      <RatingBottomSheet
        isVisible={ratingModalVisible}
        onClose={() => setRatingModalVisible(false)}
        orderId={pendingRatingOrder?.id || 0}
        raterType="user"
        orderStatus={pendingRatingOrder?.user_status || ''}
        cancelledBy={pendingRatingOrder?.cancelled_by}
        onSuccess={() => {
          setRatingModalVisible(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor: '#F5F5F5',
    padding: 20,
    justifyContent: 'center',
  }, skeleton: {
    backgroundColor: '#e0e0e0', // light gray
    borderRadius: 70, // circular like avatar
  },
  avatarWithBorder: {
    position: 'relative',          // for absolute camera icon positioning
    borderWidth: 2,                // thickness of border
    borderColor: '#10B981',        // blue border color
    borderRadius: 20,              // round border matching avatar radius
    padding: 50,                   // some padding so border doesn't clip image
    alignSelf: 'center',          // center horizontally
  },

  heading: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#E53935',
    marginBottom: 20,
    textAlign: 'center',
  },
  locationIconWrapper: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: '#E0F7FA',
    padding: 8,
    borderRadius: 25,
    elevation: 3,
  },
  avatarContainer: {
    alignSelf: 'center',
    position: 'relative',
  },
  avatarImage: {
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  cameraIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#000',
    borderRadius: 20,
    padding: 6,
  },
  instructionText: {
    textAlign: 'center',
    marginTop: 12,
    fontSize: 16,
    color: '#555',
  },
  submitButton: {
    marginTop: 30,
    backgroundColor: '#10B981',
    borderRadius: 0,
  },
  removeButton: {
    marginTop: 15,
    borderColor: 'red',
    borderRadius: 8,
  },
  fullScreenModal: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
  },
  bottomSheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  bottomSheet: {
    backgroundColor: '#fff',
    paddingVertical: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  modalCloseBtn: {
    alignSelf: 'flex-end',
    marginRight: 10,
    marginBottom: 10,
  },
  optionLabel: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
  },
  optionButton: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    // backgroundColor: 'black',
    borderWidth: 1, // Use borderWidth for the border
    borderColor: '#B0BEC5', // Light gray color for border (you can adjust to your preference)

    borderRadius: 40, // This makes the icon container round
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10, // Space between icon and text
  },
  optionText: {
    marginTop: 6,
    fontSize: 14,
    color: '#333',
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
  },
  changeText: {
    marginLeft: 8,
    color: '#1E88E5',
    fontWeight: '600',
    fontSize: 16,
  },
  locationInfo: {
    marginTop: 16,
  },
  map: {
    flex: 1,
  },

  closeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
