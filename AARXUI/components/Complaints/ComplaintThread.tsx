import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/Language/LocalizedPrimitives';
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import type { ComplaintMessage, LocalAttachment } from '@/utils/complaintsApi';

export function ComplaintThread({
  messages,
  userType,
  BASE_URL,
  onSend,
  disabled,
}: {
  messages: ComplaintMessage[];
  userType: 'user' | 'store';
  BASE_URL: string;
  onSend: (text: string, attachment: LocalAttachment | null) => Promise<void>;
  disabled?: boolean;
}) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<LocalAttachment | null>(null);
  const flatRef = useRef<FlatList>(null);

  useEffect(() => {
    if (messages.length) flatRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [messages.length]);

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      const a = result.assets[0];
      setPendingPhoto({
        uri: a.uri,
        name: a.fileName || `photo_${Date.now()}.jpg`,
        type: a.mimeType || 'image/jpeg',
      });
    }
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed && !pendingPhoto) return;
    if (sending) return;
    setSending(true);
    try {
      await onSend(trimmed, pendingPhoto);
      setText('');
      setPendingPhoto(null);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not send message.');
    } finally {
      setSending(false);
    }
  };

  const renderItem = ({ item }: { item: ComplaintMessage }) => {
    if (item.sender_type === 'platform') {
      return (
        <View style={styles.platformWrap}>
          <Text style={styles.platformText}>
            {item.text || (item.attachment_url ? 'Sent an attachment' : '')}
          </Text>
        </View>
      );
    }
    const mine = item.sender_type === userType;
    return (
      <View style={[styles.row, mine ? styles.rowMine : styles.rowOther]}>
        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
          {item.text ? <Text style={[styles.bubbleText, mine ? styles.textMine : styles.textOther]}>{item.text}</Text> : null}
          {item.attachment_url ? (
            <Image
              source={{ uri: item.attachment_url.startsWith('http') ? item.attachment_url : `${BASE_URL}${item.attachment_url}` }}
              style={styles.image}
              contentFit="cover"
            />
          ) : null}
          <Text style={[styles.time, mine ? styles.timeMine : styles.timeOther]}>
            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={(i) => i.id.toString()}
        renderItem={renderItem}
        inverted
        contentContainerStyle={{ padding: 12, flexGrow: 1, justifyContent: 'flex-end' }}
        showsVerticalScrollIndicator={false}
      />

      {pendingPhoto ? (
        <View style={styles.photoPreview}>
          <Image source={{ uri: pendingPhoto.uri }} style={styles.photoThumb} contentFit="cover" />
          <TouchableOpacity onPress={() => setPendingPhoto(null)} style={styles.photoRemove}>
            <Ionicons name="close-circle" size={20} color="#ef4444" />
          </TouchableOpacity>
          <Text style={styles.photoLabel}>Photo ready to send</Text>
        </View>
      ) : null}

      <View style={[styles.composer, disabled && { opacity: 0.6 }]}>
        <TouchableOpacity onPress={pickPhoto} disabled={disabled} style={styles.iconBtn}>
          <Ionicons name="image-outline" size={22} color="#0e7490" />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder={disabled ? 'Conversation closed' : 'Type a message…'}
          value={text}
          onChangeText={setText}
          editable={!disabled}
          multiline
        />
        <TouchableOpacity onPress={handleSend} disabled={disabled || sending} style={styles.sendBtn}>
          {sending ? <ActivityIndicator color="#fff" /> : <Ionicons name="send" size={18} color="#fff" />}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginBottom: 8 },
  rowMine: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18 },
  bubbleMine: { backgroundColor: '#ecfdf5', borderTopRightRadius: 6, borderWidth: 1, borderColor: '#bbf7d0' },
  bubbleOther: { backgroundColor: '#ffffff', borderTopLeftRadius: 6, borderWidth: 1, borderColor: '#e2e8f0' },
  bubbleText: { fontSize: 15, lineHeight: 20, fontWeight: '500' },
  textMine: { color: '#064e3b' },
  textOther: { color: '#0f172a' },
  time: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  timeMine: { color: '#059669' },
  timeOther: { color: '#94a3b8' },
  image: { width: 200, height: 200, borderRadius: 12, marginBottom: 4 },
  platformWrap: { alignItems: 'center', marginVertical: 6 },
  platformText: {
    backgroundColor: '#f1f5f9',
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    maxWidth: '85%',
    textAlign: 'center',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 14,
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderColor: '#e2e8f0',
  },
  iconBtn: { padding: 8 },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    fontSize: 15,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPreview: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 8, borderTopWidth: 1, borderColor: '#e2e8f0' },
  photoThumb: { width: 44, height: 44, borderRadius: 8 },
  photoRemove: { marginHorizontal: 8 },
  photoLabel: { fontSize: 12, color: '#475569', fontWeight: '700' },
});
