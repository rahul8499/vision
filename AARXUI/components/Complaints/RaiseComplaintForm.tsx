import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/Language/LocalizedPrimitives';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import Constants from 'expo-constants';
import {
  COMPLAINT_CATEGORIES,
  COMPLAINT_PRIORITIES,
  createComplaint,
  type ComplaintDetail,
  type ComplaintParty,
  type LocalAttachment,
} from '@/utils/complaintsApi';

const BASE_URL = (Constants.expoConfig?.extra?.BASE_URL as string) || '';

type Counterparty = { id: number; name: string };

export function RaiseComplaintForm({
  userType,
  prefill,
  onSubmitted,
  onCancel,
}: {
  userType: 'user' | 'store';
  prefill?: {
    respondent_type?: ComplaintParty;
    respondent_id?: number;
    respondent_name?: string;
    order_id?: number;
    order_label?: string;
  };
  onSubmitted: (detail: ComplaintDetail) => void;
  onCancel?: () => void;
}) {
  const [respondentType, setRespondentType] = useState<ComplaintParty>(
    prefill?.respondent_type || (userType === 'user' ? 'store' : 'user')
  );
  const [respondentId, setRespondentId] = useState<number | null>(prefill?.respondent_id ?? null);
  const [respondentName, setRespondentName] = useState<string>(prefill?.respondent_name ?? '');
  const [orderId, setOrderId] = useState<number | null>(prefill?.order_id ?? null);
  const [orderLabel, setOrderLabel] = useState<string | null>(prefill?.order_label ?? null);

  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('medium');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);

  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [loadingCounterparties, setLoadingCounterparties] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const targetLabel = respondentType === 'store' ? 'Pharmacy / Store' : 'Customer / User';
  const lockedTarget = !!prefill?.respondent_id;

  const loadCounterparties = useCallback(async (query?: string) => {
    const token = await SecureStore.getItemAsync('authToken');
    const headers = { Authorization: `Bearer ${token || ''}` };
    try {
      setLoadingCounterparties(true);
      if (userType === 'user') {
        const url = query
          ? `${BASE_URL}/api/stores/?search=${encodeURIComponent(query)}`
          : `${BASE_URL}/api/stores/`;
        const res = await axios.get(url, { headers });
        const list = (res.data?.results || res.data || []).map((s: any) => ({ id: s.id, name: s.name }));
        setCounterparties(list.slice(0, 50));
      } else {
        const res = await axios.get(`${BASE_URL}/api/store/my-responses/`, { headers });
        const responses: any[] = res.data?.results || res.data || [];
        const map = new Map<number, string>();
        responses.forEach((r) => {
          const userId = r?.user_id || (typeof r?.user === 'object' ? r.user?.id : r?.user);
          if (userId && r?.user_name) map.set(Number(userId), r.user_name);
        });
        setCounterparties(Array.from(map.entries()).map(([id, name]) => ({ id, name })).slice(0, 100));
      }
    } catch (e) {
      setCounterparties([]);
    } finally {
      setLoadingCounterparties(false);
    }
  }, [userType]);

  useEffect(() => {
    if (!lockedTarget && pickerOpen) {
      loadCounterparties(search);
    }
  }, [pickerOpen, search, loadCounterparties, lockedTarget]);

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      const a = result.assets[0];
      setAttachments((prev) => [
        ...prev,
        { uri: a.uri, name: a.fileName || `photo_${Date.now()}.jpg`, type: a.mimeType || 'image/jpeg' },
      ]);
    }
  };

  const handleSubmit = async () => {
    const missing: string[] = [];
    if (!respondentId) missing.push(`Select ${targetLabel.toLowerCase()}`);
    if (!category) missing.push('Select a category');
    if (!subject.trim()) missing.push('Add a short subject');
    if (!description.trim()) missing.push('Describe the issue in detail');
    if (submitting) return;

    if (missing.length > 0) {
      Alert.alert('More details needed', 'Please complete the following:\n\n• ' + missing.join('\n• '));
      return;
    }

    setSubmitting(true);
    try {
      const detail = await createComplaint({
        respondent_type: respondentType,
        respondent_id: respondentId,
        category,
        subject: subject.trim(),
        description: description.trim(),
        priority,
        order_id: orderId,
        attachments,
      });
      onSubmitted(detail);
    } catch (e: any) {
      let msg = 'Could not submit complaint.';
      try {
        const parsed = typeof e?.message === 'string' ? JSON.parse(e.message) : null;
        if (parsed) msg = JSON.stringify(parsed);
      } catch {}
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      {orderLabel ? (
        <View style={styles.orderBox}>
          <Ionicons name="receipt-outline" size={16} color="#0e7490" />
          <Text style={styles.orderText}>Regarding: {orderLabel}</Text>
        </View>
      ) : null}

      {/* Target */}
      <Text style={styles.label}>Complaint against</Text>
      {lockedTarget ? (
        <View style={styles.lockedTarget}>
          <Ionicons name={respondentType === 'store' ? 'storefront' : 'person'} size={18} color="#0e7490" />
          <Text style={styles.lockedTargetText}>{respondentName}</Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.targetBtn} onPress={() => setPickerOpen(true)}>
          <Text style={styles.targetBtnText}>
            {respondentId ? respondentName : `Select ${targetLabel}`}
          </Text>
          <Ionicons name="chevron-down" size={20} color="#64748b" />
        </TouchableOpacity>
      )}

      {pickerOpen && !lockedTarget && (
        <View style={styles.picker}>
          {userType === 'user' && (
            <TextInput
              style={styles.searchInput}
              placeholder="Search pharmacy by name…"
              value={search}
              onChangeText={setSearch}
            />
          )}
          {loadingCounterparties ? (
            <ActivityIndicator style={{ marginVertical: 10 }} color="#059669" />
          ) : (
            <ScrollView style={styles.pickerList} keyboardShouldPersistTaps="handled">
              {counterparties.length === 0 ? (
                <Text style={styles.empty}>No {targetLabel.toLowerCase()} found.</Text>
              ) : (
                counterparties.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={styles.pickerItem}
                    onPress={() => {
                      setRespondentId(c.id);
                      setRespondentName(c.name);
                      setPickerOpen(false);
                    }}
                  >
                    <Text style={styles.pickerItemText}>{c.name}</Text>
                    <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          )}
        </View>
      )}

      {/* Category */}
      <Text style={styles.label}>Category</Text>
      <View style={styles.chipRow}>
        {COMPLAINT_CATEGORIES.map((c) => (
          <TouchableOpacity
            key={c.value}
            style={[styles.chip, category === c.value && styles.chipActive]}
            onPress={() => setCategory(c.value)}
          >
            <Text style={[styles.chipText, category === c.value && styles.chipTextActive]}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Subject */}
      <Text style={styles.label}>Subject</Text>
      <TextInput
        style={styles.input}
        placeholder="Short title of the issue"
        value={subject}
        onChangeText={setSubject}
        maxLength={200}
      />

      {/* Priority */}
      <Text style={styles.label}>Priority</Text>
      <View style={styles.chipRow}>
        {COMPLAINT_PRIORITIES.map((p) => (
          <TouchableOpacity
            key={p.value}
            style={[styles.chip, priority === p.value && styles.chipActive]}
            onPress={() => setPriority(p.value)}
          >
            <Text style={[styles.chipText, priority === p.value && styles.chipTextActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Description */}
      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Explain the issue in detail…"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={5}
        textAlignVertical="top"
      />

      {/* Attachments */}
      <View style={styles.attachHeader}>
        <Text style={styles.label}>Attachments (optional)</Text>
        <TouchableOpacity onPress={pickPhoto} style={styles.addPhoto}>
          <Ionicons name="camera-outline" size={16} color="#0e7490" />
          <Text style={styles.addPhotoText}>Add photo</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.thumbs}>
        {attachments.map((a, idx) => (
          <View key={idx} style={styles.thumbWrap}>
            <Image source={{ uri: a.uri }} style={styles.thumb} contentFit="cover" />
            <TouchableOpacity style={styles.thumbRemove} onPress={() => setAttachments((p) => p.filter((_, i) => i !== idx))}>
              <Ionicons name="close-circle" size={18} color="#ef4444" />
            </TouchableOpacity>
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        {onCancel ? (
          <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={onCancel}>
            <Text style={styles.btnGhostText}>Cancel</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={[styles.btn, styles.btnPrimary, submitting && { opacity: 0.7 }]} onPress={handleSubmit}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Submit Complaint</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  orderBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ecfeff', padding: 10, borderRadius: 12, marginBottom: 14 },
  orderText: { marginLeft: 8, color: '#0e7490', fontWeight: '800', fontSize: 13 },
  label: { fontSize: 13, fontWeight: '800', color: '#334155', marginTop: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  lockedTarget: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  lockedTargetText: { marginLeft: 8, fontSize: 15, fontWeight: '800', color: '#0f172a' },
  targetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  targetBtnText: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  picker: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginTop: 8, padding: 8 },
  searchInput: { backgroundColor: '#f1f5f9', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, marginBottom: 6 },
  pickerList: { maxHeight: 220 },
  pickerItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#f1f5f9' },
  pickerItemText: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  empty: { textAlign: 'center', color: '#94a3b8', paddingVertical: 16 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  chip: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, margin: 4 },
  chipActive: { backgroundColor: '#059669', borderColor: '#059669' },
  chipText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  chipTextActive: { color: '#fff' },
  input: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, borderWidth: 1, borderColor: '#e2e8f0' },
  textArea: { minHeight: 110, paddingTop: 12 },
  attachHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  addPhoto: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ecfeff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  addPhotoText: { marginLeft: 4, color: '#0e7490', fontWeight: '800', fontSize: 12 },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  thumbWrap: { position: 'relative', marginRight: 8, marginBottom: 8 },
  thumb: { width: 72, height: 72, borderRadius: 10 },
  thumbRemove: { position: 'absolute', top: -6, right: -6, backgroundColor: '#fff', borderRadius: 10 },
  actions: { flexDirection: 'row', marginTop: 20 },
  btn: { flex: 1, borderRadius: 14, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', marginHorizontal: 4 },
  btnPrimary: { backgroundColor: '#059669' },
  btnPrimaryText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  btnGhost: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  btnGhostText: { color: '#475569', fontWeight: '800', fontSize: 16 },
});
