import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/Language/LocalizedPrimitives';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  View
} from 'react-native';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  SUPPORT_CATEGORIES,
  createSupportTicket,
  getSupportTicket,
  getSupportTickets,
  rateSupportTicket,
  replySupportTicket,
  type SupportTicket
} from '@/utils/platformSupportApi';
import { SupportRatingCard } from '@/components/SupportRatingCard';

// Enterprise Color Palette Tokens
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

const getStatusColor = (s: string) => {
  switch (s) {
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

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  const router = useRouter();
  return (
    <View style={{ paddingTop: 10, paddingBottom: 6 }}>
      <View
        style={{
          marginHorizontal: 16,
          borderRadius: 22,
          overflow: 'hidden',
          elevation: 6,
          shadowColor: PALETTE.primaryNavy,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
        }}
      >
        <LinearGradient
          colors={[PALETTE.primaryNavy, '#184C75', PALETTE.secondaryTeal]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: 18, paddingVertical: 18 }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.8}
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              backgroundColor: 'rgba(255, 255, 255, 0.18)',
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.3)',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
            }}
          >
            <Feather name="arrow-left" size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={{ fontSize: 22, fontWeight: '900', color: '#FFFFFF' }}>{title}</Text>
          <Text style={{ fontSize: 11.5, fontWeight: '600', color: 'rgba(255, 255, 255, 0.85)', marginTop: 4, lineHeight: 17 }}>
            {subtitle}
          </Text>
        </LinearGradient>
      </View>
    </View>
  );
}

export function SupportTicketList() {
  const router = useRouter();
  const focused = useIsFocused();
  const [data, setData] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await getSupportTickets());
    } catch {
      Alert.alert('Could not load', 'Please check your connection and try again.');
    } finally {
      setLoading(false);
      setRefresh(false);
    }
  }, []);

  useEffect(() => {
    if (focused) load();
  }, [focused, load]);

  return (
    <View style={{ flex: 1, backgroundColor: PALETTE.bgLight }}>
      <Header
        title="AARX Platform Support"
        subtitle="For app bugs, account, verification, subscription and technical issues. Separate from complaints against users or pharmacies."
      />

      <TouchableOpacity
        onPress={() => router.push('/platform-support/raise')}
        activeOpacity={0.88}
        style={{
          marginHorizontal: 16,
          marginTop: 12,
          marginBottom: 8,
          backgroundColor: PALETTE.cardWhite,
          borderWidth: 1,
          borderColor: PALETTE.borderTeal,
          borderRadius: 18,
          padding: 14,
          flexDirection: 'row',
          alignItems: 'center',
          elevation: 2,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.04,
          shadowRadius: 4,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: PALETTE.cardTealLight,
            borderWidth: 1,
            borderColor: PALETTE.borderTeal,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MaterialCommunityIcons name="message-plus-outline" size={22} color={PALETTE.secondaryTeal} />
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={{ fontSize: 14.5, fontWeight: '900', color: PALETTE.primaryNavy }}>New support request</Text>
          <Text style={{ fontSize: 11.5, fontWeight: '600', color: PALETTE.textSecondary, marginTop: 2 }}>
            Tell the AARX support team what went wrong
          </Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={22} color={PALETTE.secondaryTeal} />
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={PALETTE.secondaryTeal} size="large" />
      ) : (
        <FlatList
          data={data}
          refreshing={refresh}
          onRefresh={() => {
            setRefresh(true);
            load();
          }}
          keyExtractor={(x) => String(x.id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 40, backgroundColor: PALETTE.cardWhite, borderWidth: 1, borderColor: PALETTE.borderTeal, borderRadius: 18, marginHorizontal: 0, marginTop: 8 }}>
              <MaterialCommunityIcons name="check-decagram-outline" size={42} color={PALETTE.secondaryTeal} />
              <Text style={{ fontSize: 14, fontWeight: '900', color: PALETTE.primaryNavy, marginTop: 12 }}>No support requests yet</Text>
              <Text style={{ fontSize: 11.5, fontWeight: '600', color: PALETTE.textSecondary, marginTop: 4 }}>Create a ticket if you experience any platform issues.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const statusColor = getStatusColor(item.status);
            return (
              <TouchableOpacity
                onPress={() => router.push(`/platform-support/${item.id}`)}
                activeOpacity={0.88}
                style={{
                  backgroundColor: PALETTE.cardWhite,
                  borderWidth: 1,
                  borderColor: PALETTE.borderTeal,
                  borderRadius: 18,
                  padding: 16,
                  marginBottom: 10,
                  elevation: 1,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: PALETTE.textSecondary }}>
                    #{item.id} · {item.category_display}
                  </Text>
                  <View style={{ backgroundColor: statusColor + '18', borderWidth: 1, borderColor: statusColor + '33', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 }}>
                    <Text style={{ fontSize: 10.5, fontWeight: '900', color: statusColor }}>{item.status_display}</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 15, fontWeight: '900', color: PALETTE.primaryNavy, marginTop: 10 }}>{item.subject}</Text>
                <Text style={{ fontSize: 11.5, fontWeight: '600', color: PALETTE.textSecondary, marginTop: 6 }}>
                  {item.message_count} replies{item.unread_count ? ` · ${item.unread_count} unread` : ''}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

export function RaiseSupportTicket() {
  const router = useRouter();
  const [category, setCategory] = useState('technical');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [image, setImage] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const pick = async () => {
    const x = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!x.canceled) {
      const a = x.assets[0];
      setImage({ uri: a.uri, name: a.fileName || 'support.jpg', type: a.mimeType || 'image/jpeg' });
    }
  };

  const submit = async () => {
    if (!subject.trim() || !description.trim()) {
      return Alert.alert('More details needed', 'Please provide a subject and description.');
    }
    try {
      setSaving(true);
      const t = await createSupportTicket({ category, subject: subject.trim(), description: description.trim(), priority }, image);
      router.replace(`/platform-support/${t.id}`);
    } catch (e) {
      Alert.alert('Could not submit', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: PALETTE.bgLight }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 50 }}>
      <Header title="Contact AARX Support" subtitle="Do not use this for a dispute with a user or pharmacy. Raise a complaint for those cases." />
      <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
        <Text style={{ fontSize: 13, fontWeight: '900', color: PALETTE.primaryNavy, marginBottom: 8 }}>Issue Type</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {SUPPORT_CATEGORIES.map((x) => {
            const active = category === x.value;
            return (
              <TouchableOpacity
                key={x.value}
                onPress={() => setCategory(x.value)}
                style={{
                  marginRight: 8,
                  marginBottom: 8,
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                  borderRadius: 14,
                  borderWidth: 1,
                  backgroundColor: active ? PALETTE.cardTealLight : PALETTE.cardWhite,
                  borderColor: active ? PALETTE.secondaryTeal : PALETTE.borderTeal,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: active ? '900' : '600', color: active ? PALETTE.secondaryTeal : PALETTE.textSecondary }}>
                  {x.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={{ fontSize: 13, fontWeight: '900', color: PALETTE.primaryNavy, marginTop: 14, marginBottom: 6 }}>Subject</Text>
        <TextInput
          value={subject}
          onChangeText={setSubject}
          maxLength={200}
          placeholder="Short summary of the problem"
          placeholderTextColor={PALETTE.textSecondary}
          style={{
            backgroundColor: PALETTE.cardWhite,
            borderWidth: 1,
            borderColor: PALETTE.borderTeal,
            borderRadius: 16,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 13,
            color: PALETTE.textMain,
            fontWeight: '600',
          }}
        />

        <Text style={{ fontSize: 13, fontWeight: '900', color: PALETTE.primaryNavy, marginTop: 14, marginBottom: 6 }}>What happened?</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          multiline
          textAlignVertical="top"
          placeholder="Include steps, error messages and what you expected"
          placeholderTextColor={PALETTE.textSecondary}
          style={{
            backgroundColor: PALETTE.cardWhite,
            borderWidth: 1,
            borderColor: PALETTE.borderTeal,
            borderRadius: 16,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 13,
            color: PALETTE.textMain,
            minHeight: 140,
            fontWeight: '600',
          }}
        />

        <TouchableOpacity
          onPress={pick}
          activeOpacity={0.88}
          style={{
            marginTop: 14,
            backgroundColor: PALETTE.cardWhite,
            borderWidth: 1,
            borderColor: PALETTE.borderTeal,
            borderRadius: 16,
            padding: 14,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <MaterialCommunityIcons name="paperclip" size={20} color={PALETTE.secondaryTeal} />
          <Text style={{ marginLeft: 10, fontSize: 13, fontWeight: '800', color: PALETTE.primaryNavy }}>
            {image ? 'Screenshot attached' : 'Attach screenshot (optional)'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          disabled={saving}
          onPress={submit}
          activeOpacity={0.88}
          style={{
            marginTop: 20,
            backgroundColor: PALETTE.secondaryTeal,
            borderRadius: 18,
            paddingVertical: 14,
            alignItems: 'center',
            elevation: 3,
          }}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={{ fontSize: 14, fontWeight: '900', color: '#FFFFFF' }}>Submit Support Request</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

export function SupportTicketDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [t, setT] = useState<SupportTicket | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      setT(await getSupportTicket(Number(id)));
    } catch {
      Alert.alert('Not found', 'This support request could not be loaded.');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const send = async () => {
    if (!text.trim()) return;
    try {
      setSending(true);
      setT(await replySupportTicket(Number(id), text.trim()));
      setText('');
    } catch (e) {
      Alert.alert('Could not send', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setSending(false);
    }
  };

  if (!t) return <ActivityIndicator style={{ marginTop: 80 }} color={PALETTE.secondaryTeal} size="large" />;

  const complete = t.status === 'resolved' || t.status === 'closed';
  const statusColor = getStatusColor(t.status);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: PALETTE.bgLight }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title={`Support #${t.id}`} subtitle={t.category_display} />
      <ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 12 }}>
        <View style={{ backgroundColor: PALETTE.cardWhite, borderWidth: 1, borderColor: PALETTE.borderTeal, borderRadius: 18, padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ backgroundColor: statusColor + '18', borderWidth: 1, borderColor: statusColor + '33', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 }}>
              <Text style={{ fontSize: 10.5, fontWeight: '900', color: statusColor }}>{t.status_display}</Text>
            </View>
            <Text style={{ fontSize: 11, fontWeight: '800', color: PALETTE.textSecondary }}>{t.priority_display}</Text>
          </View>

          <Text style={{ fontSize: 17, fontWeight: '900', color: PALETTE.primaryNavy, marginTop: 10 }}>{t.subject}</Text>
          <Text style={{ fontSize: 12.5, fontWeight: '600', color: PALETTE.textMain, lineHeight: 18, marginTop: 8 }}>{t.description}</Text>

          {t.resolution_note ? (
            <View style={{ backgroundColor: PALETTE.cardTealLight, borderWidth: 1, borderColor: PALETTE.borderTeal, borderRadius: 14, padding: 12, marginTop: 12 }}>
              <Text style={{ fontSize: 12, fontWeight: '900', color: PALETTE.primaryNavy }}>Resolution</Text>
              <Text style={{ fontSize: 11.5, fontWeight: '600', color: PALETTE.textMain, marginTop: 3 }}>{t.resolution_note}</Text>
            </View>
          ) : null}
        </View>

        {complete ? (
          <SupportRatingCard
            value={t.support_rating}
            onSubmit={async (rating, feedback) => {
              const saved = await rateSupportTicket(t.id, rating, feedback);
              setT((current) => (current ? { ...current, support_rating: saved } : current));
              return saved;
            }}
          />
        ) : null}

        <Text style={{ fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2, color: PALETTE.textSecondary, marginTop: 16, marginBottom: 10, marginLeft: 2 }}>
          Conversation
        </Text>

        {(t.messages || []).map((m) => {
          const isPlatform = m.sender_type === 'platform';
          return (
            <View
              key={m.id}
              style={{
                borderRadius: 18,
                padding: 14,
                marginBottom: 10,
                maxWidth: '85%',
                alignSelf: isPlatform ? 'flex-start' : 'flex-end',
                backgroundColor: isPlatform ? PALETTE.cardWhite : PALETTE.primaryNavy,
                borderWidth: isPlatform ? 1 : 0,
                borderColor: PALETTE.borderTeal,
                elevation: 1,
              }}
            >
              <Text style={{ fontSize: 9.5, fontWeight: '800', marginBottom: 4, color: isPlatform ? PALETTE.secondaryTeal : 'rgba(255, 255, 255, 0.8)' }}>
                {m.sender_name}
              </Text>
              {m.text ? (
                <Text style={{ fontSize: 13, fontWeight: '600', color: isPlatform ? PALETTE.textMain : '#FFFFFF', lineHeight: 18 }}>{m.text}</Text>
              ) : null}
              {m.attachment ? <Image source={{ uri: m.attachment }} style={{ width: 190, height: 140, borderRadius: 12, marginTop: 8 }} /> : null}
            </View>
          );
        })}
      </ScrollView>

      {!complete ? (
        <View
          style={{
            backgroundColor: PALETTE.cardWhite,
            borderTopWidth: 1,
            borderTopColor: PALETTE.borderTeal,
            paddingHorizontal: 14,
            paddingTop: 12,
            paddingBottom: Platform.OS === 'ios' ? 78 : 68,
            flexDirection: 'row',
            alignItems: 'center',
            elevation: 8,
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.06,
            shadowRadius: 4,
          }}
        >
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            placeholder="Reply to AARX Support..."
            placeholderTextColor={PALETTE.textSecondary}
            style={{
              flex: 1,
              backgroundColor: PALETTE.bgLight,
              borderWidth: 1,
              borderColor: PALETTE.borderTeal,
              borderRadius: 20,
              paddingHorizontal: 14,
              paddingVertical: 10,
              fontSize: 13,
              color: PALETTE.textMain,
              maxHeight: 100,
            }}
          />
          <TouchableOpacity
            disabled={sending}
            onPress={send}
            style={{
              width: 44,
              height: 44,
              backgroundColor: PALETTE.secondaryTeal,
              borderRadius: 22,
              marginLeft: 10,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {sending ? <ActivityIndicator color="#FFFFFF" /> : <MaterialCommunityIcons name="send" size={20} color="#FFFFFF" />}
          </TouchableOpacity>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
