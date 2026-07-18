import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/Language/LocalizedPrimitives';
import React, { useState } from 'react';
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
import {
  COMPLAINT_CATEGORIES,
  COMPLAINT_PRIORITIES,
  createComplaint,
  type ComplaintDetail,
  type ComplaintParty,
  type LocalAttachment,
} from '@/utils/complaintsApi';

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
  const respondentType = prefill?.respondent_type || (userType === 'user' ? 'store' : 'user');
  const respondentId = prefill?.respondent_id ?? null;
  const respondentName = prefill?.respondent_name || (respondentType === 'store' ? 'Selected pharmacy' : 'Selected customer');
  const orderId = prefill?.order_id ?? null;
  const orderLabel = prefill?.order_label || (orderId ? `Order #${orderId}` : null);

  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('medium');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);

  const [submitting, setSubmitting] = useState(false);

  const hasComplaintContext = !!respondentId && !!orderId;

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
    if (!respondentId || !orderId) {
      Alert.alert('Choose an order', 'Open the complaint from its related enquiry or order card.');
      return;
    }

    const missing: string[] = [];
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
      {hasComplaintContext && orderLabel ? (
        <View style={styles.orderBox}>
          <Ionicons name="receipt-outline" size={16} color="#0e7490" />
          <Text style={styles.orderText}>Regarding: {orderLabel}</Text>
        </View>
      ) : null}

      {/* Target */}
      <Text style={styles.label}>Complaint against</Text>
      {hasComplaintContext ? (
        <View style={styles.lockedTarget}>
          <Ionicons name={respondentType === 'store' ? 'storefront' : 'person'} size={18} color="#0e7490" />
          <Text style={styles.lockedTargetText}>{respondentName}</Text>
        </View>
      ) : (
        <View style={styles.contextWarning}>
          <Ionicons name="information-circle-outline" size={20} color="#b45309" />
          <View style={styles.contextWarningBody}>
            <Text style={styles.contextWarningTitle}>Select the related transaction first</Text>
            <Text style={styles.contextWarningText}>
              Go back and use Raise Complaint on the specific enquiry or order card. The related {userType === 'user' ? 'pharmacy' : 'customer'} will be selected automatically.
            </Text>
          </View>
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
        <TouchableOpacity
          disabled={!hasComplaintContext || submitting}
          style={[styles.btn, styles.btnPrimary, (!hasComplaintContext || submitting) && { opacity: 0.5 }]}
          onPress={handleSubmit}
        >
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
  contextWarning: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#fffbeb', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#fde68a' },
  contextWarningBody: { flex: 1, marginLeft: 10 },
  contextWarningTitle: { fontSize: 14, fontWeight: '900', color: '#92400e' },
  contextWarningText: { marginTop: 4, fontSize: 12, lineHeight: 18, fontWeight: '600', color: '#b45309' },
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
