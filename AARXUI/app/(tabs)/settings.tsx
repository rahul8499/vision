import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/Language/LocalizedPrimitives';
// import {
  // StyleSheet,
  // View
// } from 'react-native';

// export default function Settings() {
//   return (
//     <View style={styles.container}>
//       <Text style={styles.text}>📄 Settings Page</Text>
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
//   text: { fontSize: 22 },
// });
// import { MaterialCommunityIcons } from '@expo/vector-icons';
// import { useIsFocused } from '@react-navigation/native';
// import axios from 'axios';
// import Constants from 'expo-constants';
// import { useRouter } from 'expo-router';
// import * as SecureStore from 'expo-secure-store';
// import React, { useEffect, useState } from 'react';
// import {
  // ActivityIndicator,
  // Alert,
  // TouchableOpacity,
  // View
// } from 'react-native';

// export default function SellerSettingsScreen() {
//   const BASE_URL = Constants.expoConfig?.extra?.BASE_URL;
//   const router = useRouter();
//   const isFocused = useIsFocused();

//   const [token, setToken] = useState<string | null>(null);
//   const [loading, setLoading] = useState(false);

//   /* 🔑 लॉग‑इन token लाएँ */
//   useEffect(() => {
//     (async () => {
//       const t = await SecureStore.getItemAsync('authToken');
//       setToken(t);
//     })();
//   }, []);

//   const [userData, setuserData] = useState<any>(null);

//   const fetchStoreProfile = async () => {


//     try {
//       const res = await fetch(`${BASE_URL}/api/me/`, {
//         headers: { Authorization: `Bearer ${token}` },

//       });

//       const data = await res.json();
//       console.log("data--", data)
//       if (res) {
//         setuserData(data);
//       } else {
//         console.warn('Failed to fetch store data');
//       }
//     } catch (err) {
//       console.error('Error fetching store profile:', err);
//     }
//   };
//   /* 🔐 Logout Handler */
//   const handleLogout = async () => {
//     if (!token) {
//       Alert.alert('Not logged‑in');
//       return;
//     }

//     Alert.alert('Logout', 'Are you sure you want to logout?', [
//       { text: 'Cancel', style: 'cancel' },
//       {
//         text: 'Logout',
//         style: 'destructive',
//         onPress: async () => {
//           try {
//             setLoading(true);

//             /* 👉 POST /api/store/logout/ */
//             await axios.post(`${BASE_URL}/api/user/logout/`, null, {
//               headers: { Authorization: `Bearer ${token}` },
//             });

//             /* 🔄 local creds हटाएँ */
//             await SecureStore.deleteItemAsync('authToken');
//             await SecureStore.deleteItemAsync('userId');
//             await SecureStore.deleteItemAsync('userType');

//             /* ↩️  Login screen पर */
//             const userType = await SecureStore.getItemAsync('userType');

//             router.push({
//               pathname: '/onboarding',
//               params: { userType: userType || '' },
//             });
//           } catch (err: any) {
//             console.error('Logout error:', err?.response?.data || err.message);
//             Alert.alert('Error', 'Logout failed. Please try again.');
//           } finally {
//             setLoading(false);
//           }
//         },
//       },
//     ]);
//   };
//   useEffect(() => {
//     fetchStoreProfile();
//   }, []);

//   useEffect(() => {
//     if (isFocused && token) {
//       fetchStoreProfile();
//     }
//   }, [isFocused, token]);
//   return (
//     <View className="flex-1 bg-white px-6 pt-16">



// {userData ? (
//   <View className="bg-white rounded-2xl p-5 shadow mb-10">
//     {/* Header with icon and name */}
//     <View className="items-center mb-6">
//       <View className="p-4 bg-emerald-100 rounded-full mb-2">
//         <MaterialCommunityIcons
//   name="account-outline"
//           size={28}
//           color="#059669"
//         />
//       </View>
//       <Text className="text-xl font-bold font-robotoBold text-gray-900">
//         {userData.name}
//       </Text>

//       {/* Mobile number */}
//       <View className="flex-row items-center space-x-2 mt-2">
//         <MaterialCommunityIcons
//           name="phone-outline"
//           size={20}
//           color="#059669"
//         />
//         <Text className="text-base text-gray-700 font-robotoMedium">
//           {userData.mobile}
//         </Text>
//       </View>
//     </View>

//     {/* Address and Email */}
//     <View className="space-y-2 border-t border-gray-200 pt-4">
//       <View className="flex-row items-start space-x-2">
//         <MaterialCommunityIcons name="map-marker-outline" size={20} color="#4B5563" />
//         <Text className="text-base text-gray-700 flex-1 ml-1">
//           {userData.address}, {userData.pincode}
//         </Text>
//       </View>

//       <View className="flex-row items-start space-x-2">
//         <MaterialCommunityIcons name="email-outline" size={20} color="#4B5563" />
//         <Text className="text-base text-gray-700 flex-1 ml-1">
//           {userData.email}
//         </Text>
//       </View>
//     </View>
//   </View>
// ) : (
//   <ActivityIndicator color="#22c55e" className="mt-4" />
// )}

//       <TouchableOpacity
//         onPress={handleLogout}
//         disabled={loading}
//         className="bg-emerald-600 rounded-lg py-3 items-center"
//       >
//         {loading ? (
//           <ActivityIndicator color="#fff" />
//         ) : (
//           <View className="flex-row items-center space-x-2">
//             {/* Logout Icon */}
//             <Text className="text-white font-semibold text-lg mr-2">Logout</Text>
//             <MaterialCommunityIcons name="logout" size={20} color="#fff" />
//           </View>)}
//       </TouchableOpacity>
//       <Text className="text-center text-gray-400 mt-8 text-sm">App version 1.0.0</Text>

//     </View>
//   );
// }
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import axios from 'axios';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../../redux/store';
import { fetchUserProfile, logout as logoutAction } from '../../redux/userSlice';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  TouchableOpacity,
  View,
  Linking,
  Share
} from 'react-native';
import * as Progress from 'react-native-progress';
import { LanguagePickerModal } from '@/components/Language/LanguagePickerModal';
import { useAppLanguage } from '@/context/LanguageContext';

export default function SellerSettingsScreen() {
  /* 📦 ENV */
  const BASE_URL = Constants.expoConfig?.extra?.BASE_URL;
  const router = useRouter();
  const isFocused = useIsFocused();
  const { t, languageLabel } = useAppLanguage();
  const [languageVisible, setLanguageVisible] = useState(false);

  /* 🔑 auth & user */
  /* 🔑 auth & user */
  const {
    user: userData,
    token,
    loading: profileLoading,
    error: profileError,
  } = useSelector((state: RootState) => state.user);
  const dispatch = useDispatch<AppDispatch>();

  /* UI state */
  const [loading, setLoading] = useState(false);   // logout spinner
  const [logoutVisible, setLogoutVisible] = useState(false);   // modal
  const [accountDeleteVisible, setAccountDeleteVisible] = useState(false);
  const [accountDeleteBusy, setAccountDeleteBusy] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);   // button spinner
  const [tempImage, setTempImage] = useState<string | null>(null); // profile change
  const [editData, setEditData] = useState<any>(null);

  // App Rating State
  const [ratingVisible, setRatingVisible] = useState(false);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingFeedback, setRatingFeedback] = useState('');
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [profileSuccessVisible, setProfileSuccessVisible] = useState(false);

  const handleAppRatingSubmit = async () => {
    if (ratingValue === 0) {
      Alert.alert('Error', 'Please select a star rating first.');
      return;
    }
    try {
      setRatingSubmitting(true);
      await axios.post(`${BASE_URL}/api/app-ratings/submit/`, {
        user_id: userData?.id,
        rating: ratingValue,
        feedback: ratingFeedback
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      Alert.alert('Thank You!', 'Your feedback has been submitted successfully.');
      setRatingVisible(false);
      setRatingValue(0);
      setRatingFeedback('');
    } catch (error) {
      Alert.alert('Error', 'Failed to submit rating. Please try again.');
    } finally {
      setRatingSubmitting(false);
    }
  };

  // Initialize editData when userData changes or modal opens
  useEffect(() => {
    if (userData && !editData) {
      setEditData({
        name: userData.name,
        mobile: userData.mobile,
        address: userData.address || '',
        pincode: userData.pincode || '',
      });
    }
  }, [userData]);

  /* ⬇️ fetch token once */
  useEffect(() => {
    if (!token || !userData) {
      dispatch(fetchUserProfile());
    }
  }, [dispatch, token, userData]);



  /* call when screen focuses or token ready */
  useEffect(() => {
    if (isFocused && (!token || !userData)) {
      dispatch(fetchUserProfile());
    }
  }, [isFocused, token, userData, dispatch]);

  /* 🔐 handle logout — with modal */
  const confirmLogout = async () => {
    if (!token) return;
    try {
      setConfirmBusy(true);
      await axios.post(`${BASE_URL}/api/user/logout/`, null, {
        headers: { Authorization: `Bearer ${token}` },
      });

      /* clear global state & local storage */
      dispatch(logoutAction());

      /* go to onboarding */
      router.push('/onboarding');
    } catch (err: any) {
      console.error('Logout error:', err?.response?.data || err.message);
      alert('Logout failed, please try again.');
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
      Alert.alert('Delete Failed', err?.response?.data?.error || 'Unable to delete your account right now. Please try again.');
    } finally {
      setAccountDeleteBusy(false);
    }
  };
  const [editOpen, setEditOpen] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const handleProfileUpdate = async () => {
    if (!token || !editData) return;
    try {
      setEditBusy(true);

      await axios.patch(`${BASE_URL}/api/me/`, {
        name: editData.name,
        mobile: editData.mobile,
        address: editData.address,
        pincode: editData.pincode,
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      setEditOpen(false);
      setProfileSuccessVisible(true);
      dispatch(fetchUserProfile()); // reload fresh data
    } catch (error) {
      console.error('Update error:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setEditBusy(false);
    }
  };
  const isFormValid = editData?.name?.trim() && editData?.mobile?.trim() && editData?.address?.trim() && editData?.pincode?.trim();

  /* ----------------------------------------------------------------- */
  return (
    <View className="flex-1 bg-slate-100">
      {/* ===== Scrollable Content ===== */}
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* Header / Brand */}
        <View className="relative overflow-hidden mb-8">
          <LinearGradient
            colors={['#0f172a', '#1e293b', '#064e3b']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="absolute inset-0 rounded-bl-[5rem] rounded-br-[8rem]"
          />
          <View className="pt-16 pb-8 px-6 relative z-10">
            <View className="flex-row justify-between items-center">
              <View className="flex-1 mr-4">
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 24, fontWeight: '900', color: '#ffffff', letterSpacing: 2.2, lineHeight: 32 }}>
                    SETTINGS
                  </Text>
                  <View style={{ width: 1.5, height: 32, backgroundColor: '#34d399', marginHorizontal: 8, borderRadius: 2, opacity: 0.8 }} />
                  <View style={{ justifyContent: 'center' }}>
                    <Text style={{ fontSize: 9, fontWeight: '800', color: '#34d399', letterSpacing: 2, textTransform: 'uppercase', lineHeight: 13 }}>Account</Text>
                    <Text style={{ fontSize: 9, fontWeight: '800', color: '#ffffff', letterSpacing: 1.5, textTransform: 'uppercase', lineHeight: 13 }}>Control</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 6.5, fontWeight: '500', color: 'rgba(255,255,255,0.45)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 }}>
                  Manage Your Account & App
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setEditOpen(true)}
                disabled={!userData || profileLoading}
                className={`bg-white/10 w-14 h-14 rounded-[1.5rem] items-center justify-center border border-white/10 shadow-2xl ${!userData || profileLoading ? 'opacity-50' : ''}`}
              >
                <Feather name="edit-3" size={22} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {userData ? (
          <>
            {/* 1. Profile Summary Block */}
            <View className="px-6 mb-8">
              <View className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-300/40 border border-slate-200/60 overflow-hidden">
                <LinearGradient
                  colors={['#0f172a', '#1e293b', '#064e3b']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  className="h-2"
                />
                <View className="p-6 flex-row items-center">
                {/* Visual Avatar */}
                <View className="relative">
                  <Progress.Circle
                    size={84}
                    progress={(userData?.profile_completion_percent || 0) / 100}
                    showsText={false}
                    color="#10B981"
                    thickness={4}
                    unfilledColor="#F3F4F6"
                    borderWidth={0}
                  />
                  <View className="absolute top-0 bottom-0 left-0 right-0 items-center justify-center">
                    <View className="w-[74px] h-[74px] bg-emerald-50 rounded-full items-center justify-center border border-emerald-100">
                      <MaterialCommunityIcons name="shield-check-outline" size={34} color="#059669" />
                    </View>
                  </View>
                  <View className="absolute -bottom-1 -right-1 bg-white p-1 rounded-full shadow-sm">
                    <View className="bg-emerald-500 w-4 h-4 rounded-full border-2 border-white" />
                  </View>
                </View>

                {/* Name & Mobile */}
                <View className="ml-5 flex-1">
                  <Text className="text-xl font-bold text-gray-900" numberOfLines={1}>{userData.name}</Text>
                  <Text className="text-sm font-semibold text-gray-400 mt-0.5">{userData.mobile}</Text>
                  <View className="flex-row items-center flex-wrap mt-2.5">
                    <View className="bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100 flex-row items-center">
                      <MaterialCommunityIcons name="star" size={12} color="#059669" />
                      <Text className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-tighter ml-1">
                        {userData?.profile_completion_percent}% Profile Done
                      </Text>
                    </View>
                    <View className="ml-3 mt-1 px-2 py-0.5 rounded-lg border bg-slate-900 border-slate-800 flex-row items-center">
                      <MaterialCommunityIcons name="check-decagram" size={11} color="#34d399" />
                      <Text className="text-[10px] font-extrabold uppercase ml-1 text-white">
                        Active Account
                      </Text>
                    </View>
                  </View>
                </View>
                </View>
              </View>
            </View>

            {/* 2. Account Details Section */}
            <View className="px-6 mb-8">
              <Text className="text-[10px] font-black text-slate-400 uppercase tracking-[4px] ml-4 mb-3">Your Account</Text>
              <View className="bg-white rounded-[2rem] overflow-hidden shadow-xl shadow-slate-200/70 border border-slate-200/70">
                <SettingsRow
                  icon="email-outline"
                  title="Email Address"
                  value={userData.email || "Add Email"}
                  onPress={() => setEditOpen(true)}
                  isLast={false}
                />
                <SettingsRow
                  icon="map-marker-outline"
                  title="User Address"
                  value={userData.address ? `${userData.address}, ${userData.pincode}` : "Add Address"}
                  onPress={() => setEditOpen(true)}
                  isLast={true}
                />
              </View>
            </View>

            {/* 3. Help & Preferences Section */}
            <View className="px-6 mb-8">
              <Text className="text-[10px] font-black text-slate-400 uppercase tracking-[4px] ml-4 mb-3">Help & Preferences</Text>
              <View className="bg-white rounded-[2rem] overflow-hidden shadow-xl shadow-slate-200/70 border border-slate-200/70">
                <SettingsRow
                  icon="shopping-outline"
                  title="Orders"
                  subtitle="Accepted quotations & walk-in orders"
                  onPress={() => router.push('/orders')}
                  isLast={false}
                />
                <SettingsRow
                  icon="shield-alert-outline"
                  title="Reports & Safety"
                  subtitle="Track your private moderation reports"
                  onPress={() => router.push("/(tabs)/reports")}
                  isLast={false}
                />
                <SettingsRow
                  icon="hand-heart-outline"
                  title="Help & Complaints"
                  subtitle="Raise or track a formal complaint"
                  onPress={() => router.push("/(tabs)/support")}
                  isLast={false}
                />
                <SettingsRow
                  icon="headphones"
                  title="Help & Support Centre"
                  subtitle="FAQs, call, email or contact AARX"
                  onPress={() => router.push('/(tabs)/help-center')}
                  isLast={false}
                />
                <SettingsRow
                  icon="bell-outline"
                  title="Notifications"
                  subtitle="Configure alerts & order updates"
                  onPress={() => Alert.alert("App Settings", "Notification preferences are active.")}
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

            {/* 4. Feedback & Information */}
            <View className="px-6 mb-8">
              <Text className="text-[10px] font-black text-slate-400 uppercase tracking-[4px] ml-4 mb-3">Feedback & Others</Text>
              <View className="bg-white rounded-[2rem] overflow-hidden shadow-xl shadow-slate-200/70 border border-slate-200/70">
                <SettingsRow
                  icon="star-outline"
                  title="Rate the App"
                  subtitle="Love using AARXUI?"
                  onPress={() => setRatingVisible(true)}
                  isLast={false}
                />
                <SettingsRow
                  icon="share-variant-outline"
                  title="Invite Friends"
                  onPress={() => Share.share({ message: 'Check out the AARX app for fast medicine delivery!' })}
                  isLast={true}
                />
              </View>
            </View>

            {/* 5. Legal Section */}
            <View className="px-6 mb-8">
              <Text className="text-[10px] font-black text-slate-400 uppercase tracking-[4px] ml-4 mb-3">Legal</Text>
              <View className="bg-white rounded-[2rem] overflow-hidden shadow-xl shadow-slate-200/70 border border-slate-200/70">
                <SettingsRow
                  icon="shield-lock-outline"
                  title="Privacy Policy"
                  subtitle="Prescription, location and account data"
                  onPress={() => router.push('/(tabs)/legal/privacy')}
                  isLast={false}
                />
                <SettingsRow
                  icon="file-sign"
                  title="Terms & Conditions"
                  subtitle="Customer platform terms"
                  onPress={() => router.push('/(tabs)/legal/terms')}
                  isLast={false}
                />
                <SettingsRow
                  icon="cash-refund"
                  title="Cancellation, Refund & Replacement"
                  subtitle="Order cancellation and medicine issues"
                  onPress={() => router.push('/(tabs)/legal/cancellation')}
                  isLast={false}
                />
                <SettingsRow
                  icon="truck-delivery-outline"
                  title="Delivery & Fulfilment Policy"
                  subtitle="ETA, handover and failed deliveries"
                  onPress={() => router.push('/(tabs)/legal/delivery')}
                  isLast={false}
                />
                <SettingsRow
                  icon="medical-bag"
                  title="Medicine & Safety Disclaimer"
                  subtitle="Clinical, pharmacist and AI limitations"
                  onPress={() => router.push('/(tabs)/legal/medicine-safety')}
                  isLast={false}
                />
                <SettingsRow
                  icon="information-outline"
                  title="About AARX"
                  value="v1.0.0"
                  onPress={() => router.push('/(tabs)/legal/about')}
                  isLast={false}
                />
                <SettingsRow
                  icon="account-remove-outline"
                  title="Delete Account"
                  subtitle="Deactivate your account and sign out"
                  onPress={() => setAccountDeleteVisible(true)}
                  isLast={true}
                />
              </View>
            </View>

            {/* 6. Logout Zone */}
            <View className="px-6 mt-2 mb-10">
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
              <Text className="text-center text-slate-400 font-bold text-[10px] mt-4 uppercase tracking-[4px]">Made with ❤️ In India</Text>
            </View>
          </>
        ) : (
          <View className="px-6 py-16 mt-2">
            {profileError && !profileLoading ? (
              <View className="bg-white rounded-[2.25rem] overflow-hidden shadow-2xl shadow-slate-300/40 border border-slate-200">
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
                  <Text className="text-2xl font-black text-slate-900 text-center">Profile Sync Failed</Text>
                  <Text className="text-[10px] font-black text-emerald-600 uppercase tracking-[3px] mt-1">Account Details</Text>
                  <Text className="text-sm font-semibold text-slate-400 text-center leading-5 mt-4">
                    {profileError || 'Unable to fetch your profile right now.'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => dispatch(fetchUserProfile())}
                    className="w-full py-4 bg-slate-900 rounded-full items-center mt-7 shadow-md flex-row justify-center"
                  >
                    <MaterialCommunityIcons name="reload" size={18} color="#34d399" />
                    <Text className="text-white font-black text-sm uppercase tracking-widest ml-2">Retry</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View className="bg-white rounded-[2.25rem] overflow-hidden shadow-2xl shadow-slate-300/40 border border-slate-200">
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
                  <Text className="text-2xl font-black text-slate-900 text-center">Fetching Profile</Text>
                  <Text className="text-[10px] font-black text-emerald-600 uppercase tracking-[3px] mt-1">Secure Account Sync</Text>
                  <Text className="text-sm font-semibold text-slate-400 text-center leading-5 mt-4">
                    Loading your account details and preferences.
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* ===== Modern Pill-Style Edit Profile Dialogue ===== */}
      <Modal visible={editOpen} transparent animationType="fade" onRequestClose={() => !editBusy && setEditOpen(false)}>
        <View className="flex-1 bg-black/60 justify-center items-center px-5">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="w-full max-w-sm"
          >
            <View className="bg-white rounded-[2.25rem] shadow-2xl overflow-hidden border border-slate-200">
              <LinearGradient
                colors={['#0f172a', '#1e293b', '#064e3b']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                className="h-2"
              />
              <View className="p-5">
              {/* Header (Avatar Picker + Title) */}
              <View className="flex-row items-center mb-5">
                <TouchableOpacity
                  onPress={async () => {
                    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.5 });
                    if (!result.canceled) setTempImage(result.assets[0].uri);
                  }}
                  className="relative"
                >
                  <View className="w-16 h-16 rounded-2xl bg-emerald-50 items-center justify-center border border-emerald-100 shadow-lg shadow-slate-300 overflow-hidden">
                    {tempImage || userData?.profile_image ? (
                      <Image source={{ uri: tempImage || userData?.profile_image }} className="w-full h-full" />
                    ) : (
                      <MaterialCommunityIcons name="account-circle-outline" size={34} color="#059669" />
                    )}
                  </View>
                  <View className="absolute -bottom-1 -right-1 bg-slate-900 w-7 h-7 rounded-xl items-center justify-center border-2 border-white shadow-sm">
                    <MaterialCommunityIcons name="camera" size={13} color="#34d399" />
                  </View>
                </TouchableOpacity>

                <View className="ml-4 flex-1">
                  <Text className="text-xl font-black text-slate-900" numberOfLines={1}>Edit Identity</Text>
                  <Text className="text-[9px] font-black text-emerald-600 uppercase tracking-[2px] mt-0.5">Personal Details</Text>
                </View>
                <TouchableOpacity
                  onPress={() => { setEditOpen(false); dispatch(fetchUserProfile()); }}
                  disabled={editBusy}
                  className={`w-9 h-9 rounded-full bg-slate-50 border border-slate-200 items-center justify-center ${editBusy ? 'opacity-50' : ''}`}
                >
                  <MaterialCommunityIcons name="close" size={18} color="#64748b" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} className="max-h-[48vh]">
                <PillInputField
                  label="FULL NAME"
                  value={editData?.name}
                  onChange={(t: string) => setEditData({ ...editData, name: t })}
                  placeholder="E.g. Rahul Kolhe"
                  icon="account-outline"
                />
                <PillInputField
                  label="PRIMARY MOBILE"
                  value={editData?.mobile}
                  onChange={(t: string) => setEditData({ ...editData, mobile: t })}
                  placeholder="10-digit number"
                  kb="number-pad"
                  icon="phone-outline"
                />
                <PillInputField
                  label="AREA PINCODE"
                  value={editData?.pincode}
                  onChange={(t: string) => setEditData({ ...editData, pincode: t })}
                  placeholder="E.g. 411038"
                  kb="number-pad"
                  icon="map-marker-radius-outline"
                />

                <View className="mb-4 relative">
                  <Text className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-4">Full Address</Text>
                  <View className="bg-slate-50 rounded-[1.5rem] border border-slate-200 relative overflow-hidden">
                    <View className="absolute top-4 left-4 z-10">
                      <MaterialCommunityIcons name="home-outline" size={18} color="#059669" />
                    </View>
                    <TextInput
                      multiline
                      value={editData?.address}
                      onChangeText={(t: string) => setEditData({ ...editData, address: t })}
                      placeholder="Enter your complete address..."
                      className="p-4 pl-11 text-slate-900 font-bold min-h-[78px] text-sm"
                      textAlignVertical="top"
                      placeholderTextColor="#A1A1AA"
                    />
                  </View>
                </View>
              </ScrollView>

              {/* Action Buttons (The Pill Pair) */}
              <View className="mt-5 flex-row gap-3">
                <TouchableOpacity
                  onPress={() => { setEditOpen(false); dispatch(fetchUserProfile()); }}
                  disabled={editBusy}
                  className={`flex-1 py-3.5 bg-slate-50 rounded-full items-center border border-slate-200 ${editBusy ? 'opacity-50' : ''}`}
                >
                  <Text className="text-slate-500 font-black text-sm">Discard</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleProfileUpdate}
                  disabled={!isFormValid || editBusy}
                  className={`flex-[1.35] py-3.5 rounded-full items-center shadow-md ${!isFormValid || editBusy ? 'bg-slate-200' : 'bg-slate-900'}`}
                >
                  {editBusy ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-black text-sm">Save Changes</Text>}
                </TouchableOpacity>
              </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ===== Premium Profile Update Success Dialog ===== */}
      <Modal visible={profileSuccessVisible} transparent animationType="fade" onRequestClose={() => setProfileSuccessVisible(false)}>
        <View className="flex-1 bg-black/60 justify-center items-center px-5">
          <View className="bg-white rounded-[2.25rem] w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200">
            <LinearGradient
              colors={['#0f172a', '#1e293b', '#064e3b']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              className="h-2"
            />
            <View className="p-7 items-center">
              <View className="w-20 h-20 rounded-[1.75rem] bg-emerald-50 border border-emerald-100 items-center justify-center mb-5 shadow-sm shadow-emerald-100">
                <View className="w-12 h-12 rounded-2xl bg-slate-900 items-center justify-center">
                  <MaterialCommunityIcons name="check-bold" size={26} color="#34d399" />
                </View>
              </View>
              <Text className="text-2xl font-black text-slate-900 text-center">Profile Updated</Text>
              <Text className="text-[10px] font-black text-emerald-600 uppercase tracking-[3px] mt-1">Saved Successfully</Text>
              <Text className="text-sm font-medium text-slate-400 text-center leading-5 mt-4 px-2">
                Your account details have been refreshed and saved.
              </Text>
              <TouchableOpacity
                onPress={() => setProfileSuccessVisible(false)}
                className="w-full py-4 bg-slate-900 rounded-full items-center mt-7 shadow-md"
              >
                <Text className="text-white font-black text-sm uppercase tracking-widest">Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ===== Delete Account Modal ===== */}
      <Modal visible={accountDeleteVisible} transparent animationType="fade" onRequestClose={() => !accountDeleteBusy && setAccountDeleteVisible(false)}>
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
                  <Text className="text-xl font-black text-slate-900">Delete Account?</Text>
                  <Text className="text-[9px] font-black text-red-500 uppercase tracking-[2px] mt-0.5">Account Access Will Stop</Text>
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
                    Your account will be deactivated and you will be signed out. Existing order history is kept safely for support and records.
                  </Text>
                </View>
              </View>

              <View className="flex-row w-full gap-3" style={{ gap: 12 }}>
                <TouchableOpacity
                  onPress={() => setAccountDeleteVisible(false)}
                  disabled={accountDeleteBusy}
                  className={`flex-1 py-3.5 bg-slate-50 rounded-full items-center border border-slate-200 ${accountDeleteBusy ? 'opacity-50' : ''}`}
                >
                  <Text className="text-slate-600 font-black text-sm">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={confirmDeleteAccount} disabled={accountDeleteBusy} className="flex-1 py-3.5 bg-red-600 rounded-full items-center shadow-sm">
                  {accountDeleteBusy ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-black text-sm">Delete</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <LanguagePickerModal visible={languageVisible} onClose={() => setLanguageVisible(false)} />

      {/* ===== Custom Logout Modal (Existing Logic) ===== */}
      <Modal visible={logoutVisible} transparent animationType="fade" onRequestClose={() => !confirmBusy && setLogoutVisible(false)}>
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
                  <MaterialCommunityIcons name="logout-variant" size={26} color="#DC2626" />
                </View>
                <View className="ml-4 flex-1">
                  <Text className="text-xl font-black text-slate-900">{t('logout.title')}</Text>
                  <Text className="text-[9px] font-black text-red-500 uppercase tracking-[2px] mt-0.5">{t('logout.userEyebrow')}</Text>
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
                    {t('logout.userMessage')}
                  </Text>
                </View>
              </View>

              <View className="flex-row w-full gap-3" style={{ gap: 12 }}>
                <TouchableOpacity
                  onPress={() => setLogoutVisible(false)}
                  disabled={confirmBusy}
                  className={`flex-1 py-3.5 bg-slate-50 rounded-full items-center border border-slate-200 ${confirmBusy ? 'opacity-50' : ''}`}
                >
                  <Text className="text-slate-600 font-black text-sm">{t('logout.stay')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={confirmLogout} disabled={confirmBusy} className="flex-1 py-3.5 bg-slate-900 rounded-full items-center shadow-sm">
                  {confirmBusy ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-black text-sm">{t('logout.confirm')}</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* ===== Rate App Modal ===== */}
      <Modal visible={ratingVisible} transparent animationType="fade" onRequestClose={() => !ratingSubmitting && setRatingVisible(false)}>
        <View className="flex-1 bg-black/60 justify-center items-center px-4">
          <View className="bg-white p-8 rounded-[3rem] w-full max-w-sm items-center shadow-2xl border border-slate-200">
            <View className="w-16 h-16 bg-emerald-50 rounded-full items-center justify-center mb-4 border border-emerald-100">
              <MaterialCommunityIcons name="star-shooting" size={32} color="#F59E0B" />
            </View>
            <Text className="text-xl font-black text-slate-900 mb-1">Rate AARX App</Text>
            <Text className="text-xs text-slate-400 text-center mb-6">How was your experience using our app?</Text>
            
            <View className="flex-row gap-2 mb-6">
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setRatingValue(star)} disabled={ratingSubmitting}>
                  <MaterialCommunityIcons
                    name={star <= ratingValue ? "star" : "star-outline"}
                    size={40}
                    color={star <= ratingValue ? "#F59E0B" : "#D1D5DB"}
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

{/* Helper: Settings Row Component */ }
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

{/* Helper: Modern Pill Input Component */ }
const PillInputField = ({ label, value, onChange, placeholder, kb, icon }: any) => (
  <View className="mb-4">
    <Text className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-4">{label}</Text>
    <View className="bg-slate-50 rounded-full px-4 flex-row items-center border border-slate-200 h-12">
      {icon && <MaterialCommunityIcons name={icon} size={18} color="#059669" className="mr-3" />}
      <TextInput
        placeholder={placeholder}
        value={value}
        onChangeText={onChange}
        keyboardType={kb || "default"}
        className="flex-1 text-slate-900 font-bold text-sm ml-2"
        placeholderTextColor="#A1A1AA"
      />
    </View>
  </View>
);
