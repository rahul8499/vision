import { LocalizedText as Text, LocalizedTextInput as TextInput, LocalizedButton as Button } from '@/components/Language/LocalizedPrimitives';

// // import Constants from 'expo-constants';
// // import { useLocalSearchParams, useRouter } from 'expo-router';
// // import * as SecureStore from 'expo-secure-store';
// // import React, { useEffect, useState } from 'react';
// // import {
  // ActivityIndicator,
  // TouchableOpacity,
  // View
// } from 'react-native';
// // import { useSignup } from '../context/SignupContext'; // <-- Adjust the import path if needed
// 
// // export default function LoginScreen() {
// //   // const { userType } = useLocalSearchParams<{ userType: string }>();
// //   const BASE_URL = Constants.expoConfig?.extra?.BASE_URL;
// 
// //   const params = useLocalSearchParams();
// //   const { setSignupData } = useSignup();
// //   const [loginBusy, setLoginBusy] = useState(false); // ⬅️ Loader state
// 
// //   const router = useRouter();
// 
// //   const [email, setEmail] = useState('');
// //   const [password, setPassword] = useState('');
// 
// 
// //   const handleNext = async () => {
// //     if (!email || !password) {
// //       alert('Please enter email and password');
// //       return;
// //     }
// 
// //     try {
// //       setLoginBusy(true); // 🌀 Start loader
// 
// //       const userType = params.userType === 'seller' ? 'seller' : 'buyer';
// //       const loginUrl =
// //         userType === 'seller'
// //           ? `${BASE_URL}/api/store/login/`
// //           : `${BASE_URL}/api/user/login/`;
// 
// //       const response = await fetch(loginUrl, {
// //         method: 'POST',
// //         headers: {
// //           'Content-Type': 'application/json',
// //         },
// //         body: JSON.stringify({ email, password }),
// //       });
// 
// //       const data = await response.json();
// //       console.log('Login response:', data);
// 
// //       if (!response.ok) {
// //         alert(data?.detail || 'Login failed! Please check your credentials.');
// //         return;
// //       }
// 
// //       // ✅ Store common tokens
// //       await SecureStore.setItemAsync('authToken', data.token);
// //       await SecureStore.setItemAsync('userType', data.user_type);
// 
// //       // ✅ Store userId only if present
// //       const userId =
// //         data.user_type === 'store'
// //           ? data.store_id
// //           : data.user_type === 'user'
// //             ? data.user_id
// //             : null;
// 
// //       if (userId) {
// //         await SecureStore.setItemAsync('userId', userId.toString());
// //       } else {
// //         console.warn('❗userId/storeId is missing');
// //       }
// 
// //       // ✅ Navigate after storing everything
// //       if (data.user_type === 'user') {
// //         router.replace('/(tabs)');
// //       } else if (data.user_type === 'store') {
// //         router.replace('/(sellerTabs)/home' as any);
// //       } else {
// //         console.warn('❗Unknown user type:', data.user_type);
// //       }
// //     } catch (error) {
// //       console.error('❌ Login error:', error);
// //       alert('Something went wrong. Please try again.');
// //     } finally {
// //       setLoginBusy(false); // ✅ Stop loader
// //     }
// //   };
// 
// 
// 
// //   const handleSignup = () => {
// //     if (params.userType === 'buyer') {
// //       router.push({
// //         pathname: '/onboarding/buyer-signup-step1',
// //         params: { userType: params.userType || '' },
// //       });
// //     } else if (params.userType === 'seller') {
// //       router.push({
// //         pathname: '/onboarding/seller-signup-step1',
// //         params: { userType: params.userType || '' },
// //       });
// //     }
// //   };
// //   useEffect(() => {
// //     // Reset signup data when LoginScreen is opened
// //     setSignupData({
// //       name: '',
// //       mobile: '',
// //       email: '',
// //       password: '',
// //       ownerName: '',
// //       address: '',
// //       pincode: '',
// //       gstNumber: '',
// //       drugLicense: '',
// //     });
// //   }, []);
// // const isValid = email.trim() !== '' && password.trim() !== '';
// 
// //   return (
// //     <View className="flex-1  bg-slate-50   pt-20 px-6">
// //       <Text className="text-2xl font-extrabold text-emerald-700 mb-10 text-center">
// //         {typeof params.userType === 'string' ? params.userType.toUpperCase() : ''} Login
// //       </Text>
// 
// //       <TextInput
// //         placeholder="Email"
// //         value={email}
// //         onChangeText={setEmail}
// //         className="w-full mb-4 px-4 py-3 rounded-lg border border-gray-300 bg-white text-base"
// //         keyboardType="email-address"
// //         autoCapitalize="none"
// //       />
// 
// //       <TextInput
// //         placeholder="Password"
// //         value={password}
// //         onChangeText={setPassword}
// //         className="w-full mb-6 px-4 py-3 rounded-lg border border-gray-300 bg-white text-base"
// //         secureTextEntry
// //       />
// 
// 
// //       <TouchableOpacity
// //         onPress={handleNext}
// //           disabled={!isValid || loginBusy}
// 
// //         className={` rounded-md px-6 py-3 mb-3 w-full ${ isValid && !loginBusy ? ' bg-green-600' : 'bg-green-600 opacity-40'}`}
// //       >
// //         {loginBusy ? (
// //           <ActivityIndicator color="#fff" />
// //         ) : (
// //           <Text className="text-white text-lg text-center font-semibold">Login ➡</Text>
// //         )}
// //       </TouchableOpacity>
// 
// 
// 
// //       <TouchableOpacity
// //         disabled={loginBusy} // ✅ Disable if login is in progress
// //         onPress={() => {
// //           if (!loginBusy) {
// //             router.push({
// //               pathname: '/onboarding',
// //               params: { userType: params.userType || '' },
// //             });
// //           }
// //         }}
// //         className={`rounded-md py-3 items-center ${loginBusy ? 'bg-gray-300 opacity-60' : 'bg-gray-200'
// //           }`}
// //       >
// //         <Text className="text-gray-700 font-medium">⬅️ Back</Text>
// //       </TouchableOpacity>
// 
// //       <Text className="text-sm  text-center text-gray-600">
// //         Don’t have an account?{' '}
// //         <Text onPress={handleSignup} className={` font-semibold ${loginBusy ? ' text-gray-300 opacity-60' : 'text-blue-600'
// //           }`} disabled={loginBusy} // ✅ Disable if login is in progress
// //         >
// //           Sign up
// //         </Text>
// //       </Text>
// // {!isValid && (
// //   <Text className="text-red-600 text-sm text-center mb-3 mt-4 italic">
// //     कृपया ईमेल और पासवर्ड दर्ज करें | Email and password are required.
// //   </Text>
// // )}
// 
// //       {/* Stepper */}
// //       <View className="flex-row justify-center items-center gap-3 mt-10">
// //         <View className="w-4 h-4 rounded-full bg-slate-300" />
// //         <View className="w-4 h-4 rounded-full bg-green-700" />
// //       </View>
// //     </View>
// //   );
// // }
// 
// // // ---------------------------MOBILE OTP-------------------------------------------------------------
// // // import { FirebaseRecaptchaVerifierModal } from "expo-firebase-recaptcha";
// // // import firebase from "firebase/compat/app";
// // // import "firebase/compat/auth";
// // // import React, { useRef, useState } from "react";
// // // import {
  // StyleSheet,
  // View
// } from 'react-native';

// // // const firebaseConfig = {
// // //   apiKey: "AIzaSyBckV_i8WsZbJJbWegC7-nGB-o386NnN6Y",
// // //   authDomain: "aarx-bd1dc.firebaseapp.com",
// // //   projectId: "aarx-bd1dc",
// // //   storageBucket: "aarx-bd1dc.appspot.com",
// // //   messagingSenderId: "602382010705",
// // //   appId: "1:602382010705:web:f1b4aa97001d1da9002b70",
// // //   measurementId: "G-G597BPHVNE"
// // // };

// // // if (!firebase.apps.length) {
// // //   firebase.initializeApp(firebaseConfig);
// // // }

// // // export default function LoginScreen() {
// // //   const recaptchaVerifier = useRef<FirebaseRecaptchaVerifierModal>(null);
// // //   const [phoneNumber, setPhoneNumber] = useState<string>("");
// // //   const [verificationId, setVerificationId] = useState<string | null>(null);
// // //   const [verificationCode, setVerificationCode] = useState<string>("");
// // //   const [message, setMessage] = useState<string>("");

// // //   const sendVerification = async () => {
// // //     try {
// // //       const phoneProvider = new firebase.auth.PhoneAuthProvider();
// // //       const id = await phoneProvider.verifyPhoneNumber(
// // //         phoneNumber,
// // //         recaptchaVerifier.current!
// // //       );
// // //       setVerificationId(id);
// // //       setMessage("OTP भेज दिया गया है!");
// // //     } catch (err: any) {
// // //       setMessage(`Error: ${err.message}`);
// // //     }
// // //   };

// // //   const confirmCode = async () => {
// // //     try {
// // //       if (!verificationId) return;
// // //       const credential = firebase.auth.PhoneAuthProvider.credential(
// // //         verificationId,
// // //         verificationCode
// // //       );
// // //       await firebase.auth().signInWithCredential(credential);
// // //       setMessage("फोन नंबर सफलतापूर्वक वेरीफाई हो गया!");
// // //     } catch (err: any) {
// // //       setMessage(`Error: ${err.message}`);
// // //     }
// // //   };

// // //   return (
// // //     <View style={styles.container}>
// // //       <FirebaseRecaptchaVerifierModal
// // //         ref={recaptchaVerifier}
// // //         firebaseConfig={firebaseConfig}
// // //         attemptInvisibleVerification={true}
// // //       />
// // //       <Text style={{ marginBottom: 20 }}>{message}</Text>
// // //       <TextInput
// // //         placeholder="फोन नंबर (+91...) डालें"
// // //         onChangeText={setPhoneNumber}
// // //         keyboardType="phone-pad"
// // //         autoComplete="tel"
// // //         style={styles.textInput}
// // //         value={phoneNumber}
// // //       />
// // //       <Button title="OTP भेजें" onPress={sendVerification} />
// // //       {verificationId && (
// // //         <>
// // //           <TextInput
// // //             placeholder="OTP दर्ज करें"
// // //             onChangeText={setVerificationCode}
// // //             keyboardType="number-pad"
// // //             style={styles.textInput}
// // //             value={verificationCode}
// // //           />
// // //           <Button title="Verify OTP" onPress={confirmCode} />
// // //         </>
// // //       )}
// // //     </View>
// // //   );
// // // }

// // // const styles = StyleSheet.create({
// // //   container: {
// // //     flex: 1,
// // //     padding: 20,
// // //     justifyContent: "center",
// // //   },
// // //   textInput: {
// // //     height: 50,
// // //     borderBottomWidth: 1,
// // //     marginBottom: 20,
// // //     fontSize: 17,
// // //   },
// // // });
// // import { Feather } from '@expo/vector-icons';
// // import Constants from 'expo-constants';
// // import { useLocalSearchParams, useRouter } from 'expo-router';
// // import * as SecureStore from 'expo-secure-store';
// // import React, { useEffect, useState } from 'react';
// // import {
  // //   ActivityIndicator,
  // //   Text,
  // //   TextInput,
  // //   TouchableOpacity,
  // //   View,
  // //
// } from 'react-native';
// // import { useSignup } from '../context/SignupContext';
// 
// // export default function LoginScreen() {
// //   const BASE_URL = Constants.expoConfig?.extra?.BASE_URL;
// //   const params = useLocalSearchParams();
// //   const { setSignupData } = useSignup();
// 
// //   const [loginBusy, setLoginBusy] = useState(false);
// //   const [email, setEmail] = useState('');
// //   const [password, setPassword] = useState('');
// //   const [secureEntry, setSecureEntry] = useState(true); // 👁️ password hide/show
// 
// //   const router = useRouter();
// 
// //   const isValid = email.trim() !== '' && password.trim() !== '';
// 
// //   const handleNext = async () => {
// //     if (!email || !password) {
// //       alert('कृपया ईमेल और पासवर्ड भरें | Please enter email and password');
// //       return;
// //     }
// 
// //     try {
// //       setLoginBusy(true);
// 
// //       const userType = params.userType === 'seller' ? 'seller' : 'buyer';
// //       const loginUrl =
// //         userType === 'seller'
// //           ? `${BASE_URL}/api/store/login/`
// //           : `${BASE_URL}/api/user/login/`;
// 
// //       const response = await fetch(loginUrl, {
// //         method: 'POST',
// //         headers: { 'Content-Type': 'application/json' },
// //         body: JSON.stringify({ email, password }),
// //       });
// 
// //       const data = await response.json();
// 
// //       if (!response.ok) {
// //         alert(data?.detail || 'Login failed! Please check your credentials.');
// //         return;
// //       }
// 
// //       await SecureStore.setItemAsync('authToken', data.token);
// //       await SecureStore.setItemAsync('userType', data.user_type);
// 
// //       const userId =
// //         data.user_type === 'store'
// //           ? data.store_id
// //           : data.user_type === 'user'
// //             ? data.user_id
// //             : null;
// 
// //       if (userId) {
// //         await SecureStore.setItemAsync('userId', userId.toString());
// //       }
// 
// //       if (data.user_type === 'user') {
// //         router.replace('/(tabs)');
// //       } else if (data.user_type === 'store') {
// //         router.replace('/(sellerTabs)/home' as any);
// //       }
// //     } catch (error) {
// //       console.error('Login error:', error);
// //       alert('Something went wrong. Please try again.');
// //     } finally {
// //       setLoginBusy(false);
// //     }
// //   };
// 
// //   const handleSignup = () => {
// //     if (params.userType === 'buyer') {
// //       router.push({ pathname: '/onboarding/buyer-signup-step1', params: { userType: params.userType || '' } });
// //     } else {
// //       router.push({ pathname: '/onboarding/seller-signup-step1', params: { userType: params.userType || '' } });
// //     }
// //   };
// 
// //   useEffect(() => {
// //     setSignupData({
// //       name: '',
// //       mobile: '',
// //       email: '',
// //       password: '',
// //       ownerName: '',
// //       address: '',
// //       pincode: '',
// //       gstNumber: '',
// //       drugLicense: '',
// //     });
// //   }, []);
// 
// //   return (
// //     <View className="flex-1 bg-slate-50 pt-20 px-6">
// //       <Text className="text-2xl font-extrabold text-emerald-700 mb-10 text-center">
// //         {typeof params.userType === 'string' ? params.userType.toUpperCase() : ''} Login
// //       </Text>
// 
// //       <TextInput
// //         placeholder="Email"
// //         value={email}
// //         onChangeText={setEmail}
// //         className="w-full mb-4 px-4 py-3 rounded-lg border border-gray-300 bg-white text-base"
// //         keyboardType="email-address"
// //         autoCapitalize="none"
// //       />
// 
// //       {/* Password field with visibility toggle */}
// //       <View className="w-full mb-6 relative">
// //         <TextInput
// //           placeholder="Password"
// //           value={password}
// //           onChangeText={setPassword}
// //           secureTextEntry={secureEntry}
// //           className="px-4 py-3 rounded-lg border border-gray-300 bg-white text-base pr-12"
// //         />
// //         <TouchableOpacity
// //           onPress={() => setSecureEntry(!secureEntry)}
// //           className="absolute right-4 top-3"
// //         >
// //           <Feather name={secureEntry ? 'eye-off' : 'eye'} size={20} color="gray" />
// //         </TouchableOpacity>
// //       </View>
// 
// //       {!isValid && (
// //         <Text className="text-red-600 text-sm text-center mb-3 italic">
// //           कृपया ईमेल और पासवर्ड दर्ज करें | Email and password are required.
// //         </Text>
// //       )}
// 
// //       <TouchableOpacity
// //         onPress={handleNext}
// //         disabled={!isValid || loginBusy}
// //         className={`rounded-md px-6 py-3 mb-3 w-full ${isValid && !loginBusy ? ' bg-lime-500' : 'bg-lime-600 opacity-40'
// //           }`}
// //       >
// //         {loginBusy ? (
// //           <View className="flex-row items-center justify-center space-x-2">
// //             <Text className="text-white text-lg font-semibold">Login</Text>
// //             <ActivityIndicator color="#fff" />
// //           </View>
// //         ) : (
// //           <Text className="text-white text-lg text-center font-semibold">Login ➡</Text>
// //         )}
// //       </TouchableOpacity>
// 
// //       <TouchableOpacity
// //         disabled={loginBusy}
// //         onPress={() =>
// //           router.push({ pathname: '/onboarding', params: { userType: params.userType || '' } })
// //         }
// //         className={`rounded-md py-3 items-center ${loginBusy ? 'bg-gray-300 opacity-60' : 'bg-gray-200'
// //           }`}
// //       >
// //         <Text className="text-gray-700 font-medium">⬅️ Back</Text>
// //       </TouchableOpacity>
// 
// //       <Text className="text-sm text-center text-gray-600 mt-4">
// //         Don’t have an account?{' '}
// //         <Text
// //           onPress={handleSignup}
// //           className={`font-semibold ${loginBusy ? 'text-gray-300 opacity-60' : 'text-blue-600'
// //             }`}
// //         >
// //           Sign up
// //         </Text>
// //       </Text>
// 
// //       {/* Stepper */}
// //       <View className="flex-row justify-center items-center gap-3 mt-10">
// //         <View className="w-4 h-4 rounded-full bg-slate-300" />
// //         <View className="w-4 h-4 rounded-full bg-lime-600" />
// //       </View>
// //     </View>
// //   );
// // }
// // import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
// // import Constants from 'expo-constants';
// // import { LinearGradient } from 'expo-linear-gradient';
// // import { useLocalSearchParams, useRouter } from 'expo-router';
// // import * as SecureStore from 'expo-secure-store';
// // import React, { useEffect, useState } from 'react';
// // import {
  // //   ActivityIndicator,
  // //   StyleSheet,
  // //   Text,
  // //   TextInput,
  // //   TouchableOpacity,
  // //   View,
  // //
// } from 'react-native';
// // import { useSignup } from '../context/SignupContext';
// 
// // export default function LoginScreen() {
// //   const BASE_URL = Constants.expoConfig?.extra?.BASE_URL;
// //   const params = useLocalSearchParams();
// //   const { setSignupData } = useSignup();
// //   const router = useRouter();
// 
// //   const userType = params.userType === 'seller' ? 'seller' : 'buyer';
// //   const isSeller = userType === 'seller';
// 
// //   const [loginBusy, setLoginBusy] = useState(false);
// //   const [email, setEmail] = useState('');
// //   const [password, setPassword] = useState('');
// //   const [secureEntry, setSecureEntry] = useState(true);
// 
// //   const isValid = email.trim() !== '' && password.trim() !== '';
// 
// //   const theme = {
// //     title: isSeller ? 'Seller Login' : 'Buyer Login',
// //     subtitle: isSeller
// //       ? 'Manage pharmacy orders easily'
// //       : 'Order medicines at your doorstep',
// //     icon: isSeller ? 'storefront-outline' : 'pill',
// //     accent: isSeller ? '#2563eb' : '#059669',
// //     gradient: isSeller
// //       ? (['#3b82f6', '#2563eb'] as const)
// //       : (['#10b981', '#059669'] as const),
// //     tint: isSeller ? '#eff6ff' : '#ecfdf5',
// //   };
// 
// //   const handleNext = async () => {
// //     if (!email || !password) {
// //       alert('Please enter email and password');
// //       return;
// //     }
// 
// //     try {
// //       setLoginBusy(true);
// 
// //       const loginUrl =
// //         userType === 'seller'
// //           ? `${BASE_URL}/api/store/login/`
// //           : `${BASE_URL}/api/user/login/`;
// 
// //       const response = await fetch(loginUrl, {
// //         method: 'POST',
// //         headers: { 'Content-Type': 'application/json' },
// //         body: JSON.stringify({ email, password }),
// //       });
// 
// //       const data = await response.json();
// 
// //       if (!response.ok) {
// //         alert(data?.detail || 'Login failed! Please check your credentials.');
// //         return;
// //       }
// 
// //       await SecureStore.setItemAsync('authToken', data.token);
// //       await SecureStore.setItemAsync('userType', data.user_type);
// 
// //       const userId =
// //         data.user_type === 'store'
// //           ? data.store_id
// //           : data.user_type === 'user'
// //             ? data.user_id
// //             : null;
// 
// //       if (userId) {
// //         await SecureStore.setItemAsync('userId', userId.toString());
// //       }
// 
// //       if (data.user_type === 'user') {
// //         router.replace('/(tabs)');
// //       } else if (data.user_type === 'store') {
// //         router.replace('/(sellerTabs)/home' as any);
// //       }
// //     } catch (error) {
// //       console.error('Login error:', error);
// //       alert('Something went wrong. Please try again.');
// //     } finally {
// //       setLoginBusy(false);
// //     }
// //   };
// 
// //   const handleSignup = () => {
// //     if (userType === 'buyer') {
// //       router.push({
// //         pathname: '/onboarding/buyer-signup-step1',
// //         params: { userType },
// //       });
// //     } else {
// //       router.push({
// //         pathname: '/onboarding/seller-signup-step1',
// //         params: { userType },
// //       });
// //     }
// //   };
// 
// //   useEffect(() => {
// //     setSignupData({
// //       name: '',
// //       mobile: '',
// //       email: '',
// //       password: '',
// //       ownerName: '',
// //       address: '',
// //       pincode: '',
// //       gstNumber: '',
// //       drugLicense: '',
// //     });
// //   }, []);
// 
// //   return (
// //     <View className="flex-1 bg-slate-50">
// //       <LinearGradient
// //         colors={['#f0fdf4', '#ecfeff', '#eff6ff']}
// //         start={{ x: 0, y: 0 }}
// //         end={{ x: 1, y: 1 }}
// //         style={StyleSheet.absoluteFillObject}
// //       />
// 
// //       <View className="flex-1 px-6 pt-0">
// //         <TouchableOpacity
// //           disabled={loginBusy}
// //           onPress={() => router.push('/onboarding')}
// //           className="mb-0 h-11 w-11 items-center justify-center rounded-full bg-white"
// //           style={styles.softShadow}
// //         >
// //           <Feather name="arrow-left" size={22} color="#334155" />
// //         </TouchableOpacity>
// //         <View className="items-center">
// //           <View
// //             className="mb-5 h-[78px] w-[78px] items-center justify-center rounded-[30px] bg-white"
// //             style={[styles.iconShadow, { shadowColor: theme.accent }]}
// //           >
// //             <MaterialCommunityIcons
// //               name={theme.icon as any}
// //               size={38}
// //               color={theme.accent}
// //             />
// //           </View>
// 
// //           <Text className="text-center text-[31px] font-black text-slate-950">
// //             {theme.title}
// //           </Text>
// 
// //           <Text className="mt-2 text-center text-[15px] font-bold text-slate-500">
// //             {theme.subtitle}
// //           </Text>
// //         </View>
// 
// //         <View
// //           className="mt-9 rounded-[30px] border border-white bg-white/80 px-5 py-6"
// //           style={styles.cardShadow}
// //         >
// //           <View className="mb-4 flex-row items-center rounded-2xl border border-slate-200 bg-slate-50 px-4">
// //             <Feather name="mail" size={20} color="#64748b" />
// //             <TextInput
// //               placeholder="Email address"
// //               value={email}
// //               onChangeText={setEmail}
// //               className="ml-3 flex-1 py-4 text-base font-semibold text-slate-900"
// //               keyboardType="email-address"
// //               autoCapitalize="none"
// //               placeholderTextColor="#94a3b8"
// //             />
// //           </View>
// 
// //           <View className="mb-5 flex-row items-center rounded-2xl border border-slate-200 bg-slate-50 px-4">
// //             <Feather name="lock" size={20} color="#64748b" />
// //             <TextInput
// //               placeholder="Password"
// //               value={password}
// //               onChangeText={setPassword}
// //               secureTextEntry={secureEntry}
// //               className="ml-3 flex-1 py-4 pr-3 text-base font-semibold text-slate-900"
// //               placeholderTextColor="#94a3b8"
// //             />
// //             <TouchableOpacity onPress={() => setSecureEntry(!secureEntry)}>
// //               <Feather
// //                 name={secureEntry ? 'eye-off' : 'eye'}
// //                 size={20}
// //                 color="#64748b"
// //               />
// //             </TouchableOpacity>
// //           </View>
// 
// //           <TouchableOpacity
// //             onPress={handleNext}
// //             disabled={!isValid || loginBusy}
// //             activeOpacity={0.9}
// //             className="overflow-hidden rounded-2xl"
// //             style={isValid && !loginBusy ? styles.buttonShadow : undefined}
// //           >
// //             <LinearGradient
// //               colors={
// //                 isValid && !loginBusy
// //                   ? theme.gradient
// //                   : ['#cbd5e1', '#94a3b8']
// //               }
// //               start={{ x: 0, y: 0 }}
// //               end={{ x: 1, y: 0 }}
// //               className="flex-row items-center justify-center py-4"
// //             >
// //               {loginBusy ? (
// //                 <>
// //                   <Text className="mr-2 text-base font-black text-white">
// //                     Logging in
// //                   </Text>
// //                   <ActivityIndicator color="#ffffff" />
// //                 </>
// //               ) : (
// //                 <>
// //                   <Text className="text-base font-black text-white">
// //                     Login
// //                   </Text>
// //                   <Feather
// //                     name="arrow-right"
// //                     size={20}
// //                     color="#ffffff"
// //                     style={{ marginLeft: 8 }}
// //                   />
// //                 </>
// //               )}
// //             </LinearGradient>
// //           </TouchableOpacity>
// 
// //           <Text className="mt-5 text-center text-sm font-semibold text-slate-500">
// //             Don’t have an account?{' '}
// //             <Text
// //               onPress={loginBusy ? undefined : handleSignup}
// //               style={{ color: loginBusy ? '#cbd5e1' : theme.accent }}
// //               className="font-black"
// //             >
// //               Sign up
// //             </Text>
// //           </Text>
// //         </View>
// 
// //         <View className="mt-7 flex-row items-center justify-center gap-3">
// //           <View className="h-3 w-3 rounded-full bg-slate-300" />
// //           <View
// //             className="h-3 w-8 rounded-full"
// //             style={{ backgroundColor: theme.accent }}
// //           />
// //         </View>
// //       </View>
// //     </View>
// //   );
// // }
// 
// // const styles = StyleSheet.create({
// //   softShadow: {
// //     elevation: 5,
// //     shadowColor: '#94a3b8',
// //     shadowOffset: { width: 0, height: 8 },
// //     shadowOpacity: 0.15,
// //     shadowRadius: 14,
// //   },
// //   iconShadow: {
// //     elevation: 8,
// //     shadowOffset: { width: 0, height: 10 },
// //     shadowOpacity: 0.18,
// //     shadowRadius: 18,
// //   },
// //   cardShadow: {
// //     elevation: 10,
// //     shadowColor: '#94a3b8',
// //     shadowOffset: { width: 0, height: 14 },
// //     shadowOpacity: 0.18,
// //     shadowRadius: 24,
// //   },
// //   buttonShadow: {
// //     elevation: 8,
// //     shadowColor: '#059669',
// //     shadowOffset: { width: 0, height: 10 },
// //     shadowOpacity: 0.25,
// //     shadowRadius: 18,
// //   },
// // });
// 
// // import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
// // import Constants from 'expo-constants';
// // import { LinearGradient } from 'expo-linear-gradient';
// // import { useLocalSearchParams, useRouter } from 'expo-router';
// // import * as SecureStore from 'expo-secure-store';
// // import React, { useEffect, useState } from 'react';
// // import {
  // //   ActivityIndicator,
  // //   KeyboardAvoidingView,
  // //   Platform,
  // //   ScrollView,
  // //   StyleSheet,
  // //   Text,
  // //   TextInput,
  // //   TouchableOpacity,
  // //   View,
  // //
// } from 'react-native';
// // import { useSignup } from '../context/SignupContext';
// 
// // export default function LoginScreen() {
// //   const BASE_URL = Constants.expoConfig?.extra?.BASE_URL;
// //   const params = useLocalSearchParams();
// //   const { setSignupData } = useSignup();
// //   const router = useRouter();
// 
// //   const userType = params.userType === 'seller' ? 'seller' : 'buyer';
// //   const isSeller = userType === 'seller';
// 
// //   const [loginBusy, setLoginBusy] = useState(false);
// //   const [email, setEmail] = useState('');
// //   const [password, setPassword] = useState('');
// //   const [secureEntry, setSecureEntry] = useState(true);
// 
// //   const isValid = email.trim() !== '' && password.trim() !== '';
// 
// //   const theme = {
// //     title: isSeller ? 'Welcome Seller' : 'Welcome Buyer',
// //     subtitle: isSeller
// //       ? 'Grow your pharmacy with smart orders'
// //       : 'Get medicines delivered safely',
// //     icon: isSeller ? 'storefront-outline' : 'pill',
// //     accent: isSeller ? '#2563eb' : '#059669',
// //     gradient: isSeller
// //       ? (['#60a5fa', '#2563eb'] as const)
// //       : (['#34d399', '#059669'] as const),
// //     chip: isSeller ? 'Pharmacy Partner' : 'Medicine Delivery',
// //   };
// 
// //   const handleNext = async () => {
// //     if (!isValid) {
// //       alert('Please enter email and password');
// //       return;
// //     }
// 
// //     try {
// //       setLoginBusy(true);
// 
// //       const loginUrl =
// //         userType === 'seller'
// //           ? `${BASE_URL}/api/store/login/`
// //           : `${BASE_URL}/api/user/login/`;
// 
// //       const response = await fetch(loginUrl, {
// //         method: 'POST',
// //         headers: { 'Content-Type': 'application/json' },
// //         body: JSON.stringify({ email, password }),
// //       });
// 
// //       const data = await response.json();
// 
// //       if (!response.ok) {
// //         alert(data?.detail || 'Login failed! Please check your credentials.');
// //         return;
// //       }
// 
// //       await SecureStore.setItemAsync('authToken', data.token);
// //       await SecureStore.setItemAsync('userType', data.user_type);
// 
// //       const userId =
// //         data.user_type === 'store'
// //           ? data.store_id
// //           : data.user_type === 'user'
// //             ? data.user_id
// //             : null;
// 
// //       if (userId) {
// //         await SecureStore.setItemAsync('userId', userId.toString());
// //       }
// 
// //       if (data.user_type === 'user') {
// //         router.replace('/(tabs)');
// //       } else if (data.user_type === 'store') {
// //         router.replace('/(sellerTabs)/home' as any);
// //       }
// //     } catch (error) {
// //       console.error('Login error:', error);
// //       alert('Something went wrong. Please try again.');
// //     } finally {
// //       setLoginBusy(false);
// //     }
// //   };
// 
// //   const handleSignup = () => {
// //     router.push({
// //       pathname:
// //         userType === 'buyer'
// //           ? '/onboarding/buyer-signup-step1'
// //           : '/onboarding/seller-signup-step1',
// //       params: { userType },
// //     });
// //   };
// 
// //   useEffect(() => {
// //     setSignupData({
// //       name: '',
// //       mobile: '',
// //       email: '',
// //       password: '',
// //       ownerName: '',
// //       address: '',
// //       pincode: '',
// //       gstNumber: '',
// //       drugLicense: '',
// //     });
// //   }, []);
// 
// //   return (
// //     <View className="flex-1 bg-slate-50">
// //       <LinearGradient
// //         colors={['#f0fdf4', '#ecfeff', '#eff6ff']}
// //         start={{ x: 0, y: 0 }}
// //         end={{ x: 1, y: 1 }}
// //         style={StyleSheet.absoluteFillObject}
// //       />
// 
// //       <KeyboardAvoidingView
// //         className="flex-1"
// //         behavior={Platform.OS === 'ios' ? 'padding' : undefined}
// //       >
// //         <ScrollView
// //           keyboardShouldPersistTaps="handled"
// //           showsVerticalScrollIndicator={false}
// //           contentContainerStyle={styles.scrollContent}
// //         >
// //           <View className="flex-1 px-6 pt-12">
// //             <TouchableOpacity
// //               disabled={loginBusy}
// //               onPress={() => router.push('/onboarding')}
// //               className="h-11 w-11 items-center justify-center rounded-full bg-white/90"
// //               style={styles.softShadow}
// //             >
// //               <Feather name="arrow-left" size={22} color="#334155" />
// //             </TouchableOpacity>
// 
// //             <View className="mt-6 items-center">
// //               <LinearGradient
// //                 colors={theme.gradient}
// //                 className={`h-[92px] w-[92px] items-center justify-center ${isSeller ? 'rounded-[34px]' : 'rounded-full'
// //                   }`}
// //                 style={styles.heroShadow}
// //               >
// //                 <MaterialCommunityIcons
// //                   name={theme.icon as any}
// //                   size={44}
// //                   color="#ffffff"
// //                 />
// //               </LinearGradient>
// 
// //               <View className="mt-5 rounded-full border border-white bg-white/80 px-4 py-2">
// //                 <Text
// //                   className="text-xs font-black"
// //                   style={{ color: theme.accent }}
// //                 >
// //                   {theme.chip}
// //                 </Text>
// //               </View>
// 
// //               <Text className="mt-5 text-center text-[34px] font-black leading-10 text-slate-950">
// //                 {theme.title}
// //               </Text>
// 
// //               <Text className="mt-2 text-center text-[15px] font-bold text-slate-500">
// //                 {theme.subtitle}
// //               </Text>
// //             </View>
// 
// //             <View
// //               className="mt-8 rounded-[34px] border border-white bg-white/85 p-5"
// //               style={styles.cardShadow}
// //             >
// //               <View className="mb-4 flex-row items-center rounded-[22px] border border-slate-100 bg-slate-50 px-4">
// //                 <Feather name="mail" size={20} color="#64748b" />
// 
// //                 <TextInput
// //                   placeholder="Email address"
// //                   value={email}
// //                   onChangeText={setEmail}
// //                   className="ml-3 flex-1 py-4 text-base font-semibold text-slate-900"
// //                   keyboardType="email-address"
// //                   autoCapitalize="none"
// //                   placeholderTextColor="#94a3b8"
// //                 />
// //               </View>
// 
// //               <View className="mb-5 flex-row items-center rounded-[22px] border border-slate-100 bg-slate-50 px-4">
// //                 <Feather name="lock" size={20} color="#64748b" />
// 
// //                 <TextInput
// //                   placeholder="Password"
// //                   value={password}
// //                   onChangeText={setPassword}
// //                   secureTextEntry={secureEntry}
// //                   className="ml-3 flex-1 py-4 text-base font-semibold text-slate-900"
// //                   placeholderTextColor="#94a3b8"
// //                 />
// 
// //                 <TouchableOpacity onPress={() => setSecureEntry(!secureEntry)}>
// //                   <Feather
// //                     name={secureEntry ? 'eye-off' : 'eye'}
// //                     size={20}
// //                     color="#64748b"
// //                   />
// //                 </TouchableOpacity>
// //               </View>
// 
// //               <TouchableOpacity
// //                 onPress={handleNext}
// //                 disabled={!isValid || loginBusy}
// //                 activeOpacity={0.9}
// //                 className="overflow-hidden rounded-[22px]"
// //                 style={isValid && !loginBusy ? styles.buttonShadow : undefined}
// //               >
// //                 <LinearGradient
// //                   colors={
// //                     isValid && !loginBusy
// //                       ? theme.gradient
// //                       : ['#cbd5e1', '#94a3b8']
// //                   }
// //                   start={{ x: 0, y: 0 }}
// //                   end={{ x: 1, y: 0 }}
// //                   className="flex-row items-center justify-center py-[17px]"
// //                 >
// //                   {loginBusy ? (
// //                     <>
// //                       <Text className="mr-2 text-base font-black text-white">
// //                         Logging in
// //                       </Text>
// //                       <ActivityIndicator color="#ffffff" />
// //                     </>
// //                   ) : (
// //                     <>
// //                       <Text className="text-base font-black text-white">
// //                         Login
// //                       </Text>
// //                       <Feather
// //                         name="arrow-right"
// //                         size={20}
// //                         color="#ffffff"
// //                         style={{ marginLeft: 8 }}
// //                       />
// //                     </>
// //                   )}
// //                 </LinearGradient>
// //               </TouchableOpacity>
// 
// //               <Text className="mt-5 text-center text-sm font-semibold text-slate-500">
// //                 Don’t have an account?{' '}
// //                 <Text
// //                   onPress={loginBusy ? undefined : handleSignup}
// //                   className="font-black"
// //                   style={{ color: loginBusy ? '#cbd5e1' : theme.accent }}
// //                 >
// //                   Sign up
// //                 </Text>
// //               </Text>
// //             </View>
// //           </View>
// //         </ScrollView>
// //       </KeyboardAvoidingView>
// //     </View>
// //   );
// // }
// 
// // const styles = StyleSheet.create({
// //   scrollContent: {
// //     flexGrow: 1,
// //     paddingBottom: 30,
// //   },
// //   softShadow: {
// //     elevation: 5,
// //     shadowColor: '#94a3b8',
// //     shadowOffset: { width: 0, height: 8 },
// //     shadowOpacity: 0.16,
// //     shadowRadius: 14,
// //   },
// //   heroShadow: {
// //     elevation: 12,
// //     shadowColor: '#059669',
// //     shadowOffset: { width: 0, height: 16 },
// //     shadowOpacity: 0.25,
// //     shadowRadius: 24,
// //   },
// //   cardShadow: {
// //     elevation: 12,
// //     shadowColor: '#94a3b8',
// //     shadowOffset: { width: 0, height: 18 },
// //     shadowOpacity: 0.2,
// //     shadowRadius: 28,
// //   },
// //   buttonShadow: {
// //     elevation: 9,
// //     shadowColor: '#059669',
// //     shadowOffset: { width: 0, height: 12 },
// //     shadowOpacity: 0.28,
// //     shadowRadius: 20,
// //   },
// // });
// 
// import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
// import Constants from 'expo-constants';
// import { LinearGradient } from 'expo-linear-gradient';
// import { useLocalSearchParams, useRouter } from 'expo-router';
// import * as SecureStore from 'expo-secure-store';
// import React, { useEffect, useState } from 'react';
// import {
  //   ActivityIndicator,
  //   KeyboardAvoidingView,
  //   Platform,
  //   ScrollView,
  //   StyleSheet,
  //   Text,
  //   TextInput,
  //   TouchableOpacity,
  //   View,
  //
// } from 'react-native';
// import { useSignup } from '../context/SignupContext';
// 
// export default function LoginScreen() {
//   const BASE_URL = Constants.expoConfig?.extra?.BASE_URL;
//   const params = useLocalSearchParams();
//   const { setSignupData } = useSignup();
//   const router = useRouter();
// 
//   const userType = params.userType === 'seller' ? 'seller' : 'buyer';
//   const isSeller = userType === 'seller';
// 
//   const [loginBusy, setLoginBusy] = useState(false);
//   const [email, setEmail] = useState('');
//   const [password, setPassword] = useState('');
//   const [secureEntry, setSecureEntry] = useState(true);
// 
//   const isValid = email.trim() !== '' && password.trim() !== '';
// 
//   const theme = {
//     title: isSeller ? 'Seller Login' : 'Buyer Login',
//     subtitle: isSeller
//       ? 'Manage your pharmacy orders faster'
//       : 'Order medicines safely at your doorstep',
//     icon: isSeller ? 'storefront-outline' : 'pill',
//     accent: isSeller ? '#2563eb' : '#059669',
//     gradient: isSeller
//       ? (['#60a5fa', '#2563eb'] as const)
//       : (['#34d399', '#059669'] as const),
//     chip: isSeller ? 'Pharmacy Partner' : 'Medicine Delivery',
//   };
// 
//   const handleNext = async () => {
//     if (!isValid) {
//       alert('Please enter email and password');
//       return;
//     }
// 
//     try {
//       setLoginBusy(true);
// 
//       const loginUrl =
//         userType === 'seller'
//           ? `${BASE_URL}/api/store/login/`
//           : `${BASE_URL}/api/user/login/`;
// 
//       const response = await fetch(loginUrl, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ email, password }),
//       });
// 
//       const data = await response.json();
// 
//       if (!response.ok) {
//         alert(data?.detail || 'Login failed! Please check your credentials.');
//         return;
//       }
// 
//       await SecureStore.setItemAsync('authToken', data.token);
//       await SecureStore.setItemAsync('userType', data.user_type);
// 
//       const userId =
//         data.user_type === 'store'
//           ? data.store_id
//           : data.user_type === 'user'
//             ? data.user_id
//             : null;
// 
//       if (userId) {
//         await SecureStore.setItemAsync('userId', userId.toString());
//       }
// 
//       if (data.user_type === 'user') {
//         router.replace('/(tabs)');
//       } else if (data.user_type === 'store') {
//         router.replace('/(sellerTabs)/home' as any);
//       }
//     } catch (error) {
//       console.error('Login error:', error);
//       alert('Something went wrong. Please try again.');
//     } finally {
//       setLoginBusy(false);
//     }
//   };
// 
//   const handleSignup = () => {
//     router.push({
//       pathname:
//         userType === 'buyer'
//           ? '/onboarding/buyer-signup-step1'
//           : '/onboarding/seller-signup-step1',
//       params: { userType },
//     });
//   };
// 
//   useEffect(() => {
//     setSignupData({
//       name: '',
//       mobile: '',
//       email: '',
//       password: '',
//       ownerName: '',
//       address: '',
//       pincode: '',
//       gstNumber: '',
//       drugLicense: '',
//     });
//   }, []);
// 
//   return (
//     <View className="flex-1 bg-slate-50">
//       <LinearGradient
//         colors={['#f0fdf4', '#ecfeff', '#eff6ff']}
//         start={{ x: 0, y: 0 }}
//         end={{ x: 1, y: 1 }}
//         style={StyleSheet.absoluteFillObject}
//       />
// 
//       <View className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-emerald-200/40" />
//       <View className="absolute -left-16 top-28 h-44 w-44 rounded-full bg-sky-200/40" />
// 
//       <KeyboardAvoidingView
//         className="flex-1"
//         behavior={Platform.OS === 'ios' ? 'padding' : undefined}
//       >
//         <ScrollView
//           keyboardShouldPersistTaps="handled"
//           showsVerticalScrollIndicator={false}
//           contentContainerStyle={styles.scrollContent}
//         >
//           <View className="flex-1 px-6 pt-0">
//             <View className="flex-row items-center justify-between">
//               <TouchableOpacity
//                 disabled={loginBusy}
//                 onPress={() => router.push('/onboarding')}
//                 className="h-11 w-11 items-center justify-center rounded-full bg-white/90"
//                 style={styles.softShadow}
//               >
//                 <Feather name="arrow-left" size={22} color="#334155" />
//               </TouchableOpacity>
// 
//               <View className="rounded-full bg-white p-2" style={styles.iconOuterShadow}>
//                 <LinearGradient
//                   colors={theme.gradient}
//                   start={{ x: 0, y: 0 }}
//                   end={{ x: 1, y: 1 }}
//                   style={styles.heroCircle}
//                 >
//                   <MaterialCommunityIcons
//                     name={theme.icon as any}
//                     size={43}
//                     color="#ffffff"
//                   />
//                 </LinearGradient>
//               </View>
// 
//               <View className="h-11 w-11" />
//             </View>
// 
//             <View className="items-center">
//               <View className="mt-5 flex-row items-center rounded-full border border-white bg-white/80 px-4 py-2">
//                 <MaterialCommunityIcons
//                   name="shield-check-outline"
//                   size={15}
//                   color={theme.accent}
//                 />
//                 <Text
//                   className="ml-1.5 text-xs font-black"
//                   style={{ color: theme.accent }}
//                 >
//                   {theme.chip}
//                 </Text>
//               </View>
// 
//               <Text className="mt-5 text-center text-[34px] font-black leading-10 text-slate-950">
//                 {theme.title}
//               </Text>
// 
//               <Text className="mt-2 text-center text-[15px] font-bold leading-5 text-slate-500">
//                 {theme.subtitle}
//               </Text>
//             </View>
// 
//             <View
//               className="mt-8 rounded-[34px] border border-white bg-white/90 p-5"
//               style={styles.cardShadow}
//             >
// 
//               <View className="mb-4 flex-row items-center rounded-[22px] border border-slate-100 bg-slate-50 px-4">
//                 <View className="h-9 w-9 items-center justify-center rounded-full bg-white">
//                   <Feather name="mail" size={18} color="#64748b" />
//                 </View>
// 
//                 <TextInput
//                   placeholder="Email address"
//                   value={email}
//                   onChangeText={setEmail}
//                   className="ml-3 flex-1 py-4 text-base font-semibold text-slate-900"
//                   keyboardType="email-address"
//                   autoCapitalize="none"
//                   placeholderTextColor="#94a3b8"
//                 />
//               </View>
// 
//               <View className="mb-5 flex-row items-center rounded-[22px] border border-slate-100 bg-slate-50 px-4">
//                 <View className="h-9 w-9 items-center justify-center rounded-full bg-white">
//                   <Feather name="lock" size={18} color="#64748b" />
//                 </View>
// 
//                 <TextInput
//                   placeholder="Password"
//                   value={password}
//                   onChangeText={setPassword}
//                   secureTextEntry={secureEntry}
//                   className="ml-3 flex-1 py-4 pr-3 text-base font-semibold text-slate-900"
//                   placeholderTextColor="#94a3b8"
//                 />
// 
//                 <TouchableOpacity onPress={() => setSecureEntry(!secureEntry)}>
//                   <Feather
//                     name={secureEntry ? 'eye-off' : 'eye'}
//                     size={20}
//                     color="#64748b"
//                   />
//                 </TouchableOpacity>
//               </View>
// 
//               <TouchableOpacity
//                 onPress={handleNext}
//                 disabled={!isValid || loginBusy}
//                 activeOpacity={0.9}
//                 className="overflow-hidden rounded-[22px]"
//                 style={isValid && !loginBusy ? styles.buttonShadow : undefined}
//               >
//                 <LinearGradient
//                   colors={
//                     isValid && !loginBusy
//                       ? theme.gradient
//                       : ['#cbd5e1', '#94a3b8']
//                   }
//                   start={{ x: 0, y: 0 }}
//                   end={{ x: 1, y: 0 }}
//                   className="flex-row items-center justify-center py-[17px]"
//                 >
//                   {loginBusy ? (
//                     <>
//                       <Text className="mr-2 text-base font-black text-white">
//                         Logging in
//                       </Text>
//                       <ActivityIndicator color="#ffffff" />
//                     </>
//                   ) : (
//                     <>
//                       <Text className="text-base font-black text-white">
//                         Login
//                       </Text>
//                       <Feather
//                         name="arrow-right"
//                         size={20}
//                         color="#ffffff"
//                         style={{ marginLeft: 8 }}
//                       />
//                     </>
//                   )}
//                 </LinearGradient>
//               </TouchableOpacity>
// 
//               <Text className="mt-5 text-center text-sm font-semibold text-slate-500">
//                 Don’t have an account?{' '}
//                 <Text
//                   onPress={loginBusy ? undefined : handleSignup}
//                   className="font-black"
//                   style={{ color: loginBusy ? '#cbd5e1' : theme.accent }}
//                 >
//                   Sign up
//                 </Text>
//               </Text>
//             </View>
// 
//             <View className="mt-7 flex-row items-center justify-center gap-3">
//               <View className="h-3 w-3 rounded-full bg-slate-300" />
//               <View
//                 className="h-3 w-8 rounded-full"
//                 style={{ backgroundColor: theme.accent }}
//               />
//             </View>
//           </View>
//         </ScrollView>
//       </KeyboardAvoidingView>
//     </View>
//   );
// }
// 
// const styles = StyleSheet.create({
//   scrollContent: {
//     flexGrow: 1,
//     paddingBottom: 30,
//   },
//   softShadow: {
//     elevation: 5,
//     shadowColor: '#94a3b8',
//     shadowOffset: { width: 0, height: 8 },
//     shadowOpacity: 0.16,
//     shadowRadius: 14,
//   },
//   iconOuterShadow: {
//     elevation: 12,
//     shadowColor: '#059669',
//     shadowOffset: { width: 0, height: 14 },
//     shadowOpacity: 0.22,
//     shadowRadius: 22,
//   },
//   heroCircle: {
//     width: 92,
//     height: 92,
//     borderRadius: 46,
//     alignItems: 'center',
//     justifyContent: 'center',
//     overflow: 'hidden',
//   },
//   cardShadow: {
//     elevation: 14,
//     shadowColor: '#94a3b8',
//     shadowOffset: { width: 0, height: 18 },
//     shadowOpacity: 0.22,
//     shadowRadius: 30,
//   },
//   buttonShadow: {
//     elevation: 10,
//     shadowColor: '#059669',
//     shadowOffset: { width: 0, height: 12 },
//     shadowOpacity: 0.28,
//     shadowRadius: 20,
//   },
// });
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import { useSignup } from '../context/SignupContext';

const { width, height } = Dimensions.get('window');
const isSmallPhone = width < 380 || height < 700;

export default function LoginScreen() {
  const BASE_URL = Constants.expoConfig?.extra?.BASE_URL;
  const params = useLocalSearchParams();
  const { setSignupData } = useSignup();
  const router = useRouter();

  const userType = params.userType === 'seller' ? 'seller' : 'buyer';
  const isSeller = userType === 'seller';

  const [loginBusy, setLoginBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secureEntry, setSecureEntry] = useState(true);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [signupBusy, setSignupBusy] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const isValid = email.trim() !== '' && password.trim() !== '';

  const theme = {
    title: isSeller ? 'Seller Login' : 'Buyer Login',
    subtitle: isSeller
      ? 'Manage pharmacy orders faster'
      : 'Order medicines safely',
    icon: isSeller ? 'storefront-outline' : 'pill',
    accent: isSeller ? '#2563eb' : '#059669',
    gradient: isSeller
      ? (['#60a5fa', '#2563eb'] as const)
      : (['#34d399', '#059669'] as const),
    chip: isSeller ? 'Pharmacy Partner' : 'Medicine Delivery',
  };

  const handleNext = async () => {
    if (!isValid) {
      alert('Please enter email and password');
      return;
    }

    try {
      setLoginBusy(true);

      const loginUrl =
        userType === 'seller'
          ? `${BASE_URL}/api/store/login/`
          : `${BASE_URL}/api/user/login/`;

      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data?.detail || 'Login failed! Please check your credentials.');
        return;
      }

      await SecureStore.setItemAsync('authToken', data.token);
      await SecureStore.setItemAsync('userType', data.user_type);

      const userId =
        data.user_type === 'store'
          ? data.store_id
          : data.user_type === 'user'
            ? data.user_id
            : null;

      if (userId) {
        await SecureStore.setItemAsync('userId', userId.toString());
      }

      if (data.user_type === 'user') {
        router.replace('/(tabs)');
      } else if (data.user_type === 'store') {
        router.replace('/(sellerTabs)/home' as any);
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('Something went wrong. Please try again.');
    } finally {
      setLoginBusy(false);
    }
  };

  const handleSignup = () => {
    if (signupBusy || loginBusy) return;

    setSignupBusy(true);
    router.push({
      pathname:
        userType === 'buyer'
          ? '/onboarding/buyer-signup-step1'
          : '/onboarding/seller-signup-step1',
      params: { userType },
    });
  };

  useEffect(() => {
    setSignupData({
      name: '',
      mobile: '',
      email: '',
      password: '',
      ownerName: '',
      address: '',
      pincode: '',
      gstNumber: '',
      drugLicense: '',
    });
  }, [setSignupData]);


  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const scrollInputIntoView = () => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: isSmallPhone ? 150 : 120,
        animated: true,
      });
    }, 120);
  };

  return (
    <View className="flex-1 bg-slate-50">
      <LinearGradient
        colors={['#f0fdf4', '#ecfeff', '#eff6ff']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <View className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-200/40" />
      <View className="absolute -left-14 top-24 h-36 w-36 rounded-full bg-sky-200/40" />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            keyboardVisible && styles.keyboardScrollContent,
          ]}
          keyboardDismissMode="on-drag"
        >
          <View className="flex-1 px-5">
            <View className="flex-row items-center justify-between">
              <TouchableOpacity
                disabled={loginBusy}
                onPress={() => router.push('/onboarding')}
                className="h-10 w-10 items-center justify-center rounded-full bg-white/90"
                style={styles.softShadow}
              >
                <Feather name="arrow-left" size={21} color="#334155" />
              </TouchableOpacity>

              <View className="rounded-full bg-white p-1.5" style={styles.iconOuterShadow}>
                <LinearGradient
                  colors={theme.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.heroCircle}
                >
                  <MaterialCommunityIcons
                    name={theme.icon as any}
                    size={isSmallPhone ? 34 : 38}
                    color="#ffffff"
                  />
                </LinearGradient>
              </View>

              <View className="h-10 w-10" />
            </View>

            <View className="items-center">
              <View className="mt-4 flex-row items-center rounded-full border border-white bg-white/80 px-3.5 py-1.5">
                <MaterialCommunityIcons
                  name="shield-check-outline"
                  size={14}
                  color={theme.accent}
                />
                <Text className="ml-1.5 text-[11px] font-black" style={{ color: theme.accent }}>
                  {theme.chip}
                </Text>
              </View>

              <Text className="mt-4 text-center text-[28px] font-black leading-9 text-slate-950">
                {theme.title}
              </Text>

              <Text className="mt-1.5 text-center text-[14px] font-bold leading-5 text-slate-500">
                {theme.subtitle}
              </Text>
            </View>

            <View
              className="mt-6 rounded-[28px] border border-white bg-white/90 p-4"
              style={styles.cardShadow}
            >
              <View className="mb-3.5 flex-row items-center rounded-[20px] border border-slate-100 bg-slate-50 px-3.5">
                <View className="h-8 w-8 items-center justify-center rounded-full bg-white">
                  <Feather name="mail" size={17} color="#64748b" />
                </View>

                <TextInput
                  placeholder="Email address"
                  value={email}
                  onChangeText={setEmail}
                  className="ml-3 flex-1 py-3.5 text-[15px] font-semibold text-slate-900"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholderTextColor="#94a3b8"
                  returnKeyType="next"
                  onFocus={scrollInputIntoView}
                />
              </View>

              <View className="mb-4 flex-row items-center rounded-[20px] border border-slate-100 bg-slate-50 px-3.5">
                <View className="h-8 w-8 items-center justify-center rounded-full bg-white">
                  <Feather name="lock" size={17} color="#64748b" />
                </View>

                <TextInput
                  placeholder="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={secureEntry}
                  className="ml-3 flex-1 py-3.5 pr-3 text-[15px] font-semibold text-slate-900"
                  placeholderTextColor="#94a3b8"
                  returnKeyType="done"
                  onFocus={scrollInputIntoView}
                />

                <TouchableOpacity onPress={() => setSecureEntry(!secureEntry)}>
                  <Feather
                    name={secureEntry ? 'eye-off' : 'eye'}
                    size={19}
                    color="#64748b"
                  />
                </TouchableOpacity>
              </View>

              <View className="mb-5 flex-row justify-end px-1">
                <TouchableOpacity onPress={() => router.push({ pathname: '/onboarding/forgot-password', params: { userType } })}>
                  <Text className="text-[13px] font-bold" style={{ color: theme.accent }}>Forgot Password?</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={handleNext}
                disabled={!isValid || loginBusy}
                activeOpacity={0.9}
                className="overflow-hidden rounded-[20px]"
                style={isValid && !loginBusy ? styles.buttonShadow : undefined}
              >
                <LinearGradient
                  colors={
                    isValid && !loginBusy
                      ? theme.gradient
                      : ['#cbd5e1', '#94a3b8']
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  className="flex-row items-center justify-center py-3.5"
                >
                  {loginBusy ? (
                    <>
                      <Text className="mr-2 text-[15px] font-black text-white">
                        Logging in
                      </Text>
                      <ActivityIndicator color="#ffffff" />
                    </>
                  ) : (
                    <>
                      <Text className="text-[15px] font-black text-white">
                        Login
                      </Text>
                      <Feather
                        name="arrow-right"
                        size={19}
                        color="#ffffff"
                        style={{ marginLeft: 8 }}
                      />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <Text className="mt-4 text-center text-[13px] font-semibold text-slate-500">
                Don’t have an account?{' '}
                <Text
                  onPress={loginBusy || signupBusy ? undefined : handleSignup}
                  className="font-black"
                  style={{
                    color: loginBusy || signupBusy ? '#cbd5e1' : theme.accent,
                  }}
                >
                  {signupBusy ? 'Opening' : 'Sign up'}
                </Text>
              </Text>
            </View>

            <View className="mt-5 flex-row items-center justify-center gap-3">
              <View className="h-2.5 w-2.5 rounded-full bg-slate-300" />
              <View
                className="h-2.5 w-7 rounded-full"
                style={{ backgroundColor: theme.accent }}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingTop: isSmallPhone ? 10 : 18,
    paddingBottom: 120,
  },
  keyboardScrollContent: {
    paddingBottom: 300,
  },
  softShadow: {
    elevation: 5,
    shadowColor: '#94a3b8',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
  },
  iconOuterShadow: {
    elevation: 9,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
  },
  heroCircle: {
    width: isSmallPhone ? 70 : 78,
    height: isSmallPhone ? 70 : 78,
    borderRadius: isSmallPhone ? 35 : 39,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cardShadow: {
    elevation: 10,
    shadowColor: '#94a3b8',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
  },
  buttonShadow: {
    elevation: 8,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
  },
});
