import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  View,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import {
  getSupportTicket,
  replySupportTicket,
  type SupportMessage,
  type SupportTicket,
} from '@/utils/platformSupportApi';
import {
  LocalizedText as Text,
  LocalizedTextInput as TextInput,
} from '@/components/Language/LocalizedPrimitives';

const BASE_URL = (Constants.expoConfig?.extra?.BASE_URL as string) || '';
const statusColor = (status: string) =>
  status === 'resolved' || status === 'closed'
    ? '#059669'
    : status === 'waiting_for_user'
      ? '#d97706'
      : '#2563eb';

export function SupportTicketRealtime() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const focused = useIsFocused();
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<SupportMessage>>(null);

  const load = useCallback(async (showLoader = false) => {
    if (!id) return;
    if (showLoader) setLoading(true);
    try {
      setTicket(await getSupportTicket(Number(id)));
    } catch {
      Alert.alert('Not found', 'This support request could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (focused) load(true);
  }, [focused, load]);

  useEffect(() => {
    if (!focused || !id || !BASE_URL) return;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const connect = async () => {
      const token = await SecureStore.getItemAsync('authToken');
      if (stopped || !token) return;
      socket = new WebSocket(
        `${BASE_URL.replace(/^http/, 'ws').replace(/\/$/, '')}/ws/support-tickets/${id}/?token=${encodeURIComponent(token)}`
      );
      socket.onmessage = (event) => {
        try {
          const frame = JSON.parse(event.data);
          if (frame.type === 'support_ticket_message' && frame.data) {
            const incoming = frame.data as SupportMessage;
            setTicket((current) => {
              if (!current || current.messages?.some((message) => message.id === incoming.id)) return current;
              return {
                ...current,
                messages: [...(current.messages || []), incoming],
                message_count: current.message_count + 1,
                updated_at: incoming.created_at || current.updated_at,
              };
            });
            requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
          } else if (frame.type === 'support_ticket_updated') {
            // Status changes are infrequent; refresh silently without replacing
            // the screen with a loader.
            load(false);
          }
        } catch {
          // REST remains the consistency fallback for malformed frames.
        }
      };
      socket.onclose = () => {
        if (!stopped) reconnectTimer = setTimeout(connect, 1500);
      };
    };

    connect();
    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [focused, id, load]);

  const send = async () => {
    const message = text.trim();
    if (!message || sending || !id) return;
    setSending(true);
    try {
      const updated = await replySupportTicket(Number(id), message);
      setTicket((current) => {
        if (!current) return updated;
        const incoming = updated.messages || [];
        const knownIds = new Set((current.messages || []).map((item) => item.id));
        const additions = incoming.filter((item) => !knownIds.has(item.id));
        return { ...updated, messages: [...(current.messages || []), ...additions] };
      });
      setText('');
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (error) {
      Alert.alert('Could not send', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setSending(false);
    }
  };

  if (loading || !ticket) {
    return <View className="flex-1 items-center justify-center bg-slate-50"><ActivityIndicator color="#059669" /></View>;
  }

  const messages = ticket.messages || [];
  return (
    <KeyboardAvoidingView className="flex-1 bg-slate-50" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View className="bg-slate-950 px-5 pb-5 pt-5">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-white/10">
            <MaterialCommunityIcons name="arrow-left" size={22} color="white" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-lg font-black text-white">Support #{ticket.id}</Text>
            <Text className="mt-0.5 text-xs text-slate-400">{ticket.category_display}</Text>
          </View>
          <View style={{ backgroundColor: `${statusColor(ticket.status)}22` }} className="rounded-full px-3 py-1.5">
            <Text style={{ color: statusColor(ticket.status) }} className="text-[10px] font-black">{ticket.status_display}</Text>
          </View>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(message) => String(message.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        ListHeaderComponent={
          <View className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">
            <View className="flex-row"><Text className="text-xs font-black text-slate-400">{ticket.priority_display} PRIORITY</Text></View>
            <Text className="mt-3 text-lg font-black text-slate-950">{ticket.subject}</Text>
            <Text className="mt-3 leading-5 text-slate-600">{ticket.description}</Text>
            {ticket.resolution_note ? <View className="mt-4 rounded-xl bg-emerald-50 p-3"><Text className="font-bold text-emerald-900">Resolution</Text><Text className="mt-1 text-emerald-800">{ticket.resolution_note}</Text></View> : null}
            <Text className="mb-1 mt-6 text-[10px] font-black tracking-widest text-slate-400">CONVERSATION</Text>
          </View>
        }
        renderItem={({ item }) => {
          const fromSupport = item.sender_type === 'platform';
          return (
            <View className={`mb-3 max-w-[86%] rounded-2xl p-4 ${fromSupport ? 'self-start border border-slate-200 bg-white' : 'self-end bg-emerald-600'}`}>
              <Text className={`mb-2 text-[10px] font-black ${fromSupport ? 'text-emerald-700' : 'text-emerald-100'}`}>{item.sender_name}</Text>
              {item.text ? <Text className={fromSupport ? 'text-slate-700' : 'text-white'}>{item.text}</Text> : null}
              {item.attachment ? <Image source={{ uri: item.attachment }} className="mt-2 h-36 w-48 rounded-xl" contentFit="cover" /> : null}
              <Text className={`mt-2 text-[9px] ${fromSupport ? 'text-slate-400' : 'text-emerald-100'}`}>
                {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          );
        }}
      />

      {ticket.status !== 'closed' ? (
        <View className="flex-row items-end border-t border-slate-200 bg-white p-3">
          <TextInput value={text} onChangeText={setText} multiline placeholder="Reply to AARX Support" className="max-h-28 flex-1 rounded-2xl bg-slate-100 px-4 py-3" />
          <TouchableOpacity disabled={sending || !text.trim()} onPress={send} className="ml-2 h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600" style={{ opacity: sending || !text.trim() ? 0.5 : 1 }}>
            {sending ? <ActivityIndicator color="white" /> : <MaterialCommunityIcons name="send" size={20} color="white" />}
          </TouchableOpacity>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
