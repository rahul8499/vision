import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/Language/LocalizedPrimitives';

import { useIsFocused } from '@react-navigation/native';
import axios from 'axios';
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker'; // ADD
import * as IntentLauncher from 'expo-intent-launcher';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Share,
  TouchableOpacity,
  View,
  Switch
} from 'react-native';
import Toast from 'react-native-toast-message';
import * as Progress from 'react-native-progress';
import { LanguagePickerModal } from '@/components/Language/LanguagePickerModal';
import { useAppLanguage } from '@/context/LanguageContext';

import { AntDesign, Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../../redux/store';
import { fetchUserProfile, logout as logoutAction } from '../../redux/userSlice';

export default function SellerSettingsScreen() {
  /* ─── env & router ──────────────────────────────────────────────── */
  const BASE_URL = Constants.expoConfig?.extra?.BASE_URL;
  const router = useRouter();
  const isFocused = useIsFocused();
  const { t, languageLabel } = useAppLanguage();
  const [languageVisible, setLanguageVisible] = useState(false);
  const params = useLocalSearchParams<{ edit?: string }>();
  const [docUpdates, setDocUpdates] = useState<{ [k: string]: any }>({});

  /* ─── state ─────────────────────────────────────────────────────── */
  const {
    user: storeData,
    token,
    loading: profileLoading,
    error: profileError,
  } = useSelector((state: RootState) => state.user);
  const dispatch = useDispatch<AppDispatch>();
  const [loading] = useState(false);
  console.log("storeData--", storeData)
  /* UI state */
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [accountDeleteVisible, setAccountDeleteVisible] = useState(false);
  const [accountDeleteBusy, setAccountDeleteBusy] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // ADD to your state section
  const [editOpen, setEditOpen] = useState(false);
  const [editBusy, setEditBusy] = useState(false);

  // ✅ Auto-open edit form when navigated from sidebar Profile shortcut
  useEffect(() => {
    if (params?.edit === 'true') {
      setEditOpen(true);
    }
  }, [params?.edit]);

  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [pincode, setPincode] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [drugLicense, setDrugLicense] = useState('');
  const [autoAccept, setAutoAccept] = useState(false);
  const [docUploadBusy, setDocUploadBusy] = useState(false);
  const [ratingVisible, setRatingVisible] = useState(false);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingFeedback, setRatingFeedback] = useState('');
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [deliverySettings, setDeliverySettings] = useState<any>(null);
  const [deliveryPeople, setDeliveryPeople] = useState<any[]>([]);
  const [deliveryBusy, setDeliveryBusy] = useState(false);
  const [deliveryPersonOpen, setDeliveryPersonOpen] = useState(false);
  const [deliveryPersonName, setDeliveryPersonName] = useState('');
  const [deliveryPersonMobile, setDeliveryPersonMobile] = useState('');
  const [deliveryPersonVehicle, setDeliveryPersonVehicle] = useState('bike');

  const fetchDeliveryConfiguration = async () => {
    if (!token) return;
    try {
      const [settingsResponse, peopleResponse] = await Promise.all([
        axios.get(`${BASE_URL}/api/store/delivery-settings/`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${BASE_URL}/api/store/delivery-persons/`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setDeliverySettings(settingsResponse.data);
      setDeliveryPeople(peopleResponse.data || []);
    } catch (error: any) {
      console.error('Delivery configuration fetch failed:', error?.response?.data || error.message);
    }
  };

  const updateDeliveryField = (field: string, value: any) => {
    setDeliverySettings((current: any) => ({ ...(current || {}), [field]: value }));
  };

  const saveDeliveryConfiguration = async () => {
    if (!token || !deliverySettings) return;
    try {
      setDeliveryBusy(true);
      const response = await axios.patch(`${BASE_URL}/api/store/delivery-settings/`, deliverySettings, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      setDeliverySettings(response.data);
      Toast.show({ type: 'success', text1: 'Delivery settings saved', position: 'bottom' });
    } catch (error: any) {
      const details = error?.response?.data;
      Toast.show({
        type: 'error',
        text1: 'Delivery settings not saved',
        text2: typeof details === 'object' ? Object.values(details).flat().join(' ') : 'Check the entered values.',
        position: 'bottom',
      });
    } finally {
      setDeliveryBusy(false);
    }
  };

  const addDeliveryPerson = async () => {
    if (!token || !deliveryPersonName.trim() || deliveryPersonMobile.replace(/\D/g, '').length < 10) {
      Toast.show({ type: 'error', text1: 'Enter a valid name and mobile number', position: 'bottom' });
      return;
    }
    try {
      setDeliveryBusy(true);
      await axios.post(`${BASE_URL}/api/store/delivery-persons/`, {
        name: deliveryPersonName.trim(),
        mobile: deliveryPersonMobile.trim(),
        vehicle_type: deliveryPersonVehicle,
        is_active: true,
        is_available: true,
        max_concurrent_orders: 1,
      }, { headers: { Authorization: `Bearer ${token}` } });
      setDeliveryPersonOpen(false);
      setDeliveryPersonName('');
      setDeliveryPersonMobile('');
      setDeliveryPersonVehicle('bike');
      await fetchDeliveryConfiguration();
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Delivery person not added', text2: error?.response?.data?.mobile?.[0] || error?.response?.data?.error, position: 'bottom' });
    } finally {
      setDeliveryBusy(false);
    }
  };

  const toggleDeliveryPerson = async (person: any) => {
    if (!token) return;
    try {
      await axios.patch(`${BASE_URL}/api/store/delivery-persons/${person.id}/`, {
        is_available: !person.is_available,
      }, { headers: { Authorization: `Bearer ${token}` } });
      await fetchDeliveryConfiguration();
    } catch {
      Toast.show({ type: 'error', text1: 'Availability update failed', position: 'bottom' });
    }
  };

  const handleAppRatingSubmit = async () => {
    if (ratingValue === 0) {
      Toast.show({
        type: 'error',
        text1: 'Rating Required',
        text2: 'Please select a star rating first.',
        position: 'bottom'
      });
      return;
    }

    try {
      setRatingSubmitting(true);
      await axios.post(`${BASE_URL}/api/app-ratings/submit/`, {
        store_id: storeData?.id,
        rating: ratingValue,
        feedback: ratingFeedback
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      Toast.show({
        type: 'success',
        text1: 'Thank You',
        text2: 'Your feedback has been submitted successfully.',
        position: 'bottom'
      });
      setRatingVisible(false);
      setRatingValue(0);
      setRatingFeedback('');
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Submit Failed',
        text2: 'Failed to submit rating. Please try again.',
        position: 'bottom'
      });
    } finally {
      setRatingSubmitting(false);
    }
  };


  const pickFileForField = async (field: string) => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: '*/*' });
      if (res.canceled) return;

      const file = res.assets?.[0];
      if (!file) return;
      if (file.size && file.size > 2 * 1024 * 1024) {
        Toast.show({
          type: 'error',
          text1: 'File Too Large',
          text2: 'Select a file under 2 MB',
          position: 'bottom'
        });
        return;
      }
      console.log("file---", file)
      const fileObj = {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || 'application/octet-stream',
      };
      setDocUploadBusy(true); // ⏳ show loader

      // ✅ Update docUpdates and call saveProfile inside callback
      setDocUpdates(prev => {
        const updated = { ...prev, [field]: fileObj };

        console.log("✅ updated docUpdates--", updated);

        // ✅ Use the updated object directly
        setTimeout(() => {
          saveProfile(updated).finally(() => setDocUploadBusy(false)); // ✅ hide loader
        }, 100);

        return updated;
      });

      // delay 100ms to ensure docUpdates is updated
      // 👉 Option‑A: defer upload until “Save Profile”
      // 👉 Option‑B: uncomment next 6 lines to upload immediately
      /*
      const fd = new FormData();
      fd.append(field, { uri:file.uri, name:file.name, type:file.mimeType || 'application/octet-stream' } as any);
      setLoading(true);
      await axios.patch(`${BASE_URL}/api/store-me/`, fd, { headers:{ Authorization:`Bearer ${token}` }});
      await fetchProfile();
      Alert.alert('Uploaded', file.name);
      */
    } catch (e) {
      console.log('picker error', e);
      setDocUploadBusy(false);
      Toast.show({
        type: 'error',
        text1: 'Picker Error',
        text2: 'Could not pick the file.',
        position: 'bottom'
      });
    }
  };

  /* ─── helpers ───────────────────────────────────────────────────── */
  const fetchProfile = async () => {
    dispatch(fetchUserProfile());
  };

  const saveProfile = async (fileUpdates = docUpdates) => {
    console.log("📦 fileUpdates used in saveProfile:", fileUpdates);

    if (!token) return;

    // quick validation
    if (!name.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Input Required',
        text2: 'Name is required',
        position: 'bottom'
      });
      return;
    }
    if (mobile.trim().length < 10) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Mobile',
        text2: 'Enter a valid 10-digit mobile number',
        position: 'bottom'
      });
      return;
    }

    try {
      setEditBusy(true);

      console.log("docUpdates--", docUpdates)
      /* 1️⃣ Check if a file was selected */
      // if (hasFileUpdates) {
      // ----- multipart upload -----
      const fd = new FormData();

      Object.entries(fileUpdates).forEach(([field, file]: any) => {
        if (file && file.uri && file.name && file.type) {
          fd.append(field, {
            uri: file.uri,
            name: file.name,
            type: file.type,
          } as any);
        } else {
          console.warn(`Skipping invalid file for field: ${field}`);
        }
      });
      // 🔤 text
      fd.append('name', name);
      fd.append('mobile', mobile);
      fd.append('address', address);
      fd.append('pincode', pincode);
      fd.append('gst_number', gstNumber);
      fd.append('drug_license_number', drugLicense);
      fd.append('owner_name', ownerName);
      fd.append('auto_accept_prescription', String(autoAccept));



      console.log("fd---", fd)
      await axios.patch(
        `${BASE_URL}/api/store-me/`,
        fd,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',   // 👈 must add in RN
          },
          // 👇 prevent axios from altering FormData
          transformRequest: (data, headers) => {
            return data;      // keep FormData as-is
          },
        }
      )

      // refresh card + close modal
      await fetchProfile();
      setEditOpen(false);
      setDocUpdates({}); // clear local file cache
      Toast.show({
        type: 'success',
        text1: 'Profile Updated',
        text2: 'Your information has been saved successfully.',
        position: 'bottom'
      });
    } catch (err: any) {
      console.error('Save error:', err);
      Toast.show({
        type: 'error',
        text1: 'Update Failed',
        text2: 'Something went wrong. Please try again.',
        position: 'bottom'
      });
    } finally {
      setEditBusy(false);
    }
  };


  // useEffect(() => {
  //   saveProfile()
  // }, [docUpdates]);

  const confirmLogout = async () => {
    if (!token) return;
    try {
      setConfirmBusy(true);
      await axios.post(`${BASE_URL}/api/store/logout/`, null, {
        headers: { Authorization: `Bearer ${token}` },
      });

      /* clear global state & local storage */
      dispatch(logoutAction());

      /* back to onboarding */
      router.replace('/onboarding');
    } catch (err: any) {
      console.error('Logout error:', err?.response?.data || err.message);
      Toast.show({
        type: 'error',
        text1: 'Logout Failed',
        text2: 'Please check your connection and try again.',
        position: 'bottom'
      });
    } finally {
      setConfirmBusy(false);
      setLogoutVisible(false);
    }
  };

  const confirmDeleteAccount = async () => {
    if (!token) return;
    try {
      setAccountDeleteBusy(true);
      await axios.delete(`${BASE_URL}/api/account/delete/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      dispatch(logoutAction());
      setAccountDeleteVisible(false);
      router.replace('/onboarding');
    } catch (err: any) {
      console.error('Delete account error:', err?.response?.data || err.message);
      Toast.show({
        type: 'error',
        text1: 'Delete Failed',
        text2: err?.response?.data?.error || 'Unable to delete your account right now.',
        position: 'bottom'
      });
    } finally {
      setAccountDeleteBusy(false);
    }
  };
  const openPdfFile = async (uri: string) => {
    if (Platform.OS === 'android') {
      IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: uri,
        flags: 1,
        type: 'application/pdf',
      });
    } else {
      await Linking.openURL(uri);
    }
  };
  /* ─── effects ───────────────────────────────────────────────────── */
  /* refetch profile when screen focused or token ready */
  useEffect(() => {
    if (isFocused && (!token || !storeData)) {
      dispatch(fetchUserProfile());
    }
    if (isFocused && token) {
      fetchDeliveryConfiguration();
    }
  }, [isFocused, token, storeData, dispatch]);

  useEffect(() => {
    if (storeData) {
      setName(storeData.name || '');
      setEmail(storeData.email || '');
      setOwnerName(storeData.owner_name || '');
      setGstNumber(storeData.gst_number || '');
      setDrugLicense(storeData.drug_license_number || '');
      setMobile(storeData.mobile || '');
      setAddress(storeData.address || '');
      setPincode(storeData.pincode || '');
      setAutoAccept(storeData.auto_accept_prescription || false);
    }
  }, [storeData]);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deleteField, setDeleteField] = useState('');

  const handleDeleteConfirmed = async (field: string) => {
    if (!token) return;

    try {
      setConfirmBusy(true);
      await axios.patch(
        `${BASE_URL}/api/store-me/`,
        { [field]: null },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      fetchProfile(); // 🔄 Refresh data
      Toast.show({
        type: 'success',
        text1: 'Document Deleted',
        text2: 'The file has been removed successfully.',
        position: 'bottom'
      });
    } catch (e) {
      Toast.show({
        type: 'error',
        text1: 'Delete Failed',
        text2: 'Could not remove the document.',
        position: 'bottom'
      });
      console.log(e);
    } finally {
      setConfirmBusy(false);
      setDeleteVisible(false); // ✅ Close modal
    }
  };
  const isFormValid = name && ownerName && mobile && email && address && pincode && gstNumber && drugLicense;

  return (
    <View className="flex-1 bg-slate-100">
      <View className="px-4 pt-2 pb-1">
        <View className="overflow-hidden rounded-[1.45rem] shadow-sm shadow-slate-300">
          <LinearGradient
            colors={["#123b59", "#0d8a63"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="relative min-h-[150px] overflow-hidden px-4 py-4"
          >
            <View className="absolute -right-9 -bottom-10 h-[210px] w-[210px] items-center justify-center">
              <Image
                source={require("../../assets/images/sellersettings.png")}
                className="h-full w-full"
                resizeMode="contain"
              />
            </View>

            <View className="min-h-[118px] justify-center">
              <View className="z-10 w-[62%] min-w-0">
                <View className="flex-row items-center">
                  <Text className="text-[28px] font-black text-white tracking-[2px] leading-9" numberOfLines={1}>SETTINGS</Text>
                  <View className="mx-3 h-9 w-px rounded-full bg-emerald-300/80" />
                </View>
                <Text className="mt-1.5 text-[8px] font-black uppercase tracking-[0.7px] text-white/45" numberOfLines={1}>
                  Account, Documents & Preferences
                </Text>

              </View>
            </View>
          </LinearGradient>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 160 }}
      >

        {/* ── profile card ──────────────── */}
        {storeData ? (
          <View className="bg-white rounded-[2rem] shadow-2xl shadow-slate-300/40 border border-slate-200/70 mb-5 overflow-hidden">
            <LinearGradient
              colors={["#0f172a", "#164e63", "#047857"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="px-5 pt-5 pb-6"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <MaterialCommunityIcons name="storefront-outline" size={15} color="#6ee7b7" />
                  <Text className="ml-2 text-[9px] font-black uppercase tracking-[2.4px] text-emerald-300">Store Identity</Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setEditOpen(true)}
                  disabled={profileLoading}
                  className="h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/10"
                  style={{ opacity: profileLoading ? 0.4 : 1 }}
                >
                  <Feather name="edit-2" size={17} color="white" />
                </TouchableOpacity>
              </View>

              <View className="mt-4 flex-row items-center">
                <View className="relative h-[88px] w-[88px] items-center justify-center">
                  <Progress.Circle
                    size={88}
                    progress={(storeData?.profile_completion_percent || 0) / 100}
                    showsText={false}
                    color="#6ee7b7"
                    thickness={4}
                    unfilledColor="rgba(255,255,255,0.18)"
                    borderWidth={0}
                  />
                  <View className="absolute inset-0 items-center justify-center">
                    <View className="h-[74px] w-[74px] items-center justify-center rounded-[1.35rem] border border-white/20 bg-white/10">
                      <MaterialCommunityIcons name="storefront-outline" size={33} color="white" />
                    </View>
                  </View>
                </View>

                <View className="ml-4 min-w-0 flex-1">
                  <Text className="text-[10px] font-black uppercase tracking-[1.5px] text-white/50" numberOfLines={1}>Official Store Profile</Text>
                  <Text className="mt-1 text-[22px] font-black leading-7 text-white" numberOfLines={1}>{storeData.name}</Text>
                  <Text className="mt-0.5 text-[11px] font-bold text-slate-300" numberOfLines={1}>{storeData.owner_name || "Owner details pending"}</Text>

                  <View className="mt-3 flex-row flex-wrap items-center gap-2">
                    <View className="flex-row items-center rounded-full border border-white/15 bg-white/10 px-2.5 py-1">
                      <MaterialCommunityIcons
                        name={storeData.is_verified ? "check-decagram" : "shield-alert-outline"}
                        size={11}
                        color={storeData.is_verified ? "#6ee7b7" : "#fbbf24"}
                      />
                      <Text className="ml-1 text-[8px] font-black uppercase tracking-[0.8px] text-white">
                        {storeData.is_verified ? "Verified" : "Unverified"}
                      </Text>
                    </View>
                    <View className="flex-row items-center rounded-full bg-emerald-300 px-2.5 py-1">
                      <MaterialCommunityIcons name="progress-check" size={11} color="#064e3b" />
                      <Text className="ml-1 text-[8px] font-black uppercase tracking-[0.8px] text-emerald-950">
                        {storeData?.profile_completion_percent || 0}% Complete
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </LinearGradient>

            <View className="px-5 pb-5">
              <View className="pt-4">
                <View className="flex-row items-start mb-3">
                  <View className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 items-center justify-center">
                    <MaterialCommunityIcons name="map-marker-outline" size={17} color="#059669" />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="text-[8px] text-slate-400 font-black uppercase tracking-[2px] mb-0.5">Store Address</Text>
                    <Text className="text-sm text-slate-700 font-bold leading-5" numberOfLines={2}>
                      {storeData?.address || 'Address not added'}{storeData?.pincode ? `, ${storeData.pincode}` : ''}
                    </Text>
                  </View>
                </View>

                <View className="flex-row gap-3 mb-3">
                  <View className="flex-1 bg-slate-50 rounded-[1.15rem] border border-slate-100 p-3">
                    <View className="flex-row items-center mb-1">
                      <MaterialCommunityIcons name="phone-outline" size={14} color="#059669" />
                      <Text className="text-[8px] text-slate-400 font-black uppercase tracking-[1.5px] ml-1.5">Mobile</Text>
                    </View>
                    <Text className="text-slate-800 text-xs font-black" numberOfLines={1}>{storeData.mobile || 'Not added'}</Text>
                  </View>

                  <View className="flex-1 bg-slate-50 rounded-[1.15rem] border border-slate-100 p-3">
                    <View className="flex-row items-center mb-1">
                      <MaterialCommunityIcons name="email-outline" size={14} color="#059669" />
                      <Text className="text-[8px] text-slate-400 font-black uppercase tracking-[1.5px] ml-1.5">Email</Text>
                    </View>
                    <Text className="text-slate-800 text-xs font-black" numberOfLines={1}>{storeData?.email || 'Not added'}</Text>
                  </View>
                </View>

                <View className="bg-slate-50 rounded-[1.15rem] border border-slate-100 p-3">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 pr-2">
                      <View className="flex-row items-center mb-1">
                        <MaterialCommunityIcons name="file-document-outline" size={14} color="#059669" />
                        <Text className="text-[8px] text-slate-400 font-black uppercase tracking-[1.5px] ml-1.5">GST</Text>
                      </View>
                      <Text className="text-slate-800 text-[11px] font-black" numberOfLines={1}>{storeData?.gst_number || 'Not added'}</Text>
                    </View>
                    <View className="w-px h-10 bg-slate-200" />
                    <View className="flex-1 pl-3">
                      <View className="flex-row items-center mb-1">
                        <MaterialCommunityIcons name="clipboard-text-outline" size={14} color="#059669" />
                        <Text className="text-[8px] text-slate-400 font-black uppercase tracking-[1.5px] ml-1.5">Drug License</Text>
                      </View>
                      <Text className="text-slate-800 text-[11px] font-black" numberOfLines={1}>{storeData?.drug_license_number || 'Not added'}</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View className="mb-6">
            {profileError && !profileLoading ? (
              <View className="bg-white rounded-[2rem] overflow-hidden shadow-xl shadow-slate-200/70 border border-slate-200">
                <LinearGradient
                  colors={['#0f172a', '#1e293b', '#064e3b']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  className="h-2"
                />
                <View className="p-7 items-center">
                  <View className="w-20 h-20 rounded-[1.75rem] bg-rose-50 border border-rose-100 items-center justify-center mb-5">
                    <MaterialCommunityIcons name="alert-circle-outline" size={34} color="#DC2626" />
                  </View>
                  <Text className="text-2xl font-black text-slate-900 text-center">Store Sync Failed</Text>
                  <Text className="text-[10px] font-black text-emerald-600 uppercase tracking-[3px] mt-1">Profile Details</Text>
                  <Text className="text-sm font-semibold text-slate-400 text-center leading-5 mt-4">
                    {profileError || 'Unable to fetch your store profile right now.'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => dispatch(fetchUserProfile())}
                    disabled={profileLoading}
                    className={`w-full py-4 bg-slate-900 rounded-full items-center mt-7 shadow-md flex-row justify-center ${profileLoading ? 'opacity-60' : ''}`}
                  >
                    {profileLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="reload" size={18} color="#34d399" />
                        <Text className="text-white font-black text-sm uppercase tracking-widest ml-2">Retry</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View className="bg-white rounded-[2rem] overflow-hidden shadow-xl shadow-slate-200/70 border border-slate-200">
                <LinearGradient
                  colors={['#0f172a', '#1e293b', '#064e3b']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  className="h-2"
                />
                <View className="p-7 items-center">
                  <View className="w-20 h-20 rounded-[1.75rem] bg-emerald-50 border border-emerald-100 items-center justify-center mb-5">
                    <ActivityIndicator color="#10B981" size="large" />
                  </View>
                  <Text className="text-2xl font-black text-slate-900 text-center">Fetching Store</Text>
                  <Text className="text-[10px] font-black text-emerald-600 uppercase tracking-[3px] mt-1">Secure Profile Sync</Text>
                  <Text className="text-sm font-semibold text-slate-400 text-center leading-5 mt-4">
                    Loading store details, documents, and preferences.
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {storeData && deliverySettings && (
          <View className="mb-5 overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/40">
            <LinearGradient colors={['#0f172a', '#075985', '#047857']} className="p-5">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <MaterialCommunityIcons name="truck-delivery-outline" size={22} color="#6ee7b7" />
                  <View className="ml-3">
                    <Text className="text-base font-black text-white">Delivery & Pickup</Text>
                    <Text className="text-[8px] font-black uppercase tracking-[1.5px] text-emerald-200">Customer fulfillment configuration</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={saveDeliveryConfiguration} disabled={deliveryBusy} className="rounded-xl bg-white/15 px-3 py-2">
                  {deliveryBusy ? <ActivityIndicator size="small" color="white" /> : <Text className="text-[9px] font-black uppercase text-white">Save</Text>}
                </TouchableOpacity>
              </View>
            </LinearGradient>

            <View className="p-5">
              {[
                ['pickup_enabled', 'Store pickup', 'Customers can collect medicines at your store'],
                ['home_delivery_enabled', 'Home delivery', 'Offer delivery inside your configured radius'],
              ].map(([field, title, subtitle]) => (
                <View key={field} className="mb-3 flex-row items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <View className="flex-1 pr-4">
                    <Text className="font-black text-slate-900">{title}</Text>
                    <Text className="mt-1 text-[10px] font-semibold text-slate-500">{subtitle}</Text>
                  </View>
                  <Switch
                    value={Boolean(deliverySettings[field])}
                    onValueChange={(value) => updateDeliveryField(field, value)}
                    trackColor={{ false: '#cbd5e1', true: '#10b981' }}
                    thumbColor="#fff"
                  />
                </View>
              ))}

              <View className="flex-row flex-wrap justify-between">
                {[
                  ['maximum_delivery_radius_km', 'Maximum radius (km)'],
                  ['free_delivery_distance_km', 'Free distance (km)'],
                  ['base_delivery_charge', 'Base charge (₹)'],
                  ['per_km_charge', 'Per km charge (₹)'],
                  ['minimum_delivery_charge', 'Minimum charge (₹)'],
                  ['maximum_delivery_charge', 'Maximum charge (₹)'],
                  ['default_estimated_delivery_minutes', 'Base ETA (minutes)'],
                  ['delivery_time_per_km_minutes', 'Minutes per km'],
                ].map(([field, label]) => (
                  <View key={field} style={{ width: '48%' }} className="mb-3 rounded-2xl border border-slate-200 bg-white px-3 py-3">
                    <Text className="text-[7px] font-black uppercase tracking-[1px] text-slate-400">{label}</Text>
                    <TextInput
                      value={String(deliverySettings[field] ?? '')}
                      onChangeText={(value) => updateDeliveryField(field, field === 'maximum_delivery_charge' && value.trim() === '' ? null : value)}
                      keyboardType="decimal-pad"
                      className="mt-1 text-sm font-black text-slate-900"
                    />
                  </View>
                ))}
              </View>

              <Text className="mb-2 mt-1 text-[8px] font-black uppercase tracking-[1.5px] text-slate-400">Customer delivery message</Text>
              <TextInput
                value={deliverySettings.delivery_message_template || ''}
                onChangeText={(value) => updateDeliveryField('delivery_message_template', value)}
                multiline
                className="mb-4 min-h-[64px] rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-800"
              />
              <Text className="mb-2 text-[8px] font-black uppercase tracking-[1.5px] text-slate-400">Default unavailable message</Text>
              <TextInput
                value={deliverySettings.delivery_unavailable_message || ''}
                onChangeText={(value) => updateDeliveryField('delivery_unavailable_message', value)}
                multiline
                className="mb-4 min-h-[64px] rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-800"
              />

              <View className="mb-3 flex-row items-center justify-between">
                <Text className="text-[9px] font-black uppercase tracking-[1.5px] text-slate-500">Delivery team</Text>
                <TouchableOpacity onPress={() => setDeliveryPersonOpen(true)} className="rounded-xl bg-emerald-600 px-3 py-2">
                  <Text className="text-[8px] font-black uppercase text-white">Add person</Text>
                </TouchableOpacity>
              </View>
              {deliveryPeople.length === 0 ? (
                <Text className="rounded-2xl bg-amber-50 p-3 text-[10px] font-bold text-amber-700">No delivery person added. Delivery can still be quoted, but assign staff before dispatch when available.</Text>
              ) : deliveryPeople.map(person => (
                <View key={person.id} className="mb-2 flex-row items-center rounded-2xl border border-slate-100 p-3">
                  <View className="h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                    <MaterialCommunityIcons name="moped" size={20} color="#2563eb" />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="font-black text-slate-900">{person.name}</Text>
                    <Text className="text-[9px] font-bold uppercase text-slate-400">{person.vehicle_type} • {person.current_order_count}/{person.max_concurrent_orders} orders</Text>
                  </View>
                  <Switch value={Boolean(person.is_available)} onValueChange={() => toggleDeliveryPerson(person)} disabled={!person.is_active} />
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── documents accordion ───────── */}
        {storeData && (

          <TouchableOpacity
            onPress={() => setDocsOpen(!docsOpen)}
            disabled={docUploadBusy || loading}
            className="bg-white rounded-[1.5rem] border border-slate-200/70 shadow-xl shadow-slate-200/40 px-5 py-4 flex-row items-center justify-between"
          >
            <View className="flex-row items-center">
              <View className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 items-center justify-center mr-3">
                <MaterialCommunityIcons name="file-document-multiple-outline" size={19} color="#059669" />
              </View>
              <Text className="text-base font-black text-slate-950 uppercase tracking-wide">
                Documents
              </Text>
            </View>
            {docUploadBusy && <ActivityIndicator size="small" color="#059669" />}

            <AntDesign
              name={docsOpen ? 'up' : 'down'}
              size={18}
              color="#4B5563"
            />
          </TouchableOpacity>
        )}

        {storeData && (
          <View className="bg-white rounded-[1.5rem] shadow-xl shadow-slate-200/40 border border-slate-200/70 mb-8 mt-3 overflow-hidden">
            {/* header */}


            {docsOpen && (
              <View className="border-t border-gray-100">
                {[
                  { label: 'Store Licence', field: 'store_license_document' },
                  { label: 'Owner ID Proof', field: 'owner_id_proof' },
                  { label: 'Store Photo', field: 'store_image' },
                ].map(({ label, field }, i) => {
                  const url = (storeData as any)?.[field];
                  const newFile = docUpdates[field];          // ⬅️ newly selected
                  const isImage = (url || newFile?.uri) ? /\.(png|jpe?g|jpg)$/i.test(url || newFile?.name) : false;

                  const rowPress = () => {
                    if (url) setPreviewUrl(url);              // view existing
                    else pickFileForField(field);             // upload new
                  };

                  const rowLongPress = () => {
                    /* allow replace even if url present */
                    pickFileForField(field);
                  };

                  return (
                    <TouchableOpacity
                      key={field}
                      onPress={rowPress}
                      onLongPress={rowLongPress}
                      disabled={docUploadBusy || loading}
                      className={`px-5 py-4 flex-row items-center justify-between ${i !== 2 ? 'border-b border-gray-100' : ''
                        }`}
                    >
                      {/* left icon + label */}
                      <View className="flex-row items-center flex-1">
                        {/* icon */}
                        {newFile ? (
                          <Ionicons name="cloud-upload-outline" size={22} color="#059669" />
                        ) : (
                          <MaterialCommunityIcons
                            name={isImage ? 'file-image' : 'file-document'}
                            size={22}
                            color={url ? '#059669' : '#9CA3AF'}
                          />
                        )}

                        {/* label */}
                        <Text
                          className={`ml-3 flex-1 ${url || newFile ? 'text-gray-800' : 'text-gray-400 italic'
                            }`}
                        >
                          {newFile ? `Selected: ${newFile.name}` : label}
                        </Text>
                      </View>

                      {/* delete button if url exists */}
                      {url && !newFile && (
                        <TouchableOpacity
                          // onPress={() => handleDeleteDocument(field)}
                          onPress={() => {
                            setDeleteField(field);
                            setDeleteVisible(true);
                          }}
                          disabled={docUploadBusy || loading}

                          className="ml-2"
                        >
                          <Ionicons name="trash-bin-outline" size={18} color="#ef4444" />
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>

                  );
                })}

              </View>
            )}
          </View>
        )}

        {storeData && (
          <>
            <View className="mb-5">
              <Text className="text-[10px] font-black text-slate-400 uppercase tracking-[4px] ml-4 mb-3">Help & Preferences</Text>
              <View className="bg-white rounded-[1.5rem] overflow-hidden shadow-xl shadow-slate-200/40 border border-slate-200/70">
                <SettingsRow
                  icon="credit-card-outline"
                  title="Billing & Subscriptions"
                  subtitle="Manage your seller plans"
                  onPress={() => router.push('/(sellerTabs)/billing')}
                  isLast={false}
                />
                <SettingsRow
                  icon="shield-alert-outline"
                  title="Reports & Safety"
                  subtitle="Track pharmacy moderation reports"
                  onPress={() => router.push("/(sellerTabs)/reports")}
                  isLast={false}
                />
                <SettingsRow
                  icon="hand-heart-outline"
                  title="Help & Complaints"
                  subtitle="Raise a case against a patient or track disputes"
                  onPress={() => router.push("/(sellerTabs)/support")}
                  isLast={false}
                />
                <SettingsRow
                  icon="account-question-outline"
                  title="Pharmacist Consultations"
                  subtitle="Availability, customer questions and callbacks"
                  onPress={() => router.push('/(sellerTabs)/pharmacist')}
                  isLast={false}
                />
                <SettingsRow
                  icon="headphones"
                  title="Seller Help & Support"
                  subtitle="FAQs, call, email or contact AARX"
                  onPress={() => router.push('/(sellerTabs)/help-center')}
                  isLast={false}
                />
                <SettingsRow
                  icon="bell-outline"
                  title="Notifications"
                  subtitle="Order and chat alerts are active"
                  onPress={() => Alert.alert('Notifications', 'Seller notification preferences are active.')}
                  isLast={false}
                />
                <SettingsRow
                  icon="earth"
                  title={t('language.title')}
                  subtitle={t('language.subtitle')}
                  value={languageLabel}
                  onPress={() => setLanguageVisible(true)}
                  isLast={true}
                />
              </View>
            </View>

            <View className="mb-5">
              <Text className="text-[10px] font-black text-slate-400 uppercase tracking-[4px] ml-4 mb-3">Feedback & App</Text>
              <View className="bg-white rounded-[1.5rem] overflow-hidden shadow-xl shadow-slate-200/40 border border-slate-200/70">
                <SettingsRow
                  icon="star-outline"
                  title="Rate the App"
                  subtitle="Share your AARX seller experience"
                  onPress={() => setRatingVisible(true)}
                  isLast={false}
                />
                <SettingsRow
                  icon="share-variant-outline"
                  title="Invite Stores"
                  subtitle="Share AARX with another pharmacy"
                  onPress={() => Share.share({ message: 'Check out AARX for pharmacy order management and medicine delivery.' })}
                  isLast={true}
                />
              </View>
            </View>

            <View className="mb-5">
              <Text className="text-[10px] font-black text-slate-400 uppercase tracking-[4px] ml-4 mb-3">Legal</Text>
              <View className="bg-white rounded-[1.5rem] overflow-hidden shadow-xl shadow-slate-200/40 border border-slate-200/70">
                <SettingsRow
                  icon="shield-lock-outline"
                  title="Privacy Policy"
                  subtitle="Store, licence, customer and staff data"
                  onPress={() => router.push('/(sellerTabs)/legal/privacy')}
                  isLast={false}
                />
                <SettingsRow
                  icon="file-sign"
                  title="Seller Terms & Conditions"
                  subtitle="Pharmacy platform responsibilities"
                  onPress={() => router.push('/(sellerTabs)/legal/terms')}
                  isLast={false}
                />
                <SettingsRow
                  icon="cash-refund"
                  title="Cancellation, Refund & Replacement"
                  subtitle="Fulfilment and replacement obligations"
                  onPress={() => router.push('/(sellerTabs)/legal/cancellation')}
                  isLast={false}
                />
                <SettingsRow
                  icon="truck-delivery-outline"
                  title="Delivery & Fulfilment Policy"
                  subtitle="Dispatch, handling and handover standards"
                  onPress={() => router.push('/(sellerTabs)/legal/delivery')}
                  isLast={false}
                />
                <SettingsRow
                  icon="medical-bag"
                  title="Medicine & Safety Disclaimer"
                  subtitle="Dispensing, consultation and AI limits"
                  onPress={() => router.push('/(sellerTabs)/legal/medicine-safety')}
                  isLast={false}
                />
                <SettingsRow
                  icon="information-outline"
                  title="About AARX"
                  value="v1.0.0"
                  onPress={() => router.push('/(sellerTabs)/legal/about')}
                  isLast={false}
                />
                <SettingsRow
                  icon="account-remove-outline"
                  title="Delete Account"
                  subtitle="Deactivate this store account and sign out"
                  onPress={() => setAccountDeleteVisible(true)}
                  isLast={true}
                />
              </View>
            </View>

            <View className="mt-2 mb-8">
              <TouchableOpacity
                onPress={() => setLogoutVisible(true)}
                disabled={loading || confirmBusy}
                className={`bg-white rounded-[2rem] py-4 flex-row justify-center items-center border border-slate-200 shadow-xl shadow-slate-200/60 ${loading || confirmBusy ? 'opacity-60' : ''}`}
              >
                {loading ? (
                  <ActivityIndicator color="#DC2626" />
                ) : (
                  <>
                    <View className="w-9 h-9 rounded-2xl bg-red-50 border border-red-100 items-center justify-center">
                      <MaterialCommunityIcons name="logout-variant" size={20} color="#DC2626" />
                    </View>
                    <Text className="text-slate-900 font-black text-base ml-3 tracking-tight">{t('logout.action')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}

        <Text className="text-center text-gray-400 mt-2 mb-2 text-sm">
          App version 1.0.0
        </Text>
      </ScrollView>
      <Modal
        visible={deleteVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !confirmBusy && setDeleteVisible(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center">
          <View className="w-11/12 bg-white rounded-2xl p-6">
            <View className="items-center mb-4">
              <MaterialCommunityIcons name="trash-can-outline" size={34} color="#DC2626" />
              <Text className="text-xl font-bold text-gray-900 mt-2">
                Confirm Delete
              </Text>
            </View>

            <Text className="text-center text-gray-600 mb-6">
              Are you sure you want to delete this document?
            </Text>

            <View className="flex-row justify-between">
              <TouchableOpacity
                disabled={confirmBusy}
                onPress={() => setDeleteVisible(false)}
                className={`flex-1 py-3 rounded-md mr-2 items-center ${confirmBusy ? 'bg-gray-100 opacity-60' : 'bg-gray-200'}`}
              >
                <Text className="text-gray-700 font-medium">Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleDeleteConfirmed(deleteField)}
                disabled={confirmBusy}
                className="flex-1 py-3 bg-red-600 rounded-md ml-2 items-center"
              >
                {confirmBusy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-medium">Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── account delete modal ───────── */}
      <Modal transparent visible={deliveryPersonOpen} animationType="fade" onRequestClose={() => setDeliveryPersonOpen(false)}>
        <View className="flex-1 items-center justify-center bg-slate-950/60 px-6">
          <View className="w-full rounded-[2rem] bg-white p-6">
            <Text className="text-xl font-black text-slate-950">Add delivery person</Text>
            <Text className="mb-5 mt-1 text-[10px] font-bold text-slate-400">Details are shown to the customer only after assignment.</Text>
            <TextInput value={deliveryPersonName} onChangeText={setDeliveryPersonName} placeholder="Full name" className="mb-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 font-bold" />
            <TextInput value={deliveryPersonMobile} onChangeText={setDeliveryPersonMobile} placeholder="Mobile number" keyboardType="phone-pad" className="mb-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 font-bold" />
            <Text className="mb-2 text-[8px] font-black uppercase tracking-[1.5px] text-slate-400">Vehicle</Text>
            <View className="mb-5 flex-row flex-wrap gap-2">
              {['walk', 'bicycle', 'bike', 'scooter', 'car'].map(vehicle => (
                <TouchableOpacity key={vehicle} onPress={() => setDeliveryPersonVehicle(vehicle)} className={`rounded-xl px-3 py-2 ${deliveryPersonVehicle === vehicle ? 'bg-slate-900' : 'bg-slate-100'}`}>
                  <Text className={`text-[9px] font-black uppercase ${deliveryPersonVehicle === vehicle ? 'text-white' : 'text-slate-500'}`}>{vehicle}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View className="flex-row gap-3">
              <TouchableOpacity onPress={() => setDeliveryPersonOpen(false)} className="flex-1 items-center rounded-2xl bg-slate-100 py-4"><Text className="font-black text-slate-600">Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={addDeliveryPerson} disabled={deliveryBusy} className="flex-[1.4] items-center rounded-2xl bg-emerald-600 py-4">
                {deliveryBusy ? <ActivityIndicator color="white" /> : <Text className="font-black text-white">Add person</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={accountDeleteVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !accountDeleteBusy && setAccountDeleteVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-center items-center px-5">
          <View className="bg-white rounded-[2.25rem] w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200">
            <LinearGradient
              colors={['#7f1d1d', '#991b1b', '#0f172a']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              className="h-2"
            />
            <View className="p-6">
              <View className="flex-row items-center mb-5">
                <View className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 items-center justify-center">
                  <MaterialCommunityIcons name="account-remove-outline" size={26} color="#DC2626" />
                </View>
                <View className="ml-4 flex-1">
                  <Text className="text-xl font-black text-slate-900">Delete Store Account?</Text>
                  <Text className="text-[9px] font-black text-red-500 uppercase tracking-[2px] mt-0.5">Store Access Will Stop</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setAccountDeleteVisible(false)}
                  disabled={accountDeleteBusy}
                  className={`w-9 h-9 rounded-full bg-slate-50 border border-slate-200 items-center justify-center ${accountDeleteBusy ? 'opacity-50' : ''}`}
                >
                  <MaterialCommunityIcons name="close" size={18} color="#64748b" />
                </TouchableOpacity>
              </View>

              <View className="bg-red-50 rounded-[1.5rem] border border-red-100 p-4 mb-5">
                <View className="flex-row items-start">
                  <MaterialCommunityIcons name="alert-outline" size={18} color="#DC2626" />
                  <Text className="text-sm font-semibold text-red-700 leading-5 ml-3 flex-1">
                    Your store will be deactivated and you will be signed out. Existing orders, chats, and records are kept safely.
                  </Text>
                </View>
              </View>

              <View className="flex-row w-full gap-3">
                <TouchableOpacity
                  disabled={accountDeleteBusy}
                  onPress={() => setAccountDeleteVisible(false)}
                  className={`flex-1 py-3.5 bg-slate-50 rounded-full items-center border border-slate-200 ${accountDeleteBusy ? 'opacity-50' : ''}`}
                >
                  <Text className="text-slate-600 font-black text-sm">Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={confirmDeleteAccount}
                  disabled={accountDeleteBusy}
                  className="flex-1 py-3.5 bg-red-600 rounded-full items-center shadow-sm"
                >
                  {accountDeleteBusy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-white font-black text-sm">Delete</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <LanguagePickerModal visible={languageVisible} onClose={() => setLanguageVisible(false)} />

      {/* ── custom logout modal ───────── */}
      <Modal
        visible={logoutVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !confirmBusy && setLogoutVisible(false)}
      >
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
                <View className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 items-center justify-center">
                  <MaterialCommunityIcons name="logout-variant" size={26} color="#DC2626" />
                </View>
                <View className="ml-4 flex-1">
                  <Text className="text-xl font-black text-slate-900">{t('logout.title')}</Text>
                  <Text className="text-[9px] font-black text-red-500 uppercase tracking-[2px] mt-0.5">{t('logout.storeEyebrow')}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setLogoutVisible(false)}
                  disabled={confirmBusy}
                  className={`w-9 h-9 rounded-full bg-slate-50 border border-slate-200 items-center justify-center ${confirmBusy ? 'opacity-50' : ''}`}
                >
                  <MaterialCommunityIcons name="close" size={18} color="#64748b" />
                </TouchableOpacity>
              </View>

              <View className="bg-slate-50 rounded-[1.5rem] border border-slate-200 p-4 mb-5">
                <View className="flex-row items-start">
                  <MaterialCommunityIcons name="shield-lock-outline" size={18} color="#059669" />
                  <Text className="text-sm font-semibold text-slate-500 leading-5 ml-3 flex-1">
                    {t('logout.storeMessage')}
                  </Text>
                </View>
              </View>

              <View className="flex-row w-full gap-3">
                <TouchableOpacity
                  disabled={confirmBusy}
                  onPress={() => setLogoutVisible(false)}
                  className={`flex-1 py-3.5 bg-slate-50 rounded-full items-center border border-slate-200 ${confirmBusy ? 'opacity-50' : ''}`}
                >
                  <Text className="text-slate-600 font-black text-sm">{t('logout.stay')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={confirmLogout}
                  disabled={confirmBusy}
                  className="flex-1 py-3.5 bg-slate-900 rounded-full items-center shadow-sm"
                >
                  {confirmBusy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-white font-black text-sm">{t('logout.confirm')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── preview modal ─────────────── */}
      <Modal
        visible={!!previewUrl}
        transparent
        animationType="slide"
        onRequestClose={() => setPreviewUrl(null)}
      >
        <View className="flex-1 bg-black">
          <TouchableOpacity
            onPress={() => setPreviewUrl(null)}
            className="absolute top-10 right-6 z-50 p-2"
          >
            <AntDesign name="close" size={28} color="#fff" />
          </TouchableOpacity>

          {/* {previewUrl && /\.(png|jpe?g|jpg)$/i.test(previewUrl) ? (
            <Image
              source={{ uri: previewUrl }}
              className="flex-1"
              resizeMode="contain"
            />
          ) : (
            previewUrl && (
              <WebView
                source={{ uri: previewUrl }}
                style={{ flex: 1, marginTop: 60 }}
                startInLoadingState
                renderLoading={() => (
                  <ActivityIndicator
                    color="#fff"
                    size="large"
                    style={{ marginTop: 80 }}
                  />
                )}
              />
            )
          )} */}
          {
            previewUrl && previewUrl.endsWith('.pdf') ? (
              <TouchableOpacity
                className="flex-1 items-center justify-center"
                onPress={() => openPdfFile(previewUrl)}
              >
                <Text className="text-white text-lg">Tap to open PDF</Text>
              </TouchableOpacity>
            ) : previewUrl && (
              <WebView
                source={{ uri: previewUrl }}
                style={{ flex: 1, marginTop: 60 }}
                startInLoadingState
                renderLoading={() => (
                  <ActivityIndicator
                    color="#fff"
                    size="large"
                    style={{ marginTop: 80 }}
                  />
                )}
              />
            )
          }

        </View>
      </Modal>
      {/* ── EDIT MODAL ─────────────────────── */}
      <Modal
        visible={editOpen}
        transparent
        animationType="fade"
        onRequestClose={() => !editBusy && setEditOpen(false)}
      >
        <View className="flex-1 bg-black/60 justify-center items-center px-5">
          <View className="w-full max-w-md bg-white rounded-[2.25rem] shadow-2xl overflow-hidden border border-slate-200">
            <LinearGradient
              colors={['#0f172a', '#1e293b', '#064e3b']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              className="h-2"
            />
            <View className="p-5">
              <View className="flex-row items-center mb-5">
                <View className="w-16 h-16 rounded-[1.35rem] bg-emerald-50 border border-emerald-100 items-center justify-center shadow-lg shadow-slate-200">
                  <MaterialCommunityIcons name="store-edit-outline" size={32} color="#059669" />
                </View>
                <View className="ml-4 flex-1">
                  <Text className="text-xl font-black text-slate-950" numberOfLines={1}>Edit Store</Text>
                  <Text className="text-[9px] font-black text-emerald-600 uppercase tracking-[2px] mt-0.5">Profile & Compliance</Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setEditOpen(false);
                    fetchProfile();
                  }}
                  disabled={editBusy}
                  className={`w-9 h-9 rounded-full bg-slate-50 border border-slate-200 items-center justify-center ${editBusy ? 'opacity-50' : ''}`}
                >
                  <MaterialCommunityIcons name="close" size={18} color="#64748b" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} className="max-h-[58vh]">
                <StorePillInput
                  label="Store Name"
                  value={name}
                  onChange={setName}
                  editable={!editBusy}
                  placeholder="Store Name"
                  icon="storefront-outline"
                />

                <StorePillInput
                  label="Owner Name"
                  value={ownerName}
                  onChange={setOwnerName}
                  editable={!editBusy}
                  placeholder="Owner Name"
                  icon="account-tie-outline"
                />

                <StorePillInput
                  label="Mobile Number"
                  value={mobile}
                  onChange={setMobile}
                  editable={!editBusy}
                  placeholder="10-digit mobile"
                  keyboardType="phone-pad"
                  icon="phone-outline"
                />

                <StorePillInput
                  label="Email Address"
                  value={email}
                  onChange={setEmail}
                  editable={!editBusy}
                  placeholder="Email"
                  keyboardType="email-address"
                  icon="email-outline"
                />

                <View className="mb-4">
                  <Text className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-4">Store Address</Text>
                  <View className="bg-slate-50 rounded-[1.5rem] border border-slate-200 relative overflow-hidden">
                    <View className="absolute top-4 left-4 z-10">
                      <MaterialCommunityIcons name="map-marker-outline" size={18} color="#059669" />
                    </View>
                    <TextInput
                      value={address}
                      onChangeText={setAddress}
                      editable={!editBusy}
                      placeholder="Complete store address"
                      multiline
                      className="p-4 pl-11 text-slate-900 font-bold min-h-[78px] text-sm"
                      placeholderTextColor="#A1A1AA"
                      textAlignVertical="top"
                    />
                  </View>
                </View>

                <StorePillInput
                  label="Pincode"
                  value={pincode}
                  onChange={setPincode}
                  editable={!editBusy}
                  placeholder="Area pincode"
                  keyboardType="numeric"
                  icon="map-marker-radius-outline"
                />

                <StorePillInput
                  label="GST Number"
                  value={gstNumber}
                  onChange={setGstNumber}
                  editable={!editBusy}
                  placeholder="GST Number"
                  icon="file-document-outline"
                />

                <StorePillInput
                  label="Drug License"
                  value={drugLicense}
                  onChange={setDrugLicense}
                  editable={!editBusy}
                  placeholder="Drug License Number"
                  icon="clipboard-text-outline"
                />

                <View className="bg-slate-50 rounded-[1.5rem] border border-slate-200 p-4 mb-4 flex-row items-center justify-between">
                  <View className="flex-row items-start flex-1 mr-4">
                    <View className="w-10 h-10 rounded-xl bg-white border border-slate-200 items-center justify-center">
                      <MaterialCommunityIcons name="flash-outline" size={18} color="#059669" />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-sm font-black text-slate-900">Auto Accept Prescriptions</Text>
                      <Text className="text-[11px] text-slate-500 font-semibold leading-4 mt-0.5">Emergency mode prescriptions will automatically be routed to you.</Text>
                    </View>
                  </View>
                  <Switch
                    value={autoAccept}
                    onValueChange={setAutoAccept}
                    disabled={editBusy}
                    trackColor={{ false: '#d1d5db', true: '#10b981' }}
                    thumbColor={Platform.OS === 'ios' ? '#fff' : autoAccept ? '#fff' : '#f4f3f4'}
                  />
                </View>
              </ScrollView>

              <View className="flex-row gap-3 mt-5">
                <TouchableOpacity
                  onPress={() => {
                    setEditOpen(false);
                    fetchProfile();
                  }}
                  disabled={editBusy}
                  className={`flex-1 py-3.5 bg-slate-50 rounded-full items-center border border-slate-200 ${editBusy ? 'opacity-50' : ''}`}
                >
                  <Text className="text-slate-600 font-black text-sm">Discard</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={saveProfile}
                  disabled={!isFormValid || editBusy}
                  className={`flex-[1.35] py-3.5 rounded-full items-center shadow-md ${!isFormValid || editBusy ? 'bg-slate-200' : 'bg-slate-900'}`}
                >
                  {editBusy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className={`font-black text-sm ${!isFormValid ? 'text-slate-500' : 'text-white'}`}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={ratingVisible} transparent animationType="fade" onRequestClose={() => !ratingSubmitting && setRatingVisible(false)}>
        <View className="flex-1 bg-black/60 justify-center items-center px-4">
          <View className="bg-white p-8 rounded-[3rem] w-full max-w-sm items-center shadow-2xl border border-slate-200">
            <View className="w-16 h-16 bg-emerald-50 rounded-full items-center justify-center mb-4 border border-emerald-100">
              <MaterialCommunityIcons name="star-shooting" size={32} color="#F59E0B" />
            </View>
            <Text className="text-xl font-black text-slate-900 mb-1">Rate AARX App</Text>
            <Text className="text-xs text-slate-400 text-center mb-6">How was your seller experience using our app?</Text>

            <View className="flex-row gap-2 mb-6">
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setRatingValue(star)} disabled={ratingSubmitting}>
                  <MaterialCommunityIcons
                    name={star <= ratingValue ? 'star' : 'star-outline'}
                    size={40}
                    color={star <= ratingValue ? '#F59E0B' : '#D1D5DB'}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-800 mb-6 min-h-[80px]"
              placeholder="Tell us what you liked or how we can improve..."
              placeholderTextColor="#9CA3AF"
              multiline
              textAlignVertical="top"
              value={ratingFeedback}
              onChangeText={setRatingFeedback}
            />

            <View className="flex-row w-full gap-3">
              <TouchableOpacity
                onPress={() => setRatingVisible(false)}
                disabled={ratingSubmitting}
                className={`flex-1 py-4 bg-slate-100 rounded-full items-center ${ratingSubmitting ? 'opacity-50' : ''}`}
              >
                <Text className="text-slate-600 font-bold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAppRatingSubmit}
                disabled={ratingSubmitting || ratingValue === 0}
                className={`flex-1 py-4 rounded-full items-center ${ratingSubmitting || ratingValue === 0 ? 'bg-emerald-300' : 'bg-slate-900'}`}
              >
                {ratingSubmitting ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold">Submit</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const SettingsRow = ({ icon, title, value, subtitle, onPress, isLast }: any) => (
  <TouchableOpacity
    onPress={onPress}
    className={`flex-row items-center px-5 py-4 ${!isLast ? 'border-b border-slate-100' : ''} active:bg-emerald-50/40`}
  >
    <View className="w-11 h-11 bg-emerald-50 rounded-2xl justify-center items-center border border-emerald-100 shadow-sm shadow-emerald-100">
      <MaterialCommunityIcons name={icon} size={21} color="#059669" />
    </View>
    <View className="ml-4 flex-1">
      <Text className="text-[15px] font-black text-slate-900 tracking-tight">{title}</Text>
      {subtitle && <Text className="text-[10px] font-bold text-slate-400 -mt-0.5 uppercase tracking-wider">{subtitle}</Text>}
      {value && <Text className="text-sm font-bold text-emerald-600 mt-0.5" numberOfLines={1}>{value}</Text>}
    </View>
    <View className="w-8 h-8 rounded-full bg-slate-50 items-center justify-center border border-slate-100">
      <MaterialCommunityIcons name="chevron-right" size={18} color="#94A3B8" />
    </View>
  </TouchableOpacity>
);

const StorePillInput = ({ label, value, onChange, editable, placeholder, keyboardType, icon }: any) => (
  <View className="mb-4">
    <Text className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-4">{label}</Text>
    <View className="bg-slate-50 rounded-full px-4 flex-row items-center border border-slate-200 h-12">
      <MaterialCommunityIcons name={icon} size={18} color="#059669" />
      <TextInput
        value={value}
        onChangeText={onChange}
        editable={editable}
        placeholder={placeholder}
        keyboardType={keyboardType || 'default'}
        className="flex-1 text-slate-900 font-bold text-sm ml-3"
        placeholderTextColor="#A1A1AA"
      />
    </View>
  </View>
);
