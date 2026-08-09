import { LocalizedText as Text } from '@/components/Language/LocalizedPrimitives';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import {
  getComplaintDetail,
  withdrawComplaint,
  type ComplaintDetail as DetailType,
  type ComplaintMessage,
  type LocalAttachment,
} from '@/utils/complaintsApi';
import { StatusBadge } from './StatusBadge';
import { ComplaintThread } from './ComplaintThread';

const BASE_URL = (Constants.expoConfig?.extra?.BASE_URL as string) || '';

export function ComplaintDetailScreen({ userType, id }: { userType: 'user' | 'store'; id: string }) {
  const router = useRouter();
  const isFocused = useIsFocused();
  const [detail, setDetail] = useState<DetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);
  const [live, setLive] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await getComplaintDetail(Number(id));
      setDetail(d);
    } catch (e) {
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load, isFocused]);

  useEffect(() => {
    if (!isFocused || !id || !BASE_URL) return;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const connect = async () => {
      const token = await SecureStore.getItemAsync('authToken');
      if (stopped || !token) return;
      socket = new WebSocket(
        `${BASE_URL.replace(/^http/, 'ws').replace(/\/$/, '')}/ws/complaints/${id}/?token=${encodeURIComponent(token)}`
      );
      socket.onmessage = (event) => {
        try {
          const incoming = JSON.parse(event.data);
          if (incoming.type !== 'complaint_message' || !incoming.data) return;
          setDetail((previous) => {
            if (!previous || previous.messages.some((message) => message.id === incoming.data.id)) return previous;
            return {
              ...previous,
              messages: [...previous.messages, incoming.data],
              message_count: previous.message_count + 1,
              updated_at: incoming.data.created_at || previous.updated_at,
            };
          });
        } catch {
          // Ignore malformed realtime frames; REST remains the source of truth.
        }
      };
      socket.onopen = () => setLive(true);
      socket.onclose = () => {
        setLive(false);
        if (!stopped) reconnectTimer = setTimeout(connect, 1500);
      };
      socket.onerror = () => setLive(false);
    };

    connect();
    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [id, isFocused]);

  useEffect(() => {
    if (!isFocused || live) return;
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [isFocused, live, load]);

  const handleSend = async (text: string, attachment: LocalAttachment | null) => {
    // Optimistic instant local display (0ms delay)
    const tempId = Date.now();
    const tempMsg: ComplaintMessage = {
      id: tempId,
      sender_type: userType,
      sender_name: userType === 'store' ? 'Pharmacy' : 'Customer',
      visibility: userType === 'store' ? 'STORE_SUPPORT' : 'USER_SUPPORT',
      text: text || null,
      attachment_url: attachment ? attachment.uri : null,
      is_read: true,
      created_at: new Date().toISOString(),
    };

    setDetail((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        messages: [...prev.messages, tempMsg],
        message_count: prev.message_count + 1,
      };
    });

    try {
      const { addComplaintMessage } = await import('@/utils/complaintsApi');
      const msg = await addComplaintMessage(Number(id), { text, attachment });
      setDetail((prev) => {
        if (!prev) return prev;
        const filtered = prev.messages.filter((m) => m.id !== tempId);
        if (filtered.some((m) => m.id === msg.id)) return { ...prev, messages: filtered };
        return { ...prev, messages: [...filtered, msg] };
      });
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not send message.');
      load();
    }
  };

  const handleWithdraw = () => {
    Alert.alert('Withdraw complaint?', 'This will close the complaint.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Withdraw',
        style: 'destructive',
        onPress: async () => {
          setWithdrawing(true);
          try {
            const d = await withdrawComplaint(Number(id));
            setDetail(d);
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Could not withdraw.');
          } finally {
            setWithdrawing(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={42} color="#cbd5e1" />
        <Text style={styles.notFound}>Complaint not found</Text>
        <TouchableOpacity style={styles.backBtn2} onPress={() => router.back()}>
          <Text style={styles.backBtn2Text}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isClosed = ['resolved', 'rejected', 'withdrawn', 'closed'].includes(detail.status);

  return (
    <View style={styles.container}>
      <View style={styles.chatHeader}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>

          <View style={styles.titleStack}>
            <Text style={styles.titleText}>Complaint #{detail.id}</Text>
            <Text style={styles.subtitleText}>{detail.category_display}</Text>
          </View>

          <View style={styles.headerRight}>
            <View style={styles.liveRow}>
              <View style={[styles.liveDot, { backgroundColor: live ? '#10b981' : '#f59e0b' }]} />
              <Text style={styles.liveText}>{live ? 'Live' : 'Sync'}</Text>
            </View>
            <StatusBadge status={detail.status} display={detail.status_display} />
            {detail.can_withdraw ? (
              <TouchableOpacity style={styles.withdrawBtn} onPress={handleWithdraw} disabled={withdrawing}>
                <Text style={styles.withdrawText}>{withdrawing ? '…' : 'Withdraw'}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.body}>
        <ComplaintThread
          messages={detail.messages}
          userType={userType}
          BASE_URL={BASE_URL}
          onSend={handleSend}
          disabled={isClosed}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  notFound: { fontSize: 16, fontWeight: '800', color: '#475569', marginTop: 12 },
  backBtn2: { marginTop: 16, backgroundColor: '#059669', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  backBtn2Text: { color: '#fff', fontWeight: '800' },
  chatHeader: { backgroundColor: '#123B5D', paddingTop: 50, paddingBottom: 14, paddingHorizontal: 12, borderBottomWidth: 1, borderColor: '#B9DDE0' },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  backButton: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)' },
  titleStack: { flex: 1, marginLeft: 10 },
  titleText: { fontSize: 18, fontWeight: '900', color: '#FFFFFF' },
  subtitleText: { marginTop: 2, fontSize: 10, fontWeight: '800', color: '#E8F4F5', textTransform: 'uppercase' },
  headerRight: { flexDirection: 'row', alignItems: 'center', marginLeft: 10 },
  withdrawBtn: { marginLeft: 8, backgroundColor: '#FFFFFF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: '#B9DDE0' },
  withdrawText: { color: '#DC2626', fontWeight: '800', fontSize: 12 },
  body: { flex: 1, flexDirection: 'column', backgroundColor: '#F4F8FA' },
  liveRow: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', marginRight: 6, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 5 },
  liveDot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  liveText: { fontSize: 9, color: '#E8F4F5', fontWeight: '800' },
});
