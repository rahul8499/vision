import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/Language/LocalizedPrimitives';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Switch,
  TouchableOpacity,
  View
} from 'react-native';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  PHARMACIST_CATEGORIES,
  createConsultation,
  getConsultation,
  getOrderConsultation,
  getPharmacistAvailability,
  getStoreConsultations,
  requestPharmacistCallback,
  sendConsultationMessage,
  setPharmacistAvailability,
  submitPharmacistDetails,
  type Consultation
} from '@/utils/pharmacistApi';

// Enterprise Color Palette
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

function Head({ title, sub, onBack }: { title: string; sub?: string; onBack?: () => void }) {
  const r = useRouter();
  const handleBack = onBack || (() => r.back());
  return (
    <View style={{ backgroundColor: PALETTE.bgLight, paddingTop: 10, paddingBottom: 6 }}>
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
          style={{ paddingHorizontal: 18, paddingVertical: 16 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              onPress={handleBack}
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
                marginRight: 12,
              }}
            >
              <Feather name="arrow-left" size={18} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 18, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.3 }}>
                  {title}
                </Text>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ADE80', marginLeft: 8 }} />
              </View>
              {sub ? (
                <Text style={{ fontSize: 10.5, fontWeight: '700', color: 'rgba(255, 255, 255, 0.85)', marginTop: 3 }} numberOfLines={2}>
                  {sub}
                </Text>
              ) : null}
            </View>
          </View>
        </LinearGradient>
      </View>
    </View>
  );
}

function OrderContextModal({ order, visible, onClose }: { order: Consultation['order_context']; visible: boolean; onClose: () => void }) {
  const [imageOpen, setImageOpen] = useState(false);
  if (!order) return null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.6)' }}>
        <View style={{ maxHeight: '92%', borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: PALETTE.cardWhite }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: PALETTE.borderTeal, padding: 18 }}>
            <View>
              <Text style={{ fontSize: 18, fontWeight: '900', color: PALETTE.primaryNavy }}>Original Order #{order.id}</Text>
              <Text style={{ fontSize: 11, fontWeight: '600', color: PALETTE.textSecondary, marginTop: 2 }}>Clinical order context</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: PALETTE.cardTealLight, borderWidth: 1, borderColor: PALETTE.borderTeal, alignItems: 'center', justifyContent: 'center' }}>
              <MaterialCommunityIcons name="close" size={20} color={PALETTE.primaryNavy} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 36 }}>
            {order.prescription_image_url ? (
              <>
                <TouchableOpacity activeOpacity={0.9} onPress={() => setImageOpen(true)} style={{ borderRadius: 20, backgroundColor: PALETTE.cardTealLight, overflow: 'hidden' }}>
                  <Image source={{ uri: order.prescription_image_url }} style={{ height: 220, width: '100%' }} resizeMode="contain" />
                  <View style={{ position: 'absolute', bottom: 10, right: 10, flexDirection: 'row', alignItems: 'center', borderRadius: 20, backgroundColor: 'rgba(18, 59, 93, 0.85)', paddingHorizontal: 12, paddingVertical: 6 }}>
                    <MaterialCommunityIcons name="magnify-plus-outline" size={16} color="#FFFFFF" />
                    <Text style={{ fontSize: 10, fontWeight: '900', color: '#FFFFFF', marginLeft: 4 }}>VIEW FULL IMAGE</Text>
                  </View>
                </TouchableOpacity>
                <Modal visible={imageOpen} transparent animationType="fade" onRequestClose={() => setImageOpen(false)}>
                  <View style={{ flex: 1, backgroundColor: '#000000' }}>
                    <TouchableOpacity onPress={() => setImageOpen(false)} style={{ position: 'absolute', right: 18, top: 48, zIndex: 10, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255, 255, 255, 0.2)', alignItems: 'center', justifyContent: 'center' }}>
                      <MaterialCommunityIcons name="close" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Image source={{ uri: order.prescription_image_url }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                  </View>
                </Modal>
              </>
            ) : null}
            <View style={{ marginTop: 14, backgroundColor: PALETTE.cardTealLight, borderWidth: 1, borderColor: PALETTE.borderTeal, borderRadius: 16, padding: 14 }}>
              <Text style={{ fontSize: 10, fontWeight: '900', textTransform: 'uppercase', color: PALETTE.secondaryTeal, letterSpacing: 1 }}>Customer and delivery</Text>
              <Text style={{ fontSize: 14, fontWeight: '900', color: PALETTE.primaryNavy, marginTop: 4 }}>{order.customer_name} · {order.customer_mobile}</Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: PALETTE.textMain, marginTop: 4 }}>{order.customer_address || 'Address unavailable'}</Text>
              <Text style={{ fontSize: 12, fontWeight: '800', color: PALETTE.secondaryTeal, marginTop: 4 }}>{order.distance_km ? `${order.distance_km} km from store` : 'Distance unavailable'} · {order.delivery_option === 'online' ? 'Home delivery' : 'Walk-in'}</Text>
            </View>
            {order.prescription_medicine_name ? (
              <View style={{ marginTop: 14 }}>
                <Text style={{ fontSize: 10, fontWeight: '900', textTransform: 'uppercase', color: PALETTE.textSecondary, letterSpacing: 1 }}>Prescription request</Text>
                <Text style={{ fontSize: 14, fontWeight: '900', color: PALETTE.primaryNavy, marginTop: 4 }}>{order.prescription_medicine_name}</Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: PALETTE.textMain, marginTop: 2 }}>{order.prescription_description}</Text>
              </View>
            ) : null}
            <View style={{ marginTop: 14 }}>
              <Text style={{ fontSize: 10, fontWeight: '900', textTransform: 'uppercase', color: PALETTE.textSecondary, letterSpacing: 1 }}>Medicines supplied</Text>
              {order.medicines.length ? (
                order.medicines.map((m, i) => (
                  <View key={`${m.name}-${i}`} style={{ marginTop: 8, backgroundColor: PALETTE.cardWhite, borderWidth: 1, borderColor: PALETTE.borderTeal, borderRadius: 14, padding: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '900', color: PALETTE.primaryNavy }}>{m.name}</Text>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: PALETTE.textSecondary, marginTop: 2 }}>{m.brand || 'Brand not specified'} · {m.type}</Text>
                      </View>
                      <Text style={{ fontSize: 13, fontWeight: '900', color: PALETTE.successGreen }}>{m.price ? `₹${m.price}` : 'Price N/A'}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={{ fontSize: 12, fontWeight: '600', color: PALETTE.textSecondary, marginTop: 6 }}>No itemized medicines recorded.</Text>
              )}
            </View>
            <View style={{ marginTop: 16, backgroundColor: PALETTE.primaryNavy, borderRadius: 16, padding: 14 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>Order total</Text>
                <Text style={{ fontSize: 16, fontWeight: '900', color: '#4ADE80' }}>{order.total_amount ? `₹${order.total_amount}` : 'N/A'}</Text>
              </View>
              {order.response_text ? (
                <Text style={{ fontSize: 11.5, fontWeight: '600', color: 'rgba(255, 255, 255, 0.85)', marginTop: 8 }}>Original store quote: {order.response_text}</Text>
              ) : null}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function UserPharmacist() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const r = useRouter();
  const [data, setData] = useState<any>(null);
  const [cat, setCat] = useState('how_to_take');
  const [medicine, setMedicine] = useState('');
  const [question, setQuestion] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getOrderConsultation(Number(orderId))
      .then((x) => {
        if (x.consultation) r.replace(`/pharmacist/consultation/${x.consultation.id}`);
        else setData(x);
      })
      .catch(() => Alert.alert('Could not load', 'Please try again.'));
  }, [orderId, r]);

  if (!data) {
    return (
      <View style={{ flex: 1, backgroundColor: PALETTE.bgLight, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={PALETTE.secondaryTeal} size="large" />
      </View>
    );
  }

  const submit = async () => {
    if (medicine.trim().length < 2 || question.trim().length < 10 || !consent) {
      return Alert.alert('Complete the form', 'Enter medicine, a clear question, and accept the consent.');
    }
    try {
      setBusy(true);
      const x = await createConsultation(Number(orderId), {
        category: cat,
        medicine_name: medicine.trim(),
        question: question.trim(),
        consent,
      });
      r.replace(`/pharmacist/consultation/${x.id}`);
    } catch (e) {
      Alert.alert('Could not start', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: PALETTE.bgLight }} keyboardShouldPersistTaps="handled">
      <Head title="Ask Your Pharmacist" sub={`Direct consultation with ${data.pharmacy_name}`} />
      <View style={{ padding: 16 }}>
        {!data.eligible ? (
          <View style={{ backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 16, padding: 14 }}>
            <Text style={{ fontSize: 14, fontWeight: '900', color: PALETTE.warningAmber }}>Not available yet</Text>
            <Text style={{ fontSize: 11.5, fontWeight: '600', color: PALETTE.textMain, marginTop: 4 }}>{data.reason}</Text>
          </View>
        ) : (
          <>
            <View style={{ backgroundColor: PALETTE.cardWhite, borderWidth: 1, borderColor: PALETTE.borderTeal, borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name={data.pharmacist_available ? 'account-check' : 'account-clock-outline'} size={26} color={data.pharmacist_available ? PALETTE.secondaryTeal : PALETTE.warningAmber} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{ fontSize: 14.5, fontWeight: '900', color: PALETTE.primaryNavy }}>{data.pharmacy_name}</Text>
                <Text style={{ fontSize: 11, fontWeight: '600', color: PALETTE.textSecondary, marginTop: 2 }}>
                  {data.pharmacist_available ? 'Verified pharmacist available' : 'Pharmacist currently offline — leave your question'}
                </Text>
              </View>
            </View>

            <Text style={{ fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2, color: PALETTE.textSecondary, marginTop: 18, marginBottom: 8, marginLeft: 2 }}>Question Category</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {PHARMACIST_CATEGORIES.map((x) => {
                const selected = cat === x.value;
                return (
                  <TouchableOpacity
                    key={x.value}
                    onPress={() => setCat(x.value)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 14,
                      borderWidth: 1,
                      backgroundColor: selected ? PALETTE.cardTealLight : PALETTE.cardWhite,
                      borderColor: selected ? PALETTE.secondaryTeal : PALETTE.borderTeal,
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: selected ? '900' : '700', color: selected ? PALETTE.secondaryTeal : PALETTE.textMain }}>{x.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={{ fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2, color: PALETTE.textSecondary, marginTop: 16, marginBottom: 8, marginLeft: 2 }}>Medicine Name</Text>
            <TextInput
              value={medicine}
              onChangeText={setMedicine}
              placeholder="As written on pack or prescription"
              placeholderTextColor={PALETTE.textSecondary}
              style={{ backgroundColor: PALETTE.cardWhite, borderWidth: 1, borderColor: PALETTE.borderTeal, borderRadius: 16, padding: 14, fontSize: 13, fontWeight: '600', color: PALETTE.textMain }}
            />

            <Text style={{ fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2, color: PALETTE.textSecondary, marginTop: 16, marginBottom: 8, marginLeft: 2 }}>Your Question</Text>
            <TextInput
              value={question}
              onChangeText={setQuestion}
              multiline
              textAlignVertical="top"
              placeholder="Explain what you want to understand about your medicine"
              placeholderTextColor={PALETTE.textSecondary}
              style={{ backgroundColor: PALETTE.cardWhite, borderWidth: 1, borderColor: PALETTE.borderTeal, borderRadius: 16, padding: 14, fontSize: 13, fontWeight: '600', color: PALETTE.textMain, minHeight: 120 }}
            />

            <TouchableOpacity
              onPress={() => setConsent(!consent)}
              activeOpacity={0.88}
              style={{ flexDirection: 'row', marginTop: 16, backgroundColor: PALETTE.cardTealLight, borderWidth: 1, borderColor: PALETTE.borderTeal, borderRadius: 16, padding: 14 }}
            >
              <MaterialCommunityIcons name={consent ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} color={PALETTE.secondaryTeal} />
              <Text style={{ fontSize: 11, fontWeight: '600', color: PALETTE.textMain, lineHeight: 16, flex: 1, marginLeft: 10 }}>
                I understand this is medicine-use guidance, not diagnosis or a new prescription. I will contact a doctor for treatment changes or urgent symptoms.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              disabled={busy}
              onPress={submit}
              activeOpacity={0.88}
              style={{ backgroundColor: PALETTE.secondaryTeal, borderRadius: 18, paddingVertical: 16, alignItems: 'center', marginTop: 20, marginBottom: 30, elevation: 3, shadowColor: PALETTE.secondaryTeal, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 5 }}
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={{ fontSize: 15, fontWeight: '900', color: '#FFFFFF' }}>
                  {data.pharmacist_available ? 'Start Pharmacist Consultation' : 'Leave Question for Pharmacist'}
                </Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
}

export function ConsultationDetail({ seller = false }: { seller?: boolean }) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const focused = useIsFocused();
  const scrollRef = useRef<ScrollView>(null);
  const [x, setX] = useState<Consultation | null>(null);
  const [text, setText] = useState('');
  const [phone, setPhone] = useState('');
  const [time, setTime] = useState('');
  const [busy, setBusy] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);

  const load = useCallback(
    () =>
      getConsultation(Number(id))
        .then((next) => setX((current) => (current && JSON.stringify(current) === JSON.stringify(next) ? current : next)))
        .catch(() => Alert.alert('Could not load', 'Try again.')),
    [id]
  );

  useEffect(() => {
    if (!focused) return;
    load();
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [focused, load]);

  if (!x) return <ActivityIndicator style={{ marginTop: 80 }} color={PALETTE.secondaryTeal} size="large" />;

  const send = async () => {
    if (!text.trim()) return;
    try {
      setBusy(true);
      setX(await sendConsultationMessage(x.id, text.trim()));
      setText('');
    } catch (e) {
      Alert.alert('Could not send', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  const callback = async () => {
    try {
      setBusy(true);
      setX(await requestPharmacistCallback(x.id, phone, time));
      Alert.alert('Callback requested', 'The pharmacy has received your request.');
    } catch (e) {
      Alert.alert('Could not request', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: PALETTE.bgLight }}>
        <Head title={seller ? x.medicine_name : `Ask ${x.pharmacy_name}`} sub={x.status_display} />

        {seller && x.order_context ? (
          <TouchableOpacity
            onPress={() => setOrderOpen(true)}
            activeOpacity={0.88}
            style={{ marginHorizontal: 16, marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderWidth: 1, borderColor: PALETTE.borderTeal, backgroundColor: PALETTE.cardTealLight, paddingVertical: 12 }}
          >
            <MaterialCommunityIcons name="file-document-outline" size={18} color={PALETTE.secondaryTeal} />
            <Text style={{ marginLeft: 8, fontSize: 12, fontWeight: '900', color: PALETTE.primaryNavy }}>View Original Order, Prescription & Medicines</Text>
          </TouchableOpacity>
        ) : null}

        <OrderContextModal order={x.order_context} visible={orderOpen} onClose={() => setOrderOpen(false)} />

        <ScrollView ref={scrollRef} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })} style={{ flex: 1, paddingHorizontal: 16, paddingTop: 12 }}>
          <View style={{ backgroundColor: PALETTE.cardTealLight, borderWidth: 1, borderColor: PALETTE.borderTeal, borderRadius: 16, padding: 14 }}>
            <Text style={{ fontSize: 12, fontWeight: '900', color: PALETTE.primaryNavy }}>Clinical Guidance Boundary</Text>
            <Text style={{ fontSize: 11, fontWeight: '600', color: PALETTE.textMain, lineHeight: 16, marginTop: 3 }}>
              The pharmacist can explain medicine use, timing, storage and precautions. They cannot diagnose or prescribe a new medicine.
            </Text>
          </View>

          {x.messages.map((m) => {
            const isMine = seller ? m.sender_type === 'pharmacist' : m.sender_type === 'user';
            return (
              <View
                key={m.id}
                style={{
                  padding: 14,
                  borderRadius: 18,
                  marginTop: 10,
                  maxWidth: '85%',
                  alignSelf: isMine ? 'flex-end' : 'flex-start',
                  backgroundColor: isMine ? PALETTE.primaryNavy : PALETTE.cardWhite,
                  borderWidth: isMine ? 0 : 1,
                  borderColor: PALETTE.borderTeal,
                  elevation: 1,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: isMine ? '#FFFFFF' : PALETTE.textMain, lineHeight: 18 }}>{m.text}</Text>
                {m.sender_type === 'pharmacist' ? (
                  <Text style={{ fontSize: 9.5, fontWeight: '700', marginTop: 6, color: isMine ? 'rgba(255, 255, 255, 0.8)' : PALETTE.secondaryTeal }}>
                    Verified pharmacist · {m.pharmacist_name}
                  </Text>
                ) : null}
              </View>
            );
          })}

          {!seller && !x.pharmacist_available ? (
            <View style={{ backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 18, padding: 14, marginTop: 16, marginBottom: 20 }}>
              <Text style={{ fontSize: 13, fontWeight: '900', color: PALETTE.warningAmber }}>Pharmacist is currently offline</Text>
              <TouchableOpacity onPress={() => Linking.openURL('tel:' + x.pharmacy_phone)} style={{ marginTop: 10, borderWidth: 1, borderColor: '#FDE68A', borderRadius: 12, paddingVertical: 10, alignItems: 'center', backgroundColor: '#FFFFFF' }}>
                <Text style={{ fontSize: 12, fontWeight: '900', color: PALETTE.primaryNavy }}>Call Pharmacy</Text>
              </TouchableOpacity>
              <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="Callback phone number" placeholderTextColor={PALETTE.textSecondary} style={{ backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, marginTop: 10, fontSize: 13, color: PALETTE.textMain }} />
              <TextInput value={time} onChangeText={setTime} placeholder="Preferred time (optional)" placeholderTextColor={PALETTE.textSecondary} style={{ backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, marginTop: 8, fontSize: 13, color: PALETTE.textMain }} />
              <TouchableOpacity onPress={callback} style={{ backgroundColor: PALETTE.primaryNavy, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 10 }}>
                <Text style={{ fontSize: 13, fontWeight: '900', color: '#FFFFFF' }}>Request Callback</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>

        {x.status !== 'closed' && (seller ? x.pharmacist_verified && x.pharmacist_available : true) ? (
          <View
            style={{
              paddingHorizontal: 14,
              paddingTop: 12,
              paddingBottom: Platform.OS === 'ios' ? 78 : 68,
              backgroundColor: PALETTE.cardWhite,
              borderTopWidth: 1,
              borderTopColor: PALETTE.borderTeal,
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
              placeholder={seller ? 'Reply as verified pharmacist...' : 'Ask a follow-up question...'}
              placeholderTextColor={PALETTE.textSecondary}
              style={{ flex: 1, backgroundColor: PALETTE.bgLight, borderWidth: 1, borderColor: PALETTE.borderTeal, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, color: PALETTE.textMain, maxHeight: 100 }}
            />
            <TouchableOpacity disabled={busy} onPress={send} style={{ width: 44, height: 44, backgroundColor: PALETTE.secondaryTeal, borderRadius: 22, marginLeft: 10, alignItems: 'center', justifyContent: 'center' }}>
              <MaterialCommunityIcons name="send" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

export function PharmacistInbox() {
  const r = useRouter();
  const focus = useIsFocused();
  const [list, setList] = useState<Consultation[]>([]);
  const [a, setA] = useState<any>(null);
  const [pn, setPn] = useState('');
  const [pl, setPl] = useState('');

  const load = useCallback(
    () =>
      Promise.all([getStoreConsultations(), getPharmacistAvailability()])
        .then(([l, v]) => {
          setList(l);
          setA(v);
          setPn(v.pharmacist_name || '');
          setPl(v.license_number || '');
        })
        .catch(() => Alert.alert('Could not load', 'Try again.')),
    []
  );

  useEffect(() => {
    if (!focus) return;
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [focus, load]);

  if (!a) return <ActivityIndicator style={{ marginTop: 80 }} color={PALETTE.secondaryTeal} size="large" />;

  return (
    <View style={{ flex: 1, backgroundColor: PALETTE.bgLight }}>
      <Head title="Pharmacist Consultations" sub="Direct consultation requests from verified customer orders." />

      <View style={{ marginHorizontal: 16, marginTop: 12, backgroundColor: PALETTE.cardWhite, borderWidth: 1, borderColor: PALETTE.borderTeal, borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14.5, fontWeight: '900', color: PALETTE.primaryNavy }}>
            {a.verified ? a.pharmacist_name || 'Verified Pharmacist' : 'Verification Required'}
          </Text>
          <Text style={{ fontSize: 11, fontWeight: '600', color: PALETTE.textSecondary, marginTop: 2 }}>
            {a.verified ? 'Control whether the pharmacist is online to reply' : 'Add pharmacist details for AARX admin verification'}
          </Text>
        </View>
        <Switch
          disabled={!a.verified}
          value={a.available}
          trackColor={{ false: '#CBD5E1', true: PALETTE.borderTeal }}
          thumbColor={a.available ? PALETTE.secondaryTeal : '#F8FAFC'}
          onValueChange={async (v) => {
            try {
              await setPharmacistAvailability(v);
              setA({ ...a, available: v });
            } catch {
              Alert.alert('Could not update');
            }
          }}
        />
      </View>

      {!a.verified ? (
        <View style={{ marginHorizontal: 16, marginTop: 12, backgroundColor: PALETTE.cardWhite, borderWidth: 1, borderColor: PALETTE.borderTeal, borderRadius: 18, padding: 14 }}>
          <Text style={{ fontSize: 14, fontWeight: '900', color: PALETTE.primaryNavy }}>Submit Pharmacist Registration</Text>
          <TextInput value={pn} onChangeText={setPn} placeholder="Registered pharmacist full name" placeholderTextColor={PALETTE.textSecondary} style={{ backgroundColor: PALETTE.bgLight, borderWidth: 1, borderColor: PALETTE.borderTeal, borderRadius: 14, padding: 12, marginTop: 10, fontSize: 13, color: PALETTE.textMain }} />
          <TextInput value={pl} onChangeText={setPl} placeholder="Pharmacist registration number" placeholderTextColor={PALETTE.textSecondary} style={{ backgroundColor: PALETTE.bgLight, borderWidth: 1, borderColor: PALETTE.borderTeal, borderRadius: 14, padding: 12, marginTop: 8, fontSize: 13, color: PALETTE.textMain }} />
          <TouchableOpacity
            onPress={async () => {
              try {
                const v = await submitPharmacistDetails(pn, pl);
                setA(v);
                Alert.alert('Submitted', 'AARX admin will verify the pharmacist registration.');
              } catch (e) {
                Alert.alert('Could not submit', e instanceof Error ? e.message : 'Check the details.');
              }
            }}
            style={{ backgroundColor: PALETTE.primaryNavy, borderRadius: 14, paddingVertical: 12, alignItems: 'center', marginTop: 12 }}
          >
            <Text style={{ fontSize: 13, fontWeight: '900', color: '#FFFFFF' }}>Submit for AARX Verification</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <FlatList
        data={list}
        keyExtractor={(x) => String(x.id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 }}
        ListEmptyComponent={<Text style={{ textAlign: 'center', color: PALETTE.textSecondary, marginTop: 40, fontSize: 13, fontWeight: '600' }}>No pharmacist questions yet.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => r.push(`/pharmacist/${item.id}`)} activeOpacity={0.88} style={{ backgroundColor: PALETTE.cardWhite, borderWidth: 1, borderColor: PALETTE.borderTeal, borderRadius: 18, padding: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ backgroundColor: PALETTE.cardTealLight, borderWidth: 1, borderColor: PALETTE.borderTeal, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ fontSize: 10, fontWeight: '900', color: PALETTE.secondaryTeal }}>{item.status_display}</Text>
              </View>
              <Text style={{ fontSize: 10, fontWeight: '800', color: PALETTE.textSecondary }}>ORDER #{item.order_id}</Text>
            </View>

            <Text style={{ fontSize: 15, fontWeight: '900', color: PALETTE.primaryNavy, marginTop: 8 }}>{item.medicine_name}</Text>
            <Text numberOfLines={2} style={{ fontSize: 11.5, fontWeight: '600', color: PALETTE.textSecondary, marginTop: 4, lineHeight: 16 }}>{item.question}</Text>

            {item.callback_requested ? (
              <View style={{ marginTop: 8, backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: PALETTE.warningAmber }}>
                  Callback requested · {item.callback_preferred_time || 'No preferred time'}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
