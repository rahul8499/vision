import { LocalizedText as Text } from '@/components/Language/LocalizedPrimitives';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import Constants from 'expo-constants';
import {
  getComplaintDetail,
  withdrawComplaint,
  type ComplaintDetail as DetailType,
  type LocalAttachment,
} from '@/utils/complaintsApi';
import { SupportHeader } from './SupportHeader';
import { StatusBadge } from './StatusBadge';
import { ComplaintThread } from './ComplaintThread';

const BASE_URL = (Constants.expoConfig?.extra?.BASE_URL as string) || '';

export function ComplaintDetailScreen({ userType, id }: { userType: 'user' | 'store'; id: string }) {
  const router = useRouter();
  const isFocused = useIsFocused();
  const [detail, setDetail] = useState<DetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);

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

  const handleSend = async (text: string, attachment: LocalAttachment | null) => {
    const { addComplaintMessage } = await import('@/utils/complaintsApi');
    const msg = await addComplaintMessage(Number(id), { text, attachment });
    setDetail((prev) => (prev ? { ...prev, messages: [...prev.messages, msg] } : prev));
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
      <SupportHeader
        title={`Complaint #${detail.id}`}
        subtitle={`${detail.category_display}`}
        onBack={() => router.back()}
        right={
          <View style={styles.headerRight}>
            <StatusBadge status={detail.status} display={detail.status_display} />
            {detail.can_withdraw ? (
              <TouchableOpacity style={styles.withdrawBtn} onPress={handleWithdraw} disabled={withdrawing}>
                <Text style={styles.withdrawText}>{withdrawing ? '…' : 'Withdraw'}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        }
      />

      <View style={styles.body}>
        <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16 }}>
          <View style={styles.metaRow}>
            <View style={styles.metaChip}>
              <Ionicons name={detail.respondent_type === 'store' ? 'storefront-outline' : 'person-outline'} size={14} color="#475569" />
              <Text style={styles.metaText}>
                {detail.complainant_type === userType ? 'Against' : 'By'}: {detail.respondent_name}
              </Text>
            </View>
            {detail.order_id ? <Text style={styles.orderTag}>Order #{detail.order_id}</Text> : null}
          </View>

          <Text style={styles.subject}>{detail.subject}</Text>
          <Text style={styles.description}>{detail.description}</Text>

          {detail.attachments.length > 0 ? (
            <View style={styles.attachGrid}>
              {detail.attachments.map((a) =>
                a.url ? (
                  <Image
                    key={a.id}
                    source={{ uri: a.url.startsWith('http') ? a.url : `${BASE_URL}${a.url}` }}
                    style={styles.attachImg}
                    contentFit="cover"
                  />
                ) : null
              )}
            </View>
          ) : null}

          {detail.resolution_notes ? (
            <View style={styles.resolution}>
              <Text style={styles.resolutionTitle}>Resolution</Text>
              <Text style={styles.resolutionText}>{detail.resolution_notes}</Text>
            </View>
          ) : null}

          {isClosed ? (
            <View style={styles.closedNote}>
              <Ionicons name="lock-closed-outline" size={14} color="#64748b" />
              <Text style={styles.closedText}>This complaint is closed. No further replies.</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.threadWrap}>
          <ComplaintThread
            messages={detail.messages}
            userType={userType}
            BASE_URL={BASE_URL}
            onSend={handleSend}
            disabled={isClosed}
          />
        </View>
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
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  withdrawBtn: { marginLeft: 8, backgroundColor: '#fef2f2', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: '#fecaca' },
  withdrawText: { color: '#dc2626', fontWeight: '800', fontSize: 12 },
  body: { flex: 1, flexDirection: 'column' },
  scroll: { flex: 1 },
  threadWrap: { flex: 1, borderTopWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f1f5f9' },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  metaChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  metaText: { fontSize: 12, color: '#475569', fontWeight: '700', marginLeft: 4 },
  orderTag: { fontSize: 12, color: '#0e7490', fontWeight: '800' },
  subject: { fontSize: 18, fontWeight: '900', color: '#0f172a', marginBottom: 8 },
  description: { fontSize: 14, color: '#334155', lineHeight: 21, fontWeight: '500' },
  attachGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  attachImg: { width: 90, height: 90, borderRadius: 10, marginRight: 8, marginBottom: 8 },
  resolution: { marginTop: 14, backgroundColor: '#ecfdf5', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#bbf7d0' },
  resolutionTitle: { fontSize: 12, fontWeight: '900', color: '#15803d', textTransform: 'uppercase', marginBottom: 4 },
  resolutionText: { fontSize: 14, color: '#064e3b', fontWeight: '600' },
  closedNote: { flexDirection: 'row', alignItems: 'center', marginTop: 14, backgroundColor: '#f1f5f9', padding: 10, borderRadius: 10 },
  closedText: { marginLeft: 6, fontSize: 12, color: '#64748b', fontWeight: '700' },
});
