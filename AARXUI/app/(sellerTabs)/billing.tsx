import { LocalizedText as Text } from '@/components/Language/LocalizedPrimitives';
import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import axios from 'axios';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../redux/store';
import { fetchUserProfile } from '../../redux/userSlice';
import Toast from 'react-native-toast-message';

import RazorpayCheckout from 'react-native-razorpay';

export default function BillingScreen() {
  const router = useRouter();
  const BASE_URL = Constants.expoConfig?.extra?.BASE_URL;
  const { token, user: storeData } = useSelector((state: RootState) => state.user);
  const dispatch = useDispatch<any>();

  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<any[]>([]);
  const [currentSub, setCurrentSub] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [subscribing, setSubscribing] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [plansRes, subRes, historyRes] = await Promise.all([
        axios.get(`${BASE_URL}/api/subscriptions/plans/`),
        axios.get(`${BASE_URL}/api/subscriptions/my-subscription/`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${BASE_URL}/api/subscriptions/history/`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setPlans(plansRes.data.plans);
      setCurrentSub(subRes.data.subscription_id ? subRes.data : null);
      setHistory(historyRes.data.history || []);
    } catch (error) {
      console.error("Error fetching billing data:", error);
      Toast.show({
        type: 'error',
        text1: 'Failed to load',
        text2: 'Could not fetch billing details.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!currentSub?.subscription_id) return;
    try {
      setSyncing(true);
      await axios.post(
        `${BASE_URL}/api/subscriptions/sync/`,
        { subscription_id: currentSub.subscription_id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchData();
      Toast.show({
        type: 'success',
        text1: 'Synced',
        text2: 'Subscription status updated from Razorpay.'
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Sync Failed',
        text2: 'Could not sync with Razorpay.'
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleSubscribe = async (plan: any) => {
    try {
      setSubscribing(plan.id);
      // 1. Create Subscription on Backend
      const createRes = await axios.post(
        `${BASE_URL}/api/subscriptions/create/`,
        { plan_id: plan.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const subscription_id = createRes.data.subscription_id;

      if (createRes.data.message === 'Resuming existing checkout.') {
        Toast.show({
          type: 'info',
          text1: 'Resuming Checkout',
          text2: 'You already have a pending subscription.'
        });
      }

      // 2. Open Razorpay Checkout
      const options = {
        description: `Subscription to ${plan.name}`,
        image: 'https://cdn-icons-png.flaticon.com/512/3011/3011270.png',
        currency: 'INR',
        key: 'rzp_test_TBsXlkpYDYR8Xj', // Actual Key from .env
        subscription_id: subscription_id,
        name: 'AARX Pharmacy',
        theme: { color: '#059669' }
      };

      try {
        console.log('[Razorpay] Opening checkout with subscription_id:', subscription_id);
        const data = await RazorpayCheckout.open(options);
        console.log('[Razorpay] Payment success:', data);
        handlePaymentSuccess(data.razorpay_subscription_id, data.razorpay_payment_id, data.razorpay_signature);
      } catch (error: any) {
        console.log('[Razorpay] Error/Cancelled:', JSON.stringify(error));
        setSubscribing(null);
        if (error?.code !== 0) { // code 0 = user cancelled, not a real error
          Toast.show({
            type: 'error',
            text1: 'Payment Failed',
            text2: error?.description || 'Payment could not be completed.'
          });
        }
      }

    } catch (error: any) {
      console.log('[Subscribe] API Error:', JSON.stringify(error?.response?.data));
      const errorMsg = error.response?.data?.error || '';

      // ✅ Already active hai toh refresh karo, error mat dikhao
      if (errorMsg.includes('already have an active subscription')) {
        await fetchData();
        dispatch(fetchUserProfile());
        Toast.show({
          type: 'success',
          text1: 'Already Active ✅',
          text2: 'Your premium plan is already running!'
        });
        setSubscribing(null);
        return;
      }

      Toast.show({
        type: 'error',
        text1: 'Subscription Failed',
        text2: errorMsg || 'Could not initiate subscription.'
      });
      setSubscribing(null);
    }
    // Note: setSubscribing(null) is called inside each catch block above.
  };

  const handlePaymentSuccess = async (sub_id: string, pay_id: string, signature: string) => {
    try {
      // Keep loading on the plan that initiated this, but we don't have plan id here easily.
      // So we can just leave it as is, or we can use another state.
      // Actually we don't need setSubscribing(true) inside handlePaymentSuccess since it's already loading from handleSubscribe.
      // We will just let it finish.

      // 3. Verify on Backend
      await axios.post(
        `${BASE_URL}/api/subscriptions/verify/`,
        {
          razorpay_subscription_id: sub_id,
          razorpay_payment_id: pay_id,
          razorpay_signature: signature
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // 4. Refresh Data
      await fetchData();
      dispatch(fetchUserProfile()); // Update store capabilities globally

      Toast.show({
        type: 'success',
        text1: 'Subscription Active',
        text2: 'Welcome to Premium!'
      });

    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Verification Failed',
        text2: 'Payment was made but verification failed. Support will assist.'
      });
    } finally {
      setSubscribing(null);
    }
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp * 1000).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  };

  if (loading) {
    return (
      <View className="flex-1 bg-slate-100 items-center justify-center">
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-100">
      <View className="px-4 pt-2 pb-1">
        <View className="overflow-hidden rounded-[1.45rem] shadow-sm shadow-slate-300">
          <LinearGradient
            colors={["#1e293b", "#0f172a"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="relative min-h-[150px] overflow-hidden px-5 py-5 justify-center"
          >
            <TouchableOpacity
              onPress={() => router.back()}
              className="absolute top-4 left-4 z-20 w-8 h-8 rounded-full bg-white/10 items-center justify-center"
            >
              <Ionicons name="arrow-back" size={18} color="white" />
            </TouchableOpacity>

            <View className="z-10 mt-6">
              <View className="flex-row items-center mb-1">
                <MaterialCommunityIcons name="star-shooting" size={24} color="#fbbf24" />
                <Text className="ml-2 text-[24px] font-black text-white tracking-[1px]">Premium</Text>
              </View>
              <Text className="text-[10px] font-black uppercase tracking-[1.5px] text-emerald-300">
                Unlock AARX Superpowers
              </Text>
            </View>
          </LinearGradient>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 100 }}>

        {/* Current Plan Section */}
        <View className="mb-6">
          <Text className="text-[10px] font-black text-slate-400 uppercase tracking-[4px] ml-2 mb-3">Current Status</Text>

          <View className="bg-white rounded-[1.5rem] shadow-xl shadow-slate-200/40 border border-slate-200/70 p-5">
            {currentSub && currentSub.status === 'active' ? (
              <View>
                <View className="flex-row justify-between items-center mb-4">
                  <View>
                    <Text className="text-xl font-black text-slate-900">{currentSub.plan_name || 'Premium Plan'}</Text>
                    <Text className="text-xs font-bold text-emerald-600 mt-0.5">Active</Text>
                  </View>
                  <View className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 items-center justify-center">
                    <MaterialCommunityIcons name="shield-check" size={24} color="#059669" />
                  </View>
                </View>

                <View className="flex-row justify-between border-t border-slate-100 pt-4">
                  <View>
                    <Text className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Renews On</Text>
                    <Text className="text-sm font-bold text-slate-700">{formatDate(currentSub.current_end)}</Text>
                  </View>
                  <TouchableOpacity onPress={handleSync} disabled={syncing} className="flex-row items-center bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
                    <Ionicons name="sync" size={12} color="#64748b" />
                    <Text className="text-[9px] font-black text-slate-500 uppercase tracking-wider ml-1">
                      {syncing ? 'Syncing...' : 'Sync'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View className="items-center py-4">
                <View className="w-16 h-16 rounded-full bg-slate-50 border border-slate-100 items-center justify-center mb-3">
                  <MaterialCommunityIcons name="store-alert-outline" size={30} color="#94a3b8" />
                </View>
                <Text className="text-base font-black text-slate-800">No Active Subscription</Text>
                <Text className="text-xs font-medium text-slate-500 mt-1 text-center">
                  You are currently on the basic free tier. Upgrade to unlock AI features and higher visibility.
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Available Plans */}
        <View className="mb-6">
          <Text className="text-[10px] font-black text-slate-400 uppercase tracking-[4px] ml-2 mb-3">Available Plans</Text>

          {plans.map((plan) => (
            <View key={plan.id} className="bg-white rounded-[1.5rem] shadow-xl shadow-slate-200/40 border border-emerald-200 p-5 mb-4 relative overflow-hidden">
              <View className="absolute top-0 right-0 bg-emerald-500 px-4 py-1 rounded-bl-xl z-10">
                <Text className="text-[9px] font-black text-white uppercase tracking-wider">Recommended</Text>
              </View>

              <View className="flex-row justify-between items-start mb-4 mt-2">
                <View className="flex-1">
                  <Text className="text-2xl font-black text-slate-900">{plan.name}</Text>
                  <Text className="text-xs font-semibold text-slate-500 mt-1">{plan.description}</Text>
                </View>
                <View className="items-end ml-4">
                  <Text className="text-2xl font-black text-emerald-600">₹{plan.price}</Text>
                  <Text className="text-[10px] font-bold text-slate-400">/ month</Text>
                </View>
              </View>

              <View className="border-t border-slate-100 pt-4 mb-5">
                {plan.features?.length > 0 ? (
                  plan.features.map((feat: string, idx: number) => (
                    <View key={idx} className="flex-row items-center mb-2">
                      <MaterialCommunityIcons name="check-circle" size={16} color="#10b981" />
                      <Text className="text-sm font-medium text-slate-600 ml-2">{feat}</Text>
                    </View>
                  ))
                ) : (
                  <Text className="text-sm text-slate-500 italic">No specific features listed.</Text>
                )}
              </View>

              <TouchableOpacity
                onPress={() => handleSubscribe(plan)}
                disabled={subscribing !== null}
                className="w-full py-4 bg-slate-900 rounded-2xl items-center flex-row justify-center shadow-lg"
              >
                {subscribing === plan.id ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="lightning-bolt" size={18} color="#fbbf24" />
                    <Text className="text-white font-black text-sm uppercase tracking-widest ml-2">Upgrade Now</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ))}

          {plans.length === 0 && (
            <Text className="text-center text-slate-500 text-sm mt-4">No plans available at the moment.</Text>
          )}

        </View>

        {/* Payment History Section */}
        <View className="mb-6">
          <Text className="text-[10px] font-black text-slate-400 uppercase tracking-[4px] ml-2 mb-3">Payment History</Text>

          {history.length > 0 ? (
            <View className="bg-white rounded-[1.5rem] shadow-xl shadow-slate-200/40 border border-slate-200/70 p-5">
              {history.map((item, idx) => (
                <View key={item.id} className={`flex-row justify-between items-center py-3 ${idx !== history.length - 1 ? 'border-b border-slate-100' : ''}`}>
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-slate-800">{item.subscription__plan__name || 'Premium Plan'}</Text>
                    <Text className="text-[10px] font-semibold text-slate-500 mt-1">
                      {new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} • {item.razorpay_payment_id}
                    </Text>
                  </View>
                  <View className="items-end ml-4">
                    <Text className="text-sm font-black text-emerald-600">₹{item.amount}</Text>
                    <Text className={`text-[10px] font-bold mt-0.5 ${item.status === 'captured' ? 'text-emerald-500' : 'text-red-500'}`}>
                      {item.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text className="text-center text-slate-500 text-sm mt-4">No payment history available.</Text>
          )}
        </View>

      </ScrollView>
    </View>
  );
}
