import { LocalizedText as Text } from '@/components/Language/LocalizedPrimitives';
import React,{useCallback,useEffect,useState}from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  View
} from 'react-native';
import{MaterialCommunityIcons}from'@expo/vector-icons';
import{LinearGradient}from'expo-linear-gradient';
import Constants from'expo-constants';
import{useRouter}from'expo-router';
import{useSelector}from'react-redux';
import axios from'axios';
import{RootState}from'../redux/store';
type Report={id:number;target_name:string;category_display:string;description:string;status:string;status_display:string;context_type:string;context_id?:number;resolution_note?:string;created_at:string};
const color=(s:string)=>s==='closed'?'#64748b':s==='action_taken'?'#059669':s==='under_review'?'#d97706':'#2563eb';
export default function SafetyReportsScreen({role}:{role:'user'|'store'}){
 const router=useRouter(),token=useSelector((s:RootState)=>s.user.token),base=Constants.expoConfig?.extra?.BASE_URL||'';
 const[reports,setReports]=useState<Report[]>([]),[loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false),[error,setError]=useState('');
 const load=useCallback(async(refresh=false)=>{refresh?setRefreshing(true):setLoading(true);try{const r=await axios.get(base+'/api/safety-reports/',{headers:{Authorization:'Bearer '+token,Accept:'application/json'}});setReports(r.data.reports||[]);setError('');}catch(e:any){setError(e.response?.data?.error||'Could not load reports.');}finally{setLoading(false);setRefreshing(false);}},[base,token]);useEffect(()=>{load();},[load]);
 return <View className="flex-1 bg-slate-50"><LinearGradient colors={['#020617','#0f172a','#064e3b']} className="px-5 pt-14 pb-6"><View className="flex-row items-center"><TouchableOpacity onPress={()=>router.back()} className="w-10 h-10 rounded-2xl bg-white/10 items-center justify-center mr-4"><MaterialCommunityIcons name="arrow-left" size={20} color="white"/></TouchableOpacity><View className="flex-1"><Text className="text-white text-xl font-black">Reports & Safety</Text><Text className="text-emerald-300 text-[10px] font-bold uppercase mt-1">Private moderation reports</Text></View><Text className="text-white font-black">{reports.length}</Text></View></LinearGradient>{loading?<View className="flex-1 items-center justify-center"><ActivityIndicator color="#059669"/></View>:<ScrollView contentContainerStyle={{padding:16,paddingBottom:60}} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>load(true)}/>}><View className="bg-emerald-50 border border-emerald-100 rounded-3xl p-4 mb-4 flex-row"><MaterialCommunityIcons name="shield-lock-outline" size={22} color="#059669"/><Text className="text-emerald-900 text-[11px] leading-5 font-bold flex-1 ml-3">Reports are privately reviewed by AARX and remain separate from complaints.</Text></View>{!!error&&<Text className="text-red-700 bg-red-50 p-4 rounded-2xl">{error}</Text>}{!error&&reports.length===0&&<View className="items-center py-24"><MaterialCommunityIcons name="shield-check-outline" size={48} color="#94a3b8"/><Text className="text-slate-900 font-black text-lg mt-5">No reports submitted</Text></View>}{reports.map(item=><View key={item.id} className="bg-white border border-slate-200 rounded-3xl p-5 mb-3"><View className="flex-row justify-between"><View className="flex-1 pr-3"><Text className="text-slate-400 text-[9px] font-black uppercase">Report #{item.id} · {item.context_type} {item.context_id||''}</Text><Text className="text-slate-950 font-black text-[15px] mt-2">{item.category_display}</Text><Text className="text-slate-500 text-[11px] mt-1">Reported: {item.target_name}</Text></View><View style={{backgroundColor:color(item.status)+'18'}} className="px-3 py-2 rounded-xl"><Text style={{color:color(item.status)}} className="text-[9px] font-black uppercase">{item.status_display}</Text></View></View><Text className="text-slate-700 text-[12px] leading-5 mt-4">{item.description}</Text>{!!item.resolution_note&&<Text className="bg-slate-50 text-slate-700 p-3 rounded-2xl mt-4">{item.resolution_note}</Text>}<Text className="text-slate-400 text-[9px] mt-4">{new Date(item.created_at).toLocaleString('en-IN')}</Text></View>)}</ScrollView>}</View>;
}
