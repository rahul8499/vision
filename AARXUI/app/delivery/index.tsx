import DeliveryDestinationModal from '@/components/DeliveryDestinationModal';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/Language/LocalizedPrimitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, SafeAreaView, ScrollView, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';

type Job = { id:number; stage:'assigned'|'picked_up'|'reached'; customer_name:string; customer_mobile?:string; customer_address:string; latitude:number; longitude:number; store_name:string; store_address:string; completion_otp_requested?:boolean };

export default function DeliveryHomeScreen() {
  const baseUrl = Constants.expoConfig?.extra?.BASE_URL || '';
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mapJob, setMapJob] = useState<Job | null>(null);
  const [otpJob, setOtpJob] = useState<Job | null>(null);
  const [otp, setOtp] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  const auth = async () => ({ Authorization: `Bearer ${await SecureStore.getItemAsync('deliveryAuthToken')}` });
  const fetchJobs = useCallback(async () => {
    try { const response = await fetch(`${baseUrl}/api/delivery/jobs/`, { headers: await auth() }); if (response.status === 401) { router.replace('/delivery/login'); return; } const data = await response.json(); setJobs(data.results || []); }
    catch { Toast.show({ type:'error', text1:'Could not load deliveries' }); }
    finally { setLoading(false); setRefreshing(false); }
  }, [baseUrl]);
  useFocusEffect(useCallback(() => { fetchJobs(); }, [fetchJobs]));

  const post = async (job:Job, path:string, body:object={}) => { setBusyId(job.id); try { const response=await fetch(`${baseUrl}/api/delivery/jobs/${job.id}/${path}/`,{method:'POST',headers:{...(await auth()),'Content-Type':'application/json'},body:JSON.stringify(body)}); const data=await response.json(); if(!response.ok) throw new Error(data.error||'Action failed'); Toast.show({type:'success',text1:data.message||'Delivery updated'}); await fetchJobs(); return true; } catch(error:any){Toast.show({type:'error',text1:'Update failed',text2:error.message});return false;} finally{setBusyId(null);} };
  const logout = async()=>{await SecureStore.deleteItemAsync('deliveryAuthToken');await SecureStore.deleteItemAsync('deliveryPartner');router.replace('/delivery/login');};

  if(loading) return <View className="flex-1 items-center justify-center bg-[#f7faf9]"><ActivityIndicator size="large" color="#ea580c" /><Text className="mt-3 font-bold text-slate-500">Loading assigned deliveries…</Text></View>;
  return <SafeAreaView className="flex-1 bg-[#f7faf9]"><ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);fetchJobs();}}/>} contentContainerStyle={{padding:16,paddingBottom:60}}>
    <View className="mb-5 flex-row items-center justify-between rounded-[1.7rem] bg-slate-950 p-5"><View><Text className="text-[9px] font-black uppercase tracking-[2px] text-orange-400">Partner dashboard</Text><Text className="mt-1 text-2xl font-black text-white">My Deliveries</Text><Text className="mt-1 text-xs font-semibold text-slate-400">{jobs.length} active assignment{jobs.length===1?'':'s'}</Text></View><TouchableOpacity onPress={logout} className="h-11 w-11 items-center justify-center rounded-2xl bg-white/10"><MaterialCommunityIcons name="logout" size={21} color="white" /></TouchableOpacity></View>
    {!jobs.length ? <View className="mt-24 items-center"><MaterialCommunityIcons name="bike-fast" size={60} color="#cbd5e1"/><Text className="mt-5 text-lg font-black text-slate-800">No assigned deliveries</Text><Text className="mt-2 text-center text-xs font-semibold text-slate-400">New jobs appear after the pharmacy assigns an order to you.</Text></View> : jobs.map(job=><View key={job.id} className="mb-4 rounded-[1.5rem] border border-slate-100 bg-white p-4 shadow-lg shadow-slate-200">
      <View className="flex-row justify-between"><View><Text className="text-[9px] font-black uppercase text-orange-600">Order #{job.id}</Text><Text className="mt-1 text-lg font-black text-slate-950">{job.customer_name}</Text></View><View className="rounded-full bg-orange-50 px-3 py-2"><Text className="text-[8px] font-black uppercase text-orange-700">{job.stage.replace('_',' ')}</Text></View></View>
      <TouchableOpacity onPress={()=>setMapJob(job)} className="mt-4 flex-row items-center rounded-2xl border border-emerald-100 bg-emerald-50 p-3"><View className="h-10 w-10 items-center justify-center rounded-xl bg-emerald-600"><MaterialCommunityIcons name="map-marker-path" size={20} color="white"/></View><View className="ml-3 flex-1"><Text className="text-[8px] font-black uppercase text-emerald-700">Customer location</Text><Text className="mt-1 text-[11px] font-bold leading-4 text-slate-700" numberOfLines={2}>{job.customer_address}</Text></View><MaterialCommunityIcons name="chevron-right" size={22} color="#047857"/></TouchableOpacity>
      <View className="mt-3 flex-row gap-2">{job.stage==='assigned'&&<TouchableOpacity disabled={busyId===job.id} onPress={()=>post(job,'status',{action:'picked_up'})} className="h-12 flex-1 items-center justify-center rounded-2xl bg-orange-600"><Text className="font-black text-white">PICKED UP</Text></TouchableOpacity>}{job.stage==='picked_up'&&<TouchableOpacity disabled={busyId===job.id} onPress={()=>post(job,'status',{action:'reached'})} className="h-12 flex-1 items-center justify-center rounded-2xl bg-blue-600"><Text className="font-black text-white">REACHED CUSTOMER</Text></TouchableOpacity>}{job.stage==='reached'&&!job.completion_otp_requested&&<TouchableOpacity disabled={busyId===job.id} onPress={()=>post(job,'request-otp')} className="h-12 flex-1 items-center justify-center rounded-2xl bg-slate-950"><Text className="font-black text-white">REQUEST OTP</Text></TouchableOpacity>}{job.stage==='reached'&&job.completion_otp_requested&&<TouchableOpacity onPress={()=>{setOtpJob(job);setOtp('');}} className="h-12 flex-1 items-center justify-center rounded-2xl bg-emerald-600"><Text className="font-black text-white">VERIFY OTP</Text></TouchableOpacity>}</View>
    </View>)}
  </ScrollView><DeliveryDestinationModal destination={mapJob?{user_name:mapJob.customer_name,user_address:mapJob.customer_address,latitude:mapJob.latitude,longitude:mapJob.longitude}:null} onClose={()=>setMapJob(null)}/>
  {otpJob&&<View className="absolute inset-0 items-center justify-center bg-slate-950/70 px-6"><View className="w-full rounded-[2rem] bg-white p-6"><Text className="text-xl font-black text-slate-950">Customer OTP</Text><Text className="mt-1 text-xs font-semibold text-slate-500">Enter the 6-digit code shown or sent to the customer.</Text><TextInput value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} className="my-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center text-2xl font-black tracking-[8px]"/><View className="flex-row gap-3"><TouchableOpacity onPress={()=>setOtpJob(null)} className="h-12 flex-1 items-center justify-center rounded-2xl bg-slate-100"><Text className="font-black text-slate-600">CANCEL</Text></TouchableOpacity><TouchableOpacity onPress={async()=>{if(await post(otpJob,'verify-otp',{otp})){setOtpJob(null);}}} className="h-12 flex-[1.4] items-center justify-center rounded-2xl bg-emerald-600"><Text className="font-black text-white">COMPLETE DELIVERY</Text></TouchableOpacity></View></View></View>}
  </SafeAreaView>;
}
