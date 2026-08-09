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
  StatusBar,
  TouchableOpacity,
  View,
  Switch
} from 'react-native';
import Toast from 'react-native-toast-message';
import * as Progress from 'react-native-progress';
import * as SecureStore from 'expo-secure-store';
import { getGoogleIdToken } from '@/utils/googleIdentity';
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
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [deliveryPersonOpen, setDeliveryPersonOpen] = useState(false);
  const [deliveryPersonName, setDeliveryPersonName] = useState('');
  const [deliveryPersonMobile, setDeliveryPersonMobile] = useState('');
  const [deliveryPersonVehicle, setDeliveryPersonVehicle] = useState('bike');
  const [deliveryPersonPin, setDeliveryPersonPin] = useState('');
  const [partnerPinTarget, setPartnerPinTarget] = useState<any>(null);
  const [partnerNewPin, setPartnerNewPin] = useState('');
  const [googleLinkBusy, setGoogleLinkBusy] = useState(false);
  const [docsModalOpen, setDocsModalOpen] = useState(false);

  /* ── Password Reset & Security State ── */
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordStep, setPasswordStep] = useState<'request' | 'verify' | 'newPassword'>('request');
  const [passwordOtp, setPasswordOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState('');

  const resetPasswordModalState = () => {
    setPasswordStep('request');
    setPasswordOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setPasswordSuccessMsg('');
    setShowPasswordText(false);
  };

  const handleRequestPasswordOtp = async () => {
    const targetEmail = storeData?.email;
    if (!targetEmail) {
      Alert.alert("Email Required", "Store email address is missing. Please update your profile first.");
      return;
    }
    try {
      setPasswordBusy(true);
      setPasswordError('');
      setPasswordSuccessMsg('');
      await axios.post(`${BASE_URL}/api/password-reset/request-otp/`, {
        email: targetEmail,
        userType: 'store',
      });
      setPasswordStep('verify');
      setPasswordSuccessMsg(`OTP sent to ${targetEmail} & WhatsApp!`);
    } catch (err: any) {
      setPasswordError(err?.response?.data?.error || "Failed to send OTP. Please verify your email.");
    } finally {
      setPasswordBusy(false);
    }
  };

  const handleVerifyPasswordOtp = async () => {
    const targetEmail = storeData?.email;
    if (!passwordOtp || passwordOtp.trim().length < 4) {
      setPasswordError("Please enter a valid 6-digit OTP code.");
      return;
    }
    try {
      setPasswordBusy(true);
      setPasswordError('');
      setPasswordSuccessMsg('');
      await axios.post(`${BASE_URL}/api/password-reset/verify-otp/`, {
        email: targetEmail,
        otp: passwordOtp.trim(),
        userType: 'store',
      });
      setPasswordStep('newPassword');
      setPasswordSuccessMsg("OTP verified successfully! Please enter your new password.");
    } catch (err: any) {
      setPasswordError(err?.response?.data?.error || "Invalid OTP code. Please check and try again.");
    } finally {
      setPasswordBusy(false);
    }
  };

  const handleConfirmPasswordReset = async () => {
    const targetEmail = storeData?.email;
    if (!newPassword || newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirm password do not match.");
      return;
    }
    try {
      setPasswordBusy(true);
      setPasswordError('');
      setPasswordSuccessMsg('');
      await axios.post(`${BASE_URL}/api/password-reset/confirm/`, {
        email: targetEmail,
        password: newPassword,
        userType: 'store',
      });
      Toast.show({
        type: 'success',
        text1: 'Password Updated',
        text2: 'Your store password has been updated successfully.',
      });
      setPasswordModalOpen(false);
      resetPasswordModalState();
    } catch (err: any) {
      setPasswordError(err?.response?.data?.error || "Failed to update password. Please try again.");
    } finally {
      setPasswordBusy(false);
    }
  };

  const handleGoogleLink = async () => {
    if (!token || googleLinkBusy) return;
    try {
      setGoogleLinkBusy(true);
      const linkTicket = await SecureStore.getItemAsync('googleLinkTicket');
      if (!linkTicket) {
        Alert.alert(
          'Verify your phone first',
          'For security, complete phone OTP once before linking Google.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Verify phone', onPress: () => router.push({ pathname: '/onboarding/phone-login', params: { userType: 'seller' } } as any) },
          ],
        );
        return;
      }
      const idToken = await getGoogleIdToken();
      if (!idToken) return;
      const response = await axios.post(
        `${BASE_URL}/api/store/google/link/`,
        { id_token: idToken, link_ticket: linkTicket },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      await SecureStore.deleteItemAsync('googleLinkTicket');
      Alert.alert('Google linked', `Google sign-in is active for ${response.data.google_email}.`);
      await dispatch(fetchUserProfile());
    } catch (error: any) {
      Alert.alert('Could not link Google', error?.response?.data?.error || error?.message || 'Please try again.');
    } finally {
      setGoogleLinkBusy(false);
    }
  };

  const DEFAULT_DELIVERY_SETTINGS = {
    pickup_enabled: true,
    home_delivery_enabled: true,
    maximum_delivery_radius_km: 10,
    free_delivery_distance_km: 2,
    base_delivery_charge: 30,
    per_km_charge: 10,
    minimum_delivery_charge: 30,
    maximum_delivery_charge: 150,
    default_estimated_delivery_minutes: 30,
    delivery_time_per_km_minutes: 5,
    delivery_message_template: "We deliver orders up to 10 km within 30-45 minutes.",
    delivery_unavailable_message: "Home delivery currently unavailable for this location."
  };

  const fetchDeliveryConfiguration = async () => {
    if (!token) return;
    try {
      const [settingsResponse, peopleResponse] = await Promise.all([
        axios.get(`${BASE_URL}/api/store/delivery-settings/`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${BASE_URL}/api/store/delivery-persons/`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const fetched = settingsResponse.data || {};
      const numOr = (val: any, def: number) => {
        const n = Number(val);
        return (!isNaN(n) && n >= 0) ? n : def;
      };
      setDeliverySettings({
        ...DEFAULT_DELIVERY_SETTINGS,
        ...fetched,
        maximum_delivery_radius_km: numOr(fetched.maximum_delivery_radius_km, 10),
        free_delivery_distance_km: numOr(fetched.free_delivery_distance_km, 2),
        base_delivery_charge: numOr(fetched.base_delivery_charge, 30),
        per_km_charge: numOr(fetched.per_km_charge, 10),
        minimum_delivery_charge: numOr(fetched.minimum_delivery_charge, 30),
        maximum_delivery_charge: numOr(fetched.maximum_delivery_charge, 150),
        default_estimated_delivery_minutes: numOr(fetched.default_estimated_delivery_minutes, 30),
        delivery_time_per_km_minutes: numOr(fetched.delivery_time_per_km_minutes, 5),
      });
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
    if (!token || !deliveryPersonName.trim() || deliveryPersonMobile.replace(/\D/g, '').length < 10 || !/^\d{4,6}$/.test(deliveryPersonPin)) {
      Toast.show({ type: 'error', text1: 'Enter valid details', text2: 'Partner PIN must contain 4–6 digits.', position: 'bottom' });
      return;
    }
    try {
      setDeliveryBusy(true);
      const enteredPin = deliveryPersonPin;
      const response = await axios.post(`${BASE_URL}/api/store/delivery-persons/`, {
        name: deliveryPersonName.trim(),
        mobile: deliveryPersonMobile.trim(),
        vehicle_type: deliveryPersonVehicle,
        is_active: true,
        is_available: true,
        max_concurrent_orders: 100,
        login_pin: deliveryPersonPin,
      }, { headers: { Authorization: `Bearer ${token}` } });
      setDeliveryPersonOpen(false);
      setDeliveryPersonName('');
      setDeliveryPersonMobile('');
      setDeliveryPersonVehicle('bike');
      setDeliveryPersonPin('');
      await fetchDeliveryConfiguration();
      await Share.share({
        title: 'AARX Delivery Partner Login',
        message: `AARX Delivery Partner Login\n\nPartner: ${response.data.name}\nPharmacy: ${storeData?.name || 'Your pharmacy'}\nPartner ID: ${response.data.login_id}\nPIN: ${enteredPin}\n\nOpen AARXUI → Delivery Partner → enter this Partner ID and PIN. Do not share these credentials with anyone else.`,
      });
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

  const deactivateDeliveryPerson = async (person: any) => {
    if (!token) return;
    Alert.alert(
      'Deactivate partner?',
      'Is partner ko inactive kar diya jayega. Active deliveries complete hone ke baad hi safe hota hai.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeliveryBusy(true);
              await axios.delete(`${BASE_URL}/api/store/delivery-persons/${person.id}/`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              Toast.show({
                type: 'success',
                text1: 'Partner deactivated',
                text2: 'Active deliveries complete hone ke baad partner hidden/inactive ho gaya.',
                position: 'bottom',
              });
              await fetchDeliveryConfiguration();
            } catch (error: any) {
              Toast.show({
                type: 'error',
                text1: 'Cannot deactivate now',
                text2: error?.response?.data?.error || 'Active deliveries complete hone ke baad try karein.',
                position: 'bottom',
              });
            } finally {
              setDeliveryBusy(false);
            }
          },
        },
      ],
    );
  };

  const deleteDeliveryPerson = async (person: any) => {
    if (!token) return;
    const hasActiveJobs = Number(person.current_order_count || 0) > 0;
    Alert.alert(
      'Delete delivery partner?',
      hasActiveJobs
        ? 'Is partner ke active jobs hain. Delete block ho sakta hai jab tak delivery complete na ho.'
        : 'Delete karne se partner inactive bhi ho jayega. Ye action reversible nahi hota.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeliveryBusy(true);
              await axios.delete(`${BASE_URL}/api/store/delivery-persons/${person.id}/`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              Toast.show({
                type: 'success',
                text1: 'Partner removed',
                text2: hasActiveJobs
                  ? 'Remove request sent. Active deliveries khatam hone ke baad try karein.'
                  : 'Partner successfully removed.',
                position: 'bottom',
              });
              await fetchDeliveryConfiguration();
            } catch (error: any) {
              Toast.show({
                type: 'error',
                text1: 'Delete blocked',
                text2: error?.response?.data?.error || 'Active deliveries complete hone ke baad delete karein.',
                position: 'bottom',
              });
            } finally {
              setDeliveryBusy(false);
            }
          },
        },
      ],
    );
  };

  const sharePartnerId = async (person: any) => {
    await Share.share({
      title: 'AARX Delivery Partner ID',
      message: `AARX Delivery Partner\nPartner: ${person.name}\nPharmacy: ${storeData?.name || 'Your pharmacy'}\nPartner ID: ${person.login_id}\n\nUse the secure PIN provided separately by the pharmacy owner. Open AARXUI → Delivery Partner to sign in.`,
    });
  };

  const resetAndSharePartnerPin = async () => {
    if (!token || !partnerPinTarget || !/^\d{4,6}$/.test(partnerNewPin)) {
      Toast.show({ type: 'error', text1: 'Enter a 4–6 digit PIN' });
      return;
    }
    try {
      setDeliveryBusy(true);
      const newPin = partnerNewPin;
      const response = await axios.patch(`${BASE_URL}/api/store/delivery-persons/${partnerPinTarget.id}/`, {
        login_pin: newPin,
      }, { headers: { Authorization: `Bearer ${token}` } });
      setPartnerPinTarget(null);
      setPartnerNewPin('');
      await fetchDeliveryConfiguration();
      await Share.share({
        title: 'AARX Delivery Partner Login',
        message: `AARX Delivery Partner Login\n\nPartner: ${response.data.name}\nPharmacy: ${storeData?.name || 'Your pharmacy'}\nPartner ID: ${response.data.login_id}\nPIN: ${newPin}\n\nOpen AARXUI → Delivery Partner and enter these credentials.`,
      });
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'PIN update failed', text2: error?.response?.data?.error || 'Please retry.' });
    } finally {
      setDeliveryBusy(false);
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

      const fileObj = {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || 'application/octet-stream',
      };

      setDocUploadBusy(true);
      const updated = { ...docUpdates, [field]: fileObj };
      setDocUpdates(updated);
      await saveProfile(updated);
      Toast.show({
        type: 'success',
        text1: 'Document Updated',
        text2: `${file.name} saved to store profile.`,
        position: 'bottom'
      });
    } catch (e) {
      console.log('picker error', e);
      Toast.show({
        type: 'error',
        text1: 'Picker Error',
        text2: 'Could not pick the file.',
        position: 'bottom'
      });
    } finally {
      setDocUploadBusy(false);
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

  const saveDocumentUploads = async () => {
    try {
      setDocUploadBusy(true);
      await saveProfile(docUpdates);
      setDocsModalOpen(false);
    } catch (err: any) {
      console.error('Document upload error:', err);
    } finally {
      setDocUploadBusy(false);
    }
  };

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
    <View style={{ flex: 1, backgroundColor: '#F4F8FA' }}>
      {/* ── Enterprise 3D Header Section ── */}
      <View style={{ marginHorizontal: 16, marginTop: 0, marginBottom: 12 }}>
        <View style={{ borderRadius: 22, overflow: 'hidden', elevation: 8, shadowColor: '#123B5D', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.16, shadowRadius: 18 }}>
          <LinearGradient
            colors={["#123B5D", "#184C75", "#0F8B8D"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ position: 'relative', minHeight: 155, overflow: 'hidden', paddingHorizontal: 20, paddingVertical: 18 }}
          >
            {/* 3D Depth Glow Spheres */}
            <View style={{ position: 'absolute', top: -35, left: -35, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255, 255, 255, 0.09)' }} />
            <View style={{ position: 'absolute', bottom: -45, right: 90, width: 130, height: 130, borderRadius: 65, backgroundColor: 'rgba(15, 139, 141, 0.28)' }} />

            {/* 3D Floating Seller Settings Image Asset */}
            <View style={{ position: 'absolute', right: -25, bottom: -24, height: 200, width: 200, alignItems: 'center', justifyContent: 'center' }}>
              <Image
                source={require("../../assets/images/sellersettings.png")}
                style={{ height: '100%', width: '100%' }}
                resizeMode="contain"
              />
            </View>

            <View style={{ minHeight: 120, justifyContent: 'center' }}>
              <View style={{ zIndex: 10, maxWidth: '56%' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 24, fontWeight: '900', color: '#FFFFFF', letterSpacing: 1.5, lineHeight: 30 }} numberOfLines={1}>
                    SETTINGS
                  </Text>
                  <View style={{ marginHorizontal: 10, height: 28, width: 2, borderRadius: 1, backgroundColor: 'rgba(74, 222, 128, 0.7)' }} />
                </View>

                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: 'rgba(255, 255, 255, 0.14)',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.24)',
                  borderRadius: 99,
                  paddingHorizontal: 9,
                  paddingVertical: 4,
                  marginTop: 8,
                  alignSelf: 'flex-start',
                  gap: 4,
                  maxWidth: '100%'
                }}>
                  <MaterialCommunityIcons name="shield-crown-outline" size={12} color="#4ADE80" />
                  <Text style={{ fontSize: 8.5, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.7, color: '#FFFFFF' }} numberOfLines={1} ellipsizeMode="tail">
                    STORE CONTROL & GOVERNANCE
                  </Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 160 }}
      >

        {/* ── Enterprise Store Identity Trigger Card ── */}
        {storeData ? (
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => setEditOpen(true)}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 20,
              borderWidth: 1,
              borderColor: '#B9DDE0',
              marginBottom: 16,
              padding: 16,
              elevation: 4,
              shadowColor: '#123B5D',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.08,
              shadowRadius: 10
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0, paddingRight: 10 }}>
                <View style={{ position: 'relative', width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <Progress.Circle
                    size={44}
                    progress={(storeData?.profile_completion_percent || 0) / 100}
                    showsText={false}
                    color="#0F8B8D"
                    thickness={3}
                    unfilledColor="#E8F4F5"
                    borderWidth={0}
                  />
                  <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#E8F4F5', borderWidth: 1, borderColor: '#B9DDE0', alignItems: 'center', justifyContent: 'center' }}>
                      <MaterialCommunityIcons name="storefront-outline" size={20} color="#123B5D" />
                    </View>
                  </View>
                </View>
                <View style={{ marginLeft: 12, flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 15, fontWeight: '900', color: '#102A43' }} numberOfLines={1}>{storeData.name}</Text>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: storeData.is_verified ? '#16A34A' : '#F59E0B', marginLeft: 6 }} />
                  </View>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#627D98', marginTop: 2 }} numberOfLines={1}>
                    {storeData.owner_name || "Owner pending"} • {storeData?.address || "Address pending"}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#123B5D', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 }}>
                <Text style={{ fontSize: 9.5, fontWeight: '900', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: 0.8 }}>Edit Profile</Text>
                <Feather name="chevron-right" size={14} color="#4ADE80" style={{ marginLeft: 4 }} />
              </View>
            </View>

            {/* Quick Status Pills */}
            <View style={{ marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E8F4F5' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F4F5', borderRadius: 99, paddingHorizontal: 9, paddingVertical: 3.5, borderWidth: 1, borderColor: '#B9DDE0' }}>
                <MaterialCommunityIcons
                  name={storeData.is_verified ? "check-decagram" : "shield-alert-outline"}
                  size={11}
                  color={storeData.is_verified ? "#16A34A" : "#F59E0B"}
                />
                <Text style={{ fontSize: 8.5, fontWeight: '900', color: '#102A43', marginLeft: 4 }}>
                  {storeData.is_verified ? "Verified Store" : "Unverified Store"}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F4F5', borderRadius: 99, paddingHorizontal: 9, paddingVertical: 3.5, borderWidth: 1, borderColor: '#B9DDE0' }}>
                <MaterialCommunityIcons name="progress-check" size={11} color="#0F8B8D" />
                <Text style={{ fontSize: 8.5, fontWeight: '900', color: '#102A43', marginLeft: 4 }}>
                  {storeData?.profile_completion_percent || 0}% Complete
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F4F5', borderRadius: 99, paddingHorizontal: 9, paddingVertical: 3.5, borderWidth: 1, borderColor: '#B9DDE0' }}>
                <MaterialCommunityIcons name="phone-outline" size={11} color="#123B5D" />
                <Text style={{ fontSize: 8.5, fontWeight: '900', color: '#102A43', marginLeft: 4 }}>
                  {storeData.mobile || "No Mobile"}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F4F5', borderRadius: 99, paddingHorizontal: 9, paddingVertical: 3.5, borderWidth: 1, borderColor: '#B9DDE0' }}>
                <MaterialCommunityIcons name="file-document-outline" size={11} color="#0F8B8D" />
                <Text style={{ fontSize: 8.5, fontWeight: '900', color: '#102A43', marginLeft: 4 }}>
                  GST: {storeData?.gst_number ? "Added" : "Pending"}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
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

        {/* ── Enterprise Delivery & Pickup Settings Trigger Card ── */}
        {storeData && deliverySettings && (
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => setDeliveryModalOpen(true)}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 20,
              borderWidth: 1,
              borderColor: '#B9DDE0',
              marginBottom: 16,
              padding: 16,
              elevation: 4,
              shadowColor: '#123B5D',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.08,
              shadowRadius: 10
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0, paddingRight: 10 }}>
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#E8F4F5', borderWidth: 1, borderColor: '#B9DDE0', alignItems: 'center', justifyContent: 'center' }}>
                  <MaterialCommunityIcons name="truck-delivery-outline" size={24} color="#0F8B8D" />
                </View>
                <View style={{ marginLeft: 12, flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 15, fontWeight: '900', color: '#102A43' }}>Delivery & Pickup Settings</Text>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#16A34A', marginLeft: 8 }} />
                  </View>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#627D98', marginTop: 2 }} numberOfLines={1}>
                    Configure rates, delivery radius, ETA & riders
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#123B5D', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 }}>
                <Text style={{ fontSize: 9.5, fontWeight: '900', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: 0.8 }}>Configure</Text>
                <Feather name="chevron-right" size={14} color="#4ADE80" style={{ marginLeft: 4 }} />
              </View>
            </View>

            {/* Quick Status Pills */}
            <View style={{ marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E8F4F5' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F4F5', borderRadius: 99, paddingHorizontal: 9, paddingVertical: 3.5, borderWidth: 1, borderColor: '#B9DDE0' }}>
                <MaterialCommunityIcons name={deliverySettings.home_delivery_enabled ? "check-circle-outline" : "close-circle-outline"} size={11} color={deliverySettings.home_delivery_enabled ? "#16A34A" : "#627D98"} />
                <Text style={{ fontSize: 8.5, fontWeight: '900', color: '#102A43', marginLeft: 4 }}>
                  {deliverySettings.home_delivery_enabled ? "Home Delivery Active" : "Home Delivery Off"}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F4F5', borderRadius: 99, paddingHorizontal: 9, paddingVertical: 3.5, borderWidth: 1, borderColor: '#B9DDE0' }}>
                <MaterialCommunityIcons name="storefront-outline" size={11} color="#0F8B8D" />
                <Text style={{ fontSize: 8.5, fontWeight: '900', color: '#102A43', marginLeft: 4 }}>
                  {deliverySettings.pickup_enabled ? "Store Pickup Active" : "Pickup Off"}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F4F5', borderRadius: 99, paddingHorizontal: 9, paddingVertical: 3.5, borderWidth: 1, borderColor: '#B9DDE0' }}>
                <MaterialCommunityIcons name="map-marker-distance" size={11} color="#123B5D" />
                <Text style={{ fontSize: 8.5, fontWeight: '900', color: '#102A43', marginLeft: 4 }}>
                  {deliverySettings.maximum_delivery_radius_km || 10} km Radius
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F4F5', borderRadius: 99, paddingHorizontal: 9, paddingVertical: 3.5, borderWidth: 1, borderColor: '#B9DDE0' }}>
                <MaterialCommunityIcons name="moped" size={11} color="#0F8B8D" />
                <Text style={{ fontSize: 8.5, fontWeight: '900', color: '#102A43', marginLeft: 4 }}>
                  {deliveryPeople.length} Riders
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* ── Enterprise Account Security & Password Trigger Card ── */}
        {storeData && (
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => {
              resetPasswordModalState();
              setPasswordModalOpen(true);
            }}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 20,
              borderWidth: 1,
              borderColor: '#B9DDE0',
              marginBottom: 16,
              padding: 16,
              elevation: 4,
              shadowColor: '#123B5D',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.08,
              shadowRadius: 10
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0, paddingRight: 10 }}>
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#E8F4F5', borderWidth: 1, borderColor: '#B9DDE0', alignItems: 'center', justifyContent: 'center' }}>
                  <MaterialCommunityIcons name="shield-lock-outline" size={24} color="#0F8B8D" />
                </View>
                <View style={{ marginLeft: 12, flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 15, fontWeight: '900', color: '#102A43' }}>Account Security & Password</Text>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#16A34A', marginLeft: 8 }} />
                  </View>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#627D98', marginTop: 2 }} numberOfLines={1}>
                    <Text>{storeData.email || 'Email missing'}</Text>
                    <Text> • Password protected</Text>
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#123B5D', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 }}>
                <Text style={{ fontSize: 9.5, fontWeight: '900', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: 0.8 }}>Change</Text>
                <Feather name="chevron-right" size={14} color="#4ADE80" style={{ marginLeft: 4 }} />
              </View>
            </View>

            {/* Quick Status Pills */}
            <View style={{ marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E8F4F5' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F4F5', borderRadius: 99, paddingHorizontal: 9, paddingVertical: 3.5, borderWidth: 1, borderColor: '#B9DDE0' }}>
                <MaterialCommunityIcons name="lock-check-outline" size={11} color="#16A34A" />
                <Text style={{ fontSize: 8.5, fontWeight: '900', color: '#102A43', marginLeft: 4 }}>
                  Password Set
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F4F5', borderRadius: 99, paddingHorizontal: 9, paddingVertical: 3.5, borderWidth: 1, borderColor: '#B9DDE0' }}>
                <MaterialCommunityIcons name="email-check-outline" size={11} color="#0F8B8D" />
                <Text style={{ fontSize: 8.5, fontWeight: '900', color: '#102A43', marginLeft: 4 }}>
                  Email OTP Auth
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F4F5', borderRadius: 99, paddingHorizontal: 9, paddingVertical: 3.5, borderWidth: 1, borderColor: '#B9DDE0' }}>
                <MaterialCommunityIcons name="whatsapp" size={11} color="#25D366" />
                <Text style={{ fontSize: 8.5, fontWeight: '900', color: '#102A43', marginLeft: 4 }}>
                  WhatsApp OTP Active
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* ── Enterprise Store Documents & Verification Trigger Card ── */}
        {storeData && (
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => setDocsModalOpen(true)}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 20,
              borderWidth: 1,
              borderColor: '#B9DDE0',
              marginBottom: 16,
              padding: 16,
              elevation: 4,
              shadowColor: '#123B5D',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.08,
              shadowRadius: 10
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0, paddingRight: 10 }}>
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#E8F4F5', borderWidth: 1, borderColor: '#B9DDE0', alignItems: 'center', justifyContent: 'center' }}>
                  <MaterialCommunityIcons name="file-document-multiple-outline" size={24} color="#0F8B8D" />
                </View>
                <View style={{ marginLeft: 12, flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 15, fontWeight: '900', color: '#102A43' }}>Store Verification Documents</Text>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#16A34A', marginLeft: 8 }} />
                  </View>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#627D98', marginTop: 2 }} numberOfLines={1}>
                    Licenses, Owner ID Proofs & Premises Photos
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#123B5D', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 }}>
                <Text style={{ fontSize: 9.5, fontWeight: '900', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: 0.8 }}>Manage</Text>
                <Feather name="chevron-right" size={14} color="#4ADE80" style={{ marginLeft: 4 }} />
              </View>
            </View>

            {/* Quick Status Pills */}
            <View style={{ marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E8F4F5' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F4F5', borderRadius: 99, paddingHorizontal: 9, paddingVertical: 3.5, borderWidth: 1, borderColor: '#B9DDE0' }}>
                <MaterialCommunityIcons name={(storeData as any)?.store_license_document ? "file-check-outline" : "file-clock-outline"} size={11} color={(storeData as any)?.store_license_document ? "#16A34A" : "#D97706"} />
                <Text style={{ fontSize: 8.5, fontWeight: '900', color: '#102A43', marginLeft: 4 }}>
                  <Text>License: </Text>
                  <Text>{(storeData as any)?.store_license_document ? "Uploaded" : "Pending"}</Text>
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F4F5', borderRadius: 99, paddingHorizontal: 9, paddingVertical: 3.5, borderWidth: 1, borderColor: '#B9DDE0' }}>
                <MaterialCommunityIcons name={(storeData as any)?.owner_id_proof ? "card-account-details-outline" : "card-search-outline"} size={11} color={(storeData as any)?.owner_id_proof ? "#16A34A" : "#D97706"} />
                <Text style={{ fontSize: 8.5, fontWeight: '900', color: '#102A43', marginLeft: 4 }}>
                  <Text>Owner ID: </Text>
                  <Text>{(storeData as any)?.owner_id_proof ? "Uploaded" : "Pending"}</Text>
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F4F5', borderRadius: 99, paddingHorizontal: 9, paddingVertical: 3.5, borderWidth: 1, borderColor: '#B9DDE0' }}>
                <MaterialCommunityIcons name={(storeData as any)?.store_image ? "image-outline" : "image-off-outline"} size={11} color={(storeData as any)?.store_image ? "#16A34A" : "#D97706"} />
                <Text style={{ fontSize: 8.5, fontWeight: '900', color: '#102A43', marginLeft: 4 }}>
                  <Text>Store Photo: </Text>
                  <Text>{(storeData as any)?.store_image ? "Uploaded" : "Pending"}</Text>
                </Text>
              </View>
            </View>
          </TouchableOpacity>
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
                  icon="google"
                  title="Google Sign-In"
                  subtitle={googleLinkBusy
                    ? 'Linking Google account…'
                    : storeData.google_linked_at
                      ? storeData.google_email || 'Google account linked'
                      : 'Link Google for faster seller login'}
                  value={storeData.google_linked_at ? 'Linked' : 'Link'}
                  onPress={storeData.google_linked_at || googleLinkBusy ? undefined : handleGoogleLink}
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
            <Text className="mb-5 mt-1 text-[10px] font-bold text-slate-400">Save करने पर Partner ID automatically बनेगा और ID + PIN share sheet खुलेगी।</Text>
            <TextInput value={deliveryPersonName} onChangeText={setDeliveryPersonName} placeholder="Full name" className="mb-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 font-bold" />
            <TextInput value={deliveryPersonMobile} onChangeText={setDeliveryPersonMobile} placeholder="Mobile number" keyboardType="phone-pad" className="mb-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 font-bold" />
            <TextInput value={deliveryPersonPin} onChangeText={setDeliveryPersonPin} placeholder="Login PIN (4–6 digits)" keyboardType="number-pad" secureTextEntry maxLength={6} className="mb-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 font-bold" />
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

      {/* ── ENTERPRISE DELIVERY & PICKUP FULFILMENT MODAL SHEET ── */}
      <Modal
        visible={deliveryModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setDeliveryModalOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '92%', overflow: 'hidden', borderWidth: 1, borderColor: '#B9DDE0' }}>
            {/* Modal Header */}
            <LinearGradient colors={['#123B5D', '#184C75', '#0F8B8D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 10 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255, 255, 255, 0.14)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.25)', alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialCommunityIcons name="truck-delivery-outline" size={22} color="#4ADE80" />
                  </View>
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.5 }}>Delivery & Pickup Logistics</Text>
                    <Text style={{ fontSize: 8.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2, color: 'rgba(255, 255, 255, 0.75)' }}>Rates, Radius, ETA & Rider Management</Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => setDeliveryModalOpen(false)}
                  style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255, 255, 255, 0.15)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.25)', alignItems: 'center', justifyContent: 'center' }}
                >
                  <AntDesign name="close" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </LinearGradient>

            {/* Modal Body ScrollView */}
            {deliverySettings && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
                {/* Toggles */}
                {[
                  ['pickup_enabled', 'Store Pickup', 'Customers can collect orders directly at your pharmacy counter'],
                  ['home_delivery_enabled', 'Home Delivery', 'Offer fast doorstep delivery within your configured radius'],
                ].map(([field, title, subtitle]) => (
                  <View key={field} style={{ marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 16, borderWidth: 1, borderColor: '#B9DDE0', backgroundColor: '#E8F4F5', padding: 14 }}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={{ fontSize: 13, fontWeight: '900', color: '#102A43' }}>{title}</Text>
                      <Text style={{ marginTop: 2, fontSize: 10, fontWeight: '600', color: '#627D98' }}>{subtitle}</Text>
                    </View>
                    <Switch
                      value={Boolean(deliverySettings[field])}
                      onValueChange={(value) => updateDeliveryField(field, value)}
                      trackColor={{ false: '#B9DDE0', true: '#0F8B8D' }}
                      thumbColor="#FFFFFF"
                    />
                  </View>
                ))}

                {/* 8 Rates Grid */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 6 }}>
                  {[
                    ['maximum_delivery_radius_km', 'Max Radius (km)', 'Doorstep delivery limit', '10'],
                    ['free_delivery_distance_km', 'Free Distance (km)', '₹0 fee up to this distance', '2'],
                    ['base_delivery_charge', 'Base Charge (₹)', 'Standard base delivery fee', '30'],
                    ['per_km_charge', 'Per km Charge (₹)', 'Extra fee per km beyond free', '10'],
                    ['minimum_delivery_charge', 'Min Charge (₹)', 'Lowest delivery fee charged', '30'],
                    ['maximum_delivery_charge', 'Max Charge (₹)', 'Cap on maximum delivery fee', '150'],
                    ['default_estimated_delivery_minutes', 'Base ETA (mins)', 'Store prep & dispatch time', '30'],
                    ['delivery_time_per_km_minutes', 'Mins Per km', 'Rider travel time per km', '5'],
                  ].map(([field, label, hint, defaultVal]) => (
                    <View key={field} style={{ width: '48%', marginBottom: 12, borderRadius: 16, borderWidth: 1, borderColor: '#B9DDE0', backgroundColor: '#F4F8FA', paddingHorizontal: 12, paddingVertical: 10 }}>
                      <Text style={{ fontSize: 9, fontWeight: '900', color: '#102A43' }}>{label}</Text>
                      <Text style={{ fontSize: 7.5, fontWeight: '700', color: '#627D98', marginTop: 1, height: 20 }} numberOfLines={2}>{hint}</Text>
                      <TextInput
                        value={String(
                          deliverySettings[field] !== undefined &&
                            deliverySettings[field] !== null &&
                            deliverySettings[field] !== '' &&
                            Number(deliverySettings[field]) > 0
                            ? deliverySettings[field]
                            : defaultVal
                        )}
                        onChangeText={(value) => updateDeliveryField(field, field === 'maximum_delivery_charge' && value.trim() === '' ? null : value)}
                        placeholder={defaultVal}
                        placeholderTextColor="#94A3B8"
                        keyboardType="decimal-pad"
                        style={{ marginTop: 6, fontSize: 14, fontWeight: '900', color: '#123B5D', backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#B9DDE0', paddingHorizontal: 10, paddingVertical: 6 }}
                      />
                    </View>
                  ))}
                </View>

                {/* Messages */}
                <Text style={{ marginBottom: 6, marginTop: 6, fontSize: 8.5, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2, color: '#627D98' }}>Customer Delivery Message</Text>
                <TextInput
                  value={deliverySettings.delivery_message_template || ''}
                  onChangeText={(value) => updateDeliveryField('delivery_message_template', value)}
                  multiline
                  style={{ marginBottom: 14, minHeight: 60, borderRadius: 14, borderWidth: 1, borderColor: '#B9DDE0', backgroundColor: '#F4F8FA', padding: 12, fontSize: 12, fontWeight: '700', color: '#102A43' }}
                />
                <Text style={{ marginBottom: 6, fontSize: 8.5, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2, color: '#627D98' }}>Default Unavailable Message</Text>
                <TextInput
                  value={deliverySettings.delivery_unavailable_message || ''}
                  onChangeText={(value) => updateDeliveryField('delivery_unavailable_message', value)}
                  multiline
                  style={{ marginBottom: 16, minHeight: 60, borderRadius: 14, borderWidth: 1, borderColor: '#B9DDE0', backgroundColor: '#F4F8FA', padding: 12, fontSize: 12, fontWeight: '700', color: '#102A43' }}
                />

                {/* Delivery Team */}
                <View style={{ marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, color: '#102A43' }}>Delivery Team & Riders</Text>
                  <TouchableOpacity onPress={() => setDeliveryPersonOpen(true)} style={{ borderRadius: 10, backgroundColor: '#123B5D', paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#0F8B8D' }}>
                    <Text style={{ fontSize: 8.5, fontWeight: '900', textTransform: 'uppercase', color: '#FFFFFF', letterSpacing: 0.8 }}>+ Add Rider</Text>
                  </TouchableOpacity>
                </View>
                {deliveryPeople.length === 0 ? (
                  <View style={{ borderRadius: 14, backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#F59E0B', padding: 12 }}>
                    <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#92400E', lineHeight: 15 }}>No delivery person registered. Orders can still be quoted, but assign staff before dispatch.</Text>
                  </View>
                ) : deliveryPeople.map(person => (
                  <View key={person.id} style={{ marginBottom: 10, flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, borderColor: '#B9DDE0', backgroundColor: '#E8F4F5', padding: 12 }}>
                    <View style={{ width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#B9DDE0' }}>
                      <MaterialCommunityIcons name="moped" size={22} color="#0F8B8D" />
                    </View>
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '900', color: '#102A43' }}>{person.name}</Text>
                      <Text style={{ fontSize: 9.5, fontWeight: '700', textTransform: 'uppercase', color: '#627D98', marginTop: 1 }}>{person.vehicle_type} • {person.current_order_count}/{person.max_concurrent_orders} orders</Text>
                      <Text selectable style={{ marginTop: 2, fontSize: 8.5, fontWeight: '900', color: '#123B5D' }}>PARTNER ID: {person.login_id}</Text>
                    </View>
                    <View style={{ marginLeft: 8, alignItems: 'flex-end' }}>
                      <Switch value={Boolean(person.is_available)} onValueChange={() => toggleDeliveryPerson(person)} disabled={!person.is_active} trackColor={{ false: '#B9DDE0', true: '#0F8B8D' }} thumbColor="#FFFFFF" />
                      <TouchableOpacity onPress={() => sharePartnerId(person)} style={{ marginTop: 4, flexDirection: 'row', alignItems: 'center', borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#B9DDE0', paddingHorizontal: 8, paddingVertical: 3 }}>
                        <MaterialCommunityIcons name="share-variant-outline" size={11} color="#123B5D" />
                        <Text style={{ marginLeft: 4, fontSize: 7.5, fontWeight: '900', textTransform: 'uppercase', color: '#123B5D' }}>Share ID</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => { setPartnerPinTarget(person); setPartnerNewPin(''); }} style={{ marginTop: 3, flexDirection: 'row', alignItems: 'center', borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#B9DDE0', paddingHorizontal: 8, paddingVertical: 3 }}>
                        <MaterialCommunityIcons name="key-variant" size={11} color="#0F8B8D" />
                        <Text style={{ marginLeft: 4, fontSize: 7.5, fontWeight: '900', textTransform: 'uppercase', color: '#0F8B8D' }}>Set PIN</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => deactivateDeliveryPerson(person)} style={{ marginTop: 3, flexDirection: 'row', alignItems: 'center', borderRadius: 8, backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#F59E0B', paddingHorizontal: 8, paddingVertical: 3 }}>
                        <MaterialCommunityIcons name="pause-circle-outline" size={11} color="#B45309" />
                        <Text style={{ marginLeft: 4, fontSize: 7.5, fontWeight: '900', textTransform: 'uppercase', color: '#B45309' }}>Deactivate</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => deleteDeliveryPerson(person)} style={{ marginTop: 3, flexDirection: 'row', alignItems: 'center', borderRadius: 8, backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#DC2626', paddingHorizontal: 8, paddingVertical: 3 }}>
                        <MaterialCommunityIcons name="delete-outline" size={11} color="#DC2626" />
                        <Text style={{ marginLeft: 4, fontSize: 7.5, fontWeight: '900', textTransform: 'uppercase', color: '#DC2626' }}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}

                {/* Save CTA Bar */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={async () => {
                    await saveDeliveryConfiguration();
                    setDeliveryModalOpen(false);
                  }}
                  disabled={deliveryBusy}
                  style={{
                    marginTop: 16,
                    backgroundColor: '#123B5D',
                    borderRadius: 16,
                    paddingVertical: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: '#0F8B8D',
                    elevation: 3
                  }}
                >
                  {deliveryBusy ? (
                    <ActivityIndicator color="#4ADE80" />
                  ) : (
                    <>
                      <Feather name="check-circle" size={18} color="#4ADE80" />
                      <Text style={{ marginLeft: 8, fontSize: 12, fontWeight: '900', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: 1 }}>
                        Save Delivery Settings
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            )}
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
      {/* ── ENTERPRISE STORE IDENTITY & PROFILE MODAL SHEET ── */}
      <Modal
        visible={editOpen}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!editBusy) {
            setEditOpen(false);
            fetchProfile();
          }
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '92%', overflow: 'hidden', borderWidth: 1, borderColor: '#B9DDE0' }}>
            {/* Modal Header */}
            <LinearGradient colors={['#123B5D', '#184C75', '#0F8B8D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 10 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255, 255, 255, 0.14)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.25)', alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialCommunityIcons name="storefront-outline" size={22} color="#4ADE80" />
                  </View>
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.5 }}>Store Identity & Profile</Text>
                    <Text style={{ fontSize: 8.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2, color: 'rgba(255, 255, 255, 0.75)' }}>Official store details, contact & compliance licenses</Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => {
                    setEditOpen(false);
                    fetchProfile();
                  }}
                  disabled={editBusy}
                  style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255, 255, 255, 0.15)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.25)', alignItems: 'center', justifyContent: 'center' }}
                >
                  <AntDesign name="close" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </LinearGradient>

            {/* Modal ScrollView Body */}
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
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

              <View style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2, color: '#627D98', marginBottom: 6, marginLeft: 4 }}>Store Address</Text>
                <View style={{ backgroundColor: '#F4F8FA', borderRadius: 16, borderWidth: 1, borderColor: '#B9DDE0', position: 'relative', overflow: 'hidden' }}>
                  <View style={{ position: 'absolute', top: 14, left: 14, zIndex: 10 }}>
                    <MaterialCommunityIcons name="map-marker-outline" size={18} color="#0F8B8D" />
                  </View>
                  <TextInput
                    value={address}
                    onChangeText={setAddress}
                    editable={!editBusy}
                    placeholder="Complete store address"
                    multiline
                    style={{ padding: 14, paddingLeft: 42, color: '#102A43', fontWeight: '700', minHeight: 78, fontSize: 13 }}
                    placeholderTextColor="#94A3B8"
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

              <View style={{ backgroundColor: '#E8F4F5', borderRadius: 16, borderWidth: 1, borderColor: '#B9DDE0', padding: 14, marginBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 12 }}>
                  <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#B9DDE0', alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialCommunityIcons name="flash-outline" size={20} color="#0F8B8D" />
                  </View>
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '900', color: '#102A43' }}>Auto Accept Prescriptions</Text>
                    <Text style={{ fontSize: 9.5, fontWeight: '600', color: '#627D98', marginTop: 1 }}>Emergency mode prescriptions automatically route to your store.</Text>
                  </View>
                </View>
                <Switch
                  value={autoAccept}
                  onValueChange={setAutoAccept}
                  disabled={editBusy}
                  trackColor={{ false: '#B9DDE0', true: '#0F8B8D' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {/* Save CTA Button */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={saveProfile}
                disabled={!isFormValid || editBusy}
                style={{
                  backgroundColor: !isFormValid ? '#CBD5E1' : '#123B5D',
                  borderRadius: 16,
                  paddingVertical: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: !isFormValid ? '#CBD5E1' : '#0F8B8D',
                  elevation: 3
                }}
              >
                {editBusy ? (
                  <ActivityIndicator color="#4ADE80" />
                ) : (
                  <>
                    <Feather name="check-circle" size={18} color={!isFormValid ? '#94A3B8' : '#4ADE80'} />
                    <Text style={{ marginLeft: 8, fontSize: 12, fontWeight: '900', color: !isFormValid ? '#64748B' : '#FFFFFF', textTransform: 'uppercase', letterSpacing: 1 }}>
                      Save Store Profile
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── ENTERPRISE STORE VERIFICATION DOCUMENTS MODAL SHEET ── */}
      <Modal
        visible={docsModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!docUploadBusy) setDocsModalOpen(false);
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '88%', overflow: 'hidden', borderWidth: 1, borderColor: '#B9DDE0' }}>
            {/* Modal Header */}
            <LinearGradient colors={['#123B5D', '#184C75', '#0F8B8D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 10 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255, 255, 255, 0.14)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.25)', alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialCommunityIcons name="file-document-multiple-outline" size={22} color="#4ADE80" />
                  </View>
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.5 }}>Store Verification Documents</Text>
                    <Text style={{ fontSize: 8.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2, color: 'rgba(255, 255, 255, 0.75)' }}>Licenses, Owner ID Proofs & Premises Photos</Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => setDocsModalOpen(false)}
                  disabled={docUploadBusy}
                  style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255, 255, 255, 0.15)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.25)', alignItems: 'center', justifyContent: 'center' }}
                >
                  <AntDesign name="close" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </LinearGradient>

            {/* Modal Body ScrollView */}
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
              <View style={{ backgroundColor: '#E8F4F5', borderRadius: 16, borderWidth: 1, borderColor: '#B9DDE0', padding: 14, marginBottom: 16, flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="information-outline" size={20} color="#0F8B8D" />
                <Text style={{ marginLeft: 10, flex: 1, fontSize: 11, fontWeight: '600', color: '#102A43', lineHeight: 16 }}>
                  Tap any document to view or upload a new file. Long-press an existing document to replace it.
                </Text>
              </View>

              {[
                { label: 'Store License Document', subLabel: 'Drug license or Trade registration certificate', field: 'store_license_document', icon: 'certificate-outline' },
                { label: 'Owner ID Proof', subLabel: 'Aadhaar, PAN or Government photo identity', field: 'owner_id_proof', icon: 'card-account-details-outline' },
                { label: 'Store Premises Photo', subLabel: 'Clear front view of pharmacy & storefront', field: 'store_image', icon: 'storefront-outline' },
              ].map(({ label, subLabel, field, icon }, i) => {
                const url = (storeData as any)?.[field];
                const newFile = docUpdates[field];
                const isImage = (url || newFile?.uri) ? /\.(png|jpe?g|jpg)$/i.test(url || newFile?.name) : false;

                const rowPress = () => {
                  if (url) setPreviewUrl(url);
                  else pickFileForField(field);
                };

                const rowLongPress = () => {
                  pickFileForField(field);
                };

                return (
                  <View
                    key={field}
                    style={{
                      backgroundColor: '#F4F8FA',
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: '#B9DDE0',
                      padding: 16,
                      marginBottom: 12,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 8 }}>
                        <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: url || newFile ? '#E8F4F5' : '#FFFFFF', borderWidth: 1, borderColor: url || newFile ? '#B9DDE0' : '#CBD5E1', alignItems: 'center', justifyContent: 'center' }}>
                          <MaterialCommunityIcons name={icon as any} size={22} color={url || newFile ? '#0F8B8D' : '#64748B'} />
                        </View>
                        <View style={{ marginLeft: 12, flex: 1 }}>
                          <Text style={{ fontSize: 13.5, fontWeight: '900', color: '#102A43' }}>{label}</Text>
                          <Text style={{ fontSize: 10, fontWeight: '600', color: '#627D98', marginTop: 2 }}>{subLabel}</Text>
                          {newFile ? (
                            <Text style={{ fontSize: 10, fontWeight: '800', color: '#0F8B8D', marginTop: 4 }}>
                              <Text>Selected: </Text>
                              <Text>{newFile.name}</Text>
                            </Text>
                          ) : null}
                        </View>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <TouchableOpacity
                          onPress={rowPress}
                          onLongPress={rowLongPress}
                          disabled={docUploadBusy || loading}
                          style={{
                            backgroundColor: url ? '#123B5D' : '#0F8B8D',
                            borderRadius: 10,
                            paddingHorizontal: 12,
                            paddingVertical: 7,
                            flexDirection: 'row',
                            alignItems: 'center'
                          }}
                        >
                          <MaterialCommunityIcons name={url ? "eye-outline" : "upload-outline"} size={14} color="#FFFFFF" />
                          <Text style={{ marginLeft: 4, fontSize: 10, fontWeight: '900', color: '#FFFFFF', textTransform: 'uppercase' }}>
                            {url ? "View" : "Upload"}
                          </Text>
                        </TouchableOpacity>

                        {url && !newFile && (
                          <TouchableOpacity
                            onPress={() => {
                              setDeleteField(field);
                              setDeleteVisible(true);
                            }}
                            disabled={docUploadBusy || loading}
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 10,
                              backgroundColor: '#FEF2F2',
                              borderWidth: 1,
                              borderColor: '#FCA5A5',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <Feather name="trash-2" size={14} color="#DC2626" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}

              {/* Upload Pending Files Button */}
              {Object.keys(docUpdates).length > 0 && (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={saveDocumentUploads}
                  disabled={docUploadBusy}
                  style={{
                    backgroundColor: '#123B5D',
                    borderRadius: 16,
                    paddingVertical: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: '#0F8B8D',
                    marginTop: 8,
                    elevation: 3
                  }}
                >
                  {docUploadBusy ? (
                    <ActivityIndicator color="#4ADE80" />
                  ) : (
                    <>
                      <Feather name="upload-cloud" size={18} color="#4ADE80" />
                      <Text style={{ marginLeft: 8, fontSize: 12, fontWeight: '900', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: 1 }}>
                        Upload Selected Documents
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── ENTERPRISE ACCOUNT SECURITY & CHANGE PASSWORD MODAL SHEET ── */}
      <Modal
        visible={passwordModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!passwordBusy) {
            setPasswordModalOpen(false);
            resetPasswordModalState();
          }
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '92%', overflow: 'hidden', borderWidth: 1, borderColor: '#B9DDE0' }}>
            {/* Header */}
            <LinearGradient colors={['#123B5D', '#184C75', '#0F8B8D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 10 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255, 255, 255, 0.14)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.25)', alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialCommunityIcons name="shield-lock-outline" size={22} color="#4ADE80" />
                  </View>
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.5 }}>Change Account Password</Text>
                    <Text style={{ fontSize: 8.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2, color: 'rgba(255, 255, 255, 0.75)' }}>
                      {passwordStep === 'request' ? 'Step 1 of 3: Verification OTP' : passwordStep === 'verify' ? 'Step 2 of 3: Confirm OTP Code' : 'Step 3 of 3: Set New Password'}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => {
                    setPasswordModalOpen(false);
                    resetPasswordModalState();
                  }}
                  disabled={passwordBusy}
                  style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255, 255, 255, 0.15)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.25)', alignItems: 'center', justifyContent: 'center' }}
                >
                  <AntDesign name="close" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </LinearGradient>

            {/* Scrollable Content */}
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
              {/* Status & Error Messages */}
              {passwordError ? (
                <View style={{ backgroundColor: '#FEE2E2', borderRadius: 14, borderWidth: 1, borderColor: '#FCA5A5', padding: 12, marginBottom: 14, flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#DC2626" />
                  <Text style={{ marginLeft: 8, fontSize: 11.5, fontWeight: '700', color: '#B91C1C', flex: 1 }}>{passwordError}</Text>
                </View>
              ) : null}

              {passwordSuccessMsg ? (
                <View style={{ backgroundColor: '#DCFCE7', borderRadius: 14, borderWidth: 1, borderColor: '#86EFAC', padding: 12, marginBottom: 14, flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialCommunityIcons name="check-circle-outline" size={18} color="#16A34A" />
                  <Text style={{ marginLeft: 8, fontSize: 11.5, fontWeight: '700', color: '#15803D', flex: 1 }}>{passwordSuccessMsg}</Text>
                </View>
              ) : null}

              {/* STEP 1: REQUEST OTP */}
              {passwordStep === 'request' && (
                <View>
                  <View style={{ backgroundColor: '#E8F4F5', borderRadius: 16, borderWidth: 1, borderColor: '#B9DDE0', padding: 16, marginBottom: 16 }}>
                    <Text style={{ fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2, color: '#627D98', marginBottom: 8 }}>Target Store Account</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                      <MaterialCommunityIcons name="email-outline" size={16} color="#0F8B8D" />
                      <Text style={{ marginLeft: 8, fontSize: 13, fontWeight: '900', color: '#102A43' }}>{storeData?.email || 'No email attached'}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <MaterialCommunityIcons name="phone-outline" size={16} color="#123B5D" />
                      <Text style={{ marginLeft: 8, fontSize: 12, fontWeight: '700', color: '#627D98' }}>{storeData?.mobile || 'No mobile attached'}</Text>
                    </View>
                    <Text style={{ marginTop: 10, fontSize: 10, fontWeight: '600', color: '#627D98', lineHeight: 14 }}>
                      Safety Notice: Pressing the button below will dispatch a 6-digit Security OTP to your email (via Brevo / SMTP) and WhatsApp number.
                    </Text>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleRequestPasswordOtp}
                    disabled={passwordBusy}
                    style={{
                      backgroundColor: '#123B5D',
                      borderRadius: 16,
                      paddingVertical: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: '#0F8B8D',
                      elevation: 3
                    }}
                  >
                    {passwordBusy ? (
                      <ActivityIndicator color="#4ADE80" />
                    ) : (
                      <>
                        <Feather name="send" size={16} color="#4ADE80" />
                        <Text style={{ marginLeft: 8, fontSize: 12, fontWeight: '900', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: 1 }}>
                          Send Verification OTP
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {/* STEP 2: VERIFY OTP */}
              {passwordStep === 'verify' && (
                <View>
                  <Text style={{ fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2, color: '#627D98', marginBottom: 6, marginLeft: 4 }}>Enter 6-Digit OTP</Text>
                  <View style={{ backgroundColor: '#F4F8FA', borderRadius: 16, borderWidth: 1, borderColor: '#B9DDE0', paddingHorizontal: 16, paddingVertical: 8, marginBottom: 14 }}>
                    <TextInput
                      value={passwordOtp}
                      onChangeText={setPasswordOtp}
                      editable={!passwordBusy}
                      placeholder="• • • • • •"
                      keyboardType="numeric"
                      maxLength={6}
                      style={{ fontSize: 24, fontWeight: '900', color: '#102A43', textAlign: 'center', letterSpacing: 12 }}
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleVerifyPasswordOtp}
                    disabled={passwordBusy}
                    style={{
                      backgroundColor: '#123B5D',
                      borderRadius: 16,
                      paddingVertical: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: '#0F8B8D',
                      elevation: 3,
                      marginBottom: 12
                    }}
                  >
                    {passwordBusy ? (
                      <ActivityIndicator color="#4ADE80" />
                    ) : (
                      <>
                        <Feather name="check-circle" size={16} color="#4ADE80" />
                        <Text style={{ marginLeft: 8, fontSize: 12, fontWeight: '900', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: 1 }}>
                          Verify OTP Code
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleRequestPasswordOtp}
                    disabled={passwordBusy}
                    style={{ paddingVertical: 8, alignItems: 'center' }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#0F8B8D', textDecorationLine: 'underline' }}>
                      Didn't receive OTP? Resend OTP
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* STEP 3: SET NEW PASSWORD */}
              {passwordStep === 'newPassword' && (
                <View>
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2, color: '#627D98', marginBottom: 6, marginLeft: 4 }}>New Password</Text>
                    <View style={{ backgroundColor: '#F4F8FA', borderRadius: 16, borderWidth: 1, borderColor: '#B9DDE0', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 }}>
                      <MaterialCommunityIcons name="lock-outline" size={18} color="#0F8B8D" />
                      <TextInput
                        value={newPassword}
                        onChangeText={setNewPassword}
                        editable={!passwordBusy}
                        placeholder="At least 6 characters"
                        secureTextEntry={!showPasswordText}
                        style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 10, color: '#102A43', fontWeight: '700', fontSize: 13 }}
                        placeholderTextColor="#94A3B8"
                      />
                      <TouchableOpacity onPress={() => setShowPasswordText(!showPasswordText)}>
                        <Feather name={showPasswordText ? "eye-off" : "eye"} size={16} color="#627D98" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2, color: '#627D98', marginBottom: 6, marginLeft: 4 }}>Confirm New Password</Text>
                    <View style={{ backgroundColor: '#F4F8FA', borderRadius: 16, borderWidth: 1, borderColor: '#B9DDE0', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 }}>
                      <MaterialCommunityIcons name="lock-check-outline" size={18} color="#0F8B8D" />
                      <TextInput
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        editable={!passwordBusy}
                        placeholder="Re-enter new password"
                        secureTextEntry={!showPasswordText}
                        style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 10, color: '#102A43', fontWeight: '700', fontSize: 13 }}
                        placeholderTextColor="#94A3B8"
                      />
                    </View>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleConfirmPasswordReset}
                    disabled={passwordBusy}
                    style={{
                      backgroundColor: '#123B5D',
                      borderRadius: 16,
                      paddingVertical: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: '#0F8B8D',
                      elevation: 3
                    }}
                  >
                    {passwordBusy ? (
                      <ActivityIndicator color="#4ADE80" />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="shield-check" size={18} color="#4ADE80" />
                        <Text style={{ marginLeft: 8, fontSize: 12, fontWeight: '900', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: 1 }}>
                          Update Store Password
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(partnerPinTarget)} transparent animationType="fade" onRequestClose={() => !deliveryBusy && setPartnerPinTarget(null)}>
        <View className="flex-1 items-center justify-center bg-slate-950/65 px-6">
          <View className="w-full rounded-[2rem] bg-white p-6">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-orange-50"><MaterialCommunityIcons name="key-variant" size={24} color="#ea580c" /></View>
            <Text className="mt-4 text-xl font-black text-slate-950">Set Partner PIN</Text>
            <Text className="mt-1 text-[11px] font-semibold leading-5 text-slate-500">{partnerPinTarget?.name} के लिए नया PIN बनाएँ। Save के बाद Partner ID और PIN दोनों share होंगे।</Text>
            <View className="mt-4 rounded-2xl bg-blue-50 p-3"><Text className="text-[8px] font-black uppercase text-blue-600">Partner ID</Text><Text selectable className="mt-1 text-[10px] font-bold text-blue-950">{partnerPinTarget?.login_id}</Text></View>
            <TextInput value={partnerNewPin} onChangeText={setPartnerNewPin} placeholder="New PIN (4–6 digits)" keyboardType="number-pad" secureTextEntry maxLength={6} className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center text-xl font-black tracking-[6px]" />
            <View className="mt-5 flex-row gap-3"><TouchableOpacity disabled={deliveryBusy} onPress={() => setPartnerPinTarget(null)} className="h-12 flex-1 items-center justify-center rounded-2xl bg-slate-100"><Text className="font-black text-slate-600">Cancel</Text></TouchableOpacity><TouchableOpacity disabled={deliveryBusy} onPress={resetAndSharePartnerPin} className="h-12 flex-[1.4] items-center justify-center rounded-2xl bg-orange-600">{deliveryBusy ? <ActivityIndicator color="white" /> : <Text className="font-black text-white">SAVE & SHARE</Text>}</TouchableOpacity></View>
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
