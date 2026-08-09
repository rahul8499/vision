import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import {
  getSupportTicket,
  rateSupportTicket,
  replySupportTicket,
  type SupportMessage,
  type SupportTicket,
} from '@/utils/platformSupportApi';
import { SupportRatingCard } from '@/components/SupportRatingCard';
import {
  LocalizedText as Text,
  LocalizedTextInput as TextInput,
} from '@/components/Language/LocalizedPrimitives';

const PALETTE = {
  primaryNavy: '#123B5D',
  secondaryTeal: '#0F8B8D',
  bgLight: '#F4F8FA',
  cardTealLight: '#E8F4F5',
  borderTeal: '#B9DDE0',
  cardWhite: '#FFFFFF',
  textMain: '#102A43',
  textSecondary: '#627D98',
  successGreen: '#16A34A',
  warningAmber: '#F59E0B',
  errorRed: '#DC2626',
};

const BASE_URL = (Constants.expoConfig?.extra?.BASE_URL as string) || '';
const getStatusColor = (status: string) => {
  switch (status) {
    case 'resolved':
    case 'closed':
      return PALETTE.successGreen;
    case 'waiting_for_user':
      return PALETTE.warningAmber;
    case 'in_progress':
      return PALETTE.secondaryTeal;
    default:
      return PALETTE.primaryNavy;
  }
};

export function SupportTicketRealtime() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const focused = useIsFocused();
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [pendingPhoto, setPendingPhoto] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [live, setLive] = useState(false);
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
            load(false);
          }
        } catch {}
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
  }, [focused, id, load]);

  useEffect(() => {
    if (!focused || live) return;
    const timer = setInterval(() => load(false), 2000);
    return () => clearInterval(timer);
  }, [focused, live, load]);

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      setPendingPhoto({
        uri: asset.uri,
        name: asset.fileName || `support_${Date.now()}.jpg`,
        type: asset.mimeType || 'image/jpeg',
      });
    }
  };

  const send = async () => {
    const message = text.trim();
    const photo = pendingPhoto;
    if ((!message && !photo) || sending || !id) return;

    setText('');
    setPendingPhoto(null);

    // Optimistically update UI
    const tempId = Date.now();
    const tempMsg: SupportMessage = {
      id: tempId,
      sender_type: 'store',
      sender_name: 'You',
      text: message,
      attachment: photo ? photo.uri : null,
      is_read: true,
      created_at: new Date().toISOString(),
    };

    setTicket((current) => {
      if (!current) return null;
      return {
        ...current,
        messages: [...(current.messages || []), tempMsg],
        message_count: current.message_count + 1,
      };
    });

    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));

    setSending(true);
    try {
      const updated = await replySupportTicket(Number(id), message, photo);
      setTicket((current) => {
        if (!current) return updated;
        const incoming = updated.messages || [];
        const knownIds = new Set((current.messages || []).filter((m) => m.id !== tempId).map((item) => item.id));
        const additions = incoming.filter((item) => !knownIds.has(item.id));
        return { ...updated, messages: [...(current.messages || []).filter((m) => m.id !== tempId), ...additions] };
      });
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (error) {
      Alert.alert('Could not send', error instanceof Error ? error.message : 'Try again.');
      load(false);
    } finally {
      setSending(false);
    }
  };

  if (loading || !ticket) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={PALETTE.secondaryTeal} size="large" />
      </View>
    );
  }

  const messages = ticket.messages || [];
  const statusClr = getStatusColor(ticket.status);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>Support #{ticket.id}</Text>
            <Text style={styles.headerSubtitle}>{ticket.category_display}</Text>
          </View>
          <View style={styles.liveBadge}>
            <View style={[styles.liveDot, { backgroundColor: live ? PALETTE.successGreen : PALETTE.warningAmber }]} />
            <Text style={styles.liveText}>{live ? 'Live' : 'Syncing'}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusClr + '22', borderColor: statusClr + '44' }]}>
            <Text style={[styles.statusText, { color: statusClr }]}>{ticket.status_display}</Text>
          </View>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(message) => String(message.id)}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListHeaderComponent={
          <View style={styles.ticketCard}>
            <View style={styles.priorityRow}>
              <Text style={styles.priorityText}>{ticket.priority_display} PRIORITY</Text>
            </View>
            <Text style={styles.ticketSubject}>{ticket.subject}</Text>
            <Text style={styles.ticketDescription}>{ticket.description}</Text>
            {ticket.resolution_note ? (
              <View style={styles.resolutionCard}>
                <Text style={styles.resolutionTitle}>Resolution</Text>
                <Text style={styles.resolutionBody}>{ticket.resolution_note}</Text>
              </View>
            ) : null}
            {ticket.status === 'resolved' || ticket.status === 'closed' ? (
              <SupportRatingCard
                value={ticket.support_rating}
                onSubmit={async (rating, feedback) => {
                  const saved = await rateSupportTicket(ticket.id, rating, feedback);
                  setTicket((current) => (current ? { ...current, support_rating: saved } : current));
                  return saved;
                }}
              />
            ) : null}
            <Text style={styles.conversationDivider}>CONVERSATION HISTORY</Text>
          </View>
        }
        renderItem={({ item }) => {
          const fromSupport = item.sender_type === 'platform';
          return (
            <View style={[styles.messageBubble, fromSupport ? styles.bubbleOther : styles.bubbleMine]}>
              <Text style={[styles.senderName, fromSupport ? styles.nameOther : styles.nameMine]}>{item.sender_name}</Text>
              {item.text ? <Text style={[styles.messageText, fromSupport ? styles.textOther : styles.textMine]}>{item.text}</Text> : null}
              {item.attachment ? (
                <Image source={{ uri: item.attachment }} style={styles.attachmentImage} contentFit="cover" />
              ) : null}
              <Text style={[styles.messageTime, fromSupport ? styles.timeOther : styles.timeMine]}>
                {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          );
        }}
      />

      {/* Attachment Preview */}
      {pendingPhoto ? (
        <View style={styles.photoPreviewBar}>
          <Image source={{ uri: pendingPhoto.uri }} style={styles.photoThumb} contentFit="cover" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.photoLabel}>Image ready to upload to S3</Text>
          </View>
          <TouchableOpacity onPress={() => setPendingPhoto(null)} style={styles.photoRemoveBtn}>
            <Ionicons name="close-circle" size={22} color={PALETTE.errorRed} />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Composer */}
      {ticket.status !== 'closed' ? (
        <View style={styles.composerContainer}>
          <TouchableOpacity onPress={pickPhoto} disabled={sending} style={styles.attachmentPickerBtn}>
            <Ionicons name="image-outline" size={22} color={PALETTE.secondaryTeal} />
          </TouchableOpacity>
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            placeholder="Reply to AARX Support..."
            placeholderTextColor={PALETTE.textSecondary}
            style={styles.composerInput}
          />
          <TouchableOpacity
            disabled={sending || (!text.trim() && !pendingPhoto)}
            onPress={send}
            style={[
              styles.sendBtn,
              (sending || (!text.trim() && !pendingPhoto)) && { opacity: 0.5 },
            ]}
          >
            {sending ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <MaterialCommunityIcons name="send" size={20} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PALETTE.bgLight },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: PALETTE.bgLight },
  header: { backgroundColor: PALETTE.primaryNavy, paddingTop: 46, paddingBottom: 16, paddingHorizontal: 16, borderBottomWidth: 1, borderColor: PALETTE.borderTeal },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  backButton: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255, 255, 255, 0.12)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.3)', alignItems: 'center', justifyContent: 'center' },
  headerInfo: { flex: 1, marginLeft: 12 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#FFFFFF' },
  headerSubtitle: { fontSize: 11, fontWeight: '700', color: 'rgba(255, 255, 255, 0.8)', marginTop: 2 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.12)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, marginRight: 8 },
  liveDot: { width: 7, height: 7, borderRadius: 4, marginRight: 5 },
  liveText: { fontSize: 9.5, fontWeight: '800', color: '#FFFFFF' },
  statusBadge: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 10, fontWeight: '900' },
  listContent: { padding: 16, paddingBottom: 24, flexGrow: 1 },
  ticketCard: { backgroundColor: PALETTE.cardWhite, borderWidth: 1, borderColor: PALETTE.borderTeal, borderRadius: 18, padding: 16, marginBottom: 16 },
  priorityRow: { flexDirection: 'row', marginBottom: 6 },
  priorityText: { fontSize: 10, fontWeight: '900', color: PALETTE.textSecondary, letterSpacing: 0.5 },
  ticketSubject: { fontSize: 17, fontWeight: '900', color: PALETTE.primaryNavy, marginTop: 4 },
  ticketDescription: { fontSize: 12.5, fontWeight: '600', color: PALETTE.textMain, lineHeight: 18, marginTop: 8 },
  resolutionCard: { backgroundColor: PALETTE.cardTealLight, borderWidth: 1, borderColor: PALETTE.borderTeal, borderRadius: 14, padding: 12, marginTop: 12 },
  resolutionTitle: { fontSize: 12, fontWeight: '900', color: PALETTE.primaryNavy },
  resolutionBody: { fontSize: 11.5, fontWeight: '600', color: PALETTE.textMain, marginTop: 3 },
  conversationDivider: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, color: PALETTE.textSecondary, marginTop: 16, textTransform: 'uppercase' },
  messageBubble: { maxWidth: '85%', padding: 14, borderRadius: 18, marginBottom: 10 },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: PALETTE.primaryNavy, borderTopRightRadius: 6 },
  bubbleOther: { alignSelf: 'flex-start', backgroundColor: PALETTE.cardWhite, borderWidth: 1, borderColor: PALETTE.borderTeal, borderTopLeftRadius: 6 },
  senderName: { fontSize: 10, fontWeight: '900', marginBottom: 4 },
  nameMine: { color: 'rgba(255, 255, 255, 0.8)' },
  nameOther: { color: PALETTE.secondaryTeal },
  messageText: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  textMine: { color: '#FFFFFF' },
  textOther: { color: PALETTE.textMain },
  attachmentImage: { width: 200, height: 140, borderRadius: 12, marginTop: 8 },
  messageTime: { fontSize: 9, fontWeight: '700', marginTop: 6 },
  timeMine: { color: 'rgba(255, 255, 255, 0.7)' },
  timeOther: { color: PALETTE.textSecondary },
  photoPreviewBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: PALETTE.cardWhite, padding: 10, borderTopWidth: 1, borderColor: PALETTE.borderTeal, marginHorizontal: 16, borderRadius: 12, marginBottom: 6 },
  photoThumb: { width: 44, height: 44, borderRadius: 8 },
  photoLabel: { fontSize: 12, color: PALETTE.textSecondary, fontWeight: '700' },
  photoRemoveBtn: { padding: 4 },
  composerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PALETTE.cardWhite,
    borderTopWidth: 1,
    borderTopColor: PALETTE.borderTeal,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 78 : 68,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  attachmentPickerBtn: { padding: 8, marginRight: 4 },
  composerInput: { flex: 1, backgroundColor: PALETTE.bgLight, borderWidth: 1, borderColor: PALETTE.borderTeal, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, color: PALETTE.textMain, maxHeight: 100 },
  sendBtn: { width: 44, height: 44, backgroundColor: PALETTE.secondaryTeal, borderRadius: 22, marginLeft: 10, alignItems: 'center', justifyContent: 'center' },
});
