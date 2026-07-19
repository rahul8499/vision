import axios from 'axios';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { uploadFileToS3 } from './s3Upload';

const BASE_URL = (Constants.expoConfig?.extra?.BASE_URL as string) || '';
export const SUPPORT_CATEGORIES = [
  {value:'app_bug',label:'App bug'},{value:'account',label:'Account access'},
  {value:'verification',label:'Verification'},{value:'subscription',label:'Subscription & billing'},
  {value:'technical',label:'Technical problem'},{value:'feature',label:'Feature request'},{value:'other',label:'Other'},
];
export type SupportMessage={id:number;sender_type:'user'|'store'|'platform';sender_name:string;text:string;attachment:string|null;is_read:boolean;created_at:string};
export type SupportRating={rating:number;feedback:string;created_at:string;updated_at?:string};
export type SupportTicket={id:number;category:string;category_display:string;subject:string;description:string;priority:string;priority_display:string;status:string;status_display:string;assigned_to:string|null;resolution_note:string|null;resolved_at:string|null;created_at:string;updated_at:string;support_rating:SupportRating|null;message_count:number;unread_count:number;messages?:SupportMessage[]};
async function headers(){const token=await SecureStore.getItemAsync('authToken');return{Authorization:`Bearer ${token||''}`};}
export async function getSupportTickets(){return(await axios.get<SupportTicket[]>(BASE_URL+'/api/complaints/platform-support/',{headers:await headers()})).data;}
export async function getSupportTicket(id:number){return(await axios.get<SupportTicket>(BASE_URL+`/api/complaints/platform-support/${id}/`,{headers:await headers()})).data;}
async function postForm(url:string,values:Record<string,string>,attachment?:{uri:string;name:string;type:string}|null){const token=await SecureStore.getItemAsync('authToken');const form=new FormData();Object.entries(values).forEach(([k,v])=>v&&form.append(k,v));if(attachment){const key=await uploadFileToS3(attachment,'platform_support',token||'');form.append('attachment_key',key);}const response=await fetch(BASE_URL+url,{method:'POST',headers:{Authorization:`Bearer ${token||''}`},body:form});if(!response.ok){let message='Request failed. Please try again.';try{const body=await response.json();message=body.error||Object.values(body).flat().join(' ')||message;}catch{}throw new Error(message);}return response.json();}
export function createSupportTicket(values:{category:string;subject:string;description:string;priority:string},attachment?:{uri:string;name:string;type:string}|null){return postForm('/api/complaints/platform-support/',values,attachment)as Promise<SupportTicket>;}
export function replySupportTicket(id:number,text:string,attachment?:{uri:string;name:string;type:string}|null){return postForm(`/api/complaints/platform-support/${id}/messages/`,{text},attachment)as Promise<SupportTicket>;}
export async function rateSupportTicket(id:number,rating:number,feedback:string){return(await axios.post<SupportRating>(BASE_URL+`/api/complaints/platform-support/${id}/rating/`,{rating,feedback},{headers:await headers()})).data;}
