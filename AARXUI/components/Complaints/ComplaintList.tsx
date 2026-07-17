import { LocalizedText as Text } from '@/components/Language/LocalizedPrimitives';
import React,{useCallback,useEffect,useState}from'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StyleSheet
} from 'react-native';
import{useRouter}from'expo-router';
import{useIsFocused}from'@react-navigation/native';
import{Ionicons}from'@expo/vector-icons';
import{getMyComplaints,getComplaintsAgainstMe,type ComplaintSummary}from'@/utils/complaintsApi';
import{ComplaintCard}from'./ComplaintCard';
export function ComplaintList({userType,mode}:{userType:'user'|'store';mode:'filed'|'against'}){
 const router=useRouter(),focused=useIsFocused();const[data,setData]=useState<ComplaintSummary[]>([]),[loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false),[error,setError]=useState('');
 const load=useCallback(async()=>{try{const r=mode==='filed'?await getMyComplaints():await getComplaintsAgainstMe();setData(r||[]);setError('');}catch{setData([]);setError('Could not load complaints. Pull down to retry.');}finally{setLoading(false);setRefreshing(false);}},[mode]);
 useEffect(()=>{setLoading(true);load();},[load,focused]);
 const open=(id:number)=>router.push({pathname:'/support/[id]',params:{id:String(id)}}as any);
 return <View style={s.container}>{loading?<View style={s.center}><ActivityIndicator size="large" color="#059669"/></View>:<FlatList data={data} keyExtractor={i=>String(i.id)} renderItem={({item})=><ComplaintCard item={item} onPress={()=>open(item.id)} roleLabel={mode==='filed'?'Against':'By'}/>} ListHeaderComponent={error?<View style={s.error}><Text style={s.errorText}>{error}</Text></View>:null} ListEmptyComponent={<View style={s.empty}><View style={s.emptyIcon}><Ionicons name="shield-checkmark-outline" size={38} color="#94a3b8"/></View><Text style={s.emptyTitle}>{mode==='filed'?'No complaints filed':'No complaints against you'}</Text><Text style={s.emptySub}>{mode==='filed'?'Formal complaints you raise will appear here.':'Your account has no incoming complaints.'}</Text></View>} contentContainerStyle={{paddingVertical:10,paddingBottom:100,flexGrow:1}} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);load();}} tintColor="#059669"/>}/>}{mode==='filed'&&<TouchableOpacity style={s.fab} onPress={()=>router.push('/support/raise')}><Ionicons name="add" size={24} color="white"/><Text style={s.fabText}>New complaint</Text></TouchableOpacity>}</View>;
}
const s=StyleSheet.create({container:{flex:1,backgroundColor:'#f8fafc'},center:{flex:1,alignItems:'center',justifyContent:'center'},empty:{flex:1,alignItems:'center',justifyContent:'center',padding:40},emptyIcon:{width:78,height:78,borderRadius:28,backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},emptyTitle:{fontSize:18,fontWeight:'900',color:'#0f172a',marginTop:18},emptySub:{fontSize:13,color:'#94a3b8',textAlign:'center',marginTop:7,lineHeight:19},error:{margin:16,padding:14,borderRadius:16,backgroundColor:'#fef2f2'},errorText:{color:'#b91c1c',fontWeight:'700'},fab:{position:'absolute',right:18,bottom:22,height:54,borderRadius:27,paddingHorizontal:20,backgroundColor:'#059669',flexDirection:'row',alignItems:'center',shadowColor:'#059669',shadowOpacity:.3,shadowRadius:10,elevation:7},fabText:{color:'#fff',fontWeight:'900',marginLeft:8}});
