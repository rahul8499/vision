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
  Alert,
  BackHandler,
  Keyboard
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
  const [inputFocused, setInputFocused] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const flatRef = useRef<FlatList>(null);

  useEffect(() => {
    if (messages.length) flatRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [messages.length]);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (inputFocused || keyboardVisible) {
        Keyboard.dismiss();
        setInputFocused(false);
        return true;
      }
      return false;
    });

    return () => sub.remove();
  }, [inputFocused, keyboardVisible]);

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
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      enabled={Platform.OS === 'ios'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={(i) => i.id.toString()}
        renderItem={renderItem}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ padding: 12, paddingBottom: 24, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: true })}
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

      <View style={[styles.composer, disabled && { opacity: 0.6 }, { marginTop: -6 }]}>
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
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
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
  bubbleMine: { backgroundColor: '#E8F4F5', borderTopRightRadius: 6, borderWidth: 1, borderColor: '#B9DDE0' },
  bubbleOther: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 6, borderWidth: 1, borderColor: '#B9DDE0' },
  bubbleText: { fontSize: 15, lineHeight: 20, fontWeight: '500' },
  textMine: { color: '#102A43' },
  textOther: { color: '#102A43' },
  time: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  timeMine: { color: '#0F8B8D' },
  timeOther: { color: '#627D98' },
  image: { width: 200, height: 200, borderRadius: 12, marginBottom: 4 },
  platformWrap: { alignItems: 'center', marginVertical: 6 },
  platformText: {
    backgroundColor: '#F4F8FA',
    color: '#627D98',
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
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 78 : 68,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: '#B9DDE0',
  },
  iconBtn: { padding: 8 },
  input: {
    flex: 1,
    backgroundColor: '#F4F8FA',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#B9DDE0',
    fontSize: 15,
    color: '#102A43',
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#0F8B8D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPreview: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 8, borderTopWidth: 1, borderColor: '#B9DDE0' },
  photoThumb: { width: 44, height: 44, borderRadius: 8 },
  photoRemove: { marginHorizontal: 8 },
  photoLabel: { fontSize: 12, color: '#627D98', fontWeight: '700' },
});
